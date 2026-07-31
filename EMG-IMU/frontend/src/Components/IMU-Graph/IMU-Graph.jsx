import React from 'react';
import './IMU-Graph.css'

// Fixed scale for the bar gauges. Accel in m/s^2, gyro in rad/s.
// Tune these to whatever range makes sense for your motion capture.
const ACCEL_RANGE = 20;   // +/- 20 m/s^2
const GYRO_RANGE = 10;    // +/- 10 rad/s

function clampToPercent(value, range) {
    if (value == null || Number.isNaN(value)) return 50; // center if no data
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

const IMUGraph = ({ label = 'IMU', data }) => {
    // data shape: { ax, ay, az, gx, gy, gz } or null/undefined if not connected yet
    const { ax, ay, az, gx, gy, gz } = data || {};

    return (
        <section className="imugraph-section">
            <section className="IMU">
                <header className="imu-header">
                    <h3>{label}</h3>
                    <span className={`imu-status ${data ? 'live' : 'offline'}`}>
                        {data ? 'LIVE' : 'NO DATA'}
                    </span>
                </header>

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

export default IMUGraph