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
    Camera, EMGGraph, GraphButton, IMUGraph, Timer, Notification, ExportPrompt, RecordingLight, ModalWrapper, 
    Checkbox, Metronome, CountdownOverlay
} from '../../Components'

import { 
    createFlaskSocket, startCamera, stopCamera, startRecording, stopRecording, exportRecording, discardRecording, 
    changePort as requestPortChange, startImuCalibration 
} from '../../services'

const MAX_SAMPLES = 120
const EMG_MAX_UV = 4095

const EXPERIMENT_OPTIONS = [
    { label: 'Extend & Contract', value: 'seated' },
    { label: 'Gait Cycle', value: 'walking' },
    { label: 'Staircase', value: 'stairs' },
]

const EXERCISE_OPTIONS_BY_EXPERIMENT = {
    seated: [
        { label: 'Baseline', value: 'baseline' },
        { label: '30°', value: '30' },
        { label: '60°', value: '60' },
        { label: '90°', value: '90' },
        { label: 'Heel Dig', value: 'heel_dig' },
        { label: 'Leg Raise', value: 'leg_raise' },
    ],
    walking: [
        { label: 'Baseline', value: 'baseline' },
        { label: 'Right Leg', value: 'r_leg' },
        { label: 'Left Leg', value: 'l_leg' },
        { label: 'Walking', value: 'walking' },
        { label: 'Inclined Walking', value: '15_walking' },
    ],
    stairs: [
        { label: 'Baseline', value: 'baseline' },
        { label: 'Forward/Back Right Leg', value: 'f_b_r_leg' },
        { label: 'Forward/Back Left Leg', value: 'f_b_l_leg' },
        { label: 'Forward/Over Right Leg', value: 'f_o_r_leg' },
        { label: 'Forward/Over Left Leg', value: 'f_o_l_leg' },
        { label: 'Step Over Right Leg', value: 'step_over_r_leg' },
        { label: 'Step Over Left Leg', value: 'step_over_l_leg' },
        { label: 'Stairmaster', value: 'stairmaster' },
    ],
}

const socket = createFlaskSocket()

// —— helpers ——

// This function takes a raw data packet from the serial port and converts it into an array of numbers.
// The serial port can send data in many different formats, so the function tries each one in order.
const NUM_IMUS = 2;

/**
 * Extracts and normalizes the EMG values into a clean numerical array: [emg1, emg2]
 */
function parseSensorPacket(packet) {
    if (!packet) return [];

    // 1. Direct handle: check if our new pre-parsed numerical properties exist
    if (packet.emg1 !== undefined && packet.emg2 !== undefined) {
        const emg1 = Number(packet.emg1);
        const emg2 = Number(packet.emg2);
        
        if (Number.isFinite(emg1) && Number.isFinite(emg2)) {
            return [emg1, emg2];
        }
    }

    // 2. Legacy fallback: support old JSON text strings if you use them for testing
    if (packet.raw != null) {
        const raw = String(packet.raw).trim();
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                const preferredKeys = ['emg1', 'emg2'];
                const preferred = preferredKeys
                    .filter((k) => k in parsed)
                    .map((k) => Number(parsed[k]))
                    .filter((v) => Number.isFinite(v));

                if (preferred.length > 0) return preferred;
            }
        } catch {
            // Fall through to legacy character split parsing
        }
        return raw.split(/[\s,;|]+/).map(Number).filter((v) => Number.isFinite(v));
    }

    return [];
}

/**
 * Normalizes IMU packets into a fixed-length list of arrays or objects matching NUM_IMUS slots
 */
function parseImuPacket(packet) {
    if (!packet) return null;

    // 1. Direct handle: check if our new pre-structured array exists
    if (Array.isArray(packet.imus)) {
        const slots = Array(NUM_IMUS).fill(null);
        packet.imus.slice(0, NUM_IMUS).forEach((imu, i) => {
            // Ensure the nested tracking dictionary maps cleanly
            slots[i] = (imu && typeof imu === 'object') ? imu : null;
        });
        return slots;
    }

    // 2. Legacy fallback: support old JSON text strings
    if (packet.raw != null) {
        const raw = String(packet.raw).trim();
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.imus)) {
                const slots = Array(NUM_IMUS).fill(null);
                parsed.imus.slice(0, NUM_IMUS).forEach((imu, i) => {
                    slots[i] = (imu && typeof imu === 'object') ? imu : null;
                });
                return slots;
            }
        } catch {
            // Not JSON
        }
    }

    return null;
}


// ── component ——

function Dashboard() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const location = useLocation()
    const timerFunctions = useRef(null)
    const countdownIntervalRef = useRef(null)

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
    const [isStartingRecording, setIsStartingRecording] = useState(false)
    const [countdownValue, setCountdownValue] = useState(null)
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

    // Experiment name (canonical BionixDB Action token), display label, exercise, and ID
    const { name, label, exercise, exerciseLabel, port, ID } = location.state || {}
    const [selectedExperiment, setSelectedExperiment] = useState(name || 'seated')
    const [selectedExercise, setSelectedExercise] = useState(exercise || Object.values(EXERCISE_OPTIONS_BY_EXPERIMENT)[0][0].value)
    const currentExerciseOptions = EXERCISE_OPTIONS_BY_EXPERIMENT[selectedExperiment] || EXERCISE_OPTIONS_BY_EXPERIMENT.seated

    function handleExperimentChange(nextExperiment) {
        setSelectedExperiment(nextExperiment)
        const nextOptions = EXERCISE_OPTIONS_BY_EXPERIMENT[nextExperiment] || EXERCISE_OPTIONS_BY_EXPERIMENT.seated
        const nextExercise = nextOptions.some((option) => option.value === selectedExercise)
            ? selectedExercise
            : nextOptions[0]?.value || ''
        setSelectedExercise(nextExercise)
    }

    // Checkbox state
    const [isCheckedCountdown, setIsCheckedCountdown] = useState(false);
    const [isCheckedMetronome, setIsCheckedMetronome] = useState(false);
    const [isCheckedTest, setIsCheckedTest] = useState(false);

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

    useEffect(() => {
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
            }
        }
    }, [])

    function runCountdown(seconds = 3) {
        return new Promise((resolve) => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
            }

            let current = seconds
            setCountdownValue(current)

            countdownIntervalRef.current = setInterval(() => {
                current -= 1

                if (current > 0) {
                    setCountdownValue(current)
                    return
                }

                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
                setCountdownValue(null)
                resolve()
            }, 1000)
        })
    }

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
        if (isRecording || isStartingRecording) return

        setIsStartingRecording(true)

        try {
            timerFunctions.current?.start()

            if (isCheckedCountdown) {
                await runCountdown(3)
            }

            const { response, data: result } = await startRecording({
                experiment: selectedExperiment,
                exercise: selectedExercise,
                numberID: ID,
            })

            if (!response.ok || result?.error) {
                throw new Error(result?.error || `Failed to record: ${response.status}`)
            }

            showNotification('Recording started', 'info')
            setIsRecording(true)
            return result
        } catch (err) {
            timerFunctions.current?.stop()
            console.error('Recording start failed:', err)
            showNotification('Recording failed', 'info')
        } finally {
            setIsStartingRecording(false)
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
            setIsRecording(false)

            if (isCheckedTest) {
                const { response: localResponse, data: localResult } = await exportRecording({ local: true })
                if (!localResponse.ok || !localResult?.saved) {
                    throw new Error(localResult?.error || `Failed to save recording locally: ${localResponse.status}`)
                }
                showNotification('Recording saved to local tests folder', 'info')
            } else {
                setShowExportPrompt(true)
            }
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

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.code !== 'Space' || event.repeat) return

            const target = event.target
            if (
                target instanceof HTMLElement &&
                (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))
            ) {
                return
            }

            event.preventDefault()

            if (isStartingRecording) return

            if (isRecording) {
                handleStop()
                return
            }

            handleRecord()
        }

        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
        }
    })

    // —— render ——

    return (
        <section className="main-section">
            {notification && (<Notification message={notification.message}/>)}
            <section className='header'>
                <section className='info-section'>
                    <section className='ExperimentName-section'>
                        <p className='subtitle'>Experiment:</p>
                        <select className='dashboard-select' value={selectedExperiment} onChange={(e) => handleExperimentChange(e.target.value)}>
                            {EXPERIMENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </section>
                    <section className='ExperimentName-section'>
                        <p className='subtitle'>Exercise:</p>
                        <select className='dashboard-select' value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}>
                            {currentExerciseOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </section>
                    <section className='ExperimentName-section'>
                        <p className='subtitle'>ID:</p>
                        <p className='id-title'>{ID}</p>
                    </section>
                </section>
                <RecordingLight isRecording={isRecording}/>
            </section>
            <section className="graphs">
                <section className="IMUs">
                    {imuData.map((data, i) => (
                        <IMUGraph key={`imu-${i}`} label={i === 0 ? 'Thigh' : 'Shank'} data={data} />
                    ))}
                </section>
                <EMGGraph
                    series={series}
                    isLive={series.some((channel) => Array.isArray(channel) && channel.length > 0)}
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
                        label={isRecording ? 'Stop' : isStartingRecording ? 'Starting...' : 'Record'}
                        name={isRecording ? 'stop' : 'record'}
                        onClick={isRecording ? handleStop : handleRecord}
                        disabled={isStartingRecording}
                    />
                    <GraphButton label="Port"   name="port"   onClick={handlePortChange} />
                    <GraphButton label="Terminal" name="terminal" onClick={handleTerminal} />
                    <GraphButton
                        label={isCalibrating ? 'Calibrating...' : 'Calibrate'}
                        name="calibrate"
                        onClick={handleCalibrate}
                        disabled={isCalibrating}
                    />
                    <GraphButton label="Back" name="back" onClick={handleHome} />
                    <Checkbox
                        label="Countdown"
                        checked={isCheckedCountdown}
                        onChange={(e) => setIsCheckedCountdown(e.target.checked)}
                    />
                    <Checkbox
                        label="Metronome"
                        checked={isCheckedMetronome}
                        onChange={(e) => setIsCheckedMetronome(e.target.checked)}
                    />
                    <Checkbox
                        label="Test"
                        checked={isCheckedTest}
                        onChange={(e) => setIsCheckedTest(e.target.checked)}
                    />
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
            <CountdownOverlay value={countdownValue} />
            <Metronome enabled={isCheckedMetronome} isRecording={isRecording} />
        </section>
    )
}

export default Dashboard
