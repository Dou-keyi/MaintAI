import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Mail, Lock, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        alert('Check your email for the confirmation link!');
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal flex items-center justify-center text-ink mb-6 shadow-lg shadow-teal/20">
            <Activity size={36} />
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight">MaintAi</h1>
          <p className="text-gray-400 mt-2 font-body italic">Predictive Maintenance. Secured.</p>
        </div>

        <div className="card p-8 bg-ink-2/50 backdrop-blur-xl border-border/80">
          <div className="flex gap-1 p-1 bg-ink rounded-lg mb-8 border border-border/30">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? 'bg-teal text-ink shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              <LogIn size={16} /> Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? 'bg-teal text-ink shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              <UserPlus size={16} /> Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Corporate Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-ink border border-border rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-teal transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Access Key / Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-ink border border-border rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-teal transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 bg-white text-ink font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-white/10"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
              ) : (
                <>Authentication Required &rarr;</>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-border/30 text-center">
            <p className="text-[11px] text-gray-500 uppercase tracking-widest leading-relaxed">
              Industrial Monitoring Node v1.0.4-LTS <br />
              Connected to Supabase Cloud Auth Layer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
