import { Link } from 'react-router-dom'
import '../CSS/graphs.css'

function Graphs() {
return (
    <>
        <section className="graphs">
            <section className="IMUs"> 
                <section className="IMU"> 
                    <div></div>
                </section>
                <section className="IMU"> 
                    <div></div>
                </section>
                <section className="IMU"> 
                    <div></div>
                </section>
            </section>
            <section className="EMGs">
                <section className="EMG1"> 
                    <div></div>
                </section>
                <section className="EMG2"> 
                    <div></div>
                </section>
            </section>
            <section className="buttons">
                <button>Record</button>
                <button>Stop</button>
                <button>Rename</button>
                <button>Change Port</button>
                <Link className="button" to="/">Back</Link>
            </section>
        </section>
    </>

)
}

export default Graphs
