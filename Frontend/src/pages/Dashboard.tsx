import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Upload, Wrench, Trash2, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  api,
  type AlertItem,
  type DashboardResponse,
  type MachineDetail,
  type MachineEconomics,
  type MachineSummary,
  type MaintenanceLog,
  type SensorReading,
} from '../lib/api'

const statusTone: Record<string, string> = {
  Healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Warning: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  Critical: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const shellCard = 'rounded-2xl border border-white/8 bg-[#161c2f] shadow-[0_18px_50px_rgba(0,0,0,0.24)]'
const innerCard = 'rounded-xl border border-white/6 bg-[#0d1322] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'

const formatDate = (value?: string | null) => {
  if (!value) return 'Not logged'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const getRulHours = (machine: Pick<MachineSummary, 'rul_cycles'> | Pick<MachineDetail, 'rul_cycles'>) =>
  Math.max(0, Math.round(machine.rul_cycles * 1.8))

const getBatteryTone = (health: number) => {
  if (health <= 35) return 'bg-red-500'
  if (health <= 65) return 'bg-amber-400'
  return 'bg-emerald-400'
}

const BatteryStatus = ({ health }: { health: number }) => {
  const level = Math.max(6, Math.min(100, Math.round(health)))

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-5 w-14 rounded-md border border-border bg-ink p-[2px]">
        <div className={`h-full rounded-sm ${getBatteryTone(health)}`} style={{ width: `${level}%` }} />
        <div className="absolute -right-[4px] top-[5px] h-2.5 w-1 rounded-r bg-gray-500/70" />
      </div>
      <span className="text-sm font-semibold text-white">{level}%</span>
    </div>
  )
}

const formatTelemetryTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [selectedMachine, setSelectedMachine] = useState<MachineDetail | null>(null)
  const [expandedMachineId, setExpandedMachineId] = useState<number | null>(null)
  const [expandedSection, setExpandedSection] = useState<'overview' | 'maintenance' | 'economics'>('overview')
  const [uploadingMachineId, setUploadingMachineId] = useState<number | null>(null)
  const [economicsMachine, setEconomicsMachine] = useState<MachineSummary | null>(null)
  const [revenuePerMonth, setRevenuePerMonth] = useState('')
  const [operatingCostPerMonth, setOperatingCostPerMonth] = useState('')
  const [replacementCost, setReplacementCost] = useState('')
  const [deleteMachine, setDeleteMachine] = useState<MachineSummary | null>(null)
  const [maintenanceMachine, setMaintenanceMachine] = useState<MachineSummary | null>(null)
  const [maintenanceType, setMaintenanceType] = useState('Preventive')
  const [maintenanceDate, setMaintenanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [maintenanceNotes, setMaintenanceNotes] = useState('')
  const [maintenanceCost, setMaintenanceCost] = useState('')
  const [maintenanceTechnician, setMaintenanceTechnician] = useState('')
  const [maintenanceParts, setMaintenanceParts] = useState('')
  const [resetHealthPct, setResetHealthPct] = useState(100)
  const [resetRulCycles, setResetRulCycles] = useState(200)
  const [resetCycle, setResetCycle] = useState(0)
  const [clearSensorHistory, setClearSensorHistory] = useState(true)
  const [clearAlerts, setClearAlerts] = useState(true)
  const [error, setError] = useState('')

  const fetchDashboard = async (preserveSelection = true) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<DashboardResponse>('/api/dashboard')
      setDashboard(data)
      const nextId =
        preserveSelection && selectedMachine
          ? selectedMachine.id
          : data.machines[0]?.id

      if (nextId) {
        const machineRes = await api.get<MachineDetail>(`/api/machines/${nextId}`)
        setSelectedMachine(machineRes.data)
        setExpandedMachineId(nextId)
        setExpandedSection('overview')
      } else {
        setSelectedMachine(null)
        setExpandedMachineId(null)
      }
    } catch (err) {
      console.error(err)
      setError('Unable to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDashboard(false)
  }, [])

  const topMachine = useMemo(() => {
    if (!dashboard?.machines.length) return null
    return [...dashboard.machines].sort((a, b) => a.health - b.health)[0]
  }, [dashboard])

  const handleSelectMachine = async (
    machine: MachineSummary,
    section: 'overview' | 'maintenance' | 'economics' = 'overview',
  ) => {
    if (expandedMachineId === machine.id && expandedSection === section) {
      setExpandedMachineId(null)
      return
    }

    try {
      const { data } = await api.get<MachineDetail>(`/api/machines/${machine.id}`)
      setSelectedMachine(data)
      setExpandedMachineId(machine.id)
      setExpandedSection(section)
    } catch (err) {
      console.error(err)
      setError('Unable to load machine detail.')
    }
  }

  const handleSyncUpload = async (machineId: number, file: File) => {
    setUploadingMachineId(machineId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/api/machines/${machineId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchDashboard()
    } catch (err) {
      console.error(err)
      alert('Manual sync failed. Please check file format.')
    } finally {
      setUploadingMachineId(null)
    }
  }

  const handleRequestMaintenance = async () => {
    if (!maintenanceMachine) return
    try {
      await api.post(`/api/machines/${maintenanceMachine.id}/maintenance-logs`, {
        maintenance_date: maintenanceDate,
        maintenance_type: maintenanceType,
        cost: maintenanceCost ? Number(maintenanceCost) : 0,
        technician: maintenanceTechnician || null,
        parts_replaced: maintenanceParts || null,
        notes: maintenanceNotes || null,
        restored_health_pct: resetHealthPct,
        restored_rul_cycles: resetRulCycles,
        reset_cycle: resetCycle,
        clear_sensor_history: clearSensorHistory,
        clear_alerts: clearAlerts,
      })
      setMaintenanceMachine(null)
      setMaintenanceNotes('')
      setMaintenanceCost('')
      setMaintenanceTechnician('')
      setMaintenanceParts('')
      await fetchDashboard()
    } catch (err) {
      console.error(err)
      alert('Maintenance logging failed.')
    }
  }

  const handleDeleteEquipment = async () => {
    if (!deleteMachine) return
    try {
      await api.delete(`/api/machines/${deleteMachine.id}`)
      if (selectedMachine?.id === deleteMachine.id) {
        setSelectedMachine(null)
        setExpandedMachineId(null)
      }
      setDeleteMachine(null)
      await fetchDashboard(false)
    } catch (err) {
      console.error(err)
      alert('Delete failed.')
    }
  }

  const handleSaveEconomics = async () => {
    if (!economicsMachine) return
    try {
      await api.put(`/api/machines/${economicsMachine.id}/economics`, {
        revenue_per_month: Number(revenuePerMonth || 0),
        operating_cost_per_month: Number(operatingCostPerMonth || 0),
        replacement_cost: Number(replacementCost || 0),
      })
      setEconomicsMachine(null)
      await fetchDashboard()
    } catch (err) {
      console.error(err)
      alert('Economics update failed.')
    }
  }

  const openEconomicsModal = (machine: MachineSummary) => {
    setEconomicsMachine(machine)
    setRevenuePerMonth(String(machine.revenue_per_month ?? machine.economics?.revenue_per_month ?? 0))
    setOperatingCostPerMonth(String(machine.operating_cost_per_month ?? machine.economics?.operating_cost_per_month ?? 0))
    setReplacementCost(String(machine.replacement_cost ?? machine.economics?.replacement_cost ?? 0))
  }

  const renderEconomics = (economics?: MachineEconomics | null) => {
    if (!economics) {
      return <div className="text-sm text-gray-500">No economics data recorded yet.</div>
    }

    const comparisonData = [
      {
        name: 'Keep',
        value: Number(economics.keep_estimated_value_12m.toFixed(2)),
        fill: '#2dd4bf',
      },
      {
        name: 'Replace',
        value: Number(economics.replace_estimated_value_12m.toFixed(2)),
        fill: '#818cf8',
      },
    ]

    const costBreakdownData = [
      {
        name: 'Monthly Margin',
        value: Number(economics.monthly_margin.toFixed(2)),
        fill: '#34d399',
      },
      {
        name: 'Downtime Risk',
        value: Number(economics.downtime_risk_cost.toFixed(2)),
        fill: '#f59e0b',
      },
      {
        name: 'Maint. 12M',
        value: Number(economics.projected_maintenance_cost.toFixed(2)),
        fill: '#f87171',
      },
    ]

    return (
      <div className={`${innerCard} px-4 py-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">{economics.recommendation}</div>
            <div className="mt-1 text-xs text-gray-400">{economics.rationale}</div>
          </div>
          <div className="rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-[11px] font-mono text-teal">
            Margin RM {economics.monthly_margin.toFixed(2)}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={`${innerCard} p-3`}>
            <div className="mb-2 text-[10px] uppercase font-mono tracking-widest text-gray-500">12M Decision Value</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number) => [`RM ${value.toFixed(2)}`, 'Value']}
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      color: '#e5e7eb',
                    }}
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {comparisonData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={`${innerCard} p-3`}>
            <div className="mb-2 text-[10px] uppercase font-mono tracking-widest text-gray-500">Cost Pressure</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costBreakdownData} layout="vertical" margin={{ top: 8, right: 12, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={86} />
                  <Tooltip
                    formatter={(value: number) => [`RM ${value.toFixed(2)}`, 'Amount']}
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      color: '#e5e7eb',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                    {costBreakdownData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className={`${innerCard} px-3 py-3`}>
            <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-1">Keep 12M</div>
            <div className="text-white font-semibold">RM {economics.keep_estimated_value_12m.toFixed(2)}</div>
          </div>
          <div className={`${innerCard} px-3 py-3`}>
            <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-1">Replace 12M</div>
            <div className="text-white font-semibold">RM {economics.replace_estimated_value_12m.toFixed(2)}</div>
          </div>
          <div className={`${innerCard} px-3 py-3`}>
            <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-1">Downtime Risk</div>
            <div className="text-white font-semibold">RM {economics.downtime_risk_cost.toFixed(2)}</div>
          </div>
          <div className={`${innerCard} px-3 py-3`}>
            <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-1">Maintenance 12M</div>
            <div className="text-white font-semibold">RM {economics.projected_maintenance_cost.toFixed(2)}</div>
          </div>
          <div className={`${innerCard} px-3 py-3`}>
            <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-1">Maint. Total</div>
            <div className="text-white font-semibold">RM {economics.maintenance_cost_total.toFixed(2)}</div>
          </div>
          <div className={`${innerCard} px-3 py-3`}>
            <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-1">Maint. Events</div>
            <div className="text-white font-semibold">{economics.maintenance_events}</div>
          </div>
          <div className={`${innerCard} px-3 py-3`}>
            <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500 mb-1">Replacement Cost</div>
            <div className="text-white font-semibold">RM {economics.replacement_cost.toFixed(2)}</div>
          </div>
        </div>
      </div>
    )
  }

  const renderMachineCard = (machine: MachineSummary) => {
    const isExpanded = expandedMachineId === machine.id && selectedMachine?.id === machine.id

    return (
    <div
      key={machine.id}
      className={`${shellCard} p-5 transition-all hover:border-teal/30 cursor-pointer ${isExpanded ? 'ring-1 ring-teal/40' : ''}`}
      onClick={() => void handleSelectMachine(machine, 'overview')}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void handleSelectMachine(machine, 'overview')
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base text-white font-display font-semibold">{machine.name}</div>
          <div className="text-xs text-gray-400 mt-1">{machine.type} | {machine.location || 'Unknown'}</div>
        </div>
        <span className={`px-3 py-1 rounded-full border text-xs font-mono ${statusTone[machine.status] || statusTone.Healthy}`}>{machine.status}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className={`${innerCard} px-4 py-3`}>
          <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-2">Battery</div>
          <BatteryStatus health={machine.health} />
        </div>
        <div className={`${innerCard} px-4 py-3`}>
          <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">RUL</div>
          <div className="text-2xl font-display text-white">{getRulHours(machine)}h</div>
        </div>
        <div className={`${innerCard} px-4 py-3`}>
          <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">Last Maint</div>
          <div className="text-xs text-white">{machine.last_maint ? formatDate(machine.last_maint) : 'None'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <div className="px-3 py-2 bg-white text-ink rounded-lg text-xs font-semibold">
          {isExpanded ? 'Opened' : 'Click card to view'}
        </div>
        <label
          className="px-3 py-2 bg-ink border border-border rounded-lg text-xs text-gray-300 cursor-pointer flex items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Upload size={14} />
          {uploadingMachineId === machine.id ? 'Updating...' : 'Update CSV'}
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(event) => {
              event.stopPropagation()
              const file = event.target.files?.[0]
              if (file) void handleSyncUpload(machine.id, file)
              event.currentTarget.value = ''
            }}
          />
        </label>
        <button
          onClick={(event) => {
            event.stopPropagation()
            setMaintenanceMachine(machine)
            setMaintenanceType('Preventive')
            setMaintenanceDate(new Date().toISOString().slice(0, 10))
            setMaintenanceNotes('')
            setMaintenanceCost('')
            setMaintenanceTechnician('')
            setMaintenanceParts('')
            setResetHealthPct(100)
            setResetRulCycles(Math.max(200, Math.round(machine.rul_cycles)))
            setResetCycle(0)
            setClearSensorHistory(true)
            setClearAlerts(true)
          }}
          className="px-3 py-2 bg-ink border border-border rounded-lg text-xs text-gray-300 flex items-center gap-2"
        >
          <Wrench size={14} /> Maintain
        </button>
        <button
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/equipment/${machine.id}/edit`)
          }}
          className="px-3 py-2 bg-ink border border-border rounded-lg text-xs text-gray-300 flex items-center gap-2"
        >
          <Pencil size={14} /> Edit
        </button>
        <div className="ml-auto" />
        <button
          onClick={(event) => {
            event.stopPropagation()
            setDeleteMachine(machine)
          }}
          className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300 flex items-center gap-2"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {isExpanded && selectedMachine && (
        <div className="mt-4 border-t border-border pt-4">
          <div className={`${innerCard} mb-4 flex flex-wrap gap-2 p-2`} onClick={(event) => event.stopPropagation()}>
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'maintenance', label: 'Maintenance' },
              { id: 'economics', label: 'Analytics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setExpandedSection(tab.id as 'overview' | 'maintenance' | 'economics')}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  expandedSection === tab.id
                    ? 'bg-white text-ink'
                    : 'bg-transparent text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {expandedSection === 'overview' && (
            <>
          <div className="grid grid-cols-3 gap-3">
            <div className={`${innerCard} px-4 py-3`}>
              <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">Brand</div>
              <div className="text-sm text-white">{selectedMachine.brand || 'Unknown'}</div>
            </div>
            <div className={`${innerCard} px-4 py-3`}>
              <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">Installed</div>
              <div className="text-sm text-white">{selectedMachine.install_date ? formatDate(selectedMachine.install_date) : 'Not logged'}</div>
            </div>
            <div className={`${innerCard} px-4 py-3`}>
              <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">Prediction Mode</div>
              <div className="text-sm text-white">{selectedMachine.latest_prediction?.model_mode || 'No prediction yet'}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-3 uppercase font-mono tracking-widest">Sensor Trends</div>
            {renderTelemetry(selectedMachine.sensor_readings)}
          </div>
            </>
          )}
          {expandedSection === 'maintenance' && (
            <div className="mt-1">
              <div className="text-xs text-gray-500 mb-3 uppercase font-mono tracking-widest">Previous Maintenance</div>
              {renderMachineMaintenanceHistory(selectedMachine.maintenance_logs)}
            </div>
          )}
          {expandedSection === 'economics' && (
            <div className="mt-1">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500 uppercase font-mono tracking-widest">Business Analytics</div>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    openEconomicsModal(machine)
                  }}
                  className="px-3 py-2 bg-ink border border-border rounded-lg text-xs text-gray-300"
                >
                  Edit Economics
                </button>
              </div>
              {renderEconomics(selectedMachine.economics)}
            </div>
          )}
        </div>
      )}
    </div>
    )
  }

  const renderAlerts = (alerts: AlertItem[]) => {
    if (!alerts.length) {
      return <div className="text-sm text-gray-500">No active alerts.</div>
    }
    return (
      <div className="space-y-3">
        {alerts.slice(0, 6).map((alert, index) => (
          <div key={`${alert.id ?? alert.title}-${index}`} className={`${innerCard} px-4 py-3`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-white font-medium">{alert.title}</div>
              <span className={`text-xs font-mono ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-300'}`}>{alert.severity.toUpperCase()}</span>
            </div>
            <div className="text-sm text-gray-400 mt-1">{alert.message}</div>
          </div>
        ))}
      </div>
    )
  }

  const renderLogs = (logs: MaintenanceLog[]) => {
    if (!logs.length) {
      return <div className="text-sm text-gray-500">No maintenance logs yet.</div>
    }
    return (
      <div className="space-y-3">
        {logs.slice(0, 6).map((log, index) => (
          <div key={`${log.id ?? log.machine_id}-${index}`} className={`${innerCard} px-4 py-3`}>
            <div className="text-white font-medium">{log.machine_name || `Machine #${log.machine_id}`}</div>
            <div className="text-sm text-gray-400 mt-1">{log.maintenance_type} | RM {Number(log.cost || 0).toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">{formatDate(log.maintenance_date)}</div>
          </div>
        ))}
      </div>
    )
  }

  const renderTelemetry = (readings: SensorReading[]) => {
    if (!readings.length) {
      return <div className="text-sm text-gray-500">No sensor history uploaded yet.</div>
    }

    const chartData = [...readings]
      .slice(0, 20)
      .reverse()
      .map((reading) => ({
        time: formatTelemetryTime(reading.timestamp),
        temperature: reading.temperature ?? null,
        vibration: reading.vibration ?? null,
        rpm: reading.rpm ?? null,
      }))

    return (
      <div className={`${innerCard} p-3`}>
        <div className="flex flex-wrap gap-2 mb-3 text-[11px] font-mono uppercase tracking-widest">
          <span className="rounded-full bg-red-500/10 px-2 py-1 text-red-300">Temperature</span>
          <span className="rounded-full bg-teal-500/10 px-2 py-1 text-teal-300">Vibration</span>
          <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-300">RPM</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#e5e7eb',
                }}
              />
              <Line type="monotone" dataKey="temperature" stroke="#f87171" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="vibration" stroke="#2dd4bf" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="rpm" stroke="#818cf8" strokeWidth={2.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  const renderMachineMaintenanceHistory = (logs: MaintenanceLog[]) => {
    if (!logs.length) {
      return <div className="text-sm text-gray-500">No previous maintenance recorded for this machine.</div>
    }

    return (
      <div className="space-y-3">
        {logs.slice(0, 6).map((log, index) => (
          <div key={`${log.id ?? log.machine_id}-${index}`} className={`${innerCard} px-4 py-3`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{log.maintenance_type}</div>
                <div className="mt-1 text-xs text-gray-400">{formatDate(log.maintenance_date)}</div>
              </div>
              <div className="text-xs font-mono text-teal">RM {Number(log.cost || 0).toFixed(2)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-300">
              <div>Technician: {log.technician || 'Unassigned'}</div>
              <div>Parts: {log.parts_replaced || 'Not listed'}</div>
            </div>
            {(log.restored_health_pct != null || log.restored_rul_cycles != null) && (
              <div className="mt-2 text-xs text-gray-400">
                Reset to {log.restored_health_pct ?? '--'}% health and {Math.round((log.restored_rul_cycles ?? 0) * 1.8)}h RUL
              </div>
            )}
            {log.notes && <div className="mt-2 text-xs text-gray-500">{log.notes}</div>}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="px-10 py-8 max-w-6xl mx-auto animate-fade-up">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-white mb-2">Fleet Dashboard</h2>
            <p className="text-gray-400 font-body text-sm">SQLite-backed equipment, alerts, maintenance history, and predictions</p>
          </div>
          <button onClick={() => void fetchDashboard()} className="flex items-center gap-2 px-4 py-2 bg-ink-3 border border-border text-sm font-medium rounded-lg transition-all hover:bg-surface-3/10 cursor-pointer">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh Status
          </button>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className={`${shellCard} p-5`}>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Managed Units</div>
            <div className="text-3xl font-display font-medium text-white">{dashboard?.summary.total ?? 0}</div>
          </div>
          <div className={`${shellCard} border-l-4 border-l-emerald-500 p-5`}>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Optimal Health</div>
            <div className="text-3xl font-display font-medium text-emerald-400">{dashboard?.summary.healthy ?? 0}</div>
          </div>
          <div className={`${shellCard} border-l-4 border-l-amber-500 p-5`}>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Warning Zone</div>
            <div className="text-3xl font-display font-medium text-amber-400">{dashboard?.summary.warning ?? 0}</div>
          </div>
          <div className={`${shellCard} border-l-4 border-l-red-500 p-5`}>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Critical Risk</div>
            <div className="text-3xl font-display font-medium text-red-500">{dashboard?.summary.critical ?? 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-[1.45fr,0.95fr] gap-5">
          <div className="space-y-5">
            <div className={`${shellCard} p-5`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display text-xl text-white">Machines</h3>
                  <p className="text-xs text-gray-500 mt-1">Live records from `/api/machines` and `/api/dashboard`.</p>
                </div>
                <button onClick={() => navigate('/add-equipment')} className="px-4 py-2 bg-teal text-ink rounded-lg text-sm font-bold">
                  Add Equipment
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {loading && !dashboard ? <div className="text-gray-500">Loading machines...</div> : dashboard?.machines.map(renderMachineCard)}
                {!loading && !dashboard?.machines.length && <div className="text-gray-500">No machines found.</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className={`${shellCard} p-5`}>
                <h3 className="font-display text-lg text-white mb-4">Alerts</h3>
                {renderAlerts(dashboard?.alerts ?? [])}
              </div>
              <div className={`${shellCard} p-5`}>
                <h3 className="font-display text-lg text-white mb-4">Maintenance Logs</h3>
                {renderLogs(dashboard?.maintenance_logs ?? [])}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className={`${shellCard} p-5`}>
              <h3 className="font-display text-xl text-white mb-4">Fleet Focus</h3>
              {topMachine ? (
                <div className="space-y-3">
                  <div className="text-white font-semibold">{topMachine.name}</div>
                  <div className="text-sm text-gray-400">Lowest current health in fleet with {getRulHours(topMachine)} hours of estimated RUL left.</div>
                  <div className={`inline-flex px-3 py-1 rounded-full border text-xs font-mono ${statusTone[topMachine.status] || statusTone.Healthy}`}>{topMachine.status}</div>
                </div>
              ) : (
                <div className="text-gray-500">No fleet data yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {maintenanceMachine && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm overflow-y-auto px-6 py-8 md:px-10 md:py-12">
          <div className={`${shellCard} mx-auto p-6 md:p-7 w-full max-w-3xl`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">Equipment Maintenance</h3>
                <p className="text-sm text-gray-400 mt-1">{maintenanceMachine.name}</p>
              </div>
              <button onClick={() => setMaintenanceMachine(null)} className="text-gray-500 hover:text-white transition-colors">
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Maintenance Type</label>
                  <select value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none">
                    <option>Preventive</option>
                    <option>Corrective</option>
                    <option>Inspection</option>
                    <option>Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Maintenance Date</label>
                  <input type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Cost</label>
                  <input type="number" min="0" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value)} placeholder="e.g. 2500" className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Technician</label>
                  <input type="text" value={maintenanceTechnician} onChange={(e) => setMaintenanceTechnician(e.target.value)} placeholder="e.g. Amir" className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Parts Replaced</label>
                  <input type="text" value={maintenanceParts} onChange={(e) => setMaintenanceParts(e.target.value)} placeholder="e.g. Bearings, fan belt, coolant valve" className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                </div>
              </div>

              <div className={`${innerCard} p-4`}>
                <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-3">Reset Machine State</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Restored Health %</label>
                    <input type="number" min="0" max="100" value={resetHealthPct} onChange={(e) => setResetHealthPct(parseInt(e.target.value) || 0)} className="w-full bg-ink-2 border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Restored RUL Cycles</label>
                    <input type="number" min="0" value={resetRulCycles} onChange={(e) => setResetRulCycles(parseInt(e.target.value) || 0)} className="w-full bg-ink-2 border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Reset Cycle</label>
                    <input type="number" min="0" value={resetCycle} onChange={(e) => setResetCycle(parseInt(e.target.value) || 0)} className="w-full bg-ink-2 border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input type="checkbox" checked={clearSensorHistory} onChange={(e) => setClearSensorHistory(e.target.checked)} />
                    Clear old sensor history
                  </label>
                  <label className="flex items-center gap-2 text-gray-300">
                    <input type="checkbox" checked={clearAlerts} onChange={(e) => setClearAlerts(e.target.checked)} />
                    Clear active alerts
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Notes</label>
                <textarea value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} rows={3} placeholder="Describe the issue, replaced parts, technician notes, or maintenance scope." className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMaintenanceMachine(null)} className="px-5 py-3 bg-ink border border-border rounded-xl text-sm text-gray-300 hover:bg-white/5">
                  Cancel
                </button>
                <button onClick={() => void handleRequestMaintenance()} className="px-5 py-3 bg-teal text-ink font-bold rounded-xl hover:brightness-110">
                  Save Maintenance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {economicsMachine && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm overflow-y-auto px-6 py-8 md:px-10 md:py-12">
          <div className={`${shellCard} mx-auto p-6 md:p-7 w-full max-w-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">Machine Economics</h3>
                <p className="text-sm text-gray-400 mt-1">{economicsMachine.name}</p>
              </div>
              <button onClick={() => setEconomicsMachine(null)} className="text-gray-500 hover:text-white transition-colors">
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Revenue / Month</label>
                  <input type="number" min="0" value={revenuePerMonth} onChange={(e) => setRevenuePerMonth(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Operating Cost / Month</label>
                  <input type="number" min="0" value={operatingCostPerMonth} onChange={(e) => setOperatingCostPerMonth(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`${innerCard} px-4 py-4`}>
                  <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-1">Derived Maintenance Cost</div>
                  <div className="text-lg font-semibold text-white">RM {selectedMachine?.economics?.projected_maintenance_cost?.toFixed(2) ?? '0.00'}</div>
                  <div className="mt-1 text-xs text-gray-400">Auto-calculated from recorded maintenance logs.</div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Replacement Cost</label>
                  <input type="number" min="0" value={replacementCost} onChange={(e) => setReplacementCost(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-2.5 text-white text-sm outline-none" />
                </div>
              </div>

              {renderEconomics({
                revenue_per_month: Number(revenuePerMonth || 0),
                operating_cost_per_month: Number(operatingCostPerMonth || 0),
                projected_maintenance_cost: selectedMachine?.economics?.projected_maintenance_cost ?? 0,
                replacement_cost: Number(replacementCost || 0),
                maintenance_cost_total: selectedMachine?.economics?.maintenance_cost_total ?? 0,
                maintenance_events: selectedMachine?.economics?.maintenance_events ?? 0,
                monthly_margin: Number(revenuePerMonth || 0) - Number(operatingCostPerMonth || 0),
                downtime_risk_cost: selectedMachine?.economics?.downtime_risk_cost ?? 0,
                keep_estimated_value_12m: selectedMachine?.economics?.keep_estimated_value_12m ?? 0,
                replace_estimated_value_12m: selectedMachine?.economics?.replace_estimated_value_12m ?? 0,
                replacement_efficiency_gain: selectedMachine?.economics?.replacement_efficiency_gain ?? 0,
                recommendation: selectedMachine?.economics?.recommendation ?? 'Save to analyze',
                rationale: selectedMachine?.economics?.rationale ?? 'Persist the values to update the recommendation.',
                current_health_pct: selectedMachine?.economics?.current_health_pct ?? 0,
                current_rul_cycles: selectedMachine?.economics?.current_rul_cycles ?? 0,
              })}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEconomicsMachine(null)} className="px-5 py-3 bg-ink border border-border rounded-xl text-sm text-gray-300 hover:bg-white/5">
                  Cancel
                </button>
                <button onClick={() => void handleSaveEconomics()} className="px-5 py-3 bg-teal text-ink font-bold rounded-xl hover:brightness-110">
                  Save Economics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteMachine && (
        <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-6 py-8">
          <div className={`${shellCard} w-full max-w-md p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">Delete Equipment</h3>
                <p className="mt-2 text-sm text-gray-400">
                  This will permanently remove <span className="text-white font-medium">{deleteMachine.name}</span> and its
                  sensor history, maintenance logs, alerts, and predictions.
                </p>
              </div>
              <button onClick={() => setDeleteMachine(null)} className="text-gray-500 hover:text-white transition-colors">
                Close
              </button>
            </div>

            <div className={`${innerCard} mt-5 px-4 py-4`}>
              <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Machine Summary</div>
              <div className="text-sm text-white">{deleteMachine.name}</div>
              <div className="mt-1 text-xs text-gray-400">
                {deleteMachine.type} | {deleteMachine.location || 'Unknown location'}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteMachine(null)} className="px-5 py-3 bg-ink border border-border rounded-xl text-sm text-gray-300 hover:bg-white/5">
                Cancel
              </button>
              <button onClick={() => void handleDeleteEquipment()} className="px-5 py-3 bg-red-500 text-white font-bold rounded-xl hover:brightness-110">
                Delete Machine
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
