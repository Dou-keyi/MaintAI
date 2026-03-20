import React, { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function AddEquipment() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [machineType, setMachineType] = useState('Motor')
  const [brand, setBrand] = useState('Generic')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState('')
  const [temperature, setTemperature] = useState(68)
  const [vibration, setVibration] = useState(0.4)
  const [rpm, setRpm] = useState(1200)
  const [cycleCount, setCycleCount] = useState(0)
  const [loadPct, setLoadPct] = useState(65)
  const [initialFile, setInitialFile] = useState<File | null>(null)
  const [loaderStage, setLoaderStage] = useState('Preparing machine blueprint...')

  const handleAddEquipment = async () => {
    if (!name.trim()) return alert('Please enter a name.')
    if (!location.trim()) return alert('Please enter a location.')

    setLoading(true)
    try {
      setLoaderStage('Preparing machine blueprint...')
      const machineRes = await api.post('/api/machines', {
        name: name.trim(),
        machine_type: machineType,
        brand: brand.trim() || null,
        location: location.trim(),
        install_date: startDate || null,
        notes: notes.trim() || null,
      })

      const machineId = machineRes.data.machine.id as number

      setLoaderStage('Calibrating health profile...')
      await api.post('/api/predict', {
        machine_id: machineId,
        cycle: cycleCount,
        temperature,
        vibration,
        rpm,
        load_pct: loadPct,
      })

      if (startDate) {
        setLoaderStage('Stamping maintenance baseline...')
        await api.post(`/api/machines/${machineId}/maintenance-logs`, {
          maintenance_date: startDate,
          maintenance_type: 'Initial inspection',
          cost: 0,
          notes: 'Logged during onboarding.',
        })
      }

      if (initialFile) {
        setLoaderStage('Injecting telemetry feed...')
        const fd = new FormData()
        fd.append('file', initialFile)
        await api.post(`/api/machines/${machineId}/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      navigate('/dashboard')
    } catch (error) {
      console.error(error)
      alert('Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-12 py-10 max-w-5xl mx-auto animate-fade-up">
      {loading && (
        <div className="fixed inset-0 z-[1200] bg-ink/92 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-teal/20 bg-ink-2 p-8 shadow-[0_0_60px_rgba(0,212,184,0.14)]">
            <div className="flex items-center justify-center mb-6">
              <div className="machine-loader">
                <div className="machine-loader__body" />
                <div className="machine-loader__arm machine-loader__arm--left" />
                <div className="machine-loader__arm machine-loader__arm--right" />
                <div className="machine-loader__wheel machine-loader__wheel--left" />
                <div className="machine-loader__wheel machine-loader__wheel--right" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-mono uppercase tracking-[0.35em] text-teal mb-3">Machine Builder</div>
              <div className="text-2xl font-display font-bold text-white">Saving Equipment</div>
              <p className="mt-3 text-sm text-gray-400">{loaderStage}</p>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/6">
              <div className="machine-loader__progress h-full rounded-full bg-gradient-to-r from-teal via-cyan-300 to-teal" />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-4xl font-extrabold text-white mb-2">Add New Equipment</h2>
          <p className="text-gray-400 text-[15px]">Register a machine in the backend and optionally seed its first telemetry log.</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-ink-3 border border-border rounded-lg text-sm text-gray-300 hover:bg-white/5">
          Back to Dashboard
        </button>
      </div>

      <div className="card border-teal/20">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Equipment Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Conveyor-A4" className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal transition-all" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Floor 2 - Line B" className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Equipment Type</label>
            <select value={machineType} onChange={e => setMachineType(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
              <option>Motor</option><option>Pump</option><option>HVAC</option><option>Conveyor</option><option>Compressor</option><option>Cooling</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Brand</label>
            <select value={brand} onChange={e => setBrand(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
              <option>Generic</option><option>Siemens</option><option>ABB</option><option>GE</option><option>Schneider</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Start Using Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycles Completed</label>
            <input type="number" min="0" value={cycleCount} onChange={e => setCycleCount(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Load %</label>
            <input type="number" min="0" max="100" value={loadPct} onChange={e => setLoadPct(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Temperature</label>
            <input type="number" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Vibration</label>
            <input type="number" step="0.01" value={vibration} onChange={e => setVibration(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">RPM</label>
            <input type="number" value={rpm} onChange={e => setRpm(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase">Seed Telemetry (CSV)</label>
          </div>
          <div className="relative h-24 group border-2 border-dashed border-border rounded-xl hover:border-teal/50 transition-all flex flex-col items-center justify-center gap-2 bg-black/20">
            <input type="file" accept=".csv" onChange={e => setInitialFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <Upload size={20} className="text-gray-500 group-hover:text-teal" />
            <span className="text-[10px] text-gray-500 uppercase font-mono">{initialFile ? initialFile.name : 'Drag telemetry here or click to upload'}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button onClick={() => navigate('/dashboard')} className="px-5 py-3 bg-ink border border-border rounded-xl text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2">
            <X size={16} /> Cancel
          </button>
          <button onClick={handleAddEquipment} disabled={loading} className="px-6 py-3 bg-teal text-ink font-bold rounded-xl shadow-lg hover:brightness-110 transition-all">
            {loading ? 'Saving...' : 'Add Equipment'}
          </button>
        </div>
      </div>
    </div>
  )
}
