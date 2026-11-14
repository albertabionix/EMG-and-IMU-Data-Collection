import os
import sys
import threading

from Imports.paths import FROZEN, data_dir

# The packaged app has no terminal (and on Windows sys.stdout/stderr are None,
# which crashes anything that writes to them), so send all output to a log file.
if FROZEN:
    _log = open(os.path.join(data_dir(), "app.log"), "w", buffering=1, encoding="utf-8")
    sys.stdout = sys.stderr = _log

from Runs.extensions import app, socketio
import routes      # registers all routes via import side-effect
import sockets      # registers socket handlers via import side-effect
from serialHandler import read_serial
from bluetoothHandler import read_ble
from Camera.cameraHandler import camera_loop
from Imports.state import state

APP_NAME = "EMG-IMU Data Collection"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))


def enable_simulated_sensor_if_requested():
    import simulatedSensor
    if simulatedSensor.requested():
        state.simulation_available = True
        state.comport = simulatedSensor.SIMULATED_PORT
        print("SIMULATED SENSOR enabled: EMG/IMU data is fake.")


def start_background_tasks():
    enable_simulated_sensor_if_requested()
    socketio.start_background_task(read_ble)
    state.camera_stop_event = threading.Event()
    state.camera_task_running = True
    socketio.start_background_task(camera_loop, state.camera_stop_event)


def run_server(port):
    socketio.run(
        app,
        host=HOST,
        port=port,
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )


def _port_free(port):
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, port))
            return True
        except OSError:
            return False


def _pick_port():
    """Use PORT if free, otherwise any free port (the built frontend talks to
    whatever origin served it, so the port doesn't have to be 5000)."""
    if _port_free(PORT):
        return PORT
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def _wait_for_server(port, timeout=20.0):
    import socket
    import time
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((HOST, port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def run_desktop_app():
    """Packaged-executable entry: run the server in the background and show the
    UI in a native window. Closing the window quits the whole app."""
    port = _pick_port()
    server = threading.Thread(target=run_server, args=(port,), daemon=True)
    server.start()
    if not _wait_for_server(port):
        print(f"Backend did not start on {HOST}:{port}")
        os._exit(1)

    url = f"http://{HOST}:{port}/"
    print(f"Serving {APP_NAME} at {url}")

    try:
        import webview
        webview.create_window(APP_NAME, url, width=1400, height=900, min_size=(900, 600))
        webview.start()
    except Exception as error:
        # No native webview available: fall back to the default browser and keep
        # serving until the process is killed.
        print(f"Native window unavailable ({error}); opening browser instead")
        import webbrowser
        webbrowser.open(url)
        server.join()

    # Window closed: stop background threads (BLE, camera, serial) immediately.
    os._exit(0)


if __name__ == "__main__":
    start_background_tasks()
    if FROZEN:
        run_desktop_app()
    else:
        run_server(PORT)
