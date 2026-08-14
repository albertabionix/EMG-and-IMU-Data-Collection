import { requestFlask } from './client.js'

export function startImuCalibration(duration = 5) {
    return requestFlask('/calibrate/imu/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
    })
}