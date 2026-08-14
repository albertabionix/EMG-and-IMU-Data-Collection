/*
    Home.jsx
    This is the beginning of the program with the pages:
        Graphs
        Help
        Authenticate
    Sends the name, ID, and port to the graphs page.
*/

import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef } from "react";

import './Home.css'

import { HomeInput, HomeButton, Dropdown, ConfirmButton } from '../../components'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || SOCKET_URL

const PORT_OPTIONS = [
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
    'COM6', 'COM7', 'COM8', 'COM9', 'COM10',
];

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
    const [port, setPort] = useState('COM4');
	const [ID, setID] = useState('');
    const [error, setError] = useState('')
    const [authError, setAuthError] = useState('')
    const [authStatus, setAuthStatus] = useState('') // CONTRIBUTOR, CONTENT_MANAGER, or '' if not authenticated
    const [authenticating, setAuthenticating] = useState(false)
    const authAbortRef = useRef(null)
    const authCancelledRef = useRef(false)

    const navigate = useNavigate();

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
        if (!ID) {
            setError("Missing the ID name")
            return
        }
        const label = EXPERIMENT_OPTIONS.find((option) => option.value === name)?.label || name
        navigate('/graphs', { state: { name, label, port, ID } })
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
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                signal: controller.signal,
            })
            const result = await response.json()
            if (!response.ok || !result.authenticated) {
                setAuthStatus('')
                setError(result.error || 'Authentication failed')
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
                        <HomeButton label='Start' onClick={handleStart} disabled={authStatus !== 'CONTENT_MANAGER'}/>
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
                                onChange={(e) => setName(e.target.value)}
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
                                label='Port'
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                                options={PORT_OPTIONS}
                            />
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