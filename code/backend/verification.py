import serial
import struct
import sys

# --- Configuration ---
# Replace with your actual ESP32 port (e.g., 'COM3' on Windows or '/dev/ttyUSB0' on Linux)
SERIAL_PORT = 'COM7' 
BAUD_RATE = 921600

# Total payload byte footprint calculation:
# uint16 (2B) + uint16 (2B) + 2x IMUs * [6x int16 (12B)] = 28 Bytes total
PACKET_FORMAT = "<HH 6h 6h" 
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)

def main():
    print(f"Connecting to ESP32 on {SERIAL_PORT} at {BAUD_RATE} baud...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        ser.flushInput()
        print("Connected! Streaming data. Press Ctrl+C to stop.\n")
    except Exception as e:
        print(f"Error opening serial port: {e}")
        sys.exit(1)

    # Align byte boundary alignment window
    while True:
        try:
            # Look for a clean payload structural window match
            raw_data = ser.read(PACKET_SIZE)
            if len(raw_data) < PACKET_SIZE:
                continue
                
            # Unpack the binary stream using struct mappings
            data = struct.unpack(PACKET_FORMAT, raw_data)
            
            emg1 = data[0]
            emg2 = data[1]
            
            # IMU 1 Raw values
            imu1_ax, imu1_ay, imu1_az = data[2], data[3], data[4]
            imu1_gx, imu1_gy, imu1_gz = data[5], data[6], data[7]
            
            # IMU 2 Raw values
            imu2_ax, imu2_ay, imu2_az = data[8], data[9], data[10]
            imu2_gx, imu2_gy, imu2_gz = data[11], data[12], data[13]

            # Clear screen line updates
            print(f"EMG1: {emg1:<4} | EMG2: {emg2:<4} | "
                  f"IMU1 Accel: ({imu1_ax:+5}, {imu1_ay:+5}, {imu1_az:+5}) | "
                  f"IMU2 Accel: ({imu2_ax:+5}, {imu2_ay:+5}, {imu2_az:+5})", end='\r')

        except KeyboardInterrupt:
            print("\nStopping data stream tracking window.")
            ser.close()
            break
        except Exception as e:
            print(f"\nParsing error encountered: {e}")
            break

if __name__ == "__main__":
    main()
