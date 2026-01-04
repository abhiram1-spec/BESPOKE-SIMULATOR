
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SimulationProfile, SimulationState } from '../types';

interface SimulationCanvasProps {
  profile: SimulationProfile;
  isPaused: boolean;
  resetSignal: number;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ profile, isPaused, resetSignal }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<SimulationState>(profile.initialState);
  const [localParams, setLocalParams] = useState(profile.parameters);
  // Fixed: useRef expects an initial value argument in this environment
  const requestRef = useRef<number | undefined>(undefined);
  // Fixed: useRef expects an initial value argument in this environment
  const lastTimeRef = useRef<number | undefined>(undefined);

  // Update local params when props change (specifically for slider interaction)
  useEffect(() => {
    setLocalParams(profile.parameters);
  }, [profile.parameters]);

  // Reset state when profile or reset signal changes
  useEffect(() => {
    setState(profile.initialState);
  }, [profile.initialState, resetSignal]);

  const update = useCallback((dt: number) => {
    if (isPaused) return;

    try {
      // Create executable logic from string
      // (state, params, dt) => newState
      const updateFn = new Function('state', 'params', 'dt', profile.updateLogic);
      
      // Convert params list to object for easier access in script
      const paramsObj = localParams.reduce((acc, p) => ({ ...acc, [p.id]: p.value }), {});
      
      setState(prevState => {
        const newState = updateFn(prevState, paramsObj, dt);
        return newState || prevState;
      });
    } catch (err) {
      console.error("Physics Update Error:", err);
    }
  }, [profile.updateLogic, localParams, isPaused]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    try {
      // Create executable logic from string
      // (ctx, state, params, w, h) => void
      const drawFn = new Function('ctx', 'state', 'params', 'w', 'h', profile.drawLogic);
      const paramsObj = localParams.reduce((acc, p) => ({ ...acc, [p.id]: p.value }), {});
      
      drawFn(ctx, state, paramsObj, w, h);
    } catch (err) {
      console.error("Drawing Error:", err);
    }
  }, [profile.drawLogic, state, localParams]);

  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1); // cap dt to prevent tunneling
      update(dt);
    }
    lastTimeRef.current = time;
    draw();
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update, draw]);

  // Handle resizing
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.parentElement?.clientWidth || 800;
        canvasRef.current.height = canvasRef.current.parentElement?.clientHeight || 600;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-inner group">
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />
      
      <div className="absolute top-4 left-4 p-3 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-tighter mb-2">Live Telemetry</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(state).slice(0, 6).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center gap-4">
              <span className="text-[10px] mono text-zinc-400">{key}:</span>
              {/* Cast val to number because TypeScript Object.entries on indexed types might infer unknown/any */}
              <span className="text-[10px] mono text-blue-400">{(val as number).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/20 backdrop-grayscale pointer-events-none">
          <div className="px-6 py-3 bg-zinc-900 border border-zinc-700 rounded-full text-zinc-400 font-medium text-sm animate-pulse">
            System Paused
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationCanvas;
