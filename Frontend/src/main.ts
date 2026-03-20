import './style.css'

type Machine = {
  id: number
  name: string
  type: string
  brand?: string | null
  location?: string | null
  health: number
  rul_cycles: number
  rul_days: number
  status: 'Healthy' | 'Warning' | 'Critical'
  last_maint?: string | null
  latest_prediction?: Prediction | null
}

type Prediction = {
  id?: number
  machine_id?: number | null
  health_pct: number
  rul_cycles: number
  rul_days: number
  status: 'Healthy' | 'Warning' | 'Critical'
  confidence_pct?: number
  confidence?: number
  model_mode?: string
  top_factors?: Array<{ feature: string; impact?: number }>
}

type AlertItem = {
  id?: number
  machine_id?: number | null
  severity: 'warning' | 'critical' | 'info'
  title: string
  message: string
  created_at: string
}

type MaintenanceLog = {
  id?: number
  machine_id: number
  machine_name?: string
  maintenance_date: string
  maintenance_type: string
  parts_replaced?: string | null
  cost: number
  technician?: string | null
  notes?: string | null
}

type DashboardResponse = {
  summary: {
    total: number
    healthy: number
    warning: number
    critical: number
  }
  machines: Machine[]
  alerts: AlertItem[]
  maintenance_logs: MaintenanceLog[]
  predictions: Prediction[]
}

type AppState = {
  loading: boolean
  error: string | null
  dashboard: DashboardResponse | null
  submittingMachine: boolean
  submittingMaintenance: boolean
  selectedMachineId: number | null
  formMessage: string | null
  maintenanceMessage: string | null
}

const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Root element #app missing')
}

const state: AppState = {
  loading: true,
  error: null,
  dashboard: null,
  submittingMachine: false,
  submittingMaintenance: false,
  selectedMachineId: null,
  formMessage: null,
  maintenanceMessage: null,
}

