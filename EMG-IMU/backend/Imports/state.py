import os

class AppState:
    def __init__(self):
        self.comport = os.getenv("SERIAL_PORT", "COM4")
        self.baud_rate = 115200
        self.ser = None

        self.is_recording = False

        # Per-modality CSV file/writer handles, opened in recording.start_recording()
        # and closed in recording.stop_recording(). None when not currently recording.
        self.emg_csv_file = None
        self.emg_csv_writer = None
        self.imu_csv_file = None
        self.imu_csv_writer = None
        self.cvkas_csv_file = None
        self.cvkas_csv_writer = None

        # {"emg": path|None, "imu": path|None, "cvkas": path|None} for the files
        # written during the current/most recent recording.
        self.recording_files = {}
        self.recording_action = None
        self.recording_pid = None

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