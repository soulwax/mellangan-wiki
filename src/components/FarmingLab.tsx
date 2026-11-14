import { useState } from "react";

const CROPS = [
  { name: "Turnip", days: 2, yield: 3 },
  { name: "Barley", days: 2, yield: 3 },
  { name: "Gourd", days: 3, yield: 2 },
  { name: "Firepepper", days: 3, yield: 2 },
];

export function FarmingLab() {
  const [crop, setCrop] = useState(0);
  const [elapsed, setElapsed] = useState(1);
  const [wet, setWet] = useState(0);
  const [seedkeeper, setSeedkeeper] = useState(false);
  const [grove, setGrove] = useState(false);
  const [harvestHome, setHarvestHome] = useState(false);
  const c = CROPS[crop];
  const wetDays = Math.min(elapsed, wet);
  const growth = elapsed + wetDays + (seedkeeper ? 1 : 0);
  const stage = growth >= c.days ? "Ripe" : growth >= c.days / 2 ? "Growing" : "Sprout";
  const produce = c.yield * (grove ? 2 : 1) + (harvestHome ? 1 : 0);
  const selectClass = "mt-1 block w-full min-h-11 rounded-lg border border-dark-700 bg-dark-950 px-3 text-slate-100";
  return (
    <section aria-labelledby="farm-lab-title" className="my-5 rounded-2xl border border-emerald-800 bg-dark-900 p-4 sm:p-5 space-y-4">
      <div>
        <h3 id="farm-lab-title" className="text-lg font-bold text-emerald-300">Try a harvest</h3>
        <p className="text-sm text-slate-300">Compare growth and yield for one planted plot. This is an illustration, not live game state.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-300">Crop
          <select className={selectClass} value={crop} onChange={e => setCrop(Number(e.target.value))}>
            {CROPS.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300">Days elapsed: {elapsed.toFixed(1)}
          <input className="block w-full min-h-11 accent-emerald-400" type="range" min="0" max="3" step="0.1" value={elapsed} onChange={e => { const value = Number(e.target.value); setElapsed(value); setWet(previous => Math.min(previous, value)); }} />
        </label>
        <label className="text-sm text-slate-300">Days wet near player: {wetDays.toFixed(1)}
          <input className="block w-full min-h-11 accent-emerald-400" type="range" min="0" max={Math.max(0.1, elapsed)} step="0.1" value={wetDays} onChange={e => setWet(Number(e.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={seedkeeper} onChange={e => setSeedkeeper(e.target.checked)} /> Seedkeeper at planting</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={grove} onChange={e => setGrove(e.target.checked)} /> Rootsworn grove</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={harvestHome} onChange={e => setHarvestHome(e.target.checked)} /> Harvest Home</label>
      </div>
      <div aria-live="polite" className="rounded-xl border border-dark-700 bg-dark-950 p-4 text-sm text-slate-200 space-y-1">
        <p><strong className="text-emerald-300">{stage}</strong> · {growth.toFixed(1)} / {c.days} days of growth</p>
        <p>{elapsed.toFixed(1)} elapsed + {wetDays.toFixed(1)} wet bonus + {seedkeeper ? 1 : 0} Seedkeeper bonus</p>
        <p>When ripe: {c.yield} base × {grove ? 2 : 1} grove + {harvestHome ? 1 : 0} boon = <strong>{produce} {c.name.toLowerCase()}</strong>.</p>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">Wet days are assumed to have occurred while the plot was loaded near the player. The game tracks rain and retained water over time; this example accepts their combined duration and does not predict the seed-return roll.</p>
    </section>
  );
}
