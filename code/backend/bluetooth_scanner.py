"""
Scans for nearby BLE devices and prints their name, address, and RSSI.
Useful for locating an ESP32 by name or signal strength.

Install:
    pip install bleak --break-system-packages

Run:
    python bluetooth_scanner.py
"""

import asyncio
from bleak import BleakScanner

SCAN_DURATION = 8.0  # seconds


async def scan():
    print(f"Scanning for {SCAN_DURATION}s...\n")
    devices = await BleakScanner.discover(timeout=SCAN_DURATION, return_adv=True)

    if not devices:
        print("No BLE devices found.")
        return

    results = []
    for device, adv in devices.values():
        name = device.name or adv.local_name or "Unknown"
        results.append((name, device.address, adv.rssi))

    # Strongest signal first (likely closest device)
    results.sort(key=lambda d: d[2], reverse=True)

    print(f"{'Name':<30} {'Address':<20} RSSI")
    print("-" * 60)
    for name, address, rssi in results:
        flag = "  <-- possible ESP32" if "esp" in name.lower() else ""
        print(f"{name:<30} {address:<20} {rssi}{flag}")


if __name__ == "__main__":
    asyncio.run(scan())