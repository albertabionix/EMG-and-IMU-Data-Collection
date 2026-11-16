"""
Binary packet format sent by the ESP32 (arduino/ESP-32.txt), shared by the real
reader (bluetoothHandler.py) and the simulator (simulatedSensor.py) so they
can't drift apart. If you change the firmware's SensorPacket, change it here.

Packet (37 bytes, little-endian, no padding):

    sync       uint16   always SYNC_WORD; marks where a packet starts
    seq        uint32   sample number since the ESP32 booted, +1 every 1 ms
    imu_fresh  uint8    bit i set = IMU i was read on this sample (100 Hz)
    emg1, emg2 uint16   12-bit ADC values
    imu1, imu2 6 x int16 each: ax, ay, az, gx, gy, gz (raw counts)
    crc        uint16   CRC-16/CCITT-FALSE of all bytes before it

seq gives every sample an exact time on the sensor's clock
(sample_time = seq / SAMPLE_RATE_HZ, plus an offset) and makes lost samples
visible as gaps. It restarts from 1 when the ESP32 reboots.
"""

import binascii
import struct

SAMPLE_RATE_HZ = 1000
NUM_IMUS = 2
IMU_AXES = ("ax", "ay", "az", "gx", "gy", "gz")

SYNC_WORD = 0xA55A
SYNC = struct.pack("<H", SYNC_WORD)
PACKET_FORMAT = "<HIBHH6h6hH"
PACKET_SIZE = struct.calcsize(PACKET_FORMAT)  # 37
_BODY_SIZE = PACKET_SIZE - 2  # everything the CRC covers

# Size of the packet before the sync/seq/imu_fresh header was added. Used only
# to recognise an ESP32 that still runs the old firmware.
LEGACY_PACKET_SIZE = 28


def crc16(data):
    """CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), same as crc16() in the firmware."""
    return binascii.crc_hqx(data, 0xFFFF)


def pack(seq, emg1, emg2, imus, imu_fresh):
    """imus: NUM_IMUS sequences of 6 ints (ax, ay, az, gx, gy, gz)."""
    flat = [v for imu in imus for v in imu]
    body = struct.pack(PACKET_FORMAT[:-1], SYNC_WORD, seq & 0xFFFFFFFF, imu_fresh, emg1, emg2, *flat)
    return body + struct.pack("<H", crc16(body))


def is_valid(packet):
    """True if packet starts with the sync marker and its CRC matches."""
    return (len(packet) == PACKET_SIZE and packet[:2] == SYNC
            and struct.unpack_from("<H", packet, _BODY_SIZE)[0] == crc16(packet[:_BODY_SIZE]))


def unpack(packet):
    """Returns {"seq", "imu_fresh", "emg1", "emg2", "imus": [dict, ...]}."""
    values = struct.unpack(PACKET_FORMAT, packet)
    _sync, seq, imu_fresh, emg1, emg2 = values[:5]
    raw = values[5:-1]
    imus = [dict(zip(IMU_AXES, raw[i * 6:(i + 1) * 6])) for i in range(NUM_IMUS)]
    return {"seq": seq, "imu_fresh": imu_fresh, "emg1": emg1, "emg2": emg2, "imus": imus}


class StreamParser:
    """Splits a raw byte stream into packets.

    A packet is only accepted when it starts with the sync marker and its CRC
    matches. Sync-like bytes inside sensor data can't cause misaligned packets,
    and a packet damaged by lost or changed bytes is dropped (it shows up as a
    gap in seq) instead of being misread.
    """

    def __init__(self):
        self._buf = bytearray()
        self._locked = False
        self.packets = 0          # packets returned so far
        self.skipped_bytes = 0    # bytes discarded while searching for a boundary

    def feed(self, data):
        """Add received bytes; returns the complete packets now available."""
        self._buf += data
        out = []
        buf = self._buf
        while True:
            if self._locked:
                if len(buf) < PACKET_SIZE:
                    break
                packet = bytes(buf[:PACKET_SIZE])
                if is_valid(packet):
                    out.append(packet)
                    del buf[:PACKET_SIZE]
                    continue
                self._locked = False  # damaged or misaligned; search again past it
                del buf[:1]

            start = self._find_boundary()
            if start is None:
                break
            self.skipped_bytes += start
            del buf[:start]
            self._locked = True

        self.packets += len(out)
        return out

    def _find_boundary(self):
        """Index of a valid packet start, or None (discarding unusable bytes)."""
        buf = self._buf
        i = buf.find(SYNC)
        while i != -1:
            if len(buf) < i + PACKET_SIZE:
                # Not enough data to check this candidate yet: keep from it on.
                self.skipped_bytes += i
                del buf[:i]
                return None
            if is_valid(bytes(buf[i:i + PACKET_SIZE])):
                return i
            i = buf.find(SYNC, i + 1)
        # No candidate at all: keep only a possible half sync marker at the end.
        keep = 1 if buf[-1:] == SYNC[:1] else 0
        self.skipped_bytes += len(buf) - keep
        del buf[:len(buf) - keep]
        return None

    def looks_like_old_firmware(self):
        """True once plenty of data has arrived without a single valid packet."""
        return self.packets == 0 and self.skipped_bytes >= 50 * LEGACY_PACKET_SIZE
