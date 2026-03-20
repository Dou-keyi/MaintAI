import React, { useEffect, useState } from 'react'
import { UploadCloud, CheckCircle, BarChart2, X, Download } from 'lucide-react'
import { api, type MachineSummary, type Prediction } from '../lib/api'

export default function PredictRUL() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Prediction | null>(null)
  const [machines, setMachines] = useState<MachineSummary[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState('')
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [newEqName, setNewEqName] = useState('')

  useEffect(() => {
    const loadMachines = async () => {
      try {
        const { data } = await api.get<{ machines: MachineSummary[] }>('/api/machines')
        setMachines(data.machines)
      } catch (error) {
        console.error(error)
      }
    }
    void loadMachines()
  }, [])

  const downloadSampleCSV = () => {
    const headers = 'timestamp,temperature,vibration,rpm,load_pct,cycle\n'
    const row = `${new Date().toISOString()},72.5,0.45,1200,64,180`
    const blob = new Blob([headers + row], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'factoryguard_sample.csv'
    a.click()
  }

  const handleSaveToFleet = async () => {
    if (!newEqName.trim() || !result) return alert('Please enter a name.')
    setLoading(true)
    try {
      const { data } = await api.post('/api/machines', {
        name: newEqName.trim(),
        machine_type: 'Imported Asset',
        brand: 'Unknown',
        location: 'Unassigned',
        health_pct: result.health_pct,
        rul_cycles: result.rul_cycles,
        notes: 'Created from standalone prediction.',
      })

      if (file && data.machine?.id) {
        const fd = new FormData()
        fd.append('file', file)
        await api.post(`/api/machines/${data.machine.id}/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      alert('Successfully added to your fleet!')
      setShowSaveModal(false)
      setResult(null)
      setFile(null)
      setNewEqName('')
    } catch (error) {
      console.error(error)
      alert('Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const url = selectedMachineId ? `/api/machines/${selectedMachineId}/upload` : '/api/predict/upload'
      const res = await api.post(url, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data.prediction || res.data)
    } catch (error) {
      console.error(error)
      alert('Prediction failed. Ensure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-12 py-10 max-w-5xl mx-auto animate-fade-up">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-display text-4xl font-extrabold text-white mb-2">Predict RUL</h2>
          <p className="text-gray-400 font-body text-[15px]">Upload sensor logs to forecast Remaining Useful Life</p>
        </div>
        <div className="flex gap-4 items-end">
          <button
            onClick={() => setShowFormatModal(true)}
            className="text-sm px-4 py-2 rounded-lg bg-surface-3/10 border border-border text-gray-400 hover:text-white transition-colors"
          >
            Format Guide
          </button>
          {result && (
            <button onClick={() => { setResult(null); setFile(null) }} className="text-sm text-red-400 hover:text-red-300 transition-colors">
              Reset
            </button>
          )}
        </div>
      </div>

      {!result ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center border-dashed border-2 bg-ink/50 transition-colors hover:border-teal/50 hover:bg-ink-2/50 max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-teal/10 text-teal rounded-full flex items-center justify-center mb-6">
            <UploadCloud size={32} />
          </div>
          <h3 className="font-display text-xl font-semibold text-white mb-2">Upload Telemetry Log</h3>

          <div className="w-full max-w-sm mb-8">
            <label className="block text-left text-xs text-gray-400 mb-1.5 font-mono tracking-widest uppercase">Select Asset Target</label>
            <select
              value={selectedMachineId}
              onChange={e => setSelectedMachineId(e.target.value)}
              className="w-full bg-ink-2 border border-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal"
            >
              <option value="">Generic (No machine link)</option>
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>{machine.name} ({machine.location || 'Unknown'})</option>
              ))}
            </select>
          </div>

          <p className="text-sm text-gray-500 mb-8 max-w-sm">
            Upload CSV telemetry containing <span className="text-teal font-mono">timestamp, temperature, vibration, rpm</span> for an ML-backed assessment.
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="btn-primary cursor-pointer px-8 w-64 justify-center"
          >
            {file ? file.name : 'Select CSV File'}
          </label>

          {file && (
            <button
              onClick={handleUpload}
              disabled={loading}
              className="mt-4 w-64 px-4 py-2.5 bg-white text-ink font-semibold text-sm rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Execute ML Model'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8 animate-fade-up">
          <div className="grid grid-cols-2 gap-8">
            <div className="card flex flex-col justify-center border-l-[4px] border-l-teal">
              <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-4">ML Forecast</h3>
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-end gap-3">
                  <span className="font-display text-7xl font-medium text-white tracking-tighter leading-none">
                    {Math.floor((result.rul_cycles ?? 0) * 1.8)}
                  </span>
                  <span className="text-teal font-mono text-sm mb-2 font-bold uppercase tracking-widest">Hours Left</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-ink/50 rounded-lg p-3 border border-border">
                    <div className="text-[10px] text-gray-500 font-mono uppercase">Cycles</div>
                    <div className="text-lg text-white font-display">{result.rul_cycles ?? 0}</div>
                  </div>
                  <div className="bg-ink/50 rounded-lg p-3 border border-border">
                    <div className="text-[10px] text-gray-500 font-mono uppercase">Health</div>
                    <div className="text-lg text-white font-display">{result.health_pct ?? 0}%</div>
                  </div>
                </div>
              </div>

              <div className={`inline-flex w-max px-3 py-1.5 text-xs font-mono font-medium rounded-full ${result.status === 'Critical' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                <CheckCircle size={14} className="mr-1.5" />
                SYSTEM STATUS: {result.status?.toUpperCase() || 'UNKNOWN'}
              </div>
            </div>

            <div className="card">
              <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                <BarChart2 size={16} /> Key Risk Drivers
              </h3>
              <div className="flex flex-col gap-4">
                {(result.top_factors || []).map((factor, index) => (
                  <div key={index} className="flex justify-between items-center pb-3 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="text-white text-[13px] font-medium">{factor.feature}</span>
                      <span className="text-gray-500 text-[11px] font-mono mt-0.5">{factor.impact || 'Analyzing...'}</span>
                    </div>
                    <div className={`font-mono text-sm ${factor.direction === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {factor.direction === 'positive' ? 'UP' : 'DOWN'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!selectedMachineId && (
            <div className="p-8 bg-teal text-ink rounded-xl flex items-center justify-between shadow-lg animate-fade-up">
              <div>
                <h4 className="font-display font-bold text-xl text-ink">Actionable Insight Ready</h4>
                <p className="text-ink/80 text-sm mt-1 font-medium">This prediction shows {result.health_pct}% health. Save it as a new fleet asset to track it over time.</p>
              </div>
              <button
                onClick={() => setShowSaveModal(true)}
                className="bg-ink text-white px-6 py-3 rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-xl"
              >
                ADD TO MY FLEET
              </button>
            </div>
          )}
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-ink-2 border border-border rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-xl font-semibold text-white mb-6 tracking-tight">Register New Asset</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Equipment Nickname</label>
                <input
                  type="text"
                  value={newEqName}
                  onChange={e => setNewEqName(e.target.value)}
                  placeholder="e.g. South Wing Pump"
                  className="w-full bg-ink border border-border rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal"
                />
              </div>

              <div className="p-4 bg-ink rounded-lg border border-border/50">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Initial Health</span>
                  <span className="text-teal font-mono">{result?.health_pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-ink-2 rounded-full overflow-hidden">
                  <div className="h-full bg-teal" style={{ width: `${result?.health_pct ?? 0}%` }} />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveToFleet}
                  disabled={loading}
                  className="flex-1 bg-teal text-ink font-bold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  {loading ? 'Saving...' : 'Deploy Asset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFormatModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-ink-2 border border-border rounded-xl p-8 w-full max-w-xl shadow-2xl animate-fade-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-xl font-semibold text-white">Log Format Spec</h3>
              <button onClick={() => setShowFormatModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <p className="text-sm text-gray-400">Your CSV should contain the following headers:</p>

              <div className="bg-ink rounded-lg p-4 font-mono text-[13px] border border-border/50">
                <div className="text-teal">timestamp,temperature,vibration,rpm,load_pct,cycle</div>
                <div className="text-gray-500 mt-2 italic">Example Row:</div>
                <div className="text-gray-300">2026-03-19 08:30:00,72.5,0.45,1200,64,180</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={downloadSampleCSV}
                  className="w-full bg-teal text-ink font-bold py-2.5 rounded-lg transition-colors hover:bg-teal/90 flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Download Sample
                </button>
                <button
                  onClick={() => setShowFormatModal(false)}
                  className="w-full bg-ink-2 border border-border text-white py-2.5 rounded-lg transition-colors hover:bg-surface-3/10"
                >
                  Close Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
