import os

from flask import Flask
from flask_socketio import SocketIO

try:
    from serial import Serial, SerialException
except Exception as error:
    raise RuntimeError(
        "pyserial is not available (or a conflicting 'serial' module is being imported). "
        "Run: python -m pip uninstall -y serial ; python -m pip install pyserial"
    ) from error
    
import cv2
import time
import numpy as np

from cv_processor import (
    detect_aruco,
    compute_joint_angles,
    compute_linear_kinematics
)

COMPORT = os.getenv("SERIAL_PORT", "COM4")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))
BAUD_RATE = 115200

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

ser = None

def connect_serial():
    global ser
    try:
        ser = Serial(COMPORT, BAUD_RATE, timeout=1)
        print(f"Connected to serial port {COMPORT} at {BAUD_RATE} baud")
        return True
    except SerialException as error:
        print(f"Serial connection failed on {COMPORT}: {error}")
        ser = None
        return False

@socketio.on("connect")
def handle_connect():
    print("Client connected")

def read_serial():
    global ser

    while True:
        if ser is None or not ser.is_open:
            connect_serial()
            socketio.sleep(2)
            continue

        try:
            line = ser.readline().decode(errors="ignore").strip()
            if not line:
                socketio.sleep(0.01)
                continue

            data = {"raw": line}

            socketio.emit("sensor_data", data)
        except SerialException as error:
            print(f"Serial read error: {error}")
            try:
                ser.close()
            except Exception:
                pass
            ser = None
            socketio.sleep(2)
        except Exception as error:
            print(f"Unexpected serial loop error: {error}")
            socketio.sleep(1)

# CVKAS
            
def camera_loop():
    cam = cv2.VideoCapture(0)

    if not cam.isOpened():
        print("Camera failed to open")
        return

    print("Camera started")

    while True:
        ret, frame = cam.read()

        if not ret:
            socketio.sleep(0.03)
            continue

        detections = detect_aruco(frame)

        angles = compute_joint_angles(detections)

        payload = {
            "angles": angles,
            "markers": []
        }

        now = time.time()

        for marker_id, data in detections.items():
            pos, vel, acc = compute_linear_kinematics(
                marker_id,
                data["center"],
                now
            )

            payload["markers"].append({
                "id": marker_id,
                "position": pos.tolist(),
                "velocity": (
                    None if vel is None
                    else float(np.linalg.norm(vel))
                ),
                "acceleration": (
                    None if acc is None
                    else float(np.linalg.norm(acc))
                )
            })

        socketio.emit("cv_data", payload)

        socketio.sleep(0.03)

if __name__ == "__main__":
    socketio.start_background_task(read_serial)
    socketio.start_background_task(camera_loop)
    socketio.run(
        app,
        host=HOST,
        port=PORT,
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )
