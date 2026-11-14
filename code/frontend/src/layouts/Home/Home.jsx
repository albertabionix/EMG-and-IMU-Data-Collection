/*
    Home.jsx
    This is the beginning of the program with the pages:
        Graphs
        Help
        Authenticate
    Sends the name, ID, and port to the graphs page.
*/

import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from "react";

import './Home.css'

import { HomeInput, HomeButton, Dropdown, ConfirmButton } from '../../components'
import { login, listPorts, changePort } from '../../services'

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

// Display labels map to BionixDB's canonical Action tokens (see ACTION_NAMES in
// bionix_db/bionixdb.py) so the value sent to the backend already matches what
// upload_emg/upload_imu/upload_cvkas expect — no translation layer needed later.
const EXPERIMENT_OPTIONS = [
    { label: 'Extend & Contract', value: 'seated' },
    { label: 'Gait Cycle', value: 'walking' },
    { label: 'Staircase', value: 'stairs' },
]

function Home() {
    // States
    const [showInputs, setShowInputs] = useState(false);
    const [name, setName] = useState("seated"); // canonical Action token, see EXPERIMENT_OPTIONS
    const [exercise, setExercise] = useState('baseline');
    const [port, setPort] = useState('');
    const [portOptions, setPortOptions] = useState([]);
    const [portConnected, setPortConnected] = useState(false);
    const [portSimulated, setPortSimulated] = useState(false);
	const [ID, setID] = useState('');
    const [error, setError] = useState('')
    const [authError, setAuthError] = useState('')
    const [authStatus, setAuthStatus] = useState('') // CONTENT_MANAGER, DEVELOPER (developers.json, no uploads), or '' if not authenticated
    const [authenticating, setAuthenticating] = useState(false)
    const authAbortRef = useRef(null)
    const authCancelledRef = useRef(false)

    const navigate = useNavigate();

    // Load the serial ports that exist on this machine. The backend picks a port at
    // startup (SERIAL_PORT env, last choice, or best guess); show that as selected.
    async function refreshPorts() {
        try {
            const { response, data } = await listPorts()
            if (!response.ok || !data) return
            const options = data.ports.map((p) => ({
                value: p.device,
                label: p.description && p.description !== 'n/a' ? `${p.device} (${p.description})` : p.device,
            }))
            const current = data.current || data.suggested || ''
            // Keep the active port selectable even if the OS no longer lists it.
            if (current && !options.some((o) => o.value === current)) {
                options.unshift({ value: current, label: `${current} (not found)` })
            }
            setPortOptions(options)
            setPort(current)
            setPortConnected(data.connected)
            setPortSimulated(Boolean(data.simulated))
        } catch {
            setPortOptions([])
        }
    }

    useEffect(() => {
        refreshPorts()
        // Poll so the connection status updates once the sensor connects.
        const id = setInterval(async () => {
            try {
                const { data } = await listPorts()
                if (data) {
                    setPortConnected(data.connected)
                    setPortSimulated(Boolean(data.simulated))
                }
            } catch { /* backend not reachable yet */ }
        }, 3000)
        return () => clearInterval(id)
    }, [])

    async function handlePortChange(nextPort) {
        setPort(nextPort)
        setPortConnected(false)
        if (nextPort) await changePort(nextPort)
    }
    const exerciseOptions = EXERCISE_OPTIONS_BY_EXPERIMENT[name] || EXERCISE_OPTIONS_BY_EXPERIMENT.seated

    function handleExperimentChange(nextExperiment) {
        setName(nextExperiment)
        const nextOptions = EXERCISE_OPTIONS_BY_EXPERIMENT[nextExperiment] || EXERCISE_OPTIONS_BY_EXPERIMENT.seated
        const nextExercise = nextOptions.some((option) => option.value === exercise)
            ? exercise
            : nextOptions[0]?.value || ''
        setExercise(nextExercise)
    }

    // Opens and closes the start menu
    function handleStart() {
        if (!showInputs) {
            setShowInputs(true);
        } else {
            setShowInputs(false);
        }
    }

    // Opens the help page
    function handleHelp() {
        navigate('/help')
    }

    // When the submit button is pressed after the name and ID are chosen go to the graphs page.
    function submit() {
        if (!name) {
            setError("Missing the experiment name")
            return
        }
        if (!exercise) {
            setError("Missing the exercise type")
            return
        }
        if (!ID) {
            setError("Missing the ID name")
            return
        }
        if (!port) {
            setError("Select the sensor's port (pair the sensor over Bluetooth first)")
            return
        }
        const label = EXPERIMENT_OPTIONS.find((option) => option.value === name)?.label || name
        const exerciseLabel = (EXERCISE_OPTIONS_BY_EXPERIMENT[name] || [])
            .find((option) => option.value === exercise)?.label || exercise
        navigate('/graphs', { state: { name, label, exercise, exerciseLabel, port, ID } })
    }
    
    async function authenticate() {
        setAuthenticating(true)
        setError('')
        // The backend opens a real browser login (BionixDB's OAuth flow) and waits for it
        // to complete with no timeout of its own — if the user closes that tab without
        // finishing, this fetch would otherwise hang forever and leave the button stuck.
        // Abort after a generous window so the user can just click Authenticate again.
        const controller = new AbortController()
        authAbortRef.current = controller
        authCancelledRef.current = false
        const timeoutId = setTimeout(() => controller.abort(), 90000)
        try {
            const { response, data: result } = await login({ signal: controller.signal })
            if (!response.ok || !result?.authenticated) {
                setAuthStatus('')
                setError(result?.error || 'Authentication failed')
                return
            }
            setAuthStatus(result.access)
        } catch (err) {
            setAuthStatus('')
            if (err.name === 'AbortError') {
                setAuthError(authCancelledRef.current ? 'Authentication cancelled' : 'Authentication timed out — please try again')
            } else {
                setAuthError('Could not reach the server to authenticate')
            }
        } finally {
            clearTimeout(timeoutId)
            authAbortRef.current = null
            setAuthenticating(false)
        }
    }

    // Lets the user give up on a stuck login (e.g. they picked the wrong Google account or
    // granted the wrong Drive access) immediately, instead of waiting for the 90s timeout.
    function cancelAuthenticate() {
        authCancelledRef.current = true
        authAbortRef.current?.abort()
    }

    return (
        <>
            <section className="main">
                <section className="title-block"> 
                    <h1 className="title">EMG and IMU Data Collector</h1>
                    <h2 className="subtitle">Alberta Bionix</h2>
                </section>
                <section className="work-block">
                    <section className='button-flex'>
                        <HomeButton label='Start' onClick={handleStart} disabled={!['CONTENT_MANAGER', 'DEVELOPER'].includes(authStatus)}/>
                        <HomeButton label='Help' onClick={handleHelp}/>
                        <HomeButton
                            label={authenticating ? 'Cancel' : authStatus ? `Authenticated (${authStatus})` : 'Authenticate'}
                            onClick={authenticating ? cancelAuthenticate : authenticate}
                        />
                    </section>
                    {authError && <p className='error'>{authError}</p>}
                    {/* appears below buttons when Start is clicked */}
                    {showInputs && (
                        <section id="start-section">
                            <Dropdown 
                                label='Experiment'
                                value={name}
                                onChange={(e) => handleExperimentChange(e.target.value)}
                                options={EXPERIMENT_OPTIONS}
                            />	
                            <HomeInput 
                                label='ID Number'
                                type='text'
                                name='id number'
                                placeholder=''
                                value={ID}
                                onChange={(e) => setID(e.target.value)}
                            />
                            <Dropdown
                                label='Exercise'
                                value={exercise}
                                onChange={(e) => setExercise(e.target.value)}
                                options={exerciseOptions}
                            />
                            <Dropdown
                                label='Port'
                                value={port}
                                onChange={(e) => handlePortChange(e.target.value)}
                                options={[{ value: '', label: portOptions.length ? 'Select a port' : 'No ports found' }, ...portOptions]}
                            />
                            <p className='port-status'>
                                {port ? (portSimulated ? 'Simulated sensor - data is fake' : portConnected ? 'Sensor connected' : 'Waiting for sensor...') : ''}
                                {' '}<button type='button' className='port-refresh' onClick={refreshPorts}>Refresh ports</button>
                            </p>
                            {error && <p className='error'>{error}</p>}
                            <ConfirmButton
                                label='Submit'
                                name='button'
                                onClick={submit}
                            />
                        </section>
                    )}
                </section>
            </section>
        </>
    );
}

export default Home