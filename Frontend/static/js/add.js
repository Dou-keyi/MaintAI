/* Add Equipment page */

const catalog = [
  {
    name: "Siemens S7 Conveyor",
    type: "Conveyor",
    brand: "Siemens",
    location: "Line 1",
    health: 82,
    rul_hours: 320,
    rul_cycles: 240,
    img: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=640&q=60"
  },
  {
    name: "ABB Servo Motor X",
    type: "Motor",
    brand: "ABB",
    location: "Floor 2",
    health: 74,
    rul_hours: 260,
    rul_cycles: 180,
    img: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=640&q=60"
  },
  {
    name: "GE Compressor Pro",
    type: "Compressor",
    brand: "GE",
    location: "Floor 1",
    health: 68,
    rul_hours: 210,
    rul_cycles: 150,
    img: "https://images.unsplash.com/photo-1503389152951-9f343605f61e?auto=format&fit=crop&w=640&q=60"
  },
  {
    name: "Schneider Cooling Unit",
    type: "Cooling",
    brand: "Schneider",
    location: "Storage",
    health: 79,
    rul_hours: 280,
    rul_cycles: 200,
    img: "https://images.unsplash.com/photo-1503389152951-9f343605f61e?auto=format&fit=crop&w=640&q=60"
  }
];

const catalogGrid = document.getElementById('catalogGrid');
const catalogPanel = document.getElementById('catalogPanel');
const customPanel  = document.getElementById('customPanel');

function showCatalog() {
  catalogPanel.style.display = 'block';
  customPanel.style.display  = 'none';
}

function showCustom() {
  catalogPanel.style.display = 'none';
  customPanel.style.display  = 'block';
}

function renderCatalog() {
  catalogGrid.innerHTML = catalog.map(item => `
    <div class="catalog-card">
      <div class="catalog-img" style="background-image:url('${item.img}')"></div>
      <div class="catalog-meta">
        <div class="catalog-name">${item.name}</div>
        <div class="catalog-sub">${item.brand} · ${item.type} · ${item.location}</div>
        <div class="catalog-health">Health ${item.health}% · ~${item.rul_hours}h RUL</div>
        <button class="btn-refresh" style="margin-top:8px;justify-content:center" onclick="addFromCatalog('${item.name}')">Add this</button>
      </div>
    </div>
  `).join('');
}

async function addFromCatalog(name) {
  const item = catalog.find(c => c.name === name);
  if (!item) return;
  const payload = {
    name: item.name,
    type: item.type,
    brand: item.brand,
    location: item.location,
    health: item.health,
    rul_days: Math.round(item.rul_hours / 24),
    rul_cycles: Math.round(item.rul_cycles),
    anomaly: false,
  };
  try {
    await apiFetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    alert('Equipment added from catalog.');
  } catch (e) {
    alert('Could not add equipment: ' + e.message);
  }
}

async function submitCustom(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cName').value.trim(),
    type: document.getElementById('cType').value,
    brand: document.getElementById('cBrand').value,
    location: document.getElementById('cLocation').value,
    health: parseInt(document.getElementById('cHealth').value || '70', 10),
    rul_days: Math.round(Number(document.getElementById('cHours').value || 48) / 24),
    rul_cycles: parseInt(document.getElementById('cCycles').value || '90', 10),
    anomaly: document.getElementById('cAnomaly').checked,
  };
  if (!payload.name || !payload.type || !payload.brand || !payload.location) {
    alert('Please fill all required fields.');
    return;
  }
  try {
    await apiFetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    alert('Equipment added.');
    e.target.reset();
  } catch (e) {
    alert('Could not add equipment: ' + e.message);
  }
}

renderCatalog();
showCatalog();
