import os

from Imports import ports

class AppState:
    def __init__(self):
        # None until a port is found or chosen in the UI; see Imports/ports.py.
        self.comport = ports.initial_port()
        # True when started with the simulated-sensor flag (see simulatedSensor.py);
        # adds "Simulated sensor" to the Port dropdown.
        self.simulation_available = False
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

        # Shared exercise metadata used throughout the app.
        self.exercise = None

        # {"emg": path|None, "imu": path|None, "cvkas": path|None} for the files
        # written during the current/most recent recording.
        self.recording_files = {}
        self.recording_action = None
        self.recording_exercise = None
        self.recording_pid = None

        self.camera_stop_event = None
        self.camera_task_running = False
        self.recording_camera_started = False
        self.camera_index_in_use = None

        # Set on successful /auth/login, reused for later uploads.
        self.bionix_db = None
        # "CONTENT_MANAGER" or "DEVELOPER" (developers.json allowlist) after login.
        self.auth_access = None

        # {"pid", "action", "files": {"emg": path|None, "imu": path|None, "cvkas": path|None}}
        # for the trial currently awaiting export/discard. Modalities are filled in
        # independently as each one's recording stops, so a session can mix-and-match
        # whichever were recorded.
        self.last_recording = None

state = AppState()