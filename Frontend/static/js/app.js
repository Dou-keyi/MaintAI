/* FactoryGuard shared client utilities */

const apiDot    = document.getElementById('apiDot');
const apiStatus = document.getElementById('apiStatus');

function setApiStatus(ok) {
  if (!apiDot || !apiStatus) return;
  apiDot.classList.remove('online', 'offline');
  apiDot.classList.add(ok ? 'online' : 'offline');
  apiStatus.textContent = ok ? 'Live' : 'Offline';
}

const API_BASE = window.API_BASE || (window.location.port === '8000' ? '' : 'http://localhost:8000');

async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok || !contentType.includes('application/json')) {
      setApiStatus(false);
      let msg = `HTTP ${res.status}`;
      const text = await res.text();
      if (text) msg = text.slice(0, 200);
      if (!contentType.includes('application/json')) {
        msg = `Unexpected response (expected JSON). Is the backend running? Body: ${msg}`;
      }
      throw new Error(msg);
    }

    setApiStatus(true);
    return await res.json();
  } catch (err) {
    setApiStatus(false);
    throw err;
  }
}

function statusColor(status) {
  const map = {
    Healthy: '#16a34a',
    Warning: '#f59e0b',
    Critical: '#ef4444',
  };
  return map[status] || '#6b7280';
}

function fmtNow() {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtTime(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function buildGauge(canvasId, value, color) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (el._gauge) el._gauge.destroy();

  const chart = new Chart(el, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [Math.max(0, Math.min(100, value)), 100 - Math.max(0, Math.min(100, value))],
        backgroundColor: [color, '#e5e7eb'],
        borderWidth: 0,
        cutout: '75%',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      rotation: -90,
      circumference: 180,
    },
  });
  el._gauge = chart;
}

function healthFillColor(health) {
  if (health > 60) return '#16a34a';
  if (health > 25) return '#f59e0b';
  return '#ef4444';
}

function buildDonut(canvasId, healthy, warning, critical) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (el._donut) el._donut.destroy();
  el._donut = new Chart(el, {
    type: 'doughnut',
    data: {
      labels: ['Healthy', 'Warning', 'Critical'],
      datasets: [{
        data: [healthy, warning, critical],
        backgroundColor: ['#079455', '#DC6803', '#D92D20'],
        borderWidth: 0,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      cutout: '70%',
      responsive: true,
    },
  });
}

function buildSensorChart(canvasId, labels, data, color) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (el._chart) { try { el._chart.destroy(); } catch (_) {} }
  el._chart = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color || '#1570EF',
        tension: 0.32,
        fill: false,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          display: true,
          title: { display: true, text: 'Cycle' },
          ticks: { color: '#6b7280', maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
          grid: { display: false },
        },
        y: {
          display: true,
          title: { display: true, text: 'Value' },
          ticks: { color: '#6b7280' },
          grid: { color: '#eef1f6' },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function buildMultiLineChart(canvasId, labels, series) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (el._chart) { try { el._chart.destroy(); } catch (_) {} }
  el._chart = new Chart(el.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: series.map(s => ({
        label: s.label,
        data: s.data,
        borderColor: s.color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
      })),
    },
    options: {
      plugins: { legend: { display: true, labels: { boxWidth: 10 } }, tooltip: { enabled: true } },
      scales: {
        x: {
          display: true,
          title: { display: true, text: 'Cycle' },
          ticks: { color: '#6b7280', maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
          grid: { display: false },
        },
        y: {
          display: true,
          title: { display: true, text: 'Value' },
          ticks: { color: '#6b7280' },
          grid: { color: '#eef1f6' },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Light-touch health check on load; individual pages will call apiFetch afterward
apiFetch('/api/metrics').catch(() => {});
