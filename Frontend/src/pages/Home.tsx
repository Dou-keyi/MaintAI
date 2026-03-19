import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, ShieldCheck, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  const [downtime, setDowntime] = useState(0);
  const [rul, setRul] = useState(0);

  useEffect(() => {
    let frame: number;
    let start = 0;
    const dur = 2000;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / dur, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setDowntime(ease * 35);
      setRul(ease * 92.4);

      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const mockAssets = [
    { name: 'Boiler Feed Pump', area: 'Utilities · Zone A', health: 82, bar: '82%', tone: 'bg-emerald-400' },
    { name: 'Conveyor Line 4', area: 'Packaging · Bay 2', health: 46, bar: '46%', tone: 'bg-amber-400' },
    { name: 'Compressor East', area: 'Production · Hall 1', health: 21, bar: '21%', tone: 'bg-red-400' },
  ];

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-64px)] px-12 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,212,184,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,212,184,0.08),transparent_24%)]" />

      <div className="relative flex flex-col lg:flex-row gap-12">
        <div className="flex-1 flex flex-col justify-center max-w-2xl animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal/8 border border-teal/20 text-teal rounded-full text-[11px] font-mono tracking-[0.24em] uppercase mb-8 w-max">
            <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
            SDG 9 · ASEAN SME Resilience Track
          </div>

          <h1 className="font-display text-5xl md:text-[68px] leading-[1.02] font-extrabold text-white mb-6 tracking-[-0.04em]">
            Predict failure
            <br />
            before it <span className="text-teal">happens.</span>
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-xl leading-relaxed">
            MaintAi monitors industrial machinery in real time, estimates remaining useful life from sensor behavior,
            and helps your team act before downtime turns into failure.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-14">
            <Link to="/dashboard" className="btn-primary px-8 py-3.5 text-[15px] shadow-[0_12px_30px_rgba(0,212,184,0.18)]">
              <Activity size={18} />
              Live Dashboard
            </Link>
            <Link to="/predict" className="btn-ghost px-8 py-3.5 text-[15px] gap-2 bg-white/[0.02]">
              <UploadCloud size={18} />
              Upload & Predict
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14 max-w-3xl">
            <div className="rounded-2xl border border-border bg-white/[0.03] px-5 py-4">
              <div className="flex items-center gap-2 text-teal text-sm font-semibold mb-2">
                <ShieldCheck size={16} />
                Reliable models
              </div>
              <div className="text-sm text-gray-400 leading-relaxed">Track wear by hours, load, cycles, and live sensor behavior.</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/[0.03] px-5 py-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2">
                <AlertTriangle size={16} />
                Early warnings
              </div>
              <div className="text-sm text-gray-400 leading-relaxed">Surface warning and critical assets before breakdown hits operations.</div>
            </div>
            <div className="rounded-2xl border border-border bg-white/[0.03] px-5 py-4">
              <div className="flex items-center gap-2 text-white text-sm font-semibold mb-2">
                <Activity size={16} />
                Actionable dashboard
              </div>
              <div className="text-sm text-gray-400 leading-relaxed">Register assets, upload telemetry, log maintenance, and monitor health.</div>
            </div>
          </div>

          <div className="flex items-center gap-12 mt-auto">
            <div>
              <div className="font-mono text-[32px] text-white font-medium mb-1">
                {downtime.toFixed(0)}
                <span className="text-teal">%</span>
              </div>
              <div className="text-[12px] text-gray-500 font-mono">downtime reduction</div>
            </div>
            <div>
              <div className="font-mono text-[32px] text-white font-medium mb-1">{rul.toFixed(1)}</div>
              <div className="text-[12px] text-gray-500 font-mono">avg RUL acc (RMSE)</div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="relative w-[420px] min-h-[520px] bg-[linear-gradient(180deg,rgba(20,25,41,0.96),rgba(10,14,26,0.98))] border border-white/8 rounded-[28px] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="absolute inset-x-10 top-0 h-24 bg-teal/10 blur-3xl" />

            <div className="absolute top-4 right-4 flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="w-2 h-2 rounded-full flex items-center justify-center bg-teal">
                <div className="w-full h-full rounded-full animate-ping bg-teal opacity-60" />
              </div>
            </div>

            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.24em] mb-8">
              MaintAi — live monitor
            </div>

            <div className="flex flex-col gap-4">
              {mockAssets.map((item) => (
                <div key={item.name} className="h-20 rounded-2xl bg-ink-3/80 border border-white/6 flex items-center px-4 overflow-hidden relative">
                  <div className={`absolute left-0 bottom-0 top-0 w-1 ${item.tone} rounded-l-2xl opacity-80`} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white mb-1">{item.name}</div>
                    <div className="text-[11px] text-gray-500 font-mono uppercase tracking-wider">{item.area}</div>
                  </div>
                  <div className="w-28">
                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-1">
                      <span>health</span>
                      <span>{item.health}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                      <div className={`h-full ${item.tone}`} style={{ width: item.bar }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/6 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-gray-500">forecast summary</span>
                <span className="text-teal text-[11px] font-mono">live</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xl font-display text-white">12</div>
                  <div className="text-[10px] text-gray-500 font-mono uppercase">assets</div>
                </div>
                <div>
                  <div className="text-xl font-display text-amber-400">3</div>
                  <div className="text-[10px] text-gray-500 font-mono uppercase">warning</div>
                </div>
                <div>
                  <div className="text-xl font-display text-red-400">1</div>
                  <div className="text-[10px] text-gray-500 font-mono uppercase">critical</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
