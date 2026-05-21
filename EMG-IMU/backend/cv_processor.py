import cv2
import numpy as np
import time

aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
aruco_params = cv2.aruco.DetectorParameters()
aruco_detector = cv2.aruco.ArucoDetector(
    aruco_dict,
    aruco_params
)

marker_state = {}

def detect_aruco(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    corners, ids, _ = aruco_detector.detectMarkers(gray)

    detections = {}

    if ids is not None:
        for i, marker_id in enumerate(ids.flatten()):
            pts = corners[i].reshape(4, 2)
            center = pts.mean(axis=0)

            detections[int(marker_id)] = {
                "center": center,
                "corners": pts
            }

    return detections

def compute_linear_kinematics(marker_id, position, timestamp):
    if marker_id not in marker_state:
        marker_state[marker_id] = {
            "prev_pos": position,
            "prev_vel": None,
            "prev_time": timestamp
        }

        return position, None, None

    state = marker_state[marker_id]

    dt = timestamp - state["prev_time"]

    if dt <= 0:
        return position, None, None

    velocity = (position - state["prev_pos"]) / dt

    acceleration = None

    if state["prev_vel"] is not None:
        acceleration = (velocity - state["prev_vel"]) / dt

    state["prev_pos"] = position
    state["prev_vel"] = velocity
    state["prev_time"] = timestamp

    return position, velocity, acceleration

def angle_between(v1, v2):
    dot = np.dot(v1, v2)
    det = v1[0] * v2[1] - v1[1] * v2[0]

    return np.degrees(np.arctan2(det, dot))


def compute_joint_angles(detections):
    if not all(k in detections for k in [0, 1, 2]):
        return None

    hip = detections[0]["center"]
    knee = detections[1]["center"]
    ankle = detections[2]["center"]

    thigh_vec = knee - hip
    shank_vec = ankle - knee

    knee_angle = angle_between(thigh_vec, shank_vec)

    vertical = np.array([0, -1])
    hip_angle = angle_between(vertical, thigh_vec)

    return {
        "hip": float(hip_angle),
        "knee": float(knee_angle)
    }