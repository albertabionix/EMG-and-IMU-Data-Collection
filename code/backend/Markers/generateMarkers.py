import cv2
import numpy as np

# Choose dictionary (must match your detector)
aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
marker_size = 200  # pixels

# Marker layout to match compute_joint_angles in cv_processor.py:
#   0 = thigh, proximal (nearer hip)
#   1 = thigh, distal    (nearer knee)
#   2 = shank, proximal (nearer knee)
#   3 = shank, distal    (nearer ankle)
for marker_id in [0, 1, 2, 3]:
    marker_img = cv2.aruco.generateImageMarker(
        aruco_dict,
        marker_id,
        marker_size
    )
    filename = f"aruco_{marker_id}.png"
    cv2.imwrite(filename, marker_img)
    print(f"Saved {filename}")