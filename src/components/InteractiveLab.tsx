import { lazy, Suspense, type ComponentType } from "react";
import type { WikiSection } from "../data/wikiContent";

type LabName = NonNullable<WikiSection["interactiveComponent"]>;

// Keep the chapter-to-component mapping in one place. Each module loads only
// when its chapter is opened.
const labs: Record<LabName, ComponentType> = {
  farming: lazy(() => import("./FarmingLab").then(m => ({ default: m.FarmingLab }))),
  gameloop: lazy(() => import("./InteractiveGameLoop").then(m => ({ default: m.InteractiveGameLoop }))),
  radix: lazy(() => import("./RadixDepthSorter").then(m => ({ default: m.RadixDepthSorter }))),
  slab: lazy(() => import("./SlabMemoryVisualizer").then(m => ({ default: m.SlabMemoryVisualizer }))),
  spatial: lazy(() => import("./SpatialGridVisualizer").then(m => ({ default: m.SpatialGridVisualizer }))),
  ouroboros: lazy(() => import("./OuroborosBitLab").then(m => ({ default: m.OuroborosBitLab }))),
  noise: lazy(() => import("./BiomeNoiseMap").then(m => ({ default: m.BiomeNoiseMap }))),
  arsenal: lazy(() => import("./RecipeArsenalExplorer").then(m => ({ default: m.RecipeArsenalExplorer }))),
  contribute: lazy(() => import("./ContributorTutorialWizard").then(m => ({ default: m.ContributorTutorialWizard }))),
  pixelshader: lazy(() => import("./PixelShaderStudio").then(m => ({ default: m.PixelShaderStudio }))),
  terrain: lazy(() => import("./TerrainConstructionLab").then(m => ({ default: m.TerrainConstructionLab }))),
  renderer: lazy(() => import("./RendererPipelineInspector").then(m => ({ default: m.RendererPipelineInspector }))),
  director: lazy(() => import("./CombatDirectorSimulator").then(m => ({ default: m.CombatDirectorSimulator }))),
  goalai: lazy(() => import("./GoalAiConcurrencyLab").then(m => ({ default: m.GoalAiConcurrencyLab }))),
  loot: lazy(() => import("./LootAffixSimulator").then(m => ({ default: m.LootAffixSimulator }))),
  gearevents: lazy(() => import("./GearEventsHudLab").then(m => ({ default: m.GearEventsHudLab }))),
  refugee: lazy(() => import("./RefugeeEscortWatchtowerLab").then(m => ({ default: m.RefugeeEscortWatchtowerLab }))),
  audiomixer: lazy(() => import("./AudioMixerVoiceStealingLab").then(m => ({ default: m.AudioMixerVoiceStealingLab }))),
  weather: lazy(() => import("./SkyWeatherFootprintsLab").then(m => ({ default: m.SkyWeatherFootprintsLab }))),
  "engine-math": lazy(() => import("./EngineMathLab").then(m => ({ default: m.EngineMathLab }))),
  "status-resistance": lazy(() => import("./StatusResistanceLab").then(m => ({ default: m.StatusResistanceLab }))),
  "input-response": lazy(() => import("./InputResponseLab").then(m => ({ default: m.InputResponseLab }))),
};

export function InteractiveLab({ name }: { name: LabName }) {
  const Lab = labs[name];
  return <Suspense fallback={<p role="status" className="p-4 text-sm text-slate-400">Loading simulation...</p>}><Lab /></Suspense>;
}
