import React, { useState, useMemo } from 'react';
import { Palette, Sparkles, Grid, Eye, Copy, Check, RotateCcw } from 'lucide-react';
import { highlightCodeToHtml } from '../utils/highlightCode';

type Tone = 0 | 1 | 2 | 3;

interface PresetSprite {
  name: string;
  band: string;
  cellIndex: number;
  pal: [string, string, string];
  pyPal: string;
  rows: string[];
}

const PRESETS: PresetSprite[] = [
  {
    name: 'Tempest Chakram (Weapon)',
    band: 'expansion actors',
    cellIndex: 18,
    pal: ['#38bdf8', '#7dd3fc', '#e0f2fe'],
    pyPal: '((56, 189, 248), (125, 211, 252), (224, 242, 254))',
    rows: [
      '................',
      '.....######.....',
      '...##++++++##...',
      '..#++......++#..',
      '.#+..######..+#.',
      '.#+.#......#.+#.',
      '#+..#..++..#..+#',
      '#+..#.++++.#..+#',
      '#+..#.++++.#..+#',
      '#+..#..++..#..+#',
      '.#+.#......#.+#.',
      '.#+..######..+#.',
      '..#++......++#..',
      '...##++++++##...',
      '.....######.....',
      '................',
    ],
  },
  {
    name: 'Sporeling Cap (Monster)',
    band: 'expansion actors',
    cellIndex: 6,
    pal: ['#15803d', '#4ade80', '#bbf7d0'],
    pyPal: '((21, 128, 61), (74, 222, 128), (187, 247, 208))',
    rows: [
      '................',
      '.....######.....',
      '...##++++++##...',
      '..#++++..++++#..',
      '.#+++..++..+++#.',
      '.#++++++++++++#.',
      '.##############.',
      '....#......#....',
      '....#.+..+.#....',
      '....#......#....',
      '....########....',
      '...#..#..#..#...',
      '...#..#..#..#...',
      '................',
      '................',
      '................',
    ],
  },
  {
    name: 'Resonance Shard (Prop)',
    band: 'expansion biome props',
    cellIndex: 14,
    pal: ['#7e22ce', '#c084fc', '#f3e8ff'],
    pyPal: '((126, 34, 206), (192, 132, 252), (243, 232, 255))',
    rows: [
      '................',
      '.......++.......',
      '......++++......',
      '.....++##++.....',
      '.....+####+.....',
      '....++####++....',
      '....+######+....',
      '...++######++...',
      '...+########+...',
      '....+######+....',
      '....########....',
      '.....######.....',
      '......####......',
      '.......##.......',
      '................',
      '................',
    ],
  },
];

