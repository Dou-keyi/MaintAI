/* FactoryGuard AI — Predict page JS */

let selectedFile = null;
let gaugeChartRef = null;

// ── Drop zone ─────────────────────────────────────────────────────────────────
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) setFile(f);
});
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(f) {
  if (!f.name.endsWith('.csv')) { alert('Please upload a .csv file'); return; }
  selectedFile = f;
  document.getElementById('fileName').textContent = f.name;
  document.getElementById('fileMeta').textContent = `${(f.size / 1024).toFixed(1)} KB`;
  document.getElementById('fileInfo').classList.remove('hidden');
  document.getElementById('predictBtn').disabled = false;
  // Reset results
  showResultsEmpty();
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  document.getElementById('fileInfo').classList.add('hidden');
  document.getElementById('predictBtn').disabled = true;
  showResultsEmpty();
}

// ── Prediction ────────────────────────────────────────────────────────────────
async function runPrediction() {
  if (!selectedFile) return;

  showResultsLoading();

  const form = new FormData();
  form.append('file', selectedFile);

  try {
    const result = await apiFetch('/api/predict', { method: 'POST', body: form });
    showResults(result);
  } catch (e) {
    showResultsEmpty();
    alert('Prediction failed: ' + e.message);
  }
}

// ── Render results ────────────────────────────────────────────────────────────
function showResults(r) {
  document.getElementById('resultsLoading').classList.add('hidden');
  document.getElementById('resultsEmpty').classList.add('hidden');
  document.getElementById('resultsContent').classList.remove('hidden');

  // Gauge
  const color = statusColor(r.status);
  const pct   = r.health_pct;
  buildGauge('gaugeChart', pct, color);
  document.getElementById('gaugePct').textContent = pct + '%';
  document.getElementById('gaugePct').style.color = color;

  // Stats
  document.getElementById('statCycles').textContent = Math.round(r.rul_cycles);
  document.getElementById('statCycles').style.color  = color;
  const rulHours = Math.max(0, Math.round((r.rul_days || 0) * 24));
  document.getElementById('statDays').textContent   = rulHours;
  document.getElementById('statDays').style.color    = color;
  document.getElementById('statStatus').innerHTML    = `<span class="status-pill ${r.status}">${r.status}</span>`;

  // Anomaly
  const banner = document.getElementById('anomalyBanner');
  r.anomaly ? banner.classList.remove('hidden') : banner.classList.add('hidden');

  // SHAP drivers
  const maxImpact = Math.max(...r.top_factors.map(f => Math.abs(f.impact)));
  document.getElementById('driversList').innerHTML = r.top_factors.map(f => {
    const pct = (Math.abs(f.impact) / maxImpact * 100).toFixed(1);
    const dir = f.direction;
    return `
      <div class="driver-row">
        <div class="driver-name">${f.feature}</div>
        <div class="driver-bar-bg">
          <div class="driver-bar-fill ${dir}" style="width:${pct}%"></div>
        </div>
        <div class="driver-dir ${dir}">${dir === 'negative' ? '▼ Reduces' : '▲ Extends'}</div>
      </div>`;
  }).join('');

  // Recommendation box
  const recs = {
    Healthy:  { cls: 'rec-healthy',  msg: '✓  Machine is operating normally. Schedule next inspection per standard preventive maintenance calendar.' },
    Warning:  { cls: 'rec-warning',  msg: '⚠  Plan maintenance within the next 2 weeks. Order replacement parts now to avoid lead-time delays.' },
    Critical: { cls: 'rec-critical', msg: '✕  Immediate maintenance required. Stop non-critical operations on this machine and schedule urgent servicing.' },
  };
  const rec = recs[r.status] || recs.Healthy;
  const recEl = document.getElementById('recommendation');
  recEl.className = `recommendation ${rec.cls}`;
  recEl.textContent = rec.msg;

  // Meta
  document.getElementById('metaRows').textContent  = `${r.rows_analysed} rows analysed`;
  document.getElementById('metaMode').textContent   = r.model_mode === 'trained' ? 'Model: trained on CMAPSS' : 'Mode: demo prediction';
  document.getElementById('metaTime').textContent   = 'At ' + fmtTime(r.predicted_at);
}

function showResultsEmpty() {
  document.getElementById('resultsLoading').classList.add('hidden');
  document.getElementById('resultsContent').classList.add('hidden');
  document.getElementById('resultsEmpty').classList.remove('hidden');
}
function showResultsLoading() {
  document.getElementById('resultsEmpty').classList.add('hidden');
  document.getElementById('resultsContent').classList.add('hidden');
  document.getElementById('resultsLoading').classList.remove('hidden');
}

// ── Model metrics ─────────────────────────────────────────────────────────────
async function loadMetrics() {
  try {
    const m = await apiFetch('/api/metrics');
    document.getElementById('metricsRow').innerHTML = `
      <div class="metric-tile">
        <div class="metric-tile-val">${m.RMSE}</div>
        <div class="metric-tile-key">RMSE</div>
        <div class="metric-tile-note">Lower is better · ±${m.RMSE} cycle error</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile-val">${m.MAE}</div>
        <div class="metric-tile-key">MAE</div>
        <div class="metric-tile-note">Median error &lt; 1 working day</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile-val">${m.R2}</div>
        <div class="metric-tile-key">R²</div>
        <div class="metric-tile-note">1.0 = perfect · explains variance</div>
      </div>
    `;
  } catch (e) {
    console.warn('Metrics load failed:', e);
  }
}

// ── Sample CSV download ───────────────────────────────────────────────────────
function downloadSample(e) {
  e.preventDefault();
  const header = 'cycle,op1,op2,op3,s2,s3,s4,s7,s8,s9,s11,s12,s13,s14,s15,s17,s20,s21\n';
  const rows = Array.from({ length: 30 }, (_, i) => {
    const c = i + 1;
    const deg = c / 30;
    return [
      c,
      (Math.random() * 0.5).toFixed(4),
      (Math.random() * 0.003).toFixed(5),
      (Math.random() * 100).toFixed(2),
      (642 + deg * 10 + Math.random() * 2).toFixed(2),
      (1589 + deg * 8 + Math.random() * 5).toFixed(2),
      (1400 + deg * 20 + Math.random() * 10).toFixed(2),
      (554 + deg * 5 + Math.random() * 3).toFixed(2),
      (2388 + deg * 15 + Math.random() * 8).toFixed(2),
      (9062 + deg * 30 + Math.random() * 20).toFixed(2),
      (47.5 + deg * 0.5 + Math.random() * 0.3).toFixed(2),
      (522 + deg * 5 + Math.random() * 3).toFixed(2),
      (2388 + deg * 12 + Math.random() * 8).toFixed(2),
      (8138 + deg * 40 + Math.random() * 20).toFixed(2),
      (8.4 + deg * 0.2 + Math.random() * 0.1).toFixed(4),
      (0.03 - deg * 0.005 + Math.random() * 0.002).toFixed(4),
      (39 - deg * 2 + Math.random()).toFixed(2),
      (23 + deg + Math.random() * 0.5).toFixed(2),
    ].join(',');
  });

  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'sample_sensors.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
loadMetrics();
