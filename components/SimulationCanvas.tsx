
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { SimulationProfile, SimulationState } from '../types';

interface SimulationCanvasProps {
  profile: SimulationProfile;
  isPaused: boolean;
  resetSignal: number;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ profile, isPaused, resetSignal }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // High-performance mutable state storage
  // We use refs instead of useState for the physics loop to prevent React re-renders on every frame
  const stateRef = useRef<SimulationState>(profile.initialState);
  const paramsRef = useRef<Record<string, number>>({});
  
  // UI Display state - updated at a lower frequency to save main thread resources
  const [telemetryState, setTelemetryState] = useState<SimulationState>(profile.initialState);
  
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const lastTelemetryTimeRef = useRef<number>(0);

  // Sync parameters to ref for access inside the animation loop without closure staleness
  useEffect(() => {
    paramsRef.current = profile.parameters.reduce((acc, p) => ({ ...acc, [p.id]: p.value }), {});
  }, [profile.parameters]);

  // Memoize the executable functions to avoid recompilation overhead
  const updateFn = useMemo(() => {
    try {
      // (state, params, dt) => newState
      return new Function('state', 'params', 'dt', profile.updateLogic);
    } catch (err) {
      console.error("Failed to compile update logic:", err);
      return (s: any) => s;
    }
  }, [profile.updateLogic]);

  const drawFn = useMemo(() => {
    try {
      // (ctx, state, params, w, h) => void
      return new Function('ctx', 'state', 'params', 'w', 'h', profile.drawLogic);
    } catch (err) {
      console.error("Failed to compile draw logic:", err);
      return () => {};
    }
  }, [profile.drawLogic]);

  // Reset simulation when profile changes or reset is requested
  useEffect(() => {
    stateRef.current = { ...profile.initialState };
    setTelemetryState({ ...profile.initialState });
    lastTimeRef.current = undefined;
  }, [profile.initialState, resetSignal]);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current === undefined) {
      lastTimeRef.current = time;
    }
    
    // Calculate delta time in seconds, clamped to 0.1s to prevent explosion on tab switch
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = time;

    // 1. Physics Update Step
    if (!isPaused) {
      try {
        const newState = updateFn(stateRef.current, paramsRef.current, dt);
        if (newState) {
          stateRef.current = newState;
        }
      } catch (err) {
        // Fail silently in loop to avoid console spam, or log deeply throttled
      }
    }

    // 2. Rendering Step
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
           const w = canvas.width;
           const h = canvas.height;
           drawFn(ctx, stateRef.current, paramsRef.current, w, h);
        } catch (err) {
           // Fail silently
        }
      }
    }

    // 3. Telemetry Step (Throttled to ~15fps)
    if (time - lastTelemetryTimeRef.current > 60) {
      setTelemetryState({ ...stateRef.current });
      lastTelemetryTimeRef.current = time;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [updateFn, drawFn, isPaused]); // Removed profile.parameters from dependency to prevent stutter on slider drag

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          // Set internal resolution to match client size for sharp rendering
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };
    
    // Initial size
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden shadow-inner group">
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />
      
      {/* Telemetry Overlay - Shows throttled state for readability and performance */}
      <div className="absolute top-4 left-4 p-3 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-tighter mb-2">Live Telemetry</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(telemetryState).slice(0, 8).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center gap-4">
              <span className="text-[10px] mono text-zinc-400">{key}:</span>
              <span className="text-[10px] mono text-blue-400">
                {typeof val === 'number' ? val.toFixed(2) : val}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/20 backdrop-grayscale pointer-events-none z-20">
          <div className="px-6 py-3 bg-zinc-900 border border-zinc-700 rounded-full text-zinc-400 font-medium text-sm animate-pulse">
            System Paused
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationCanvas;
