import { useState } from "react";

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function CombatDirectorSimulator() {
  const [heat, setHeat] = useState(0);
  const [shrines, setShrines] = useState(0);
  const [elapsed, setElapsed] = useState(300);
  const [cycling, setCycling] = useState(false);
  const nightLength = heat >= 10 && !cycling ? 1080 : 900;
  const dawnPull = heat >= 5 && !cycling ? 30 : 60;
  const dawnAt = nightLength - (cycling ? 0 : shrines * dawnPull);
  const left = Math.max(0, dawnAt - elapsed);
  const daylight = Math.max(0, Math.min(1, 1 - left / 150)) ** 2;

  return (
    <section className="rounded-xl border border-amber-500/30 bg-dark-900 p-4 sm:p-6 text-slate-200" aria-labelledby="night-clock-title">
      <h3 id="night-clock-title" className="text-lg font-semibold text-amber-300">Explore the night clock</h3>
      <p className="mt-2 text-sm text-slate-400">A simplified calculation using the default 900-second night. Cycling mode illustrates the clock formula with that same length; campaign rules can choose different lengths.</p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm" htmlFor="night-heat">Heat: <strong>{heat}</strong></label>
          <input id="night-heat" type="range" min="0" max="10" value={heat} onChange={e => setHeat(Number(e.target.value))} className="w-full accent-amber-400" />
          <label className="block text-sm" htmlFor="night-shrines">Recorded shrines: <strong>{shrines}</strong></label>
          <input id="night-shrines" type="range" min="0" max="10" value={shrines} onChange={e => setShrines(Number(e.target.value))} className="w-full accent-amber-400" />
          <label className="block text-sm" htmlFor="night-elapsed">Elapsed night time: <strong>{clock(elapsed)}</strong></label>
          <input id="night-elapsed" type="range" min="0" max="1200" step="5" value={elapsed} onChange={e => setElapsed(Number(e.target.value))} className="w-full accent-amber-400" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cycling} onChange={e => setCycling(e.target.checked)} /> Cycling mode (no shrine dawn pull)</label>
        </div>
        <div className="rounded-lg border border-dark-750 bg-dark-950 p-4 text-sm space-y-2" aria-live="polite">
          <p>Night length: <strong>{clock(nightLength)}</strong></p>
          <p>Pull per recorded shrine: <strong>{cycling ? "none" : `${dawnPull} seconds`}</strong></p>
          <p>Dawn deadline: <strong>{clock(dawnAt)}</strong></p>
          <p>Time remaining: <strong>{clock(left)}</strong></p>
          <p>Night daylight ramp: <strong>{(daylight * 100).toFixed(0)}%</strong></p>
          <p>Guard spawn attempts on kindling at this recorded count: <strong>{8 + 3 * shrines}</strong></p>
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">Heat 5 halves the default shrine pull and Heat 10 lengthens the default night. Heat applies to ending-at-dawn survival runs. A newly recorded shrine increments the count before its guard wave; the game may reject individual spawn attempts. During a cycling day, daylight uses a different formula.</p>
    </section>
  );
}
