import { Link } from 'react-router-dom'
import '../CSS/help.css'

function Help() {
return (
	<>
		<section className="help-section">
			<section className='help-flex'>
				<h1>Extra Help</h1>
				<h2>Hardware needed</h2>
				<ul>
					<li>3 IMUs</li>
					<li>2 EMGs</li>
					<li>Camera</li>
					<li>...</li>
				</ul>
				<h2>What should be open</h2>
				<ul>
					<li>You should have two terminals open, one for frontend and one for backend.</li>
					<li>Check which com ports are being used.</li>
					<li>...</li>
				</ul>
				<section className='button-flex'>
					<a href=""></a>
				</section>
			</section>
		</section>
	</>

)
}

export default Help
