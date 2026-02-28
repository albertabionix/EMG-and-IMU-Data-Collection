import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
const [count, setCount] = useState(0)

return (
	<>
		<section className="main">
			<section className="title-block"> 
				<h1 className="title">EMG and IMU Data Collector</h1>
				<h2 className="subtitle">Alberta Bionix</h2>
			</section>
			<section className="work-block">
				<button className="button">Start</button>
				<button className="button">Help</button>
			</section>
		</section>
	</>

)
}

export default App
