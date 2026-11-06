import { useState } from "react";

// Input::steer() applies this radial response; the graph uses one horizontal axis.
function response(raw: number) {
  return raw > 0.25 ? Math.min(1, (raw - 0.25) / 0.75) : 0;
}

export function InputResponseLab() {
  const [raw, setRaw] = useState(0);
  const [held, setHeld] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const [triggerHeld, setTriggerHeld] = useState(false);
  const output = response(raw);
  const updateStick = (value: number) => {
    setRaw(value);
    setHeld(previous => previous ? response(value) > 0.3 : response(value) > 0.6);
  };
  const updateTrigger = (value: number) => {
    setTrigger(value);
    setTriggerHeld(previous => previous ? value > 0.25 : value > 0.5);
  };
  const reset = () => { setRaw(0); setHeld(false); setTrigger(0); setTriggerHeld(false); };

  return (
    <section className="rounded-xl border border-sky-500/30 bg-dark-900 p-4 sm:p-6 text-slate-200" aria-labelledby="input-lab-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="input-lab-title" className="text-lg font-semibold text-sky-300">Stick response and hysteresis</h3>
          <p className="mt-1 text-sm text-slate-400">Move each slider up and down to see when a digital action presses and releases. The graph shows a horizontal stick input.</p>
        </div>
        <button type="button" onClick={reset} className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-800">Reset</button>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <svg viewBox="0 0 300 160" className="w-full max-w-md" role="img" aria-label={`Stick response graph: raw ${raw.toFixed(2)}, output ${output.toFixed(2)}`}>
            <line x1="35" y1="125" x2="280" y2="125" stroke="#64748b" />
            <line x1="35" y1="125" x2="35" y2="15" stroke="#64748b" />
            <polyline points="35,125 96.25,125 280,15" fill="none" stroke="#38bdf8" strokeWidth="3" />
            <line x1={35 + raw * 245} y1="125" x2={35 + raw * 245} y2={125 - output * 110} stroke="#fbbf24" strokeDasharray="4 4" />
            <circle cx={35 + raw * 245} cy={125 - output * 110} r="5" fill="#fbbf24" />
            <text x="35" y="145" fill="#94a3b8" fontSize="11">0</text>
            <text x="91" y="145" fill="#94a3b8" fontSize="11">0.25</text>
            <text x="267" y="145" fill="#94a3b8" fontSize="11">1.0 raw</text>
            <text x="2" y="20" fill="#94a3b8" fontSize="11">1.0</text>
          </svg>
          <label htmlFor="stick-input" className="block text-sm">Raw horizontal stick: <strong>{raw.toFixed(2)}</strong></label>
          <input id="stick-input" className="mt-2 w-full accent-sky-400" type="range" min="0" max="1" step="0.01" value={raw} onChange={e => updateStick(Number(e.target.value))} />
          <p className="mt-2 text-sm" aria-live="polite">Rescaled output: <strong>{output.toFixed(2)}</strong> · Right action: <strong>{held ? "held" : "released"}</strong></p>
          <p className="mt-1 text-xs text-slate-400">Press above 0.60 output; release at 0.30 or below.</p>
        </div>
        <div className="rounded-lg border border-slate-700 p-4">
          <h4 className="font-semibold">Trigger response</h4>
          <p className="mt-2 text-sm text-slate-400">Triggers use their own thresholds, without the stick dead-zone calculation.</p>
          <label htmlFor="trigger-input" className="mt-5 block text-sm">Trigger value: <strong>{trigger.toFixed(2)}</strong></label>
          <input id="trigger-input" className="mt-2 w-full accent-amber-400" type="range" min="0" max="1" step="0.01" value={trigger} onChange={e => updateTrigger(Number(e.target.value))} />
          <p className="mt-2 text-sm" aria-live="polite">Trigger action: <strong>{triggerHeld ? "held" : "released"}</strong></p>
          <p className="mt-1 text-xs text-slate-400">Press above 0.50; release at 0.25 or below.</p>
          <p className="mt-5 text-xs text-slate-400">In the gap between thresholds, the state depends on the direction you moved the slider.</p>
        </div>
      </div>
    </section>
  );
}
