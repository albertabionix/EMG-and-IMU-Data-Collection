import os
from Runs.extensions import app, socketio
import routes      # registers all routes via import side-effect
import sockets      # registers socket handlers via import side-effect
from serialHandler import read_serial
from bluetoothHandler import read_ble
from Camera.cameraHandler import camera_loop

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))

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