/*
	main.jsx
	This is the start of the program where the header and footer is found. 
	The content is in the middle where there are multiple routes connecting to all the pages. 
	The index.html opens this file. <StrictMode> is a tool that intentionally runs certain things twice to help catch bugs.
	<HashRouter> enables client side routing so it lets the browser handle navigation.
*/

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import Home from './Pages/Home/Home.jsx'
import Graphs from './Pages/GraphDashboard/GraphDashboard.jsx'
import Help from './Pages/Help/Help.jsx'
import logo from "./assets/bionix_logo.png"
import './main.css'

function AppLayout() {
	return (
		<div className="app-shell">
			<header className="app-header">
				<img className="logo" src={logo}></img>
				<nav className="header-nav" aria-label="Main navigation">
					<Link to="/">Home</Link>
				</nav>
			</header>

			<main className="app-content">
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/graphs" element={<Graphs />} />
					<Route path="/help" element={<Help />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</main>

			<footer className="app-footer">
				<span>Alberta Bionix</span>
				<span>EMG and IMU Data Collector</span>
			</footer>
		</div>
	)
}

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<HashRouter>
			<AppLayout />
		</HashRouter>
	</StrictMode>,
)
