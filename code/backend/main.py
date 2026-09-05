import os
import threading
from Runs.extensions import app, socketio
import routes      # registers all routes via import side-effect
import sockets      # registers socket handlers via import side-effect
from serialHandler import read_serial
from bluetoothHandler import read_ble
from Camera.cameraHandler import camera_loop
from Imports.state import state

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))

if __name__ == "__main__":
    socketio.start_background_task(read_ble)
    state.camera_stop_event = threading.Event()
    state.camera_task_running = True
    socketio.start_background_task(camera_loop, state.camera_stop_event)
    socketio.run(
        app,
        host=HOST,
        port=PORT,
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )