import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import Home from './Pages/Home.jsx'
import Graphs from './Pages/Graphs.jsx'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import logo from "./assets/bionix_logo.png"

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