export const PixelShaderStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pixel' | 'shader'>('pixel');
  const [presetIdx, setPresetIdx] = useState<number>(0);
  const [brushTone, setBrushTone] = useState<Tone>(2);
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [showGutter, setShowGutter] = useState<boolean>(true);
  const [copiedPy, setCopiedPy] = useState<boolean>(false);

  const [grid, setGrid] = useState<Tone[][]>(() => {
    return PRESETS[0].rows.map((r) =>
      r.split('').map((ch) => (ch === '+' ? 3 : ch === '#' ? 2 : 0))
    );
  });

  const [hurt, setHurt] = useState<number>(0.15);
  const [lowHealth, setLowHealth] = useState<number>(0.2);
  const [vignette, setVignette] = useState<number>(0.65);
  const [pause, setPause] = useState<number>(0.0);
  const [lightBoost, setLightBoost] = useState<number>(1.6);

  const loadPreset = (idx: number) => {
    setPresetIdx(idx);
    const p = PRESETS[idx];
    setGrid(
      p.rows.map((r) =>
        r.split('').map((ch) => (ch === '+' ? 3 : ch === '#' ? 2 : 0))
      )
    );
  };

  const clearGrid = () => {
    setGrid(Array.from({ length: 16 }, () => Array(16).fill(0) as Tone[]));
  };

  const toggleCell = (x: number, y: number) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[y][x] = next[y][x] === brushTone ? 0 : brushTone;
      return next;
    });
  };

  const outlineMask = useMemo(() => {
    const mask = Array.from({ length: 16 }, () => Array(16).fill(false));
    if (!showOutline) return mask;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (grid[y][x] !== 0) continue;
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < 16 && ny >= 0 && ny < 16 && grid[ny][nx] !== 0) {
            mask[y][x] = true;
            break;
          }
        }
      }
    }
    return mask;
  }, [grid, showOutline]);

  const pythonSnippet = useMemo(() => {
    const p = PRESETS[presetIdx];
    const bodyRows = grid.map((row) =>
      row.map((cell) => (cell > 0 ? '#' : '.')).join('')
    );
    const hiRows = grid.map((row) =>
      row.map((cell) => (cell === 3 ? '+' : '.')).join('')
    );
    return `def paint_custom_sprite():
    c = Canvas(16, 16)
    pal = ${p.pyPal}
    body = [
${bodyRows.map((r) => `        "${r}",`).join('\n')}
    ]
    hi = [
${hiRows.map((r) => `        "${r}",`).join('\n')}
    ]
    c.cluster(0, 0, body, pal[1])
    c.cluster(0, 0, hi, pal[2])
    return c.image(outline=${showOutline ? 'True' : 'False'})`;
  }, [grid, presetIdx, showOutline]);

  const copyPython = () => {
    navigator.clipboard.writeText(pythonSnippet);
    setCopiedPy(true);
    setTimeout(() => setCopiedPy(false), 1600);
  };

  const preset = PRESETS[presetIdx];

  return (
    <div className="my-6 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
      <div className="border-b border-dark-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-dark-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-display font-bold text-sm tracking-wide text-slate-100">
            INTERACTIVE STUDIO: 16×16 PROCEDURAL PIXEL PAINTER &amp; SLANG POST-FX LAB
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('pixel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
              activeTab === 'pixel'
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/50'
                : 'bg-dark-900 text-slate-400 hover:text-slate-200 border border-dark-750'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>1. sprite_kit.py 16×16 Painter</span>
          </button>
          <button
            onClick={() => setActiveTab('shader')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
              activeTab === 'shader'
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/50'
                : 'bg-dark-900 text-slate-400 hover:text-slate-200 border border-dark-750'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>2. post.slang ConstantBuffer Lab</span>
          </button>
        </div>
      </div>

      {activeTab === 'pixel' && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                {PRESETS.map((p, idx) => (
                  <button
                    key={p.name}
                    onClick={() => loadPreset(idx)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                      presetIdx === idx
                        ? 'bg-gold-500/20 border-gold-500/50 text-gold-300'
                        : 'bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Preset {idx + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={clearGrid}
                className="px-2 py-1 rounded text-[11px] font-mono bg-dark-950 border border-dark-750 text-slate-400 hover:text-rose-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>

            <div
              className={`p-2 rounded-xl border ${
                showGutter
                  ? 'border-rose-500/50 bg-rose-950/20'
                  : 'border-dark-750 bg-dark-950'
              }`}
            >
              {showGutter && (
                <div className="text-[10px] font-mono text-rose-300 text-center mb-1">
                  18×18 Atlas Cell (Outer 1px = Mandatory Transparent Gutter)
                </div>
              )}
              <div
                className="grid gap-[1px] bg-dark-800 p-[1px] rounded"
                style={{
                  gridTemplateColumns: `repeat(${showGutter ? 18 : 16}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: showGutter ? 18 : 16 }).map((_, ry) =>
                  Array.from({ length: showGutter ? 18 : 16 }).map((__, rx) => {
                    const isGutter =
                      showGutter && (rx === 0 || ry === 0 || rx === 17 || ry === 17);
                    if (isGutter) {
                      return (
                        <div
                          key={`${rx}-${ry}`}
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-500/15 border border-rose-500/20"
                          title="1px Transparent Gutter (Must stay RGBA 0,0,0,0)"
                        />
                      );
                    }
                    const x = showGutter ? rx - 1 : rx;
                    const y = showGutter ? ry - 1 : ry;
                    const cell = grid[y][x];
                    const isOutline = outlineMask[y][x];
                    let bg = '#0d0b14';
                    if (cell === 1) bg = preset.pal[0];
                    else if (cell === 2) bg = preset.pal[1];
                    else if (cell === 3) bg = preset.pal[2];
                    else if (isOutline) bg = 'rgb(63, 38, 49)';

                    return (
                      <button
                        key={`${rx}-${ry}`}
                        onClick={() => toggleCell(x, y)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform hover:scale-110 focus:outline-none"
                        style={{ backgroundColor: bg }}
                        title={`(${x}, ${y})`}
                      />
                    );
                  })
                )}
              </div>
            </div>

            <div className="w-full mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-gold-400" />
                <button
                  onClick={() => setBrushTone(1)}
                  className={`px-2 py-1 rounded border ${
                    brushTone === 1 ? 'border-white text-white' : 'border-dark-700 text-slate-400'
                  }`}
                  style={{ backgroundColor: preset.pal[0] + '33' }}
                >
                  Shadow
                </button>
                <button
                  onClick={() => setBrushTone(2)}
                  className={`px-2 py-1 rounded border ${
                    brushTone === 2 ? 'border-white text-white' : 'border-dark-700 text-slate-400'
                  }`}
                  style={{ backgroundColor: preset.pal[1] + '33' }}
                >
                  Mid (#)
                </button>
                <button
                  onClick={() => setBrushTone(3)}
                  className={`px-2 py-1 rounded border ${
                    brushTone === 3 ? 'border-white text-white' : 'border-dark-700 text-slate-400'
                  }`}
                  style={{ backgroundColor: preset.pal[2] + '33' }}
                >
                  Light (+)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOutline}
                    onChange={(e) => setShowOutline(e.target.checked)}
                    className="accent-gold-400"
                  />
                  Auto-Outline (63,38,49)
                </label>
                <label className="flex items-center gap-1 text-[11px] text-rose-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGutter}
                    onChange={(e) => setShowGutter(e.target.checked)}
                    className="accent-rose-400"
                  />
                  1px Gutter
                </label>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-gold-400 font-semibold">
                  Generated tools/sprite_kit.py Python Code
                </span>
                <button
                  onClick={copyPython}
                  className="px-2.5 py-1 rounded bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs font-mono text-slate-200 flex items-center gap-1.5"
                >
                  {copiedPy ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Python</span>
                    </>
                  )}
                </button>
              </div>
              <pre
                className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[310px]"
                dangerouslySetInnerHTML={{
                  __html: highlightCodeToHtml(pythonSnippet, 'python', true),
                }}
              />
            </div>

            <div className="mt-4 p-3 rounded-xl bg-dark-950/90 border border-dark-800 text-xs font-mono text-slate-300 space-y-1">
              <div className="text-gold-300 font-semibold">
                Why 1px Automatic Outline + 1px Transparent Gutter?
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <code>Canvas.image(outline=True)</code> automatically walks every painted pixel&apos;s 4-neighborhood and stamps <code>OUTLINE = (63, 38, 49, 255)</code> into empty neighbors inside the <code>16×16</code> tile. Then <code>place_cell(atlas, band, idx, img)</code> pastes at <code>+1, +1</code> inside the <code>18×18</code> cell so GPU bilinear filtering never bleeds across neighboring sprites!
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shader' && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-gold-400 font-semibold mb-1">
              res/shaders/post.slang — ConstantBuffer&lt;PostData&gt; Uniforms
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">post.hurt (Chromatic Aberration + Crimson Edge)</span>
                <span className="text-rose-400">{hurt.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={hurt}
                onChange={(e) => setHurt(parseFloat(e.target.value))}
                className="w-full accent-rose-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">post.lowHealth (7 Hz Heartbeat Edge Pulse)</span>
                <span className="text-amber-400">{lowHealth.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={lowHealth}
                onChange={(e) => setLowHealth(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">post.vignette (Smoothstep 0.55..1.25 Radial Falloff)</span>
                <span className="text-sky-400">{vignette.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vignette}
                onChange={(e) => setVignette(parseFloat(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">post.pause (4-Tap Box Blur + Cool Slate Desaturation)</span>
                <span className="text-purple-400">{pause.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={pause}
                onChange={(e) => setPause(parseFloat(e.target.value))}
                className="w-full accent-purple-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">lightAt(uv) Multiplier (0.625 Neutral * 1.6 Over-Exposure)</span>
                <span className="text-emerald-400">{lightBoost.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={2.4}
                step={0.1}
                value={lightBoost}
                onChange={(e) => setLightBoost(parseFloat(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-between gap-4">
            <div
              className="relative h-48 rounded-xl border border-dark-750 overflow-hidden flex items-center justify-center transition-all"
              style={{
                background: `radial-gradient(circle at 50% 50%, rgba(246, 195, 36, ${0.18 * lightBoost}), rgba(15, 23, 42, 0.96) ${Math.round(
                  (1.15 - vignette * 0.45) * 100
                )}%)`,
                boxShadow: `inset 0 0 ${Math.round(30 + hurt * 60 + lowHealth * 45)}px rgba(225, 29, 72, ${Math.min(
                  0.85,
                  hurt * 0.55 + lowHealth * 0.45
                )})`,
                filter: `blur(${(pause * 2.2).toFixed(1)}px) saturate(${(
                  1.12 -
                  pause * 0.65
                ).toFixed(2)})`,
              }}
            >
              <div className="text-center px-4">
                <div
                  className="font-display font-black text-lg tracking-wider text-slate-100"
                  style={{
                    textShadow: `${(hurt * 4.5).toFixed(1)}px 0 0 rgba(244,63,94,0.8), -${(
                      hurt * 4.5
                    ).toFixed(1)}px 0 0 rgba(56,189,248,0.8)`,
                  }}
                >
                  ACES(albedo * lightAt * 1.15)
                </div>
                <div className="text-xs font-mono text-slate-300 mt-1">
                  CA Offset: <span className="text-rose-300">{(0.35 + hurt * 4.0).toFixed(2)}px</span> • Blur Tap:{' '}
                  <span className="text-purple-300">{(1.8 * pause).toFixed(2)}px</span> • Neutral Light:{' '}
                  <span className="text-emerald-300">{(0.625 * lightBoost).toFixed(2)}</span>
                </div>
              </div>
              <div className="absolute bottom-2 right-3 flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <Eye className="w-3 h-3 text-gold-400" />
                <span>Live Composite Preview</span>
              </div>
            </div>

            <pre
              className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: highlightCodeToHtml(
                  `float2 ca = n * (0.35 + post.hurt * 4.0); // = n * ${(0.35 + hurt * 4.0).toFixed(2)}\nfloat3 albedo = float3(albedoAt(uv + ca).r, albedoAt(uv).g, albedoAt(uv - ca).b);\nfloat3 col = aces((albedo * lightAt(uv) + min(bloom * 0.06, 0.2)) * 1.15);\ncol *= 1.0 - smoothstep(0.55, 1.25, dist) * ${vignette.toFixed(2)};`,
                  'slang',
                  true,
                ),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

