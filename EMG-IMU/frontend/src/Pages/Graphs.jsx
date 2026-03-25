import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { io } from "socket.io-client";
import '../CSS/graphs.css'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:5000";
const socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"],
    autoConnect: false,
});
const MAX_SAMPLES = 120;
const EMG_MAX_UV = 1000;
const AXIS_MIN_X = 12;
const AXIS_MAX_X = 200;
const AXIS_VIEWBOX = "-12 0 224 100";

function buildPoints(values) {
    if (values.length <= 1) {
        return `${AXIS_MIN_X},50`;
    }

    // Map raw EMG values directly to µV scale (0-1000)
    const scaled = values.map((value) => {
        const uv = Math.max(0, Math.min(value, EMG_MAX_UV));
        return (uv / EMG_MAX_UV) * 100;
    });

    return scaled
        .map((value, index) => {
            const x = AXIS_MIN_X + (index / (scaled.length - 1)) * (AXIS_MAX_X - AXIS_MIN_X);
            const y = 100 - value;
            return `${x},${y}`;
        })
        .join(' ');
}

function renderChartWithAxes(values, channelIndex) {
    const points = buildPoints(values);
    const TICK_INTERVAL = 250;
    
    const yTicks = [];
    for (let i = 0; i <= EMG_MAX_UV; i += TICK_INTERVAL) {
        const yPercent = 100 - (i / EMG_MAX_UV) * 100;
        yTicks.push({ value: i, yPercent });
    }

    return (
        <svg viewBox={AXIS_VIEWBOX} preserveAspectRatio="xMinYMid meet" aria-label={`EMG ${channelIndex + 1} graph`} className="emg-chart">
            {/* Horizontal grid lines */}
            {yTicks.map((tick, idx) => (
                <line key={`grid-${idx}`} x1={AXIS_MIN_X} y1={tick.yPercent} x2={AXIS_MAX_X} y2={tick.yPercent} className="grid-line" />
            ))}
            {/* Y-axis */}
            <line x1={AXIS_MIN_X} y1="0" x2={AXIS_MIN_X} y2="100" className="axis" />
            {/* Y-axis tick marks and labels */}
            {yTicks.map((tick, idx) => (
                <g key={`tick-${idx}`}>
                    <line x1={AXIS_MIN_X - 2} y1={tick.yPercent} x2={AXIS_MIN_X} y2={tick.yPercent} className="tick" />
                    <text x={AXIS_MIN_X - 3} y={tick.yPercent + 0.2} className="tick-label" textAnchor="end" dominantBaseline="middle">
                        {tick.value}
                    </text>
                </g>
            ))}
            {/* Y-axis label */}
            <text x="-7" y="50" className="axis-label" textAnchor="middle" transform="rotate(-90 -7 50)">
                µV
            </text>
            {/* Plot line */}
            <polyline points={points} className="emg-line" />
        </svg>
    );
}

function parseSensorPacket(packet) {
    if (!packet || packet.raw == null) {
        return [];
    }

    const raw = String(packet.raw).trim();
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            return parsed.map(Number).filter((value) => Number.isFinite(value));
        }

        if (parsed && typeof parsed === 'object') {
            const preferredKeys = ['emg1', 'emg2'];
            const preferredValues = preferredKeys
                .filter((key) => key in parsed)
                .map((key) => Number(parsed[key]))
                .filter((value) => Number.isFinite(value));

            if (preferredValues.length > 0) {
                return preferredValues;
            }

            return Object.values(parsed)
                .map(Number)
                .filter((value) => Number.isFinite(value));
        }
    } catch {
        // Continue with delimited parsing when payload is plain text.
    }

    return raw
        .split(/[\s,;|]+/)
        .map(Number)
        .filter((value) => Number.isFinite(value));
}



function Graphs() {
    const [series, setSeries] = useState([]);
    const [latestValues, setLatestValues] = useState([]);

    useEffect(() => {
        const onConnect = () => {
            console.log("Socket connected to backend");
        };

        const onConnectError = (error) => {
            console.error("Socket connection failed:", error);
        };

        const onSensorData = (incomingData) => {
            const values = parseSensorPacket(incomingData);
            if (values.length === 0) {
                return;
            }

            setLatestValues(values);
            setSeries((previousSeries) => {
                const nextSeries = values.map((value, index) => {
                    const previousChannel = previousSeries[index] || [];
                    const updatedChannel = [...previousChannel, value];

                    if (updatedChannel.length > MAX_SAMPLES) {
                        updatedChannel.shift();
                    }

                    return updatedChannel;
                });

                return nextSeries;
            });
        };

        socket.on("connect", onConnect);
        socket.on("connect_error", onConnectError);
        socket.on("sensor_data", onSensorData);
        socket.connect();

        return () => {
            socket.off("connect", onConnect);
            socket.off("connect_error", onConnectError);
            socket.off("sensor_data", onSensorData);
            socket.disconnect();
        };
    }, []);

    const channelCount = Math.max(series.length, 2);

    return (
        <>
            <section className="graphs">
                <section className="IMUs">
                    <section className="IMU">
                        <div></div>
                    </section>
                    <section className="IMU">
                        <div></div>
                    </section>
                    <section className="IMU">
                        <div></div>
                    </section>
                </section>
                <section className="EMGs">
                    {Array.from({ length: channelCount }).map((_, index) => (
                        <section className="EMGPanel" key={`emg-${index}`}>
                            <div className="emg-graph">
                                {renderChartWithAxes(series[index] || [], index)}
                            </div>
                        </section>
                    ))}
                </section>
                <section className="buttons">
                    <button>Record</button>
                    <button>Stop</button>
                    <button>Import CSV</button>
                    <button>Change Port</button>
                    <Link className="button" to="/">Back</Link>
                </section>
            </section>
        </>
    )
}

export default Graphs
