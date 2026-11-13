"""
Serial port discovery and the remembered port choice.

The ESP32 streams over Bluetooth Classic serial (SPP). Once paired, the OS exposes
it as a serial port:
  - Windows: COMx (two are created; the "outgoing" one has the ESP32's address in
    its hardware ID)
  - macOS:   /dev/cu.<DeviceName>  (use cu.*, not tty.*, which can block on open)
  - Linux:   /dev/rfcommN

Startup port, in priority order: SERIAL_PORT env var > last port chosen in the
UI (saved in settings.json) > best guess from the available ports.
"""

import json
import os
import sys

from serial.tools import list_ports

from Imports.paths import data_dir

_SETTINGS_FILE = os.path.join(data_dir(), "settings.json")

# macOS system ports that are never the sensor.
_MAC_IGNORED = ("bluetooth-incoming-port", "debug-console", "wlan-debug")


def _is_candidate(port):
    if sys.platform == "darwin":
        name = port.device.lower()
        # /dev/tty.* duplicates every /dev/cu.* entry; only offer cu.*
        return name.startswith("/dev/cu.") and not any(i in name for i in _MAC_IGNORED)
    return True


def available_ports():
    """Ports the user can pick from: [{"device", "description"}], sorted by device."""
    ports = [p for p in list_ports.comports() if _is_candidate(p)]
    return [
        {"device": p.device, "description": p.description or ""}
        for p in sorted(ports, key=lambda p: p.device)
    ]


def _score(port):
    """Higher means more likely to be the ESP32's Bluetooth serial port."""
    device, desc, hwid = port.device.lower(), (port.description or "").lower(), (port.hwid or "").lower()
    score = 0
    if "esp" in device or "esp" in desc:
        score += 3
    if "bthenum" in hwid:  # Windows Bluetooth serial port
        score += 1
        # The incoming port has an all-zero remote address; the outgoing one
        # (the one we connect to) has the ESP32's address.
        if "000000000000" not in hwid:
            score += 1
    if sys.platform == "darwin" and "usb" not in device:  # Bluetooth, not a USB cable
        score += 1
    return score


def guess_port():
    """Best guess at the sensor's port, or None if no candidates exist."""
    ports = [p for p in list_ports.comports() if _is_candidate(p)]
    if not ports:
        return None
    best = max(ports, key=_score)
    return best.device if _score(best) > 0 or len(ports) == 1 else None


def _load_settings():
    try:
        with open(_SETTINGS_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def saved_port():
    return _load_settings().get("serial_port")


def save_port(device):
    settings = _load_settings()
    settings["serial_port"] = device
    try:
        with open(_SETTINGS_FILE, "w") as f:
            json.dump(settings, f, indent=2)
    except OSError as error:
        print(f"Could not save port setting: {error}")


def initial_port():
    return os.getenv("SERIAL_PORT") or saved_port() or guess_port()
