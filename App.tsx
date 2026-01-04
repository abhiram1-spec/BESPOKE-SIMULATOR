
import React, { useState, useCallback, useRef } from 'react';
import { generateSimulation } from './services/geminiService';
import { SimulationProfile, AppState, SimulationParam } from './types';
import ControlPanel from './components/ControlPanel';
import SimulationCanvas from './components/SimulationCanvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [profile, setProfile] = useState<SimulationProfile | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() && !image) return;
    
    setAppState(AppState.GENERATING);
    try {
      const newProfile = await generateSimulation(prompt, image || undefined);
      setProfile(newProfile);
      setAppState(AppState.RUNNING);
      setIsPaused(false);
    } catch (err) {
      console.error(err);
      setAppState(AppState.ERROR);
    }
  };

  const handleParamChange = (id: string, value: number) => {
    if (!profile) return;
    const newParams = profile.parameters.map(p => 
      p.id === id ? { ...p, value } : p
    );
    setProfile({ ...profile, parameters: newParams });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setResetSignal(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center px-6 justify-between bg-zinc-950 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Bespoke Simulator Engine</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold -mt-1">Physics Generative UI</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400">
            {profile ? `Current: ${profile.title}` : 'No active simulation'}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full">
        {/* Left: Input & Tools */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4">Input Definition</h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a physics scenario... e.g., 'A 2kg mass on a spring with damping' or 'Two billiard balls colliding in 2D'"
              className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all resize-none text-zinc-200 placeholder:text-zinc-600"
            />
            
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 h-10 border border-zinc-800 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${image ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {image ? 'Sketch Attached' : 'Attach Sketch'}
              </button>
              {image && (
                <button 
                  onClick={() => setImage(null)}
                  className="w-10 h-10 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-400"
                >
                  ✕
                </button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={appState === AppState.GENERATING}
              className={`w-full h-12 mt-4 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all transform active:scale-95 ${
                appState === AppState.GENERATING
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
              }`}
            >
              {appState === AppState.GENERATING ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  ENGINEERING...
                </span>
              ) : (
                'GENERATE SIMULATION'
              )}
            </button>
          </div>

          {profile && (
            <ControlPanel
              parameters={profile.parameters}
              onParamChange={handleParamChange}
              onReset={handleReset}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
            />
          )}

          {!profile && appState === AppState.IDLE && (
            <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-zinc-500 text-sm leading-relaxed">
                Welcome, Scientist.<br/>Input a problem above to start the bespoke engine.
              </p>
            </div>
          )}
        </div>

        {/* Center: Simulation Canvas */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          <div className="flex-1 min-h-[500px]">
            {profile ? (
              <SimulationCanvas 
                profile={profile} 
                isPaused={isPaused} 
                resetSignal={resetSignal} 
              />
            ) : (
              <div className="w-full h-full rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center text-zinc-700 space-y-4">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-lg font-light tracking-widest">AWAITING SYSTEM PARAMETERS</span>
              </div>
            )}
          </div>

          {/* Bottom Info Bar */}
          {profile && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold text-white">{profile.title}</h2>
                  <p className="text-sm text-zinc-400 mt-1">{profile.description}</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1">
                  <span className="text-[10px] font-mono text-blue-400 uppercase">Solver Active</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 leading-relaxed italic">
                  <span className="text-zinc-400 font-semibold not-italic mr-2">Core Theory:</span>
                  {profile.physicsDescription}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Background Decorative Element */}
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed -top-32 -right-32 w-96 h-96 bg-purple-600/5 blur-[120px] pointer-events-none" />
    </div>
  );
};

export default App;
