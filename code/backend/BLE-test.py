import asyncio
import struct
from bleak import BleakScanner, BleakClient

# Must exactly match your ESP32 configuration
TARGET_NAME = "ESP32_EMG_IMU_1KHZ"
TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

def notification_handler(sender, data):
    """
    Triggers every time the ESP32 issues a notification.
    Unpacks the compact 28-byte binary packet.
    """
    # Verify the packet is the correct size before unpacking
    if len(data) == 28:
        # < = Little Endian
        # H = uint16_t (2 bytes)
        # h = int16_t (2 bytes)
        # Structure: emg1 (H), emg2 (H), then 6 int16 (h) for IMU0, 6 int16 (h) for IMU1
        packet_format = "<HH hhhhhh hhhhhh"
        unpacked = struct.unpack(packet_format, data)
        
        emg1 = unpacked[0]
        emg2 = unpacked[1]
        
        # IMU 0 Data
        ax0, ay0, az0 = unpacked[2], unpacked[3], unpacked[4]
        gx0, gy0, gz0 = unpacked[5], unpacked[6], unpacked[7]
        
        # IMU 1 Data
        ax1, ay1, az1 = unpacked[8], unpacked[9], unpacked[10]
        gx1, gy1, gz1 = unpacked[11], unpacked[12], unpacked[13]
        
        # Print cleanly to the laptop console
        print(f"EMG: [{emg1}, {emg2}] | IMU0 Acc: [{ax0},{ay0},{az0}] Gyro: [{gx0},{gy0},{gz0}] | IMU1 Acc: [{ax1},{ay1},{az1}]")
    else:
        print(f"Warning: Received mismatched packet size of {len(data)} bytes.")

async def main():
    print(f"Scanning for BLE device named '{TARGET_NAME}'...")
    device = await BleakScanner.find_device_by_filter(
        lambda d, ad: d.name == TARGET_NAME
    )
    
    if not device:
        print(f"Could not find device '{TARGET_NAME}'. Is it powered on?")
        return

    print(f"Found {TARGET_NAME} [{device.address}]. Connecting and pulling GATT map...")
    
    # Establish connection bypassing native OS wrappers
    async with BleakClient(device) as client:
        if client.is_connected:
            print(f"Successfully connected! Fetching GATT services...")
            
            # Start listening to the data notifications
            await client.start_notify(TX_CHAR_UUID, notification_handler)
            print("Streaming data... Press Ctrl+C to stop.")
            
            # Keep the script running to receive continuous streams
            while True:
                await asyncio.sleep(1)
        else:
            print("Failed to establish a stable connection.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStreaming stopped by user.")
