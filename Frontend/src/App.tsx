import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Activity, Database, LayoutDashboard, Search, Settings, LogOut, User } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import PredictRUL from './pages/PredictRUL';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import AddEquipment from './pages/AddEquipment';
import EditEquipment from './pages/EditEquipment';

function Nav({ session }: { session: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    fetch('http://localhost:8000/api/machines')
      .then(res => setApiStatus(res.ok ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'));
  }, [location]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 h-16 bg-ink/85 backdrop-blur-md border-b border-border">
      <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-white tracking-tight">
        <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center text-ink">
          <Activity size={18} />
        </div>
        MaintAi
      </Link>
      
      <ul className="flex items-center gap-1.5 list-none">
        {[
          { path: '/', label: 'Home' },
          { path: '/dashboard', label: 'Dashboard' },
          { path: '/add-equipment', label: 'Add Equipment' },
          { path: '/predict', label: 'Predict RUL' },
          { path: '/about', label: 'How It Works' }
        ].map(item => (
          <li key={item.path}>
            <Link 
              to={item.path}
              className={`px-3.5 py-1.5 rounded-md text-[13.5px] transition-colors ${
                location.pathname === item.path 
                  ? 'text-teal font-medium' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      
      <div className="flex items-center gap-4">
        {session ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-mono text-teal bg-teal/5 border border-teal/20 px-3 py-1.5 rounded-full">
              <User size={14} />
              {session.user.email}
            </span>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <Link to="/login" className="px-5 py-2 bg-white text-ink border-none rounded-lg text-ink font-body text-[13.5px] font-semibold hover:bg-gray-200 transition-all">
            Sign In &rarr;
          </Link>
        )}
      </div>
    </nav>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink-2 border-t border-border px-12 py-10 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div>
          <div className="font-display text-[15px] font-bold text-white">MaintAi</div>
          <div className="text-[12.5px] text-gray-500 mt-1">Predictive Maintenance for ASEAN SMEs</div>
          <div className="text-[11px] text-gray-600 mt-2">Copyright © {year} MaintAi. Built by Team DouKeyi.</div>
          <a href="mailto:evin8917@gmail.com" className="text-[11px] text-teal mt-1 inline-block hover:underline">
            evin8917@gmail.com
          </a>
        </div>
      </div>
      <div className="font-mono text-[11.5px] text-gray-500 text-right">
        <div className="text-teal">SDG 9 · Industry, Innovation & Infrastructure</div>
        <div className="mt-1">NASA CMAPSS · XGBoost · FastAPI · Target 9.4</div>
      </div>
    </footer>
  );
}

function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-ink text-gray-300 font-body">
        <Nav session={session} />
        <main className="pt-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/add-equipment" element={session ? <AddEquipment /> : <Navigate to="/login" />} />
            <Route path="/equipment/:id/edit" element={session ? <EditEquipment /> : <Navigate to="/login" />} />
            <Route path="/predict" element={session ? <PredictRUL /> : <Navigate to="/login" />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
