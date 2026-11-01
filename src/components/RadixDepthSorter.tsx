import React, { useState, useMemo } from 'react';
import { Layers, ArrowDownUp, Binary, Sparkles } from 'lucide-react';

function floatToUint32(f: number): number {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setFloat32(0, f, false);
  return view.getUint32(0, false) >>> 0;
}

function orderedBits(f: number): number {
  const u = floatToUint32(f);
  const mask = (u & 0x80000000) !== 0 ? 0xffffffff : 0x80000000;
  return (u ^ mask) >>> 0;
}

interface DrawableItem {
  id: number;
  name: string;
  kind: 'FloorDecal' | 'Prop' | 'Enemy' | 'Player' | 'Canopy';
  layer: number;
  y: number;
  swimming: boolean;
}

const SAMPLE_DRAWABLES: DrawableItem[] = [
  { id: 0, name: 'Player (Knight)', kind: 'Player', layer: 1, y: 124.5, swimming: false },
  { id: 1, name: 'Ancient Pine Canopy', kind: 'Canopy', layer: 2, y: 98.0, swimming: false },
  { id: 2, name: 'Blood Scorch Mark', kind: 'FloorDecal', layer: 0, y: 210.25, swimming: false },
  { id: 3, name: 'Alpha Wolf', kind: 'Enemy', layer: 1, y: -42.75, swimming: false },
  { id: 4, name: 'Mire Leech', kind: 'Enemy', layer: 1, y: 124.1, swimming: true },
  { id: 5, name: 'Runestone Obelisk', kind: 'Prop', layer: 1, y: -115.5, swimming: false },
  { id: 6, name: 'Necromancer', kind: 'Enemy', layer: 1, y: 185.8, swimming: false },
];

