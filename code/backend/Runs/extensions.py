import os

from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS

from Imports.paths import frontend_dist_dir

# Serve the built React app (code/frontend/dist) from the same server as the API,
# so the packaged executable needs no separate Node/Vite process. In development
# the Vite dev server is still used instead; this is only a fallback.
_DIST = frontend_dist_dir()

app = Flask(__name__, static_folder=_DIST, static_url_path="")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")


@app.route("/")
def index():
    if os.path.exists(os.path.join(_DIST, "index.html")):
        return app.send_static_file("index.html")
    return (
        "Frontend not built. Run `npm run build` in code/frontend, "
        "or use the Vite dev server (`npm run dev`).",
        404,
    )
