
import React from 'react';
import { SimulationParam } from '../types';

interface ControlPanelProps {
  parameters: SimulationParam[];
  onParamChange: (id: string, value: number) => void;
  onReset: () => void;
  isPaused: boolean;
  setIsPaused: (val: boolean) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  parameters, 
  onParamChange, 
  onReset, 
  isPaused, 
  setIsPaused 
}) => {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-md shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Controls</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isPaused 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
            }`}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button 
            onClick={onReset}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-all"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {parameters.map((param) => (
          <div key={param.id} className="group">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                {param.name}
              </label>
              <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {param.value.toFixed(2)} {param.unit}
              </span>
            </div>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={param.value}
              onChange={(e) => onParamChange(param.id, parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-zinc-600 font-mono">{param.min}</span>
              <span className="text-[10px] text-zinc-600 font-mono">{param.max}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ControlPanel;
