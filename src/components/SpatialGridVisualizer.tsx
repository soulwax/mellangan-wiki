import React, { useState, useMemo } from 'react';
import { Grid, Crosshair, Layers, Plus, RotateCcw, EyeOff } from 'lucide-react';

interface SimEnemy {
  id: number;
  name: string;
  gx: number;
  gy: number;
  buried: boolean;
}

const GRID_DIM = 4;
const TOTAL_CELLS = GRID_DIM * GRID_DIM;

const INITIAL_ENEMIES: SimEnemy[] = [
  { id: 0, name: 'Wolf#0', gx: 1.2, gy: 1.3, buried: false },
  { id: 1, name: 'Wolf#1', gx: 1.7, gy: 1.6, buried: false },
  { id: 2, name: 'Cultist#2', gx: 2.4, gy: 1.2, buried: false },
  { id: 3, name: 'Burrower#3', gx: 1.5, gy: 1.4, buried: true },
  { id: 4, name: 'Golem#4', gx: 0.6, gy: 2.7, buried: false },
  { id: 5, name: 'Wraith#5', gx: 2.2, gy: 2.5, buried: false },
  { id: 6, name: 'Wolf#6', gx: 2.8, gy: 2.2, buried: false },
  { id: 7, name: 'Skeleton#7', gx: 3.3, gy: 0.8, buried: false },
  { id: 8, name: 'Spider#8', gx: 1.1, gy: 2.2, buried: false },
];

