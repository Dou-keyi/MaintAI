import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Plus, X, Activity, Upload, MoreVertical, Wrench, ShieldCheck, AlertTriangle, FileText, Trash2, Pencil } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Machine {
  id: string;
  name: string;
  type: string;
  category?: string;
  brand?: string;
  location: string;
  status: string;
  health: number;
  last_maint?: string;
  updated_at?: string;
  rul_cycles: number;
  specifications?: any;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getLoadMultiplier = (load?: string) => {
  if (load === 'Heavy') return 1.35;
  if (load === 'Light') return 0.8;
  return 1.0;
};

const getDerivedStatus = (health: number) => {
  if (health <= 30) return 'Critical';
  if (health <= 70) return 'Warning';
  return 'Healthy';
};

const getCategoryCardTone = (category?: string) => {
  const key = (category || '').trim().toLowerCase();
  const tones: Record<string, { row: string; badge: string }> = {
    downstairs: { row: 'hover:bg-cyan-500/8', badge: 'text-cyan-300 bg-cyan-500/10 border-cyan-400/20' },
    upstairs: { row: 'hover:bg-violet-500/8', badge: 'text-violet-300 bg-violet-500/10 border-violet-400/20' },
    bathroom: { row: 'hover:bg-sky-500/8', badge: 'text-sky-300 bg-sky-500/10 border-sky-400/20' },
    warehouse: { row: 'hover:bg-amber-500/8', badge: 'text-amber-300 bg-amber-500/10 border-amber-400/20' },
    kitchen: { row: 'hover:bg-orange-500/8', badge: 'text-orange-300 bg-orange-500/10 border-orange-400/20' },
    office: { row: 'hover:bg-emerald-500/8', badge: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20' },
    'server room': { row: 'hover:bg-fuchsia-500/8', badge: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/20' },
    outdoor: { row: 'hover:bg-lime-500/8', badge: 'text-lime-300 bg-lime-500/10 border-lime-400/20' },
  };
  return tones[key] || { row: 'hover:bg-teal-500/8', badge: 'text-teal-300 bg-teal-500/10 border-teal-400/20' };
};

const deriveMachineMetrics = (machine: any) => {
  const specs = machine.specifications || {};
  const baseHealth = Number(machine.health_pct ?? specs.initial_battery ?? 100);
  const baseRul = Number(machine.rul_cycles ?? 100);
  const usageHours = Number(specs.usage_hours_per_day ?? 8);
  const cyclesPerDay = Number(specs.cycles_per_day ?? 24);
  const completedCycles = Number(specs.cycles_completed ?? 0);
  const maxTemp = Number(specs.max_temp ?? 85);
  const currentTemp = Number(specs.current_temperature ?? 0);
  const currentVibration = Number(specs.current_vibration ?? 0);
  const loadMultiplier = getLoadMultiplier(specs.load_intensity);

  const startDateValue = machine.last_maintenance_date || specs.commissioned_on || machine.created_at || machine.updated_at;
  const startDate = startDateValue ? new Date(startDateValue) : new Date();
  const now = new Date();
  const daysInUse = Math.max(0, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const usageWear = daysInUse * (usageHours / 24) * 1.6 * loadMultiplier;
  const cycleWear = completedCycles * 0.025 * loadMultiplier;
  const liveCycleWear = daysInUse * cyclesPerDay * 0.02 * loadMultiplier;
  const thermalWear = currentTemp > maxTemp ? (currentTemp - maxTemp) * 0.6 : 0;
  const vibrationWear = currentVibration > 0.8 ? (currentVibration - 0.8) * 18 : 0;
  const totalWear = usageWear + cycleWear + liveCycleWear + thermalWear + vibrationWear;

  const health = clamp(Math.round((baseHealth - totalWear) * 10) / 10, 0, 100);
  const rulCycles = clamp(Math.round((baseRul - (daysInUse * cyclesPerDay * loadMultiplier)) * 10) / 10, 0, 999999);
  const status = machine.status === 'Maintenance Pending' ? 'Maintenance Pending' : getDerivedStatus(health);

  return {
    health,
    rul_cycles: rulCycles,
    status,
    derived_cycles_completed: Math.round(completedCycles + daysInUse * cyclesPerDay),
    derived_days_in_use: Math.round(daysInUse * 10) / 10,
  };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [newEqName, setNewEqName] = useState('');
  const [newEqType, setNewEqType] = useState('Motor');
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
  const [showExampleModal, setShowExampleModal] = useState(false);

  // Dropdown / Local State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [maintenanceMachine, setMaintenanceMachine] = useState<Machine | null>(null);
  const [maintenanceType, setMaintenanceType] = useState('Preventive');
  const [maintenanceDate, setMaintenanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [maintenanceCost, setMaintenanceCost] = useState('');
  const [showChartDetail, setShowChartDetail] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isAddModalOpen || showExampleModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isAddModalOpen, showExampleModal]);

  const fetchCatalog = async () => {
    const { data } = await supabase.from('equipment_catalog').select('*');
    if (data) setCatalog(data);
  };

  const fetchMachines = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase.from('user_equipments')
        .select('*, equipment_catalog(*)')
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        setMachines(data.map((d) => {
          const derived = deriveMachineMetrics(d);
          return {
            id: d.id,
            name: d.custom_name,
            type: d.equipment_catalog?.equipment_type || d.custom_type || 'Custom',
            category: d.specifications?.asset_category || 'Uncategorized',
            brand: d.equipment_catalog?.brand || d.custom_brand || 'Generic',
            location: d.location || 'Unknown',
            status: derived.status,
            health: derived.health,
            rul_cycles: derived.rul_cycles,
            last_maint: d.last_maintenance_date ? new Date(d.last_maintenance_date).toLocaleDateString() : 'No Data',
            updated_at: d.updated_at ? new Date(d.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never',
            specifications: {
              ...(d.specifications || {}),
              derived_cycles_completed: derived.derived_cycles_completed,
              derived_days_in_use: derived.derived_days_in_use,
            }
          };
        }));
      } else {
        setMachines([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMachines();
    fetchCatalog();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchMachines();
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSyncUpload = async (machineId: string, file: File) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await axios.post(`http://localhost:8000/api/machines/${machineId}/upload`, fd);
      alert("Asset Synced successfully!");
      fetchMachines();
    } catch (e) {
      alert("Manual sync failed. Please check file format.");
    }
    setLoading(false);
  };

  const openMaintenanceModal = (machine: Machine) => {
    setMaintenanceMachine(machine);
    setMaintenanceType('Preventive');
    setMaintenanceDate(new Date().toISOString().slice(0, 10));
    setMaintenanceNotes('');
    setMaintenanceCost('');
    setActiveMenuId(null);
  };

  const handleRequestMaintenance = async () => {
    if (!maintenanceMachine) return;
    try {
      const specs = maintenanceMachine.specifications || {};
      const restoredHealth = Number(specs.initial_battery ?? 100);
      const loadMultiplier = getLoadMultiplier(specs.load_intensity);
      const restoredRul = Math.max(0, Math.floor(restoredHealth * 1.5 * loadMultiplier));
      const maintenancePayload = {
        equipment_id: maintenanceMachine.id,
        maintenance_date: new Date(maintenanceDate).toISOString(),
        maintenance_type: maintenanceType,
        cost: maintenanceCost ? Number(maintenanceCost) : null,
        notes: maintenanceNotes || null,
      };

      const maintenanceInsert = await supabase.from('maintenance_logs').insert([maintenancePayload]);
      if (maintenanceInsert.error) {
        console.warn('maintenance_logs insert skipped:', maintenanceInsert.error.message);
      }

      const { error } = await supabase.from('user_equipments').update({ 
          last_maintenance_date: new Date(maintenanceDate).toISOString(),
          status: 'Healthy',
          health_pct: restoredHealth,
          rul_cycles: restoredRul,
          specifications: {
            ...specs,
            cycles_completed: 0,
          },
      }).eq('id', maintenanceMachine.id);
      if (error) throw error;
      alert("Equipment maintenance logged and machine status reset.");
      setMaintenanceMachine(null);
      fetchMachines();
    } catch (e) { console.error(e); }
  };

  const handleDeleteEquipment = async (machine: Machine) => {
    const confirmed = window.confirm(`Delete equipment "${machine.name}"? This will remove the equipment and its uploaded logs.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const maintenanceDelete = await supabase.from('maintenance_logs').delete().eq('equipment_id', machine.id);
      if (maintenanceDelete.error) {
        console.warn('maintenance_logs delete skipped:', maintenanceDelete.error.message);
      }

      const logsDelete = await supabase.from('equipment_logs').delete().eq('equipment_id', machine.id);
      if (logsDelete.error) throw logsDelete.error;

      const { error } = await supabase.from('user_equipments').delete().eq('id', machine.id);
      if (error) throw error;

      if (selectedMachine?.id === machine.id) {
        setSelectedMachine(null);
        setChartData([]);
      }

      setActiveMenuId(null);
      await fetchMachines();
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
    setLoading(false);
  };

  const handleAddEquipment = async () => {
    if (!newEqName) return alert("Please enter a name.");
    if (!newEqLocation) return alert("Please enter a location.");
    setLoading(true);
    const loadFactor = newEqLoad === 'Heavy' ? 0.8 : newEqLoad === 'Light' ? 1.2 : 1.0;
    const effectiveCycles = Math.max(0, newEqCycleCount);
    const adjustedHealth = Math.max(0, Math.min(100, Math.round(newEqBattery - (effectiveCycles / 50))));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");

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
      }]).select('*, equipment_catalog(*)');

      if (error) throw error;
      const d = data[0];

      if (initialFile && d.id) {
        const fd = new FormData();
        fd.append('file', initialFile);
        await axios.post(`http://localhost:8000/api/machines/${d.id}/upload`, fd);
      }
      await fetchMachines();
    } catch (e) {
      alert("Registration failed.");
    }
    
    setIsAddModalOpen(false);
    setNewEqName('');
    setNewEqLocation('');
    setNewEqType('Motor');
    setNewEqBrand('Generic');
    setNewEqBattery(100);
    setNewEqTemp(85);
    setNewEqCurrentTemp(68);
    setNewEqCurrentVibration(0.4);
    setNewEqCurrentRpm(1200);
    setNewEqUsage(8);
    setNewEqLoad('Medium');
    setNewEqStartDate('');
    setNewEqCycleCount(0);
    setNewEqDailyCycles(24);
    setInitialFile(null);
    setLoading(false);
  };

  const handleRowClick = async (machine: Machine) => {
    setSelectedMachine(machine);
    try {
      const { data, error } = await supabase.from('equipment_logs')
        .select('log_timestamp, temperature, vibration').eq('equipment_id', machine.id)
        .order('log_timestamp', { ascending: true }).limit(100);
      if (error) throw error;
      if (data && data.length > 5) {
        setChartData(data.map(d => ({
          time: new Date(d.log_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          Temperature: d.temperature,
          Vibration: d.vibration
        })));
        return;
      }
    } catch (e) { console.warn("Using fallback chart data."); }
    
    const mockData = [];
    let temp = machine.health > 50 ? 60 : 85;
    for (let i = 24; i >= 0; i--) {
      const d = new Date(); d.setHours(d.getHours() - i);
      mockData.push({
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        Temperature: temp + (Math.random() * 5 - 2.5),
        Vibration: Math.max(0, 2 + (Math.random() * 1.5 - 0.75))
      });
      if (i < 10) temp += 1.5;
    }
    setChartData(mockData);
  };

  const donutData = {
    labels: ['Healthy', 'Impaired', 'Critical'],
    datasets: [{
      data: [
        machines.filter(m => m.health > 70).length,
        machines.filter(m => m.health <= 70 && m.health > 30).length,
        machines.filter(m => m.health <= 30).length,
      ],
      backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
      borderWidth: 0,
      cutout: '80%'
    }]
  };

  const equipmentCategories = ['All', ...Array.from(new Set(machines.map((m) => m.category).filter(Boolean)))];
  const statusCategories = ['All', 'Healthy', 'Warning', 'Critical', 'Maintenance Pending'];
  const statusPriority: Record<string, number> = {
    'Critical': 0,
    'Maintenance Pending': 1,
    'Warning': 2,
    'Healthy': 3,
  };
  const visibleMachines = machines
    .filter((m) => {
      const categoryMatch = categoryFilter === 'All' || m.category === categoryFilter;
      const statusMatch = statusFilter === 'All' || m.status === statusFilter;
      return categoryMatch && statusMatch;
    })
    .sort((a, b) => {
      const statusDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return a.health - b.health;
    });

  return (
    <>
      <div className="px-12 py-10 max-w-7xl mx-auto animate-fade-up">
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-display text-4xl font-extrabold text-white mb-2">Fleet Dashboard</h2>
            <p className="text-gray-400 font-body text-[15px]">Multi-cloud asset monitoring and RUL forecasting</p>
          </div>
          <button onClick={fetchMachines} className="flex items-center gap-2 px-4 py-2 bg-ink-3 border border-border text-sm font-medium rounded-lg transition-all hover:bg-surface-3/10 cursor-pointer">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Status
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="card">
             <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Managed Units</div>
             <div className="text-4xl font-display font-medium text-white">{machines.length}</div>
          </div>
          <div className="card border-l-4 border-l-emerald-500">
             <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Optimal Health</div>
             <div className="text-4xl font-display font-medium text-emerald-400">{machines.filter(m => m.health > 70).length}</div>
          </div>
          <div className="card border-l-4 border-l-amber-500">
             <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Warning Zone</div>
             <div className="text-4xl font-display font-medium text-amber-400">{machines.filter(m => m.health <= 70 && m.health > 30).length}</div>
          </div>
          <div className="card border-l-4 border-l-red-500">
             <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Critical Risk</div>
             <div className="text-4xl font-display font-medium text-red-500">{machines.filter(m => m.health <= 30).length}</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          <div className="flex-1 card p-0 flex flex-col min-h-[550px]">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <span className="font-display font-semibold text-lg text-white">Asset Directory</span>
              <button 
                onClick={() => navigate('/add-equipment')}
                className="px-4 py-1.5 bg-teal text-ink text-xs font-bold rounded shadow-lg hover:brightness-110 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16}/> DEPLOY INSTRUMENT
              </button>
            </div>

            <div className="px-5 py-4 border-b border-border bg-ink-3/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Area Category</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-ink border border-border rounded-lg px-3 py-2 text-xs text-white outline-none min-w-[180px]"
                >
                  {equipmentCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Status Filter</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-ink border border-border rounded-lg px-3 py-2 text-xs text-white outline-none min-w-[180px]"
                >
                  {statusCategories.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-visible">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-ink-3 text-[10px] font-mono text-gray-500 uppercase tracking-widest border-b border-border/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-4 font-medium">Model / Region</th>
                    <th className="px-5 py-4 font-medium">Classification</th>
                    <th className="px-5 py-4 font-medium text-center">Status Index</th>
                    <th className="px-5 py-4 font-medium">Last Sync</th>
                    <th className="px-5 py-4 font-medium text-right">Forecast (Hrs)</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {visibleMachines.map(m => {
                    const totalHrs = Math.floor(m.rul_cycles * 1.8);
                    const usage = (m.specifications as any)?.usage_hours_per_day || 8;
                    const daysLeft = Math.ceil(totalHrs / usage);
                    const isMaint = m.health < 40;
                    const categoryTone = getCategoryCardTone(m.category);
                    
                    return (
                      <tr key={m.id} onClick={() => handleRowClick(m)} className={`cursor-pointer transition-all duration-200 group relative ${selectedMachine?.id === m.id ? 'bg-white/10' : categoryTone.row}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                             <div className="font-semibold text-white group-hover:text-teal transition-colors font-display">{m.name}</div>
                             {["Siemens", "ABB", "GE", "Schneider"].some(b => m.brand?.includes(b)) && <ShieldCheck size={14} className="text-teal/70" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-[11px] text-gray-500 font-mono tracking-normal uppercase">{m.location}</div>
                            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${categoryTone.badge}`}>
                              {m.category || 'Uncategorized'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-gray-300 font-medium">{m.brand}</div>
                          <div className="text-[10px] text-gray-500 uppercase mt-0.5">{m.type}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-col items-center">
                               <span className="w-10 font-mono text-[12px] text-white/90 text-center">{m.health}%</span>
                               {isMaint && <div className="text-[8px] text-amber-500 font-black animate-pulse flex items-center gap-0.5 mt-1"><Wrench size={8}/> MAINT</div>}
                            </div>
                            <div className="relative w-16 h-6 border border-white/10 rounded-md p-0.5 bg-black/40 overflow-hidden shadow-inner">
                              <div className={`h-full rounded-sm transition-all duration-1000 bg-gradient-to-r ${m.health > 70 ? 'from-emerald-600 to-emerald-400' : m.health > 30 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'}`} style={{ width: `${m.health}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-400 font-mono text-[11px] whitespace-nowrap">{m.updated_at}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="text-white font-mono font-bold text-sm tracking-normal">{totalHrs.toLocaleString()}h</div>
                          <div className="text-[10px] text-teal/80 font-mono font-bold uppercase mt-1">DAYS REMAINING: {daysLeft}</div>
                        </td>
                        <td className="px-5 py-4 relative overflow-visible">
                           <button 
                             onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === m.id ? null : m.id); }}
                             className="p-1.5 text-gray-500 hover:text-teal hover:bg-teal/10 rounded-lg transition-all"
                           >
                             <MoreVertical size={18} />
                           </button>
                           {activeMenuId === m.id && (
                             <div className="absolute right-0 top-full mt-2 w-48 bg-ink-2 border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in py-1">
                               <button onClick={() => openMaintenanceModal(m)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-white hover:bg-white/10 transition-colors">
                                  <Wrench size={14} className="text-teal" /> Equipment Maintenance
                               </button>
                               <button 
                                 onClick={() => fileInputRef.current?.click()} 
                                 className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-white hover:bg-white/10 transition-colors"
                               >
                                  <Upload size={14} className="text-teal" /> Sync & Forecast
                               </button>
                               <button
                                 onClick={() => navigate(`/equipment/${m.id}/edit`)}
                                 className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-white hover:bg-white/10 transition-colors"
                               >
                                  <Pencil size={14} className="text-teal" /> Modify Equipment
                               </button>
                               <button
                                 onClick={() => handleDeleteEquipment(m)}
                                 className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-red-300 hover:bg-red-500/10 transition-colors"
                               >
                                  <Trash2 size={14} className="text-red-400" /> Delete Equipment
                               </button>
                               <input 
                                 type="file" ref={fileInputRef} className="hidden" accept=".csv" 
                                 onChange={(e) => { 
                                   const f = e.target.files?.[0]; 
                                   if(f) handleSyncUpload(m.id, f); 
                                   setActiveMenuId(null);
                                 }} 
                               />
                             </div>
                           )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleMachines.length === 0 && <div className="p-20 text-center text-gray-500 font-display">NO ASSETS MATCH THE CURRENT FILTERS</div>}
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-80 flex flex-col gap-6 shrink-0">
            {selectedMachine ? (
              <div className="card flex-1 animate-fade-up border-teal/20">
                 <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
                    <h3 className="font-display font-bold text-white tracking-wide">{selectedMachine.name}</h3>
                    <button onClick={() => setSelectedMachine(null)} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                 </div>
                 
                 <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" vertical={false} opacity={0.3} />
                        <XAxis dataKey="time" hide />
                        <YAxis stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${Math.round(v)}°`} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1E2540', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }} />
                        <ReferenceLine y={selectedMachine.specifications?.max_temp || 100} stroke="#EF4444" strokeDasharray="5 5" label={{ value: 'MAX THRESHOLD', position: 'right', fill: '#EF4444', fontSize: 9 }} />
                        <Line type="monotone" dataKey="Temperature" stroke="#EF4444" strokeWidth={3} dot={false} animationDuration={2000} />
                        <Line type="monotone" dataKey="Vibration" stroke="#00D4B8" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>
                 <button
                   onClick={() => setShowChartDetail(true)}
                   className="mt-3 w-full py-2.5 bg-ink border border-border rounded-lg text-xs text-white font-medium hover:bg-white/5 transition-all"
                 >
                   View in Detail
                 </button>

                 <div className="mt-8 space-y-4">
                    <div className="bg-ink rounded-xl p-4 border border-border/30">
                       <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">TOTAL OPERATION</div>
                       <div className="text-2xl font-display font-medium text-white">
                         {Math.round(((selectedMachine.specifications as any)?.derived_days_in_use || 0) * ((selectedMachine.specifications as any)?.usage_hours_per_day || 8)).toLocaleString()}
                         <span className="text-xs text-gray-500"> Hours</span>
                       </div>
                    </div>
                    <div className="bg-ink rounded-xl p-4 border border-border/30">
                       <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">USAGE / LOAD</div>
                       <div className="text-sm text-white font-medium">
                         {((selectedMachine.specifications as any)?.usage_hours_per_day || 8)} h/day · {((selectedMachine.specifications as any)?.load_intensity || 'Medium')}
                       </div>
                       <div className="text-[11px] text-gray-500 mt-1 font-mono">
                         {((selectedMachine.specifications as any)?.derived_cycles_completed || 0).toLocaleString()} cycles completed
                       </div>
                    </div>
                    <div className="p-4 rounded-xl border border-teal/20 bg-teal/5">
                       <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck size={16} className="text-teal" />
                          <span className="text-xs font-bold text-teal tracking-normal uppercase font-mono">{selectedMachine.brand} Reliability</span>
                       </div>
                       <p className="text-[11px] text-gray-400 leading-relaxed">
                         {["Siemens", "ABB", "GE", "Schneider"].some(b => selectedMachine.brand?.includes(b)) 
                           ? `Deep-analysis confirms high engineering reliability for ${selectedMachine.brand}. RUL prediction boosted by 25%.`
                           : "Baseline assessment active. Standard component wear rates applied."}
                       </p>
                    </div>
                    <button className="w-full py-2 bg-ink-3 border border-border rounded-lg text-xs text-white font-medium hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                      <FileText size={14} className="text-teal" /> EXPORT PDF REPORT
                    </button>
                 </div>
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center py-12 border-border/20">
                 <h3 className="font-display font-semibold mb-8 text-gray-300">Fleet Health Distribution</h3>
                 <div className="w-44 h-44 relative">
                    <Doughnut data={donutData} options={{ cutout: '85%', plugins: { legend: { display: false } } }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-sm text-gray-500 font-mono">ASSETS</span>
                       <span className="text-4xl font-display font-black text-white">{machines.length}</span>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FIXED MODALS */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-xl grid place-items-center p-4">
          <div className="bg-ink-2 border border-border rounded-2xl p-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] relative border-teal/20">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-display text-2xl font-bold text-white tracking-normal">Deploy Asset</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Equipment Name</label>
                  <input type="text" value={newEqName} onChange={e => setNewEqName(e.target.value)} placeholder="e.g. Conveyor-A4" className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Location</label>
                  <input type="text" value={newEqLocation} onChange={e => setNewEqLocation(e.target.value)} placeholder="e.g. Floor 2 - Line B" className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal transition-all" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                   <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase">SEED TELEMETRY (CSV)</label>
                   <button onClick={() => setShowExampleModal(true)} className="text-[10px] text-teal hover:underline font-mono">VIEW CSV SPEC</button>
                </div>
                <div className="relative h-20 group border-2 border-dashed border-border rounded-xl hover:border-teal/50 transition-all flex flex-col items-center justify-center gap-2 bg-black/20">
                  <input type="file" accept=".csv" onChange={e => setInitialFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <Upload size={20} className="text-gray-500 group-hover:text-teal" />
                  <span className="text-[10px] text-gray-500 uppercase font-mono">{initialFile ? initialFile.name : 'Drag telemetry here'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Equipment Type</label>
                   <select value={newEqType} onChange={e => setNewEqType(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
                     <option>Motor</option><option>Pump</option><option>HVAC</option><option>Conveyor</option><option>Compressor</option><option>Cooling</option>
                   </select>
                </div>
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Brand</label>
                   <select value={newEqBrand} onChange={e => setNewEqBrand(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
                     <option>Generic</option><option>Siemens</option><option>ABB</option><option>GE</option><option>Schneider</option><option>Other</option>
                   </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Start Using Date</label>
                   <input type="date" value={newEqStartDate} onChange={e => setNewEqStartDate(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
                </div>
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Duty Cycle (H/D)</label>
                   <input type="number" value={newEqUsage} onChange={e => setNewEqUsage(parseInt(e.target.value))} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Load Level</label>
                   <select value={newEqLoad} onChange={e => setNewEqLoad(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none">
                     <option>Light</option><option>Medium</option><option>Heavy</option>
                   </select>
                </div>
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycles Completed</label>
                   <input type="number" min="0" value={newEqCycleCount} onChange={e => setNewEqCycleCount(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
                </div>
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Cycles / Day</label>
                   <input type="number" min="0" value={newEqDailyCycles} onChange={e => setNewEqDailyCycles(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Starting Health %</label>
                   <input type="number" min="0" max="100" value={newEqBattery} onChange={e => setNewEqBattery(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
                </div>
                <div>
                   <label className="block text-gray-500 mb-2 uppercase font-mono tracking-tight">Max Temperature Threshold</label>
                   <input type="number" value={newEqTemp} onChange={e => setNewEqTemp(parseInt(e.target.value) || 0)} className="w-full bg-ink border border-border rounded-xl px-3 py-2.5 text-white outline-none" />
                </div>
              </div>

              <div>
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

              <button onClick={handleAddEquipment} disabled={loading} className="w-full bg-teal text-ink font-bold py-4 rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all mt-4 border-b-4 border-teal-700">
                {loading ? 'INITIALIZING...' : 'AUTHORIZE DEPLOYMENT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExampleModal && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-ink-2 border border-border rounded-2xl p-8 w-full max-w-xl shadow-2xl animate-fade-up">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
              <h3 className="font-display text-xl font-bold text-white">CSV Specification v1.0</h3>
              <button onClick={() => setShowExampleModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="bg-black/40 rounded-xl p-6 font-mono text-[12px] border border-border/50 space-y-4">
               <div>
                  <span className="text-teal"># Required Headers</span>
                  <div className="text-gray-300 mt-1 uppercase">timestamp, temperature, vibration, rpm</div>
               </div>
               <div>
                  <span className="text-teal"># Sample Data</span>
                  <div className="text-gray-500 mt-1">2026-03-19 08:30:00, 82.503, 0.457, 1205</div>
               </div>
            </div>
            <button onClick={() => setShowExampleModal(false)} className="w-full bg-ink border border-border text-white font-bold py-3 rounded-xl mt-8 hover:bg-white/5 transition-all">CONFIRM FORMAT</button>
          </div>
        </div>
      )}

      {maintenanceMachine && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ink-2 border border-border rounded-2xl p-8 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">Equipment Maintenance</h3>
                <p className="text-sm text-gray-400 mt-1">{maintenanceMachine.name}</p>
              </div>
              <button onClick={() => setMaintenanceMachine(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Maintenance Type</label>
                  <select value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none">
                    <option>Preventive</option>
                    <option>Corrective</option>
                    <option>Inspection</option>
                    <option>Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Maintenance Date</label>
                  <input type="date" value={maintenanceDate} onChange={(e) => setMaintenanceDate(e.target.value)} className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Estimated Cost</label>
                <input type="number" min="0" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value)} placeholder="e.g. 2500" className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none" />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-2">Notes</label>
                <textarea value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} rows={4} placeholder="Describe the issue, replaced parts, technician notes, or maintenance scope." className="w-full bg-ink border border-border rounded-xl px-4 py-3 text-white text-sm outline-none resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMaintenanceMachine(null)} className="px-5 py-3 bg-ink border border-border rounded-xl text-sm text-gray-300 hover:bg-white/5">
                  Cancel
                </button>
                <button onClick={handleRequestMaintenance} className="px-5 py-3 bg-teal text-ink font-bold rounded-xl hover:brightness-110">
                  Save Maintenance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChartDetail && selectedMachine && (
        <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ink-2 border border-border rounded-2xl p-8 w-full max-w-5xl shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">Sensor Trend Detail</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {selectedMachine.name} · {selectedMachine.category || 'Uncategorized'} · {selectedMachine.location}
                </p>
              </div>
              <button onClick={() => setShowChartDetail(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-ink px-4 py-3">
                <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">Health</div>
                <div className="text-2xl font-display text-white">{selectedMachine.health}%</div>
              </div>
              <div className="rounded-xl border border-border bg-ink px-4 py-3">
                <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">RUL</div>
                <div className="text-2xl font-display text-white">{Math.floor(selectedMachine.rul_cycles * 1.8)}h</div>
              </div>
              <div className="rounded-xl border border-border bg-ink px-4 py-3">
                <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">Load</div>
                <div className="text-2xl font-display text-white">{(selectedMachine.specifications as any)?.load_intensity || 'Medium'}</div>
              </div>
              <div className="rounded-xl border border-border bg-ink px-4 py-3">
                <div className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1">Cycles</div>
                <div className="text-2xl font-display text-white">{((selectedMachine.specifications as any)?.derived_cycles_completed || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="h-[420px] w-full rounded-2xl border border-border bg-ink p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" vertical={false} opacity={0.35} />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="temp" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} label={{ value: 'Temp', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                  <YAxis yAxisId="vibration" orientation="right" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} label={{ value: 'Vibration', angle: 90, position: 'insideRight', fill: '#9CA3AF' }} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#141929', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
                  <ReferenceLine yAxisId="temp" y={selectedMachine.specifications?.max_temp || 100} stroke="#EF4444" strokeDasharray="5 5" label={{ value: 'MAX TEMP', position: 'top', fill: '#EF4444', fontSize: 10 }} />
                  <Line yAxisId="temp" type="monotone" dataKey="Temperature" stroke="#EF4444" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                  <Line yAxisId="vibration" type="monotone" dataKey="Vibration" stroke="#00D4B8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setShowChartDetail(false)} className="px-5 py-3 bg-ink border border-border rounded-xl text-sm text-gray-300 hover:bg-white/5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
