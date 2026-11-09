export interface MermaidDiagramDef {
  title: string;
  chart: string;
}

export interface WikiSection {
  id: string;
  title: string;
  category:
    | "core"
    | "graphics"
    | "simulation"
    | "world"
    | "gameplay"
    | "contribute";
  summary: string;
  sourceFiles: string[];
  content: string;
  mermaidChart?: MermaidDiagramDef;
  mermaidCharts?: MermaidDiagramDef[];
  interactiveComponent?:
    | "gameloop"
    | "radix"
    | "slab"
    | "spatial"
    | "ouroboros"
    | "noise"
    | "arsenal"
    | "contribute"
    | "pixelshader"
    | "terrain"
    | "renderer"
    | "director"
    | "goalai"
    | "loot"
    | "gearevents"
    | "refugee"
    | "audiomixer"
    | "weather"
    | "engine-math"
    | "input-response"
    | "status-resistance";
}

export const WIKI_SECTIONS: WikiSection[] = [
  {
    id: "overview",
    title: "01. Engine Philosophy & 8-Slot Hardware Telemetry",
    category: "core",
    summary:
      'The C++20 "C with classes" architecture, Vulkan 1.2 baseline, 1,520B pool slabs, high-refresh easing, and telemetry.',
    sourceFiles: [
      "src/main.cpp",
      "src/Game.cpp",
      "src/Prof.c",
      "src/SpriteObject.hpp",
      "src/entity/Pool.c",
      "src/entity/ItemStats.hpp",
      "src/input/Input.hpp",
      "src/meta/Settings.hpp",
    ],
    content: `
### Architectural Paradigm: Pragmatic "C with Classes"

**Mellangan** is engineered in **C++20** and **C11** around a strict systems-programming ethos: data locality, predictable cache residency, and deterministic 60 Hz simulation (\`DT = 1.0 / 60.0\`). Rather than deep object-oriented wrapper hierarchies or heavy runtime polymorphism, the engine combines flat data structures, bitwise state packing, and lightweight virtual dispatch at the entity root (\`SpriteObject\`).

#### System Requirements & Hardware Baseline
* **Vulkan 1.2 Core:** The engine targets a clean Vulkan 1.2 feature set (leveraging MoltenVK on macOS Apple Silicon). Shader pipelines are pre-compiled to SPIR-V at build time using LunarG \`slangc\`.
* **Measured Reference Baseline:** Intel Iris Xe integrated graphics (8 logical cores, 16 GB RAM). In a 36-minute \`--soak\` stress run (550+ active entities on screen), the engine sustains 60 fps every minute with frame $p_{99}$ latency between 1.9 ms and 6.3 ms and total process memory stabilized at $\\sim 180\\text{ MB}$. \`--bench-gate\` holds 60 fps with a $p_{99}$ of $\\sim 8\\text{ ms}$ at 10,000 active enemies.
* **Windows SEH Minidump Crash Reporter:** An unhandled exception or abort records the version, world seed, active hero, and module offset backtrace to \`mellangan.log\`, writing a full \`crash.dmp\` minidump beside the executable (or redirecting to the user save directory if running from read-only application folders).

#### Core Engineering Invariants

1. **Zero Heap Thrashing via Expanded 1,520-Byte Pool Slabs (\`src/entity/Pool.c\`):**
   Every object inheriting from \`SpriteObject\` overrides \`operator new\` and sized \`operator delete(void *p, size_t size)\` to route directly into \`Pool.c\`, a 96-size-class, 16-byte-grained slab allocator backed by 64 KB contiguous memory blocks. Slab capacity extends to 1,520 bytes, guaranteeing zero-allocation instantiation for all 78 bestiary species. Compile-time assertions enforce that no monster class exceeds the 1,520-byte slab boundary.

2. **Decoupled Gear Footprint (\`ItemStats.hpp\`, 832-Byte Enemies):**
   Equipment modifiers (44 float attributes) are decoupled from the base creature footprint. Regular monsters without inventory items share an immutable, zero-initialized static block via \`bonus()\`, reducing standard enemy memory from 1,000 bytes down to 832 bytes (a 16.8% cache footprint reduction across 10,000 mobs). Mutable gear instances are allocated on demand via \`kit()\` only when a mob or hero equips items.

3. **Smooth High-Refresh Display Sub-Step Easing (120 Hz / 144 Hz+):**
   While game logic evaluates at a fixed 60 Hz step, visual rendering interpolates sprite positions, point light sources, and camera coordinates between simulation ticks using normalized fractional sub-step time $\\alpha \\in [0, 1)$:
   $x_{\\text{render}} = (1 - \\alpha) x_{\\text{prev}} + \\alpha x_{\\text{curr}}$
   Spatial discontinuities (such as blinks, teleports, or respawns exceeding 3 tiles / 48 pixels) automatically bypass interpolation and snap instantaneously to prevent smear artifacts. At 60 Hz or lower, interpolation incurs zero latency and zero computational overhead.

4. **Hardware Performance Counter Telemetry & F3 Profiler Graph (\`src/Prof.c\`):**
   Every tick and render pass is bracketed by \`prof_begin(slot)\` and \`prof_end(slot)\` using high-resolution \`SDL_GetPerformanceCounter()\` timers across 8 hardware telemetry slots:
   * \`PROF_THINK (0)\`: 4-barrier parallel enemy AI and soft-body crowd relaxation (\`Workers::run\`).
   * \`PROF_ENTITIES (1)\`: EnTT \`Owned\` iteration, status afflictions, and weapon cooldowns.
   * \`PROF_PARTICLES (2)\`: Particle kinematics and two-pointer in-place array compaction.
   * \`PROF_HOUSEKEEP (3)\`: Diurnal clock, wave spawning, CSR spatial grid rebuild, and deferred entity flush.
   * \`PROF_LIGHT (4)\`: Dynamic lightmap accumulation and \`LightField\` caster registration.
   * \`PROF_FLOOR (5)\`: 3-biome barycentric ground blending and 4-bit cardinal cliff auto-tiling.
   * \`PROF_SORT (6)\`: 64-bit sort key packing and 3-pass 12-bit LSD Radix Sort.
   * \`PROF_DRAW (7)\`: Planar water reflections, directional contact shadows, and sprite batching.
   Pressing F3 overlays a 120-frame stacked bar graph: blue represents simulation tick time, stacked beneath GPU render time. Bars turn gold when frame time exceeds 8.3 ms, and red when exceeding the 16.7 ms target budget.

5. **Full Gamepad Support & Dynamic Control Glyphs (SDL3):**
   Full analog gamepad integration provides variable-velocity stick steering with circular deadzones and debounced menu navigation. All on-screen button prompts and tutorial hints dynamically switch between keyboard glyphs and controller buttons based on the most recently used input device.

\`\`\`c
static Uint64 started[PROF_COUNT];
static double total[PROF_COUNT];
static const char *NAMES[PROF_COUNT] = {
  "think", "entities", "particles", "housekeep",
  "light", "floor",    "sort",      "draw"
};

void prof_begin(int slot) { started[slot] = SDL_GetPerformanceCounter(); }

void prof_end(int slot) {
  total[slot] += (double)(SDL_GetPerformanceCounter() - started[slot]) /
                 (double)SDL_GetPerformanceFrequency();
}
\`\`\`
`,

    mermaidCharts: [
      {
        title: "Engine Subsystem Dependency Topology",
        chart: `
flowchart TD
    classDef os fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef core fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef sim fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef gfx fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    subgraph Platform_Layer ["OS & Hardware Abstraction"]
        SDL3["SDL3 Platform<br/>(Events, HiRes Timer, 32-Voice Audio)"]:::os
        VK["Vulkan 1.2 Device<br/>(Extern/Vulkan2D Command Queues)"]:::os
    end

    subgraph Memory_Concurrency ["Memory & Concurrency Core"]
        Pool["Pool.c Slab Allocator<br/>(96 Size Classes, 64KB Pages, SRWLOCK)"]:::core
        Workers["Workers.cpp Thread Pool<br/>(Atomic Fetch-Add Chunk Stealing)"]:::core
        Prof["Prof.c Telemetry<br/>(8 Hardware Performance Slots)"]:::core
    end

    subgraph Simulation_Kernel ["Deterministic 60Hz Level Kernel"]
        ECS["EnTT Registry<br/>(Owned Lifecycle & Sparse Sets)"]:::sim
        CSR["LevelSpace.cpp<br/>(CSR Prefix-Sum Grid & Bit-Packed Terrain)"]:::sim
        AI["Goal.hpp / Plans.cpp<br/>(8-Slot Bitwise GoalQueue Ringbuffer)"]:::sim
        World["World & Noise.c<br/>(Voronoi Lattice, Barycentric Blend)"]:::sim
    end

    subgraph Render_Pipeline ["LevelRender.cpp & Screen.cpp"]
        Light["LightField.cpp<br/>(64 Shadow Casters & Perlin Flicker)"]:::gfx
        Radix["3-Pass 12-Bit Radix Sort<br/>(64-Bit Key: Layer | orderedBits(y) | Idx)"]:::gfx
        Reflect["Planar Water Mirror & Submerge<br/>(s.mirror / s.submerge)"]:::gfx
    end

    SDL3 --> Prof
    SDL3 --> ECS
    Pool --> ECS
    Workers --> AI
    ECS --> CSR
    World --> CSR
    CSR --> AI
    ECS --> Radix
    Light --> Radix
    Radix --> Reflect
    Reflect --> VK
`,
      },
      {
        title: "End-to-End Frame Lifecycle & Telemetry Sequence",
        chart: `
sequenceDiagram
    autonumber
    participant Main as Main Thread (Game.cpp)
    participant Level as Level.cpp (Tick & Flush)
    participant Workers as Workers.cpp (N-1 Threads)
    participant Render as LevelRender.cpp
    participant VK2D as Vulkan2D GPU

    Main->>Level: level.tick() [DT = 1/60s]
    Note over Level: PROF_HOUSEKEEP (Begin)
    Level->>Level: night.tick(), spawner.tick(), explore(), hunt()
    Level->>Level: buildGrid() -> CSR Prefix-Sum cellStart[] & cells[]
    Note over Level: PROF_HOUSEKEEP (End) / PROF_THINK (Begin)
    Level->>Workers: Barrier 1: workers.run(n, 256, Enemy::think)
    Workers-->>Level: Sense & GoalQueue -> xWant, yWant
    Level->>Workers: Barrier 2: workers.run(n, 256, Enemy::move)
    Workers-->>Level: Velocity integration & Level::collide
    Level->>Workers: Barrier 3: workers.run(n, 256, Enemy::push)
    Workers-->>Level: Read CSR Grid -> xPush, yPush
    Level->>Workers: Barrier 4: workers.run(n, 256, Enemy::settle)
    Workers-->>Level: Commit xPush, yPush & re-collide
    Note over Level: PROF_THINK (End) / PROF_ENTITIES & PARTICLES
    Level->>Level: Tick Owned Entities, Compact Particles, flush() Dead/Pending
    Main->>Render: renderLight(s) [PROF_LIGHT]
    Render->>VK2D: scatter() Surfaces/Props + Offscreen Lightmap Glows
    Main->>Render: render(s) [PROF_FLOOR -> PROF_SORT -> PROF_DRAW]
    Render->>Render: renderFloor(s) + 64-Bit Key Pack + 3-Pass LSD Radix Sort
    Render->>VK2D: Planar reflect(s) -> LightField Shadows -> Sorted Sprites
`,
      },
    ],
    interactiveComponent: "gameloop",
  },
  {
    id: "gallery",
    title: "Mellangan: A Tale in Eighteen Frames",
    category: "graphics",
    summary: "A Mage takes the road through bright fields, darkening woods, hard-won spoils, and the halls below.",
    sourceFiles: ["src/test/view/Gallery.cpp"],
    content: `
### Once, the road was green

The shrine was cold, the daylight generous, and the traveler had yet to learn what followed her. Then the woods grew quiet. The pictures tell what came next: the creatures, the glitter they left behind, and the road that went down into the earth.

Follow the frames in order, or choose a thread above. Open a frame for a closer look; the arrow keys turn the pages.
`,
  },
  {
    id: "radix-rendering",
    title: "02. 64-Bit Radix Y-Sort, Planar Reflections & LightField",
    category: "graphics",
    summary:
      "IEEE-754 monotonic conversion, 3-pass 12-bit LSD radix sort, high-refresh display easing, and CSR draw culling.",
    sourceFiles: [
      "src/level/LevelRender.cpp",
      "src/level/LightField.cpp",
      "src/gfx/Screen.cpp",
      "src/SpriteObject.hpp",
    ],
    content: `
### Strict $O(N)$ Depth Sorting via 64-Bit Key Packing

In a top-down 2.5D world with thousands of overlapping enemies, trees, projectiles, and particles, calling comparison-based \`std::sort\` ($O(N \\log N)$ with branch mispredictions and pointer indirections) every frame wastes precious CPU budget. \`src/level/LevelRender.cpp\` solves this in strictly linear $O(3N)$ time.

#### 1. IEEE-754 Float-to-Monotonic-Uint32 Bijection (\`orderedBits\`)
World \`y\` coordinates can be negative or positive IEEE-754 \`float\` values. Raw signed-magnitude IEEE-754 bit patterns do not sort monotonically as unsigned integers because negative numbers have MSB \`1\` and decrease as magnitude grows. \`orderedBits(float f)\` transforms any \`float\` into an order-preserving \`uint32_t\`:

\`\`\`cpp
uint32_t orderedBits(float f) {
  uint32_t u;
  std::memcpy(&u, &f, 4);
  return u ^ (uint32_t(int32_t(u) >> 31) | 0x80000000u);
}

void Level::queue(SpriteObject *e) {
  keys.push_back(uint64_t(e->layer()) << 56 |
                 uint64_t(orderedBits(float(e->y))) << 24 | drawn.size());
  drawn.push_back(e);
}
\`\`\`

* If \`f >= 0\`: Arithmetic right shift \`int32_t(u) >> 31\` is \`0\`, so the mask is \`0x80000000u\`, flipping only the sign bit (mapping $[+0, +\\infty)$ to $[0x80000000, 0xFFFFFFFF]$).
* If \`f < 0\`: Arithmetic right shift \`int32_t(u) >> 31\` is \`0xFFFFFFFF\`, flipping **all 32 bits** (mapping $(-\\infty, -0]$ to $[0x00000000, 0x7FFFFFFF]$).

#### 2. 3-Pass 12-Bit LSD Radix Sort (\`radixSort\`)
Because bits $[23..0]$ store the original insertion index \`drawn.size()\` (already monotonically increasing), the sort only needs to order bits $[59..24]$ (32 bits of \`orderedBits(y)\` plus 4 bits of \`layer\`). Three passes of 12-bit LSD Radix Sort (\`SHIFT = {24, 36, 48}\`, 4,096 histogram buckets) sort the entire scene with zero comparisons:

\`\`\`cpp
void radixSort(std::vector<uint64_t> &a, std::vector<uint64_t> &tmp) {
  static const int SHIFT[3] = {24, 36, 48};
  tmp.resize(a.size());
  for (int shift : SHIFT) {
    uint32_t count[4097] = {};
    for (uint64_t k : a)
      count[(k >> shift & 4095) + 1]++;
    for (int i = 1; i <= 4096; i++)
      count[i] += count[i - 1];
    for (uint64_t k : a)
      tmp[count[k >> shift & 4095]++] = k;
    a.swap(tmp);
  }
}
\`\`\`

#### 3. Spatial Draw Culling via CSR Crowd Grid
Rather than iterating every spawned monster in the world to perform frustum bounds testing, \`LevelRender.cpp\` queries the Compressed Sparse Row (CSR) spatial grid directly. Active view bounds are mapped to spatial grid cell intervals, harvesting only visible candidates into the sort queue in $O(\\text{visible})$ time, eliminating broad-phase render overhead.

#### 4. High-Refresh Sub-Step Easing & Discontinuity Snapping (\`SpriteObject.hpp\`)
High-refresh displays (120 Hz, 144 Hz, 240 Hz) receive smooth motion without altering the deterministic 60 Hz gameplay clock. When rendering between logic ticks, \`SpriteObject::blend(float a)\` calculates interpolated screen coordinates:

\`\`\`cpp
bool blend(float a) {
  double xd = x - xLast, yd = y - yLast;
  if (blended || !(xd * xd + yd * yd < 48 * 48))
    return false;
  xNow = x, yNow = y, zNow = z, blended = true;
  x = xLast + xd * a, y = yLast + yd * a, z = zLast + (z - zLast) * a;
  return true;
}
void unblend() {
  if (blended)
    x = xNow, y = yNow, z = zNow, blended = false;
}
\`\`\`

If spatial displacement exceeds 3 tiles ($48\\text{ px}$), such as a flash step, teleport, or respawn, \`blend()\` returns false and the sprite snaps directly, avoiding visual stretching or blurring across the map.

#### 5. Planar Water Reflections, Submerge Clipping & \`LightField\` Shadows
* **Planar Reflections (\`Level::reflect\`):** Before drawing Layer 1, if \`waterInView\` or \`sky.flood() > 0\`, entities standing adjacent to wet tiles are rendered upside-down via \`s.mirror(std::floor(e->y), tint)\`, capped at 48 crowd reflections to bound fillrate.
* **Layer-Transition Shadow Flush:** During the main draw loop over \`keys\`, the moment the first key with \`(k >> 56) >= 1\` is encountered, all Layer 1 occluders project radial contact shadows from up to 64 active point light casters (\`lights.cast(s, e->x, e->y, width, height)\`) before any Layer 1 sprite body is drawn.
* **Submerged Swimmer Clipping:** Entities wading in water (\`swimming(e)\`) replace their ground shadow with an animated water ripple (\`atlas::wx::ripple\`) and clip their lower torso via \`s.submerge(std::floor(e->y) - 5)\`.
`,

    mermaidCharts: [
      {
        title: "64-Bit Sort Key & 3-Pass 12-Bit Radix Sort Architecture",
        chart: `
flowchart TD
    classDef key fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef pass fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef draw fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    subgraph Key_Packing ["Level::queue(SpriteObject*)"]
        F["float e->y"]:::key
        OB["orderedBits(y)<br/>u ^ ((int32_t(u)>>31) | 0x80000000)"]:::key
        K["64-Bit Key<br/>[63..56] Layer | [55..24] OrdY | [23..0] DrawIdx"]:::key
        F --> OB --> K
    end

    subgraph Radix_Engine ["radixSort(keys, keysTmp)"]
        P1["Pass 1: Shift 24<br/>Bits [35..24] (Low 12b of Y)<br/>4096-Bucket Prefix Sum"]:::pass
        P2["Pass 2: Shift 36<br/>Bits [47..36] (Mid 12b of Y)<br/>4096-Bucket Prefix Sum"]:::pass
        P3["Pass 3: Shift 48<br/>Bits [59..48] (Top 8b Y + 4b Layer)<br/>4096-Bucket Prefix Sum"]:::pass
        P1 --> P2 --> P3
    end

    subgraph Draw_Submission ["Level::render(Screen&)"]
        L0["Layer 0: Ground Decals"]:::draw
        SH["Layer >= 1 Trigger:<br/>Flush LightField Contact Shadows"]:::draw
        L1["Layer 1: Props, Mobs & Swimmer Clipping"]:::draw
        L2["Layer 2: Overhead Tree Canopies"]:::draw
        L0 --> SH --> L1 --> L2
    end

    K --> P1
    P3 --> L0
`,
      },
      {
        title: "Dynamic LightField Contact Shadow & Perlin Flicker Pipeline",
        chart: `
flowchart TD
    classDef light fill:#181524,stroke:#f97316,stroke-width:2px,color:#e2e8f0;
    classDef math fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Torch["Torches, Braziers, Shrine Flames & Projectiles"]:::light
    Flicker["Dual-Octave Perlin Flicker<br/>1 + 0.10*perlin(3.1t) + 0.05*perlin(11.7t)"]:::math
    Caster["LightField::add(x, y, reach, strength)<br/>Up to 64 Active Casters"]:::light
    Occluder["SpriteObject::occlusion(width) -> height"]:::math
    Project["LightField::cast(Screen&, x, y, w, h)<br/>d = hypot(x - cx, y - cy), angle = atan2(yd, xd)"]:::math
    ShadowSprite["Render Oriented atlas::Shadow<br/>len = height * clamp(d/48, 0.35, 2.2)<br/>alpha = clamp(1.5 * strength * (1 - d/reach), 0, 1)"]:::out

    Torch --> Flicker --> Caster
    Caster --> Project
    Occluder --> Project
    Project --> ShadowSprite
`,
      },
    ],
    interactiveComponent: "radix",
  },
  {
    id: "memory-slab",
    title: "03. Intrusive Slab Allocator (Pool.c) & Sized Deallocation",
    category: "simulation",
    summary:
      "Zero-header C++ sized operator delete, 1,520B pool slabs, decoupled 832B enemy ItemStats, and status bitmasks.",
    sourceFiles: [
      "src/entity/Pool.c",
      "src/entity/Pool.h",
      "src/SpriteObject.hpp",
      "src/entity/ItemStats.hpp",
      "src/entity/Status.hpp",
    ],
    content: `
### Zero-Header Polymorphic Allocation via C++14 Sized \`operator delete\`

A classic dilemma in C++ game engines is how a custom allocator knows the size of a polymorphic object during \`delete basePtr;\` without prepending an 8-byte metadata header to every allocation (which ruins cache-line alignment). Mellangan solves this by combining \`virtual ~SpriteObject() = default;\` with the two-argument sized deallocation function in \`src/SpriteObject.hpp\`:

\`\`\`cpp
class SpriteObject {
public:
  virtual ~SpriteObject() = default;
  static void *operator new(size_t size) { return pool_alloc(size); }
  static void operator delete(void *p, size_t size) { pool_free(p, size); }
};
\`\`\`

When \`std::unique_ptr<Entity>\` or \`std::unique_ptr<SpriteObject>\` destroys an instance via its virtual destructor, the compiler-generated deleting destructor thunk inside the derived class's vtable passes the **exact compile-time \`sizeof(DerivedType)\`** to \`SpriteObject::operator delete(void *p, size_t size)\`!

### Inside \`src/entity/Pool.c\`

1. **Size Class Quantization & 1,520-Byte Slab Expansion:**
   Sizes are rounded up to multiples of 16 bytes via bit-shifting:
   \`classOf(size) = (size + 15) >> 4\`.
   The allocator supports 96 distinct size classes, handling allocations up to **1,520 bytes** directly within contiguous pre-allocated slab pages. In earlier versions, large monsters exceeding 512 bytes spilled into the system heap, causing micro-stutters during heavy wave spawns. With the 1,520-byte ceiling, every bestiary entity, boss, projectile, and particle is served by zero-fragmentation pool slabs.

2. **Decoupled Gear Footprint (\`ItemStats.hpp\`, 832-Byte Enemies):**
   Monster memory footprint was aggressively optimized by isolating equipment stat tables (44 float properties) into \`ItemStats\`. Because standard horde enemies do not equip gear, they share an immutable zero-initialized static instance:
   \`\`\`cpp
   const ItemStats &Mob::bonus() const { return gear ? *gear : NONE; }
   ItemStats &Mob::kit() {
     if (!gear) gear = std::make_unique<ItemStats>();
     return *gear;
   }
   \`\`\`
   This compacts the \`Enemy\` base struct from 1,000 bytes down to **832 bytes**, saving 1.68 MB of raw resident memory per 10,000 active monsters and dramatically enhancing CPU L2/L3 cache line utilization.

3. **Status Effect Bitmask Fast-Path (\`Status.hpp\`):**
   The \`Status\` affliction component caches active states in a compact 32-bit integer mask (\`live |= 1u << i\`). Common enemies with no active status ailments bypass array iteration completely during the 60 Hz tick loop:
   \`\`\`cpp
   float Status::power(StatusKind kind) const {
     if (!(live >> int(kind) & 1)) return 0;
     const auto &e = effects[int(kind)];
     return e.time > 0 ? e.power : 0;
   }
   \`\`\`

4. **64 KB Contiguous Slab Refills (\`SLAB = 65536\`):**
   When \`freeList[c]\` is empty, \`refill(c)\` allocates a single \`sizeof(Slab) + 65536\` block, links the \`Slab\` header into the global \`slabs\` chain for clean shutdown (\`pool_shutdown()\`), and carves the 64 KB payload in reverse order into an intrusive singly-linked list of \`Node { Node *next; }\`. Carve-in-reverse places the lowest memory address at the head of \`freeList[c]\`, ensuring sequential forward memory addresses on consecutive allocations!

5. **Platform-Native Lightweight Synchronization:**
   Pool operations are synchronized using Windows \`SRWLOCK\` (\`AcquireSRWLockExclusive\`) or POSIX \`pthread_mutex_t\`, incurring single-digit nanosecond lock acquisition times during multi-threaded allocations.
`,

    mermaidCharts: [
      {
        title: "Sized Virtual Destructor to Slab Size-Class Routing",
        chart: `
flowchart LR
    classDef cpp fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef pool fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef mem fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    New["new Spark(...) / new Wolf(...)"]:::cpp
    Del["delete basePtr (virtual ~SpriteObject)"]:::cpp
    ClassOf["classOf(size) = (size + 15) >> 4<br/>16B Grain, 96 Classes (16B..1520B)"]:::pool
    Lock["POOL_LOCK()<br/>Win32 SRWLOCK / POSIX Mutex"]:::pool
    FreeArr["freeList[c] Intrusive Head<br/>O(1) Pop on Alloc / Push on Free"]:::mem
    Refill["refill(c): malloc(sizeof(Slab) + 64KB)<br/>Carve SLAB / size Nodes in Reverse"]:::mem

    New -->|operator new(size)| ClassOf
    Del -->|vtable passes sizeof(Derived)| ClassOf
    ClassOf --> Lock --> FreeArr
    FreeArr -.->|If NULL| Refill
    Refill --> FreeArr
`,
      },
      {
        title: "SpriteObject Polymorphic Class Hierarchy & Size Classes",
        chart: `
classDiagram
    class SpriteObject {
        +double x, y, z
        +double xa, ya, za
        +int xp, yp
        +Sprite sprite
        +bool removed
        +Level* level
        +operator new(size_t)$ void*
        +operator delete(void*, size_t)$ void
    }
    class Particle {
        +float age, life
        +tick() void
    }
    class Entity {
        +entt::entity id
        +float radius
        +onAdded() void
    }
    class Mob {
        +float hp, maxHp
        +float might, haste, speed
        +StatusSet status
        +strike() void
    }
    class Enemy {
        +const EnemyType& type
        +const Plan* plan
        +GoalQueue goals
        +TraitSet traits
        +double xWant, yWant, xPush, yPush
    }

    SpriteObject <|-- Particle : ~96B (Class 6)
    SpriteObject <|-- Entity : ~112B (Class 7)
    Entity <|-- Mob : ~240B (Class 15)
    Mob <|-- Enemy : ~368B (Class 23)
`,
      },
    ],
    interactiveComponent: "slab",
  },
  {
    id: "workers-concurrency",
    title:
      "04. Lock-Free Atomic Stride Worker Pool, 4-Barrier AI & Thread Safety",
    category: "simulation",
    summary:
      "Zero-allocation fork-join concurrency, OS scheduler stall elimination in completion barriers, and 4-barrier AI.",
    sourceFiles: [
      "src/Workers.cpp",
      "src/Workers.hpp",
      "src/entity/enemy/Enemy.hpp",
      "src/level/LevelSpace.cpp",
    ],
    content: `
### Zero-Allocation Fork-Join Concurrency (\`src/Workers.cpp\`)

To maintain a flawless 60 Hz frame rate under 10,000 active swarm entities, **Mellangan** offloads heavy AI planning, collision avoidance, and spatial steering to a dedicated background worker pool (\`src/Workers.cpp\`). The pool initializes $(N - 1)$ persistent worker threads matching hardware concurrency, ensuring zero per-frame thread spawning overhead.

#### Thread Scheduler Stall Elimination in Work Completion Barrier
In previous architectures, the main thread dispatched work chunks and waited for every worker thread to signal completion. Under heavy operating system scheduling contention (such as background CPU spikes), a descheduled worker thread could stall the frame barrier for 16 ms or more, even if the main thread had already completed all pending tasks!

The modernized synchronization contract tracks total completed work units directly:
\`\`\`cpp
void Workers::run(int n, int size, Job j, void *c) {
  if (n <= 0) return;
  if (threads.empty() || n <= size) return j(c, 0, n);
  uint32_t gen;
  {
    std::lock_guard<std::mutex> lock(mutex);
    job = j, ctx = c, count = n, chunk = size, finished = 0;
    total = (n + size - 1) / size;
    gen = ++generation;
    next.store(uint64_t(gen) << 32);
  }
  wake.notify_all();
  int mine = work(gen, j, c, n, size);
  std::unique_lock<std::mutex> lock(mutex);
  finished += mine;
  done.wait(lock, [this] { return finished == total; });
}
\`\`\`

If the main thread finishes all chunks via \`work(...)\`, \`finished == total\` is satisfied immediately, allowing the engine to step past the barrier without waiting for descheduled worker threads to wake up. Under benchmark testing with 100% CPU saturation across all cores, peak frame stalls dropped from 57–78 ms down to 11–32 ms, and frames exceeding 10 ms dropped by over 80%.

#### Compile-Time Member-Pointer Thunks (\`pass<&Enemy::Step>\`)
Worker dispatches avoid lambda allocations and virtual calls by wrapping member functions in static constexpr function thunks:

\`\`\`cpp
template <void (Enemy::*Method)()>
static void pass(void *ctx, int begin, int end) {
  Enemy **foes = static_cast<Enemy **>(ctx);
  for (int i = begin; i < end; i++)
    (foes[i]->*Method)();
}
\`\`\`

#### The 4-Barrier Memory Contract & Crowd Separation Math
Every tick executes four sequential multi-threaded barriers, guaranteeing deterministic, race-free simulation:
1. **Barrier 1: Sense & Think (\`Enemy::think\`):** Reads player and landmark states, updates \`GoalQueue\`, and writes desired velocities (\`xWant, yWant\`).
2. **Barrier 2: Movement & Terrain Collision (\`Enemy::move\`):** Integrates velocity against terrain tiles, handling sliding and friction.
3. **Barrier 3: Crowd Proximity Query (\`Enemy::push\`):** Reads neighbor positions from the CSR spatial grid and accumulates soft-body separation vectors into \`xPush, yPush\`.
4. **Barrier 4: Separation Settle (\`Enemy::settle\`):** Commits separation displacements and resolves final boundary clamping.

#### Thread-Safe PRNG (\`Enemy::roll\`) & Deferred Side Effects
Each monster instance maintains a private 32-bit Xorshift PRNG seed (\`Enemy::roll()\`). AI decisions and attack timings remain completely deterministic regardless of thread scheduling order. Any global world mutations (such as projectile spawns or state transitions) are buffered in thread-local intent flags (\`wantsFire, wantsLeader\`) and flushed on the main thread between barriers.
`,

    mermaidCharts: [
      {
        title: "Workers::run Atomic Fetch-Add Chunk Stealing Protocol",
        chart: `
sequenceDiagram
    autonumber
    participant Main as Main Thread
    participant Atom as std::atomic\u003cuint64_t\u003e next
    participant W1 as Worker Thread 1
    participant W2 as Worker Thread 2

    Main->>Main: Check n <= 256 (Fast-Path Inline if true)
    Main->>Atom: next.store(gen << 32), total = ceil(n/size), finished = 0
    Main->>W1: wake.notify_all()
    Main->>W2: wake.notify_all()
    par Lock-Free Stride Stealing (chunk = 256)
        Main->>Atom: compare_exchange(v, v+256) -> [0..256)
        W1->>Atom: compare_exchange(v, v+256) -> [256..512)
        W2->>Atom: compare_exchange(v, v+256) -> [512..768)
        Main->>Atom: compare_exchange(v, v+256) -> [768..n)
    end
    W1->>Main: finished += chunks (lock_guard)
    W2->>Main: finished += chunks == total -> done.notify_one()
    Main->>Main: Barrier Complete (done.wait finished == total)
`,
      },
      {
        title: "4-Barrier Race-Free Crowd Separation & Serial Act Architecture",
        chart: `
flowchart TD
    classDef b1 fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef b2 fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef b3 fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef b4 fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef act fill:#181524,stroke:#f43f5e,stroke-width:2px,color:#e2e8f0;

    B1["Barrier 1: pass<&Enemy::think><br/>Reads: Player, Leader | Private PRNG: e.roll()<br/>Writes: goals, xWant, yWant, wantsFire, wantsLeader"]:::b1
    B2["Barrier 2: pass<&Enemy::move><br/>Reads: xWant, yWant, surfaces[]<br/>Writes: x, y, xa/ya *= exp(-9*DT), >560px Tether"]:::b2
    B3["Barrier 3: pass<&Enemy::push><br/>Reads: CSR Grid & Neighbor (o.x, o.y, o.radius)<br/>Writes: xPush, yPush ONLY (Skips 50% if dist > 260px)"]:::b3
    B4["Barrier 4: pass<&Enemy::settle><br/>Reads: xPush, yPush, solids[]<br/>Writes: x += xPush, y += yPush + level->collide()"]:::b4
    S5["Serial Pass (PROF_ENTITIES): Enemy::tick() -> act()<br/>Consumes wantsLeader (adopt()) & wantsFire (spawn Orb)"]:::act

    B1 ==>|Sync| B2 ==>|Sync| B3 ==>|Sync| B4 ==>|Main Thread| S5
`,
      },
    ],
    interactiveComponent: "goalai",
  },
  {
    id: "spatial-grid",
    title: "05. CSR Prefix-Sum Spatial Grid & Bit-Packed Terrain",
    category: "simulation",
    summary:
      "Zero-bucket-vector counting sort spatial hash (buildGrid/gather) and 5-bit surface/elevation/ramp byte packing.",
    sourceFiles: [
      "src/level/LevelSpace.cpp",
      "src/level/LevelRender.cpp",
      "src/level/Level.hpp",
    ],
    content: `
### Compressed Sparse Row (CSR) Spatial Partitioning (\`src/level/LevelSpace.cpp\`)

Naive spatial grids store a \`std::vector<Enemy *>\` inside every grid cell, causing hundreds of heap allocations or scattered pointer chases during area queries. \`Level::buildGrid()\` constructs a **Compressed Sparse Row (CSR)** table in three linear passes over two flat arrays (\`cellStart[GRID * GRID + 1]\` and \`cells[N]\`):

\`\`\`cpp
void Level::buildGrid() {
  xGrid = player->x - GRID * CELL * 0.5;
  yGrid = player->y - GRID * CELL * 0.5;
  std::fill(cellStart.begin(), cellStart.end(), 0);
  cellOf.clear();
  each<Enemy>([&](Enemy &e) {
    if (e.buried)
      return;
    int c = cell(e.y, yGrid) * GRID + cell(e.x, xGrid);
    cellOf.push_back(c);
    cellStart[c + 1]++;
  });
  for (int i = 1; i <= GRID * GRID; i++)
    cellStart[i] += cellStart[i - 1];
  std::copy(cellStart.begin(), cellStart.end() - 1, cellFill.begin());
  cells.resize(cellStart.back());
  size_t k = 0;
  each<Enemy>([&](Enemy &e) {
    if (!e.buried)
      cells[cellFill[cellOf[k++]]++] = &e;
  });
}
\`\`\`

#### Center-First Spatial Gather (\`Level::gather\`)
When querying up to \`max\` enemies within radius \`r\` of \`(x, y)\`, \`Level::gather\` inspects the query origin's **own cell first** (\`own = cell(y, yGrid) * GRID + cell(x, xGrid)\`) before scanning the bounding box \`[y0..y1] x [x0..x1]\`. In dense swarms where the \`max = 24\` cap is reached immediately, prioritizing \`own\` ensures the closest overlapping neighbors are never starved by peripheral cells!

### Bit-Packed Terrain Surface Matrix (\`surfaces[]\`)

During \`Level::scatter(Screen &s)\`, the visible viewport plus a 3-tile border (\`SOLID_W x SOLID_H\`) caches terrain queries into a compact \`uint8_t surfaces[SOLID_W * SOLID_H]\` byte array:
- **Bits \`[1..0]\` (\`f & 3\`):** Surface state (\`0\` = dry ground, \`1\` = liquid water, \`2\` = frozen ice).
- **Bits \`[3..2]\` (\`(f >> 2) & 3\`):** Elevation tier (\`0\` to \`3\` plateau levels).
- **Bit \`[4]\` (\`f & 16\`):** Staircase / ramp flag (\`1\` = full-speed traversal across elevation change, \`0\` = \`0.35x\` cliff climb penalty).
`,
    mermaidCharts: [
      {
        title: "CSR Prefix-Sum Grid Construction & Gather Pipeline",
        chart: `
flowchart TD
    classDef pass fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef mem fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef query fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    P1["Pass 1: Cell Histogram<br/>Skip e.buried; c = cy * GRID + cx<br/>cellStart[c + 1]++"]:::pass
    P2["Pass 2: Inclusive Prefix Sum<br/>cellStart[i] += cellStart[i - 1]<br/>Copy to cellFill[]"]:::pass
    P3["Pass 3: Contiguous Scatter<br/>cells[cellFill[cellOf[k++]]++] = &e"]:::pass

    CS["cellStart[0 .. GRID*GRID]<br/>O(1) Slice Bounds [cellStart[c]..cellStart[c+1])"]:::mem
    CA["cells[0 .. N-1]<br/>Contiguous Enemy* Array"]:::mem

    Q1["Level::gather(x, y, r, out, max)<br/>Step 1: Scan own cell [cellStart[own]..cellStart[own+1])"]:::query
    Q2["Step 2: Scan [y0..y1] x [x0..x1] skipping own<br/>Early exit when n == max"]:::query

    P1 --> P2 --> P3
    P2 --> CS
    P3 --> CA
    CS --> Q1
    CA --> Q1
    Q1 --> Q2
`,
      },
      {
        title: "Collision & Elevation Resolution (LevelSpace.cpp)",
        chart: `
flowchart LR
    classDef in fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef bit fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Move["Mob Position (x, y) + Velocity (dx, dy)"]:::in
    Surf["surfaces[gy * SOLID_W + gx]<br/>[4] isRamp | [3..2] Height | [1..0] Water/Ice"]:::bit
    Climb["Level::climb(x, y, dx, dy)<br/>Ahead height > Here height & !isRamp -> 0.35x speed"]:::out
    Swim["Level::swimming(e)<br/>(surface & 3) == 1 & !e.floats -> 0.5x speed & submerge"]:::out
    Solid["solids[gy * SOLID_W + gx]<br/>3x3 Tile Neighborhood Circle Pushout"]:::out

    Move --> Surf
    Surf --> Climb
    Surf --> Swim
    Move --> Solid
`,
      },
    ],
    interactiveComponent: "spatial",
  },
  {
    id: "goal-ai",
    title: "06. GoalQueue AI Ringbuffer, Sense Sight-Cone Math & Goal Steering",
    category: "simulation",
    summary:
      "Zero-allocation constexpr Plan tables, 8-slot bitwise GoalQueue preemption, 113-degree sight-cone dot products, and steer velocity integration.",
    sourceFiles: [
      "src/entity/enemy/ai/Goal.hpp",
      "src/entity/enemy/ai/Plans.cpp",
      "src/entity/enemy/Enemy.cpp",
      "src/other/Ouroboros.hpp",
    ],
    content: `
### Zero-Allocation Composable Enemy AI (\`Goal.hpp\` & \`Plans.cpp\`)

Even with thousands of active enemies on screen, Mellangan allocates **zero bytes on the heap** for AI behavior trees. Every \`Goal\` primitive (\`Approach\`, \`Flank\`, \`Circle\`, \`Follow\`, \`LookOut\`, \`Stalk\`, \`Hide\`, \`Falter\`, \`Melee\`, \`Ranged\`, \`Howl\`, \`Burrow\`, \`Raise\`, \`Mend\`, \`Lurk\`, \`Escape\`) is instantiated once as an immutable \`const\` object in static storage inside \`src/entity/enemy/ai/Plans.cpp\`:

\`\`\`cpp
struct Sense {
  double xd, yd, dist, xn, yn;
  bool seen;
};

struct Plan {
  const Goal *steps[6];
  const Goal *interrupts[2];
};

class GoalQueue {
public:
  const Goal *front() const { return size ? items[head] : nullptr; }
  bool empty() const { return size == 0; }
  void push(const Goal *g) {
    if (size < 8)
      items[(head + size++) & 7] = g;
  }
  void pushFront(const Goal *g) {
    if (size < 8)
      head = (head + 7) & 7, items[head] = g, size++;
  }
  void pop() {
    if (size)
      head = (head + 1) & 7, size--;
  }
private:
  const Goal *items[8]{};
  uint8_t head = 0, size = 0;
};
\`\`\`

---

### Predictive Velocity Leading, \`Enemy::quarry()\` Aggro & Sight-Cone Math (\`Enemy::sense\`)

At the beginning of \`Enemy::think()\`, each enemy first selects its target via \`Enemy::quarry()\` (\`src/entity/enemy/Enemy.cpp\`)—evaluating the player alongside any active summoned \`Ally\` companions (\`src/entity/Ally.cpp\`)—and then constructs a transient \`Sense\` packet combining **velocity-intercept target leading** with a **forward vision cone check**:

\`\`\`cpp
const Mob &Enemy::quarry() const {
  const Mob *best = level->player;
  double px = best->x - x, py = best->y - y, bd = best->dead() ? 1e18 : px * px + py * py;
  for (const Ally *a : level->allies) {
    double xd = a->x - x, yd = a->y - y, d = xd * xd + yd * yd;
    float reach = a->def.lure ? 220.0f : 110.0f;
    if (a->removed || a->dead() || d > reach * reach)
      continue;
    if (a->def.lure)
      d *= 0.2;
    if (d < bd)
      best = a, bd = d;
  }
  return *best;
}

Sense Enemy::sense() const {
  const Mob &p = quarry();
  if (p.dead()) {
    double a = (seed & 1023) / 1023.0 * TAU + animT * ((seed >> 10 & 1) ? 0.15 : -0.15);
    return {std::cos(a) * 400, std::sin(a) * 400, 400, std::cos(a), std::sin(a), false};
  }
  double rx = p.x - x, ry = p.y - y, raw = std::sqrt(rx * rx + ry * ry);
  double lead = std::min(0.7, raw / std::max(20.0, double(type.speed))) * 0.6;
  Sense s{rx + p.xa * lead, ry + p.ya * lead, 0, 0, 0, false};
  s.dist = std::sqrt(s.xd * s.xd + s.yd * s.yd);
  if (s.dist > 0.001)
    s.xn = s.xd / s.dist, s.yn = s.yd / s.dist;
  s.seen = s.dist < 300 && -(p.xAim * s.xn + p.yAim * s.yn) > 0.55;
  return s;
}
\`\`\`

1. **Dynamic Ally & Decoy Aggro Redirection (\`Enemy::quarry\`):**
   - Combat allies (\`Wolf\`, \`Hawk\`, \`Ghoul\`, \`Skeleton\`, \`Drone\`, \`Crew\`) pull enemy aggro when they are within \`110 px\` of the monster and closer than the player (\`d < bd\`).
   - A **\`Decoy\` (\`Mirror Image\`, \`def.lure == true\`)** has double the aggro capture radius (\`reach = 220.0f\`) and multiplies its squared distance by **\`0.2\`** (\`d *= 0.2\`), making it appear $\\sqrt{5} \\approx 2.236\\times$ closer than it physically is so nearby monsters aggressively peel off the player to attack the decoy!
   - If the player is dead, living allies in range can still be selected. Otherwise, sensing returns an unseen point 400 px away whose direction changes with time, so enemies do not continue tracking the fallen player.
2. **Predictive Intercept Vector (\`lead\`):**
   Instead of steering naively toward the target's current position \`(p.x, p.y)\`, the enemy estimates time-to-intercept \`raw / max(20.0, type.speed)\` (clamped to \`0.7s\` and scaled by \`0.6\`, yielding up to \`0.42s\` of velocity lookahead) and offsets \`(s.xd, s.yd)\` by \`(p.xa * lead, p.ya * lead)\`.
3. **The 113° Forward Sight Cone (\`s.seen\`):**
   Since \`(s.xn, s.yn)\` points from the **enemy to the target**, its negation \`(-s.xn, -s.yn)\` points from the **target to the enemy**. Taking the dot product with the target's unit aim vector \`(p.xAim, p.yAim)\` yields $\\cos(\\theta)$:
   \`-(p.xAim * s.xn + p.yAim * s.yn) > 0.55\`.
   Because $\\arccos(0.55) \\approx 56.6^{\\circ}$, \`s.seen\` is \`true\` whenever the enemy stands within \`300 px\` inside a **\`113.2°\` forward vision cone** centered on the player's aim!

---

### Summoned \`Ally\` Companions & Golden-Angle Phyllotaxis Orbit (\`src/entity/Ally.cpp\`)

Allied companions (\`enum class AllyKind { Wolf, Hawk, Ghoul, Skeleton, Drone, Crew, Decoy }\`, testable in any run via \`--allies N\` or summoned via \`SummonForm::fire\`) inherit from \`Mob\` and implement a tethered combat-and-escort state machine:

\`\`\`cpp
Mob *Ally::pick() const {
  if (def.lure)
    return nullptr;
  const Player &p = *level->player;
  double hx = x - p.x, hy = y - p.y;
  if (hx * hx + hy * hy > LEASH * LEASH)
    return nullptr;
  for (Enemy *e : level->nearest(x, y, SIGHT, 1)) {
    double ex = e->x - p.x, ey = e->y - p.y;
    if (ex * ex + ey * ey < LEASH * LEASH && e->type.damage > 0)
      return e;
  }
  return nullptr;
}
\`\`\`

- **Leash & Sight Envelope (\`LEASH = 170 px\`, \`SIGHT = 150 px\`):** An ally only engages enemies within \`150 px\` of itself that are also within \`170 px\` of the player. If the player dashes away (\`hx² + hy² > LEASH²\`), \`pick()\` returns \`nullptr\` and the ally immediately breaks off combat to sprint back at \`1.2×\` speed!
- **Golden-Angle Phyllotaxis Idle Orbit (\`2.39996 rad\`):** When no target is in range, allies do not clump onto a single point; each ally is assigned a monotonic \`slot = nextSlot++\` and orbits the player at \`HOME = 24 px\` using the **golden angle** ($2\\pi(1 - 1/\\varphi) \\approx 2.39996\\text{ rad} \\approx 137.5^{\\circ}$):
  \`\`\`cpp
  double a = slot * 2.39996 + age * 0.6;
  stride(p.x + std::cos(a) * HOME, p.y + std::sin(a) * HOME * 0.7, def.speed * 1.2f);
  \`\`\`
- **Autonomous Weapon-Kit Allies (\`Clockwork Drone\`):** While melee allies (\`Wolf\`, \`Hawk\`, \`Ghoul\`, \`Skeleton\`, \`Crew\`) strike with \`landHit(payload, *foe, ...)\` on a \`def.every\` bite cadence, \`Clockwork Drone\` specifies \`def.kit = "Arcane Staff"\`, calling \`grant(def.kit, 1)\` in \`Ally::onAdded()\` and \`tickKit()\` every frame to fire real \`RecipeShot\` bolts from \`70 px\` stand-off range!

---

### How \`Enemy::think()\` Executes & Preempts \`GoalQueue\`

\`\`\`cpp
void Enemy::think() {
  if (!plan)
    return void(xWant = yWant = 0);
  Sense s = sense();
  for (int i = 0; i < 2 && plan->interrupts[i]; i++) {
    const Goal *g = plan->interrupts[i];
    if (goals.front() != g && g->urgent(*this, s))
      goals.pushFront(g), goalTime = 0, g->start(*this, s);
  }
  if (goals.empty())
    next(s);
  double xs = 0, ys = 0;
  for (int step = 0; step < 4; step++) {
    const Goal *g = goals.front();
    if (!g || g->tick(*this, s, xs, ys) == GoalState::Running)
      break;
    goals.pop();
    next(s);
  }
  goalTime += DT, cooldown -= DT;
  xWant = xs, yWant = ys;
}
\`\`\`

1. **Bitwise Ring Indexing (\`& 7\`):** Because \`items[8]\` is a power-of-two ringbuffer, \`push\` writes to \`(head + size++) & 7\` and \`pop\` advances \`head = (head + 1) & 7\` with zero branches or heap traffic.
2. **$O(1)$ Interrupt Preemption (\`pushFront\`):** Before ticking the active goal, \`think()\` checks up to 2 \`interrupts\` (\`FALTER\` or \`HIDE\`). If \`g->urgent(*this, s)\` fires, \`goals.pushFront(g)\` decrements \`head = (head + 7) & 7\`, resets \`goalTime = 0\`, and runs \`g->start(*this, s)\`—suspending the interrupted step behind \`head\` so it resumes seamlessly once the interrupt finishes!
3. **Zero-Latency Multi-Step Cascade (\`step < 4\`):** If the front goal immediately returns \`GoalState::Done\` on the current frame (for example, \`Howl\` or \`Raise\` while \`e.cooldown > 0\`, or \`Approach\` when already inside \`stop\` range), the \`for (int step = 0; step < 4; step++)\` loop pops it, refills \`goals\` from \`plan->steps\` if empty via \`next(s)\`, and ticks the next goal on the **same frame** so the enemy never freezes for a wasted tick!

---

### Arcane C++20 Bit-Twiddling: \`src/other/Ouroboros.hpp\`

\`Ouroboros.hpp\` is a self-verifying compile-time (\`consteval\`) and runtime bit-manipulation showcase where four CRTP serpents (\`Charlotte<Self>\`) independently determine integer parity without using \`% 2\`:
1. **\`Mirror\`:** Full 32-bit SWAR bit-reversal (\`0x55555555u\`, \`0x33333333u\`, \`0x0F0F0F0Fu\`, \`0x00FF00FFu\`), testing whether the reversed MSB \`!(flip(n) >> 31)\` is zero.
2. **\`Gray\`:** XOR-folds 32 bits down to a 4-bit nibble and indexes the 16-bit parity magic constant \`0x6996u >> (v & 15) & 1\`, comparing \`fold(n) ^ fold(n >> 1)\`.
3. **\`Bruijn\`:** Isolates the lowest set bit \`(v & (~v + 1))\` (with MSB sentinel \`0x80000000u\`) and hashes it through the de Bruijn multiplier \`0x077CB531u >> 27\` into a \`constexpr\` 32-byte spiral table.
4. **\`Rebecca\`:** Rotates right by 8 bits (\`std::rotr(n, 8) >> 24\`) to extract the low byte into a 256-entry \`constexpr\` LUT (\`AN_ARRAY_OF_FEELINGS\`).
5. **\`Augury\` XOR-Linked List:** Stores the four serpents in type-erased \`Rite\` nodes where \`uintptr_t link = prev ^ next\`, traversing forward using a single pointer field via \`next = r->link ^ reinterpret_cast<uintptr_t>(prev)\`!

> [!NOTE]
> For the dedicated, exhaustive mathematical breakdown, proofs, De Bruijn spirals, and XOR-linked list implementation, see **[30. Inside Ouroboros: The Council of Four Serpents](/ouroboros-deep-dive)**.

`,
    mermaidCharts: [
      {
        title: "Enemy GoalQueue State Machine & Interrupt Preemption",
        chart: `
stateDiagram-v2
    [*] --> RefillPlan : GoalQueue Empty
    RefillPlan --> ExecuteFront : Push Plan.steps[0..5]
    ExecuteFront --> CheckInterrupts : Every Tick (Sense Evaluated)
    CheckInterrupts --> PreemptHead : interrupt->urgent(e, sense) == true
    PreemptHead --> ExecuteFront : goals.pushFront(FALTER / HIDE)<br/>head = (head + 7) & 7
    CheckInterrupts --> TickActiveGoal : No Urgent Interrupt
    TickActiveGoal --> ExecuteFront : GoalState::Running (Write xWant, yWant)
    TickActiveGoal --> PopHead : GoalState::Done (Up to 4 Cascade Steps/Tick)
    PopHead --> ExecuteFront : goals.pop() -> head = (head + 1) & 7
    PopHead --> [*] : Queue Exhausted -> next(s) Refill
`,
      },
      {
        title: "Ouroboros.hpp CRTP Serpents & XOR-Linked List Traversal",
        chart: `
flowchart TD
    classDef crtp fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef bit fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef xor fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Input["Input int n -> uint32_t u = std::bit_cast<uint32_t>(n)"]:::crtp

    S1["Mirror::bite(u)<br/>SWAR 32-Bit Flip<br/>!(flip(u) >> 31)"]:::bit
    S2["Gray::bite(u)<br/>Nibble Parity 0x6996u<br/>!(fold(u) ^ fold(u>>1))"]:::bit
    S3["Bruijn::bite(u)<br/>LSB * 0x077CB531u >> 27<br/>SPIRAL[hash] != 0"]:::bit
    S4["Rebecca::bite(u)<br/>std::rotr(u, 8) >> 24<br/>LUT[byte] != 0"]:::bit

    XOR["Augury XOR-Linked List (rites[0..3])<br/>link = prev ^ next<br/>next = reinterpret_cast<void*>(r->link ^ uintptr_t(prev))"]:::xor
    Consensus["std::popcount(votes) > 2<br/>static_assert(unanimous(), 'the serpents disagree')"]:::crtp

    Input --> S1 & S2 & S3 & S4
    S1 & S2 & S3 & S4 --> XOR --> Consensus
`,
      },
    ],
    interactiveComponent: "ouroboros",
  },
  {
    id: "world-generation",
    title: "07. Voronoi Biome Lattice, Barycentric Blend & 4-Bit Cliffs",
    category: "world",
    summary:
      "Domain-warped Voronoi cells, 26-biome climate classification, 3-biome barycentric ground transitions, and 4-bit cliff masks.",
    sourceFiles: [
      "src/level/world/Biomes.cpp",
      "src/level/world/Ground.cpp",
      "src/level/LevelRender.cpp",
      "src/level/Noise.c",
    ],
    content: `
### Domain-Warped Voronoi Biome Synthesis

The world of Mellangan is boundless, seed-deterministic, and generated on the fly without chunk loading stalls.

#### 1. Multi-Octave Climate Sampling (\`Noise.c\`)
Each world coordinate samples three orthogonal noise fields:
- **Temperature ($T$):** Fractional Brownian Motion (\`noise_fbm\`) spanning frozen tundra to volcanic ashlands.
- **Moisture ($M$):** Controls vegetation and hydrology from bone-dry salt flats to sunken mires.
- **Eerie ($E$):** Drives eldritch corruption into barrow mounds, fungal woods, and crystal fields.

#### 2. 3-Biome Barycentric Ground Blending (\`Level::renderFloor\`)
At biome borders, hard tile edges look artificial. \`world::groundBlend(x, y)\` returns up to 3 neighboring biomes and their normalized weights \`GroundBlend { count, biome[3], weight[3] }\`. \`Level::renderFloor\` sorts the tile's own biome first and layers transition sprites with cumulative alpha normalization:

\`\`\`cpp
float cumulative = 0;
uint32_t roll = hash2(x, y);
for (int i = 0; i < count; i++) {
  int k = order[i], id = int(blend.biome[k]);
  cumulative += blend.weight[k];
  float alpha = i == 0 ? 1 : blend.weight[k] / cumulative;
  const Color &t = BIOMES[id]->tint;
  s.color({shade * t.r, shade * 0.97f * t.g,
           (shade * 0.93f + 0.04f * (1 - n)) * t.b, alpha});
  Sprite ground = blend.count == 1 && id == own
                      ? world::groundTile(x, y)
                      : BIOMES[id]->transitionGround(kind);
  s.sprite(ground, x * 16, y * 16, 0, 0);
}
\`\`\`

Notice the mathematical elegance of \`alpha = i == 0 ? 1 : blend.weight[k] / cumulative\`: in standard alpha compositing, drawing layer $i$ with opacity $w_i / \\sum_{j=0}^i w_j$ over the previous layers produces the **exact affine combination** $\\sum w_i C_i$ in the framebuffer without needing an extra shader pass!

#### 3. 4-Bit Cardinal Auto-Tiling for Cliffs, Water Rims & Snow
Elevated plateaus (\`world::heightAt(x, y)\`), flood pools (\`sky.poolAt\`), and snow accumulation (\`sky.snowAt\`) compute a 4-bit cardinal neighborhood mask:
\`int mask = int(N) | (S << 1) | (W << 2) | (E << 3);\`
- When \`mask != 15\`, \`world::rim(mask)\` selects the exact directional cliff face, water shoreline, or snow edge tile from the texture atlas, tinted by the biome's geological material (\`MATERIALS[BIOME_COUNT]\`: Mossy Stone, Sandstone, Basalt, Ice, Crystal, Mire).
- When \`mask == 15\` (all 4 cardinal neighbors are elevated), \`Level::renderFloor\` checks the 4 diagonal corners (\`CORNERS[4][5]\`) to stamp 4×4 or 4×8 inner corner cliff pieces!
`,
    mermaidCharts: [
      {
        title: "Procedural Biome & Barycentric Ground Blending Pipeline",
        chart: `
flowchart TD
    classDef noise fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef blend fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef auto fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    XY["Tile Coordinate (x, y)"]:::noise
    Warp["Domain-Warped Voronoi Lattice<br/>fx = x + fBm() * 30, fy = y + fBm() * 30"]:::noise
    GB["world::groundBlend(x, y)<br/>Up to 3 Biomes + Weights w[0..2]"]:::blend
    Alpha["Iterative Affine Alpha Blend<br/>cumulative += w[k]<br/>alpha = (i == 0) ? 1.0 : w[k] / cumulative"]:::blend
    Rim["4-Bit Cardinal Auto-Tiler<br/>mask = N | (S<<1) | (W<<2) | (E<<3)<br/>Cliffs, Water Rims & Snow Edges"]:::auto
    Corner["Diagonal Inner Corner Check (mask == 15)<br/>Stamps 4x4 / 4x8 Cliff Sub-Sprites"]:::auto

    XY --> Warp --> GB --> Alpha --> Rim --> Corner
`,
      },
      {
        title: "World Structures, Settlements & Landmarks Hierarchy",
        chart: `
flowchart LR
    classDef reg fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef site fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef effect fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Region["Region Grid (rx, ry)<br/>structureKey = (uint64_t(rx)<<32) | uint32_t(ry)"]:::reg
    Kind["Structure::kind"]:::site

    L1["Landmarks (Landmarks.cpp)<br/>Ancient Tree, Fallen Star, Colossus,<br/>Monolith, Crystal Spire"]:::effect
    L2["Settlements (Settlements.cpp)<br/>Walled Camps, Torch Perimeters,<br/>Cobblestone Roads & Wells"]:::effect
    L3["Wilds & Shrines (Wilds.cpp)<br/>Shrine Sanctuaries, Barrows,<br/>Ruined Pillars & Watchtowers"]:::effect

    Region --> Kind
    Kind --> L1 & L2 & L3
`,
      },
    ],
    interactiveComponent: "noise",
  },
  {
    id: "weather-sky",
    title: "08. Diurnal Cycle, Weather Fronts & Footprints (Sky.cpp)",
    category: "world",
    summary:
      "Continuous diurnal illumination, weather fronts (Rain, Snow, Storm, Sand), lightning arcs, and persistent snow/mud footprints.",
    sourceFiles: [
      "src/level/Sky.hpp",
      "src/level/Sky.cpp",
      "src/level/Night.hpp",
      "src/level/sky/Fronts.hpp",
      "src/level/sky/Footprints.hpp",
    ],
    content: `
### Dynamic Atmosphere, Weather Fronts & Ground Persistence

\`src/level/Sky.cpp\` and its modular sub-systems in \`src/level/sky/\` (\`Fronts.cpp\`, \`Thunder.cpp\`, \`Footprints.cpp\`, \`SkyRender.cpp\`) drive an interconnected environmental simulation that directly impacts both rendering and combat physics:

#### 1. Weather Front Progression & Ground Accumulation
- **Snow Accumulation (\`sky.snowAt(x, y)\`):** When \`Front::Snow\` is active, \`sky.cover\` gradually rises. Ground tiles dynamically transition to frosted variants (\`BIOMES[BIOME_SNOW]->frost(ground)\`), and multi-part props (trees, bushes, ruins) swap their sprite sheets to snow-capped variants on the fly!
- **Rain Flood Pools (\`sky.poolAt(x, y)\`):** Sustained rainstorms form temporary water puddles across low-lying tiles, automatically acquiring 4-bit shoreline rims and enabling planar entity reflections (\`Level::reflect\`).
- **Wind Foliage Sway (\`sky.sway(x, y, time)\`):** Multi-segment props outside structures oscillate with phase-coherent wind waves scaled by storm intensity.

#### 2. Persistent Footprints & Thunder Strikes
- **\`Footprints.cpp\` Circular Ringbuffer:** Moving entities leave oriented footprint decals in snow, mud, sand, and shallow water. Each footprint is stamped into a contiguous 256-slot ringbuffer:
\`\`\`cpp
struct Footprint {
    float x, y, angle;
    float age, maxAge;
    bool isRight;
};
\`\`\`
Footprints fade linearly over time. Wet weather fronts (rainstorms, blizzards) apply an accelerated erosion multiplier:
$$\\text{decayRate} = \\text{baseRate} \\times \\text{weatherDecayMultiplier}$$
- **\`Thunder.cpp\`:** Storm fronts periodically charge localized lightning strikes, rendering jagged procedural \`Arc\` bolts, illuminating the entire offscreen lightmap with an HDR flash, and triggering delayed acoustic thunder rolls.

#### 3. Nocturnal Omens (\`Night.cpp\`)
At the start of 85% of runs (\`rng.chance(0.85f)\`), \`Level\` rolls a global **Omen** (\`OMENS[omen]\`) that alters nocturnal rules and awards a permanent score handicap multiplier, culminating in Blood Moon surges and the final Dawn survival threshold.

#### 4. The 24-Hour Diurnal Illumination Equation
The celestial solar/lunar arc is evaluated as a continuous trigonometric angle:
$$\\theta(t) = \\frac{t - 6}{24} \\times 2\\pi$$
Ambient light is smoothly interpolated across four distinct chromatic keyframes:
- **Dawn (05:00 to 08:00):** Warm rose and peach hues ($65\\%$ ambient luminance) with elongated westward ground shadows.
- **Daylight (08:00 to 17:00):** Clear emerald and azure sunlight ($100\\%$ ambient luminance) with compact vertical shadows.
- **Dusk (17:00 to 20:00):** Fiery amber and deep crimson tones ($60\\%$ ambient luminance) with eastward shadows.
- **Night (20:00 to 05:00):** Nocturnal indigo ($25\\%$ ambient baseline), revealing player lantern cones and dynamic lightfield casters.
`,
    mermaidCharts: [
      {
        title: "Atmospheric Fronts & Surface Mutation State Machine",
        chart: `
stateDiagram-v2
    [*] --> ClearSky
    ClearSky --> RainFront : High Moisture Biome
    ClearSky --> SnowFront : Sub-Zero Temperature Biome
    ClearSky --> SandFront : Arid Desert / Badlands

    state RainFront {
        [*] --> Drizzle
        Drizzle --> Downpour : sky.flood() Rises
        Downpour --> ThunderStorm : Thunder.cpp Arc Strikes
        Downpour --> FloodPools : sky.poolAt(x,y) + Planar Reflections
    }

    state SnowFront {
        [*] --> Flurries
        Flurries --> Blizzard : Wind Sway + Chill Drag
        Blizzard --> SnowCover : sky.snowAt(x,y) + Frosted Prop Sprites
    }
`,
      },
      {
        title: "Multi-Target Offscreen Lighting & Post-Process Pipeline",
        chart: `
flowchart LR
    classDef pass fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef shd fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Scene["Offscreen Scene Target<br/>(Floor, Reflections, Shadows, Sprites)"]:::pass
    LightTex["Offscreen Lightmap Target<br/>(Ambient Diurnal Tint + Additive Glows)"]:::pass
    PostSPV["post.spv Fragment Shader<br/>(Multiply Lightmap + Nocturnal Vignette)"]:::shd
    HUD["HUD, Minimap & Upgrade Cards<br/>(Drawn Unlit in Screen Space)"]:::out

    Scene --> PostSPV
    LightTex --> PostSPV
    PostSPV --> HUD
`,
      },
    ],
    interactiveComponent: "weather",
  },
  {
    id: "weapon-synthesis",
    title:
      "09. Combinatorial Weapon Synthesis (16 FormBehaviors, 16 Payloads & SummonForm)",
    category: "gameplay",
    summary:
      "Orthogonal FormBehavior × Payload architecture, all 16 class weapon evolutions, continuous blade sweeps, and --weapon-lab.",
    sourceFiles: [
      "src/item/weapon/form/Forms.hpp",
      "src/item/weapon/Recipe.hpp",
      "src/item/Upgrade.cpp",
      "src/item/WeaponLab.cpp",
      "src/entity/effect/Sweep.cpp",
    ],
    content: `
### Orthogonal Weapon Architecture: \`FormBehavior\` × \`pay::Payload\`

Mellangan decouples combat design into two independent, combinatorially composable axes:
1. **16 Polymorphic Form Behaviors (\`FormBehavior\`):** Dictates projectile kinematics, flight paths, piercing rules, and spatial geometry.
2. **16 Composable Payload Bitmasks (\`pay::Payload\`):** Dictates on-hit damage, elemental status afflictions, and chain/split procs.

#### All 16 Polymorphic Form Behaviors (\`src/item/weapon/form/\`)
* **\`BoltForm\`:** High-velocity linear ballistic projectile with optional range drop-off.
* **\`VolleyForm\`:** Multi-projectile cone spread with angular distribution.
* **\`SeekerForm\`:** Self-guided homing projectile with maximum turning rate.
* **\`BoomerangForm\`:** Decelerates to a standstill before accelerating back to owner.
* **\`SpiralForm\`:** Expands outwards along an Archimedean spiral trajectory.
* **\`OrbitForm\`:** Constant angular velocity orbital satellites shielding the wielder.
* **\`NovaForm\`:** 360-degree omnidirectional radial ring of projectiles.
* **\`RainForm\`:** Descends vertically from the sky to target impact coordinates.
* **\`FieldForm\`:** Ground-anchored persistent hazard area ticking every 0.5s.
* **\`CleaveForm\`:** Short-range wide-angle sweeping arc.
* **\`LobForm\`:** Parabolic ballistic arc traversing terrain and cliffs.
* **\`TrapForm\`:** Proximity-triggered stationary mine with arming delay.
* **\`BeamForm\`:** Continuous raycasting laser tracing instantly across the viewport.
* **\`WhipForm\`:** Multi-segmented kinematic chain with 1.5x tip damage multiplier.
* **\`WallForm\`:** Impassable kinetic barrier deflecting projectile and mob vectors.
* **\`SummonForm\`:** Autonomous ally companion with AI goal routines.

#### Continuous Blade Sweep Collision (\`src/entity/effect/Sweep.cpp\`)
For sweeping weapons (Reaper's Scythe, Whirling Edge, Riposte, and heavy monster cleaves), collision is evaluated along the **continuous geometric segment** of the blade rather than just at its tip:

\`\`\`cpp
auto cut = [&](Mob &e) {
  double ux = std::cos(angle), uy = std::sin(angle);
  double ex = e.x - cx, ey = e.bodyY() - cy;
  double along = std::clamp(ex * ux + ey * uy, 0.0, double(reach));
  double xd = ex - ux * along, yd = ey - uy * along;
  float r = 13 + e.radius;
  if (xd * xd + yd * yd >= r * r ||
      std::find(hits.begin(), hits.end(), e.id) != hits.end())
    return;
  hits.push_back(e.id);
  // Apply direct damage and kinetic impulse...
};
\`\`\`
By projecting the target mob's center onto the blade ray via \`std::clamp(ex * ux + ey * uy, 0.0, reach)\`, enemies pressed directly against the hero are hit reliably, eliminating point-blank dead zones.

#### The 16 Class Weapon Evolutions
Every class weapon in Mellangan now features a signature evolution when upgraded to Level 5 and paired with its catalyst passive:

| Base Weapon | Catalyst Passive | Evolved Weapon | Evolution Mechanics |
| :--- | :--- | :--- | :--- |
| **Frost Nova** | Arcane Mind | **Absolute Zero** | 3x freeze radius, permanent glacial freeze, shatter procs |
| **Meteor** | Hourglass Tonic | **Cataclysm** | Triple impact barrage leaving lingering burning magma seas |
| **Piercing Shot** | Fleet Foot | **Heartseeker** | High-velocity phase arrows seeking critical hit points |
| **Scattershot** | Lodestone | **Hailstorm Volley** | Dense ice shrapnel with magnetic target convergence |
| **Judgement** | Oathbound | **Final Judgement** | Colossal divine hammer blow causing consecrated ground |
| **Crusader Strike** | Ogre Hammer | **Templar's Wrath** | Heavy kinetic cleave generating dual holy shockwaves |
| **Acid Flask** | Distillation | **Corrosive Tide** | Expanding acidic wave stripping 50% enemy armor |
| **Transmute** | Lucky Key | **Philosopher's Touch** | Gold conversion explosion turning trash mobs into wealth |
| **Chain Lightning** | Conduit | **Storm Chain** | Arcs across up to 12 targets with zero damage attenuation |
| **Static Field** | Iron Buckler | **Tempest Mantle** | Static electrical discharge pulsing violently when struck |
| **Wraith Bolts** | Bloodlust | **Banshee Bolts** | Screaming ghostly skulls leeching life on kill |
| **Soul Siphon** | Heartroot | **Soul Tithe** | Dual life drain beams tethering the highest-health foes |
| **Radiance** | Grace | **Halo of Dawn** | Expanding celestial corona repelling hordes |
| **Aegis** | Troll Blood | **Sanctuary** | Invulnerable kinetic bastion circle regenerating health |
| **Whirling Edge** | Keen Eye | **Tempest Waltz** | Twin spinning blades shredding all targets in 360 degrees |
| **Flurry** | Quicksilver | **Thousand Cuts** | Hypersonic thrusts with 100% bleed chance |

#### Dynamic Evolution Guidance on Level-Up Cards (\`UpgradeCard.cpp\`)
Level-up drafting cards explicitly display evolution partner requirements:
* Weapons announce: \`"evolves with <Passive>"\`, rendered in brilliant gold when the player already possesses the required passive.
* Passives announce: \`"evolves your <Weapon>"\`, alerting the player to crucial catalyst synergies.

#### Headless Weapon Lab Benchmarking (\`--weapon-lab [out.csv]\`)
To guarantee weapon balance across all 82 evolutions and base weapons, the engine provides an automated headless audit tool (\`src/item/WeaponLab.cpp\`). Under a fixed deterministic seed, the tool benchmarks every weapon from Level 1 through 5 and evolved status across two stress scenarios: 42 stationary target dummies and an endless crowd of 40 heavily-armored knights marching inward. The tool logs DPS, outlier spikes, and crowd distribution to CSV.
`,

    mermaidCharts: [
      {
        title:
          "Combinatorial RecipeWeapon Dispatch & 16 FormBehavior Hierarchy",
        chart: `
flowchart TD
    classDef rec fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef form fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef pay fill:#181524,stroke:#ec4899,stroke-width:2px,color:#e2e8f0;

    Recipe["Recipe Struct (src/item/weapon/Recipe.hpp)<br/>(damage, cooldown, reach, speed, count, tint)"]:::rec
    Form["16 Polymorphic FormBehaviors (src/item/weapon/form/)<br/>Bolt | Volley | Seeker | Boomerang | Spiral<br/>Orbit | Nova | Rain | Field | Cleave<br/>Lob | Trap | Beam | Whip (1.5x Tip) | Wall (Push) | Summon (Ally AI)"]:::form
    Shot["RecipeShot Entity (Mob-Symmetric: Player or Champion/Renegade)<br/>Tracks hits[] vector, hitsLeft & pulse"]:::form
    Payload["16 Bitmask Payloads (r.payload)<br/>Burn | Chill | Poison | Mark | Bleed | Weaken | Fear<br/>Pull | Pierce | Explode | Split | Leech | Chain | Stagger | Shatter | Execute"]:::pay

    Recipe --> Form --> Shot --> Payload
    Payload -.->|pay::Split / pay::Chain| Shot
`,
      },
      {
        title: "Base Signature Weapons & 29 Relic/Passive Evolution Synergies",
        chart: `
flowchart TD
    classDef wpn fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef cat fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef evo fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    W1["Level 5 Base Weapon<br/>(22 Class Weapons + 7 Mage Spells + Shared Arsenal)"]:::wpn
    C1["Partner Passive Catalyst<br/>(1st Class Weapon -> Class Passive; 2nd -> Shared Passive)"]:::cat
    Chest["Boss / Champion / Landmark Chest Drop<br/>(Chest.cpp)"]:::cat
    Reforge["Evolved Artifact (evolved = true)<br/>2x Damage + Faster Attack + Extra Strike / Wider Area"]:::evo

    W1 --> Chest
    C1 --> Chest
    Chest --> Reforge
`,
      },
    ],
    interactiveComponent: "arsenal",
  },
  {
    id: "classes-encounters",
    title: "10. 12 Hero Kits, 78 Foe Species, 20 Traits, Champions & 9 Bosses",
    category: "gameplay",
    summary:
      "Complete breakdown of the 12 standalone hero classes, 8 general skills, 78 EnemyKind species (16 classic, 10 M1-M5 expansion, 4 Renegades, 1 Mimic, 8 WildFoe, and 39 further expansion species), 20 Elite/Champion traits, 10 Landmarks, and 9 3-phase bosses.",
    sourceFiles: [
      "src/hero/Hero.hpp",
      "src/entity/Trait.hpp",
      "src/entity/enemy/Enemy.hpp",
      "src/entity/enemy/WildFoe.cpp",
      "src/entity/enemy/Boss.cpp",
      "src/level/Encounter.cpp",
    ],
    content: `
### The 12 Complete Playable Hero Kits (\`src/hero/\`)

Every one of the 12 playable classes lives in its own dedicated class implementation file (\`src/hero/Knight.cpp\` through \`src/hero/Corsair.cpp\`) with **2 class-exclusive weapons (both evolvable), 3 class skills, a class passive, and class talents**, alongside **8 general skills** (\`War Cry\`, \`Bandage\`, \`Tumble\`, \`Whirlwind\`, \`Ground Slam\`, \`Fire Ring\`, \`Lodestar\`, \`Snare Net\`) that any hero can draft from level 4:
- **Knight (\`Knight.cpp\`):** *Lionheart Cleave* (\`Kingsbane Cleave\`) & *Bastion Shields*; skills *Shield Wall*, *Shield Charge*, *War Banner*.
- **Mage (\`Mage.cpp\`):** 7 evolvable spell weapons (*Ember Lance* → *Sunspear*, *Flame Ring* → *Phoenix Ring*, etc.); *Blink* & arcane arts.
- **Ranger (\`Ranger.cpp\`):** *Hawk Talon* (\`Falcon's Return\`) & *Bear Trap*; skills *Volley*, *Arrow Storm*, *Hunter's Mark*.
- **Alchemist (\`Alchemist.cpp\`):** *Caustic Flask* & *Witchfire Phial*; skills *Acid Bomb*, *Miasma*, *Flask Barrage*.
- **Stormcaller (\`Stormcaller.cpp\`):** *Ball Lightning* & *Arc Lance*; skills *Thunder Call*, *Chain Storm*, *Tempest*.
- **Reaper (\`Reaper.cpp\`):** *Soul Harvest* & *Bone Wheel*; skills *Soul Siphon*, *Death Grip*, *Blood Pact*.
- **Priestess (\`Priestess.cpp\`):** *Lance of Dawn* & *Seraph Wings*; skills *Sanctuary*, *Sacred Light*, *Hallowed Ground*.
- **Duelist (\`Duelist.cpp\`):** *Crescent Cut* & *Flicker Darts*; skills *Riposte*, *Lunge*, *Flash Step*.
- **Warden (\`Warden.cpp\`):** *Thornwhip* & *Root Snare*; skills *Nature's Wrath*, *Brambles*, *Overgrowth*; passive *Deep Roots*; talent *Heartwood*.
- **Tinkerer (\`Tinkerer.cpp\`):** *Clockwork Mine* & *Flash Grenade*; skills *Overclock*, *Minefield*, *Scrap Barrage*; passive *Fine Gearing*; talent *Shrapnel*.
- **Oracle (\`Oracle.cpp\`):** *Prophecy Ray* & *Fate Wheel*; skills *Astral Nova*, *Comet*, *Eclipse*; passive *Farsight*; talent *Starsight*.
- **Corsair (\`Corsair.cpp\`):** *Chain Shot* & *Riptide*; skills *Broadside*, *Powder Keg*, *Whirlpool*; passive *Sea Legs*; talent *Plunder*.

---

### 39 \`EnemyKind\` Species: Mimics, Renegades & \`WildFoe\` Greenwood Table (\`WildFoe.cpp\`)

Beyond the 16 classic monsters and 10 regional expansion monsters (\`src/entity/enemy/ExpansionEnemy.cpp\`), \`EnemyKind\` (\`src/entity/enemy/Enemy.hpp\`) spans **78 distinct species**:
1. **Disguised Chest \`Mimic\` (\`EnemyKind::Mimic\`):** Waits motionless in the grass (\`Lurk\` goal with \`buried = true\` so player weapons ignore it), rattles when approached, springs at close range, and bursts into a shower of coins, items, and potions on death.
2. **4 Renegade Adventurers (\`Outlaw\`, \`Berserker\`, \`PitFighter\`, \`Deserter\`):** Announced by *"RENEGADES ON YOUR TRAIL"* from 3 minutes onward. They wield real player weapons and telegraph special class skills with glowing warning rings.
3. **8 Greenwood & Woodland Foes (\`WildFoe::DEFS[8]\` in \`src/entity/enemy/WildFoe.cpp\`):**
   Driven by a compact data-driven behavior table \`WildFoe::DEFS[]\` across \`Thornling\`, \`Boar\`, \`GoblinArcher\`, \`GoblinShaman\`, \`Sapling\`, \`Treant\`, \`MothWisp\`, and \`Cutthroat\`:
   \`\`\`cpp
   void WildFoe::tick() {
     Enemy::tick();
     if (removed)
       return;
     life += DT;
     Player &p = *level->player;
     if (wild.grow > 0 && life >= wild.grow) {
       level->spawner.spawn(EnemyKind::Treant, x, y);
       level->add<Shockwave>(x, bodyY(), 4, 30, 0.4f, Color{0.45f, 0.8f, 0.35f, 1}, false);
       return remove();
     }
     if (wild.mends && (mendTime -= DT) <= 0) {
       mendTime = 1;
       if (Enemy *ally = hurtAlly(*this, 90)) {
         ally->hp = std::min(ally->maxHp, ally->hp + 4 * damageMul);
         Spark::burst(*level, ally->x, ally->bodyY(), HEX, 4, 30, true);
       }
     }
     if (wild.dims && !p.dead()) {
       double xd = p.x - x, yd = p.y - y;
       float reach = type.radius + p.radius + 4;
       if (xd * xd + yd * yd < reach * reach)
         p.dim = 4;
     }
   }

   float WildFoe::contactBonus(const Player &p) const {
     return wild.backstab && (x - p.x) * p.facing < 0 ? 1.5f : 1.0f;
   }
   \`\`\`
   - **\`Sapling\` → \`Treant\` Metamorphosis (\`wild.grow = 25\`):** If a \`Sapling\` survives for \`25s\`, it transforms in-place into a towering \`EnemyKind::Treant\` brute!
   - **\`Cutthroat\` Backstab (\`wild.backstab = true\`):** \`contactBonus(p)\` tests \`(x - p.x) * p.facing < 0\` and deals **\`1.5×\`** contact damage when striking from behind the player's facing direction!
   - **\`GoblinShaman\` (\`wild.mends = true\`):** Heals the most injured nearby monster within \`90 px\` every \`1.0s\` and casts \`hex\` every \`6.5s\` to inflict \`StatusKind::Weaken\` (\`25%\` for \`3.0s\`).
   - **\`MothWisp\` (\`wild.dims = true\`):** Sets \`p.dim = 4\` on contact, dimming the player's torch light radius.
   - **\`Thornling\` (\`wild.bramble = true\`):** Spawns a slowing \`Bramble\` hazard patch on death in \`WildFoe::die()\`.

---

### All 20 Elite & Champion \`Trait\` Modifiers (\`src/entity/Trait.hpp\`)

Elites roll 1 trait and **Named Procedural Champions** (e.g., *"A CHAMPION STALKS: MORGRA THE HOLLOW"*, carrying a crown ring, 2 traits, 1 skill, and 1 player weapon) roll 2 traits from a 20-bit \`Traits::bits\` pool:
- **Original 6 (\`0.5.12\`):** \`Hasted\` (+40% speed), \`Vampiric\` (leech on hit), \`Warded\` (5-hit shield + burst), \`Splitting\` (splits into 2 copies on death), \`Volatile\` (delayed death explosion), \`Frosted\` (chilling trail).
- **Wave 2 (\`0.5.13\`):** \`Thorned\` (reflects melee hits), \`Regenerating\` (heals when unhit), \`Blinking\` (teleports when struck), \`Phasing\` (\`veiled()\` untouchable 1s every 4s), \`Brooding\` (spawns weak copies every 8s), \`Gravitic\` (pulls player inward).
- **Wave 3 (\`Unreleased\`):** \`Cursed\` (inflicts \`Weaken\`/\`Marked\`), \`Silencing\` (delays skill cooldown), \`FireEnchanted\`, \`ColdEnchanted\`, \`StormEnchanted\` (elemental hits + death novas), \`StoneSkin\` (-15% speed, high physical mitigation), \`Multishot\` (extra projectiles), and \`AuraBearer\` (buffs nearby allies).

---

### 9 Three-Phase Bosses & 10 Towering Landmarks

- **9 Three-Phase Bosses (\`Boss.cpp\`):** In addition to the classic **Cyclops**, **Pack Lord**, and **Lich**, six biome-family bosses now stalk the world: **Frost Colossus**, **Glass Tyrant**, **Spore Mother**, **Cinder King**, **Bog Witch**, and **Storm Herald**. Every boss fights across **3 phases** (enraging at **66.7% HP** and **33.3% HP** with boss-bar notch markers, minion summons, brief wards, and telegraphed skill casts).
- **10 Towering Landmarks (\`Landmarks.cpp\`):** *Ancient Tree*, *Fallen Star*, *The Colossus*, *The Monolith*, *Crystal Spire*, *Great Mushroom*, *Shipwreck*, *Ancient Gate*, *Ember Forge*, and *Frozen Giant*—each placed on level dry ground in every second \`80×80\` region with off-screen compass markers and permanent first-visit rewards.
`,
    mermaidCharts: [
      {
        title: "Boss Phase Enrage & Telegraph Execution Loop",
        chart: `
stateDiagram-v2
    [*] --> Phase0 : Boss Spawned (100% HP)
    Phase0 --> Phase1_Enrage : HP < 66.7% (2/3 maxHp)
    Phase1_Enrage --> Phase1_Active : enrage() Shockwave + Speed Boost
    Phase1_Active --> Phase2_Enrage : HP < 33.3% (1/3 maxHp)
    Phase2_Enrage --> Phase2_Active : Final Enrage + 10-Orb Radial Spiral
    Phase2_Active --> BossDefeated : HP <= 0 (Drop Evolution Chest)
`,
      },
      {
        title: "Enemy Damage, Status Affliction & Elite Trait Pipeline",
        chart: `
flowchart TD
    classDef hit fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef stat fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef trait fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;

    Strike["Mob::strike(dmg, xd, yd, knock)"]:::hit
    Ward["TraitSet::Warded Check<br/>Absorbs Hit if Ward Charges > 0"]:::trait
    Mark["StatusKind::Marked Check<br/>Amplifies Incoming Damage (+15%..35%)"]:::stat
    Knock["Apply Knockback Impulse<br/>xa += xd * knock, ya += yd * knock<br/>Decay: exp(-9 * DT)"]:::hit
    Death["HP <= 0: EnemyDeath.cpp<br/>Trigger Volatile / Splitting Traits<br/>Spawn XP Gem & Bounty Progress"]:::trait

    Strike --> Ward --> Mark --> Knock --> Death
`,
      },
    ],
  },
  {
    id: "audio-qa",
    title: "11. Audio Streams, Voice Selection & Visual QA",
    category: "core",
    summary:
      "SDL3 effect streams, oldest-start voice selection, music and weather playback, and visual QA views.",
    sourceFiles: [
      "src/audio/Sound.cpp",
      "src/Bench.cpp",
      "src/test/Test.cpp",
      "src/test/view/Screenshots.cpp",
    ],
    content: `
### Sound effects, music and ambience (\`src/audio/Sound.cpp\`)

The audio device uses SDL streams. \`Sound::init()\` requests mono, 44.1 kHz signed 16-bit audio for the effect streams; the actual device format is queried and logged. Each effect WAV must match that requested format, or \`Sound::load()\` rejects it and logs a warning.

#### Effect voices

There are 32 pre-created effect streams. An effect has a shared minimum gap between plays, measured in milliseconds using \`SDL_GetTicks()\`. After the gap check, \`Sound::play()\` chooses the first stream whose queued input is empty. If none is empty, it chooses the stream with the oldest recorded start time. The chosen stream is cleared, assigned gain \`volume * effectsGain\`, given a frequency ratio of \`pitch * (1 + random jitter)\`, and filled with the effect's PCM data.

The selection uses start time, not sound category or priority. Music and ambient beds have separate streams and do not occupy the 32 effect slots. An empty input queue is SDL's reported queue state, not a guarantee about every sample already buffered downstream.

#### Music, weather and gain

- \`night.ogg\` is decoded into memory at initialization. \`Sound::tick()\` refills the music stream when its queued input falls below one decoded track's length, unless music is hushed for a clip.
- Rain and wind WAVs use separate looping streams. \`Sound::ambience()\` sets their target gains from clamped weather inputs, with peaks of 0.20 and 0.14. Each tick moves the current gain 2% toward its target. Once a silent target fades below 0.002, the stream queue is cleared.
- \`Sound::mix()\` sets the device master gain and the music stream gain. Effects use the effect gain when played; the next ambience target uses the ambience gain. Mute sets the device gain to zero and restores the stored master gain when toggled back.
- Some callers gate sound by visibility, such as \`Enemy::voice()\`. \`Sound::play()\` itself has no listener position or distance attenuation parameter.

#### One-shot clip playback

\`Sound::clip()\` decodes a separate Ogg file, queues it on its own stream and hushes music by clearing its queue and stopping refills. \`clipGain()\` clamps the clip gain to 0–1. \`endClip()\` releases the stream and decoded data and allows music refilling on a later tick. See the intro playback chapter for the video that uses this path.

### Automated Test Suites, Benchmarks & Visual QA (\`src/test/\`)

Mellangan includes a built-in verification and visual QA harness in \`src/test/\`:
- **Deterministic Unit & Simulation Suites (\`src/test/Test.cpp\`):**
  1. \`CoreTest.cpp\`: Slab allocator (\`testPoolAllocAndFree\`, \`testPoolConcurrency\`), level lifecycle, and multi-threaded AI passes.
  2. \`CombatTest.cpp\` & \`PayloadTest.cpp\`: 7 statuses (\`testStatuses\`, \`testStatusDamage\`, \`testNewStatuses\`), 16 weapon payloads (\`testNewPayloads\`), and shape forms (\`testShapeForms\`).
  3. \`ItemTest.cpp\`: 30 affix families, rarity rolls, treasure classes, paper-doll inventory (\`testInventory\`), and reversible gear stats (\`testEquipStats\`).
  4. \`AllyTest.cpp\`: Summon cap refreshing, quarry aggro redirection, decoy lure weighting, and friendly-fire immunity (\`testAllies\`).
  5. \`ClassTest.cpp\`, \`ArsenalTest.cpp\`, \`BestiaryTest.cpp\`, \`ExpansionEnemyTest.cpp\`, \`ExpansionTest.cpp\`: All 12 hero kits, 41 weapon evolutions, 78 foe species, and 20 traits.
  6. \`WorldTest.cpp\`, \`BiomeTransitionTest.cpp\`, \`BiomeEncounterTest.cpp\`, \`RunTest.cpp\`, \`RunRulesTest.cpp\`: Voronoi determinism, hill/tarn constraints, shoreline dry moats, and \`RunRules\` parameterization.
- **Headless GPU Screenshot & QA Views (\`Screenshots.cpp\`, \`QaViews.cpp\`, \`BiomeMap.cpp\`):** Programmatically stages combat encounters, boss fights, UI menus, and biome transitions, capturing uncompressed frames directly from Vulkan textures via \`vk2dTextureCopyPixels\`.
`,
    mermaidCharts: [
      {
        title: "SDL3 Effect Voice Selection & Weather Beds",
        chart: `
flowchart TD
    classDef sfx fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef mix fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Play["Sound::play(volume, pitchJitter, pitch)"]:::sfx
    Gate["Per-effect gap<br/>now - last < gap * 1000 -> Ignore"]:::sfx
    Scan["Scan voices[0..31]<br/>Find Queued == 0 OR Min(voiceStarted[i])"]:::mix
    Ratio["SDL_SetAudioStreamFrequencyRatio<br/>pitch * (1 + rng(-jitter, +jitter))"]:::mix
    Beds["Weather Beds (rain, wind)<br/>b.gain += (b.want - b.gain) * 0.02f"]:::mix
    Vorbis["stb_vorbis Music Stream<br/>(res/music/night.ogg)"]:::mix
    Device["SDL_AudioDeviceID<br/>Hardware Output"]:::out

    Play --> Gate --> Scan --> Ratio --> Device
    Beds --> Device
    Vorbis --> Device
`,
      },
      {
        title: "Automated Test Harness, Benchmark & GPU Screenshot Pipeline",
        chart: `
flowchart LR
    classDef cli fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef sim fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gpu fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    CLI["CLI Flags (main.cpp)<br/>--test | --bench | --screenshots | --qa"]:::cli
    Suite["Deterministic Test Suites<br/>Core, World, Combat, Arsenal, Biomes"]:::sim
    Bench["Bench.cpp<br/>Frame & Subsystem Timing Profiling"]:::sim
    Stage["Screenshots.cpp / QaViews.cpp<br/>Synthetic Scene & Combat Staging"]:::gpu
    Readback["vk2dTextureCopyPixels<br/>GPU Staging Buffer -> PNG Output"]:::gpu

    CLI --> Suite & Bench & Stage
    Stage --> Readback
`,
      },
    ],
  },
  {
    id: "contribute-basics",
    title:
      "12. Contribution Basics: Toolchain, Build, House Rules, DevStart & WorldDebug",
    category: "contribute",
    summary:
      "Step-by-step onboarding from cloning submodules and building with CMake/slangc to house rules, DevStart::seek() feature warps, and the F8 WorldDebug inspector.",
    sourceFiles: [
      "CMakeLists.txt",
      "NOTES.md",
      "src/main.cpp",
      "src/DevStart.hpp",
      "src/DevStart.cpp",
      "src/level/WorldDebug.cpp",
    ],
    content: `
### Welcome Contributor! Start with the Basics

Contributing to **Mellangan** is straightforward once you understand its build pipeline, strict house rules, and built-in developer sandbox. This tutorial walks you through the fundamentals step by step before diving into adding weapons, enemies, and biomes.

#### Step 1: Prerequisites & Submodule Clone
Mellangan requires:
- **CMake 3.21+** and a **C++20 / C11** compiler (MSVC 2022 on Windows, Clang on macOS, GCC/Clang on Linux).
- **LunarG Vulkan SDK:** Provides the Vulkan headers/loader and **\`slangc\`**, which compiles \`res/shaders/*.slang\` into SPIR-V (\`.spv\`) at build time. On Windows, \`CMakeLists.txt\` automatically detects \`C:/VulkanSDK/*\` even if \`VULKAN_SDK\` is not set in your environment.
- **Python 3 + Pillow 13.0.0:** Used only when regenerating or verifying the deterministic sprite atlas (\`tools/make_assets.py\`).

\`\`\`bash
git clone --recurse-submodules https://github.com/soulwax/Mellangan.git
cd Mellangan
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug --parallel
\`\`\`

#### Step 2: The Golden House Rules (\`NOTES.md\`)
Every pull request or task packet must obey five non-negotiable conventions:
1. **Pragmatic "C with Classes":** Use plain structs, fixed arrays, and direct loops where they fit; use classes for clear ownership and virtual extension points (\`SpriteObject\`, \`Entity\`, \`Mob\`, \`Upgrade\`, \`Goal\`, \`Biome\`).
2. **Submodule Boundaries:** Only \`extern/Vulkan2D\` and \`extern/wiki\` may be modified when needed. Treat \`extern/entt\`, \`extern/spdlog\`, and \`extern/stb\` as strictly read-only.
3. **Append-Only Enums (Save Compatibility):** \`EnemyKind\`, \`BiomeId\`, and \`HeroId\` indices are serialized in player saves, charts, and Codex progress. Always append new enum values at the end—never reorder or insert in the middle.
4. **No Unverified Commits:** Always run \`--test\` in a Debug build (so \`assert()\` checks are compiled in) and inspect visual changes at 1x native scale before considering a task complete.

#### Step 3: Fast Iteration with \`DevStart\` (\`src/DevStart.cpp\`) & \`WorldDebug\` (\`F8\`)
Never play for 10 minutes manually just to reach a test case! \`src/DevStart.cpp\` provides instant concentric-ring terrain feature warps (\`DevStart::seek\`), upgrade loadouts (\`DevStart::armPlayer\`), loot bag seeding (\`--give N\`), and ally pack summoning (\`--allies N\`):

\`\`\`cpp
template <class F> void DevStart::seek(F fits) {
  for (int r = 0; r < 2000; r += 4)
    for (int i = 0, n = std::max(1, r); i < n; i++) {
      double a = TAU * i / n;
      int tx = int(std::cos(a) * r), ty = int(std::sin(a) * r);
      if (fits(tx, ty)) {
        x = tx, y = ty, at = true;
        return;
      }
    }
}
\`\`\`

- **Hotkeys in \`--dev\` mode:**
  - \`F5\`: Instant Level-Up menu.
  - \`F6\`: Skip \`+30s\` on the night clock.
  - \`F7\`: Toggle God Mode (\`p.god = !p.god\`).
  - \`F8\`: Toggle **\`WorldDebug\` (\`src/level/WorldDebug.cpp\`)** — overlays the \`20 × 20\`-tile regional grid (\`R rx,ry\`), colour-coded \`Structure\` footprints with \`1\`-tile apron frames, pulsing target brackets (\`pulse = (2 + 2 * sin(t * 6)) * u\`), a dashed guide vector to the nearest unvisited structure, and live tile/biome/elevation telemetry panels!
  - \`F9\`: Warp to the nearest generated structure or shrine.
  - \`F10\`: Cycle to the next weather front (\`Rain\`, \`Snow\`, \`Storm\`, \`Sand\`).
- **Command-Line Warp & Loadout Flags (\`src/DevStart.hpp\`):**
  - \`--arm "=Ember Lance!,Bastion Shields"\`: Prefixing with \`'='\` (\`stripsLevels()\`) zeroes out starting class weapons first; appending \`'!'\` levels the upgrade to \`MAX_LEVEL\` and immediately calls \`u.evolve()\`.
  - \`--give 12 --loot\`: Rolls 12 \`ilvl = 30\` items at \`300%\` Magic Find directly into \`p.bag\` and enables ground loot drops.
  - \`--allies 6\`: Summons a ring of 6 allied companions (\`Wolf\`, \`Hawk\`, \`Ghoul\`, \`Skeleton\`, \`Drone\`, \`Crew\`) around the player at spawn.
  - \`--biome N\`, \`--at X,Y\`, \`--cliff\`, \`--ramp\`, \`--peak\`, \`--lake\`, \`--landmark N\`: Teleports directly to the nearest matching terrain feature.
`,
    mermaidCharts: [
      {
        title:
          "CMake Build, Slang Shader Compilation & Asset Bundling Pipeline",
        chart: `
flowchart LR
    classDef src fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef tool fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef bin fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    CPP["src/*.cpp (C++20 + src/pch.hpp)<br/>src/*.c (C11, SKIP_PRECOMPILE_HEADERS)"]:::src
    Slang["res/shaders/*.slang<br/>(flash.slang, post.slang...)"]:::src
    Sub["Vendor Submodules<br/>Vulkan2D, SDL3 (Static), EnTT, spdlog, stb"]:::src

    SlangC["Vulkan SDK slangc<br/>-target spirv -profile glsl_450<br/>-entry PixelShader -stage fragment"]:::tool
    Compiler["MSVC (/W4 /MP) or Clang/GCC<br/>Static CRT + Version.hpp Gen"]:::tool

    App["build/bin/MellanganApp<br/>+ Post-Build Copy of res/ & *.spv"]:::bin

    Slang --> SlangC --> App
    CPP --> Compiler
    Sub --> Compiler
    Compiler --> App
`,
      },
      {
        title: "Contributor Development & Verification Loop",
        chart: `
flowchart TD
    classDef step fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef gate fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    S1["1. Inspect Module & Callers<br/>Read NOTES.md & Shared Registry Contracts"]:::step
    S2["2. Implement Focused Change<br/>C-with-Classes Style, Zero Code Comments"]:::step
    S3["3. Build Debug Target<br/>cmake --build build --config Debug"]:::step
    G1["4. Run Headless & Graphical Assertions<br/>MellanganApp --test (All Tests Pass)"]:::gate
    G2["5. Visual Sandbox Verification<br/>MellanganApp --dev --arm / --biome / --test-*-view"]:::gate
    G3["6. Performance Check & Changelog<br/>MellanganApp --bench & Update CHANGELOG.md"]:::gate

    S1 --> S2 --> S3 --> G1 --> G2 --> G3
`,
      },
    ],
    interactiveComponent: "contribute",
  },
  {
    id: "tutorial-weapon",
    title: "13. Tutorial 1: Adding a New Weapon, Recipe & Evolution",
    category: "contribute",
    summary:
      "Hands-on beginner tutorial: 16 Form trajectories, evolution partner registration, level-up cards, and --weapon-lab audit.",
    sourceFiles: [
      "src/item/weapon/Recipe.cpp",
      "src/item/Upgrade.cpp",
      "src/Atlas.hpp",
      "src/test/ArsenalTest.cpp",
      "src/item/WeaponLab.cpp",
    ],
    content: `
### Add a weapon

First choose what your weapon does. A **form** controls its movement or shape, such as a bolt, orbit, or boomerang. A **payload** adds an effect, such as burn, chill, or chain lightning. If an existing form and payload fit your idea, add one row to \`src/item/weapon/Recipe.cpp\` (Path A below). If the weapon needs movement or drawing code that does not exist yet, write an \`Upgrade\` class (Path B). Start with Path A if this is your first weapon.

---

#### Path A: Add a recipe in \`Recipe.cpp\`

Suppose we want to add a new Stormcaller weapon called **\`Tempest Chakram\`** that throws a boomerang disc that both **Chains** lightning and **Marks** enemies:

##### Step 1: Add the \`Recipe\` Entry in \`src/item/weapon/Recipe.cpp\`
Find \`RECIPES\` and add a row beside similar weapons. Its fields, in order, are:
\`{ name, ownerClass, pitch, unitName, iconIndex, form, payloadMask, baseDamage, cooldown, reach, speed, count, tintColor, particleSprite }\`:

\`\`\`cpp
{"Tempest Chakram", "STORMCALLER", "A charged disc arcs out and chains lightning",
 "disc", 13, Form::Boomerang, pay::Chain | pay::Mark, 15, 1.9f, 175, 230, 1,
 {0.55f, 0.85f, 1.0f, 1.0f}, atlas::pt::ArcaneStar}
\`\`\`

##### Step 2: Check the five levels
\`RecipeWeapon\` creates the level-up descriptions from your row. It checks whether the form covers an area to decide which level-three bonus to give:
* **Level 1:** Base weapon unlocked (\`r.pitch\`).
* **Level 2:** \`+50% base damage\`.
* **Level 3:** \`+1 disc\` (for projectile count forms) or \`+30% radius\` (for area forms).
* **Level 4:** \`-20% cooldown\`.
* **Level 5:** Evolution readiness. Level-up cards dynamically announce the required catalyst passive (such as \`"evolves with Conduit"\`), highlighted in gold when held.

##### Step 3: Add the evolution pair in \`src/item/Upgrade.cpp\`
Find \`EVOLUTIONS\` and add the base weapon, required passive, and evolved weapon in that order:
\`\`\`cpp
{"Tempest Chakram", "Conduit", "Storm Maelstrom"},
\`\`\`
The startup content check verifies the names and the one-to-one pairing. Use the exact names already registered for the passive and evolved weapon.

---

#### Path B: Write a weapon class when a recipe is not enough

##### Step 1: Reserve an Icon in \`src/Atlas.hpp\`
Reserve an index in \`atlas::i::*\` for your weapon's 16x16 icon in the UI atlas.

##### Step 2: Subclass \`Upgrade\` in \`src/item/weapon/\`
Implement your weapon class inheriting from \`Upgrade\`, overriding \`tick()\`, \`levelUp()\`, and \`evolve()\`:
\`\`\`cpp
class CustomBlade : public Upgrade {
public:
  CustomBlade() : Upgrade("Custom Blade", "Strikes nearby foes", atlas::i::Sword) {
    weapon = true;
  }
  void tick() override;
};
\`\`\`

##### Step 3: Register in \`Upgrade::all()\` (\`src/item/Upgrade.cpp\`)
Add your weapon instance to the master upgrade registry so the level-up drafting director can offer it during runs.

##### Step 4: Check damage with \`--weapon-lab\`
Run the weapon lab after the weapon works in-game. It writes a CSV file that lets you compare damage across levels:
\`\`\`sh
./build/Release/Mellangan --weapon-lab weapon_audit.csv
\`\`\`
Read the damage-per-second results for stationary targets and the moving crowd. Check that each upgrade changes something useful and that the evolution does not jump far beyond nearby weapons.
`,

    mermaidCharts: [
      {
        title: "Step-by-Step Weapon & Evolution Registration Flow",
        chart: `
flowchart TD
    classDef art fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef code fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef reg fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef qa fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    A1["Step 1: 16x16 Icon in res/atlas.png<br/>tools/atlas_layout.py & src/Atlas.hpp"]:::art
    C1["Option A: Add Recipe Row<br/>src/item/weapon/Recipe.cpp"]:::code
    C2["Option B: Subclass Upgrade & Projectile<br/>src/item/weapon/MyWeapon.cpp"]:::code
    R1["Step 3: Register in Upgrade::all()<br/>src/item/Upgrade.cpp + Catalyst Pairing"]:::reg
    Q1["Step 4: Verify with CLI & ArsenalTest<br/>--dev --arm 'Weapon!' & --test-arsenal-view"]:::qa

    A1 --> C1 & C2
    C1 & C2 --> R1 --> Q1
`,
      },
      {
        title: "Projectile Lifecycle & Slab Memory Reclamation",
        chart: `
sequenceDiagram
    autonumber
    participant Wpn as Upgrade::tick(Mob &p)
    participant Lvl as Level::add<T>()
    participant Pool as Pool.c (pool_alloc)
    participant Shot as Projectile::tick()
    participant Enemy as Enemy::strike()

    Wpn->>Pool: operator new(sizeof(MyProjectile))
    Pool-->>Wpn: O(1) Slot from freeList[c]
    Wpn->>Lvl: level->add(unique_ptr<Entity>)
    Lvl->>Lvl: flush() -> reg.emplace<Owned>(id)
    loop Every 60Hz Tick while age < life
        Lvl->>Shot: shot->tick()
        Shot->>Lvl: level->foes(hostile, x, y, r) [CSR Grid]
        Shot->>Enemy: e.afflict(StatusKind) + e.strike(dmg)
    end
    Shot->>Shot: remove() (removed = true)
    Lvl->>Pool: flush() -> virtual ~SpriteObject -> pool_free(p, size)
`,
      },
    ],
  },
  {
    id: "tutorial-enemy-biome",
    title: "14. Tutorial 2: Adding a Monster, AI Plan & Biome Niche",
    category: "contribute",
    summary:
      "Advanced tutorial: append save-safe EnemyKind enums, compose zero-allocation GoalQueue plans, and register a new Biome.",
    sourceFiles: [
      "src/entity/enemy/Enemy.hpp",
      "src/entity/enemy/Roster.cpp",
      "src/entity/enemy/ai/Plans.cpp",
      "src/level/biome/Biome.cpp",
    ],
    content: `
### Add a monster, then give it a home

The monster and its biome are two separate changes. First give the monster an ID, artwork, behavior, and stats. Then add it to a biome's spawn list. A **spawn mask** is a number whose bits say which monsters may appear there. Existing save data also uses monster IDs as positions in an array, so ID order matters.

---

#### Part 1: Step-by-Step Monster Creation

##### Step 1: Append \`EnemyKind\` at the End (\`src/entity/enemy/Enemy.hpp\`)
Saved Codex kill counts use \`int(EnemyKind)\` as array positions. Append a new kind after the existing ones, just before the enum's count marker. Reordering old kinds would change what an existing save means. \`Night::strongestUnlocked\` also relies on the ordering of classic monsters before \`Cyclops\`.

##### Step 2: Paint the 16×16 Silhouette & Verify the Atlas
1. Add the procedural pixel-art generator for your creature's \`16×16\` cell in \`tools/make_expansion.py\` (using \`Canvas\` contour, cluster, and highlight primitives from \`tools/sprite_kit.py\`).
2. Run \`python tools/make_assets.py --verify\` to rebuild \`res/atlas.png\` and verify deterministic RGBA/PNG hashes and 1px transparent gutters.

##### Step 3: Choose existing AI goals in \`Plans.cpp\`
A \`Plan\` is a small list of actions the monster can try. Reuse goals such as approach, stalk, or melee before writing a new goal. Add a fallback or interrupt such as \`FALTER\` or \`HIDE\`:

\`\`\`cpp
const Approach DART_IN{42, {0.8, 1.1, 3, 0, 0, true}};
const Melee STING{0.22f, 0.20f, 3.1, 1.3f};

const Plan PLANS[] = {
  {{&STALK, &DART_IN, &STING}, {&FALTER}},
};
\`\`\`

\`Goal::tick()\` runs on worker threads. It may set an intent on its own enemy, such as \`e.wantsFire = true\`. Spawn the projectile later in \`Enemy::act()\` on the main thread. Changing shared level lists from a worker can race with other updates.

##### Step 4: Register Stats in \`Roster.cpp\` & Biome \`foes\` Bitmask
Add the \`EnemyType\` row (name, sprite, radius, speed, HP, contact damage, XP value, death effect style) and include \`1ULL << int(EnemyKind::MyMonster)\` in its home biome's \`foes\` mask.

---

#### Part 2: Step-by-Step Biome Creation (\`src/level/biome/\`)

1. **Append \`BiomeId\`:** Add your new biome ID at the end of \`BiomeId\` in \`src/level/biome/Biome.hpp\` and increment \`BIOME_COUNT\`.
2. **Define Climate Niche & Props:** Subclass \`Biome\` (or configure an \`ExpansionBiome\` entry in \`src/level/biome/ExpansionBiome.cpp\`) with:
   - Ground tint and transition surface (\`transitionGround(int kind)\`).
   - Three characteristic 16×16 props (trees, rocks, flora) with collision radii.
   - Regional \`foes\` spawn bitmask and structure weights.
   - A distinct **gameplay rule** (e.g., conductive storm water, fracturing salt crust, or healing grove breeze) rather than a mere palette swap.
3. **Verify Reachability in \`WorldTest.cpp\` & \`BiomeTransitionTest.cpp\`:**
   Run \`./build/bin/Debug/MellanganApp.exe --test\` to verify that the bounded multi-seed survey reaches all biomes and that \`world::groundBlend(x, y)\` produces smooth 3-biome barycentric transitions across every boundary!
`,
    mermaidCharts: [
      {
        title: "Thread-Safe Monster AI Intent vs Main-Thread Action Contract",
        chart: `
flowchart TD
    classDef worker fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef main fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef danger fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;

    subgraph Parallel_Phase ["PROF_THINK (Worker Threads - Read-Only World)"]
        Sense["Compute Sense<br/>(xd, yd, dist, seen)"]:::worker
        GoalTick["Goal::tick(Enemy &e, Sense &s, xs, ys)<br/>Writes e.xWant, e.yWant, e.wantsFire = true"]:::worker
        Forbidden["NEVER Call level->add() or Sound::play()<br/>Directly Inside Goal::tick()!"]:::danger
        Sense --> GoalTick
    end

    subgraph Serial_Phase ["PROF_ENTITIES (Main Thread - Safe Mutation)"]
        EntTick["Enemy::tick() -> Enemy::act()"]:::main
        Spawn["If (wantsFire):<br/>level->add<Orb>(...) & Enemy::voice()"]:::main
        EntTick --> Spawn
    end

    GoalTick ==>|Barrier Sync| EntTick
`,
      },
      {
        title:
          "Deterministic Asset Pipeline & Save-Safe Registration Checklist",
        chart: `
flowchart TD
    classDef step fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef verify fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    P1["1. Reserve 18x18 Cells in tools/atlas_layout.py<br/>Paint 16x16 Sprite in tools/make_expansion.py"]:::step
    P2["2. Run python tools/make_assets.py --verify<br/>Byte-Identical Dual-Run RGBA & PNG Hash Check"]:::verify
    P3["3. Append EnemyKind / BiomeId at Enum End<br/>Preserves Codex & Chart Save Compatibility"]:::step
    P4["4. Wire Plans.cpp, Roster.cpp & Biome.cpp<br/>Verify Reachability in --test & --test-biome-view"]:::verify

    P1 --> P2 --> P3 --> P4
`,
      },
    ],
  },
  {
    id: "tutorial-hero-class",
    title:
      "15. Tutorial 3: Adding a Playable Hero, Active Skill, Talent & Relic",
    category: "contribute",
    summary:
      "Step-by-step guide to defining HeroData, Mob-symmetric active skills, class talents, boss relics, and Codex unlock predicates.",
    sourceFiles: [
      "src/hero/Hero.hpp",
      "src/hero/Hero.cpp",
      "src/hero/ExpansionHero.hpp",
      "src/hero/Warden.cpp",
      "src/item/skill/Skill.hpp",
      "src/item/talent/ExpansionTalents.cpp",
      "src/item/relic/ExpansionRelics.cpp",
    ],
    content: `
### Add a playable hero

Start with the hero's data: name, starting weapon, stats, and unlock rule. Then add its active skill and any class-only talents or relics. The main types are \`HeroData\`, \`Hero\`, and \`ExpansionHero\` in \`src/hero/\`. A complete class package consists of:
1. **Hero data and behavior (\`src/hero/*.cpp\`):** Set the starting stats and weapon. Write \`met(const Codex &)\` to decide when the class unlocks. Add passive behavior in hooks such as \`tick\` or \`guard\`, and list three favored upgrades in \`affinity[3]\`.
2. **Active skill (\`cast(Mob &)\`):** \`HeroSkill\` connects the hero's cast function to the Space key. You can add other skills that appear in level-up choices under \`src/item/skill/\`.
3. **Talents and relics:** Put class-only talents in \`src/item/talent/\` and boss-chest relics in \`src/item/relic/\`.

---

#### Step 1: Define \`HeroData\` and the Codex Unlock Predicate
In \`src/hero/Hero.hpp\`, every hero initializes \`HeroData\`:

\`\`\`cpp
struct HeroData {
  const char *name, *weapon, *title, *trait, *need;
  bool (*met)(const Codex &);
  int tile;
  Color tint;
  float hp, speed, might, haste, magnet, armor, regen, luck;
  const char *skill, *skillDesc;
  float cooldown;
  const char *affinity[3];
};
\`\`\`

Look at the unlock functions in \`src/hero/Warden.cpp\` and nearby hero files. They read the saved \`Codex\` and return true after a milestone, such as seeing a dawn or reaching a kill count. Here is the shape of one such function and its data row:

\`\`\`cpp
bool chronomancer(const Codex &c) { return c.dawns > 0; }

const HeroData CHRONO_DATA = {
    "CHRONOMANCER", "Hourglass Shard", "Weaver of fractured seconds",
    "Cooldowns tick 15% faster below half health", "see a dawn", chronomancer, 84,
    {0.55f, 0.85f, 1.0f, 1.0f}, -5, 1.04f, 0.05f, -0.05f, 4, 0, 0, 0.03f,
    "TIME STOP", "Freeze nearby foes for 2.5s and restore 25% cooldown", 12,
    {"Hourglass Shard", "Hourglass Tonic", "Prism Beam"}
};
\`\`\`

---

#### Step 2: Make the skill work for either side
\`Hero::cast(Mob &p)\` accepts a \`Mob\` because both the player and a hostile Renegade can use a hero's skill. The caster is \`p\`; its enemies depend on \`p.hostile\`.
- **Always use \`p.level->foes(p, ...)\` or \`p.hostile\`** when spawning projectiles or dealing area damage inside \`Hero::cast(Mob &p)\` and \`ability::*\` functions (\`src/entity/Ability.hpp\`).
- Never hardcode \`p.level->player\` as the caster—\`testArtsBothSides()\` in \`src/test/ClassTest.cpp\` specifically tests every hero ability cast by both a \`Player\` and a hostile \`Enemy\`!

\`\`\`cpp
void MyHero::cast(Mob &p) const {
  if (p.dead())
    return;
  p.level->foes(p, p.x, p.y, 120, [&](Mob &e) {
    e.afflict(StatusKind::Chill, 2.5f, 0.8f);
    e.strike(24 * p.might, e.x - p.x, e.y - p.y, 60);
  });
  flourish::sigil(*p.level, p.x, p.y, 120, tint, 0);
  Sound::nova.play(0.4f);
}
\`\`\`

---

#### Step 3: Append to \`HEROES[]\` & Add Class Talents / Relics
1. **Append Only:** Increment \`HERO_COUNT\` in \`src/hero/Hero.hpp\` and append your hero pointer at the **end** of \`HEROES[HERO_COUNT]\` in \`src/hero/Hero.cpp\` so saved \`Codex::start\` indices stay valid.
2. **Add a Class Talent (\`src/item/talent/\`):** Subclass \`Upgrade\` with \`owner = "CHRONOMANCER"\` so \`LevelUpMenu\` only offers that talent when playing your hero.
3. **Verify with \`--test\`:** Run \`MellanganApp --test\` to execute \`testClassKits()\` and \`testArtsBothSides()\`.
`,
    mermaidCharts: [
      {
        title:
          "Hero Class, Active Skill & Renegade Mirror-Symmetry Architecture",
        chart: `
flowchart TD
    classDef hero fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef mob fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef target fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    HeroDef["class Hero : public HeroData<br/>equip(Mob &), cast(Mob &), tick(Mob &)"]:::hero
    HeroSkill["HeroSkill : public Skill<br/>Wraps hero.cast(p) on Spacebar"]:::hero

    PlayerCaster["Player (hostile = false)<br/>Player::cast() -> skill->use(*this)"]:::mob
    RenegadeCaster["Renegade Mirror Foe (hostile = true)<br/>Renegade::tick() -> hero->cast(*this)"]:::mob

    FoeQuery["level->foes(caster, x, y, r)<br/>Filters by e.hostile != caster.hostile"]:::target
    Verify["testArtsBothSides() (ClassTest.cpp)<br/>Asserts Symmetry for Player & Hostile Casts"]:::target

    HeroDef --> HeroSkill --> PlayerCaster
    HeroDef --> RenegadeCaster
    PlayerCaster & RenegadeCaster --> FoeQuery --> Verify
`,
      },
      {
        title: "Codex Unlock Predicate, Class Affinity & Relic Synergy Flow",
        chart: `
flowchart TD
    classDef codex fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef menu fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef run fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Save["Codex Save State (Saves.cpp)<br/>biomes, kills(), shrines, bestStreak"]:::codex
    Met["HeroData::met(const Codex &)<br/>Unlocks Hero in ClassMenu.cpp"]:::codex
    Equip["Player::onAdded() -> hero->equip(*this)<br/>Grants Starter Weapon + HeroSkill + Base Stats"]:::menu
    Affinity["hero->favours(upgrade)<br/>Weights affinity[3] Cards in LevelUpMenu.cpp"]:::run
    Talent["Class-Restricted Talents (owner == hero->name)<br/>+ Boss Chest Relics (Chest.cpp)"]:::run

    Save --> Met --> Equip --> Affinity --> Talent
`,
      },
    ],
  },
  {
    id: "tutorial-structures-boss",
    title:
      "16. Tutorial 4: Adding World Landmarks, Interactive Sites & 3-Phase Bosses",
    category: "contribute",
    summary:
      "Step-by-step guide to procedural StructureDef footprints, interactive encounter::Site triggers, and 3-phase BossDef cast tables.",
    sourceFiles: [
      "src/level/Structure.hpp",
      "src/level/structure/Landmarks.cpp",
      "src/level/encounter/Landmarks.cpp",
      "src/entity/enemy/Boss.hpp",
      "src/entity/enemy/Boss.cpp",
    ],
    content: `
### Add a landmark or a boss

These are separate contributions. A **landmark** places tiles and props at a site in the world. An **encounter** defines what happens when the player reaches it. A regional boss has its own combat phases. Build and check one part before adding the next.

---

#### Part 1: Adding a World Landmark & Interactive Site

##### Step 1: Append \`StructureKind\` in \`src/level/Structure.hpp\`
Structures are divided into common settlements (\`Cottage\` .. \`Mine\`) and rare regional **Landmarks** (\`kind >= StructureKind::AncientTree\`).
- Append your new landmark before \`StructureKind::Count\` in \`enum class StructureKind\`.

##### Step 2: Define the Footprint in \`STRUCTURES[]\` (\`src/level/Structure.cpp\` & \`src/level/structure/Landmarks.cpp\`)
\`StructureDef\` has four optional functions. They receive \`(lx, ly)\`, the tile's position inside the structure's \`w × h\` rectangle:
- \`void (*size)(uint32_t roll, int *w, int *h)\`: Sets the tile bounding box (e.g. \`*w = 9; *h = 9;\`).
- \`bool (*dirt)(const Structure *s, int lx, int ly)\`: Returns \`true\` where dirt paths or cleared foundations replace grass.
- \`bool (*ground)(const Structure *s, int lx, int ly, Sprite *out)\`: Overrides floor tiles (cobblestone, rune circles, grates).
- \`bool (*prop)(const Structure *s, int lx, int ly, uint32_t roll, Prop *p)\`: Places pillars, altars, braziers, or walls with collision radii and heights.

##### Step 3: Wire the Interactive Encounter in \`src/level/encounter/Landmarks.cpp\`
The encounter code in \`src/level/encounter/Landmarks.cpp\` handles what happens at the site. Depending on the landmark, it can react to \`E\` or to proximity. Read a nearby encounter before adding one. It may show particles and then give a reward or start a fight.
- Test your landmark immediately via CLI:
\`\`\`cpp
./build/bin/Debug/MellanganApp.exe --dev --landmark 8
\`\`\`

---

#### Part 2: Designing a 3-Phase Regional Boss (\`src/entity/enemy/Boss.cpp\`)

Regional bosses are configured declaratively via \`struct BossDef\` in \`src/entity/enemy/Boss.hpp\`:

\`\`\`cpp
struct Phase {
  const Cast *casts;
  int count;
};

struct BossDef {
  EnemyKind kind;
  const char *title, *arrival, *fall;
  Color tone;
  Phase phases[3];
  EnemyKind minion;
  int minions;
  uint32_t lands;
};
\`\`\`

##### Step 1: Compose the 3 Phase \`Cast\` Arrays in \`src/entity/enemy/Boss.cpp\`
Each \`Cast\` entry specifies \`{ void (*fn)(Enemy &), float cooldown, float range, Color telegraphTone }\`. As the boss's HP drops below **66% (Phase 2)** and **33% (Phase 3)**, it automatically escalates to faster cooldowns and deadlier \`ability::*\` patterns (\`ability::thunder\`, \`ability::comet\`, \`ability::quake\`, \`ability::grasp\`, \`ability::miasma\`, \`ability::firering\`, \`ability::volley\`):

\`\`\`cpp
const Cast MY_BOSS_P1[] = {
    {[](Enemy &e) { ability::quake(e, 110, 12); }, 7, 110, GLASS},
    {[](Enemy &e) { ability::volley(e, 5, 0.2, 220, 8, 1); }, 6, 300, GLASS}};
const Cast MY_BOSS_P2[] = {
    {[](Enemy &e) { ability::charge(e, 140, 14); }, 5, 240, GLASS},
    {[](Enemy &e) { ability::volley(e, 9, 0.15, 230, 8, 1); }, 6, 300, GLASS}};
const Cast MY_BOSS_P3[] = {
    {[](Enemy &e) { ability::volley(e, 16, TAU / 16, 220, 8, 1); }, 5, 300, GLASS},
    {[](Enemy &e) { ability::dance(e, 90, 12, GLASS); }, 5, 200, GLASS}};
\`\`\`

##### Step 2: Bind the Biome Mask \`lands\` & Minion Retinue
Set \`lands = land(BiomeId::CrystalFields)\` (or a bitwise OR of multiple \`BiomeId\` bits) so \`bossFor(int biome)\` selects your boss when the night clock triggers a regional boss spawn in that biome!
`,
    mermaidCharts: [
      {
        title: "Deterministic Region Structure & Landmark Encounter Pipeline",
        chart: `
flowchart LR
    classDef world fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef def fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef enc fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Region["World::structureInRegion(rx, ry)<br/>Deterministic Seed Roll"]:::world
    Footprint["StructureDef Callbacks (lx, ly)<br/>size() -> dirt() -> ground() -> prop()"]:::def
    Ambient["Ambient Site Tick (Sites.cpp)<br/>encounter::smoke / runes / starlight"]:::enc
    Interact["Player Approaches & Presses E<br/>Triggers Landmark Boon, Trial or Elite"]:::enc

    Region --> Footprint --> Ambient --> Interact
`,
      },
      {
        title:
          "3-Phase Boss Cast Rotation, Telegraph & Chest Drop State Machine",
        chart: `
stateDiagram-v2
    [*] --> Arrival: Night Boss Timer or Landmark Trigger
    Arrival --> Phase1_100_to_67_HP: Announce BossDef.arrival + Spawn Minion Retinue
    Phase1_100_to_67_HP --> Phase2_66_to_34_HP: HP <= 66% (Escalate Cast Table & Speed)
    Phase2_66_to_34_HP --> Phase3_Below_33_HP: HP <= 33% (Enrage Casts + Dense Telegraphs)
    Phase3_Below_33_HP --> Defeated: HP <= 0
    Defeated --> [*]: Announce BossDef.fall + Spawn Boss Chest (Evolution / Relic)
`,
      },
    ],
  },
  {
    id: "tutorial-pixel-shader",
    title:
      "17. Tutorial 5: Procedural 16x16 Pixel-Art (sprite_kit.py) & Slang Shaders",
    category: "contribute",
    summary:
      "Step-by-step guide to painting procedural 16x16 sprites in Python, validating 1px atlas gutters, and authoring Vulkan Slang shaders.",
    sourceFiles: [
      "tools/sprite_kit.py",
      "tools/atlas_layout.py",
      "tools/make_assets.py",
      "res/shaders/flash.slang",
      "res/shaders/post.slang",
      "src/gfx/Screen.cpp",
    ],
    content: `
### Add artwork or a shader

Artwork and shaders are separate tasks. The atlas is the large image containing the game's small sprites. \`tools/make_assets.py\` assembles it from source sheets and drawing scripts; \`tools/atlas_layout.py\` describes where each group of sprites belongs. A Slang shader is text code compiled to SPIR-V for the GPU.

---

#### Part 1: Add a 16 × 16 sprite

Use \`tools/atlas_layout.py\` to find the band and confirm an unused cell. Draw the sprite in the generator for that band under \`tools/\`, or update the source art that generator reads. Paint within 16 × 16 pixels. The surrounding one-pixel border keeps neighboring sprites from bleeding into it.

Add a named index or sprite lookup in \`src/Atlas.hpp\` so C++ can find the new image. Run \`python tools/make_assets.py --verify\` with the source-sheet path required by that script. Inspect the generated atlas and the sprite in-game. The script also has a \`--from-atlas\` mode for reusing the existing base image; check its usage before choosing that mode.
---

#### Part 2: Authoring Slang Fragment Shaders (\`res/shaders/*.slang\`)

At build time, \`CMakeLists.txt\` compiles every \`res/shaders/*.slang\` file into SPIR-V via \`slangc\`:
\`slangc <file>.slang -target spirv -profile glsl_450 -entry PixelShader -stage fragment -o shaders/<file>.spv\`

##### Read the shader inputs (\`flash.slang\` and \`post.slang\`)
A fragment shader calculates a pixel's final color. These shaders receive textures, a sampler, and small blocks of settings through Vulkan bindings. Keep the binding numbers and data layout in sync with the C++ renderer:
- \`[[vk::push_constant]] Push push;\` — Contains \`cameraIndex\`, bindless \`textureIndex\`, \`texturePos\`, vertex \`colour\`, and \`model\` matrix.
- \`[[vk::binding(1, 1)]] SamplerState sampler;\`
- \`[[vk::binding(2, 2)]] Texture2D<float4> textures[];\` — Bindless texture array indexing both \`res/atlas.png\`, the offscreen world target, and the offscreen additive light map (\`post.lightTexture\`).
- \`[[vk::binding(3, 3)]] ConstantBuffer<T> ubo;\` — Custom uniform buffer (\`FlashData\` in \`flash.slang\` or \`PostData\` in \`post.slang\`).

##### How Sharp Pixel-Art Upscaling & ACES Lighting Work in \`post.slang\`
Instead of blurry bilinear filtering or shimmering nearest-neighbor at non-integer window scales, \`albedoAt(float2 uv)\` computes sub-pixel anti-aliased texel edges scaled by \`post.scale\`:
\`\`\`cpp
float2 p = uv - 0.5;
float2 i = floor(p);
float2 f = saturate((p - i - 0.5) * post.scale + 0.5);
\`\`\`
The final \`PixelShader\` also applies the hurt effect, light map, bloom, tone mapping, vignette, and pause blur. When changing one effect, compare the image before and after at the same scene and scale. The light map multiplies \`lightAt(uv)\` by \`1.6\`; a light value of \`0.625\` therefore acts as neutral brightness.
`,
    mermaidCharts: [
      {
        title:
          "sprite_kit.py Procedural Canvas -> atlas_layout.py Gutter Verifier Pipeline",
        chart: `
flowchart LR
    classDef py fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef cell fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef check fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Kit["Canvas(16, 16) (sprite_kit.py)<br/>cluster / ellipse / material + Auto-Outline (63,38,49)"]:::py
    Place["place_cell(atlas, band, idx, img)<br/>Pastes at (band.x + col*18 + 1, band.y + row*18 + 1)"]:::cell
    Verify["python tools/make_assets.py --verify<br/>Checks 1px Transparent Gutter + Dual-Run SHA-256"]:::check
    Header["src/Atlas.hpp<br/>constexpr Sprite Bound to GPU UV Quad"]:::check

    Kit --> Place --> Verify --> Header
`,
      },
      {
        title:
          "Vulkan2D Bindless Slang Shader & Light-Map Post-Processing Pipeline",
        chart: `
flowchart LR
    classDef pass fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef ubo fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    WorldTarget["Offscreen World Target<br/>Radix-Sorted Sprites + flash.slang"]:::pass
    LightTarget["Offscreen Light Map (post.lightTexture)<br/>Neutral 0.625 + Additive Screen::glow()"]:::pass
    PostUBO["ConstantBuffer<PostData><br/>hurt, lowHealth, vignette, pause, shrine, scale"]:::ubo
    PostShader["post.slang PixelShader(uv)<br/>Sharp Bilinear + Light*1.6 + 8-Tap Bloom + ACES"]:::out

    WorldTarget & LightTarget & PostUBO --> PostShader
`,
      },
    ],
    interactiveComponent: "pixelshader",
  },
  {
    id: "tutorial-testing-profiling",
    title:
      "18. Tutorial 6: Writing Deterministic Tests, Visual QA Views & Prof.c Benchmarks",
    category: "contribute",
    summary:
      "Hands-on testing tutorial: deterministic unit tests, --weapon-lab DPS audit, --soak 60-min autopilot, and --bench-gate.",
    sourceFiles: [
      "src/test/Tests.hpp",
      "src/test/Test.cpp",
      "src/Bench.cpp",
      "src/Prof.c",
      "src/item/WeaponLab.cpp",
    ],
    content: `
### Check a change with tests and measurements

Start with \`--test\` for code behavior. Use a visual view when pixels or layout changed. Use the weapon lab for damage balance, or a soak run for performance over time. These tools answer different questions; pick the one that matches your change.

#### The Modern CLI Toolchain & Test Suite

1. **Deterministic Unit Tests (\`--test\`):**
   Runs the full suite of unit tests declared in \`src/test/Tests.hpp\`. The suite seeds its PRNG, verifies weapon mechanics, affix roll distributions, crowd separation algorithms, bastion siege integrity, and cross-references all item and asset link tables. Builds with AddressSanitizer and UndefinedBehaviorSanitizer execute cleanly with zero warnings.

2. **Headless Weapon Lab Audit (\`--weapon-lab [out.csv]\`):**
   Automates balance testing across all 82 evolutions and base weapons. Simulates 42 stationary dummies and a marching 40-knight horde under fixed seeds, reporting DPS, flat levels, and crowd share anomalies directly to CSV.

3. **Autopilot Soak Testing (\`--soak [minutes]\`):**
   Launches god-mode autopilot runs that navigate, answer level-up menus, and loop through dawns continuously for up to 60 minutes. Every minute, the harness logs frame rate, 99th-percentile frame latency, resident memory footprint, and active entity counts. The harness exits with failure code 2 if:
   * Frame rate drops below 55 fps or frame $p_{99}$ latency exceeds 16.7 ms.
   * Process memory expands by more than 32 MB over initial run baseline.
   * Frame execution stalls due to window minimization or display lock.

4. **Release Gate Verification (\`--bench-gate\`):**
   Executes a stress benchmark scaling up to 10,000 active enemies. The release packaging pipeline (\`package.ps1\`) enforces that the 10,000-mob row must maintain at least 55 fps with frame $p_{99} < 16.7\\text{ ms}$, failing the release build if performance slips.

5. **Continuous Integration Matrix (GitHub Actions):**
   Every commit and pull request compiles across three distinct environments:
   * **Windows:** MSVC with \`/W4 /WX\` (warnings as errors) across Debug and Release targets.
   * **Linux:** Clang with \`-Werror\` under AddressSanitizer and UBSan.
   * **macOS (Apple Silicon):** Native arm64 Clang build with validation layers.
   All three environments execute \`--test\` headlessly without requiring a physical GPU.

#### Writing a Deterministic Unit Test (\`src/test/\`)

\`\`\`cpp
#include "test/Test.hpp"
#include "level/Level.hpp"
#include "entity/enemy/Enemy.hpp"

void testCrowdPush() {
  Level level;
  level.seed(1337);
  // Spawn two overlapping enemies and verify soft-body relaxation
  Enemy *a = level.spawn<Enemy>(EnemyKind::Wolf, 100, 100);
  Enemy *b = level.spawn<Enemy>(EnemyKind::Wolf, 101, 100);
  level.buildGrid();
  level.push();
  level.settle();
  test_assert(a->x != b->x, "Mobs must push apart deterministically");
}
\`\`\`
`,

    mermaidCharts: [
      {
        title:
          "Headless Deterministic Simulation & Assertions Pipeline (--test)",
        chart: `
flowchart LR
    classDef init fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef sim fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef pass fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Run["MellanganApp --test<br/>runTests() (#undef NDEBUG)"]:::init
    PoolTest["testPoolAllocAndFree() &<br/>testPoolConcurrency() (8 Threads)"]:::sim
    SimSuites["27 Deterministic Gameplay Suites<br/>Arsenal, Biomes, Classes, Combat, Traits"]:::sim
    Shutdown["pool_shutdown()<br/>Reclaims All 64 KB Slabs Cleanly"]:::pass

    Run --> PoolTest --> SimSuites --> Shutdown
`,
      },
      {
        title: "Prof.c 8-Slot Frame Budget & Visual QA Readback Architecture",
        chart: `
flowchart TD
    classDef prof fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef qa fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Frame["60 Hz Frame Tick & Render"]:::prof
    Slots["8 Hardware Counter Slots (Prof.c)<br/>THINK | ENTITIES | PARTICLES | HOUSEKEEP<br/>LIGHT | FLOOR | SORT | DRAW"]:::prof
    HUD["F8 WorldDebug HUD & --bench Report<br/>Per-Subsystem Millisecond Breakdown"]:::out

    QAFlags["Visual QA CLI Flags<br/>--test-*-view & --capture-screenshots"]:::qa
    Readback["vk2dTextureCopyPixels -> stbi_write_png<br/>1x Native Pixel Inspection"]:::out

    Frame --> Slots --> HUD
    Frame --> QAFlags --> Readback
`,
      },
    ],
  },
  {
    id: "terrain-construction",
    title:
      "19. Tutorial 7: How Our Terrain Is Constructed (Morphology, Cliffs & Auto-Tiling)",
    category: "contribute",
    summary:
      "Complete 7-layer synthesis of TileMemo bit-packing, 5x5 tent biome blending, solidCore/smoothPatch morphology, 4-tier plateaus, and RIM[16] auto-tiling.",
    sourceFiles: [
      "src/level/World.hpp",
      "src/level/world/Internal.hpp",
      "src/level/world/Biomes.cpp",
      "src/level/world/Terrain.cpp",
      "src/level/world/Ground.cpp",
      "src/level/world/Sites.cpp",
      "src/level/world/Props.cpp",
      "src/level/FloorPainter.cpp",
    ],
    content: `
### How Our Terrain Is Constructed: The 7-Stage Procedural Pipeline

Mellangan constructs an infinite, seamless 2D world with multi-tier cliffs, ramps, highland tarns, lowland lakes, and 3-way biome transitions **without storing a single heap-allocated chunk**. Every tile \`(x, y)\` is synthesized on demand through 7 deterministic stages across \`src/level/world/\` and \`src/level/FloorPainter.cpp\`.

---

#### Stage 1: Direct-Mapped Spatial Memoization (\`Internal.hpp\` & \`Biomes.cpp\`)
Because auto-tiling and morphological filtering query neighboring tiles \`(x + dx, y + dy)\` repeatedly, recomputing FBM noise per neighbor would be too slow. Instead, \`Biomes.cpp\` and \`Sites.cpp\` maintain three zero-allocation, direct-mapped spatial caches invalidated by \`noise_epoch\`:
1. **\`TileMemo tiles[128 * 64]\`:** Indexed by \`(x & 127) | (y & 63) << 7\`. Packs 8 terrain properties into a single \`uint32_t bits\` word via \`MemoField { has, shift, mask }\`:
   - \`slot::biome\` (5 bits), \`slot::raw\` (5 bits), \`slot::dirt\` (1 bit), \`slot::rawDirt\` (1 bit), \`slot::rawWater\` (1 bit), \`slot::water\` (1 bit), \`slot::level\` (2 bits), \`slot::rawLevel\` (2 bits), plus \`float shade\` and \`float clump\`.
2. **\`BlendNode blendMemo[64 * 64]\`:** Indexed on a 2-tile coarse lattice \`(x / 2 & 63) | (y / 2 & 63) << 6\`, caching the 3-biome \`GroundBlend\` weights.
3. **\`Slot cache[256]\` (\`Sites.cpp\`):** Indexed by \`(rx & 15) | (ry & 15) << 4\`, caching the rolled \`Structure\` per \`20×20\` tile region (\`REGION = 20\`).

---

#### Stage 2: 3×3 Majority-Vote Biome Smoothing & 5×5 Separable Kernel Blending (\`Biomes.cpp\`)
1. **Speckle Elimination (\`biomeAt(x, y)\`):**
   \`rawBiome(x, y)\` evaluates climate fields (\`biomeForLocation\`). Then \`biomeAt(x, y)\` tallies a **3×3 Moore-neighborhood majority vote** (\`votes[BIOME_COUNT]\`, breaking ties in favor of the center tile \`own\`) so isolated 1-tile biome islands never occur.
2. **Coarse 5×5 Separable Tent Kernel (\`blendNode\`):**
   At every even lattice coordinate \`(x0, y0)\`, \`blendNode\` samples a 5×5 grid of even tiles (\`ix, iy in -2..2\`, step 2) weighted by \`K[5] = {1, 2, 3, 2, 1}\` (\`K[ix + 2] * K[iy + 2]\`). \`compactBlend\` keeps the **top 3 biomes** and normalizes their weights to sum to \`1.0\`.
3. **Hermite Bilinear Interpolation (\`groundBlend(x, y)\`):**
   For any tile \`(x, y)\`, fractional offsets \`fx, fy\` inside the \`2×2\` cell are smoothstepped via \`fx = fx * fx * (3 - 2 * fx)\` and bilinearly interpolated across the 4 surrounding \`blendNode\` corners.

---

#### Stage 3: Morphological Patch Filtering (\`solidCore\` & \`smoothPatch\` in \`Terrain.cpp\`)
9-slice rim auto-tiling (\`RIM[16]\`) requires every terrain feature to be at least **2 tiles thick** (otherwise a 1-tile-wide strip would need both a North and South border simultaneously). \`Terrain.cpp\` guarantees this invariant mathematically:
- **\`solidCore(test, ctx, x, y)\`:** Tests whether \`(x, y)\` is part of at least one **2×2 completely filled square** (\`dx, dy in -1..0\`). Any 1-tile protrusion or single-tile island fails \`solidCore\`.
- **\`smoothPatch(test, ctx, x, y)\`:** Returns \`true\` if \`solidCore(x, y)\` is true **OR** if at least **3 of its 4 cardinal neighbors** are \`solidCore\`s (closing 1-tile concave notches and pinholes).

---

#### Stage 4: 4-Tier Elevation Plateaus (\`0..3\`) & 3-Tile Block Ramps (\`Terrain.cpp\`)
1. **Domain-Warped Elevation (\`levelNoise\`):**
   Coordinates \`(x, y)\` are domain-warped by \`9 * noise_fbm(...)\`, attenuated near the origin \`(0, 0)\` by \`lift = clampf((d - 18) / 42, 0, 1)\` (ensuring a flat spawn area), and compared against jittered thresholds \`STEPS[3] = {0.14f, 0.34f, 0.48f}\`.
2. **Pinhole-Free Stacking (\`heightAt\`):**
   \`filledAbove(x, y, &k)\` fills sunken pits via \`rawAbove || !smoothPatch(rawBelow)\`, and \`heightAt(x, y)\` increments \`level\` from \`1..3\` while \`smoothPatch(filledAbove, &k, x, y)\` holds.
3. **3-Tile Wide South Ramps (\`isRamp\`):**
   Stairs are aligned to 3-tile horizontal blocks \`b = block(x) * 3\`. Unless skipped by a deterministic 1-in-3 hash roll, \`isRamp(x, y)\` returns \`true\` when all 3 columns \`c in [b, b + 2]\` sit on the exact same south-facing cliff edge (\`heightAt(c, y) == h\`, \`heightAt(c, y + 1) < h\`, \`heightAt(c, y - 1) >= h\`).

---

#### Stage 5: Hydrology: Lowland Lakes, Dry Moats & Highland Tarns (\`Terrain.cpp\`)
- **Lowland Lakes (\`level == 0\`):** \`lake(x, y, margin)\` blends per-biome water table biases \`LAKES[BIOME_COUNT]\`. To prevent players or buildings from spawning underwater, \`rawWaterAt\` passes \`margin = -std::max(spawnDry(x, y), structureDry(x, y))\`, pushing shorelines away from \`(0, 0)\` and away from any \`Structure\` within 6 tiles!
- **Highland Tarns (\`level > 0\`):** \`tarn(x, y, level)\` creates mountain pools on elevated plateaus only when the entire **5×5 neighborhood** shares the exact same \`heightAt(x + dx, y + dy) == level\`, ensuring water never spills over a cliff edge.

---

#### Stage 6: Region Structures (\`Sites.cpp\`) & Prop Scattering (\`Props.cpp\`)
- **20×20 Regions & 4×4 Realms (\`rollStructure\`):** Every \`20×20\` tile region rolls at most one \`Structure\`. One designated region per \`4×4\` Realm (outside the origin realm) rolls a rare regional **Landmark** (\`kind >= StructureKind::AncientTree\`), while standard regions roll from \`b->structureWeights[]\`. Up to 4 candidate footprints are tested to guarantee the entire \`(w + 4) × (h + 4)\` pad has uniform elevation \`heightAt(xx, yy) == ground\`.
- **Context-Aware Props (\`propAt\`):** Places structure props first, keeps a clear radius around \`(0, 0)\` (\`clearing\`), scatters cliff-base boulders/pebbles where \`heightAt(x, y - 1) > level\`, mixes \`fringe\` flora along biome borders, and thins solid tree density at higher altitudes (\`THIN[level]\`).

---

#### Stage 7: \`RIM[16]\` Nine-Slice Auto-Tiling & Cumulative Alpha Blending (\`Ground.cpp\` & \`FloorPainter.cpp\`)
1. **4-Bit Cardinal Auto-Tiler (\`RIM[16]\`):**
   \`sides(x, y, at)\` packs \`N (1) | S (2) | W (4) | E (8)\` into a 4-bit mask \`0..15\`. \`rimOffset(mask)\` maps the vertical bits \`mask & 3\` and horizontal bits \`mask >> 2 & 3\` via \`edge[4] = {1, 2, 0, 1}\` to \`edge[v] * 12 + edge[h]\`, indexing the exact 3×3 nine-slice tile for lake shores, dirt paths, snow rims, rain pools, and cliff walls.
2. **Cumulative Alpha-Over Barycentric Blending (\`FloorPainter::blend\`):**
   To blend up to 3 biomes on a single tile using sequential sprite draws, \`FloorPainter::blend\` draws the owning biome first at \`alpha = 1.0\` and each subsequent biome \`k\` at \`alpha = blend.weight[k] / cumulative\`. Mathematically:
   - After Pass 1: \`C = w0/(w0+w1) * C0 + w1/(w0+w1) * C1\`
   - After Pass 2: \`C = w0 * C0 + w1 * C1 + w2 * C2\` , an exact barycentric linear combination!
3. **Drop Shadows, Ramps & Inner Cliff Corners (\`FloorPainter::wall\` & \`cliff\`):**
   Casts translucent dark rectangles below south and east cliff edges, renders 3-tile \`atlas::stairs(material, part)\` on ramps, draws \`atlas::cliff(material, RIM[mask])\` along outer cliff faces, and stamps \`4×4\` / \`4×8\` concave corner sub-sprites (\`CORNERS[4][5]\`) when all 4 cardinal neighbors are elevated (\`mask == 15\`) but a diagonal neighbor drops off!
`,
    mermaidCharts: [
      {
        title: "Complete 7-Stage Procedural Terrain Construction Pipeline",
        chart: `
flowchart TD
    classDef memo fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef biome fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef morph fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef draw fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Coord["Tile Coordinate (x, y) & noise_epoch"]:::memo
    Memo["Stage 1: Direct-Mapped Spatial Caches<br/>TileMemo[128x64] | BlendNode[64x64] | Structure[256]"]:::memo

    RawB["Stage 2A: rawBiome -> biomeAt(x, y)<br/>3x3 Moore Majority Vote (Speckle Removal)"]:::biome
    Blend["Stage 2B: blendNode (5x5 K={1,2,3,2,1})<br/>-> groundBlend(x, y) Top-3 Barycentric Weights"]:::biome

    Elev["Stage 4: Domain-Warped levelNoise(x, y)<br/>-> filledAbove -> heightAt(0..3) & 3-Tile isRamp"]:::morph
    Hydro["Stage 5: Hydrology & Dry Moats<br/>Lowland lake() - max(spawnDry, structureDry) | Highland 5x5 tarn()"]:::morph
    Patch["Stage 3: Morphological Filter<br/>solidCore (2x2 Block) -> smoothPatch (>=3 Core Neighbors)"]:::morph

    SiteProp["Stage 6: 20x20 Region Structure & PropAt<br/>Flat Pad Check + Cliff Boulders + Fringe Flora"]:::draw
    Paint["Stage 7: FloorPainter::tile(x, y)<br/>RIM[16] Auto-Tile + Cumulative Alpha Blend + Cliff Walls"]:::draw

    Coord --> Memo --> RawB & Elev
    RawB --> Blend
    Elev --> Patch --> Hydro
    Blend & Hydro --> SiteProp --> Paint
`,
      },
      {
        title:
          "Morphological Patch Smoothing (solidCore -> smoothPatch) & 4-Bit RIM[16] Auto-Tiler",
        chart: `
flowchart TD
    classDef raw fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;
    classDef core fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef rim fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Noise["Raw Threshold Test<br/>rawDirtAt | rawWaterAt | filledAbove"]:::raw
    Core["solidCore(test, x, y)<br/>True iff (x,y) is in a 2x2 True Square<br/>(Eliminates 1-Tile Spurs)"]:::core
    Smooth["smoothPatch(test, x, y)<br/>True iff solidCore OR >= 3 Cardinal Cores<br/>(Closes 1-Tile Notches)"]:::core
    Sides["sides(x, y, at)<br/>4-Bit Mask: N(1) | S(2) | W(4) | E(8)"]:::rim
    RimLUT["RIM[mask] = edge[mask&3]*12 + edge[mask>>2&3]<br/>Exact 3x3 Nine-Slice Atlas Offset"]:::rim

    Noise --> Core --> Smooth --> Sides --> RimLUT
`,
      },
    ],
    interactiveComponent: "terrain",
  },
  {
    id: "renderer-in-context",
    title: "20. Tutorial 8: How the Renderer Works in Context of Our Game",
    category: "contribute",
    summary:
      "End-to-end walkthrough of Screen.cpp, LevelRender.cpp, LightField.cpp, offscreen targets, water reflections, submersion clipping, and native GUI scaling.",
    sourceFiles: [
      "src/Game.cpp",
      "src/gfx/Screen.hpp",
      "src/gfx/Screen.cpp",
      "src/level/LevelRender.cpp",
      "src/level/LightField.cpp",
      "res/shaders/post.slang",
    ],
    content: `
### How the Renderer Works in Context of Our Game

Mellangan's rendering architecture (\`Screen\`, \`LevelRender\`, \`LightField\`, and \`Vulkan2D\`) is purpose-built around a **dual-resolution multi-pass frame graph**:
1. The **World & Lighting Passes** render into compact, pixel-art-resolution offscreen targets (\`vw × vh\`, dynamically sized between \`480×270\` and \`640×360\` inside \`640×360\` GPU textures \`Screen::world\` and \`Screen::light\`).
2. The **Composite & GUI Pass** upscales and composites \`world × light\` onto the window swapchain via \`res/shaders/post.slang\`, and then renders the HUD, bitmap typography, and menus directly at **native window pixel resolution** using an integer-snapped UI unit \`u\`.

---

#### 1. The 7 GPU Textures & Pre-Baked White Silhouette (\`Screen::load\`)

At startup, \`Screen::load(base)\` (\`src/gfx/Screen.cpp\`) initializes 7 \`VK2DTexture\` handles and 1 SPIR-V post-process shader:
- **4 Asset Texture Sheets:** \`atlas\` (\`res/atlas.png\`), \`particles\` (\`res/particles.png\`, \`8×8\` cells), \`weather\` (\`res/weather.png\`), and \`font\` (\`res/font.png\`, \`8×16\` ASCII glyph grid).
- **1 CPU-Generated White Silhouette Texture (\`silhouette\` via \`Screen::loadSilhouette\`):**
  Instead of switching GPU pipelines or binding a constant buffer every time one of 500 enemies flashes white on hit, \`Screen::loadSilhouette\` loads \`res/atlas.png\` into CPU memory at startup and bitwise-ORs every 32-bit RGBA texel with \`0x00FFFFFFu\`:
\`\`\`cpp
uint32_t *texel = reinterpret_cast<uint32_t *>(px);
for (int i = 0; i < iw * ih; i++)
  texel[i] |= 0x00FFFFFFu;
\`\`\`
  This preserves the exact alpha channel of every sprite in the atlas while setting RGB to pure white! During \`Screen::flash\`, the renderer draws the normal sprite from \`atlas\` and immediately draws the identical UV rectangle from \`silhouette\` with vertex alpha \`prev.a * std::min(amount, 1.0f)\`.
- **2 Offscreen Render Targets (\`MAX_W = 640, MAX_H = 360\`):** \`world\` and \`light\`.

---

#### 2. Aspect-Adaptive Virtual Viewport (\`Screen::fit\` & \`Screen::reach\`)

Before any pass begins in \`Game::render()\`, \`screen.fit(window)\` adapts the virtual world dimensions \`(vw, vh)\` to the physical window aspect ratio \`(pw, ph)\`:
- Base virtual resolution is **\`480×270\`** (exact \`30 × 16.875\` tiles).
- On wider monitors (\`fw * 270 >= fh * 480\`), \`vh\` stays locked at \`270\` while \`vw\` expands up to \`MAX_W = 640\`.
- On taller monitors (\`fw * 270 < fh * 480\`), \`vw\` stays locked at \`480\` while \`vh\` expands up to \`MAX_H = 360\`.
- **Gameplay Coupling (\`Screen::reach()\`):** Because wider viewports reveal more tiles horizontally, \`Screen::reach()\` computes the extra half-diagonal \`hypot(vw, vh)*0.5 - hypot(480, 270)*0.5\` so \`Spawner.cpp\` automatically pushes enemy spawn rings outside the player's wider field of view!

---

#### 3. Pass 1: Offscreen Additive Light Map & Surface Scatter (\`PROF_LIGHT\`)

In \`Game::render()\`, Pass 1 constructs the offscreen light map inside \`Screen::light\`:
1. **Ambient Sky-Biome Clear (\`Screen::beginLight\`):**
   Computes the ambient baseline from \`d = level->night.daylight()\`, biome \`air\` tint, and weather \`sky.shade()\`, clears \`Screen::light\` in \`VK2D_BLEND_MODE_BLEND\`, switches to **\`VK2D_BLEND_MODE_ADD\`**, and sets \`lightBudget = 240\`.
2. **Visible Tile & Prop Scatter (\`Level::scatter\`):**
   \`Level::renderLight\` first calls \`scatter(s)\`, which scans the visible tile frustum (plus a 3-tile margin) to:
   - Populate \`surfaces[SOLID_W * SOLID_H]\` with bit-packed water (\`1\`), ice (\`2\`), elevation \`heightAt << 2\`, and \`isRamp << 4\`, and set \`waterInView\`.
   - Query \`world::propAt(x, y, p)\`, swap prop sprites to frosted variants where \`sky.snowAt(x, y)\` is true, compute wind sway \`sky.sway(p.x, p.y, time)\` for multi-part trees, and record solid prop collision radii into \`solids[]\`.
3. **Additive Glows & Shadow Casters (\`Screen::glow\` & \`LightField::add\`):**
   The player's torch, kindled shrines, projectiles, particles, and luminous props stamp radial \`atlas::Light\` sprites into \`Screen::light\` (decrementing \`lightBudget\`) and register up to \`LightField::MAX = 16\` shadow-casting point lights (\`x, y, reach, strength\`).

---

#### 4. Pass 2: Offscreen World Target (\`PROF_FLOOR\`, \`PROF_SORT\`, \`PROF_DRAW\`)

\`Screen::beginWorld\` binds \`Screen::world\` in \`VK2D_BLEND_MODE_BLEND\` and executes four ordered sub-passes in \`Level::render(Screen &s)\`:

##### Sub-Pass 2A: Terrain Floor & Ground Telegraphs (\`PROF_FLOOR\`)
- \`renderFloor(s)\` runs \`FloorPainter::tile(x, y)\` across \`eachVisibleTile(s)\`.
- \`sky.renderGround(s)\` renders ground-level weather effects (mud/snow footprints, lightning ground strikes).
- \`events.render(s, *this)\` renders boss and landmark warning rings directly on the floor so entities walk *on top* of telegraphs.

##### Sub-Pass 2B: Frustum Culling & 3-Pass 12-Bit Radix Sort (\`PROF_SORT\`)
- Every visible entity (\`s.visible(x, y, 48)\`), visible particle, and scattered \`Prop\` is passed to \`Level::queue(SpriteObject *e)\`, which packs a 64-bit key:
\`\`\`cpp
keys.push_back(uint64_t(e->layer()) << 56 |
               uint64_t(orderedBits(float(e->y))) << 24 | drawn.size());
\`\`\`
- \`radixSort(keys, keysTmp)\` sorts bits \`24..59\` (32-bit IEEE-754 \`orderedBits(y)\` plus the lower 4 bits of \`layer()\`) using three 12-bit counting-sort passes (\`SHIFT = {24, 36, 48}\`, \`count[4097]\`).

##### Sub-Pass 2C: Planar Water Reflections (\`Level::reflect\`)
- Executed only when \`sky.flood() > 0 || waterInView\`.
- Iterates the sorted \`keys\` and checks whether the tiles immediately south of \`e\` (\`ty + 1\`, \`ty + 2\`) contain liquid water or rain pools (\`wet(tx, ty + 1)\`), capping enemy reflections at \`shown < 48\`.
- Calls \`s.mirror(std::floor(e->y), {0.55f, 0.66f, 0.9f, alpha})\` before \`e->draw(s)\`. Inside \`Screen::sprite\`, when \`mirrored == true\`, the sprite is vertically reflected across the entity's foot axis \`mirrorY\`:
\`\`\`cpp
if (mirrored)
  y = 2 * mirrorY - y, ys = -ys, rot = -rot;
\`\`\`

##### Sub-Pass 2D: Dynamic Cast Shadows, Submersion Clipping & Y-Sorted Sprites (\`PROF_DRAW\`)
1. **Unified Shadow Pass (Before First \`layer() == 1\` Object):**
   Right before the first standing entity/prop (\`k >> 56 >= 1\`) is drawn, \`LevelRender.cpp\` loops over all \`layer() == 1\` objects so shadows never overlapon top of adjacent feet:
   - If \`e->occlusion(width) > 0\`, \`lights.cast(s, e->x, e->y, width, height)\` (\`src/level/LightField.cpp\`) iterates all active point-light casters and draws radial \`atlas::Shadow\` sprites rotated along \`std::atan2(yd, xd)\` and stretched proportionally to distance \`d / 48\`.
   - If \`swimming(e)\` is true, it draws an animated water ripple (\`atlas::wx::ripple(frame)\`) instead of a drop shadow; otherwise it calls \`e->drawShadow(s)\`.
2. **Waterline Submersion Clipping (\`Screen::submerge\`):**
   When drawing a \`swimming(e)\` entity, \`LevelRender.cpp\` wraps \`e->draw(s)\` in \`s.submerge(std::floor(e->y) - 5)\` and \`s.emerge()\`. Inside \`Screen::sprite\`, \`sunk == true\` truncates the source UV height \`h\`:
\`\`\`cpp
if (sunk && ys > 0) {
  h = std::min(s.h, float((waterline - (y - yo * ys)) / ys));
  if (h <= 0)
    return;
}
\`\`\`
   This cleanly clips the bottom 5 pixels of the character or monster at the water surface without needing a stencil buffer!
3. **Atmospheric Canopy (\`sky.render(s, air)\`):**
   Draws falling rain streaks, snowflakes, sandstorm gusts, and fog over the sorted world.

---

#### 5. Pass 3: \`post.slang\` Composite & Native-Resolution GUI (\`Screen::beginGui\`)

Finally, \`Screen::beginGui(window, fx)\` switches the render target to \`VK2D_TARGET_SCREEN\` (or \`screenTarget\` when capturing headless QA PNGs via \`Screen::saveTarget\`):
1. Sets the camera to full physical window dimensions \`(w, h)\`, computes \`scale = std::min(w / vw, h / vh)\`, and derives the integer UI layout unit \`u = std::max(1.0f, std::round(scale * 0.5f))\`.
2. Draws \`Screen::world\` centered at \`(floor((w - vw * scale) / 2), floor((h - vh * scale) / 2))\` through \`res/shaders/post.slang\`, binding \`vk2dTextureGetID(light)\` inside \`PostData\` so the shader multiplies sharp-sampled world albedo by \`lightAt(uv) * 1.6\`, adds 8-tap bloom, applies ACES filmic tonemapping, and applies hurt chromatic aberration or pause blur.
3. Renders \`WorldDebug\` (\`F8\`), \`Hud::render\`, and \`Menu::render\` directly in native window pixels scaled by \`u\`, using \`Screen::rect\`, \`Screen::frame\`, \`Screen::bracket\`, and \`Screen::text\` (which renders \`res/font.png\` twice—first offset by \`(+size, +size)\` in dark shadow \`{0.02, 0.01, 0.05, 0.85 * a}\`, then in foreground color \`c\`).
`,
    mermaidCharts: [
      {
        title:
          "Complete Multi-Pass Frame Graph (Game::render -> Screen -> LevelRender)",
        chart: `
flowchart TD
    classDef setup fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef light fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef world fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gui fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Fit["Stage 0: Screen::fit(window) & Camera::aim()<br/>Compute Virtual (vw x vh) in [480x270 .. 640x360] & (xOffset, yOffset)"]:::setup

    subgraph Pass_1_Light ["Pass 1: Screen::light Offscreen Target (PROF_LIGHT)"]
        BeginL["Screen::beginLight(ambient)<br/>Clear BLEND -> Switch to VK2D_BLEND_MODE_ADD (lightBudget = 240)"]:::light
        Scatter["Level::scatter(s)<br/>Build surfaces[] & solids[] + Collect Visible Props + Frost & Wind Sway"]:::light
        Glows["Player, Night, Sky, Entities, Particles & Props<br/>Screen::glow() + LightField::add() (Up to 16 Shadow Casters)"]:::light
        BeginL --> Scatter --> Glows
    end

    subgraph Pass_2_World ["Pass 2: Screen::world Offscreen Target (PROF_FLOOR / SORT / DRAW)"]
        Floor["Sub-Pass 2A (PROF_FLOOR): Level::renderFloor()<br/>FloorPainter::tile() + sky.renderGround() + events.render()"]:::world
        Sort["Sub-Pass 2B (PROF_SORT): Level::queue() & radixSort()<br/>64-Bit Key [layer:8 | orderedBits(y):32 | idx:24] -> 3-Pass 12b Radix"]:::world
        Reflect["Sub-Pass 2C: Level::reflect(s)<br/>If waterInView/flood: s.mirror(floor(y), veil) -> Flip ys = -ys"]:::world
        Draw["Sub-Pass 2D (PROF_DRAW): Unified Shadow Pass (LightField::cast)<br/>+ Submersion Clipping s.submerge() + e->draw() + sky.render()"]:::world
        Floor --> Sort --> Reflect --> Draw
    end

    subgraph Pass_3_Screen ["Pass 3: Swapchain / screenTarget Composite & Native GUI"]
        Post["Screen::beginGui(window, fx)<br/>vk2dRendererDrawShader(post.slang, PostData, world + bindless light)"]:::gui
        UI["Native Window Pixel UI (Scaled by u = round(scale * 0.5))<br/>WorldDebug (F8) + Hud::render() + Menu::render() +vk2dRendererPresent()"]:::gui
        Post --> UI
    end

    Fit --> Pass_1_Light --> Pass_2_World --> Pass_3_Screen
`,
      },
      {
        title:
          "Planar Water Reflection, Submersion Clipping & White Silhouette Flash Pipeline",
        chart: `
flowchart LR
    classDef state fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef math fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef gpu fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Mirror["s.mirror(floor(e->y), veil)<br/>(Level::reflect)"]:::state
    MirrorMath["Screen::sprite() Mirror Transform<br/>y' = 2*mirrorY - y, ys' = -ys, rot' = -rot<br/>color *= veil"]:::math

    Submerge["s.submerge(floor(e->y) - 5)<br/>(When swimming(e) == true)"]:::state
    ClipMath["Screen::sprite() Source Height Clip<br/>h = min(s.h, (waterline - topY) / ys)<br/>Clips Bottom 5px Below Water!"]:::math

    Flash["Screen::flash(s, ..., amount, c)<br/>(Hit Flash on Mob / Enemy)"]:::state
    Silhouette["1. Draw Normal Sprite from Screen::atlas<br/>2. Overlay Identical UV from Screen::silhouette<br/>(Pre-Baked 0x00FFFFFF RGB) at alpha = amount"]:::gpu

    Mirror --> MirrorMath
    Submerge --> ClipMath
    Flash --> Silhouette
`,
      },
    ],
    interactiveComponent: "renderer",
  },
  {
    id: "night-spawner-director",
    title:
      "21. Night Clock, 11 Omens, Shrine Dawn-Pull & 7-Stream Wave Director",
    category: "gameplay",
    summary:
      "The 15-minute nocturnal survival arc, Endless Night mode, 10-tier Heat Ladder curses, and daily worlds.",
    sourceFiles: [
      "src/level/Night.cpp",
      "src/level/Spawner.cpp",
      "src/level/RunRules.hpp",
      "src/level/Flavour.cpp",
      "src/meta/Codex.hpp",
    ],
    content: `
### The 15-Minute Nocturnal Survival Arc (\`src/level/Night.cpp\` & \`Flavour.cpp\`)

Every standard run in **Mellangan** is governed by \`Night\` (\`src/level/Night.cpp\`) and \`RunRules\` (\`src/level/RunRules.hpp\`), tracking the countdown to dawn (\`r.nightLength = 900.0f\` seconds by default), active nocturnal \`Omens\`, and sacred Shrines scattered across the map.

#### The 11 Nocturnal Omens (\`OMENS[OMEN_COUNT = 11]\` in \`Flavour.cpp\`)
At the start of a run, \`Level\` rolls \`rng.chance(0.85f)\` to activate one of 11 global Omens (falling back to \`CALM\` on the remaining 15% of nights):
* **\`BLOOD MOON\`:** \`rate = 1.25, horde = 1.35, speed = 1.15, xp = 1.2, score = 1.5, elite = 1.2\`
* **\`FROSTFALL\`:** \`rate = 0.9, horde = 1.0, speed = 0.85, xp = 1.0, score = 1.1, elite = 1.0\`
* **\`ECLIPSE\`:** \`rate = 1.4, horde = 1.5, speed = 1.1, xp = 1.35, score = 1.75, elite = 1.5\`
* **\`TEMPEST\`:** \`rate = 1.15, horde = 1.2, speed = 1.25, xp = 1.15, score = 1.3, elite = 1.1\`
* **\`HARVEST MOON\`:** \`rate = 1.0, horde = 1.0, speed = 1.0, xp = 1.5, score = 1.2, elite = 1.0\`
* **\`SOLITUDE\`:** \`rate = 0.7, horde = 0.5, speed = 1.1, xp = 0.9, score = 1.0, elite = 2.0\`
* **\`MIASMA\`:** \`rate = 1.1, horde = 1.1, speed = 0.95, xp = 1.1, score = 1.25, elite = 1.3\`
* **\`STARFALL\`:** \`rate = 1.0, horde = 1.1, speed = 1.05, xp = 1.25, score = 1.35, elite = 1.15\`
* **\`CARRION CALL\`:** \`rate = 1.3, horde = 1.4, speed = 1.05, xp = 1.1, score = 1.4, elite = 0.8\`
* **\`VOID WHISPER\`:** \`rate = 1.2, horde = 1.2, speed = 1.1, xp = 1.3, score = 1.6, elite = 1.4\`
* **\`ASH RAIN\`:** \`rate = 1.05, horde = 1.15, speed = 0.9, xp = 1.15, score = 1.2, elite = 1.1\`

#### Endless Night Mode (\`Night::endless\`)
At dawn (06:00), players can press K (or LT on gamepad) to reject the morning sun and plunge into **Endless Night**. The HUD clock transforms into an elapsed timer, and the dark deepens relentlessly:
* Every 60 seconds of elapsed endless time, monsters receive compounding attribute multipliers:
  $H(m) = H_0 \\times (1.10)^m, \\quad D(m) = D_0 \\times (1.05)^m$
* Monster health scales by $+10\\%$ compounding per minute, while attack damage scales by $+5\\%$ compounding per minute.
* Codex records the player's longest endless survival duration, rendering it on the death screen alongside personal records. Dedicated achievements unlock at 5 and 15 minutes of endless survival.

#### The Heat Ladder (Heat 0 to 10)
For players seeking deeper challenge, the class selection screen features a 10-tier Heat Ladder. Each Heat rank adds a permanent stacking curse on top of the selected difficulty:
1. **Heat 1 (Thick Hides):** All monsters gain $+25\\%$ health.
2. **Heat 2 (Hungry Dark):** Monster movement speed increases by $+10\\%$.
3. **Heat 3 (Sharp Claws):** Monster attack damage increases by $+25\\%$.
4. **Heat 4 (Chosen Ones):** Elite and champion spawn rates double (
### The 15-Minute Nocturnal Survival Arc (\`src/level/Night.cpp\` & \`Flavour.cpp\`)

Every run in **Mellangan** is governed by \`Night\` (\`src/level/Night.cpp\`) and \`RunRules\` (\`src/level/RunRules.hpp\`), which track the countdown to dawn (\`r.nightLength = 900.0f\` seconds by default), the active nocturnal \`Omen\` (\`OMENS[11]\` in \`src/level/Flavour.cpp\`), and the kindling state of sacred Shrines scattered across the map.

#### The 11 Nocturnal Omens (\`OMENS[OMEN_COUNT = 11]\` in \`Flavour.cpp\`)
At the start of a run, \`Level\` rolls \`rng.chance(0.85f)\` (unless overridden by \`rules.omen\`) to activate one of **11 global Omens** (falling back to \`CALM\` on the remaining 15% of nights). Each \`Omen\` modifies six global pacing parameters (\`rate, horde, speed, xp, score, elite\`) accessed via \`level.portent()\`:
- **\`BLOOD MOON\`:** \`rate = 1.25\`, \`horde = 1.3\`, \`xp = 1.2\`, \`score = 1.3\` (faster spawns & larger hordes).
- **\`AURORA\`:** \`xp = 1.35\`, \`score = 1.1\`, \`elite = 0.05\` (richer XP gems and more elites).
- **\`GALE\`:** \`speed = 1.15\`, \`score = 1.2\` (\`+15%\` monster movement speed).
- **\`OUTLAW SEASON\`:** \`score = 1.25\` (doubles Renegade hunting party frequency).
- **\`MIMIC MOON\`:** \`xp = 1.15\`, \`score = 1.2\` (\`2.5×\` disguised Chest Mimics).
- **\`THE SWARM\`:** \`rate = 1.45\`, \`horde = 1.5\`, \`speed = 0.92\`, \`xp = 1.1\`, \`score = 1.35\` (relentless swarm density).
- **\`IRON NIGHT\`:** \`rate = 0.85\`, \`xp = 1.25\`, \`score = 1.3\`, \`elite = 0.14\` (\`+14%\` flat elite promotion rate).
- **\`WAR DRUMS\`:** \`horde = 1.45\`, \`speed = 1.08\`, \`xp = 1.15\`, \`score = 1.3\` (frequent war-party waves).
- **\`LONG NIGHT\`:** \`rate = 1.15\`, \`horde = 1.2\`, \`speed = 1.05\`, \`xp = 1.2\`, \`score = 1.4\`.
- **\`QUIET HOURS\`:** \`rate = 0.75\`, \`horde = 0.8\`, \`xp = 0.9\`, \`score = 0.85\` (calmer night, lower score multiplier).
- **\`CHAMPION'S HOUR\`:** \`xp = 1.3\`, \`score = 1.4\`, \`elite = 0.08\` (halves Champion spawn interval and increases max simultaneous Champions to 3).

---

### Shrine Dawn-Pull & Quadratic Sunrise Mechanics (\`Night.cpp\`)

#### 1. Shrine Kindling Pulls Dawn Closer by 60 Seconds (\`Night::dawnAt()\`)
Standing inside an unlit shrine's structure footprint charges \`kindling\` at \`level.kindleRate / KINDLE\` per second, with \`KINDLE = 6\`. Progress decays by half a unit per second outside the footprint. On completion, \`Night::kindle()\`:

1. Records the shrine (up to \`MAX_LIT\`), increments the codex shrine count, marks its biome, and sets \`offering\` so the game opens the shrine menu.
2. Magnets gems strictly within \`PULL = 240\` px of the shrine center, resets their speed, and creates a nova and visual effects. It also spawns \`8 + 3 * lit\` guards at radius 170, using the strongest enemy kind unlocked at the current time.
3. In a run that ends at dawn, each recorded shrine advances dawn by \`r.dawnPull\` seconds (60 by default). In cycling modes, shrine count does not shorten the night.

\`\`\`cpp
float Night::dawnAt() const {
  const RunRules &r = level.rules;
  return nightStart + r.nightLength - (r.endsAtDawn ? lit * r.dawnPull : 0);
}
\`\`\`

#### 2. The Final 150 Seconds (\`Night::daylight()\`)
During the final 150 seconds before dawn, \`Night::daylight()\` returns a quadratic ramp. In cycling modes, the dawn period instead returns \`clampf((dayEnds - level.time) / 20, 0, 1)\`.

\`\`\`cpp
float Night::daylight() const {
  if (dawn && !level.rules.endsAtDawn)
    return clampf((dayEnds - level.time) / 20, 0, 1);
  float d = clampf(1 - left() / 150, 0, 1);
  return d * d;
}
\`\`\`
For runs that end at dawn, \`Night::tick()\` calls \`game.onDawn()\`. Cycling modes use \`Night::cycle()\` to transition between night and day.

---

### The 7-Stream Wave Director (\`src/level/Spawner.cpp\`)

\`Spawner::tick(Level &level)\` runs during \`PROF_HOUSEKEEP\` and coordinates **seven independent spawn streams**, all bounded by \`b.enemyCap\` and positioned outside the camera viewport via \`R_MIN = 220 + reach\` to \`R_MAX = 260 + reach\`:

1. **Dynamic Trickle Stream (\`Spawner::trickle\`):**
   \`\`\`cpp
   float rate = level.portent().rate * level.rules.spawnRate * level.night.spawnScale();
   float interval = std::max(b.spawnFloor, b.spawnInterval - t * b.spawnRamp) / rate;
   int batch = 1 + int(t / b.batchEvery);
   \`\`\`
   Each enemy in the batch is chosen by \`Spawner::pick(level, r, x, y)\`:
   - \`1.5%\` chance (after \`70s\`): \`EnemyKind::Thief\` treasure goblin.
   - \`b.localChance\`: A biome-native specialist from \`localFoes(world::biomeUnder(x, y))\`.
   - \`b.strongChance\`: One of the top 2 most recently unlocked monster tiers in \`r.common\`.
   - Otherwise: Uniform draw from \`r.common\`, promoting to an elite with probability \`min(b.eliteCap, (t - b.eliteStart) * b.eliteRamp) + level.portent().elite\` (and rolling 1 \`Trait\` after \`90s\`, or 2 \`Traits\` with \`20%\` chance after \`300s\`).
2. **6 Named Minute-Wave Templates (\`WAVE_DEFS[6]\` in \`Spawner::horde\`):**
   Every \`b.hordeEvery\` (\`60s\`), \`Spawner::horde(t)\` computes \`count = int(min(b.hordeMax, b.hordeBase + t / b.hordeRamp) * o.horde * level.rules.hordeScale)\` and selects a non-repeating wave template from \`WAVE_DEFS[6]\`:
   - **\`"THE HORDE CLOSES IN"\` (\`from = 0s\`):** Full ring of strong unlocked foes around the player.
   - **\`"A SWARM DESCENDS"\` (\`from = 60s\`):** \`1.5×\` count of fast early-tier swarmers led by 2 elites.
   - **\`"THE PACK HUNTS"\` (\`from = 100s\`):** Coordinated \`Alpha\` wolves and \`Wolf\` packs.
   - **\`"AMBUSH!"\` (\`from = 120s\`):** Concentrated \`60°\` (\`PI / 3\`) arc directly ahead of the player's movement vector!
   - **\`"THE DEAD RISE"\` (\`from = 150s\`):** Tight inner ring of \`Skeleton\`s (\`130..170 px\`) backed by an outer ring of \`Necromancer\` summoners (\`220..250 px\`).
   - **\`"THE LAND STIRS"\` (\`from = 90s\`):** Biome-native ambush drawn entirely from \`localFoes(biome)\` plus 2 biome elites.
3. **Disguised Chest Mimics (\`Spawner::mimics\`):**
   Every \`45s\` (or \`18s\` under \`MIMIC MOON\`), hides a dormant \`EnemyKind::Mimic\` ahead of the player if fewer than 2 mimics are active.
4. **Renegade Adventurer Hunting Parties (\`Spawner::renegades\`):**
   From \`180s\` onward (or \`90s\` under \`OUTLAW SEASON\`), announces *"RENEGADES ON YOUR TRAIL"* and spawns \`1..2\` weapon-wielding \`Outlaw\`, \`Berserker\`, \`PitFighter\`, or \`Deserter\` foes.
5. **Named Epithet Champions (\`Spawner::champions\`):**
   From \`150s\` onward (every \`120s\`, or \`60s\` under \`CHAMPION'S HOUR\`), \`spawnChampion\` rolls a procedural epithet (\`Rank.cpp\`), 2 \`Trait\`s, 1 active \`Skill\`, and 1 player \`Upgrade\` weapon.
6. **Explosive Supply Barrels (\`Spawner::barrel\`):**
   Places a destructible \`SupplyBarrel\` every \`20s\` along the player's perimeter.
7. **Regional & Cycling 3-Phase Bosses (\`Spawner::boss\`):**
   Every \`b.bossEvery\` seconds, \`bossFor(world::biomeUnder(player->x, player->y))\` selects the biome's regional boss from \`BOSS_DEFS[9]\` (or cycles \`THE CYCLOPS\`, \`THE PACK LORD\`, and \`THE LICH\` on a 30% classic roll), scaled by \`1.0f + (bosses - 1) * b.bossHpStep\`.
\\times$).
5. **Heat 5 (Dim Shrines):** Shrines pull dawn only half as far (30s instead of 60s).
6. **Heat 6 (Teeming):** Swarm wave spawn frequency and horde sizes scale up.
7. **Heat 7 (Frail):** Player maximum health is reduced by $-20\\%$.
8. **Heat 8 (Starved):** Experience gem yield is reduced by $-20\\%$.
9. **Heat 9 (The Tide):** Hordes and wave surges increase by $+50\\%$ in density.
10. **Heat 10 (Long Night):** Base nocturnal duration increases by $+20\\%$.

Surviving to dawn at a given Heat level unlocks the next rank. Highest cleared Heat is tracked permanently in the Codex and highlighted in the run recap log (\`runs.csv\`).

#### Daily Deterministic Worlds
Daily runs provide a global standardized challenge: calendar dates deterministically seed the world generator, fix the active hero class (among unlocked characters), and assign a fixed Heat level between 0 and 3.

#### Concentric Ring Shrine Search Optimization
Locating the nearest sleeping shrine or Ancient Gate previously required generating an entire $81 \\times 81$ tile region matrix ($460\\text{ ms}$). The engine replaced this with an expanding concentric ring search that terminates immediately upon reaching the first ring bounding the nearest possible target, slashing query latency down to **$4\\text{ ms}$**.
`,

    mermaidCharts: [
      {
        title:
          "Night Clock, 60s Shrine Dawn-Pull & 7-Stream Spawner Director Pipeline",
        chart: `
flowchart TD
    classDef clock fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef shrine fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef stream fill:#181524,stroke:#f43f5e,stroke-width:2px,color:#e2e8f0;

    Seed["Level Init: Roll Omen (85% OMENS[0..10], 15% CALM)<br/>portent() -> (rate, horde, speed, xp, score, elite)"]:::clock
    Tick["Night::tick(level) @ 60 Hz<br/>dawnAt = nightStart + nightLength - lit * dawnPull (60s)"]:::clock
    DawnCheck{"dawnAt - level.time <= 150s?"}:::clock
    Daylight["Quadratic Sunrise Ramp<br/>d = clamp(1 - left/150, 0, 1); daylight = d * d"]:::clock
    StrikeDawn["level.time >= dawnAt:<br/>dawn = true -> game.onDawn() (or Night::cycle)"]:::clock

    ShrineProx["Player Within 28px of Unlit Shrine?<br/>kindling += DT * kindleRate / 6.0s"]:::shrine
    Kindle["Night::kindle() @ kindling >= 1.0<br/>lit++ (Pulls Dawn -60s!) + Ring of (8 + 3*lit) Foes @ r=170"]:::shrine

    Spawner["Spawner::tick(level) (7 Concurrent Streams)<br/>Spawn Ring = [220 + reach .. 260 + reach]"]:::stream
    Streams["1. trickle(t)  2. horde(t) (WAVE_DEFS[6])  3. mimics()<br/>4. renegades(t)  5. champions()  6. barrel()  7. boss()"]:::stream

    Seed --> Tick --> DawnCheck
    DawnCheck -- "Yes" --> Daylight --> StrikeDawn
    Tick --> ShrineProx --> Kindle
    Tick --> Spawner --> Streams
`,
      },
      {
        title: "Spawner::pick() Decision Tree & Biome Specialist Routing",
        chart: `
flowchart TD
    classDef roll fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    Start["Spawner::pick(level, roster, x, y)"]:::roll
    ThiefRoll{"t > 70s &&<br/>chance(0.015)?"}:::roll
    LocalRoll{"chance(b.localChance)<br/>&& localFoes(biome)?"}:::roll
    StrongRoll{"chance(b.strongChance)<br/>&& common.size >= 3?"}:::roll

    Thief["EnemyKind::Thief<br/>(Treasure Goblin)"]:::out
    BiomeFoe["Biome-Native Specialist<br/>localFoes(world::biomeUnder(x, y))"]:::out
    TopTwo["Top-2 Newest Unlocked Tier<br/>r.common[size - 1 - range(0, 1)]"]:::out
    Uniform["Uniform Common Pool<br/>+ Elite & Trait Promotion Roll (after b.eliteStart)"]:::out

    Start --> ThiefRoll
    ThiefRoll -- "Yes" --> Thief
    ThiefRoll -- "No" --> LocalRoll
    LocalRoll -- "Yes" --> BiomeFoe
    LocalRoll -- "No" --> StrongRoll
    StrongRoll -- "Yes" --> TopTwo
    StrongRoll -- "No" --> Uniform
`,
      },
    ],
    interactiveComponent: "director",
  },
  {
    id: "persistence-codex-balance",
    title: "22. Persistence, 6-World History LRU, Codex Unlocks & Balance INI",
    category: "core",
    summary:
      "Save files, backup fallback, campaign autosaves, run records, settings and Codex progress.",
    sourceFiles: [
      "src/meta/Saves.cpp",
      "src/meta/Saves.hpp",
      "src/GameCampaign.cpp",
      "src/level/Chart.cpp",
      "src/test/SaveTest.cpp",
      "src/meta/Codex.hpp",
      "src/meta/Feats.cpp",
      "src/meta/Settings.cpp",
      "src/menu/SettingsMenu.cpp",
      "src/gfx/Palette.hpp",
      "src/test/PaletteTest.cpp",
      "src/input/Input.cpp",
    ],
    content: `
### Save files and recovery (\`src/meta/Saves.cpp\`)

\`Saves::open()\` asks SDL for the preference directory using \`SDL_GetPrefPath("soulwax", "Mellangan")\`. Its exact location depends on the platform and environment. If no preference path is available, \`Saves::read()\` returns an empty string and \`Saves::write()\` does nothing.

#### Writing a file

\`Saves::store()\` follows this sequence:

1. Write the new bytes to \`<name>.tmp\` using \`SDL_SaveFile()\`. A failure is logged and returns \`false\`.
2. If the current primary exists and is nonempty, attempt to rename it to \`<name>.bak\`. The code does not check this rename's return value.
3. Rename the temporary file to the primary name. Failure is logged and returns \`false\`; success returns \`true\`.

The ordinary \`Saves::write()\` wrapper discards that return value. These steps provide a backup and a temporary file, but the code does not verify the saved contents or establish a guarantee against every crash or filesystem failure. In particular, do not treat the backup as a verified copy: it is the previous nonempty primary, which may itself be invalid.

#### Reading and fallback

\`Saves::recall()\` reads the primary first. A nonempty primary is accepted if no validator was supplied, or if its validator passes. Otherwise it tries \`<name>.bak\` with the same rules. If the backup is accepted, the function logs a warning and **returns its contents**; it does not rewrite the primary. If neither is acceptable, it returns the original primary contents, which can be empty or invalid. Callers must still handle invalid input.

| Data | Validation before fallback | Notes |
|:---|:---|:---|
| Campaign | \`Campaign::valid\` | An invalid primary can trigger backup fallback. |
| Codex | Newline and parse check | \`Codex::load()\` also parses the returned data before applying it. |
| Chart | Header and expected byte length | \`Chart::load()\` checks the returned data again. |
| Settings, keys, world history and run log | No validator supplied by these read sites | A nonempty primary is accepted without a corruption check by \`recall()\`. |

\`Saves::erase()\` removes the primary, backup and temporary siblings. \`src/test/SaveTest.cpp\` exercises fallback from missing, empty and invalid files for several of these paths; it is not a test of every possible filesystem interruption.

#### Campaign autosave and run history

\`Game::saveCampaign()\` captures and saves only when a campaign and level exist and the player is alive. It writes only when \`writes()\` permits it. The campaign tick resets a 60-second autosave timer, and other actions such as completing a delve or rescuing a sanctuary seeker also request a save.

\`Saves::record()\` keeps up to six recent world records, moving the recorded world to the front, accumulating its run count, best time and dawn flag. Evicting the oldest record also calls \`erase()\` on its chart and sibling backup and temporary files.

#### 50 In-Game Achievements & Codex Unlocks (\`src/meta/Feats.cpp\`)
The Codex tracks 50 distinct achievements spanning lifetime milestones, single-run feats, challenge completions, and class masteries:
* **Lifetime Milestones:** First dawn, 10 dawns, 50 runs, 1,000 / 10,000 / 100,000 lifetime kills, 50 / 150 / 300 kill streaks, visiting 10 / 20 / all biomes, collecting 5 / 10 / 16 relics.
* **Single-Run Feats:** Reaching level 20 / 40, slaying 5,000 foes in one run, kindling 5 shrines, crafting 3 weapon evolutions, reaching dawn with a single weapon, full-health dawn, or sub-12:00 dawn.
* **Difficulty & Boss Triumphs:** Dawn on Ultra-Violence, Nightmare, and under nocturnal Omens; slaying the Ancient Cyclops, Alpha Wolf, and Pale Warden; and clearing dawn with each of the 12 individual hero classes.
The final Codex tab displays all 50 achievements, providing contextual hint text for locked entries and maintaining stable IDs for future digital storefront synchronization.

#### Run Balancing Telemetry (\`runs.csv\` & \`tools/run_report.py\`)
When run recording is permitted, the game reads \`runs.csv\`, replaces its header, adds a telemetry row and writes the resulting file through \`Saves::write()\`:
* Timestamp, game version, world seed, difficulty, selected class, active omen, final time, dawn status, and cause of death.
* Player level, kill tally, shrines ignited, distance traversed, and total damage dealt.
* Per-weapon levels and aggregate damage output, upgrade selection order, level checkpoints at each minute, and dwell duration per biome.
The bundled \`tools/run_report.py\` utility parses this telemetry to calculate median weapon damage per second, class win rates by Heat tier, and highlight statistical balance outliers.

#### Settings: from file to screen (\`Settings.cpp\`, \`SettingsMenu.cpp\`)

\`Settings\` starts with defaults. Outside benchmark mode, startup reads \`settings.txt\` from the preference directory and parses recognized \`key integer\` lines. Values are clamped to each field's allowed range; unknown or malformed lines leave the corresponding defaults unchanged. If the settings file is empty, startup checks the older \`visual.txt\` for the reduced-particles setting. \`Settings::save()\` writes every registered field as a separate line.

| Menu control | Stored key | Values and behavior |
|:---|:---|:---|
| Master, music, effects, ambience | \`master\`, \`music\`, \`effects\`, \`ambience\` | 0–100, adjusted in steps of 10 in the menu. |
| Screen shake, flashes | \`shake\`, \`flash\` | 0–100, adjusted in steps of 25. |
| Particles, damage numbers | \`reduced_particles\`, \`damage_numbers\` | 0 or 1; particle density and number visibility are separate settings. |
| Colours | \`colourblind\` | 0–4: Standard, Deuteranopia, Protanopia, Tritanopia and Monochrome. |
| Fullscreen, scaling, VSync | \`fullscreen\`, \`pixel_perfect\`, \`vsync\` | 0 or 1; scaling selects Fill or Pixel Perfect. |
| Intro | \`intro\` | 0 or 1; controls whether the optional intro is eligible at startup. |

Numeric rows clamp at their ends; labeled choices cycle. Each change calls \`Game::applySettings()\` and requests a save, subject to \`writes()\`. Applying settings updates the audio mix, camera shake, selected palette and scaling mode. When a window exists, it also updates fullscreen and selects VSync or triple-buffer screen mode. Other consumers read settings directly, including particle rendering and flash effects.

#### Colour schemes and verification (\`Palette.hpp\`)

The five schemes define colors for warnings, damage, healing, comparison indicators, item rarities and night-touched items. Game code selects these colors at their use sites; this is not a full-screen color transformation. The Monochrome scheme is a named UI palette and does not turn the entire game image grayscale.

\`PaletteTest.cpp\` models each alternative under a corresponding simulated vision matrix and compares selected color distances against the standard scheme. It tests item rarity separation, hurt versus heal, and warning versus a sample grass color. These checks help catch regressions in those comparisons; they do not establish readability for every scene, display or player.

#### Controls and rebinding
The controls menu saves 17 keyboard bindings and eight gamepad bindings in \`keys.txt\`. See **Input, Controls & Rebinding** for the fixed controls, conflict handling, analog stick behavior and prompt substitutions.

`,

    mermaidCharts: [
      {
        title:
          "Saves Preference Directory, 6-World LRU History & Chart Eviction",
        chart: `
flowchart TD
    classDef io fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef file fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gc fill:#181524,stroke:#f43f5e,stroke-width:2px,color:#e2e8f0;

    Pref["Saves::open()<br/>SDL_GetPrefPath('soulwax', 'Mellangan')"]:::io
    Files["Persistent Files<br/>• world.txt (WorldMode + Seed)<br/>• worlds.txt (LRU History <= 6)<br/>• codex.txt (Meta Unlock Ledger)<br/>• chart-<code>.bin (Fog-of-War)"]:::file
    Record["Saves::record(code, time, dawn)<br/>Move/Insert World at history.begin()"]:::io
    Evict["history.size() > 6 (Saves::HISTORY)?<br/>Saves::erase(chart path)<br/>history.pop_back()"]:::gc

    Pref --> Files --> Record --> Evict
`,
      },
      {
        title:
          "Balance::load() Pointer-to-Member INI Reflection Cascade (res/balance.ini)",
        chart: `
flowchart TD
    classDef ini fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef reflect fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;

    File["res/balance.ini<br/>[all] Baseline + 5 Difficulty Sections"]:::ini
    Filter{"section == 'all' ||<br/>section == difficultyName(tier)?"}:::ini
    Bind["Lookup Key in FIELDS[28]<br/>this->*f.member = strtof(value)"]:::reflect
    Systems["Consumed by Spawner, Night, Player & Enemy<br/>(spawnInterval, enemyCap, hordeMax, xpGrowth...)"]:::reflect

    File --> Filter -- "Match" --> Bind --> Systems
`,
      },
    ],
    interactiveComponent: "director",
  },
  {
    id: "combat-status-draft",
    title:
      "23. 7 Status Afflictions, 0.5s DoT Ticks, Bleed Stacking & Level-Up Draft",
    category: "gameplay",
    summary:
      "Exact math behind all 7 StatusKind afflictions in Status.hpp (including Bleed 1.6x moving damage, Weaken, and Fear), lossless 0.5-second DoT ticks, and LevelUpMenu weighted card drafting.",
    sourceFiles: [
      "src/entity/Status.hpp",
      "src/entity/Mob.cpp",
      "src/menu/LevelUpMenu.cpp",
      "src/entity/pickup/Chest.cpp",
    ],
    content: `
### Fixed-Slot 7-Status Affliction Array (\`src/entity/Status.hpp\`)

Every \`Mob\` (both \`Player\` and \`Enemy\`) embeds a compact \`Status\` object containing a 7-element inline array \`std::array<StatusEffect, int(StatusKind::Count)> effects{}\` (\`Burn\`, \`Chill\`, \`Poison\`, \`Marked\`, \`Bleed\`, \`Weaken\`, \`Fear\`), a 32-bit immunity mask \`uint32_t immune = 0\`, and a \`bool moving = false\` locomotion flag. Because the array is fixed-size and inline, applying or ticking status effects never allocates heap memory.

#### Immunity Bitmasks, Hard Caps & Additive Bleed Stacking (\`Status::apply\`)
When a weapon or hazard calls \`status.apply(kind, duration, power, source)\`:
1. **Immunity Check:** If \`immune & (1u << int(kind))\` is non-zero (or \`power <= 0\` / \`duration <= 0\`), the affliction is ignored.
2. **Safety Clamping (\`Status::cap\`):**
   - \`StatusKind::Chill\` power is clamped to **\`0.65f\`** (\`65%\` maximum slow), so \`movement() = 1.0f - power(Chill)\` never freezes a mob below \`35%\` base speed.
   - \`StatusKind::Marked\` and \`StatusKind::Fear\` power are clamped to **\`1.0f\`**, so \`incoming() = 1.0f + power(Marked)\` caps at \`2.0×\` vulnerability and \`afraid() = power(Fear) > 0\` causes afflicted enemies to flee!
   - \`StatusKind::Weaken\` power is clamped to **\`0.5f\`** (\`-50%\` maximum outgoing damage reduction via \`outgoing() = 1.0f - power(Weaken)\`).
   - \`Burn\`, \`Poison\`, and \`Bleed\` cap at \`1000.0f\` DPS, and \`duration\` is clamped to \`60.0f\` seconds.
3. **Additive \`Bleed\` Stacking vs Max-Envelope Stacking:**
   - Re-applying **\`StatusKind::Bleed\`** while active **stacks additively**: \`e.power = std::min(cap(kind), e.power + power)\`.
   - Re-applying any other status takes the max envelope: \`if (e.time <= 0 || power > e.power) e.power = power\`.

---

### Lossless 0.5-Second DoT Ticks & 1.6× Moving Bleed Multiplier (\`Status::tick\`)

Damage-over-time effects (\`Burn\`, \`Poison\`, and \`Bleed\`, checked via \`Status::ticks(i)\`) do not deal tiny sub-point damage on every 60 Hz frame. Instead, \`Status::tick(dt, damage)\` accumulates \`e.elapsed += step\`, scales \`Bleed\` by **\`1.6×\` if the target is moving** (\`float k = i == int(StatusKind::Bleed) && moving ? 1.6f : 1.0f\`), and fires discrete **0.5-second ticks** plus a **lossless fractional remainder tick** on expiry:

\`\`\`cpp
if (ticks(i)) {
  float k = i == int(StatusKind::Bleed) && moving ? 1.6f : 1.0f;
  e.elapsed += step;
  while (e.elapsed + 1e-6f >= 0.5f) {
    e.elapsed = std::max(0.0f, e.elapsed - 0.5f);
    if (!damage(e.power * 0.5f * k, e.source)) {
      clear();
      return;
    }
  }
  if (e.time <= 0 && e.elapsed > 1e-6f)
    if (!damage(e.power * e.elapsed * k, e.source)) {
      clear();
      return;
    }
}
\`\`\`

This guarantees that an affliction with \`power = 10\` and \`duration = 1.3s\` deals two \`5.0\` ticks at \`0.5s\` and \`1.0s\`, followed by an exact \`3.0\` remainder tick at \`1.3s\` (\`13.0\` total damage, or \`20.8\` if bleeding while moving).

---

### Weighted Level-Up Draft & Bonus 4th Card (\`src/menu/LevelUpMenu.cpp\`)

When the player levels up or opens a \`Chest\` (\`treasure = true\`), \`LevelUpMenu::roll(Game &g, bool treasure)\` builds the draft hand from the global \`UPGRADES\` registry without replacement.

#### 1. Slot Cap Filtering (\`Upgrade::SLOTS\`)
First, \`LevelUpMenu::roll\` counts how many passive upgrades (\`owned[0]\`) and active weapons (\`owned[1]\`) the player already owns. Any unowned upgrade whose category has already reached \`Upgrade::SLOTS\` is excluded from the pool so the player can only level up existing items in that category.

#### 2. 3× / 2× / 1× Weighted Sampling Without Replacement
For each of the 3 primary card slots (\`k < 3\`), every eligible upgrade \`u\` in \`pool\` is assigned an integer draft weight:

\`\`\`cpp
auto weight = [&](const Upgrade *u) {
  return u->owner ? 3 : (p.hero && p.hero->favours(u->name)) ? 2 : 1;
};
\`\`\`

- **\`3× Weight\` (\`u->owner != nullptr\`):** Exclusive class weapons and talents belonging to the player's hero class are three times as likely to appear.
- **\`2× Weight\` (\`p.hero->favours(u->name)\`):** Weapons and passives listed in the hero's \`affinity[]\` array are twice as likely to appear.
- **\`1× Weight\`:** All other eligible upgrades in the general pool.

#### 3. The Bonus 4th Card Slot (\`MAX_CHOICES = 4\`)
After drawing up to 3 standard upgrade cards, \`LevelUpMenu::roll\` checks whether a **4th special card** should appear:
1. **Active Skill Offer (\`25%\` chance at \`lvl >= 4\`):** On normal level-ups (\`!treasure\`) once \`p.lvl >= 4\`, there is a **1-in-4 (\`25%\`)** chance to offer an unlearned class skill or one of the 8 general skills in the 4th slot.
2. **Weapon Evolution (\`evolveSlot\` on Treasure Chests):** When opening a \`treasure\` chest, if any owned weapon satisfies \`u->canEvolve(p)\` (max weapon level + required catalyst passive), the 4th slot deterministically offers the **Evolution** (\`evolveSlot = count++\`).
3. **Relic Offering (\`treasure || 3%\` wild roll):** If no Evolution occupied the 4th slot, opening a \`treasure\` chest (or rolling a \`3%\` lucky proc on a normal level-up) offers an unowned \`Relic\` via \`pickRelic(p, g.rng)\`.
`,
    mermaidCharts: [
      {
        title:
          "Status::apply() Clamping, Bleed Stacking & Lossless 0.5s DoT Tick State Machine",
        chart: `
flowchart TD
    classDef apply fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef tick fill:#181524,stroke:#f43f5e,stroke-width:2px,color:#e2e8f0;
    classDef mod fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Apply["Status::apply(kind, duration, power, src)<br/>Check immune & (1u << kind)"]:::apply
    Clamp["Clamp Envelopes & Stack<br/>• Chill <= 0.65 | Weaken <= 0.50 | Marked/Fear <= 1.0<br/>• Bleed: Additive (e.power += power) | Others: Max Envelope"]:::apply
    DotTick["Status::tick(dt) (Burn / Poison / Bleed)<br/>k = (Bleed && moving) ? 1.6f : 1.0f"]:::tick
    HalfSec["While e.elapsed >= 0.5f:<br/>damage(e.power * 0.5f * k, e.source)"]:::tick
    Tail["On Expiry (e.time <= 0 && e.elapsed > 0):<br/>Flush Remainder damage(e.power * e.elapsed * k)"]:::mod

    Apply --> Clamp --> DotTick --> HalfSec --> Tail
`,
      },
      {
        title:
          "LevelUpMenu::roll() 3x/2x/1x Weighted Draft & 4th Bonus Card Resolution",
        chart: `
flowchart TD
    classDef pool fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef weight fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef bonus fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Filter["Filter UPGRADES Registry<br/>u->eligible(p) && (owned || slots < Upgrade::SLOTS)"]:::pool
    Draw3["Draw 3 Cards Without Replacement<br/>weight(u) = owner ? 3 : hero->favours ? 2 : 1"]:::weight
    Slot4Check{"Bonus 4th Card Roll<br/>(count < MAX_CHOICES)"}:::bonus
    SkillCard["Normal Level-Up (lvl >= 4 & 25% Roll)<br/>Offer Class Skill or General Skill"]:::bonus
    EvolveCard["Treasure Chest + u->canEvolve(p)<br/>Guaranteed Weapon Evolution Card (29 Evolutions)"]:::bonus
    RelicCard["Treasure Fallback or 3% Wild Roll<br/>Offer Unowned Relic (pickRelic)"]:::bonus

    Filter --> Draw3 --> Slot4Check
    Slot4Check -- "!treasure && lvl >= 4 (25%)" --> SkillCard
    Slot4Check -- "treasure && canEvolve" --> EvolveCard
    Slot4Check -- "treasure || 3% chance" --> RelicCard
`,
      },
    ],
    interactiveComponent: "director",
  },
  {
    id: "goal-steering-catalog",
    title:
      "24. The 16 AI Goal Primitives, Gait Kinematics & 39-Monster Plan Table",
    category: "simulation",
    summary:
      "Complete mathematical breakdown of all 16 Goal subclasses in src/entity/enemy/ai/, Gait wave/weave modulation, V-formation pack following, and subterranean burrow state machines.",
    sourceFiles: [
      "src/entity/enemy/ai/Plans.cpp",
      "src/entity/enemy/ai/Approach.cpp",
      "src/entity/enemy/ai/Melee.cpp",
      "src/entity/enemy/ai/Flank.cpp",
      "src/entity/enemy/ai/Follow.cpp",
      "src/entity/enemy/ai/Burrow.cpp",
    ],
    content: `
### Architectural Overview of \`src/entity/enemy/ai/\`

All 39 monster species in **Mellangan** (\`EnemyKind::Bat\` through \`EnemyKind::Cutthroat\`) are driven by combinations of **16 stateless \`Goal\` subclasses** wired into \`const Plan PLANS[39]\` (\`src/entity/enemy/ai/Plans.cpp\`). A compile-time assertion guarantees that every \`EnemyKind\` has a corresponding plan:

\`\`\`cpp
static_assert(sizeof(PLANS) / sizeof(PLANS[0]) == int(EnemyKind::Count));
\`\`\`

Each \`Goal\` implements up to five virtual methods (\`src/entity/enemy/ai/Goal.hpp\`):
- \`void start(Enemy &e, const Sense &s) const\`: Initializes per-enemy scratch fields (\`xMark, yMark\`, \`side\`, \`buried\`, \`faltered\`) when the goal becomes the queue front.
- \`GoalState tick(Enemy &e, const Sense &s, double &xs, double &ys) const\`: Computes the desired velocity vector \`(xs, ys)\` and returns \`GoalState::Running\` or \`GoalState::Done\`.
- \`bool urgent(const Enemy &e, const Sense &s) const\`: Evaluated for \`plan->interrupts[0..1]\` before ticking the active goal; if \`true\`, preempts via \`goals.pushFront(g)\`.
- \`float tell(const Enemy &e) const\`: Returns a normalized \`[0..1]\` telegraph progress value rendered as an expanding warning ring or flash before a strike/eruption.
- \`bool conceals() const\`: Returns \`true\` during \`Hide\` so \`Ghost\` renders at reduced alpha while backing away.

---

### 1. \`Approach\` & \`Gait\` Wave/Weave Modulation (\`ai/Approach.cpp\`)

\`Approach(double stop, Gait gait)\` is the primary locomotion primitive, parameterized by \`struct Gait\`:

\`\`\`cpp
struct Gait {
  double base = 1, pulse = 0, pulseRate = 0, weave = 0, weaveRate = 0;
  bool rectified = false;
};
\`\`\`

On every tick until \`stop > 0 && s.dist < stop && e.cooldown <= 0\`, \`Approach::tick\` computes three kinematic layers:
1. **Longitudinal Speed Modulation (\`v\`):**
   \`\`\`cpp
   double wave = std::sin(e.animT * gait.pulseRate);
   double v = e.type.speed *
              (gait.base + gait.pulse * (gait.rectified ? std::max(0.0, wave) : wave));
   \`\`\`
   - **\`CHARGE\` / \`MARCH\` / \`CLOSE\` / \`LUMBER\`:** \`{1, 0, 0, 0, 0, false}\` — steady constant velocity.
   - **\`OOZE\` (\`Slime\`, \`Ghost\`, \`FrostWisp\`):** \`{0.8, 0.4, 2, 0, 0, false}\` — smooth sinusoidal peristaltic pulsing between \`0.4x\` and \`1.2x\` speed.
   - **\`SCUTTLE\` (\`Scorpion\`, \`EmberImp\`):** \`{0.5, 1.2, 4, 0, 0, true}\` — **half-wave rectified** bursts (\`0.5x\` baseline surging to \`1.7x\` during positive half-cycles of $\\sin(4t)$).
2. **Orthogonal Serpentine Weave (\`w\`):**
   \`double w = std::sin(e.animT * gait.weaveRate) * gait.weave;\`
   Used by \`FLUTTER\` (\`Bat\`, \`weave = 34, rate = 5\`), \`HOVER\` (\`MothWisp\`), \`CASTING_RANGE\` (\`Cultist\`, \`weave = 28, rate = 3\`), and \`SHOOTING_RANGE\` (\`Outlaw\`).
3. **8-Lane Seed Fan Spread (\`spread\`):**
   \`\`\`cpp
   double spread = (int(e.seed >> 3 & 7) - 3.5) * 0.14 *
                   std::clamp((s.dist - 50) / 160, 0.0, 1.0);
   \`\`\`
   Bits \`[5..3]\` of the enemy's seed assign it to one of 8 angular approach lanes spanning $\\pm 3.5 \\times 0.14 = \\pm 0.49\\text{ rad}$ ($\\approx \\pm 28^{\\circ}$) when \`s.dist >= 210 px\`. As the monster closes from \`210 px\` to \`50 px\`, the spread linearly collapses to \`0°\`, creating natural pincer envelopes that converge directly onto the player at melee range!

---

### 2. Orbital, Pack & Sight-Reactive Steering Goals

- **\`Flank(prefer)\` (\`ai/Flank.cpp\`):**
  Combines a proportional radial spring \`radial = clamp((s.dist - prefer) * 1.6, -spd, spd)\` with a \`0.95 * spd\` tangential orbit in direction \`e.side\` (\`+1\` or \`-1\`). Completes after \`1.6 + (e.seed % 5) * 0.2\` seconds once within \`prefer + 30 px\`, handing off to \`BITE\` or \`STAB\`.
- **\`Circle(radius, seconds)\` (\`ai/Circle.cpp\`):**
  Used by \`MothWisp\` (\`HOVER -> ORBIT -> DIVE\`). Orbits at \`radius = 60 px\` for \`2.5s\` with a tighter \`2.0x\` radial spring before diving.
- **\`Follow(breakOff)\` (\`ai/Follow.cpp\`):**
  Used by \`Rat\` (\`PACK -> CHARGE\`). If \`s.dist < 90 px\`, returns \`Done\` to transition to \`CHARGE\`. Otherwise, looks up \`lead = e.level->get<Enemy>(e.leader)\`:
  - If \`!lead\`, sets \`e.wantsLeader = true\` (resolved by main-thread \`Enemy::adopt()\`).
  - If \`lead\` is valid, steers toward a **V-formation wing offset** \`12 px\` behind and \`±10 px\` beside the leader:
    \`\`\`cpp
    double tx = lead->x - s.yn * 10 * e.side - s.xn * 12,
           ty = lead->y + s.xn * 10 * e.side - s.yn * 12;
    \`\`\`
- **\`LookOut(sight)\` (\`ai/LookOut.cpp\`):**
  Used by \`Slime\` (\`WATCH 260\`) and \`Knight\` / \`Deserter\` (\`GUARD 220\`). Wanders at \`0.3x\` speed along a random unit direction re-rolled every \`1.5 + e.roll()\` seconds until \`s.dist < sight\` sets \`e.aware = true\`.
- **\`Stalk(range)\` (\`ai/Stalk.cpp\`):**
  Used by \`Spider\`. Orbits at \`range = 110 px\` while the player is looking at the spider (\`s.seen == true\`). The instant the player looks away (\`!s.seen && s.dist < range * 1.6\`) or \`goalTime > 7s\`, \`Stalk\` completes and chains into \`CLOSE -> BITE\`.

---

### 3. Preemptive Interrupt Goals (\`Falter\` & \`Hide\`)

- **\`Falter(below = 0.3f)\` (\`ai/Falter.cpp\`):**
  Attached to \`interrupts[0]\` on 19 monster plans. \`urgent()\` returns \`true\` once per enemy lifetime (\`!e.faltered\`) when \`e.hp < e.maxHp * 0.3f && s.dist < 160\`. \`start()\` sets \`e.faltered = true\`, and \`tick()\` backs away at \`-0.9x\` speed with a lateral sine weave for \`1.1s\`.
- **\`Hide(range = 240)\` (\`ai/Hide.cpp\`):**
  Attached to \`EnemyKind::Ghost\`. Whenever \`e.aware && s.seen && s.dist < 240\`, \`Hide\` preempts \`OOZE\`, sets \`conceals() = true\`, and retreats at \`-0.6x\` speed until the player looks away (\`!s.seen\`) or distance exceeds \`240 * 1.3 = 312 px\`.

---

### 4. Combat & Specialist Goals (\`Melee\`, \`Ranged\`, \`Burrow\`, \`Howl\`, \`Raise\`, \`Mend\`, \`Lurk\`, \`Escape\`)

- **\`Melee(windup, lunge, speed, cooldown)\` (\`ai/Melee.cpp\`):**
  1. \`start()\`: Locks the unit attack vector \`(e.xMark, e.yMark) = (s.xn, s.yn)\` so the player can dodge laterally during the windup!
  2. **Windup Phase (\`goalTime < windup\`):** Steps backward at \`-8 px/s\` while emitting telegraph progress \`tell() = goalTime / windup\`.
  3. **Lunge Phase (\`goalTime < windup + lunge\`):** Dashes along the locked \`(xMark, yMark)\` vector at \`e.type.speed * speed\`.
  4. **Completion:** Sets \`e.cooldown = cooldown\` and returns \`GoalState::Done\`.
- **\`Ranged(prefer, range)\` (\`ai/Ranged.cpp\`):**
  Maintains radial distance \`prefer = 150\` while strafing (\`cos(3 * animT) * 28\`). Whenever \`e.cooldown <= 0 && s.dist < range\`, sets \`e.wantsFire = true\` and \`e.cooldown = 2.5f + 1.5f * e.roll()\`.
- **\`Burrow(travel, warn, surface)\` (\`ai/Burrow.cpp\`):**
  Three-stage subterranean state machine for \`EnemyKind::Burrower\`:
  1. **Subterranean Travel (\`buried = true, goalTime < 2.8s\`):** Because \`e.buried\` is \`true\`, \`Level::buildGrid()\` and \`Enemy::push()\` skip the Burrower completely! It chases the player underground at \`1.35x\` speed, emitting \`SmokeDebris\` every 5 ticks until \`s.dist <= 30\` or \`goalTime >= 2.8s\`.
  2. **Eruption Telegraph (\`2.8s <= goalTime < 3.55s\`):** Halts at \`(xMark, yMark)\` and ramps \`tell()\` from \`0.0\` to \`1.0\` over \`warn = 0.75s\`.
  3. **Eruption & Surface Recovery (\`goalTime >= 3.55s\`):** Clears \`e.buried = false\`, plays \`Sound::erupt\`, bursts 25 blood sparks, deals \`1.25x\` AoE damage within \`28 px\`, and crawls at \`0.4x\` speed for \`surface = 2.4s\` before executing \`NIP\`.
- **\`Howl\` (\`Alpha\`), \`Raise\` (\`Necromancer\`), \`Mend\` (\`GoblinShaman\`), \`Lurk\` (\`Mimic\`), and \`Escape\` (\`Thief\`):**
  - \`Howl\` grants \`frenzy = 6.0f\` (\`+35%\` speed) to self and all \`Wolf\` allies within \`240 px\` (and spawns up to 3 wolves if \`e.boss\`).
  - \`Raise\` channels for \`0.85s\` and spawns 2 \`Skeleton\` minions (4 if \`e.boss\`).
  - \`Mend\` scans \`level->gather(x, y, 150, nearby, 24)\` for the most injured ally (\`hp / maxHp < 0.9f\`) and escorts within \`40 px\`.
  - \`Lurk\` keeps a \`Mimic\` disguised (\`buried = true\`) until \`s.dist < 46 px\`, erupting with \`frenzy = 1.5f\`.
  - \`Escape\` makes a \`Thief\` flee for \`10.0s\` while dropping gold sparks every 6 ticks, slowing to \`0.35x\` speed during the final \`2.0s\` windup before vanishing!
`,
    mermaidCharts: [
      {
        title:
          "Approach Gait Modulation, 8-Lane Fan Spread & Melee Lock-On Pipeline",
        chart: `
flowchart TD
    classDef sense fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gait fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef melee fill:#181524,stroke:#f43f5e,stroke-width:2px,color:#e2e8f0;

    Sense["Enemy::sense()<br/>Velocity Lead: rx + p.xa * lead<br/>Sight Cone: dist < 300 && -(p.Aim · n) > 0.55"]:::sense
    GaitWave["Approach::tick() Longitudinal Wave<br/>wave = sin(animT * pulseRate)<br/>v = speed * (base + pulse * (rectified ? max(0, wave) : wave))"]:::gait
    Spread["8-Lane Seed Fan Spread & Orthogonal Weave<br/>spread = ((seed>>3 & 7) - 3.5) * 0.14 * clamp((dist-50)/160, 0, 1)<br/>Rotate (xn, yn) by spread + Apply Orthogonal Weave w"]:::gait
    StopCheck{"s.dist < stop &&<br/>e.cooldown <= 0?"}:::gait
    MeleeStart["Melee::start(): Lock (xMark, yMark) = (s.xn, s.yn)<br/>1. Windup (t < windup): v = -8 px/s, tell() = t / windup<br/>2. Lunge (t < windup+lunge): Dash along (xMark, yMark) at speed * mul"]:::melee

    Sense --> GaitWave --> Spread --> StopCheck
    StopCheck -- "Yes (GoalState::Done)" --> MeleeStart
`,
      },
      {
        title:
          "Burrow 3-Stage Subterranean State Machine & Follow V-Formation Wing Math",
        chart: `
flowchart TD
    classDef burrow fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef pack fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    subgraph Burrower_Plan ["Burrow::tick() (travel=2.8s, warn=0.75s, surface=2.4s)"]
        B1["Stage 1 (t < 2.8s, buried = true)<br/>Skips CSR Grid & Collision; Chases @ 1.35x Speed + SmokeDebris"]:::burrow
        B2["Stage 2 (2.8s <= t < 3.55s, buried = true)<br/>Halts at (xMark, yMark); Ramps tell() = (t - 2.8) / 0.75"]:::burrow
        B3["Stage 3 (t >= 3.55s, buried = false)<br/>Erupts (28px AoE, 1.25x Dmg) + Crawls @ 0.4x Speed for 2.4s"]:::burrow
        B1 --> B2 --> B3
    end

    subgraph Rat_Pack ["Follow::tick(breakOff = 90) & Enemy::adopt()"]
        F1["No Leader? Set wantsLeader = true<br/>Main-Thread Enemy::adopt() Scans gather(140px) for Unled Aware Rat"]:::pack
        F2["Leader Found: Compute V-Formation Wing Slot<br/>tx = lead->x - yn * 10 * side - xn * 12<br/>ty = lead->y + xn * 10 * side - yn * 12"]:::pack
        F3["s.dist < 90px: Break Off Formation<br/>Return GoalState::Done -> Transition to CHARGE"]:::pack
        F1 --> F2 --> F3
    end
`,
      },
    ],
    interactiveComponent: "goalai",
  },
  {
    id: "diablo-loot-runrules",
    title:
      "25. Diablo-Style Item System, 30 Affix Families, Treasure Classes & RunRules",
    category: "gameplay",
    summary:
      "Deep dive into v0.5.14+ item bases, 30 five-tier affix families, diminishing-returns Magic Find, Night-Touched cursed items, ItemDrop physics, RunRules, and BiomeViewer.",
    sourceFiles: [
      "src/item/loot/Item.hpp",
      "src/item/loot/Affix.cpp",
      "src/item/loot/Loot.cpp",
      "src/entity/pickup/ItemDrop.cpp",
      "src/level/RunRules.hpp",
      "tools/biome_viewer/main.cpp",
    ],
    content: `
### Diablo-Style Item System Architecture (\`src/item/loot/\`)

Introduced in \`v0.5.14+\` (and testable via \`--loot\` in gameplay or \`--loot-sim <COUNT> [MLVL]\` from the CLI), \`src/item/loot/\` implements a complete, deterministic ARPG itemization engine modeled after classic *Diablo II* prefix/suffix generation, treasure classes, and diminishing-returns Magic Find.

#### 1. Item Bases & 3 Quality Tiers (\`ItemBase.hpp\`, \`ItemBase.cpp\`)
Every weapon in the arsenal—plus dedicated **Off-hands**, **Armour**, and **Charms**—is registered in \`itemBases()\` with a slot bitmask (\`slot::Weapon\`, \`slot::Offhand\`, \`slot::Armour\`, \`slot::Charm\`, \`slot::AreaWeapon\`, \`slot::ShotWeapon\`), base quality level \`qlvl\`, spawn \`weight\`, gold \`value\`, and an implicit \`Stat\`.
- Each base exists across **3 progression tiers** (\`TIER_COUNT = 3\`) with quality offsets \`TIER_LEVEL[3] = {0, 18, 36}\`.
- When \`pickBase(ilvl, tier, rng)\` selects a base for an item of level \`ilvl\`, any \`(base, tier)\` pair whose effective quality \`q = b.qlvl + TIER_LEVEL[t]\` is within \`10\` levels of \`ilvl\` (\`ilvl - q <= 10\`) receives a **\`3×\` freshness weight bonus**:
  \`\`\`cpp
  auto weight = [&](const ItemBase &b, int t) {
    int q = b.qlvl + TIER_LEVEL[t];
    return q > ilvl ? 0 : b.weight * (ilvl - q <= 10 ? 3 : 1);
  };
  \`\`\`

---

### 2. 30 Affix Families Across 5 Tiers (\`src/item/loot/Affix.cpp\`)

\`AFFIXES[30]\` defines **14 Prefix families** and **16 Suffix families**, each containing up to **5 progressive \`AffixTier\` brackets** (\`qlvl = 1, 12, 24, 36, 48\`):
- **14 Prefix Families (\`prefix = true\`):**
  \`damage\` (*Sharp* → *Merciless*, \`+6%..+70%\`), \`burn\` (*Smoldering* → *Infernal*), \`chill\` (*Chilling* → *Arctic*), \`poison\` (*Noxious* → *Pestilent*), \`shock\` (*Charged* → *Thunderous*), \`bleed\` (*Jagged* → *Butchering*), \`count\` (*Twin* / *Triple* / *Legion*, \`+1..+2\` projectiles on \`ShotWeapon\`), \`area\` (*Wide* → *Titanic*, \`+6%..+40%\` on \`AreaWeapon | Offhand\`), \`crit\` (*Keen* → *Fatal*), \`leech\` (*Thirsty* → *Sanguine*), \`armour\` (*Sturdy* → *Impregnable*), \`life\` (*Hale* → *Titan's*, \`+8..+80\` HP), \`fortune\` (*Lucky* → *Divine*, \`+6%..+58%\` Magic Find), and \`gleaming\` (*Gleaming* → *Radiant*, Gold Find).
- **16 Suffix Families (\`prefix = false\`):**
  \`speed\` (*of the Fox* → *of the Gale*), \`haste\` (*of Haste* → *of Quickening*), \`regen\` (*of Mending* → *of Life Eternal*), \`reach\` (*of the Magnet* → *of Attraction*), \`wisdom\` (*of the Pupil* → *of the Archmage*), \`thorns\` (*of Thorns* → *of Razors*), \`resist burn/chill/poison\`, \`kindling\`, \`night\` (*of Dusk* → *of the Long Night*), \`dawn\` (*of Daybreak* → *of the Sun*, boss damage), \`slaying\` (*of Slaying* → *of the Executioner*, elite damage), and class-item skill tree boosters \`arms\`, \`arts\`, and \`instincts\` (\`+1..+2\` levels).

#### Family Exclusion & Prefix/Suffix Caps (\`Item::addAffix\`)
An \`Item\` holds up to \`MAX_AFFIXES = 6\` rolls (\`Roll rolls[6]\`). \`Item::hasFamily(affix)\` prevents two rolls from the same affix family from appearing on the same item:
- **\`Rarity::Magic\` (\`affixMagic\`):** Rolls \`1..2\` affixes (at most 1 prefix and 1 suffix) and names the item dynamically, e.g., *"Searing Standard Ember Lance of Alacrity"*.
- **\`Rarity::Rare\` (\`affixRare\`):** Rolls \`3..5\` affixes (up to \`6\` if a Unique roll upgrades a Rare via \`extra = 1\`), enforcing at most **3 prefixes and 3 suffixes**, and generates a deterministic two-word title from \`hash2(seed, 17)\` and \`hash2(seed, 91)\` (e.g., *"Dusk Fang"*, *"Storm Aegis"*).

---

### 3. Diminishing-Returns Magic Find & Night-Touched Curses (\`Loot.cpp\`)

\`rarityOdds(int ilvl, float magicFind)\` scales base drop rates by \`scale = 1 + ilvl / 40.0f\` and applies a hyperbolic diminishing-returns curve \`diminish(mf, k) = (mf * k) / (mf + k)\` to Rare (\`k = 600\`) and Unique (\`k = 250\`) rolls while keeping Magic rolls linear:

\`\`\`cpp
float diminish(float mf, float k) { return mf * k / (mf + k); }

RarityOdds rarityOdds(int ilvl, float magicFind) {
  float scale = 1 + ilvl / 40.0f;
  return {std::min(1.0f, scale / 700 * (1 + diminish(magicFind, 250) / 100)),
          std::min(1.0f, scale / 90 * (1 + diminish(magicFind, 600) / 100)),
          std::min(1.0f, scale / 7 * (1 + magicFind / 100))};
}
\`\`\`

#### Night-Touched Items (\`touch(Item &item, Rng &rng)\`)
When an item is rolled at night (\`night == true\`), Magic and Rare items have a **\`1-in-25\` (\`4%\`)** chance to become **Night-Touched**:
1. Picks one existing affix roll on the item at random and **boosts its tier by \`+2\`** (\`r.tier = std::min(AFFIXES[r.affix].tiers - 1, r.tier + 2)\`), rerolling its numeric value in the higher tier!
2. Assigns one of 5 permanent **\`CURSES\`** (\`Frail: -10% max health\`, \`Leaden: -5% movement speed\`, \`Hunted: foes deal 5% more damage\`, \`Bleeding: lose 1 health/s\`, or \`Dimmed: -20% light radius\`).

---

### 4. Treasure Classes & \`ItemDrop\` Parabolic Spill (\`ItemDrop.cpp\`)

\`TREASURE[8]\` maps each \`Source\` (\`Swarm\`, \`Line\`, \`Brute\`, \`Elite\`, \`Champion\`, \`Boss\`, \`Chest\`, \`Mimic\`) to a \`TreasureClass\` with guaranteed \`floored\` drops (e.g., \`Champion\` guarantees \`1× Magic+\`, \`Boss\` guarantees \`2× Rare+\`, \`Mimic\` guarantees \`1× Magic+\`) plus \`picks\` weighted draws across \`{none, gold, potion, material, item}\` where \`itemWeight = tc.item * (roll.night ? 2 : 1)\`.
- When an enemy dies or chest opens in \`--loot\` mode, \`ItemDrop::spill\` launches each drop along a \`0.35s\` (\`FLY\`) parabolic arc \`z = std::sin(k * PI) * 14\`.
- Rare and Night-Touched items emit vertical light beams (\`ItemDrop::beams()\`) and burst 8 colored sparks on landing.

---

### 5. \`RunRules\` Mode Parameterization & Standalone \`BiomeViewer\`

- **\`RunRules\` (\`src/level/RunRules.hpp\`):** Decouples run rules from hardcoded Dawn constants so future campaign/endless modes can configure \`nightLength\`, \`dawnPull\`, \`dayLength\`, \`endsAtDawn\`, \`spawnRate\`, \`hordeScale\`, fixed \`omen\`, circular sanctuary zones \`std::vector<SafeZone> safe\` (\`safeAt(x, y)\`), and a spatial difficulty callback \`float (*threat)(double x, double y)\`.
- **Standalone \`BiomeViewer\` (\`tools/biome_viewer/main.cpp\`):** Built via \`cmake --build <dir> --target BiomeViewer\`, this tool streams a \`768×768\` world preview at 6 zoom scales (\`1, 2, 4, 8, 16, 32\` tiles/pixel), overlays all regional \`Structure\` and \`Landmark\` sites, and exports PNGs directly to disk or the OS clipboard.
`,
    mermaidCharts: [
      {
        title:
          "Diablo-Style Loot Pipeline: TreasureClass -> rollItem() -> Night-Touched Touch()",
        chart: `
flowchart TD
    classDef tc fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef roll fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef curse fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    Spill["ItemDrop::spill(level, x, y, Source, mlvl)<br/>Lookup TREASURE[Source] (itemWeight * 2 at Night)"]:::tc
    Floored["Emit tc.floored Guaranteed Drops<br/>(Champion: 1x Magic+ | Boss: 2x Rare+ | Mimic: 1x Magic+)"]:::tc
    PickBase["pickBase(ilvl, tier, rng)<br/>q = b.qlvl + TIER_LEVEL[t] <= ilvl (3x Weight if ilvl - q <= 10)"]:::roll
    RarityRoll["rollRarity(ilvl, magicFind, ownRng)<br/>diminish(mf, k) = mf * k / (mf + k)<br/>Magic: 1-2 Affixes | Rare: 3-6 Affixes (<=3 Pre, <=3 Suf)"]:::roll
    NightTouch{"night && (Magic || Rare)<br/>&& 1-in-25 Roll?"}:::curse
    Touch["touch(item, ownRng)<br/>Boost Random Affix Tier by +2 & Reroll<br/>Attach CURSES[0..4] + Emit Vertical Light Beam"]:::curse

    Spill --> Floored --> PickBase --> RarityRoll --> NightTouch
    NightTouch -- "Yes" --> Touch
`,
      },
      {
        title:
          "RunRules Campaign Parameterization & SafeZone / Threat Evaluation",
        chart: `
flowchart TD
    classDef rules fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef sys fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;

    RR["struct RunRules (src/level/RunRules.hpp)<br/>nightLength=900, dayLength=0, endsAtDawn=true<br/>spawnRate=1, hordeScale=1, loot=false, omen=ROLL_OMEN"]:::rules
    Safe["SafeZone Vector (safeAt(x, y))<br/>xd² + yd² < radius² -> Suppresses Spawns & Hostile Aggro"]:::sys
    Threat["Spatial Threat Function Pointer<br/>float (*threat)(double x, double y)<br/>Scales Monster Level (mlvl) by World Distance / Region"]:::sys

    RR --> Safe & Threat
`,
      },
    ],
    interactiveComponent: "loot",
  },
  {
    id: "paper-doll-gear-combat",
    title:
      "26. Paper-Doll Inventory (I), Reversible PlayerGear, ItemStats Combat Hooks & Loot Label Stacker",
    category: "gameplay",
    summary:
      "How the 37-slot InventoryMenu (5 paper-doll slots + 8x4 bag), reversible applyItem(±1) stat & upgrade-level accounting, (1-r)² quadratic DoT resistance, Enemy::hurt/onHit combat pipeline, and 12-pass Hud::lootLabels() AABB stacker operate.",
    sourceFiles: [
      "src/menu/InventoryMenu.cpp",
      "src/entity/PlayerGear.cpp",
      "src/item/loot/Equip.cpp",
      "src/entity/ItemStats.hpp",
      "src/entity/enemy/Enemy.cpp",
      "src/gui/Tooltip.cpp",
      "src/gui/Hud.cpp",
    ],
    content: `
### 1. The 37-Slot Paper-Doll Inventory (\`src/menu/InventoryMenu.cpp\`)

Pressing **\`I\`** (or \`Tab\` when configured) opens \`InventoryMenu\`, a full paper-doll equipment and bag interface built around \`SLOTS = GEAR + Player::BAG\` (\`5 + 32 = 37\` addressable slots):

- **Left Paper-Doll Column (\`slot 0..4\`):**
  1. \`GearWeapon (0)\`: Main-hand weapons (\`Slot::Weapon\`) that also grant or level up a passive \`UpgradeId\` (\`item.def().grants\`).
  2. \`GearOffhand (1)\`: Shields, bucklers, tomes, lanterns, and thorny totems (\`Slot::Offhand\`).
  3. \`GearArmour (2)\`: Tunics, mail, coats, and plate (\`Slot::Armour\`).
  4. \`GearCharm (3)\` & \`GearCharm2 (4)\`: Dual charm slots (\`Slot::Charm\`). \`Player::equip(bagIndex)\` automatically routes a newly equipped charm to \`GearCharm2\` whenever \`worn[GearCharm]\` is occupied and \`!worn[GearCharm2]\`:
     \`\`\`cpp
     GearSlot slot = gearSlotFor(in.def().slot);
     if (slot == GearCharm && worn[GearCharm] && !worn[GearCharm2])
         slot = GearCharm2;
     \`\`\`
- **Center Hero & Live Stat Readout:** Renders the animated hero sprite at \`2×\` scale above 5 live totals (\`Health\`, \`Armour\`, \`Power %\`, \`Speed %\`, \`Magic Find %\`), plus active \`Potion\` (\`Q\`), \`Gold\`, and \`Scrap\` counters.
- **Right \`8 × 4\` Bag Grid (\`slot 5..36\`, \`COLS = 8, ROWS = 4\`):**
  - **2D Spatial D-Pad Navigation (\`InventoryMenu::move\`):** Evaluates candidate slot centroids \`(sx, sy)\` along the input direction vector \`(dx, dy)\` and selects the slot minimizing \`along + perp * 2.5f\`, seamlessly crossing between the paper-doll column and the \`8 × 4\` bag grid.
  - **Direct Manipulation:** \`Enter / Space / Left-Click\` equips a bag item or unequips a paper-doll slot back into the bag; \`X / Right-Click\` drops the selected item onto the ground via \`ItemDrop::drop(level, x, y, out)\`.

---

### 2. Reversible \`applyItem(±1)\` & \`gearLevels[slot]\` Accounting (\`Equip.cpp\`, \`PlayerGear.cpp\`)

Equipping and unequipping items in real time without floating-point drift or permanent upgrade-level corruption requires strict **signed reversibility**:

1. **Signed Stat Application (\`applyItem(Mob &m, const Item &item, int sign)\` in \`src/item/loot/Equip.cpp\`):**
   Every implicit base stat (\`base.stat1\`, \`base.stat2\`), rolled affix (\`item.rolls[0..affixCount-1]\`), and Night-Touched curse (\`item.curse\`) is routed through \`addStat(m, stat, val * sign)\` where \`sign = +1\` in \`Player::wear()\` and \`sign = -1\` in \`Player::shed()\`:
   \`\`\`cpp
   void Player::wear(GearSlot slot, const Item &item) {
       if (!item) return;
       applyItem(*this, item, +1);
       UpgradeId id = item.def().grants;
       if (id != UpgradeId::Count)
           if (Upgrade *up = findUpgrade(id)) {
               int before = up->level;
               int target = std::min<int>(item.tier + 1, Upgrade::MAX_LEVEL);
               while (up->level < target) up->levelUp();
               gearLevels[slot] = static_cast<uint8_t>(up->level - before);
           }
   }
   \`\`\`
2. **Exact Upgrade-Level Delta Tracking (\`gearLevels[5]\`):**
   - A weapon base specifies \`UpgradeId grants\` and \`tier\` (\`0 = Simple -> Lv.1\`, \`1 = Fine -> Lv.2\`, \`2 = Elite -> Lv.3\`).
   - If the player already drafted \`Lv.1\` of that weapon during a level-up and equips a \`Tier 2 (Elite)\` weapon (target \`Lv.3\`), \`wear()\` calls \`up->levelUp()\` twice and records \`gearLevels[slot] = 2\`.
   - When the weapon is unequipped in \`Player::shed(slot)\`, \`up->level = std::max(0, up->level - gearLevels[slot])\` subtracts only the \`2\` gear-contributed levels, preserving the player's drafted \`Lv.1\` intact!
3. **Max-HP Ratio Preservation (\`recalcStats\`):**
   Whenever gear modifies \`bonus.maxHealth\` or \`bonus.healthPct\` (including the Night-Touched \`Frail\` curse \`-10% maxHealth\`), \`Player::recalcStats()\` preserves the player's fractional health ratio \`health / prevMax\` (or adds flat max-HP gains directly during \`wear()\`) and clamps \`health\` to \`[1, maxHealth]\`.

---

### 3. Quadratic $(1 - r)^2$ DoT Resistance in \`Status::apply\` (\`src/entity/Status.hpp\`)

Elemental and bleed resistances (\`Stat::FireResist\`, \`Stat::ColdResist\`, \`Stat::LightningResist\`, \`Stat::PoisonResist\`, \`Stat::BleedResist\`) are stored on \`Mob::resist[StatusKind::Count]\` and clamped to **\`75%\` (\`0.75f\`)**:

\`\`\`cpp
void apply(StatusKind kind, float duration, float power, uint32_t source = 0) {
    auto i = static_cast<size_t>(kind);
    float r = std::clamp(resist[i], 0.0f, 0.75f);
    duration *= 1 - r;
    power = std::min(power * (1 - r), cap(kind));
    // ...
}
\`\`\`

Because \`Status::apply\` multiplies **both** \`duration\` by $(1 - r)$ **and** \`power\` (damage per second / slow magnitude) by $(1 - r)$, total damage-over-time for \`Burn\`, \`Poison\`, and \`Bleed\` scales **quadratically**:

$$\\text{Total DoT} = (\\text{power} \\cdot (1 - r)) \\times (\\text{duration} \\cdot (1 - r)) = \\text{Base DoT} \\cdot (1 - r)^2$$

- At \`r = 0.50\` (\`50%\` resistance): DPS is halved and duration is halved $\\implies 25$% total DoT taken (\`75%\` effective mitigation).
- At the \`r = 0.75\` (\`75%\` resistance cap): DPS is $0.25\\times$ and duration is $0.25\\times$ $\\implies (0.25)^2 = 6.25$% total DoT taken (**\`93.75%\` effective DoT mitigation**!).

---

### 4. \`Enemy::hurt\` & \`Enemy::onHit\` Combat Pipeline (\`src/entity/enemy/Enemy.cpp\`)

When a player attack strikes an enemy, \`Enemy::hurt\` and \`Enemy::onHit\` execute a multi-stage pipeline combining terrain elevation, hero crit multipliers, \`ItemStats\` target-category bonuses, and 6 on-hit status/chain procs:

1. **Elevation Advantage (\`+15%\`):** If the target is non-flying (\`!type.floats\`) and the attacker stands on higher terrain (\`level->heightAt(player->x, player->y) > level->heightAt(x, y)\`), damage is multiplied by **\`1.15f\`** and emits a golden spark.
2. **Hero Critical Hit (\`8% + luck\`):** Rolls \`rng.chance(0.08f + player->luck)\`; on success, multiplies damage by \`hero->edge()\` (\`1.8f\` base, \`2.2f\` Corsair, \`2.5f\` Duelist).
3. **Target-Category \`ItemStats\` Scaling:**
   \`\`\`cpp
   const auto &b = player->bonus;
   float pct = (boss || def ? b.bossDamage : 0)
             + (elite || title ? b.eliteDamage : 0)
             + (level->isDawn() ? 0 : b.nightDamage);
   if (pct > 0) damage *= 1 + pct / 100;
   \`\`\`
4. **6 On-Hit Item Procs (\`Enemy::onHit\`):**
   - **\`burnChance\`:** Applies \`StatusKind::Burn\` for \`2.0s\` at \`damage * 0.20f\` DPS.
   - **\`chillChance\`:** Applies \`StatusKind::Chill\` for \`1.2s\` at \`0.30f\` (\`30%\` slow).
   - **\`poisonChance\`:** Applies \`StatusKind::Poison\` for \`3.0s\` at \`damage * 0.15f\` DPS.
   - **\`bleedChance\`:** Applies \`StatusKind::Bleed\` for \`3.0s\` at \`damage * 0.12f\` DPS (stacks additively in \`Status::apply\`, and ticks at \`1.6×\` when the target moves!).
   - **\`lifeOnHit\` (\`leech\`):** Heals the player by \`std::min(damage * leech / 100.0f, 0.5f)\` HP per hit.
   - **\`shockChance\`:** Queries the nearest living enemy within \`80 px\` (\`level->findNearestEnemy(x, y, 80, this)\`), deals \`damage * 0.5f\` lightning damage, and spawns a visual \`Arc\` bolt.
5. **Defensive Thorns & Emergency Ward (\`Player::hurt\` in \`src/entity/Player.cpp\`):**
   - **\`thorns\`:** Reflects flat \`bonus.thorns\` damage back onto the melee attacker (\`from->hurt(bonus.thorns, x, y, false, id)\`).
   - **\`ward\` (\`LowLifeWard\`):** When an incoming hit drops the player from \`>= 30%\` HP to \`< 30%\` HP and \`wardCooldown <= 0\`, triggers a \`3.0s\` \`StatusKind::Shield\` equal to \`bonus.ward\` with a **\`30.0s\`** cooldown (\`wardCooldown = 30\`).

---

### 5. Differential Item Comparison (\`Tooltip.cpp\`) & 12-Pass Loot Label Stacker (\`Hud.cpp\`)

- **Differential Stat Comparison (\`gui::compare\` in \`src/gui/Tooltip.cpp\`):**
  When hovering a ground \`ItemDrop\` or bag slot while holding an equipped item in the corresponding paper-doll slot, \`tally(item)\` sums all implicit and affix contributions across \`Stat::Damage .. Stat::Light\` into a 22-float array and prints green (\`BETTER\`) or red (\`"lose " + WORSE\`) delta rows for every stat where \`|delta| >= 0.05f\`.
- **12-Pass Vertical AABB Loot Label De-Overlap (\`Hud::lootLabels\` in \`src/gui/Hud.cpp\`):**
  When multiple items spill onto the same tile, their world-to-screen label boxes \`Tag { drop, name, x, y, w, h }\` would overlap. \`Hud::lootLabels()\` sorts visible tags bottom-to-top (\`a.y > b.y\`) and runs up to **12 iterative vertical sweep passes**, pushing any overlapping upper tag above the lower tag by \`1 * u\` pixel (\`t.y = hit->y - t.h - u\`) until reaching a fixed point!
`,
    mermaidCharts: [
      {
        title:
          "Reversible PlayerGear::wear / shed & (1-r)² Status Resistance Pipeline",
        chart: `
flowchart TD
    classDef gear fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef stat fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef combat fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;

    Equip["Player::equip(bagIndex)<br/>Charm auto-routes to GearCharm2 if GearCharm occupied"]:::gear
    Shed["Player::shed(slot)<br/>applyItem(*this, oldItem, -1)<br/>up->level -= gearLevels[slot]"]:::gear
    Wear["Player::wear(slot, newItem)<br/>applyItem(*this, newItem, +1)<br/>Level grants up to min(tier + 1, 3) -> store gearLevels[slot]"]:::gear
    Recalc["Player::recalcStats()<br/>Preserve health / prevMax ratio<br/>Clamp resist[0..6] to 75% (0.75f)"]:::stat
    DotResist["Status::apply(kind, duration, power)<br/>duration *= (1 - r) AND power *= (1 - r)<br/>Quadratic Total DoT = Base * (1 - r)² (6.25% at 75% cap!)"]:::combat

    Equip --> Shed --> Wear --> Recalc --> DotResist
`,
      },
      {
        title: "Enemy::hurt & Enemy::onHit Multi-Stage Combat & Proc Pipeline",
        chart: `
flowchart TD
    classDef hit fill:#181524,stroke:#f43f5e,stroke-width:2px,color:#f8fafc;
    classDef proc fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    BaseHit["Enemy::hurt(damage, fromX, fromY, knockback, by)<br/>1. High Ground (!floats && h_player > h_enemy): damage *= 1.15f<br/>2. Crit Roll (0.08 + luck): damage *= hero->edge()"]:::hit
    CatMult["Target-Category ItemStats Multiplier<br/>damage *= 1 + (bossDamage + eliteDamage + nightDamage) / 100"]:::hit
    OnHit["Enemy::onHit(player, damage)<br/>Rolls 6 Independent ItemStats Procs:"]:::proc
    Procs["• Burn: 2.0s @ 20% dmg/s<br/>• Chill: 1.2s @ 30% slow<br/>• Poison: 3.0s @ 15% dmg/s<br/>• Bleed: 3.0s @ 12% dmg/s (Additive + 1.6x moving)<br/>• Leech: heal min(dmg * leech%, 0.5 HP)<br/>• Shock: 80px Arc chain for 50% dmg"]:::proc

    BaseHit --> CatMult --> OnHit --> Procs
`,
      },
    ],
    interactiveComponent: "gearevents",
  },
  {
    id: "biome-events-chart-hud",
    title:
      "27. 26 Regional Biome Events, Paged RLE Fog-of-War Chart & HUD Ray-Clipped Edge Pointers",
    category: "world",
    summary:
      "Deterministic stateless Murmur3 scheduling for 26 regional BiomeEvents, sparse 32x32 paged fog-of-war Chart with horizontal scanline RLE coalescing, and asymmetric viewport ray-clipping in Hud::edge().",
    sourceFiles: [
      "src/level/BiomeEvents.hpp",
      "src/level/BiomeEvents.cpp",
      "src/level/Chart.hpp",
      "src/level/Chart.cpp",
      "src/gui/Hud.cpp",
    ],
    content: `
### 1. Deterministic Stateless \`BiomeEvents\` across All 26 Biomes (\`src/level/BiomeEvents.cpp\`)

Every one of the 26 biomes (\`BIOME_COUNT = 26\`) has a signature periodic environmental event defined in \`EVENTS[BIOME_COUNT]\` (\`src/level/BiomeEvents.cpp\`). Rather than storing active event timers per chunk on the heap, \`BiomeEvents::schedule(seed, biome, epoch, rx, ry)\` computes each \`20 × 20\`-tile region's event window **purely as a stateless function of \`(seed, biome, epoch, rx, ry)\`** via a 32-bit Murmur3-style avalanche mixer \`mix(x)\`:

\`\`\`cpp
uint32_t mix(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7FEB352Du;
    x ^= x >> 15;
    x *= 0x846CA68Bu;
    x ^= x >> 16;
    return x;
}
\`\`\`

#### Regional Event Cadence, Warning Phase & Sanctuary Suppression
- **Region Grid (\`20 × 20\` tiles = \`320 × 320 px\`):** The player's current region is \`rx = floor(player.x / 16) / 20\`, \`ry = floor(player.y / 16) / 20\`.
- **Epoch Cadence (\`def.every\`):**
  - **Core Biomes (\`0..15\`, \`Grassland\` through \`Void\`):** \`every = 48.0s\` per epoch.
  - **Sub-Biomes (\`16..25\`, \`Oasis\` through \`Caldera\`):** \`every = 28.0s\` per epoch (faster micro-biome cadence).
- **Deterministic Window within Epoch:**
  - \`begins = epoch * def.every + 8.0f + float(h % uint32_t(def.every - 17.0f))\`
  - \`ends = begins + 5.0f\` (\`5.0s\` active duration)
  - **\`3.0s\` Telegraph Warning (\`t >= begins - 3 && t < begins\`):** Draws a pulsing telegraph ring and displays a directional banner:
    - Beneficial boons (\`good = true\`, e.g. \`FAIRY RING\`, \`OASIS BLOOM\`, \`SPRING THAW\`, \`GOLD RUSH\`, \`STARFALL\`): **\`"<NAME> - STEP INSIDE"\`**
    - Environmental hazards (\`good = false\`, e.g. \`SANDSTORM\`, \`BLIZZARD\`, \`LAVA BOMB\`, \`SPORE CLOUD\`, \`VOID RIFT\`, \`LOCUST SWARM\`): **\`"<NAME> - MOVE TO SAFETY"\`**
- **Shrine Sanctuary Suppression:** Standing within **2 tiles** of any \`Tile::Shrine\` sets \`sanctuary = true\`, immediately suppressing regional biome events so shrine kindling and prayers are never interrupted by unavoidable environmental hazards.

---

### 2. Sparse Paged Fog-of-War \`Chart\` & Scanline RLE Coalescing (\`src/level/Chart.hpp\`, \`src/level/Chart.cpp\`)

Because the world is infinite (\`int32_t\` tile coordinates), the exploration map (\`M\` / \`Tab\` overlay and top-right minimap) cannot allocate a dense 2D array. \`Chart\` implements a **sparse 2-level paged grid** with a 1-entry MRU page cache and **horizontal scanline Run-Length Encoding (RLE)** during rendering:

1. **Spatial Granularity & Memory Layout:**
   - **Chart Cell (\`CELL = 4\` tiles = \`64 × 64 px\`):** Each byte in a page represents a \`4 × 4\`-tile square.
   - **Page (\`PAGE = 32\` cells = \`128 × 128\` tiles = \`1024 B\`):** \`std::unordered_map<uint64_t, std::unique_ptr<Page>> pages\` maps a 64-bit \`key(px, py)\` to a 1 KB \`std::array<uint8_t, 1024>\`.
   - **1-Entry MRU Cache (\`lastKey\`, \`lastPage\`):** Consecutive \`slot(cx, cy, create)\` lookups within the same \`32 × 32\`-cell page bypass the hash table in $O(1)$ time.
   - **Bitwise Cell Encoding:**
     - \`0x00\`: Unexplored fog-of-war.
     - \`bits 0..6\`: \`(BiomeId + 1)\` (\`1..26\`), indexing \`BIOME_TINTS[26]\`.
     - \`bit 7 (\`NOW = 0x80\`)\`: Currently inside the player's live vision radius (rendered at full brightness \`alpha = 235\` vs. \`175\` for previously explored memory).
2. **Horizontal Scanline RLE Coalescing (\`Chart::draw\`):**
   Rather than submitting $N \\times N$ individual quad draw calls for the minimap or full-screen map, \`Chart::draw\` scans each row \`cy\` and packs \`key = cellByte * 2 + isBorderCell\`. Consecutive cells along \`cx\` with identical \`key\` are merged into a single \`s.rect(x0 + (from - cx0) * step, ry, (cx - from) * step, step, col)\` call—cutting GPU vertex submissions by **80%–92%**!
3. **Binary Persistence (\`chart-<code>.bin\`):**
   \`Chart::save\` and \`Chart::load\` serialize explored pages with \`DISTANCE_MAGIC = 0x3543414Du\` (\`"MAC5"\`), stripping the transient \`NOW (0x80)\` bit on write (\`b & ~NOW\`) so reloaded worlds restore historical fog-of-war cleanly.

---

### 3. Asymmetric Viewport Ray-Clipping in \`Hud::edge\` (\`src/gui/Hud.cpp\`)

Offscreen objectives (nearest unlit \`Shrine\`, active \`Boss\`, and distant \`Landmark\` pins) are projected onto the screen perimeter by \`Hud::edge(Sprites &s, double wx, double wy, Color col, const char *tag)\`:

\`\`\`cpp
void Hud::edge(Sprites &s, double wx, double wy, Color col, const char *tag) const {
    float xd = static_cast<float>(wx - viewX) * k;
    float yd = static_cast<float>(wy - viewY) * k;
    float xh = vw * k * 0.5f - 18 * u;
    float yh = vh * k * 0.5f - (yd < 0 ? 84 : bossIds.empty() ? 18 : 46) * u;
    if (std::abs(xd) <= xh && std::abs(yd) <= yh) return;
    float fit = std::min(1.0f, std::min(xh / std::max(1.0f, std::abs(xd)),
                                        yh / std::max(1.0f, std::abs(yd))));
    float px = vw * k * 0.5f + xd * fit;
    float py = vh * k * 0.5f + yd * fit;
    s.rect(px - 5 * u, py - 5 * u, 10 * u, 10 * u, col);
}
\`\`\`

- **Why \`yh\` Is Asymmetric:**
  - **Top Edge (\`yd < 0\`):** Insets by \`84 * u\` so edge pointers never collide with the top night-progress bar, omen banner, or minimap header.
  - **Bottom Edge (\`yd >= 0\`):** Dynamically insets by \`46 * u\` when a boss health bar is active (\`!bossIds.empty()\`), or \`18 * u\` otherwise.
- **Intersection Factor \`fit\`:** Computing \`fit = min(1.0f, xh / |xd|, yh / |yd|)\` projects any 2D ray \`(xd, yd)\` directly onto the exact perimeter of the safe HUD rectangle in branchless constant time, followed by a 3-layer concentric diamond marker and inward-offset distance label.
`,
    mermaidCharts: [
      {
        title:
          "Stateless BiomeEvents::schedule() Murmur3 Hash & Sanctuary Pipeline",
        chart: `
flowchart TD
    classDef hash fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef phase fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef fx fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;

    Region["Player Tile (tx, ty) -> Region (rx = tx/20, ry = ty/20)<br/>Lookup Dominant Biome & EVENTS[biome] (every = 48s or 28s)"]:::hash
    Sanctuary{"Within 2 Tiles of<br/>Tile::Shrine?"}:::hash
    Suppress["sanctuary = true<br/>Suppress Regional Biome Event"]:::hash
    Mix["BiomeEvents::schedule(seed, biome, epoch, rx, ry)<br/>32-Bit Murmur3 mix(0x7FEB352D, 0x846CA68B)<br/>begins = epoch*every + 8 + (h % (every - 17)), ends = begins + 5"]:::phase
    Warn["Warning Phase (begins - 3s .. begins)<br/>Pulsing Ring + 'STEP INSIDE' (Boon) or 'MOVE TO SAFETY' (Hazard)"]:::fx
    Active["Active Phase (begins .. ends)<br/>Apply Biome Effect (Heal/Haste/Gold or DoT/Chill/Wind/Suck)"]:::fx

    Region --> Sanctuary
    Sanctuary -- "Yes" --> Suppress
    Sanctuary -- "No" --> Mix --> Warn --> Active
`,
      },
      {
        title:
          "Sparse Paged Fog-of-War Chart, Scanline RLE Coalescer & Hud::edge Ray Clipper",
        chart: `
flowchart TD
    classDef chart fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef rle fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef hud fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;

    Reveal["Chart::reveal(wx, wy, tileRadius, biomeAt)<br/>CELL = 4 Tiles (64px) | PAGE = 32x32 Cells (1 KB)<br/>1-Entry MRU Cache (lastKey, lastPage)<br/>Cell Byte = NOW (0x80) | (BiomeId + 1)"]:::chart
    RLE["Chart::draw() Scanline RLE Coalescer<br/>key = cellByte * 2 + isBorderCell<br/>Merge consecutive matching [from .. cx) into 1 s.rect()"]:::rle
    Edge["Hud::edge(wx, wy, col, tag)<br/>xh = vw*k*0.5 - 18*u<br/>yh = vh*k*0.5 - (yd < 0 ? 84 : boss ? 46 : 18)*u<br/>fit = min(1, xh/|xd|, yh/|yd|)"]:::hud

    Reveal --> RLE --> Edge
`,
      },
    ],
    interactiveComponent: "gearevents",
  },
  {
    id: "tutorial-loot-affixes-allies",
    title:
      "28. Tutorial 9: Contributing Diablo Item Bases, 5-Tier Affixes, Summoned Allies & Weapon Forms",
    category: "contribute",
    summary:
      "Step-by-step C++20 guide to adding Diablo-style gear bases, reversible 5-tier item affixes in Affix.cpp & Equip.cpp, autonomous summoned Ally companions, and custom FormBehaviors.",
    sourceFiles: [
      "src/item/loot/ItemBase.cpp",
      "src/item/loot/Affix.hpp",
      "src/item/loot/Affix.cpp",
      "src/item/loot/Equip.cpp",
      "src/entity/Ally.hpp",
      "src/entity/Ally.cpp",
      "src/item/weapon/form/Summon.cpp",
      "src/item/weapon/form/FormBehavior.cpp",
    ],
    content: `
### Pick one item-system change

This chapter contains four independent tasks. A **gear base** is the item before random bonuses. An **affix** is one of those bonuses. An **ally** is a summoned companion. A **form behavior** controls how a weapon attack moves or acts. Choose one task, follow its files in order, and run the relevant test before moving to another.

### 1. Add a gear base (\`src/item/loot/ItemBase.cpp\`)

\`build()\` makes weapon bases from the weapons registered in \`Upgrade::all()\`. If you added a recipe to \`RECIPES[]\`, check whether it already appears as a droppable base before adding more item data. For an offhand, armour piece, or charm, add a row to \`GEAR[]\` in \`ItemBase.cpp\`:

\`\`\`cpp
const ItemBase GEAR[] = {
    {"Buckler", slot::Offhand, Atlas::RoundShield, 1, 10, 20, Stat::Armor, 1.0f, nullptr},
    {"Kite Shield", slot::Offhand, Atlas::RoundShield, 6, 8, 55, Stat::Armor, 2.0f, nullptr},
    {"Astral Aegis", slot::Offhand, Atlas::AegisShield, 14, 5, 135, Stat::ResistArcane, 18.0f, nullptr},
    {"Starlight Signet", slot::Charm, Atlas::SignetRing, 10, 6, 95, Stat::CritChance, 4.0f, nullptr},
};
\`\`\`

- **Read the \`ItemBase\` fields in order:**
  1. \`name\`: Display name shown as the base noun between prefix and suffix (e.g., \`"Celestial Astral Aegis of the Titan"\`).
  2. \`slots\`: Bitmask from \`namespace slot\` (\`slot::Weapon = 1\`, \`slot::Offhand = 2\`, \`slot::Armour = 4\`, \`slot::Charm = 8\`).
  3. \`icon\`: \`16 × 16\` \`Sprite\` coordinate from \`src/Atlas.hpp\`.
  4. \`qlvl\`: Minimum monster/chest item level (\`ilvl >= qlvl\`) required before \`rollBase(rng, ilvl, mask)\` includes this base in the weighted pool.
  5. \`weight\` & \`value\`: Relative drop weight and base gold value before rarity multipliers.
  6. \`implicit\` & \`amount\`: Built-in implicit \`Stat\` and magnitude applied before any rolled affixes.

---

### 2. Add an affix that can be unequipped (\`Affix.hpp\`, \`Affix.cpp\`, \`Equip.cpp\`)

An affix changes a stat while an item is equipped. Adding one touches three files. The key check is simple: equipping applies a positive change with \`applyItem(m, item, +1.0f)\`; unequipping applies the same change with \`-1.0f\`. After both operations, the original stat should be restored.

#### Step 2A: Append to \`enum class Stat\` (\`src/item/loot/Affix.hpp\`)

Always append new enum constants at the end of \`enum class Stat\` so existing save files and item tests remain aligned:

\`\`\`cpp
enum class Stat : uint8_t {
    None,
    FlatDamage,
    PercentDamage,
    AttackSpeed,
    CritChance,
    CritMultiplier,
    Area,
    Projectiles,
    Pierce,
    CooldownReduction,
    SkillLevels,
    MaxLife,
    LifeRegen,
    LifeOnHit,
    Armor,
    Thorns,
    Dodge,
    ResistFire,
    ResistCold,
    ResistLightning,
    ResistPoison,
    ResistArcane,
    ResistAll,
    MoveSpeed,
    PickupRadius,
    MagicFind,
    GoldFind,
    XpGain,
    BurnChance,
    ChillChance,
    PoisonChance,
    BleedChance,
    ShockChance,
    BossDamage,
    EliteDamage,
    NightDamage,
    Light,
    NovaMastery,
};
\`\`\`

#### Step 2B: Add the 5-Tier \`AffixDef\` & Tooltip Formatter (\`src/item/loot/Affix.cpp\`)

Add a row to \`const AffixDef AFFIXES[]\` in \`src/item/loot/Affix.cpp\` and format its tooltip string in \`describe(Stat stat, float value)\`:

\`\`\`cpp
{
    "NovaMastery",
    true,
    slot::Weapon | slot::AreaWeapon | slot::Charm,
    Stat::NovaMastery,
    0xFFF,
    5,
    {
        {"Resonant", 1, 6.0f, 10.0f},
        {"Harmonic", 5, 11.0f, 16.0f},
        {"Astral", 10, 17.0f, 23.0f},
        {"Celestial", 15, 24.0f, 31.0f},
        {"Supernova", 20, 32.0f, 40.0f},
    }
},
\`\`\`

And inside \`describe(Stat stat, float value)\` (\`src/item/loot/Affix.cpp\`):

\`\`\`cpp
case Stat::NovaMastery:
    std::snprintf(buf, sizeof(buf), "+%d%% Area & Arcane Mastery", iv);
    break;
\`\`\`

#### Step 2C: Wire the Reversible Stat Delta in \`apply()\` (\`src/item/loot/Equip.cpp\`)

Inside \`apply(Mob &m, Stat stat, float v)\` in \`src/item/loot/Equip.cpp\`, apply \`v\` purely additively so \`+v\` on \`Player::wear\` and \`-v\` on \`Player::shed\` cancel out with zero drift:

\`\`\`cpp
case Stat::NovaMastery:
    p.stats().area += v * 0.005f;
    p.stats().might += v * 0.005f;
    break;
\`\`\`

---

### 3. Add a summoned ally (\`Ally.hpp\`, \`Ally.cpp\`, \`Recipe.cpp\`)

An ally is a \`Mob\` managed by \`src/entity/Ally.cpp\`. It can attack directly when \`kit == nullptr\`, or use a recipe weapon when \`kit\` is set. For example, the Clockwork Drone uses an Arcane Staff. Check which path your new ally needs before filling out its definition.

#### Step 3A: Append to \`enum class AllyKind\` (\`src/entity/Ally.hpp\`)

Append your new companion kind immediately before \`Count\`:

\`\`\`cpp
enum class AllyKind : uint8_t {
    Skeleton,
    Wolf,
    Wisp,
    Turret,
    Totem,
    Golem,
    Decoy,
    Fairy,
    Crow,
    Imp,
    Beetle,
    Banner,
    Ancestor,
    Mirror,
    Bear,
    Hawk,
    Spiderling,
    BoneMage,
    EmberHound,
    FrostSprite,
    Gargoyle,
    VineTendril,
    Drone,
    Valkyrie,
    StarSentinel,
    Count
};
\`\`\`

#### Step 3B: Add the \`AllyDef\` Row to \`ALLIES[]\` (\`src/entity/Ally.cpp\`)

\`src/entity/Ally.cpp\` enforces \`static_assert(std::size(ALLIES) == static_cast<size_t>(AllyKind::Count))\`. Add your companion definition at the matching index:

\`\`\`cpp
const AllyDef ALLIES[] = {
    {"Star Sentinel", "Astral Beacon", EnemyKind::Wisp, 26.0f, 82.0f, 0.75f,
     70.0f, 18.0f, 1.05f, true, false, Color::rgb(0x88, 0xE0, 0xFF), "Arcane Staff"},
};
\`\`\`

- **How \`SummonForm\` Auto-Binds via \`AllyDef::recipe\`:**
  When \`SummonForm::fire(const Context &c)\` (\`src/item/weapon/form/Summon.cpp\`) executes, it calls \`allyFor(c.r.name)\`, which scans \`ALLIES[]\` for \`a.recipe == c.r.name\`. By setting \`recipe = "Astral Beacon"\` in \`ALLIES[]\` and adding an \`"Astral Beacon"\` row with \`Form::Summon\` to \`RECIPES[]\` (\`src/item/weapon/Recipe.cpp\`), the weapon automatically spawns up to \`cap = c.count + 1 + (c.evolved ? 2 : 0)\` active \`Star Sentinel\` companions!

---

### 4. Add a weapon form when existing forms do not fit (\`src/item/weapon/form/\`, \`FormRegistry.cpp\`)

If a weapon needs a brand-new geometric attack pattern beyond the 16 built-in \`Form\` types:
1. Append the new identifier to \`enum class Form : uint8_t\` in \`src/item/weapon/Recipe.hpp\`.
2. Create \`src/item/weapon/form/MyForm.cpp\` implementing \`class MyForm : public FormBehavior\` with \`void fire(const Context &c) const override\`.
3. Use \`c.aimDir(ox, oy)\` to resolve target direction, \`c.payload(damageScale)\` to snapshot the \`HitPayload\` (including evolved status effects and hero luck/edge), and \`landHit(payload, enemy, fromX, fromY, by)\` (\`src/item/weapon/form/FormCommon.hpp\`) to apply damage, status procs, and floating combat numbers.
4. Register the singleton in \`formFor(Form f)\` inside \`src/item/weapon/form/FormBehavior.cpp\`.
`,
    mermaidCharts: [
      {
        title:
          "End-to-End Pipeline for Contributing a Reversible 5-Tier Loot Affix",
        chart: `
flowchart LR
    classDef step fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef code fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef verify fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;

    S1["1. Affix.hpp<br/>Append Stat::NovaMastery<br/>to enum class Stat"]:::step
    S2["2. Affix.cpp<br/>Add 5-Tier AffixDef to AFFIXES[]<br/>+ Format in describe(Stat, float)"]:::code
    S3["3. Equip.cpp<br/>Apply reversible +v / -v delta<br/>in apply(Mob &m, Stat, float v)"]:::code
    S4["4. Verify in Sandbox & Tests<br/>MellanganApp.exe --dev --give 16 --loot<br/>MellanganApp.exe --test"]:::verify

    S1 --> S2 --> S3 --> S4
`,
      },
      {
        title: "Summoned Ally Companion & Form::Summon Auto-Binding Pipeline",
        chart: `
flowchart TD
    classDef ally fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef weapon fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef runtime fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;

    Kind["1. Ally.hpp & Ally.cpp<br/>Append AllyKind::StarSentinel before Count<br/>Add AllyDef row (recipe = 'Astral Beacon', kit = 'Arcane Staff')"]:::ally
    Recipe["2. Recipe.cpp<br/>Add 'Astral Beacon' row with Form::Summon<br/>SummonForm::fire() matches allyFor(c.r.name)"]:::weapon
    Spawn["3. Runtime Execution (Ally::onAdded & Ally::tick)<br/>Grants kit weapon ('Arcane Staff'), orbits Player,<br/>leashes at 150px, and fires kit or melee bites"]:::runtime

    Kind --> Recipe --> Spawn
`,
      },
    ],
    interactiveComponent: "contribute",
  },
  {
    id: "tutorial-traits-events-bounties",
    title:
      "29. Tutorial 10: Contributing Elite/Champion Traits, Regional Biome Events & Bounties",
    category: "contribute",
    summary:
      "Step-by-step C++20 guide to adding Elite/Champion monster Traits across 5 combat hooks, scheduling regional BiomeEvents, adding Bounty contracts, and writing deterministic Field unit tests.",
    sourceFiles: [
      "src/entity/Trait.hpp",
      "src/entity/Trait.cpp",
      "src/level/BiomeEvents.hpp",
      "src/level/BiomeEvents.cpp",
      "src/level/Bounty.hpp",
      "src/level/Bounty.cpp",
      "src/test/AllyTest.cpp",
    ],
    content: `
### Choose a trait, bounty, or test

These are three separate contributions. A **trait** changes an elite monster's behavior. A **bounty** gives the player a contract objective. A **headless test** checks a rule without opening the game window. Start with the part that matches your change; you do not need to implement all three.

### 1. Add an elite or champion trait (\`src/entity/Trait.hpp\`, \`src/entity/Trait.cpp\`)

Elite monsters can have one or two traits; champions can have two or three. \`Traits::bits\` stores which traits a monster has. Each trait uses one bit of that 32-bit number. Add a new trait in three steps:

#### Step 1A: Append to \`enum class Trait\` (\`src/entity/Trait.hpp\`)

Append the new trait identifier before \`Count\` (up to 31 traits fit in \`uint32_t bits\`):

\`\`\`cpp
enum class Trait : uint8_t {
    Hasted,
    Armored,
    Regenerating,
    Vampiric,
    Thorns,
    Molten,
    Frozen,
    Plagued,
    Stormcaller,
    Splitting,
    Shielded,
    Berserk,
    Blinker,
    Avenger,
    Executioner,
    Juggernaut,
    Dampening,
    Vortex,
    Hexer,
    Undying,
    Mirrored,
    Count
};
\`\`\`

#### Step 1B: Register Name & Aura Tint in \`TRAITS[]\` (\`src/entity/Trait.cpp\`)

Add the display name and pixel aura color to \`const TraitInfo TRAITS[int(Trait::Count)]\` in \`src/entity/Trait.cpp\`:

\`\`\`cpp
const TraitInfo TRAITS[static_cast<int>(Trait::Count)] = {
    {"Hasted", Color::rgb(0xFF, 0xE0, 0x55)},
    {"Armored", Color::rgb(0x9A, 0xA8, 0xB8)},
    {"Mirrored", Color::rgb(0x90, 0xF0, 0xFF)},
};
\`\`\`

#### Step 1C: Hook into the 5 \`Traits\` Lifecycle Methods (\`src/entity/Trait.cpp\`)

Every \`Mob\` automatically invokes \`traits\` at five points in its lifecycle:
1. **\`Traits::incoming(Mob &self, float damage)\`:** Modifies incoming damage before HP subtraction (e.g., \`Armored\` scales by \`0.6f\`, \`Dampening\` scales by \`0.45f\` when attacker is \`> 56 px\` away, \`Shielded\` absorbs one hit while \`cooldown <= 0\`).
2. **\`Traits::landed(Mob &self, float dealt)\`:** Fires when the monster lands a hit on the player (e.g., \`Vampiric\` heals, \`Frozen\` chills, \`Plagued\` poisons, \`Hexer\` applies \`applyWeaken(3.0f)\`).
3. **\`Traits::tick(Mob &self)\`:** Per-frame behavior (e.g., \`Regenerating\`, \`Stormcaller\` lightning strikes, \`Blinker\` teleports, \`Vortex\` player pull).
4. **\`Traits::died(Mob &self, float damage)\`:** Death triggers (e.g., \`Undying\` revives once at \`35% HP\`, \`Molten\` explodes, \`Splitting\` spawns 2 mini-clones, \`Avenger\` buffs nearby allies).
5. **\`Traits::render(const Mob &self, Sprites &s, double bob)\`:** Renders ground rings or floating badges under the monster.

\`\`\`cpp
float Traits::incoming(Mob &self, float damage) {
    if (has(Trait::Mirrored) && self.level) {
        if (auto *p = self.level->player()) {
            double dx = p->x - self.x;
            double dy = p->y - self.y;
            if (dx * dx + dy * dy > 64.0 * 64.0) {
                p->hurt(1, self.x, self.y, 2.0);
                return damage * 0.70f;
            }
        }
    }
    return damage;
}
\`\`\`

---

### 2. Add a bounty objective (\`src/level/Bounty.cpp\`)

Shrine and night contract bounties are implemented in \`src/level/Bounty.cpp\`. Each bounty tracks \`kind\`, \`arg\`, \`goal\`, \`baseline\`, and \`reward\` (\`0 = Chest\`, \`1 = Gold\`, \`2 = Shrine Boon\`):

\`\`\`cpp
enum Kind : uint8_t {
    SlayCount,
    SlayFoe,
    SurviveSec,
    ReachCombo,
    GatherGold,
    StayMoving,
    HoldGround,
    SlayElites,
    KINDS
};
\`\`\`

To add a new bounty kind (such as \`SlayElites\`):
1. Append \`SlayElites\` before \`KINDS\` in \`src/level/Bounty.cpp\`.
2. Initialize \`b.goal\` and \`b.baseline\` inside \`Bounty::roll(Random &rng, const Level &level, int night)\`:

\`\`\`cpp
case SlayElites:
    b.goal = 3 + night;
    b.baseline = level.eliteKills();
    break;
\`\`\`

3. Format the HUD objective banner in \`Bounty::text()\` and return live progress in \`Bounty::progress(const Level &level)\`:

\`\`\`cpp
case SlayElites:
    return level.eliteKills() - baseline;
\`\`\`

---

### 3. Write a repeatable test without a game window (\`src/test/AllyTest.cpp\`, \`src/test/LootTest.cpp\`)

Every contribution should include a fast, deterministic unit test in \`src/test/\` using the headless \`Field\` fixture (\`src/test/TestFixtures.hpp\`). \`Field\` initializes a complete \`Level\` and \`Player\` in memory without creating a Vulkan window or audio device, executing 180 simulation ticks (3.0 seconds of game time) in under **2 milliseconds**:

\`\`\`cpp
void testStarSentinelCompanion() {
    Field f;
    auto *ally = f.level.spawnAlly(AllyKind::StarSentinel, f.player->x + 16.0, f.player->y);
    assert(ally != nullptr);
    auto *foe = f.spawn(EnemyKind::Zombie, f.player->x + 48.0, f.player->y);
    int before = foe->hp;
    f.step(180);
    assert(foe->removed || foe->hp < before);
}
\`\`\`

Run the entire assertion suite in Debug mode before committing:

\`\`\`bash
cmake --build build --config Debug --parallel
./build/bin/Debug/MellanganApp.exe --test
\`\`\`
`,
    mermaidCharts: [
      {
        title:
          "5 Lifecycle Hooks of struct Traits on Elite & Champion Monsters",
        chart: `
flowchart LR
    classDef hook fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef fn fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Spawn["Traits::roll(rng, count)<br/>Assigns 1..3 bitmask traits<br/>Sets tint & HP/Speed scale"]:::hook
    Tick["Traits::tick(self)<br/>Regen, Stormcaller bolt,<br/>Blinker warp, Vortex pull"]:::fn
    In["Traits::incoming(self, dmg)<br/>Shielded absorb, Armored 0.6x,<br/>Dampening 0.45x, Berserk"]:::fn
    Land["Traits::landed(self, dealt)<br/>Vampiric heal, Frozen chill,<br/>Plagued poison, Hexer weaken"]:::fn
    Died["Traits::died(self, dmg)<br/>Undying 35% revive, Molten blast,<br/>Splitting clones, Avenger buff"]:::fn

    Spawn --> Tick --> In --> Land --> Died
`,
      },
      {
        title: "Headless Field Unit Test & Debug Verification Pipeline",
        chart: `
flowchart LR
    classDef test fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gate fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    F1["Construct Headless Field f<br/>(Zero GPU/Audio Init)"]:::test
    F2["Configure Scenario<br/>f.player->grant(...) / f.spawn(...)<br/>f.level.spawnAlly(...)"]:::test
    F3["Step Deterministic Simulation<br/>f.step(180) (60 Hz fixed dt)"]:::test
    F4["Verify C++ assert() Invariants<br/>./build/bin/Debug/MellanganApp.exe --test"]:::gate

    F1 --> F2 --> F3 --> F4
`,
      },
    ],
    interactiveComponent: "contribute",
  },
  {
    id: "ouroboros-deep-dive",
    title:
      "30. How Ouroboros Really Works: The Council of Four Serpents, SWAR Parity, De Bruijn Spirals & XOR-Linked Augury",
    category: "core",
    summary:
      "Complete mathematical and architectural breakdown of src/other/Ouroboros.hpp: compile-time consteval unanimity proofs, 4 CRTP serpents (Mirror, Gray, Bruijn, Rebecca), infix operator->*, and self-traversing XOR-linked list Augury.",
    sourceFiles: ["src/other/Ouroboros.hpp", "src/main.cpp"],
    content: `
### 1. The Mythos, Origin & Purpose of Ouroboros (\`src/other/Ouroboros.hpp\`, \`src/main.cpp\`)

In classical antiquity and alchemical philosophy, the **Ouroboros** represents the serpent consuming its own tail, a primordial symbol of eternal cyclical return, self-referential systems, and closed feedback loops.

Within the Mellangan codebase, \`namespace ouroboros\` (\`src/other/Ouroboros.hpp\`) elevates the simplest computational question (**"Is an integer n even or odd (n % 2 == 0)?"**) into a tour-de-force of modern C++20 metaprogramming, SIMD-within-a-register (SWAR) bit manipulations, discrete mathematics, and self-traversing XOR pointer arithmetic.

#### Why Ouroboros Exists: The Engine's Hardware & Compiler Canary

Rather than being a whimsical Easter egg, Ouroboros serves a critical operational role in Mellangan's engine integrity. When launching the game with the \`--dev\` developer sandbox flag, \`src/main.cpp\` invokes \`consultOuroboros()\`:

\`\`\`cpp
static void consultOuroboros() {
    constexpr ouroboros::Ouroboros council;
    int n = int(SDL_GetTicks() % 1000);
    ouroboros::Augury augury;
    spdlog::info("Ouroboros: {} is {}, {} of 4 serpents agree, the augury {}", n,
                 (council->*n) ? "even" : "odd", council.agreement(n),
                 augury.even(n) == (council->*n) ? "concurs" : "dissents");
}
\`\`\`

1. **Compile-Time Optimization Verification:** Mellangan compiles with aggressive optimization (\`-O3\` / \`/O2\`) and heavily utilizes modern C++20 features: \`consteval\`, \`std::bit_cast\`, \`std::rotr\`, and \`std::popcount\`. The entire council must pass an exhaustive compile-time test suite (\`static_assert(unanimous(), "the serpents disagree");\`). If an optimizing compiler introduces an instruction-scheduling bug, mishandles sign extension, or breaks constant folding, compilation halts immediately.
2. **Runtime ABI & Pointer Provenance Test:** The dynamic \`Augury\` class instantiates a self-referential XOR-linked list of type-erased function-pointer thunks on the stack. \`consultOuroboros()\` verifies at runtime that pointer-to-integer casts (\`reinterpret_cast<uintptr_t>\`) and XOR-pointer recovery work without strict-aliasing violations or link-time optimization (LTO) miscompilations.

---

### 2. Zero-Vtable Static Polymorphism: \`template <class Self> struct Charlotte\`

Each of the four serpents is modeled as an empty, stateless C++ struct inheriting from a common CRTP (Curiously Recurring Template Pattern) base named \`Charlotte\`:

\`\`\`cpp
template <class Self> struct Charlotte {
    constexpr bool operator()(uint32_t n) const {
        return static_cast<const Self &>(*this).bite(n);
    }
};
\`\`\`

- **Zero Memory Overhead:** Because \`Charlotte\` defines no member variables and no virtual function table (\`vtable\`), \`sizeof(Charlotte<Self>) == 1\` (standard C++ minimum for empty classes).
- **Zero-Cost Abstraction:** Calling \`Mirror{}(u)\` expands into an inlined, direct static dispatch to \`Mirror::bite(u)\` without any indirect pointer dereferences or dynamic call indirection.
- **The Bite Invariant:** Every serpent struct must implement \`constexpr bool bite(uint32_t n) const\`, returning \`true\` if \`n\` is even ($n \\pmod 2 = 0$) and \`false\` if \`n\` is odd ($n \\pmod 2 = 1$).

---

### 3. Serpent 1: \`Mirror\`: 32-Bit SWAR Bit Reversal

\`Mirror\` determines integer parity by reversing all 32 bits of the integer end-to-end using a 5-stage SIMD-Within-A-Register (SWAR) divide-and-conquer algorithm:

\`\`\`cpp
struct Mirror : Charlotte<Mirror> {
    static constexpr uint32_t flip(uint32_t v) {
        v = (v >> 1 & 0x55555555u) | (v & 0x55555555u) << 1;
        v = (v >> 2 & 0x33333333u) | (v & 0x33333333u) << 2;
        v = (v >> 4 & 0x0F0F0F0Fu) | (v & 0x0F0F0F0Fu) << 4;
        v = (v >> 8 & 0x00FF00FFu) | (v & 0x00FF00FFu) << 8;
        return v >> 16 | v << 16;
    }
    constexpr bool bite(uint32_t n) const { return !(flip(n) >> 31); }
};
\`\`\`

#### Step-by-Step SWAR Breakdown
1. **Stage 1 (1-Bit Pair Swap):** Bitmask \`0x55555555u\` (\`01010101 01010101 01010101 01010101\`). Swaps adjacent odd and even bits across all 16 bit-pairs simultaneously.
2. **Stage 2 (2-Bit Dibit Swap):** Bitmask \`0x33333333u\` (\`00110011 00110011 00110011 00110011\`). Swaps adjacent 2-bit groups.
3. **Stage 3 (4-Bit Nibble Swap):** Bitmask \`0x0F0F0F0Fu\` (\`00001111 00001111 00001111 00001111\`). Swaps adjacent 4-bit nibbles.
4. **Stage 4 (8-Bit Byte Swap):** Bitmask \`0x00FF00FFu\` (\`00000000 11111111 00000000 11111111\`). Swaps adjacent 8-bit bytes.
5. **Stage 5 (16-Bit Halfword Swap):** \`v >> 16 | v << 16\`. Swaps the upper and lower 16-bit words.

#### Why Mirror Proves Parity
In binary representation, the parity of any integer $n$ is encoded exclusively in its least significant bit $b_0$ (bit 0):
- If $n$ is even, $b_0 = 0$.
- If $n$ is odd, $b_0 = 1$.

Because \`flip(n)\` inverts the position of every bit $i \\mapsto (31 - i)$, bit 0 is transposed to bit 31 (the most significant bit, MSB). Shifting right by 31 bits (\`flip(n) >> 31\`) extracts $b_0$. Negating this with logical not (\`!(flip(n) >> 31)\`) evaluates to \`!0 = true\` if even, and \`!1 = false\` if odd!

---

### 4. Serpent 2: \`Gray\`: XOR Nibble Folding and the 0x6996u Parity Constant

\`Gray\` utilizes Gray-code folding and discrete parity trees, solving parity through a mathematical identity where all 31 upper bits destroy themselves through pairwise cancellation:

\`\`\`cpp
struct Gray : Charlotte<Gray> {
    static constexpr uint32_t fold(uint32_t v) {
        v ^= v >> 16, v ^= v >> 8, v ^= v >> 4;
        return 0x6996u >> (v & 15) & 1;
    }
    constexpr bool bite(uint32_t n) const { return !(fold(n) ^ fold(n >> 1)); }
};
\`\`\`

#### Step 1: 32-Bit to 4-Bit XOR Folding
- \`v ^= v >> 16\`: Folds the upper 16 bits of the word into the lower 16 bits.
- \`v ^= v >> 8\`: Folds the upper 8 bits of that result into the lower 8 bits.
- \`v ^= v >> 4\`: Folds the upper 4 bits into the lowest nibble ($[0..15]$).
The lowest 4 bits now contain the accumulated XOR sum of all 32 bits partitioned modulo 4.

#### Step 2: The Magic Parity Constant \`0x6996u\`
Why does \`0x6996u >> (v & 15) & 1\` compute the parity of a 4-bit nibble?
Let us express \`0x6996\` in binary:
\`\`\`text
0x6996 = 0110 1001 1001 0110 (binary)
\`\`\`
Now calculate the parity ($popcount \\pmod 2$) for every 4-bit integer from 0 to 15:
- $0 = 0000_2 \\implies 0$
- $1 = 0001_2 \\implies 1$
- $2 = 0010_2 \\implies 1$
- $3 = 0011_2 \\implies 0$
- $4 = 0100_2 \\implies 1$
- $5 = 0101_2 \\implies 0$
- $6 = 0110_2 \\implies 0$
- $7 = 0111_2 \\implies 1$
- $8 = 1000_2 \\implies 1$
- $9 = 1001_2 \\implies 0$
- $10 = 1010_2 \\implies 0$
- $11 = 1011_2 \\implies 1$
- $12 = 1100_2 \\implies 0$
- $13 = 1101_2 \\implies 1$
- $14 = 1110_2 \\implies 1$
- $15 = 1111_2 \\implies 0$

Reading these parity values from index 0 to index 15 yields: **\`0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0\`**! This is the exact 16-bit binary pattern of \`0x6996u\`. Thus, shifting \`0x6996u\` right by \`(v & 15)\` and masking with \`1\` computes the global parity of \`v\` with zero memory loads and zero branches!

#### Step 3: The Parity Cancellation Theorem

Why does \`!(fold(n) ^ fold(n >> 1))\` determine whether $n$ is even? Let $P(x)$ denote the global parity of an integer $x$:

$$P(n) = \\bigoplus_{i=0}^{31} b_i = b_0 \\oplus \\bigoplus_{i=1}^{31} b_i$$

Now consider the right-shifted value $n \\gg 1$:

$$P(n \\gg 1) = 0 \\oplus \\bigoplus_{i=1}^{31} b_i = \\bigoplus_{i=1}^{31} b_i$$

When we compute the XOR sum of their parities:

$$P(n) \\oplus P(n \\gg 1) = \\left( b_0 \\oplus \\bigoplus_{i=1}^{31} b_i \\right) \\oplus \\left( \\bigoplus_{i=1}^{31} b_i \\right)$$

By the associativity and commutativity of XOR ($x \\oplus x = 0$ and $x \\oplus 0 = x$):

$$P(n) \\oplus P(n \\gg 1) = b_0 \\oplus 0 = b_0$$

**Every single bit from 1 through 31 cancels itself out completely!** Only bit 0 survives! Negating the result with \`!\` returns \`!b_0\`, which is \`true\` (1) for even numbers and \`false\` (0) for odd numbers.

---

### 5. Serpent 3: \`Bruijn\`: De Bruijn Sequence $B(2, 5)$ Spiral & LSB Isolation

\`Bruijn\` solves parity using cyclic De Bruijn sequences to isolate and hash the least significant set bit ($LSB$) into a trailing zero count table:

\`\`\`cpp
struct Bruijn : Charlotte<Bruijn> {
    static constexpr std::array<uint8_t, 32> SPIRAL = [] {
        std::array<uint8_t, 32> t{};
        for (uint32_t i = 0; i < 32; i++)
            t[(0x077CB531u << i) >> 27] = uint8_t(i);
        return t;
    }();
    constexpr bool bite(uint32_t n) const {
        uint32_t v = n | 0x80000000u;
        return SPIRAL[((v & (~v + 1)) * 0x077CB531u) >> 27] != 0;
    }
};
\`\`\`

#### What Is a De Bruijn Sequence $B(2, 5)$?
A De Bruijn sequence of order $k=5$ on a binary alphabet is a cyclic sequence of length $2^5 = 32$ in which every possible 5-bit combination appears exactly once as a contiguous circular substring.
The 32-bit constant **\`0x077CB531u\`** is a canonical $B(2, 5)$ generator:
\`\`\`text
0x077CB531 = 0000 0111 0111 1100 1011 0101 0011 0001 (binary)
\`\`\`

#### The Compile-Time \`SPIRAL\` Hash Table
At compile time, the lambda generates \`SPIRAL\`:
\`\`\`cpp
for (uint32_t i = 0; i < 32; i++)
    t[(0x077CB531u << i) >> 27] = uint8_t(i);
\`\`\`
Because \`0x077CB531u\` is a De Bruijn cycle, multiplying by any isolated power-of-two bit $2^i$ circularly shifts the 32-bit sequence by $i$ positions. The top 5 bits (\`>> 27\`) uniquely identify the power $i \\in [0..31]$ with zero hash collisions!

#### The Sentinel and Parity Decision
1. **Sentinel Mask (\`v = n | 0x80000000u\`):** If $n = 0$, $v \\ \\&\\ -v$ would be 0, leading to undefined behavior in table indexing. Or-ing with \`0x80000000u\` (bit 31) guarantees $v \\neq 0$ while leaving bit 0 completely untouched.
2. **Two's Complement LSB Isolation (\`v & (~v + 1)\`):** This is the classic bitwise operation \`v & -v\`, which strips away all set bits except the lowest one ($2^k$).
3. **Parity Check:**
   - If $n$ is **odd**, bit 0 is set $\\implies LSB = 2^0 = 1$. The trailing zero count is $0 \\implies SPIRAL[...] = 0$.
   - If $n$ is **even**, bit 0 is clear $\\implies LSB \\ge 2^1$ (or $2^{31}$ if $n = 0$). The trailing zero count is $\\ge 1 \\implies SPIRAL[...] \\neq 0$.
4. Checking \`SPIRAL[...] != 0\` returns \`true\` if and only if $n$ is even!

---

### 6. Serpent 4: \`Rebecca\`: Circular Vector Rotation & Affine Galois Field Inversion

\`Rebecca\` rotates the 32-bit word, extracts the lowest byte, and routes it through an affine Galois field mapping over $\\mathbb{Z}_2$:

\`\`\`cpp
struct Rebecca : Charlotte<Rebecca> {
    static constexpr std::array<uint8_t, 256> AN_ARRAY_OF_FEELINGS = [] {
        std::array<uint8_t, 256> t{};
        for (uint32_t b = 0; b < 256; b++)
            t[b] = uint8_t(1 ^ (((b * 0x5Du) ^ 0x2Eu) & 1));
        return t;
    }();
    constexpr bool bite(uint32_t n) const {
        return AN_ARRAY_OF_FEELINGS[std::rotr(n, 8) >> 24] != 0;
    }
};
\`\`\`

#### Step 1: Circular Vector Rotation (\`std::rotr\`)
C++20's \`std::rotr(n, 8)\` performs a circular right rotation of 8 bits. The lowest byte of $n$ (byte 0) wraps around into the highest byte position (bits $24..31$). Right-shifting by 24 (\`>> 24\`) isolates this original low byte ($b \\in [0..255]$).

#### Step 2: The Affine Galois Parity Proof

Inside the compile-time lambda, each byte is transformed by:

$$f(b) = 1 \\oplus \\Big( \\big( (b \\times 0x5D) \\oplus 0x2E \\big) \\ \\&\\ 1 \\Big)$$

Why is this mathematically guaranteed to yield the even/odd parity of $b$?

1. **Multiplication by $0x5D$ (93):**
   In binary arithmetic modulo 2, $93 = 2 \\times 46 + 1 \\equiv 1 \\pmod 2$.
   Because 93 is odd, $\\gcd(93, 2) = 1$. Multiplication by an odd scalar in $\\mathbb{Z}_2$ is an automorphism (invertible permutation):

   $$(b \\times 93) \\pmod 2 \\equiv (b \\pmod 2) \\times (93 \\pmod 2) \\equiv b \\times 1 \\equiv b \\pmod 2$$

   The parity of $b$ is perfectly conserved!

2. **XOR with $0x2E$ (46):**
   In binary, $46 = 00101110_2$. Notice that its least significant bit is **0** ($46 \\equiv 0 \\pmod 2$).
   XORing any integer with an even number does not alter its lowest bit:

   $$(X \\oplus 46) \\ \\&\\ 1 = (X \\ \\&\\ 1) \\oplus (46 \\ \\&\\ 1) = (X \\ \\&\\ 1) \\oplus 0 = X \\ \\&\\ 1$$

   Therefore:

   $$\\big( (b \\times 0x5D) \\oplus 0x2E \\big) \\ \\&\\ 1 = b \\ \\&\\ 1 = b_0$$

3. **Inversion with $1 \\oplus$:**
   - If $b$ is even, $b_0 = 0 \\implies 1 \\oplus 0 = 1$.
   - If $b$ is odd, $b_0 = 1 \\implies 1 \\oplus 1 = 0$.
4. \`AN_ARRAY_OF_FEELINGS[b] != 0\` returns \`true\` if even, \`false\` if odd!

---

### 7. The Consensus Council & Infix Operator \`->*\`

The \`Ouroboros\` class gathers the independent verdicts of all four serpents into a 4-bit omens register and exposes the custom infix operator \`->*\`:

\`\`\`cpp
class Ouroboros {
public:
    constexpr uint32_t omens(int n) const {
        uint32_t u = std::bit_cast<uint32_t>(n);
        return uint32_t(Mirror{}(u)) | uint32_t(Gray{}(u)) << 1 |
               uint32_t(Bruijn{}(u)) << 2 | uint32_t(Rebecca{}(u)) << 3;
    }
    constexpr int agreement(int n) const {
        uint32_t o = omens(n);
        return std::popcount(o) > 2 ? std::popcount(o) : 4 - std::popcount(o);
    }
    constexpr bool even(int n) const { return std::popcount(omens(n)) > 2; }
    friend constexpr bool operator->*(Ouroboros self, int n) {
        return self.even(n);
    }
};
\`\`\`

- **Bitwise Omens (\`omens\`):** Bit 0 = Mirror, Bit 1 = Gray, Bit 2 = Bruijn, Bit 3 = Rebecca.
- **Democratic Majority Rule:** \`std::popcount(omens(n)) > 2\` determines evenness by supermajority consensus (at least 3 votes).
- **The Infix \`operator->*\`:** Overloading C++'s pointer-to-member operator \`->*\` allows idiomatic evaluation:
  \`\`\`cpp
  constexpr ouroboros::Ouroboros council;
  if (council->*ticks) {
      // Executes on even ticks
  }
  \`\`\`

#### The Compile-Time Unanimity Proof (\`consteval\`)
Before any code in Mellangan can be compiled, the compiler executes \`unanimous()\` inside a compile-time constant evaluation:

\`\`\`cpp
consteval bool unanimous() {
    Ouroboros o;
    constexpr int EDGES[] = {
        0, 1, -1, 2, -2,
        0x7FFFFFFF, int(0x80000000u),
        0x55555555, int(0xAAAAAAAAu),
        65536, 255, 256
    };
    for (int n : EDGES)
        if ((o->*n) != (n % 2 == 0) || o.agreement(n) != 4)
            return false;
    for (int n = -2048; n <= 2048; n++)
        if ((o->*n) != (n % 2 == 0) || o.agreement(n) != 4)
            return false;
    return true;
}
static_assert(unanimous(), "the serpents disagree");
\`\`\`
Every edge case (zero, positive and negative one, INT_MAX, INT_MIN, alternating bitmasks \`0x55555555\` and \`0xAAAAAAAA\`, power-of-two boundaries, and the entire continuous span of 4,097 integers between $[-2048, 2048]$) must achieve **100% unanimous agreement (\`agreement == 4\`)** at compile time!

---

### 8. \`Augury\`: The Self-Traversing XOR-Linked List & Type-Erased Thunk Dispatch

While \`Ouroboros\` executes at compile time via inlined templates, \`Augury\` executes at runtime using a memory-compact **XOR-linked list** and type-erased function pointers:

\`\`\`cpp
template <class S> bool thunk(const void *charlotte, uint32_t n) {
    return (*static_cast<const S *>(charlotte))(n);
}

struct Rite {
    const void *charlotte;
    bool (*bite)(const void *, uint32_t);
    uintptr_t link;
};
\`\`\`

#### The XOR-Linked List Principle
A standard doubly linked list node requires two separate 64-bit pointers (\`prev\` and \`next\`), occupying 16 bytes of pointer overhead per node.
An XOR-linked list compresses both pointers into a **single 64-bit integer**:
$$\\text{link} = \\text{prev} \\oplus \\text{next}$$

#### Construction in \`Augury::Augury()\`
\`\`\`cpp
for (int i = 0; i < 4; i++) {
    uintptr_t prev = i ? reinterpret_cast<uintptr_t>(static_cast<void *>(&rites[i - 1])) : 0;
    uintptr_t next = i < 3 ? reinterpret_cast<uintptr_t>(static_cast<void *>(&rites[i + 1])) : 0;
    rites[i] = {serpents[i], bites[i], prev ^ next};
}
\`\`\`

#### Forward Traversal via XOR Pointer Arithmetic
\`\`\`cpp
bool even(int n) const {
    uint32_t u = std::bit_cast<uint32_t>(n), votes = 0, seat = 0;
    const void *prev = nullptr, *here = static_cast<const void *>(rites);
    while (here) {
        const Rite *r = static_cast<const Rite *>(here);
        votes |= uint32_t(r->bite(r->charlotte, u)) << seat++;
        const void *next = reinterpret_cast<const void *>(
            r->link ^ reinterpret_cast<uintptr_t>(prev));
        prev = here, here = next;
    }
    return std::popcount(votes) > 2;
}
\`\`\`

- **Pointer Recovery:** Because $link = prev \\oplus next$, calculating $link \\oplus prev = (prev \\oplus next) \\oplus prev = next$. The address of the next node is reconstructed on the fly using zero extra memory!
- **Type-Erased Thunks:** Each node points to a stateless serpent instance (\`r->charlotte\`) and an indirect C function pointer (\`r->bite\`). This validates runtime indirect branch prediction, function call ABI compliance, and cacheline alignment across compiler versions.
`,
    mermaidCharts: [
      {
        title:
          "The Council of Four Serpents: Compile-Time Parity Consensus & Operator ->*",
        chart: `
flowchart TD
    classDef input fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef serpent fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef council fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Input["Target Integer int n<br/>u = std::bit_cast<uint32_t>(n)"]:::input

    M["Mirror::bite(u)<br/>5-Stage SWAR 32-Bit Flip<br/>Bit 0 -> Bit 31<br/>!(flip(u) >> 31)"]:::serpent
    G["Gray::bite(u)<br/>XOR Nibble Fold to 4 Bits<br/>0x6996u Parity Truth Table<br/>!(fold(u) ^ fold(u >> 1))"]:::serpent
    B["Bruijn::bite(u)<br/>LSB Isolation (v & -v)<br/>De Bruijn Multiplier 0x077CB531u<br/>SPIRAL[hash] != 0"]:::serpent
    R["Rebecca::bite(u)<br/>std::rotr(u, 8) >> 24 Low Byte<br/>Galois Affine Inversion in Z₂<br/>AN_ARRAY_OF_FEELINGS[b] != 0"]:::serpent

    Omens["omens(n) = M | G<<1 | B<<2 | R<<3<br/>popcount(omens) > 2 (Consensus Majority)"]:::council
    Operator["council->*n (Infix Pointer-to-Member)<br/>static_assert(unanimous(), 'the serpents disagree')"]:::council

    Input --> M & G & B & R
    M & G & B & R --> Omens --> Operator
`,
      },
      {
        title:
          "Augury XOR-Linked List Traversal with Type-Erased Thunks (link = prev ^ next)",
        chart: `
flowchart LR
    classDef node fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef dispatch fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef result fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;

    R0["rites[0] (Mirror)<br/>link = 0 ^ &rites[1]"]:::node
    R1["rites[1] (Gray)<br/>link = &rites[0] ^ &rites[2]"]:::node
    R2["rites[2] (Bruijn)<br/>link = &rites[1] ^ &rites[3]"]:::node
    R3["rites[3] (Rebecca)<br/>link = &rites[2] ^ 0"]:::node

    Thunk["Indirect Function Pointer Call<br/>r->bite(r->charlotte, u)<br/>thunk<S>() -> bool"]:::dispatch
    Votes["Accumulate Bitwise Votes<br/>votes |= bite() << seat++<br/>std::popcount(votes) > 2"]:::result

    R0 -->|"next = link ^ 0"| R1
    R1 -->|"next = link ^ prev"| R2
    R2 -->|"next = link ^ prev"| R3
    R0 & R1 & R2 & R3 -.-> Thunk --> Votes
`,
      },
    ],
    interactiveComponent: "ouroboros",
  },
  {
    id: "campaign-settlements-delves",
    title:
      "31. Campaign Settlements, Sanctuary Seekers, Watchtowers & Dungeon Delves",
    category: "gameplay",
    summary:
      "The v0.6.0 Hearth & Home meta-loop: lost sanctuary seeker escort state machines (Townsfolk.cpp), watchtower ballistic defense (Watchtower.cpp), merchant discounts, the Loyal Hound companion, and multi-floor subterranean Delves (Delve.cpp).",
    sourceFiles: [
      "src/campaign/Campaign.hpp",
      "src/campaign/Campaign.cpp",
      "src/campaign/Townsfolk.hpp",
      "src/campaign/Townsfolk.cpp",
      "src/campaign/Sentry.hpp",
      "src/campaign/Sentry.cpp",
      "src/campaign/Watchtower.hpp",
      "src/campaign/Watchtower.cpp",
      "src/campaign/Delve.hpp",
      "src/campaign/Delve.cpp",
      "src/test/RescueTest.cpp",
      "src/test/TowerTest.cpp",
      "src/test/DelveTest.cpp",
    ],
    content: `
### The Hearth & Home Architecture: Settlements, Escort & Subterranean Delves

Mellangan v0.6.0 introduces the **Hearth & Home** meta-progression loop (\`src/campaign/\`), connecting high-stakes nocturnal survival with persistent settlement growth, lost sanctuary seeker rescues, defensive watchtowers, and multi-floor subterranean dungeon delves:

\`\`\`
Wilderness Excursions <---> Lost Sanctuary Seeker Escort <---> Town Hearth Settlement
        |                                                 |
        v                                                 v
Deep Dungeon Delves                              Watchtower Fortifications & Loyal Hound
\`\`\`

---

### 1. The Townsfolk Entity & Escort State Machine (\`Townsfolk.cpp\`)

The \`Townsfolk\` class (\`src/campaign/Townsfolk.hpp\`) models civilian villagers displaced by the spreading darkness. Each sanctuary seeker operates under a strict three-state lifecycle:

\`\`\`cpp
class Townsfolk : public Entity {
public:
    static constexpr float SPEED = 18, HEAR = 34, SAY = 5, TRAIL = 50,
                           CALL = 28, LEASH = 260, HP = 40;
    enum class Mode { Home, Lost, Following };
    Mode mode = Mode::Home;
    // ...
};
\`\`\`

#### Mathematical Invariants of the Escort Loop:

1. **The Rescue Call Proximity (\`CALL = 28.0f\`):**
   When spawned in the wilderness, sanctuary seekers begin in \`Mode::Lost\`. They cannot fight back and use a fixed distress line. When the player enters within Euclidean distance $d < \\text{CALL}$, the sanctuary seeker immediately transitions to \`Mode::Following\`:
   \`\`\`cpp
   if (mode == Mode::Lost && d < CALL && !p.dead()) {
       mode = Mode::Following;
       talk = SAY;
       hush = SAY + 6;
       spoken = line();
       level->game.announce("A SANCTUARY SEEKER FOLLOWS YOU  BRING THEM TO A BASTION");
   }
   \`\`\`

2. **Following Speed (\`TRAIL = 50.0f\`):**
   Once following, the sanctuary seeker moves toward the player when more than 20 px away, using a speed capped by both 50 px/s and $1.05\\times$ the player's speed:
   $$v_{\\text{trail}} = \\min(50.0, v_{\\text{player}} \\times 1.05)$$
   Bastion routing and wall collision constrain the path. A fast player can still outrun the follower and break the leash.

3. **The Leash Break Theorem (\`LEASH = 260.0f\`):**
   If the hero abandons the sanctuary seeker or sprints past the separation threshold ($d > \\text{LEASH}$), the tether breaks! The sanctuary seeker reverts to \`Mode::Lost\`, ceases movement, and cries out for help:
   \`\`\`cpp
   if (d > LEASH || p.dead()) {
       mode = Mode::Lost;
       return;
   }
   \`\`\`

4. **Predator Vulnerability & Flashing (\`HP = 40.0f\`):**
   Roaming predators (wolves, rats, night shades) deal $1.5\\times$ scaling damage to unarmored sanctuary seekers:
   \`\`\`cpp
   if (float bite = e.type.damage * e.damageMul * DT * 1.5f; bite > 0)
       hp -= bite, flash = 0.15f;
   \`\`\`
   If HP drops to zero, the sanctuary seeker disintegrates in a burst of white spark particles (\`Spark::burst\`) and is permanently lost to the dark.

5. **Dialogue:** Lost and following sanctuary seekers use fixed lines. Once home, they choose from four lines for their town, indexed by \`town % 5\`. A nearby living player can hear the nearest townsperson speak.

---

### 2. Watchtower Ballistic Defense & Light Casters (\`Watchtower.cpp\`)

To protect vulnerable settlements against nocturnal siege waves, town elders can fortify town perimeters by constructing **Watchtowers** (\`src/campaign/Watchtower.hpp\`):

\`\`\`cpp
class Watchtower : public Entity {
public:
    static constexpr float RANGE = 190, RELOAD = 1.1f;
    float reload = 0.5f, t = 0;
    int shots = 0;
};
\`\`\`

#### Architectural Invariants:
1. **Procedural Multi-Tile Sprite Assembly:**
   A Watchtower is drawn across 4 vertical atlas tiles:
   \`\`\`cpp
   s.sprite(atlas::town(tt::Bricks), xp, yp, 8, 16, 1, 1);
   s.sprite(atlas::town(tt::ArrowSlit), xp, yp - 16, 8, 16, 1, 1);
   s.sprite(atlas::town(tt::TowerTop + 25), xp, yp - 32, 8, 16, 1, 1);
   s.sprite(atlas::town(tt::TowerTop + 1), xp, yp - 48, 8, 16, 1, 1);
   \`\`\`
2. **Target Acquisition & Ballistic Cadence:**
   Once its reload timer reaches zero, the tower scans a circular perimeter of radius $\\text{RANGE} = 190$ px centered at the arrow slit ($y - 40$). It selects the nearest living, unburied hostile and looses an arrow projectile at **260 px/s**, then resets its reload to 1.1 seconds:
   $$damage = 8.0 + 2.0 \\times \\text{Player::lvl}$$
3. **Dynamic Lightfield Beacon:**
   The tower summit casts an additive flame glow into \`level->lights\` with a natural sinusoidal flicker:
   \`\`\`cpp
   s.glow(xp, yp - 40, 70, FLAME * (0.8f + 0.2f * std::sin(t * 6)));
   \`\`\`

---

### Sentries and walls (\`src/campaign/Sentry.cpp\`)

Sentries select the nearest living, unburied enemy within 120 px of their post. They chase within 70% of that guard radius and cleave nearby enemies when in reach. Their movement passes through the active \`RunRules::wall\` callback. When a sentry pushes an overlapping enemy, the same wall callback constrains the displacement, except for Shades. This keeps ordinary enemies from being pushed through a bastion wall.

---

### 3. Settlement Economy, Vendor Discounts & The Loyal Hound Companion

When a following sanctuary seeker comes within 120 px of a town center, \`Campaign::stray()\` settles them there and grants these rewards:

1. **Crafting Materials Payout:**
   Each rescue adds three independently selected materials to the player: Shard, Ore, Rune, Herb, Hide or Bone. Wood and Stone are not selected by this reward.
2. **Permanent Merchant Discount:**
   Rescuing sanctuary seekers earns the gratitude of the regional vendor (\`Vendor.cpp\`), applying a **+5% price discount** per rescued sanctuary seeker, capped at a hard maximum of **25%** (\`level.vendor.discount = 0.25f\`):
   $$\\text{discount} = \\min(0.25, 0.05 \\times \\text{rescued})$$
3. **Milestone: The Loyal Hound Companion (\`c.hound\`):**
   Upon reaching **at least 3 total rescues** (\`rescued >= 3\`), the town gifts the player their faithful **Hunting Hound**:
   - The hound follows the player into the wilderness as a dedicated \`Ally\`.
   - Deals scaled biting damage: $damage = 6.0 + 2.0 \\times \\text{Player::lvl}$.
   - Uses the normal wolf ally targeting rules and is moved back beside the player if it strays more than 260 px away.
   - If the hound is removed, the campaign marks it down. At the next transition to dawn, the flag clears and a new hound can be summoned beside a living player.

---

### 4. Deep Dark Dungeon Delves (\`Delve.cpp\`)

In addition to surface exploration, campaign maps contain abandoned mine shafts that lead into **Subterranean Delves** (\`src/campaign/Delve.hpp\`):

\`\`\`cpp
struct Delve {
    static constexpr int FLOORS = 3, RING = 7;
    static constexpr float REACH = 48, PAUSE = 2.5f;
    bool active = false;
    int floor = 0;
};
\`\`\`

#### Delve Dynamics:
1. **Entry and sealing:** An uncompleted mine within 48 px can start a delve. The game places a ring of rubble around its center, pauses ordinary spawning, and removes nearby non-boss enemies.
2. **Three waves:** Each wave begins after the previous area's enemies have been cleared and the wait has elapsed. The first has cave bats and kobold miners; the second has rock crawlers, ore golems and a cave bat. The third adds a guardian, kobold miners and rock crawlers.
3. **Guardian by act:** Acts 1–5 use Cyclops, Mycelial Brute, Iceback, Glass Mantis and Cyclops respectively. The guardian appears in the third wave only.
4. **Completion:** Clearing the final wave restores the spawn rate, removes rubble, records the cleared mine, and creates a chest, boss-source item drops, four ore and two rune material drops. Aborting also restores spawning and removes rubble.

`,
    mermaidCharts: [
      {
        title: "The Sanctuary Seeker Escort & Leash Lifecycle State Machine",
        chart: `
stateDiagram-v2
    [*] --> Lost : Spawn in Wilderness
    Lost --> Following : Player Distance < CALL (28 px)
    Following --> Lost : Player dies or distance > LEASH (260 px)
    Following --> Home : Within 120 px of town center (settle())
    Lost --> Death : HP <= 0 (Predator Bites)
    Following --> Death : HP <= 0 (Intercepted by Foes)

    state Home {
        [*] --> VillageWander : Day (SPEED = 18)
        VillageWander --> CampfireHuddle : Night (Shiver + Near Fire)
        CampfireHuddle --> CitizenDialogue : Player Distance < HEAR
    }
`,
      },
      {
        title: "Settlement Defense, Watchtowers & Hound Companion Progression",
        chart: `
flowchart TD
    classDef hero fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef town fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef tower fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef dog fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    Hero["Hero Explores Wilderness<br/>(Satchel & Materials)"]:::hero
    Seeker["Lost Sanctuary Seeker Discovered<br/>Mode::Following (Leash 260)"]:::hero

    Town["Town Hearth & Safe Zone<br/>+3 Materials | +5% Discount"]:::town
    Hound["Loyal Hound Companion<br/>(Unlocked at 3 Rescues)<br/>Revives Fresh at Dawn!"]:::dog
    Tower["Watchtower Fortification<br/>(RANGE 190 | RELOAD 1.1s)<br/>Arrow Slits & Flame Lightfield"]:::tower

    Seeker -->|"Escort into Town"| Town
    Town -->|"Milestone: 3 Rescues"| Hound
    Town -->|"300 gold + 12 stone + 8 wood"| Tower
    Tower -->|"Auto-Fire Arrows (260 px/s)"| Foes["Incoming Nocturnal Swarm"]
    Hound -->|"Autonomous Biting & Quarry Aggro"| Foes
`,
      },
    ],
    interactiveComponent: "refugee",
  },
  {
    id: "engine-mathematics",
    title: "32. Die Mathematik von Mellangan: Eine Untersuchung von Modellen und Invarianten",
    category: "core",
    summary: "Eine wissenschaftliche Analyse der Näherungen, Beweise, Einheiten und Randbedingungen des Spielsystems anhand des Quellcodes.",
    sourceFiles: [
      "src/Math.hpp",
      "src/entity/enemy/Enemy.cpp",
      "src/entity/Status.hpp",
      "src/item/loot/Loot.cpp",
      "src/level/LevelSpace.cpp",
      "src/level/LevelRender.cpp",
      "src/campaign/Bastion.cpp",
      "src/level/world/Biomes.cpp",
      "src/level/world/Ground.cpp",
      "src/level/world/Under.cpp",
      "src/level/biome/Biome.cpp",
      "src/level/FloorPainter.cpp",
      "src/level/Noise.h",
      "src/level/Noise.c",
      "src/level/LightField.cpp",
      "src/level/Sky.cpp",
      "src/level/world/Terrain.cpp",
      "src/particle/Spark.cpp",
      "src/particle/Drift.cpp",
      "src/particle/debris/Debris.cpp",
      "src/level/Matter.cpp",
      "src/Game.cpp",
      "src/campaign/CampaignChronicle.cpp",
      "src/hero/Synergy.cpp",
      "src/level/Feuds.cpp",
    ],
    content: `
### Zusammenfassung

Diese Untersuchung fragt, wie ein Echtzeitspiel kontinuierliche Geometrie, ungewisse Ergebnisse und umfangreiche räumliche Suchen in Regeln überführt, die sich innerhalb eines festen Zeitbudgets auswerten lassen. Ihre These lautet, dass Mellangans mathematischer Entwurf weniger von einer einzelnen Formel als von einem wiederkehrenden Dreischritt abhängt: **eine endliche Darstellung wählen, eine Invariante bewahren und den Gültigkeitsbereich der Darstellung angeben**. Die Vorhersage einer Zielposition ist zeitlich begrenzt; Widerstand ist gedeckelt und wirkt zweifach; die Seltenheit wird durch eine geordnete Abfolge von Entscheidungen bestimmt; räumliche Suchen nutzen Zellen und Präfixsummen; Gelände wird an Stützpunkten klassifiziert und an Grenzen gemischt; Bewegung schreitet in diskreten Rekursionen fort. Jede dieser Konstruktionen gewinnt Geschwindigkeit oder Vorhersagbarkeit, indem sie auf einen Teil der Allgemeingültigkeit verzichtet.

Als Beleg dient der oben genannte aktuelle Quellcode. Das Kapitel rekonstruiert die maßgeblichen Gleichungen, leitet ausgewählte Invarianten her und verdeutlicht Einheiten und Grenzfälle anhand von Zahlenbeispielen. Es unterscheidet exakte algebraische Folgen eines Codepfads von brauchbaren Näherungen für dessen vollständiges Laufzeitverhalten. Weder die Laufzeit eines Einzelbildes noch die allgemeine Spielbalance werden hier gemessen oder bewiesen. Ein fünfter Teil überträgt dieselbe Methode auf Systeme der lebendigen Welt: Eine Kachelmarke verhindert das Pendeln zwischen Ebenen, Grüfte und Tafeln erhalten eine Präfix-Invariante der Chronik, Synergien bilden eine Produktmenge, und die Wahrscheinlichkeit einer Fehde lässt sich trotz Restverzerrung des Hashes exakt angeben. Daraus ergibt sich ein Vorgehen für Mitwirkende: Änderungen mathematisch formulieren, ihre Voraussetzungen benennen und die Stellen prüfen, an denen diese Voraussetzungen nicht mehr gelten.

### Forschungsfrage und analytischer Rahmen

**Forschungsfrage.** Welche Eigenschaften muss ein vereinfachtes mathematisches Modell bewahren, damit es in Mellangans Simulation mit festen Zeitschritten und seiner Darstellung nützlich bleibt? Die Antwort wird anhand von vier Gruppen und einem abschließenden fünften Teil untersucht: Entscheidungsregeln (Zielerfassung, Zustände, Beute), Datenumformungen (räumliche Zellen, Tiefensortierung, Richtungsfelder), räumliche Erzeugung (Biome, Rauschen, Bodenübergänge) und zeitliche Entwicklung (Partikel, Materie, Licht). Diese Gruppen verbindet der Umgang mit Grenzen, Reihenfolgen und Einheiten.

Eine **Invariante** ist eine Eigenschaft, die nach einer gültigen Operation erhalten bleiben soll, etwa eine normierte Mischung mit der Summe eins oder disjunkte Zellbereiche, die alle zugeordneten Gegner enthalten. Eine **Voraussetzung** beschränkt den Gültigkeitsbereich einer Herleitung, etwa eine konstante Schadensrate oder eine endliche Tiefe ohne NaN-Wert. Eine **Randbedingung** beschreibt das Verhalten an einer Grenze des Bereichs, etwa an einer Entfernungsschwelle, bei einem Zählerstand von null oder am Rand einer Rasterzelle. Diese Begriffe sind wichtig: Auch eine korrekte Formel kann zu einer falschen Vorhersage über das Spiel führen, wenn ihre Voraussetzungen fehlen.

| Modellgruppe | Endliche Darstellung | Im Folgenden untersuchte Eigenschaft | Wesentliche Einschränkung |
| --- | --- | --- | --- |
| Zielerfassung und Zustände | Begrenzte Vorhersage; begrenzter Widerstand | Maximale Vorhersage; Wirkung zweier Abschwächungen | Bewegliches Ziel; erneute Anwendung und Obergrenzen |
| Beute und Indizierung | Geordnete Würfe; Zellen mit Präfixsummen | Aufteilung der Wahrscheinlichkeiten; disjunkte Bereiche | Nachgelagerte Gegenstandsregeln; Kandidaten der Grobsuche |
| Darstellung und Wege | Ganzzahlige Sortierschlüssel; Rasterfeld | Stabile Tiefenreihenfolge; minimale Schrittzahl | NaN-Werte und Schlüsselbreite; unterschiedliche Schrittlängen |
| Gelände und Bewegung | Abgetastete Biome; feste Zeitschritte | Normierung der Mischung; Verhalten der Rekursion | Klassifikationsgrenzen; Reihenfolge der Aktualisierung |
| Ebenen, Chronik und Kombinatorik | Kachelmarke; Kennungsmengen; Bitmasken; Hash-Reste | Kein Pendeln; Präfix der Fragmente; Produktformel; exakte Wahrscheinlichkeit | Stürze außerhalb der Durchgänge; bearbeitete Spielstände; Annahme gleichverteilter Hashes |

### Quellen, Notation und Methode

Die für dieses Kapitel aufgeführten Quelldateien bilden die Grundlage. Für jedes Modell bestimmt die Analyse die genaue Funktion, erfasst ihre Eingaben und Einheiten, überträgt ihre Operationen in der tatsächlichen Ausführungsreihenfolge in mathematische Form, leitet eine Folge ab und prüft diese anhand eines Zahlenbeispiels oder einer Invariante. Untersucht wird die Bedeutung der Implementierung. Aus einer Formel allein wird weder auf die Entwurfsabsicht geschlossen noch eine frühere Messung als mathematische Garantie behandelt.

Sofern ein Abschnitt nicht ausdrücklich **Kacheln** nennt, bezeichnen $x,y$ Positionen in **Weltpixeln**. Eine Kachel ist 16 Pixel breit. $n$ bezeichnet einen Simulationsschritt und $\\Delta t=1/60\\text{ s}$ dessen Dauer. Fett gesetzte Symbole sind zweidimensionale Vektoren; $\\|\\mathbf v\\|$ ist die euklidische Länge. Wahrscheinlichkeiten beziehen sich auf die angegebene Zufallsprüfung, nicht zwangsläufig auf einen endgültigen Gegenstand oder eine Begegnung. Ein halboffenes Intervall $[a,b)$ enthält $a$, aber nicht $b$. Alle folgenden Ableitungen beziehen sich auf idealisierte Formeln mit reellen Zahlen; das Programm rechnet mit begrenzter Genauigkeit und kann Werte begrenzen.

Die folgenden vier Teile führen von lokalen Entscheidungen über Datenstrukturen zu erzeugtem Raum und zeitabhängigen Effekten. Jedes Ergebnis gilt unter den jeweils genannten Voraussetzungen. Die eigenen Kapitel über KI, Gelände, Partikel und Materie liefern weiteren Zusammenhang.

## Teil I. Begrenzte Entscheidungsregeln

### 1. Zielvorhersage und Sichtprüfung

\`Enemy::sense()\` verwendet die Verschiebung $\\mathbf{r}$ vom Gegner zum Ziel, die Geschwindigkeit $\\mathbf{v}$ des Ziels und die Geschwindigkeit $s$ des Gegnertyps. Die Funktion sagt eine kurze Bewegung voraus:

$\\tau=0.6\\min\\left(0.7,\\frac{\\|\\mathbf{r}\\|}{\\max(20,s)}\\right),\\qquad \\mathbf{q}=\\mathbf{r}+\\tau\\mathbf{v}$

Die Vorhersagezeit beträgt höchstens $0.42$ Sekunden. Bei einem 100 px entfernten Ziel, einer Gegnergeschwindigkeit von 50 px/s und einer Zielgeschwindigkeit von 20 px/s senkrecht zur Sichtlinie ergäbe die unbegrenzte Schätzung aus Entfernung und Geschwindigkeit 2 s. Durch die Begrenzung gilt $\\tau=0.42$ s; der vorhergesagte Punkt liegt daher 8.4 px seitlich. Um zu erkennen, was die Heuristik auslässt, nehmen wir konstante Geschwindigkeiten an und lösen die hypothetische Abfanggleichung $\\|\\mathbf r+t\\mathbf v\\|=st$. Quadrieren beider Seiten ergibt

$$ (\\mathbf v\\cdot\\mathbf v-s^2)t^2+2(\\mathbf r\\cdot\\mathbf v)t+\\mathbf r\\cdot\\mathbf r=0. $$

Ein exakter Abfangpunkt erfordert eine reelle, nichtnegative Lösung und hängt von der Richtung von $\\mathbf v$ ab. \`Enemy::sense()\` löst diese quadratische Gleichung nicht. Der begrenzte Ausdruck liefert einen kleinen Vorhalt für die Wahrnehmung und bleibt selbst dann endlich, wenn ein exaktes Abfangen unmöglich ist. Der Vergleich zeigt den Gültigkeitsbereich der Näherung; daraus folgt nicht, dass ein exaktes Abfangen das Spiel verbessern würde.

**Satz 1 (beschränkter Vorhalt).** Für endliche Eingaben, $s\\ge0$ und $R=\\|\\mathbf r\\|\\ge0$, gilt:

1. Die Vorhersagezeit liegt zwischen null und $0.42\\,\\mathrm{s}$.
2. Der vorhergesagte Punkt entfernt sich vom aktuellen Zielvektor um höchstens $0.42\\,\\mathrm{s}\\,\\|\\mathbf v\\|$.

In Formeln:

$$0\\le\\tau\\le0.42\\,\\mathrm{s},$$
$$\\|\\mathbf q-\\mathbf r\\|=\\tau\\|\\mathbf v\\|\\le0.42\\,\\mathrm{s}\\,\\|\\mathbf v\\|.$$

*Beweis.* Wegen $\\max(20,s)\\ge20>0$ ist $R/\\max(20,s)\\ge0$. Damit folgen nacheinander

$$0\\le\\min\\left(0.7,\\frac{R}{\\max(20,s)}\\right)\\le0.7,$$
$$0\\le\\tau=0.6\\min\\left(0.7,\\frac{R}{\\max(20,s)}\\right)\\le0.6\\cdot0.7=0.42.$$

Außerdem ist $\\mathbf q-\\mathbf r=\\tau\\mathbf v$. Weil $\\tau\\ge0$, liefert die Homogenität der euklidischen Norm $\\|\\tau\\mathbf v\\|=\\tau\\|\\mathbf v\\|$. Einsetzen der ersten Schranke beweist die zweite. $\\square$

Die Aussage begrenzt den **Zusatz zum aktuellen Zielvektor**, nicht die Entfernung des Gegners zum Ziel oder seine spätere Bewegung.

Unter der zusätzlichen Modellannahme, dass die tatsächliche Zielbeschleunigung während $[0,\\tau]$ höchstens $A$ Pixel pro Quadratsekunde beträgt und $\\mathbf v$ die Anfangsgeschwindigkeit ist, lässt sich auch der Vorhersagefehler begrenzen. Zweimaliges Integrieren von $\\mathbf a(t)$ ergibt $\\mathbf r_{\\mathrm{wahr}}(\\tau)-\\mathbf q=\\int_0^\\tau(\\tau-u)\\mathbf a(u)\\,du$. Die Dreiecksungleichung liefert
$$\\|\\mathbf r_{\\mathrm{wahr}}(\\tau)-\\mathbf q\\|\\le\\int_0^\\tau(\\tau-u)A\\,du=\\tfrac12A\\tau^2\\le0.0882A.$$
Dies ist ein **bedingter Fehlerbeweis** für das Modell konstanter Anfangsgeschwindigkeit. Abrupte Richtungswechsel, Teleportation oder eine nicht beschränkte Beschleunigung verletzen seine Voraussetzung.

Bei einem lebenden Ziel normiert der Code $\\mathbf{q}$ zu $\\hat{\\mathbf{q}}$, sofern seine Länge größer als 0.001 ist. Das Kennzeichen \`seen\` prüft:

$\\|\\mathbf{q}\\|<300\\quad\\text{und}\\quad -\\mathbf{a}\\cdot\\hat{\\mathbf{q}}>0.55$

Hier ist $\\mathbf{a}$ die **Zielrichtung des Ziels**, nicht die Blickrichtung des Gegners. Die Prüfung fragt anhand der vorhergesagten Verschiebung also, ob sich der Gegner ungefähr vor dem Ziel befindet. Bei einer normierten Zielrichtung entspricht die strenge Skalarprodukt-Schwelle einem halben Winkel von $\\arccos(0.55)\\approx56.6^\\circ$, also einem Kegel von etwa $113.3^\\circ$. Genau an der Grenze schlägt der strenge Vergleich fehl. Ist das gewählte Ziel tot, gibt der Code stattdessen einen ungesehenen Punkt in 400 px Entfernung zurück; lebende Verbündete in der Nähe können weiterhin zuerst ausgewählt werden.

### 2. Zustandswiderstand: das Produkt zweier Abschwächungen

\`Status::apply()\` begrenzt den Widerstand auf $0\\le r\\le0.75$ und multipliziert anschließend sowohl die eintreffende Stärke als auch die Dauer mit $1-r$. Für einen einzelnen Schaden-über-Zeit-Effekt mit konstanter Stärke $P$, Dauer $T$, ohne Obergrenze für Stärke oder Dauer und ohne erneute Anwendung gilt:

$P_r=P(1-r),\\qquad T_r=T(1-r),\\qquad D_r=PT(1-r)^2$

Bei 50 % Widerstand werden aus 40 Schadenspunkten pro Sekunde über 4 Sekunden 20 Schadenspunkte pro Sekunde über 2 Sekunden: 40 statt 160 Schadenspunkte. Bei der Obergrenze von 75 % beträgt das idealisierte Ergebnis $160(0.25)^2=10$.

Die Implementierung fügt Schaden in Abständen von 0.5 Sekunden zu und rechnet beim Ablauf einen verbleibenden Teilabschnitt ab. Bei $T_r=1.3$ s ergeben sich die Abschnitte $0.5+0.5+0.3=1.3$ s. Deshalb ist das obige Integral auch dann nützlich, wenn sich die Dauer nicht gleichmäßig auf die Zeitschritte verteilt.

**Lemma 2 (Erhaltung der wirksamen Zeit durch die Taktung).** Betrachte einen einzelnen Zustand unter drei Voraussetzungen: Er wird nicht erneut angewendet, seine Stärke $P_r$ bleibt bis zum Ablauf konstant, und jeder Schadensaufruf wird angenommen. Dann summieren sich die berechneten Zeitanteile im idealisierten Modell auf genau $T_r$.

*Beweis.* Teile die wirksame Dauer in vollständige Halbsekunden und einen Rest:

$$n=\\left\\lfloor\\frac{T_r}{0.5}\\right\\rfloor,\\qquad
\\rho=T_r-0.5n,\\qquad 0\\le\\rho<0.5.$$

Jeder der $n$ vollständigen Abschnitte verursacht $0.5P_r$ Schaden. Der Ablauf rechnet den Rest mit $\\rho P_r$ ab. Daher gilt Schritt für Schritt

$$\\begin{aligned}
D&=n(0.5P_r)+\\rho P_r\\\\
 &=P_r(0.5n+\\rho)\\\\
 &=P_rT_r.
\\end{aligned}$$

Die Aufteilung auf Simulationsschritte ändert diese Summe nicht. $\\square$

Im Programm können die Toleranz von $10^{-6}$ Sekunden, Gleitkommarundung, Tod während eines Schadensaufrufs und die weiter unten genannten Obergrenzen die exakte Gleichheit verändern.

**Herleitung.** Bei konstanter Schadensrate $P_r$ ist der Gesamtschaden ihr Zeitintegral, $D_r=\\int_0^{T_r}P_r\\,dt=P_rT_r$. Einsetzen der beiden Abschwächungen durch den Widerstand ergibt $PT(1-r)^2$. Das Quadrat entsteht, weil der Widerstand **sowohl** die Rate als auch die Einwirkzeit verändert. Im unbegrenzten Bereich gilt $\\partial D_r/\\partial r=-2PT(1-r)$: Zusätzlicher Widerstand verringert den Schaden, doch sein absoluter Grenznutzen sinkt mit steigendem $r$. Sobald der Widerstand die Grenze 0.75 erreicht oder eine andere Obergrenze greift, beschreibt diese Ableitung den Code nicht mehr. Ein einmaliger Treffer oder ein Effekt mit fester Dauer wäre anders von $r$ abhängig.

**Grenzen des Modells.** Die Stärke ist je Zustand begrenzt, die Dauer auf 60 Sekunden gedeckelt, und bei erneuter Anwendung kann ein bereits vorhandener stärkerer oder längerer Effekt erhalten bleiben. Blutung addiert Stärke und verursacht während der Bewegung des Ziels den $1.6\\times$-fachen Schaden. Tod oder Entfernung können die Abfolge vorzeitig beenden. In diesen Fällen muss die Zustandsaktualisierung verfolgt werden; die Formel für den einzelnen Effekt reicht nicht aus.

### 3. Beutewahrscheinlichkeiten: abnehmender Zuwachs und bedingte Wahrscheinlichkeit

\`rarityOdds()\` verwendet $S=1+L/40$ mit der Gegenstandsstufe $L$ sowie die Sättigungsfunktion

$f_k(m)=\\frac{mk}{m+k},\\qquad f_k'(m)=\\frac{k^2}{(m+k)^2}$

Für einen nichtnegativen Bonus auf magische Funde $m$ gilt $f_k'(m)>0$, während $f_k''(m)=-2k^2/(m+k)^3<0$ ist. Ein höherer Bonus erhöht den umgerechneten Wert stets, doch jeder weitere Punkt trägt weniger bei als der vorherige. Für unbegrenzt wachsendes $m$ nähert sich der Wert $k$. Die Prüfungen auf einzigartige und seltene Gegenstände verwenden $k=250$ beziehungsweise $k=600$; die Prüfung auf magische Gegenstände nutzt den unveränderten Bonus. Jede Prüfungswahrscheinlichkeit ist auf 1 begrenzt:

$u=\\min\\left(1,\\frac{S}{700}\\left(1+\\frac{f_{250}(m)}{100}\\right)\\right)$
$r=\\min\\left(1,\\frac{S}{90}\\left(1+\\frac{f_{600}(m)}{100}\\right)\\right),\\qquad g=\\min\\left(1,\\frac{S}{7}\\left(1+\\frac{m}{100}\\right)\\right)$

Dies sind **bedingte Prüfungen**, keine drei endgültigen Wahrscheinlichkeiten, die sich einfach addieren ließen. \`rollRarity()\` prüft zuerst auf einzigartige Gegenstände, bei Fehlschlag auf seltene und erst bei erneutem Fehlschlag auf magische. Nach der Multiplikationsregel für bedingte Wahrscheinlichkeiten gilt:

$P(U)=u,\\qquad P(R)=(1-u)r,\\qquad P(M)=(1-u)(1-r)g$

Die verbleibende Wahrscheinlichkeit ist $P(O)=(1-u)(1-r)(1-g)$. Dabei bedeutet $O$, dass die Seltenheitsbestimmung die spätere Entscheidung zwischen verbessert und gewöhnlich erreicht. Diese vier Ergebnisse teilen den ursprünglichen Wurf vollständig auf: $u+(1-u)[r+(1-r)(g+1-g)]=1$. Diese Identität hilft bei der Prüfung einer geänderten Wahrscheinlichkeitstabelle. Sie zeigt auch, warum die Reihenfolge wichtig ist: Würde zuerst auf selten geprüft, betrüge die endgültige Wahrscheinlichkeit für einzigartig $(1-r)u$ statt $u$.

Bei Gegenstandsstufe 40 und ohne Bonus auf magische Funde ist $S=2$: Die Prüfung auf einzigartig hat eine Wahrscheinlichkeit von etwa 0.286 %, die auf selten von 2.222 %. Die tatsächliche Wahrscheinlichkeit, die Prüfung auf selten zu erreichen und zu bestehen, beträgt etwa $0.997143\\times0.022222=2.216\\%$. Die Gegenstandserzeugung kann danach eine Mindestseltenheit festlegen oder ein einzigartiges Ergebnis gesondert behandeln. Die Gleichungen beschreiben daher die anfängliche Seltenheitsbestimmung und nicht jedes endgültige Beuteergebnis.

## Teil II. Datenstrukturen als mathematische Umformungen

### 4. Präfixsummen: aus einer Menge zusammenhängende Zellbereiche bilden

\`Level::buildGrid()\` zählt nicht vergrabene Gegner je Rasterzelle, bildet Präfixsummen und verteilt Zeiger in einem zusammenhängenden Feld. Angenommen, vier Zellen enthalten jeweils $[2,0,3,1]$ Gegner. Die exklusiven Anfangspositionen lauten

$[0,\\;2,\\;2,\\;5,\\;6]$

Formal sei $c_i$ die Anzahl in Zelle $i$, mit $s_0=0$ und $s_{i+1}=s_i+c_i$. Dann gilt $s_i=\\sum_{j<i}c_j$ und $s_C=N$, wobei $N$ die Gesamtzahl der zugeordneten Gegner ist. Zelle $i$ belegt das halboffene Intervall $[s_i,s_{i+1})$. Zelle 1 ist leer, weil ihre beiden Anfangspositionen gleich sind; Zelle 2 belegt die Indizes 2, 3 und 4.

**Behauptung: Die Zellbereiche bilden eine Zerlegung.** Sind alle $c_i$ nichtnegativ und schreibt die Verteilung genau $c_i$ Gegner in Zelle $i$, dann überschneiden sich die Bereiche nicht und ihre Vereinigung ist $[0,N)$. Der Beweis folgt aus $s_{i+1}=s_i+c_i$: Jeder Bereich beginnt genau dort, wo der vorige endet, und der letzte endet bei $N$. Das ist stärker als die bloße Feststellung, dass die Gesamtzahl stimmt; auch Überschneidungen und Lücken sind ausgeschlossen. Der Aufbau des Index benötigt $O(N+C)$ Arbeit für $N$ Gegner und $C$ Zellen sowie Speicher für die Felder.

**Induktionsbeweis für das Schreiben.** Zu Beginn erhält der Schreibzeiger jeder Zelle den Wert $p_i=s_i$. Nach $j$ Schreibvorgängen in Zelle $i$ gilt als Schleifeninvariante $p_i=s_i+j$, und genau die Plätze $[s_i,s_i+j)$ dieser Zelle sind belegt. Für $j=0$ ist das Intervall leer. Ein weiterer Vorgang schreibt an $p_i$ und erhöht ihn um eins; damit gilt die Invariante für $j+1$. Wegen $j<c_i$ liegt jeder dieser Indizes vor $s_i+c_i=s_{i+1}$, also innerhalb des reservierten Bereichs. Nach $c_i$ Vorgängen ist $p_i=s_{i+1}$. Zusammen mit der disjunkten Zerlegung beweist dies, dass der Verteiler bei gültigen Zählungen weder eine Zelle überschreibt noch einen zugeordneten Gegner auslässt. Es beweist keine Sicherheit, wenn ein Gegner zwischen Zählen und Verteilen seine Zellnummer änderte; der Code sammelt deshalb Zellnummer und Zeiger gemeinsam in \`binned\`.

\`gather()\` besucht zuerst die Zelle der Abfrage und danach weitere Zellen, die deren umschließendes Quadrat berührt. Die Funktion überspringt entfernte Gegner und endet beim vom Aufrufer vorgegebenen Höchstwert. Dies ist eine **grobe Kandidatensuche**: Die Zugehörigkeit zu einer Zelle beweist noch nicht, dass ein Kandidat innerhalb des angefragten Kreisradius liegt. Vergrabene Gegner werden beim Aufbau des Rasters in einer eigenen Liste \`loose\` abgelegt.

### 5. Gleitkomma-Tiefen mit Ganzzahlen sortieren

\`LevelRender.cpp\` wandelt das Bitmuster einer 32-Bit-Gleitkommazahl in einen vorzeichenlosen Schlüssel um. Bei nichtnegativen Werten kehrt der Code das Vorzeichenbit um, bei negativen Werten alle Bits. Für gewöhnliche endliche Zahlen entspricht die Reihenfolge der vorzeichenlosen Ganzzahlen danach der numerischen Reihenfolge:

| Tiefe | Ursprüngliches Gleitkomma-Bitmuster | Geordnetes Bitmuster |
|:---|:---|:---|
| $-10$ | \`C1200000\` | \`3EDFFFFF\` |
| $-0$ | \`80000000\` | \`7FFFFFFF\` |
| $+0$ | \`00000000\` | \`80000000\` |
| $+10$ | \`41200000\` | \`C1200000\` |

**Behauptung: Die Umwandlung bewahrt die Reihenfolge endlicher Tiefenwerte.** Bei nichtnegativen endlichen IEEE-754-Werten wachsen die vorzeichenlos interpretierten Bitmuster mit dem Zahlenwert; das Umkehren des Vorzeichenbits verschiebt den gesamten Bereich über die negativen Werte. Bei negativen endlichen Werten verlaufen die ursprünglichen vorzeichenlosen Bitmuster entgegen der numerischen Reihenfolge; die Umkehrung aller Bits dreht sie erneut um. Die beiden umgewandelten Bereiche treffen um null aufeinander. Beide Nullen sind numerisch gleich, erhalten aber benachbarte, verschiedene Schlüssel. NaN-Werte haben keine gewöhnliche numerische Ordnung und sind daher von der Behauptung ausgenommen. Vorausgesetzt wird außerdem die hier verwendete 32-Bit-Gleitkommadarstellung.

Der gepackte Schlüssel enthält die Ebene ab Bit 56, die geordnete Tiefe in den Bits 24–55 und den Zeichenindex in den untersten 24 Bits. Drei stabile Zählsortierdurchläufe mit je 12 Bits und Verschiebungen um 24, 36 und 48 sortieren die Bits 24–59. Damit erfasst die Sortierung die Tiefe und nur die unteren vier Bits der Ebene; die aktuellen Ebenenwerte passen dort hinein. Die unteren Indexbits werden **nicht** sortiert: Bei gleicher Ebene und Tiefe bleibt aufgrund der Stabilität die Einfügereihenfolge erhalten. Jeder Durchlauf verarbeitet die Schlüssel und 4096 Zellen; der Aufwand beträgt $O(3(N+4096))$. Die gepackte Darstellung setzt außerdem voraus, dass der Zeichenindex in 24 Bits passt.

**Satz 3 (Ordnung der drei Durchläufe).** Es gelten vier Voraussetzungen: Die Ebenenwerte liegen in $[0,15]$; jeder Zeichenindex liegt in $[0,2^{24})$; die Tiefen sind endliche IEEE-754-Binary32-Werte; und die Plattform verschiebt negative 32-Bit-Ganzzahlen arithmetisch nach rechts. Dann ist das Ergebnis lexikografisch nach Ebene und kodierter Tiefe geordnet. Bei gleicher kodierter Tiefe und Ebene bleibt die Einfügereihenfolge erhalten.

*Beweis.* Zerlege den sortierten Teil des Schlüssels in drei Blöcke zu je zwölf Bits:

| Durchlauf | Bits | Bereits geordneter Teil danach |
|:---|:---|:---|
| 1 | 24–35 | 24–35 |
| 2 | 36–47 | 24–47 |
| 3 | 48–59 | 24–59 |

Der erste Durchlauf ordnet den niedrigsten Block. Der zweite ist stabil: Innerhalb gleicher Werte von Bit 36–47 bleibt die Ordnung des ersten Blocks erhalten. Dasselbe Argument gilt für den dritten Block. So ordnen die drei Durchläufe zusammen alle 36 Bits von 24 bis 59.

Die Bits 24–55 enthalten die gesamte Tiefenkodierung. Unter der Schranke $0\\le\\text{Ebene}\\le15$ enthalten die Bits 56–59 den gesamten Ebenenwert. Da die Ebenenbits höher liegen, bestimmen sie zuerst die Ordnung, danach die Tiefenbits. Die unteren 24 Indexbits werden nicht verglichen; bei Gleichheit der sortierten Bits bewahrt die Stabilität die Einfügereihenfolge. $\\square$

Größere Ebenenwerte könnten falsch einsortiert werden. NaN besitzt keine numerische Tiefenordnung. Die beiden numerisch gleichen Nullen haben verschiedene Schlüssel und fallen deshalb nicht unter die Aussage zur stabilen Gleichheit.

### 6. Ein Tor-Richtungsfeld als Graphenproblem

\`bastion::raise()\` behandelt begehbare Zellen als Knoten eines Graphen und Verbindungen zu bis zu acht Nachbarzellen als Kanten. Die Funktion legt die Toröffnung in eine Warteschlange nach dem Prinzip „zuerst hinein, zuerst heraus“ und breitet sich von dort aus. Jede neu entdeckte Zelle speichert die Richtung zurück zur Zelle, von der aus sie entdeckt wurde. Eine diagonale Ausbreitung wird verworfen, wenn eine der beiden angrenzenden Zellen in gerader Richtung eine Wand ist. So führt kein Weg durch eine blockierte Ecke.

**Behauptung: Die gespeicherte Richtung folgt einem Weg mit minimaler Schrittzahl zu einer Öffnung.** Jede Toröffnung gelangt mit Abstand null in die Warteschlange. Ein entdeckter Nachbar liegt eine Kante weiter entfernt als die Zelle, von der aus er entdeckt wurde. Durch die Reihenfolge der Warteschlange werden alle Zellen mit Abstand $d$ vor den Zellen mit Abstand $d+1$ verarbeitet. Eine spätere Entdeckung kann deshalb keinen Weg mit weniger Kanten ergeben. Die gespeicherte Richtung weist auf diesem ersten Weg zurück. Der Beweis setzt voraus, dass jede zulässige Kante gleich viel kostet und dass die Wand- und Eckprüfungen beim Aufbau einen festen Graphen bilden.

Das Ergebnis minimiert die **Anzahl der Rasterschritte**, nicht die genaue euklidische Weglänge. Ein diagonaler und ein gerader Schritt zählen jeweils als eine Kante, obwohl sie geometrisch unterschiedlich lang sind. Ein diagonaler Zellschritt ist $16\\sqrt{2}$ px lang, ein gerader dagegen 16 px. Ein Verfahren mit gewichteten Kanten würde eine andere Frage nach dem kürzesten Weg beantworten.

Das Feld wird gemeinsam genutzt: Befinden sich Spieler und eine bewegliche Einheit auf gegenüberliegenden Seiten einer Bastion und bewegt sich die Einheit bereits auf den Spieler zu, kann \`route()\` ihre gewünschte Geschwindigkeit durch die gespeicherte, normierte Richtung mal Geschwindigkeit ersetzen. Dies ist eine lokale Wegregel und keine allgemeine Lösung für kürzeste Wege um jedes Hindernis oder zu jedem beweglichen Ziel.


## Teil III. Raum, Klassifikation und erzeugte Texturen

### 7. Biome klassifizieren: kontinuierliches Klima und einzelne Stützpunkte

\`BIOME_COUNT\` umfasst derzeit 30 Einträge: 16 Grundbiome, 10 zusätzliche Biome und 4 Küstenbiome. Der Küstenzweig wird zuerst anhand von \`landAt(x,y)\` entschieden; im Landesinneren wird das Klima an einem ausgewählten Stützpunkt abgetastet. Dieser Unterschied ist mathematisch bedeutsam. Ein glattes Klimafeld bestimmt das endgültige Biom nicht allein, denn eine Küstenschwelle kann es überschreiben, bevor die Klassifikation des Landesinneren beginnt (\`src/level/biome/Biome.cpp\`).

#### Die kontinuierliche Klimalandschaft

Kachelkoordinaten $(x, y)$ werden mit $\\text{CLIMATE\\_SCALE} = 2.5$ skaliert:

$s_x = \\frac{x}{2.5}, \\qquad s_y = \\frac{y}{2.5}$

Um Rasterartefakte zu vermeiden, werden die skalierten Koordinaten durch Rauschen mit mehreren Oktaven verzerrt:

$w_x = s_x + 5 \\cdot \\text{fBm}_2(0.045 s_x + 11.3, \\; 0.045 s_y - 4.1, \\; 701) + 0.9 \\cdot \\text{Perlin}(0.23 s_x + 3.1, \\; 0.23 s_y - 8.7, \\; 703)$
$w_y = s_y + 5 \\cdot \\text{fBm}_2(0.045 s_x - 7.7, \\; 0.045 s_y + 9.2, \\; 702) + 0.9 \\cdot \\text{Perlin}(0.23 s_x - 5.3, \\; 0.23 s_y + 2.9, \\; 704)$

An der verzerrten Koordinate $(w_x, w_y)$ bestimmen vier kontinuierliche Rauschfelder das Klimatupel $\\mathbf{C} = (T, M, E, W)$:
* **Temperatur ($T$):** $\\text{fBm}_3(0.011 w_x, \\; 0.011 w_y, \\; 101)$
* **Feuchtigkeit ($M$):** $\\text{fBm}_3(0.013 w_x + 40.5, \\; 0.013 w_y, \\; 202)$
* **Unheimlichkeit ($E$):** $\\text{fBm}_2(0.017 w_x, \\; 0.017 w_y - 60.5, \\; 303)$
* **Wildheit ($W$):** $\\text{fBm}_2(0.012 w_x + 123.5, \\; 0.012 w_y - 77.5, \\; 505)$

#### Quantisierung durch Voronoi-Stützpunkte (\`siteOf\`)

Statt jede Kachel im Landesinneren anhand ihres eigenen Klimawerts zu klassifizieren, wählt \`siteOf(x,y)\` einen nahe gelegenen, versetzten Stützpunkt und klassifiziert dessen Klima. Auch die Stützpunktskala hängt vom Ort ab. Sei $h(x,y)=\\operatorname{clamp}(1-\\sqrt{x^2+y^2}/1000,0,1)$ und $F$ der im Quellcode verwendete Rauschaufruf mit zwei Oktaven. Dann gilt

$$n(x,y)=F(0.0006x+5.3,\\;0.0006y-8.9;617)+0.7h^2(3-2h).$$

Die Skala beträgt $q=6$ bei $n<-0.12$, $q=3$ bei $-0.12\\le n<0.1$ und sonst $q=1$. Die Zellbreite ist daher $c=112q$ Kacheln, also 672, 336 oder 112 Kacheln. Im Quellcode heißen die größeren Bereiche weitläufige und Provinzskalen. Eine einzige feste Voronoi-Zellgröße würde den aktuellen Algorithmus deshalb falsch beschreiben.

Mit der Frequenz $\\phi=0.018/q$ ergibt sich für die Auswahl des Stützpunkts der verzerrte Punkt

$f_x=x+30q\\,\\text{fBm}_2(\\phi x+3.7,\\;\\phi y-1.3;611)+3\\,\\text{Perlin}(0.09x,\\;0.09y+5.1;612)$
$f_y=y+30q\\,\\text{fBm}_2(\\phi x-8.1,\\;\\phi y+6.4;613)+3\\,\\text{Perlin}(0.09x+2.3,\\;0.09y;614)$

Beim Zellindex $(c_x,c_y)=(\\lfloor f_x/c\\rfloor,\\lfloor f_y/c\\rfloor)$ untersucht der Generator diese Zelle und ihre acht Nachbarn. Ein möglicher Stützpunkt in Zelle $(i,j)$ liegt bei

$$P_{i,j}=c\\left(i+0.15+0.70\\frac{h_x}{255},\\quad j+0.15+0.70\\frac{h_y}{255}\\right),$$

wobei $h=\\text{hash2}(73i+\\text{noise\\_salt}+\\text{salt},151j-\\text{noise\\_salt}-\\text{salt})$, $h_x=h\\mathbin{\\&}255$, $h_y=(h\\gg8)\\mathbin{\\&}255$ und $\\text{salt}=0$ für $q=1$, sonst $977q$. Unter den neun Kandidaten wird der Stützpunkt mit dem kleinsten $\\|\\mathbf f-P_{i,j}\\|^2$ gewählt. Dies ist eine lokale Suche nach dem nächsten Stützpunkt in verzerrten Koordinaten. Da $q$ vom Abfrageort abhängt, entsteht kein einzelnes globales Voronoi-Diagramm mit einer einheitlichen Menge von Stützpunkten. Übergänge zwischen den Skalen schaffen zusätzliche Biomgrenzen.

#### Radiale Abschwächung vom Ursprung aus (kubische Hermite-Funktion)

Um das Startgebiet eher ruhigen Biomen zuzuordnen, misst der Code den Abstand $d=\\sqrt{s_x^2+s_y^2}$ der **Kachelkoordinaten des ausgewählten Voronoi-Stützpunkts** vom Weltursprung. Diese Stützpunktkoordinaten sind nicht die zuvor verwendeten skalierten Klimakoordinaten. Unheimlichkeit und Wildheit werden mit einer kubischen Glättungsfunktion abgeschwächt:

$u = \\text{clamp}\\left(\\frac{d - 260}{400}, \\; 0, \\; 1\\right), \\qquad \\beta(d) = u^2 (3 - 2u)$
$E' = E \\cdot \\beta(d), \\qquad W' = -1 + (W + 1) \\cdot \\beta(d)$

Für $d \\le 260$ Kacheln ist $\\beta(d)=0$; dadurch wird Unheimlichkeit auf null und Wildheit auf $-1$ gesetzt. Dort entfallen die Zweige für unheimliche und zusätzliche Biome, während die übrigen Temperatur- und Feuchtigkeitsregeln weiterhin verschiedene gewöhnliche Biome auswählen können. Ab $d \\ge660$ Kacheln gelten die ursprünglichen Klimawerte.

#### Klassifikation des Landesinneren und Vorrang der Küste (\`biomeOf\`)

Das Klimatupel $\\mathbf{C}' = (T, M, E', W')$ wird durch geordnete Schwellenprüfungen auf 26 Biome des **Landesinneren** verteilt:
1. **Wildheit ($W' > 0.2$):** Ordnet die 10 zusätzlichen Biome fünf Temperaturbereichen ($T < -0.20$, $T < -0.07$, $T < 0.07$, $T < 0.20$, $T \\ge 0.20$) zu, die nach dem Vorzeichen der Feuchtigkeit ($M > 0$) unterteilt werden.
2. **Unheimlichkeit ($E' > 0.14$):** Unterscheidet Aschelande ($T > 0.12$), Kristallfelder ($T < -0.12$), Pilzwald ($M > 0.06$) und Hügelgräber ($M \\le 0.06$).
3. **Übrige Grundbiome:** Klassifiziert die anderen 12 Grundbiome (Taiga, Schnee, Dschungel, Ödland, Wüste, Heide, Savanne, Blütenland, Moor, Herbstwald, Wald, Wiese). Wo sich Bedingungen überschneiden, ist die Reihenfolge entscheidend; \`biomeOf()\` gibt den ersten Treffer zurück.

Vor diesem Zweig für das Landesinnere prüft \`biomeForLocation()\` den Wert $L=\\text{landAt}(x,y)$. Bei $L<0$ wählt die Funktion tropisches oder kaltes Meer; bei $0\\le L<0.012$ einen warmen oder kalten Strand. Die Wärme ergibt sich aus dem Vorzeichen einer eigenen Rauschprobe mit zwei Oktaven, nicht aus der Temperatur $T$ des Landesinneren. Die vier Küstenbiome gehören daher nicht zu dessen 26 Klassifikationsergebnissen.

Schließlich wendet \`biomeAt(x, y)\` eine Mehrheitsentscheidung über $3 \\times 3$ Kacheln an:

$B(x, y) = \\arg\\max_{b} \\sum_{dy=-1}^{1} \\sum_{dx=-1}^{1} \\mathbb{I}(\\text{rawBiome}(x+dx, \\; y+dy) == b)$

Der Code setzt zunächst das ursprüngliche Biom der Kachel als Gewinner ein und bevorzugt dieses Biom bei Gleichstand mit dem führenden Ergebnis. Das angegebene $\\arg\\max$ steht somit verkürzt für eine Abstimmung mit einer besonderen Gleichstandsregel. Der Filter entfernt viele vereinzelte Ausreißer aus nur einer Kachel, macht die Klassifikation aber nicht kontinuierlich: Küsten- und Klimaschwellen erzeugen weiterhin scharfe Grenzen.

#### Einordnung der geografischen Untersuchung mit 100.000 Kacheln

Der Koordinatenteiler $2.5$ senkt die Frequenz des Klimarauschens: Strukturen in diesen Feldern erstrecken sich über etwa $2.5$-mal so viele Eingabekacheln, bevor die eigene Voronoi-Auswahl und der Mehrheitsfilter angewendet werden. Daraus allein folgt nicht die endgültige Größe jedes Bioms. Die früher gemessene Anzahl von Grenzen ist eine historische Beobachtung und keine mathematische Garantie für jeden Startwert oder spätere Versionen des Generators.

### 8. Biomschichten: Übergänge an der Oberfläche und Schichten im Untergrund

Mellangan setzt Biomschichten in zwei verschiedenen Raumrichtungen um: waagerechte, nach Gewichten gemischte Bodenübergänge an der Oberfläche und einzelne senkrechte Schichten in der Unterwelt (\`src/level/world/Biomes.cpp\`, \`Ground.cpp\`, \`Under.cpp\`, \`FloorPainter.cpp\`).

#### Waagerechte Bodenmischung mit Gewichten (\`groundBlend\`)

Um harte Kachelübergänge abzumildern, mischt \`world::groundBlend(x, y)\` bis zu drei benachbarte Biome. Ein Gitterpunkt verwendet eine Schablone aus $5\\times5$ Biomproben. Die Ergebnisse werden auf einem Gitter mit zwei Kacheln Abstand zwischengespeichert und für dazwischenliegende Kacheln interpoliert. Die Schablone muss daher nicht für jede gezeichnete Kachel neu berechnet werden.

##### 1. Glättung mit einer binomialen Schablone
An den Gitterkoordinaten $(x_0, y_0) = (2 \\lfloor x/2 \\rfloor, \\; 2 \\lfloor y/2 \\rfloor)$ wird eine Umgebung aus $5 \\times 5$ Kacheln mit den trennbaren binomialen Gewichten $K = [1, 2, 3, 2, 1]$ ausgewertet:

$\\text{totals}[b] = \\sum_{iy=-2}^{2} \\sum_{ix=-2}^{2} K[ix + 2] \\cdot K[iy + 2] \\cdot \\mathbb{I}(\\text{biomeAt}(x_0 + 2ix, \\; y_0 + 2iy) == b)$

Die Summe der Gewichte beträgt $(1 + 2 + 3 + 2 + 1)^2 = 81$. \`compactBlend()\` wählt die drei Biome mit den höchsten Gesamtgewichten und normiert ihre Summe auf $1.0$:

$\\mathbf{w} = (w_1, w_2, w_3), \\qquad \\sum_{i=1}^{k} w_i = 1.0 \\quad (k \\le 3)$

##### 2. Geglättete bilineare Interpolation
Die Bruchteile innerhalb einer Kachel, $f_x = (x - x_0)/2$ und $f_y = (y - y_0)/2$, werden mit kubischen Hermite-Kurven umgeformt:

$S_x = f_x^2 (3 - 2f_x), \\qquad S_y = f_y^2 (3 - 2f_y)$

Die Mischgewichte der vier Ecken der $2 \\times 2$-Zelle werden mit $S_x$ und $S_y$ bilinear interpoliert und anschließend erneut auf die drei vorherrschenden Biome reduziert. Vor dieser letzten Kürzung sind die vier bilinearen Koeffizienten nichtnegativ und ergeben zusammen eins. Auch jede Eckmischung ergibt eins; ihre gewichtete Mischung hat deshalb ebenfalls die Summe eins. \`compactBlend()\` verwirft alle bis auf die drei stärksten Anteile und normiert diese erneut. Die Normierung bleibt somit erhalten, während der genaue Beitrag eines verworfenen vierten Bioms bewusst verloren geht. Wechselt das Biom auf Rang drei, kann dennoch ein sichtbarer Übergang entstehen.

**Satz 4 (Wahrscheinlichkeitsvektor nach beiden Kürzungen).** Sind die Eingangsgewichte endlich und nichtnegativ und ist mindestens eines positiv, liefert \`compactBlend()\` höchstens drei verschiedene Biome mit nichtnegativen Gewichten und Summe eins, abgesehen von Rundungsfehlern.

*Beweis, erster Schritt: Auswahl und Normierung.* Die Auswahl nimmt jeweils einen bislang unbenutzten Index mit maximalem positivem Gewicht. Daher erscheint kein Biom zweimal. Sei $A$ die Menge der ausgewählten Indizes, $v_b$ das Eingangsgewicht von Biom $b$ und $W=\\sum_bv_b>0$. Die erste Normierung ergibt $v_b/W$ für $b\\in A$. Deren Summe ist

$$\\begin{aligned}
S&=\\sum_{b\\in A}\\frac{v_b}{W}\\\\
 &=\\frac{\\sum_{b\\in A}v_b}{W}>0.
\\end{aligned}$$

Nach der zweiten Normierung hat jedes ausgewählte Biom das Gewicht

$$\\begin{aligned}
\\frac{v_b/W}{S}
&=\\frac{v_b}{\\sum_{a\\in A}v_a}.
\\end{aligned}$$

Alle diese Gewichte sind nichtnegativ und summieren sich auf eins.

*Zweiter Schritt: Interpolation.* Für $S_x,S_y\\in[0,1]$ sind die vier Eckkoeffizienten $(1-S_x)(1-S_y)$, $S_x(1-S_y)$, $(1-S_x)S_y$ und $S_xS_y$ nichtnegativ. Ihre Summe ist

$$[(1-S_x)+S_x][(1-S_y)+S_y]=1.$$

Ein solches gewichtetes Mittel normierter Eckvektoren ist wieder nichtnegativ und normiert. Die erneute Auswahl der drei größten Anteile erfüllt somit die Voraussetzungen des ersten Schritts. $\\square$

Die Auswahl ist eine diskrete Operation. Aus der Normierung folgt keine Stetigkeit der **gekürzten** Gewichte, wenn das Biom auf Rang drei wechselt.

##### 3. Rekursive Zusammensetzung mit Alphawerten
\`FloorPainter::blend()\` zeichnet bis zu drei Bodenoberflächen nacheinander. Das maßgebliche Biom der örtlichen Kachel (\`own\`) steht an Index 0, gefolgt von fremden Biomen. Die Deckkraft $\\alpha_i$ für Schicht $i$ lautet:

$\\alpha_0 = 1.0, \\qquad \\alpha_i = \\frac{w_i}{\\sum_{j=0}^{i} w_j} \\quad (i \\ge 1)$

**Satz (Erhaltung der Gewichte beim Mischen in mehreren Durchläufen):**
Nach dem Zeichnen bis einschließlich Schicht $i-1$ ist die dargestellte Farbe das gewichtete Mittel dieser Schichten mit dem Gesamtgewicht $C_{i-1} = \\sum_{j=0}^{i-1} w_j$. Wird Schicht $i$ mit der Deckkraft $\\alpha_i=w_i/(C_{i-1}+w_i)$ gezeichnet, entsteht das gewichtete Mittel bis einschließlich Schicht $i$.

*Beweis durch Induktion über die Schichten.* Die Grundschicht wird deckend gezeichnet, also $F_0=c_0$ und $C_0=w_0$. Angenommen, nach Schicht $i-1$ gilt $F_{i-1}=\\sum_{j<i}w_jc_j/C_{i-1}$. Mit $\\alpha_i=w_i/(C_{i-1}+w_i)$ ist der Anteil der bisherigen Farbe

$$1-\\alpha_i=\\frac{C_{i-1}}{C_{i-1}+w_i}.$$

Die gewöhnliche Alphaüberlagerung wird damit

$$\\begin{aligned}
F_i&=(1-\\alpha_i)F_{i-1}+\\alpha_i c_i\\\\
   &=\\frac{C_{i-1}F_{i-1}+w_ic_i}{C_{i-1}+w_i}\\\\
   &=\\frac{\\sum_{j<i}w_jc_j+w_ic_i}{\\sum_{j<i}w_j+w_i}\\\\
   &=\\frac{\\sum_{j\\le i}w_jc_j}{\\sum_{j\\le i}w_j}.
\\end{aligned}$$

Damit gilt die Behauptung auch für Schicht $i$. Bei normierten Endgewichten ist $\\sum_jw_j=1$, also lautet die endgültige Farbe $\\sum_jw_jc_j$. Dies beschreibt die Alphagewichte vor Einfärbung, Texturdetails und späterer Beleuchtung. $\\square$

#### Senkrechte Schichtung im Untergrund (\`Under.cpp\`)

Das Spielsystem beschreibt die Tiefe der Welt durch drei getrennte senkrechte Ebenen:

$\\text{Ebene} \\in \\{\\text{Oberfläche}, \\; \\text{Höhlen}, \\; \\text{Tiefe}\\}$

Ein Ebenenwechsel aktualisiert den Zeiger auf die aktive Ebene und erhöht \`noise_epoch\`. Dadurch werden die gespeicherten Kachelergebnisse (\`memos\`) ungültig.

##### 1. Zufallsbasierte Klassifikation von Höhlenzellen ($64 \\times 64$ Kacheln)
Der Untergrund ist in Zellen aus $64 \\times 64$ Kacheln eingeteilt (\`CAVE_CELL = 64\`). Der Zell-Hash beginnt mit $h=\\text{hash2}(73c_x+11,151c_y-7)$. \`kindOf()\` reserviert die Reste $h\\bmod100<40$ für massives Gestein und skaliert die übrigen 60 Reste mittels Ganzzahldivision um: $r=\\lfloor100((h\\bmod100)-40)/60\\rfloor$. Die anfängliche Einteilung lautet:

| Art | Ursprüngliche Reste | Anzahl von 100 |
|:---|:---|---:|
| Massives Gestein | 0–39 | 40 |
| Hohlraum | 40–72 | 33 |
| Durchgang | 73–87 | 15 |
| Höhlensystem | 88–94 | 7 |
| Abstieg | 95–99 | 5 |

Dies sind Anzahlen von Hash-Resten, keine garantierten Häufigkeiten in einer endlichen Karte. Bei der weiteren Erzeugung kann eine Zelle verworfen oder ein Durchgang mit zu wenigen Öffnungen in einen Hohlraum umgewandelt werden. Die fertige Welt muss diese Anteile daher nicht genau einhalten.

##### 2. Ausschneiden gedrehter elliptischer Kammern
Jede Kammer $r$ wird als um den Winkel $\\theta$ gedrehte Ellipse mit Mittelpunkt $(m_x, m_y)$ und Halbachsen $(r_a, r_b)$ ausgeschnitten:

$u = (x - m_x) \\cos \\theta + (y - m_y) \\sin \\theta, \\qquad v = (y - m_y) \\cos \\theta - (x - m_x) \\sin \\theta$
$e(x, y) = \\frac{u^2}{r_a^2} + \\frac{v^2}{r_b^2} + 0.35 \\cdot \\text{fBm}_2(0.08 x + 3.7, \\; 0.08 y - 1.9, \\; 3011)$

Eine Kachel wird ausgehöhlt, wenn $e(x, y) < 1.0$ ist und die Schwellenwerte des zellulären Rauschens erfüllt sind. Gänge zwischen Räumen entstehen durch lineare Strahlinterpolation mit veränderlicher Breite.

##### 3. Übernahme von Klima und Biom in der Tiefe
Unterirdische Höhlen behalten einen thematischen Bezug zur Oberfläche. In \`under::biomeAt(x, y)\` führt die Funktion Folgendes aus:
\`\`\`cpp
Surfaced up;
return world::biomeAt(x, y);
\`\`\`
Das vorübergehende RAII-Objekt \`Surfaced\` setzt \`active\` auf \`Layer::Surface\`, fragt das maßgebliche Biom der darüberliegenden Oberfläche ab und stellt beim Auflösen die zuvor aktive Ebene wieder her. Die Auswahl des Höhlenbioms ordnet dieses Oberflächenbiom anschließend mit \`caveBelow()\` zu; die tiefe Ebene wählt ihr eigenes Biom gesondert.

#### Einordnung der drei Weltebenen

Die senkrechte Verknüpfung zwischen Oberflächenklima und Höhlenerzeugung schafft einen erkennbaren Übergang. Beim Abstieg durch einen Höhleneingang bei $(x, y)$ übernimmt das unterirdische Biom Merkmale der Welt darüber, während an die Stelle des offenen Himmels eine Höhlendecke, Dunkelheit und unterirdische Gewässer treten.


### 9. Prozedurales Rauschen: Hash ohne Zwischenspeicher und gedrehte fraktale Brownsche Bewegung

Für kontinuierliche räumliche Unterschiede verwendet \`src/level/Noise.c\` einen Koordinaten-Hash statt einer Permutationstabelle, eine feste Tabelle mit 16 Gradienten, Interpolation fünften Grades und gedrehte fraktale Oktaven. Der Hash hängt von ganzzahligen Gitterkoordinaten, einem vom Aufrufer übergebenen Startwert und einem zusätzlichen Weltwert ab; ein anderer Weltwert verändert das erzeugte Muster.

#### Analytischer Hash ohne Zwischenspeicher (\`noise_hash\`)

Aus zweidimensionalen ganzzahligen Gitterkoordinaten $(ix, iy) \\in \\mathbb{Z}^2$, einem regionalen Startwert $S$ und einem zusätzlichen Weltwert $\\sigma$ mischt \`noise_hash\` alle 32 Bits mithilfe großer Primzahl-Multiplikatoren und Bitverschiebungen nach dem Murmur-Verfahren:

$$h_0 = (ix \\cdot K_x) \\oplus (iy \\cdot K_y) \\oplus (S \\cdot K_s) \\oplus (\\sigma \\cdot K_\\phi)$$

$$h_1 = h_0 \\oplus (h_0 \\gg 13), \\qquad h_2 = h_1 \\cdot M, \\qquad h_{\\text{final}} = h_2 \\oplus (h_2 \\gg 15)$$

wobei gilt:
- $K_x = \\text{0x8DA6B343} = 2376487747$
- $K_y = \\text{0xD8163841} = 3625293889$
- $K_s = \\text{0xCB1AB31F} = 3407467295$
- $K_\\phi = \\text{0x9E3779B1} = 2654435761$ (aus dem goldenen Schnitt $2^{32} \\cdot (\\sqrt{5} - 1)/2$ abgeleitet)
- $M = \\text{0x5BD1E995} = 1540483477$ (Mischkonstante von MurmurHash2)

Dieses Verfahren benötigt keinen Zugriff auf eine Permutationstabelle. Die genaue Anzahl von Anweisungen, das Zwischenspeicherverhalten und die benötigten Prozessortakte hängen vom Compiler und der Ziel-CPU ab. Der Quellcode belegt daher den Algorithmus, aber keine allgemeingültige Laufzeitangabe.

#### Der Ring aus 16 gleichmäßig verteilten Gradienten

Klassische Implementierungen wählen zufällig aus 4 oder 8 Hauptrichtungen. Mellangan berechnet vorab 16 gleichwinklig verteilte zweidimensionale Einheitsvektoren, die mit $\\sqrt{2}$ skaliert sind:

$$\\mathbf{g}_k = \\sqrt{2} \\begin{pmatrix} \\cos\\left(k \\frac{\\pi}{8}\\right) \\\\ \\sin\\left(k \\frac{\\pi}{8}\\right) \\end{pmatrix}, \\qquad k \\in \\{0, 1, \\dots, 15\\}$$

Der Gradientenindex stammt aus den obersten 4 Bits des durchmischten Hash-Werts:

$$k = h_{\\text{final}} \\gg 28$$

Die Tabelleneinträge haben abgesehen von dezimalen Rundungen ungefähr die Länge $\\sqrt{2}$. Bei einem Abstand $\\mathbf d$ von einer Ecke ist das Skalarprodukt $\\mathbf g_k\\cdot\\mathbf d$ und erfüllt nach Cauchy-Schwarz die Schranke $|\\mathbf g_k\\cdot\\mathbf d|\\le\\sqrt{2}\\|\\mathbf d\\|$. Diese Schranke erklärt die gewählte Skalierung; sie beweist nicht, dass Rauschproben die beiden Endpunkte von $[-1,1]$ erreichen.

#### Abrunden negativer Koordinaten und Glättung fünften Grades mit $C^2$-Stetigkeit

Um Fehler beim Abschneiden negativer Koordinaten zu vermeiden (eine gewöhnliche C-Umwandlung von \`(int32_t)-0.5f\` rundet gegen null auf \`0\` statt auf \`-1\`), berechnet Mellangan die abgerundeten Koordinaten ohne Verzweigung:

$$\\text{ifloor}(v) = \\lfloor v \\rfloor = \\text{int}(v) - [v < \\text{float}(\\text{int}(v))]$$

Innerhalb jeder Gitterzelle werden die gebrochenen Koordinaten $(dx, dy) = (x - \\lfloor x \\rfloor, y - \\lfloor y \\rfloor)$ mit Ken Perlins Polynom fünften Grades geglättet:

$$u = \\text{fade}(dx) = 6 dx^5 - 15 dx^4 + 10 dx^3 = dx^3 (dx (6 dx - 15) + 10)$$

$$v = \\text{fade}(dy) = 6 dy^5 - 15 dy^4 + 10 dy^3 = dy^3 (dy (6 dy - 15) + 10)$$

Für die erste und zweite Ableitung der Glättungskurve fünften Grades gilt:

$$f'(0) = f'(1) = 0, \\qquad f''(0) = f''(1) = 0$$

An ganzzahligen Grenzen verschwinden sowohl die erste als auch die zweite Ableitung der Glättungskurve. Zusammen mit den gemeinsamen Eckgradienten gehen der interpolierte Wert und seine ersten beiden Ableitungen im idealen mathematischen Modell an Zellrändern glatt ineinander über; die Berechnung mit Gleitkommazahlen bleibt eine Näherung.

**Satz 5 ($C^2$-Anschluss an einer Gitterkante).** Im idealen Modell mit reeller Arithmetik und gleichen Hash-Ergebnissen für dieselbe Ecke passen Wert, erste und zweite Ableitungen des Gradientenrauschens an einer Gitterkante zusammen.

*Beweis.* Fixiere zunächst eine waagerechte Teilzelle und betrachte die Grenze $x=m$ zweier benachbarter Zellen. Die Interpolation in $x$ hat in jeder Zelle die Form

$$L(x)=(1-f(t))A(x)+f(t)B(x),\\qquad t\\in[0,1].$$

Nach der Interpolation in $y$ sind $A$ und $B$ weiterhin affin in $x$. Links der Grenze ist $t=1$, rechts ist $t=0$. Die gemeinsame Gitterkante liefert auf beiden Seiten dieselben Eckgradienten und somit dieselbe Randfunktion $G(y)$. Die Bedingungen $f(1)=1$ und $f(0)=0$ geben auf beiden Seiten den Wert $G(y)$.

Beim ersten und zweiten Ableiten nach $x$ fallen alle Terme mit $f'$ und $f''$ an den Rändern weg, denn

$$f'(0)=f'(1)=f''(0)=f''(1)=0.$$

Übrig bleiben die entsprechenden Ableitungen der gemeinsamen affinen Kantendaten; die zweite reine $x$-Ableitung ist dort null. Da die Randfunktion $G(y)$ auf beiden Seiten dieselbe ist, stimmen auch ihre $y$-Ableitungen überein. Dasselbe gilt für gemischte Ableitungen, wenn man die übereinstimmenden Ausdrücke nach $y$ ableitet. Die waagerechten Gitterkanten folgen durch Vertauschen von $x$ und $y$. $\\square$

Endliche Gleitkommapräzision garantiert keine bitgenaue Ableitungsstetigkeit.

#### Gedrehte fraktale Brownsche Bewegung (\`noise_fbm\`)

Werden Oktaven von unverändertem Perlin-Rauschen entlang der Hauptachsen addiert, entstehen sichtbare Ausrichtungsartefakte, weil die Gitterlinien jeder Oktave mit den Achsen zusammenfallen. Um diese wiederkehrende Ausrichtung zu vermeiden, multipliziert Mellangan den Koordinatenvektor bei jeder Oktave mit einer pythagoreischen Rotationsmatrix:

$$\\begin{pmatrix} x_{i+1} \\\\ y_{i+1} \\end{pmatrix} = \\begin{pmatrix} 1.6 & -1.2 \\\\ 1.2 & 1.6 \\end{pmatrix} \\begin{pmatrix} x_i \\\\ y_i \\end{pmatrix}$$

Diese Umformung lässt sich in eine genaue Frequenzskalierung und eine Drehung in der Ebene zerlegen:

$$\\begin{pmatrix} 1.6 & -1.2 \\\\ 1.2 & 1.6 \\end{pmatrix} = 2.0 \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}, \\qquad \\theta = \\arctan\\left(\\frac{1.2}{1.6}\\right) = \\arctan(0.75) \\approx 36.87^\\circ$$

Wichtige mathematische Eigenschaften:
1. **Genaue Frequenzverdopplung:** Weil $1.6^2 + 1.2^2 = 2.56 + 1.44 = 4.0 = 2.0^2$ gilt, verdoppelt sich die Frequenz ($\\lambda = 2.0$) mit jeder Oktave.
2. **Entkoppelte Gitterausrichtung:** Die Drehung des Gitters um $36.87^\\circ$ zwischen aufeinanderfolgenden Oktaven verringert die Übereinstimmung hochfrequenter und niederfrequenter Strukturen.
3. **Günstige Koordinatenumformung:** Die Matrix benötigt je Oktave vier Gleitkomma-Multiplikationen und zwei Additionen, aber keine Berechnung von Sinus oder Kosinus zur Laufzeit. Ihre Dezimalzahlen werden im binären Gleitkommaformat näherungsweise dargestellt.
4. **Fortschreibung des Startwerts:** Um das Gradientenmuster zwischen den Oktaven zu verändern, wird der Startwert jeweils um eine feste ungerade Konstante erhöht:
   $$S_i = S + i \\cdot \\text{0x9E3779B9u}$$
5. **Normierung der Amplitude:** Die Summe der Oktaven wird durch die Summe ihrer Amplituden geteilt:
   $$N_{\\text{fBm}}(\\mathbf{x}) = \\frac{\\sum_{i=0}^{m-1} 0.5^i \\cdot \\text{Perlin}(\\mathbf{x}_i, S_i)}{\\sum_{i=0}^{m-1} 0.5^i}$$
   Dies ist ein gewichtetes Mittel der Oktavenproben. Sein Wertebereich hängt vom tatsächlichen Wertebereich von \`noise_perlin()\` ab; allein die Division durch die Amplitudensumme beweist keine genaue Schranke von $[-1,1]$.

#### Anwendungen in anderen Spielsystemen

1. **Kontinuierliche Verzerrung des Klimas (\`src/level/biome/Biome.cpp\`):**
   Regionale Klimatupel $\\mathbf{C} = (T, M, \\eta, W)$ werden an verzerrten Koordinaten abgetastet:
   $$w_x = s_x + 5.0 \\cdot \\text{fBm}_2(0.045 s_x + 11.3, 0.045 s_y - 4.1) + 0.9 \\cdot \\text{Perlin}(0.23 s_x + 3.1, 0.23 s_y - 8.7)$$
2. **Dynamisches Flackern von Fackeln (\`src/level/LightField.cpp\`):**
   Lichtradien schwanken mit nicht kommensurablen Frequenzen ($3.1$ und $11.7$ rad/s); dadurch entsteht ein warmes, sich nicht genau wiederholendes Flackern:
   $$\\Delta L(t) = 1.0 + 0.10 \\cdot \\text{Perlin}(3.1 t, \\text{seed} \\cdot 0.37, 909) + 0.05 \\cdot \\text{Perlin}(11.7 t, \\text{seed} \\cdot 0.53, 910)$$
3. **Wolkenschichten mit Parallaxe (\`src/level/Sky.cpp\`):**
   Die Wolkendecke verbindet eine langsame, durch Parallaxe verschobene Windbewegung $(o_x, o_y)$ mit hochfrequenten Wirbeln am Horizont, um räumliche Tiefe in der Atmosphäre darzustellen.

## Teil IV. Zeitliche Entwicklung und sichtbare Effekte

### 10. Partikelbewegung: zuerst die Zeiteinheit bestimmen

\`Spark\` und \`Drift\` speichern waagerechte Geschwindigkeiten in Pixeln pro Sekunde und multiplizieren die Verschiebung mit $\\Delta t$. \`Debris\` speichert Geschwindigkeiten und Schwerkraft dagegen in Pixeln pro Simulationsschritt. Dieselben Namen der Mitgliedsvariablen \`xa\`, \`ya\` und \`za\` haben in diesen beiden Gruppen somit unterschiedliche Einheiten. Vor einem Vergleich ihrer Parameterwerte muss die jeweilige Aktualisierungsgleichung gelesen werden.

#### Dämpfung eines Funkens im Einzelnen

Bei einem Funken multipliziert ein Aktualisierungsschritt zuerst die Geschwindigkeit mit $k=e^{-5\\Delta t}$ und verschiebt ihn dann mit der gedämpften Geschwindigkeit:

$$\\mathbf v_{n+1}=e^{-5\\Delta t}\\mathbf v_n,\\qquad\\mathbf x_{n+1}=\\mathbf x_n+\\Delta t\\,\\mathbf v_{n+1}.$$

Bei 60 Hz gilt $k=e^{-5/60}\\approx0.9200$. Nach 30 Schritten oder einer halben Sekunde beträgt das Geschwindigkeitsverhältnis $k^{30}=e^{-2.5}\\approx0.0821$. Die Halbwertszeit der Geschwindigkeit ist $\\ln 2/5\\approx0.139$ Sekunden. Da die Bewegung die **neue**, bereits gedämpfte Geschwindigkeit verwendet, ergibt wiederholtes Einsetzen

$$\\mathbf x_n-\\mathbf x_0=\\Delta t\\sum_{j=1}^{n}k^j\\mathbf v_0=\\Delta t\\,\\mathbf v_0\\frac{k(1-k^n)}{1-k}.$$

**Satz 6 (Grenzwert und Zeitschrittfehler ohne Lebensdauerbegrenzung).** Setze $a=5\\,\\mathrm{s}^{-1}$ und $\\Delta t>0$. Ohne Lebensdauerbegrenzung besitzt die diskrete Bewegung einen endlichen Gesamtweg. Dessen Verschiebungsfaktor nähert sich für $\\Delta t\\to0$ dem kontinuierlichen Faktor $1/a$ von unten.

*Beweis, Konvergenz.* Aus $a\\Delta t>0$ folgt $0<k=e^{-a\\Delta t}<1$. Für $n\\to\\infty$ verschwindet $k^n$ in der obigen geometrischen Summe. Damit ist der Faktor
$$F_{\\Delta t}=\\Delta t\\frac{k}{1-k}=\\frac{\\Delta t}{e^{a\\Delta t}-1}.$$

*Schranke.* Für $z=a\\Delta t>0$ gilt $e^z-1>z$. Deshalb

$$\\begin{aligned}
0<F_{\\Delta t}
&=\\frac{\\Delta t}{e^z-1}\\\\
&<\\frac{\\Delta t}{z}\\\\
&=\\frac1a.
\\end{aligned}$$

*Grenzwert und Fehler.* Mit $e^z-1=z+z^2/2+O(z^3)$ und $z=a\\Delta t$ erhält man
$$F_{\\Delta t}=\\frac1a-\\frac{\\Delta t}{2}+O(\\Delta t^2),\\qquad\\lim_{\\Delta t\\to0}F_{\\Delta t}=\\frac1a.$$

Dies beweist den kleineren Faktor des diskreten Gesamtwegs in Richtung der Anfangsgeschwindigkeit. Für Vektoren bedeutet „unter“ keine Vektorordnung. Die Aussage betrifft nur die reine Dämpfungsrekursion ohne Ende der Partikellebensdauer, Kollision oder weitere Kraft.

Der Verschiebungsfaktor für unendlich lange Zeit beträgt bei 60 Hz ungefähr $0.192$ s mal Anfangsgeschwindigkeit, gegenüber $0.2$ s für die kontinuierliche Differentialgleichung $d\\mathbf v/dt=-5\\mathbf v$. Der kleine Unterschied entsteht durch die Reihenfolge der diskreten Aktualisierung und nicht durch eine andere Bremskonstante. Die endliche Lebensdauer des Funkens verkürzt den tatsächlichen Weg weiter. Aus der Dämpfung allein folgen weder Schwerkraft noch Kollisionen mit Wänden; diese Verhaltensweisen gehören zu anderen Effekten.

\`Drift\` fügt nach der Dämpfung die Schwerkraft hinzu: $v_{y,n+1}=kv_{y,n}+g\\Delta t$, wobei $k=e^{-d\\Delta t}$ und $d$ der Bremskoeffizient ist. Bei konstantem $g$ und $d>0$ nähert sich diese diskrete Rekursion $v_{y,\\infty}=g\\Delta t/(1-e^{-d\\Delta t})$. Das Schwanken ist ein eigener schwingender Anteil der waagerechten Verschiebung; die Drehung verändert die Ausrichtung des Bildes.

#### Trümmer verwenden Einheiten pro Simulationsschritt

Für Trümmer in der Luft lautet die grundlegende Aktualisierung $v_{x,n+1}=d v_{x,n}$, $v_{y,n+1}=d v_{y,n}$ und $v_{z,n+1}=v_{z,n}-g$, ohne Faktor $\\Delta t$. In Bodennähe verwendet die waagerechte Dämpfung $0.85$ statt $d$. Das Objekt versucht $\\lfloor\\|\\mathbf v\\|+1\\rfloor$ Teilschritte mit getrennten Achsen; blockierte Geschwindigkeitsanteile kehren ihre Richtung um und werden um den Rückprallfaktor verkleinert. Die übliche Lebensdauer von 40–59 Schritten entspricht bei 60 Hz etwa 0.67–0.98 Sekunden. Da dies diskrete Spieleffekte sind, erfordert die Umrechnung von $g$ in eine Beschleunigung pro Sekunde die Multiplikation mit $60^2$ sowie die Berücksichtigung der genauen Aktualisierungsreihenfolge. Kollisionen und das Verhalten einzelner Unterklassen behandelt das eigene Partikelkapitel.

### 11. Reaktiver Boden als diskreter Zustandsautomat

\`Matter\` speichert für jede belegte Kachel einen Zustand und einen Zeitzähler. Die eigene Uhr schreitet alle $0.1$ Sekunden fort, obwohl das Spiel alle $1/60$ Sekunden einen Schritt ausführt. Wird eine Kachel für die Dauer $T$ gesetzt, enthält der Zähler ungefähr $T/0.1$ Zehntelsekunden. Der Ablauf richtet sich nach der Tabelle \`EXPIRE\`; eintreffendes Feuer, Kälte, Wasser, Ladung oder Sporen folgen \`REACTIONS\` in \`LevelMatter.cpp\`.

Eine nasse Kachel, die bei $t=0$ abgekühlt wird, gefriert beispielsweise für 12 Sekunden. Danach wird sie für weitere 6 Sekunden nass und nimmt schließlich den leeren Zustand an. Dies ist eine Folge von Zustandsübergängen, $\\text{Nass}\\xrightarrow{\\text{Kälte}}\\text{Gefroren}\\xrightarrow{12s}\\text{Nass}\\xrightarrow{6s}\\text{Leer}$, keine kontinuierliche Temperaturgleichung.

Feuer breitet sich jeden zehnten Materieschritt aus, also ungefähr einmal pro Sekunde. Dabei prüft es die vier direkten Nachbarn und setzt sowohl einen leeren gespeicherten Zustand als auch ein brennbares Objekt voraus. Die Suche merkt Änderungen vor und wendet sie erst danach an.

**Behauptung: Ein Ausbreitungsdurchlauf kann gewöhnliches Feuer nicht über zwei zuvor unbeleuchtete Kacheln in einer Reihe tragen.** Jede während des Durchlaufs untersuchte Quelle brannte bereits zu Beginn der Suche; neu vorgemerkte Änderungen werden erst danach brennend. Die zweite unbeleuchtete Kachel kann die erste neu entzündete Kachel deshalb erst in einem späteren Durchlauf als Quelle nutzen. Entlang eines durchgehenden, eine Kachel breiten Streifens aus Brennstoff rückt die Front pro Durchlauf höchstens um eine Kachel oder 16 Weltpixel vor. Der Beweis gilt für diese gewöhnliche Ausbreitung; die Entzündung von Öl ist ein eigener, sofortiger Ausbruch auf acht Nachbarn und folgt dieser Schranke nicht. Ablaufende Zustände, fehlender Brennstoff und konkurrierende Zustände können die Front verlangsamen oder anhalten.

### 12. Geometrie der von Licht erzeugten Schatten

Für jede registrierte Lichtquelle in Reichweite misst \`LightField::cast()\` den ebenen Abstand $d$ zwischen Lichtquelle und Objekt. Abstände $d<6$ und $d>R$ werden übersprungen, wobei $R$ die Reichweite der Lichtquelle ist. Für geeignete Objekte berechnet die Funktion

$$f=1-\\frac{d}{R},\\qquad\\ell=H\\operatorname{clamp}\\left(\\frac{d}{48},0.35,2.2\\right),\\qquad a=\\operatorname{clamp}(1.5Sf,0,1),$$

wobei $H$ die Objekthöhe und $S$ die Lichtstärke bezeichnet. $\\ell$ bestimmt die Schattenlänge und $a$ den Alphawert des Schattens. Bei $d=48$, $R=120$ und $S=0.5$ beträgt der Abfall $0.6$, die Länge $H$ und der Alphawert $0.45$. Der Winkel ist $\\operatorname{atan2}(y-y_c,x-x_c)$ und weist von der Lichtquelle weg.

Die Verhältnisse $d/R$ und $d/48$ sind dimensionslos, wenn beide Entfernungen in Pixeln angegeben sind. Daher sind $f$ und $a$ dimensionslos, während $\\ell$ die Längeneinheit von $H$ behält. Diese Einheitenprüfung deckt einen häufigen Fehler auf: Würde $d$ in Kacheln an eine Formel übergeben, deren Konstanten 6, 48 und $R$ Pixelabstände sind, änderten sich sowohl die Auswahl der Objekte als auch die Schattenlänge um einen von der Kachelgröße abhängigen Faktor. Dies ist ein Modell für sichtbare Kontaktschatten mit begrenzter Länge und Deckkraft, keine Strahlverfolgung und kein Abstandsquadratgesetz für Licht.

## Teil V. Ebenenwechsel, Erinnerung und Kombinatorik der lebendigen Welt

### 13. Ebenenwechsel ohne Pendeln: eine Kachelmarke als Hysterese

Seit dem Umbau der Höhleneingänge genügt es, die Mitte eines Eingangs zu betreten. \`Game::step()\` läuft in jedem Simulationsschritt von \`Game::play()\` genau einmal, nach den Tastenwegen \`crack()\`, \`gather()\` und \`stairs()\` und vor dem Sturz in eine Kluft. Sei $\\Pi_\\ell$ die Menge der Durchgangskacheln der Ebene $\\ell$, also der Kacheln, für die \`world::passageAt()\` wahr liefert. Die **Fußkachel** des Helden im Schritt $n$ ist

$u_n=\\left(\\left\\lfloor x_n/16\\right\\rfloor,\\ \\left\\lfloor (y_n-4)/16\\right\\rfloor\\right),$

dieselbe Abbildung, die auch \`passageNear()\` verwendet. \`Level::landed\` speichert ein Bit $L_n\\in\\{0,1\\}$. Jede neu gebaute Ebene beginnt mit $L=1$; dazu gehören Reisen im Feldzug, das Laden eines Spielstands und ein neuer Lauf. Nach \`Level::shift()\` im Morgenlauf setzt \`Game::through()\` das Bit ausdrücklich. Die Aktualisierung lautet:

- **Fall 1:** $u_n\\notin\\Pi_\\ell$. Dann setzt \`step()\` $L\\leftarrow0$.
- **Fall 2:** $u_n\\in\\Pi_\\ell$ und $L=0$, der Held lebt und kein Gewölbe ist aktiv. Dann wechselt \`through()\` die Ebene, danach gilt $L=1$.
- **Fall 3:** $u_n\\in\\Pi_\\ell$ und $L=1$. Dann geschieht nichts.

**Satz 7 (kein sofortiger Rückweg).** Nach einer Ankunft durch einen Durchgang kann der nächste selbsttätige Wechsel erst erfolgen, nachdem die Fußkachel bei einer Prüfung außerhalb von $\\Pi_\\ell$ lag. Außerdem gibt es pro Simulationsschritt höchstens einen Wechsel durch Durchgänge.

*Beweis der ersten Aussage.* Nach der Ankunft gilt $L=1$: entweder durch den Standardwert der neuen Ebene oder durch die Zuweisung in \`through()\`. Fall 2, der einzige selbsttätige Wechsel, verlangt dagegen $L=0$. Nur Fall 1 setzt das Bit auf null, und sein Auslöser ist $u\\notin\\Pi_\\ell$. Eine Prüfung außerhalb der Durchgangskacheln muss also dazwischenliegen.

*Beweis der zweiten Aussage.* Hat ein Tastenweg im laufenden Schritt bereits gewechselt, sieht \`step()\` die neue Ebene mit $L=1$. Die drei Fälle schließen einander aus; \`step()\` kann \`through()\` höchstens einmal aufrufen. $\\square$

**Folgerung (Mindestweg für eine Rückkehr).** Die Ankunft setzt den Helden auf $(16w_x+8,\\ 16w_y+12)$. Dann ist $u=(w_x,w_y)$, denn $\\lfloor(16w_y+8)/16\\rfloor=w_y$. Liegt am Zielort selbst ein Durchgang, wie bei einem Höhlenmund und seinem Tageslicht unten oder bei beiden Enden einer Treppe, muss der Held zuerst die Kachel verlassen. Waagerecht trennen ihn $8$ Pixel von jedem Rand. Senkrecht liegt $y-4=16w_y+8$ ebenfalls $8$ Pixel von beiden Rändern entfernt. Eine Rückkehr verlangt also mindestens $8$ Pixel Weg hinaus und einen Schritt zurück. Die Marke wirkt wie eine Hysterese der Breite einer halben Kachel. Dieselbe Überlegung zeigt, dass ein geladener Spielstand auf einem Höhlenmund keinen Wechsel auslöst.

*Grenzen.* Der Sturz in eine Kluft ist eine eigene Regel in \`Game::fall()\` und gehört nicht zu $\\Pi$. Satz 7 schließt daher nicht aus, dass im selben Schritt nach einem Durchgang ein Sturz folgt, falls ein Ziel auf einer Kluftkachel läge.

### 14. Höhlenmünder an Klippen: Verschiebung mit beschränktem Abstand

An der Oberfläche wählt \`mouthProp()\` das Bild eines Höhlenmunds aus dem Gelände. Mit der Höhe $h$ heißt eine Kachel **Klippenfuß**, wenn

$C(x,y)\\iff h(x,y-1)>h(x,y)\\ \\wedge\\ \\neg\\,\\mathrm{Rampe}(x,y-1).$

Dort erscheint ein Bogen in der Klippenwand, sonst entscheidet das Bit $\\mathrm{hash2}(41x+7,\\,43y-1)\\bmod 2$ zwischen Grube und Bau. Ohne gezielte Platzierung lagen bei Saat $0$ über $32\\times32$ Zellen nur $3$ von $718$ Mündern an einem Klippenfuß. Deshalb verschiebt \`place()\` beim Zellaufbau jeden gewählten Platz $s$ um einen Versatz $\\delta\\in\\{-3,\\dots,3\\}^2$ mit kleinstem $\\|\\delta\\|^2$. Der neue Platz muss Klippenfuß sein, oberirdisch trocken liegen und einen offenen $3\\times3$-Block in der Höhle besitzen. Gleichstände entscheidet die Durchlaufreihenfolge, weil nur ein echt kleinerer Abstand ersetzt. Gibt es keinen solchen Platz, bleibt $s$.

**Satz 8 (Lage und Abstand nach der Verschiebung).** Die Platzierung garantiert zwei Eigenschaften:

1. Jeder Mund liegt mit lokalen Koordinaten $1\\le i,j\\le62$ in seiner Zelle und hat einen offenen $3\\times3$-Block.
2. Für zwei Münder $m_a,m_b$ derselben Zelle gilt die Abstandsschranke

$\\|m_a-m_b\\|\\ \\ge\\ 12-3\\sqrt2\\ \\approx\\ 7{,}757\\ \\text{Kacheln}.$

*Beweis der Lage.* Unverschobene Plätze stammen aus dem Raster $i,j\\in\\{1,4,\\dots,61\\}$ und bestehen die Prüfung des $3\\times3$-Blocks. Ein verschobener Platz muss dieselbe Prüfung bestehen. Außerhalb von $[0,64)$ liefert \`openAt\` falsch. Für den geprüften Block gilt daher $0\\le i-1$ und $i+1\\le63$, also $1\\le i\\le62$; für $j$ gilt dasselbe.

*Beweis des Abstands.* Sei $m_b$ nach $m_a$ entstanden und $s$ sein ursprünglicher Kandidat. Beide Auswahlschleifen verwerfen $s$, wenn $\\|s-m_a\\|^2<144$. Für einen angenommenen Kandidaten gilt deshalb

$$\\|s-m_a\\|\\ge\\sqrt{144}=12.$$

Jede Komponente der Verschiebung $\\delta=m_b-s$ beträgt höchstens drei Kacheln. Somit

$$\\|m_b-s\\|=\\|\\delta\\|
\\le\\sqrt{3^2+3^2}=3\\sqrt2.$$

Die umgekehrte Dreiecksungleichung kombiniert beide Grenzen:

$$\\|m_a-m_b\\|\\ge\\|s-m_a\\|-\\|m_b-s\\|
\\ge12-3\\sqrt2.$$

Der Notfallzweig ohne Abstandsprüfung setzt nur den ersten Mund einer Zelle. $\\square$

Vor der Änderung galt die Schranke $12$; die Verschiebung kostet also höchstens $3\\sqrt2\\approx4{,}24$ Kacheln Abstand. Für Münder verschiedener Zellen machte schon die alte Regel keine Aussage. *Beobachtung, kein Beweis.* Mit derselben Saat sind nun $63$ von $718$ Mündern Bögen ($8{,}8\\,\\%$). Unter den übrigen $655$ fallen $337$ auf Gruben und $318$ auf Baue. Unter der Annahme eines fairen Paritätsbits erwartet man $327{,}5$ Gruben mit Standardabweichung $\\sqrt{655}/2\\approx12{,}8$. Die Abweichung beträgt also etwa $0{,}74$ Standardabweichungen.

### 15. Grabinschriften und die Präfix-Invariante der Chronik

Die Chronik eines Feldzugs hat $F\\le8$ Gründer. Jeder Gründer $f$ besitzt $M=2$ Fragmente mit den Kennungen $r=4f+k$, $k<M$. Gespeichert wird die Menge $\\mathcal F$ der gelesenen Kennungen, und \`found(f)\` zählt $|\\{k<M:\\ 4f+k\\in\\mathcal F\\}|$. Fragmente liegen an der Oberfläche als Tafeln. Seit dieser Fassung liegt außerdem im Herzen jeder Zelle der Verlorenen Hallen im Sundark eine Gruft auf der Kachel $(h_x,\\ h_y-2)$, und ihre Inschrift zählt ebenfalls als Fragment.

**Satz 9 (Präfix-Invariante).** Beginnt die Fragmentmenge leer und wird nur durch \`Campaign::read()\` verändert, so enthält sie für jeden Gründer genau die ersten \`found(f)\` Fragmente:

$\\mathcal F\\cap\\{4f,\\,4f+1\\}=\\{4f+k:\\ k<\\mathrm{found}(f)\\}.$

*Beweis durch Induktion über die Leseaufrufe.* Im Anfangszustand sind $\\mathcal F$ und alle Präfixe leer. Angenommen, die Gleichung gilt vor dem nächsten erfolgreichen Lesen. \`read()\` fügt genau den Wert aus \`readable()\` ein. Sowohl die Tafel an der Oberfläche als auch die Gruft unten liefern bei $\\mathrm{found}(f)<M$ denselben nächsten Index:

$$k=\\mathrm{found}(f),\\qquad r=4f+k.$$

Nach Induktionsannahme sind $4f,\\dots,4f+k-1$ bereits vorhanden und $4f+k$ ist das kleinste fehlende Fragment dieses Gründers. Das Einfügen verlängert also sein Präfix um genau eins; die Präfixe aller anderen Gründer bleiben gleich. $\\square$

Daraus folgt: Die Reihenfolge der Fragmente bleibt erhalten, gleich ob der Held eine Tafel oder eine Gruft liest. Die Meldung, dass ein Grab erwacht, erscheint für jeden Gründer genau einmal, nämlich beim Übergang von $\\mathrm{found}=1$ zu $2$. Kein Gründer erhält mehr als $M$ Fragmente. *Grenze.* \`Campaign::load()\` nimmt jede Zeile \`fragment r\` mit $0\\le r<64$ an; ein von Hand bearbeiteter Spielstand liegt außerhalb der Voraussetzung.

**Satz 10 (Zuordnung und Einmaligkeit der Grüfte).** Eine Gruft auf der Kachel $t$ gehört dem Gründer

$\\mathrm{buried}(t)=\\arg\\min_f\\ \\|\\mathbf c_f-16\\,t\\|^2,$

Hier ist $\\mathbf c_f$ der Mittelpunkt des Sitzes von Gründer $f$ in Weltpixeln. Bei Gleichstand gewinnt der kleinste Index. Die Formel teilt die Grüfte in Voronoi-Zellen der Sitze ein. Jede Gruft liefert höchstens ein Fragment; alle Grüfte zusammen liefern höchstens $MF\\le16$.

*Beweis der Zuordnung.* Der lineare Durchlauf ersetzt den bisherigen Sieger nur bei einem echt kleineren Abstand $d<\\text{near}$. Bei gleichen Abständen bleibt daher der zuerst betrachtete, kleinere Index Sieger.

*Beweis der Schranke.* Beim Lesen in der Tiefe speichert \`read()\` den Zellschlüssel $(c_x,c_y)$ in \`epitaphs\`. Danach liefert \`readable()\` für denselben Schlüssel $-1$. Der Schlüssel wird auch als Zeile \`epitaph cx cy\` gespeichert. Somit trägt jede Gruft höchstens einmal bei. Nach Satz 9 kann Gründer $f$ insgesamt höchstens $M$ Fragmente erhalten. Summiert über $F$ Gründer ergibt das höchstens $MF\\le2\\cdot8=16$, unabhängig von der Zahl der Hallen. $\\square$

**Lemma (Unabhängigkeit von der Ebene).** \`Campaign::history()\` liefert dieselben Gründer, gleich auf welcher Ebene sie zum ersten Mal ausgewertet wird.

*Beweis.* \`chronicle::write()\` liest Bauwerke über \`world::structureIn()\`; diese Abfrage hängt von der aktiven Ebene ab. \`history()\` ruft das Schreiben innerhalb eines \`world::Surfaced\` auf. Dieses Objekt aktiviert vor der Abfrage die Oberfläche und stellt beim Verlassen die vorige Ebene wieder her. Die Abfrage sieht daher unabhängig vom Ausgangsort dieselbe Oberflächenebene. $\\square$

Vor dieser Fassung hätte eine erste Auswertung unter der Erde keine Bauwerke gefunden. Eine leere Chronik wäre dann durch das Merkbit \`chronicled\` für die ganze Sitzung festgeschrieben worden.

### 16. Synergien als Produktmenge und Fehden als Bernoulli-Prozess

\`synergy::marksOf()\` fasst die Merkmale eines Helden zu einer 64-Bit-Maske $M$ zusammen: Mutationen ab Bit $0$, Leiden ab Bit $32$, Werkstoffe der Ausrüstung ab Bit $40$. Sechzehn Auslöser besitzen die Merkmale $a_0,\\dots,a_{15}$, sechzehn Wirkungen die Merkmale $b_0,\\dots,b_{15}$. Mit $A=\\{a_t\\}$ und $B=\\{b_p\\}$ sind alle $32$ Merkmale verschieden, insbesondere $A\\cap B=\\emptyset$; der Test \`testSynergies\` prüft das. \`synergy::of()\` berechnet

$\\mathrm{of}(M)=\\{16t+p:\\ a_t\\in M,\\ b_p\\in M\\}.$

**Satz 11 (Produktformel).** Die Abbildung $\\sigma(t,p)=16t+p$ ist eine Bijektion von $\\{0,\\dots,15\\}^2$ auf $\\{0,\\dots,255\\}$, und

$|\\mathrm{of}(M)|=|A\\cap M|\\cdot|B\\cap M|.$

Ein einzelnes Merkmal weckt keine Synergie. Außerdem gilt für $M\\subseteq M'$ stets $\\mathrm{of}(M)\\subseteq\\mathrm{of}(M')$.

*Beweis der Bijektion.* Zu jeder Kennung $s\\in\\{0,\\dots,255\\}$ liefert die Division mit Rest eindeutig

$$t=\\left\\lfloor\\frac{s}{16}\\right\\rfloor,\\qquad p=s\\bmod16,$$

und damit $s=16t+p$. Das ist genau die Zerlegung in \`triggerOf\` und \`payloadOf\`.

*Beweis der Anzahl.* Setze $T_M=\\{t:a_t\\in M\\}$ und $P_M=\\{p:b_p\\in M\\}$. Beide Bedingungen sind unabhängig; jede aktive Synergie entspricht genau einem Paar aus $T_M\\times P_M$. Daher

$$\\begin{aligned}
|\\mathrm{of}(M)|&=|T_M\\times P_M|\\\\
 &=|T_M|\\,|P_M|\\\\
 &=|A\\cap M|\\,|B\\cap M|.
\\end{aligned}$$

Für $M=\\{x\\}$ liegt $x$ wegen $A\\cap B=\\emptyset$ höchstens auf einer Seite; ein Faktor ist null. Aus $M\\subseteq M'$ folgen $T_M\\subseteq T_{M'}$ und $P_M\\subseteq P_{M'}$, also auch die behauptete Monotonie. $\\square$

Beispiel: Ein Hale-Held mit fünf Leiden und dem Werkstoff Stein besitzt insgesamt sechs Auslöser. Mit sechs Werkstoffen der Ausrüstung als Wirkungen erreicht er $6\\cdot6=36$ Synergien. Für alle $256$ braucht er sämtliche $32$ Merkmale.

Eine **Fehde** flammt in einem berechtigten Augenblick, der alle $15$ Sekunden geprüft wird, genau dann auf, wenn

$\\mathrm{hash2}\\bigl(\\mathrm{hash2}(31r_x+7n,\\ 17r_y-13s),\\ \\text{salt}\\bigr)\\bmod1000<90.$

Dabei sind $(r_x,r_y)$ die Region, $n$ die Nacht und $s$ das Zeitfenster. Außerhalb berechtigter Augenblicke setzt \`Level::feuds()\` den Zeitgeber zurück, nämlich nahe sicheren Zonen, während einer Belagerung und in den ersten Nächten.

**Satz 12 (Wahrscheinlichkeit trotz Restverzerrung).** Unter der Annahme, dass der äußere Hash auf $\\{0,\\dots,2^{32}-1\\}$ gleichverteilt ist, hat eine einzelne Prüfung die Wahrscheinlichkeit

$P=\\frac{90\\cdot4\\,294\\,968}{2^{32}}=\\frac{386\\,547\\,120}{4\\,294\\,967\\,296}\\approx0{,}0900000017.$

*Beweis.* Die Division des Hashraums in 1000 Restklassen ergibt

$$2^{32}=1000\\cdot4\\,294\\,967+296.$$

Die Reste $0,\\dots,295$ besitzen deshalb je $4\\,294\\,968$ Urbilder; alle anderen besitzen je $4\\,294\\,967$. Das Ereignis \`Rest < 90\` umfasst die 90 Reste $0,\\dots,89$, die sämtlich zur ersten Gruppe gehören. Seine Anzahl günstiger Hashwerte ist somit $90\\cdot4\\,294\\,968$. Division durch $2^{32}$ ergibt die Formel. $\\square$

Die Abweichung von $0.09$ beträgt weniger als $2\\cdot10^{-9}$. **Nur wenn aufeinanderfolgende Prüfungen außerdem unabhängig sind**, ist die Zahl der Prüfungen bis zur ersten Fehde geometrisch verteilt. Dann gilt

$$E[N]=\\frac1P\\approx11.1,\\qquad
E[\\text{berechtigte Zeit}]\\approx15E[N]\\approx167\\,\\mathrm{s},$$
$$P(\\text{zehn Prüfungen ohne Fehde})=(1-P)^{10}\\approx0.389.$$

Ein Aufflammen ist noch kein Kampf: \`ignite()\` braucht zwei verfeindete Rudel in Reichweite.

*Beobachtung.* \`testFeuds\` zählt $193$ Aufflammen in $2000$ Fenstern. Bei unabhängigen Prüfungen mit $P\\approx0.09$ wären $2000P\\approx180$ zu erwarten, mit Standardabweichung $\\sqrt{2000P(1-P)}\\approx12.8$. Die beobachtete Abweichung beträgt etwa eine Standardabweichung. Die Gleichverteilung und Unabhängigkeit von \`hash2\` sind Annahmen, keine Ergebnisse dieses Beweises. Deterministisch ist die Entscheidung dennoch: Dieselben Eingaben liefern denselben Hash und damit dasselbe Ergebnis.

### Diskussion: Gemeinsamkeiten der Modelle

In allen fünf Teilen erscheint derselbe Entwurfsgedanke in unterschiedlicher Form. Das Spielsystem bildet einen großen Möglichkeitsraum auf eine kleinere Darstellung ab und gestaltet die Aktualisierung so, dass eine nützliche Eigenschaft erhalten bleibt. Die zeitliche Begrenzung der Zielvorhersage begrenzt den Einfluss entfernter Bewegung. Geordnete Seltenheitsprüfungen machen aus drei bedingten Chancen einander ausschließende Ergebnisse. Präfixsummen machen aus Zellanzahlen nicht überlappende Speicherbereiche. Stabile Sortierdurchläufe bewahren die Zeichenreihenfolge, wenn die berücksichtigten Schlüsselbits gleich sind. Die Normierung der Bodenmischung erhält das Gesamtgewicht, nachdem viele mögliche Biome auf drei reduziert wurden. Verzögerte Änderungen des Feuerzustands begrenzen die Ausbreitung in einem gewöhnlichen Durchlauf. Eine einzelne Marke trennt Ankunft und Aufbruch an Ebenenübergängen, und eine Menge gelesener Kennungen bleibt ein Präfix, gleich über welchen Weg ein Fragment gelesen wird. Diese Algorithmen unterscheiden sich, lassen sich aber alle danach beurteilen, welche Information sie verwerfen und welche Invariante erhalten bleibt.

Die Beweise zeigen außerdem einen wiederkehrenden Unterschied zwischen **lokaler Korrektheit** und **Gesamtverhalten**. Die Zerlegung durch Präfixsummen beschreibt, wo Kandidaten gespeichert sind, aber nicht, ob jeder Kandidat im Suchkreis liegt. Der Beweis zur Mischung erklärt, wie gewichtete Farben zusammengesetzt werden, garantiert jedoch keine stetige Klassifikation an jeder Grenze. Ein Weg mit der geringsten Kantenzahl muss in Pixeln nicht der kürzeste sein. Das Quadrat beim Widerstand beschreibt eine einzelne Anwendung von Schaden über Zeit, nicht erneute Anwendung, Immunität oder Tod. Werden solche Grenzen als Teil des Modells betrachtet, wird aus einer lokal korrekten Herleitung keine zu weitgehende Behauptung.

### Grenzen der Aussagekraft

Drei Grenzen bestimmen die Schlussfolgerungen. **Entwicklung des Quellcodes:** Die Gleichungen beschreiben die genannten Funktionen in der vorliegenden Fassung; eine neue Küstenregel, Zustandsobergrenze oder ein anderer Sortierschlüssel kann eine Formel ungültig machen, ohne dass sich ihr Titel ändert. **Numerische Umsetzung:** Gleitkomma-Rundungen, das Abschneiden von Ganzzahlen, Hash-Reste und strenge Vergleiche können an Schwellen von der idealen Rechnung mit reellen Zahlen abweichen. **Zusammenspiel der Systeme:** Darstellung, Spielregeln und spätere Schritte der Gegenstandserzeugung können das sichtbare oder endgültige Ergebnis nach dem hier untersuchten mathematischen Schritt verändern. Die frühere geografische Untersuchung liefert Beobachtungen, aber keinen Beweis für künftige Biom-Häufigkeiten. Aus den Aufwandsgrenzen allein folgt keine gemessene Laufzeit eines Einzelbildes auf einem bestimmten Rechner.

### Nachvollziehen und Schlussfolgerung

Die kleinen Ergebnisse lassen sich ohne Start des vollständigen Spiels nachvollziehen: Mit $P=40$, $T=4$ und $r=0.5$ ergibt sich $D_r=40$; aus $[2,0,3,1]$ entsteht die Präfixsumme $[0,2,2,5,6]$; $e^{-5(30/60)}$ liefert das Geschwindigkeitsverhältnis eines Funkens nach einer halben Sekunde; und die Ausdrücke für die Seltenheitsergebnisse summieren sich zu eins. Für den fünften Teil gilt $12-3\\sqrt2\\approx7{,}757$, $90\\cdot4\\,294\\,968=386\\,547\\,120$ und $0{,}91^{10}\\approx0{,}389$; die Tests \`testCaveEntry\`, \`testEpitaphs\`, \`testSynergies\` und \`testFeuds\` prüfen die zugehörigen Codepfade ohne grafische Oberfläche. Danach kann jede Rechnung mit der genannten Funktion verglichen und nach einer Codeänderung der passende Test ohne grafische Oberfläche ausgeführt werden. Bei Änderungen an Gelände oder Darstellung sollten zusätzlich zur Zahlenprüfung typische Grenzen und Fälle mit gleichen Schlüsseln betrachtet werden.

Die Antwort der Untersuchung auf ihre Forschungsfrage gilt somit unter Bedingungen: Ein vereinfachtes Modell bleibt nützlich, wenn seine Darstellung klar benannt, die erhaltene Eigenschaft prüfbar und sein Gültigkeitsbereich angegeben ist. Vor der Änderung einer Konstante sollten ihre Einheiten bestimmt, eine Aktualisierung oder Entscheidung in der tatsächlichen Reihenfolge des Codes hergeleitet und die Grenze geprüft werden, an der eine Obergrenze, ein Gleichstand oder ein anderer Zweig greift. Erst zusammen mit diesen Bedingungen wird eine Formel zu einem Werkzeug für die Entwicklung.
`,
    interactiveComponent: "status-resistance",
    mermaidCharts: [
      {
        title: "Von Zellanzahlen zu räumlichen Abfragen",
        chart: `
flowchart LR
    A[Gegner je Zelle zählen] --> B[Präfixsummen bilden]
    B --> C[Auf zusammenhängende Bereiche verteilen]
    C --> D[Kandidaten aus nahen Zellen sammeln]
    D --> E[Aufrufer prüft die Kandidaten genau]
`,
      },
    ],
  },
  {
    id: "menu-language",
    title: "33. Menu Text and Language Overrides",
    category: "contribute",
    summary:
      "How menu strings, format arguments and the currently unwired override parser work.",
    sourceFiles: [
      "src/gui/Lang.hpp",
      "src/gui/Lang.cpp",
      "src/menu/SettingsMenu.cpp",
      "src/menu/PauseMenu.cpp",
      "src/menu/DeadMenu.cpp",
      "src/menu/DawnMenu.cpp",
      "src/test/LangTest.cpp",
    ],
    content: `
### Where menu text lives

\`src/gui/Lang.hpp\` defines English defaults as members of \`Lang\`. The global \`lang\` instance supplies text to the pause, settings, controls, death and dawn menus. Coverage is partial: other game text still lives elsewhere in the code. The settings menu stores pointers to \`Lang\` members in its row definitions, so it reads the current value when it renders.

Strings with arguments pass through \`say()\`, a wrapper around runtime \`fmt::format\`. For example, \`say(lang.felledBy, by)\` inserts the cause of death into the default \`felled by {}\`. Input prompts such as the pause-menu controls also pass through \`Input::prompt()\` when rendered.

### Reading overrides

\`Lang::parse()\` accepts text already held in memory. Each recognized line has a case-sensitive key, one literal space, then the value. The remainder of the line is preserved as the value, including additional spaces. Lines beginning with \`#\`, lines without a space, unknown keys and values with a different number of opening braces from the English default are ignored. CRLF and LF line endings are accepted.

For example:

\`\`\`text
# Example overrides passed to Lang::parse()
paused PAUSA
felledBy abattu par {}
world monde {}
\`\`\`

The return value counts accepted lines, not distinct keys; if a key appears more than once, the last accepted value wins. Missing or rejected keys keep their current values. A freshly constructed \`Lang\` starts with English defaults. Parsed values are kept in static string storage, so their pointers remain valid after the input buffer goes away.

**Current integration limit:** the source currently calls \`Lang::parse()\` in the language test, but does not wire a translation file or language selector into game startup. Supplying a file beside the executable therefore does not by itself change the menus.

### Format strings and testing

The parser counts \`{\` characters; it does not fully validate \`fmt\` syntax, argument types, or the order of placeholders. A translation can pass that check and still fail when \`say()\` formats it. Keep the placeholders compatible with the call site and test actual formatted output. For example, \`endlessRun\` has two arguments, while \`world\` has one.

To add a menu string, define its English default in \`Lang\`, add its member to \`LANG_KEYS\`, use it at the render site, and extend \`src/test/LangTest.cpp\` for formatting or parsing behavior. The existing test checks nonempty defaults, unique keys and members, formats defaults containing braces, and checks accepted and rejected overrides. It does not validate every possible translation or exercise a startup file loader.
`,
  },
  {
    id: "intro-playback",
    title: "34. Intro Video and Audio Playback",
    category: "graphics",
    summary:
      "Startup conditions, MPEG frame decoding, Vulkan2D texture updates and the separate audio clip lifecycle.",
    sourceFiles: [
      "src/Game.cpp",
      "src/menu/IntroMenu.hpp",
      "src/menu/IntroMenu.cpp",
      "src/audio/Sound.cpp",
    ],
    content: `
### When the intro appears

After initializing audio and applying settings, \`Game\` chooses the optional intro only when the intro setting is enabled, both required files exist, and the session is not a campaign launch, developer mode, benchmark, or read-only run. The files are \`res/videos/moth_studios.mpg\` and \`res/videos/moth_studios.ogg\`; otherwise startup continues to the title menu.

### Decoding and presentation

\`IntroMenu\` opens the MPEG video with \`pl_mpeg\`, disables its embedded audio, allocates an RGBA buffer, and creates a Vulkan2D image and texture. When the frame resource and duration are valid, it starts the separate Ogg clip through \`Sound::clip()\`.

On each menu tick, \`decode()\` consumes video frames until the next frame time is ahead of the menu clock. Each decoded frame is converted to RGBA; after the loop, only the latest is uploaded to the existing texture. Rendering clears the screen to black and fits the video within the viewport while preserving its aspect ratio.

The menu fades the picture and clip gain over the final 0.5 seconds. Input after the first 0.1 seconds starts an early fade. When the fade ends, the title menu replaces the intro. If video setup fails, duration is set to zero and the menu proceeds to the title on its next tick.

### Ownership and cleanup

The menu owns the decoder, CPU buffer, image and texture. Its destructor ends the clip, waits for the renderer, then frees the texture, image and decoder. Ending the clip also allows the ordinary music stream to refill. Video and audio come from separate files; the menu advances video from its own clock and does not implement an explicit audio-clock synchronization mechanism.
`,
  },
  {
    id: "input-controls",
    title: "35. Input, Controls & Rebinding",
    category: "core",
    summary: "Key transitions, keyboard and gamepad bindings, stick dead zones, saved mappings and contextual prompts.",
    sourceFiles: [
      "src/input/Key.hpp",
      "src/input/Input.hpp",
      "src/input/Input.cpp",
      "src/menu/ControlsMenu.cpp",
      "src/test/InputTest.cpp",
    ],
    content: `
### From an event to an action

\`Input::handle()\` receives SDL events and updates shared \`Key\` objects. A \`Key\` records whether it is held (\`down\`) and counts transitions from released to pressed. At the next \`Input::tick()\`, \`clicked\` is set if at least one press was recorded and the count is cleared. A press and release between ticks can therefore produce \`clicked\` even though \`down\` is already false. Losing window focus releases the keys and clears stored stick and trigger state.

Keyboard and gamepad bindings can point to the same action. Some gamepad bindings deliberately control two actions: by default, X maps to Gather and Retry, Y to Inventory and Codex, and Back to Map and Quit. Which action matters depends on the current game or menu context.

### Rebinding and persistence

The controls menu exposes 17 keyboard rows and eight gamepad rows. It switches the displayed set according to the current input mode. Selecting a row listens for a new key or supported pad button; Escape cancels keyboard listening and B cancels gamepad listening. Reset restores both sets of defaults.

\`Input::rebind()\` rejects unknown and fixed scancodes. \`rebindPad()\` accepts only buttons listed by \`padName()\`. If the requested input is already assigned, the other binding receives the selected row's old input. Both methods release the tracked keys after a successful change, avoiding an unintended held action during the swap.

Arrow keys, Enter, Escape, number keys 1–4 and other keys handled by \`fixed()\` remain fixed. On gamepad, A, B, Start and the D-pad are fixed; supported bindable inputs include X, Y, shoulders, stick buttons, triggers and listed auxiliary buttons. Consult \`Input.cpp\` for the complete current lists.

\`saveKeys()\` writes names and numeric SDL scancodes or pad identifiers to \`keys.txt\`. \`parseKeys()\` applies valid entries through the same rebind methods, so conflicts are resolved in file order. The controls menu requests a save after listening ends and when defaults are restored; \`Game::saveKeys()\` writes only when \`writes()\` permits it.

### Stick dead zone and button hysteresis

The left stick uses a radial dead zone. If its raw magnitude is $m \\le 0.25$, output is zero. Outside the dead zone, the magnitude is rescaled from the remaining range to $[0,1]$, while preserving direction:

$$\\mathbf{s}=\\frac{\\mathbf{v}}{m}\\min\\left(1,\\frac{m-0.25}{0.75}\\right)$$

For example, a horizontal input of 0.50 becomes approximately 0.33. The same rescaled axes also drive digital menu directions: a direction presses when its component exceeds 0.6 and remains held until it drops to 0.3 or below. This gap reduces repeated press/release changes near a threshold. Triggers use a separate gap: they press above 0.5 and remain held above 0.25.

### Prompts and tests

\`Input::prompt()\` substitutes recognized space-delimited words. In pad mode it applies fixed replacements such as \`Enter\` to \`A\`, then checks the configured pad binding words. In keyboard mode it substitutes certain default prompt words when their keyboard binding has changed. This is a targeted text substitution, not a general parser for arbitrary sentences or punctuation.

\`src/test/InputTest.cpp\` exercises gamepad mapping, dead zone and threshold behavior, rebinding, cancellation, persistence and representative prompt text. When adding a binding, update the relevant binding table and count, check fixed controls and prompt words, and extend the tests for the new behavior.
`,
    interactiveComponent: "input-response",
    mermaidCharts: [
      {
        title: "From SDL events to game actions",
        chart: `
flowchart LR
    Event[SDL input event] --> Handle[Input handle]
    Handle --> Binding[Fixed or configured binding]
    Binding --> Key[Key down and press count]
    Key --> Tick[Input tick]
    Tick --> Action[Game and menu actions]
`,
      },
    ],
  },
  {
    id: "caves-sundark",
    title: "36. Caves, the Sundark, Guardians & Dread",
    category: "world",
    summary: "Three world layers, cave passages, regional hazards, deep guardians, and campaign dread.",
    sourceFiles: [
      "src/level/world/Under.cpp",
      "src/level/biome/CaveBiome.hpp",
      "src/level/biome/CaveBiome.cpp",
      "src/level/CaveRules.cpp",
      "src/level/World.hpp",
      "src/campaign/CampaignSave.cpp",
      "src/campaign/CampaignChronicle.cpp",
      "src/Game.cpp",
    ],
    content: `
### Three layers at the same coordinates

\`world::Layer\` distinguishes the surface, caves, and the deep Sundark. Underground terrain is generated in \`64 × 64\` tile cells. A cave cell records its topology, mouths, biome, possible vault, and chamber center; a deep cell records its biome, landing, exit, and possible guardian lair. \`world::enter()\` switches the active layer, so terrain and prop queries at the same tile coordinates resolve against that layer. The cave biome under a surface location follows the land above; deep regions use their own climate and biome selection.

\`world::passageNear()\` searches the tiles around the hero for a passage. Cave mouths connect surface and caves. Stairs connect caves and deep cells. Deep exits may instead be roots, chimneys, or sinkholes; a sinkhole leads to the surface. A chasm is different from an interaction passage: it occupies a small open area in a descent cave. Non-floating, non-boss foes that enter it are removed from the current layer. Check the passage's \`to\` layer before assuming every underground exit returns to the cave above.

Walking onto a passage tile travels without a key: \`Game::step()\` reads the hero's foot tile through \`world::passageAt()\` once per step, and \`Level::landed\` keeps the hero from bouncing straight back. The flag is set on every arrival and on every new level, and clears once the foot leaves a passage tile. E beside a passage still works. On the surface, \`mouthProp()\` draws a mouth as a cliff arch when the tile above is higher, otherwise as a pit or a burrow; the cave builder nudges each mouth up to three tiles toward a cliff foot. Below, a mouth is a pool of daylight with a beam. Chapter 32, section 13 proves the no-bounce property, and section 14 proves the spacing bound after the nudge.

\`Level::shift()\` changes layers without changing the run clock. It removes current foes, draws gems toward the hero, transfers the current chart into its layer slot, updates sky and cave lighting, places the hero and allies at the destination, and moves loose non-gem pickups along. The first visit to a chamber center creates a chest, tracked by a key containing the cell coordinates and layer. The separate chart for each layer prevents explored surface tiles from revealing cave walls.

### Regional rules and rewards

\`CaveBiome\` contains eight shallow regions followed by eight deep regions. Each \`CaveDef\` supplies floor and wall art, tint, props, foes, pool type, light grade, and optional guardian. \`Level::caveRules()\` selects a timed rule from the hero's current cave biome. Root hollows can put brambles ahead of travel; warrens drop rock; spore halls release poison; vents and magma halls erupt; catacombs and ossuaries raise skeletons; the mere stirs water creatures; the hive hatches spiders. Geodes and the cathedral can heal near crystals, rune stones in the halls frighten nearby non-boss foes, and the abyss pushes the hero with gusts. Some rules require a nearby matching prop or pool, so a timer firing does not guarantee an event.

Deep lairs wake when the hero approaches their center. \`Level::guard()\` records active guardians by cell, avoids waking one twice, and marks it felled when its entity disappears. Felled deep guardians remain recorded in campaign saves. A guardian's death also calls \`surgeFrom()\`, which may offer a Changeling a region-specific mutation. The Lost Halls have no guardian and instead host the deep sanctuary. Two tiles north of each Halls heart stands a founder's tomb (\`world::tombAt()\`). In a campaign, \`Campaign::buried()\` assigns it to the founder whose seat lies nearest, and reading its epitaph counts as that founder's next Chronicle fragment, once per tomb (\`epitaph cx cy\` in the save). Chapter 32, section 15 proves that fragments stay in order on either path.

### Dread in a campaign

\`Level::haunt()\` runs underground only when the run does not end at dawn. Dread rises with time below and contributes to \`threatAt()\` alongside the layer's base threat. A warded location reduces dread gain to one quarter. In the Lost Halls sanctuary, dread drains rapidly and the hero slowly heals. The game announces each new third of the dread range. Returning to the surface or resting in the sanctuary relieves the pressure; the campaign save records remaining dread, the current layer, slain guardians, and separate cave and deep edits.

For a new underground region, add its \`CaveBiome\` and \`CaveDef\`, decide how generation selects it, supply a \`CaveRules.cpp\` rule at the matching enum index, then verify its passage, terrain, chart, foe selection, and save behavior. Keep the shallow/deep boundary at \`CAVE_SHALLOW\` aligned with the enum order.
`,
    mermaidCharts: [{
      title: "Travel and state across world layers",
      chart: `
flowchart LR
    Surface[Surface] <-->|Cave mouth| Caves[Caves]
    Caves <-->|Stairs or deep exit| Deep[Sundark]
    Deep -->|Sinkhole| Surface
    Caves -->|Descent chasm| Deep
    Deep -->|Time below| Dread[Campaign dread]
    Deep -->|Lost Halls sanctuary| Relief[Heal and drain dread]
`,
    }],
  },
  {
    id: "mutations-afflictions",
    title: "37. Changelings, Mutation Offers & Afflictions",
    category: "gameplay",
    summary: "How biome whispers, guardian surges, deep upheaval, exposure, and cures alter a campaign hero.",
    sourceFiles: [
      "src/hero/Mutation.hpp",
      "src/hero/Mutation.cpp",
      "src/hero/Affliction.hpp",
      "src/hero/Affliction.cpp",
      "src/level/Whispers.cpp",
      "src/campaign/CampaignSave.cpp",
    ],
    content: `
### Mutation offers

The mutation system runs only when the level's \`rules.mutate\` is enabled. A Changeling standing on the surface in a mapped biome builds a linger timer. After eight seconds, \`Level::whispers()\` offers that biome's gift for twelve seconds. Leaving a 160-pixel radius or letting the offer expire rejects it and starts a 120-second cooldown. An owned gift cannot be offered again. For example, fungal ground whispers Spore Sacs, ashlands Ember Glands, and storm steppe Stormcall. The current mapping is the \`WHISPERS\` table in \`Mutation.cpp\`.

Killing a deep guardian can instead call \`surgeFrom()\`. Its \`SURGES\` table supplies up to two region-themed choices that the hero does not already own. This stronger offer lasts fifteen seconds and resolves to one of the choices if its timer runs out; accepting it increases Synod scrutiny. A fall into the deep may trigger \`upheaval()\`: it has a one-in-four roll, grants a random unowned positive mutation to a Changeling, may also grant a defect, and adds scrutiny. For a non-Changeling, that same event may grant an affliction instead.

Mutations are bits on the player, with a per-mutation timer for repeated effects. \`grant()\` applies immediate changes such as Chitin armor and slower movement, Hollow Bones speed and lower maximum health, or poison immunity from Spore Sacs. \`tick()\` runs periodic effects such as an Ember Glands burning trail, Rime Glands chill, and the mind gifts Kindle, Stillness, Stormcall, Quicken, and Beguile. Nearby Censers suppress mind effects; when a mind effect fires near Synod foes, the Synod gains scrutiny. Quicken animates a nearby wood or stone prop as an ally, while Beguile turns a nearby ordinary foe into an ally. The \`MutationDef\` table is the authority for which gifts are mind gifts, defects, and periodic effects.

### Environmental afflictions

\`Level::exposure()\` tracks a separate timer for each affliction. The relevant surface biome, or its underground counterpart, chooses the current source. Moon Touched requires night on the surface. At 40 seconds the hero gets a warning; at 75 seconds exposure grants the affliction and raises scrutiny. Leaving the source or already owning the affliction fades its exposure at half a second per second. This is independent of Changeling status.

The five afflictions each trade a benefit for a cost: Spore Crown grants poison immunity but slows daytime pace; Glass Skin adds armor but doubles charged-ground damage; Frost Blood grants chill immunity but doubles burning-ground damage; Ash Lung adds burn resistance but lowers pace; Moon Touched raises vigor at night and lowers it by day. A town cure removes one owned affliction for 150 gold. \`affliction::cure()\` also reverses its immediate armor or resistance change and recomputes shared immunities, so curing Spore Crown does not remove poison immunity supplied by Spore Sacs.

Campaign saves record the mutation and affliction bitsets. When extending either enum, keep the bit width and save format in mind, add its source or offer mapping, apply and reverse its effects as appropriate, and verify interactions with Synod scrutiny and existing immunities.
`,
  },
  {
    id: "particle-physics",
    title: "38. Particle Motion, Debris Physics & Collision",
    category: "graphics",
    summary: "The fixed-step particle lifecycle, per-second effects, per-tick debris, collision response, and render interpolation.",
    sourceFiles: [
      "src/Math.hpp",
      "src/SpriteObject.hpp",
      "src/level/Level.cpp",
      "src/level/LevelRender.cpp",
      "src/level/LevelSpace.cpp",
      "src/particle/Particle.hpp",
      "src/particle/Spark.cpp",
      "src/particle/Drift.cpp",
      "src/particle/Mote.cpp",
      "src/particle/Shockwave.cpp",
      "src/particle/Arc.cpp",
      "src/particle/VisualDetail.hpp",
      "src/particle/debris/Debris.cpp",
      "src/particle/debris/Debris.hpp",
    ],
    content: `
### One fixed update, several kinds of motion

The game advances simulation at \`DT = 1 / 60\` second. The main loop can run multiple fixed ticks before one render. \`Level::spawn()\` owns visual effects in a \`vector<unique_ptr<SpriteObject>>\` and assigns their \`level\` pointer. \`Level::tick()\` visits each live particle, then moves survivors toward the front of the vector and resizes it. The loop uses the vector's current size, so an effect spawned during a particle tick can also be visited in that same tick. These effects are separate from ordinary EnTT-owned entities and weapon projectiles.

The \`Particle\` base class stores \`life\` and \`maxLife\` in **seconds**. Each tick subtracts \`DT\`; when life reaches zero it sets \`removed\`. Its \`frac() = life / maxLife\` gives a remaining-life fraction for fades and size changes. \`SpriteObject\` supplies position \`(x, y, z)\`, velocity fields \`(xa, ya, za)\`, drawing hooks, and the removal flag. Rendering places an effect at screen position \`(floor(x), floor(y - z))\`, so positive \`z\` appears above the ground.

### Sparks: radial launch and exponential damping

\`Spark::burst()\` chooses a random angle and a speed in \`[0.3, 1.0] × requestedSpeed\` for each spark. It initializes \`xa = cos(angle) × speed\` and \`ya = sin(angle) × speed\`. At each tick, \`Spark::tick()\` first ages the effect, then computes \`k = exp(-5 × DT)\`, multiplies both velocity components by \`k\`, and advances \`x += xa × DT\`, \`y += ya × DT\`. The launch speed is therefore in pixels per second. There is no gravity or terrain collision in this class. Remaining life scales its opacity and sprite size; a glowing spark can also stamp light into the light pass. \`burst()\` skips a whole burst if the live spark count is already above 700; this is a threshold check at burst entry, so a burst may take the count past 700.

### Drift: configurable falling and floating

\`Drift\` uses the same seconds-based velocity convention. With \`age = maxLife - life\` and \`k = exp(-drag × DT)\`, its update is \`xa *= k\`, \`ya = ya × k + gravity × DT\`, \`x += (xa + cos(age × 5 + rot) × sway) × DT\`, \`y += ya × DT\`, and \`rot += spin × DT\`. Positive gravity accelerates downward in screen coordinates; negative gravity makes an effect rise. Sway changes the horizontal displacement without changing stored \`xa\`. Rendering combines a short fade-in, an end fade, rotation, and optional size growth. Call sites such as \`flourish::scatter()\` set drag, spin, gravity, and launch velocity after construction. Drift does not collide with the world.

### Debris: height, substeps, and axis-specific bounce

\`Debris\` is a separate \`SpriteObject\` branch. It starts with a random direction sampled inside a unit sphere and normalized, then adds an upward component to \`za\`. Its \`life\` is an **integer number of ticks**, initially 40–59. Unlike Spark and Drift, the base debris update does **not** multiply displacement by \`DT\`: velocities, gravity, and damping are expressed per simulation tick. A debris fragment loses horizontal speed by a factor of 0.85 when \`z <= 1\`, otherwise by its configurable \`drag\`; then \`za -= gravity\`.

\`attemptMove()\` chooses \`steps = int(sqrt(xa² + ya² + za²) + 1)\`. For each substep it tries X, Y, and Z separately, each with one \`velocity / steps\` displacement. If the proposed height is below zero, it clamps \`z\` to zero and calls \`collide()\`. When the proposed height is below 12, horizontal movement also tests \`Level::blocks(x, y)\`, which checks nearby solid props by their circular radii. The default collision response reverses and scales only the velocity component for the blocked axis: for example, a vertical hit applies \`za *= -bounce\`. These substeps make fast fragments less likely to cross small blockers in one tick. They are a simple discrete collision scheme, not a general rigid-body solver.

Debris subclasses specialize that scheme. Blood uses stronger drag and a small bounce. Chips launch faster, spin while airborne, and fade at the end. Snow falls slowly with wind and removes itself on a vertical collision. Smoke and flame use negative gravity to rise. Meat sheds blood during flight and can scatter more blood when it hits while falling fast. \`Debris::shed()\` combines a new fragment's random velocity with part of the parent's velocity. \`Debris::gore()\` composes blood with smoke or meat depending on the caller.

### Animated effects and the draw pass

Not every particle integrates velocity. \`Mote\` recomputes a curved path from its starting point toward the player's current position, using squared age for progress and a sine-shaped sideways bend. \`Shockwave\` eases an expanding ring radius. \`Arc\` holds fixed lightning nodes, redraws jittered segments, and can charge ground once. These are scripted visual paths; their appearance should not be read as collision physics.

\`Level::render()\` queues visible particles with entities and props for depth sorting, while \`renderLight()\` invokes their light hooks separately. Before drawing, \`Level::blend()\` can interpolate positions between the previous and current simulation tick on high-refresh displays; \`unblend()\` restores simulation coordinates afterward. The reduced-particles option uses \`showParticle()\` to filter cosmetic effects from the draw and light passes, but it does not skip their simulation ticks. Live-count limits also guard creation: \`Drift::room()\` requires fewer than 360 drifts and \`Debris::room()\` fewer than 1,200 debris objects. A new effect should state whether its speed is per second or per tick, and whether it needs collision, height, light, or only an age-driven render animation.
`,
    mermaidCharts: [{
      title: "Particle lifecycle and motion families",
      chart: `
flowchart LR
    Spawn[Level spawn] --> Tick[Fixed 60 Hz particle tick]
    Tick --> Seconds[Particle life in seconds]
    Tick --> Debris[Debris life in ticks]
    Seconds --> Spark[Spark velocity and drag]
    Seconds --> Drift[Drift gravity sway and spin]
    Seconds --> Scripted[Mote Shockwave Arc paths]
    Debris --> Substeps[Axis substeps and collisions]
    Spark --> Cull[Remove and compact]
    Drift --> Cull
    Scripted --> Cull
    Substeps --> Cull
    Cull --> Render[Visible depth sorted draw and light]
`,
    }],
  },
  {
    id: "reactive-ground",
    title: "39. Reactive Ground: Fire, Ice, Charge, Spores & Regrowth",
    category: "world",
    summary: "Sparse timed terrain states, table-driven reactions, controlled fire spread, ground hazards, and campaign recovery.",
    sourceFiles: [
      "src/level/Matter.hpp",
      "src/level/Matter.cpp",
      "src/level/LevelMatter.cpp",
      "src/level/Level.hpp",
      "src/level/Level.cpp",
      "src/level/LevelRender.cpp",
      "src/entity/enemy/SynodFoe.cpp",
      "src/campaign/Campaign.cpp",
      "src/test/CampaignTest.cpp",
    ],
    content: `
### From a cause to a ground state

Reactive ground is enabled by \`RunRules::matter\`. \`Stuff\` names the state of a tile: None, Wet, Burning, Frozen, Oiled, Spored, Charged, Ash, or Limed. \`Cause\` names an incoming stimulus: Fire, Chill, Water, Charge, or Spore. \`Level::react(x, y, cause)\` reads the tile's effective state, finds the first matching row in the \`REACTIONS\` table, writes the new state and duration to \`Matter\`, and triggers any steam, burst, or current effect. It returns false when matter is disabled or no row matches; a cause does not automatically affect every state.

\`Level::stuffAt()\` first checks the stored matter state. If the tile has no stored state, it treats lava as Burning, a deterministic Badlands tar tile as Oiled, and a sufficiently deep sky puddle as Wet. These fallback states can therefore participate in reactions without filling the sparse matter store in advance. For example, Fire ignites an otherwise empty tile only when \`kindling(x, y)\` finds a suitable, non-submerged prop; Fire on Wet makes steam and clears that wet state; Chill on Wet makes Frozen; Charge on Wet makes Charged.

### Sparse storage and clocks

\`Matter\` divides tile coordinates into \`16 × 16\` pages. A page contains a byte of \`Stuff\` and a 16-bit time counter per tile, plus a live-cell count. Pages are allocated only when a nonempty state is written and erased when their final live cell disappears. Floor division keeps negative world coordinates in the correct page. \`set()\` converts seconds to tenths of a second, capped at 60,000 units. A zero counter does not expire by itself, so callers supplying temporary effects must provide a positive duration.

The game ticks at 60 Hz, but \`Matter::tick()\` advances its timer on a \`0.1\`-second clock. On expiry, Burning becomes Ash for 20 seconds, Frozen becomes Wet for 6, and Charged becomes Wet for 4; other timed states become None. Every tenth matter step, roughly once per second, Burning checks its four cardinal neighbors. It schedules fire only where the destination has no stored matter and \`fuel(x, y)\` says a burnable prop is present. Changes are collected first and applied after the scan, so a newly lit tile cannot spread again in the same pass. The fire stops when fuel ends, reaches water, or meets an occupied tile such as lime.

When a Burning state expires, \`Level::scorch()\` can record the burned prop as a harvested terrain edit with a regrowth day three campaign days later. \`Campaign::regrow()\` clears due edits from the surface edit map when a day advances. Fire itself is transient matter; the terrain edit is what lets a burned plant remain absent after the flames and ash disappear.

### Chain reactions and actors

The reaction table includes special effects beyond state replacement. Igniting Oiled ground starts a short burn and writes Burning into the eight surrounding tiles unless they contain Limed matter. This burst writes those neighbors directly, so it is distinct from the slower fuel-limited cardinal spread. Charging a Wet tile calls \`Level::current()\`, which walks connected wet tiles through four-neighbor adjacency and marks them Charged, up to a 48-tile queue limit. Each tile changed to Charged is no longer Wet, which also prevents the search from revisiting it.

Spored ground poisons actors other than Mycel foes. When a creature dies on spores, \`sprout()\` can schedule a Sporeling after six seconds, with at most four pending sprouts. Fire can consume Spored ground into a brief burn. Synod Limers write Limed tiles around themselves; no Fire or Spore reaction row starts from Limed, and a mob standing there has Burn and Poison ended.

\`Level::tread()\` applies the ground's effects to a mob. Burning applies Burn, Wet ends an existing Burn, Charged applies a brief damaging Burn status, and Spored applies Poison. Bosses receive half the ground damage in the Burning and Charged branches. \`Level::footing()\` separately multiplies movement pace: Wet \`0.85\`, Frozen \`1.1\`, and Oiled \`0.8\`, when those are stored matter states. Afflictions can further change the player's ground damage, including Glass Skin on Charged and Frost Blood on Burning. The player is checked by \`matterTick()\`; enemy movement calls its own tread path.

### Rendering and checks

\`Matter::render()\` visits only pages overlapping the camera and draws a translucent tile-colored rectangle for each live state; Burning alpha flickers with time and tile position. Reactions also emit ordinary Spark particles for steam, flare, and electric current, connecting this system to the particle chapter without making the particles themselves the authority for terrain state.

\`testMatter()\` and \`testMatterTable()\` in \`CampaignTest.cpp\` check freezing and thawing, pace, fuel-limited fire, wet quenching, electric propagation, oil bursts, lime blocking, sporeling growth, and empty-page cleanup. When adding a state or reaction, update \`Stuff\`, \`EXPIRE\`, \`LOOK\`, the reaction table, and these behavior tests together; the enum order indexes the expiry and color arrays.
`,
    mermaidCharts: [{
      title: "Ground reaction and expiry examples",
      chart: `
flowchart LR
    Wet[Wet] -->|Chill| Frozen[Frozen]
    Frozen -->|Timer| Wet
    Wet -->|Charge| Charged[Charged]
    Charged -->|Timer| Wet
    Wet -->|Fire| Dry[None and steam]
    Fuel[Empty tile with fuel] -->|Fire| Burning[Burning]
    Burning -->|Timer| Ash[Ash]
    Ash -->|Timer| Dry
    Oiled[Oiled] -->|Fire| Burst[Burning and neighbor burst]
    Spored[Spored] -->|Fire| Burning
`,
    }],
  },
  {
    id: "tutorial-manual-tilemap",
    title: "40. Your First Tilemap: Draw It, Map Its Symbols & Read It in C++",
    category: "contribute",
    summary: "A first contribution exercise: hand-write an ASCII tilemap, turn symbols into typed cells, inspect coordinates, and connect the idea to Mellangan structures.",
    sourceFiles: [
      "extern/wiki/examples/manual-tilemap/manual_map.txt",
      "extern/wiki/examples/manual-tilemap/read_map.cpp",
      "src/Atlas.hpp",
      "src/level/Structure.hpp",
      "src/level/Structure.cpp",
      "src/level/structure/Layouts.hpp",
      "src/level/structure/Settlements.cpp",
      "src/level/world/Ground.cpp",
      "src/level/FloorPainter.cpp",
    ],
    content: `
### Start with a drawing, not a renderer

Imagine you have just learned basic C++ and want a small, reviewable contribution. A tilemap is a grid: each character in a text row describes one tile-sized place. Make a file called \`manual_map.txt\` with **exactly** these seven rows (the working copy is in \`extern/wiki/examples/manual-tilemap/\`):

\`\`\`text
........
..####..
..#..#..
..#@...T
..#..#..
..~~~~..
........
\`\`\`

Each row has eight characters. The top-left character is tile \`(0, 0)\`; \`x\` increases to the right and \`y\` increases downward. The map is therefore **8 × 7 tiles**, or **128 × 112 pixels** at Mellangan's 16-pixel tile scale. Do not add spaces to align the rows: spaces would be new, unrecognized symbols.

Write down the legend before writing the loader:

| Symbol | Meaning in this exercise | Stored data |
| --- | --- | --- |
| \`.\` | ordinary grass | grass ground |
| \`#\` | stone or paved ground | stone ground |
| \`~\` | water | water ground |
| \`T\` | tree on grass | grass ground + tree flag |
| \`@\` | player start on grass | grass ground + spawn coordinate |

The \`T\` and \`@\` symbols do **not** replace the ground under them. That small choice is useful later: Mellangan separates ground drawing from props, and a spawn point is location metadata rather than a texture. For this exercise the stone is just a ground type; collision and movement rules are a later step.

### Turn characters into typed cells

Open \`extern/wiki/examples/manual-tilemap/read_map.cpp\`. Its smallest important types are:

\`\`\`cpp
enum class Ground { Grass, Stone, Water };
struct Cell {
  Ground ground = Ground::Grass;
  bool tree = false;
};
\`\`\`

The loader opens the text file with \`std::ifstream\`, takes one row at a time with \`std::getline\`, and checks that all rows have the same width. It accepts an optional trailing carriage return so a CRLF map also works on systems that preserve it. A \`switch\` maps each character to a \`Cell\`; \`@\` additionally records \`spawnX\` and \`spawnY\`. Unknown characters, an empty map, uneven rows, and missing or duplicate spawns produce errors. This is important when a teammate edits a map by hand: a typo should name its coordinates, not silently become a different tile.

The cells go into a single \`std::vector<Cell>\` in **row-major order**. For a map of width \`w\`, the cell at \`(x, y)\` is at index \`y * w + x\`. Here the spawn \`@\` is at \`(3, 3)\`, so its vector index is \`3 * 8 + 3 = 27\`. The loader's \`at(x, y)\` checks bounds before using this formula. The tree is at \`(7, 3)\`, and the four \`~\` symbols are at \`(2, 5)\` through \`(5, 5)\`.

### Build it and read the result

From the **wiki repository root**, compile the standalone program and give the map path as its argument. On Windows with MinGW:

\`\`\`powershell
g++ -std=c++17 -Wall -Wextra -pedantic examples/manual-tilemap/read_map.cpp -o read_map.exe
.\\read_map.exe examples/manual-tilemap/manual_map.txt
\`\`\`

On a Unix-like shell, use the same compile command with \`-o read_map\`, then run \`./read_map examples/manual-tilemap/manual_map.txt\`. The expected output is:

\`\`\`text
size: 8 x 7
spawn: (3, 3)
water cells: 4
tree at (7, 3): yes
spawn ground is grass: yes
\`\`\`

Now change one \`.\` to \`~\` and rerun: the water count should rise to five. Change one row's length or add \`?\` and rerun: the parser should reject the map. These small experiments prove that the program reads the **file you edited**, rather than printing a hard-coded drawing. Restore the sample when finished. You can delete the local \`read_map.exe\`; it is only a build output.

### Map data is not atlas data

The character \`#\` means “stone ground” in *your map format*. It is not an atlas index. Mellangan's \`Sprite\` stores a rectangle \`(x, y, w, h)\` in an image. \`atlas::tile(index)\` and \`atlas::town(index)\` convert an index into such a rectangle; \`atlas::tt::Path\` names the town atlas's paved path graphic. Rendering chooses a graphic for a ground kind, then draws it at world pixel position \`(tileX * 16, tileY * 16)\`. \`FloorPainter::tile()\` follows that coordinate convention when it draws the current world's ground.

For a first engine-facing extension, a **local structure layout** is the closest existing seam. \`Structure\` stores a footprint \`(x, y, w, h)\` in tiles. Its \`StructureDef\` can provide \`ground\` and \`prop\` callbacks. The callbacks receive local coordinates \`(lx, ly)\`; the world tile is \`(structure.x + lx, structure.y + ly)\`. \`structureGround()\` checks the footprint and asks the callback for a \`Sprite\`. A small ground callback could read your map's \`#\` cell and return \`masonry(s, atlas::tt::Path)\` as the paved graphic. \`T\` would belong in a prop callback, while \`@\` is a place to spawn an actor and needs separate gameplay code. Existing examples to read are \`layout::cottageGround()\` and \`layout::cottage()\` in \`Settlements.cpp\`.

There is an important limit to this exercise: the **running world does not currently load this text file as a tilemap**. \`world::groundTile()\` builds its answer from water, dirt, biome, and structure rules. Dropping \`manual_map.txt\` into the game assets will not change terrain. A real contribution that uses the file in-game must choose when to load it, how it fits a structure's footprint, how water and props participate in world queries, and how the map is packaged. Keep the standalone loader and its error checks as a starting point; then add one engine integration at a time and compare it with the existing structure callbacks.
`,
  },
  {
    id: "enemy-mind-model",
    title: "41. Enemy Minds: Goal Plans and Champion Powers",
    category: "gameplay",
    summary: "How ordinary enemy goals steer movement, while champion mind mutations run on a separate timer, affect nearby foes, and may pass to a Changeling.",
    sourceFiles: [
      "src/entity/enemy/Enemy.hpp",
      "src/entity/enemy/Enemy.cpp",
      "src/entity/enemy/ai/Goal.hpp",
      "src/entity/enemy/ai/Plans.cpp",
      "src/level/Level.cpp",
      "src/level/Level.hpp",
      "src/level/Spawner.cpp",
      "src/hero/Mutation.hpp",
      "src/hero/Mutation.cpp",
      "src/entity/ability/Strikes.cpp",
      "src/entity/enemy/EnemyDeath.cpp",
      "src/level/Whispers.cpp",
      "src/test/CampaignTest.cpp",
    ],
    content: `
### What “mind” means here

An enemy has a **normal decision loop** and may also have a **champion mind mutation**. The decision loop chooses a target, runs a small sequence of goals, and asks for movement. A champion mind adds one of four timed powers. It does not replace the goal plan, learn from the player, or use a machine-learning model. In code, \`Enemy::goals\` holds the current goal queue; \`Enemy::mind\` is an index into the mutation table, and \`mindTime\` is its countdown. The separate \`mutant\` field marks a mutation that can be offered to a Changeling when that enemy dies.

### The normal decision loop

\`Level::tick()\` gathers enemies and runs \`Enemy::think()\` in the worker phase. Each thinking enemy first calls \`sense()\`. Its \`quarry()\` normally selects the player, but a nearby ally can draw its attention; an ally with a lure weighs more strongly. \`sense()\` takes the target's current position and velocity, adds a short prediction of where it may move, and records distance and direction. Its \`seen\` flag means the **target is facing toward the enemy** within the code's angle and distance test. It is not a general line-of-sight raycast.

The enemy's \`Plan\` lists up to six goal steps and two possible interrupts. A \`Goal\` can initialize local state in \`start()\`, set desired movement in \`tick()\`, and return \`Running\` or \`Done\`. An urgent interrupt can move to the front of the eight-slot \`GoalQueue\`. \`Enemy::think()\` processes at most four completed goal steps in one call, then writes \`xWant\` and \`yWant\`. Later worker passes move the enemy and resolve crowd separation. Main-thread \`Enemy::tick()\` performs actions that may change the level. The existing GoalQueue and steering chapters describe individual goal types and their worker-thread rules in more detail.

### How a champion receives a mind

\`Spawner::champion()\` selects a suitable species from the local biome, spawns and crowns it, and gives it champion equipment. If \`RunRules::mutate\` is enabled, it calls \`mutation::endow()\`. Endowment rejects Synod enemies. For any other eligible champion, \`roll % 4\` picks one entry from the fixed list \`Kindle, Stillness, Stormcall, Fold\`. The chosen mutation is stored in **both** \`e.mind\` and \`e.mutant\`; its initial timer is \`MUTATIONS[mind].every * FOE_MIND\`, with \`FOE_MIND = 1.5\`. The game logs a “WIELDS” notice using the champion's title and mind name. The separate \`mutation::mutate()\` path gives some enemies body-themed traits; it is not the four-power champion mind selection.

| Mind | Base \`every\` | Champion interval | What a cast attempts |
| --- | ---: | ---: | --- |
| Kindle | 6 s | 9 s | Burn the nearest target and, when matter is enabled, its surrounding ground. |
| Stillness | 8 s | 12 s | Chill nearby opposing mobs and react a small disc of ground around the champion. |
| Stormcall | 7 s | 10.5 s | Chain lightning through up to three opposing targets. |
| Fold | 9 s | 13.5 s | Blink in the champion's aim direction with damage at departure and arrival. |

These intervals are **countdowns between attempts**, not guarantees that every attempt affects someone. The timer is set when the mind is assigned, so the power does not fire immediately on spawn.

### One cast, in order

After status damage and ground tread, \`Enemy::tick()\` calls \`mutation::cast(*this)\` when \`mind >= 0\`. This happens in the main-thread entity pass, before the enemy's ordinary \`act()\`, trait tick, and weapon tick. \`cast()\` subtracts the fixed \`DT\` from \`mindTime\`. If time remains, it returns. When the timer expires, it resets the timer to the full champion interval **before** looking for a target.

The target gate asks \`Level::nearestFoes(e, e.x, e.y, 200, 1)\` for one opposing mob within 200 pixels. Because the champion is hostile, this search considers the player and live allied mobs, sorted by distance. If it finds none, the cast ends and the already-reset timer keeps running. The goal queue and its \`aware\` state do not control this gate. A champion can therefore keep following its ordinary plan while its mind independently counts down; a nearby valid foe is what allows an expired mind to act.

The four branches then use the target differently:

* **Kindle** uses the nearest target directly. It writes a 3 × 3 patch of Burning ground for 3 seconds when matter rules are on, reports a Burn interaction, applies a 2-second Burn with power \`4 * e.damageMul\`, and emits sparks. The Burn status is still attempted when matter rules are off.
* **Stillness** is centered on the champion after the 200-pixel gate succeeds. It gives opposing mobs within 70 pixels a 2-second Chill of power 0.5. It also sends Chill reactions to nearby ground tiles in a small disc and emits sparks. The target that passed the gate may be farther than the 70-pixel chill radius.
* **Stormcall** calls \`ability::chain(e, 3, 160, 6)\`. That ability makes its own target list within 160 pixels, then links up to three foes and applies damage and Shock interactions. A foe between 160 and 200 pixels can pass the outer gate while leaving the chain with no target.
* **Fold** calls \`ability::blink(e, 70, 4, RIME)\`. Blink uses the caster's aim, deals its burst damage, moves up to 70 pixels, resolves collision, and draws the travel effect. It is not a teleport to the target's coordinates; a blocked path can change the final position.

### What happens when the champion dies

\`Enemy::die()\` checks \`mutant\` and calls \`Level::inherit()\` with that mutation. For a mind-endowed champion, \`mutant\` holds the same choice as \`mind\`. The player receives an **offer**, not an immediate grant: inheritance requires mutation rules, a Changeling player, no current offer, and a mind the player does not already own. The tier-one offer lasts 12 seconds and is anchored to the player's position. The normal offer logic can dismiss it when time runs out or the player walks more than 160 pixels away. Accepting it grants the mutation. Thus a death does not always transfer the champion's power.

### Reading and checking this code

Follow the lifecycle in this order: \`Spawner::champion()\` → \`mutation::endow()\` → \`Level::tick()\` and \`Enemy::think()\` → \`Enemy::tick()\` and \`mutation::cast()\` → \`Enemy::die()\` and \`Level::inherit()\`. This shows where the plan and mind run, and why a worker goal should not perform the mind's level-changing effects.

\`testChampionMinds()\` in \`CampaignTest.cpp\` checks that the four selection rolls give four distinct minds, Synod endowment fails, a spawned champion gets a mind, Kindle burns the player and ground, Fold moves closer in its test setup, and death opens the expected Changeling offer. When changing a mind, keep the selection table, timer, target behavior, death offer, and these checks in sync.
`,
    mermaidCharts: [{
      title: "Ordinary enemy decisions and optional champion mind",
      chart: `
flowchart LR
    Spawn[Champion spawn] --> Endow[Optional mind endowment]
    Think[Worker: sense and goal queue] --> Move[Worker: move and settle]
    Endow --> Think
    Move --> Tick[Main thread: enemy tick]
    Tick --> Timer[Mind timer and target gate]
    Timer -->|Valid target| Power[Kindle Stillness Stormcall Fold]
    Timer -->|No target| Wait[Wait for next interval]
    Power --> Death[Enemy death]
    Wait --> Death
    Death --> Offer[Conditional Changeling offer]
`,
    }],
  },
];
