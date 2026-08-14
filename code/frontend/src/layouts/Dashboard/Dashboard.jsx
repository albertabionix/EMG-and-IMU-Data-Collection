/*
    GraphDashboard.jsx
    There are two types of commuication styles that are used:
        Polling: A technique where a program repeatedly checks the status of a resource at regular intervals to see if an event has changed.
        Socket: Open a two-way interactive communication session between the user's browser and a server without having to poll.
    Owns the single socket connection for the page.
    Passes data down to child components as props.
*/

import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'

import './Dashboard.css'

import { 
    Camera, EMGGraph, GraphButton, IMUGraph, Timer, ExperimentName, Notification, ExportPrompt, RecordingLight, ModalWrapper 
} from '../../Components'

import { 
    createFlaskSocket, startCamera, stopCamera, startRecording, stopRecording, exportRecording, discardRecording, 
    changePort as requestPortChange, startImuCalibration 
} from '../../services'

const MAX_SAMPLES = 120
const EMG_MAX_UV = 4095

const socket = createFlaskSocket()

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

const NUM_IMUS = 2

function parseImuPacket(packet) {
    if (!packet || packet.raw == null) return null

    const raw = String(packet.raw).trim()
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return null

        const isValidImu = (obj) => obj && typeof obj === 'object'

        if (Array.isArray(parsed.imus)) {
            const slots = Array(NUM_IMUS).fill(null)
            parsed.imus.slice(0, NUM_IMUS).forEach((imu, i) => {
                slots[i] = isValidImu(imu) ? imu : null
            })
            return slots
        }

        if (isValidImu(parsed.imu)) {
            const slots = Array(NUM_IMUS).fill(null)
            slots[0] = parsed.imu
            return slots
        }
    } catch {
        // not JSON, or no imu/imus key present
    }

    return null
}

// ── component ——

