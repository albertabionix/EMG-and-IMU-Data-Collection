from flask import request, jsonify, Response
import threading

from Runs.extensions import app, socketio
from Imports.state import state
import auth
import Camera.recording
from Camera import cameraHandler
import calibration


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


# ---- Auth ----

@app.route('/auth/login', methods=['POST'])
def auth_login():
    result, status = auth.login()
    return jsonify(result), status


# ---- EMG recording ----

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


@app.route('/record/discard', methods=['POST'])
def discard_recording_route():
    ok, error = Camera.recording.discard_recording()
    if not ok:
        return jsonify({'discarded': False, 'error': error}), 400
    return jsonify({'discarded': True})


@app.route('/export', methods=['POST'])
def export_route():
    result, status = Camera.recording.export_recording()
    return jsonify(result), status

# ---- IMU calibration ----

@app.route('/calibrate/imu/start', methods=['POST'])
def start_calibrate_imu():
    if calibration.is_calibrating():
        return jsonify({'status': 'already_calibrating'}), 409

    duration = 5.0
    if request.is_json:
        data = request.get_json(silent=True) or {}
        duration = data.get('duration', duration)

    calibration.start_calibration(duration=duration)
    return jsonify({'status': 'started', 'duration': duration})


@app.route('/calibrate/imu/status', methods=['GET'])
def calibrate_imu_status():
    return jsonify({'calibrating': calibration.is_calibrating()})


# ======== IMU recording (skeleton — sensor pipeline not implemented yet) ============
# Mirror start_recording_route()/stop_recording_route() above once IMU data collection
# exists: write the local CSV the same way EMG does, then call recording._init_recording
# and set state.last_recording["files"]["imu"] = filename so /export and /record/discard
# pick it up automatically — neither of those routes need any changes to support IMU.

@app.route('/record/imu/start', methods=['POST'])
def start_recording_imu():
    return jsonify({'error': 'IMU recording not implemented yet'}), 501


@app.route('/record/imu/stop', methods=['POST'])
def stop_recording_imu():
    return jsonify({'error': 'IMU recording not implemented yet'}), 501
# ======== IMU recording (skeleton — sensor pipeline not implemented yet) ============


# ============ CVKAS recording (skeleton — not yet persisted to disk) ===========
# cv_processor.py already computes angles/kinematics per-frame and emits them live via
# socketio ("cv_data", see camera_loop()) but never writes them to a CSV. Once that's
# added: buffer the cv_data payloads during camera_loop() and flush them to a CSV on
# camera stop, then call recording._init_recording and set
# state.last_recording["files"]["cvkas"] = filename, same pattern as IMU above.

@app.route('/record/cvkas/start', methods=['POST'])
def start_recording_cvkas():
    return jsonify({'error': 'CVKAS recording not implemented yet'}), 501


@app.route('/record/cvkas/stop', methods=['POST'])
def stop_recording_cvkas():
    return jsonify({'error': 'CVKAS recording not implemented yet'}), 501
# ============ CVKAS recording (skeleton — not yet persisted to disk) ===========

# ---- Misc / hardware control ----

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
    socketio.start_background_task(cameraHandler.camera_loop, state.camera_stop_event)
    state.camera_task_running = True
    return jsonify({'status': 'started'})


@app.route('/camera/stop', methods=['POST'])
def stop_camera():
    if not state.camera_task_running or state.camera_stop_event is None:
        return jsonify({'status': 'not_running'})
    state.camera_stop_event.set()
    state.camera_task_running = False
    return jsonify({'status': 'stopping'})