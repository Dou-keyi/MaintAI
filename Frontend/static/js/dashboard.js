/* FactoryGuard AI — Dashboard JS */

let allMachines = [];
let activeFilter = 'all';
let selectedMachineId = null;
let modalSensorData = null;
let activeModalTab = 'temperature';

// ── Load everything ─────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/machines');
    allMachines = data.machines;
    renderKPIs(data);
    renderMachineList(allMachines);
    renderDonut(data);
    document.getElementById('lastUpdated').textContent = 'Updated ' + fmtNow();
  } catch (e) {
    console.error('Dashboard load failed:', e);
  }
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
function renderKPIs(data) {
  const avg = Math.round(data.machines.reduce((s, m) => s + m.health, 0) / data.machines.length);
  const strip = document.getElementById('kpiStrip');
  strip.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total machines</div>
      <div class="kpi-val">${data.total}</div>
      <div class="kpi-sub">Monitored units</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg health score</div>
      <div class="kpi-val ${avg > 60 ? 'green' : avg > 25 ? 'amber' : 'red'}">${avg}%</div>
      <div class="kpi-sub">Across fleet</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Warnings</div>
      <div class="kpi-val amber">${data.warning}</div>
      <div class="kpi-sub">Need attention soon</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Critical</div>
      <div class="kpi-val red">${data.critical}</div>
      <div class="kpi-sub">Schedule immediately</div>
    </div>
  `;
}

// ── Machine list ─────────────────────────────────────────────────────────────
function renderMachineList(machines) {
  const filtered = activeFilter === 'all'
    ? machines
    : machines.filter(m => m.status === activeFilter);

  const list = document.getElementById('machineList');
  if (!filtered.length) {
    list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-3);font-size:13px">No machines in this category</div>`;
    return;
  }

  list.innerHTML = filtered.map(m => {
    const fillColor = healthFillColor(m.health);
    const anomalyDot = m.anomaly ? `<span style="width:7px;height:7px;border-radius:50%;background:var(--critical);display:inline-block;margin-left:6px;"></span>` : '';
    const rulHours = Math.max(0, Math.round((m.rul_days || 0) * 24));
    return `
      <div class="machine-row" onclick="selectMachine('${m.id}', true)">
        <div class="machine-info">
          <div class="machine-name">${m.name}${anomalyDot}</div>
          <div class="machine-meta">${m.type} · ${m.brand || 'Brand?'} · ${m.location}</div>
        </div>
        <div class="health-bar-wrap">
          <div class="health-label">${m.health}%</div>
          <div class="health-bar">
            <div class="health-fill" style="width:${m.health}%;background:${fillColor}"></div>
          </div>
        </div>
        <div class="rul-chip">${rulHours} Hours left</div>
        <div class="status-pill ${m.status}">${m.status}</div>
      </div>`;
  }).join('');
}

// ── Select machine → side detail ─────────────────────────────────────────────
async function selectMachine(id, openModal = false) {
  selectedMachineId = id;
  try {
    const m = await apiFetch(`/api/machines/${id}`);
    if (openModal) {
      showModal(m);
    } else {
      renderDetailPanel(m);
    }
  } catch (e) {
    console.error('Machine detail failed:', e);
  }
}

