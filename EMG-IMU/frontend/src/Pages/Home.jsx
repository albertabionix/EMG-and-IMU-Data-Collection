import { Link } from 'react-router-dom'
import '../CSS/home.css'

function Home() {
return (
	<>
		<section className="main">
			<section className="title-block"> 
				<h1 className="title">EMG and IMU Data Collector</h1>
				<h2 className="subtitle">Alberta Bionix</h2>
			</section>
			<section className="work-block">
				<Link className="button" to="/graphs">Start</Link>
				<Link className="button" to="/">Help</Link>
				<a className="button" href="https://drive.google.com" target="_blank" rel="noreferrer">Google Drive</a>
			</section>
		</section>
	</>

)
}

export default Home
