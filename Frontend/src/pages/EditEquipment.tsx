import React, { useEffect, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type MachineDetail } from '../lib/api'

export default function EditEquipment() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [machine, setMachine] = useState<MachineDetail | null>(null)
  const [name, setName] = useState('')
  const [machineType, setMachineType] = useState('Motor')
  const [brand, setBrand] = useState('Generic')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [temperature, setTemperature] = useState(68)
  const [vibration, setVibration] = useState(0.4)
  const [rpm, setRpm] = useState(1200)
  const [cycleCount, setCycleCount] = useState(0)
  const [loadPct, setLoadPct] = useState(65)
  const [logFile, setLogFile] = useState<File | null>(null)

  useEffect(() => {
    const loadMachine = async () => {
      if (!id) return
      try {
        const { data } = await api.get<MachineDetail>(`/api/machines/${id}`)
        setMachine(data)
        setName(data.name || '')
        setMachineType(data.type || 'Motor')
        setBrand(data.brand || 'Generic')
        setLocation(data.location || '')
        setNotes(data.notes || '')
        const latest = data.sensor_readings[0]
        setTemperature(Number(latest?.temperature ?? 68))
        setVibration(Number(latest?.vibration ?? 0.4))
        setRpm(Number(latest?.rpm ?? 1200))
        setCycleCount(Number(latest?.cycle ?? 0))
        setLoadPct(Number(latest?.load_pct ?? 65))
      } catch (error) {
        console.error(error)
        navigate('/dashboard')
      } finally {
        setPageLoading(false)
      }
    }

    void loadMachine()
  }, [id, navigate])

  const handleSave = async () => {
    if (!id || !name.trim()) return alert('Please enter an equipment name.')

    setLoading(true)
    try {
      await api.patch(`/api/machines/${id}`, {
        name: name.trim(),
        machine_type: machineType,
        brand: brand.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      })

      await api.post('/api/predict', {
        machine_id: Number(id),
        cycle: cycleCount,
        temperature,
        vibration,
        rpm,
        load_pct: loadPct,
      })

      if (logFile) {
        const fd = new FormData()
        fd.append('file', logFile)
        await api.post(`/api/machines/${id}/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      navigate('/dashboard')
    } catch (error) {
      console.error(error)
      alert('Update failed.')
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return <div className="px-12 py-10 max-w-5xl mx-auto text-gray-400">Loading equipment...</div>
  }

  return (
    <div className="px-12 py-10 max-w-5xl mx-auto animate-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-4xl font-extrabold text-white mb-2">Modify Equipment</h2>
          <p className="text-gray-400 text-[15px]">Update the machine profile and optionally upload a new telemetry log.</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-ink-3 border border-border rounded-lg text-sm text-gray-300 hover:bg-white/5">
          Back to Dashboard
        </button>
      </div>

      <div className="card border-teal/20">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Equipment Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Equipment Type</label>
            <select value={machineType} onChange={(e) => setMachineType(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
              <option>Motor</option><option>Pump</option><option>HVAC</option><option>Conveyor</option><option>Compressor</option><option>Cooling</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Brand</label>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
              <option>Generic</option><option>Siemens</option><option>ABB</option><option>GE</option><option>Schneider</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycle</label>
            <input type="number" value={cycleCount} onChange={(e) => setCycleCount(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Load %</label>
            <input type="number" min="0" max="100" value={loadPct} onChange={(e) => setLoadPct(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Current Temp</label>
            <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Current Vibration</label>
            <input type="number" step="0.01" value={vibration} onChange={(e) => setVibration(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Current RPM</label>
            <input type="number" value={rpm} onChange={(e) => setRpm(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Update Telemetry Log (Optional)</label>
          <div className="relative h-24 group border-2 border-dashed border-border rounded-xl hover:border-teal/50 transition-all flex flex-col items-center justify-center gap-2 bg-black/20">
            <input type="file" accept=".csv" onChange={(e) => setLogFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <Upload size={20} className="text-gray-500 group-hover:text-teal" />
            <span className="text-[10px] text-gray-500 uppercase font-mono">{logFile ? logFile.name : 'Upload a new telemetry csv'}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={() => navigate('/dashboard')} className="px-5 py-3 bg-ink border border-border rounded-xl text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2">
            <X size={16} /> Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="px-6 py-3 bg-teal text-ink font-bold rounded-xl shadow-lg hover:brightness-110 transition-all">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {machine && (
        <div className="mt-6 text-sm text-gray-400">
          Current backend record: {machine.name} | Status {machine.status} | Health {machine.health}%
        </div>
      )}
    </div>
  )
}
