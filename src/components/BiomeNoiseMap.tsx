import React, { useState, useEffect, useRef } from 'react';
import { Compass, Sliders, MapPin, Sparkles } from 'lucide-react';

interface BiomeInfo {
  name: string;
  color: string;
  category: string;
  description: string;
}

const BIOME_DATA: Record<string, BiomeInfo> = {
  MEADOW: { name: 'Meadow', color: '#4ade80', category: 'Temperate', description: 'Gentle grassy plains with timber staircases and wild blossoms.' },
  SAVANNA: { name: 'The Savanna', color: '#facc15', category: 'Arid', description: 'Golden sunlit plains, acacia trees, and wandering hyenas.' },
  SNOW: { name: 'Snowfields', color: '#93c5fd', category: 'Frozen', description: 'Frigid tundra, frozen giants, and biting blizzards.' },
  DESERT: { name: 'Desert', color: '#fb923c', category: 'Arid', description: 'Sandstone dunes, stranded shipwrecks, and violent sandstorms.' },
  MIRE: { name: 'Mire', color: '#2dd4bf', category: 'Wetland', description: 'Murky swamp waters, toxic bog gases, and glowing mushrooms.' },
  JUNGLE: { name: 'Jungle', color: '#16a34a', category: 'Tropical', description: 'Dense canopy, grasping vines, and ancient stone ruins.' },
  BADLANDS: { name: 'Badlands', color: '#c2410c', category: 'Volcanic', description: 'Scorched red clay, ember forges, and basalt plateaus.' },
  TAIGA: { name: 'Taiga', color: '#0284c7', category: 'Subarctic', description: 'Evergreen pine forests, wolves, and frosted trails.' },
};

export const BiomeNoiseMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState<number>(1337);
  const [scale, setScale] = useState<number>(0.05);
  const [selectedCoord, setSelectedCoord] = useState<{ x: number; y: number; temp: number; moist: number; biome: string }>({
    x: 0,
    y: 0,
    temp: 0.15,
    moist: -0.1,
    biome: 'SAVANNA',
  });

  const pseudoNoise = (x: number, y: number, s: number) => {
    const val = Math.sin(x * 12.9898 + y * 78.233 + s * 43.123) * 43758.5453;
    return val - Math.floor(val);
  };

  const sampleTerrain = (x: number, y: number, s: number) => {
    const temp = Math.sin(x * scale + s) * 0.5 + Math.cos(y * scale * 0.8 + s * 1.5) * 0.5;
    const moist = Math.cos(x * scale * 0.7 - s * 0.8) * 0.5 + Math.sin(y * scale + s * 0.5) * 0.5;

    let biome = 'MEADOW';
    if (temp < -0.25) biome = 'SNOW';
    else if (temp < -0.1 && moist > 0.1) biome = 'TAIGA';
    else if (temp > 0.15 && moist < -0.15) biome = 'DESERT';
    else if (temp > 0.15 && moist < 0.05) biome = 'SAVANNA';
    else if (temp > 0.15 && moist > 0.12) biome = 'JUNGLE';
    else if (moist > 0.22) biome = 'MIRE';
    else if (temp > 0.1 && moist < -0.1) biome = 'BADLANDS';

    return { temp, moist, biome };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const nx = px - width / 2;
        const ny = py - height / 2;
        const { biome } = sampleTerrain(nx, ny, seed);
        const info = BIOME_DATA[biome] || BIOME_DATA.MEADOW;

        // Parse hex color
        const hex = info.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        const idx = (py * width + px) * 4;
        imgData.data[idx] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 230;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [seed, scale]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const py = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const nx = px - canvas.width / 2;
    const ny = py - canvas.height / 2;
    const { temp, moist, biome } = sampleTerrain(nx, ny, seed);
    setSelectedCoord({ x: nx, y: ny, temp, moist, biome });
  };

  const selectedBiomeInfo = BIOME_DATA[selectedCoord.biome] || BIOME_DATA.MEADOW;

  return (
    <div className="my-8 rounded-xl border border-dark-700 bg-dark-900/90 overflow-hidden shadow-2xl backdrop-blur-sm">
      <div className="px-5 py-3 bg-dark-850/90 border-b border-dark-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-gold-400" />
          <span className="font-mono text-sm font-semibold text-slate-200">
            Procedural World Generation & Noise Lattice
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-dark-750 text-slate-400 font-mono">
            Deterministic Voronoi/FBM
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSeed((s) => s + 71)}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-dark-750 hover:bg-dark-700 border border-dark-600 text-xs font-mono text-gold-300 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reroll Seed #{seed}</span>
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Canvas preview */}
        <div className="md:col-span-7 flex flex-col items-center">
          <div className="relative rounded-lg overflow-hidden border border-dark-700 shadow-inner group cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={260}
              height={180}
              onClick={handleCanvasClick}
              className="w-full max-w-[420px] h-auto image-pixelated block"
            />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-dark-950/80 backdrop-blur-sm border border-dark-700/80 text-[10px] font-mono text-slate-300 pointer-events-none">
              Click map to inspect tile coordinates
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 w-full max-w-[420px]">
            <span className="text-xs font-mono text-slate-400">Scale:</span>
            <input
              type="range"
              min="0.02"
              max="0.10"
              step="0.005"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-gold-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Selected Biome Card */}
        <div className="md:col-span-5 flex flex-col justify-between h-full bg-dark-850/80 p-5 rounded-xl border border-dark-700/70">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Lattice Node Sample
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${selectedBiomeInfo.color}25`,
                  color: selectedBiomeInfo.color,
                }}
              >
                {selectedBiomeInfo.category}
              </span>
            </div>
            <h4
              className="text-xl font-bold font-display tracking-wide mb-2"
              style={{ color: selectedBiomeInfo.color }}
            >
              {selectedBiomeInfo.name}
            </h4>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              {selectedBiomeInfo.description}
            </p>
          </div>

          <div className="space-y-2 border-t border-dark-750/70 pt-3 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Tile Coordinate:</span>
              <span className="text-slate-200">
                ({selectedCoord.x}, {selectedCoord.y})
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Temperature:</span>
              <span className="text-amber-300">{selectedCoord.temp.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Moisture:</span>
              <span className="text-sky-300">{selectedCoord.moist.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Cell Boundary:</span>
              <span className="text-emerald-400">Voronoi BIOME_CELL (32)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
