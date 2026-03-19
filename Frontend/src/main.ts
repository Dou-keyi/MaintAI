import './style.css'
const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Root element #app missing')

app.innerHTML = `
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="logo">M</div>
        <div class="title">
          <span class="name">MaintAI</span>
          <span class="tag">Predictive Maintenance</span>
        </div>
      </div>
      <nav class="nav">
        <a class="active">Dashboard</a>
        <a>Equipment</a>
        <a>Alerts</a>
        <a>Maintenance Logs</a>
        <a>Settings</a>
      </nav>
      <div class="actions">
        <button class="icon-btn" aria-label="notifications">??</button>
        <div class="avatar">JS</div>
      </div>
    </header>

    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Machines</div>
        <div class="stat-value">24</div>
      </div>
      <div class="stat-card healthy">
        <div class="dot"></div>
        <div>
          <div class="stat-label">Healthy Machines</div>
          <div class="stat-value">18</div>
        </div>
      </div>
      <div class="stat-card warning">
        <div class="dot"></div>
        <div>
          <div class="stat-label">Warning Machines</div>
          <div class="stat-value">4</div>
        </div>
      </div>
      <div class="stat-card critical">
        <div class="dot"></div>
        <div>
          <div class="stat-label">Critical Machines</div>
          <div class="stat-value">2</div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Equipment Health</h3>
        <span class="pill">Live</span>
      </div>
      <div class="table">
        <div class="table-head">
          <span>Machine Name</span><span>Equipment Type</span><span>Health Score</span><span>Remaining Useful Life</span><span>Status</span><span>Last Maintenance</span><span>Action</span>
        </div>
        <div class="table-row">
          <span>Air Conditioner A</span><span>Cooling System</span><span>82%</span><span>72 Days</span><span><span class="status healthy">Healthy</span></span><span>3 Months Ago</span><button class="link-btn">View</button>
        </div>
        <div class="table-row">
          <span>Motor Pump 2</span><span>Industrial Pump</span><span>45%</span><span>14 Days</span><span><span class="status warning">Warning</span></span><span>5 Months Ago</span><button class="link-btn">Schedule</button>
        </div>
        <div class="table-row">
          <span>Conveyor Belt 1</span><span>Transport System</span><span>30%</span><span>7 Days</span><span><span class="status critical">Critical</span></span><span>6 Months Ago</span><button class="link-btn">Repair</button>
        </div>
      </div>
    </section>

    <section class="layout-two">
      <div class="panel">
        <div class="panel-head">
          <h3>Sensor Trends</h3>
          <div class="legend">
            <span class="legend-item temp">Temperature</span>
            <span class="legend-item vib">Vibration</span>
            <span class="legend-item load">Load</span>
          </div>
        </div>
        <div class="chart-spark">
          <svg viewBox="0 0 300 120" preserveAspectRatio="none">
            <polyline class="line temp" points="0,80 40,70 80,60 120,65 160,55 200,60 240,50 300,45" />
            <polyline class="line vib" points="0,90 40,85 80,75 120,78 160,68 200,72 240,64 300,60" />
            <polyline class="line load" points="0,70 40,72 80,68 120,62 160,65 200,60 240,58 300,55" />
          </svg>
        </div>
      </div>

      <div class="panel gauge">
        <div class="panel-head"><h3>Machine Health Score</h3></div>
        <div class="gauge-wrap">
          <div class="gauge-ring" style="--percent:76"></div>
          <div class="gauge-center">
            <div class="gauge-value">76%</div>
            <div class="muted">AC Compressor</div>
          </div>
        </div>
      </div>
    </section>

    <section class="layout-two">
      <div class="panel">
        <div class="panel-head"><h3>AI Prediction</h3></div>
        <div class="prediction">
          <div>
            <p class="muted">Machine Name</p>
            <h4>AC Compressor</h4>
          </div>
          <div class="prediction-grid">
            <div><span class="muted">Health Score</span><strong>76%</strong></div>
            <div><span class="muted">Predicted Failure</span><strong>18 days</strong></div>
            <div><span class="muted">Confidence</span><strong>91%</strong></div>
          </div>
          <div class="alert-card">Maintenance recommended within 10 days to avoid compressor failure.</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Maintenance Cost Tracker</h3></div>
        <form class="form-grid">
          <label><span>Machine Name</span><input type="text" placeholder="Motor Pump 2" value="Motor Pump 2" /></label>
          <label><span>Maintenance Type</span><input type="text" placeholder="Bearing Replacement" value="Bearing Replacement" /></label>
          <label><span>Parts Replaced</span><input type="text" placeholder="Bearings" /></label>
          <label><span>Cost (RM)</span><input type="number" placeholder="350" value="350" /></label>
          <label><span>Technician</span><input type="text" placeholder="Ahmad" value="Ahmad" /></label>
          <label class="full"><span>Notes</span><textarea rows="2" placeholder="Notes..."></textarea></label>
          <div class="full">
            <button type="button" class="primary full">Log Maintenance</button>
          </div>
        </form>
      </div>
    </section>

    <section class="layout-two">
      <div class="panel">
        <div class="panel-head"><h3>Real-Time Alerts</h3></div>
        <ul class="alerts">
          <li class="warn">? Temperature spike detected in Motor Pump 2</li>
          <li class="warn">? Vibration anomaly in Conveyor Belt 1</li>
          <li class="ok">? Air Conditioner A operating normally</li>
        </ul>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Recent Maintenance Logs</h3></div>
        <ul class="logs">
          <li>
            <div class="log-title">Motor Pump 2</div>
            <div class="muted">Bearing Replacement ? RM 350 ? Technician: Ahmad</div>
          </li>
          <li>
            <div class="log-title">Conveyor Belt 1</div>
            <div class="muted">Belt tension adjustment ? RM 180 ? Technician: Lee</div>
          </li>
        </ul>
      </div>
    </section>

    <button class="fab" id="fab">+ Add Equipment</button>

    <div class="drawer" id="drawer">
      <div class="drawer-content">
        <div class="drawer-head">
          <h3>Add Equipment</h3>
          <button class="icon-btn" id="close">?</button>
        </div>
        <form class="form-grid">
          <label><span>Machine Name</span><input type="text" placeholder="New Machine" /></label>
          <label><span>Equipment Type</span><input type="text" placeholder="Chiller" /></label>
          <label><span>Operating Hours</span><input type="number" placeholder="3200" /></label>
          <label><span>Load %</span><input type="number" placeholder="75" /></label>
          <label><span>Temperature</span><input type="number" placeholder="68" /></label>
          <label><span>Last Maintenance Date</span><input type="date" /></label>
          <div class="full"><button type="button" class="primary full">Submit & Predict</button></div>
        </form>
      </div>
    </div>
  </div>
`

const drawer = document.querySelector<HTMLElement>('#drawer')!
const fab = document.querySelector<HTMLButtonElement>('#fab')!
const closeBtn = document.querySelector<HTMLButtonElement>('#close')!

fab.addEventListener('click', () => drawer.classList.add('open'))
closeBtn.addEventListener('click', () => drawer.classList.remove('open'))
drawer.addEventListener('click', (e) => {
  if (e.target === drawer) drawer.classList.remove('open')
})


