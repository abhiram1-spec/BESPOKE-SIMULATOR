
import React, { useState, useCallback, useRef } from 'react';
import { generateSimulation, generatePreviewVideo } from './services/geminiService';
import { SimulationProfile, AppState, SimulationParam } from './types';
import ControlPanel from './components/ControlPanel';
import SimulationCanvas from './components/SimulationCanvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DEFAULT_PROFILE: SimulationProfile = {
  title: "Gravitational Lensing Event",
  description: "Real-time visualization of light ray deflection (geodesics) caused by the spacetime curvature of a supermassive object.",
  physicsDescription: "Based on General Relativity principles where mass curves spacetime. Light rays follow geodesics which appear bent in 3D space. This simulation uses a high-performance integration step to trace photon paths interacting with a central gravitational potential.",
  parameters: [
    { id: 'mass', name: 'Singularity Mass', min: 1000, max: 50000, step: 1000, value: 15000, unit: 'M☉' },
    { id: 'c', name: 'Light Velocity', min: 5, max: 50, step: 1, value: 20, unit: 'c' },
    { id: 'density', name: 'Ray Density', min: 10, max: 150, step: 5, value: 60, unit: 'rays' },
    { id: 'horizon', name: 'Event Horizon', min: 10, max: 100, step: 5, value: 40, unit: 'px' }
  ],
  initialState: { t: 0 },
  updateLogic: `
    // Simple time accumulator for any time-based animations (like accretion disk flow)
    return { t: state.t + dt };
  `,
  drawLogic: `
    const { mass, c, density, horizon } = params;
    const cx = 0; 
    // Clear background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;

    // Draw Accretion Disk / Lensing Distortion Field (Visual Effect)
    const time = state.t || 0;
    
    ctx.save();
    ctx.translate(centerX, centerY);

    // Dynamic Accretion Glow
    const glowRadius = horizon * (3 + Math.sin(time * 2) * 0.1);
    const gradient = ctx.createRadialGradient(0, 0, horizon, 0, 0, glowRadius);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.2, 'rgba(249, 115, 22, 0.8)'); // Orange-500
    gradient.addColorStop(0.6, 'rgba(180, 83, 9, 0.2)');  // Amber-700
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Event Horizon
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(0, 0, horizon, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f97316'; // Orange-500
    ctx.lineWidth = 2;
    ctx.stroke();

    // Photon Tracing
    // We re-calculate the paths every frame for stateless rendering
    ctx.lineWidth = 1;
    ctx.globalCompositeOperation = 'screen'; // Additive blending for light rays

    const raySpacing = h / density;
    const startX = -w / 2;
    
    for (let i = 0; i < density; i++) {
        // Distribute rays vertically
        const initialY = (i - density / 2) * raySpacing;
        
        // Simulation variables for this ray
        let px = startX;
        let py = initialY;
        let vx = c;
        let vy = 0;
        
        ctx.beginPath();
        // Color based on distance from center (redshift effect visualization)
        ctx.strokeStyle = Math.abs(initialY) < horizon * 2 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(59, 130, 246, 0.4)';
        
        ctx.moveTo(px, py);
        
        let active = true;
        let steps = 0;
        
        while (active && steps < w/c * 2) {
            const dx = 0 - px;
            const dy = 0 - py;
            const distSq = dx*dx + dy*dy;
            const dist = Math.sqrt(distSq);
            
            // Event Horizon Collision
            if (dist < horizon) {
                active = false;
                break;
            }
            
            // Bounds check (optimization)
            if (px > w/2 || Math.abs(py) > h) {
                active = false;
                break;
            }
            
            // Gravitational Force (Newtonian approx for viz: F = G*M/r^2)
            // We apply it perpendicular to velocity to simulate bending without speed change (mostly)
            
            const force = mass / Math.max(distSq, 10);
            const ax = (dx / dist) * force;
            const ay = (dy / dist) * force;
            
            vx += ax;
            vy += ay;
            
            // Normalize speed to c (light speed constancy)
            const speed = Math.sqrt(vx*vx + vy*vy);
            vx = (vx / speed) * c;
            vy = (vy / speed) * c;
            
            px += vx;
            py += vy;
            
            ctx.lineTo(px, py);
            steps++;
        }
        ctx.stroke();
    }
    
    ctx.restore();
    
    // Telemetry Overlay
    ctx.fillStyle = '#52525b';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('Schwarzschild Metric approx.', 20, h - 20);
  `
};

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [profile, setProfile] = useState<SimulationProfile | null>(DEFAULT_PROFILE);
  const [isPaused, setIsPaused] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video Generation State
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

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

  const handleGenerateVideo = async () => {
    if (!prompt.trim() && !profile) return;
    const promptToUse = prompt.trim() || profile?.title || "Physics simulation";

    // Veo Model Key Check
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const hasKey = await aistudio.hasSelectedApiKey();
      if (!hasKey) {
        try {
           await aistudio.openSelectKey();
        } catch (e) {
          console.error("Key selection failed or cancelled", e);
          return;
        }
      }
    }

    setIsVideoLoading(true);
    try {
      const url = await generatePreviewVideo(promptToUse);
      setVideoUrl(url);
    } catch (e) {
      console.error("Video generation failed", e);
      alert("Failed to generate video. Please try again.");
    } finally {
      setIsVideoLoading(false);
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
              placeholder="Describe a physics scenario (e.g., 'Double pendulum') or upload a whiteboard sketch to generate a simulation automatically."
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

            <div className="grid grid-cols-1 gap-3 mt-4">
              <button
                onClick={handleGenerate}
                disabled={appState === AppState.GENERATING || isVideoLoading}
                className={`w-full h-12 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all transform active:scale-95 ${
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
                    SIMULATING...
                  </span>
                ) : (
                  'GENERATE SIMULATION'
                )}
              </button>

              <button
                onClick={handleGenerateVideo}
                disabled={isVideoLoading || (!prompt && !profile)}
                className={`w-full h-10 rounded-xl font-bold text-xs tracking-wide border transition-all ${
                  isVideoLoading
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-900 border-zinc-800 text-purple-400 hover:text-purple-300 hover:border-purple-500/50 hover:bg-purple-900/10'
                }`}
              >
                {isVideoLoading ? 'RENDERING VIDEO (MAY TAKE MINS)...' : '✨ GENERATE DEMO VIDEO'}
              </button>
            </div>
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
                Welcome, Scientist.<br/>Input a problem or upload a whiteboard sketch to start the bespoke engine.
              </p>
            </div>
          )}
        </div>

        {/* Center: Simulation Canvas */}
        <div className="lg:col-span-9 flex flex-col gap-6 relative">
          <div className="flex-1 min-h-[500px] relative z-0">
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

      {/* Video Modal */}
      {videoUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
               <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Veo Generated Preview</h3>
               <button 
                 onClick={() => setVideoUrl(null)}
                 className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
               >
                 ✕
               </button>
            </div>
            <div className="relative aspect-video bg-black">
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-4 bg-zinc-950 text-xs text-zinc-500 border-t border-zinc-800 flex justify-between">
              <span>Generated by Veo 3.1</span>
              <a href={videoUrl} download="demo_simulation.mp4" className="text-blue-400 hover:underline">Download MP4</a>
            </div>
          </div>
        </div>
      )}

      {/* Background Decorative Element */}
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed -top-32 -right-32 w-96 h-96 bg-purple-600/5 blur-[120px] pointer-events-none" />
    </div>
  );
};