export const RadixDepthSorter: React.FC = () => {
  const [customLayer, setCustomLayer] = useState<number>(1);
  const [customY, setCustomY] = useState<number>(-42.75);
  const [customIdx, setCustomIdx] = useState<number>(3);
  const [activePass, setActivePass] = useState<number>(3);

  const rawFloatBits = useMemo(() => floatToUint32(customY), [customY]);
  const monotonicBits = useMemo(() => orderedBits(customY), [customY]);

  const encodedDrawables = useMemo(() => {
    return SAMPLE_DRAWABLES.map((d, index) => {
      const ordY = orderedBits(d.y);
      const b0 = ordY & 0xfff;
      const b1 = (ordY >>> 12) & 0xfff;
      const b2 = ((d.layer & 0xf) << 8) | ((ordY >>> 24) & 0xff);
      const hexHigh = (((d.layer & 0xff) << 24) | (ordY >>> 8)) >>> 0;
      const hexLow = (((ordY & 0xff) << 24) | (index & 0xffffff)) >>> 0;
      const fullHex = `0x${hexHigh.toString(16).toUpperCase().padStart(8, '0')}${hexLow
        .toString(16)
        .toUpperCase()
        .padStart(8, '0')}`;

      return {
        ...d,
        index,
        ordY,
        b0,
        b1,
        b2,
        fullHex,
      };
    });
  }, []);

  const sortedByPass = useMemo(() => {
    const arr = [...encodedDrawables];
    if (activePass >= 1) {
      arr.sort((a, b) => a.b0 - b.b0);
    }
    if (activePass >= 2) {
      arr.sort((a, b) => a.b1 - b.b1);
    }
    if (activePass >= 3) {
      arr.sort((a, b) => a.b2 - b.b2);
    }
    return arr;
  }, [encodedDrawables, activePass]);

  const bitStringRaw = rawFloatBits.toString(2).padStart(32, '0');
  const bitStringOrd = monotonicBits.toString(2).padStart(32, '0');

  return (
    <div className="my-6 rounded-xl border border-dark-700 bg-dark-900/90 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-dark-750 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Binary className="w-4 h-4 text-gold-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-gold-400 font-mono">
              64-Bit Key Packing & 3-Pass LSD Radix Y-Sorter
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Interactive inspector for <code className="text-gold-300">orderedBits(float)</code> and <code className="text-gold-300">radixSort()</code> in <code className="text-slate-300">src/level/LevelRender.cpp</code>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((pass) => (
            <button
              key={pass}
              onClick={() => setActivePass(pass)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors border ${
                activePass === pass
                  ? 'bg-gold-500/20 text-gold-300 border-gold-500/60 font-bold'
                  : 'bg-dark-850 text-slate-400 border-dark-700 hover:text-slate-200'
              }`}
            >
              {pass === 0 ? 'Unsorted Queue' : `Pass ${pass} (Shift ${pass === 1 ? 24 : pass === 2 ? 36 : 48})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-3">
            <div className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              <span>IEEE-754 Monotonic Float Bijection (<code className="text-gold-300">orderedBits</code>)</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">World Y Coordinate:</span>
                <span className={`font-bold ${customY < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {customY.toFixed(2)} px
                </span>
              </div>
              <input
                type="range"
                min="-300"
                max="300"
                step="0.25"
                value={customY}
                onChange={(e) => setCustomY(parseFloat(e.target.value))}
                className="w-full accent-gold-400"
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Layer [63..56]</label>
                  <select
                    value={customLayer}
                    onChange={(e) => setCustomLayer(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-slate-200"
                  >
                    <option value={0}>Layer 0 (Ground Decal)</option>
                    <option value={1}>Layer 1 (Entities & Props)</option>
                    <option value={2}>Layer 2 (Overhead Canopy)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Draw Vector Index [23..0]</label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={customIdx}
                    onChange={(e) => setCustomIdx(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-dark-900 border border-dark-700 rounded px-2 py-1 text-xs text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-dark-800 space-y-2 font-mono text-[11px]">
              <div>
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span>Raw IEEE-754 Bits:</span>
                  <span className="text-slate-200">0x{rawFloatBits.toString(16).toUpperCase().padStart(8, '0')}</span>
                </div>
                <div className="p-1.5 rounded bg-dark-900 border border-dark-800 tracking-tighter text-[10px] break-all">
                  <span className="text-rose-400 font-bold">{bitStringRaw[0]}</span>
                  <span className="text-amber-300">{bitStringRaw.slice(1, 9)}</span>
                  <span className="text-slate-400">{bitStringRaw.slice(9)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span>XOR Mask Applied:</span>
                  <span className="text-purple-300">
                    {customY < 0 ? '0xFFFFFFFF (Negative: Flip All 32)' : '0x80000000 (Positive: Flip Sign)'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 mb-0.5">
                  <span>orderedBits(y) Result:</span>
                  <span className="text-emerald-300 font-bold">0x{monotonicBits.toString(16).toUpperCase().padStart(8, '0')}</span>
                </div>
                <div className="p-1.5 rounded bg-dark-900 border border-emerald-500/30 tracking-tighter text-[10px] break-all text-emerald-300">
                  {bitStringOrd}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 text-xs font-mono space-y-2">
            <div className="font-bold text-slate-200">64-Bit Sort Key Layout (<code className="text-gold-300">uint64_t</code>)</div>
            <div className="grid grid-cols-12 gap-1 text-center text-[10px]">
              <div className="col-span-2 p-2 rounded bg-purple-500/15 border border-purple-500/50 text-purple-300">
                <div className="font-bold">[63..56]</div>
                <div>Layer (8b)</div>
                <div className="mt-1 text-white font-bold">0x{customLayer.toString(16).toUpperCase().padStart(2, '0')}</div>
              </div>
              <div className="col-span-6 p-2 rounded bg-emerald-500/15 border border-emerald-500/50 text-emerald-300">
                <div className="font-bold">[55..24]</div>
                <div>orderedBits(y) (32b)</div>
                <div className="mt-1 text-white font-bold">0x{monotonicBits.toString(16).toUpperCase().padStart(8, '0')}</div>
              </div>
              <div className="col-span-4 p-2 rounded bg-sky-500/15 border border-sky-500/50 text-sky-300">
                <div className="font-bold">[23..0]</div>
                <div>drawn.size() (24b)</div>
                <div className="mt-1 text-white font-bold">0x{customIdx.toString(16).toUpperCase().padStart(6, '0')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col justify-between p-4 rounded-xl bg-dark-950 border border-dark-800">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-200">
                <ArrowDownUp className="w-4 h-4 text-emerald-400" />
                <span>
                  Radix Sort Buffer State ({activePass === 0 ? 'Insertion Order' : `After Pass ${activePass} of 3`})
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                4096-Bucket Histogram (12-Bit Radix)
              </span>
            </div>

            <div className="space-y-2">
              {sortedByPass.map((item, rank) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-dark-900 border border-dark-750 flex flex-wrap items-center justify-between gap-2 text-xs font-mono transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded bg-dark-800 border border-dark-650 flex items-center justify-center text-[11px] font-bold text-gold-400">
                      {rank}
                    </span>
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.swimming && (
                          <span className="px-1.5 py-0.5 text-[9px] rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            s.submerge(y-5)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Key: <span className="text-slate-300">{item.fullHex}</span> • DrawIdx: #{item.index}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px]">
                      L{item.layer}
                    </div>
                    <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] w-24 text-right">
                      y={item.y.toFixed(2)}
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded border ${
                          activePass === 3
                            ? 'bg-gold-500/20 border-gold-500 text-gold-300 font-bold'
                            : 'bg-dark-950 border-dark-800 text-slate-500'
                        }`}
                        title="Bits [59..48] (Shift 48)"
                      >
                        B2:0x{item.b2.toString(16).toUpperCase().padStart(3, '0')}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border ${
                          activePass === 2
                            ? 'bg-gold-500/20 border-gold-500 text-gold-300 font-bold'
                            : 'bg-dark-950 border-dark-800 text-slate-500'
                        }`}
                        title="Bits [47..36] (Shift 36)"
                      >
                        B1:0x{item.b1.toString(16).toUpperCase().padStart(3, '0')}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border ${
                          activePass === 1
                            ? 'bg-gold-500/20 border-gold-500 text-gold-300 font-bold'
                            : 'bg-dark-950 border-dark-800 text-slate-500'
                        }`}
                        title="Bits [35..24] (Shift 24)"
                      >
                        B0:0x{item.b0.toString(16).toUpperCase().padStart(3, '0')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-dark-800 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Shadow Trigger: First key where <code className="text-slate-200">(k &gt;&gt; 56) &gt;= 1</code> flushes all Layer 1 <code className="text-gold-300">lights.cast()</code> &amp; <code className="text-gold-300">drawShadow()</code></span>
            </div>
            <span className="text-emerald-400">Complexity: O(3N) strictly linear</span>
          </div>
        </div>
      </div>
    </div>
  );
};