function Dashboard() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const location = useLocation()
    const timerFunctions = useRef(null)

    // Port state
    const [newPort, setNewPort] = useState()

    // Notification state
    const [notification, setNotification] = useState(null)
    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // EMG state
    const [series, setSeries] = useState([])
    const [latestValues, setLatestValues] = useState([])
    const [isRecording, setIsRecording] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [showExportPrompt, setShowExportPrompt] = useState(false)
    const showExportPromptRef = useRef(false)

    // IMU state 
    const [imuData, setImuData] = useState(Array(NUM_IMUS).fill(null))
    const [displayIMU, setDisplayIMU] = useState(0)

    // Camera state
    const [cameraImage, setCameraImage] = useState(null)
    const [cvStatus, setCvStatus] = useState('stopped')
    const [cvMarkers, setCvMarkers] = useState([])
    const [cvAngles, setCvAngles] = useState(null)

    // Terminal state
    const [terminalOpen, setTerminalOpen] = useState(false);

    // Calibration state
    const [isCalibrating, setIsCalibrating] = useState(false)

    // Experiment name (canonical BionixDB Action token), display label, port, and ID
    const { name, label, port, ID } = location.state || {}


    // Discards the orphaned local recording if the user leaves (navigates away, refreshes,
    // or closes the tab) without resolving the export prompt — otherwise the local CSV file
    // is never uploaded and never cleaned up. keepalive lets the request outlive the page.
    function discardIfPromptAbandoned() {
        if (!showExportPromptRef.current) return
        discardRecording({ keepalive: true })
        showExportPromptRef.current = false
    }

    const onCalibrationStatus = (payload) => {
        if (payload?.status === 'complete') {
            setIsCalibrating(false)
            showNotification('Calibration complete', 'info')
        }
    }

    useEffect(() => {
        showExportPromptRef.current = showExportPrompt
    }, [showExportPrompt])

    useEffect(() => {
        window.addEventListener('beforeunload', discardIfPromptAbandoned)
        return () => {
            window.removeEventListener('beforeunload', discardIfPromptAbandoned)
            discardIfPromptAbandoned() // covers in-app navigation away (Back, Home link, etc.)
        }
    }, [])

    // ── socket setup ——

    useEffect(() => {
        // Apply port from navigation state if provided (e.g. from a port-picker screen)
        if (state?.port) {
            changePort(state.port).catch((err) =>
                console.error('Failed to apply selected port:', err)
            )
        }

        setNewPort(port)

        const onConnect = () => console.log('Socket connected to backend')
        const onConnectError = (err) => console.error('Socket connection failed:', err)

        const onSensorData = (incomingData) => {
            const values = parseSensorPacket(incomingData)
            if (values.length > 0) {
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

            // Prefer the backend's pre-parsed, calibrated imus array if present.
            // Fall back to parsing raw only if the backend didn't send it.
            const imus = Array.isArray(incomingData.imus)
                ? incomingData.imus
                : parseImuPacket(incomingData)

            if (imus) {
                setImuData((prev) => imus.map((slot, i) => (slot != null ? slot : prev[i])))
            }
        }

        const onCvFrame = (payload) => {
            if (payload?.image) setCameraImage(payload.image)
        }

        const onCvStatus = (payload) => {
            if (payload?.status) setCvStatus(payload.status)
        }

        const onCvData = (payload) => {
            setCvMarkers(payload?.markers || [])
            setCvAngles(payload?.angles ?? null)
        }

        socket.on('connect', onConnect)
        socket.on('connect_error', onConnectError)
        socket.on('sensor_data', onSensorData)
        socket.on('cv_frame', onCvFrame)
        socket.on('cv_status', onCvStatus)
        socket.on('cv_data', onCvData)
        socket.on('calibration_status', onCalibrationStatus)
        socket.connect()

        return () => {
            socket.off('connect', onConnect)
            socket.off('connect_error', onConnectError)
            socket.off('sensor_data', onSensorData)
            socket.off('cv_frame', onCvFrame)
            socket.off('cv_status', onCvStatus)
            socket.off('cv_data', onCvData)
            socket.off('calibration_status', onCalibrationStatus)
            socket.disconnect()
        
        }
    }, [state?.port])

    // —— camera controls ——

    async function handleCameraStart() {
        try {
            await startCamera()
        } catch (err) {
            console.error('Camera start failed:', err)
        }
    }

    async function handleCameraStop() {
        try {
            await stopCamera()
        } catch (err) {
            console.error('Camera stop failed:', err)
        }
    }

    // —— button handlers ——

    async function handleRecord() {
        try {
            timerFunctions.current?.start()
            const { response, data: result } = await startRecording({ experiment: name, numberID: ID })

            if (!response.ok || result?.error) {
                throw new Error(result?.error || `Failed to record: ${response.status}`)
            }

            showNotification('Recording started', 'info')
            setIsRecording(true)
            return result
        } catch (err) {
            console.error('Recording start failed:', err)
            showNotification('Recording failed', 'info')
        }

    }

    async function handleStop() {
        try {
            timerFunctions.current?.stop()
            const response = await stopRecording()

            if (!response.ok) {
                throw new Error(`Failed to stop: ${response.status}`)
            }

            showNotification('Recording stopped', 'info')
            setShowExportPrompt(true)
            setIsRecording(false)
        } catch (err) {
            console.error('Recording stop failed:', err)
            showNotification('Recording stop failed', 'info')
        }

    }

    async function handleExport() {
        setExporting(true)
        try {
            const { response, data: result } = await exportRecording()
            if (!response.ok || !result?.uploaded) {
                showNotification(result?.error || 'Export failed', 'info')
                return
            }
            showNotification(`Uploaded as ${Object.values(result.names).join(', ')}`, 'info')
            setShowExportPrompt(false)
        } catch (err) {
            showNotification('Could not reach the server to export', 'info')
        } finally {
            setExporting(false)
        }
    }

    async function handleCancelExport() {
        try {
            const { response, data: result } = await discardRecording()
            if (!response.ok || !result?.discarded) {
                showNotification(result?.error || 'Failed to discard recording', 'info')
                return
            }
            showNotification('Recording discarded', 'info')
            setShowExportPrompt(false)
        } catch (err) {
            showNotification('Could not reach the server to discard the recording', 'info')
        }
    }

    function handleHome() {
        navigate('/')
    }

    async function handlePortChange() {
        try {
            await changePort()
            showNotification('Port connected', 'info');
        } catch (err) {
            console.error('Port change failed:', err)
            showNotification('Port failed', 'info');
        }
    }

    // Changing a port by sending a API to the backend with the new port.
    async function changePort(portName) {
        const newPort = portName || prompt('Enter your port name')
        if (!newPort) return

        const { response } = await requestPortChange(newPort)

        if (!response.ok) {
            throw new Error(`Failed to change port: ${response.status}`)
        } 

        setNewPort(newPort)

        return response.json()
    }

    function handleTerminal() {
        setTerminalOpen(true)
    }

    async function handleCalibrate() {
        if (isCalibrating) return

        try {
            const response = await startImuCalibration(5)

            if (response.status === 409) {
                showNotification('Already calibrating', 'info')
                return
            }

            if (!response.ok) {
                throw new Error(`Failed to calibrate: ${response.status}`)
            }

            setIsCalibrating(true)
            showNotification('Calibrating... hold still', 'info')
        } catch (err) {
            console.error('Calibration failed:', err)
            showNotification('Calibration failed', 'info')
        }
    }

    // —— render ——

    return (
        <section className="main-section">
            {notification && (<Notification message={notification.message}/>)}
            <section className='header'>
                <section className='info-section'>
                    <ExperimentName subtitle='Experiment:' title={label || name}/>
                    <ExperimentName subtitle='Port:' title={newPort}/>
                    <ExperimentName subtitle='ID:' title={ID}/>
                </section>
                <RecordingLight isRecording={isRecording}/>
            </section>
            <section className="graphs">
                <section className="IMUs">
                    {imuData.map((data, i) => (
                        <IMUGraph key={`imu-${i}`} label={`IMU ${i + 1}`} data={data} />
                    ))}
                </section>
                <EMGGraph
                    series={series}
                    latestValues={latestValues}
                    emgMaxUv={EMG_MAX_UV}
                />
                <section className='timer-camera-section'>
                    <Timer ref={timerFunctions} />
                    <Camera
                        cameraImage={cameraImage}
                        cvStatus={cvStatus}
                        markers={cvMarkers}
                        angles={cvAngles}
                        onStart={handleCameraStart}
                        onStop={handleCameraStop}
                    />
                </section>
                <section className="buttons">
                    <GraphButton
                        label={isRecording ? 'Stop' : 'Record'}
                        name={isRecording ? 'stop' : 'record'}
                        onClick={isRecording ? handleStop : handleRecord}
                    />
                    <GraphButton label="Port"   name="port"   onClick={handlePortChange} />
                    <GraphButton label="Terminal" name="terminal" onClick={handleTerminal} />
                    <GraphButton
                        label={isCalibrating ? 'Calibrating...' : 'Calibrate'}
                        name="calibrate"
                        onClick={handleCalibrate}
                        disabled={isCalibrating}
                    />
                    <GraphButton label="Back"   name="back"   onClick={handleHome} />
                </section>
            </section>
            {showExportPrompt && (
                <ExportPrompt
                    onExport={handleExport}
                    onCancel={handleCancelExport}
                    exporting={exporting}
                />
            )}
            <ModalWrapper
                isOpen={terminalOpen}
                onClose={() => setTerminalOpen(false)}
                socket={socket}
            />
        </section>
    )
}

export default Dashboard
