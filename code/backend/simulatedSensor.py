"""
Simulated ESP32 sensor for testing and debugging without hardware.

Enable it when starting the backend, with any of:
    python main.py --simulated-sensor
    python main.py SIMULATED_SENSOR=1
    SIMULATED_SENSOR=1 python main.py

It produces binary packets in the same format and at the same rate as the
firmware (arduino/ESP-32.txt) and feeds them through the normal packet handler,
so live graphs, calibration, recording and export behave as with the real
sensor. "Simulated sensor" then appears in the Port dropdown; picking a real
port switches to it, and you can switch back.

Data shape (matches the firmware's raw values):
  - 1000 packets/s; IMUs refresh every 10th packet (100 Hz), so IMU values
    repeat between refreshes exactly like real recordings.
  - EMG: 12-bit ADC (0-4095), resting around 1500 with a muscle-activation
    burst for 1 s every 4 s.
  - IMU: raw ISM330DHCX counts. Accel range +/-4 g (8197 counts per g),
    gyro range +/-500 dps (57 counts per dps), with gravity on one axis,
    a slow sway and noise.
"""

import math
import os
import random
import struct
import sys
import time

SIMULATED_PORT = "SIMULATED"
_FLAGS = ("--simulated-sensor", "--simulate", "SIMULATED_SENSOR=1", "SIMULATED_SENSOR=true")

PACKET_FORMAT = "<HH 6h 6h"
PACKET_RATE_HZ = 1000
IMU_REFRESH_EVERY_N = 10
BATCH_S = 0.01  # generate 10 packets per 10 ms tick

COUNTS_PER_G = 8197     # +/-4 g range: 0.122 mg/LSB
COUNTS_PER_DPS = 57.1   # +/-500 dps range: 17.5 mdps/LSB


def requested(argv=None):
    """True if the simulator was asked for on the command line or in the env."""
    argv = sys.argv[1:] if argv is None else argv
    if any(arg.lower() in (f.lower() for f in _FLAGS) for arg in argv):
        return True
    return os.getenv("SIMULATED_SENSOR", "").lower() in ("1", "true", "yes")


def _emg(t, channel):
    # Burst for 1 s out of every 4 s; channel 2 is offset and weaker.
    phase = (t + channel * 0.5) % 4.0
    envelope = math.sin(math.pi * phase) if phase < 1.0 else 0.0
    amplitude = 40 + envelope * (250 if channel == 0 else 160)
    value = 1500 + random.gauss(0, amplitude)
    return max(0, min(4095, int(value)))


def _imu(t, index):
    # IMU 1 has gravity on +Y, IMU 2 on -X (like the example recordings).
    sway = 0.05 * math.sin(2 * math.pi * 0.3 * t + index)          # in g
    sway_rate = 0.05 * 2 * math.pi * 0.3 * math.cos(2 * math.pi * 0.3 * t + index)
    gravity = (0.0, 1.0, 0.2) if index == 0 else (-1.0, -0.2, -0.1)
    accel = [
        int((g + (sway if axis == 0 else 0)) * COUNTS_PER_G + random.gauss(0, 40))
        for axis, g in enumerate(gravity)
    ]
    gyro = [
        int((math.degrees(sway_rate) if axis == 2 else 0) * COUNTS_PER_DPS + random.gauss(0, 15))
        for axis in range(3)
    ]
    return accel + gyro


def run(still_selected, process_packet, sleep=time.sleep):
    """Generate packets until still_selected() returns False.

    process_packet receives the raw packet bytes, the same as a serial read.
    """
    print("Simulated sensor running (fake data at 1000 packets/s).")
    start = time.monotonic()
    next_tick = start
    packet_index = 0
    imus = _imu(0, 0) + _imu(0, 1)

    while still_selected():
        for _ in range(int(PACKET_RATE_HZ * BATCH_S)):
            t = packet_index / PACKET_RATE_HZ
            if packet_index % IMU_REFRESH_EVERY_N == 0:
                imus = _imu(t, 0) + _imu(t, 1)
            packet = struct.pack(PACKET_FORMAT, _emg(t, 0), _emg(t, 1), *imus)
            process_packet(packet)
            packet_index += 1

        next_tick += BATCH_S
        delay = next_tick - time.monotonic()
        if delay > 0:
            sleep(delay)
        elif delay < -0.5:  # fell far behind (e.g. machine was busy); don't burst to catch up
            next_tick = time.monotonic()

    print("Simulated sensor stopped.")
