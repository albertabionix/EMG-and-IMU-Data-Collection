/*
	Help.jsx
	This is the extra help page so researchers can get extra help when needed when things are not working.
*/

import { Link, useNavigate } from 'react-router-dom'
import './Help.css'
import BackButton from '../../Components/BackButton/BackButton'

function Help() {

return (
	<>
		<section className="help-section">
			<BackButton to='/'/>
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
