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
const AXIS_MIN_X = 12
const AXIS_MAX_X = 200
const AXIS_VIEWBOX = '-12 0 224 100'

// —— socket ——

const socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    autoConnect: false,
})

// —— helpers ——

function buildPoints(values) {
    if (values.length <= 1) {
        return `${AXIS_MIN_X},50`
    }

    const scaled = values.map((value) => {
        const uv = Math.max(0, Math.min(value, EMG_MAX_UV))
        return (uv / EMG_MAX_UV) * 100
    })

    return scaled
        .map((value, index) => {
            const x = AXIS_MIN_X + (index / (scaled.length - 1)) * (AXIS_MAX_X - AXIS_MIN_X)
            const y = 100 - value
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
        const yPercent = 100 - (i / EMG_MAX_UV) * 100
        yTicks.push({ value: i, yPercent })
    }

    return (
        <svg
            viewBox={AXIS_VIEWBOX}
            preserveAspectRatio="xMinYMid meet"
            aria-label={`EMG ${channelIndex + 1} graph`}
            className="emg-chart"
        >
            {yTicks.map((tick, idx) => (
                <line key={`grid-${idx}`} x1={AXIS_MIN_X} y1={tick.yPercent} x2={AXIS_MAX_X} y2={tick.yPercent} className="grid-line" />
            ))}
            <line x1={AXIS_MIN_X} y1="0" x2={AXIS_MIN_X} y2="100" className="axis" />
            {yTicks.map((tick, idx) => (
                <g key={`tick-${idx}`}>
                    <line x1={AXIS_MIN_X - 2} y1={tick.yPercent} x2={AXIS_MIN_X} y2={tick.yPercent} className="tick" />
                    <text x={AXIS_MIN_X - 3} y={tick.yPercent + 0.2} className="tick-label" textAnchor="end" dominantBaseline="middle">
                        {tick.value}
                    </text>
                </g>
            ))}
            <text x="-7" y="50" className="axis-label" textAnchor="middle" transform="rotate(-90 -7 50)">
                µV
            </text>
            <polyline points={points} className="emg-line" />
        </svg>
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
