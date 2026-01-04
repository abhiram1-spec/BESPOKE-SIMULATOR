
import { GoogleGenAI, Type } from "@google/genai";
import { SimulationProfile } from "../types";

// Always use process.env.API_KEY directly for initialization as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are a "Bespoke Simulator Engine", an expert physics educator and senior React engineer.
Your goal is to convert text physics/math problems into a functional, structured simulation profile.

You must return a JSON object that adheres strictly to the SimulationProfile structure.
The profile includes:
1. title: A catchy name.
2. description: Short explanation.
3. parameters: List of control sliders (id, name, min, max, step, value, unit).
4. state_variables: An array of objects representing the initial physical state, where each object has a 'key' (e.g., 'x', 'v', 'theta') and a 'value' (number).
5. updateLogic: A JS function body that takes (state, params, dt) and returns the modified state object.
   Use the variables from params as 'params.id' and state as 'state.id'.
   Example: 'return { ...state, x: state.x + state.v * dt };'
6. drawLogic: A JS function body that takes (ctx, state, params, w, h). 
   Use 'ctx' (CanvasRenderingContext2D) to draw. 
   Assume coordinates are centered at (w/2, h/2) for math/physics visualization unless standard screen space is better.
   Include clear labels and units in the visualization.

Constraints:
- Only return the JSON.
- Physics must be accurate (Euler integration is fine for speed).
- Use Tailwind colors if you write text: #3b82f6 (blue), #ef4444 (red), #10b981 (green).
`;

export async function generateSimulation(prompt: string, imageData?: string): Promise<SimulationProfile> {
  const contents = imageData 
    ? { parts: [{ text: prompt }, { inlineData: { data: imageData.split(',')[1], mimeType: 'image/jpeg' } }] }
    : prompt;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          physicsDescription: { type: Type.STRING },
          parameters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                min: { type: Type.NUMBER },
                max: { type: Type.NUMBER },
                step: { type: Type.NUMBER },
                value: { type: Type.NUMBER },
                unit: { type: Type.STRING }
              },
              required: ['id', 'name', 'min', 'max', 'step', 'value']
            }
          },
          state_variables: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                value: { type: Type.NUMBER }
              },
              required: ['key', 'value']
            }
          },
          updateLogic: { type: Type.STRING },
          drawLogic: { type: Type.STRING }
        },
        required: ['title', 'description', 'parameters', 'state_variables', 'updateLogic', 'drawLogic']
      }
    }
  });

  const parsed = JSON.parse(response.text);
  
  // Convert state_variables from Array<{key, value}> back to the expected SimulationState object map
  const initialStateMap: Record<string, number> = {};
  if (Array.isArray(parsed.state_variables)) {
    parsed.state_variables.forEach((item: { key: string; value: number }) => {
      initialStateMap[item.key] = item.value;
    });
  }

  // Destructure to remove the temporary schema field and return the final Profile
  const { state_variables, ...rest } = parsed;

  return {
    ...rest,
    initialState: initialStateMap
  };
}
