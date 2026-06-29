import os

class AppState:
    def __init__(self):
        self.comport = os.getenv("SERIAL_PORT", "COM4")
        self.baud_rate = 115200
        self.ser = None

        self.is_recording = False
        self.csv_writer = None
        self.csv_file = None

        self.camera_stop_event = None
        self.camera_task_running = False
        self.camera_index_in_use = None

        # Set on successful /auth/login, reused for later uploads.
        self.bionix_db = None

        # {"pid", "action", "files": {"emg": path|None, "imu": path|None, "cvkas": path|None}}
        # for the trial currently awaiting export/discard. Modalities are filled in
        # independently as each one's recording stops, so a session can mix-and-match
        # whichever were recorded.
        self.last_recording = None

state = AppState()