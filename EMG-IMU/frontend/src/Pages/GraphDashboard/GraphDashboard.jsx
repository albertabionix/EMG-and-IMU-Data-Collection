/*
    GraphDashboard.jsx
    There are two types of sockets that are used:
        Polling: A technique where a program repeatedly checks the status of a resource at regular intervals to see if an event has changed.
        Socket: Open a two-way interactive communication session between the user's browser and a server without having to poll.
    Owns the single socket connection for the page.
    Passes data down to child components as props.
*/

import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

import './GraphDashboard.css'

import { Camera, EMGGraph, GraphButton, IMUGraph, Timer } from '../../components'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000' // 
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || SOCKET_URL

const MAX_SAMPLES = 120
const EMG_MAX_UV = 1000

const socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    autoConnect: false,
})

// —— helpers ——

// This function takes a raw data packet from the serial port and converts it into an array of numbers.
// The serial port can send data in many different formats, so the function tries each one in order.
function parseSensorPacket(packet) {
    if (!packet || packet.raw == null) return []

    const raw = String(packet.raw).trim()
    if (!raw) return []

    try {
        const parsed = JSON.parse(raw)

        if (Array.isArray(parsed)) {
            return parsed.map(Number).filter((v) => Number.isFinite(v))
        }

        if (parsed && typeof parsed === 'object') {
            const preferredKeys = ['emg1', 'emg2']
            const preferred = preferredKeys
                .filter((k) => k in parsed)
                .map((k) => Number(parsed[k]))
                .filter((v) => Number.isFinite(v))

            if (preferred.length > 0) return preferred

            return Object.values(parsed)
                .map(Number)
                .filter((v) => Number.isFinite(v))
        }
    } catch {
        // fall through to delimited parsing
    }

    return raw
        .split(/[\s,;|]+/)
        .map(Number)
        .filter((v) => Number.isFinite(v))
}

// Changing a port by sending a API to the backend with the new port.
async function changePort(portName) {
    const newPort = portName || prompt('Enter your port name')
    if (!newPort) return

    const response = await fetch(`${API_BASE_URL}/change-port`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newPort }),
    })

    if (!response.ok) {
        throw new Error(`Failed to change port: ${response.status}`)
    }

    return response.json()
}

// ── component ——

function GraphDashboard() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const location = useLocation()
    const timerFunctions = useRef(null)

    // EMG state
    const [series, setSeries] = useState([])
    const [latestValues, setLatestValues] = useState([])
    const [isRecording, setIsRecording] = useState(false)

    // Camera state
    const [cameraImage, setCameraImage] = useState(null)
    const [cvStatus, setCvStatus] = useState('stopped')

    // Experiment name, port, and ID
    const { name, port, ID } = location.state || {}


    // ── socket setup ——

    useEffect(() => {
        // Apply port from navigation state if provided (e.g. from a port-picker screen)
        if (state?.port) {
            changePort(state.port).catch((err) =>
                console.error('Failed to apply selected port:', err)
            )
        }

        const onConnect = () => console.log('Socket connected to backend')
        const onConnectError = (err) => console.error('Socket connection failed:', err)

        const onSensorData = (incomingData) => {
            const values = parseSensorPacket(incomingData)
            if (values.length === 0) return

            setLatestValues(values)
            setSeries((prev) =>
                values.map((value, index) => {
                    const channel = prev[index] || []
                    const updated = [...channel, value]
                    if (updated.length > MAX_SAMPLES) updated.shift()
                    return updated
                })
            )
        }

        const onCvFrame = (payload) => {
            if (payload?.image) setCameraImage(payload.image)
        }

        const onCvStatus = (payload) => {
            if (payload?.status) setCvStatus(payload.status)
        }

        socket.on('connect', onConnect)
        socket.on('connect_error', onConnectError)
        socket.on('sensor_data', onSensorData)
        socket.on('cv_frame', onCvFrame)
        socket.on('cv_status', onCvStatus)
        socket.connect()

        return () => {
            socket.off('connect', onConnect)
            socket.off('connect_error', onConnectError)
            socket.off('sensor_data', onSensorData)
            socket.off('cv_frame', onCvFrame)
            socket.off('cv_status', onCvStatus)
            socket.disconnect()
        }
    }, [state?.port])

    // —— camera controls ——

    async function handleCameraStart() {
        try {
            await fetch(`${API_BASE_URL}/camera/start`, { method: 'POST' })
        } catch (err) {
            console.error('Camera start failed:', err)
        }
    }

    async function handleCameraStop() {
        try {
            await fetch(`${API_BASE_URL}/camera/stop`, { method: 'POST' })
        } catch (err) {
            console.error('Camera stop failed:', err)
        }
    }

    // —— button handlers ——

    async function handleRecord() {
        timerFunctions.current?.start()
        const response = await fetch(`${API_BASE_URL}/record/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ experiment: name, numberID: ID }),
        })

        if (!response.ok) {
            throw new Error(`Failed to record: ${response.status}`)
        }

        return response.json()

    }

    async function handleStop() {
        timerFunctions.current?.stop()
        const response = await fetch(`${API_BASE_URL}/record/stop`, {
            method: 'POST',
        })

        if (!response.ok) {
            throw new Error(`Failed to stop: ${response.status}`)
        }
    }

    function handleHome() {
        navigate('/')
    }

    async function handlePortChange() {
        try {
            await changePort()
        } catch (err) {
            console.error('Port change failed:', err)
        }
    }

    // —— render ——

    return (
        <section className="main-section">
            <Timer ref={timerFunctions} />
            <section className="graphs">
                <section className="IMUs">
                    <IMUGraph />
                </section>
                <EMGGraph
                    series={series}
                    latestValues={latestValues}
                    emgMaxUv={EMG_MAX_UV}
                />

                <Camera
                    cameraImage={cameraImage}
                    cvStatus={cvStatus}
                    onStart={handleCameraStart}
                    onStop={handleCameraStop}
                />

                <section className="buttons">
                    <GraphButton label="Record" name="record" onClick={handleRecord} />
                    <GraphButton label="Stop"   name="stop"   onClick={handleStop} />
                    <GraphButton label="Import" name="import" />
                    <GraphButton label="Port"   name="port"   onClick={handlePortChange} />
                    <GraphButton label="Back"   name="back"   onClick={handleHome} />
                </section>
            </section>
        </section>
    )
}

export default GraphDashboard
