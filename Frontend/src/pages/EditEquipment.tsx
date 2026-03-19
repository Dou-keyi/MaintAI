import React, { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../lib/supabase';

export default function EditEquipment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [selectedExistingCategory, setSelectedExistingCategory] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [loadLevel, setLoadLevel] = useState('Medium');
  const [currentTemp, setCurrentTemp] = useState(68);
  const [currentVibration, setCurrentVibration] = useState(0.4);
  const [currentRpm, setCurrentRpm] = useState(1200);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [cyclesPerDay, setCyclesPerDay] = useState(24);
  const [usageHours, setUsageHours] = useState(8);
  const [maxTemp, setMaxTemp] = useState(85);
  const [logFile, setLogFile] = useState<File | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        navigate('/login');
        return;
      }

      const [{ data: equipment, error }, { data: categoryRows }] = await Promise.all([
        supabase.from('user_equipments').select('*, equipment_catalog(*)').eq('id', id).eq('user_id', user.id).single(),
        supabase.from('user_equipments').select('specifications').eq('user_id', user.id)
      ]);

      if (error || !equipment) {
        navigate('/dashboard');
        return;
      }

      const specs = equipment.specifications || {};
      const categories = Array.from(
        new Set(
          (categoryRows || [])
            .map((item: any) => item?.specifications?.asset_category)
            .filter((value: string | undefined) => !!value && value.trim().length > 0)
        )
      ) as string[];

      const currentCategory = specs.asset_category || '';
      setExistingCategories(categories);
      setCategory(currentCategory);
      setSelectedExistingCategory(currentCategory || categories[0] || '');
      setCategoryMode(currentCategory && categories.includes(currentCategory) ? 'existing' : 'new');
      setName(equipment.custom_name || '');
      setLocation(equipment.location || '');
      setLoadLevel(specs.load_intensity || 'Medium');
      setCurrentTemp(Number(specs.current_temperature ?? 68));
      setCurrentVibration(Number(specs.current_vibration ?? 0.4));
      setCurrentRpm(Number(specs.current_rpm ?? 1200));
      setCyclesCompleted(Number(specs.cycles_completed ?? 0));
      setCyclesPerDay(Number(specs.cycles_per_day ?? 24));
      setUsageHours(Number(specs.usage_hours_per_day ?? 8));
      setMaxTemp(Number(specs.max_temp ?? 85));
      setPageLoading(false);
    };

    loadData();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!id) return;
    const finalCategory = categoryMode === 'existing' ? selectedExistingCategory : category.trim();
    if (!name.trim()) return alert('Please enter an equipment name.');
    if (!finalCategory) return alert('Please select or enter a category.');

    setLoading(true);
    try {
      const { data: row, error: fetchError } = await supabase.from('user_equipments').select('specifications').eq('id', id).single();
      if (fetchError) throw fetchError;

      const nextSpecifications = {
        ...(row?.specifications || {}),
        asset_category: finalCategory,
        load_intensity: loadLevel,
        current_temperature: currentTemp,
        current_vibration: currentVibration,
        current_rpm: currentRpm,
        cycles_completed: cyclesCompleted,
        cycles_per_day: cyclesPerDay,
        usage_hours_per_day: usageHours,
        max_temp: maxTemp,
      };

      const { error } = await supabase
        .from('user_equipments')
        .update({
          custom_name: name.trim(),
          location: location.trim(),
          specifications: nextSpecifications,
        })
        .eq('id', id);

      if (error) throw error;

      if (logFile) {
        const fd = new FormData();
        fd.append('file', logFile);
        await axios.post(`http://localhost:8000/api/machines/${id}/upload`, fd);
      }

      navigate('/dashboard');
    } catch (e) {
      console.error(e);
      alert('Update failed.');
    }
    setLoading(false);
  };

  if (pageLoading) {
    return <div className="px-12 py-10 max-w-5xl mx-auto text-gray-400">Loading equipment...</div>;
  }

  return (
    <div className="px-12 py-10 max-w-5xl mx-auto animate-fade-up">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-4xl font-extrabold text-white mb-2">Modify Equipment</h2>
          <p className="text-gray-400 text-[15px]">Update the machine profile, workload, live readings, and upload a new telemetry log.</p>
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
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Category Mode</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCategoryMode('existing')} className={`flex-1 rounded-xl px-3 py-2.5 border text-xs font-semibold ${categoryMode === 'existing' ? 'bg-teal text-ink border-teal' : 'bg-ink border-border text-gray-300'}`}>Existing</button>
              <button type="button" onClick={() => setCategoryMode('new')} className={`flex-1 rounded-xl px-3 py-2.5 border text-xs font-semibold ${categoryMode === 'new' ? 'bg-teal text-ink border-teal' : 'bg-ink border-border text-gray-300'}`}>New</button>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">{categoryMode === 'existing' ? 'Existing Category' : 'New Category'}</label>
            {categoryMode === 'existing' ? (
              <select value={selectedExistingCategory} onChange={(e) => setSelectedExistingCategory(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
                {existingCategories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            ) : (
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Downstairs, Bathroom, Warehouse" className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Load Level</label>
            <select value={loadLevel} onChange={(e) => setLoadLevel(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
              <option>Light</option><option>Medium</option><option>Heavy</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Usage Hours / Day</label>
            <input type="number" value={usageHours} onChange={(e) => setUsageHours(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycles Completed</label>
            <input type="number" value={cyclesCompleted} onChange={(e) => setCyclesCompleted(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycles / Day</label>
            <input type="number" value={cyclesPerDay} onChange={(e) => setCyclesPerDay(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 text-xs">
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Current Temp</label>
            <input type="number" step="0.1" value={currentTemp} onChange={(e) => setCurrentTemp(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Current Vibration</label>
            <input type="number" step="0.01" value={currentVibration} onChange={(e) => setCurrentVibration(parseFloat(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Current RPM</label>
            <input type="number" value={currentRpm} onChange={(e) => setCurrentRpm(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
          </div>
          <div>
            <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Max Temp</label>
            <input type="number" value={maxTemp} onChange={(e) => setMaxTemp(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
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
    </div>
  );
}
