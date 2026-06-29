from flask import request, jsonify, Response
import threading

from Runs.extensions import app, socketio
from Imports.state import state
import Camera.recording
import Camera.cameraHandler


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route('/record/start', methods=['POST'])
def start_recording_route():
    data = request.get_json()
    filename = Camera.recording.start_recording(
        data.get("experiment", "unknown"),
        data.get("numberID", "0"),
    )
    return jsonify({"filename": filename})


@app.route('/record/stop', methods=['POST'])
def stop_recording_route():
    Camera.recording.stop_recording()
    return jsonify({"recording": False})


@app.route('/change-port', methods=['POST'])
def change_port():
    data = request.get_json()
    if not data or 'value' not in data:
        return jsonify({'error': 'Missing value'}), 400
    state.comport = data.get('value')
    return jsonify({'updated': state.comport})


@app.route('/camera/start', methods=['POST'])
def start_camera():
    if state.camera_task_running:
        return jsonify({'status': 'already_running'})
    state.camera_stop_event = threading.Event()
    socketio.start_background_task(Camera.cameraHandler.camera_loop, state.camera_stop_event)
    state.camera_task_running = True
    return jsonify({'status': 'started'})


@app.route('/camera/stop', methods=['POST'])
def stop_camera():
    if not state.camera_task_running or state.camera_stop_event is None:
        return jsonify({'status': 'not_running'})
    state.camera_stop_event.set()
    state.camera_task_running = False
    return jsonify({'status': 'stopping'})


@app.route('/api/camera')
def camera_feed():
    return Response(
        Camera.cameraHandler.generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )