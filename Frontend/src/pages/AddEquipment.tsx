import React, { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../lib/supabase';

export default function AddEquipment() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [newEqName, setNewEqName] = useState('');
  const [newEqType, setNewEqType] = useState('Motor');
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [selectedExistingCategory, setSelectedExistingCategory] = useState('');
  const [newEqCategory, setNewEqCategory] = useState('');
  const [newEqBrand, setNewEqBrand] = useState('Generic');
  const [newEqLocation, setNewEqLocation] = useState('');
  const [newEqBattery, setNewEqBattery] = useState(100);
  const [newEqTemp, setNewEqTemp] = useState(85);
  const [newEqCurrentTemp, setNewEqCurrentTemp] = useState(68);
  const [newEqCurrentVibration, setNewEqCurrentVibration] = useState(0.4);
  const [newEqCurrentRpm, setNewEqCurrentRpm] = useState(1200);
  const [newEqUsage, setNewEqUsage] = useState(8);
  const [newEqLoad, setNewEqLoad] = useState('Medium');
  const [newEqStartDate, setNewEqStartDate] = useState('');
  const [newEqCycleCount, setNewEqCycleCount] = useState(0);
  const [newEqDailyCycles, setNewEqDailyCycles] = useState(24);
  const [initialFile, setInitialFile] = useState<File | null>(null);

  useEffect(() => {
    const loadPageData = async () => {
      const { data } = await supabase.from('equipment_catalog').select('*');
      if (data) setCatalog(data);

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: equipments } = await supabase
        .from('user_equipments')
        .select('specifications')
        .eq('user_id', user.id);

      const categories = Array.from(
        new Set(
          (equipments || [])
            .map((item: any) => item?.specifications?.asset_category)
            .filter((value: string | undefined) => !!value && value.trim().length > 0)
        )
      ) as string[];

      setExistingCategories(categories);
      if (categories.length > 0) {
        setSelectedExistingCategory(categories[0]);
      } else {
        setCategoryMode('new');
      }
    };
    loadPageData();
  }, []);

  const handleAddEquipment = async () => {
    if (!newEqName) return alert('Please enter a name.');
    if (!newEqLocation) return alert('Please enter a location.');
    const finalCategory = categoryMode === 'existing' ? selectedExistingCategory : newEqCategory.trim();
    if (!finalCategory) return alert('Please select or enter a category.');

    setLoading(true);
    const loadFactor = newEqLoad === 'Heavy' ? 0.8 : newEqLoad === 'Light' ? 1.2 : 1.0;
    const effectiveCycles = Math.max(0, newEqCycleCount);
    const adjustedHealth = Math.max(0, Math.min(100, Math.round(newEqBattery - effectiveCycles / 50)));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('user_equipments').insert([{
        user_id: user.id,
        custom_name: newEqName,
        custom_type: selectedCatalogId ? null : newEqType,
        custom_brand: selectedCatalogId ? null : newEqBrand,
        catalog_id: selectedCatalogId || null,
        location: newEqLocation,
        health_pct: adjustedHealth,
        status: adjustedHealth > 70 ? 'Healthy' : adjustedHealth > 30 ? 'Warning' : 'Critical',
        rul_cycles: Math.max(0, Math.floor((newEqBattery * 1.5 * loadFactor) - (effectiveCycles * 0.15))),
        last_maintenance_date: newEqStartDate || null,
        specifications: {
          asset_category: finalCategory,
          commissioned_on: newEqStartDate || null,
          cycles_completed: effectiveCycles,
          cycles_per_day: newEqDailyCycles,
          max_temp: newEqTemp,
          current_temperature: newEqCurrentTemp,
          current_vibration: newEqCurrentVibration,
          current_rpm: newEqCurrentRpm,
          initial_battery: newEqBattery,
          usage_hours_per_day: newEqUsage,
          load_intensity: newEqLoad
        }
      }]).select('id');

      if (error) throw error;

      if (initialFile && data?.[0]?.id) {
        const fd = new FormData();
        fd.append('file', initialFile);
        await axios.post(`http://localhost:8000/api/machines/${data[0].id}/upload`, fd);
      }

      navigate('/dashboard');
    } catch (e) {
      console.error(e);
      alert('Registration failed.');
    }

    setLoading(false);
  };

  return (
    <div className="px-12 py-10 max-w-5xl mx-auto animate-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-4xl font-extrabold text-white mb-2">Add New Equipment</h2>
          <p className="text-gray-400 text-[15px]">Register a machine with operating profile, wear history, and seed telemetry.</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-ink-3 border border-border rounded-lg text-sm text-gray-300 hover:bg-white/5">
          Back to Dashboard
        </button>
      </div>

      <div className="card border-teal/20">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Equipment Name</label>
            <input type="text" value={newEqName} onChange={e => setNewEqName(e.target.value)} placeholder="e.g. Conveyor-A4" className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal transition-all" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Location</label>
            <input type="text" value={newEqLocation} onChange={e => setNewEqLocation(e.target.value)} placeholder="e.g. Floor 2 - Line B" className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Catalog Model</label>
            <select value={selectedCatalogId} onChange={e => setSelectedCatalogId(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
              <option value="">Custom equipment</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>{item.brand} - {item.model_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Equipment Type</label>
            <select value={newEqType} onChange={e => setNewEqType(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" disabled={!!selectedCatalogId}>
              <option>Motor</option><option>Pump</option><option>HVAC</option><option>Conveyor</option><option>Compressor</option><option>Cooling</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Brand</label>
            <select value={newEqBrand} onChange={e => setNewEqBrand(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" disabled={!!selectedCatalogId}>
              <option>Generic</option><option>Siemens</option><option>ABB</option><option>GE</option><option>Schneider</option><option>Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Category Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategoryMode('existing')}
                className={`flex-1 rounded-xl px-3 py-2.5 border text-xs font-semibold ${
                  categoryMode === 'existing' ? 'bg-teal text-ink border-teal' : 'bg-ink border-border text-gray-300'
                }`}
              >
                Existing
              </button>
              <button
                type="button"
                onClick={() => setCategoryMode('new')}
                className={`flex-1 rounded-xl px-3 py-2.5 border text-xs font-semibold ${
                  categoryMode === 'new' ? 'bg-teal text-ink border-teal' : 'bg-ink border-border text-gray-300'
                }`}
              >
                New
              </button>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">
              {categoryMode === 'existing' ? 'Existing Category' : 'New Category'}
            </label>
            {categoryMode === 'existing' ? (
              <select
                value={selectedExistingCategory}
                onChange={e => setSelectedExistingCategory(e.target.value)}
                className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none"
                disabled={existingCategories.length === 0}
              >
                {existingCategories.length === 0 ? (
                  <option value="">No existing categories</option>
                ) : (
                  existingCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))
                )}
              </select>
            ) : (
              <input
                type="text"
                value={newEqCategory}
                onChange={e => setNewEqCategory(e.target.value)}
                placeholder="e.g. Downstairs, Bathroom, Block A, Production Line 2"
                className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none"
              />
            )}
          </div>
          <div className="col-span-3 flex items-end">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Put this machine into an existing group or create a new one. Categories are used to organize multiple machines together in the Asset Directory.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Start Using Date</label>
            <input type="date" value={newEqStartDate} onChange={e => setNewEqStartDate(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Duty Cycle (H/D)</label>
            <input type="number" value={newEqUsage} onChange={e => setNewEqUsage(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Load Level</label>
            <select value={newEqLoad} onChange={e => setNewEqLoad(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
              <option>Light</option><option>Medium</option><option>Heavy</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycles Completed</label>
            <input type="number" min="0" value={newEqCycleCount} onChange={e => setNewEqCycleCount(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycles / Day</label>
            <input type="number" min="0" value={newEqDailyCycles} onChange={e => setNewEqDailyCycles(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Starting Health %</label>
            <input type="number" min="0" max="100" value={newEqBattery} onChange={e => setNewEqBattery(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Max Temp Threshold</label>
            <input type="number" value={newEqTemp} onChange={e => setNewEqTemp(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
        </div>

        <div className="mb-6">
          <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-3">Current Operating Readings</div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Temperature</label>
              <input type="number" step="0.1" value={newEqCurrentTemp} onChange={e => setNewEqCurrentTemp(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
            </div>
            <div>
              <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Vibration</label>
              <input type="number" step="0.01" value={newEqCurrentVibration} onChange={e => setNewEqCurrentVibration(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
            </div>
            <div>
              <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">RPM</label>
              <input type="number" value={newEqCurrentRpm} onChange={e => setNewEqCurrentRpm(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
            </div>
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
  );
}
