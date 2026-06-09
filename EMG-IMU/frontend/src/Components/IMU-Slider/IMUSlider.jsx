import React from 'react';

import './IMUSlider.css'

const IMUSlider = () => {
  return (
        <div className="cir-tabs" role="tablist" aria-label="Range">
            <input className="cir-tabs__r" type="radio" name="cir-range" id="cir-r-day" />
            <label className="cir-tabs__t" htmlFor="cir-r-day" role="tab">Front</label>
            <input className="cir-tabs__r" type="radio" name="cir-range" id="cir-r-week" defaultChecked />
            <label className="cir-tabs__t" htmlFor="cir-r-week" role="tab">Back</label>
            <input className="cir-tabs__r" type="radio" name="cir-range" id="cir-r-month" />
            <label className="cir-tabs__t" htmlFor="cir-r-month" role="tab">Iso</label>
        </div>
  );
}

export default IMUSlider;
