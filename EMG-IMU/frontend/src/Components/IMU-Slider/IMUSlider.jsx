import React from 'react';

import './IMUSlider.css'

const IMUSlider = ({ display }) => {

	function handleThigh() {
		display(0)
	}

	function handleShank() {
		display(1)
	}
  
  return (
        <div className="cir-tabs" role="tablist" aria-label="Range">
            <input className="cir-tabs__r" type="radio" name="cir-range" id="cir-r-day" defaultChecked onClick={handleThigh}/>
            <label className="cir-tabs__t" htmlFor="cir-r-day" role="tab">Thigh</label>
            <input className="cir-tabs__r" type="radio" name="cir-range" id="cir-r-week" onClick={handleShank} />
            <label className="cir-tabs__t" htmlFor="cir-r-week" role="tab">Shank</label>
        </div>
  );
}

export default IMUSlider;