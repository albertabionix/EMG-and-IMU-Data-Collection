import cv2
import numpy as np


class MarkerKalmanTracker:
    def __init__(self, position, timestamp):
        self.kf = cv2.KalmanFilter(4, 2)

        # State: [x, y, vx, vy]
        self.kf.measurementMatrix = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ], dtype=np.float32)

        self.kf.processNoiseCov = np.diag([
            1, 1, 25, 25
        ]).astype(np.float32)

        # Initial measurement uncertainty
        self.kf.measurementNoiseCov = np.diag([
            4, 4
        ]).astype(np.float32)

        self.kf.errorCovPost = np.eye(4, dtype=np.float32) * 10

        x, y = position
        self.kf.statePost = np.array([
            [x], [y], [0], [0]
        ], dtype=np.float32)

        self.last_time = timestamp
        self.last_velocity = None

    def update(self, position, timestamp):
        dt = timestamp - self.last_time

        if dt <= 0:
            return None, None, None

        # Reinitialize after a long detection gap.
        # Avoid trusting a prediction across a large gap.
        if dt > 0.5:
            self.__init__(position, timestamp)
            return np.array(position), None, None

        # Update motion model using actual elapsed time.
        self.kf.transitionMatrix = np.array([
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1,  0],
            [0, 0, 0,  1]
        ], dtype=np.float32)

        # Predict the current state.
        self.kf.predict()

        # Correct prediction with detected center.
        measurement = np.array(
            [[position[0]], [position[1]]],
            dtype=np.float32
        )

        estimated = self.kf.correct(measurement).flatten()

        filtered_position = estimated[:2].astype(float)
        velocity = estimated[2:4].astype(float)

        acceleration = None
        if self.last_velocity is not None:
            acceleration = (
                velocity - self.last_velocity
            ) / dt

        self.last_velocity = velocity.copy()
        self.last_time = timestamp

        return filtered_position, velocity, acceleration