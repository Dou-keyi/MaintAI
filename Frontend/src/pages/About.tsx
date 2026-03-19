import React from 'react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-12 animate-fade-up">
      <div className="text-center mb-16">
        <h1 className="font-display text-4xl leading-[1.2] font-extrabold text-white mb-6">
          How <span className="text-teal">MaintAi</span> Works
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          We combine physical telemetry with advanced machine learning to predict failure
          before it causes downtime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        <div className="card text-center group">
          <div className="w-12 h-12 bg-ink-3 rounded-full flex items-center justify-center text-teal font-display text-xl font-bold mx-auto mb-6 group-hover:-translate-y-1 transition-transform">
            1
          </div>
          <h3 className="text-white font-medium mb-3">Data Ingestion</h3>
          <p className="text-[13.5px] text-gray-400">
            Securely consume CSV logs from multi-sensor arrays (vibration, temperature, RPM) directly from your industrial assets.
          </p>
        </div>
        
        <div className="card text-center group">
          <div className="w-12 h-12 bg-ink-3 rounded-full flex items-center justify-center text-teal font-display text-xl font-bold mx-auto mb-6 group-hover:-translate-y-1 transition-transform">
            2
          </div>
          <h3 className="text-white font-medium mb-3">XGBoost Inference</h3>
          <p className="text-[13.5px] text-gray-400">
            Process sequences through our NASA CMAPSS-trained model to estimate Remaining Useful Life (RUL) with high precision.
          </p>
        </div>
        
        <div className="card text-center group">
          <div className="w-12 h-12 bg-ink-3 rounded-full flex items-center justify-center text-teal font-display text-xl font-bold mx-auto mb-6 group-hover:-translate-y-1 transition-transform">
            3
          </div>
          <h3 className="text-white font-medium mb-3">Actionable Insights</h3>
          <p className="text-[13.5px] text-gray-400">
            Deploy proactive maintenance teams weeks before a catastrophic failure, minimizing unplanned downtime.
          </p>
        </div>
      </div>

      <div className="card mb-20 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[300px] font-display font-black text-white/[0.02] pointer-events-none select-none z-0">
          9
        </div>
        <div className="relative z-10 text-center">
          <div className="bg-white/10 text-white font-mono text-[11px] px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-6">
            SDG Target 9.4
          </div>
          <h2 className="font-display text-3xl font-extrabold text-white mb-6">
            Sustainable Industrialization
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
            By optimizing maintenance schedules, MaintAi drastically reduces resource waste,
            extends the lifespan of heavy machinery, and prevents catastrophic environmental incidents 
            caused by unexpected industrial failures—aligning perfectly with the United Nations 
            Sustainable Development Goal 9.
          </p>
        </div>
      </div>
    </div>
  );
}
