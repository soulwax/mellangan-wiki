import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Expand, X } from "lucide-react";

type GalleryFilter = "All" | "Phases" | "Biomes" | "Battles" | "Places";

interface GalleryImage {
  file: string;
  title: string;
  caption: string;
  categories: GalleryFilter[];
}

const images: GalleryImage[] = [
  { file: "01-meadow-day.png", title: "First light", caption: "The meadow at the start of a journey.", categories: ["Phases", "Biomes"] },
  { file: "02-forest-dusk.png", title: "Forest at dusk", caption: "The tree line as daylight fades.", categories: ["Phases", "Biomes"] },
  { file: "03-snowfields.png", title: "Snowfields", caption: "A cold stretch of the overworld.", categories: ["Biomes"] },
  { file: "04-desert.png", title: "Desert", caption: "Warm sand and sparse cover.", categories: ["Biomes"] },
  { file: "05-mire.png", title: "Mire", caption: "Wet ground under a dim sky.", categories: ["Biomes"] },
  { file: "06-ashlands.png", title: "Ashlands by night", caption: "A hostile landscape after dark.", categories: ["Phases", "Biomes"] },
  { file: "07-shrine.png", title: "Wayside shrine", caption: "One of the landmarks that draws a run across the map.", categories: ["Places"] },
  { file: "08-forest-battle.png", title: "Forest skirmish", caption: "A ring of enemies closes in beneath the trees.", categories: ["Battles"] },
  { file: "09-desert-battle.png", title: "Desert encounter", caption: "Demons and scavengers converge across open sand.", categories: ["Battles"] },
  { file: "10-cave.png", title: "Below the surface", caption: "The first descent into the caves.", categories: ["Places"] },
  { file: "11-deep-halls.png", title: "Deep halls", caption: "A hall far below the open world.", categories: ["Places"] },
];

const filters: GalleryFilter[] = ["All", "Phases", "Biomes", "Battles", "Places"];

export function GalleryPage() {
  const [filter, setFilter] = useState<GalleryFilter>("All");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const visible = useMemo(() => images.filter((item) => filter === "All" || item.categories.includes(filter)), [filter]);
  const openIndex = visible.findIndex((item) => item.file === openFile);
  const selected = openIndex >= 0 ? visible[openIndex] : null;

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFile(null);
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setOpenFile(visible[(openIndex - 1 + visible.length) % visible.length].file);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setOpenFile(visible[(openIndex + 1) % visible.length].file);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected, visible, openIndex]);

  return (
    <section aria-label="Game image gallery" className="mt-7">
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter gallery images">
        {filters.map((item) => (
          <button key={item} type="button" aria-pressed={filter === item} onClick={() => { setFilter(item); setOpenFile(null); }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${filter === item ? "border-gold-400 bg-gold-400/15 text-gold-200" : "border-dark-700 bg-dark-900 text-slate-300 hover:border-gold-500/50 hover:text-slate-100"}`}>
            {item}
          </button>
        ))}
        <span className="self-center ml-auto text-xs font-mono text-slate-500">{visible.length} images</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {visible.map((item, index) => (
          <button key={item.file} type="button" onClick={() => setOpenFile(item.file)}
            aria-label={`Open image ${index + 1}: ${item.title}`}
            className="group overflow-hidden rounded-xl border border-dark-750 bg-dark-900/70 text-left transition-colors hover:border-gold-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
            <div className="relative aspect-video overflow-hidden bg-dark-950">
              <img src={`/gallery/${item.file}`} alt={item.caption} loading={index < 2 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" style={{ imageRendering: "pixelated" }} />
              <span className="absolute right-3 top-3 rounded-md bg-dark-950/75 p-1.5 text-slate-100 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Expand size={16} /></span>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3"><h3 className="font-display text-lg font-bold text-slate-100">{item.title}</h3><span className="text-[10px] font-mono text-gold-300">{String(index + 1).padStart(2, "0")}</span></div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{item.caption}</p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`${selected.title} enlarged`} onClick={() => setOpenFile(null)}>
          <div className="relative flex max-h-full w-full max-w-[1500px] flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-4 text-slate-100"><div><strong className="font-display text-lg">{selected.title}</strong><span className="ml-3 text-xs font-mono text-slate-400">{openIndex + 1} / {visible.length}</span></div><button type="button" onClick={() => setOpenFile(null)} aria-label="Close image" className="rounded-lg border border-slate-600 p-2 hover:bg-white/10"><X size={20} /></button></div>
            <img src={`/gallery/${selected.file}`} alt={selected.caption} className="min-h-0 w-full flex-1 object-contain" style={{ imageRendering: "pixelated" }} />
            <div className="mt-3 flex items-center justify-between gap-3"><button type="button" aria-label="Previous image" onClick={() => setOpenFile(visible[(openIndex - 1 + visible.length) % visible.length].file)} className="rounded-lg border border-slate-600 p-2 text-slate-100 hover:bg-white/10"><ArrowLeft size={20} /></button><p className="text-center text-sm text-slate-300">{selected.caption}</p><button type="button" aria-label="Next image" onClick={() => setOpenFile(visible[(openIndex + 1) % visible.length].file)} className="rounded-lg border border-slate-600 p-2 text-slate-100 hover:bg-white/10"><ArrowRight size={20} /></button></div>
          </div>
        </div>
      )}
    </section>
  );
}