export const SpatialGridVisualizer: React.FC = () => {
  const [enemies, setEnemies] = useState<SimEnemy[]>(INITIAL_ENEMIES);
  const [queryX, setQueryX] = useState<number>(1.6);
  const [queryY, setQueryY] = useState<number>(1.6);
  const [queryRadius, setQueryRadius] = useState<number>(0.95);
  const [selectedSurfaceTile, setSelectedSurfaceTile] = useState<number>(5);

  const csrData = useMemo(() => {
    const cellStart = new Array<number>(TOTAL_CELLS + 1).fill(0);
    const cellOf: { enemy: SimEnemy; cell: number }[] = [];

    for (const e of enemies) {
      if (e.buried) continue;
      const cx = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(e.gx)));
      const cy = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(e.gy)));
      const c = cy * GRID_DIM + cx;
      cellOf.push({ enemy: e, cell: c });
      cellStart[c + 1]++;
    }

    for (let i = 1; i <= TOTAL_CELLS; i++) {
      cellStart[i] += cellStart[i - 1];
    }

    const cellFill = cellStart.slice(0, TOTAL_CELLS);
    const cells = new Array<SimEnemy>(cellStart[TOTAL_CELLS]);

    for (let k = 0; k < cellOf.length; k++) {
      const c = cellOf[k].cell;
      const dest = cellFill[c]++;
      cells[dest] = cellOf[k].enemy;
    }

    const ownX = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(queryX)));
    const ownY = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(queryY)));
    const ownCell = ownY * GRID_DIM + ownX;

    const x0 = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(queryX - queryRadius)));
    const x1 = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(queryX + queryRadius)));
    const y0 = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(queryY - queryRadius)));
    const y1 = Math.max(0, Math.min(GRID_DIM - 1, Math.floor(queryY + queryRadius)));

    const gatherOrder: { cell: number; stage: 'own' | 'neighbor'; sliceStart: number; sliceEnd: number; found: SimEnemy[] }[] = [];
    const gatheredIds = new Set<number>();

    const ownSlice: SimEnemy[] = [];
    for (let i = cellStart[ownCell]; i < cellStart[ownCell + 1]; i++) {
      ownSlice.push(cells[i]);
      gatheredIds.add(cells[i].id);
    }
    gatherOrder.push({
      cell: ownCell,
      stage: 'own',
      sliceStart: cellStart[ownCell],
      sliceEnd: cellStart[ownCell + 1],
      found: ownSlice
    });

    for (let yc = y0; yc <= y1; yc++) {
      for (let xc = x0; xc <= x1; xc++) {
        const c = yc * GRID_DIM + xc;
        if (c === ownCell) continue;
        const slice: SimEnemy[] = [];
        for (let i = cellStart[c]; i < cellStart[c + 1]; i++) {
          slice.push(cells[i]);
          gatheredIds.add(cells[i].id);
        }
        gatherOrder.push({
          cell: c,
          stage: 'neighbor',
          sliceStart: cellStart[c],
          sliceEnd: cellStart[c + 1],
          found: slice
        });
      }
    }

    return { cellStart, cells, ownCell, x0, x1, y0, y1, gatherOrder, gatheredIds };
  }, [enemies, queryX, queryY, queryRadius]);

  const spawnEnemy = () => {
    const id = enemies.length ? Math.max(...enemies.map((e) => e.id)) + 1 : 0;
    const gx = Number((Math.random() * 3.8 + 0.1).toFixed(2));
    const gy = Number((Math.random() * 3.8 + 0.1).toFixed(2));
    const names = ['Wolf', 'Cultist', 'Golem', 'Wraith', 'Spider', 'Skeleton'];
    const name = `${names[id % names.length]}#${id}`;
    setEnemies((prev) => [...prev, { id, name, gx, gy, buried: false }]);
  };

  const toggleBuried = (id: number) => {
    setEnemies((prev) =>
      prev.map((e) => (e.id === id ? { ...e, buried: !e.buried } : e))
    );
  };

  const surfaceSamples = [
    { label: 'Dry Lowland', water: 0, height: 0, ramp: 0 },
    { label: 'Shallow Water', water: 1, height: 0, ramp: 0 },
    { label: 'Frozen Ice Sheet', water: 2, height: 0, ramp: 0 },
    { label: 'Plateau Tier 1', water: 0, height: 1, ramp: 0 },
    { label: 'Stone Ramp Tier 1', water: 0, height: 1, ramp: 1 },
    { label: 'High Peak Tier 2', water: 0, height: 2, ramp: 0 },
    { label: 'Summit Ramp Tier 2', water: 0, height: 2, ramp: 1 },
    { label: 'Citadel Tier 3', water: 0, height: 3, ramp: 0 },
  ];

  const activeSurface = surfaceSamples[selectedSurfaceTile % surfaceSamples.length];
  const packedByte =
    (activeSurface.water & 3) |
    ((activeSurface.height & 3) << 2) |
    ((activeSurface.ramp & 1) << 4);

  return (
    <div className="my-6 rounded-xl border border-dark-700 bg-dark-900/90 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-dark-750 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-mono">
              CSR Prefix-Sum Spatial Grid & Bit-Packed Terrain Lab
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Interactive simulation of <code className="text-gold-300">Level::buildGrid()</code> and <code className="text-gold-300">Level::gather()</code> in <code className="text-slate-300">src/level/LevelSpace.cpp</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={spawnEnemy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Spawn Enemy</span>
          </button>
          <button
            onClick={() => setEnemies(INITIAL_ENEMIES)}
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 border border-dark-650 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="relative aspect-square w-full max-w-[340px] mx-auto bg-dark-950 rounded-xl border border-dark-750 overflow-hidden select-none">
            <div className="grid grid-cols-4 grid-rows-4 w-full h-full">
              {Array.from({ length: TOTAL_CELLS }).map((_, c) => {
                const cx = c % GRID_DIM;
                const cy = Math.floor(c / GRID_DIM);
                const isOwn = c === csrData.ownCell;
                const isQueried =
                  cx >= csrData.x0 &&
                  cx <= csrData.x1 &&
                  cy >= csrData.y0 &&
                  cy <= csrData.y1;
                const count = csrData.cellStart[c + 1] - csrData.cellStart[c];

                return (
                  <div
                    key={c}
                    onClick={() => {
                      setQueryX(cx + 0.5);
                      setQueryY(cy + 0.5);
                    }}
                    className={`relative border border-dark-800/80 p-1.5 cursor-pointer transition-colors ${
                      isOwn
                        ? 'bg-gold-500/15 border-gold-500/60'
                        : isQueried
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'hover:bg-dark-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={isOwn ? 'text-gold-300 font-bold' : isQueried ? 'text-emerald-300' : 'text-slate-500'}>
                        C{c}
                      </span>
                      <span className="text-[9px] px-1 rounded bg-dark-900/80 text-slate-400">
                        [{csrData.cellStart[c]}..{csrData.cellStart[c + 1]})
                      </span>
                    </div>
                    {count > 0 && (
                      <div className="mt-1 text-[9px] font-mono text-emerald-400/90">
                        n={count}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className="pointer-events-none absolute rounded-full border-2 border-dashed border-gold-400/70 bg-gold-400/5 transition-all duration-150"
              style={{
                left: `${((queryX - queryRadius) / GRID_DIM) * 100}%`,
                top: `${((queryY - queryRadius) / GRID_DIM) * 100}%`,
                width: `${((queryRadius * 2) / GRID_DIM) * 100}%`,
                height: `${((queryRadius * 2) / GRID_DIM) * 100}%`,
              }}
            />

            {enemies.map((e) => {
              const inCellGather = csrData.gatheredIds.has(e.id);
              return (
                <button
                  key={e.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggleBuried(e.id);
                  }}
                  title={`${e.name} (${e.buried ? 'Buried - skipped by buildGrid' : 'Active'}) - Click to toggle buried`}
                  style={{
                    left: `${(e.gx / GRID_DIM) * 100}%`,
                    top: `${(e.gy / GRID_DIM) * 100}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
                    e.buried
                      ? 'bg-dark-800 text-slate-500 border border-dashed border-slate-600 opacity-50'
                      : inCellGather
                      ? 'bg-emerald-500 text-dark-950 border-2 border-white shadow-lg shadow-emerald-500/30 scale-110'
                      : 'bg-rose-500/80 text-white border border-rose-300'
                  }`}
                >
                  {e.id}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5 bg-dark-950/70 p-3.5 rounded-lg border border-dark-800 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-gold-400" />
                Query Origin: ({queryX.toFixed(2)}, {queryY.toFixed(2)})
              </span>
              <span className="text-gold-400">Own Cell: C{csrData.ownCell}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 w-24">Query Radius:</span>
              <input
                type="range"
                min="0.2"
                max="1.8"
                step="0.05"
                value={queryRadius}
                onChange={(e) => setQueryRadius( parseFloat(e.target.value) )}
                className="flex-1 accent-gold-400"
              />
              <span className="text-slate-200 w-10 text-right">{queryRadius.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-1">
              <EyeOff className="w-3 h-3 text-slate-400" />
              <span>Click any cell to relocate query origin. Click numbered enemy dots to toggle <code className="text-slate-300">e.buried</code>.</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="p-3.5 rounded-lg bg-dark-950/90 border border-dark-800">
            <div className="text-xs font-mono font-bold text-slate-200 mb-2 flex items-center justify-between">
              <span>1. Prefix-Sum Offset Table: <code className="text-gold-300">cellStart[0..{TOTAL_CELLS}]</code></span>
              <span className="text-[10px] text-slate-400">Slice for cell c is [cellStart[c] .. cellStart[c+1])</span>
            </div>
            <div className="grid grid-cols-9 gap-1">
              {csrData.cellStart.map((val, idx) => {
                const isOwn = idx === csrData.ownCell;
                return (
                  <div
                    key={idx}
                    className={`p-1.5 rounded border text-center font-mono ${
                      isOwn
                        ? 'bg-gold-500/20 border-gold-500 text-gold-300'
                        : 'bg-dark-900 border-dark-750 text-slate-300'
                    }`}
                  >
                    <div className="text-[9px] text-slate-500">[{idx}]</div>
                    <div className="text-xs font-bold">{val}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-dark-950/90 border border-dark-800">
            <div className="text-xs font-mono font-bold text-slate-200 mb-2 flex items-center justify-between">
              <span>2. Contiguous Packed Array: <code className="text-emerald-300">cells[0..{csrData.cells.length - 1}]</code></span>
              <span className="text-[10px] text-emerald-400">{csrData.cells.length} non-buried entities packed</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {csrData.cells.map((e, idx) => {
                const isGathered = csrData.gatheredIds.has(e.id);
                return (
                  <div
                    key={idx}
                    className={`px-2.5 py-1.5 rounded border font-mono text-xs flex items-center gap-2 ${
                      isGathered
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                        : 'bg-dark-900 border-dark-750 text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500">#{idx}</span>
                    <span className="font-semibold">{e.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-dark-950/90 border border-dark-800">
            <div className="text-xs font-mono font-bold text-slate-200 mb-2">
              3. <code className="text-gold-300">Level::gather()</code> Cell Traversal Sequence (Own Cell First)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {csrData.gatherOrder.map((step, i) => (
                <div
                  key={step.cell}
                  className={`p-2 rounded border text-xs font-mono flex items-center justify-between ${
                    step.stage === 'own'
                      ? 'bg-gold-500/15 border-gold-500/50 text-gold-200'
                      : 'bg-dark-900/80 border-dark-750 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase mr-1.5 px-1 py-0.5 rounded bg-dark-950 text-slate-400">
                      Step {i + 1}
                    </span>
                    <span className="font-bold">Cell C{step.cell}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      [{step.sliceStart}..{step.sliceEnd})
                    </span>
                  </div>
                  <div className="text-[11px]">
                    {step.found.length > 0 ? (
                      <span className="text-emerald-400 font-bold">
                        {step.found.map((f) => `#${f.id}`).join(', ')}
                      </span>
                    ) : (
                      <span className="text-slate-600">empty</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-dark-950/90 border border-dark-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-purple-300">
                <Layers className="w-3.5 h-3.5" />
                <span>4. Bit-Packed Surface & Elevation Byte (<code className="text-slate-200">surfaces[gy * SOLID_W + gx]</code>)</span>
              </div>
              <select
                value={selectedSurfaceTile}
                onChange={(e) => setSelectedSurfaceTile(Number(e.target.value))}
                className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs font-mono text-slate-200"
              >
                {surfaceSamples.map((s, idx) => (
                  <option key={s.label} value={idx}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-8 gap-1 mt-2 font-mono text-center">
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                const val = (packedByte >> bit) & 1;
                const role =
                  bit >= 5
                    ? 'Unused'
                    : bit === 4
                    ? 'isRamp'
                    : bit >= 2
                    ? 'Height'
                    : 'Surface';
                const color =
                  bit >= 5
                    ? 'border-dark-800 text-slate-600 bg-dark-900/40'
                    : bit === 4
                    ? 'border-amber-500/50 text-amber-300 bg-amber-500/10'
                    : bit >= 2
                    ? 'border-purple-500/50 text-purple-300 bg-purple-500/10'
                    : 'border-sky-500/50 text-sky-300 bg-sky-500/10';
                return (
                  <div key={bit} className={`p-1.5 rounded border ${color}`}>
                    <div className="text-[9px] opacity-75">b{bit} ({role})</div>
                    <div className="text-sm font-bold mt-0.5">{val}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap justify-between text-[11px] font-mono text-slate-400">
              <span>Byte Hex: <code className="text-slate-200">0x{packedByte.toString(16).toUpperCase().padStart(2, '0')}</code></span>
              <span>surfaceAt (& 3): <code className="text-sky-300">{packedByte & 3}</code></span>
              <span>heightAt (&gt;&gt;2 & 3): <code className="text-purple-300">{(packedByte >> 2) & 3}</code></span>
              <span>climb ramp (& 16): <code className="text-amber-300">{(packedByte & 16) ? 'true (1.0x)' : 'false (0.35x cliff)'}</code></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

