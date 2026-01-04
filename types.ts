
export interface SimulationParam {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
}

export interface SimulationState {
  [key: string]: number;
}

export interface DrawCommand {
  type: 'circle' | 'rect' | 'line' | 'text' | 'path' | 'arrow';
  props: any;
}

export interface SimulationProfile {
  title: string;
  description: string;
  physicsDescription: string;
  parameters: SimulationParam[];
  initialState: SimulationState;
  updateLogic: string; // JavaScript string: (state, params, dt) => newState
  drawLogic: string;   // JavaScript string: (ctx, state, params, canvasWidth, canvasHeight) => void
}

export enum AppState {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR'
}
