/*
    EMG-Graph.jsx
    This displays both EMGs and are parsed and built in real time using sockets.
*/
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

import './EMG-Graph.css'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000'
const MAX_SAMPLES = 120
const EMG_MAX_UV = 1023
const AXIS_MIN_X = 6
const AXIS_MAX_X = 205
const AXIS_MIN_Y = 6
const AXIS_MAX_Y = 110
const AXIS_VIEWBOX_X = -12
const AXIS_VIEWBOX_Y = 0
const AXIS_VIEWBOX_WIDTH = 224
const AXIS_VIEWBOX_HEIGHT = 112
const AXIS_VIEWBOX = `${AXIS_VIEWBOX_X} ${AXIS_VIEWBOX_Y} ${AXIS_VIEWBOX_WIDTH} ${AXIS_VIEWBOX_HEIGHT}`

// single source of truth for SVG-y -> CSS top% conversion
const toTopPercent = (svgY) =>
    ((svgY - AXIS_VIEWBOX_Y) / AXIS_VIEWBOX_HEIGHT) * 100

// —— socket ——

const socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    autoConnect: false,
})

// —— helpers ——

function buildPoints(values) {
    if (values.length <= 1) {
        return `${AXIS_MIN_X},${(AXIS_MIN_Y + AXIS_MAX_Y) / 2}`
    }

    const scaled = values.map((value) => {
        const uv = Math.max(0, Math.min(value, EMG_MAX_UV))
        return (uv / EMG_MAX_UV) * (AXIS_MAX_Y - AXIS_MIN_Y)
    })

    return scaled
        .map((value, index) => {
            const x = AXIS_MIN_X + (index / (scaled.length - 1)) * (AXIS_MAX_X - AXIS_MIN_X)
            const y = AXIS_MAX_Y - value
            return `${x},${y}`
        })
        .join(' ')
}

// 

function parseSensorPacket(packet) {
    if (!packet || packet.raw == null) return []

    const raw = String(packet.raw).trim()
    if (!raw) return []

    try {
        const parsed = JSON.parse(raw)

        if (Array.isArray(parsed)) {
            return parsed.map(Number).filter((value) => Number.isFinite(value))
        }

        if (parsed && typeof parsed === 'object') {
            const preferredKeys = ['emg1', 'emg2']
            const preferredValues = preferredKeys
                .filter((key) => key in parsed)
                .map((key) => Number(parsed[key]))
                .filter((value) => Number.isFinite(value))

            if (preferredValues.length > 0) return preferredValues

            return Object.values(parsed)
                .map(Number)
                .filter((value) => Number.isFinite(value))
        }
    } catch {
        // fall through to delimited parsing
    }

    return raw
        .split(/[\s,;|]+/)
        .map(Number)
        .filter((value) => Number.isFinite(value))
}

function EMGChart({ values, channelIndex }) {
    const points = buildPoints(values)
    const TICK_INTERVAL = 250

    const yTicks = []
    for (let i = 0; i <= EMG_MAX_UV; i += TICK_INTERVAL) {
        const yPercent = AXIS_MAX_Y - (i / EMG_MAX_UV) * (AXIS_MAX_Y - AXIS_MIN_Y)
        yTicks.push({ value: i, yPercent })
    }

    return (
        <div className="emg-chart-wrapper">
            <svg
                viewBox={AXIS_VIEWBOX}
                preserveAspectRatio="none"
                aria-label={`EMG ${channelIndex + 1} graph`}
                className="emg-chart"
            >
                {yTicks.map((tick, idx) => (
                    <line key={`grid-${idx}`} x1={AXIS_MIN_X} y1={tick.yPercent} x2={AXIS_MAX_X} y2={tick.yPercent} className="grid-line" />
                ))}
                <line x1={AXIS_MIN_X} y1={AXIS_MIN_Y} x2={AXIS_MIN_X} y2={AXIS_MAX_Y} className="axis" />
                <polyline points={points} className="emg-line" />
            </svg>

            <div className="emg-tick-labels">
                {yTicks.map((tick, idx) => (
                    <span
                        key={`ticklabel-${idx}`}
                        className="emg-tick-label"
                        style={{ top: `${toTopPercent(tick.yPercent)}%` }}
                    >
                        {tick.value}
                    </span>
                ))}
                <span className="emg-axis-label">µV</span>
            </div>
        </div>
    )
}

// —— component ——

const EMGGraph = ({ series, isLive }) => {
    const channelCount = Math.max(series.length, 2)
    return (
        <section className="emggraph-section">
            {Array.from({ length: channelCount }).map((_, index) => (
                <section className="EMGPanel" key={`emg-${index}`}>
                    <div className="emg-panel-header">
                        <h3>{`EMG ${index + 1}`}</h3>
                        <span className={`imu-status ${isLive ? 'live' : 'offline'}`}>
                            {isLive ? 'LIVE' : 'NO DATA'}
                        </span>
                    </div>
                    <div className="emg-graph">
                        <EMGChart values={series[index] || []} channelIndex={index} />
                    </div>
                </section>
            ))}
        </section>
    )
}

export default function EMGReader() {
    const [series, setSeries] = useState([])
    const [isLive, setIsLive] = useState(false)
    const liveTimeoutRef = useRef(null)

    useEffect(() => {
        const onConnect = () => console.log('EMG socket connected')
        const onConnectError = (error) => {
            console.error('EMG socket error:', error)
            setIsLive(false)
        }
        const onDisconnect = () => setIsLive(false)

        const onSensorData = (incomingData) => {
            const values = parseSensorPacket(incomingData)
            if (values.length === 0) return

            setIsLive(true)
            clearTimeout(liveTimeoutRef.current)
            liveTimeoutRef.current = setTimeout(() => setIsLive(false), 2000)

            setSeries((prev) => {
                return values.map((value, index) => {
                    const prevChannel = prev[index] || []
                    const updated = [...prevChannel, value]
                    if (updated.length > MAX_SAMPLES) updated.shift()
                    return updated
                })
            })
        }

        socket.on('connect', onConnect)
        socket.on('connect_error', onConnectError)
        socket.on('disconnect', onDisconnect)
        socket.on('sensor_data', onSensorData)
        socket.connect()

        return () => {
            socket.off('connect', onConnect)
            socket.off('connect_error', onConnectError)
            socket.off('disconnect', onDisconnect)
            socket.off('sensor_data', onSensorData)
            socket.disconnect()
            clearTimeout(liveTimeoutRef.current)
        }
    }, [])

    return <EMGGraph series={series} isLive={isLive} />
}
