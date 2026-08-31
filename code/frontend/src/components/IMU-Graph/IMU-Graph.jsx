import React, { useMemo } from 'react';
import './IMU-Graph.css'

// Fixed scale for the bar gauges. Accel in m/s^2, gyro in rad/s.
const ACCEL_RANGE = 20;   // +/- 20 m/s^2
const GYRO_RANGE = 10;    // +/- 10 rad/s

// --- 16-bit Raw Register Scaling Coefficients ---
// Accel factor: (4G range / 32768 total steps) * 9.80665 m/s^2 per G
const ACCEL_CONVERSION_FACTOR = (4.0 / 32768.0) * 9.80665; 
// Gyro factor: (500 DPS range / 32768 total steps) * (Math.PI / 180) to get rad/s
const GYRO_CONVERSION_FACTOR = (500.0 / 32768.0) * (Math.PI / 180);

const PITCH_MAX_DEG = 90;
const PITCH_MAX_PX = 70; 

function clampToPercent(value, range) {
    if (value == null || Number.isNaN(value)) return 50; 
    const clamped = Math.max(-range, Math.min(range, value));
    return ((clamped + range) / (2 * range)) * 100;
}

function AxisBar({ axis, value, range, colorClass }) {
    const percent = clampToPercent(value, range);
    const display = value == null ? '--' : value.toFixed(2);

    return (
        <div className="axis-row">
            <span className="axis-label">{axis}</span>
            <div className="axis-track">
                <div className="axis-zero-line" />
                <div
                    className={`axis-fill ${colorClass}`}
                    style={{ left: `${Math.min(percent, 50)}%`, width: `${Math.abs(percent - 50)}%` }}
                />
            </div>
            <span className="axis-value">{display}</span>
        </div>
    );
}

function computeTilt(ax, ay, az) {
    if (ax == null || ay == null || az == null) return null;
    if (ax === 0 && ay === 0 && az === 0) return null;

    const roll = Math.atan2(ay, az) * (180 / Math.PI);
    const pitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az)) * (180 / Math.PI);

    return { roll, pitch };
}

function OrientationIndicator({ ax, ay, az }) {
    const tilt = useMemo(() => computeTilt(ax, ay, az), [ax, ay, az]);

    const roll = tilt ? Math.max(-180, Math.min(180, tilt.roll)) : 0;
    const pitchClamped = tilt ? Math.max(-PITCH_MAX_DEG, Math.min(PITCH_MAX_DEG, tilt.pitch)) : 0;
    const pitchOffset = (pitchClamped / PITCH_MAX_DEG) * PITCH_MAX_PX;

    const cx = 100;
    const cy = 100;

    return (
        <div className="imu-group orientation-group">
            <div className="orientation-wrap">
                <svg viewBox="0 0 200 200" className="orientation-svg">
                    <circle cx={cx} cy={cy} r="90" className="orientation-ring" />
                    <line x1={cx} y1={cy - 90} x2={cx} y2={cy - 80} className="orientation-tick" />
                    <line x1={cx} y1={cy + 90} x2={cx} y2={cy + 80} className="orientation-tick" />
                    <line x1={cx - 90} y1={cy} x2={cx - 80} y2={cy} className="orientation-tick" />
                    <line x1={cx + 90} y1={cy} x2={cx + 80} y2={cy} className="orientation-tick" />

                    <g transform={`rotate(${roll} ${cx} ${cy}) translate(0 ${pitchOffset})`}>
                        <line
                            x1={cx - 75}
                            y1={cy}
                            x2={cx + 75}
                            y2={cy}
                            className={`orientation-line${tilt ? '' : ' orientation-line-offline'}`}
                        />
                        <circle cx={cx} cy={cy} r="4" className="orientation-center-dot" />
                    </g>
                </svg>
            </div>
            <div className="orientation-readout">
                <span>Roll: {tilt ? tilt.roll.toFixed(1) : '--'}°</span>
                <span>Pitch: {tilt ? tilt.pitch.toFixed(1) : '--'}°</span>
            </div>
        </div>
    );
}

const IMUGraph = ({ label = 'IMU', data }) => {
    // Intercept and cleanly transform variables if data exists
    const scaledData = useMemo(() => {
        if (!data) return null;
        return {
            ax: data.ax * ACCEL_CONVERSION_FACTOR,
            ay: data.ay * ACCEL_CONVERSION_FACTOR,
            az: data.az * ACCEL_CONVERSION_FACTOR,
            gx: data.gx * GYRO_CONVERSION_FACTOR,
            gy: data.gy * GYRO_CONVERSION_FACTOR,
            gz: data.gz * GYRO_CONVERSION_FACTOR
        };
    }, [data]);

    const { ax, ay, az, gx, gy, gz } = scaledData || {};

    return (
        <section className="imugraph-section">
            <section className="IMU">
                <header className="imu-header">
                    <h3>{label}</h3>
                    <span className={`imu-status ${data ? 'live' : 'offline'}`}>
                        {data ? 'LIVE' : 'NO DATA'}
                    </span>
                </header>

                <OrientationIndicator ax={ax} ay={ay} az={az} />

                <div className="imu-group">
                    <h4>Accel (m/s&sup2;)</h4>
                    <AxisBar axis="X" value={ax} range={ACCEL_RANGE} colorClass="accel" />
                    <AxisBar axis="Y" value={ay} range={ACCEL_RANGE} colorClass="accel" />
                    <AxisBar axis="Z" value={az} range={ACCEL_RANGE} colorClass="accel" />
                </div>

                <div className="imu-group">
                    <h4>Gyro (rad/s)</h4>
                    <AxisBar axis="X" value={gx} range={GYRO_RANGE} colorClass="gyro" />
                    <AxisBar axis="Y" value={gy} range={GYRO_RANGE} colorClass="gyro" />
                    <AxisBar axis="Z" value={gz} range={GYRO_RANGE} colorClass="gyro" />
                </div>
            </section>
        </section>
    )
}

export default IMUGraph;
