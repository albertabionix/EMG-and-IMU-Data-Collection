import React from 'react';
import { useState, useRef, useImperativeHandle, forwardRef } from 'react'

import './Camera.css'

const Camera = () => {
    const [cameraImage, setCameraImage] = useState(null);


    async function openCamera() {
        await fetch('http://localhost:5000/api/camera/start', { method: 'POST' });
    }

    useImperativeHandle(ReferenceError, () => ({
        start() {
            if (running.current) return;
            running.current = true;
            startTime.current = Date.now() - elapsed.current;
            intervalId.current = setInterval(() => {
                elapsed.current = Date.now() - startTime.current;
                setTimerDisplay(formatTime(elapsed.current));
            }, 10);
        },

        stop() {
            running.current = false;
            clearInterval(intervalId.current);
            elapsed.current = 0;
            setTimerDisplay('0:00.00');
        }
    }))
    

    return (
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
    )
}

export default Camera