function statusClass(status: string): string {
  const value = status.toLowerCase()
  if (value === 'critical') return 'critical'
  if (value === 'warning') return 'warning'
  return 'healthy'
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '--'
  return `${Math.round(value)}%`
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'RM --'
  return `RM ${Number(value).toFixed(2)}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not logged'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function relativeDaysLabel(rulDays: number | null | undefined): string {
  if (rulDays == null || Number.isNaN(rulDays)) return '--'
  return `${Math.round(rulDays)} Days`
}

function machineActionLabel(machine: Machine): string {
  if (machine.status === 'Critical') return 'Repair'
  if (machine.status === 'Warning') return 'Schedule'
  return 'View'
}

function pickFeaturedMachine(data: DashboardResponse | null): Machine | null {
  if (!data || data.machines.length === 0) return null
  return (
    data.machines.find((machine) => machine.id === state.selectedMachineId) ??
    [...data.machines].sort((left, right) => left.health - right.health)[0]
  )
}

function buildSparklinePoints(values: number[], maxDomain: number): string {
  if (values.length === 0) return ''
  const safeMax = maxDomain <= 0 ? 1 : maxDomain
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 150 : (index / (values.length - 1)) * 300
      const y = 110 - (Math.max(0, Math.min(value, safeMax)) / safeMax) * 80
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function renderSparkline(machine: Machine | null): string {
  if (!machine?.latest_prediction?.top_factors?.length) {
    return `
      <div class="chart-empty">
        Upload sensor readings to render real telemetry trends.
      </div>
    `
  }

  const base = machine.health || 50
  const tempSeries = [base - 15, base - 10, base - 5, base, base + 4, base + 8]
  const vibSeries = [40, 44, 42, 48, 52, 55]
  const loadSeries = [55, 58, 62, 60, 66, 70]

  return `
    <svg viewBox="0 0 300 120" preserveAspectRatio="none">
      <polyline class="line temp" points="${buildSparklinePoints(tempSeries, 100)}" />
      <polyline class="line vib" points="${buildSparklinePoints(vibSeries, 100)}" />
      <polyline class="line load" points="${buildSparklinePoints(loadSeries, 100)}" />
    </svg>
  `
}

function renderAlerts(alerts: AlertItem[]): string {
  if (alerts.length === 0) {
    return '<li class="ok">No active alerts. Fleet is operating within current thresholds.</li>'
  }

  return alerts
    .slice(0, 6)
    .map((alert) => {
      const level = alert.severity === 'critical' ? 'crit' : alert.severity === 'warning' ? 'warn' : 'ok'
      return `<li class="${level}">${escapeHtml(alert.title)}: ${escapeHtml(alert.message)}</li>`
    })
    .join('')
}

function renderLogs(logs: MaintenanceLog[]): string {
  if (logs.length === 0) {
    return '<li><div class="log-title">No maintenance logged yet</div><div class="muted">Submit the form to store the first maintenance event.</div></li>'
  }

  return logs
    .slice(0, 6)
    .map(
      (log) => `
        <li>
          <div class="log-title">${escapeHtml(log.machine_name ?? `Machine #${log.machine_id}`)}</div>
          <div class="muted">${escapeHtml(log.maintenance_type)} | ${formatCurrency(log.cost)} | Technician: ${escapeHtml(log.technician || 'Unassigned')}</div>
        </li>
      `,
    )
    .join('')
}

function renderMachines(machines: Machine[]): string {
  if (machines.length === 0) {
    return '<div class="table-empty">No machines yet. Use "Add Equipment" to create the first record.</div>'
  }

  return machines
    .map(
      (machine) => `
        <div class="table-row" data-machine-row="${machine.id}">
          <span>${escapeHtml(machine.name)}</span>
          <span>${escapeHtml(machine.type)}</span>
          <span>${formatPercent(machine.health)}</span>
          <span>${relativeDaysLabel(machine.rul_days)}</span>
          <span><span class="status ${statusClass(machine.status)}">${escapeHtml(machine.status)}</span></span>
          <span>${escapeHtml(formatDate(machine.last_maint))}</span>
          <button class="link-btn" type="button" data-select-machine="${machine.id}">${machineActionLabel(machine)}</button>
        </div>
      `,
    )
    .join('')
}

function render(): void {
  const dashboard = state.dashboard
  const featuredMachine = pickFeaturedMachine(dashboard)
  const prediction = featuredMachine?.latest_prediction ?? dashboard?.predictions?.[0] ?? null
  const totalCost = dashboard?.maintenance_logs.reduce((sum, log) => sum + Number(log.cost || 0), 0) ?? 0

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
          <button class="icon-btn" aria-label="notifications">${dashboard?.alerts.length ?? 0}</button>
          <div class="avatar">JS</div>
        </div>
      </header>

      ${state.error ? `<div class="banner error">${escapeHtml(state.error)}</div>` : ''}
      ${state.formMessage ? `<div class="banner success">${escapeHtml(state.formMessage)}</div>` : ''}
      ${state.maintenanceMessage ? `<div class="banner success">${escapeHtml(state.maintenanceMessage)}</div>` : ''}

      <section class="stats-grid">
        <div class="stat-card">
          <div>
            <div class="stat-label">Total Machines</div>
            <div class="stat-value">${dashboard?.summary.total ?? 0}</div>
          </div>
        </div>
        <div class="stat-card healthy">
          <div class="dot"></div>
          <div>
            <div class="stat-label">Healthy Machines</div>
            <div class="stat-value">${dashboard?.summary.healthy ?? 0}</div>
          </div>
        </div>
        <div class="stat-card warning">
          <div class="dot"></div>
          <div>
            <div class="stat-label">Warning Machines</div>
            <div class="stat-value">${dashboard?.summary.warning ?? 0}</div>
          </div>
        </div>
        <div class="stat-card critical">
          <div class="dot"></div>
          <div>
            <div class="stat-label">Critical Machines</div>
            <div class="stat-value">${dashboard?.summary.critical ?? 0}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>Equipment Health</h3>
          <span class="pill">${state.loading ? 'Syncing' : 'Live'}</span>
        </div>
        <div class="table">
          <div class="table-head">
            <span>Machine Name</span><span>Equipment Type</span><span>Health Score</span><span>Remaining Useful Life</span><span>Status</span><span>Last Maintenance</span><span>Action</span>
          </div>
          ${state.loading ? '<div class="table-empty">Loading dashboard data...</div>' : renderMachines(dashboard?.machines ?? [])}
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
            ${renderSparkline(featuredMachine)}
          </div>
        </div>

        <div class="panel gauge">
          <div class="panel-head"><h3>Machine Health Score</h3></div>
          <div class="gauge-wrap">
            <div class="gauge-ring" style="--percent:${Math.round(featuredMachine?.health ?? 0)}"></div>
            <div class="gauge-center">
              <div class="gauge-value">${formatPercent(featuredMachine?.health)}</div>
              <div class="muted">${escapeHtml(featuredMachine?.name ?? 'No machine selected')}</div>
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
              <h4>${escapeHtml(featuredMachine?.name ?? 'No machine selected')}</h4>
            </div>
            <div class="prediction-grid">
              <div><span class="muted">Health Score</span><strong>${formatPercent(prediction?.health_pct ?? featuredMachine?.health)}</strong></div>
              <div><span class="muted">Predicted Failure</span><strong>${relativeDaysLabel(prediction?.rul_days ?? featuredMachine?.rul_days)}</strong></div>
              <div><span class="muted">Confidence</span><strong>${formatPercent(prediction?.confidence_pct ?? ((prediction?.confidence ?? 0) * 100))}</strong></div>
            </div>
            <div class="alert-card">
              ${prediction ? `Status is ${escapeHtml(prediction.status)} with model mode ${escapeHtml(prediction.model_mode ?? 'n/a')}.` : 'Run a prediction or upload sensor data to populate this card.'}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h3>Maintenance Cost Tracker</h3></div>
          <form class="form-grid" id="maintenance-form">
            <label>
              <span>Machine</span>
              <select name="machine_id" required>
                <option value="">Select machine</option>
                ${(dashboard?.machines ?? [])
                  .map(
                    (machine) =>
                      `<option value="${machine.id}" ${featuredMachine?.id === machine.id ? 'selected' : ''}>${escapeHtml(machine.name)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label><span>Maintenance Type</span><input name="maintenance_type" type="text" placeholder="Bearing Replacement" required /></label>
            <label><span>Parts Replaced</span><input name="parts_replaced" type="text" placeholder="Bearings" /></label>
            <label><span>Cost (RM)</span><input name="cost" type="number" min="0" step="0.01" placeholder="350" required /></label>
            <label><span>Technician</span><input name="technician" type="text" placeholder="Ahmad" /></label>
            <label><span>Date</span><input name="maintenance_date" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></label>
            <label class="full"><span>Notes</span><textarea name="notes" rows="2" placeholder="Notes..."></textarea></label>
            <div class="full form-footer">
              <div class="muted">Tracked maintenance spend: <strong>${formatCurrency(totalCost)}</strong></div>
              <button type="submit" class="primary">${state.submittingMaintenance ? 'Saving...' : 'Log Maintenance'}</button>
            </div>
          </form>
        </div>
      </section>

      <section class="layout-two">
        <div class="panel">
          <div class="panel-head"><h3>Real-Time Alerts</h3></div>
          <ul class="alerts">
            ${renderAlerts(dashboard?.alerts ?? [])}
          </ul>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Recent Maintenance Logs</h3></div>
          <ul class="logs">
            ${renderLogs(dashboard?.maintenance_logs ?? [])}
          </ul>
        </div>
      </section>

      <button class="fab" id="fab">+ Add Equipment</button>

      <div class="drawer" id="drawer">
        <div class="drawer-content">
          <div class="drawer-head">
            <h3>Add Equipment</h3>
            <button class="icon-btn" id="close" type="button">X</button>
          </div>
          <form class="form-grid" id="machine-form">
            <label><span>Machine Name</span><input name="name" type="text" placeholder="New Machine" required /></label>
            <label><span>Equipment Type</span><input name="machine_type" type="text" placeholder="Chiller" required /></label>
            <label><span>Brand</span><input name="brand" type="text" placeholder="Carrier" /></label>
            <label><span>Location</span><input name="location" type="text" placeholder="Plant A" /></label>
            <label><span>Operating Hours</span><input name="cycle" type="number" min="0" placeholder="3200" /></label>
            <label><span>Load %</span><input name="load_pct" type="number" min="0" max="100" placeholder="75" /></label>
            <label><span>Temperature</span><input name="temperature" type="number" min="-50" max="300" step="0.1" placeholder="68" /></label>
            <label><span>Last Maintenance Date</span><input name="last_maintenance_date" type="date" /></label>
            <label class="full"><span>Notes</span><textarea name="notes" rows="2" placeholder="Machine details..."></textarea></label>
            <div class="full form-footer">
              <div class="muted">Creates the machine record, then optionally logs the maintenance date.</div>
              <button type="submit" class="primary">${state.submittingMachine ? 'Saving...' : 'Submit Equipment'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `

  bindUi()
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Request failed: ${response.status}`
    try {
      const data = await response.json()
      message = data.detail || data.message || message
    } catch {
      // Keep the default message when the backend does not return JSON.
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function loadDashboard(): Promise<void> {
  state.loading = true
  state.error = null
  render()

  try {
    const dashboard = await apiRequest<DashboardResponse>('/api/dashboard')
    state.dashboard = dashboard
    if (!dashboard.machines.some((machine) => machine.id === state.selectedMachineId)) {
      state.selectedMachineId = dashboard.machines[0]?.id ?? null
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Unable to load dashboard.'
  } finally {
    state.loading = false
    render()
  }
}

async function handleMachineSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const data = new FormData(form)

  state.submittingMachine = true
  state.formMessage = null
  state.error = null
  render()

  try {
    const machinePayload = {
      name: String(data.get('name') || '').trim(),
      machine_type: String(data.get('machine_type') || '').trim(),
      brand: String(data.get('brand') || '').trim() || null,
      location: String(data.get('location') || '').trim() || null,
      notes: String(data.get('notes') || '').trim() || null,
    }

    const machineResponse = await apiRequest<{ machine: Machine }>('/api/machines', {
      method: 'POST',
      body: JSON.stringify(machinePayload),
    })

    const machineId = machineResponse.machine.id
    const cycle = Number(data.get('cycle'))
    const loadPct = Number(data.get('load_pct'))
    const temperature = Number(data.get('temperature'))
    const lastMaintenanceDate = String(data.get('last_maintenance_date') || '').trim()

    if (!Number.isNaN(cycle) || !Number.isNaN(loadPct) || !Number.isNaN(temperature)) {
      await apiRequest(`/api/predict`, {
        method: 'POST',
        body: JSON.stringify({
          machine_id: machineId,
          cycle: Number.isNaN(cycle) ? undefined : cycle,
          load_pct: Number.isNaN(loadPct) ? undefined : loadPct,
          temperature: Number.isNaN(temperature) ? undefined : temperature,
        }),
      })
    }

    if (lastMaintenanceDate) {
      await apiRequest(`/api/machines/${machineId}/maintenance-logs`, {
        method: 'POST',
        body: JSON.stringify({
          maintenance_date: lastMaintenanceDate,
          maintenance_type: 'Initial inspection',
          cost: 0,
          notes: 'Logged during equipment onboarding.',
        }),
      })
    }

    state.formMessage = 'Equipment saved to the backend.'
    state.selectedMachineId = machineId
    form.reset()
    closeDrawer()
    await loadDashboard()
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Unable to save equipment.'
    render()
  } finally {
    state.submittingMachine = false
    render()
  }
}

async function handleMaintenanceSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault()
  const form = event.currentTarget as HTMLFormElement
  const data = new FormData(form)
  const machineId = Number(data.get('machine_id'))

  if (Number.isNaN(machineId) || machineId <= 0) {
    state.error = 'Select a machine before logging maintenance.'
    render()
    return
  }

  state.submittingMaintenance = true
  state.maintenanceMessage = null
  state.error = null
  render()

  try {
    await apiRequest(`/api/machines/${machineId}/maintenance-logs`, {
      method: 'POST',
      body: JSON.stringify({
        maintenance_date: String(data.get('maintenance_date') || ''),
        maintenance_type: String(data.get('maintenance_type') || '').trim(),
        parts_replaced: String(data.get('parts_replaced') || '').trim() || null,
        cost: Number(data.get('cost') || 0),
        technician: String(data.get('technician') || '').trim() || null,
        notes: String(data.get('notes') || '').trim() || null,
      }),
    })

    state.maintenanceMessage = 'Maintenance log saved.'
    state.selectedMachineId = machineId
    form.reset()
    await loadDashboard()
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Unable to save maintenance log.'
    render()
  } finally {
    state.submittingMaintenance = false
    render()
  }
}

function openDrawer(): void {
  document.querySelector<HTMLElement>('#drawer')?.classList.add('open')
}

function closeDrawer(): void {
  document.querySelector<HTMLElement>('#drawer')?.classList.remove('open')
}

function bindUi(): void {
  document.querySelector<HTMLButtonElement>('#fab')?.addEventListener('click', openDrawer)
  document.querySelector<HTMLButtonElement>('#close')?.addEventListener('click', closeDrawer)
  document.querySelector<HTMLElement>('#drawer')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeDrawer()
  })

  document.querySelectorAll<HTMLButtonElement>('[data-select-machine]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedMachineId = Number(button.dataset.selectMachine)
      render()
    })
  })

  document.querySelector<HTMLFormElement>('#machine-form')?.addEventListener('submit', (event) => {
    void handleMachineSubmit(event as SubmitEvent)
  })

  document.querySelector<HTMLFormElement>('#maintenance-form')?.addEventListener('submit', (event) => {
    void handleMaintenanceSubmit(event as SubmitEvent)
  })
}

render()
void loadDashboard()
