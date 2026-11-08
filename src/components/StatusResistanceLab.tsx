import { useState } from "react";

export function StatusResistanceLab() {
  const [percent, setPercent] = useState(50);
  const [damage, setDamage] = useState(160);
  const r = percent / 100;
  const points = Array.from({ length: 76 }, (_, i) => {
    const x = 40 + (i / 75) * 240;
    const y = 145 - (1 - i / 100) ** 2 * 120;
    return `${x},${y}`;
  }).join(" ");
  return (
    <section className="rounded-xl border border-violet-500/30 bg-dark-900 p-4 sm:p-6 text-slate-200" aria-labelledby="resistance-title">
      <h3 id="resistance-title" className="text-lg font-semibold text-violet-300">Zustandswiderstand untersuchen</h3>
      <p className="mt-1 text-sm text-slate-400">Bei einem einzelnen Schaden-über-Zeit-Effekt verringert Widerstand sowohl die Schadensrate als auch die Dauer.</p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <svg viewBox="0 0 310 180" className="w-full max-w-md" role="img" aria-label={`Verbleibender Schaden bei ${percent} % Widerstand: ${(100 * (1-r)**2).toFixed(1)} Prozent`}>
          <line x1="40" y1="145" x2="280" y2="145" stroke="#64748b" />
          <line x1="40" y1="145" x2="40" y2="25" stroke="#64748b" />
          <polyline points={points} fill="none" stroke="#c084fc" strokeWidth="3" />
          <circle cx={40 + percent / 75 * 240} cy={145 - (1-r)**2 * 120} r="5" fill="#fbbf24" />
          <text x="37" y="164" fill="#94a3b8" fontSize="11">0%</text>
          <text x="222" y="164" fill="#94a3b8" fontSize="11">75 % Widerstand</text>
          <text x="1" y="29" fill="#94a3b8" fontSize="11">100%</text>
          <text x="10" y="145" fill="#94a3b8" fontSize="11">0%</text>
        </svg>
        <div>
          <label htmlFor="resistance-slider" className="block text-sm">Widerstand: <strong>{percent} %</strong></label>
          <input id="resistance-slider" type="range" min="0" max="75" step="1" value={percent} onChange={e => setPercent(Number(e.target.value))} className="mt-2 w-full accent-violet-400" />
          <label htmlFor="base-dot" className="mt-4 block text-sm">Ausgangsschaden insgesamt</label>
          <input id="base-dot" type="number" min="0" max="10000" value={damage} onChange={e => setDamage(Math.max(0, Math.min(10000, Number(e.target.value))))} className="mt-2 w-32 rounded border border-slate-600 bg-dark-950 px-2 py-1" />
          <p className="mt-4 text-sm" aria-live="polite">Verbleibender Schaden: <strong>{(100 * (1-r)**2).toFixed(1)} %</strong> · Gesamt: <strong>{(damage * (1-r)**2).toFixed(1)}</strong></p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Dieses Modell setzt eine konstante Schadensrate, keine Obergrenzen oder erneute Anwendung und ein Ziel voraus, das den gesamten Effekt überlebt. Blutung bei Bewegung und das Addieren von Effekten können das Ergebnis verändern.</p>
    </section>
  );
}