// ── Detail panel (sidebar) ────────────────────────────────────────────────────
function renderDetailPanel(m) {
  const panel = document.getElementById('detailPanel');
  const color = statusColor(m.status);
  const rulHours = Math.max(0, Math.round((m.rul_days || 0) * 24));
  panel.innerHTML = `
    <div class="detail-head">
      <div class="detail-machine-name">${m.name}</div>
      <div class="detail-machine-meta">${m.type} · ${m.brand || 'Brand?'} · ${m.location} · Last maint. ${m.last_maint}</div>
    </div>
    <div class="detail-kpis">
      <div class="detail-kpi">
        <div class="detail-kpi-val" style="color:${color}">${m.health}%</div>
        <div class="detail-kpi-key">Health</div>
      </div>
      <div class="detail-kpi">
        <div class="detail-kpi-val">${rulHours}h</div>
        <div class="detail-kpi-key">RUL (hours)</div>
      </div>
      <div class="detail-kpi">
        <span class="status-pill ${m.status}">${m.status}</span>
        <div class="detail-kpi-key" style="margin-top:6px">Status</div>
      </div>
    </div>
    <div class="chart-tabs" id="detailTabs">
      ${['temperature','pressure','vibration','load'].map(s =>
        `<button class="chart-tab ${s==='temperature'?'active':''}" onclick="switchDetailTab('${m.id}','${s}',this)">${cap(s)}</button>`
      ).join('')}
    </div>
    <div class="detail-chart-wrap">
      <div style="height:130px;position:relative;">
        <canvas id="detailChart"></canvas>
      </div>
    </div>
  `;
  drawDetailChart(m, 'temperature');
}

function switchDetailTab(id, sensor, btn) {
  document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const m = allMachines.find(x => x.id === id);
  // For the detail panel, we need history — fetch it
  apiFetch(`/api/machines/${id}`).then(full => drawDetailChart(full, sensor));
}

