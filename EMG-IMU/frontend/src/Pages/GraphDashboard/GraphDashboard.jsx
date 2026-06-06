/*
GraphDashboard.jsx

*/
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'

import './GraphDashboard.css'

import { EMGGraph, GraphButton, IMUGraph, Timer } from '../../components'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:5000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || SOCKET_URL;

async function changePort(portName) {
    const newPort = portName || prompt("Enter your port name");
    if (!newPort) return;

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

function GraphDashboard() {
    const [cameraImage, setCameraImage] = useState(null);
    const { state } = useLocation();
    const timerFunctions = useRef(null);

    const navigate = useNavigate();

    function handleRecord() {
        timerFunctions.current.start()
    }

    function handleStop() {
        timerFunctions.current.stop()
    }

    function handleHome() {
        navigate('/')
    }

    return (
        <>
            <section className='main-section'>
                <Timer ref={timerFunctions}/>
                <section className="graphs">
                    <section className="IMUs">
                        <IMUGraph />
                        <IMUGraph />
                    </section>
                    <EMGGraph />
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
                        <GraphButton label='Record' name='record' onClick={handleRecord} />
                        <GraphButton label='Stop' name='stop' onClick={handleStop} />
                        <GraphButton label='Import' name='import' />
                        <GraphButton label='Port' name='port' onClick={changePort} />
                        <GraphButton label='Back' name='back' onClick={handleHome} />
                    </section>
                </section>
            </section>
        </>
    )
}

export default GraphDashboard
