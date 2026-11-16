import time
import serial
from serial import SerialException

from Runs.extensions import socketio
from Imports.state import state
import calibration
from Camera import recording
import sensorPacket
import simulatedSensor

RECONNECT_DELAY_S = 3
READ_CHUNK = 4096

OLD_FIRMWARE_WARNING = (
    "Sensor connected, but its data isn't recognised. The ESP32 is probably "
    "running old firmware: flash arduino/ESP-32.txt to it."
)


def _process_packet(packet_bytes):
    p = sensorPacket.unpack(packet_bytes)
    seq, fresh = p["seq"], p["imu_fresh"]
    raw_imus = p["imus"]
    # Only IMUs actually read on this sample; the others repeat the last reading.
    fresh_imus = [imu if fresh & (1 << i) else None for i, imu in enumerate(raw_imus)]

    calibration.process_sample(fresh_imus)
    imus = raw_imus if calibration.is_calibrating() else calibration.apply_offsets(raw_imus)
    socketio.emit("sensor_data", {"emg1": p["emg1"], "emg2": p["emg2"], "imus": imus})

    if state.is_recording:
        now = time.time()
        recording.note_sample(seq)
        recording.write_emg_row(now, seq, p["emg1"], p["emg2"])
        if fresh:
            recording.write_imu_row(now, seq, fresh_imus)


def _handle_bytes(parser, data):
    for packet in parser.feed(data):
        _process_packet(packet)
    if parser.looks_like_old_firmware():
        if state.sensor_warning != OLD_FIRMWARE_WARNING:
            print(OLD_FIRMWARE_WARNING)
        state.sensor_warning = OLD_FIRMWARE_WARNING
    elif parser.packets:
        state.sensor_warning = None


def read_ble():
    while True:
        ser = None
        port = state.comport
        if not port:
            # Nothing chosen or detected yet; wait for the user to pick a port.
            socketio.sleep(1)
            continue
        parser = sensorPacket.StreamParser()
        state.sensor_warning = None
        if port == simulatedSensor.SIMULATED_PORT:
            simulatedSensor.run(lambda: state.comport == port,
                                lambda data: _handle_bytes(parser, data),
                                sleep=socketio.sleep)
            continue
        try:
            print(f"Connecting to Bluetooth Classic stream on {port}...")
            ser = serial.Serial(port, timeout=2.0)
            print(f"Bluetooth Classic connected on {port}.")
            state.ser = ser

            # Leave the loop when the port is changed in the UI so we reconnect
            # to the new one (checked at least every read timeout).
            while ser.is_open and state.comport == port:
                # Read whatever has arrived (at least 1 byte, waiting up to the timeout).
                data = ser.read(max(1, min(ser.in_waiting, READ_CHUNK)))
                if data:
                    _handle_bytes(parser, data)
        except SerialException as error:
            print(f"Bluetooth Classic connection failed on {port}: {error}")
        except Exception as error:
            print(f"Bluetooth Classic stream error: {error}")
        finally:
            state.ser = None
            state.sensor_warning = None
            if ser is not None:
                ser.close()
        if state.comport == port:  # failed or dropped; switching ports retries immediately
            socketio.sleep(RECONNECT_DELAY_S)


def main():
    """Run the Classic reader directly for a quick terminal test."""
    try:
        read_ble()
    except KeyboardInterrupt:
        print("\nClosing connection.")


if __name__ == "__main__":
    main()
