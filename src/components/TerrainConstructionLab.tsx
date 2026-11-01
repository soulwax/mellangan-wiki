import React, { useState, useMemo } from 'react';
import { Mountain, Waves, Layers, Grid, Compass } from 'lucide-react';

const EDGE_TABLE = [1, 2, 0, 1];
function rimOffset(mask: number): number {
  return EDGE_TABLE[mask & 3] * 12 + EDGE_TABLE[(mask >> 2) & 3];
}

const RAW_DEMO_GRID: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 1, 1, 0, 1, 1, 0, 0],
  [0, 1, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export const TerrainConstructionLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'morph' | 'autotile' | 'blend'>('morph');
  const [rawCells, setRawCells] = useState<number[][]>(() =>
    RAW_DEMO_GRID.map((r) => [...r])
  );
  const [viewStage, setViewStage] = useState<'raw' | 'core' | 'smooth'>('smooth');

  const [north, setNorth] = useState<boolean>(true);
  const [south, setSouth] = useState<boolean>(true);
  const [west, setWest] = useState<boolean>(false);
  const [east, setEast] = useState<boolean>(true);
  const [isRampTile, setIsRampTile] = useState<boolean>(false);

  const [w0, setW0] = useState<number>(0.55);
  const [w1, setW1] = useState<number>(0.3);
  const [w2, setW2] = useState<number>(0.15);

  const toggleRawCell = (x: number, y: number) => {
    setRawCells((prev) => {
      const next = prev.map((r) => [...r]);
      next[y][x] = next[y][x] ? 0 : 1;
      return next;
    });
  };

  const { coreGrid, smoothGrid, rimMasks } = useMemo(() => {
    const h = rawCells.length;
    const w = rawCells[0].length;
    const test = (x: number, y: number) =>
      x >= 0 && x < w && y >= 0 && y < h ? rawCells[y][x] === 1 : false;

    const core = Array.from({ length: h }, () => Array(w).fill(false));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!test(x, y)) continue;
        let ok = false;
        for (let dy = -1; dy <= 0; dy++) {
          for (let dx = -1; dx <= 0; dx++) {
            if (
              test(x + dx, y + dy) &&
              test(x + dx + 1, y + dy) &&
              test(x + dx, y + dy + 1) &&
              test(x + dx + 1, y + dy + 1)
            ) {
              ok = true;
            }
          }
        }
        core[y][x] = ok;
      }
    }

    const getCore = (x: number, y: number) =>
      x >= 0 && x < w && y >= 0 && y < h ? core[y][x] : false;

    const smooth = Array.from({ length: h }, () => Array(w).fill(false));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (getCore(x, y)) {
          smooth[y][x] = true;
        } else {
          const n =
            (getCore(x, y - 1) ? 1 : 0) +
            (getCore(x, y + 1) ? 1 : 0) +
            (getCore(x - 1, y) ? 1 : 0) +
            (getCore(x + 1, y) ? 1 : 0);
          smooth[y][x] = n >= 3;
        }
      }
    }

    const getSmooth = (x: number, y: number) =>
      x >= 0 && x < w && y >= 0 && y < h ? smooth[y][x] : false;

    const masks = Array.from({ length: h }, () => Array(w).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m =
          (getSmooth(x, y - 1) ? 1 : 0) |
          (getSmooth(x, y + 1) ? 2 : 0) |
          (getSmooth(x - 1, y) ? 4 : 0) |
          (getSmooth(x + 1, y) ? 8 : 0);
        masks[y][x] = m;
      }
    }

    return { coreGrid: core, smoothGrid: smooth, rimMasks: masks };
  }, [rawCells]);

  const cardinalMask =
    (north ? 1 : 0) |
    ((south || isRampTile) ? 2 : 0) |
    (west ? 4 : 0) |
    (east ? 8 : 0);
  const rimIdx = rimOffset(cardinalMask);
  const rimRow = Math.floor(rimIdx / 12);
  const rimCol = rimIdx % 12;

  const normWeights = useMemo(() => {
    const sum = Math.max(0.001, w0 + w1 + w2);
    const n0 = w0 / sum;
    const n1 = w1 / sum;
    const n2 = w2 / sum;
    const c0 = n0;
    const c1 = n0 + n1;
    const c2 = n0 + n1 + n2;
    return {
      n: [n0, n1, n2],
      alpha: [1.0, c1 > 0 ? n1 / c1 : 0, c2 > 0 ? n2 / c2 : 0],
    };
  }, [w0, w1, w2]);

  return (
    <div className="my-6 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
      <div className="border-b border-dark-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-dark-950/60">
        <div className="flex items-center gap-2.5">
          <Mountain className="w-4 h-4 text-gold-400" />
          <span className="font-display font-bold text-sm tracking-wide text-slate-100">
            INTERACTIVE TERRAIN CONSTRUCTION LAB: MORPHOLOGY, RIM[16] &amp; BARYCENTRIC BLEND
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('morph')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
              activeTab === 'morph'
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/50'
                : 'bg-dark-900 text-slate-400 hover:text-slate-200 border border-dark-750'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>1. solidCore &amp; smoothPatch Filter</span>
          </button>
          <button
            onClick={() => setActiveTab('autotile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
              activeTab === 'autotile'
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/50'
                : 'bg-dark-900 text-slate-400 hover:text-slate-200 border border-dark-750'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>2. 4-Bit RIM[16] &amp; Cliff Auto-Tiler</span>
          </button>
          <button
            onClick={() => setActiveTab('blend')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
              activeTab === 'blend'
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/50'
                : 'bg-dark-900 text-slate-400 hover:text-slate-200 border border-dark-750'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Cumulative Alpha FloorPainter</span>
          </button>
        </div>
      </div>

      {activeTab === 'morph' && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400">
                Click any tile to toggle raw noise (`rawDirtAt` / `rawWaterAt` / `rawAbove`):
              </span>
              <div className="flex items-center gap-1">
                {(['raw', 'core', 'smooth'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setViewStage(st)}
                    className={`px-2 py-1 rounded text-[11px] font-mono uppercase border ${
                      viewStage === st
                        ? 'bg-gold-500/20 border-gold-500/50 text-gold-300'
                        : 'bg-dark-950 border-dark-750 text-slate-400'
                    }`}
                  >
                    {st === 'raw' ? '1. Raw' : st === 'core' ? '2. solidCore' : '3. smoothPatch'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-10 gap-1 p-3 rounded-xl bg-dark-950 border border-dark-800">
              {rawCells.map((row, y) =>
                row.map((rawVal, x) => {
                  const isCore = coreGrid[y][x];
                  const isSmooth = smoothGrid[y][x];
                  const active =
                    viewStage === 'raw'
                      ? rawVal === 1
                      : viewStage === 'core'
                      ? isCore
                      : isSmooth;
                  const pruned = rawVal === 1 && !active;
                  const filledNotch = rawVal === 0 && active;

                  return (
                    <button
                      key={`${x}-${y}`}
                      onClick={() => toggleRawCell(x, y)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded text-[10px] font-mono flex items-center justify-center border transition-all ${
                        active
                          ? filledNotch
                            ? 'bg-emerald-500/35 border-emerald-400 text-emerald-200 font-bold'
                            : 'bg-sky-500/30 border-sky-400/70 text-sky-200'
                          : pruned
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 line-through'
                          : 'bg-dark-900 border-dark-800 text-slate-600'
                      }`}
                      title={`(${x}, ${y}) Raw=${rawVal}, solidCore=${isCore}, smoothPatch=${isSmooth}`}
                    >
                      {active ? rimOffset(rimMasks[y][x]) : pruned ? '×' : '·'}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-sky-500/30 border border-sky-400/70 inline-block" />
                2×2 Solid Core (Number = RIM Offset)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/40 inline-block" />
                Pruned 1-Tile Spur (×)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/35 border border-emerald-400 inline-block" />
                3-Neighbor Filled Notch
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-between space-y-3">
            <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-gold-400 font-semibold">
                Why Terrain.cpp Filters Every Patch Through solidCore &amp; smoothPatch
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                9-slice rim auto-tiling (<code>RIM[16]</code>) only has Top, Center, and Bottom rows plus Left, Center, and Right columns—it has no sprite for a <strong>1-tile-thick peninsula</strong> (where both North and South are empty simultaneously).
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                1. <code>solidCore(test, ctx, x, y)</code> requires <code>(x, y)</code> to belong to at least one complete <strong>2×2 filled square</strong> (<code>dx, dy in -1..0</code>), pruning 1-tile spurs (red <code>×</code>).
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                2. <code>smoothPatch(test, ctx, x, y)</code> keeps every <code>solidCore</code> tile AND promotes any tile surrounded by <strong>&ge; 3 cardinal <code>solidCore</code> neighbors</strong> (green), closing 1-tile pinholes and notches!
              </p>
            </div>

            <pre className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed">
{`bool solidCore(PatchTest test, const void *ctx, int x, int y) {
  if (!test(x, y, ctx)) return false;
  for (int dy = -1; dy <= 0; dy++)
    for (int dx = -1; dx <= 0; dx++)
      if (test(x+dx, y+dy, ctx) && test(x+dx+1, y+dy, ctx) &&
          test(x+dx, y+dy+1, ctx) && test(x+dx+1, y+dy+1, ctx))
        return true;
  return false;
}`}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'autotile' && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            <div className="text-xs font-mono text-slate-400 mb-3">
              Toggle 4-Bit Cardinal Neighbors (<code>sides(x, y, at)</code>) to compute <code>RIM[mask]</code>:
            </div>

            <div className="grid grid-cols-3 gap-2 items-center justify-items-center bg-dark-950 p-4 rounded-xl border border-dark-800">
              <div />
              <button
                onClick={() => setNorth(!north)}
                className={`px-3 py-2 rounded-lg text-xs font-mono border ${
                  north
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-dark-900 border-dark-750 text-slate-500'
                }`}
              >
                N (bit 0 = {north ? 1 : 0})
              </button>
              <div />

              <button
                onClick={() => setWest(!west)}
                className={`px-3 py-2 rounded-lg text-xs font-mono border ${
                  west
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-dark-900 border-dark-750 text-slate-500'
                }`}
              >
                W (bit 2 = {west ? 4 : 0})
              </button>

              <div className="w-24 h-24 rounded-xl bg-gold-500/15 border-2 border-gold-400 flex flex-col items-center justify-center text-center p-2">
                <div className="text-[10px] font-mono text-gold-300">mask = {cardinalMask}</div>
                <div className="text-sm font-display font-bold text-slate-100 mt-0.5">
                  RIM[{cardinalMask}] = {rimIdx}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  3×3 Slice ({rimCol}, {rimRow})
                </div>
              </div>

              <button
                onClick={() => setEast(!east)}
                className={`px-3 py-2 rounded-lg text-xs font-mono border ${
                  east
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-dark-900 border-dark-750 text-slate-500'
                }`}
              >
                E (bit 3 = {east ? 8 : 0})
              </button>

              <div />
              <button
                onClick={() => setSouth(!south)}
                className={`px-3 py-2 rounded-lg text-xs font-mono border ${
                  south
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-dark-900 border-dark-750 text-slate-500'
                }`}
              >
                S (bit 1 = {south ? 2 : 0})
              </button>
              <div />
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs font-mono text-amber-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isRampTile}
                onChange={(e) => setIsRampTile(e.target.checked)}
                className="accent-amber-400"
              />
              isRamp(x, y) = true (3-Tile Block Aligned South Staircase)
            </label>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-2 text-xs font-mono">
              <div className="text-gold-400 font-semibold uppercase">
                How Ground.cpp Maps 4-Bit Masks to 3×3 Nine-Slice Offsets
              </div>
              <div className="text-slate-300">
                <code>constexpr uint8_t edge[4] = &#123;1, 2, 0, 1&#125;;</code>
              </div>
              <div className="text-slate-400 leading-relaxed">
                • Vertical bits <code>(mask &amp; 3)</code>: <code>00</code> &rarr; row 1, <code>01 (N only)</code> &rarr; row 2 (Bottom Edge), <code>10 (S only)</code> &rarr; row 0 (Top Edge), <code>11 (N+S)</code> &rarr; row 1 (Center).
              </div>
              <div className="text-slate-400 leading-relaxed">
                • Horizontal bits <code>(mask &gt;&gt; 2 &amp; 3)</code>: <code>00</code> &rarr; col 1, <code>01 (W only)</code> &rarr; col 2 (Right Edge), <code>10 (E only)</code> &rarr; col 0 (Left Edge), <code>11 (W+E)</code> &rarr; col 1 (Center).
              </div>
              <div className="text-emerald-300 pt-1">
                Result: <code>edge[{cardinalMask & 3}] * 12 + edge[{(cardinalMask >> 2) & 3}] = {rimRow} * 12 + {rimCol} = {rimIdx}</code>
              </div>
            </div>

            <pre className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed">
{`constexpr uint8_t rimOffset(int mask) {
  constexpr uint8_t edge[4] = {1, 2, 0, 1};
  return uint8_t(edge[mask & 3] * 12 + edge[mask >> 2 & 3]);
}
// Used by: b->lakeRim(RIM[mask]), b->dirtRim(RIM[mask]),
// atlas::snowRim(RIM[mask]), atlas::waterRim(RIM[mask]), atlas::cliff(mat, RIM[mask])`}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'blend' && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-3">
            <div className="text-xs font-mono text-gold-400 uppercase font-semibold">
              Barycentric 3-Biome Weights (Biomes.cpp &rarr; FloorPainter::blend)
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-emerald-400">Pass 0 (Owning Biome: Meadow)</span>
                <span>Weight: {(normWeights.n[0] * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={w0}
                onChange={(e) => setW0(parseFloat(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-amber-400">Pass 1 (Neighbor Biome A: Autumn)</span>
                <span>Weight: {(normWeights.n[1] * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={w1}
                onChange={(e) => setW1(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-sky-400">Pass 2 (Neighbor Biome B: Snow)</span>
                <span>Weight: {(normWeights.n[2] * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={w2}
                onChange={(e) => setW2(parseFloat(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-2 text-xs font-mono">
              <div className="text-gold-400 font-semibold uppercase">
                Cumulative Alpha-Over Theorem (FloorPainter::blend)
              </div>
              <p className="text-slate-400 leading-relaxed">
                If you draw 3 sprites sequentially using standard GPU alpha-blending (<code>dst = src * a + dst * (1 - a)</code>), passing raw weights <code>w[i]</code> as alpha would under-weight Pass 0! Instead, <code>FloorPainter::blend</code> passes <code>alpha = weight[k] / cumulative</code>:
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded bg-dark-900 border border-dark-750">
                  <div className="text-[10px] text-emerald-400">Pass 0 (Base)</div>
                  <div className="text-sm font-bold text-slate-100">
                    alpha = {normWeights.alpha[0].toFixed(3)}
                  </div>
                </div>
                <div className="p-2 rounded bg-dark-900 border border-dark-750">
                  <div className="text-[10px] text-amber-400">Pass 1 (w1 / (w0+w1))</div>
                  <div className="text-sm font-bold text-slate-100">
                    alpha = {normWeights.alpha[1].toFixed(3)}
                  </div>
                </div>
                <div className="p-2 rounded bg-dark-900 border border-dark-750">
                  <div className="text-[10px] text-sky-400">Pass 2 (w2 / 1.0)</div>
                  <div className="text-sm font-bold text-slate-100">
                    alpha = {normWeights.alpha[2].toFixed(3)}
                  </div>
                </div>
              </div>
            </div>

            <pre className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed">
{`for (int i = 0; i < count; i++) {
  int k = order[i], id = int(blend.biome[k]);
  cumulative += blend.weight[k];
  tint(BIOMES[id]->tint, shade, n, i == 0 ? 1 : blend.weight[k] / cumulative);
  s.sprite(ground, x * 16, y * 16, 0, 0);
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

