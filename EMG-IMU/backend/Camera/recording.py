import os
import csv
from datetime import datetime

from Imports.state import state


def start_recording(experiment, number_id):
    folder = "tests"
    os.makedirs(folder, exist_ok=True)

    experiment = experiment.replace(" ", "_")
    timestamp = datetime.now().strftime('%Y-%b-%d_%H-%M-%S')
    filename = os.path.join(folder, f"recording_{experiment}_{number_id}_{timestamp}.csv")

    state.csv_file = open(filename, "w", newline="")
    state.csv_writer = csv.writer(state.csv_file)
    header = ["timestamp", "emg1", "emg2"]
    for i in range(3):
        for axis in ("ax", "ay", "az", "gx", "gy", "gz"):
            header.append(f"imu{i + 1}_{axis}")
    state.csv_writer.writerow(header)
    state.is_recording = True

    print(f"Recording started: {filename}")
    return filename


def stop_recording():
    state.is_recording = False
    if state.csv_file:
        state.csv_file.close()
        state.csv_file = None
        state.csv_writer = None
    print("Recording stopped")