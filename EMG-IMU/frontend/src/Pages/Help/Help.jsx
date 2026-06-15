/*
	Help.jsx
	This is the extra help page so researchers can get extra help when needed when things are not working.
*/

import { Link, useNavigate } from 'react-router-dom'
import './Help.css'
import BackButton from '../../Components/BackButton/BackButton'
import { CardImage } from '../../components'

function Help() {

	

return (
	<>
		<section className="help-section">
			<BackButton to='/'/>
			<h1 className='title-card'>Extra Help</h1>
			<section className='three-flex'>
				<CardImage />
			</section>
		</section>
	</>

)
}

export default Help
