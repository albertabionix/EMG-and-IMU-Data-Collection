/*
    Home.jsx
    This is the beginning of the program with the pages:
        Graphs
        Help
        Authenticate
    Sends the name, ID, and port to the graphs page.
*/

import { Link, useNavigate } from 'react-router-dom'
import { useState } from "react";

import './Home.css'

import { HomeInput, HomeButton, Dropdown, ConfirmButton } from '../../components'

const PORT_OPTIONS = [
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
    'COM6', 'COM7', 'COM8', 'COM9', 'COM10',
];

const EXPERIMENT_OPTIONS = [
    'Extend & Contract', 'Gait Cycle', 'Staircase',
]

function Home() {
    // States
    const [showInputs, setShowInputs] = useState(false);
    const [name, setName] = useState("Extend & Contract");
    const [port, setPort] = useState('COM4');
	const [ID, setID] = useState('');
    const [error, setError] = useState('')

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
        navigate('/graphs', { state: { name, port, ID } })
    }
    
    function authenticate() {
        
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
                        <HomeButton label='Start' onClick={handleStart}/>
                        <HomeButton label='Help' onClick={handleHelp}/>
                        <HomeButton label='Authenticate' onClick={authenticate}/>
                    </section>
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