from Runs.extensions import socketio
import calibration

@socketio.on("connect")
def handle_connect():
    print("Client connected")

@socketio.on("calibrate_imu")
def handle_calibrate_imu():
    calibration.start_calibration()