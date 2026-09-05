import threading
import base64
import sys
import time

import cv2
import numpy as np

from Runs.extensions import socketio
from Imports.state import state
from .cv_processor import detect_aruco, compute_joint_angles, compute_linear_kinematics

from . import recording

def generate_frames():
    while True:
        camera = getattr(state, "camera", None)
        if camera is None:
            break
        success, frame = camera.read()
        if not success:
            break
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


def camera_loop(*args):
    stop_event = args[0] if args and isinstance(args[0], threading.Event) else (state.camera_stop_event or threading.Event())

    # DirectShow is Windows-only. On macOS, let OpenCV select its native backend.
    cap_backend = getattr(cv2, 'CAP_DSHOW', None) if sys.platform.startswith("win") else None
    cam = None

    for idx in range(0, 4):
        try:
            cam_candidate = cv2.VideoCapture(idx, cap_backend) if cap_backend is not None else cv2.VideoCapture(idx)
            if cam_candidate is None or not cam_candidate.isOpened():
                cam_candidate.release() if cam_candidate else None
                continue
            ret, _ = cam_candidate.read()
            if not ret:
                cam_candidate.release()
                continue
            cam = cam_candidate
            state.camera_index_in_use = idx
            break
        except Exception as e:
            print(f"Camera open attempt {idx} failed: {e}")
            try:
                cam_candidate.release()
            except Exception:
                pass

    if cam is None or not cam.isOpened():
        print("Camera failed to open on indexes 0-3")
        state.camera_task_running = False
        socketio.emit("cv_status", {"status": "failed"})
        return

    # Store on shared state so nothing else tries to open the device separately
    state.camera = cam

    print(f"Camera started on index {state.camera_index_in_use}")
    socketio.emit("cv_status", {"status": "started", "index": state.camera_index_in_use})

    RESIZE_DIM = (320, 240)

    try:
        while not stop_event.is_set():
            ret, frame = cam.read()
            if not ret:
                socketio.sleep(0.03)
                continue

            small = cv2.resize(frame, RESIZE_DIM)

            try:
                ok, buf = cv2.imencode('.jpg', small, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
                if ok:
                    b64str = base64.b64encode(buf.tobytes()).decode('ascii')
                    socketio.emit('cv_frame', {'image': 'data:image/jpeg;base64,' + b64str})
            except Exception as e:
                print(f"Frame encode/emit failed: {e}")

            # Detect on the SAME resized frame we send to the frontend so marker
            # coordinates line up with what's drawn on screen.
            detections = detect_aruco(small)
            angles = compute_joint_angles(detections)
            payload = {"angles": angles, "markers": []}
            now = time.time()

            for marker_id, data in detections.items():
                pos, vel, acc = compute_linear_kinematics(marker_id, data["center"], now)
                payload["markers"].append({
                    "id": marker_id,
                    "position": pos.tolist(),
                    "velocity": None if vel is None else float(np.linalg.norm(vel)),
                    "acceleration": None if acc is None else float(np.linalg.norm(acc)),
                })

            socketio.emit("cv_data", payload)
            recording.write_cvkas_row(now, payload["markers"], payload["angles"])
            socketio.sleep(0.03)
    finally:
        try:
            cam.release()
        except Exception:
            pass
        state.camera = None
        state.camera_task_running = False
        print("Camera stopped")
        socketio.emit("cv_status", {"status": "stopped"})