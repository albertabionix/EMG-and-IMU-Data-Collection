import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import Home from './Pages/home.jsx'
import Graphs from './Pages/graphs.jsx'
import Help from './Pages/help.jsx'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import logo from "./assets/bionix_logo.png"

function AppLayout() {
	return (
		<div className="app-shell">
			{/*The header of the site*/}
			<header className="app-header">
				<img className="logo" src={logo}></img>
				<nav className="header-nav" aria-label="Main navigation">
					<Link to="/">Home</Link>
				</nav>
			</header>

			<main className="app-content">
				{/*The main content of the site with all the different pages*/}
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/graphs" element={<Graphs />} />
					<Route path="/help" element={<Help />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</main>

			<footer className="app-footer">
				{/*Footer of the website*/}
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
