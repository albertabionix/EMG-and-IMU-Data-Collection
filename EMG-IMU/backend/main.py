import os

from flask import Flask, request, jsonify, Response
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
import threading
import base64

from cv_processor import (
    detect_aruco,
    compute_joint_angles,
    compute_linear_kinematics
)

global COMPORT

COMPORT = os.getenv("SERIAL_PORT", "COM4")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))
BAUD_RATE = 115200

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

camera = cv2.VideoCapture(0)  # 0 = default camera

@app.after_request
def add_cors_headers(response):
    # Allow HTTP API calls from the Vite dev server during local development.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

ser = None
camera_stop_event = None
camera_task_running = False
camera_index_in_use = None

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

# Port Change

@app.route('/change-port', methods=['POST'])
def changePort():
    global COMPORT 

    data = request.get_json()
    if not data or 'value' not in data:
        return jsonify({'error': 'Missing value'}), 400

    COMPORT = data.get('value')  

    return jsonify({'updated': COMPORT})

# Camera Start

@app.route('/camera/start', methods=['POST'])
def start_camera():
    global camera_stop_event, camera_task_running
    if camera_task_running:
        return jsonify({'status': 'already_running'})

    camera_stop_event = threading.Event()
    socketio.start_background_task(camera_loop, camera_stop_event)
    camera_task_running = True
    return jsonify({'status': 'started'})

# Camera Stop

@app.route('/camera/stop', methods=['POST'])
def stop_camera():
    global camera_stop_event, camera_task_running
    if not camera_task_running or camera_stop_event is None:
        return jsonify({'status': 'not_running'})

    camera_stop_event.set()
    camera_task_running = False
    return jsonify({'status': 'stopping'})

# Camera

def generate_frames():
    while True:
        success, frame = camera.read()
        if not success:
            break

        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        # Yield as multipart stream
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/api/camera')
def camera_feed():
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

# CVKAS
            
def camera_loop(*args):
    # Support a stop event when started as a background task with control.
    stop_event = None

    # Accept an Event passed as the first positional argument (common usage below).
    if len(args) > 0 and isinstance(args[0], threading.Event):
        stop_event = args[0]
    else:
        # fallback: if a global event exists, use it
        global camera_stop_event
        stop_event = camera_stop_event or threading.Event()

    # Prefer DirectShow backend on Windows when available for more reliable opening
    cap_backend = getattr(cv2, 'CAP_DSHOW', None)

    # Try multiple device indexes to find a working camera
    cam = None
    global camera_index_in_use
    for idx in range(0, 4):
        try:
            if cap_backend is not None:
                cam_candidate = cv2.VideoCapture(idx, cap_backend)
            else:
                cam_candidate = cv2.VideoCapture(idx)

            if cam_candidate is None:
                continue

            # short warm-up read
            opened = cam_candidate.isOpened()
            if not opened:
                cam_candidate.release()
                continue

            # test read one frame
            ret, _ = cam_candidate.read()
            if not ret:
                cam_candidate.release()
                continue

            cam = cam_candidate
            camera_index_in_use = idx
            break
        except Exception as e:
            print(f"Camera open attempt {idx} failed: {e}")
            try:
                cam_candidate.release()
            except Exception:
                pass

    if cam is None or not cam.isOpened():
        print("Camera failed to open on indexes 0-3")
        socketio.emit("cv_status", {"status": "failed"})
        return

    print(f"Camera started on index {camera_index_in_use}")
    socketio.emit("cv_status", {"status": "started", "index": camera_index_in_use})

    try:
        while not stop_event.is_set():
            ret, frame = cam.read()

            if not ret:
                socketio.sleep(0.03)
                continue

            # Emit a downscaled JPEG frame to the frontend for preview
            try:
                small = cv2.resize(frame, (320, 240))
                ok, buf = cv2.imencode('.jpg', small, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
                if ok:
                    jpg_bytes = buf.tobytes()
                    b64str = base64.b64encode(jpg_bytes).decode('ascii')
                    socketio.emit('cv_frame', {'image': 'data:image/jpeg;base64,' + b64str})
            except Exception as e:
                # non-fatal for detection loop
                print(f"Frame encode/emit failed: {e}")

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
    finally:
        try:
            cam.release()
        except Exception:
            pass
        print("Camera stopped")
        socketio.emit("cv_status", {"status": "stopped"})

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
