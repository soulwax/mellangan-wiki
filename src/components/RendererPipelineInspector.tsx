import React, { useState, useMemo } from 'react';
import { Layers, Sun, Monitor, Droplets, Sparkles } from 'lucide-react';

interface PassStep {
  id: string;
  pass: string;
  profSlot: string;
  target: string;
  blendMode: string;
  sourceFunc: string;
  summary: string;
  details: string[];
  code: string;
}

const RENDER_STEPS: PassStep[] = [
  {
    id: 'fit-aim',
    pass: 'Stage 0: Viewport Fit & Camera Aim',
    profSlot: 'Pre-Render',
    target: 'CPU Viewport State (vw × vh)',
    blendMode: 'N/A',
    sourceFunc: 'Screen::fit(window) & Camera::aim(screen)',
    summary: 'Adapts virtual canvas (480×270 up to 640×360) to window aspect ratio and snaps camera scroll (xOffset, yOffset).',
    details: [
      'Base virtual resolution is W = 480, H = 270 (16:9), expanding up to MAX_W = 640 or MAX_H = 360 so ultrawide/tall monitors show more world rather than stretching pixels.',
      'Screen::reach() computes extra diagonal radius beyond 480×270 so Spawner.cpp pushes monster spawn rings outside wider viewports.',
      'camera.aim(screen) sets xOffset and yOffset (with screen-shake offset) used to transform world coordinates (x, y) into viewport pixels (x - xOffset, y - yOffset).',
    ],
    code: `if (fw * H >= fh * W)
  vw = std::min(MAX_W, int(std::round(H * fw / fh))), vh = H;
else
  vw = W, vh = std::min(MAX_H, int(std::round(W * fh / fw)));`,
  },
  {
    id: 'pass-light',
    pass: 'Pass 1: Offscreen Additive Light Map & Scatter',
    profSlot: 'PROF_LIGHT',
    target: 'Screen::light (VK2DTexture 640×360)',
    blendMode: 'BLEND (Clear) -> ADD (Glows)',
    sourceFunc: 'Screen::beginLight(ambient) & Level::renderLight(s)',
    summary: 'Clears light map to daylight×sky×biome ambient, scatters visible props/surfaces, and stamps up to 240 additive point lights.',
    details: [
      'Clears Screen::light to lerpf(night, dawn, daylight) * air * sky using VK2D_BLEND_MODE_BLEND, then switches to VK2D_BLEND_MODE_ADD.',
      'Level::scatter(s) scans visible tiles to populate surfaces[] (water, ice, heightAt, isRamp), collects visible Prop instances, applies snow frost sprites, and computes wind tree sway.',
      'Player torch, kindled shrines, projectiles, particles, and luminous props call Screen::glow() (capped at lightBudget = 240) and register up to 16 shadow casters in LightField.',
    ],
    code: `void Screen::beginLight(Color ambient) {
  vk2dRendererSetTarget(light);
  vk2dRendererSetBlendMode(VK2D_BLEND_MODE_BLEND);
  color(ambient); vk2dRendererClear();
  vk2dRendererSetBlendMode(VK2D_BLEND_MODE_ADD);
  lightBudget = 240;
}`,
  },
  {
    id: 'pass-floor',
    pass: 'Pass 2A: Offscreen World Floor & Telegraphs',
    profSlot: 'PROF_FLOOR',
    target: 'Screen::world (VK2DTexture 640×360)',
    blendMode: 'VK2D_BLEND_MODE_BLEND',
    sourceFunc: 'Screen::beginWorld() & Level::renderFloor(s)',
    summary: 'Paints auto-tiled terrain, 3-biome barycentric blends, rain pools, snow cover, cliff walls, and boss ground telegraphs.',
    details: [
      'Binds Screen::world offscreen target and clears to {0.04, 0.03, 0.06, 1}.',
      'eachVisibleTile invokes FloorPainter::tile(x, y) to draw ground sprites, cumulative-alpha biome transitions, puddles, snow rims, cliff drop-shadows, and 3-part stairs.',
      'sky.renderGround(s) and events.render(s, *this) overlay footprints and encounter hazard rings directly onto the ground plane before any entities are drawn.',
    ],
    code: `prof_begin(PROF_FLOOR);
renderFloor(s);
sky.renderGround(s);
events.render(s, *this);
prof_end(PROF_FLOOR);`,
  },
  {
    id: 'pass-sort',
    pass: 'Pass 2B: Frustum Cull & 64-Bit Radix Y-Sort',
    profSlot: 'PROF_SORT',
    target: 'CPU Sort Buffers (keys, drawn)',
    blendMode: 'N/A',
    sourceFunc: 'Level::queue(SpriteObject *) & radixSort()',
    summary: 'Culls entities/particles to viewport + 48px margin, packs 64-bit [layer:8 | orderedBits(y):32 | idx:24] keys, and runs 3-pass 12-bit Radix sort.',
    details: [
      'Entities and particles outside s.visible(x, y, 48) are skipped prior to sorting.',
      'orderedBits(float(e->y)) converts IEEE-754 float Y coordinates into monotonically ordered unsigned 32-bit integers.',
      '3 passes of 12-bit counting histograms (count[4097] at shifts 24, 36, 48) sort all visible objects in strict O(3N) time with zero allocations.',
    ],
    code: `void Level::queue(SpriteObject *e) {
  keys.push_back(uint64_t(e->layer()) << 56 |
                 uint64_t(orderedBits(float(e->y))) << 24 | drawn.size());
  drawn.push_back(e);
}`,
  },
  {
    id: 'pass-draw',
    pass: 'Pass 2C/2D: Water Reflections, Shadows, Submersion & Sprites',
    profSlot: 'PROF_DRAW',
    target: 'Screen::world (VK2DTexture 640×360)',
    blendMode: 'VK2D_BLEND_MODE_BLEND',
    sourceFunc: 'Level::reflect(s), LightField::cast() & e->draw(s)',
    summary: 'Draws planar vertical water reflections, radial point-light cast shadows, waterline-clipped swimming sprites, and silhouette hit-flashes.',
    details: [
      'Level::reflect(s): When water or flood puddles are in view, activates s.mirror(floor(e->y), veil) so Screen::sprite flips y = 2*mirrorY - y and ys = -ys (capped at 48 enemy reflections).',
      'Unified Shadow Pass: Before the first layer 1 sprite draws, LightField::cast projects radial atlas::Shadow sprites away from nearby point lights, followed by e->drawShadow(s) (or water ripples if swimming).',
      'Waterline Submersion Clipping: If swimming(e) is true, s.submerge(floor(e->y) - 5) clips the sprite source height h = min(s.h, (waterline - topY) / ys) so legs disappear beneath the water surface!',
      'Zero-Shader Hit Flash: Screen::flash draws the base sprite from atlas and overlays the pre-baked white silhouette texture with alpha = min(amount, 1.0).',
    ],
    code: `if (swimming(e)) {
  s.submerge(std::floor(e->y) - 5);
  e->draw(s);
  s.emerge();
} else
  e->draw(s);`,
  },
  {
    id: 'pass-gui',
    pass: 'Pass 3: post.slang Composite & Native-Scale HUD/Menus',
    profSlot: 'Present',
    target: 'VK2D_TARGET_SCREEN (or screenTarget PNG)',
    blendMode: 'post.slang -> BLEND (GUI)',
    sourceFunc: 'Screen::beginGui(window, fx) & Hud::render()',
    summary: 'Composites world + light via post.slang (sharp bilinear, bloom, ACES, hurt CA, pause blur), then draws crisp native-pixel UI.',
    details: [
      'Computes integer-friendly pixel scale = min(w / vw, h / vh) and UI unit u = max(1, round(scale * 0.5)).',
      'Passes vk2dTextureGetID(light) in PostData so post.slang multiplies sharp-sampled albedo by lightAt(uv) * 1.6, adds 8-tap bloom, applies ACES tonemapping, and blurs/desaturates when pause > 0.',
      'HUD, WorldDebug (F8), and Menus draw directly to the window swapchain at native resolution using u-scaled coordinates and 1-unit drop-shadow bitmap text.',
    ],
    code: `PostData data{fx.time, fx.hurt, fx.lowHealth, vk2dTextureGetID(light),
              float(vw), float(vh), 0.85f, 0.02f, fx.pause, fx.shrine, scale, 0};
vk2dRendererDrawShader(post, &data, world, std::floor((w - vw * scale) / 2),
                       std::floor((h - vh * scale) / 2), scale, scale, ...);`,
  },
];

