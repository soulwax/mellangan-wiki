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
    | "farming"
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
    | "status-resistance"
    | "game-interface";
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
### Follow one frame

The outer loop in \`Game::run()\` connects real time to the fixed-step simulation. Each iteration measures elapsed wall time, adds it to an accumulator capped at 0.25 seconds, and polls SDL events into the input state. While at least \`DT = 1/60\` second remains, it calls \`Game::tick()\` and subtracts one step. It then renders once and presents the frame. A frame can therefore contain **zero, one, or several ticks**; a long stall beyond the accumulator cap is discarded rather than simulated indefinitely. Quit and fatal renderer status end the loop.

For example, starting with an empty accumulator, a 25 ms frame runs one approximately 16.67 ms tick and leaves about 8.33 ms for the next frame. The remainder is also used for rendering interpolation when measured FPS exceeds 70; at lower FPS the renderer uses the current state. Frame timing and profiler values depend on the machine and workload.

### What a tick does

1. \`Game::tick()\` updates input, audio, hotkeys and camera-related state. If a menu is active it ticks the menu. Otherwise routing or hit-stop can prevent normal play; only the normal play path calls \`Game::play()\`. The world is still rendered when normal play is paused.
2. \`Game::play()\` handles player actions, campaign choices and travel, then calls \`Level::tick()\`. Afterwards it handles campaign bookkeeping and pending shrine, boon and level-up menus.
3. \`Level::tick()\` advances level time and housekeeping, builds the spatial grid, and gathers enemies. Four ordered worker passes think, move, compute crowd pushes and settle them; combat and experience bookkeeping also run between the first and second passes.
4. The main thread ticks live owned entities and resolves interactions, then ticks and compacts particles. Finally \`flush()\` processes deferred entity changes. Rendering starts only after all fixed ticks for that outer iteration finish.
5. \`Game::render()\` sets up the camera and temporary interpolation, renders lighting, world and GUI, then restores the simulation positions. \`vk2dRendererPresent()\` presents the frame. The profiler diagram below expands the level and rendering stages; its interactive timings are illustrative, not measurements from your game.

### Architectural Paradigm: Pragmatic "C with Classes"

**Mellangan** is engineered in **C++20** and **C11** around a strict systems-programming ethos: data locality, predictable cache residency, and deterministic 60 Hz simulation (\`DT = 1.0 / 60.0\`). Rather than deep object-oriented wrapper hierarchies or heavy runtime polymorphism, the engine combines flat data structures, bitwise state packing, and lightweight virtual dispatch at the entity root (\`SpriteObject\`).

#### System Requirements & Hardware Baseline
* **Vulkan 1.2 Core:** The engine targets a clean Vulkan 1.2 feature set (leveraging MoltenVK on macOS Apple Silicon). Shader pipelines are pre-compiled to SPIR-V at build time using LunarG \`slangc\`.
* **Benchmarking:** \`--bench\` measures a range of enemy counts; \`--bench-gate\` checks 10,000 enemies against at least 55 fps and frame p99 no greater than 16.7 ms. Results depend on hardware and build configuration (\`src/Bench.cpp\`).
* **Windows SEH Minidump Crash Reporter:** An unhandled exception or abort records the version, world seed, active hero, and module offset backtrace to \`mellangan.log\`, writing a full \`crash.dmp\` minidump beside the executable (or redirecting to the user save directory if running from read-only application folders).

#### Core Engineering Invariants

1. **Pooled SpriteObject Allocations (\`src/entity/Pool.c\`):**
   \`SpriteObject\` routes allocation and sized deallocation through a synchronized pool. Requests through 1,520 bytes use 16-byte size classes backed by 64 KiB slab payloads; larger requests use \`malloc\`. The code also uses direct allocation when \`__SANITIZE_ADDRESS__\` is defined. An empty free list triggers a slab allocation, so pool use does not mean every request avoids the system allocator.

2. **On-Demand Gear Stats (\`src/entity/ItemStats.hpp\`):**
   A mob without gear reads a shared, zero-initialized \`ItemStats\` through \`bonus()\`. \`kit()\` allocates a mutable instance when needed. Actual object sizes depend on the compiler, build and current fields.

3. **Smooth High-Refresh Display Sub-Step Easing (120 Hz / 144 Hz+):**
   While game logic evaluates at a fixed 60 Hz step, visual rendering interpolates sprite positions, point light sources, and camera coordinates between simulation ticks using normalized fractional sub-step time $\\alpha \\in [0, 1)$:
   $x_{\\text{render}} = (1 - \\alpha) x_{\\text{prev}} + \\alpha x_{\\text{curr}}$
   A sprite displacement of 48 pixels or more bypasses interpolation. The game uses interpolation when its measured frame rate exceeds 70 fps; otherwise it uses the current simulation state.

4. **Hardware Performance Counter Telemetry & F3 Profiler Graph (\`src/Prof.c\`):**
   Selected simulation and rendering sections are bracketed by \`prof_begin(slot)\` and \`prof_end(slot)\` using SDL performance-counter timers across eight CPU timing slots:
   * \`PROF_THINK (0)\`: 4-barrier parallel enemy AI and soft-body crowd relaxation (\`Workers::run\`).
   * \`PROF_ENTITIES (1)\`: EnTT \`Owned\` iteration, status afflictions, and weapon cooldowns.
   * \`PROF_PARTICLES (2)\`: Particle kinematics and two-pointer in-place array compaction.
   * \`PROF_HOUSEKEEP (3)\`: Diurnal clock, wave spawning, CSR spatial grid rebuild, and deferred entity flush.
   * \`PROF_LIGHT (4)\`: Dynamic lightmap accumulation and \`LightField\` caster registration.
   * \`PROF_FLOOR (5)\`: 3-biome barycentric ground blending and 4-bit cardinal cliff auto-tiling.
   * \`PROF_SORT (6)\`: 64-bit sort key packing and 3-pass 12-bit LSD Radix Sort.
   * \`PROF_DRAW (7)\`: Planar water reflections, directional contact shadows, and sprite batching.
   Pressing F3 overlays a 120-frame stacked bar graph: blue represents simulation tick time, stacked beneath CPU time spent in the render call (not GPU execution time). Bars turn gold when frame time exceeds 8.3 ms, and red when exceeding the 16.7 ms target budget.

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
        Pool["Pool.c Slab Allocator<br/>(95 Used Size Classes, 64 KiB Payloads)"]:::core
        Workers["Workers.cpp Thread Pool<br/>(Atomic Compare-Exchange Chunk Stealing)"]:::core
        Prof["Prof.c Telemetry<br/>(8 Hardware Performance Slots)"]:::core
    end

    subgraph Simulation_Kernel ["Deterministic 60Hz Level Kernel"]
        ECS["EnTT Registry<br/>(Owned Lifecycle & Sparse Sets)"]:::sim
        CSR["LevelSpace.cpp<br/>(CSR Prefix-Sum Grid & Bit-Packed Terrain)"]:::sim
        AI["Goal.hpp / Plans.cpp<br/>(8-Slot Bitwise GoalQueue Ringbuffer)"]:::sim
        World["World & Noise.c<br/>(Voronoi Lattice, Barycentric Blend)"]:::sim
    end

    subgraph Render_Pipeline ["LevelRender.cpp & Screen.cpp"]
        Light["LightField.cpp<br/>(8 Shadow Casters & Perlin Flicker)"]:::gfx
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

    Note over Main: Poll input; run zero or more fixed ticks per frame
    Main->>Level: Game::play() calls level.tick() when play is active
    Note over Level: PROF_HOUSEKEEP (Begin)
    Level->>Level: night.tick(), spawner.tick(), explore(), hunt()
    Level->>Level: buildGrid() -> CSR Prefix-Sum cellStart[] & cells[]
    Note over Level: PROF_HOUSEKEEP (End) / PROF_THINK (Begin)
    Level->>Workers: Barrier 1: workers.run(n, 256, Enemy::think)
    Workers-->>Level: Sense & GoalQueue -> xWant, yWant
    Level->>Level: Combat and experience bookkeeping
    Level->>Workers: Barrier 2: workers.run(n, 256, Enemy::move)
    Workers-->>Level: Velocity integration & Level::collide
    Level->>Workers: Barrier 3: workers.run(n, 256, Enemy::push)
    Workers-->>Level: Read CSR Grid -> xPush, yPush
    Level->>Workers: Barrier 4: workers.run(n, 256, Enemy::settle)
    Workers-->>Level: Commit xPush, yPush & re-collide
    Note over Level: PROF_THINK (End) / PROF_ENTITIES & PARTICLES
    Level->>Level: Tick Owned Entities, Compact Particles, flush() Dead/Pending
    Note over Main: After all ticks, render once
    Main->>Render: renderLight(s) [PROF_LIGHT]
    Render->>VK2D: scatter() Surfaces/Props + Offscreen Lightmap Glows
    Main->>Render: render(s) [PROF_FLOOR -> PROF_SORT -> PROF_DRAW]
    Render->>Render: renderFloor(s) + 64-Bit Key Pack + 3-Pass LSD Radix Sort
    Render->>VK2D: Planar reflect(s) -> LightField Shadows -> Sorted Sprites
    Main->>VK2D: GUI, then present
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
* **Layer-Transition Shadow Flush:** During the main draw loop over \`keys\`, the moment the first key with \`(k >> 56) >= 1\` is encountered, all Layer 1 occluders project radial contact shadows from up to 8 active point light casters (\`lights.cast(s, e->x, e->y, width, height)\`) before any Layer 1 sprite body is drawn.
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
    Caster["LightField::add(x, y, reach, strength)<br/>Up to 8 Active Casters"]:::light
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
      "Sized deallocation, 16-byte pool size classes, on-demand gear stats, and status bitmasks.",
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

1. **Size classes and fallback:**
   \`classOf(size)\` rounds requests up in 16-byte units after treating zero as one. Indices 1–95 cover requests through 1,520 bytes; index 0 is unused. Larger requests go directly to \`malloc\`. When \`__SANITIZE_ADDRESS__\` is defined, all requests use the direct path. The pool refills a class with a new slab when its free list is empty.

2. **On-demand gear stats (\`ItemStats.hpp\`):**
   Ungeared mobs read a shared immutable zero-initialized instance through \`Mob::bonus()\`. \`Mob::kit()\` creates mutable stats on demand. Exact object sizes vary with the build and the types' current fields.

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
   Pool operations are synchronized using Windows \`SRWLOCK\` (\`AcquireSRWLockExclusive\`) or POSIX \`pthread_mutex_t\`, so concurrent access to the pool is serialized.
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
    ClassOf["classOf(size) = (size + 15) >> 4<br/>16B Grain, 95 Used Classes (16B..1520B)"]:::pool
    Fallback["malloc or free<br/>Oversized or sanitizer direct path"]:::mem
    Lock["POOL_LOCK()<br/>Win32 SRWLOCK / POSIX Mutex"]:::pool
    FreeArr["freeList[c] Intrusive Head<br/>O(1) Pop on Alloc / Push on Free"]:::mem
    Refill["refill(c): malloc(sizeof(Slab) + 64KB)<br/>Carve SLAB / size Nodes in Reverse"]:::mem

    New -->|"operator new(size)"| ClassOf
    Del -->|"sized delete"| ClassOf
    ClassOf -->|"class 1 to 95"| Lock --> FreeArr
    ClassOf -->|"class 96 or greater, or direct mode"| Fallback
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

    SpriteObject <|-- Particle
    SpriteObject <|-- Entity
    Entity <|-- Mob
    Mob <|-- Enemy
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
      "Chunked worker dispatch, completion tracking and the four enemy update passes.",
    sourceFiles: [
      "src/Workers.cpp",
      "src/Workers.hpp",
      "src/entity/enemy/Enemy.hpp",
      "src/level/LevelSpace.cpp",
    ],
    content: `
### Zero-Allocation Fork-Join Concurrency (\`src/Workers.cpp\`)

**Mellangan** uses a persistent worker pool (\`src/Workers.cpp\`) for enemy thinking, movement, crowd separation and settling. It starts \`max(2, hardware_concurrency()) - 1\` background workers; the calling thread also processes chunks. This avoids creating worker threads for each pass, but does not guarantee a particular frame rate.

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

If the main thread finishes all chunks via \`work(...)\`, \`finished == total\` is satisfied immediately, allowing the engine to step past the barrier without waiting for descheduled worker threads to wake up.

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
Each level tick runs four sequential worker passes; each pass completes before the next starts:
1. **Barrier 1: Sense & Think (\`Enemy::think\`):** Reads player and landmark states, updates \`GoalQueue\`, and writes desired velocities (\`xWant, yWant\`).
2. **Barrier 2: Movement & Terrain Collision (\`Enemy::move\`):** Integrates velocity against terrain tiles, handling sliding and friction.
3. **Barrier 3: Crowd Proximity Query (\`Enemy::push\`):** Reads neighbor positions from the CSR spatial grid and accumulates soft-body separation vectors into \`xPush, yPush\`.
4. **Barrier 4: Separation Settle (\`Enemy::settle\`):** Commits separation displacements and resolves final boundary clamping.

#### Thread-Safe PRNG (\`Enemy::roll\`) & Deferred Side Effects
Each monster instance maintains a private 32-bit Xorshift PRNG seed (\`Enemy::roll()\`). A per-enemy seed keeps that enemy’s random choices separate from the global generator. Flags such as \`wantsFire\` and \`wantsLeader\` carry deferred actions into \`Enemy::act()\` during the serial entity tick after the worker passes. These design choices alone do not prove that every aspect of the full simulation is deterministic.
`,

    mermaidCharts: [
      {
        title: "Workers::run Atomic Compare-Exchange Chunk Stealing Protocol",
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

When an enemy proceeds to its goal plan in \`Enemy::think()\`, it selects a target via \`Enemy::quarry()\` (\`src/entity/enemy/Enemy.cpp\`)—evaluating the player alongside any active summoned \`Ally\` companions (\`src/entity/Ally.cpp\`)—and then constructs a transient \`Sense\` packet combining **velocity-intercept target leading** with a **forward vision cone check**:

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
   - Living, non-lure allies within 110 px compete with the player and other eligible allies by squared distance; the lowest current value wins.
   - A **\`Decoy\` (\`Mirror Image\`, \`def.lure == true\`)** has double the aggro capture radius (\`reach = 220.0f\`) and multiplies its squared distance by **\`0.2\`** (\`d *= 0.2\`), making it appear $\\sqrt{5} \\approx 2.236\\times$ closer than it physically is so nearby monsters aggressively peel off the player to attack the decoy!
   - If the player is dead, living allies in range can still be selected. Otherwise, sensing returns an unseen point 400 px away whose direction changes with time, so enemies do not continue tracking the fallen player.
2. **Predictive Intercept Vector (\`lead\`):**
   Instead of steering naively toward the target's current position \`(p.x, p.y)\`, the enemy estimates time-to-intercept \`raw / max(20.0, type.speed)\` (clamped to \`0.7s\` and scaled by \`0.6\`, yielding up to \`0.42s\` of velocity lookahead) and offsets \`(s.xd, s.yd)\` by \`(p.xa * lead, p.ya * lead)\`.
3. **The 113° Forward Sight Cone (\`s.seen\`):**
   Since \`(s.xn, s.yn)\` points from the **enemy to the target**, its negation \`(-s.xn, -s.yn)\` points from the **target to the enemy**. Taking the dot product with the target's unit aim vector \`(p.xAim, p.yAim)\` yields $\\cos(\\theta)$:
   \`-(p.xAim * s.xn + p.yAim * s.yn) > 0.55\`.
   For a unit aim vector, the threshold corresponds to an approximately 113.3° cone around the selected target’s aim. The 300 px limit uses the predicted displacement, so it is not necessarily the enemy’s current distance from the target.

---

### Summoned \`Ally\` Companions & Golden-Angle Phyllotaxis Orbit (\`src/entity/Ally.cpp\`)

Allies inherit from \`Mob\`. The current kinds include Wolf, Hawk, Ghoul, Skeleton, Drone, Crew, Decoy, Ghost, Quickened and Beguiled; their definitions are in \`Ally.cpp\`. Summon forms create or refresh some of them. Their target selection is:

\`\`\`cpp
Mob *Ally::pick() const {
  if (def.lure)
    return nullptr;
  const Player &p = *level->player;
  double hx = x - p.x, hy = y - p.y;
  if (hx * hx + hy * hy > LEASH * LEASH)
    return nullptr;
  for (Enemy *e : level->nearest(x, y, SIGHT, 1, true)) {
    double ex = e->x - p.x, ey = e->y - p.y;
    if (ex * ex + ey * ey < LEASH * LEASH && e->type.damage > 0)
      return e;
  }
  return nullptr;
}
\`\`\`

- **Target and leash:** A lure does not choose a target. Other allies ask for the nearest eligible enemy within 150 px, then require that enemy and the ally to be within 170 px of the player. The \`true\` argument applies \`Level::harms()\`, including the campaign hostility and Strike rules. Because the query requests only one enemy before checking its damage and distance from the player, failing those later checks does not make it try a second candidate.
- **Idle formation:** With no target, an ally moves toward a position around the player using \`a = slot * 2.39996 + age * 0.6\` and radius \`HOME + (slot % 4) * 12\`. The vertical offset is scaled by 0.7 and the movement pace is \`def.speed * 1.2\`.
- **Drone and melee attacks:** An ally with \`def.shot\`, such as the Clockwork Drone, fires a \`RecipeShot\` when in reach and its bite timer is ready. Other allies call \`landHit()\` instead. The drone definition uses a 90 px reach and a Drone Bolt recipe; it does not grant an Arcane Staff upgrade.

---

### How \`Enemy::think()\` Executes & Preempts \`GoalQueue\`

\`\`\`cpp
void Enemy::think() {
  remember();
  if (!plan)
    return void(xWant = yWant = 0);
  if (level->rules.peaceable && bide())
    return;
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
    title: "10. Hero Kits, Enemy Kinds, Traits, Champions & Bosses",
    category: "gameplay",
    summary:
      "An overview of hero kits, enemy families, traits, landmarks and regional bosses.",
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

### \`EnemyKind\` Examples: Mimics, Renegades & \`WildFoe\` Greenwood Table (\`WildFoe.cpp\`)

Beyond the 16 classic monsters and 10 regional expansion monsters (\`src/entity/enemy/ExpansionEnemy.cpp\`), \`EnemyKind\` (\`src/entity/enemy/Enemy.hpp\`) currently has **84 enum values** before \`Count\`, including special kinds such as nests and the Synod. The following are selected examples:
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

- Six Ogg tracks (night, campaign, menu, caves, boss and hearth) are decoded at initialization. \`Game::score()\` chooses a track based on mode and location, and \`Sound::tick()\` fades out before changing the stream format and track, then fades in. The current track is refilled while music is not hushed.
- Rain, wind and five place beds (forest, marsh, frost, surf and cave) use separate looping streams. \`Sound::ambience()\` sets weather targets, while \`Sound::places()\` sets place targets from clamped weights; rain and wind peaks are 0.20 and 0.14. Each tick moves the current gain 2% toward its target. Once a silent target fades below 0.002, the stream queue is cleared.
- \`Sound::mix()\` sets the device master gain and the music stream gain. Effects use the effect gain when played; the next ambience target uses the ambience gain. Mute sets the device gain to zero and restores the stored master gain when toggled back.
- Some callers gate sound by visibility, such as \`Enemy::voice()\`. \`Sound::play()\` itself has no listener position or distance attenuation parameter.

#### One-shot clip playback

\`Sound::clip()\` decodes a separate Ogg file, queues it on its own stream and initially hushes music by clearing its queue and stopping refills. \`clipGain()\` clamps the clip gain to 0–1. \`easeIn()\` can resume and fade in music before the clip ends; \`endClip()\` releases the stream and decoded data and also clears the hush. See the intro playback chapter for the video that uses this path.

### Automated Test Suites, Benchmarks & Visual QA (\`src/test/\`)

Mellangan includes a built-in verification and visual QA harness in \`src/test/\`:
- **Deterministic Unit & Simulation Suites (\`src/test/Test.cpp\`):**
  1. \`CoreTest.cpp\`: Slab allocator (\`testPoolAllocAndFree\`, \`testPoolConcurrency\`), level lifecycle, and multi-threaded AI passes.
  2. \`CombatTest.cpp\` & \`PayloadTest.cpp\`: 7 statuses (\`testStatuses\`, \`testStatusDamage\`, \`testNewStatuses\`), 16 weapon payloads (\`testNewPayloads\`), and shape forms (\`testShapeForms\`).
  3. \`ItemTest.cpp\`: 30 affix families, rarity rolls, treasure classes, paper-doll inventory (\`testInventory\`), and reversible gear stats (\`testEquipStats\`).
  4. \`AllyTest.cpp\`: Summon cap refreshing, quarry aggro redirection, decoy lure weighting, and friendly-fire immunity (\`testAllies\`).
  5. \`ClassTest.cpp\`, \`ArsenalTest.cpp\`, \`BestiaryTest.cpp\`, \`ExpansionEnemyTest.cpp\`, \`ExpansionTest.cpp\`: Hero kits, weapons, enemies, and traits.
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
    Vorbis["Music tracks<br/>menu, night, campaign, caves, boss, hearth"]:::mix
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
      "src/meta/Heat.cpp",
      "src/level/Level.cpp",
      "src/entity/enemy/SynodFoe.cpp",
      "src/test/RunRulesTest.cpp",
    ],
    content: `
### The night clock

\`Night\` and \`RunRules\` control when dawn arrives. A default survival run starts with a 900-second night and a 60-second dawn pull per recorded shrine:

$$\\text{dawnAt}=\\text{nightStart}+\\text{nightLength}-(\\text{endsAtDawn} ? \\text{lit}\\times\\text{dawnPull}:0)$$

\`left()\` clamps the remaining time to zero. In an ending-at-dawn run, \`Night::tick()\` calls \`game.onDawn()\` once the clock reaches the deadline. In cycling modes, \`Night::cycle()\` alternates night and day using \`dayLength\`; recorded shrines do not shorten that cycle. In the last 150 seconds of a night, \`daylight()\` uses a quadratic ramp. During daytime in a cycling mode it uses the remaining day time divided by 20, clamped to 0–1.

### Kindling and rekindling shrines

Standing inside the footprint of a cold shrine adds \`DT * level.kindleRate / 6\` to the progress meter; outside a cold shrine progress decays by \`DT / 2\`. The first kindling records the shrine up to \`MAX_LIT = 64\`, increments the Codex count and sets \`offering\` for the shrine menu. It also marks the biome, pulls gems within 240 px toward the hero, creates a nova and effects, and attempts to spawn a ring of \`8 + 3 * lit\` guards at radius 170 px. Spawn rules can reject individual guards.

Synod lamplighters can snuff a shrine. A dark shrine can be kindled again, restoring it without incrementing \`lit\` or the Codex count and without a second offering; the guard wave still occurs. \`dawnAt()\` uses the recorded \`lit\` count, not the current number of burning shrines.

### Omens

When \`rules.omen\` requests a roll, level construction chooses one of 11 omens with 85% probability; otherwise \`portent()\` returns \`CALM\`. A nonnegative \`rules.omen\` forces an omen index, while a negative value other than the roll sentinel leaves it calm. The \`Omen\` structure contains separate fields for movement, XP, elite and health scaling, kindling, wave sizes and timing, and special spawn timing. Its full values are in \`src/level/Flavour.cpp\`; the in-game notes summarize their intent:

- **Blood Moon:** more experience and elites.
- **Aurora:** faster shrine kindling.
- **Gale:** faster movement for the hero and foes.
- **Outlaw Season:** earlier and more frequent renegades.
- **Mimic Moon:** more mimics and richer experience.
- **The Swarm:** larger hordes with less-hardy foes.
- **Iron Night:** fewer, tougher foes.
- **War Drums:** elites always learn a skill.
- **Long Night:** denser, more frequent waves.
- **Quiet Hours:** gentler waves and fewer rewards.
- **Champion's Hour:** named foes appear more often.

The \`rate\`, \`waves\`, \`bands\`, \`mimics\` and \`champions\` fields are timing factors in their respective call sites; a smaller interval factor can mean more frequent events. They should not all be read as spawn-rate multipliers.

### Spawner scheduling

\`Spawner::tick()\` runs the trickle first. During dawn it then runs named-enemy logic and returns. At night it also checks waves, mimics, renegade parties, champions, barrels and bosses; \`rules.waves\` and \`rules.bosses\` gate the appropriate streams. Initial deadlines include 60 seconds for the first wave, 70 for mimics, 160 for renegades, 110 for champions, 15 for barrels and 150 for bosses, subject to the factors and conditions in \`tick()\`.

\`trickle()\` multiplies its base interval by the omen's \`rate\`, then divides by spawn rate, pressure and the appropriate day-rate factor. Its batch grows with elapsed time and checks \`enemyCap\`. \`pick()\` first considers thieves, night stalkers and grave robbers when eligible, then a biome or cave-local pool, and finally the common pool. Spawn placement through \`ring()\` adds the screen reach to the requested distance and can bias toward the hero's travel direction. \`spawn()\` can reject a location because it is safe, lost, a sanctum or warded; do not assume every scheduled attempt creates an enemy.

Six wave templates have individual unlock times and avoid repeating the last selection. A wave's size is based on the balance settings, omen and run rules. Other streams have their own timing and population checks: for example, mimics and champions can be skipped when their current limits are reached. \`Spawner::spawn()\` applies threat-scaled health and damage and can promote eligible foes to elites.

### Heat, daily runs and endless night

\`applyHeat()\` applies the first \`heat\` rungs cumulatively, clamped from 0 to 10. The rungs increase enemy health, speed and damage; double base elite chance; halve shrine dawn pull; reduce the spawn interval and increase the cap; reduce player health and XP; increase horde base and maximum; and finally increase night length by 20%. The definitions and exact factors are in \`src/meta/Heat.cpp\`.

A daily run derives heat from its world code in the class menu, giving a value from 0 to 3. The player still chooses their hero. After reaching dawn in a non-campaign run, the dawn menu allows the player to continue into endless night. \`Game::beginEndless()\` extends the night, and \`Game::observe()\` compounds enemy health by 1.10 and damage by 1.05 each elapsed minute.
`,
    mermaidCharts: [
      {
        title: "Night clock and shrine lifecycle",
        chart: `
flowchart TD
    Cold[Cold shrine] -->|"stand inside and charge"| Kindle{Previously recorded and dark?}
    Kindle -->|No| First[Record shrine and offer blessing]
    Kindle -->|Yes| Relight[Restore shrine without another offering]
    First --> Effects[Pull gems and attempt guard wave]
    Relight --> Effects
    Effects --> Clock[Update night and dawn deadline]
    First -->|"can be snuffed"| Cold
    Clock -->|"ends-at-dawn and deadline reached"| Dawn[Trigger dawn]
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

#### Achievements and Codex unlocks (\`src/meta/Feats.cpp\`)
The \`FEATS\` table currently contains 64 achievements. Its predicates cover lifetime milestones, survival runs, classes, campaign acts, rescues, delves, founders and campaign endings. The Codex displays their names and hints across pages. Achievement flags are stored in a 64-bit field, and a compile-time assertion limits the table to 64 entries.

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
| Anti-aliasing | \`msaa\` | 0–3 selects Off, 2×, 4× or 8× MSAA; the applied sample count is limited by renderer capabilities. |
| Intro | \`intro\` | 0 or 1; controls whether the optional intro is eligible at startup. |
| Language | \`language\` | Selects English or a language file discovered in \`res/lang/\`. |

Numeric rows clamp at their ends; labeled choices cycle. Each change calls \`Game::applySettings()\` and requests a save, subject to \`writes()\`. Applying settings updates the audio mix, camera shake, selected palette and scaling mode. When a window exists, it also updates fullscreen, selects VSync or triple-buffer screen mode, and applies the supported MSAA setting. Other consumers read settings directly, including particle rendering and flash effects.

#### Colour schemes and verification (\`Palette.hpp\`)

The five schemes define colors for warnings, damage, healing, comparison indicators, item rarities and night-touched items. Game code selects these colors at their use sites; this is not a full-screen color transformation. The Monochrome scheme is a named UI palette and does not turn the entire game image grayscale.

\`PaletteTest.cpp\` models each alternative under a corresponding simulated vision matrix and compares selected color distances against the standard scheme. It tests item rarity separation, hurt versus heal, and warning versus a sample grass color. These checks help catch regressions in those comparisons; they do not establish readability for every scene, display or player.

#### Controls and rebinding
The controls menu saves 18 keyboard bindings and nine gamepad bindings in \`keys.txt\`. See **Input, Controls & Rebinding** for the fixed controls, conflict handling, analog stick behavior and prompt substitutions.

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
  },
  {
    id: "combat-status-draft",
    title:
      "23. 7 Status Afflictions, 0.5s DoT Ticks, Bleed Stacking & Level-Up Draft",
    category: "gameplay",
    summary:
      "Seven status effects, half-second damage ticks and the weighted level-up and treasure draft.",
    sourceFiles: [
      "src/entity/Status.hpp",
      "src/entity/Mob.cpp",
      "src/menu/LevelUpMenu.cpp",
      "src/entity/pickup/Chest.cpp",
      "src/item/Upgrade.cpp",
      "src/hero/Mutation.cpp",
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
   - Re-applying any other status retains the stronger power. All statuses retain the greater of their current remaining time and the new duration (capped at 60 seconds).

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

For an isolated effect with unchanged power, no resistance and a target that survives the full duration, \`power = 10\` and \`duration = 1.3s\` produce approximately 5 damage at each half-second tick and 3 on expiry, or 13 total. Bleed uses the movement flag at the tick that pays out damage, so changing movement during an accumulated interval can change its total.

---

### Level-up and treasure drafts (\`src/menu/LevelUpMenu.cpp\`)

A normal level gain increments \`pendingLevels\`. Taking a chest increments both \`pendingLevels\` and \`pendingTreasures\`. When the game processes pending levels, \`LevelUpMenu::open()\` constructs a draft; the constructor consumes one pending treasure, if present, and marks that draft as treasure. Campaign level banking can change when a draft is processed.

#### The ordinary upgrade pool

The constructor builds its pool from the player's own \`p.upgrades\`. It counts owned ordinary weapons and passives separately, excluding relics and skills. A candidate must be visible, non-rare, non-skill and not maxed; it must already be owned or have room in its category, and any class owner must match the player's hero. \`mutation::slots()\` supplies the category limit: the normal base is six, with an extra weapon slot for the Second Arms mutation.

Up to three ordinary cards are drawn without replacement. Each draw uses weight 3 for an owner-specific upgrade, 2 for a hero-favoured upgrade with no owner, and 1 otherwise. If the pool is empty, the menu inserts a null choice, which heals the player by 40 when applied.

#### The special card: skill, evolution, then relic

The constructor prepares a list of evolvable upgrades and a separate skill list. The skill list contains skills other than the player's current skill whose owner is either unset or matches the hero. It then uses one \`if / else if\` chain, so at most one special card is added:

1. If the skill list is nonempty, the first ordinary choice is not null, the player is at least level 4, and a 25% roll succeeds, add a random skill. This check also runs for treasure drafts.
2. Otherwise, if the draft is treasure and the evolution list is nonempty, add one random evolution. \`canEvolve()\` requires a partner, a non-evolved upgrade at maximum level, and an owned partner at level 1 or above.
3. Otherwise, if a non-maxed, visible relic is available and the draft is treasure or a 3% roll succeeds, add a random relic.

A treasure draft therefore does **not** guarantee an evolution: the skill branch takes precedence. \`LevelUpMenu::open()\` displays a menu only when the resulting draft has more than one choice; otherwise it applies the sole choice immediately and continues processing pending levels. \`apply()\` evolves the chosen upgrade, levels it, or heals for a null choice, then decrements \`pendingLevels\`.

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
        title: "Level-up and treasure draft selection",
        chart: `
flowchart TD
    Start[Consume a pending treasure if present] --> Pool[Filter player upgrades and draw up to three]
    Pool --> Empty{Pool empty?}
    Empty -- Yes --> Heal[Insert heal choice]
    Empty -- No --> Skill{Eligible skill and level 4 and 25 percent roll?}
    Heal --> Evolution
    Skill -- Yes --> AddSkill[Add random skill]
    Skill -- No --> Evolution{Treasure and evolution ready?}
    Evolution -- Yes --> AddEvolution[Add random evolution]
    Evolution -- No --> Relic{Relic available and treasure or 3 percent roll?}
    Relic -- Yes --> AddRelic[Add random relic]
    Relic -- No --> Finish[Finish draft]
    AddSkill --> Finish
    AddEvolution --> Finish
    AddRelic --> Finish
`,
      },
    ],
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

Enemy kinds use combinations of \`Goal\` objects wired into \`PLANS\` (\`src/entity/enemy/ai/Plans.cpp\`). A compile-time assertion guarantees that every \`EnemyKind\` has a corresponding plan:

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
    title: "25. Item Generation, Rarity and Run Rules",
    category: "gameplay",
    summary: "Item bases and quality tiers, affixes, rarity rolls, night-touched items and loot drops.",
    sourceFiles: [
      "src/item/loot/ItemBase.cpp",
      "src/item/loot/Affix.cpp",
      "src/item/loot/Loot.cpp",
      "src/item/loot/Unique.cpp",
      "src/entity/pickup/ItemDrop.cpp",
      "src/level/RunRules.hpp",
    ],
    content: `### Item bases and quality

Equipment is built from a base in \`ItemBase.cpp\`. The three quality tiers are **Worn**, **Fine** and **Masterwork**; their quality-level offsets are 0, 18 and 36. Base eligibility and weighting depend on item level. Ordinary base selection excludes implants, which are obtained through other mechanics.

### Affixes and rarity

The affix registry contains **31 families: 14 prefixes and 17 suffixes**. Families do not all have the same number of tiers: for example, projectile count has three tiers and skills have two. Eligible affixes depend on the item and its level. Rare items request more affixes than magic items, but the generator can finish with fewer when it cannot find enough eligible choices.

Rarity is rolled in order: unique, rare, magic, then superior or normal. Each of the first three checks draws a new random number. If their respective thresholds are U, R and M, the initial probabilities are U, (1 − U)R and (1 − U)(1 − R)M. Of the remaining outcomes, one eighth is superior and seven eighths normal. Magic find uses diminishing returns for the unique and rare thresholds, while the magic threshold uses magic find directly. The explorer below shows these initial outcomes.

The final item can differ from that initial roll: a rarity floor may raise it, and a unique roll can fall back to a rare item if an eligible unique cannot be made. The game does have unique definitions in \`Unique.cpp\`.

### Night and dropped items

At night, item drops receive extra weight in the loot selection. A magic or rare item can become night-touched on a 1-in-25 roll; the effect requires at least one affix, improves one affix by up to two tiers and adds a curse. The Frail curse is displayed as −10% maximum health, but equipment application currently subtracts **10 maximum health** as a flat amount.

Dropped equipment follows a short arc; potions are separate pickups. Rare-or-better items and night-touched items can show a temporary beam. When at least 120 item drops already exist, newly rolled drops below rare are skipped, including night-touched magic items. Rare-or-better equipment produces a landing effect.

### Run rules

\`RunRules\` configures conditions such as loot, timing and safe zones for a run. \`safeAt(x, y)\` checks whether a position lies inside a configured circular safe zone; the consequences depend on the code that calls it.
`,
    mermaidCharts: [{
      title: "From rarity roll to item",
      chart: `flowchart TD
    A[Select eligible base and tier] --> B[Roll unique, rare, then magic]
    B --> C[Apply rarity floor]
    C --> D{Unique roll?}
    D -->|Yes| E[Try an eligible unique]
    E -->|Unavailable| F[Generate rare affixes]
    D -->|No| G[Generate rarity properties]
    E -->|Available| H[Unique item]
`,
    }],
    interactiveComponent: "loot",
  },
  {
    id: "paper-doll-gear-combat",
    title: "26. Equipment, Inventory and Combat Effects",
    category: "gameplay",
    summary: "Six equipment slots, the bag, equipping and removing gear, combat effects and ground labels.",
    sourceFiles: [
      "src/menu/InventoryMenu.cpp",
      "src/entity/PlayerGear.cpp",
      "src/item/loot/Equip.cpp",
      "src/entity/enemy/Enemy.cpp",
      "src/gui/HudWorld.cpp",
    ],
    content: `### Equipment and bag

The inventory has **six equipment slots**: weapon, offhand, armour, two charms and implant. The bag has 32 positions arranged in an 8 × 4 grid. Directional navigation wraps through the bag and links its left edge to the equipment slots. Mouse movement selects a cell; a left click or confirm activates it, and the erase action drops an item.

### Putting on and removing gear

An item must fit the hero and its target slot. If the first charm slot is occupied and the second is empty, another charm goes into the second slot. Equipping into an occupied slot swaps the old item into the selected bag position. Implant changes have additional restrictions: the player must not be a changeling and must be in a safe zone; equipping an implant also increases suspicion. Removing equipment through the unequip action requires room in the bag.

\`applyItem\` applies the base implicit, affixes and curse with a positive sign on equip and a negative sign on removal. Maximum-health changes also adjust current health: an increase adds health, while a decrease clamps current health to the new maximum. Items that grant an upgrade add levels up to the appropriate item tier; the player records the levels added by that item so removal can subtract them.

### Effects in combat

Equipment stats feed into damage and on-hit effects in \`Enemy::hurt\`. Non-periodic hits can receive critical and other damage modifiers; eligible hits can also trigger effects such as burn, chill, poison, bleed, leech and shock. These effects depend on the attack source and the corresponding player stats, so an item description alone does not guarantee that every hit will trigger one.

### Ground labels

\`Hud::lootLabels\` sorts visible labels and tries to place them without overlapping earlier labels or HUD obstacles. It makes up to 12 placement attempts per label, so a dense pile is not guaranteed to be perfectly separated.
`,
    mermaidCharts: [{
      title: "Equipping and removing an item",
      chart: `flowchart TD
    A[Select item in bag] --> B[Check fit and slot restrictions]
    B --> C[Swap or equip item]
    C --> D[Apply item stats and granted levels]
    D --> E[Remove item]
    E --> F[Reverse stats and recorded levels]
`,
    }],
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
      "src/campaign/Standing.cpp",
      "src/entity/Faction.hpp",
      "src/level/Aggro.cpp",
      "src/level/RunRules.hpp",
      "src/entity/pickup/Gem.cpp",
      "src/test/PeaceableTest.cpp",
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
       level->game.announce(lang.seekerFollows);
   }
   \`\`\`

2. **Following Speed (\`TRAIL = 50.0f\`):**
   Once following, the sanctuary seeker moves toward the player when more than 20 px away, using a speed capped by both 50 px/s and $1.05\\times$ the player's speed:
   $$v_{\\text{trail}} = \\min(50.0, v_{\\text{player}} \\times 1.05)$$
   Bastion routing and wall collision constrain the path. A fast player can still outrun the follower and break the leash.

3. **The Leash Break Theorem (\`LEASH = 260.0f\`):**
   If the hero dies or passes the separation threshold ($d > \\text{LEASH}$), the tether breaks! The sanctuary seeker reverts to \`Mode::Lost\`, ceases movement, and cries out for help:
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

5. **Dialogue:** Lost and following seekers use localized lines. At home, the nearest eligible townsperson can speak when the player is nearby. They can share a recipe or a founder rumour at intervals, falling back to one of four town lines otherwise.

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
   Once its reload timer reaches zero, the tower scans a circular perimeter of radius $\\text{RANGE} = 190$ px centered at the arrow slit ($y - 40$). It uses \`Level::targets()\` to select the nearest eligible living, unburied enemy and looses an arrow projectile at **260 px/s**, then resets its reload to 1.1 seconds:
   $$damage = 8.0 + 2.0 \\times \\text{Player::lvl}$$
3. **Dynamic Lightfield Beacon:**
   The tower summit casts an additive flame glow into \`level->lights\` with a natural sinusoidal flicker:
   \`\`\`cpp
   s.glow(xp, yp - 40, 70, FLAME * (0.8f + 0.2f * std::sin(t * 6)));
   \`\`\`

---

### Sentries and walls (\`src/campaign/Sentry.cpp\`)

Sentries select the nearest eligible living, unburied enemy within 120 px of their post. Their target and cleave use \`Level::targets()\`, which applies \`harms()\`: in a peaceable campaign this ordinarily selects angry enemies, while holding Strike also permits calm targets. Sentries chase within 70% of their guard radius and cleave nearby eligible enemies when in reach. Their movement passes through the active \`RunRules::wall\` callback. Their physical shove checks nearby enemies independently of the target filter; the wall callback constrains that displacement except for Shades. This keeps ordinary enemies from being pushed through a bastion wall.

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

### Campaign standing, combat and experience

Campaign rules enable \`autoXp\` and \`peaceable\`. \`Gem::drop()\` immediately gives positive XP to the player when \`autoXp\` is enabled; in survival, the ordinary path creates a collectible gem. This applies wherever a reward uses \`Gem::drop()\`, so campaign players do not need to collect those XP gems.

Faction standing begins from lineage, class and a seed-based tilt. \`standing::spread()\` changes the chosen faction and propagates a scaled change to other reputed factions according to their relationship. \`standing::disposition()\` maps the resulting value to Hated, Disliked, Indifferent, Liked, Friendly or Revered; the thresholds are defined in \`Level\` and \`Campaign\` rather than inferred from the labels.

In a peaceable campaign, enemies normally wait or wander. Hated enemies rouse when they see a living hero. Disliked enemies warn nearby heroes and attack if approached closely or if the hero lingers. Bosses, champion definitions and titled enemies are treated as hated. Aggro can also spread to nearby members of the same faction; a group may flee after enough members fall. Aggro expires when the enemy loses sight for 20 seconds or goes 480 px from where it was roused.

The hero's automatic weapons run while combat is active or while Strike is held. Combat is refreshed when an aggroed enemy is within 480 px, and remains active for five seconds after the last refresh. Ordinarily player-targeted attacks use \`Level::harms()\` to spare foes that are not angry. Holding Strike (F or R3 by default) permits attacks on otherwise peaceful foes; a direct player hit on a calm foe rouses its nearby faction group and costs standing, except for the Synod standing penalty in this particular path. Foe death and other campaign actions have their own reputation effects.

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

**Herleitung der Widerstandswirkung.** Bei konstanter Schadensrate $P_r$ ist der Gesamtschaden das Zeitintegral

$$D_r=\\int_0^{T_r}P_r\\,dt=P_rT_r.$$

Stärke und Dauer werden jeweils mit $1-r$ multipliziert. Einsetzen zeigt, woher das Quadrat kommt:

$$D_r=[P(1-r)]\\,[T(1-r)]=PT(1-r)^2.$$

Im unbegrenzten Bereich ist die Ableitung nach dem Widerstand

$$\\frac{\\partial D_r}{\\partial r}=-2PT(1-r).$$

Für $P,T>0$ und $0\\le r<0.75$ ist sie negativ. Zusätzlicher Widerstand verringert also den Schaden; der Betrag der Ableitung wird mit wachsendem $r$ kleiner. Sobald eine Obergrenze für Widerstand, Stärke oder Dauer greift, beschreibt diese Ableitung den betroffenen Codepfad nicht mehr. Ein einmaliger Treffer oder ein Effekt mit fester Dauer folgt ebenfalls einer anderen Formel.

**Grenzen des Modells.** Die Stärke ist je Zustand begrenzt, die Dauer auf 60 Sekunden gedeckelt, und bei erneuter Anwendung kann ein bereits vorhandener stärkerer oder längerer Effekt erhalten bleiben. Blutung addiert Stärke und verursacht während der Bewegung des Ziels den $1.6\\times$-fachen Schaden. Tod oder Entfernung können die Abfolge vorzeitig beenden. In diesen Fällen muss die Zustandsaktualisierung verfolgt werden; die Formel für den einzelnen Effekt reicht nicht aus.

### 3. Beutewahrscheinlichkeiten: abnehmender Zuwachs und bedingte Wahrscheinlichkeit

\`rarityOdds()\` verwendet $S=1+L/40$ mit der Gegenstandsstufe $L$ sowie die Sättigungsfunktion

$f_k(m)=\\frac{mk}{m+k}$

Für $m\\ge0$ und $k>0$ sind Nenner und Zähler definiert. Die beiden Ableitungen haben entgegengesetzte Vorzeichen:

$$f_k'(m)=\\frac{k^2}{(m+k)^2}>0,\\qquad
f_k''(m)=-\\frac{2k^2}{(m+k)^3}<0.$$

Der umgerechnete Bonus steigt also, aber seine Steigung nimmt ab. Durch Division von Zähler und Nenner durch $m$ folgt außerdem $\\lim_{m\\to\\infty}f_k(m)=k$. Die Prüfungen auf einzigartige und seltene Gegenstände verwenden $k=250$ beziehungsweise $k=600$; die Prüfung auf magische Gegenstände nutzt den unveränderten Bonus. Jede Prüfungswahrscheinlichkeit ist auf 1 begrenzt:

$u=\\min\\left(1,\\frac{S}{700}\\left(1+\\frac{f_{250}(m)}{100}\\right)\\right)$
$r=\\min\\left(1,\\frac{S}{90}\\left(1+\\frac{f_{600}(m)}{100}\\right)\\right),\\qquad g=\\min\\left(1,\\frac{S}{7}\\left(1+\\frac{m}{100}\\right)\\right)$

Dies sind **bedingte Prüfungen**, keine drei endgültigen Wahrscheinlichkeiten, die sich einfach addieren ließen. \`rollRarity()\` prüft zuerst auf einzigartige Gegenstände, bei Fehlschlag auf seltene und erst bei erneutem Fehlschlag auf magische. Nach der Multiplikationsregel für bedingte Wahrscheinlichkeiten gilt:

$P(U)=u,\\qquad P(R)=(1-u)r,\\qquad P(M)=(1-u)(1-r)g$

Die Restwahrscheinlichkeit nach drei Fehlschlägen ist

$$P(O)=(1-u)(1-r)(1-g).$$

Die vier Zweige $U,R,M,O$ teilen den ursprünglichen Wurf vollständig auf. Einsetzen und Ausklammern zeigt dies ohne eine Annahme über gleiche Prüfungswahrscheinlichkeiten:

$$\\begin{aligned}
P(U)+P(R)+P(M)+P(O)
&=u+(1-u)\\left[r+(1-r)\\bigl(g+(1-g)\\bigr)\\right]\\\\
&=u+(1-u)[r+(1-r)]\\\\
&=1.
\\end{aligned}$$

\`rollRarity()\` teilt den Restzweig $O$ anschließend durch einen gleichverteilten Ganzzahlwurf von 0 bis 7: Ein Wert liefert \`Superior\`, sieben Werte liefern \`Normal\`. Vor späteren Regeln der Gegenstandserzeugung gilt daher

$$P(\\mathrm{Superior})=\\frac{P(O)}8,\\qquad
P(\\mathrm{Normal})=\\frac{7P(O)}8.$$

Die Reihenfolge der ersten drei Prüfungen ist wesentlich: Würde zuerst auf selten geprüft, betrüge die endgültige Wahrscheinlichkeit für einzigartig $(1-r)u$ statt $u$.

Bei Gegenstandsstufe 40 und ohne Bonus auf magische Funde ist $S=2$: Die Prüfung auf einzigartig hat eine Wahrscheinlichkeit von etwa 0.286 %, die auf selten von 2.222 %. Die tatsächliche Wahrscheinlichkeit, die Prüfung auf selten zu erreichen und zu bestehen, beträgt etwa $0.997143\\times0.022222=2.216\\%$. Die Gegenstandserzeugung kann danach eine Mindestseltenheit festlegen oder ein einzigartiges Ergebnis gesondert behandeln. Die Gleichungen beschreiben daher die anfängliche Seltenheitsbestimmung und nicht jedes endgültige Beuteergebnis.

## Teil II. Datenstrukturen als mathematische Umformungen

### 4. Präfixsummen: aus einer Menge zusammenhängende Zellbereiche bilden

\`Level::buildGrid()\` zählt nicht vergrabene Gegner je Rasterzelle, bildet Präfixsummen und verteilt Zeiger in einem zusammenhängenden Feld. Angenommen, vier Zellen enthalten jeweils $[2,0,3,1]$ Gegner. Die exklusiven Anfangspositionen lauten

$[0,\\;2,\\;2,\\;5,\\;6]$

Formal sei $c_i$ die Anzahl in Zelle $i$, mit $s_0=0$ und $s_{i+1}=s_i+c_i$. Dann gilt $s_i=\\sum_{j<i}c_j$ und $s_C=N$, wobei $N$ die Gesamtzahl der zugeordneten Gegner ist. Zelle $i$ belegt das halboffene Intervall $[s_i,s_{i+1})$. Zelle 1 ist leer, weil ihre beiden Anfangspositionen gleich sind; Zelle 2 belegt die Indizes 2, 3 und 4.

**Behauptung: Die Zellbereiche bilden eine Zerlegung.** Falls alle $c_i\\ge0$ sind und die Verteilung genau $c_i$ Gegner in Zelle $i$ schreibt, sind die Bereiche paarweise disjunkt und ihre Vereinigung ist $[0,N)$.

*Beweis.* Die Präfixgleichung $s_{i+1}=s_i+c_i$ liefert zunächst $s_{i+1}\\ge s_i$. Damit ist jeder Bereich $[s_i,s_{i+1})$ gültig; bei $c_i=0$ ist er leer. Der Endpunkt eines Bereichs ist genau der Anfangspunkt des nächsten. Es gibt also weder eine Überschneidung noch eine Lücke. Aus $s_0=0$ und

$$s_C=\\sum_{i=0}^{C-1}c_i=N$$

folgt, dass die lückenlose Folge von Bereichen genau $[0,N)$ bedeckt. $\\square$

Der Aufbau des Index benötigt $O(N+C)$ Arbeit für $N$ Gegner und $C$ Zellen sowie Speicher für die Felder.

**Induktionsbeweis für das Schreiben.** Zu Beginn erhält der Schreibzeiger jeder Zelle den Wert $p_i=s_i$. Nach $j$ Schreibvorgängen in Zelle $i$ gilt als Schleifeninvariante $p_i=s_i+j$, und genau die Plätze $[s_i,s_i+j)$ dieser Zelle sind belegt. Für $j=0$ ist das Intervall leer. Ein weiterer Vorgang schreibt an $p_i$ und erhöht ihn um eins; damit gilt die Invariante für $j+1$. Wegen $j<c_i$ liegt jeder dieser Indizes vor $s_i+c_i=s_{i+1}$, also innerhalb des reservierten Bereichs. Nach $c_i$ Vorgängen ist $p_i=s_{i+1}$. Zusammen mit der disjunkten Zerlegung beweist dies, dass der Verteiler bei gültigen Zählungen weder eine Zelle überschreibt noch einen zugeordneten Gegner auslässt. Es beweist keine Sicherheit, wenn ein Gegner zwischen Zählen und Verteilen seine Zellnummer änderte; der Code sammelt deshalb Zellnummer und Zeiger gemeinsam in \`binned\`.

\`gather()\` besucht zuerst die Zelle der Abfrage und danach die Zellen im umschließenden Rasterrechteck von $(x-r,y-r)$ bis $(x+r,y+r)$. Es überspringt als entfernt markierte Gegner und endet beim vom Aufrufer vorgegebenen Höchstwert. Die Funktion prüft keinen Kreisabstand $\\|\\mathbf p-\\mathbf e\\|<r$: Der Radius bestimmt nur die besuchten Zellen. Damit ist das Ergebnis eine **grobe Kandidatenmenge**, die auch Gegner außerhalb des Kreises enthalten kann. Vergrabene Gegner werden beim Rasteraufbau in der eigenen Liste \`loose\` abgelegt und erscheinen nicht in dieser Zellabfrage.

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

**Behauptung: Die gespeicherte Richtung folgt einem Weg mit minimaler Schrittzahl zu einer Öffnung.** Dies gilt für den beim Aufbau feststehenden Graphen, wenn jede zulässige Kante dieselben Kosten von einem Schritt hat.

*Beweis.* Jede Toröffnung wird als Quelle mit Abstand null eingereiht. Werden alle Knoten mit Abstand $d$ verarbeitet, gelangt jeder noch unentdeckte Nachbar mit Abstand $d+1$ ans Ende der Warteschlange. Wegen der FIFO-Reihenfolge kann kein Knoten mit Abstand $d+1$ vor einem Knoten mit Abstand $d$ verarbeitet werden.

Induktiv werden daher zuerst alle erreichbaren Knoten mit Abstand null, dann eins, dann zwei und so weiter entdeckt. Bei der ersten Entdeckung einer Zelle ist ein kürzerer Weg ausgeschlossen: Er hätte eine Vorgängerzelle mit kleinerem Abstand gehabt, die bereits verarbeitet worden wäre. Die gespeicherte Richtung zeigt auf diese Vorgängerzelle. Wiederholt man sie, sinkt der Abstand in jedem Schritt um eins, bis eine Toröffnung erreicht ist. $\\square$

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

Die Abschwächung lässt sich in drei Abstandsbereiche zerlegen:

1. Bei $d\\le260$ Kacheln ist $u=0$ und $\\beta=0$. Daher werden $E'=0$ und $W'=-1$.
2. Für $260<d<660$ liegt $u=(d-260)/400$ zwischen null und eins. Weil $\\frac{d}{du}[u^2(3-2u)]=6u(1-u)\\ge0$, steigt $\\beta$ dort ohne Rücksprung von null auf eins.
3. Bei $d\\ge660$ ist $u=1$ und $\\beta=1$. Dann gelten wieder $E'=E$ und $W'=W$.

In der Mitte bei $d=460$ ist $u=0.5$ und $\\beta=0.5$. Die beiden abgeschwächten Werte sind folglich $E'=E/2$ und $W'=(W-1)/2$. Der Anfangsbereich kann weiterhin verschiedene gewöhnliche Biome auswählen, weil Temperatur und Feuchtigkeit nicht auf einen festen Wert gesetzt werden. Die verschwindende Steigung $6u(1-u)$ an beiden Enden erklärt den glatten Anschluss der Abschwächung; sie macht die späteren Biomschwellen selbst nicht glatt.

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

**Behauptung: Ein Ausbreitungsdurchlauf kann gewöhnliches Feuer nicht über zwei zuvor unbeleuchtete Kacheln in einer Reihe tragen.** Gemeint ist der gewöhnliche Viernachbar-Durchlauf von \`Matter::tick()\`.

*Beweis.* Sei $B_n$ die Menge der Kacheln, die beim Beginn dieses Durchlaufs brennen. Die Suche prüft nur gespeicherte Zustände aus diesem Anfangsbild. Sie kann für eine Kachel außerhalb von $B_n$ eine Änderung vormerken, schreibt diese aber erst nach dem vollständigen Durchlauf. Eine neu vorgemerkte Kachel ist somit während derselben Suche keine Quelle.

Jede neu entzündete Kachel muss direkt an eine Quelle aus $B_n$ grenzen. Entlang eines durchgehenden, eine Kachel breiten Brennstoffstreifens kann die Front daher pro Durchlauf höchstens einen Zellschritt, also 16 Weltpixel, vorrücken. Erst im folgenden Durchlauf darf die neue Kachel selbst eine weitere entzünden. $\\square$

Die Entzündung von Öl ist ein eigener, sofortiger Ausbruch auf acht Nachbarn und folgt dieser Schranke nicht. Fehlender Brennstoff, Ablauf und konkurrierende Zustände können die gewöhnliche Front verlangsamen oder anhalten.

### 12. Geometrie der von Licht erzeugten Schatten

Für jede registrierte Lichtquelle in Reichweite misst \`LightField::cast()\` den ebenen Abstand $d$ zwischen Lichtquelle und Objekt. Abstände $d<6$ und $d>R$ werden übersprungen, wobei $R$ die Reichweite der Lichtquelle ist. Für geeignete Objekte berechnet die Funktion

$$f=1-\\frac{d}{R},\\qquad\\ell=H\\operatorname{clamp}\\left(\\frac{d}{48},0.35,2.2\\right),\\qquad a=\\operatorname{clamp}(1.5Sf,0,1),$$

wobei $H$ die Objekthöhe und $S$ die Lichtstärke bezeichnet. $\\ell$ bestimmt die Schattenlänge und $a$ den Alphawert des Schattens. Die beiden Grenzen der Längenklammer liegen bei $0.35\\cdot48=16.8$ px und $2.2\\cdot48=105.6$ px. Damit gilt für ein berücksichtigtes Objekt

$$\\ell=\\begin{cases}
0.35H,& d\\le16.8,\\\\
H d/48,& 16.8<d<105.6,\\\\
2.2H,& d\\ge105.6.
\\end{cases}$$

Bei $d=48$, $R=120$ und $S=0.5$ ist $f=1-48/120=0.6$. Daher folgen $\\ell=H$ und $a=1.5\\cdot0.5\\cdot0.6=0.45$. Der Winkel $\\operatorname{atan2}(y-y_c,x-x_c)$ weist von der Lichtquelle weg. Objekte mit $d<6$ oder $d>R$ wurden bereits vor dieser Rechnung ausgeschlossen.

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
      "English defaults, the language selector, translation files, glossary and format validation.",
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
### Interface text and content names

\`src/gui/Lang.hpp\` defines the English interface defaults in \`Lang\`; menus read the global \`lang\` instance. \`say()\` formats strings with runtime \`fmt\` arguments. Content names and other text can also pass through the \`Glossary\` via \`tr()\`. These are two complementary kinds of entries in the same language file.

### Selecting a language

The Language row in Settings lists \`english\` first, followed by the sorted \`.txt\` filenames in \`res/lang/\`. The selected name is saved in \`settings.txt\`. \`Game::loadLanguage()\` resets the interface strings and glossary to English defaults when the selection changes, then loads \`res/lang/<name>.txt\` unless English is selected. If the file cannot be read, the game logs a warning and keeps the defaults. German is supplied as \`res/lang/deutsch.txt\`.

### File format and validation

Interface overrides use a case-sensitive key followed by a literal space and the translated text. A content glossary entry begins with \`~\`, followed by the English text, a tab, and the translation. Lines beginning with \`#\` can be used as comments. For example:

\`\`\`text
paused PAUSA
felledBy abattu par {}
~Wolf	Loup
\`\`\`

\`Lang::parse()\` rejects unknown keys, mismatched counts of opening braces, and values that fail its \`fmt\` check. \`Glossary::parse()\` checks for a tab, nonempty text on both sides, matching brace counts and format validity when the value contains braces. CRLF and LF are accepted. Each parser returns the number of accepted lines, including repeated keys; a later accepted entry replaces the earlier value. Untranslated interface entries retain their English defaults and an absent glossary entry returns the original English text.

The format check uses sample numeric arguments. It does not prove that a translation works for every type and value supplied at its actual call site, so keep placeholders compatible and exercise the real UI. \`langTemplate()\` produces the English interface keys as a starting point. \`src/test/LangTest.cpp\` tests defaults, formatting, parsing, language discovery and switching. When adding text, register interface fields in \`LANG_KEYS\` or use the glossary path for content, then update the language file and relevant tests.

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

On each menu tick, \`decode()\` consumes video frames until the next frame time is ahead of the menu clock. The loop keeps the latest decoded frame, converts it to RGBA and uploads it to the existing texture. Rendering clears the screen to black and fits the video within the viewport while preserving its aspect ratio.

The menu fades the picture and clip gain over the final 0.5 seconds. Input after the first 0.1 seconds starts an early fade. When the fade ends, the title menu replaces the intro with a matching veil. Music begins easing in during the final three seconds or after a skip. If video setup fails, duration is set to zero and the menu proceeds to the title on its next tick.

### Ownership and cleanup

The menu owns the decoder, CPU buffer, image and texture. Its destructor ends the clip, waits for the renderer, then frees the texture, image and decoder. Ending the clip also allows the ordinary music stream to refill. Video and audio come from separate files. The intro clock uses the greater of menu time and the clip playback estimate from \`Sound::clipTime()\`; this is based on queued audio bytes and is not a direct measurement of what the device has already played.
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

Keyboard and gamepad bindings can point to the same action. Some gamepad bindings deliberately control two actions: by default, X maps to Gather and Retry, Y to Inventory and Codex, and Back to Map and Quit. Strike defaults to F on the keyboard and R3 on a gamepad. Which action matters depends on the current game or menu context.

### Rebinding and persistence

The controls menu exposes 18 keyboard rows and nine gamepad rows. It switches the displayed set according to the current input mode. Selecting a row listens for a new key or supported pad button; Escape cancels keyboard listening and B cancels gamepad listening. Reset restores both sets of defaults.

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
  {
    id: "crafting-workbench",
    title: "Crafting, Salvage & Schematics",
    category: "gameplay",
    summary: "Workbench formulas, material costs, item eligibility, and how salvage and imbue work.",
    sourceFiles: [
      "src/item/craft/Recipes.cpp",
      "src/item/craft/Recipes.hpp",
      "src/item/craft/Resources.cpp",
      "src/menu/CraftMenu.cpp",
      "src/test/CraftTest.cpp",
    ],
    content: `
### Using the workbench

Choose a formula, select the required items from the bag, and activate the formula. Choosing another formula clears the selection. For Imbue, the restart control (R by default) cycles learned schematics. The menu reports missing materials, incompatible selections, and insufficient bits before it consumes anything. Combine requires three distinct items in the same gear slot; the other item formulas require one. The Hoe requires no item and can only be made once.

The costs below are per use. Shards are crystal shards and runes here are **rune stones**, a crafting material, not the socketable runes used in rune words.

| Formula | Cost | Input and result |
| --- | --- | --- |
| Reroll | 3 shards | Magic, rare, or crafted item with at least one affix: reroll its weakest affix within that affix's existing tier. |
| Reforge | 5 shards, 2 ore | Rare item without a night curse: roll a new set of rare affixes while retaining its name. |
| Upgrade | 6 ore, 1 rune stone | Any item below the highest base tier: raise its tier one step, from Worn to Fine or Fine to Masterwork. |
| Combine | None | Three magic items of the same slot become one rare. Its base and tier come from the first selection; its item level is the lowest of the three. |
| Cleanse | 1 shard, 1 herb | Remove a night curse. If there are affixes, the one with the highest tier index loses up to two tier steps and is rerolled. |
| Tinker | 4 ore | Add one random affix to an eligible item with room. |
| Salvage | None | Destroy one item for bits and possibly learn an unknown affix. |
| Imbue | Bits | Add a compatible learned affix to an eligible item with room. |
| Hoe | 3 wood, 2 stone | Make the hoe used to till grass and dirt for farming. |

Eligibility differs by formula: Upgrade does not require a plain item, while Reforge excludes night-cursed rares. Tinker and Imbue reject unique and night-cursed items and require fewer than five affixes before adding one. Imbue also checks the affix's compatibility and the three-prefix or three-suffix limit. Adding an affix turns normal or superior gear magic; magic gear becomes rare once it has more than two affixes.

### Crafted gear

These eight formulas take one **normal or superior** item in the listed slot. The result is crafted gear on the same base, with the two named fixed affixes and a roll for one to three additional affixes, subject to compatibility and prefix/suffix limits. Existing affixes are cleared first. The implementation makes up to 16 attempts to add the random affixes, so the requested count is not an unconditional guarantee.

| Formula | Slot | Materials | Fixed affixes |
| --- | --- | --- | --- |
| Bloodfang | Weapon | 2 shards, 2 ore, 2 bones | damage, leech |
| Stormbrand | Weapon | 3 shards, 2 ore, 1 rune stone | shock, haste |
| Ember Lamp | Off-hand | 3 shards, 1 rune stone, 2 herbs | burn, area |
| Sage's Ward | Off-hand | 4 ore, 1 rune stone, 1 herb | armour, wisdom |
| Frostmantle | Armour | 2 shards, 2 ore, 2 hides | armour, resist chill |
| Thornhide | Armour | 2 ore, 1 herb, 3 hides | thorns, life |
| Blood Charm | Charm | 1 shard, 1 rune stone, 1 herb, 2 bones | life, leech |
| Fortune Charm | Charm | 4 shards, 2 rune stones | fortune, gleaming |

### Bits and learning

For normal through crafted rarities, salvage yields **1 + base tier index + affix count + rarity bonus** bits. Worn, Fine and Masterwork have tier indices 0, 1 and 2. The rarity bonuses are normal 0, superior 1, magic 1, rare 3, unique 6 and crafted 3. The Third Hand doubles the yield and guarantees learning if the item has an unknown affix. Otherwise, when unknown affixes are present, the chances are 0% for normal or superior, 50% for magic, 65% for rare, 100% for unique and 80% for crafted. At most one unknown affix is learned, chosen from those on the item; salvage still destroys the item when nothing is learned.

Founder tablets and friendly families can also teach schematics. Imbue selects the best tier of the chosen affix allowed by the item's level; its full price is **4 + 3 × tier index** bits, where the first affix tier has index 0. Near a built Anvil or rune forge, the price is halved and rounded up. Imbuing through the menu adds 3 Synod scrutiny, doubled for a Synod member when that system is active. Campaign saves retain bits and schematics.

### Implementation and checks

\`missing()\` validates a formula before \`craft()\` performs it. Single-item formulas replace the bag entry; Combine removes its three inputs and appends the result. Successful actions can award campaign experience, with separate craft, salvage and tinker sources. \`CraftTest.cpp\` exercises the basic formulas, slot restrictions, fixed affixes, salvage, imbue, scrutiny and schematic save round-trip. The formula table in \`Recipes.cpp\` is the authoritative source for current costs and eligibility.
`,
  },

  {
    id: "campaign-farming",
    title: "Campaign Farming: Seed to Harvest",
    category: "gameplay",
    summary: "How to plant and harvest crops, find seeds, and understand weather and grove bonuses.",
    sourceFiles: ["src/campaign/Farm.cpp", "src/campaign/Farm.hpp", "src/campaign/Harvest.cpp", "src/test/FarmTest.cpp"],
    content: `
### Start a field

Craft a Hoe at a workbench for 3 wood and 2 stone. On the campaign surface, aim at eligible ground and use the gather action to till it. Water, ramps, existing plots, structures, placed objects and obstructing or harvestable props can prevent tilling. Dirt and a defined set of fertile biomes qualify; not every surface tile is suitable. The prompt indicates whether the targeted tile can be tilled.

Use the gather action on bare tilled soil to plant an available seed. The game cycles through available seed types after each planting; the prompt names the next seed. A growing crop cannot be harvested early. Gather it once ripe, and the plot remains tilled for another planting. Each till, planting and harvest can grant campaign experience, subject to the normal repeat rules.

| Crop | Base time | Base produce per harvest |
| --- | ---: | ---: |
| Turnip | 2 days | 3 |
| Barley | 2 days | 3 |
| Gourd | 3 days | 2 |
| Firepepper | 3 days | 2 |

Growth reaches the growing stage halfway through its required time and becomes ripe at the full duration. Each harvest has a 50% deterministic seed-return roll based on the plot and sowing time. Foraging herbs or bushes can also yield seeds; a Liked Rootsworn camp fire can give two seeds once per day.

### Weather, boons and groves

Rain and retained water add growth bonus while plots are within 1,200 pixels of the player on the surface; ordinary elapsed-time growth still counts for distant plots. Wet growth adds one extra day of progress per day wet, and water remains for up to a quarter day after rain. Seedkeeper gives a crop one day of bonus when planted. A qualifying settled Rootsworn camp within 320 pixels doubles the base produce, and Harvest Home adds one more produce after that multiplication. Grove harvests also grant standing. These bonuses do not change the seed-return roll.

Plots and their sowing, growth bonus and water state are part of campaign edits and are saved. \`FarmTest.cpp\` exercises planting, growth, rain, saving, grove yield and experience; \`Farm.cpp\` is the authority for exact eligibility and distance checks.
`,
    interactiveComponent: "farming",
    mermaidCharts: [{ title: "A plot through the seasons", chart: `
flowchart LR
    Ground[Eligible ground] -->|Hoe and gather| Soil[Tilled soil]
    Soil -->|Plant one seed| Sprout[Sprout]
    Sprout -->|Half required growth| Growing[Growing]
    Growing -->|Full required growth| Ripe[Ripe]
    Ripe -->|Gather produce| Soil
` }],
  },
  {
    id: "gems-and-sockets",
    title: "Gems, Sockets & the Jeweller",
    category: "gameplay",
    summary: "Gem grades, slot-dependent bonuses, socket limits, and jeweller services.",
    sourceFiles: ["src/item/loot/Jewel.cpp", "src/item/loot/Jewel.hpp", "src/menu/JewelMenu.cpp", "src/test/JewelTest.cpp"],
    content: `
### Gems and equipment

Gems come in seven kinds and five grades: Rough, Cut, Clear, Flawless and Radiant. Their bonus depends on the equipment slot. Weapons and off-hands share one effect column, armour uses another, and charms use a third. Higher grades multiply the base effect by 1, 2, 3.5, 5.5 and 8 respectively; the sum of socketed contributions to a stat on an item is capped.

| Gem | Weapon or off-hand | Armour | Charm |
| --- | --- | --- | --- |
| Amber | Shock | Poison resistance | Gold find |
| Jade | Poison | Regeneration | Magic find |
| Garnet | Burn | Burn resistance | Life |
| Sapphire | Chill | Chill resistance | Haste |
| Opal | Critical chance | Speed | Kindling |
| Onyx | Damage | Armour | Leech |
| Moonstone | Night damage | Light | Wisdom |

Weapons and armour can have up to three sockets, off-hands two and each charm one. Gear may generate with sockets as reach increases, or the town jeweller can add them. Gems can be found from kills, ore and caches; reach gates higher grades at 1, 6, 12, 18 and 24 respectively. Radiant drops have a separate rarity roll once eligible.

### Services

At the Jeweller's Bench or town jeweller, insert a carried gem into the first empty socket. Three gems of the same grade can be combined into one gem of the next grade, with the output kind selected in the menu. Inputs may be different kinds; the implementation removes them one at a time from the most plentiful kind at that grade. Radiant gems cannot be combined further. Combining is free at the bench; the town fee is 50, 100, 150 or 200 gold according to the input grade.

The town jeweller also removes gems for 100 gold times their grade number, returning them to stock, and adds sockets for 300, 900 or 2,700 gold for the first, second or third socket. Slot limits still apply. Rune insertion, removal and completed rune words have additional rules described on the Runes page. Closing a changed jeweller menu saves the campaign.
`,
    mermaidCharts: [{ title: "The two jeweller services", chart: `
flowchart LR
    Gems[Three same-grade gems] --> Bench[Bench: combine free]
    Gems --> Town[Town jeweller: combine for gold]
    Bench --> Higher[Choose a higher-grade gem]
    Town --> Higher
    Town --> Services[Add sockets or remove gems for gold]
    Stock[Carried gem] --> Insert[Fill first empty socket]
` }],
  },
  {
    id: "runes-and-words",
    title: "Runes & Rune Words",
    category: "gameplay",
    summary: "Ordered rune recipes, discovery, equipment restrictions, and the cost of breaking a word.",
    sourceFiles: ["src/item/loot/Rune.cpp", "src/item/loot/Rune.hpp", "src/item/loot/RuneWord.cpp", "src/menu/JewelMenu.cpp", "src/test/RuneTest.cpp"],
    content: `
### Making a word

Socketable runes are distinct from the rune stones used in workbench recipes. Runes can be found through kills and certain first-time discoveries, including shrines, founder tablets and special hearts. Each rune has its own stat bonus. At a jeweller, runes fill the first empty socket, so insert them in the order shown below.

A word activates only when the item has **exactly** the listed socket count, the correct gear slot and the full ordered rune sequence. Unique items cannot form words. Combining partial hints can reveal a word in the campaign Codex; successfully making a word also teaches it. The individual rune bonuses still contribute to the item's socket stats.

| Word | Slot | Runes in order | Effect described by the game |
| --- | --- | --- | --- |
| Ashen Tithe | Weapon | Keth, Wenn | Kills near a lit shrine feed light; 25 kills near a cold shrine rekindle it. |
| Furrowsong | Armour | Orra, Keth | Moving over open ground periodically tills and sows a faster-growing seed. |
| Toll of Roads | Off-hand | Dunn, Orra | Camps treat you one standing band higher; sales grant Coinroad standing, up to 40 daily. |
| Matterwake | Weapon | Brae, Mirr | Hits leave their payload's matter under the foe for 3 seconds. |
| Unwhitened | Off-hand | Mirr, Dunn | Lime does not touch you; scrutiny falls while no Synod eye is on you. |
| Kindred Flesh | Armour | Wenn, Brae, Keth | Changeling defects sleep and mutations arrive sooner; Hale implants are stronger and can be swapped anywhere. |
| Kinward | Armour | Hathe, Orra, Wenn | Nearby allies and followers mend; quickened props last twice as long. |
| Smithcall | Weapon | Quor, Dunn, Brae | Some kills yield bits; imbue beside a campfire at the Anvil price. |
| Undertorch | Off-hand | Selv, Mirr | Below ground, gain light, avoid attracting lightdrawn foes and receive earlier tremor warning. |
| Long Table | Armour | Hathe, Selv, Keth | Meals last three times as long and mend nearby allies and followers. |
| Laid Spear | Off-hand | Yrn, Quor | Once daily, use 1 by an angry group leader to send the group home. |
| Quarter Given | Weapon | Aelm, Thask, Yrn | Foes below 10% yield and flee, granting standing without a kill. |

### Removing runes

The town jeweller can return a lone rune for a fee. A completed word locks its runes: breaking it requires a second confirmation, destroys its runes, and returns any gems on the item. The jeweller cannot add sockets to a completed word. This makes the socket count as important as the rune order when planning an item.

\`RuneTest.cpp\` checks matching, insertion, removal and word effects. The table in \`Rune.cpp\` defines current sequences; individual effect implementations live in \`RuneWord.cpp\` and their associated systems.
`,
    mermaidCharts: [{ title: "Checking a rune word", chart: `
flowchart TD
    Start[Socket runes in order] --> Unique{Unique item?}
    Unique -->|Yes| No[No rune word]
    Unique -->|No| Match{Slot, socket count and sequence match?}
    Match -->|No| No
    Match -->|Yes| Word[Word activates]
    Word -->|Town jeweller, confirm twice| Break[Break word and destroy runes]
` }],
  },

  {
    id: "campaign-cookery",
    title: "Campaign Cookery & Sharing the Fire",
    category: "gameplay",
    summary: "Combine ingredients into world-specific meals, season them, and share a hearth with visitors.",
    sourceFiles: ["src/campaign/Cookery.cpp", "src/campaign/Cookery.hpp", "src/hero/Synergy.hpp", "src/test/ExperienceTest.cpp"],
    content: `
### Make a meal

In the campaign, use the cook menu near a campfire to consume two **different** cookable materials. The 12 eligible materials are crystal shard, ore, rune stone, herb, hide, bone, wood, stone, turnip, barley, gourd and firepepper. Their unordered pair determines a trigger and payload for that world's seed, so the same pair can produce a different dish in another world. There are 66 possible pairs. Cooking immediately replaces the current meal effect and awards campaign experience.

An optional third, different material is a spice: it changes the trigger while retaining the pair's payload. A delicacy can also be consumed as garnish, adding a second payload on the same trigger. Neither spice nor garnish needs to be present. The game remembers discovered pairs and spices separately; villagers or visitors may also reveal recipes.

Meals normally last 300 seconds. Cooking near a Smoke Rack doubles that duration; the Long Table rune word can extend it further. A trigger is the condition under which a meal acts, such as being struck, moving or standing still; a payload is what happens when it acts. A meal's effect is therefore conditional, not necessarily a constant stat bonus.

### A guest at the hearth

After cooking, if no guest is already close enough to share the meal, the game can attempt a visit. Visits require night and enabled faction relations; hated families and certain families barred by Synod membership are excluded. Eligible families with better standing are more likely to be chosen. Cook again while the visitor is nearby to share, improve their faction's standing and receive a secret or, if no eligible secret remains, gold. A guest has a limited lifetime.

The code validates ingredient counts and hearth proximity before consuming anything. \`Cookery.cpp\` defines the seed-dependent mapping, sharing and validation; the experience tests exercise a cooking award.
`,
    mermaidCharts: [{ title: "From ingredients to a meal", chart: `
flowchart LR
    Pair[Two different materials] --> Dish[World seed selects trigger and payload]
    Spice[Optional third material] --> Trigger[Replace trigger]
    Dish --> Trigger
    Trigger --> Meal[Active meal]
    Garnish[Optional delicacy] --> Meal
    Meal --> Guest[May attract a night visitor]
    Guest --> Share[Cook again nearby to share]
` }],
  },
  {
    id: "campaign-experience",
    title: "Campaign Experience Beyond Combat",
    category: "gameplay",
    summary: "First-time awards, local repetition, recovery and scaling for campaign activities.",
    sourceFiles: ["src/hero/Experience.cpp", "src/hero/Experience.hpp", "src/level/Level.hpp", "src/test/ExperienceTest.cpp"],
    content: `
### Actions can advance a peaceful hero

Campaign experience is granted directly to the hero. Crafting, cooking, tinkering, gathering, mining, farming, gifts and resolving encounters can all award it, alongside combat and quests. The source table also defines first shrine lighting, rekindling, first trades and standing-band awards. These activity awards require automatic XP rules and a living player; they are not a description of every kill or quest reward.

For a table-driven activity, the award is its base value multiplied by the act multiplier, depth multiplier, any first-time multiplier, local repetition factor and supplied units. Act I through V multipliers are 1, 1.7, 2.25, 2.5 and 3.2; surface, cave and deep multipliers are 1, 1.15 and 1.35.

| Activity | Base XP | First-time multiplier | Repeat factor after an award |
| --- | ---: | ---: | ---: |
| Craft | 12 | 5 | 0.8 |
| Cook | 22 | 4 | 0.8 |
| Tinker | 15 | 3 | 0.8 |
| Gather | 3 | 1 | 0.8 |
| Mine | 6 | 1 | 0.8 |
| Till / plant / harvest | 1 / 2 / 10 | 1 / 3 / 2 | 0.8 |
| Rekindle | 10 | 1 | 0.5 |
| Gift / resolve / salvage | 15 / 25 / 4 | 1 | 0.8 |

For example, the first craft of a particular formula on the Act I surface pays 60 XP. An immediate repeat of that formula in the same region pays 12 × 0.8 = 9.6 XP. The first-time marker is keyed by source and activity; repeat fading is additionally tracked by layer and region. A different region can have its own repeat factor, but does not reset the first-time bonus.

The repeat factor recovers linearly at one unit per in-game day, capped at 1. Each qualifying award multiplies its current factor by the source's decay. Some sources, including first shrine lighting, trade and standing bands, are once per key rather than repeatable. First markers and unfinished recovery are saved; older saved keys are migrated. \`ExperienceTest.cpp\` checks first awards, local fading, recovery, save handling and several activity paths.
`,
    mermaidCharts: [{ title: "How an activity award is calculated", chart: `
flowchart LR
    Action[Activity and key] --> Eligible{Automatic XP and living hero?}
    Eligible -->|No| Zero[No activity award]
    Eligible -->|Yes| First[First-time or once-only check]
    First --> Scale[Base times act, depth, first bonus and local factor]
    Scale --> Grant[Grant XP]
    Grant --> Fade[Reduce local factor; recover over time]
` }],
  },
  {
    id: "campaign-standing",
    title: "Campaign Standing & Faction Relations",
    category: "gameplay",
    summary: "Starting reputation, disposition bands, and how faction politics can spread standing changes.",
    sourceFiles: ["src/campaign/Standing.cpp", "src/campaign/Politics.cpp", "src/level/Level.hpp", "src/test/PoliticsTest.cpp"],
    content: `
### Your reputation with a faction

A campaign starts with faction-specific base values, adjusted by lineage, class and a seed-dependent pair of positive and negative world tilts. Reputation is clamped to −1,000 through 1,000. Hearth standing is fixed at zero, and a Changeling's Synod standing is capped at the WARY threshold. Thus two heroes or worlds need not meet the same faction on identical terms.

| Standing | Disposition |
| --- | --- |
| −1,000 to −500 | Hated |
| −499 to −250 | Disliked |
| −249 to 249 | Indifferent |
| 250 to 499 | Liked |
| 500 to 899 | Friendly |
| 900 to 1,000 | Revered |

These are the numeric bands used by \`standing::disposition()\`. Individual systems can impose additional conditions: for example, \`Level::friendly()\` excludes the Synod even at a high score. A band describes standing, not a promise that every group will behave identically in every encounter.

### Relations between factions

When a qualifying standing change spreads, the politics system uses faction relationships to propagate it to other factions. It uses live politics when available, otherwise seeded base relations. The result is clamped and the lineage restrictions are applied again. Campaign politics can change over time, so the same action need not have identical secondary effects in every world or on every day.

Faction dispositions feed several campaign systems, including camp services and social encounters. The separate politics state describes relationships **between factions**; reputation describes the hero's standing **with each faction**. \`Standing.cpp\` owns the initial modifiers and bands, while \`Politics.cpp\` owns relations and propagation. \`PoliticsTest.cpp\` checks political behavior and persistence.
`,
    mermaidCharts: [{ title: "From an action to faction standing", chart: `
flowchart LR
    Action[Qualifying action] --> Direct[Standing with one faction changes]
    Direct --> Politics[Current faction relationships]
    Politics --> Spread[Secondary standing changes]
    Spread --> Clamp[Clamp and lineage rules]
    Clamp --> Bands[Disposition bands]
    Bands --> Encounters[Camp and encounter rules]
` }],
  },

  {
    id: "campaign-quest-flow",
    title: "Campaign Quests: Offer to Reward",
    category: "gameplay",
    summary: "The spine quest state machine, turn-in, act transitions and the elder's errand interface.",
    sourceFiles: ["src/campaign/Quests.cpp", "src/campaign/Quests.hpp", "src/campaign/Errand.hpp", "src/menu/QuestMenu.cpp", "src/test/QuestTest.cpp"],
    content: `
### Follow the campaign spine

The elder's quest panel shows the current campaign quest and its status. Accept an offered quest to make it active. The game tracks its objective and moves it to ready when the conditions are met; return to the elder to claim its reward. The menu also displays generated errands separately, including their known clues and any revealed twists. Selecting an errand and using the indicated abandon control removes that errand; it does not abandon the spine quest.

Turning in a ready spine quest grants its gold, experience and an item. If the bag is full, the item drops beside the player. A gathering objective checks the required materials again on turn-in and consumes them; if they are no longer available, the quest returns to active. Rewards and slot choices come from the quest and act tables.

The quest table contains legacy entries as well as the current spine. \`quests::after()\` advances between the designated spine entries, and \`respine()\` moves an offered legacy quest onto the appropriate current path. This distinction matters when reading older save data: the number of table entries per act is not the number of spine quests a new campaign must complete.

### Between acts and after the king

On completing an act's spine, the next act can enter the Road state until its town is reached. If that town is already founded, the next offer can become available directly. After the last spine quest, the campaign enters Done or, when applicable, Reckoning for the Synod ending. These are distinct from generated errands, which maintain their own progress and clues.

\`QuestMenu::tick()\` routes accept and turn-in actions; \`quests::tick()\` evaluates objectives; \`quests::turnIn()\` pays rewards and advances the campaign. The menu saves after these actions. \`QuestTest.cpp\` exercises the act spines and transitions.
`,
    mermaidCharts: [{ title: "Spine quest states", chart: `
flowchart LR
    Offered[Offered] -->|Accept| Active[Active]
    Active -->|Objective met| Ready[Ready]
    Ready -->|Missing gather materials| Active
    Ready -->|Claim reward| Next{Next step}
    Next -->|Next quest available| Offered
    Next -->|New town required| Road[Road to next town]
    Road -->|Reach town| Offered
    Next -->|Final spine| End[Reckoning or Done]
` }],
  },
  {
    id: "campaign-fact-ledger",
    title: "Local Knowledge: Fact Ledger Foundation",
    category: "gameplay",
    summary: "The current fact and disclosure data model, save format, journal display and integration status.",
    sourceFiles: ["src/campaign/Facts.hpp", "src/campaign/Facts.cpp", "src/campaign/People.hpp", "src/campaign/CampaignSave.cpp", "src/menu/QuestMenu.cpp", "src/test/FactTest.cpp"],
    content: `
### What exists today

The campaign has a local-knowledge ledger with twelve defined facts and 51 permitted fact-recipient pairs. Each fact has a stable key and up to four named sources. The ledger records the **first accepted source** for a fact; learning the same fact from another source later does not replace it. Disclosures record whether a known fact has been shared with a permitted recipient, once per pair.

This is currently a **data and interface foundation**. In the current source tree, calls to \`facts::learn()\` and \`facts::share()\` occur in \`FactTest.cpp\`, with no gameplay call sites yet. The presence of a defined source or recipient therefore does not establish that a player can discover or disclose it in ordinary play.

If a campaign ledger contains a known fact, the elder's quest panel offers a Local Knowledge page. Left and right switch between that page and quests; up and down select known facts. The display includes the claim, its recorded source and a descriptive label such as Record, Testimony, Observed or Derived. These labels are presentation text, not a numerical confidence calculation. For the grief-order fact, the display distinguishes testimony from the board record according to the recorded source.

### Persistence and validation

\`qfact <fact-key> <source-key>\` saves a learned fact; \`qdisclose <fact-key> <recipient-key>\` saves a permitted disclosure. The loader rejects unknown keys, invalid sources and malformed rows. It may read disclosure rows before fact rows; after the campaign is loaded, \`link()\` removes disclosures for facts that were not successfully learned. This prevents an orphan disclosure from surviving a load while allowing rows in either order.

\`FactTest.cpp\` checks key lookup, first-source retention, invalid and duplicate disclosures, load ordering, orphan cleanup and a save round-trip. These checks establish ledger behavior, not the completion of the future in-world interaction that would populate it.
`,
    mermaidCharts: [{ title: "Fact ledger lifecycle", chart: `
flowchart LR
    Source[Valid named source] --> Learn[Learn fact once]
    Learn --> Ledger[Ledger keeps first source]
    Ledger --> Display[Quest panel can show local knowledge]
    Ledger --> Share[Share with permitted recipient once]
    Ledger --> Save[Save fact and disclosure rows]
    Share --> Save
     Save --> Load[Load rows in either order]
     Load --> Link[Remove orphan disclosures]
` }],
  },
  {
    id: "plan-and-todo",
    title: "52. Master Plan, Living TODO & Community Interface",
    category: "contribute",
    summary:
      "Master development roadmap, active TODO tasks, zero-login community poll on open game design dilemmas, pixel art submission pipeline, and in-engine telemetry bridge.",
    sourceFiles: [
      "TODO.md",
      "README.md",
      "CHANGELOG.md",
      "CMakeLists.txt",
      "src/main.cpp",
      "src/DevStart.cpp",
    ],
    interactiveComponent: "game-interface",
    content: `
### The Master Development Plan & Architectural Vision

**Mellangan** began as an uncompromising survival arena prototype and has matured into an expansive, atmosphere-rich action RPG. Its design fuses the subterranean mystery of Caves of Qud, the unrelenting progression pace of Risk of Rain, the gun-feel and kinetic dodges of Enter the Gungeon, and the room-by-room item synergies of The Binding of Isaac.

#### The Dual-Pillar Architecture: Campaign vs. Survival

The game maintains two fundamentally distinct, mode-aware game loops:

1. **Campaign Mode (Main Narrative Spine):**
   * Features a four-slot persistent character ledger (\`campaign.txt\` through \`campaign-4.txt\`).
   * Spans Acts I through V across procedurally stitched Voronoi biomes, ancient groves, and deep subterranean cave delves.
   * Emphasizes regional situations such as The Splintered Ford, settlement hubs like Hearthwick and Kettlestaithe, local fact ledgers, and culinary craft.
   * Introduces real-time d20 spell attacks (Star Lance, Cinder Bloom, Winter Grasp, Verdant Ward) alongside martial weapons and class Arts.
   * Full pacifist route support through stowed weapons (Key 2), parleying, rite gifts, and founder name invocations.

2. **Survival Mode (Pure Arcade Loop):**
   * A relentless nocturnal arena test: survive the oncoming midnight horde across expanding biome tiers.
   * Locate and rekindle stone shrines to hold back the encroaching dark.
   * Unpolluted competitive leaderboards: Campaign-only equipment bases and quest relics never contaminate the survival drop tables.

#### The Upcoming Engine and Game Repository Decoupling

When the Vulkan rendering and entity infrastructure reaches full maturity:
* The core rendering layer (**Vulkan2D**, pre-compiled SPIR-V pipeline, MoltenVK support, and high-refresh fractional easing) will split into a dedicated, public open-source engine repository.
* The proprietary game assets, campaign narrative tables, and commercial mechanics will move to an independent game repository, paving the way for official Steam release and Steam Deck verification.

### Living Development Tasks & Sprint Priorities

Active engineering tasks are tracked directly in \`TODO.md\`. Each item maintains strict code ownership, clear verification criteria, and zero-defect requirements:

* **Unique Weapon Tooltip Attack Grants (\`src/gui/Tooltip.cpp\`):**
  Unique items currently display rich narrative lore but omit their active granted attack profile. The goal is showing both for Oathblade, Farsong, Grim Harvest, and all base-grant uniques without altering rune-word tooltips.
* **Mode-Aware Gambling Deterministic Verification (\`src/test/VendorTest.cpp\`):**
  Rigorous tests for \`gamble(base, rng, campaign)\` ensuring Campaign never rolls Survival-exclusive relics, and Survival never yields Campaign-exclusive equipment bases.
* **Content Mode Declaration Fault Assertions (\`src/meta/Content.cpp\`):**
  Extending \`contentFaults()\` to enforce that Campaign-only uniques must use Campaign-only bases, Survival-only items reject Campaign bases, and all references resolve at boot.
* **32-Voice LRU Audio Mixer with Voice Stealing (\`src/audio/AudioMixer.cpp\`):**
  Dynamic channel culling and distance attenuation to maintain crystal-clear audio during 10,000 entity soak tests without distortion or buffer underruns.

### Community Bridge: Zero-Login Polls, RFCs & Asset Submissions

Community collaboration directly shapes Mellangan. The interactive portal below provides four key capabilities:

1. **Session-Backed Community Polls:**
   Cast votes on pressing design dilemmas (such as unique weapon discovery, meal spoilage, and shrine counter-assaults) and supply written feedback. All votes and rationales persist seamlessly in browser \`sessionStorage\` with zero accounts or logins required.
2. **RFC Proposal Export:**
   Compile your votes, custom comments, and balance priorities into clean Markdown ready to submit as a GitHub Discussion RFC or share in community Discord channels.
3. **Artwork & Pixel Art Submission:**
   Inspect, upload, or paint 16×16 pixel art directly in the browser with real-time palette analysis, dimension verification, and automatic PR submission manifest generation for \`res/\`.
4. **Engine Telemetry & Command Line Configurator:**
   Paste runtime logs from \`mellangan.log\` for instant diagnostic parsing, or configure launch flags (\`--dev\`, \`--seed\`, \`--hero\`, \`--bench-gate\`) with one-click terminal copy.
`,
    mermaidCharts: [
      {
        title: "Mellangan Development Lifecycle & Community Loop",
        chart: `
flowchart TD
    subgraph Community["Player & Community Interface"]
        Poll["Open Design Polls<br/>(SessionStorage / No Login)"]
        Art["Asset Submission<br/>(16x16 Pixel Canvas)"]
        LogDiag["Log & Crash Diagnostic<br/>(Telemetry Parser)"]
    end

    subgraph Roadmap["Master Plan & Living Tasks"]
        TODO["Living TODO Board<br/>(TODO.md Sync)"]
        Sprint["Active Sprints<br/>(Campaign & Engine)"]
    end

    subgraph Engine["Mellangan C++20 Core"]
        Content["Content.cpp & Tooltip.cpp<br/>(Weapon Grants & Lore)"]
        Vendor["VendorTest.cpp<br/>(Mode-Aware Pools)"]
        Vulkan2D["Vulkan2D Submodule<br/>(Standalone Engine Split)"]
    end

    Poll --> TODO
    Art --> Content
    LogDiag --> Engine
    TODO --> Sprint
    Sprint --> Content
    Sprint --> Vendor
    Sprint --> Vulkan2D
`,
      },
    ],
  },
  {
    id: "vk2d-architecture",
    title: "53. Vulkan2D Basic Architecture & Frame Lifecycle",
    category: "graphics",
    summary:
      "How extern/Vulkan2d turns complex Vulkan setup into a simple 2D drawing API: the global renderer state, 18-step boot sequence, 2 frames in flight, 3 command buffers per swapchain image (Copy, Compute, Draw), and automatic window resizing.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/VK2D.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Renderer.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Opaque.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Structs.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Constants.h",
      "extern/Vulkan2d/VK2D/src/Renderer.c",
      "extern/Vulkan2d/VK2D/src/RendererMeta.c",
    ],
    content: `
### What \`extern/Vulkan2d\` Is and Why It Exists

Raw Vulkan is famously verbose: drawing a single 2D sprite requires hundreds of lines of setup for instances, physical devices, queues, swapchains, render passes, descriptor pools, staging buffers, and pipeline barriers. \`extern/Vulkan2d\` (**VK2D**) wraps **Vulkan 1.2** and **SDL3** behind a clean, beginner-friendly C API (originally designed as a high-speed drop-in replacement for \`SDL_Renderer\`).

You include \`VK2D/VK2D.h\`, initialize the renderer on an SDL3 Vulkan window, load textures or shaders, call simple drawing functions like \`vk2dDrawTexture(tex, x, y)\`, and finish each frame with \`vk2dRendererPresent()\`.

#### Opaque Pointers vs User Structs

To keep user code simple and prevent accidental corruption of Vulkan handles, \`VK2D/include/VK2D/Structs.h\` splits all types into two categories:
1. **Opaque Pointers (\`VK2D_OPAQUE_POINTER\`):** Types like \`VK2DTexture\`, \`VK2DShader\`, \`VK2DPolygon\`, \`VK2DModel\`, and \`VK2DRenderer\` are pointers to hidden internal structs (defined only inside \`VK2D/include/VK2D/Opaque.h\`). You create and free them through VK2D functions without ever touching raw \`VkImage\` or \`VkBuffer\` handles.
2. **Plain User Structs (\`VK2D_USER_STRUCT\`):** Small configuration structs like \`VK2DRendererConfig\`, \`VK2DStartupOptions\`, \`VK2DCameraSpec\`, and \`VK2DDrawCommand\` live on the stack so you can read and edit their fields directly.

Internally, a single global state structure (\`VK2DRenderer gRenderer\` in \`VK2D/src/Renderer.c\`, defined as \`struct VK2DRenderer_t\` in \`VK2D/include/VK2D/Opaque.h\`) owns the entire Vulkan context: the \`VkInstance\`, physical and logical devices, Vulkan Memory Allocator (\`VmaAllocator\`), swapchain images, descriptor controllers, graphics/compute pipelines, and frame synchronization primitives.

### Screen Space, Angles & Origin Pivots

Before looking at the GPU internals, it helps to know how VK2D measures positions and angles:
- **Top-Left Origin:** Coordinates start at $(0, 0)$ in the **top-left corner** of the window or texture. The $x$-axis grows to the right, and the $y$-axis grows **downward** (so $y = 300$ is lower on screen than $y = 100$).
- **Radians & Clockwise Rotation:** All rotations in VK2D use **radians** (with helper macros \`VK2D_DEGREES(d)\` and \`VK2D_RADIANS(r)\` in \`Constants.h\`). Angles start at East ($0\\text{ rad}$) and rotate **clockwise**.
- **Origin Pivot (\`originX, originY\`):** By default, a sprite's rotation pivot is its top-left corner $(0, 0)$, which swings the whole image in an arc when rotated. Setting \`originX = width / 2\` and \`originY = height / 2\` rotates the sprite cleanly in place around its center.

### Startup Options & Automatic Hardware Fallbacks

\`vk2dRendererInit(SDL_Window *window, VK2DRendererConfig config, const VK2DStartupOptions *options)\` boots the renderer. If you pass \`NULL\` for \`options\` (or leave specific fields set to \`0\`), VK2D fills in safe defaults from \`DEFAULT_STARTUP_OPTIONS\` and \`Constants.c\`:

| Option Field | Default Value | Plain-English Purpose |
| --- | --- | --- |
| \`enableDebug\` | \`false\` | Enables \`VK_LAYER_KHRONOS_validation\` and attaches the debug callback (\`_vk2dDebugCallback\`) to catch Vulkan API misuse. |
| \`stdoutLogging\` | \`true\` | Prints info, warnings, and errors to the terminal (\`Logger.c\`). |
| \`quitOnError\` | \`true\` | Immediately aborts the program if a fatal Vulkan error occurs (\`VK2D_LOG_SEVERITY_FATAL\`). |
| \`errorFile\` | \`"vk2derror.txt"\` | File path where warnings, errors, and system hardware specs (\`vk2dHostInformation()\`) are appended. |
| \`vramPageSize\` | \`256,000\` bytes | Size of each RAM-to-VRAM staging page in \`VK2DDescriptorBuffer\`. Controls how many sprites (\`2,284\`) or geometry vertices (\`9,141\`) fit in one batch. |
| \`maxTextures\` | \`10,000\` | Maximum number of textures that can stay loaded at once in the global bindless texture array (clamped to hardware limits). |
| \`enableNuklear\` | \`false\` | Initializes the built-in Nuklear immediate-mode GUI library when set to \`true\`. |

GPUs vary wildly in what they support. Integrated laptops often lack triple buffering (\`VK_PRESENT_MODE_MAILBOX_KHR\`) or \`32x\` MSAA. Rather than failing to boot when you request an unsupported setting in \`VK2DRendererConfig\`, VK2D queries the GPU's limits (\`gRenderer->limits\`) and **automatically falls back to the next best supported option**:
- If you request \`VK2D_MSAA_32X\` on a GPU that only supports \`8x\` MSAA, VK2D clamps \`config.msaa\` to \`VK2D_MSAA_8X\`.
- If you request \`VK2D_SCREEN_MODE_TRIPLE_BUFFER\` or \`VK2D_SCREEN_MODE_IMMEDIATE\` and the display driver does not offer it, \`_vk2dRendererGetPresentMode()\` falls back to \`VK2D_SCREEN_MODE_VSYNC\` (\`VK_PRESENT_MODE_FIFO_KHR\`), which the Vulkan specification guarantees on every device.
- Calling \`vk2dRendererGetConfig()\` returns the **actual** configuration running on the hardware (or the pending config if you just called \`vk2dRendererSetConfig()\`).

### The 18-Step Boot Sequence & Why Frame 1 Starts Immediately

After creating the \`VkInstance\`, picking a GPU (\`VK2DPhysicalDevice\`), creating the logical device (\`VK2DLogicalDevice\`), and starting the Vulkan Memory Allocator (\`VmaAllocator\`), \`vk2dRendererInit()\` runs 18 ordered setup steps wrapped in \`VK2D_INIT_STEP(step)\`. If any step hits a fatal error (\`vk2dStatusFatal()\`), it stops right there and calls \`vk2dRendererQuit()\` so later steps never touch half-initialized pointers:

\`\`\`c
#define VK2D_INIT_STEP(step) do { step; if (vk2dStatusFatal()) { vk2dRendererQuit(); return VK2D_ERROR; } } while (0)
VK2D_INIT_STEP(_vk2dRendererCreateDebug());
VK2D_INIT_STEP(_vk2dRendererCreateWindowSurface());
VK2D_INIT_STEP(_vk2dRendererCreateSwapchain());
VK2D_INIT_STEP(_vk2dRendererCreateColourResources());
VK2D_INIT_STEP(_vk2dRendererCreateDepthBuffer());
VK2D_INIT_STEP(_vk2dRendererCreateRenderPass());
VK2D_INIT_STEP(_vk2dRendererCreateDescriptorSetLayouts());
VK2D_INIT_STEP(_vk2dRendererCreatePipelines());
VK2D_INIT_STEP(_vk2dRendererCreateFrameBuffer());
VK2D_INIT_STEP(_vk2dRendererCreateDescriptorPool(false));
VK2D_INIT_STEP(_vk2dRendererCreateDescriptorBuffers());
VK2D_INIT_STEP(_vk2dRendererCreateUniformBuffers(true));
VK2D_INIT_STEP(_vk2dRendererCreateSampler());
VK2D_INIT_STEP(_vk2dRendererCreateUnits());
VK2D_INIT_STEP(_vk2dRendererCreateSynchronization());
VK2D_INIT_STEP(_vk2dRendererCreateSpriteBatching());
VK2D_INIT_STEP(_vk2dRendererInitNuklear());
VK2D_INIT_STEP(_vk2dInitShaderCompiler());
#undef VK2D_INIT_STEP
\`\`\`

Look at line 334 of \`VK2D/src/Renderer.c\`: right before \`vk2dRendererInit()\` finishes, it calls \`vk2dRendererStartFrame(VK2D_BLACK)\`! That means **as soon as \`vk2dRendererInit()\` returns, the renderer is already inside an open frame and ready to record draw calls**. In your main loop, you do not need to call \`StartFrame\` or \`EndFrame\` manually; you simply draw your scene and call \`vk2dRendererPresent()\`, which finishes the current frame and immediately opens the next one:

\`\`\`c
void vk2dRendererPresent() {
  if (vk2dRendererGetPointer() == NULL)
    return;
  vk2dRendererEndFrame();
  vk2dRendererStartFrame(VK2D_BLACK);
}
\`\`\`

*(Guard flag \`gRenderer->procedStartFrame\` ensures that calling \`vk2dRendererStartFrame()\` twice in a row or calling \`vk2dRendererEndFrame()\` without a started frame is a safe no-op.)*

### Two Frames in Flight vs Three Command Buffers

To keep both the CPU and GPU busy without waiting on each other, VK2D uses two separate counters every frame:

1. **Frame-in-Flight Slot (\`currentFrame\` $\\in \\{0, 1\\}$, since \`VK2D_MAX_FRAMES_IN_FLIGHT = 2\`):**
   While the GPU is busy drawing Frame 0, the CPU can already record commands and write uniform data into Frame 1's memory buffers. Resources duplicated per \`currentFrame\` include:
   - \`inFlightFences[2]\`: CPU wait fences that prevent the CPU from overwriting a frame slot still in use by the GPU.
   - \`imageAvailableSemaphores[2]\`: GPU semaphores signaled when the swapchain hands over a screen image.
   - \`descriptorBuffers[2]\`: The per-frame 256 KB paged staging/VRAM memory managers (\`VK2DDescriptorBuffer\`).
   - \`uboDescriptorSets[2]\`: The per-frame camera matrix uniform descriptors.
   - \`descConCompute[2]\`, \`descConShaders[2]\`, \`descConSBO[2]\`: Per-frame descriptor set allocators reset at the start of each frame (\`vk2dDescConReset\`).

2. **Swapchain Image Index (\`scImageIndex\` $\\in [0, \\text{swapchainImageCount})$, usually 3 images):**
   Returned by \`vkAcquireNextImageKHR\`. It tells VK2D which actual screen backbuffer to draw into. Indexed by \`scImageIndex\`:
   - \`framebuffers[scImageIndex]\` and \`swapchainImageViews[scImageIndex]\`.
   - \`renderFinishedSemaphores[scImageIndex]\` and \`imagesInFlight[scImageIndex]\`.
   - **Three separate \`VkCommandBuffer\` streams per swapchain image:**
     1. \`dbCommandBuffer[scImageIndex]\` (**1. Copy Buffer**): Copies all per-frame dynamic data (sprite batches, camera matrices, shader uniforms, dynamic geometry) from CPU staging RAM into fast GPU VRAM, then inserts a pipeline barrier so Compute waits for the copy to finish.
     2. \`computeCommandBuffer[scImageIndex]\` (**2. Compute Buffer**): Runs the \`spritebatch.comp\` compute shader to turn compact sprite draw commands into $4 \\times 4$ model matrices in parallel, then inserts a pipeline barrier so Vertex Shaders wait for Compute to finish.
     3. \`commandBuffer[scImageIndex]\` (**3. Draw Buffer**): Runs the actual graphics render passes (\`vkCmdBeginRenderPass\`), switches offscreen targets, and records all \`vkCmdDraw\` calls.

### Why CPU Recording Order Differs from GPU Execution Order

One of the cleverest tricks in VK2D is how those three command buffers are recorded vs how the GPU runs them:

- **While You Draw (CPU Recording):**
  When you call \`vk2dRendererDrawTexture()\`, VK2D simply appends a struct to a C array (\`gRenderer->drawCommands\`). When that batch flushes (\`vk2dRendererFlushSpriteBatch()\`), VK2D copies those commands into the mapped CPU staging memory of \`descriptorBuffers[currentFrame]\`, records \`vkCmdDispatch\` onto \`computeCommandBuffer\`, and records \`vkCmdDraw\` onto \`commandBuffer\`. Notice that **nothing has been recorded into \`dbCommandBuffer\` yet**!
- **When the Frame Ends (\`vk2dRendererEndFrame\`):**
  At the end of the frame, after every sprite batch, camera update, and custom shader uniform has been written into the staging pages, \`vk2dDescriptorBufferEndFrame()\` unmaps the staging memory and records **one big \`vkCmdCopyBuffer\` per 256 KB page** into \`dbCommandBuffer\`, followed by the pipeline barriers.
- **When Submitted to the GPU (\`vkQueueSubmit\`):**
  VK2D submits the three command buffers in the array order \`[dbCommandBuffer, computeCommandBuffer, commandBuffer]\`:
  $$\\text{GPU Execution Order:} \\quad \\underbrace{\\text{dbCommandBuffer}}_{\\text{1. Copy RAM } \\to \\text{ VRAM}} \\longrightarrow \\underbrace{\\text{computeCommandBuffer}}_{\\text{2. Build Sprite Matrices}} \\longrightarrow \\underbrace{\\text{commandBuffer}}_{\\text{3. Draw Graphics Passes}}$$
  Even though \`dbCommandBuffer\` was recorded last on the CPU, it sits **first** in the submit list! The GPU copies all frame data to VRAM in one burst, runs all compute shader dispatches second, and executes all graphics draws third.

### Skipping Redundant Binds & Handling Window Resizes

Binding the same Vulkan pipeline, descriptor sets, or vertex buffer over and over is slow. For non-instanced draws (shapes, custom shaders, 3D models), \`gRenderer\` remembers the last bound handles in \`prevPipe\`, \`prevSetHash\`, and \`prevVBO\`, skipping the Vulkan bind calls when nothing changed:

\`\`\`c
uint64_t _vk2dHashSets(VkDescriptorSet *sets, uint32_t setCount) {
  uint64_t hash = 0;
  for (uint32_t i = 0; i < setCount; i++) {
    uint64_t *pointer = (void*)&sets[i];
    hash += (*pointer) * (i + 1);
  }
  return hash;
}
\`\`\`

Notice how weighting each handle by \`(i + 1)\` makes order matter: swapping Set 1 and Set 2 produces a different hash, whereas re-drawing two polygons in a row with the same camera descriptor set produces the exact same hash and skips both \`vkCmdBindPipeline\` and \`vkCmdBindDescriptorSets\`. Switching render targets or flushing a sprite batch calls \`_vk2dRendererResetBoundPointers()\` to clear \`prevPipe\`, \`prevSetHash\`, and \`prevVBO\`.

When a user resizes or minimizes the window (causing \`VK_ERROR_OUT_OF_DATE_KHR\` or \`VK_SUBOPTIMAL_KHR\`), or calls \`vk2dRendererSetConfig()\` to change MSAA or VSync on the fly:
1. If the window is minimized (\`SDL_WINDOW_MINIMIZED\`), \`_vk2dRendererResetSwapchain()\` pauses in a lightweight \`SDL_PumpEvents()\` loop until the window is restored.
2. It waits for the GPU to finish (\`vkDeviceWaitIdle\`) and rebuilds the swapchain, MSAA buffer, depth buffer, framebuffers, camera UBOs, samplers, and sync objects.
3. **Smart MSAA Rebuild:** Because Vulkan bakes MSAA sample counts into render passes, pipelines, and offscreen framebuffers, VK2D checks \`bool msaaChanged = gRenderer->newConfig.msaa != gRenderer->config.msaa;\`. Only when MSAA actually changed does it destroy and recreate the 3 \`VkRenderPass\` objects, rebuild all pipelines (keeping custom shaders alive), and call \`_vk2dRendererRefreshTargets()\` to resize the MSAA resolve images of every offscreen texture target!

#### Swapchain Surface Capabilities, Image Count & \`B8G8R8A8_SRGB\` Selection

Inside \`_vk2dRendererCreateWindowSurface()\` and \`_vk2dRendererCreateSwapchain()\` (\`RendererMeta.c\`), VK2D handles three tricky cross-platform window quirks automatically:
- **Universal Surface Format:** VK2D locks \`surfaceFormat.format = VK_FORMAT_B8G8R8A8_SRGB\` with \`VK_COLOR_SPACE_SRGB_NONLINEAR_KHR\` (guaranteed across Vulkan desktop and mobile drivers) so sRGB textures blend accurately without washing out colors.
- **High-DPI & Wayland Window Sizes (\`UINT32_MAX\` Extent):** On Wayland and some Retina displays, \`surfaceCapabilities.currentExtent.width\` may be \`UINT32_MAX\` to let the application choose the resolution. When VK2D sees \`UINT32_MAX\`, \`_vk2dRendererGetSurfaceSize()\` falls back to \`SDL_GetWindowSizeInPixels()\` so blurry scaling never happens.
- **Swapchain Image Count Clamping:** VK2D requests at least 3 swapchain images for smooth triple buffering ($\\max(\\text{minImageCount}, 3)$), then clamps down to \`surfaceCapabilities.maxImageCount\` when a driver restricts the maximum queue length.

### Detailed Swapchain Image Acquisition & Fence Tracking (\`vk2dRendererStartFrame\`)

Let's trace what happens at the very start of a frame inside \`vk2dRendererStartFrame()\`:
1. **Wait on the Frame-in-Flight Fence:** First, the CPU calls \`vkWaitForFences(ld->dev, 1, &inFlightFences[currentFrame], VK_TRUE, UINT64_MAX)\`. Because \`inFlightFences[0..1]\` are created in the **signaled** state (\`VK_FENCE_CREATE_SIGNALED_BIT\`), the very first two frames do not block at all.
2. **Acquire a Swapchain Image in a Retry Loop:** Next, it calls \`vkAcquireNextImageKHR(..., imageAvailableSemaphores[currentFrame], VK_NULL_HANDLE, &scImageIndex)\`:
   - \`VK_SUCCESS\`: Image acquired cleanly; break out of the loop and proceed.
   - \`VK_SUBOPTIMAL_KHR\`: The image is still usable for this frame, so VK2D sets \`gRenderer->resetSwapchain = true\` (to rebuild the swapchain right after presenting this frame) and breaks out of the loop to draw normally.
   - \`VK_ERROR_OUT_OF_DATE_KHR\`: The window size changed and the image cannot be used. VK2D immediately calls \`_vk2dRendererResetSwapchain()\` and \`continue\`s the \`for (;;)\` loop to acquire a fresh image from the newly rebuilt swapchain!
   - \`VK_NOT_READY\` or \`VK_TIMEOUT\`: Sets \`procedStartFrame = false\` and skips the frame without crashing.
3. **Check if That Swapchain Image Is Still in Flight (\`imagesInFlight\`):** Because a swapchain usually has 3 images while \`VK2D_MAX_FRAMES_IN_FLIGHT\` is 2, \`imagesInFlight[scImageIndex]\` stores the \`VkFence\` of whichever frame last rendered to \`scImageIndex\`. If \`imagesInFlight[scImageIndex] != VK_NULL_HANDLE\`, VK2D waits on that fence before reassigning \`imagesInFlight[scImageIndex] = inFlightFences[currentFrame]\`.
4. **Rolling 1-Second Frame Time Average:** At the end of \`vk2dRendererEndFrame()\`, VK2D measures the elapsed wall time since \`previousTime\` in milliseconds using \`SDL_GetPerformanceCounter()\`, adds it to \`accumulatedTime\`, and increments \`amountOfFrames\`. Once \`accumulatedTime >= 1000.0\` ms (one full second), it updates \`gRenderer->frameTimeAverage = accumulatedTime / amountOfFrames\` and resets both counters to zero. That way, calling \`vk2dRendererGetAverageFrameTime()\` returns a stable, jitter-free millisecond reading ($1000 / \\text{avg}$ = FPS)!

### Reverse-Order Teardown (\`vk2dRendererQuit\`)

When your game exits and calls \`vk2dRendererQuit()\`, VK2D cleans up in the exact reverse order of initialization:
1. If a frame is currently open (\`procedStartFrame == true\`), it calls \`vk2dRendererEndFrame()\` to flush and submit it cleanly.
2. It calls \`vkQueueWaitIdle(gRenderer->ld->queue)\` so the GPU finishes all work in flight before any buffer or image is destroyed.
3. It shuts down the Slang compiler (\`_vk2dQuitShaderCompiler\`) and Nuklear GUI (\`_vk2dRendererQuitNuklear\`), then destroys sprite batching, sync objects, target lists, unit polygons, samplers, descriptor pools, descriptor buffers, framebuffers, pipelines, descriptor set layouts, render passes, depth and MSAA buffers, the swapchain, window surface, debug callbacks, and \`vmaDestroyAllocator\`.
4. Finally, it frees the logical device, physical device, \`VkInstance\`, logger/validation mutexes, and \`gRenderer\` itself.
`,
    mermaidCharts: [
      {
        title: "VK2DRenderer_t Subsystem Ownership & Handle Hierarchy",
        chart: `
flowchart TD
    classDef root fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef dev fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef mem fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef pipe fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    R["gRenderer (struct VK2DRenderer_t)<br/>Singleton State Machine"]:::root

    subgraph Core_Vulkan ["Instance, Device & Allocator"]
        VK["VkInstance vk + VkSurfaceKHR surface"]:::dev
        PD["VK2DPhysicalDevice pd<br/>(graphicsFamily / computeFamily)"]:::dev
        LD["VK2DLogicalDevice ld<br/>(VkDevice, queue, loadQueue, pool)"]:::dev
        VMA["VmaAllocator vma + vmaBudgets"]:::dev
    end

    subgraph Swapchain_Passes ["Swapchain & 3 RenderPasses"]
        SC["VkSwapchainKHR swapchain<br/>swapchainImages & framebuffers"]:::pipe
        RP["3 VkRenderPass Objects<br/>renderPass, midFrameSwap, externalTarget"]:::pipe
        ATT["Attachments<br/>msaaImage + depthBuffer"]:::pipe
    end

    subgraph Per_Frame_Sync ["2 Frames in Flight vs N Swapchain Slots"]
        FIF["Per-Frame (VK2D_MAX_FRAMES_IN_FLIGHT = 2)<br/>inFlightFences, imageAvailableSemaphores<br/>descriptorBuffers, descConCompute/Shaders/SBO"]:::mem
        CB["Per-Swapchain-Image (scImageIndex)<br/>dbCommandBuffer (Copy)<br/>computeCommandBuffer (Compute)<br/>commandBuffer (Draw)"]:::mem
    end

    subgraph Pipelines_Descriptors ["Pipelines & Bindless Descriptors"]
        PIPES["Built-In VK2DPipelines<br/>instancedPipe, spriteBatchPipe (Compute),<br/>primFillPipe, primLinePipe, modelPipe, wireframePipe, shadowsPipe"]:::pipe
        TEX["Global Bindless Array<br/>texArrayDescriptorSet (Set 2, Binding 2)<br/>Up to 10,000 Sampled Images"]:::mem
    end

    R --> Core_Vulkan
    R --> Swapchain_Passes
    R --> Per_Frame_Sync
    R --> Pipelines_Descriptors
`,
      },
      {
        title: "Three-Command-Buffer Frame Recording vs GPU Execution Timeline",
        chart: `
sequenceDiagram
    autonumber
    participant App as User / Game Loop
    participant CPU as Renderer.c (CPU State)
    participant DB as dbCommandBuffer (Copy)
    participant Comp as computeCommandBuffer (Compute)
    participant Draw as commandBuffer (Draw)
    participant GPU as VkQueue (GPU Execution)

    Note over App,CPU: Frame already started by vk2dRendererInit() or previous Present()
    CPU->>CPU: vkWaitForFences(inFlightFences at currentFrame)
    CPU->>CPU: vkAcquireNextImageKHR -> scImageIndex
    CPU->>DB: vkBeginCommandBuffer + vmaMapMemory(stageBuffers)
    CPU->>Comp: vkBeginCommandBuffer + Bind spriteBatchPipe
    CPU->>Draw: vkBeginCommandBuffer + vkCmdBeginRenderPass(renderPass)

    App->>CPU: vk2dRendererDrawTexture(...) / DrawPolygon(...)
    CPU->>CPU: Append VK2DDrawCommand to drawCommands buffer
    Note over CPU,Draw: On Batch Flush (vk2dRendererFlushSpriteBatch)
    CPU->>CPU: memcpy drawCommands to mapped stageBuffer & reserve DrawInstance SBO
    CPU->>Comp: vkCmdPushConstants + vkCmdBindDescriptorSets + vkCmdDispatch
    CPU->>Draw: vkCmdBindPipeline(instancedPipe) + vkCmdDraw(6 * count, 1)

    App->>CPU: vk2dRendererPresent() -> vk2dRendererEndFrame()
    CPU->>CPU: Flush final sprite batch & _vk2dRendererFlushUBOBuffers()
    CPU->>Draw: vkCmdEndRenderPass(commandBuffer)
    CPU->>DB: vmaUnmapMemory + vkCmdCopyBuffer(stage to device) per page
    CPU->>DB: Barrier TRANSFER_WRITE to COMPUTE_SHADER (READ and WRITE)
    CPU->>Comp: Barrier COMPUTE_WRITE to VERTEX_INPUT and VERTEX_SHADER
    CPU->>GPU: vkQueueSubmit(dbCommandBuffer, computeCommandBuffer, commandBuffer)
    GPU->>GPU: 1. DMA Transfer Pages -> 2. Compute Matrices -> 3. Rasterize Draws
    CPU->>GPU: vkQueuePresentKHR(swapchain, scImageIndex)
    CPU->>CPU: Advance currentFrame and call vk2dRendererStartFrame()
`,
      },
    ],
  },
  {
    id: "vk2d-devices-memory",
    title: "54. Physical/Logical Devices, VMA & Paged DescriptorBuffers",
    category: "graphics",
    summary:
      "How VK2D picks the best GPU, checks Vulkan 1.2 bindless features, tracks VRAM with Vulkan Memory Allocator (VMA), and streams dynamic frame data through 256 KB DescriptorBuffer pages.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/PhysicalDevice.h",
      "extern/Vulkan2d/VK2D/include/VK2D/LogicalDevice.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Buffer.h",
      "extern/Vulkan2d/VK2D/include/VK2D/DescriptorBuffer.h",
      "extern/Vulkan2d/VK2D/src/PhysicalDevice.c",
      "extern/Vulkan2d/VK2D/src/LogicalDevice.c",
      "extern/Vulkan2d/VK2D/src/Buffer.c",
      "extern/Vulkan2d/VK2D/src/DescriptorBuffer.c",
    ],
    content: `
### Picking the Best GPU & Queue Family (\`PhysicalDevice.c\`)

A computer often has more than one graphics chip (for example, an integrated CPU graphics chip plus a dedicated gaming GPU). \`vk2dPhysicalDeviceFind(VkInstance instance, int32_t preferredDevice)\` inspects every Vulkan-capable device on the system.

When \`preferredDevice\` is set to \`VK2D_DEVICE_BEST_FIT\` (\`-1\`), \`_vk2dPhysicalDeviceGetBestDevice()\` loops through the available GPUs:
- If it finds a **discrete GPU** (\`VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU\`) that supports VK2D's required queues, it selects it immediately and stops searching.
- Otherwise, it falls back to the first supported integrated GPU.

What makes a GPU queue family valid for VK2D? Inside \`_vk2dPhysicalDeviceSupportsQueueFamilies()\`, VK2D looks for a single queue family whose \`queueFlags\` support **both graphics drawing and compute shaders** (\`VK_QUEUE_GRAPHICS_BIT\` and \`VK_QUEUE_COMPUTE_BIT\`):

\`\`\`c
if (queueList[i].queueFlags & VK_QUEUE_GRAPHICS_BIT &&
    queueList[i].queueFlags & VK_QUEUE_COMPUTE_BIT) {
  out->QueueFamily.graphicsFamily = i;
  gRenderer->limits.supportsMultiThreadLoading = queueList[i].queueCount >= 2;
  gfx = true;
  out->QueueFamily.computeFamily = i;
  comp = true;
}
\`\`\`

Why is using the same queue family for both graphics and compute so helpful? In Vulkan, if compute and graphics lived on different queue families, every sprite batch would need a complex queue ownership transfer barrier. Because they share one queue family, simple pipeline barriers are all that is needed! And if that queue family offers at least 2 hardware queues (\`queueCount >= 2\`), VK2D grabs a second queue handle (\`ldev->loadQueue\`) and sets \`limits.supportsMultiThreadLoading = true\`.

### Logical Device & The 7 Required Bindless Features (\`LogicalDevice.c\`)

Once the physical GPU is chosen, \`vk2dLogicalDeviceCreate()\` creates the \`VK2DLogicalDevice\` wrapper (\`VkDevice\`, \`queue\`, \`loadQueue\`, and a resettable \`VkCommandPool\`).

Because VK2D stores all loaded textures in a single huge bindless array so you can draw any texture at any time without swapping descriptor sets, it queries \`vkGetPhysicalDeviceFeatures2\` (\`VkPhysicalDeviceDescriptorIndexingFeatures\`) and checks that the GPU supports **seven Vulkan 1.2 descriptor indexing features**:

1. \`shaderSampledImageArrayNonUniformIndexing\` (allows shaders to index the texture array with a per-sprite variable)
2. \`runtimeDescriptorArray\` (allows open-ended \`texture2D tex[]\` arrays in GLSL/Slang)
3. \`descriptorBindingVariableDescriptorCount\` (allows sizing the texture array to \`maxTextures\` at allocation time)
4. \`descriptorBindingPartiallyBound\` (allows drawing even when most of the 10,000 texture slots are still empty)
5. \`descriptorBindingUpdateUnusedWhilePending\` (allows loading a new texture into an empty slot while a command buffer is running)
6. \`descriptorBindingSampledImageUpdateAfterBind\` (allows updating texture slots after the descriptor set is bound)
7. \`descriptorBindingUniformBufferUpdateAfterBind\` (allows updating the camera matrix UBO at the end of the frame after draw calls were recorded)

All the hardware limits above are queried during \`vk2dLogicalDeviceCreate()\` (\`LogicalDevice.c\`): optional extensions \`VK_EXT_MEMORY_BUDGET_EXTENSION_NAME\` and \`VK_KHR_portability_subset\` (for macOS/MoltenVK) are enabled automatically if present, along with device features \`wideLines\` (unlocking \`limits.maxLineWidth\`), \`fillModeNonSolid\` (unlocking 3D \`wireframePipe\`), and \`samplerAnisotropy\`.

#### Automatic Depth Buffer Format Probing (\`_vk2dRendererCreateDepthBuffer\`)

Before creating pipelines or render passes, \`_vk2dRendererCreateDepthBuffer()\` searches for the lightest supported depth format on the physical GPU:
1. It checks four candidate formats in order: \`VK_FORMAT_D16_UNORM\`, \`VK_FORMAT_D32_SFLOAT\`, \`VK_FORMAT_D32_SFLOAT_S8_UINT\`, and \`VK_FORMAT_D24_UNORM_S8_UINT\`.
2. Using \`vkGetPhysicalDeviceFormatProperties()\`, it picks the **first** format whose \`optimalTilingFeatures\` includes \`VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT\`.
3. Why pick \`D16_UNORM\` first? Most 2D games only need depth testing when drawing optional 3D props across a small near/far range ($0.1$ to $10.0$), so 16-bit depth cuts depth-attachment VRAM bandwidth in half compared to 32-bit floats while staying compatible with hardware MSAA.

#### Single-Use Command Buffers & Queue Submissions (\`LogicalDevice.c\`)

Whenever an asset upload (texture pixels, 3D model VBO, or pixel readback) needs an immediate GPU transfer outside the main frame loop, VK2D uses two helper functions on \`VK2DLogicalDevice\`:
- \`vk2dLogicalDeviceGetSingleUseBuffer(dev)\`: Allocates a primary \`VkCommandBuffer\` from \`dev->pool\` and begins it with \`VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT\`.
- \`vk2dLogicalDeviceSubmitSingleBuffer(dev, buf)\`: Ends the command buffer, submits it to \`dev->queue\`, waits until the copy finishes via \`vkQueueWaitIdle(dev->queue)\`, and frees the command buffer back to \`dev->pool\`.
- Meanwhile, if the GPU queue family exposes two hardware queues (\`queueCount >= 2\`), \`vk2dLogicalDeviceCreate()\` also caches a second queue handle (\`ldev->loadQueue\`) and flags \`limits.supportsMultiThreadLoading = true\` alongside the active queue handle.

### Easy GPU Memory with VMA & Staging Uploads (\`Buffer.c\`)

Allocating raw \`VkDeviceMemory\` blocks in Vulkan by hand is slow and hits driver allocation count limits quickly. VK2D embeds **Vulkan Memory Allocator (VMA)** (\`gRenderer->vma\`) to pool and sub-allocate GPU memory automatically.

- **Checking VRAM Usage (\`vk2dRendererGetVRAMUsage\`):** If the GPU supports \`VK_EXT_memory_budget\` (\`limits.supportsVRAMUsage == true\`), VMA queries live OS video memory budgets via \`vmaGetHeapBudgets()\`. VK2D sums \`usage\` and \`budget\` across all \`VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT\` heaps and divides by $1{,}048{,}576$ to report used and total VRAM in **MiB**.
- **Static GPU Buffers (\`Buffer.c\`):** When you create a polygon or load a 3D model, the vertex data only needs to be uploaded once. Fast GPU memory (\`DEVICE_LOCAL\`) usually cannot be written directly by the CPU. So \`vk2dBufferLoad()\` does a two-step staging upload:
  1. It creates a temporary CPU-visible **staging buffer** (\`HOST_VISIBLE | HOST_COHERENT\`), maps it, and \`memcpy\`s your data into it.
  2. It creates a fast **device-local buffer** on the GPU, records a single-use command buffer to copy from staging to VRAM (\`vk2dBufferCopy\`), waits for the copy to finish, and frees the temporary staging buffer.
  *(For 3D models, \`vk2dBufferLoad2()\` packs both the vertex array and the 16-bit index array back-to-back into one shared \`VK2DBuffer\` in a single upload!)*

### Per-Frame Dynamic Memory: How \`VK2DDescriptorBuffer\` Works (\`DescriptorBuffer.c\`)

Static staging uploads are great for assets loaded once at startup, but what about data that changes **every single frame**, like sprite batches, camera matrices, custom shader uniforms, and \`vk2dRendererDrawGeometry\` vertices? Creating and freeing Vulkan buffers every frame would stutter terribly.

To solve this, VK2D creates one \`VK2DDescriptorBuffer\` per frame in flight (\`gRenderer->descriptorBuffers[0]\` and \`[1]\`). Think of a \`VK2DDescriptorBuffer\` as a **book of 256 KB memory pages** (\`_VK2DDescriptorBufferInternal\`). Each page is actually a twin pair of buffers of size \`pageSize = options.vramPageSize\` (default \`256,000\` bytes):
- \`stageBuffer\`: Lives in CPU-writable RAM (\`VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT\`).
- \`deviceBuffer\`: Lives in fast GPU VRAM (\`VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT\`) with flags allowing it to act simultaneously as a **Uniform Buffer (UBO)**, **Vertex Buffer (VBO)**, and **Storage Buffer (SSBO)**:
\`\`\`c
VK_BUFFER_USAGE_TRANSFER_DST_BIT |
VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT |
VK_BUFFER_USAGE_VERTEX_BUFFER_BIT |
VK_BUFFER_USAGE_STORAGE_BUFFER_BIT
\`\`\`

#### Follow One Frame Through \`VK2DDescriptorBuffer\`

1. **Start of Frame (\`vk2dDescriptorBufferBeginFrame\`):**
   Every existing 256 KB page resets its used byte counter to zero (\`buffers[i].size = 0\`) and maps its \`stageBuffer\` into a CPU pointer (\`buffers[i].hostData\`). No memory is allocated or freed; last frame's pages are simply recycled!
2. **During the Frame (\`CopyData\` and \`ReserveSpace\`):**
   - Whenever VK2D needs to send dynamic data to the GPU (like a flushed sprite batch, camera UBO, or shader uniform), it calls \`vk2dDescriptorBufferCopyData(db, data, size, &outBuffer, &offset)\`.
   - It checks its list of 256 KB pages for the first page with enough free space ($\\text{size} \\le \\text{pageSize} - \\text{buffers}[i].\\text{size}$). If every page is full, \`_vk2dDescriptorBufferAppendBuffer(db)\` allocates a brand-new 256 KB page pair on the fly (growing the page array in steps of \`VK2D_DEFAULT_ARRAY_EXTENSION = 5\`).
   - It \`memcpy\`s the data into \`stageBuffer\` at the current offset, and hands back the corresponding **VRAM** \`deviceBuffer->buf\` handle and byte \`offset\` so descriptors or vertex bindings can point to where the data *will* live once copied!
   - When the compute shader needs empty VRAM space to write its output \`VK2DDrawInstance\` matrices, VK2D calls \`vk2dDescriptorBufferReserveSpace()\`, which reserves a slice in the page and advances the offset without copying anything from the CPU.
   - **Hardware Alignment Rounding:** GPUs require uniform and storage buffer offsets to land on specific byte boundaries (for example, 64 or 256 bytes). After every sub-allocation, VK2D rounds \`spot->size\` up to the next multiple of the GPU's alignment limit:
     $$A = \\max\\!\\big(\\text{minStorageBufferOffsetAlignment},\\; \\text{minUniformBufferOffsetAlignment}\\big)$$
3. **End of Frame Bulk Copy (\`vk2dDescriptorBufferEndFrame\`):**
   When you call \`vk2dRendererPresent()\`, VK2D unmaps every \`stageBuffer\` and records **one \`vkCmdCopyBuffer\` per non-empty 256 KB page** onto \`dbCommandBuffer\`. Instead of thousands of tiny copies, the GPU copies whole 256 KB pages in bulk!
4. **Two-Stage Pipeline Barriers (\`RecordCopyPipelineBarrier\` & \`RecordComputePipelineBarrier\`):**
   - At the end of \`dbCommandBuffer\`: Records a buffer barrier on all active pages so the **Compute Shader** waits until the **DMA Transfer** finishes writing \`deviceBuffer\`.
   - At the end of \`computeCommandBuffer\`: Records a second buffer barrier on all active pages so the **Vertex Shader** waits until the **Compute Shader** finishes writing the sprite instance matrices into \`deviceBuffer\`.

#### How \`vramPageSize\` Controls Your Renderer Limits

Because a single allocation inside \`VK2DDescriptorBuffer\` can never span across two separate 256 KB pages (\`if (size < db->pageSize)\`), the value of \`options.vramPageSize\` directly sets the three hardware limits returned by \`vk2dRendererGetLimits()\`:

| Limit Field in \`VK2DRendererLimits\` | Formula in \`Renderer.c\` / \`RendererMeta.c\` | Value at Default \`256,000\` B Page |
| --- | --- | ---: |
| \`maxInstancedDraws\` | $\\min(\\lfloor\\text{vramPageSize} / 64\\rfloor,\\, \\lfloor\\text{vramPageSize} / 112\\rfloor) - 1$ | **2,284** sprites per batch |
| \`maxGeometryVertices\` | $\\lfloor\\text{vramPageSize} / \\text{sizeof(VK2DVertexColour)}\\rfloor - 1 = \\lfloor 256{,}000 / 28 \\rfloor - 1$ | **9,141** vertices per \`DrawGeometry\` call |
| \`maxShaderBufferSize\` | $\\min(\\text{maxUniformBufferRange},\\, \\text{vramPageSize})$ | **65,536 B** (or **256,000 B** if GPU allows) |
`,
    mermaidCharts: [
      {
        title: "VK2DDescriptorBuffer Paged Sub-Allocation & Alignment",
        chart: `
flowchart LR
    classDef req fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef host fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef vram fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    subgraph CPU_SubAlloc ["Mid-Frame Calls (DescriptorBuffer.c)"]
        C1["CopyData(drawCommands)<br/>memcpy to hostData + offset"]:::req
        C2["ReserveSpace(drawInstances)<br/>No CPU memcpy (GPU SSBO Out)"]:::req
        C3["CopyData(workingUBO / Shader Uniforms)"]:::req
    end

    subgraph Page_Pool ["_VK2DDescriptorBufferInternal Pages (256 KB each)"]
        SB["stageBuffer (HOST_VISIBLE)<br/>Mapped via vmaMapMemory<br/>Offset aligned to max(minSSBO, minUBO)"]:::host
        DB["deviceBuffer (DEVICE_LOCAL)<br/>TRANSFER_DST, UBO, VBO, SSBO"]:::vram
    end

    C1 --> SB
    C2 -.->|"Reserves aligned range"| DB
    C3 --> SB
    SB -->|"vkCmdCopyBuffer at EndFrame<br/>(on dbCommandBuffer)"| DB
`,
      },
      {
        title: "Two-Stage Buffer Memory Barrier Chain Across Command Buffers",
        chart: `
flowchart TD
    classDef copy fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef comp fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef draw fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    subgraph Cmd1 ["1. dbCommandBuffer (Transfer Stage)"]
        DMA["vkCmdCopyBuffer(stageBuffer to deviceBuffer)<br/>For all non-empty 256 KB pages"]:::copy
        B1["vk2dDescriptorBufferRecordCopyPipelineBarrier<br/>STAGE_TRANSFER (TRANSFER_WRITE)<br/>to STAGE_COMPUTE_SHADER (SHADER_READ / WRITE)"]:::copy
        DMA --> B1
    end

    subgraph Cmd2 ["2. computeCommandBuffer (Compute Stage)"]
        DISP["vkCmdDispatch(spriteBatchPipe, (drawCount/64)+1, 1, 1)<br/>Reads DrawCommand Buffer, Writes DrawInstance Buffer"]:::comp
        B2["vk2dDescriptorBufferRecordComputePipelineBarrier<br/>STAGE_COMPUTE_SHADER (SHADER_WRITE)<br/>to STAGE_VERTEX_INPUT and VERTEX_SHADER"]:::comp
        DISP --> B2
    end

    subgraph Cmd3 ["3. commandBuffer (Graphics Stage)"]
        VERT["instanced.vert / colour.vert / usershader.vert<br/>Reads DrawInstance SSBO, Camera UBO, User Uniforms & Geometry VBO"]:::draw
    end

    B1 --> DISP
    B2 --> VERT
`,
      },
    ],
  },
  {
    id: "vk2d-descriptors-textures",
    title: "55. Bindless Texture Array, Samplers & DescriptorControl",
    category: "graphics",
    summary:
      "How VK2D organizes its 4 descriptor sets, grows descriptor pools automatically, keeps up to 10,000 textures bound at once, streams dynamic pixel regions, and reads textures back to CPU RAM.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/DescriptorControl.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Texture.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Image.h",
      "extern/Vulkan2d/VK2D/src/DescriptorControl.c",
      "extern/Vulkan2d/VK2D/src/Texture.c",
      "extern/Vulkan2d/VK2D/src/Image.c",
    ],
    content: `
### How Shaders Find Their Data: The 4 Descriptor Sets

In Vulkan, shaders access textures and buffers through numbered **Descriptor Sets** (\`set = 0\`, \`set = 1\`, etc.). To keep things predictable across the entire engine, VK2D uses the exact same four descriptor set slots for every graphics pipeline:

| Set & Binding | Layout Handle | What Lives Here | Who Uses It |
| --- | --- | --- | --- |
| **Set 0, Binding 0** | \`dslBufferVP\` | **Camera Matrices (\`VK2DUniformBufferObject\`)**: Holds the \`mat4 viewproj[10]\` array for all 10 cameras. | Every vertex shader (\`instanced.vert\`, \`colour.vert\`, \`model.vert\`, \`shadows.vert\`, \`usershader.vert\`). |
| **Set 1, Binding 1** | \`dslSampler\` | **Texture Sampler**: Either \`samplerSet\` (2D pixel coordinates) or \`modelSamplerSet\` (3D repeating normalized UVs). | Sprite, custom shader, and 3D model fragment shaders. |
| **Set 2, Binding 2** | \`dslTextureArray\` | **Global Bindless Texture Array (\`texArrayDescriptorSet\`)**: Holds up to \`10,000\` \`VkImageView\` handles at once. | Sprite, custom shader, and 3D model fragment shaders. |
| **Set 3, Binding 3** (Sprites) | \`dslBufferSBO\` | **Computed Sprite Instances (\`DrawInstance objects[]\`)**: Storage buffer written by \`spritebatch.comp\`. | Read by \`instanced.vert\` during sprite batch drawing. |
| **Set 3, Binding 3** (Custom Shaders) | \`dslBufferUser\` | **Custom Shader Uniforms (\`UserData\`)**: Optional \`ConstantBuffer\` data passed to \`vk2dRendererDrawShader()\`. | Custom Slang / SPIR-V shaders. |
| **Compute Set 0, Bindings 0 & 1** | \`dslSpriteBatch\` | **Batch Input & Output SSBOs**: Binding 0 is \`DrawCommand draws[]\`, Binding 1 is \`DrawInstance draws[]\`. | Used exclusively by \`spritebatch.comp\` on the compute command buffer. |

### Never Running Out of Descriptor Sets: \`VK2DDescCon\` (\`DescriptorControl.c\`)

A standard Vulkan \`VkDescriptorPool\` has a hard limit on how many descriptor sets it can hand out; once full, \`vkAllocateDescriptorSets\` fails with \`VK_ERROR_OUT_OF_POOL_MEMORY\`.

\`VK2DDescCon\` (\`struct VK2DDescCon_t\`) wraps a **self-growing list of descriptor pools** so you never hit a hard ceiling mid-frame:
- Each pool in \`descCon->pools[]\` is created with room for \`VK2D_DEFAULT_DESCRIPTOR_POOL_ALLOCATION = 1000\` descriptor sets (defined in \`Constants.c\`).
- When VK2D needs a fresh descriptor set (for example, when flushing a sprite batch or calling \`vk2dRendererDrawShader\` with custom uniform data), \`_vk2dDescConGetAvailableSet(descCon)\` tries to allocate from \`pools[0]\`, then \`pools[1]\`, and so on.
- If every active pool in the list is full, \`_vk2dDescConAppendList(descCon)\` automatically creates a new \`VkDescriptorPool\` of 1,000 sets (expanding the \`pools\` array in steps of \`VK2D_DEFAULT_ARRAY_EXTENSION = 5\`) and hands back the new set.
- At the start of the next frame (\`vk2dRendererStartFrame\`), \`vk2dDescConReset()\` loops through \`0 .. poolsInUse - 1\` and calls \`vkResetDescriptorPool(..., 0)\`, instantly recycling all allocated sets for the new frame without destroying the pools.

### The Global Bindless Texture Array (Why All Textures Can Batch Together)

In older OpenGL or basic Vulkan renderers, drawing Sprite A with \`hero.png\` and Sprite B with \`tree.png\` required unbinding \`hero.png\`, binding \`tree.png\`, and issuing two separate draw calls.

VK2D avoids this completely: **every texture you load or create is placed into one giant global array** (\`gRenderer->texArrayDescriptorSet\`) at Set 2, Binding 2. That single array stays bound for the entire sprite batch, and each sprite simply passes its integer slot number (\`textureIndex = vk2dTextureGetID(tex)\`) to the shader!

#### How MoltenVK (macOS) Limits Are Handled Automatically

In \`_vk2dRendererCreateDescriptorSetLayouts()\` (\`RendererMeta.c\`), VK2D asks the Vulkan driver if it supports a variable-length descriptor array of \`options.maxTextures\` (default \`10,000\`) via \`vkGetDescriptorSetLayoutSupport\`. Some drivers (especially **MoltenVK** on macOS) support descriptor indexing but allow fewer textures in a single set than their global limit suggests. If \`layoutSupport.supported\` comes back false, VK2D halves the requested count in a loop (\`descriptorCount /= 2\`) until the driver accepts it, then clamps to the exact \`maxVariableDescriptorCount\` supported by the host.

#### Loading, Updating & Reading Back Textures (\`Texture.c\` & \`Image.c\`)

1. **Loading from Disk or Memory (\`vk2dTextureLoad\` / \`vk2dTextureFrom\`):**
   Uses embedded \`stb_image.h\` (\`STBI_rgb_alpha\`) to decode PNG/JPEG/BMP bytes into 32-bit RGBA pixels, uploads them through a staging buffer into a \`VK_FORMAT_R8G8B8A8_SRGB\` GPU image, transitions the image to \`VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL\`, and calls \`_vk2dTextureAddToTextureArray(tex)\`. That function finds the first slot in \`gRenderer->textureArray[]\` with \`active == false\`, stores the slot index atomically in \`tex->descriptorIndex\`, and writes the \`VkImageView\` into \`texArrayDescriptorSet[spot]\`. When you later call \`vk2dTextureFree(tex)\`, it simply sets \`textureArray[val].active = false\` so the next loaded texture can reuse that slot!
2. **Why 2D Textures Use Pixel Coordinates Instead of \`0.0 .. 1.0\` UVs:**
   Look at \`vk2dInitSamplerCreateInfo()\` in \`Initializers.c\`: VK2D's 2D sampler (\`gRenderer->textureSampler\`) sets \`unnormalizedCoordinates = VK_TRUE\` and \`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE\`. That means 2D shaders sample textures using **exact pixel coordinates** $(x \\in [0, \\text{width}],\\, y \\in [0, \\text{height}])$ rather than normalized $[0, 1]$ floats! Meanwhile, the 3D model sampler (\`gRenderer->modelSampler\`) sets \`unnormalizedCoordinates = VK_FALSE\` and \`VK_SAMPLER_ADDRESS_MODE_REPEAT\` for standard 3D UV mapping.
3. **Streaming Live Pixels into a Texture (\`vk2dTextureUpdate\` & \`vk2dTextureUpdateRegion\`):**
   If you have procedural pixel art, a dynamic minimap, or video frames that change on the CPU every frame (as demonstrated in \`examples/testing/main.c\`), you do not need to destroy and recreate the texture. Calling \`vk2dTextureUpdate(tex, pixels)\` or \`vk2dTextureUpdateRegion(tex, pixels, x, y, w, h)\` copies your RGBA buffer into a staging buffer, transitions the texture to \`TRANSFER_DST_OPTIMAL\`, copies just the \`(x, y, w, h)\` rectangle via \`vkCmdCopyBufferToImage\`, and transitions it back to \`SHADER_READ_ONLY_OPTIMAL\`. *(Note: Render-target textures created with \`vk2dTextureCreate\` cannot be updated with \`vk2dTextureUpdateRegion\`; draw to them with \`vk2dRendererSetTarget\` instead.)*
4. **Reading GPU Pixels Back to CPU RAM (\`vk2dTextureCopyPixels\`):**
   Need to save a screenshot or inspect a rendered texture on the CPU? \`vk2dTextureCopyPixels(tex, outPixels)\` copies the GPU image into a temporary host-visible staging buffer via \`vkCmdCopyImageToBuffer\`. Because offscreen render targets use the swapchain's \`VK_FORMAT_B8G8R8A8_SRGB\` format (Blue-Green-Red-Alpha) while normal loaded textures use \`VK_FORMAT_R8G8B8A8_SRGB\` (Red-Green-Blue-Alpha), \`vk2dTextureCopyPixels()\` checks \`vk2dTextureIsTarget(tex)\` and automatically swaps the Red and Blue channels for render targets so \`outPixels\` always comes back as clean RGBA bytes!

#### 2D \`textureSampler\` vs 3D \`modelSampler\` (\`RendererMeta.c\`)

The Vulkan specification forbids enabling anisotropic filtering when \`unnormalizedCoordinates = VK_TRUE\`. Because 2D sprites in VK2D sample textures using raw pixel coordinates rather than $0.0 .. 1.0$ fractions, \`_vk2dRendererCreateSampler()\` builds two separate \`VkSampler\` objects bound cleanly through \`samplerSet\` and \`modelSamplerSet\`:

| Sampler Property | 2D \`textureSampler\` (\`samplerSet\`) | 3D \`modelSampler\` (\`modelSamplerSet\`) |
| --- | --- | --- |
| **Coordinate Mode** | \`unnormalizedCoordinates = VK_TRUE\` (raw pixel $x, y$) | \`unnormalizedCoordinates = VK_FALSE\` (normalized $[0, 1]$ UV) |
| **Address Wrap Mode** | \`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE\` | \`VK_SAMPLER_ADDRESS_MODE_REPEAT\` (tiles seamlessly) |
| **Magnification / Minification** | \`LINEAR\` or \`NEAREST\` from \`config.filterMode\` | \`LINEAR\` or \`NEAREST\` from \`config.filterMode\` |
| **Anisotropic Filtering** | Disabled (\`1.0\`) because pixel UVs forbid anisotropy | Enabled when \`filterMode == LINEAR\`, clamped to \`min(msaa, maxSamplerAnisotropy)\` |

#### Inside \`struct VK2DTexture_t\`: Sprite Texture vs Render Target

Both regular images and drawable offscreen canvases share the same \`VK2DTexture\` pointer type (\`Opaque.h\`), distinguished internally by whether \`tex->fbo != VK_NULL_HANDLE\`:
- **Standard Sprite (\`vk2dTextureLoad\` / \`From\`):** Owns only \`img\` (\`VK_FORMAT_R8G8B8A8_SRGB\`), \`imgHandled = true\` (so \`vk2dTextureFree\` frees \`img\`), and its atomic bindless slot \`descriptorIndex\`. Fields \`sampledImg\`, \`depthBuffer\`, \`fbo\`, \`ubo\`, and \`uboSet\` stay \`NULL\`.
- **Offscreen Render Target (\`vk2dTextureCreate(w, h)\`):** Uses swapchain-compatible \`VK_FORMAT_B8G8R8A8_SRGB\` for \`img\` with \`COLOR_ATTACHMENT | SAMPLED | TRANSFER_SRC | TRANSFER_DST\`, allocates its own \`depthBuffer\` (and MSAA \`sampledImg\` if MSAA > 1x), builds a personal \`VkFramebuffer\` (\`fbo\`), uploads a dedicated orthographic \`ubo\` sized to \`w x h\`, and registers itself in \`gRenderer->targets[]\` so MSAA changes resize its attachments automatically!
`,
    mermaidCharts: [
      {
        title: "Bindless Texture Array Slot Allocation & Shader Sampling",
        chart: `
flowchart LR
    classDef cpu fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef desc fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gpu fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Load["vk2dTextureLoad / vk2dTextureCreate"]:::cpu
    Scan["Scan textureArray (0..maxTextures)<br/>Find first active == false -> spot"]:::cpu
    Update["vkUpdateDescriptorSets<br/>dstSet = texArrayDescriptorSet (Set 2, Binding 2)<br/>dstArrayElement = spot"]:::desc
    Draw["VK2DDrawCommand / PushConstants<br/>textureIndex = vk2dTextureGetID(tex)"]:::cpu
    Frag["instanced.frag / Slang PixelShader<br/>nonuniformEXT(textureIndex)<br/>Sampled with unnormalized pixel UVs (Set 1)"]:::gpu

    Load --> Scan --> Update
    Scan -->|"SDL_SetAtomicInt(&tex->descriptorIndex, spot)"| Draw
    Update --> Frag
    Draw --> Frag
`,
      },
      {
        title: "VK2DDescCon Auto-Expanding Descriptor Pool Chain",
        chart: `
flowchart TD
    classDef fnCall fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef pool fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Req["vk2dDescConGetSet(descCon)"]:::fnCall
    CheckNull{"descCon->pools == NULL?"}:::pool
    AllocPool["vkCreateDescriptorPool (1,000 sets)<br/>poolsInUse++"]:::pool
    TryAlloc["vkAllocateDescriptorSets(currentPool)"]:::pool
    Result{"res == VK_SUCCESS?"}:::pool
    NextPool{"++i == poolsInUse?"}:::pool
    Ret["Return VkDescriptorSet"]:::out

    Req --> CheckNull
    CheckNull -->|Yes| AllocPool --> TryAlloc
    CheckNull -->|No| TryAlloc
    TryAlloc --> Result
    Result -->|Yes| Ret
    Result -->|"VK_ERROR_OUT_OF_POOL_MEMORY"| NextPool
    NextPool -->|No| TryAlloc
    NextPool -->|Yes| AllocPool
`,
      },
    ],
  },
  {
    id: "vk2d-sprite-batching",
    title: "56. GPU Compute Sprite Batching & Instanced Pipeline",
    category: "graphics",
    summary:
      "Why drawing thousands of 2D sprites in VK2D is so fast: collecting lightweight VK2DDrawCommands on the CPU, building 4x4 matrices on the GPU in spritebatch.comp, and drawing procedural 6-vertex quads with zero vertex buffers.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/Structs.h",
      "extern/Vulkan2d/VK2D/src/Renderer.c",
      "extern/Vulkan2d/VK2D/src/RendererMeta.c",
      "extern/Vulkan2d/shaders/spritebatch.comp",
      "extern/Vulkan2d/shaders/instanced.vert",
      "extern/Vulkan2d/shaders/instanced.frag",
    ],
    content: `
### Why VK2D Uses a Compute Shader for Sprite Batching

In a typical 2D game, 90% of what you draw every frame is sprites (characters, tiles, projectiles, particles, UI icons). If the CPU had to multiply translation, rotation, and scaling matrices for 10,000 sprites and build 4-corner vertex buffers every frame, the CPU would quickly become a bottleneck.

VK2D turns sprite drawing into a **three-step assembly line** where the GPU does the heavy math:
1. **CPU (\`Renderer.c\`):** Simply appends your raw drawing parameters (position, scale, rotation angle, pivot, UV rectangle, color tint, and texture ID) into a flat C array (\`gRenderer->drawCommands\`).
2. **Compute Shader (\`shaders/spritebatch.comp\`):** Runs 64 threads per workgroup on the GPU to turn each compact \`VK2DDrawCommand\` into a full \`VK2DDrawInstance\` containing a $4 \\times 4$ model matrix.
3. **Vertex & Fragment Shaders (\`instanced.vert\` & \`instanced.frag\`):** Draws all $N$ sprites in a **single \`vkCmdDraw\` call** with **zero vertex buffers bound**, generating the 6 corners of each sprite quad on the fly from \`gl_VertexIndex\`!

#### Step 1: Collecting \`VK2DDrawCommand\` Structs on the CPU

Whenever you call \`vk2dRendererDrawTexture()\` (or its shorthand macros \`vk2dDrawTexture\`, \`vk2dDrawTextureExt\`, \`vk2dDrawTexturePart\`), VK2D fills out a \`VK2DDrawCommand\` struct and copies it into \`gRenderer->drawCommands[gRenderer->drawCommandCount++]\`:

\`\`\`c
struct VK2DDrawCommand {
    vec4 texturePos;       // xInTex, yInTex, texWidth, texHeight (in pixels)
    vec4 colour;           // RGBA colour tint (copied from gRenderer->colourBlend)
    vec2 pos;              // X, Y position in the game world
    vec2 origin;           // X, Y pivot point for rotation (in pixels)
    vec2 scale;            // X, Y scale multiplier (negative values flip the sprite!)
    float rotation;        // Rotation in radians
    uint32_t textureIndex; // Bindless texture slot (from vk2dTextureGetID(tex))
};
\`\`\`

If you want to build sprite lists on your own worker threads, you can also fill an array of \`VK2DDrawCommand\` structs yourself and hand the whole array to \`vk2dRendererAddBatch(commands, count)\` on the main thread!

#### Step 2: When Does a Sprite Batch Flush? (\`vk2dRendererFlushSpriteBatch\`)

How many sprites fit in a single batch before VK2D has to flush it to the current 256 KB \`VK2DDescriptorBuffer\` page? During startup (\`_vk2dRendererCreateDescriptorBuffers\`), VK2D divides \`vramPageSize\` (default \`256,000\` bytes) by \`sizeof(VK2DDrawInstance)\` (\`112\` bytes) and subtracts 1:
$$\\text{maxInstancedDraws} = \\left\\lfloor\\frac{256{,}000}{112}\\right\\rfloor - 1 = 2{,}284 \\text{ sprites per batch}$$
*(Tip: If your game draws tens of thousands of sprites per frame and you want even larger batches, simply set \`options.vramPageSize\` to a larger value when calling \`vk2dRendererInit\`, just like \`examples/testing/main.c\` does!)*

VK2D automatically calls \`vk2dRendererFlushSpriteBatch()\` whenever any of these events happen:
- **Batch Full:** \`drawCommandCount\` reaches \`limits.maxInstancedDraws\` (\`2,284\` by default).
- **Pipeline or Blend Mode Change:** You switch from drawing sprites to drawing shapes (\`vk2dRendererDrawPolygon\`, \`vk2dRendererDrawRectangle\`), custom shaders (\`vk2dRendererDrawShader\`), shadows (\`vk2dRendererDrawShadows\`), 3D models (\`vk2dRendererDrawModel\`), or you change the blend mode (\`vk2dRendererSetBlendMode\`).
- **Render Target Switch or Clear:** You call \`vk2dRendererSetTarget()\`, \`vk2dRendererClear()\`, or \`vk2dRendererEmpty()\`.
- **Camera State Change:** You lock/unlock cameras (\`vk2dRendererLockCameras\` / \`UnlockCameras\`), toggle \`vk2dRendererSetTextureCamera()\`, or enable/disable a camera (\`vk2dCameraSetState\`).
- **End of Frame:** \`vk2dRendererPresent()\` flushes any remaining sprites before submitting the frame.

*(Notice what is **not** on that list: switching textures or changing \`vk2dRendererSetColourMod()\`! Because every \`VK2DDrawCommand\` carries its own \`textureIndex\` and \`colour\` vector, you can draw 2,000 sprites from 500 different PNG files with 2,000 different color tints in **one single draw call**!)*

#### Step 3: Building $4 \\times 4$ Matrices in \`shaders/spritebatch.comp\`

When \`vk2dRendererFlushSpriteBatch()\` runs:
1. It copies \`drawCommandCount\` \`VK2DDrawCommand\` items into the current frame's \`VK2DDescriptorBuffer\` (getting back the GPU buffer and offset for Binding 0).
2. It reserves \`drawCommandCount * sizeof(VK2DDrawInstance)\` bytes in the \`VK2DDescriptorBuffer\` for the compute output (Binding 1 for compute, and Set 3 Binding 3 for the vertex shader).
3. On \`computeCommandBuffer\`, it pushes \`drawCount\` and dispatches enough 64-thread workgroups to cover every sprite in the batch:
\`\`\`c
vkCmdDispatch(computeBuf, (drawCount / 64) + 1, 1, 1);
\`\`\`

In \`shaders/spritebatch.comp\`, thread \`gID = gl_GlobalInvocationID.x\` reads \`drawCommandsIn.draws[gID]\`, builds the $4 \\times 4$ model matrix that scales the sprite and rotates it around \`origin\`, and writes \`drawInstancesOut.draws[gID]\`:
$$M = T(\\text{pos.x} + \\text{origin.x}\\cdot \\text{scale.x},\\; \\text{pos.y} + \\text{origin.y}\\cdot \\text{scale.y}) \\cdot R_z(-\\theta) \\cdot T(-\\text{origin.x}\\cdot \\text{scale.x},\\; -\\text{origin.y}\\cdot \\text{scale.y}) \\cdot S(\\text{scale.x},\\; \\text{scale.y})$$

#### Why \`VK2DDrawInstance\` Contains 12 Bytes of Explicit \`vec3 padding\`

Look closely at \`VK2DDrawInstance\` in \`Structs.h\` vs \`DrawInstance\` in \`spritebatch.comp\` and \`instanced.vert\`:
- In C, after \`vec4 texturePos\` (16B), \`vec4 colour\` (16B), and \`uint32_t textureIndex\` (4B), the current byte offset is **36**.
- In GLSL \`std140\` layout (\`spritebatch.comp\`), every \`vec4\` column of a \`mat4\` **must start at a 16-byte boundary**, so GLSL automatically advances from byte 36 to byte **48** before placing \`mat4 model\`. Meanwhile, \`instanced.vert\` enables \`GL_EXT_scalar_block_layout\`.
- By adding \`vec3 padding;\` (12 bytes) right after \`uint32_t textureIndex\` inside C's \`VK2DDrawInstance\`, the C struct size hits **112 bytes** ($16 + 16 + 4 + 12 + 64$) and \`model\` lands at **exact byte offset 48** across C, \`std140\`, and \`scalar_block_layout\`!

#### Step 4: Drawing Procedural Quads in \`instanced.vert\` & \`instanced.frag\`

Right after queueing the compute dispatch, \`vk2dRendererFlushSpriteBatch()\` binds \`instancedPipe\` on \`commandBuffer\` along with the 4 descriptor sets (\`[0] = UBO\`, \`[1] = samplerSet\`, \`[2] = texArrayDescriptorSet\`, \`[3] = vertexShaderSBOSet\`). Then, for each active 2D camera, it pushes \`cameraIndex\` and records:
\`\`\`c
vkCmdDraw(buf, 6 * gRenderer->drawCommandCount, 1, 0, 0);
\`\`\`

Why \`6 * drawCommandCount\` vertices with \`instanceCount = 1\` and **no vertex buffer**? Look at \`shaders/instanced.vert\`: the shader has a constant 6-vertex unit square (\`vertices[0..5]\`) baked right into its code! Using integer division and modulo on \`gl_VertexIndex\`, the vertex shader knows which sprite (\`instance = gl_VertexIndex / 6\`) and which triangle corner (\`vertexIndex = gl_VertexIndex % 6\`) it is currently drawing:

\`\`\`glsl
int instance = gl_VertexIndex / 6;
int vertexIndex = gl_VertexIndex % 6;
newPos.x = vertices[vertexIndex].x * objectBuffer.objects[instance].texturePos.z;
newPos.y = vertices[vertexIndex].y * objectBuffer.objects[instance].texturePos.w;
gl_Position = ubo.cameras[push.cameraIndex] * objectBuffer.objects[instance].model * vec4(newPos, 1.0, 1.0);
fragTexCoord.x = objectBuffer.objects[instance].texturePos.x + (texCoords[vertexIndex].x * objectBuffer.objects[instance].texturePos.z);
fragTexCoord.y = objectBuffer.objects[instance].texturePos.y + (texCoords[vertexIndex].y * objectBuffer.objects[instance].texturePos.w);
\`\`\`

Finally, \`shaders/instanced.frag\` looks up the sprite's texture inside the global bindless array \`tex[nonuniformEXT(instanceTextureIndex)]\` using pixel coordinates \`fragTexCoord\` and multiplies the pixel color by \`fragColour\`.
`,
    mermaidCharts: [
      {
        title: "Compute-Driven Sprite Batching Dataflow (CPU -> Compute -> Vertex -> Fragment)",
        chart: `
flowchart TD
    classDef cpu fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef comp fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef vert fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef frag fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    DrawCall["vk2dRendererDrawTexture / vk2dRendererAddBatch"]:::cpu
    CmdArr["gRenderer->drawCommands (0..N-1)<br/>VK2DDrawCommand (pos, scale, rot, origin, uv, colour, texID)"]:::cpu
    Staging["DescriptorBuffer CopyData & ReserveSpace<br/>drawCommands (SSBO Binding 0)<br/>drawInstances (SSBO Binding 1 / Vertex Set 3 Binding 3)"]:::cpu
    CompShader["spritebatch.comp (local_size_x = 64)<br/>Builds mat4 model = T(origin) * Rz(-rot) * T(-origin) * S(scale)<br/>Writes DrawInstance Output"]:::comp
    VertShader["instanced.vert (vkCmdDraw 6 * N vertices, 0 VBOs)<br/>instance = gl_VertexIndex / 6, corner = gl_VertexIndex % 6<br/>gl_Position = viewproj * model * pos"]:::vert
    FragShader["instanced.frag<br/>Sample bindless texture array with pixel UVs * colour"]:::frag

    DrawCall --> CmdArr -->|"Flush at 2,284 sprites or state change"| Staging
    Staging --> CompShader --> VertShader --> FragShader
`,
      },
    ],
  },
  {
    id: "vk2d-pipelines-shaders",
    title: "57. Graphics Pipelines, 4 Blend Modes & Runtime Slang Compiler",
    category: "graphics",
    summary:
      "How VK2D pre-builds 4 blend mode variations per pipeline, bakes built-in GLSL shaders into Blobs.h, and compiles custom Slang pixel shaders at runtime with automatic reflection.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/Pipeline.h",
      "extern/Vulkan2d/VK2D/include/VK2D/BlendModes.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Shader.h",
      "extern/Vulkan2d/VK2D/include/VK2D/ShaderCompiler.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Blobs.h",
      "extern/Vulkan2d/VK2D/src/Pipeline.c",
      "extern/Vulkan2d/VK2D/src/Shader.c",
      "extern/Vulkan2d/VK2D/src/ShaderCompiler.cpp",
      "extern/Vulkan2d/shaders/usershader.vert",
    ],
    content: `
### Why Every \`VK2DPipeline\` Holds Four \`VkPipeline\` Handles (\`Pipeline.c\`)

In Vulkan, once a graphics pipeline (\`VkPipeline\`) is created, its color blending formula is locked in. If a game wants to switch from normal alpha blending to additive blending for a glowing fireball, it has to bind a different \`VkPipeline\`.

To make switching blend modes instant, \`vk2dPipelineCreate()\` automatically builds **four \`VkPipeline\` variations** inside every \`VK2DPipeline\` struct (\`pipe->pipes[0..3]\`), using the table in \`VK2D/include/VK2D/BlendModes.h\`:

| Blend Mode (\`VK2DBlendMode\`) | Color Formula | Alpha Formula | What It Is Used For |
| --- | --- | --- | --- |
| \`VK2D_BLEND_MODE_BLEND (0)\` | $C_{\\text{src}} \\alpha_{\\text{src}} + C_{\\text{dst}}(1 - \\alpha_{\\text{src}})$ | $\\alpha_{\\text{src}}^2 + \\alpha_{\\text{dst}}(1 - \\alpha_{\\text{src}})$ | Default mode for almost everything (transparent sprites, shapes, UI). |
| \`VK2D_BLEND_MODE_NONE (1)\` | Overwrites destination ($C_{\\text{src}}$) | Overwrites destination ($\\alpha_{\\text{src}}$) | Wiping a texture to transparent (\`vk2dRendererEmpty\`) or raw pixel copies. |
| \`VK2D_BLEND_MODE_ADD (2)\` | $C_{\\text{src}} \\alpha_{\\text{src}} + C_{\\text{dst}}$ | $\\max(\\alpha_{\\text{src}} \\alpha_{\\text{dst}},\\, \\alpha_{\\text{dst}}^2)$ | Additive lightmaps, torches, lasers, and glowing particles. |
| \`VK2D_BLEND_MODE_SUBTRACT (3)\` | $\\max(C_{\\text{src}} \\alpha_{\\text{dst}},\\, C_{\\text{dst}} \\alpha_{\\text{dst}})$ | $C_{\\text{dst}} \\alpha_{\\text{dst}} - C_{\\text{src}} \\alpha_{\\text{src}}$ | Carving dark shadows out of a light texture (used in \`examples/shadowsglsl\`). |

How does VK2D know if a pipeline or blend mode changed with just one integer check? Every time a \`VK2DPipeline\` is created, it gets a base ID that steps by \`16\` (\`0x10, 0x20, 0x30, ...\`). Calling \`vk2dPipelineGetID(pipe, blendMode)\` returns \`pipe->id + blendMode\`. Because there are only 4 blend modes (\`0..3\`), adding the blend mode into the bottom bits gives every \`(pipeline, blendMode)\` combination a unique ID!

#### The Seven Built-In Pipelines

During startup (\`_vk2dRendererCreatePipelines\`), VK2D builds 6 graphics pipelines and 1 compute pipeline:

| Pipeline Handle | \`VK2DPipelineType\` | Push Constant Struct | Size | What It Draws |
| --- | --- | --- | ---: | --- |
| \`primFillPipe\` | \`DEFAULT (0)\` | \`VK2DPushBuffer\` | 84 B | Filled 2D rectangles, circles, and triangulated polygons. |
| \`primLinePipe\` | \`DEFAULT (0)\` | \`VK2DPushBuffer\` | 84 B | 2D outlines and lines (\`VK_PRIMITIVE_TOPOLOGY_LINE_STRIP\`). |
| \`modelPipe\` | \`3D (1)\` | \`VK2D3DPushBuffer\` | 88 B | Textured 3D \`.obj\` models with depth testing and back-face culling. |
| \`wireframePipe\` | \`3D (1)\` | \`VK2D3DPushBuffer\` | 88 B | 3D wireframe meshes (\`VK_POLYGON_MODE_LINE\`). |
| \`instancedPipe\` | \`INSTANCING (2)\` | \`VK2DInstancedPushBuffer\` | 4 B | All batched 2D sprites (reads \`DrawInstance\` SSBO at Set 3). |
| \`shadowsPipe\` | \`SHADOWS (3)\` | \`VK2DShadowsPushBuffer\` | 100 B | Hardware-accelerated 2D shadow volumes. |
| \`spriteBatchPipe\` | *(Compute)* | \`VK2DComputePushBuffer\` | 4 B | Runs \`spritebatch.comp\` to compute $4 \\times 4$ sprite matrices. |

### Built-In Shaders Compiled into C Arrays (\`shaders/genblobs.py\` $\\to$ \`Blobs.h\`)

You never have to ship a \`shaders/\` folder alongside your game executable for VK2D's built-in pipelines. The Python script \`extern/Vulkan2d/shaders/genblobs.py\` runs \`glslc\` on the GLSL 450 files in \`shaders/\` and converts the compiled SPIR-V binaries into C \`unsigned char[]\` hex arrays inside \`VK2D/include/VK2D/Blobs.h\` (\`VK2DVertColour\`, \`VK2DFragInstanced\`, \`VK2DCompSpritebatch\`, \`VK2DVertUsershader\`, etc.).

### Writing Custom Slang Pixel Shaders (\`Shader.c\` & \`ShaderCompiler.cpp\`)

Want to write a custom pixel shader for water ripples, CRT scanlines, or post-processing? VK2D embeds the **Slang** compiler (\`VK2D/src/ShaderCompiler.cpp\`) so you can load human-readable \`.slang\` files directly via \`vk2dSlangLoad(filename)\` or \`vk2dSlangFrom(sourceString, length)\`! *(If your project does not need custom shaders and you want faster CMake builds, you can pass \`-DVK2D_DISABLE_SHADERS=ON\` to skip building Slang.)*

When you compile a Slang shader in VK2D, you only write the **Pixel (Fragment) Shader** function named \`PixelShader(float2 uv)\`. VK2D automatically pairs your pixel shader with its built-in 6-vertex quad vertex shader (\`shaders/usershader.vert\`, stored in \`VK2DVertUsershader\`).

#### Automatic Shader Reflection & Validation

Before linking your Slang shader into SPIR-V, \`_vk2dShaderCompile()\` inspects your shader's global variables using Slang's reflection API (\`program->getLayout()->getGlobalParamsVarLayout()\`) and checks three required bindings plus one optional uniform block:

1. **Required Push Constants (\`push\`):** Must be named \`push\`, declared as \`[[vk::push_constant]] Push push;\`, and have an exact size of **112 bytes** (matching \`VK2DShaderPushBuffer\`).
2. **Required Sampler (\`sampler\`):** Must be named \`sampler\` and bound at Set 1, Binding 1 (\`[[vk::binding(1, 1)]] SamplerState sampler;\`).
3. **Required Texture Array (\`textures\`):** Must be named \`textures\` and bound at Set 2, Binding 2 (\`[[vk::binding(2, 2)]] Texture2D<float4> textures[];\`).
4. **Optional Custom Uniform Data (\`[[vk::binding(3, 3)]]\`):** If you declare a \`ConstantBuffer<MyData>\` at Set 3, Binding 3, VK2D automatically reads its byte size from Slang reflection (\`userDataSize\`) so you never have to pass \`sizeof(MyData)\` manually!

Here is a complete, ready-to-use Slang shader template (from \`docs/Shaders.md\`):

\`\`\`hlsl
struct Push {
    int cameraIndex;
    uint textureIndex;
    float4 texturePos; // x, y, w, h in pixels
    float4 colour;     // current renderer colourMod
    float4x4 model;
};
[[vk::push_constant]] Push push;

[[vk::binding(1, 1)]] SamplerState sampler;
[[vk::binding(2, 2)]] Texture2D<float4> textures[];

struct UserData {
    float time;
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 texColor = textures[push.textureIndex].Sample(sampler, uv);
    return push.colour * texColor;
}
\`\`\`

*(Alignment Tip: In Slang/Vulkan constant buffers, \`float4\` / \`vec4\` fields align to 16-byte boundaries. If your C struct has a \`float time;\` followed by a \`vec4 colour;\`, remember to put \`float _pad[3];\` between them on the C side so the C struct matches the shader's 16-byte alignment!)*

#### How Custom Shaders Survive MSAA & Swapchain Resets

Every time \`vk2dShaderFrom()\` creates a custom \`VK2DShader\`, VK2D copies both the vertex and fragment SPIR-V bytecode (\`spvVert\`, \`spvFrag\`) and \`uniformSize\` into the shader struct and appends the shader handle to \`gRenderer->customShaders[]\` via \`_vk2dRendererAddShader()\`. If the player toggles MSAA from \`1x\` to \`8x\` mid-game, \`_vk2dRendererResetSwapchain()\` destroys old graphics pipelines, rebuilds \`renderPass\`, and loops over \`gRenderer->customShaders[]\` calling \`_vk2dShaderBuildPipe()\`—instantly rebuilding all 4 blend mode pipelines for your shader from its cached SPIR-V without re-invoking the Slang compiler!
`,
    mermaidCharts: [
      {
        title: "Runtime Slang Compilation, Reflection & Pipeline Registration",
        chart: `
flowchart TD
    classDef slang fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef refl fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef vk fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Src["User Slang Source<br/>Entry Point: PixelShader"]:::slang
    Session["Slang IGlobalSession -> ISession<br/>Target: SLANG_SPIRV (glsl_450)"]:::slang
    Reflect["Global Params Reflection Loop<br/>1. push ConstantBuffer (Push == 112B)<br/>2. sampler SamplerState at (1, 1)<br/>3. textures Texture2D array at (2, 2)<br/>4. Optional ConstantBuffer at (3, 3) -> userDataSize"]:::refl
    Link["program->link() & getEntryPointCode()<br/>Outputs fragmentSpirv + userDataSize"]:::slang
    Build["vk2dShaderFrom(VK2DVertUsershader, fragmentSpirv, userDataSize)<br/>Creates VK2DPipeline (4 Blend Modes)<br/>Registers in gRenderer->customShaders"]:::vk

    Src --> Session --> Reflect --> Link --> Build
`,
      },
    ],
  },
  {
    id: "vk2d-targets-cameras",
    title: "58. Offscreen Render Targets, 3 RenderPasses & 10-Camera UBO System",
    category: "graphics",
    summary:
      "Why VK2D keeps three separate VkRenderPass objects, how switching render targets works mid-frame, how UNIT_VIEW clears textures, and how up to 10 cameras render split-screen or 3D views.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/Camera.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Texture.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Math.h",
      "extern/Vulkan2d/VK2D/src/Camera.c",
      "extern/Vulkan2d/VK2D/src/Renderer.c",
      "extern/Vulkan2d/VK2D/src/RendererMeta.c",
    ],
    content: `
### Why VK2D Needs Three Separate \`VkRenderPass\` Objects (\`RendererMeta.c\`)

In a 2D game, you often start drawing to the screen, switch mid-frame to an offscreen texture (to draw a lightmap or a low-resolution retro canvas), and then switch back to the screen to composite everything together.

In Vulkan, a \`VkRenderPass\` specifies what happens to the pixels of an image at the exact moment the pass begins (\`loadOp\`). If VK2D only had one \`VkRenderPass\` with \`VK_ATTACHMENT_LOAD_OP_CLEAR\`, switching back to the screen after drawing a lightmap would **wipe everything you drew to the screen earlier in the frame**!

To prevent this, \`_vk2dRendererCreateRenderPass()\` creates **three** compatible render passes:

| RenderPass Name | Color \`loadOp\` | Depth \`loadOp\` | What Happens When It Starts |
| --- | --- | --- | --- |
| **1. \`renderPass\`** | \`LOAD_OP_CLEAR\` | \`LOAD_OP_CLEAR\` | Used once at the very start of the frame (\`vk2dRendererStartFrame\`). Wipes the screen backbuffer and depth buffer clean. |
| **2. \`externalTargetRenderPass\`** | \`LOAD_OP_LOAD\` | \`LOAD_OP_CLEAR\` | Used when \`vk2dRendererSetTarget(tex)\` switches to an offscreen texture. **Keeps** whatever pixels were already in that texture from earlier passes or frames! |
| **3. \`midFrameSwapRenderPass\`** | \`LOAD_OP_LOAD\` | \`LOAD_OP_LOAD\` | Used when \`vk2dRendererSetTarget(VK2D_TARGET_SCREEN)\` returns to the screen mid-frame. **Keeps** both the screen colors and depth buffer intact! |

#### Attachment Transition Layouts (1x MSAA vs Multi-Sampled Resolve)

Each of those three render passes changes its attachment count and image layouts automatically based on whether MSAA is enabled (\`config.msaa > 1\`), where Attachment \`0\` is color, Attachment \`1\` is depth, and Attachment \`2\` (MSAA only) is the single-sampled resolve image:

| RenderPass | MSAA Off (2 Attachments) | MSAA On (3 Attachments with Resolve) |
| --- | --- | --- |
| **\`renderPass\`** | Att 0: \`UNDEFINED -> PRESENT_SRC_KHR\`<br/>Att 1: \`UNDEFINED -> DEPTH_STENCIL\` | Att 0 (MSAA): \`UNDEFINED -> COLOR_ATTACHMENT\`<br/>Att 2 (Swapchain Resolve): \`UNDEFINED -> PRESENT_SRC_KHR\` |
| **\`midFrameSwapRenderPass\`** | Att 0: \`PRESENT_SRC_KHR -> PRESENT_SRC_KHR\` (\`LOAD\`)<br/>Att 1: \`DEPTH_STENCIL -> DEPTH_STENCIL\` (\`LOAD\`) | Att 0 (MSAA): \`COLOR_ATTACHMENT -> COLOR_ATTACHMENT\` (\`LOAD\`)<br/>Att 2 (Resolve): \`PRESENT_SRC_KHR -> PRESENT_SRC_KHR\` (\`LOAD\`) |
| **\`externalTargetRenderPass\`** | Att 0 (Tex): \`COLOR_ATTACHMENT -> COLOR_ATTACHMENT\` (\`LOAD\`)<br/>Att 1 (Depth): \`UNDEFINED -> DEPTH_STENCIL\` (\`CLEAR\`) | Att 0 (MSAA): \`COLOR_ATTACHMENT -> COLOR_ATTACHMENT\` (\`LOAD\`)<br/>Att 2 (Tex Resolve): \`COLOR_ATTACHMENT -> COLOR_ATTACHMENT\` (\`LOAD\`) |

### Switching Render Targets Mid-Frame (\`vk2dRendererSetTarget\`)

When you create an offscreen render-target texture with \`vk2dTextureCreate(w, h)\`, VK2D allocates:
- \`img\`: The color image (\`VK_FORMAT_B8G8R8A8_SRGB\`), starting in \`VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL\`.
- \`sampledImg\` (if MSAA is enabled) and \`depthBuffer\` (so 3D models can even be drawn into offscreen textures!).
- \`fbo\`: The \`VkFramebuffer\` tying those images together.
- \`ubo\` & \`uboSet\`: A built-in camera UBO matching the texture's $w \\times h$ pixel dimensions.

When you call \`vk2dRendererSetTarget(target)\`:
1. **Flush Sprites:** Calls \`vk2dRendererFlushSpriteBatch()\` so any sprites waiting in the batch are drawn to the old target before leaving it.
2. **Texture-to-Texture Safety:** If you are currently targeting Texture A and call \`vk2dRendererSetTarget(TextureB)\`, VK2D first switches back to \`VK2D_TARGET_SCREEN\` so Texture A gets transitioned back to shader-readable mode cleanly.
3. **End Current Pass & Transition Layout:** Ends the current render pass (\`vkCmdEndRenderPass\`) and records a pipeline image barrier (\`_vk2dTransitionImageLayout\`):
   - If entering a texture target: transitions \`target->img->img\` from \`SHADER_READ_ONLY_OPTIMAL\` to \`COLOR_ATTACHMENT_OPTIMAL\` so the GPU can draw into it.
   - If returning to \`VK2D_TARGET_SCREEN\`: transitions the texture you just finished drawing from \`COLOR_ATTACHMENT_OPTIMAL\` back to \`SHADER_READ_ONLY_OPTIMAL\` so shaders can sample it right away!
4. **Begin New Pass:** Starts \`externalTargetRenderPass\` (for a texture) or \`midFrameSwapRenderPass\` (for the screen) and resets cached pipeline pointers.

#### How \`vk2dRendererClear()\` and \`vk2dRendererEmpty()\` Work Inside a \`LOAD_OP_LOAD\` Pass

Since \`externalTargetRenderPass\` preserves existing texture pixels (\`LOAD_OP_LOAD\`), how do you clear an offscreen texture?
- \`vk2dRendererClear()\`: Draws \`gRenderer->unitSquare\` using \`primFillPipe\` with \`cameraIndex = VK2D_INVALID_CAMERA (-1)\`. Look at \`shaders/colour.vert\`: when \`cameraIndex == -1\`, the vertex shader ignores the camera UBO and multiplies the $[0, 1]^2$ unit square by a constant matrix \`UNIT_VIEW\` that stretches $[0, 1]^2$ across the entire $[-1, 1]^2$ screen clip space, filling every pixel with the current \`colourMod\`!
- \`vk2dRendererEmpty()\`: Saves your current blend mode and color mod, sets the color to \`{0, 0, 0, 0}\` and the blend mode to \`VK2D_BLEND_MODE_NONE\` (which overwrites destination alpha with \`0\`), calls \`vk2dRendererClear()\`, and restores your previous settings. *(Important: Always call \`vk2dRendererEmpty()\` or \`vk2dRendererClear()\` the first time you bind a freshly created \`vk2dTextureCreate\` target before sampling it!)*

### The 10-Camera System: World Lens vs Screen Viewport (\`Camera.c\`)

VK2D can keep up to \`VK2D_MAX_CAMERAS = 10\` cameras active at the same time (\`gRenderer->cameras[0..9]\`). Camera \`0\` (\`VK2D_DEFAULT_CAMERA\`) always exists and matches the window size. You can create up to 9 extra cameras with \`vk2dCameraCreate(spec)\` for scrolling worlds, split-screen multiplayer (\`examples/splitscreen\`), minimaps, or 3D model overlays (\`examples/retrolook\`).

Every \`VK2DCameraSpec\` separates **what the camera sees in the world** from **where that view appears on the window**:
- **World Lens (\`x, y, w, h, zoom, rot\`):** \`(x, y)\` is the top-left world coordinate seen by the camera; \`(w, h)\` is the virtual width and height in world pixels; \`zoom\` magnifies the view ($w / \\text{zoom},\\, h / \\text{zoom}$); and \`rot\` rotates the camera in radians.
- **Window Viewport (\`xOnScreen, yOnScreen, wOnScreen, hOnScreen\`):** Controls the hardware \`VkViewport\` and \`VkRect2D\` scissor rectangle on the actual window where this camera is drawn. For example, a $256 \\times 224$ retro camera (\`w = 256, h = 224\`) with \`wOnScreen = 768, hOnScreen = 672\` automatically scales up $3\\times$ to fill the window!

#### Why Camera Position Updates Apply at the End of the Frame

All 10 camera matrices live in one 640-byte uniform buffer (\`struct VK2DUniformBufferObject { mat4 viewproj[10]; }\`). When you record draw calls during the frame, shaders only receive the integer \`cameraIndex\` via push constants. Right before the frame is submitted in \`vk2dRendererEndFrame()\`, VK2D loops through all active cameras, builds their view-projection matrices in \`gRenderer->workingUBO\`, and flushes \`workingUBO\` into the \`VK2DDescriptorBuffer\`:
\`\`\`c
for (int i = 0; i < VK2D_MAX_CAMERAS; i++)
  if (gRenderer->cameras[i].state == VK2D_CAMERA_STATE_NORMAL)
    _vk2dCameraUpdateUBO(&gRenderer->workingUBO, &gRenderer->cameras[i].spec, i);
_vk2dRendererFlushUBOBuffers();
\`\`\`
Because the UBO is flushed at the end of the frame and copied on \`dbCommandBuffer\` before \`commandBuffer\` runs, **updating a camera's \`x, y, zoom\` with \`vk2dCameraUpdate()\` at any point in the frame updates the view for the entire frame**.

By contrast, **camera states and locks take effect immediately mid-frame** (because they flush the current sprite batch):
- By default, every 2D draw call loops through all enabled 2D cameras and draws once into each camera's viewport.
- Calling \`vk2dRendererLockCameras(camIndex)\` tells VK2D to draw **only** to \`camIndex\` (for example, locking to \`VK2D_DEFAULT_CAMERA\` when drawing your HUD overlay so the HUD does not get drawn four times inside a 4-player split-screen!). Calling \`vk2dRendererUnlockCameras()\` resumes drawing to all active cameras.
- When drawing to an offscreen texture, VK2D uses the texture's own $w \\times h$ pixel space by default unless you call \`vk2dRendererSetTextureCamera(true)\` to make offscreen texture draws use your world cameras.
`,
    mermaidCharts: [
      {
        title: "Mid-Frame Render Target Switching & Layout Transitions",
        chart: `
sequenceDiagram
    autonumber
    participant App as Application
    participant R as Renderer.c
    participant Cmd as commandBuffer (Draw)

    Note over R,Cmd: Currently in renderPass (VK2D_TARGET_SCREEN)
    App->>R: vk2dRendererSetTarget(offscreenTex)
    R->>R: vk2dRendererFlushSpriteBatch()
    R->>Cmd: vkCmdEndRenderPass()
    R->>Cmd: Transition offscreenTex SHADER_READ_ONLY to COLOR_ATTACHMENT
    R->>Cmd: vkCmdBeginRenderPass(externalTargetRenderPass, offscreenFBO)
    R->>R: _vk2dRendererResetBoundPointers()

    App->>R: Draw lights and sprites to offscreenTex
    App->>R: vk2dRendererSetTarget(VK2D_TARGET_SCREEN)
    R->>R: vk2dRendererFlushSpriteBatch()
    R->>Cmd: vkCmdEndRenderPass()
    R->>Cmd: Transition offscreenTex COLOR_ATTACHMENT to SHADER_READ_ONLY
    R->>Cmd: vkCmdBeginRenderPass(midFrameSwapRenderPass, swapchainFBO)
    R->>R: _vk2dRendererResetBoundPointers()
    App->>R: Sample offscreenTex in post-process or sprite batch
`,
      },
    ],
  },
  {
    id: "vk2d-primitives-shadows-gui",
    title: "59. Polygons, 2D Shadow Volumes, 3D Models, Nuklear GUI & Raw Vulkan",
    category: "graphics",
    summary:
      "How VK2D draws shapes without per-frame allocations, extrudes 2D shadow edges on the GPU, loads Wavefront .obj 3D models, chains Nuklear GUI semaphores, and exposes raw Vulkan handles.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/Polygon.h",
      "extern/Vulkan2d/VK2D/include/VK2D/ShadowEnvironment.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Model.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Gui.h",
      "extern/Vulkan2d/VK2D/include/VK2D/VulkanInterface.h",
      "extern/Vulkan2d/VK2D/src/Polygon.c",
      "extern/Vulkan2d/VK2D/src/ShadowEnvironment.c",
      "extern/Vulkan2d/VK2D/src/Model.c",
      "extern/Vulkan2d/VK2D/src/Gui.c",
      "extern/Vulkan2d/VK2D/src/VulkanInterface.c",
    ],
    content: `
### Drawing Shapes: Reusable Unit VBOs vs Custom Polygons (\`Polygon.c\`)

VK2D has three ways to draw 2D vector shapes using \`primFillPipe\` (filled triangles) and \`primLinePipe\` (line strips):

1. **Zero-Allocation Unit Shapes (\`_vk2dRendererCreateUnits\`):**
   At startup, VK2D builds five small vertex buffers in VRAM that stay loaded for the life of the program:
   - \`unitSquare\` (6 vertices forming a $1 \\times 1$ square) and \`unitSquareOutline\` (5 vertices forming its border).
   - \`unitCircle\` and \`unitCircleOutline\` (built with \`VK2D_CIRCLE_VERTICES = 72\` vertices in \`Constants.c\` for a smooth circle of radius $0.5$).
   - \`unitLine\` (2 vertices from $(0, 0)$ to $(1, 0)$).
   When you call \`vk2dRendererDrawRectangle()\`, \`vk2dRendererDrawCircle()\`, or \`vk2dRendererDrawLine()\`, VK2D does **not** generate new vertices on the CPU. Instead, it binds the pre-built unit shape and passes a scaling, rotation, and translation matrix in push constants (\`VK2DPushBuffer\`)! For example, \`vk2dRendererDrawLine(x1, y1, x2, y2)\` simply measures the line length $L = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$ and angle $\\theta = \\operatorname{atan2}(y_2-y_1,\\, x_2-x_1)$, and stretches and rotates \`unitLine\` to connect the two points.
2. **Permanent Custom Polygons (\`vk2dPolygonCreate\` & \`vk2dPolygonShapeCreateRaw\`):**
   - If you have a list of \`vec2\` corner points for a convex shape, \`vk2dPolygonCreate(vertices, count)\` automatically turns them into $(N - 2) \\times 3$ triangles using a simple **triangle fan** anchored at \`vertices[0]\` and uploads them into a permanent GPU buffer (\`VK2DPolygon\`).
   - If you want each vertex to have its own custom color gradient, \`vk2dPolygonShapeCreateRaw(vertexData, count)\` uploads your pre-triangulated \`VK2DVertexColour\` array directly.
3. **Immediate-Mode Dynamic Geometry (\`vk2dRendererDrawGeometry\`):**
   If your vertices change every frame, \`vk2dRendererDrawGeometry(vertices, count, ...)\` copies up to \`limits.maxGeometryVertices\` (\`9,141\` vertices for a 256 KB page) directly into the current frame's \`VK2DDescriptorBuffer\` and draws them on the spot without creating a \`VK2DPolygon\` object.

### Hardware-Accelerated 2D Drop Shadows (\`ShadowEnvironment.c\` & \`shadows.vert\`)

Want walls or pillars to cast real-time 2D shadows away from torches or player lights? \`VK2DShadowEnvironment\` does the heavy lifting on the GPU:

1. **Adding Wall Edges on the CPU (\`vk2dShadowEnvironmentAddEdge\`):**
   You create a shadow environment with \`vk2dShadowEnvironmentCreate()\`, optionally group walls into movable objects with \`vk2dShadowEnvironmentAddObject()\`, and trace the outer edges of each wall with \`vk2dShadowEnvironmentAddEdge(se, x1, y1, x2, y2)\`.
   For every wall edge $(x_1, y_1) \\to (x_2, y_2)$, VK2D appends **6 vertices** (two triangles) into its vertex list:
\`\`\`c
vec3 vert[6] = {
    {x2, y2, 0}, // Index 0: Stays on the wall edge
    {x2, y2, 0}, // Index 1: Pushed away from light by shadows.vert!
    {x1, y1, 0}, // Index 2: Stays on the wall edge
    {x1, y1, 0}, // Index 3: Stays on the wall edge
    {x1, y1, 0}, // Index 4: Pushed away from light by shadows.vert!
    {x2, y2, 0}, // Index 5: Pushed away from light by shadows.vert!
};
\`\`\`
Once all edges are added, calling \`vk2dShadowEnvironmentFlushVBO(se)\` uploads the whole list into a single GPU vertex buffer (\`se->vbo\`). Even if a wall object moves or rotates every frame, you **never** have to rebuild the VBO: just call \`vk2dShadowEnvironmentObjectUpdate(se, obj, x, y, scaleX, scaleY, rot, ox, oy)\` to update that object's $4 \\times 4$ model matrix!
2. **Extruding Shadow Quads on the GPU (\`shaders/shadows.vert\`):**
   When you call \`vk2dRendererDrawShadows(se, colour, lightSource)\`, VK2D binds \`shadowsPipe\` and pushes the object's \`model\` matrix and the light's \`(x, y)\` position. Inside \`shaders/shadows.vert\`, the vertex shader checks \`gl_VertexIndex % 6\`. Vertices \`0, 2, 3\` stay anchored on the wall segment, while vertices \`1, 4, 5\` are flung $1{,}000\\times$ outward along the ray from \`lightSource\` through the wall corner:
\`\`\`glsl
int mod = gl_VertexIndex % 6;
vec4 position = pushBuffer.model * vec4(inPosition, 1.0);
if (mod == 1 || mod == 4 || mod == 5) {
    vec4 vertex = vec4(
        (position.x - pushBuffer.lightSource.x) * 1000,
        (position.y - pushBuffer.lightSource.y) * 1000,
        1.0, 0.0);
    gl_Position = ubo.viewproj[pushBuffer.cameraIndex] * vertex;
} else {
    gl_Position = ubo.viewproj[pushBuffer.cameraIndex] * position;
}
\`\`\`
That stretches the 6 vertices from a flat line segment into a long shadow quad covering everything behind the wall!

### 3D Wavefront \`.obj\` Models (\`Model.c\`)

While VK2D is built for 2D games, it includes a depth-buffered 3D mesh pipeline (\`modelPipe\` and \`wireframePipe\`) so you can drop rotating 3D save crystals, items, or background props into a 2D game (just like *Castlevania: Symphony of the Night*).
- \`vk2dModelLoad(objFile, texture)\` parses \`.obj\` files using embedded \`tinyobj_loader_c.h\`, automatically triangulates faces, flips the vertical UV coordinate (\`1 - v\`) to match Vulkan texture space, merges duplicate vertices, and uploads both the \`VK2DVertex3D\` vertices and 16-bit indices into a single GPU buffer via \`vk2dBufferLoad2()\`.
- Remember: \`vk2dRendererDrawModel()\` only draws to cameras whose \`type\` is set to \`VK2D_CAMERA_TYPE_PERSPECTIVE\` or \`VK2D_CAMERA_TYPE_ORTHOGRAPHIC\`!

### Built-In Nuklear GUI & Semaphore Chaining (\`Gui.c\` & \`nuklear.c\`)

If you set \`options.enableNuklear = true\` at startup, VK2D initializes an embedded **Nuklear** immediate-mode GUI context (\`vk2dGuiContext()\`). In your event loop, wrap \`SDL_PollEvent(&e)\` between \`vk2dGuiStartInput()\`, \`vk2dGuiProcessEvent(&e)\`, and \`vk2dGuiEndInput()\`, then build your debug windows with standard \`nk_begin()\` / \`nk_end()\` calls.

Inside \`VK2D/src/nuklear.c\`, Nuklear maintains its own dedicated Vulkan resources (\`struct nk_sdl_device\`):
- **Per-Swapchain-Image Mapped Buffers:** Allocates a \`512 KB\` vertex buffer (\`MAX_VERTEX_BUFFER\`), \`128 KB\` 16-bit index buffer (\`MAX_ELEMENT_BUFFER\`), and \`64-byte\` orthographic projection UBO per swapchain image, keeping them persistently mapped (\`mapped_vertexs\`, \`mapped_indexs\`, \`mapped_uniforms\`) so \`nk_convert()\` writes UI triangles straight into host-visible memory each frame.
- **Font Atlas & up to 256 UI Textures:** Bakes a default 16 px font into a \`VK_FORMAT_R8G8B8A8_UNORM\` \`VkImage\` (\`font_image\`) and caches up to \`NK_SDL_MAX_TEXTURES = 256\` combined image sampler descriptor sets (\`texture_descriptor_sets\`).
- **Automatic SDL3 Clipboard Integration:** Hooks \`nk_sdl_clipboard_copy\` and \`nk_sdl_clipboard_paste\` directly to \`SDL_SetClipboardText()\` and \`SDL_GetClipboardText()\` so copy-pasting into Nuklear text boxes works out of the box.

How does Nuklear draw on top of your game without clashing with VK2D's command buffers? At the end of \`vk2dRendererEndFrame()\`:
1. VK2D submits its own 3 command buffers to \`ld->queue\`, which signal \`renderFinishedSemaphores[scImageIndex]\` when done.
2. VK2D then calls \`nk_sdl_render(..., renderFinishedSemaphores[scImageIndex])\`, which tells Nuklear's Vulkan command buffer to **wait** for VK2D's rendering to finish before drawing the GUI, and returns a new semaphore (\`nkSemaphore\`).
3. Finally, \`vkQueuePresentKHR\` waits on \`nkSemaphore\` before showing the frame on screen!

### Direct Vulkan Escape Hatch (\`VulkanInterface.h\`)

If you ever want to write raw Vulkan commands alongside VK2D, \`VK2D/include/VK2D/VulkanInterface.h\` gives you safe access to the active internals:
- \`vk2dVulkanGetDrawBuffer()\`, \`vk2dVulkanGetComputeBuffer()\`, \`vk2dVulkanGetCopyBuffer()\`: Returns the active command buffers for this frame and automatically calls \`_vk2dRendererResetBoundPointers()\` so VK2D knows to rebind its own pipelines on the next VK2D draw call.
- \`vk2dVulkanCopyDataIntoBuffer(data, size, &outBuffer, &bufferOffset)\`: Uploads custom per-frame data through the current frame's \`VK2DDescriptorBuffer\`.
- \`vk2dVulkanGetDevice()\`, \`vk2dVulkanGetPhysicalDevice()\`, \`vk2dVulkanGetQueue()\`, \`vk2dVulkanGetVMA()\`: Returns the underlying Vulkan and VMA handles.
`,
    mermaidCharts: [
      {
        title: "2D Shadow Volume Edge Extrusion & Nuklear Present Chain",
        chart: `
flowchart LR
    classDef shadow fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef queue fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gui fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    subgraph Shadow_Pipeline ["2D Shadow Volume Extrusion"]
        Edge["vk2dShadowEnvironmentAddEdge(x1,y1, x2,y2)<br/>Emits 6 vec3 vertices per segment"]:::shadow
        Vert["shadows.vert<br/>mod in (0,2,3): Static World Pos<br/>mod in (1,4,5): (pos - lightSource) * 1000"]:::shadow
        Edge --> Vert
    end

    subgraph Present_Chain ["EndFrame Queue & Nuklear Semaphore Handoff"]
        Sub["vkQueueSubmit(db, compute, draw)<br/>Signals renderFinishedSemaphores"]:::queue
        NK["nk_sdl_render(...)<br/>Waits on renderFinishedSemaphores<br/>Signals nkSemaphore"]:::gui
        Pres["vkQueuePresentKHR<br/>Waits on nkSemaphore (or renderFinished)"]:::queue
        Sub --> NK --> Pres
    end
`,
      },
    ],
  },
  {
    id: "vk2d-validation-logging-utils",
    title: "60. Error Handling, Thread-Safe Logger, Initializers & Utilities",
    category: "graphics",
    summary:
      "How VK2D reports recoverable vs fatal errors (Validation.c), formats thread-safe logs and custom logger callbacks (Logger.c), zero-initializes Vulkan structs (Initializers.c), and implements hybrid sleep and LCG random numbers (Util.c).",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/Validation.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Logger.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Util.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Initializers.h",
      "extern/Vulkan2d/VK2D/src/Validation.c",
      "extern/Vulkan2d/VK2D/src/Logger.c",
      "extern/Vulkan2d/VK2D/src/Util.c",
      "extern/Vulkan2d/VK2D/src/Initializers.c",
    ],
    content: `
### Recoverable vs Fatal Status Codes (\`Validation.c\`)

Not every error in a game should crash the program. If a modder types the wrong filename for a sprite (\`vk2dTextureLoad("missing.png")\`), the game can log a warning and keep running. On the other hand, if the GPU driver crashes (\`VK_ERROR_DEVICE_LOST\`) or runs out of VRAM, continuing to record Vulkan commands would segfault.

VK2D tracks errors using a bitmask enum called \`VK2DStatus\` (\`Structs.h\`). Whenever something goes wrong, internal functions call \`vk2dRaise(VK2DStatus status, const char *fmt, ...)\`, which bitwise-ORs the flag into \`gStatus\` and appends the formatted message into a 4,096-byte buffer (\`gLogBuffer\`).

\`vk2dStatusFatal()\` in \`VK2D/src/Validation.c\` separates **non-fatal warnings** from **fatal hardware failures** with a single bitmask check:

\`\`\`c
bool vk2dStatusFatal() {
  return (gStatus & ~(VK2D_STATUS_NONE |
                      VK2D_STATUS_SDL_ERROR |
                      VK2D_STATUS_FILE_NOT_FOUND |
                      VK2D_STATUS_BAD_ASSET |
                      VK2D_STATUS_TOO_MANY_CAMERAS |
                      VK2D_STATUS_BEYOND_LIMIT)) != 0;
}
\`\`\`

| \`VK2DStatus\` Flag | Bit Value | Fatal? | When It Happens |
| --- | --- | --- | --- |
| \`VK2D_STATUS_FILE_NOT_FOUND\` | \`1 << 0\` | No | A texture, model, or shader file could not be opened on disk. |
| \`VK2D_STATUS_BAD_FORMAT\` | \`1 << 1\` | **Yes** | Invalid image bytes, corrupt \`.obj\` file, or shader uniform size not a multiple of 4. |
| \`VK2D_STATUS_TOO_MANY_CAMERAS\` | \`1 << 2\` | No | All 10 camera slots in \`gRenderer->cameras[]\` are already in use. |
| \`VK2D_STATUS_DEVICE_LOST\` | \`1 << 3\` | **Yes** | GPU hang or driver reset (\`VK_ERROR_DEVICE_LOST\`). |
| \`VK2D_STATUS_VULKAN_ERROR\` | \`1 << 4\` | **Yes** | Unrecoverable Vulkan API failure during setup or command submission. |
| \`VK2D_STATUS_OUT_OF_RAM\` | \`1 << 5\` | **Yes** | \`malloc\`, \`calloc\`, or \`realloc\` returned \`NULL\`. |
| \`VK2D_STATUS_OUT_OF_VRAM\` | \`1 << 6\` | **Yes** | VMA or Vulkan ran out of GPU video memory (\`VK_ERROR_OUT_OF_DEVICE_MEMORY\`). |
| \`VK2D_STATUS_RENDERER_NOT_INITIALIZED\` | \`1 << 7\` | **Yes** | Calling VK2D functions before \`vk2dRendererInit()\` or after \`vk2dRendererQuit()\`. |
| \`VK2D_STATUS_SDL_ERROR\` | \`1 << 8\` | No | General SDL3 windowing or event error. |
| \`VK2D_STATUS_BEYOND_LIMIT\` | \`1 << 9\` | No | Requested shader uniform size or texture update region exceeds hardware/image bounds. |
| \`VK2D_STATUS_BAD_ASSET\` | \`1 << 10\` | No | Passing a \`NULL\` texture/polygon/shader pointer to a draw call, or running out of bindless texture slots. |

If \`options.quitOnError\` is \`true\` (the default) and \`vk2dStatusFatal()\` becomes true, \`vk2dRaise()\` logs the message with \`VK2D_LOG_SEVERITY_FATAL\`, which immediately flushes the log file and calls \`abort()\`. If you set \`options.quitOnError = false\`, you can poll \`vk2dStatus()\`, \`vk2dStatusFatal()\`, and \`vk2dStatusMessage()\` in your game loop to display a friendly crash dialog before shutting down! *(Reading \`vk2dStatus()\` or \`vk2dStatusMessage()\` sets \`gResetLog = true\` so the next \`vk2dRaise()\` starts a fresh status mask.)*

### Thread-Safe Logging & Custom Logger Callbacks (\`Logger.c\`)

All console and file logging in VK2D routes through \`VK2D/src/Logger.c\`:
- **Six Severity Levels:** \`debug\`, \`info\`, \`warn\`, \`error\`, \`fatal\`, and \`unknown\`, with convenient \`printf\`-style wrappers (\`vk2dLogInfo(...)\`, \`vk2dLogWarn(...)\`, \`vk2dLogError(...)\`).
- **Zero-Allocation Fast Path:** In \`vk2dLoggerLogv()\`, messages up to **127 characters** are formatted directly into a stack buffer (\`char msgBuf[128]\`) with zero heap allocations; only longer messages allocate a temporary heap buffer.
- **Dual Output (Console + Error File):** Protected by \`SDL_Mutex\`, the default logger (\`VK2DDefaultLogger\`) prints \`info\` and \`debug\` to \`stdout\` and \`warn\`/\`error\`/\`fatal\` to \`stderr\` (when \`stdoutLogging\` is enabled). Regardless of whether console logging is on or off, **every warning, error, and fatal message is also written with a timestamp to \`errorFile\`** (\`vk2derror.txt\`), preceded by the system hardware header (\`vk2dHostInformation()\`):
\`\`\`text
Windows, SDL 3.x.x | Host: 16 logical cores, 31.92gb RAM | Device: NVIDIA GeForce RTX ..., Vulkan 1.3.x, Vulkan2D 0.8.0
\`\`\`
- **Custom Logger Hook (\`vk2dSetLogger\`):** Want VK2D logs to appear inside your own game engine's log file or on-screen console? Fill out a \`VK2DLogger\` struct (\`log\`, \`destroy\`, \`severityFn\`, \`context\`) and pass it to \`vk2dSetLogger(&myLogger)\`—even before calling \`vk2dRendererInit()\`!

### Vulkan Struct Initializers (\`Initializers.c\`) & Helpers (\`Util.c\`)

1. **Boilerplate-Free Vulkan Structs (\`Initializers.c\`):**
   Every Vulkan \`vkCreate*\` call requires a large \`Vk*CreateInfo\` struct with a mandatory \`sType\` tag. \`VK2D/src/Initializers.c\` isolates all 38 of these struct builders (\`vk2dInitInstanceCreateInfo\`, \`vk2dInitSwapchainCreateInfoKHR\`, \`vk2dInitGraphicsPipelineCreateInfo\`, \`vk2dInitSamplerCreateInfo\`, etc.), zero-initializing each struct (\`= {0}\`) and setting its exact \`VK_STRUCTURE_TYPE_*\` enum so \`RendererMeta.c\` stays clean and readable.
2. **Hybrid Frame Limiter Sleep (\`vk2dSleep\` in \`Util.c\`):**
   OS sleep functions like \`SDL_Delay(ms)\` only have millisecond granularity and often oversleep by 1 to 2 ms due to OS thread scheduling, causing frame-pacing micro-stutter. \`vk2dSleep(double seconds)\` combines a coarse \`SDL_Delay(floor(seconds * 1000))\` with a sub-millisecond high-precision spin-wait loop using \`SDL_GetPerformanceCounter()\` for the remaining fraction of a millisecond:
\`\`\`c
void vk2dSleep(double seconds) {
  if (seconds <= 0) return;
  double start = SDL_GetPerformanceCounter();
  double milliseconds = floor(seconds * 1000);
  SDL_Delay(milliseconds);
  while ((SDL_GetPerformanceCounter() - start) / (double)SDL_GetPerformanceFrequency() < seconds) {
    volatile int i = 0;
  }
}
\`\`\`
3. **Thread-Safe Atomic LCG Random Number Generator (\`vk2dRandom\`):**
   Need a quick random float between \`min\` and \`max\` for particle spread or light colors? \`vk2dRandom(float min, float max)\` in \`Renderer.c\` updates a global \`SDL_AtomicInt gRNG\` (seeded with \`time(0)\` at startup) using the classic linear congruential generator ($r \\leftarrow (1103515245 \\cdot r + 12345) \\bmod 2^{31}$) and maps it across 5,000 steps between \`min\` and \`max\`.
4. **Color Conversion Helpers (\`vk2dColourHex\`, \`vk2dColourInt\`, \`vk2dColourRGBA\`):**
   Converts CSS-style hex strings (\`"#59d9d7"\`), 32-bit packed RGBA integers (\`0xFF8000FF\`), or \`0..255\` byte tuples into normalized \`vec4\` floats (\`0.0f .. 1.0f\`).
`,
    mermaidCharts: [
      {
        title: "Error Raising, Severity Routing & Log Sinks (Validation.c -> Logger.c)",
        chart: `
flowchart TD
    classDef fnCall fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef check fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef sink fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Raise["vk2dRaise(status, fmt, ...)<br/>gStatus |= status<br/>Appends to gLogBuffer (4096 B)"]:::fnCall
    FatalCheck{"quitOnError && vk2dStatusFatal()?"}:::check
    SevFatal["Severity = VK2D_LOG_SEVERITY_FATAL"]:::check
    SevErr["Severity = VK2D_LOG_SEVERITY_ERROR"]:::check
    Logger["vk2dLoggerLogv (Stack Buf up to 127 chars)<br/>Routes to gLogger->log()"]:::fnCall
    Stdout["Console stdout / stderr<br/>(if stdoutLogging == true)"]:::sink
    ErrFile["errorFile (vk2derror.txt)<br/>Always records WARN, ERROR & FATAL"]:::sink
    Abort["abort() if FATAL"]:::sink

    Raise --> FatalCheck
    FatalCheck -->|Yes| SevFatal --> Logger
    FatalCheck -->|No| SevErr --> Logger
    Logger --> Stdout
    Logger --> ErrFile
    ErrFile --> Abort
`,
      },
    ],
  },
  {
    id: "vk2d-examples-cookbook",
    title: "61. Practical Vulkan2D Cookbook & Sample Walkthroughs",
    category: "graphics",
    summary:
      "Step-by-step code walkthroughs of real VK2D patterns from extern/Vulkan2d/examples/: integer-scaled retro pixel canvases, multi-light subtractive 2D shadows, 4-player split-screen cameras, dynamic texture streaming, and bitmap font overlays.",
    sourceFiles: [
      "extern/Vulkan2d/examples/main/main.c",
      "extern/Vulkan2d/examples/retrolook/main.c",
      "extern/Vulkan2d/examples/shadowsglsl/main.c",
      "extern/Vulkan2d/examples/splitscreen/main.c",
      "extern/Vulkan2d/examples/gui/main.c",
      "extern/Vulkan2d/examples/testing/main.c",
      "extern/Vulkan2d/examples/debug.c",
    ],
    content: `
### Recipe 1: Integer-Scaled Retro Pixel Canvas (\`examples/retrolook/main.c\`)

Many pixel-art games want to render at a fixed low resolution (like $256 \\times 224$ or $480 \\times 270$) and scale up cleanly to whatever window size the player chooses with nearest-neighbor filtering (\`VK2D_FILTER_TYPE_NEAREST\`).

\`examples/retrolook/main.c\` shows the exact 4-step pattern:
1. Create an offscreen render-target texture at your virtual resolution: \`VK2DTexture texTarget = vk2dTextureCreate(256, 224);\`.
2. At the start of your draw loop, bind \`texTarget\` and clear it:
\`\`\`c
vk2dRendererSetTarget(texTarget);
vk2dRendererSetColourMod(clear);
vk2dRendererClear();
vk2dRendererSetColourMod(VK2D_DEFAULT_COLOUR_MOD);
\`\`\`
3. Draw your entire game world (sprites, tilemaps, particles, or even 3D models if \`vk2dRendererSetTextureCamera(true)\` is enabled) into \`texTarget\`.
4. Switch back to \`VK2D_TARGET_SCREEN\`, lock to \`VK2D_DEFAULT_CAMERA\`, compute the integer scale factor, and draw \`texTarget\` centered in the window:
\`\`\`c
vk2dRendererSetTarget(VK2D_TARGET_SCREEN);
float scale = minf(floorf(windowW / 256.0f), floorf(windowH / 224.0f));
float xOnWindow = (windowW - (256.0f * scale)) / 2.0f;
float yOnWindow = (windowH - (224.0f * scale)) / 2.0f;
vk2dRendererLockCameras(VK2D_DEFAULT_CAMERA);
vk2dDrawTextureExt(texTarget, xOnWindow, yOnWindow, scale, scale, 0, 0, 0);
\`\`\`

### Recipe 2: Multi-Light 2D Shadows Using Subtractive Blending (\`examples/shadowsglsl/main.c\`)

How do you combine \`VK2DShadowEnvironment\` with multiple colored point lights so each light casts its own independent shadows across the room? \`examples/shadowsglsl/main.c\` demonstrates this using a reusable offscreen light texture (\`lightTex\`) and \`VK2D_BLEND_MODE_SUBTRACT\`:

1. **Setup Once:** Create your wall polygons, trace their edges into a \`VK2DShadowEnvironment\` with \`vk2dShadowEnvironmentAddEdge()\`, and upload the shadow VBO once via \`vk2dShadowEnvironmentFlushVBO(shadows)\`. Create one offscreen texture \`lightTex = vk2dTextureCreate(400, 300)\`.
2. **Per-Light Loop Every Frame:** For each point light \`i\`:
   - Switch target to \`lightTex\` and wipe it to transparent with \`vk2dRendererEmpty()\`.
   - Draw the radial light orb sprite centered at \`lights[i].pos\` tinted with \`lights[i].colour\`.
   - Switch blend mode to **subtractive** (\`VK2D_BLEND_MODE_SUBTRACT\`) and call \`vk2dRendererDrawShadows(shadows, VK2D_BLACK, lights[i].pos)\`. Because \`VK2D_BLEND_MODE_SUBTRACT\` subtracts the shadow's alpha from the destination alpha (\`VK_BLEND_OP_REVERSE_SUBTRACT\`), this **erases** the light orb's alpha everywhere behind the walls!
   - Restore \`VK2D_BLEND_MODE_BLEND\`, switch back to \`VK2D_TARGET_SCREEN\`, and draw \`lightTex\` onto the screen!
3. Finally, draw your wall polygons and player sprites on top of the accumulated lights.

\`\`\`c
for (int i = 0; i < lightCount; i++) {
  vk2dRendererSetTarget(lightTex);
  vk2dRendererEmpty(); // Clear to {0, 0, 0, 0}

  vk2dRendererSetColourMod(lights[i].colour);
  vk2dDrawTexture(lightOrbTex,
                  lights[i].pos[0] - vk2dTextureWidth(lightOrbTex) / 2,
                  lights[i].pos[1] - vk2dTextureHeight(lightOrbTex) / 2);
  vk2dRendererSetColourMod(VK2D_DEFAULT_COLOUR_MOD);

  // Carve shadows out of this light's alpha channel!
  vk2dRendererSetBlendMode(VK2D_BLEND_MODE_SUBTRACT);
  vk2dRendererDrawShadows(shadows, VK2D_BLACK, lights[i].pos);
  vk2dRendererSetBlendMode(VK2D_BLEND_MODE_BLEND);

  vk2dRendererSetTarget(VK2D_TARGET_SCREEN);
  vk2dDrawTexture(lightTex, 0, 0);
}
\`\`\`

### Recipe 3: Four-Quadrant Split-Screen + UI Overlay (\`examples/splitscreen/main.c\`)

Because VK2D automatically loops over all enabled 2D cameras on every draw call, setting up a 4-player split-screen takes almost no extra drawing code:

1. Create 4 cameras with \`vk2dCameraCreate()\`, setting their \`xOnScreen, yOnScreen, wOnScreen, hOnScreen\` to the 4 quadrants of the window (top-left, top-right, bottom-left, bottom-right), each with its own independent world \`x, y, zoom, rot\`.
2. Before drawing the game world, temporarily disable the full-window default camera so the world is only drawn into the 4 split-screen quadrants:
\`\`\`c
vk2dCameraSetState(VK2D_DEFAULT_CAMERA, VK2D_CAMERA_STATE_DISABLED);
// Draw your world once — VK2D automatically renders it into all 4 quadrant cameras!
vk2dDrawPolygon(testPoly, 0, 0);
vk2dDrawTextureExt(texCaveguy, x, y, 10, 10, time, 8, 8);
vk2dCameraSetState(VK2D_DEFAULT_CAMERA, VK2D_CAMERA_STATE_NORMAL);
\`\`\`
3. To draw screen-space UI borders and HUD text across the whole window without repeating them in each quadrant, lock the renderer to \`VK2D_DEFAULT_CAMERA\`:
\`\`\`c
vk2dRendererLockCameras(VK2D_DEFAULT_CAMERA);
// Draw screen-space UI / borders / debug overlay here
vk2dRendererUnlockCameras();
\`\`\`

### Recipe 4: Sprite-Sheet Bitmap Font & Telemetry Overlay (\`examples/debug.c\`)

All the example programs include \`examples/debug.c\`, which shows how to render a bitmap font sprite sheet (\`assets/font.png\`, a 128-pixel-wide grid of $8 \\times 16$ ASCII characters) and display live frame time and VRAM telemetry:
- Each ASCII character \`c = text[i]\` is sliced from the texture atlas at pixel coordinates:
  $$x_{\\text{tex}} = (c \\times 8) \\bmod 128, \\qquad y_{\\text{tex}} = \\lfloor c / 16 \\rfloor \\times 16$$
  and drawn with \`vk2dRendererDrawTexture(gDebugFont, x, y, 2, 2, 0, 0, 0, xTex, yTex, 8, 16)\`.
- Because every character uses the same \`gDebugFont\` texture, drawing a 100-character string simply appends 100 \`VK2DDrawCommand\` structs into the current sprite batch and renders the entire paragraph in **one instanced GPU draw call**!
- Always remember the golden shutdown rule shown at the bottom of every example: **call \`vk2dRendererWait()\` before freeing any textures, polygons, models, or shaders** so the GPU finishes its last submitted command buffer before VMA destroys the underlying buffers!

### Recipe 5: CMake Integration & Build Flags (\`extern/Vulkan2d/CMakeLists.txt\`)

Adding \`extern/Vulkan2d\` to a C or C++ project only requires \`add_subdirectory\` and linking against \`Vulkan2D\`. Four CMake options in \`extern/Vulkan2d/CMakeLists.txt\` let you tailor the build:

| CMake Option | Default | What It Controls |
| --- | --- | --- |
| \`VK2D_BUILD_SDL\` | \`ON\` | Builds the bundled \`extern/SDL\` (SDL3) submodule automatically. Set to \`OFF\` if your project already provides an \`SDL3\` target. |
| \`VK2D_DISABLE_SHADERS\` | \`OFF\` | When set to \`ON\`, defines \`DISABLE_SHADER_COMPILATION\` and skips building the embedded \`extern/slang\` compiler for much faster CMake build times if you only need built-in pipelines or pre-compiled SPIR-V. |
| \`VK2D_DISABLE_VECS\` | \`OFF\` | Defines \`VK2D_DISABLE_VECTOR_TYPES\` so \`Structs.h\` does not typedef \`vec2\`, \`vec3\`, \`vec4\`, and \`mat4\` (helpful if you already use \`cglm\` or another math library with those type names). |
| \`VK2D_BUILD_EXAMPLES\` | \`OFF\` | Builds all 6 sample executables under \`examples/\` (\`main\`, \`gui\`, \`retrolook\`, \`shadowsglsl\`, \`splitscreen\`, \`testing\`). |
`,
    mermaidCharts: [
      {
        title: "Subtractive 2D Shadow & Multi-Light Composition Loop (examples/shadowsglsl)",
        chart: `
flowchart LR
    classDef pass1 fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef pass2 fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef pass3 fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Empty["1. vk2dRendererSetTarget(lightTex)<br/>vk2dRendererEmpty() -> RGBA (0,0,0,0)"]:::pass1
    Orb["2. Draw Colored Light Orb<br/>(VK2D_BLEND_MODE_BLEND)"]:::pass1
    Sub["3. vk2dRendererSetBlendMode(SUBTRACT)<br/>vk2dRendererDrawShadows(shadows, lightPos)<br/>Carves alpha = 0 behind wall edges"]:::pass2
    Comp["4. vk2dRendererSetTarget(SCREEN)<br/>Draw lightTex over scene<br/>Repeat for each Light (0..7)"]:::pass3

    Empty --> Orb --> Sub --> Comp
`,
      },
    ],
  },
  {
    id: "vk2d-math-matrices",
    title: "62. Math.h Matrix Engine, Clip Space & Coordinate Transforms",
    category: "graphics",
    summary:
      "How VK2D's standalone Math.h builds 2D and 3D view, orthographic, and perspective matrices for Vulkan's Y-down and [0, 1] depth clip space, plus pivot rotation math.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/Math.h",
      "extern/Vulkan2d/VK2D/src/RendererMeta.c",
      "extern/Vulkan2d/shaders/spritebatch.comp",
      "extern/Vulkan2d/shaders/colour.vert",
    ],
    content: `
### Why VK2D Includes Its Own \`Math.h\` Instead of CGLM

Many C graphics projects use \`cglm\` (an OpenGL-focused math library). However, **Vulkan's clip space is different from OpenGL's clip space in two big ways**:
1. **Flipped $Y$-Axis:** In OpenGL, clip-space $Y = -1$ is the bottom of the screen and $Y = +1$ is the top. In Vulkan, $Y = -1$ is the **top** of the screen and $Y = +1$ is the **bottom**!
2. **Half-Range Depth ($Z \\in [0, 1]$):** OpenGL maps near-to-far depth into $[-1, +1]$, whereas Vulkan maps near-to-far depth into $[0, 1]$.

To avoid fighting OpenGL matrix conventions, \`VK2D/include/VK2D/Math.h\` embeds a clean, self-contained 247-line vector and $4 \\times 4$ matrix library (originally written by Ali Emre Gülcü under the MIT license) tailored specifically for Vulkan's coordinate system.

### Vector Operations & $4 \\times 4$ Matrix Layout (\`Math.h\`)

VK2D defines four basic float array types in \`Structs.h\` (unless disabled via \`VK2D_DISABLE_VECTOR_TYPES\`):
\`\`\`c
typedef float vec2[2];
typedef float vec3[3];
typedef float vec4[4];
typedef float mat4[16];
\`\`\`

In \`Math.h\`, a \`mat4\` is a flat 16-element float array where the translation components $(t_x, t_y, t_z)$ live in indices \`m[12]\`, \`m[13]\`, and \`m[14]\` (the fourth 4-float column vector in GLSL column-major memory layout):
- \`identityMatrix(m)\`: Sets the main diagonal \`m[0] = m[5] = m[10] = m[15] = 1.0f\`.
- \`normalize(v)\`: Computes $L = \\sqrt{v_0^2 + v_1^2 + v_2^2}$ and divides $v$ by $L$ if $L > \\epsilon$ ($\\epsilon = 0.0009765625 = 2^{-10}$).
- \`dot(a, b)\` and \`cross(a, b, c)\`: Standard 3D dot product and cross product.
- \`scaleMatrix(m, v)\` and \`translateMatrix(m, v)\`: Pre-multiplies matrix \`m\` by a $4 \\times 4$ scale or translation matrix \`k\` (\`multiplyMatrix(k, m, t)\`).
- \`rotateMatrix(m, w, r)\`: Normalizes rotation axis \`w\` and applies **Rodrigues' 3D axis-angle rotation formula** for angle \`r\` (in radians):
  $$R(\\mathbf{w}, r) = \\begin{bmatrix} x^2(1-c)+c & xy(1-c)+sz & xz(1-c)-sy & 0 \\\\ xy(1-c)-sz & y^2(1-c)+c & yz(1-c)+sx & 0 \\\\ xz(1-c)+sy & yz(1-c)-sx & z^2(1-c)+c & 0 \\\\ 0 & 0 & 0 & 1 \\end{bmatrix}$$
  where $s = \\sin(r)$ and $c = \\cos(r)$.

### How 2D and 3D Cameras Build Their View-Projection Matrix (\`_vk2dCameraUpdateUBO\`)

At the end of every frame, \`_vk2dCameraUpdateUBO()\` in \`RendererMeta.c\` builds \`ubo->viewproj[index]\` by multiplying a **View Matrix** (\`cameraMatrix\`) and a **Projection Matrix** (\`orthographicMatrix\` or \`perspectiveMatrix\`):

#### 1. Look-At View Matrix (\`cameraMatrix\`)

Given camera position \`eye\`, target point \`cent\`, and up vector \`top\`, \`cameraMatrix(m, eye, cent, top)\` computes three orthonormal basis vectors:
- Forward: $\\mathbf{f} = \\operatorname{normalize}(\\text{cent} - \\text{eye})$
- Left: $\\mathbf{l} = \\operatorname{normalize}(\\mathbf{f} \\times \\text{top})$
- True Up: $\\mathbf{u} = \\mathbf{l} \\times \\mathbf{f}$

For a **2D Default Camera** (\`VK2D_CAMERA_TYPE_DEFAULT\`) with top-left world position $(x, y)$, virtual size $(w, h)$, and rotation angle \`rot\`, \`_vk2dCameraUpdateUBO()\` places the camera eye at the center of the screen at $z = -2$ looking straight toward $z = 0$:
\`\`\`c
vec3 eyes   = {camera->x + (camera->w * 0.5f), camera->y + (camera->h * 0.5f), -2.0f};
vec3 center = {eyes[0], eyes[1], 0.0f};
vec3 up     = {sin(-camera->rot), -cos(-camera->rot), 0.0f};
cameraMatrix(view, eyes, center, up);
\`\`\`

#### 2. Vulkan Orthographic & Perspective Projection Matrices

Look at \`orthographicMatrix(m, h, r, n, f)\` and \`perspectiveMatrix(m, fov, asp, n, f)\` in \`Math.h\`, where \`h\` is the zoomed height ($h / \\text{zoom}$), \`r\` / \`asp\` is the aspect ratio ($w / h$), \`n = 0.1\` is the near plane, and \`f = 10.0\` is the far plane:

$$P_{\\text{ortho}} = \\begin{bmatrix} \\frac{2}{h \\cdot r} & 0 & 0 & 0 \\\\ 0 & -\\frac{2}{h} & 0 & 0 \\\\ 0 & 0 & \\frac{1}{n - f} & 0 \\\\ 0 & 0 & \\frac{n}{n - f} & 1 \\end{bmatrix}, \\qquad P_{\\text{persp}} = \\begin{bmatrix} \\frac{1}{\\tan(\\text{fov}/2) \\cdot \\text{asp}} & 0 & 0 & 0 \\\\ 0 & -\\frac{1}{\\tan(\\text{fov}/2)} & 0 & 0 \\\\ 0 & 0 & \\frac{f}{n - f} & -1 \\\\ 0 & 0 & \\frac{n \\cdot f}{n - f} & 0 \\end{bmatrix}$$

Notice two key details in both matrices:
- The second diagonal entry (\`m[5]\`) is **negative** ($-2/h$ and $-1/\\tan(\\text{fov}/2)$) to match Vulkan's top-down clip space.
- The third row maps $z = n$ to $0$ and $z = f$ to $1$, matching Vulkan's $[0, 1]$ depth buffer range!

### Pivot-Point Rotation Math (CPU vs GPU Compute)

When you rotate a 2D sprite or shape around a local pivot point \`(originX, originY)\` with scale \`(xscale, yscale)\` at world position \`(x, y)\`, VK2D cannot simply rotate around $(0, 0)$ or the sprite would orbit around the top-left corner of the world.

Instead, both the CPU draw path (\`_vk2dRendererDrawRaw\` in \`RendererMeta.c\`) and the GPU compute shader (\`shaders/spritebatch.comp\`) perform a **three-step sandwich transform**:
1. Scale the pivot offset by the sprite's scale: $\\text{ox}' = -\\text{originX} \\cdot \\text{xscale}$ and $\\text{oy}' = \\text{originY} \\cdot \\text{yscale}$.
2. Translate to the world pivot point $(x - \\text{ox}',\\, y + \\text{oy}')$, rotate by angle $\\theta$ around the $Z$-axis, and translate back by $(\\text{ox}',\\, -\\text{oy}')$.
3. Multiply by the scaling matrix $(\\text{xscale},\\, \\text{yscale},\\, 1)$.

*(Performance Optimization: In \`_vk2dRendererDrawRaw\` and \`_vk2dRendererDrawRawShader\`, if \`rot == 0\`, VK2D skips the three pivot translation/rotation matrix multiplications completely and performs a single \`translateMatrix\` call! Similarly, if \`xscale == 1 && yscale == 1\`, it skips \`scaleMatrix\`!)*
`,
    mermaidCharts: [
      {
        title: "2D World Space to Vulkan Normalized Device Coordinates (NDC) Pipeline",
        chart: `
flowchart LR
    classDef local fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef world fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef cam fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef ndc fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Local["Local Quad Corner<br/>(0..w, 0..h)"]:::local
    Model["Model Matrix (M)<br/>T(pivot) * Rz(rot) * T(-pivot) * S(scale)"]:::world
    View["Camera View Matrix (V)<br/>eye = (x + w/2, y + h/2, -2)<br/>up = (sin(-rot), -cos(-rot), 0)"]:::cam
    Proj["Orthographic Matrix (P)<br/>Scale (2/w, -2/h), Z in 0..1"]:::cam
    Clip["Vulkan Clip Space (gl_Position)<br/>X in -1..+1, Y in -1 (top) to +1 (bottom), Z in 0..1"]:::ndc

    Local --> Model --> View --> Proj --> Clip
`,
      },
    ],
  },
  {
    id: "vk2d-api-reference",
    title: "63. Complete Vulkan2D Public API Reference & Struct Cheat Sheet",
    category: "graphics",
    summary:
      "A single-page lookup table of every public C function, shorthand drawing macro, push-constant struct layout, and opaque handle across all headers in extern/Vulkan2d/VK2D/include/VK2D/.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/include/VK2D/VK2D.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Renderer.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Structs.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Texture.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Camera.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Polygon.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Shader.h",
      "extern/Vulkan2d/VK2D/include/VK2D/ShadowEnvironment.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Model.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Gui.h",
      "extern/Vulkan2d/VK2D/include/VK2D/Logger.h",
      "extern/Vulkan2d/VK2D/include/VK2D/VulkanInterface.h",
    ],
    content: `
### 1. Renderer Lifecycle, Config & Frame Control (\`Renderer.h\`)

| Function Signature | Summary & Notes |
| --- | --- |
| \`VK2DResult vk2dRendererInit(SDL_Window *window, VK2DRendererConfig config, const VK2DStartupOptions *options)\` | Initializes Vulkan 1.2, VMA, swapchain, pipelines, and starts Frame 1. Pass \`NULL\` for \`options\` to use defaults. |
| \`void vk2dRendererPresent()\` | Ends the current frame (\`vk2dRendererEndFrame\`), submits the 3 command buffers, presents the swapchain, and immediately begins the next frame (\`vk2dRendererStartFrame\`). |
| \`void vk2dRendererWait()\` | Calls \`vkQueueWaitIdle\`. **Must** be called before freeing any textures, polygons, models, or shaders! |
| \`void vk2dRendererQuit()\` | Ends the active frame, waits for the GPU to idle, and frees all internal Vulkan/VMA/Nuklear/Slang resources. |
| \`VK2DRendererConfig vk2dRendererGetConfig()\` | Returns the active (hardware-clamped) MSAA, screen mode, and filter configuration. |
| \`void vk2dRendererSetConfig(VK2DRendererConfig config)\` | Queues a new MSAA or VSync/Immediate/TripleBuffer mode; takes effect on the next swapchain reset at the end of the frame. |
| \`void vk2dRendererResetSwapchain()\` | Manually flags the swapchain to rebuild at the end of the current frame. |
| \`VK2DRendererLimits vk2dRendererGetLimits()\` | Returns host GPU limits (\`maxMSAA\`, \`maxInstancedDraws\`, \`maxShaderBufferSize\`, \`maxGeometryVertices\`, \`supportsVRAMUsage\`, etc.). |
| \`void vk2dRendererGetVRAMUsage(float *inUse, float *total)\` | Queries VMA heap budgets and writes used and total device-local VRAM in **MiB**. |
| \`double vk2dRendererGetAverageFrameTime()\` | Returns the rolling 1-second average frame time in milliseconds ($1000 / \\text{ms}$ = FPS). |
| \`const char *vk2dHostInformation()\` | Returns a formatted string with OS, SDL3 version, CPU core count, system RAM, GPU name, and Vulkan/VK2D versions. |
| \`void vk2dSleep(double seconds)\` | Hybrid \`SDL_Delay\` + high-precision performance-counter spin-wait for exact frame rate limiting. |
| \`double vk2dTime()\` | Returns elapsed time in seconds since \`vk2dRendererInit()\`. |
| \`float vk2dRandom(float min, float max)\` | Thread-safe atomic LCG random float in $[\\text{min}, \\text{max}]$ with $1/5000$ step resolution. |

### 2. Render Targets, Blend Modes, Colors & Cameras (\`Renderer.h\` & \`Camera.h\`)

| Function Signature | Summary & Notes |
| --- | --- |
| \`void vk2dRendererSetTarget(VK2DTexture target)\` | Switches drawing to an offscreen render-target texture or back to \`VK2D_TARGET_SCREEN\` (\`NULL\`). Flushes the sprite batch and transitions image layouts automatically. |
| \`void vk2dRendererClear()\` | Fills the current render target with the current \`colourMod\` using a full-screen \`UNIT_VIEW\` quad. |
| \`void vk2dRendererEmpty()\` | Clears every pixel of the current render target to transparent black \`{0, 0, 0, 0}\` using \`VK2D_BLEND_MODE_NONE\`. |
| \`void vk2dRendererSetBlendMode(VK2DBlendMode blendMode)\` | Flushes the sprite batch and sets the blend mode (\`BLEND\`, \`NONE\`, \`ADD\`, or \`SUBTRACT\`). |
| \`VK2DBlendMode vk2dRendererGetBlendMode()\` | Returns the currently active \`VK2DBlendMode\`. |
| \`void vk2dRendererSetColourMod(const vec4 mod)\` | Sets the global RGBA color multiplier applied to subsequent draws (default \`VK2D_DEFAULT_COLOUR_MOD = {1,1,1,1}\`). |
| \`void vk2dRendererGetColourMod(vec4 dst)\` | Copies the current RGBA color modifier into \`dst\`. |
| \`void vk2dColourHex(vec4 dst, const char *hex)\` | Parses a 7-char hex string like \`"#59d9d7"\` into normalized RGBA floats (alpha = \`1.0f\`). |
| \`void vk2dColourInt(vec4 dst, uint32_t colour)\` | Unpacks a 32-bit \`0xRRGGBBAA\` integer into normalized RGBA floats. |
| \`void vk2dColourRGBA(vec4 dst, uint8_t r, uint8_t g, uint8_t b, uint8_t a)\` | Converts four \`0..255\` bytes into normalized RGBA floats. |
| \`VK2DCameraIndex vk2dCameraCreate(VK2DCameraSpec spec)\` | Allocates a new camera slot (\`1..9\`, or \`VK2D_INVALID_CAMERA\` if full) and sets its state to \`NORMAL\`. |
| \`void vk2dCameraUpdate(VK2DCameraIndex index, VK2DCameraSpec spec)\` | Updates a camera's world lens and screen viewport spec (replaces zero \`wOnScreen\`/\`hOnScreen\` with window size). |
| \`VK2DCameraSpec vk2dCameraGetSpec(VK2DCameraIndex index)\` | Returns the current \`VK2DCameraSpec\` of camera \`index\`. |
| \`void vk2dCameraSetState(VK2DCameraIndex index, VK2DCameraState state)\` | Flushes the sprite batch and sets camera state (\`NORMAL\`, \`DISABLED\`, or \`DELETED\`). Cannot delete \`VK2D_DEFAULT_CAMERA (0)\`. |
| \`VK2DCameraState vk2dCameraGetState(VK2DCameraIndex index)\` | Returns the current \`VK2DCameraState\` of camera \`index\`. |
| \`void vk2dRendererSetCamera(VK2DCameraSpec camera)\` | Updates \`VK2D_DEFAULT_CAMERA (0)\` while keeping its viewport locked to the full window size. |
| \`VK2DCameraSpec vk2dRendererGetCamera()\` | Returns the \`VK2DCameraSpec\` of \`VK2D_DEFAULT_CAMERA (0)\`. |
| \`void vk2dRendererLockCameras(VK2DCameraIndex cam)\` | Flushes the sprite batch and restricts subsequent draws to render **only** to camera \`cam\`. |
| \`void vk2dRendererUnlockCameras()\` | Flushes the sprite batch and resumes rendering to all enabled cameras. |
| \`void vk2dRendererSetTextureCamera(bool useCameraOnTextures)\` | When \`true\`, drawing to an offscreen texture uses active world cameras instead of raw texture pixel coordinates. |

### 3. Drawing Functions & Zero-Overhead Shorthand Macros (\`Renderer.h\`)

| Full Function & Shorthand Macro(s) | What It Draws |
| --- | --- |
| \`vk2dRendererDrawTexture(tex, x, y, xscale, yscale, rot, ox, oy, xInTex, yInTex, texW, texH)\`<br/>• \`vk2dDrawTexture(tex, x, y)\`<br/>• \`vk2dDrawTextureExt(tex, x, y, xscale, yscale, rot, ox, oy)\`<br/>• \`vk2dDrawTexturePart(tex, x, y, xPos, yPos, w, h)\` | Appends a 2D sprite to the compute-accelerated sprite batch (\`instancedPipe\`). Negative \`xscale\` or \`yscale\` flips the sprite horizontally or vertically. |
| \`vk2dRendererAddBatch(VK2DDrawCommand *commands, uint32_t count)\` | Appends an array of pre-built \`VK2DDrawCommand\` structs to the sprite batch, flushing automatically whenever the batch limit is reached. |
| \`vk2dRendererFlushSpriteBatch()\` | Manually flushes the active sprite batch to the compute and draw command buffers. |
| \`vk2dRendererDrawShader(shader, data, tex, x, y, xscale, yscale, rot, ox, oy, xInTex, yInTex, texW, texH)\`<br/>• \`vk2dDrawShader(shader, data, tex, x, y)\` | Flushes the sprite batch, uploads \`data\` (if \`uniformSize > 0\`) to Set 3, and draws \`tex\` using custom \`VK2DShader\` \`shader\`. |
| \`vk2dRendererDrawRectangle(x, y, w, h, r, ox, oy)\`<br/>• \`vk2dDrawRectangle(x, y, w, h)\` | Draws a filled rectangle using \`unitSquare\` and \`primFillPipe\`. |
| \`vk2dRendererDrawRectangleOutline(x, y, w, h, r, ox, oy, lineWidth)\`<br/>• \`vk2dDrawRectangleOutline(x, y, w, h, lw)\` | Draws a rectangle border using \`unitSquareOutline\` and \`primLinePipe\`. |
| \`vk2dRendererDrawCircle(x, y, r)\` / \`vk2dDrawCircle(x, y, r)\`<br/>\`vk2dRendererDrawCircleOutline(x, y, r, lw)\` / \`vk2dDrawCircleOutline(x, y, r, lw)\` | Draws a filled or outlined 72-vertex circle of radius \`r\` centered at \`(x, y)\`. |
| \`vk2dRendererDrawLine(x1, y1, x2, y2)\` / \`vk2dDrawLine(x1, y1, x2, y2)\` | Draws a line segment from \`(x1, y1)\` to \`(x2, y2)\` by scaling and rotating \`unitLine\`. |
| \`vk2dRendererDrawPolygon(poly, x, y, filled, lineWidth, xscale, yscale, rot, ox, oy)\`<br/>• \`vk2dDrawPolygon(poly, x, y)\`<br/>• \`vk2dDrawPolygonOutline(poly, x, y, width)\` | Draws a pre-allocated \`VK2DPolygon\` VBO filled or outlined. |
| \`vk2dRendererDrawGeometry(vertices, count, x, y, filled, lineWidth, xscale, yscale, rot, ox, oy)\` | Streams up to \`maxGeometryVertices\` (\`9,141\`) \`VK2DVertexColour\` vertices through the current frame's \`VK2DDescriptorBuffer\` and draws them immediately. |
| \`vk2dRendererDrawShadows(shadowEnvironment, colour, lightSource)\` | Extrudes and draws all enabled 2D shadow objects in \`shadowEnvironment\` away from \`vec2 lightSource\`. |
| \`vk2dRendererDrawModel(model, x, y, z, xscale, yscale, zscale, rot, axis, ox, oy, oz)\`<br/>• \`vk2dDrawModel(model, x, y, z)\` / \`vk2dDrawModelExt(...)\`<br/>• \`vk2dRendererDrawWireframe(...)\` / \`vk2dDrawWireframe(...)\` | Draws a 3D \`VK2DModel\` (filled or wireframe) to all active 3D cameras (\`PERSPECTIVE\` or \`ORTHOGRAPHIC\`). |

### 4. Asset Management: Textures, Images, Polygons, Models, Shaders & Shadows

| Header | Functions |
| --- | --- |
| **\`Texture.h\`** | \`vk2dTextureLoad(filename)\`, \`vk2dTextureFrom(data, size)\`, \`vk2dTextureLoadFromImage(image)\`, \`vk2dTextureCreate(w, h)\` (offscreen target), \`vk2dTextureUpdate(tex, pixels)\`, \`vk2dTextureUpdateRegion(tex, pixels, x, y, w, h)\`, \`vk2dTextureCopyPixels(tex, outPixels)\`, \`vk2dTextureWidth(tex)\`, \`vk2dTextureHeight(tex)\`, \`vk2dTextureIsTarget(tex)\`, \`vk2dTextureGetImage(tex)\`, \`vk2dTextureGetID(tex)\` (thread-safe atomic bindless ID), \`vk2dTextureFree(tex)\`. |
| **\`Image.h\`** | \`vk2dImageCreate(dev, w, h, format, aspectMask, usage, samples)\`, \`vk2dImageLoad(dev, filename)\`, \`vk2dImageFromPixels(dev, pixels, w, h, mainThread)\`, \`vk2dImageUpdate(img, pixels, x, y, w, h)\`, \`vk2dImageFree(img)\`. |
| **\`Polygon.h\`** | \`vk2dPolygonCreate(vertices, count)\` (auto-triangulates convex \`vec2\` loop), \`vk2dPolygonCreateOutline(vertices, count)\`, \`vk2dPolygonShapeCreateRaw(vertexData, count)\` (pre-triangulated \`VK2DVertexColour\`), \`vk2dPolygonFree(poly)\`. |
| **\`Shader.h\`** | \`vk2dSlangLoad(slangFile)\`, \`vk2dSlangFrom(slangSource, size)\`, \`vk2dShaderFrom(vertSpv, vertSize, fragSpv, fragSize, uniformSize)\`, \`vk2dShaderFree(shader)\`. |
| **\`ShadowEnvironment.h\`** | \`vk2dShadowEnvironmentCreate()\`, \`vk2dShadowEnvironmentAddObject(se)\`, \`vk2dShadowEnvironmentAddEdge(se, x1, y1, x2, y2)\`, \`vk2dShadowEnvironmentFlushVBO(se)\`, \`vk2dShadowEnvironmentObjectSetPos(se, obj, x, y)\`, \`vk2dShadowEnvironmentObjectUpdate(se, obj, x, y, sx, sy, rot, ox, oy)\`, \`vk2dShadowEnvironmentObjectSetStatus(se, obj, enabled)\`, \`vk2dShadowEnvironmentObjectGetStatus(se, obj)\`, \`vk2dShadowEnvironmentResetEdges(se)\`, \`vk2dShadowEnvironmentFree(se)\`. |
| **\`Model.h\`** | \`vk2dModelLoad(objFile, tex)\`, \`vk2dModelFrom(objBytes, size, tex)\`, \`vk2dModelCreate(vertices, vCount, indices, iCount, tex)\`, \`vk2dModelFree(model)\` (does not free \`tex\`). |
| **\`Gui.h\`** | \`vk2dGuiContext()\`, \`vk2dGuiStartInput()\`, \`vk2dGuiProcessEvent(SDL_Event *e)\`, \`vk2dGuiEndInput()\`. |
| **\`Validation.h\` & \`Logger.h\`** | \`vk2dStatus()\`, \`vk2dStatusFatal()\`, \`vk2dStatusMessage()\`, \`vk2dRaise(status, fmt, ...)\`, \`vk2dSetLogger(logger)\`, \`vk2dDefaultLoggerSetSeverity(sev)\`, \`vk2dDefaultLoggerSetStandardOutput(out)\`, \`vk2dDefaultLoggerSetErrorOutput(out)\`, \`vk2dDefaultLoggerSetErrorFile(file)\`, \`vk2dLogDebug/Info/Warn/Error/Fatal(fmt, ...)\`. |
| **\`VulkanInterface.h\`** | \`vk2dVulkanGetDrawBuffer()\`, \`vk2dVulkanGetComputeBuffer()\`, \`vk2dVulkanGetCopyBuffer()\`, \`vk2dVulkanGetSingleUseBuffer()\`, \`vk2dVulkanSubmitSingleUseBuffer(buf)\`, \`vk2dVulkanCopyDataIntoBuffer(data, size, &outBuf, &offset)\`, \`vk2dVulkanGetFrame()\`, \`vk2dVulkanGetSwapchainImageIndex()\`, \`vk2dVulkanGetSwapchainImageCount()\`, \`vk2dVulkanGetMaxFramesInFlight()\`, \`vk2dVulkanGetDevice()\`, \`vk2dVulkanGetPhysicalDevice()\`, \`vk2dVulkanGetQueue()\`, \`vk2dVulkanGetQueueFamily()\`, \`vk2dVulkanGetVMA()\`. |

### 5. GPU Push Constant & Instance Buffer Byte Layout Cheat Sheet (\`Structs.h\`)

When writing custom shaders or inspecting GPU captures in RenderDoc, every VK2D pipeline uses one of these exact binary layouts:

| C Struct Name | Total Size | Byte Offsets & Fields |
| --- | ---: | --- |
| \`VK2DVertexColour\` | **28 B** | \`[0..11]\` \`vec3 pos\` $\\cdot$ \`[12..27]\` \`vec4 colour\` |
| \`VK2DVertex3D\` | **20 B** | \`[0..11]\` \`vec3 pos\` $\\cdot$ \`[12..19]\` \`vec2 uv\` |
| \`VK2DDrawCommand\` | **64 B** | \`[0..15]\` \`vec4 texturePos\` $\\cdot$ \`[16..31]\` \`vec4 colour\` $\\cdot$ \`[32..39]\` \`vec2 pos\` $\\cdot$ \`[40..47]\` \`vec2 origin\` $\\cdot$ \`[48..55]\` \`vec2 scale\` $\\cdot$ \`[56..59]\` \`float rotation\` $\\cdot$ \`[60..63]\` \`uint32_t textureIndex\` |
| \`VK2DDrawInstance\` | **112 B** | \`[0..15]\` \`vec4 texturePos\` $\\cdot$ \`[16..31]\` \`vec4 colour\` $\\cdot$ \`[32..35]\` \`uint32_t textureIndex\` $\\cdot$ \`[36..47]\` \`vec3 padding\` $\\cdot$ \`[48..111]\` \`mat4 model\` |
| \`VK2DPushBuffer\` | **84 B** | \`[0..63]\` \`mat4 model\` $\\cdot$ \`[64..79]\` \`vec4 colourMod\` $\\cdot$ \`[80..83]\` \`int32_t cameraIndex\` |
| \`VK2D3DPushBuffer\` | **88 B** | \`[0..63]\` \`mat4 model\` $\\cdot$ \`[64..79]\` \`vec4 colourMod\` $\\cdot$ \`[80..83]\` \`uint32_t textureIndex\` $\\cdot$ \`[84..87]\` \`uint32_t cameraIndex\` |
| \`VK2DShadowsPushBuffer\` | **100 B** | \`[0..63]\` \`mat4 model\` $\\cdot$ \`[64..71]\` \`vec2 lightSource\` $\\cdot$ \`[72..79]\` \`vec2 _alignment\` $\\cdot$ \`[80..95]\` \`vec4 colour\` $\\cdot$ \`[96..99]\` \`uint32_t cameraIndex\` |
| \`VK2DShaderPushBuffer\` | **112 B** | \`[0..3]\` \`int32_t cameraIndex\` $\\cdot$ \`[4..7]\` \`uint32_t textureIndex\` $\\cdot$ \`[8..15]\` \`vec2 _padding\` $\\cdot$ \`[16..31]\` \`vec4 texturePos\` $\\cdot$ \`[32..47]\` \`vec4 colour\` $\\cdot$ \`[48..111]\` \`mat4 model\` |
| \`VK2DInstancedPushBuffer\` | **4 B** | \`[0..3]\` \`uint32_t cameraIndex\` |
| \`VK2DComputePushBuffer\` | **4 B** | \`[0..3]\` \`uint32_t drawCount\` |
`,
    mermaidCharts: [
      {
        title: "VK2D Header Dependency & Module Map (VK2D/include/VK2D/VK2D.h)",
        chart: `
flowchart TD
    classDef umbrella fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef pub fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef low fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    Umbrella["VK2D/VK2D.h<br/>Single Umbrella Include"]:::umbrella

    subgraph High_Level_API ["Included Automatically by VK2D.h"]
        Rend["Renderer.h<br/>(Init, Present, Draw*, Config, Limits)"]:::pub
        Tex["Texture.h & Image.h<br/>(Load, Create Target, Update, Readback)"]:::pub
        Cam["Camera.h<br/>(Create, Update, State, 2D & 3D Specs)"]:::pub
        Poly["Polygon.h & Model.h<br/>(2D Shapes & 3D .obj Meshes)"]:::pub
        Shad["Shader.h & ShadowEnvironment.h<br/>(Slang Shaders & 2D Drop Shadows)"]:::pub
        GuiH["Gui.h<br/>(Nuklear Input & Context)"]:::pub
    end

    subgraph Low_Level_Opt ["Optional Direct / Internal Headers"]
        VkInt["VulkanInterface.h<br/>(Raw Command Buffers, Device & VMA)"]:::low
        LogVal["Logger.h & Validation.h<br/>(Custom Loggers & Status Inspection)"]:::low
        Opaque["Opaque.h, Structs.h & Constants.h<br/>(Internal Struct Definitions & Limits)"]:::low
    end

    Umbrella --> High_Level_API
    High_Level_API --> Low_Level_Opt
`,
      },
    ],
  },
  {
    id: "vk2d-shaders-glsl-deep-dive",
    title: "64. Built-In GLSL 450 Shaders, Vertex Formats & SPIR-V Blob Generation",
    category: "graphics",
    summary:
      "Inside extern/Vulkan2d/shaders/: how the 5 vertex input descriptors in Util.c match every GLSL 450 shader, the math behind colour.vert's UNIT_VIEW clear matrix, and how genblobs.py compiles shaders into C byte arrays in Blobs.h.",
    sourceFiles: [
      "extern/Vulkan2d/shaders/colour.vert",
      "extern/Vulkan2d/shaders/colour.frag",
      "extern/Vulkan2d/shaders/usershader.vert",
      "extern/Vulkan2d/shaders/model.vert",
      "extern/Vulkan2d/shaders/model.frag",
      "extern/Vulkan2d/shaders/shadows.vert",
      "extern/Vulkan2d/shaders/shadows.frag",
      "extern/Vulkan2d/shaders/genblobs.py",
      "extern/Vulkan2d/VK2D/include/VK2D/Blobs.h",
    ],
    content: `
### The Five Vertex Input Layouts (\`Util.c\` & \`Pipeline.c\`)

When Vulkan creates a graphics pipeline in \`vk2dPipelineCreate()\`, it needs a \`VkPipelineVertexInputStateCreateInfo\` explaining how vertex bytes inside a buffer map onto \`layout(location = N)\` inputs in the vertex shader. VK2D defines five helper builders inside \`VK2D/src/Util.c\`:

| Pipeline Type | Builder in \`Util.c\` | Vertex Stride | Attribute Locations |
| --- | --- | ---: | --- |
| **Shapes (\`primFillPipe\`, \`primLinePipe\`)** | \`_vk2dGetColourVertexInputState()\` | \`28 B\` (\`VK2DVertexColour\`) | \`0\`: \`vec3 pos\` (\`R32G32B32_SFLOAT\`)<br/>\`1\`: \`vec4 colour\` (\`R32G32B32A32_SFLOAT\`) |
| **3D Meshes (\`modelPipe\`, \`wireframePipe\`)** | \`_vk2dGetModelVertexInputState()\` | \`20 B\` (\`VK2DVertex3D\`) | \`0\`: \`vec3 pos\` (\`R32G32B32_SFLOAT\`)<br/>\`1\`: \`vec2 uv\` (\`R32G32_SFLOAT\`) |
| **2D Shadows (\`shadowsPipe\`)** | \`_vk2dGetShadowsVertexInputState()\` | \`12 B\` (\`vec3\`) | \`0\`: \`vec3 pos\` (\`R32G32B32_SFLOAT\`) |
| **Batched Sprites (\`instancedPipe\`)** | \`_vk2dGetInstanceVertexInputState()\` | \`0 B\` *(No VBO!)* | Procedural corners derived from \`gl_VertexIndex\` and SSBO Set 3 |
| **Custom Slang Shaders (\`USER_SHADER\`)** | \`_vk2dGetTextureVertexInputState()\` | \`0 B\` *(No VBO!)* | Procedural $1 \\times 1$ quad corners indexed directly by \`gl_VertexIndex\` |

Look closely at \`_vk2dGetInstanceVertexInputState()\` in \`Util.c\`: it constructs a per-instance vertex attribute table for \`VK2DDrawInstance\`, then hits an early \`return vk2dInitPipelineVertexInputStateCreateInfo(VK_NULL_HANDLE, 0, VK_NULL_HANDLE, 0);\` right before returning—because \`instanced.vert\` reads all per-sprite attributes straight out of the compute shader's Set 3 SSBO instead!

*(Zero-VBO Trick: Both \`instanced.vert\` and \`usershader.vert\` bake a static 6-vertex unit square array right into GLSL constant memory. Because \`vkCmdBindVertexBuffers\` is skipped completely, VK2D never allocates or binds vertex buffers for sprites or custom shaders!)*

### Inside Every Built-In GLSL 450 Shader Pair (\`shaders/\`)

Each built-in pipeline pairs a tiny, specialized vertex and fragment shader under \`extern/Vulkan2d/shaders/\`:

1. **Shapes & Clears (\`colour.vert\` & \`colour.frag\`):**
   Reads \`vec3 inPosition\` and \`vec4 inColor\`, multiplies by \`pushBuffer.model\`, and outputs \`fragColor * pushBuffer.colourMod\`.
   Notice the constant matrix \`UNIT_VIEW\` inside \`shaders/colour.vert\`:
\`\`\`glsl
const mat4 UNIT_VIEW = {
    { 2.0,  0.0, 0.0,      0.0 },
    { 0.0,  2.0, 0.0,      0.0 },
    { 0.0,  0.0, 0.10101,  0.0 },
    { -1.0, -1.0, 0.191919, 1.0 }
};
\`\`\`
   Why those exact decimals? When \`vk2dRendererClear()\` or \`vk2dRendererEmpty()\` draws \`unitSquare\` (whose corners span $[0, 1]^2$), it sets \`pushBuffer.cameraIndex = -1\`. \`UNIT_VIEW\` stretches $[0, 1]$ by $\\times 2$ and shifts by $-1$ to cover $[-1, +1]^2$ in screen clip space, while mapping $z = 0$ inside Vulkan's $[0.1, 10.0]$ orthographic depth range ($\\frac{1}{10.0 - 0.1} = 0.10101$).
2. **Custom Shader Quad Host (\`usershader.vert\`):**
   Matches \`VK2DShaderPushBuffer\` (\`112 B\`). Multiplies \`VERTICES[gl_VertexIndex]\` by \`push.texturePos.zw\` (pixel width/height of the sprite region) so your Slang vertex output sits in world pixel coordinates, then interpolates pixel texture coordinates \`fragTexCoord = push.texturePos.xy + TEX_COORDS[gl_VertexIndex] * push.texturePos.zw\` into \`PixelShader(float2 uv)\`.
3. **3D Models (\`model.vert\` & \`model.frag\`):**
   Transforms \`VK2DVertex3D\` vertices by \`ubo.viewproj[cameraIndex] * pushBuffer.model\`, then samples \`tex[pushBuffer.textureIndex]\` with the repeating normalized 3D sampler (\`Set 1\`) and tints by \`pushBuffer.colourMod\`.
4. **2D Shadow Extrusion (\`shadows.vert\` & \`shadows.frag\`):**
   Reads wall corner positions (\`vec3 inPosition\`), transforms them into world space, tests \`gl_VertexIndex % 6\`, projects vertices \`1, 4, 5\` away from \`pushBuffer.lightSource\` by $\\times 1{,}000$, and fills the extruded triangles with solid \`pushBuffer.colour\` inside \`shadows.frag\`.

### Baking Shaders Into C Arrays (\`shaders/genblobs.py\` $\\to$ \`Blobs.h\`)

Instead of loading external \`.spv\` files from disk at startup (which could fail if a game launches from a different working directory), VK2D compiles all GLSL shaders ahead of time into C byte arrays in \`VK2D/include/VK2D/Blobs.h\` using \`extern/Vulkan2d/shaders/genblobs.py\`:

1. \`find_glslc()\` locates \`glslc\` (on Linux) or scans \`C:\\VulkanSDK\\*\\Bin\\glslc.exe\` (on Windows).
2. For every input file, \`genblobs.py\` runs \`glslc -g <shader>\` to compile SPIR-V bytecode (with debug symbols preserved for RenderDoc!) into \`a.spv\`.
3. \`filename_to_variable()\` converts paths like \`colour.vert\` or \`spritebatch.comp\` into C identifiers using the pattern \`VK2D<Ext><Name>\` (producing \`VK2DVertColour\`, \`VK2DFragInstanced\`, \`VK2DCompSpritebatch\`, etc.).
4. Finally, it formats the SPIR-V bytes in 15-byte hex rows into \`VK2D/include/VK2D/Blobs.h\`, wrapped in \`extern "C"\` guards so both C11 and C++ callers can reference them directly.
`,
    mermaidCharts: [
      {
        title: "GLSL 450 Source -> glslc SPIR-V Compilation -> Blobs.h Pipeline Build",
        chart: `
flowchart LR
    classDef src fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef tool fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef blob fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef pipe fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    GLSL["shaders/*.vert, *.frag, spritebatch.comp<br/>GLSL 450 Sources"]:::src
    GEN["shaders/genblobs.py<br/>Calls glslc -g and encodes hex arrays"]:::tool
    BLOBS["VK2D/include/VK2D/Blobs.h<br/>VK2DVertColour, VK2DFragInstanced,<br/>VK2DVertUsershader, VK2DCompSpritebatch"]:::blob
    PIPES["RendererMeta.c & Shader.c<br/>vkCreateShaderModule directly from C arrays<br/>Zero external shader files needed at runtime"]:::pipe

    GLSL --> GEN --> BLOBS --> PIPES
`,
      },
    ],
  },
  {
    id: "vk2d-nuklear-uthash-internals",
    title: "65. Nuklear Vulkan Backend (nuklear.c), Font Atlas Hashing & Off-Thread Loading",
    category: "graphics",
    summary:
      "Inside VK2D's embedded immediate-mode GUI renderer (nuklear.c), how font handles are indexed with uthash.h, how swapchain resizes rebuild UI framebuffers, and how Image.c structures pixel uploads.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/src/nuklear.c",
      "extern/Vulkan2d/VK2D/include/VK2D/nuklear_defs.h",
      "extern/Vulkan2d/VK2D/include/VK2D/uthash.h",
      "extern/Vulkan2d/VK2D/src/Gui.c",
      "extern/Vulkan2d/VK2D/src/Image.c",
      "extern/Vulkan2d/VK2D/src/RendererMeta.c",
    ],
    content: `
### Inside \`VK2D/src/nuklear.c\`: A Standalone Vulkan UI Overlay

While VK2D handles all 2D/3D game rendering through \`Renderer.c\`, its embedded GUI (\`options.enableNuklear = true\`) runs a self-contained Vulkan backend (\`struct nk_sdl_device\` inside \`VK2D/src/nuklear.c\`) that shares the same \`VkDevice\` and swapchain image views without interfering with your game's descriptor buffers or sprite batches.

How does \`nuklear.c\` overlay crisp menus and debug panels cleanly on top of your rendered game?

1. **Preserve Game Pixels with \`LOAD_OP_LOAD\`:**
   \`nk_sdl_create_render_pass()\` creates a single-attachment \`VkRenderPass\` whose \`initialLayout\` and \`finalLayout\` are both \`VK_IMAGE_LAYOUT_PRESENT_SRC_KHR\` and whose \`loadOp\` is \`VK_ATTACHMENT_LOAD_OP_LOAD\`. Because it waits on VK2D's \`renderFinishedSemaphores[scImageIndex]\`, Nuklear opens the swapchain image **right after** VK2D finishes drawing your scene and draws widgets cleanly over top!
2. **Per-Swapchain-Image Mapped Ring Buffers:**
   In \`nk_sdl_device_create()\`, Nuklear allocates one set of host-visible, persistently mapped buffers **per swapchain image**:
   - \`vertex_buffers[i]\`: \`512 KB\` (\`MAX_VERTEX_BUFFER\`) storing \`struct nk_sdl_vertex\` (\`float pos[2]\`, \`float uv[2]\`, \`nk_byte col[4]\`).
   - \`index_buffers[i]\`: \`128 KB\` (\`MAX_ELEMENT_BUFFER\`) storing 16-bit triangle indices.
   - \`uniform_buffers[i]\`: \`64 B\` storing an orthographic screen-space projection matrix (\`m[0] = 2 / w\`, \`m[5] = -2 / h\`).
   - \`frameStartFences[i]\`: Signals when that swapchain slot's previous Nuklear command buffer has finished executing on the GPU before overwriting its mapped vertex/index buffers.
3. **256 Texture Descriptor Cache & Per-Widget Scissor Clipping:**
   \`nk_sdl_render()\` calls \`nk_convert()\` to tessellate windows, sliders, and text directly into the mapped buffers, then walks \`nk_draw_foreach(cmd)\`. Whenever a widget references a new \`VkImageView\` (up to \`NK_SDL_MAX_TEXTURES = 256\`), Nuklear caches a \`VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER\` descriptor set for it, updates \`vkCmdSetScissor\` to \`cmd->clip_rect\` so scrolled panels never bleed outside their window borders, and issues \`vkCmdDrawIndexed\`.

### Embedded SPIR-V UI Shaders & Resize Recovery

Just like \`Blobs.h\` embeds VK2D's game shaders, \`VK2D/src/nuklear.c\` embeds pre-compiled SPIR-V bytecode arrays \`nuklearshaders_nuklear_vert_spv\` (1,856 bytes) and \`nuklearshaders_nuklear_frag_spv\` (860 bytes). When the game window resizes or changes MSAA:
- \`_vk2dRendererResetNuklear()\` in \`RendererMeta.c\` calls \`nk_sdl_resize(swapchainImageViews, swapchainImageCount, surfaceWidth, surfaceHeight)\`.
- \`nk_sdl_resize()\` destroys and recreates Nuklear's framebuffers, pipeline, descriptor pool, and render pass using the new swapchain image views—without clearing your open windows, slider values, or font atlas!

### Font Atlas Management & \`uthash.h\` Registry (\`RendererMeta.c\`)

When \`_vk2dRendererInitNuklear()\` boots the UI subsystem:
- It calls \`nk_sdl_font_stash_begin(&atlas)\`, bakes Nuklear's default 16 px font into a 32-bit RGBA bitmap via \`nk_font_atlas_bake(..., NK_FONT_ATLAS_RGBA32)\`, and uploads it into a \`VK_FORMAT_R8G8B8A8_UNORM\` GPU image (\`dev->font_image\`) via \`nk_sdl_device_upload_atlas()\`.
- Inside \`struct VK2DGui_t\` (\`Opaque.h\`), VK2D embeds Troy D. Hanson's single-header hash table library (\`VK2D/include/VK2D/uthash.h\`) inside \`struct VK2DFontHandle\`:
\`\`\`c
struct VK2DFontHandle {
  UT_hash_handle hh;
  char *name;
  struct nk_font *font;
};
\`\`\`
  At shutdown (\`_vk2dRendererQuitNuklear()\`), VK2D safely iterates all entries using \`HASH_ITER(hh, gRenderer->gui->fonts, font, tmp)\` and \`HASH_DEL()\` to free every font handle before calling \`nk_sdl_shutdown()\`.

### Event Routing & Dual-Queue Support for Image Uploads (\`Gui.c\` & \`Image.c\`)

To route keyboard shortcuts (Copy/Paste via SDL3 clipboard, arrow keys, backspace, scroll wheel, and text input) and double-clicks into Nuklear cleanly:
1. Wrap your SDL3 event polling loop with \`vk2dGuiStartInput()\`, \`vk2dGuiProcessEvent(&e)\`, and \`vk2dGuiEndInput()\`. Internally, all three functions check \`vk2d->options.enableNuklear\` first so they are safe no-ops if Nuklear is disabled.
2. In \`VK2D/src/Image.c\`, note how \`vk2dImageFromPixels(dev, pixels, w, h, mainThread)\` accepts a \`bool mainThread\` flag and forwards it through \`_vk2dImageTransitionImageLayout()\` and \`_vk2dImageCopyBufferToImage()\`, while \`LogicalDevice.c\` probes \`queueCount >= 2\` to cache \`ldev->loadQueue\` for multi-queue hardware. And every image upload handles platform endianness via \`SDL_BYTEORDER\` masks (\`rmask, gmask, bmask, amask\`) cleanly across Windows, Linux, and macOS.
`,
    mermaidCharts: [
      {
        title: "VK2D Frame Submission -> Nuklear Overlay Pass -> Swapchain Present Sync",
        chart: `
flowchart LR
    classDef vk2d fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef nk fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef pres fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Scene["VK2D Main Submit<br/>Copies + Compute + Graphics<br/>Signals renderFinishedSemaphores"]:::vk2d
    WaitFence["nk_sdl_render<br/>Wait frameStartFences and nk_convert<br/>Into mapped 512KB VBO + 128KB IBO"]:::nk
    DrawUI["RenderPass LOAD_OP_LOAD<br/>Bind font_image or cached texture set<br/>Per-widget vkCmdSetScissor + DrawIndexed"]:::nk
    Present["vkQueuePresentKHR<br/>Waits on render_completed_semaphores"]:::pres

    Scene -->|"Wait renderFinishedSemaphore"| WaitFence --> DrawUI -->|"Signal nkSemaphore"| Present
`,
      },
    ],
  },
  {
    id: "vk2d-gpu-architecture-book",
    title: "66. GPU & Shader Book I: How Modern GPUs Actually Work",
    category: "graphics",
    summary:
      "A complete mental model of modern GPU silicon written for 2D/3D engine programmers: CPU latency vs GPU throughput, 32/64-lane SIMT warps, branch divergence, zero-cost warp switching, Morton-tiled VRAM textures, and the 2x2 pixel quad rasterizer.",
    sourceFiles: [
      "extern/Vulkan2d/VK2D/src/PhysicalDevice.c",
      "extern/Vulkan2d/VK2D/src/LogicalDevice.c",
      "extern/Vulkan2d/VK2D/src/DescriptorBuffer.c",
      "extern/Vulkan2d/VK2D/src/Pipeline.c",
      "extern/Vulkan2d/shaders/spritebatch.comp",
      "extern/Vulkan2d/shaders/instanced.vert",
      "extern/Vulkan2d/shaders/instanced.frag",
    ],
    content: `
### Chapter 1: CPU vs GPU: Two Opposite Philosophies of Silicon

If you think of a **CPU** as a **Formula 1 race car**, a **GPU** is a **hundred-car freight train**. They are both made of silicon transistors, yet they spend their chip area and electricity on completely opposite goals.

#### Why Your CPU Has Huge Caches & Complex Control Logic

A modern desktop CPU core spends most of its transistors on **minimizing latency** for a single, unpredictable thread (game AI, pathfinding, file I/O, or OS scheduling):
- **Branch Predictors & Speculative Execution:** Guesses which way an \`if\` statement will go 20 instructions ahead so the pipeline stays full.
- **Out-of-Order Execution Engines:** Reorders unrelated instructions on the fly while waiting for memory.
- **Giant Multi-Level Caches (L1/L2/L3):** Tens of megabytes of fast SRAM sit right next to the ALU so a single core rarely waits 200+ clock cycles for system RAM.
- **Result:** Only a tiny fraction of CPU die area is actual math circuitry (ALUs); most of the chip is smart control logic keeping 8 to 16 threads blazingly fast one instruction at a time.

#### Why Your GPU Gives Up Control Logic for Thousands of Math Lanes

When drawing a $1920 \\times 1080$ screen at 60 FPS, the GPU computes color for **$2{,}073{,}600$ pixels every 16.67 milliseconds** ($124$ million pixels per second), and each pixel runs nearly the exact same math program (a **shader**). Instead of building smart branch predictors for each pixel:
- A GPU shrinks control logic and L3 cache to a bare minimum and stamps down dozens of **Streaming Multiprocessors (SMs)** (NVIDIA) or **Compute Units (CUs)** (AMD) / **GPU Cores** (Apple Silicon).
- Inside each SM sit **dozens of simple math lanes (ALUs)** paired with an enormous **register file** (typically $256\\text{ KB}$ per SM!) and a **hardware warp scheduler**.
- **Result:** A GPU cannot run a single thread as fast as a CPU core, yet its total math throughput and memory bandwidth dwarf a CPU by $10\\times$ to $50\\times$ when thousands of pixels or sprites run in parallel.

| Silicon Design Feature | Modern CPU (Latency-Oriented) | Modern GPU (Throughput-Oriented) | What It Means for VK2D Code |
| --- | --- | --- | --- |
| **Control & Branch Logic** | Huge out-of-order engine + branch predictor | Minimal shared fetch/decode unit per warp | Avoid unpredictable \`if\` branches inside pixel shaders |
| **On-Chip Memory** | Large coherent L1/L2/L3 caches (~32–96 MB) | Huge register file (~256 KB per SM) + small L1/shared RAM | Keep live shader variables compact so more warps fit in registers |
| **Latency Hiding Strategy** | Cache hits + out-of-order execution | Instant 1-cycle context switch between 32+ active warps | Dispatch large batches (\`vkCmdDispatch\`, many pixels) so SMs stay fed |
| **Main Memory Bus** | 64-bit / 128-bit DDR5 (~50–90 GB/s) | Wide 128-bit to 512-bit GDDR6/HBM (~300–1,000+ GB/s) | Stream vertex/instance buffers in bulk via \`VK2DDescriptorBuffer\` |

### Chapter 2: SIMT Execution, Warps (32 Lanes) & Wavefronts (64 Lanes)

Here is the single biggest mental leap in GPU programming: **a GPU does not execute one shader invocation per instruction decoder**. Instead, the hardware bundles neighboring pixels, vertices, or compute threads into groups of **32** (called a **Warp** on NVIDIA and Apple GPUs) or **64** (called a **Wavefront** on AMD GCN/RDNA in wave64 mode).

Look at \`extern/Vulkan2d/shaders/spritebatch.comp\` line 32:
\`\`\`glsl
layout (local_size_x = 64, local_size_y = 1, local_size_z = 1) in;
\`\`\`
VK2D chooses \`local_size_x = 64\` specifically because \`64\` fills **exactly two 32-lane NVIDIA warps or one 64-lane AMD wavefront** per workgroup with zero wasted hardware lanes!

#### How SIMT (Single Instruction, Multiple Threads) Works Clock-by-Clock

Inside one 32-lane warp:
1. All 32 lanes share **one Program Counter (\`PC\`)** and fetch the **same instruction** at the exact same clock cycle.
2. Each lane \`0..31\` owns its own private registers (\`r0..rN\`) holding different values (for instance, pixel $(10, 4)$ vs pixel $(11, 4)$).
3. On a uniform instruction like \`c = texColor * push.colour;\`, all 32 lanes multiply their own colors simultaneously in a single step.

#### Branch Divergence: Why \`if / else\` Inside a Warp Costs Both Paths

What happens when 16 pixels in a warp take the \`if\` branch and the other 16 pixels take the \`else\` branch? Because a warp only has **one Program Counter (\`PC\`)**, the 32 lanes cannot jump to two different lines of code at the same time! Instead, the SM executes **both paths sequentially** using a 32-bit **Active Execution Mask (\`exec_mask\`)**:

\`\`\`text
Suppose a 32-pixel warp runs:
  if (uv.x < 128.0) { color = expensiveBlur(); }   // Only pixels 0..15 true
  else              { color = fastTint(); }        // Only pixels 16..31 true

Hardware execution timeline inside the SM:
  Step 1: Push exec_mask = 0x0000FFFF (lanes 0..15 ON, lanes 16..31 SLEEPING)
          Execute expensiveBlur() -> 16 lanes compute, 16 lanes sit idle!
  Step 2: Flip exec_mask = 0xFFFF0000 (lanes 0..15 SLEEPING, lanes 16..31 ON)
          Execute fastTint()      -> 16 lanes compute, 16 lanes sit idle!
  Step 3: Restore exec_mask = 0xFFFFFFFF (all 32 lanes reconverge)
\`\`\`

Notice the cost: **the warp paid \`cost(if) + cost(else)\`**, cutting hardware efficiency in half! On the other hand, if *every* pixel in the 32-lane warp agrees (e.g., \`if (userData.mode == 1)\`, a uniform check), the mask is either \`0xFFFFFFFF\` or \`0x00000000\`, so the SM skips the untaken branch completely with **zero divergence penalty**.

#### Eliminating Divergence with Branchless Shader Math

Experienced shader authors replace per-pixel \`if\` statements with arithmetic intrinsics that execute identically on all 32 lanes:
- \`step(edge, x)\`: Returns \`0.0\` if \`x < edge\`, else \`1.0\` (single GPU compare instruction, zero branches).
- \`smoothstep(e0, e1, x)\`: Smooth Hermite interpolation from \`0.0\` to \`1.0\` between \`e0\` and \`e1\`.
- \`lerp(a, b, t)\` (Slang) / \`mix(a, b, t)\` (GLSL): Blends between \`a\` and \`b\` without branching: $a + t(b - a)$.
- \`saturate(x)\` / \`clamp(x, 0.0, 1.0)\`: Compiled for free as an output modifier on many GPU ALU instructions!

#### Zero-Cost Warp Switching (How SMs Hide 400-Cycle VRAM Latency)

Reading a texel from VRAM texture memory (\`textures[push.textureIndex].Sample(sampler, uv)\`) is slow—often **200 to 450 GPU clock cycles** if it misses L1/L2 cache! A CPU would stall or rely on out-of-order execution. A GPU does something much simpler:
1. Warp 0 issues a texture sample instruction and is immediately marked **stalled waiting on memory**.
2. On the **very next clock cycle** (1 cycle = zero context-switch overhead, because every warp's registers stay live in the SM's 256 KB register file!), the warp scheduler swaps in **Warp 1** to execute math instructions.
3. Then **Warp 2**, **Warp 3**, up to 48 or 64 warps rotate through the ALU while Warp 0's texture fetch travels back from GDDR6.
4. By the time the scheduler loops back to Warp 0, its pixel data has arrived in registers and it resumes seamlessly. *(This is why small "hello world" draws of 1 sprite underutilize a GPU, whereas batching 2,000 sprites through \`vk2dRendererFlushSpriteBatch\` saturates the warp scheduler cleanly!)*

### Chapter 3: The GPU Memory Hierarchy & Why Layout Matters

Understanding where your shader's data physically lives explains every binding rule inside VK2D:

| Memory Tier | Approx. Latency | Bandwidth | Where VK2D Uses It |
| --- | --- | --- | --- |
| **Per-Lane Registers** | ~1 cycle | ~20–80 TB/s aggregate | Local variables inside \`PixelShader\`, loop counters, sampled \`float4\` results |
| **Push Constants** | ~1–4 cycles | Broadcast from SM constant bank | \`VK2DShaderPushBuffer\` (**112 B**), \`VK2DPushBuffer\` (**84 B**), \`cameraIndex\` |
| **L1 / Texture Cache** | ~20–30 cycles | Multi-TB/s per SM | Recently sampled $2 \\times 2$ texture tiles & \`ConstantBuffer<UserData>\` |
| **L2 Cache** | ~100–200 cycles | ~1–4 TB/s shared | Cross-SM sharing of \`VK2DDrawInstance\` SSBO & swapchain render target writes |
| **Device-Local VRAM** | ~250–450 cycles | ~300–1,000+ GB/s | \`VK2DDescriptorBuffer\` \`deviceBuffer\`, loaded textures, shadow/model VBOs |
| **PCIe System RAM** | ~1,000+ cycles | ~16–32 GB/s (PCIe 4.0/5.0) | \`stageBuffer\` mapped by CPU during frame; DMA-copied once at \`vk2dRendererEndFrame\` |

#### Push Constants vs \`ConstantBuffer<UserData>\` vs Storage Buffers

- **Push Constants (\`[[vk::push_constant]]\`):** Vulkan guarantees at least **128 bytes** of ultra-fast inline data embedded directly in the command buffer packet itself (VK2D uses up to **112 bytes** for custom shaders). Updating push constants never allocates GPU buffers or descriptor sets.
- **Uniform / Constant Buffers (\`[[vk::binding(3, 3)]] ConstantBuffer<UserData>\`):** Read-only per draw call (\`VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER\`, up to 64 KB). SMs broadcast reads cleanly when all lanes read the same offset (\`userData.time\`), which is why \`ConstantBuffer\` is fast—and why fields must obey 16-byte \`vec4\` alignment!
- **Storage Buffers (SSBOs, \`Set 3 Binding 3\` in \`instanced.vert\`):** Arbitrarily large read/write arrays (\`VK_BUFFER_USAGE_STORAGE_BUFFER_BIT\`). VK2D's compute shader \`spritebatch.comp\` reads \`DrawCommand draws[]\` and writes \`DrawInstance draws[]\` through aligned slices of the 256 KB \`VK2DDescriptorBuffer\` pages.

#### Why \`VK_IMAGE_TILING_OPTIMAL\` Uses 2D Morton / Z-Order Swizzling

When VK2D calls \`vk2dInitImageCreateInfo()\` in \`Initializers.c\`, it always sets \`imageCreateInfo.tiling = VK_IMAGE_TILING_OPTIMAL\`. Why not store pixels row-by-row like a C array (\`VK_IMAGE_TILING_LINEAR\`)?
- In a normal 2D C array, moving 1 pixel down on screen jumps by \`width * 4\` bytes (often several kilobytes away, causing a cache miss on diagonal sprite rotations!).
- Under \`OPTIMAL\` tiling, the GPU driver shuffles pixels into **2D space-filling Z-order (Morton) curves** inside $2 \\times 2$, $4 \\times 4$, and $8 \\times 8$ blocks! That means any pixel's neighbors *up, down, left, right, and diagonal* sit in the exact same L1 cache line—which is essential when bilinear texture filtering (\`VK_FILTER_LINEAR\`) samples 4 neighboring texels at once!

### Chapter 4: The Hardware Graphics Pipeline & The 2×2 Pixel Quad Rule

When \`vk2dRendererDrawShader()\` records \`vkCmdDraw(buf, 6, 1, 0, 0)\` into \`commandBuffer\`, here is what happens inside the silicon:

1. **Input Assembler / Vertex Puller:** Reads \`gl_VertexIndex\` from \`0\` to \`5\`, forming two clockwise/counter-clockwise triangles (\`VERTICES[0..2]\` and \`VERTICES[3..5]\`). Notice no VBO memory fetch occurs!
2. **Vertex Shader (\`usershader.vert\`):** Runs 6 vertex invocations in a warp, multiplying \`newPos\` by \`push.model\` and \`ubo.viewproj[push.cameraIndex]\` to output \`gl_Position\` and pixel-space \`fragTexCoord\`.
3. **Viewport Transform & Scissor Culling:** Clips triangles outside $[-1, +1]^2$ NDC (and $z \\in [0, 1]$), converts to screen pixels inside \`viewport\`, and discards pixels outside \`scissor\`.
4. **Rasterizer & Barycentric Interpolation:** Walks across the triangles and spawns fragments—**never 1 pixel at a time, always in $2 \\times 2$ blocks called Pixel Quads**!

#### Why GPUs Always Execute Pixel Shaders in 2×2 Quads (Helper Lanes)

Even if a tiny 1-pixel sprite corner only touches **1 pixel** inside a $2 \\times 2$ tile, the hardware **still launches all 4 threads** (1 visible lane + 3 hidden **helper lanes** whose outputs are thrown away before blending):
- **Why?** Because hardware texture mipmapping and screen-space derivative functions (\`ddx(v)\` / \`ddy(v)\`, or GLSL \`dFdx\` / \`dFdy\`) work by subtracting adjacent lanes inside the $2 \\times 2$ quad!
  $$\\operatorname{ddx}(v) = v_{(x+1,y)} - v_{(x,y)}, \\qquad \\operatorname{ddy}(v) = v_{(x,y+1)} - v_{(x,y)}$$
- **Practical Rule for 2D Pixel Art:** Tiny 1-pixel or thin-sliver triangles suffer up to **75% helper-lane waste** inside $2 \\times 2$ quads. Combining sprites into full quads (as VK2D does with 6-vertex quads) keeps quad occupancy high and avoids edge helper-lane overhead!
5. **ROP (Render Output Unit) & Hardware Color Blending:** Finally, surviving fragment outputs flow into fixed-function **ROP** units, which execute VK2D's 4 pre-built \`VkPipelineColorBlendAttachmentState\` formulas (\`BLEND\`, \`NONE\`, \`ADD\`, \`SUBTRACT\`) using hardware MSAA resolve buffers and write the final BGRA pixels to the framebuffer.

### Chapter 5: Hardware Mental-Model Exercises & Solutions

Test your understanding of GPU hardware before writing your first Slang shader:

#### Exercise 1: Calculating Warp Branch Divergence Cost
Suppose a $32 \\times 32$ sprite tile has a diagonal slash across it, so inside every $8 \\times 4$ screen pixel warp, half the pixels (\`uv.y < uv.x\`) execute a 20-cycle **fire glow** formula and the other half execute an 8-cycle **ice tint** formula using \`if / else\`.
- **Question:** How many compute cycles does that divergent warp take compared to a uniform warp, and how would you rewrite it to eliminate the divergence?
- **Solution:** Because all 32 lanes share one \`PC\`, the warp runs both paths back-to-back: $20 + 8 = 28$ cycles (instead of $20$ or $8$), leaving half the SIMT lanes idle on every cycle. Rewrite it branchlessly using \`step\`:
\`\`\`hlsl
float mask = step(localUV.y, localUV.x); // 1.0 when y <= x, else 0.0
float4 finalCol = lerp(iceTint(), fireGlow(), mask);
\`\`\`
  Wait—notice one subtle catch! In \`lerp(iceTint(), fireGlow(), mask)\`, *both* functions are still evaluated per lane (costing ~28 cycles anyway unless one path can reuse the same math!). True savings happen when you parameterize a single shared calculation with \`mask\` (e.g., \`float tint = lerp(float3(0.4, 0.8, 1.0), float3(1.0, 0.4, 0.1), mask);\`), dropping the whole warp down to **~10 cycles with zero divergence**!

#### Exercise 2: Why \`VK2DDescriptorBuffer\` Copies Pages Instead of Single Sprites
Suppose you call \`vk2dRendererDrawShader\` 300 times in a frame with a 16-byte \`UserData\` struct.
- **Question:** How many Vulkan DMA copy calls does VK2D issue over the PCIe bus to transfer all 300 uniforms?
- **Solution:** **One single \`vkCmdCopyBuffer\` call per 256 KB page!** Each of the 300 writes goes sequentially into CPU-mapped \`stageBuffer\` RAM (aligned up to the GPU's \`minUniformBufferOffsetAlignment\`, e.g., 64 B $\\times 300 = 19{,}200$ bytes < $256{,}000$ bytes), so all 300 structs fit inside Page 0. At \`vk2dRendererEndFrame()\`, \`vk2dDescriptorBufferEndFrame()\` transfers the entire active slice in **1 bulk DMA copy** on \`dbCommandBuffer\`.

#### Exercise 3: Predicting Helper-Lane Effects in a Fragment Shader
- **Question:** If a shader writes a debug counter to a storage buffer inside a triangle edge pixel, could the helper lanes outside the triangle also execute your shader math?
- **Solution:** **Yes!** All 4 threads of the $2 \\times 2$ pixel quad execute the fragment shader instructions (including texture fetches and ALU ops, so derivatives \`ddx\`/\`ddy\` remain valid), and the hardware simply masks out framebuffer writes and side effects from helper lanes! Never sample adjacent pixels outside your sprite atlas frame without clamping first!
`,
    mermaidCharts: [
      {
        title: "GPU Streaming Multiprocessor (SM), Warp Scheduler & Memory Hierarchy",
        chart: `
flowchart TD
    classDef cpu fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef sm fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef mem fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef vram fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    HOST["CPU Staging RAM (stageBuffer)<br/>Mapped Host Memory -> 1 Bulk DMA per Frame"]:::cpu
    VRAM["Device-Local VRAM (GDDR6 / HBM)<br/>Textures in Z-Order Optimal Tiling + SSBOs"]:::vram
    L2["Shared GPU L2 Cache<br/>Feeds All Streaming Multiprocessors"]:::mem

    subgraph SM_Core ["Single Streaming Multiprocessor (SM / CU)"]
        WS["Warp Scheduler (1-Cycle Context Switch)<br/>Holds 32 to 64 Resident Warps"]:::sm
        REG["256 KB On-Chip Register File<br/>Push Constants + Private Per-Lane Registers"]:::mem
        ALU["32 or 64 SIMT Math Lanes<br/>Shared PC + Active Execution Mask"]:::sm
        TEX["L1 Texture Cache & Filtering Units<br/>Bilinear / Nearest + Unnormalized Pixel Addressing"]:::mem
    end

    HOST -->|"PCIe Bulk Copy (dbCommandBuffer)"| VRAM --> L2 --> TEX
    WS --> ALU
    REG <--> ALU
    TEX --> REG
`,
      },
      {
        title: "Hardware Graphics Pipeline: Vertex Puller to 2x2 Pixel Quad & ROP Blender",
        chart: `
flowchart LR
    classDef ia fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef vert fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef rast fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef rop fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    IA["1. Vertex Puller<br/>gl_VertexIndex 0..5<br/>Zero VBO needed for Shaders"]:::ia
    VS["2. Vertex Shader<br/>usershader.vert<br/>NDC Clip + Pixel UV Out"]:::vert
    RAST["3. Triangle Rasterizer<br/>Viewport, Scissor & Barycentrics<br/>Spawns 2x2 Pixel Quads"]:::rast
    FS["4. Pixel Shader (SIMT Warps)<br/>PixelShader(float2 uv)<br/>Sample Textures + Compute RGBA"]:::vert
    ROP["5. ROP Hardware Blend Unit<br/>BLEND, NONE, ADD, SUBTRACT<br/>MSAA Resolve -> Framebuffer"]:::rop

    IA --> VS --> RAST --> FS --> ROP
`,
      },
    ],
  },
  {
    id: "vk2d-shader-book-fundamentals",
    title: "67. GPU & Shader Book II: Step-by-Step Vulkan2D Shader Guide (Line-by-Line)",
    category: "graphics",
    summary:
      "Your hands-on Vulkan2D shader textbook: every line of shaders/usershader.vert, every required Slang binding checked by ShaderCompiler.cpp, pixel vs local [0,1] UV math, complete C host code, and 3 starter-to-solution assignments.",
    sourceFiles: [
      "extern/Vulkan2d/docs/Shaders.md",
      "extern/Vulkan2d/assets/shader.slang",
      "extern/Vulkan2d/shaders/usershader.vert",
      "extern/Vulkan2d/VK2D/src/ShaderCompiler.cpp",
      "extern/Vulkan2d/VK2D/src/Shader.c",
      "extern/Vulkan2d/VK2D/src/Renderer.c",
      "extern/Vulkan2d/examples/testing/main.c",
    ],
    content: `
### Chapter 1: How a Custom Shader Lives Inside Vulkan2D

In raw Vulkan, writing a custom shader means creating a vertex shader, fragment shader, descriptor set layout, pipeline layout, 4 blend-mode \`VkPipeline\` objects, and per-frame uniform buffer uploads. **Vulkan2D compresses all of that into Slang Fragment Shaders**:
- You only write the **Pixel (Fragment) Shader** in **Slang** (\`.slang\`).
- When you call \`vk2dSlangFrom(source, len)\` or \`vk2dSlangLoad("assets/shader.slang")\`, \`_vk2dShaderCompile()\` in \`VK2D/src/ShaderCompiler.cpp\` compiles your Slang code to SPIR-V (\`SLANG_SPIRV\`, profile \`glsl_450\`), inspects its global variables with Slang reflection, verifies the 3 required bindings + optional \`ConstantBuffer\`, and auto-detects \`userDataSize\`.
- \`VK2D/src/Shader.c\` then pairs your fragment SPIR-V with VK2D's built-in vertex shader (\`VK2DVertUsershader\`, compiled from \`extern/Vulkan2d/shaders/usershader.vert\`) and pre-builds all 4 blend mode pipelines inside \`vk2dPipelineCreate(..., VK2D_PIPELINE_TYPE_USER_SHADER)\`!

*(Important Gotcha in \`VK2D/src/Shader.c\`! Look at line 97 of \`VK2D/src/Shader.c\` inside \`vk2dSlangLoad(const char *slangFile)\`: in this bundled snapshot of Vulkan2d, \`vk2dSlangLoad\` passes the hardcoded literal \`"assets/shader.slang"\` to \`_vk2dLoadFile()\`. To load **any** custom \`.slang\` filename reliably from disk in your own project, use this tiny 12-line helper around \`vk2dSlangFrom()\`:)*

\`\`\`c
VK2DShader loadCustomSlangFile(const char *path) {
  FILE *f = fopen(path, "rb");
  if (!f) return NULL;
  fseek(f, 0, SEEK_END);
  long size = ftell(f);
  rewind(f);
  char *src = malloc((size_t)size + 1);
  fread(src, 1, (size_t)size, f);
  fclose(f);
  src[size] = '\\0';
  VK2DShader shader = vk2dSlangFrom(src, (int)size);
  free(src);
  return shader;
}
\`\`\`

### Chapter 2: Line-by-Line Dissection of \`shaders/usershader.vert\`

Before your Slang \`PixelShader(float2 uv)\` runs, VK2D's built-in vertex shader \`extern/Vulkan2d/shaders/usershader.vert\` runs for all 6 vertices of your sprite quad. Understanding every line here tells you **exactly what \`uv\` and \`push\` contain** when they arrive in your pixel shader:

\`\`\`glsl
#version 450
#extension GL_ARB_separate_shader_objects : enable

const vec2 VERTICES[] = {
    vec2(0.0f, 0.0f), vec2(1.0f, 0.0f), vec2(1.0f, 1.0f),
    vec2(1.0f, 1.0f), vec2(0.0f, 1.0f), vec2(0.0f, 0.0f),
};

const vec2 TEX_COORDS[] = {
    vec2(0.0f, 0.0f), vec2(1.0f, 0.0f), vec2(1.0f, 1.0f),
    vec2(1.0f, 1.0f), vec2(0.0f, 1.0f), vec2(0.0f, 0.0f),
};

layout(push_constant) uniform PushBuffer {
    int cameraIndex;   // Offset 0  (4 B)
    uint textureIndex; // Offset 4  (4 B) + 8 B implicit std430 alignment pad
    vec4 texturePos;   // Offset 16 (16 B): xInTex, yInTex, texW, texH
    vec4 colour;       // Offset 32 (16 B): global colourMod RGBA
    mat4 model;        // Offset 48 (64 B): scale/rotate/translate around origin
} push;                // Total = 112 B

layout(set = 0, binding = 0) uniform UniformBufferObject {
    mat4 viewproj[10];
} ubo;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    vec2 newPos;
    newPos.x = VERTICES[gl_VertexIndex].x * push.texturePos.z;
    newPos.y = VERTICES[gl_VertexIndex].y * push.texturePos.w;
    gl_Position = ubo.viewproj[push.cameraIndex] * push.model * vec4(newPos, 1.0, 1.0);
    fragTexCoord.x = push.texturePos.x + (TEX_COORDS[gl_VertexIndex].x * push.texturePos.z);
    fragTexCoord.y = push.texturePos.y + (TEX_COORDS[gl_VertexIndex].y * push.texturePos.w);
}
\`\`\`

Walk through the two critical lines inside \`main()\`:
- **Line 46–48 (Screen Position):** \`VERTICES[gl_VertexIndex]\` is $(0,0)$ to $(1,1)$. Multiplying by \`push.texturePos.z\` (sprite width in pixels) and \`push.texturePos.w\` (sprite height in pixels) gives the sprite's true pixel dimensions before multiplying by \`push.model\` and the active camera's \`viewproj[push.cameraIndex]\`.
- **Line 49–50 (Pixel-Space \`fragTexCoord\`):** Look closely! \`TEX_COORDS\` ($0..1$) is multiplied by \`push.texturePos.zw\` (pixel width/height) and added to \`push.texturePos.xy\` (top-left pixel offset in a spritesheet). Therefore, the \`float2 uv\` parameter arriving in your Slang \`PixelShader(float2 uv)\` is **NOT** normalized $[0, 1]$! It is in **raw texture pixel coordinates**, e.g. $u \\in [0, 16],\\, v \\in [0, 16]$ for a $16 \\times 16$ caveguy sprite!

### Chapter 3: Line-by-Line Dissection of Your First Slang Shader & C Host

Let's examine every single line of a minimal working VK2D Slang shader side-by-side with the reflection checks in \`ShaderCompiler.cpp\`:

\`\`\`hlsl
// Lines 1-11: Push constants: MUST be named "push" of type "Push" and size == 112 B!
struct Push {
    int cameraIndex;     // [0..3]   Camera slot chosen by VK2D (0..9)
    uint textureIndex;   // [4..7]   Bindless slot ID inside textures[] (+8B auto pad)
    float4 texturePos;   // [16..31] (xInTex, yInTex, widthInTex, heightInTex) in pixels
    float4 colour;       // [32..47] Current vk2dRendererSetColourMod() RGBA
    float4x4 model;      // [48..111] 4x4 transform matrix (world pixels -> camera)
};
[[vk::push_constant]] Push push;

// Lines 13-15: Required global sampler & bindless texture array (exact names & bindings!)
[[vk::binding(1, 1)]] SamplerState sampler;
[[vk::binding(2, 2)]] Texture2D<float4> textures[];

// Lines 17-22: Optional user uniform block at Set 3, Binding 3 (auto-measured by reflection)
struct UserData {
    float time;          // Passed via void *data in vk2dRendererDrawShader()
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

// Lines 24-34: Entry point MUST be named "PixelShader" with [shader("pixel")]
[shader("pixel")]
float4 PixelShader(float2 uv) {
    // 1. Sample raw pixel-space texture coordinate using VK2D's unnormalized sampler
    float4 texColor = textures[push.textureIndex].Sample(sampler, uv);

    // 2. Convert pixel-space uv into normalized [0.0 .. 1.0] UVs for effects math
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;

    // 3. Tint gently using localUV.x and time
    float pulse = 0.5 + 0.5 * sin(userData.time * 4.0 + localUV.x * 6.28318);
    return float4(texColor.rgb * push.colour.rgb * (0.7 + 0.3 * pulse), texColor.a * push.colour.a);
}
\`\`\`

#### Line-by-Line Checklist of What \`_vk2dShaderCompile()\` Enforces (\`ShaderCompiler.cpp\`)

| Declaration in Your \`.slang\` File | Requirement in \`ShaderCompiler.cpp\` | What Happens If Wrong |
| --- | --- | --- |
| \`[[vk::push_constant]] Push push;\` | Variable name **must** be \`push\`, struct name \`Push\`, exact byte size **112**. | Logs error & returns \`false\` |
| \`[[vk::binding(1, 1)]] SamplerState sampler;\` | Variable name **must** be \`sampler\`, type \`SamplerState\`, Set \`1\`, Binding \`1\`. | Logs error & returns \`false\` |
| \`[[vk::binding(2, 2)]] Texture2D<float4> textures[];\` | Variable name **must** be \`textures\`, type \`Texture2D<float4>[]\`, Set \`2\`, Binding \`2\`. | Logs error & returns \`false\` |
| \`[[vk::binding(3, 3)]] ConstantBuffer<T> ...;\` | Optional. If present at Set \`3\`, Binding \`3\`, must be a \`ConstantBuffer\`. Size auto-detected! | Rejects non-\`ConstantBuffer\` |
| \`[shader("pixel")] float4 PixelShader(float2 uv)\` | Entry point **must** be named \`PixelShader\`. | Logs entrypoint error |

*(Why \`localUV\` Matters: Remember the formula $\\text{localUV} = (\\text{uv} - \\text{push.texturePos.xy}) / \\text{push.texturePos.zw}$. Whether your sprite is a full $512 \\times 512$ PNG or a single $16 \\times 16$ frame sliced from \`(32, 48, 16, 16)\` inside a massive spritesheet, \`localUV\` always spans cleanly from $(0, 0)$ at the top-left of that sprite to $(1, 1)$ at its bottom-right!)*

#### Complete Line-by-Line C Host Program

\`\`\`c
#include <SDL3/SDL.h>
#include "VK2D/VK2D.h"

// Must match UserData in Slang byte-for-byte (multiple of 4 bytes)
typedef struct MyShaderData {
  float time;
} MyShaderData;

int main(void) {
  SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS);
  SDL_Window *win = SDL_CreateWindow("VK2D Shader Book", 800, 600, SDL_WINDOW_VULKAN);
  VK2DRendererConfig cfg = { VK2D_MSAA_1X, VK2D_SCREEN_MODE_VSYNC, VK2D_FILTER_TYPE_NEAREST };
  vk2dRendererInit(win, cfg, NULL);

  VK2DTexture sprite = vk2dTextureLoad("assets/caveguy.png");
  VK2DShader shader = loadCustomSlangFile("assets/my_effect.slang");

  bool running = true;
  SDL_Event e;
  while (running) {
    while (SDL_PollEvent(&e)) {
      if (e.type == SDL_EVENT_QUIT) running = false;
    }
    MyShaderData data = { .time = (float)vk2dTime() };

    // Draw sprite at (320, 220), scaled 8x around center pivot (8, 8)
    vk2dRendererDrawShader(
        shader, &data, sprite,
        320, 220, 8.0f, 8.0f, 0.0f, 8.0f, 8.0f,
        0, 0, vk2dTextureWidth(sprite), vk2dTextureHeight(sprite));

    vk2dRendererPresent();
  }

  vk2dRendererWait(); // ALWAYS wait before freeing GPU assets!
  vk2dShaderFree(shader);
  vk2dTextureFree(sprite);
  vk2dRendererQuit();
  SDL_DestroyWindow(win);
  return 0;
}
\`\`\`

### Chapter 4: Line-by-Line Dissection of \`assets/shader.slang\` (The Rainbow Wave)

Let's dissect the actual pixel shader included in \`extern/Vulkan2d/assets/shader.slang\` (used in \`examples/main\` and \`examples/testing\`):

\`\`\`hlsl
[shader("pixel")]
float4 PixelShader(float2 uv) {
    float a = 1;
    float b = 0.3;
    float val1 = ((a - b) / 2) * sin(((uv.y + uv.x) / 2) + (userData.time)) + (((a - b) / 2) + b);
    float val2 = ((a - b) / 2) * sin(((uv.y + uv.x) / 2) + (userData.time + (3.141592635 * 0.25))) + (((a - b) / 2) + b);
    float val3 = ((a - b) / 2) * sin(((uv.y + uv.x) / 2) + (userData.time + (3.141592635 * 0.5))) + (((a - b) / 2) + b);
    float4 uv_colour = textures[push.textureIndex].Sample(sampler, uv);
    return float4((0.5 * uv_colour.r) * push.colour.r * (val1 * 2),
                  (0.5 * uv_colour.g) * push.colour.g * (val2 * 2),
                  (0.5 * uv_colour.b) * push.colour.b * (val3 * 2),
                  (uv_colour.a) * push.colour.a);
}
\`\`\`

- **Lines 32–33:** Sets the wave peak $a = 1.0$ and trough $b = 0.3$ so colors never dip completely to black.
- **Line 34 (\`val1\`: Red Wave):** Notice how \`((a - b) / 2) * sin(x) + ((a - b) / 2 + b)\` remaps $\\sin(x) \\in [-1, +1]$ smoothly into $[b, a] = [0.3, 1.0]$. Passing \`(uv.y + uv.x) / 2\` creates diagonal wave stripes moving across pixel coordinates, while \`userData.time\` scrolls those stripes continuously!
- **Lines 35–36 (\`val2\`, \`val3\`: Green & Blue Phase Shift):** Adding $\\pi/4$ ($45^\\circ$) to Green and $\\pi/2$ ($90^\\circ$) to Blue offsets the three color waves so the peaks chase one another like a scrolling rainbow.
- **Line 37:** Samples the original texel \`uv_colour\` once into fast registers.
- **Lines 38–41:** Multiplies RGB by the phase waves and preserves original alpha (\`uv_colour.a * push.colour.a\`) so transparent background pixels around the character stay invisible!

### Chapter 5: Graded Assignments 1–3 (With Starter Code & Full Solutions)

#### Assignment 1: Damage Hit-Flash & Stone Petrification Shader
- **Objective:** Write a shader with two floats in \`UserData\`: \`float flashAmount\` ($0.0 .. 1.0$) and \`float stoneAmount\` ($0.0 .. 1.0$). When \`stoneAmount > 0\`, blend the sprite smoothly toward grayscale luminance ($Y = 0.299 R + 0.587 G + 0.114 B$). Then, when \`flashAmount > 0\`, blend toward pure opaque white while keeping transparent background pixels untouched!
- **Starter Skeleton (Fill in \`PixelShader\`):**
\`\`\`hlsl
// Add Push, sampler, textures here...
struct UserData {
    float flashAmount; // 0.0 = normal, 1.0 = solid white hit flash
    float stoneAmount; // 0.0 = full color, 1.0 = grayscale statue
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 c = textures[push.textureIndex].Sample(sampler, uv);
    // TODO 1: Compute perceptual luminance y = dot(c.rgb, float3(0.299, 0.587, 0.114))
    // TODO 2: Blend c.rgb -> float3(y, y, y) using lerp(..., userData.stoneAmount)
    // TODO 3: Blend RGB -> float3(1.0, 1.0, 1.0) using lerp(..., userData.flashAmount)
    // TODO 4: Return final RGBA multiplied by push.colour
}
\`\`\`
- **Reference Solution (Shader + C Struct):**
\`\`\`c
// Matching C struct (8 bytes, 4-byte aligned -> valid for vk2dShaderFrom!)
typedef struct HitFlashData {
  float flashAmount;
  float stoneAmount;
} HitFlashData;
\`\`\`
\`\`\`hlsl
[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 c = textures[push.textureIndex].Sample(sampler, uv);
    float luma = dot(c.rgb, float3(0.299, 0.587, 0.114));
    float3 stoned = lerp(c.rgb, float3(luma, luma, luma), saturate(userData.stoneAmount));
    float3 flashed = lerp(stoned, float3(1.0, 1.0, 1.0), saturate(userData.flashAmount));
    return float4(flashed * push.colour.rgb, c.a * push.colour.a);
}
\`\`\`

#### Assignment 2: Normalized UV Pulsing Magic Forcefield
- **Objective:** Convert pixel \`uv\` into centered normalized coordinates $p \\in [-1, +1]^2$, measure distance $r = \\text{length}(p)$ from the sprite center, and draw an additive cyan shield ring at radius $r \\approx 0.85$ whose thickness pulses over \`userData.time\`—without any \`if\` branch divergence!
- **Reference Solution:**
\`\`\`hlsl
struct UserData {
    float time;
    float shieldStrength; // 0.0 .. 1.0
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 tex = textures[push.textureIndex].Sample(sampler, uv);
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float2 p = localUV * 2.0 - 1.0; // Center is (0, 0), edges are +/- 1.0
    float r = length(p);

    float pulseRadius = 0.80 + 0.06 * sin(userData.time * 5.0);
    // Peak 1.0 right on the ring, smoothly falling to 0.0 away from the ring
    float ring = 1.0 - smoothstep(0.0, 0.12, abs(r - pulseRadius));
    float3 shieldColor = float3(0.2, 0.9, 1.0) * ring * userData.shieldStrength;

    // Show sprite + glowing ring where either sprite is opaque OR ring is glowing
    float3 finalRGB = tex.rgb * push.colour.rgb + shieldColor;
    float finalA = max(tex.a, ring * userData.shieldStrength) * push.colour.a;
    return float4(finalRGB, finalA);
}
\`\`\`

#### Assignment 3: Retro 4-Shade Game Boy Quantizer & Ordered 2×2 Dither
- **Objective:** Use VK2D's pixel-space \`uv\` coordinates directly to look up a $2 \\times 2$ Bayer threshold matrix (adding crisp retro dithering) and snap the sprite luminance into 4 classic emerald-green shades!
- **Reference Solution:**
\`\`\`hlsl
[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 c = textures[push.textureIndex].Sample(sampler, uv);
    float luma = dot(c.rgb, float3(0.299, 0.587, 0.114));

    // Classic 2x2 Bayer matrix thresholds in pixel space (zero normalization needed!)
    int2 px = int2(floor(uv)) & 1; // 0 or 1 in X and Y
    float bayer = (px.x == 0 && px.y == 0) ? 0.00 :
                  (px.x == 1 && px.y == 0) ? 0.50 :
                  (px.x == 0 && px.y == 1) ? 0.75 : 0.25;

    // Quantize into 4 discrete tones (0, 1, 2, 3) with dithering bias
    float q = floor(saturate(luma + (bayer - 0.5) * 0.25) * 3.999) / 3.0;
    float3 gbDark  = float3(0.06, 0.22, 0.06);
    float3 gbLight = float3(0.61, 0.74, 0.06);
    float3 outRGB = lerp(gbDark, gbLight, q);
    return float4(outRGB * push.colour.rgb, c.a * push.colour.a);
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Line-by-Line Dataflow from C Host to usershader.vert and Slang PixelShader",
        chart: `
flowchart TD
    classDef host fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef vert fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef frag fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    Host["C Host: vk2dRendererDrawShader(shader, &data, tex, x, y, ...)<br/>Pushes 112B PushBuffer + Copies UserData to Set 3 Binding 3"]:::host
    Vert["shaders/usershader.vert<br/>Reads VERTICES(0..5) * texturePos.zw<br/>Emits gl_Position + pixel-space fragTexCoord"]:::vert
    Frag["Your Slang PixelShader(float2 uv)<br/>Reads push.textureIndex, Set 1 sampler, Set 2 textures, Set 3 userData<br/>Outputs final float4 RGBA"]:::frag

    Host --> Vert --> Frag
`,
      },
      {
        title: "Pixel-Space UV vs Normalized Local UV Coordinate Mapping",
        chart: `
flowchart LR
    classDef raw fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef norm fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef use fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    RawUV["Incoming Pixel uv<br/>e.g. (xInTex..xInTex+W, yInTex..yInTex+H)"]:::raw
    NormUV["localUV = (uv - push.texturePos.xy) / push.texturePos.zw<br/>Always 0.0 to 1.0 across current sprite"]:::norm
    TexSample["Texture Sampling & Pixel Neighbours<br/>textures[id].Sample(sampler, uv)<br/>or uv + float2(1, 0) for 1px step"]:::use
    MathFX["Normalized Vignettes, Rings & Waves<br/>length(localUV * 2.0 - 1.0)"]:::use

    RawUV --> TexSample
    RawUV --> NormUV --> MathFX
`,
      },
    ],
  },
  {
    id: "vk2d-shader-book-advanced-workshop",
    title: "68. GPU & Shader Book III: Advanced Effects, Alignment Rules & Assignments 4–7",
    category: "graphics",
    summary:
      "Master C-to-GPU memory alignment (std140/std430), write 4 production shaders line-by-line (atlas-safe water ripples, 1-pixel outlines, procedural dissolve, CRT post-processing), sample multiple bindless textures at once, and solve Assignments 4–7.",
    sourceFiles: [
      "extern/Vulkan2d/docs/Shaders.md",
      "extern/Vulkan2d/VK2D/src/ShaderCompiler.cpp",
      "extern/Vulkan2d/VK2D/src/Shader.c",
      "extern/Vulkan2d/VK2D/src/RendererMeta.c",
      "extern/Vulkan2d/examples/main/main.c",
      "extern/Vulkan2d/examples/retrolook/main.c",
    ],
    content: `
### Chapter 1: The C-to-GPU Memory Alignment Bible (\`std140\` / \`std430\` Rules)

Every bug where a shader "reads garbage numbers" from \`userData\` comes from **struct alignment mismatch** between your C compiler and Vulkan's GPU constant buffer rules (\`docs/Shaders.md\`). Look at why:
- A scalar (\`float\`, \`int\`, \`uint\`) takes **4 bytes** and aligns to **4 bytes**.
- A \`float2\` (\`vec2\`) takes **8 bytes** and aligns to **8 bytes**.
- A \`float4\` (\`vec4\`) takes **16 bytes** and **must start at a byte offset divisible by 16**!

Look at what happens when you put a \`float time\` right before a \`vec4 tint\` without padding:

\`\`\`c
// BROKEN C STRUCT (Size: 20 bytes)
typedef struct BrokenData {
  float time;   // Offset 0..3
  vec4 tint;    // C puts this at Offset 4..19! GPU reads Offset 16..31 (GARBAGE!)
} BrokenData;

// FIXED C STRUCT (Size: 32 bytes: matches Slang's std430/std140 layout!)
typedef struct FixedData {
  float time;     // Offset 0..3
  float _pad[3];  // Offset 4..15 (12 bytes of explicit padding)
  vec4 tint;      // Offset 16..31 (Starts cleanly at 16-byte boundary!)
} FixedData;
\`\`\`

*(Pro Golden Rule: Put all your \`vec4\` and \`mat4\` fields at the **top** of \`UserData\`, followed by \`vec2\` fields, followed by scalars—and always pack floats into multiples of 4 so \`sizeof(C_Struct) == userDataSize\` reported by Slang reflection!)*

### Chapter 2: Four Production Game Shaders Explained Line-by-Line

#### Production Shader 1: Atlas-Safe Water Ripple (No Sprite-Sheet Bleed!)

If you draw a sprite carved out of a spritesheet using \`vk2dRendererDrawShader\`, shifting \`uv\` carelessly with \`sin()\` can accidentally step outside \`push.texturePos\` and sample the boots or sword of the *neighboring sprite*! Always clamp displaced pixel UVs strictly inside \`[minUV, maxUV]\`:

\`\`\`hlsl
[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 minUV = push.texturePos.xy + float2(0.5, 0.5);
    float2 maxUV = push.texturePos.xy + push.texturePos.zw - float2(0.5, 0.5);
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;

    // Displace X slightly using vertical Y wave, tapering to 0 near edges
    float wave = sin(localUV.y * 25.0 + userData.time * 6.0) * 1.5;
    float2 safeUV = clamp(uv + float2(wave, 0.0), minUV, maxUV);

    float4 tex = textures[push.textureIndex].Sample(sampler, safeUV);
    return tex * push.colour;
}
\`\`\`

*(Why \`+ 0.5\` / \`- 0.5\`? Under \`VK_FILTER_LINEAR\`, texel centers sit at integer $+ 0.5$, so clamping 0.5 px inward guarantees bilinear filtering never blends with a neighbor frame in your atlas!)*

#### Production Shader 2: Crisp 1-Pixel Sprite Outline & Glowing Aura

Because VK2D's \`sampler\` sets \`unnormalizedCoordinates = VK_TRUE\`, adding \`float2(1.0, 0.0)\` to \`uv\` steps **exactly 1 texture pixel right**, regardless of whether the texture is $16 \\times 16$ or $2048 \\times 2048$! We can outline any transparent sprite in 10 lines with zero \`if\` divergence:

\`\`\`hlsl
struct UserData {
    float4 outlineColor; // Offset 0..15
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 center = textures[push.textureIndex].Sample(sampler, uv);

    // Sample 4 cardinal neighbors exactly 1 texel away
    float aRight = textures[push.textureIndex].Sample(sampler, uv + float2( 1.0,  0.0)).a;
    float aLeft  = textures[push.textureIndex].Sample(sampler, uv + float2(-1.0,  0.0)).a;
    float aDown  = textures[push.textureIndex].Sample(sampler, uv + float2( 0.0,  1.0)).a;
    float aUp    = textures[push.textureIndex].Sample(sampler, uv + float2( 0.0, -1.0)).a;

    // Is any neighbor opaque while center is transparent?
    float neighborOpaque = saturate(aRight + aLeft + aDown + aUp);
    float outlineMask = neighborOpaque * (1.0 - step(0.1, center.a));

    return lerp(center * push.colour, userData.outlineColor, outlineMask);
}
\`\`\`

#### Production Shader 3: Procedural Noise Dissolve with Emissive Burn Edge

No noise texture needed: a tiny 2D value-noise helper lets any boss or crate burn away into ash with an orange ember rim controlled by \`userData.dissolveProgress\` ($0.0 .. 1.0$):

\`\`\`hlsl
float hash21(float2 p) {
    p = frac(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return frac(p.x * p.y);
}

float valueNoise(float2 p) {
    float2 i = floor(p);
    float2 f = frac(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + float2(1.0, 0.0));
    float c = hash21(i + float2(0.0, 1.0));
    float d = hash21(i + float2(1.0, 1.0));
    return lerp(lerp(a, b, f.x), lerp(c, d, f.x), f.y);
}

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 tex = textures[push.textureIndex].Sample(sampler, uv);
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float n = valueNoise(localUV * 10.0);

    // Cut away pixels where noise < dissolveProgress (branchless alpha mask!)
    float alive = step(userData.progress, n);
    // Glowing orange ember band just above the threshold (+0.08 width)
    float ember = alive * (1.0 - step(userData.progress + 0.08, n));

    float3 rgb = lerp(tex.rgb * push.colour.rgb, float3(1.0, 0.42, 0.05), ember);
    return float4(rgb, tex.a * push.colour.a * alive);
}
\`\`\`

#### Production Shader 4: Full-Screen Offscreen CRT Post-Processing

Combine Chapter 58 (\`vk2dRendererSetTarget\`) with custom shaders to apply full-screen post-processing to your entire game:
1. Draw your entire game into an offscreen target texture \`VK2DTexture sceneTex = vk2dTextureCreate(w, h);\`.
2. Switch back to \`VK2D_TARGET_SCREEN\` and draw \`sceneTex\` using \`vk2dRendererDrawShader(crtShader, &time, sceneTex, 0, 0, ...)\`.
3. Inside \`crt.slang\`, sample Red, Green, and Blue at slightly shifted horizontal pixel coordinates for **Chromatic Aberration**, multiply alternating rows by a dark scanline sine wave, and darken the corners with a smooth vignette!

### Chapter 3: Sampling Multiple Bindless Textures in One Custom Shader

Because VK2D keeps **all loaded textures** inside the single global bindless array \`textures[]\` (Set 2, Binding 2), any custom shader can sample a second texture (such as a normal map, light mask, or lookup palette) simply by storing \`vk2dTextureGetID(secondTex)\` inside your \`UserData\` C struct!

\`\`\`c
typedef struct MultiTexData {
  uint32_t secondTexID; // Set via vk2dTextureGetID(normalMapTex)
  float strength;
  float pad0;
  float pad1;           // Padded cleanly to 16 bytes
} MultiTexData;
\`\`\`
\`\`\`hlsl
struct UserData {
    uint secondTexID;
    float strength;
    float pad0;
    float pad1;
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

// Sample sprite albedo from push.textureIndex AND secondary map from userData.secondTexID!
float4 albedo = textures[push.textureIndex].Sample(sampler, uv);
float4 mapSample = textures[userData.secondTexID].Sample(sampler, uv);
\`\`\`

### Chapter 4: Graded Assignments 4–7 (Advanced, With Starter Code & Full Solutions)

#### Assignment 4: Expanding Radial Shockwave Distortion (Post-Processing)
- **Objective:** Given an offscreen scene texture drawn via \`vk2dRendererDrawShader\`, take \`float2 centerLocal\` ($0..1$), \`float radius\`, \`float thickness\`, and \`float strength\` inside \`UserData\`, and refract pixels along the ring outward to create an explosion shockwave!
- **Reference Solution:**
\`\`\`hlsl
struct UserData {
    float2 centerLocal; // Normalized 0..1 explosion center
    float radius;
    float strength;     // 16 bytes total (two float2 slots aligned cleanly!)
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 minUV = push.texturePos.xy + 0.5;
    float2 maxUV = push.texturePos.xy + push.texturePos.zw - 0.5;
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;

    float2 delta = localUV - userData.centerLocal;
    float dist = length(delta) + 0.0001; // Avoid divide-by-zero at center
    float2 dir = delta / dist;

    float band = 1.0 - smoothstep(0.0, 0.08, abs(dist - userData.radius));
    float2 offsetPx = -dir * band * userData.strength;
    return textures[push.textureIndex].Sample(sampler, clamp(uv + offsetPx, minUV, maxUV)) * push.colour;
}
\`\`\`

#### Assignment 5: 9-Tap 3×3 Pixel Blur Kernel
- **Objective:** Sample the 9 pixels around \`uv\` at distance \`userData.blurRadiusPx\` using normalized $3 \\times 3$ box/Gaussian weights ($1, 2, 1 \\;/\\; 2, 4, 2 \\;/\\; 1, 2, 1$ divided by $16$) and clamp safely inside \`push.texturePos\`.
- **Reference Solution:**
\`\`\`hlsl
[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 minUV = push.texturePos.xy + 0.5;
    float2 maxUV = push.texturePos.xy + push.texturePos.zw - 0.5;
    float r = userData.blurRadiusPx;

    float4 sum = float4(0, 0, 0, 0);
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2(-r, -r), minUV, maxUV)) * 1.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2( 0, -r), minUV, maxUV)) * 2.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2( r, -r), minUV, maxUV)) * 1.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2(-r,  0), minUV, maxUV)) * 2.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2( 0,  0), minUV, maxUV)) * 4.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2( r,  0), minUV, maxUV)) * 2.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2(-r,  r), minUV, maxUV)) * 1.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2( 0,  r), minUV, maxUV)) * 2.0;
    sum += textures[push.textureIndex].Sample(sampler, clamp(uv + float2( r,  r), minUV, maxUV)) * 1.0;
    return (sum / 16.0) * push.colour;
}
\`\`\`

#### Assignment 6: Multi-Texture 2D Normal-Mapped Torch Light
- **Objective:** Pass \`uint normalTexID\` (from \`vk2dTextureGetID(normalTex)\`) and a 3D torch light position \`float3 lightLocal\` (where $x, y \\in [0, 1]$ and $z$ is height above sprite, e.g. \`0.18\`) in \`UserData\`. Decode the RGB normal map ($\\mathbf{N} = \\operatorname{normalize}(\\text{rgb} \\cdot 2.0 - 1.0)$) and shade your sprite with Lambertian diffuse lighting $\\max(\\mathbf{N} \\cdot \\mathbf{L}, 0)$ + ambient light!
- **Reference Solution:**
\`\`\`hlsl
struct UserData {
    float3 lightPosLocal; // [0..11]  (x, y, zHeight)
    uint normalTexID;     // [12..15] Exact 16-byte packed struct! Zero waste!
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 albedo = textures[push.textureIndex].Sample(sampler, uv);
    float3 normalRGB = textures[userData.normalTexID].Sample(sampler, uv).xyz;
    float3 N = normalize(normalRGB * 2.0 - 1.0);

    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float3 L = normalize(userData.lightPosLocal - float3(localUV, 0.0));
    float diff = max(dot(N, L), 0.0);

    float3 lit = albedo.rgb * (0.22 + 0.95 * diff * float3(1.0, 0.78, 0.45));
    return float4(lit * push.colour.rgb, albedo.a * push.colour.a);
}
\`\`\`

#### Assignment 7: Bypassing Slang to Load Raw Pre-Compiled SPIR-V (\`vk2dShaderFrom\`)
- **Objective:** If you build VK2D with \`-DVK2D_DISABLE_SHADERS=ON\` (disabling runtime Slang compilation) or want zero startup compile time, write a GLSL 450 fragment shader matching VK2D's descriptors (\`set 1\` sampler, \`set 2\` texture array, \`set 3\` uniform), compile it offline with \`glslc my_effect.frag -o my_effect.spv\`, and load it directly alongside \`VK2DVertUsershader\` (\`Blobs.h\`) using \`vk2dShaderFrom()\`!
- **Reference Solution (GLSL Fragment + C Loader):**
\`\`\`glsl
#version 450
#extension GL_EXT_nonuniform_qualifier : enable

layout(set = 1, binding = 1) uniform sampler texSampler;
layout(set = 2, binding = 2) uniform texture2D textures[];
layout(set = 3, binding = 3) uniform UserData { float time; } userData;

layout(push_constant) uniform PushBuffer {
    int cameraIndex; uint textureIndex; vec4 texturePos; vec4 colour; mat4 model;
} push;

layout(location = 0) in vec2 fragTexCoord;
layout(location = 0) out vec4 outColor;

void main() {
    vec4 tex = texture(sampler2D(textures[nonuniformEXT(push.textureIndex)], texSampler), fragTexCoord);
    outColor = tex * push.colour * (0.6 + 0.4 * sin(userData.time * 3.0));
}
\`\`\`
\`\`\`c
#include "VK2D/Blobs.h"
// Load spvBytes from disk, then create VK2DShader directly with zero Slang dependency:
VK2DShader precompiled = vk2dShaderFrom(
    VK2DVertUsershader, sizeof(VK2DVertUsershader),
    spvBytes, spvByteCount,
    sizeof(float)); // Must be a multiple of 4!
\`\`\`
`,
    mermaidCharts: [
      {
        title: "16-Byte ConstantBuffer Alignment: Broken C Struct vs Padded C Struct",
        chart: `
flowchart TD
    classDef broken fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;
    classDef pad fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef ok fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    subgraph Broken_Layout ["Broken C Struct (Mismatch!)"]
        B1["Bytes 0..3: float time"]:::broken
        B2["Bytes 4..19: vec4 tint (UNALIGNED!)<br/>GPU Slang reads Bytes 16..31 -> CORRUPTION"]:::broken
    end

    subgraph Fixed_Layout ["Fixed 16-Byte Aligned C Struct"]
        F1["Bytes 0..3: float time"]:::ok
        F2["Bytes 4..15: float _pad0..2 (12 B Pad)"]:::pad
        F3["Bytes 16..31: vec4 tint (Aligned to 16 B!)<br/>Matches Slang ConstantBuffer byte-for-byte"]:::ok
    end
`,
      },
      {
        title: "Offscreen Render Target + Multi-Texture Bindless Post-Processing Pipeline",
        chart: `
flowchart LR
    classDef scene fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef target fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef post fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    World["1. Draw World Sprites & Lights<br/>SetTarget(sceneTex) -> Empty() -> Draw"]:::scene
    TexID["2. Bindless Slot Ready<br/>push.textureIndex = GetID(sceneTex)<br/>userData.secondTexID = GetID(normalOrMaskTex)"]:::target
    Post["3. Draw Fullscreen Quad with Custom Shader<br/>SetTarget(SCREEN) -> DrawShader(postShader)"]:::post
    Final["4. Final Screen Image<br/>CRT, Shockwave, Blur or Normal-Mapped Lit World"]:::out

    World --> TexID --> Post --> Final
`,
      },
    ],
  },
  {
    id: "vk2d-shader-book-compute-and-shadows",
    title: "69. GPU & Shader Book IV: Compute Shaders, Vertex Projection & Hardware Blending",
    category: "graphics",
    summary:
      "Leave triangles behind with SIMT compute grids (dissecting all 85 lines of spritebatch.comp), master homogeneous w=0 infinity shadow projection in shadows.vert, understand ROP blend math and premultiplied alpha, and solve Assignments 8–10.",
    sourceFiles: [
      "extern/Vulkan2d/shaders/spritebatch.comp",
      "extern/Vulkan2d/shaders/shadows.vert",
      "extern/Vulkan2d/shaders/shadows.frag",
      "extern/Vulkan2d/VK2D/src/Pipeline.c",
    ],
    content: `
# 69. GPU & Shader Book IV: Compute Shaders, Vertex Projection & Hardware Blending

In Books I–III we mastered how a **Fragment (Pixel) Shader** colors pixels inside a quad. In Book IV, we step back and examine the other three programmable and fixed-function powerhouses on the GPU:
1. **Compute Shaders** (\`vkCmdDispatch\`), which run arbitrary parallel programs without any triangles, rasterizer, or screen pixels.
2. **Vertex Projection** (\`shadows.vert\`), which bends 4D homogeneous coordinates ($w = 1$ vs $w = 0$) to extrude 2D shadow volumes to infinity on the GPU.
3. **Hardware Blending (ROPs)**, which mixes your shader's output \`float4\` with the framebuffer at millions of pixels per millisecond.

---

### Chapter 1: Compute Shaders Explained From Zero

A graphics pipeline (Vertex + Rasterizer + Fragment) is specialized for turning triangles into pixels. A **Compute Shader** throws away the entire triangle machinery and gives you raw access to the GPU's SIMT cores as a giant parallel array processor.

#### How Dispatching a Grid Works

When the CPU calls \`vkCmdDispatch(cmd, groupCountX, groupCountY, groupCountZ)\`, it launches a 3D grid of **Workgroups**. Inside the shader, you declare how many threads live in each workgroup:

\`\`\`glsl
layout(local_size_x = 64, local_size_y = 1, local_size_z = 1) in;
\`\`\`

Why \`64\`? As we learned in Book I:
- On AMD RDNA GPUs, one **Wavefront** is 64 threads (or 32 in Wave32 mode).
- On NVIDIA GPUs, one **Warp** is 32 threads, so 64 threads cleanly fills **2 full warps** with zero wasted lanes.
- If you need to process $N = 10{,}000$ sprites, the CPU dispatches $\\lceil 10{,}000 / 64 \\rceil = 157$ workgroups ($157 \\times 64 = 10{,}048$ threads). The last 48 threads simply hit a bounds check \`if (gID < drawCount)\` and exit safely!

| Built-In Variable | Meaning in a 1D Compute Grid (\`local_size_x = 64\`) |
| :--- | :--- |
| \`gl_WorkGroupID.x\` | Which workgroup this thread belongs to ($0 .. \\text{groupCountX} - 1$) |
| \`gl_LocalInvocationID.x\` | Thread's local seat inside its workgroup ($0 .. 63$) |
| \`gl_GlobalInvocationID.x\` | Unique global index: \`gl_WorkGroupID.x * 64 + gl_LocalInvocationID.x\` |

#### Storage Buffers (SSBOs) vs Push Constants vs Shared Memory

Compute shaders read and write **Shader Storage Buffer Objects (SSBOs)** instead of returning a pixel color:
- **Push Constants** (\`112\`–\`128\` bytes): Tiny read-only parameters (e.g., \`uint drawCount\`, \`float dt\`). Fastest possible read.
- **SSBOs** (\`buffer ...\`): Megabytes of structured arrays in VRAM. Can be \`readonly\`, \`writeonly\`, or read-write.
- **Workgroup Shared Memory** (\`shared\` in GLSL, \`groupshared\` in HLSL/Slang): Typically \`32\` to \`64\` KB of ultra-fast on-chip SRAM shared only among the 64 threads inside the *same* workgroup. Use \`barrier()\` so all 64 threads finish writing to \`shared\` memory before any thread reads a neighbor's value.

---

### Chapter 2: Line-by-Line Dissection of \`shaders/spritebatch.comp\` (All 85 Lines)

Vulkan2D uses a compute shader (\`extern/Vulkan2d/shaders/spritebatch.comp\`) to transform thousands of tiny CPU sprite descriptions (\`DrawCommand\`) into full $4 \\times 4$ transformation matrices (\`DrawInstance\`) in parallel before drawing them in a single instanced draw call.

Let us read all 85 lines and dissect every single block:

\`\`\`glsl
#version 450

struct DrawInstance {
    vec4 texturePos;
    vec4 colour;
    uint textureIndex;
    mat4 model;
};

struct DrawCommand {
    vec4 texturePos;
    vec4 colour;
    vec2 pos;
    vec2 origin;
    vec2 scale;
    float rotation;
    uint textureIndex;
};

layout(push_constant) uniform PushBuffer {
    uint drawCount;
} ubo;

layout(std140, binding = 0) readonly buffer DrawCommandsIn {
    DrawCommand draws[ ];
} drawCommandsIn;

layout(std140, binding = 1) buffer DrawInstancesOut {
    DrawInstance draws[ ];
} drawInstancesOut;

layout (local_size_x = 64, local_size_y = 1, local_size_z = 1) in;
\`\`\`

- **Lines 3–18 (\`DrawInstance\` vs \`DrawCommand\`)**: On the CPU, building a $4 \\times 4$ matrix (64 bytes, 16 floats, 2 trig calls \`sin\`/\`cos\`, 4 matrix multiplies) for 50,000 sprites wastes CPU cycles and PCIe upload bandwidth. Instead, the CPU uploads a compact \`DrawCommand\` (just \`pos\`, \`origin\`, \`scale\`, \`rotation\`) and lets the GPU compute \`mat4 model\` in parallel!
- **Lines 20–22 (\`PushBuffer\`)**: Passes the exact number of sprites queued this frame (\`ubo.drawCount\`) in 4 bytes of push constant memory.
- **Lines 24–30 (Boundless Array SSBOs)**: \`DrawCommand draws[ ]\` has an unsized array bracket \`[ ]\`, meaning the GPU can read/write as many elements as fit inside the bound \`VkBuffer\`. Notice \`readonly\` on \`DrawCommandsIn\` allows the GPU texture/L1 cache to cache reads aggressively.
- **Line 32**: Launches 64 threads per workgroup along X.

Now inspect the matrix helper functions (lines 34–59):

\`\`\`glsl
mat4 translationMatrix(vec2 delta) {
    return mat4(
        vec4(1.0, 0.0, 0.0, 0.0),
        vec4(0.0, 1.0, 0.0, 0.0),
        vec4(0.0, 0.0, 1.0, 0.0),
        vec4(delta, 0.0, 1.0)
    );
}

mat4 scalingMatrix(vec2 scale) {
    return mat4(
        vec4(scale.x, 0.0, 0.0, 0.0),
        vec4(0.0, scale.y, 0.0, 0.0),
        vec4(0.0, 0.0, 1.0, 0.0),
        vec4(0.0, 0.0, 0.0, 1.0)
    );
}

mat4 zrotationMatrix(float theta) {
    return mat4(
        vec4(cos(theta), -sin(theta), 0.0, 0.0),
        vec4(sin(theta), cos(theta), 0.0, 0.0),
        vec4(0.0, 0.0, 1.0, 0.0),
        vec4(0.0, 0.0, 0.0, 1.0)
    );
}
\`\`\`

- **Column-Major Trap**: In GLSL, \`mat4(col0, col1, col2, col3)\` takes **4 columns**, NOT 4 rows! That is why \`vec4(delta, 0.0, 1.0)\` is the **4th argument** (column 3, the translation column), even though when written vertically in source code it looks like the bottom row.

Finally, lines 61–85 execute per sprite thread:

\`\`\`glsl
void main() {
    uint gID = gl_GlobalInvocationID.x;

    if (gID < ubo.drawCount) {
        DrawCommand draw = drawCommandsIn.draws[gID];
        mat4 model = mat4(1.0);
        draw.origin.x *= -draw.scale.x;
        draw.origin.y *= draw.scale.y;
        vec2 origin = {-draw.origin.x + draw.pos.x, draw.origin.y + draw.pos.y};
        vec2 originTranslation = {draw.origin.x, -draw.origin.y};

        // Assemble the model matrix
        model *= translationMatrix(origin);
        model *= zrotationMatrix(-draw.rotation);
        model *= translationMatrix(originTranslation);
        model *= scalingMatrix(draw.scale);

        // Copy data over
        drawInstancesOut.draws[gID].model = model;

        drawInstancesOut.draws[gID].texturePos = drawCommandsIn.draws[gID].texturePos;
        drawInstancesOut.draws[gID].colour = drawCommandsIn.draws[gID].colour;
        drawInstancesOut.draws[gID].textureIndex = drawCommandsIn.draws[gID].textureIndex;
    }
}
\`\`\`

- **Line 62**: Each GPU thread grabs its unique sprite index \`gID\`.
- **Line 64**: Tail threads where \`gID >= ubo.drawCount\` have their SIMT execution mask turned off so they never read or write out of bounds.
- **Lines 67–76 (Pivot Math)**: To rotate a sprite around an arbitrary \`origin\` (like a sword hilt or wheel center) instead of its top-left corner, you must:
  1. \`scalingMatrix(draw.scale)\`: Scale the unit quad \`[0..1]\` to pixel width/height.
  2. \`translationMatrix(originTranslation)\`: Shift the pivot point to \`(0, 0)\`.
  3. \`zrotationMatrix(-draw.rotation)\`: Rotate around \`(0, 0)\`.
  4. \`translationMatrix(origin)\`: Shift the rotated sprite to its final world position \`draw.pos\`.
- **Lines 79–83**: Writes the finished \`model\` matrix and copies \`texturePos\`, \`colour\`, and \`textureIndex\` into \`drawInstancesOut\` so the upcoming \`vkCmdDrawIndexed\` instanced pass can read everything sequentially.

---

### Chapter 3: Vertex Projection & $w = 0$ Infinity Rays (\`shadows.vert\`)

Most 2D shaders treat vertex shaders as boring pass-throughs. \`extern/Vulkan2d/shaders/shadows.vert\` shows how a vertex shader can **extrude 2D wall edges into infinite shadow quads** on the fly without the CPU ever building shadow triangles!

\`\`\`glsl
#version 450
#extension GL_ARB_separate_shader_objects : enable

layout(set = 0, binding = 0) uniform UniformBufferObject {
    mat4 viewproj[10];
} ubo;

layout(push_constant) uniform PushBuffer {
    mat4 model;
    vec2 lightSource;
    vec2 _alignment;
    vec4 colour;
    int cameraIndex;
} pushBuffer;

layout(location = 0) in vec3 inPosition;

out gl_PerVertex {
    vec4 gl_Position;
};

void main() {
    int mod = gl_VertexIndex % 6;
    vec4 position = pushBuffer.model * vec4(inPosition, 1.0);
    if (mod == 1 || mod == 4 || mod == 5) {
        // One of the vertices that needs to be projected
        vec4 vertex = vec4(
            (position.x - pushBuffer.lightSource.x) * 1000,
            (position.y - pushBuffer.lightSource.y) * 1000,
            1.0,
            0.0
        );
        gl_Position = ubo.viewproj[pushBuffer.cameraIndex] * vertex;
    } else {
        // Static vertices
        gl_Position = ubo.viewproj[pushBuffer.cameraIndex] * position;
    }
}
\`\`\`

#### Why \`w = 0.0\` Projects to Infinity

In 4D **Homogeneous Coordinates** $(x, y, z, w)$, the GPU rasterizer divides $(x, y, z)$ by $w$ right after the vertex shader (**Perspective Divide**):

$$\\text{NDC} = \\left(\\frac{x}{w},\\; \\frac{y}{w},\\; \\frac{z}{w}\\right)$$

- **Lines 35–36 (Static Wall Vertices, \`w = 1.0\`)**: \`position\` has $w = 1.0$, so dividing by $1.0$ leaves it pinned right on the wall edge.
- **Lines 27–32 (Extruded Shadow Vertices, \`w = 0.0\`)**: When $w = 0.0$, the vector represents a **pure direction** (a point at mathematical infinity along the ray from \`lightSource\` through \`position\`). Modern GPUs clip triangles in 4D homogeneous clip space *before* dividing by $w$, so \`gl_Position\` cleanly stretches the shadow quad all the way to the edge of the screen without dividing by zero!
- **Line 23 (\`gl_VertexIndex % 6\`)**: Every wall edge is drawn as 6 vertices (2 triangles = 1 quad). Vertices \`0, 2, 3\` stay glued to the wall; vertices \`1, 4, 5\` shoot away from the light!
- **\`shadows.frag\`**: Simply outputs \`outColor = vec4(pushBuffer.colour);\` (typically opaque black or dark translucent shadow tint).

---

### Chapter 4: Hardware Blending (ROPs) & Premultiplied Alpha

After your fragment shader returns \`float4 srcColor\`, it does **not** directly overwrite the screen. First it enters the fixed-function **ROP (Render Output Unit)**, which reads the existing pixel \`dstColor\` from VRAM and computes:

$$\\text{outRGB} = \\text{srcRGB} \\cdot F_{\\text{src}} \\;\\oplus\\; \\text{dstRGB} \\cdot F_{\\text{dst}}$$

| VK2D Blend Mode | Blend Equation | Visual Effect |
| :--- | :--- | :--- |
| \`VK2D_BLEND_MODE_BLEND\` | $\\text{src} \\cdot \\alpha_{\\text{src}} + \\text{dst} \\cdot (1 - \\alpha_{\\text{src}})$ | Standard alpha transparency (sprites, UI) |
| \`VK2D_BLEND_MODE_ADD\` | $\\text{src} \\cdot \\alpha_{\\text{src}} + \\text{dst} \\cdot 1$ | Glowing fire, lasers, bloom, magic sparks |
| \`VK2D_BLEND_MODE_SUBTRACT\` | $\\text{dst} \\cdot 1 - \\text{src} \\cdot \\alpha_{\\text{src}}$ | Darkening masks, ink/shadow cutouts |
| \`VK2D_BLEND_MODE_NONE\` | $\\text{src} \\cdot 1 + \\text{dst} \\cdot 0$ | Direct overwrite (fastest; skips reading \`dst\`) |

#### The Dark Fringe Bug & Premultiplied Alpha

Have you ever scaled a sprite with bilinear filtering and noticed ugly **dark black halos** around soft edges?
- Suppose a sprite has a bright yellow pixel \`(1, 1, 0, 1)\` next to a transparent black pixel \`(0, 0, 0, 0)\`.
- Halfway between them, bilinear interpolation averages them to \`(0.5, 0.5, 0.0, 0.5)\`.
- Under standard \`BLEND\`, the ROP multiplies \`srcRGB\` by \`srcAlpha\` *again*: \`0.5 * 0.5 = 0.25\` yellow! That lost brightness creates a muddy dark ring.
- **Fix (Premultiplied Alpha)**: Store or output \`float4(rgb * alpha, alpha)\` and blend with \`ONE, ONE_MINUS_SRC_ALPHA\`, or ensure transparent pixels in your PNG share the neighbor's RGB color instead of \`(0, 0, 0, 0)\`!

---

### Chapter 5: Graded Assignments 8–10 (With Starter Code & Full Solutions)

#### Assignment 8: Write a 1D GPU Particle Integrator Compute Shader
- **Objective:** Write a GLSL 450 compute shader (\`local_size_x = 64\`) that updates an array of \`Particle\` structs (\`vec2 pos\`, \`vec2 vel\`, \`float life\`, \`float pad[3]\` to align cleanly) with gravity \`(0, 480)\`, drag \`0.99\`, floor bounce at \`y = 700\`, and \`if (id >= push.count) return;\`.
- **Starter Skeleton:**
\`\`\`glsl
#version 450
struct Particle {
    vec2 pos;
    vec2 vel;
    float life;
    float pad0;
    float pad1;
    float pad2;
};
layout(push_constant) uniform Push { uint count; float dt; } push;
layout(std140, binding = 0) buffer Particles { Particle p[]; } buf;
layout(local_size_x = 64, local_size_y = 1, local_size_z = 1) in;

void main() {
    // TODO: 1. Compute global thread ID and guard against push.count
    // TODO: 2. Integrate vel += vec2(0.0, 480.0) * push.dt; vel *= 0.99;
    // TODO: 3. Integrate pos += vel * push.dt;
    // TODO: 4. Bounce off floor y = 700.0 (invert vel.y * -0.65) and decrement life
}
\`\`\`
- **Reference Solution:**
\`\`\`glsl
void main() {
    uint id = gl_GlobalInvocationID.x;
    if (id >= push.count) return;

    Particle pt = buf.p[id];
    pt.vel += vec2(0.0, 480.0) * push.dt;
    pt.vel *= pow(0.99, push.dt * 60.0);
    pt.pos += pt.vel * push.dt;

    if (pt.pos.y > 700.0) {
        pt.pos.y = 700.0;
        pt.vel.y = -abs(pt.vel.y) * 0.65;
    }
    pt.life = max(0.0, pt.life - push.dt);
    buf.p[id] = pt;
}
\`\`\`

#### Assignment 9: Custom Vertex Shader Wind Sway via \`vk2dShaderFrom\`
- **Objective:** Remember from Assignment 7 that \`vk2dShaderFrom(vertSpv, vertSize, fragSpv, fragSize, userSize)\` lets you replace \`VK2DVertUsershader\` with your **own custom vertex shader**! Modify \`shaders/usershader.vert\` in GLSL 450 so the top two vertices of a grass or banner sprite sway horizontally with \`sin(time * 3.0 + pos.x * 0.05)\`, while the bottom vertices stay anchored to the ground!
- **Hint:** In \`usershader.vert\`, \`inPosition\` is \`(0,0)\` at top-left, \`(1,0)\` at top-right, \`(0,1)\` at bottom-left, and \`(1,1)\` at bottom-right! So \`float swayMask = 1.0 - inPosition.y;\` equals \`1.0\` at the top and \`0.0\` at the roots!
- **Reference Solution (GLSL 450 Vertex Shader):**
\`\`\`glsl
#version 450
layout(set = 0, binding = 0) uniform UniformBufferObject { mat4 viewproj[10]; } ubo;
layout(set = 3, binding = 3) uniform UserData { float time; float strengthPx; } userData;

layout(push_constant) uniform PushBuffer {
    int cameraIndex; uint textureIndex; vec4 texturePos; vec4 colour; mat4 model;
} push;

layout(location = 0) in vec2 inPosition;
layout(location = 0) out vec2 fragTexCoord;

void main() {
    vec4 worldPos = push.model * vec4(inPosition, 0.0, 1.0);
    float topWeight = 1.0 - inPosition.y; // 1.0 at top edge, 0.0 at bottom roots
    worldPos.x += sin(userData.time * 3.5 + worldPos.y * 0.02) * userData.strengthPx * topWeight;

    gl_Position = ubo.viewproj[push.cameraIndex] * worldPos;
    fragTexCoord = push.texturePos.xy + (inPosition * push.texturePos.zw);
}
\`\`\`

#### Assignment 10: Additive Energy Halo + Premultiplied Fringe Cleaner
- **Objective:** Draw a soft circular energy orb in Slang intended for \`vk2dRendererSetBlendMode(VK2D_BLEND_MODE_ADD)\`, using smooth radial falloff \`pow(1.0 - saturate(dist * 2.0), 2.5)\` and premultiplying \`rgb\` by \`alpha\` so additive blending adds zero black artifacts.
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float3 glowColor; float intensity; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float d = length(localUV - float2(0.5, 0.5)) * 2.0; // 0 at center, 1 at edge
    float falloff = pow(saturate(1.0 - d), 2.5);
    float3 rgb = userData.glowColor * userData.intensity * falloff;
    return float4(rgb, falloff); // RGB already scaled by falloff for clean additive ROP!
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Compute Shader 1D Dispatch: Workgroups, Global IDs & SIMT Tail Masking",
        chart: `
flowchart LR
    classDef cpu fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef wg fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef lane fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef masked fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;

    Dispatch["CPU: vkCmdDispatch(157, 1, 1)<br/>drawCount = 10,000 sprites"]:::cpu
    WG0["Workgroup 0..155<br/>64 Active Threads Each<br/>gID = wgID * 64 + localID"]:::wg
    WGLast["Tail Workgroup 156<br/>gID 9,984 .. 10,047"]:::wg
    Active["Lanes 0..15 (gID < 10,000)<br/>Compute Model Matrix & Copy"]:::lane
    Inactive["Lanes 16..63 (gID >= 10,000)<br/>Execution Mask = 0 (Safe No-Op)"]:::masked

    Dispatch --> WG0 --> Active
    Dispatch --> WGLast --> Active
    WGLast --> Inactive
`,
      },
      {
        title: "Projective Shadow Volume Extrusion (w=1 Wall Edge vs w=0 Infinity Ray)",
        chart: `
flowchart TD
    classDef light fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef static fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef ray fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef clip fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Light["Light Source (lx, ly)"]:::light
    Wall["Wall Segment Endpoints<br/>gl_VertexIndex % 6 in {0,2,3}<br/>w = 1.0 (Pinned to Wall)"]:::static
    Extrude["Extruded Ray Vertices<br/>gl_VertexIndex % 6 in {1,4,5}<br/>vec4(pos - light, 1.0, w = 0.0)"]:::ray
    Proj["4D ViewProj Clipping + Rasterizer<br/>Covers Screen to Infinity"]:::clip

    Light --> Wall
    Light --> Extrude
    Wall --> Proj
    Extrude --> Proj
`,
      },
    ],
  },
  {
    id: "vk2d-shader-book-debugging-and-performance",
    title: "70. GPU & Shader Book V: SDFs, Performance Profiling & Debugging Like a Graphics Engineer",
    category: "graphics",
    summary:
      "Build resolution-independent 2D SDFs with hardware fwidth() anti-aliasing, triage CPU vs ALU vs TMU vs Overdraw GPU bottlenecks, debug NaN/UVs visually and in RenderDoc, and solve Capstone Assignments 11–13.",
    sourceFiles: [
      "extern/Vulkan2d/assets/shader.slang",
      "extern/Vulkan2d/VK2D/src/Renderer.c",
      "extern/Vulkan2d/VK2D/src/Pipeline.c",
    ],
    content: `
# 70. GPU & Shader Book V: SDFs, Performance Profiling & Debugging Like a Graphics Engineer

Welcome to the final volume of the Vulkan2D GPU & Shader Book. Now that you understand GPU hardware, Slang fragment shaders, alignment rules, compute grids, and blending, we tackle the three skills that separate a casual shader writer from a production graphics engineer:
1. **Signed Distance Fields (SDFs)** for infinitely sharp UI, outlines, and fluid shapes at any zoom level.
2. **GPU Bottleneck Triage** so you know *why* a frame takes 16 ms instead of 2 ms.
3. **Visual Shader Debugging & RenderDoc**, because GPUs have no \`printf()\`.

---

### Chapter 1: Signed Distance Fields (SDFs) & \`fwidth()\` Anti-Aliasing

A bitmap sprite stores colors on a fixed pixel grid. Zoom in $10\\times$ and it turns into blurry or blocky squares. A **Signed Distance Field (SDF)** replaces the bitmap with a pure math function $d = f(p)$ returning the **shortest Euclidean distance** from pixel $p$ to the shape's boundary:
- $d < 0$: Pixel is **inside** the shape.
- $d = 0$: Pixel lies **exactly on** the border.
- $d > 0$: Pixel is **outside** the shape.

#### Essential 2D SDF Primitives (Line-by-Line)

\`\`\`hlsl
// 1. Circle centered at origin with radius r
float sdCircle(float2 p, float r) {
    return length(p) - r;
}

// 2. Rounded Box with half-extents b = (halfW, halfH) and corner radius r
float sdRoundedBox(float2 p, float2 b, float r) {
    float2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// 3. Smooth Minimum (Polynomial smin) for liquid metaball blending!
float smin(float a, float b, float k) {
    float h = saturate(0.5 + 0.5 * (b - a) / k);
    return lerp(b, a, h) - k * h * (1.0 - h);
}
\`\`\`

- **CSG Boolean Operations** take just one intrinsic:
  - **Union (Combine):** \`min(d1, d2)\`
  - **Intersection (Overlap):** \`max(d1, d2)\`
  - **Subtraction (Carve d2 out of d1):** \`max(d1, -d2)\`
  - **Thick Outline Ring:** \`abs(d) - thickness\`

#### Hardware Anti-Aliasing in One Line: \`fwidth(d)\`

Remember from Book I that the GPU always executes fragment shaders in **$2 \\times 2$ pixel quads**? That exists specifically so the hardware can compute finite differences between neighboring pixels in **1 instruction**:
- \`ddx(d)\` = how much \`d\` changes per 1 pixel step horizontally.
- \`ddy(d)\` = how much \`d\` changes per 1 pixel step vertically.
- \`fwidth(d)\` = \`abs(ddx(d)) + abs(ddy(d))\` = **the exact width of 1 screen pixel in SDF units**, regardless of camera zoom or sprite scale!

\`\`\`hlsl
// Razor-sharp 1-pixel anti-aliased alpha at ANY resolution or zoom!
float aa = fwidth(d);
float alpha = 1.0 - smoothstep(-aa, aa, d);
\`\`\`

---

### Chapter 2: GPU Performance Profiling & Bottleneck Hunting

When your frame rate drops, guessing "maybe my shader has too many lines" almost always wastes time. GPUs fail in four distinct ways:

| Bottleneck Type | Symptom | Root Cause in Vulkan2D | Concrete Fix |
| :--- | :--- | :--- | :--- |
| **CPU / Draw-Call Bound** | GPU is idle between draws; high CPU frame time | Calling \`vk2dRendererDrawShader\` or switching blend modes 5,000 times per frame | Batch normal sprites with \`vk2dRendererDrawTexture\`; group same-shader draws together |
| **ALU (Math) Bound** | Frame time scales with math complexity, not texture count | Nested loops, \`pow\`, \`sin\`/\`cos\`, \`sqrt\` in SFUs inside every pixel | Precompute constants on CPU; replace \`pow(x, 2.0)\` with \`x * x\`; use \`dot(v, v)\` instead of \`length(v)\` |
| **TMU / Bandwidth Bound** | Frame time drops sharply when screen resolution shrinks | 25+ texture taps per pixel (large blur) or random noisy UVs thrashing L1 cache | Use separable 2-pass blur (horizontal + vertical = $9 + 9 = 18$ taps instead of $9 \\times 9 = 81$!) |
| **ROP / Overdraw Bound** | Massive slowdowns when large particle clouds overlap | Drawing 30 fullscreen translucent layers over the same pixel | Tight-crop sprite quads; discard/cull invisible particles; keep blend modes \`NONE\` for opaque background |

#### Three Hidden Shader Performance Traps

1. **\`discard\` (\`clip\`) Kills Early-Z**: If a fragment shader contains \`discard\`, the GPU cannot know whether a pixel survives until *after* running the shader, disabling Early-Z hardware culling. Prefer alpha blending when possible, or only \`discard\` on genuinely opaque cutout masks.
2. **Non-Uniform Bindless Indexing**: If adjacent threads in a 32-lane warp read \`textures[idx]\` with *different* \`idx\` values (e.g., per-pixel procedural \`idx\`), the GPU cannot issue one texture instruction; it loops sequentially over each unique \`idx\` in the warp (scalarization). For uniform per-draw \`push.textureIndex\`, all 32 lanes share the exact same slot at full speed!
3. **Scalar vs Vector Operations**: Modern AMD RDNA and NVIDIA GPUs are **scalar** under the hood (\`float4\` takes 4 instructions, not 1!). Computing \`rgb\` when you only need \`a\` wastes 3 ALU cycles.

---

### Chapter 3: Debugging Shaders Without \`printf\`

When a custom shader outputs a black screen or corrupted colors, treat **color channels as a visual oscilloscope**:

\`\`\`hlsl
// 1. Verify UV range (Should show smooth Red left->right, Green top->bottom)
return float4(localUV, 0.0, 1.0);

// 2. Verify UserData arrived intact (Pulse brightness if value > 0)
return float4(saturate(userData.time * 0.2), 0.0, 0.0, 1.0);

// 3. Catch NaN / Infinity poison (Flash bright magenta if ANY pixel is NaN!)
if (any(isnan(finalColor)) || any(isinf(finalColor))) {
    return float4(1.0, 0.0, 1.0, 1.0);
}
\`\`\`

Why catch \`NaN\` aggressively? If a single pixel computes \`normalize(float2(0, 0))\` or \`pow(-0.5, 2.2)\`, it outputs \`NaN\`. When a bloom or blur pass samples that pixel next frame, \`NaN + neighbor = NaN\`, turning your entire screen into spreading black squares!

#### Inspecting a VK2D Frame in RenderDoc

1. Launch your compiled Vulkan2D executable from **RenderDoc** (\`Launch Application\` + press \`F12\` to capture a single frame).
2. In the **Event Browser**, locate your \`vkCmdDraw(4, 1, ...)\` call (from \`vk2dRendererDrawShader\`).
3. Open **Pipeline State -> Fragment Shader (FS)**:
   - Inspect **Push Constants** (\`cameraIndex\`, \`textureIndex\`, \`texturePos\`, \`colour\`, \`model\`).
   - Inspect **Descriptor Set 2 Binding 2** to see every texture currently alive in VK2D's bindless array.
   - Inspect **Descriptor Set 3 Binding 3** to verify the exact raw bytes your C \`UserData\` struct uploaded!
4. Right-click any pixel in the **Texture Viewer** and click **Debug** to step line-by-line through your Slang/SPIR-V variables!

---

### Chapter 4: Graded Assignments 11–13 (Capstone Labs & Full Solutions)

#### Assignment 11: Resolution-Independent SDF Health Bar With \`fwidth()\` AA
- **Objective:** Draw a pill-shaped health bar entirely inside \`PixelShader\` (zero texture reads!) using \`sdRoundedBox\`, \`userData.hpRatio\` ($0..1$), green-to-red health fill, dark background track, crisp 2-pixel border, and \`fwidth()\` anti-aliasing.
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float hpRatio; float aspect; float pad0; float pad1; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

float sdRoundedBox(float2 p, float2 b, float r) {
    float2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    // Remap to aspect-corrected space centered at (0,0)
    float2 p = (localUV - 0.5) * float2(userData.aspect, 1.0);
    float dOuter = sdRoundedBox(p, float2(userData.aspect * 0.46, 0.38), 0.22);

    float aa = fwidth(dOuter);
    float outerMask = 1.0 - smoothstep(-aa, aa, dOuter);
    float innerMask = 1.0 - smoothstep(-aa, aa, dOuter + 0.05);

    float fillOn = step(localUV.x, userData.hpRatio);
    float3 hpCol = lerp(float3(0.95, 0.2, 0.15), float3(0.15, 0.9, 0.35), userData.hpRatio);
    float3 trackCol = lerp(float3(0.12, 0.12, 0.16), hpCol, fillOn);
    float3 finalRGB = lerp(float3(0.85, 0.88, 0.95), trackCol, innerMask);
    return float4(finalRGB * push.colour.rgb, outerMask * push.colour.a);
}
\`\`\`

#### Assignment 12: Liquid Metaball Energy Slime (\`smin\` CSG)
- **Objective:** Combine two orbiting circles using polynomial \`smin(d1, d2, 0.18)\` so they stretch and merge like mercury droplets, shaded with an inner core highlight and \`fwidth()\` smooth edge!
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float time; float pad0; float pad1; float pad2; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

float smin(float a, float b, float k) {
    float h = saturate(0.5 + 0.5 * (b - a) / k);
    return lerp(b, a, h) - k * h * (1.0 - h);
}

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float2 p = localUV - 0.5;
    float2 c1 = float2(cos(userData.time * 2.0) * 0.16, sin(userData.time * 1.3) * 0.08);
    float2 c2 = -c1;

    float d = smin(length(p - c1) - 0.15, length(p - c2) - 0.13, 0.18);
    float aa = fwidth(d);
    float alpha = 1.0 - smoothstep(-aa, aa, d);
    float core = 1.0 - smoothstep(-0.08, 0.0, d);
    float3 rgb = lerp(float3(0.15, 0.55, 1.0), float3(0.75, 0.96, 1.0), core);
    return float4(rgb, alpha) * push.colour;
}
\`\`\`

#### Assignment 13: Capstone Multi-Pass NaN-Safe Bloom Pipeline
- **Objective:** Build a 2-shader offscreen bloom pipeline:
  1. Render your world into \`sceneTex\`.
  2. Draw \`sceneTex\` into a half-res \`bloomTex\` using a **Bright-Pass Threshold Shader** (extracting pixels with luminance $> 0.8$ while sanitizing \`isnan\`/\`isinf\`).
  3. Draw \`sceneTex\` to \`VK2D_TARGET_SCREEN\`, then switch to \`VK2D_BLEND_MODE_ADD\` and draw \`bloomTex\` over it with a 5-tap cross blur!
- **Reference Solution (Bright-Pass Extract Slang Shader):**
\`\`\`hlsl
struct UserData { float threshold; float intensity; float pad0; float pad1; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 c = textures[push.textureIndex].Sample(sampler, uv);
    // Sanitize NaNs/Infs before threshold so bloom never spreads black squares!
    if (any(isnan(c)) || any(isinf(c))) return float4(0, 0, 0, 1);

    float luma = dot(c.rgb, float3(0.2126, 0.7152, 0.0722));
    float weight = smoothstep(userData.threshold, userData.threshold + 0.25, luma);
    return float4(c.rgb * weight * userData.intensity, 1.0);
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "2×2 Pixel Quad Derivatives: How fwidth(d) Achieves Crisp Zoom-Free Edges",
        chart: `
flowchart LR
    classDef quad fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef diff fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef edge fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Quad["2x2 Pixel Quad in Rasterizer<br/>P00, P10, P01, P11 Run Together"]:::quad
    Diff["Hardware Finite Differences<br/>ddx = d(P10) - d(P00)<br/>ddy = d(P01) - d(P00)"]:::diff
    FWidth["fwidth(d) = abs(ddx) + abs(ddy)<br/>Exact 1-Pixel Transition Width"]:::diff
    AA["smoothstep(-aa, aa, d)<br/>Zero Jaggies at Any Zoom"]:::edge

    Quad --> Diff --> FWidth --> AA
`,
      },
      {
        title: "GPU Bottleneck Triage Decision Tree",
        chart: `
flowchart TD
    classDef start fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef branch fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef fix fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Q["Slow Frame Rate: Shrink Window Resolution 50%"]:::start
    ResCheck{"Did Frame Time Drop<br/>Noticeably?"}:::branch
    CPU["CPU or Draw-Call Bound<br/>Batch Sprites, Reduce State Switches"]:::fix
    PixelBound{"Halve Texture Taps or<br/>Replace Shader with Flat Color"}:::branch
    TMU["TMU / Bandwidth Bound<br/>Use Separable Blur, Mipmaps"]:::fix
    ALUOrROP["ALU or Overdraw Bound<br/>Simplify Math, Trim Overdraw Quads"]:::fix

    Q --> ResCheck
    ResCheck -->|"No (Same ms)"| CPU
    ResCheck -->|"Yes (Much Faster)"| PixelBound
    PixelBound -->|"Much Faster"| TMU
    PixelBound -->|"Check Math vs Layers"| ALUOrROP
`,
      },
    ],
  },
  {
    id: "vk2d-shader-book-vertex-pulling-color",
    title: "71. GPU & Shader Book VI: Vertex Pulling, Color Spaces (sRGB vs Linear) & Procedural Palettes",
    category: "graphics",
    summary:
      "Draw thousands of sprites with zero vertex buffers using programmable vertex pulling (dissecting instanced.vert, instanced.frag, and colour.vert line-by-line), master sRGB vs Linear light math and cosine palettes, and solve Assignments 14–16.",
    sourceFiles: [
      "extern/Vulkan2d/shaders/instanced.vert",
      "extern/Vulkan2d/shaders/instanced.frag",
      "extern/Vulkan2d/shaders/colour.vert",
      "extern/Vulkan2d/shaders/colour.frag",
    ],
    content: `
# 71. GPU & Shader Book VI: Vertex Pulling, Color Spaces (sRGB vs Linear) & Procedural Palettes

In Books I–V we covered GPU hardware, Slang fragment shaders, alignment rules, compute grids, blending, SDFs, and debugging. Now in **Book VI** we uncover two secrets behind clean, fast 2D engines:
1. **Programmable Vertex Pulling**: How Vulkan2D draws thousands of sprites in a single call *without binding a vertex buffer* (\`instanced.vert\` and \`instanced.frag\`).
2. **Color Spaces & Procedural Palettes**: Why lighting and gradients look muddy if you mix up **sRGB** and **Linear** light, and how to generate rich palettes with 4 lines of math instead of lookup textures.

---

### Chapter 1: Vertex Pulling: Drawing 50,000 Quads With Zero Vertex Buffers

Normally, beginners are taught to allocate a giant \`VkBuffer\` full of vertex positions and UVs, bind it with \`vkCmdBindVertexBuffers\`, and configure \`VkVertexInputAttributeDescription\`. Modern Vulkan engines often skip all of that using **Programmable Vertex Pulling**.

In \`extern/Vulkan2d/shaders/instanced.vert\` (all 62 lines), the vertex shader has **zero \`in\` vertex attributes**! Instead, it invents a quad out of thin air using \`gl_VertexIndex\`:

\`\`\`glsl
#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_EXT_scalar_block_layout : enable
#extension GL_EXT_nonuniform_qualifier : enable

struct DrawInstance {
    vec4 texturePos;
    vec4 colour;
    uint textureIndex;
    mat4 model;
};

layout(push_constant) uniform PushBuffer {
    int cameraIndex;
} push;

layout(set = 0, binding = 0) uniform UniformBufferObject {
    mat4 cameras[10];
} ubo;

layout(set = 3, binding = 3) readonly buffer ObjectBuffer{
    DrawInstance objects[];
} objectBuffer;

layout(location = 1) out vec2 fragTexCoord;
layout(location = 2) out vec4 fragColour;
layout(location = 3) out uint textureIndex;

vec2 vertices[] = {
    vec2(0.0f, 0.0f),
    vec2(1.0f, 0.0f),
    vec2(1.0f, 1.0f),
    vec2(1.0f, 1.0f),
    vec2(0.0f, 1.0f),
    vec2(0.0f, 0.0f),
};

vec2 texCoords[] = {
    vec2(0.0f, 0.0f),
    vec2(1.0f, 0.0f),
    vec2(1.0f, 1.0f),
    vec2(1.0f, 1.0f),
    vec2(0.0f, 1.0f),
    vec2(0.0f, 0.0f),
};

out gl_PerVertex {
    vec4 gl_Position;
};

void main() {
    vec2 newPos;
    int instance = gl_VertexIndex / 6;
    int vertexIndex = gl_VertexIndex % 6;
    newPos.x = vertices[vertexIndex].x * objectBuffer.objects[instance].texturePos.z;
    newPos.y = vertices[vertexIndex].y * objectBuffer.objects[instance].texturePos.w;
    gl_Position = ubo.cameras[push.cameraIndex] * objectBuffer.objects[instance].model * vec4(newPos, 1.0, 1.0);
    fragTexCoord.x = objectBuffer.objects[instance].texturePos.x + (texCoords[vertexIndex].x * objectBuffer.objects[instance].texturePos.z);
    fragTexCoord.y = objectBuffer.objects[instance].texturePos.y + (texCoords[vertexIndex].y * objectBuffer.objects[instance].texturePos.w);
    fragColour = objectBuffer.objects[instance].colour;
    textureIndex = objectBuffer.objects[instance].textureIndex;
}
\`\`\`

#### Line-by-Line Breakdown

- **Lines 21–23 (\`ObjectBuffer\`)**: Reads the \`DrawInstance\` array written milliseconds earlier by \`spritebatch.comp\` (Book IV!).
- **Lines 29–45 (\`vertices[]\` & \`texCoords[]\`)**: Two 6-entry constant arrays forming 2 triangles (one quad). No VRAM vertex buffer fetch needed; these live right in shader constants!
- **Lines 53–54 (The Trick!)**: When the CPU calls \`vkCmdDraw(cmd, drawCount * 6, 1, 0, 0)\`:
  - \`instance = gl_VertexIndex / 6\` tells the shader **which sprite** ($0, 1, 2, \\dots$) this vertex belongs to.
  - \`vertexIndex = gl_VertexIndex % 6\` tells the shader **which corner** ($0..5$) of that sprite's quad this vertex is.
- **Lines 55–57**: Scales the unit quad \`[0..1]\` by the sprite's UV width/height (\`texturePos.zw\`), multiplies by the sprite's \`model\` matrix and camera \`viewproj\`, and emits \`gl_Position\`.
- **Lines 58–61**: Computes the atlas UV and forwards \`fragColour\` and \`textureIndex\` to the fragment shader.

Now look at \`extern/Vulkan2d/shaders/instanced.frag\` (all 22 lines):

\`\`\`glsl
#version 450
#extension GL_ARB_separate_shader_objects : enable
#extension GL_EXT_scalar_block_layout : enable
#extension GL_EXT_nonuniform_qualifier : enable

layout(set = 1, binding = 1) uniform sampler texSampler;
layout(set = 2, binding = 2) uniform texture2D tex[];

layout(location = 1) in vec2 fragTexCoord;
layout(location = 2) in vec4 fragColour;
layout(location = 3) in flat uint instanceTextureIndex;

layout(location = 0) out vec4 outColor;

void main() {
    vec4 colour = texture(sampler2D(tex[nonuniformEXT(instanceTextureIndex)], texSampler), fragTexCoord);
    outColor = vec4(
            colour.r * fragColour.r,
            colour.g * fragColour.g,
            colour.b * fragColour.b,
            colour.a * fragColour.a);
}
\`\`\`

- **Line 11 (\`flat uint instanceTextureIndex\`)**: Why is \`flat\` mandatory here? Normally, the rasterizer smoothly blends vertex outputs across a triangle using barycentric weights (that is how \`fragTexCoord\` varies smoothly from \`0\` to \`1\`). You **cannot** interpolate an integer texture ID (what would texture \`3.47\` mean?), so Vulkan requires \`flat\` on all integer fragment inputs, copying the ID straight from the triangle's provoking vertex.
- **Line 16 (\`nonuniformEXT(...)\`)**: Because sprite A might use \`tex[2]\` and adjacent sprite B in the **same 32-lane warp** might use \`tex[7]\`, \`nonuniformEXT\` tells the SPIR-V compiler to generate a hardware **waterfall loop** so every pixel reads its exact texture safely without undefined behavior!

---

### Chapter 2: \`UNIT_VIEW\` & Screen-Space Matrix Tricks (\`colour.vert\`)

How does Vulkan2D draw colored rectangles or shapes even when you pass \`cameraIndex = -1\` (ignoring all 10 game cameras)? Look at \`extern/Vulkan2d/shaders/colour.vert\` (lines 23–34):

\`\`\`glsl
const mat4 UNIT_VIEW = {
    { 2.0, 0.0, 0.0, 0.0 },
    { 0.0, 2.0, 0.0, 0.0 },
    { 0.0, 0.0, 0.10101, 0.0 },
    { -1.0, -1.0, 0.191919, 1.0 }
};

void main() {
    mat4 camera = pushBuffer.cameraIndex == -1 ? UNIT_VIEW : ubo.viewproj[pushBuffer.cameraIndex];
    gl_Position = camera * pushBuffer.model * vec4(inPosition, 1.0);
    fragColor = inColor;
}
\`\`\`

Remember from Book IV that GLSL \`mat4\` constructors take **4 columns**. Multiply \`UNIT_VIEW\` by a unit-square point $(x, y, 0, 1)$ where $x, y \\in [0, 1]$:
- $X_{\\text{ndc}} = 2x - 1 \\in [-1, +1]$ (left edge to right edge of the screen)
- $Y_{\\text{ndc}} = 2y - 1 \\in [-1, +1]$ (top edge to bottom edge in Vulkan!)

So \`cameraIndex = -1\` turns normalized \`[0..1]\` coordinates straight into fullscreen Vulkan NDC without touching any camera UBO!

---

### Chapter 3: sRGB vs Linear Color Space & Cosine Palettes

Human vision is logarithmic: we are far more sensitive to small differences in dark shadows than in bright highlights. To save bits in 8-bit PNG files, image formats store colors in **sRGB** (roughly $\\text{sRGB} \\approx \\text{Linear}^{1/2.2}$).

#### Why Mixing Up sRGB and Linear Breaks Lighting

- **The Golden Rule**: All **physics and math** (lighting, bloom, alpha blending, color tinting) belong in **Linear space**. Only **storage and display** use **sRGB**.
- When Vulkan2D creates its swapchain with \`VK_FORMAT_B8G8R8A8_SRGB\`, the GPU hardware does two things for free:
  1. **TMU Read**: Automatically decodes sRGB textures to **Linear** when \`Sample()\` runs.
  2. **ROP Write**: Automatically encodes your shader's Linear \`outColor\` back to **sRGB** before writing to the screen!
- **Trap with Custom Math**: If you hand-pick an sRGB hex color like \`#808080\` (50% gray in Paint, \`0.502\`) and pass it inside \`UserData\`, it is **not** half as bright in Linear light! In Linear space, 50% perceptual gray is \`pow(0.502, 2.2) = 0.219\`.

\`\`\`hlsl
// Helper functions when converting raw UserData colors or UNORM render targets
float3 srgbToLinear(float3 c) { return pow(max(c, 0.0), 2.2); }
float3 linearToSrgb(float3 c) { return pow(max(c, 0.0), 1.0 / 2.2); }
\`\`\`

#### Procedural Cosine Color Palettes (Zero Texture Reads!)

Instead of uploading a 1D gradient texture to color plasma, fire, or shockwaves, you can compute an infinitely smooth, custom RGB gradient in **3 ALU instructions** using Inigo Quilez's cosine palette formula:

$$\\mathbf{C}(t) = \\mathbf{a} + \\mathbf{b} \\cdot \\cos\\bigl(2\\pi (\\mathbf{c} \\cdot t + \\mathbf{d})\\bigr)$$

\`\`\`hlsl
float3 cosinePalette(float t, float3 a, float3 b, float3 c, float3 d) {
    return a + b * cos(6.2831853 * (c * t + d));
}
// Sunset / Magma ramp for t in [0..1]:
float3 fire = cosinePalette(t, float3(0.5), float3(0.5), float3(1.0, 1.0, 0.5), float3(0.80, 0.90, 0.30));
\`\`\`

---

### Chapter 4: Graded Assignments 14–16 (With Starter Code & Full Solutions)

#### Assignment 14: Dynamic Palette-Swapped Retro Sprite (1D Lookup or Cosine Ramp)
- **Objective:** Convert any grayscale sprite (using its luminance \`c.r\` or \`dot(c.rgb, lumaWeights)\`) into a vibrant animated color-cycled sprite using \`cosinePalette\` shifted by \`userData.time\`, preserving original alpha \`c.a\`.
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float time; float cycleSpeed; float pad0; float pad1; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

float3 cosinePalette(float t, float3 a, float3 b, float3 c, float3 d) {
    return a + b * cos(6.2831853 * (c * t + d));
}

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 tex = textures[push.textureIndex].Sample(sampler, uv);
    float luma = dot(tex.rgb, float3(0.299, 0.587, 0.114));
    float t = luma + userData.time * userData.cycleSpeed;
    float3 pal = cosinePalette(t, float3(0.5), float3(0.5), float3(1.0), float3(0.00, 0.33, 0.67));
    return float4(pal * push.colour.rgb, tex.a * push.colour.a);
}
\`\`\`

#### Assignment 15: Gamma-Correct Inverse-Square Spotlight
- **Objective:** Light a sprite with a radial spotlight at \`userData.lightPosLocal\` ($0..1$) using physically based inverse-square falloff $I = 1 / (1 + k \\cdot d^2)$, keeping lighting math in Linear space!
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float2 lightPosLocal; float radius; float intensity; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 tex = textures[push.textureIndex].Sample(sampler, uv);
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float d = length(localUV - userData.lightPosLocal) / max(userData.radius, 0.001);
    float atten = userData.intensity / (1.0 + 4.0 * d * d);

    float3 linearAlbedo = pow(max(tex.rgb, 0.0), 2.2);
    float3 litLinear = linearAlbedo * (0.06 + atten * float3(1.0, 0.85, 0.6));
    float3 outRGB = pow(max(litLinear, 0.0), 1.0 / 2.2);
    return float4(outRGB * push.colour.rgb, tex.a * push.colour.a);
}
\`\`\`

#### Assignment 16: Vertex-Pulled Procedural Starfield Grid (\`vk2dShaderFrom\`)
- **Objective:** Write a GLSL 450 vertex shader with **zero vertex buffers** that uses \`gl_VertexIndex / 6\` (star ID) and \`gl_VertexIndex % 6\` (corner ID) to scatter 64 animated twinkling star quads across NDC space using a simple deterministic hash!
- **Reference Solution (GLSL 450 Vertex Shader):**
\`\`\`glsl
#version 450
layout(set = 3, binding = 3) uniform UserData { float time; float sizeNdc; } userData;
layout(location = 0) out vec2 fragLocal;

vec2 corners[6] = vec2[](
    vec2(-1, -1), vec2(1, -1), vec2(1, 1),
    vec2(1, 1), vec2(-1, 1), vec2(-1, -1)
);

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * (p + p));
}

void main() {
    int id = gl_VertexIndex / 6;
    int corner = gl_VertexIndex % 6;
    vec2 center = vec2(hash11(float(id) * 1.7), hash11(float(id) * 3.1)) * 2.0 - 1.0;
    float twinkle = 0.5 + 0.5 * sin(userData.time * 4.0 + float(id));
    vec2 pos = center + corners[corner] * userData.sizeNdc * twinkle;

    gl_Position = vec4(pos, 0.0, 1.0);
    fragLocal = corners[corner];
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Programmable Vertex Pulling: Zero Vertex Buffer to Non-Uniform Bindless Texture",
        chart: `
flowchart LR
    classDef cpu fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef vert fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef rast fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef frag fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Draw["CPU: vkCmdDraw(drawCount * 6)<br/>Zero Vertex Buffers Bound"]:::cpu
    VS["instanced.vert<br/>instance = gl_VertexIndex / 6<br/>corner = gl_VertexIndex % 6<br/>Reads ObjectBuffer SSBO"]:::vert
    Rast["Rasterizer<br/>Interpolates fragTexCoord<br/>Copies flat instanceTextureIndex"]:::rast
    FS["instanced.frag<br/>tex[nonuniformEXT(idx)]<br/>Waterfall Loop Across Warp"]:::frag

    Draw --> VS --> Rast --> FS
`,
      },
      {
        title: "sRGB vs Linear Light Pipeline: Where Gamma Conversion Happens",
        chart: `
flowchart LR
    classDef disk fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef lin fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    PNG["PNG / Texture on Disk<br/>Encoded in sRGB (~gamma 2.2)"]:::disk
    TMU["GPU Texture Unit<br/>Auto-Decodes SRGB -> Linear"]:::lin
    Math["Shader Math & ROP Blending<br/>Lighting, Bloom, Tint in Linear"]:::lin
    Swap["Swapchain B8G8R8A8_SRGB<br/>Auto-Encodes Linear -> sRGB"]:::out

    PNG --> TMU --> Math --> Swap
`,
      },
    ],
  },
  {
    id: "vk2d-shader-book-3d-depth-raymarching",
    title: "72. GPU & Shader Book VII: 3D Depth Buffers, Raymarching & Parallax Relief",
    category: "graphics",
    summary:
      "Step into 3D inside Vulkan2D: dissect model.vert and model.frag line-by-line, understand hardware Z-buffering and Early-Z culling, build real-time 3D sphere-traced raymarching and parallax heightmaps inside a 2D quad, and solve Assignments 17–19.",
    sourceFiles: [
      "extern/Vulkan2d/shaders/model.vert",
      "extern/Vulkan2d/shaders/model.frag",
      "extern/Vulkan2d/assets/shader.slang",
    ],
    content: `
# 72. GPU & Shader Book VII: 3D Depth Buffers, Raymarching & Parallax Relief

In Books I–VI we explored 2D pixels, compute grids, shadows, SDFs, and vertex pulling. In **Book VII**, we cross the bridge into **3D**: first by dissecting Vulkan2D's built-in 3D model shaders and hardware depth buffer, and then by embedding a **real-time 3D raymarcher** and **parallax heightmap** right inside a standard 2D \`PixelShader\`!

---

### Chapter 1: 3D Geometry & The Z-Buffer (\`model.vert\` & \`model.frag\`)

Even though Vulkan2D is primarily a 2D renderer, it ships a full 3D mesh pipeline (\`VK2DModel\`). Look at \`extern/Vulkan2d/shaders/model.vert\` (all 27 lines):

\`\`\`glsl
#version 450
#extension GL_ARB_separate_shader_objects : enable

layout(set = 0, binding = 0) uniform UniformBufferObject {
    mat4 viewproj[10];
} ubo;

layout(push_constant) uniform PushBuffer {
    mat4 model;
    vec4 colourMod;
    uint textureIndex;
    int cameraIndex;
} pushBuffer;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

out gl_PerVertex {
    vec4 gl_Position;
};

void main() {
    gl_Position = ubo.viewproj[pushBuffer.cameraIndex] * pushBuffer.model * vec4(inPosition, 1.0);
    fragTexCoord = inTexCoord;
}
\`\`\`

#### Line-by-Line Breakdown

- **Line 15 (\`vec3 inPosition\`)**: Unlike 2D quads (\`vec2\`), 3D vertices carry a \`z\` coordinate for depth.
- **Line 25 (Right-to-Left MVP Multiplication)**:
  1. \`pushBuffer.model * vec4(inPosition, 1.0)\` moves the vertex from **Model Space** (e.g., a crate centered at \`(0,0,0)\`) into **World Space**.
  2. \`ubo.viewproj[cameraIndex] * ...\` moves it from **World Space** into **Camera Space** and applies perspective projection into **4D Clip Space**.
- **\`model.frag\` (Lines 20–28)**:
\`\`\`glsl
void main() {
    vec4 colour = texture(sampler2D(tex[pushBuffer.textureIndex], texSampler), fragTexCoord);
    outColor = vec4(
        colour.r * pushBuffer.colourMod.r,
        colour.g * pushBuffer.colourMod.g,
        colour.b * pushBuffer.colourMod.b,
        colour.a * pushBuffer.colourMod.a
    );
}
\`\`\`

#### How the Hardware Z-Buffer & Early-Z Work

In 2D, you sort sprites back-to-front on the CPU (Painter's Algorithm). In 3D, triangles intersect and overlap in complex ways, so sorting on the CPU fails. Instead, the GPU uses a **Depth Buffer (Z-Buffer)** (e.g., \`VK_FORMAT_D16_UNORM\` or \`D24_UNORM_S8_UINT\`):
1. Every pixel on screen stores a depth value $z \\in [0.0, 1.0]$ (\`0.0\` = near camera, \`1.0\` = far away).
2. Before running \`model.frag\`, the **Early-Z** hardware unit checks if the incoming triangle pixel's $z$ is *closer* than the Z-buffer value currently stored at that pixel.
3. If it is behind an already-drawn wall ($z_{\\text{new}} > z_{\\text{stored}}$), the GPU **skips running the fragment shader completely**! That is why drawing opaque 3D objects **front-to-back** makes 3D games dramatically faster.

---

### Chapter 2: 3D Raymarching (Sphere Tracing) Inside a 2D Quad

What if you want a spinning 3D crystal, planet, or hologram *inside a 2D sprite* without loading a 3D \`.obj\` mesh? You can run a **Sphere Tracer (Raymarcher)** inside \`PixelShader\`!

#### How Sphere Tracing Works

For each pixel inside your 2D quad:
1. Convert \`localUV\` to centered screen coordinates $p \\in [-1, +1]^2$.
2. Place a virtual camera at $\\mathbf{o} = (0, 0, -2.5)$ looking toward $+Z$.
3. Shoot a ray through pixel $p$: $\\mathbf{d} = \\operatorname{normalize}(\\text{float3}(p, 1.6))$.
4. Loop up to 48 steps:
   - Evaluate the 3D Signed Distance Function $d = \\text{mapSDF}(\\mathbf{o} + t \\cdot \\mathbf{d})$.
   - Because an SDF tells you the **exact safe distance to the nearest surface in any direction**, you can jump forward by $t \\mathrel{+}= d$ without ever clipping through geometry!
   - If $d < 0.001$, you **hit** the 3D surface! If $t > 10.0$, the ray missed into empty space.

#### Computing 3D Surface Normals Without Triangles

To light a 3D surface, you need its surface normal vector $\\mathbf{N}$. With an SDF, you estimate the 3D gradient using a tiny offset $\\varepsilon = 0.001$:

$$\\mathbf{N} = \\operatorname{normalize}\\begin{pmatrix} f(p + \\varepsilon \\hat{x}) - f(p - \\varepsilon \\hat{x}) \\\\ f(p + \\varepsilon \\hat{y}) - f(p - \\varepsilon \\hat{y}) \\\\ f(p + \\varepsilon \\hat{z}) - f(p - \\varepsilon \\hat{z}) \\end{pmatrix}$$

\`\`\`hlsl
float3 calcNormal(float3 p, float time) {
    float2 e = float2(0.001, 0.0);
    return normalize(float3(
        mapSDF(p + e.xyy, time) - mapSDF(p - e.xyy, time),
        mapSDF(p + e.yxy, time) - mapSDF(p - e.yxy, time),
        mapSDF(p + e.yyx, time) - mapSDF(p - e.yyx, time)
    ));
}
\`\`\`

---

### Chapter 3: 2D Parallax Heightmap Relief (Steep Parallax Mapping)

Even flat 2D dungeon tiles or brick walls can look deeply 3D if you supply a grayscale **Heightmap** (where \`1.0\` = raised brick face, \`0.0\` = deep mortar crack) in a second bindless texture slot \`userData.heightTexID\`:
- Given a 2D view offset \`float2 viewDir\` (from the camera center to the sprite), step 8 times through the heightmap along \`viewDir\`.
- Stop when your current ray depth exceeds the heightmap sample at that UV.
- Sample the color texture at the shifted UV! Bricks jut forward over the mortar cracks as the player walks past!

---

### Chapter 4: Graded Assignments 17–19 (With Starter Code & Full Solutions)

#### Assignment 17: Real-Time 3D Raymarched Rotating Box + Specular Highlight
- **Objective:** Raymarch a 3D rounded box rotating around the Y axis by \`userData.time\` inside a normal VK2D \`PixelShader\`, compute its 3D normal with \`calcNormal\`, and shade it with Lambertian diffuse + Blinn-Phong specular + Fresnel rim glow!
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float time; float pad0; float pad1; float pad2; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

float sdBox3D(float3 p, float3 b) {
    float3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float mapSDF(float3 p, float t) {
    float c = cos(t), s = sin(t);
    p.xz = float2(c * p.x - s * p.z, s * p.x + c * p.z);
    p.xy = float2(c * p.x - s * p.y, s * p.x + c * p.y);
    return sdBox3D(p, float3(0.45, 0.45, 0.45)) - 0.08;
}

float3 calcNormal(float3 p, float t) {
    float2 e = float2(0.001, 0.0);
    return normalize(float3(
        mapSDF(p + e.xyy, t) - mapSDF(p - e.xyy, t),
        mapSDF(p + e.yxy, t) - mapSDF(p - e.yxy, t),
        mapSDF(p + e.yyx, t) - mapSDF(p - e.yyx, t)
    ));
}

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float2 p = localUV * 2.0 - 1.0;

    float3 ro = float3(0.0, 0.0, -2.2);
    float3 rd = normalize(float3(p, 1.5));
    float t = 0.0;
    bool hit = false;

    for (int i = 0; i < 40; ++i) {
        float d = mapSDF(ro + rd * t, userData.time);
        if (d < 0.002) { hit = true; break; }
        t += d;
        if (t > 6.0) break;
    }

    if (!hit) return float4(0.0, 0.0, 0.0, 0.0);

    float3 pos = ro + rd * t;
    float3 N = calcNormal(pos, userData.time);
    float3 L = normalize(float3(0.6, -0.8, -0.7));
    float3 H = normalize(L - rd);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 32.0);
    float fresnel = pow(1.0 - max(dot(N, -rd), 0.0), 3.0);

    float3 col = float3(0.15, 0.45, 0.95) * (0.2 + diff) + float3(1.0) * spec + float3(0.3, 0.9, 1.0) * fresnel;
    return float4(col * push.colour.rgb, push.colour.a);
}
\`\`\`

#### Assignment 18: 8-Step Parallax Occlusion Relief Shader
- **Objective:** Use a secondary bindless heightmap \`textures[userData.heightTexID]\` and \`userData.viewDir\` (normalized screen-space camera offset) to march 8 layers deep and shift \`uv\` safely within \`push.texturePos\`.
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float2 viewDir; uint heightTexID; float depthScale; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float2 minUV = push.texturePos.xy + 0.5;
    float2 maxUV = push.texturePos.xy + push.texturePos.zw - 0.5;

    float numLayers = 8.0;
    float layerDepth = 1.0 / numLayers;
    float curLayerDepth = 0.0;
    float2 deltaUV = (userData.viewDir * userData.depthScale) / numLayers;

    float2 curUV = uv;
    float heightVal = 1.0 - textures[userData.heightTexID].Sample(sampler, clamp(curUV, minUV, maxUV)).r;

    for (int i = 0; i < 8; ++i) {
        if (curLayerDepth >= heightVal) break;
        curUV -= deltaUV;
        heightVal = 1.0 - textures[userData.heightTexID].Sample(sampler, clamp(curUV, minUV, maxUV)).r;
        curLayerDepth += layerDepth;
    }
    return textures[push.textureIndex].Sample(sampler, clamp(curUV, minUV, maxUV)) * push.colour;
}
\`\`\`

#### Assignment 19: Quantized Cel-Shaded 3-Band Lighting
- **Objective:** Replace smooth Lambertian shading with 3 crisp cartoon shadow bands (\`0.25\`, \`0.60\`, \`1.0\`) using \`floor(diff * 3.0) / 2.0\` or \`step()\` thresholds, plus a hard crisp rim highlight!
- **Reference Solution:**
\`\`\`hlsl
float toonShade(float diff) {
    float band1 = step(0.20, diff);
    float band2 = step(0.65, diff);
    return 0.25 + 0.35 * band1 + 0.40 * band2; // Crisp 0.25, 0.60, 1.00 steps!
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Sphere Tracing (3D Raymarching) Loop Inside a Single 2D Fragment",
        chart: `
flowchart LR
    classDef ray fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef sdf fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef hit fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef miss fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;

    Init["Pixel UV -> Ray Origin ro & Direction rd"]:::ray
    March["Step i: d = mapSDF(ro + rd * t)"]:::sdf
    Check{"d < 0.002?"}:::sdf
    Hit["Hit Surface! Compute calcNormal(pos)<br/>Shade Diffuse + Specular + Fresnel"]:::hit
    Advance["Safe Jump: t += d<br/>(Never Overshoots!)"]:::ray
    Miss["t > 6.0 -> Transparent Alpha 0.0"]:::miss

    Init --> March --> Check
    Check -->|"Yes"| Hit
    Check -->|"No & t <= 6.0"| Advance --> March
    Check -->|"t > 6.0"| Miss
`,
      },
      {
        title: "3D MVP Transform Chain & Hardware Early-Z Depth Culling",
        chart: `
flowchart LR
    classDef vert fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef zbuf fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef frag fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef cull fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;

    MVP["model.vert<br/>gl_Position = viewproj * model * vec4(pos, 1.0)"]:::vert
    EarlyZ{"Hardware Early-Z Test<br/>z_new < z_buffer?"}:::zbuf
    Skip["Culled! Fragment Shader Skipped"]:::cull
    RunFS["Run model.frag & Update Z-Buffer"]:::frag

    MVP --> EarlyZ
    EarlyZ -->|"No (Occluded)"| Skip
    EarlyZ -->|"Yes (Closer)"| RunFS
`,
      },
    ],
  },
];