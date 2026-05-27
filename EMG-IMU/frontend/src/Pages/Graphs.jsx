import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { io } from "socket.io-client";
import '../CSS/graphs.css'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:5000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || SOCKET_URL;
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

async function changePort() {
    const newPort = prompt("Enter your port name");
    if (!newPort) {
        return;
    }

    const response = await fetch(`${API_BASE_URL}/change-port`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newPort })
    });

    if (!response.ok) {
        throw new Error(`Failed to change port: ${response.status}`);
    }

    await response.json();
}

async function openCamera() {
    await fetch('http://localhost:5000/api/camera/start', { method: 'POST' });
}

function record() {

}

let elapsed = 0;
let running = false;
let intervalId = null;
let startTime = null;

const element = document.getElementById("intro");

function start() {
    if (running) return;
    running = true;
    startTime = Date.now() - elapsed;
    intervalId = setInterval(() => {
        elapsed = Date.now() - startTime;
        document.getElementById("timer").innerHTML = formatTime(elapsed);
    }, 10);
}

function stop() {
    running = false;
    clearInterval(intervalId);
    elapsed = 0;
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function Graphs() {
    const [series, setSeries] = useState([]);
    const [latestValues, setLatestValues] = useState([]);
    const [cameraImage, setCameraImage] = useState(null);
    const [cvStatus, setCvStatus] = useState('stopped');

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
        socket.on("cv_frame", (payload) => {
            if (payload && payload.image) {
                setCameraImage(payload.image);
            }
        });

        socket.on("cv_status", (payload) => {
            if (payload && payload.status) {
                setCvStatus(payload.status);
            }
        });
        socket.connect();

        return () => {
            socket.off("connect", onConnect);
            socket.off("connect_error", onConnectError);
            socket.off("sensor_data", onSensorData);
            socket.off("cv_frame");
            socket.off("cv_status");
            socket.disconnect();
        };
    }, []);

    const channelCount = Math.max(series.length, 2);

    return (
        <>
            <section className='main-section'>
                <p id='timer'>0:00.00</p>
                <section className="graphs">
                    <section className="IMUs">
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
                    <div className="camera-panel">
                        <div className="camera-controls">
                            <button onClick={async () => { await fetch(`${API_BASE_URL}/camera/start`, { method: 'POST' }); }}>Start Camera</button>
                            <button onClick={async () => { await fetch(`${API_BASE_URL}/camera/stop`, { method: 'POST' }); }}>Stop Camera</button>
                        </div>
                        <div className="camera-preview">
                            {cameraImage ? (
                                <img src={cameraImage} alt="Camera Preview" />
                            ) : (
                                <div className="camera-placeholder">No preview</div>
                            )}
                        </div>
                    </div>
                    <section className="buttons">
                        <button onClick={start}>Record</button>
                        <button onClick={stop}>Stop</button>
                        <button>Import CSV</button>
                        <button onClick={changePort}>Change Port</button>
                        <Link className="button" to="/">Back</Link>
                    </section>
                </section>
            </section>
        </>
    )
}

export default Graphs