export const RendererPipelineInspector: React.FC = () => {
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(4);
  const [winW, setWinW] = useState<number>(1920);
  const [winH, setWinH] = useState<number>(1080);
  const [spriteY, setSpriteY] = useState<number>(140);
  const [isSwimming, setIsSwimming] = useState<boolean>(true);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [flashAmount, setFlashAmount] = useState<number>(0.0);

  const viewportMetrics = useMemo(() => {
    const W = 480;
    const H = 270;
    const MAX_W = 640;
    const MAX_H = 360;
    let vw = W;
    let vh = H;
    if (winW * H >= winH * W) {
      vw = Math.min(MAX_W, Math.round((H * winW) / winH));
      vh = H;
    } else {
      vw = W;
      vh = Math.min(MAX_H, Math.round((W * winH) / winW));
    }
    const scale = Math.min(winW / vw, winH / vh);
    const u = Math.max(1, Math.round(scale * 0.5));
    const reach = Math.max(
      0,
      Math.hypot(vw, vh) * 0.5 - Math.hypot(W, H) * 0.5
    );
    const letterboxX = Math.floor((winW - vw * scale) / 2);
    const letterboxY = Math.floor((winH - vh * scale) / 2);
    return { vw, vh, scale, u, reach, letterboxX, letterboxY };
  }, [winW, winH]);

  const activeStep = RENDER_STEPS[selectedStepIdx];
  const waterline = Math.floor(spriteY) - 5;
  const topY = spriteY - 16;
  const clippedH = isSwimming ? Math.min(16, Math.max(0, waterline - topY)) : 16;

  return (
    <div className="my-6 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
      <div className="border-b border-dark-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-dark-950/60">
        <div className="flex items-center gap-2.5">
          <Monitor className="w-4 h-4 text-emerald-400" />
          <span className="font-display font-bold text-sm tracking-wide text-slate-100">
            INTERACTIVE RENDERER INSPECTOR: MULTI-PASS FRAME GRAPH, SUBMERSION &amp; VIEWPORT MATH
          </span>
        </div>
        <span className="text-[11px] font-mono text-gold-300 bg-gold-500/10 px-2.5 py-1 rounded border border-gold-500/30">
          Screen.cpp + LevelRender.cpp + LightField.cpp
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Click a Frame-Graph Pass to Inspect State &amp; Targets:
          </div>
          {RENDER_STEPS.map((st, idx) => {
            const active = idx === selectedStepIdx;
            return (
              <button
                key={st.id}
                onClick={() => setSelectedStepIdx(idx)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  active
                    ? 'bg-dark-850 border-gold-500/60 shadow-md'
                    : 'bg-dark-950/60 hover:bg-dark-950 border-dark-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-100 font-display">
                    {st.pass}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-900 text-emerald-400 border border-dark-750">
                    {st.profSlot}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-gold-300 mt-1 truncate">
                  Target: {st.target}
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dark-800 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-slate-100 font-display">
                  {activeStep.pass}
                </h4>
                <div className="text-[11px] font-mono text-gold-400">
                  {activeStep.sourceFunc}
                </div>
              </div>
              <div className="text-right font-mono text-[11px]">
                <div className="text-sky-300">Blend: {activeStep.blendMode}</div>
                <div className="text-slate-400">{activeStep.target}</div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {activeStep.summary}
            </p>

            <ul className="space-y-1.5 text-xs text-slate-300">
              {activeStep.details.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gold-400 font-mono">•</span>
                  <span className="leading-relaxed">{d}</span>
                </li>
              ))}
            </ul>

            <pre className="p-3 rounded-lg bg-dark-900 border border-dark-750 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              {activeStep.code}
            </pre>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-sky-400 font-semibold">
                <Droplets className="w-3.5 h-3.5" />
                <span>Submersion, Reflection &amp; Silhouette Lab</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSwimming}
                    onChange={(e) => setIsSwimming(e.target.checked)}
                    className="accent-sky-400"
                  />
                  swimming(e)
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMirrored}
                    onChange={(e) => setIsMirrored(e.target.checked)}
                    className="accent-purple-400"
                  />
                  Level::reflect()
                </label>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Screen::flash(amount) [0x00FFFFFF Silhouette]</span>
                  <span className="text-gold-300">{flashAmount.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={flashAmount}
                  onChange={(e) => setFlashAmount(parseFloat(e.target.value))}
                  className="w-full accent-gold-400"
                />
              </div>

              <div className="text-[11px] font-mono text-slate-300 bg-dark-900 p-2.5 rounded border border-dark-750 space-y-1">
                <div>
                  Foot Y: <span className="text-slate-100">{spriteY}.0</span> | Waterline:{' '}
                  <span className="text-sky-300">{isSwimming ? `${waterline}.0` : 'Off'}</span>
                </div>
                <div>
                  Source UV Height <code>h</code>:{' '}
                  <span className="text-emerald-300">{clippedH}px / 16px</span>{' '}
                  {isSwimming && '(Bottom 5px Clipped!)'}
                </div>
                {isMirrored && (
                  <div className="text-purple-300">
                    Reflection: y&apos; = 2*{spriteY} - y, ys = -1, veil = (0.55, 0.66, 0.9)
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Screen::fit(window) Aspect Calculator</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: '1920×1080 (16:9)', w: 1920, h: 1080 },
                  { label: '2560×1080 (21:9)', w: 2560, h: 1080 },
                  { label: '1920×1200 (16:10)', w: 1920, h: 1200 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setWinW(p.w);
                      setWinH(p.h);
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-mono border ${
                      winW === p.w && winH === p.h
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-dark-900 border-dark-750 text-slate-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono text-slate-300 bg-dark-900 p-2.5 rounded border border-dark-750 space-y-1">
                <div>
                  Virtual World Target: <span className="text-emerald-300">{viewportMetrics.vw} × {viewportMetrics.vh}</span> (Max 640×360)
                </div>
                <div>
                  Upscale <code>scale</code>: <span className="text-gold-300">{viewportMetrics.scale.toFixed(2)}x</span> | UI Unit <code>u</code>:{' '}
                  <span className="text-sky-300">{viewportMetrics.u}px</span>
                </div>
                <div>
                  Spawner <code>reach()</code> Bonus: <span className="text-purple-300">+{viewportMetrics.reach.toFixed(1)}px</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
