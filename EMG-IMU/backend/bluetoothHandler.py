import asyncio
import json
import time
import traceback

from bleak import BleakScanner, BleakClient
from bleak.exc import BleakError

from Runs.extensions import socketio
from Imports.state import state

# Keys we look for when extracting a single IMU reading from a parsed packet.
IMU_FIELDS = ("ax", "ay", "az", "gx", "gy", "gz")
NUM_IMUS = 2

DEVICE_NAME = "ESP32_EMG_IMU"
UART_TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
RECONNECT_DELAY_S = 3

# Buffer for assembling newline-terminated JSON lines out of BLE notification chunks.
_data_buffer = ""


def _extract_imu_reading(obj):
    """Pull ax/ay/az/gx/gy/gz out of a dict, defaulting missing fields to None."""
    if not isinstance(obj, dict):
        return None
    if not any(key in obj for key in IMU_FIELDS):
        return None
    return {key: obj.get(key) for key in IMU_FIELDS}


def _extract_imus(parsed):
    """
    Normalize IMU data into a fixed-length list of NUM_IMUS readings
    (missing/failed IMUs become None), regardless of whether the packet
    sent a single 'imu' object or a list under 'imus'.
    """
    slots = [None] * NUM_IMUS

    if "imus" in parsed and isinstance(parsed["imus"], list):
        for i, item in enumerate(parsed["imus"][:NUM_IMUS]):
            slots[i] = _extract_imu_reading(item)
        return slots

    if "imu" in parsed:
        slots[0] = _extract_imu_reading(parsed["imu"])
        return slots

    # Flattened top-level fallback (e.g. {"emg1":..., "ax":..., "ay":...})
    slots[0] = _extract_imu_reading(parsed)
    return slots


def _flatten_imu_row(imus):
    """Flatten a list of IMU readings into CSV-friendly columns."""
    row = []
    for imu in imus:
        for key in IMU_FIELDS:
            row.append(imu.get(key, "") if imu else "")
    return row


def _process_line(line):
    """Same per-line handling read_serial() used to do: parse, emit, optionally write CSV."""
    line = line.strip()
    if not line:
        return

    try:
        parsed = json.loads(line)
    except json.JSONDecodeError:
        parsed = None

    payload = {"raw": line}

    if isinstance(parsed, dict):
        imus = _extract_imus(parsed)
        if imus:
            payload["imus"] = imus

    socketio.emit("sensor_data", payload)

    if state.is_recording and state.csv_writer and isinstance(parsed, dict):
        try:
            emg1 = parsed.get("emg1", "")
            emg2 = parsed.get("emg2", "")
            imus = _extract_imus(parsed)
            row = [time.time(), emg1, emg2] + _flatten_imu_row(imus)
            state.csv_writer.writerow(row)
            state.csv_file.flush()
        except Exception as csv_error:
            print(f"CSV write error: {csv_error}")


def _notification_handler(sender, data):
    """Bleak calls this synchronously for every BLE notification chunk."""
    global _data_buffer
    try:
        _data_buffer += data.decode("utf-8", errors="ignore")
        while "\n" in _data_buffer:
            line, _data_buffer = _data_buffer.split("\n", 1)
            _process_line(line)
    except Exception as error:
        print(f"Error handling BLE notification: {error}")


async def connect_ble():
    """Scan for the device and return a connected BleakClient, or None on failure."""
    print(f"Scanning for BLE device named '{DEVICE_NAME}'...")
    device = await BleakScanner.find_device_by_name(DEVICE_NAME, timeout=10.0)

    if not device:
        print(f"Could not find device named '{DEVICE_NAME}'.")
        return None

    print(f"Device found! [Address: {device.address}] Connecting...")

    disconnected_event = asyncio.Event()

    def on_disconnect(client):
        print("BLE device disconnected.")
        disconnected_event.set()

    client = BleakClient(device, disconnected_callback=on_disconnect)
    try:
        await client.connect()
    except BleakError as error:
        print(f"BLE connection failed: {error}")
        return None

    if not client.is_connected:
        print("Failed to connect to BLE device.")
        return None

    state.ble_client = client
    print(f"Connected to {DEVICE_NAME} (MTU: {client.mtu_size})")
    return client, disconnected_event


async def _ble_loop():
    """Scan/connect/stream, reconnecting on drop - the async equivalent of read_serial()'s while loop."""
    global _data_buffer

    while True:
        _data_buffer = ""
        result = await connect_ble()

        if result is None:
            await asyncio.sleep(RECONNECT_DELAY_S)
            continue

        client, disconnected_event = result
        try:
            await client.start_notify(UART_TX_CHAR_UUID, _notification_handler)
            print("start_notify succeeded, waiting for data...")   # <-- add this
            await disconnected_event.wait()
        except BleakError as error:
            print(f"BLE error: {error}")
        finally:
            try:
                await client.disconnect()
            except Exception:
                pass
            state.ble_client = None

        print(f"Retrying in {RECONNECT_DELAY_S}s...")
        await asyncio.sleep(RECONNECT_DELAY_S)


def read_ble():
    """
    Entry point for socketio.start_background_task(read_ble), matching how
    read_serial() was wired up. Runs its own asyncio event loop inside the
    background thread since bleak requires asyncio.
    """
    try:
        asyncio.run(_ble_loop())
    except Exception:
        print("Unexpected BLE loop error:")
        traceback.print_exc()