function drawDetailChart(m, sensor) {
  const labels = m.history.map(h => h.cycle);
  const data   = m.history.map(h => h[sensor]);
  const colors = { temperature: '#1570EF', pressure: '#7B61FF', vibration: '#D92D20', load: '#DC6803' };
  buildSensorChart('detailChart', labels, data, colors[sensor] || '#1570EF');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function showModal(m) {
  modalSensorData = m.history;
  activeModalTab  = 'temperature';
  const color = statusColor(m.status);
  const latest = m.history[m.history.length - 1];
  const rulHours = Math.max(0, Math.round((m.rul_days || 0) * 24));

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-head">
      <div class="modal-machine-name">${m.name}</div>
      <div class="modal-machine-meta">${m.type} · ${m.brand || 'Brand?'} · ${m.location} · Installed ${m.install_date} · Last maintenance ${m.last_maint}</div>
    </div>
    <div class="modal-kpis">
      <div class="modal-kpi">
        <div class="modal-kpi-val" style="color:${color}">${m.health}%</div>
        <div class="modal-kpi-key">Health score</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-val">${rulHours} h</div>
        <div class="modal-kpi-key">Time to failure</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-val">${m.rul_cycles}</div>
        <div class="modal-kpi-key">Cycles remaining</div>
      </div>
      <div class="modal-kpi">
        <span class="status-pill ${m.status}">${m.status}${m.anomaly ? ' ⚠' : ''}</span>
        <div class="modal-kpi-key" style="margin-top:6px">Status</div>
      </div>
    </div>
    <div class="modal-chart-tabs">
      ${['temperature','pressure','vibration','load','all'].map(s =>
        `<button class="modal-chart-tab ${s==='temperature'?'active':''}" onclick="switchModalTab('${s}',this)">${s==='all'?'All sensors':cap(s)}</button>`
      ).join('')}
    </div>
    <div class="modal-chart-wrap">
      <div style="height:200px;position:relative;">
        <canvas id="modalChart"></canvas>
      </div>
      <div style="padding:6px 4px 0;font-size:12px;color:var(--text-3);">Sensor trend</div>
    </div>
    <div style="display:flex;gap:12px;margin:8px 20px 16px;flex-wrap:wrap;color:var(--text-2);font-size:13px;">
      <span>Temp: <strong style="color:var(--text-1)">${latest.temperature}°C</strong></span>
      <span>Pressure: <strong style="color:var(--text-1)">${latest.pressure}</strong></span>
      <span>Vibration: <strong style="color:var(--text-1)">${latest.vibration}</strong></span>
      <span>Load: <strong style="color:var(--text-1)">${latest.load}%</strong></span>
    </div>
    ${m.anomaly ? `<div class="anomaly-banner" style="margin:0 20px 16px">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Anomaly detected — machine has transitioned from Healthy to Impaired state
    </div>` : ''}
  `;

  drawModalChart('temperature');
  document.getElementById('modalBackdrop').classList.add('open');
  document.getElementById('machineModal').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.getElementById('machineModal').classList.remove('open');
}

function switchModalTab(sensor, btn) {
  document.querySelectorAll('.modal-chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeModalTab = sensor;
  drawModalChart(sensor);
}

function drawModalChart(sensor) {
  if (!modalSensorData) return;
  const labels = modalSensorData.map(h => h.cycle);
  const colors = { temperature: '#1570EF', pressure: '#7B61FF', vibration: '#D92D20', load: '#DC6803' };
  if (sensor === 'all') {
    buildMultiLineChart('modalChart', labels, [
      { label: 'Temp',      data: modalSensorData.map(h => h.temperature), color: colors.temperature },
      { label: 'Pressure',  data: modalSensorData.map(h => h.pressure),    color: colors.pressure },
      { label: 'Vibration', data: modalSensorData.map(h => h.vibration),   color: colors.vibration },
      { label: 'Load',      data: modalSensorData.map(h => h.load),        color: colors.load },
    ]);
  } else {
    const data = modalSensorData.map(h => h[sensor]);
    buildSensorChart('modalChart', labels, data, colors[sensor] || '#1570EF');
  }
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function renderDonut(data) {
  const h = data.machines.filter(m => m.status === 'Healthy').length;
  const w = data.machines.filter(m => m.status === 'Warning').length;
  const c = data.machines.filter(m => m.status === 'Critical').length;
  buildDonut('donutChart', h, w, c);

  document.getElementById('donutLegend').innerHTML = [
    { label: 'Healthy',  val: h, color: '#079455' },
    { label: 'Warning',  val: w, color: '#DC6803' },
    { label: 'Critical', val: c, color: '#D92D20' },
  ].map(item => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${item.color}"></div>
      <span style="color:var(--text-2)">${item.label}</span>
      <span style="margin-left:auto;font-weight:600;color:var(--text-1)">${item.val}</span>
    </div>
  `).join('');
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
document.getElementById('filterTabs').addEventListener('click', e => {
  const btn = e.target.closest('.filter-tab');
  if (!btn) return;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderMachineList(allMachines);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Boot ──────────────────────────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('addName').value = '';
  document.getElementById('addType').value = '';
  document.getElementById('addBrand').value = '';
  document.getElementById('addLocation').value = '';
  document.getElementById('addHealth').value = 70;
  document.getElementById('addHours').value = 48;
  document.getElementById('addCycles').value = 90;
  document.getElementById('addAnomaly').checked = false;
  document.getElementById('addBackdrop').classList.add('open');
  document.getElementById('addModal').classList.add('open');
}

function closeAddModal() {
  document.getElementById('addBackdrop').classList.remove('open');
  document.getElementById('addModal').classList.remove('open');
}

async function submitAddEquipment(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('addName').value.trim();
  const type = document.getElementById('addType').value;
  const brand = document.getElementById('addBrand').value;
  const location = document.getElementById('addLocation').value;
  const health = parseInt(document.getElementById('addHealth').value || '70', 10);
  const hours  = Number(document.getElementById('addHours').value || 48);
  const cycles = parseInt(document.getElementById('addCycles').value || '90', 10);
  const anomaly= document.getElementById('addAnomaly').checked;

  if (!name || !type || !brand || !location) {
    alert('Please fill name, type, brand, and location.');
    return;
  }

  const payload = {
    name,
    type,
    location,
    brand,
    health,
    rul_days: Math.round(hours / 24),
    rul_cycles: cycles,
    anomaly,
  };

  try {
    await apiFetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    closeAddModal();
    await loadDashboard();
  } catch (err) {
    alert('Could not add equipment: ' + err.message);
  }
}

loadDashboard();
