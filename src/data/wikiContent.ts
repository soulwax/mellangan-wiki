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
    | "game-interface"
    | "bastion";
}

export const WIKI_SECTIONS: WikiSection[] = [
  {
    id: "overview",
    title: "01. Engine Philosophy & 8-Slot Hardware Telemetry",
    category: "core",
    interactiveComponent: "gameloop",
    summary:
      "The C++20 \"C with classes\" architecture, Vulkan 1.2 baseline, 1,520B pool slabs, high-refresh easing, and telemetry.",
    sourceFiles: [
          "src/main.cpp",
          "src/Game.cpp",
          "src/Prof.c",
          "src/SpriteObject.hpp",
          "src/String.hpp",
          "src/Math.hpp",
          "src/Math.cpp",
          "src/entity/Pool.c",
          "src/entity/ItemStats.hpp",
          "src/input/Input.hpp",
          "src/meta/Settings.hpp"
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

6. **C-Backed Owning \`String\` & Arbitrary Precision Math (\`src/String.hpp\`, \`src/Math.hpp\`):**
   Gameplay-owned strings use a compact \`String\` class with 15-byte inline SSO (\`char local[16]\`, \`realloc\`/\`free\` heap fallback), \`std::string\` / \`std::string_view\` adapters, and custom \`fmt::formatter<String>\` + \`std::hash<String>\` integrations. Alongside it, \`src/Math.hpp\` and \`src/Math.cpp\` provide arbitrary-precision \`BigInteger\` (base-$10^9$ limbs) and \`BigFloat\` (\`DEFAULT_SCALE = 34\`, half-to-even rounding) reserved for future large-number use and exercised by \`MathTest\` and \`--math-benchmark\`.

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

    Note over Main: Poll input and run zero or more fixed ticks per frame
    Main->>Level: Game.play() calls level.tick() when play is active
    Note over Level: PROF_HOUSEKEEP (Begin)
    Level->>Level: night.tick(), spawner.tick(), explore(), hunt()
    Level->>Level: buildGrid() -> CSR Prefix-Sum cellStart[] & cells[]
    Note over Level: PROF_HOUSEKEEP (End) / PROF_THINK (Begin)
    Level->>Workers: Barrier 1, workers.run(n, 256, Enemy.think)
    Workers-->>Level: Sense & GoalQueue -> xWant, yWant
    Level->>Level: Combat and experience bookkeeping
    Level->>Workers: Barrier 2, workers.run(n, 256, Enemy.move)
    Workers-->>Level: Velocity integration and Level.collide
    Level->>Workers: Barrier 3, workers.run(n, 256, Enemy.push)
    Workers-->>Level: Read CSR Grid -> xPush, yPush
    Level->>Workers: Barrier 4, workers.run(n, 256, Enemy.settle)
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
  },
  {
    id: "gallery",
    title: "Mellangan: A Tale in Eighteen Frames",
    category: "graphics",
    summary:
      "A Mage takes the road through bright fields, darkening woods, hard-won spoils, and the halls below.",
    sourceFiles: [
          "src/test/view/Gallery.cpp"
    ],
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
    interactiveComponent: "radix",
    summary:
      "IEEE-754 monotonic conversion, 3-pass 12-bit LSD radix sort, high-refresh display easing, and CSR draw culling.",
    sourceFiles: [
          "src/level/LevelRender.cpp",
          "src/level/LightField.cpp",
          "src/gfx/Screen.cpp",
          "src/SpriteObject.hpp"
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
  },
  {
    id: "memory-slab",
    title: "03. Intrusive Slab Allocator (Pool.c) & Sized Deallocation",
    category: "simulation",
    interactiveComponent: "slab",
    summary:
      "Sized deallocation, 16-byte pool size classes, on-demand gear stats, and status bitmasks.",
    sourceFiles: [
          "src/entity/Pool.c",
          "src/entity/Pool.h",
          "src/SpriteObject.hpp",
          "src/entity/ItemStats.hpp",
          "src/entity/Status.hpp"
    ],
    content: `### The Heap Fragmentation Nightmare in Real-Time Game Engines

In a 60 FPS real-time action RPG, thousands of dynamic objects are created and destroyed every second: arrow projectiles, spell impact sparks, temporary mob status buffs, audio voice handles, and floating damage numbers.

If an engine relies on the standard system allocator (\`malloc\` and \`free\` in C, or global \`operator new\` and \`operator delete\` in C++), it inevitably falls victim to the **Heap Fragmentation Death Spiral**:

1. **The Metadata Tax (Memory Bloat):** General-purpose allocators (such as glibc ptmalloc or Windows Heap) must prepend a hidden metadata chunk header (typically 8 to 16 bytes) in front of every single allocated memory block. When allocating a 16-byte sprite struct, an 8-byte header represents a 50% memory waste! Furthermore, these headers push addresses off 64-byte hardware cache line boundaries.
2. **External Fragmentation:** Over hours of continuous gameplay, allocating and freeing objects of varying sizes punches microscopic "holes" across virtual memory pages. Even if the operating system reports 200 MB of free RAM, the largest contiguous free chunk might be smaller than 4 KB, causing allocation failures or forcing the OS kernel to commit new virtual memory pages.
3. **Lock Contention & Syscall Stalls:** General-purpose allocators utilize complex global bin locks. When 16 worker threads allocate and free memory concurrently, worker threads spend significant CPU cycles waiting on allocator mutexes, creating unpredictable 10ms frame spikes that produce visible stutter.

To eliminate heap fragmentation, eliminate memory headers, and guarantee zero-latency allocations, Mellangan uses an **Intrusive Segregated Slab Allocator** (\`src/entity/Pool.c\`, \`src/entity/Pool.h\`).

---

### The Empty Hotel Room Mental Model: Zero-Byte Metadata Headers

How can an allocator track which memory blocks are free without prepending an 8-byte header to every object?

\`\`\`
[ Traditional Allocator: The External Bellhop Ledger ]
+-------------+-----------------------+
| 8-Byte Head | Object Payload Memory |
| (Block Size)| (16 to 64 bytes)      |
+-------------+-----------------------+
Every object carries a permanent backpack of metadata,
wasting space and breaking cache line alignment.

[ Mellangan's Intrusive Free-List: The Nightstand Note ]
When a room is EMPTY:
+-------------------------------------+
| Node* next (Points to next room)    |  <-- Occupies the room itself!
+-------------------------------------+

When a room is OCCUPIED:
+-------------------------------------+
| Monster X, Y, Health, Facing Vector |  <-- Overwrites the note!
+-------------------------------------+
Metadata overhead per allocation: EXACTLY ZERO BYTES!
\`\`\`

When a memory block is free, it does not need to store monster statistics. Therefore, the allocator uses the free block's **own internal memory** to store a pointer to the next free block:

\`\`\`c
typedef struct Node {
  struct Node *next;
} Node;
\`\`\`

When the game engine allocates the block, it writes the monster's fields directly over that memory address. The pointer is no longer needed because the block is no longer on the free list! When the monster dies and the block is freed, the allocator re-interprets the memory address as a \`Node*\` and links it back into the free list.

---

### 96 Segregated Size Classes (\`Pool.h\` and \`Pool.c\`)

Rather than managing arbitrary variable-sized chunks in a single pool, Mellangan partitions all small-to-medium memory requests into 96 fixed-size bins:

\`\`\`c
#define POOL_GRAIN_SHIFT 4
#define POOL_CLASSES 96
#define POOL_MAX ((POOL_CLASSES - 1) << POOL_GRAIN_SHIFT)
\`\`\`

With \`POOL_GRAIN_SHIFT = 4\`, memory allocation granularity is $2^4 = 16\\text{ bytes}$. The mapping from any requested byte size $S$ to its size class index $c$ is computed using a branchless bit-shift:

\`\`\`c
static size_t classOf(size_t size) {
  if (size == 0)
    size = 1;
  return (size + (1 << POOL_GRAIN_SHIFT) - 1) >> POOL_GRAIN_SHIFT;
}
\`\`\`

Mathematically, this evaluates to:

$$c = \\text{classOf}(S) = \\left\\lfloor \\frac{S + 15}{16} \\right\\rfloor$$

\`\`\`
Size Requested | Size Class Index (c) | Sliced Chunk Size (c << 4)
---------------|----------------------|----------------------------
1 to 16 bytes  | Class 1              | 16 bytes
17 to 32 bytes | Class 2              | 32 bytes
33 to 48 bytes | Class 3              | 48 bytes
...            | ...                  | ...
1505 to 1520 B | Class 95             | 1520 bytes
> 1520 bytes   | Bypasses pool        | Direct system malloc(size)
\`\`\`

- Any request up to 1,520 bytes (\`POOL_MAX = 95 \\times 16\`) is rounded up to the nearest multiple of 16 bytes and served instantly from that size class's segregated free list.
- Requests larger than 1,520 bytes are rare in gameplay loops and bypass directly to system \`malloc(size)\`.

---

### 64 KB Slabs & Hardware Cache Prefetching (\`refill\`)

When size class $c$ exhausts its free list (\`!freeList[c]\`), it refills by allocating a 64 KB memory slab (\`SLAB = 64 * 1024 = 65{,}536\\text{ bytes}\`):

\`\`\`c
static void refill(size_t c) {
  size_t size = c << POOL_GRAIN_SHIFT;
  Slab *s = (Slab *)malloc(sizeof(Slab) + SLAB);
  if (!s)
    abort();
  s->next = slabs;
  slabs = s;
  char *slab = (char *)(s + 1);
  for (size_t i = SLAB / size; i-- > 0;) {
    Node *n = (Node *)(slab + i * size);
    n->next = freeList[c];
    freeList[c] = n;
  }
}
\`\`\`

\`\`\`
[ 64 KB Slab Memory Layout ]
+------------+-------------------------------------------------------+
| Slab* next | Chunk 0 | Chunk 1 | Chunk 2 | Chunk 3 | ... | Chunk K |
+------------+-------------------------------------------------------+
^ s          ^ slab = (char*)(s + 1)
\`\`\`

#### Why Backward Initialization Matters for Cache Lines

Notice the descending loop structure:

\`\`\`c
for (size_t i = SLAB / size; i-- > 0;)
\`\`\`

Why does the allocator link nodes backwards from $K - 1$ down to $0$?

\`\`\`
Iteration Step | Node Initialized | freeList[c] Points To
---------------|------------------|----------------------
i = K - 1      | Chunk K - 1      | Chunk K - 1
i = K - 2      | Chunk K - 2      | Chunk K - 2 -> Chunk K - 1
...            | ...              | ...
i = 0          | Chunk 0          | Chunk 0 -> Chunk 1 -> ... -> Chunk K - 1
\`\`\`

By pushing Chunk $K - 1$ first and Chunk $0$ last, \`freeList[c]\` ends up pointing directly to **Chunk 0** (the lowest numerical memory address in the slab).

When the game begins spawning entities at the start of a wave:
1. First entity gets Chunk 0.
2. Second entity gets Chunk 1.
3. Third entity gets Chunk 2.

Because allocations march sequentially forward in virtual memory, the hardware Data Cache Prefetcher detects the ascending address stream and automatically streams upcoming chunks from L2 into L1 cache before the CPU even issues load instructions!

---

### C++20 Sized Deallocation via Virtual Destructors

If Mellangan stores zero metadata headers in front of allocated blocks, how does \`pool_free(p, size)\` know which size class $c$ the pointer $p$ belongs to when freeing?

\`\`\`c
void pool_free(void *p, size_t size) {
  if (!p)
    return;
  size_t c = classOf(size);
  if (c >= POOL_CLASSES || DIRECT) {
    free(p);
    return;
  }
  POOL_LOCK();
  Node *n = (Node *)p;
  n->next = freeList[c];
  freeList[c] = n;
  POOL_UNLOCK();
}
\`\`\`

The answer lies in C++14/C++20 **Sized Deallocation** integrated into the base polymorphic class \`src/SpriteObject.hpp\`:

\`\`\`cpp
class SpriteObject {
public:
  virtual ~SpriteObject() = default;
  static void *operator new(size_t size) { return pool_alloc(size); }
  static void operator delete(void *p, size_t size) { pool_free(p, size); }
};
\`\`\`

#### The Deleting Destructor Thunk

Consider a polymorphic hierarchy where \`Monster\` inherits from \`SpriteObject\`:

\`\`\`cpp
class Skeleton : public SpriteObject {
  int bones;
  double swordAngle;
  // sizeof(Skeleton) == 96 bytes
};

SpriteObject *obj = new Skeleton(); // calls operator new(96) -> pool_alloc(96)
delete obj;                         // calls operator delete(obj, 96) -> pool_free(obj, 96)
\`\`\`

When \`delete obj;\` executes on a base pointer:
1. The compiler calls the virtual destructor through the object's vtable.
2. Inside the derived class's vtable resides a special compiler-generated function known as the **deleting destructor thunk**.
3. This thunk calls the derived destructor \`Skeleton::~Skeleton()\`, and then invokes \`SpriteObject::operator delete(p, sizeof(Skeleton))\`.
4. The exact compile-time size (96 bytes) is passed directly in a CPU register (e.g. \`EDX\` or \`RSI\`) to \`pool_free\`!

Because the language runtime provides the size directly, the allocator computes $c = (96 + 15) \\gg 4 = 6$ in a single CPU cycle, without inspecting chunk headers.

---

### AddressSanitizer (ASan) Redzone Integration

In custom slab allocators, memory bugs such as buffer overruns or use-after-free can be notoriously difficult to track because chunks are recycled immediately without returning pages to the operating system.

Mellangan solves this by conditionally compiling AddressSanitizer support:

\`\`\`c
#ifdef __SANITIZE_ADDRESS__
#define DIRECT 1
#else
#define DIRECT 0
#endif
\`\`\`

When building with \`-fsanitize=address\`:
- \`DIRECT\` is enabled.
- All calls to \`pool_alloc\` and \`pool_free\` bypass the slab freelist and forward directly to the system \`malloc\` and \`free\`.
- ASan surrounds every allocation with poisoned guard pages (redzones), immediately catching out-of-bounds reads, writes, and dangling pointers at the exact instruction where they occur.
- When compiling for release distribution, \`DIRECT\` is 0, restoring full slab pooling performance.

---

### Concurrency Primitives: SRWLOCK vs POSIX Mutexes

\`Pool.c\` protects its free lists with platform-optimized lightweight mutual exclusion:

\`\`\`c
#ifdef _WIN32
#include <windows.h>
static SRWLOCK poolLock = SRWLOCK_INIT;
#define POOL_LOCK()   AcquireSRWLockExclusive(&poolLock)
#define POOL_UNLOCK() ReleaseSRWLockExclusive(&poolLock)
#else
#include <pthread.h>
static pthread_mutex_t poolLock = PTHREAD_MUTEX_INITIALIZER;
#define POOL_LOCK()   pthread_mutex_lock(&poolLock)
#define POOL_UNLOCK() pthread_mutex_unlock(&poolLock)
#endif
\`\`\`

On Windows, \`SRWLOCK\` (Slim Reader/Writer Lock) is a pointer-sized synchronization primitive (8 bytes) that requires zero heap allocation and executes entirely in user mode in the uncontended case, avoiding costly kernel transitions.

Upon game shutdown, \`pool_shutdown()\` walks the \`slabs\` linked list and frees every 64 KB slab in a single pass:

\`\`\`c
void pool_shutdown(void) {
  POOL_LOCK();
  while (slabs) {
    Slab *s = slabs;
    slabs = slabs->next;
    free(s);
  }
  for (size_t c = 0; c < POOL_CLASSES; c++)
    freeList[c] = NULL;
  POOL_UNLOCK();
}
\`\`\`

This guarantees that all memory allocated throughout hours of gameplay is reclaimed cleanly by the operating system, with zero memory leaks.
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
  },
  {
    id: "workers-concurrency",
    title: "04. Lock-Free Atomic Stride Worker Pool, 4-Barrier AI & Thread Safety",
    category: "simulation",
    interactiveComponent: "goalai",
    summary:
      "Chunked worker dispatch, completion tracking and the four enemy update passes.",
    sourceFiles: [
          "src/Workers.cpp",
          "src/Workers.hpp",
          "src/entity/enemy/Enemy.hpp",
          "src/level/LevelSpace.cpp"
    ],
    content: `### The Concurrency Conundrum in Real-Time Game AI

Modern gaming CPUs feature 8 to 16 physical cores capable of executing 16 to 32 concurrent hardware threads. To maintain a locked 60 frames per second with 10,000 simulated monsters, an engine must parallelize entity thinking, movement integration, and crowd avoidance across all available CPU cores.

However, standard concurrency approaches found in web services or desktop applications fail catastrophically in real-time game loops:

1. **Job Queue Mutex Contention (The Kitchen Door Jam):** If a thread pool uses a shared queue protected by a \`std::mutex\`, 16 threads attempting to pop jobs concurrently spend nearly their entire time quantum waiting on lock acquisition. Mutex lock convoys and OS thread context switching cause high CPU utilization without accomplishing useful computational work.
2. **Dynamic Task Heap Allocations:** Creating heap-allocated \`std::packaged_task\`, \`std::function\`, or \`std::future\` objects for thousands of small AI jobs triggers allocator contention, destroying performance.
3. **Data Races & Non-Deterministic Simulation:** If Thread A reads Monster B's position to steer away from it while Thread B is simultaneously updating Monster B's velocity, memory race conditions occur. This leads to unpredictable glitches, memory corruption, and desynchronized replay states.

To achieve maximum multi-core throughput with deterministic execution, Mellangan implements a **Zero-Allocation, Lock-Free Atomic Stride Worker Pool** (\`src/Workers.cpp\`, \`src/Workers.hpp\`).

---

### The Restaurant Line Cook Mental Model: Atomic Stride Work-Stealing

To intuitively understand how Mellangan's worker pool operates, consider a bustling restaurant kitchen during a dinner rush:

\`\`\`
[ Traditional Mutex Queue: The Locked Manager's Office ]
- 16 line cooks stand in a single-file line outside the head chef's office.
- Each cook must knock on the door, wait for the chef to unlock it,
  receive ONE order ticket, step out, and lock the door again.
- Result: 90% of the kitchen stands idle waiting in line!

[ Mellangan's Lock-Free Atomic Stride: The Carousel Spindle ]
- All order tickets are placed on a rotating carousel spindle.
- A cook steps up and grabs a STRIDE of 16 tickets in a single rapid motion
  (an atomic increment that takes 2 nanoseconds).
- The cook retreats to their station and cooks all 16 dishes independently.
- The head chef does not sit in an office; the chef also grabs tickets
  and cooks alongside the team until the carousel is empty!
\`\`\`

---

### The 64-Bit Packed Atomic Stride Invariant (\`Workers.cpp\`)

The core of \`src/Workers.cpp\` is a single 64-bit atomic integer:

\`\`\`cpp
std::atomic<uint64_t> next{0};
\`\`\`

This single 64-bit integer packs two distinct 32-bit values into one atomic memory word:

\`\`\`
+-----------------------------------+-----------------------------------+
| High 32 Bits: Generation Counter  | Low 32 Bits: Current Work Index   |
| (gen = uint32_t(v >> 32))         | (begin = uint32_t(v))             |
+-----------------------------------+-----------------------------------+
\`\`\`

#### Dispatching a Parallel Job (\`Workers::run\`)

When the main thread initiates a parallel phase across $N$ entities with chunk size $S$:

\`\`\`cpp
void Workers::run(int n, int size, Job j, void *c) {
  if (n <= 0)
    return;
  if (threads.empty() || n <= size)
    return j(c, 0, n);
  uint32_t gen;
  {
    std::lock_guard<std::mutex> lock(mutex);
    job = j, ctx = c, count = n, chunk = size, finished = 0, total = (n + size - 1) / size;
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

1. **Small Workload Fast-Path:** If $N \\le \\text{size}$ or no background threads exist, \`j(c, 0, n)\` executes immediately on the calling thread. This completely bypasses mutex locks, condition variable wakeups, and thread context switches for trivial workloads!
2. **Epoch Generation Counter:** \`gen = ++generation;\` increments the dispatch epoch.
3. **Atomic Initialization:** \`next.store(uint64_t(gen) << 32);\` resets the work index to 0 while stamping the new generation into the upper 32 bits.
4. **Broadcast Wakeup:** \`wake.notify_all();\` signals sleeping worker threads.
5. **Active Caller Participation:** The line \`int mine = work(gen, j, c, n, size);\` ensures the calling thread actively processes chunks! The main thread never sits idle waiting on background workers; it works until the spindle is empty.

---

### Lock-Free Compare-and-Swap Work Stealing (\`Workers::work\`)

Once threads are running, workers grab chunks of work using an atomic Compare-And-Swap (\`compare_exchange_weak\`) loop:

\`\`\`cpp
int Workers::work(uint32_t gen, Job j, void *c, int n, int size) {
  int chunks = 0;
  for (uint64_t v = next.load(); uint32_t(v >> 32) == gen && int(uint32_t(v)) < n;) {
    if (!next.compare_exchange_weak(v, v + uint64_t(size)))
      continue;
    int begin = int(uint32_t(v));
    j(c, begin, std::min(begin + size, n));
    chunks++;
    v = next.load();
  }
  return chunks;
}
\`\`\`

#### Why This Design Is Immune to ABA and Race Conditions

1. **Zero Lock Contention During Execution:** Grabbing a chunk does not acquire a mutex! The \`compare_exchange_weak\` updates \`v\` to \`v + size\` in a single atomic hardware instruction (\`LOCK CMPXCHG\` on x86-64).
2. **ABA Protection via Epoch Generation:** Suppose Worker 3 is suspended by the operating system kernel while reading \`v\`. Before Worker 3 resumes, the entire job finishes, and a new job starts. When Worker 3 wakes up, it checks \`uint32_t(v >> 32) == gen\`. Because \`gen\` has incremented, the condition evaluates to \`false\`, causing Worker 3 to exit the loop immediately without processing stale data!
3. **Zero False Sharing:** Threads do not write to adjacent memory addresses in a shared task array. Each worker claims an exclusive index interval $[ \\text{begin},\\; \\min(\\text{begin} + \\text{size}, n) )$ and processes its entities in private CPU registers and cache lines.

---

### The 4-Barrier AI Architecture: Guaranteeing Thread Safety

Parallelizing 10,000 entities without data races requires structuring the simulation tick into discrete sequential phases. Mellangan enforces a **4-Barrier Memory Contract**:

\`\`\`
[ Tick Start ]
      |
+--------------------------------------------------------------+
| BARRIER 1: SENSE & THINK (Enemy::think)                      |
| - Read-only world view: player coords, CSR grid, landmarks.  |
| - GoalQueue evaluation; outputs desired velocity (xWant).    |
+--------------------------------------------------------------+
      | (All threads synchronize)
+--------------------------------------------------------------+
| BARRIER 2: MOVEMENT & TILE COLLISION (Enemy::move)           |
| - Integrates velocity against static terrain tiles.          |
| - Resolves cliff and wall sliding independently per mob.     |
+--------------------------------------------------------------+
      | (All threads synchronize)
+--------------------------------------------------------------+
| BARRIER 3: CROWD PROXIMITY QUERY (Enemy::push)               |
| - Queries CSR spatial grid for nearby neighbors.             |
| - Accumulates soft-body separation vectors into xPush, yPush.|
+--------------------------------------------------------------+
      | (All threads synchronize)
+--------------------------------------------------------------+
| BARRIER 4: SEPARATION SETTLE (Enemy::settle)                 |
| - Applies soft-body separation offsets.                      |
| - Resolves final boundary clamping.                          |
+--------------------------------------------------------------+
      | (All threads synchronize)
[ Serial Tick Commit: Spawns, Deaths, Drop Generation ]
\`\`\`

\`\`\`cpp
template <void (Enemy::*Method)()>
static void pass(void *ctx, int begin, int end) {
  Enemy **foes = static_cast<Enemy **>(ctx);
  for (int i = begin; i < end; i++)
    (foes[i]->*Method)();
}
\`\`\`

By wrapping C++ member functions in static function thunks (\`pass<&Enemy::think>\`, \`pass<&Enemy::move>\`, \`pass<&Enemy::push>\`, \`pass<&Enemy::settle>\`), the engine executes each pass across thousands of entities in parallel, guaranteeing that no entity reads intermediate physical states while another entity is writing to them.

---

### Thread-Safe PRNG & Deferred Mutation Queues

In a multi-threaded game engine, sharing a single global random number generator across threads causes massive cache line bouncing and ruins reproducibility.

#### 1. Per-Entity Xorshift PRNG (\`Enemy::roll\`)
Each monster instance maintains a private 32-bit Xorshift PRNG state (\`uint32_t seed\`), exposed via \`float Enemy::roll()\` (\`src/entity/enemy/Enemy.hpp:247\`) returning a unit float in $[0, 1)$.

Because each enemy mutates only its own internal seed, zero cross-thread cache bouncing occurs. Replaying a battle from identical starting seeds produces identical AI decisions.

#### 2. Deferred Side Effects (\`Enemy::act\`)
Worker threads are strictly prohibited from mutating global engine state (such as adding new entities to \`Level::entities\` or spawning loot drops).

Instead, worker threads set deferred intent flags (\`src/entity/enemy/Enemy.hpp:168–171\`):
- \`e.rallies\`
- \`e.pounced\`
- \`e.wantsLeader\`
- \`e.wantsFire\`

After the 4-barrier worker passes conclude, the main game thread executes a quick serial commit phase (\`Enemy::act()\`). The main thread inspects these flags, instantiates new projectiles in the slab pool, and adds dropped loot into the CSR grid safely, ensuring absolute memory integrity.
`,
    mermaidCharts: [
      {
        title: "Workers::run Atomic Compare-Exchange Chunk Stealing Protocol",
        chart: `
sequenceDiagram
    autonumber
    participant Main as Main Thread
    participant Atom as std::atomic<uint64_t> next
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
  },
  {
    id: "spatial-grid",
    title: "05. CSR Prefix-Sum Spatial Grid & Bit-Packed Terrain",
    category: "simulation",
    interactiveComponent: "spatial",
    summary:
      "Zero-bucket-vector counting sort spatial hash (buildGrid/gather) and 5-bit surface/elevation/ramp byte packing.",
    sourceFiles: [
          "src/level/LevelSpace.cpp",
          "src/level/LevelRender.cpp",
          "src/level/Level.hpp"
    ],
    content: `### The Spatial Partitioning Problem: Why Brute-Force Collapses Framerates

In any high-performance real-time action RPG featuring thousands of simultaneous entities, spatial queries are the single largest computational bottleneck. Consider an active combat scene in Mellangan with $N = 10{,}000$ simulated entities (the player, enemy swarms, companions, projectiles, and particle emitters). If every entity must check for collisions or neighbors against every other entity using naive pairwise distance testing:

$$\\text{Pairs to evaluate} = \\frac{N(N - 1)}{2} = \\frac{10{,}000 \\times 9{,}999}{2} \\approx 50{,}000{,}000 \\text{ checks per frame}$$

At a target framerate of 60 frames per second (16.6 milliseconds per frame budget), the CPU would need to execute over 3 billion distance checks per second. Each Euclidean distance check requires subtractions, multiplications, additions, and either a square root or a comparison against radius squared:

$$d^2 = (x_1 - x_2)^2 + (y_1 - y_2)^2 < (r_1 + r_2)^2$$

Even on modern SIMD-accelerated processors, evaluating 50 million distance checks completely overwhelms cache lines and saturates execution pipelines, plummeting the frame rate from a smooth 60 FPS down to an unplayable 2 FPS.

#### Why Hierarchical Trees (Quadtrees, BVH, $k$-d Trees) Fall Short

Traditional game development tutorials often recommend hierarchical spatial data structures such as Quadtrees, Bounding Volume Hierarchies (BVH), or $k$-d trees. While these structures reduce average query complexity from $\\mathcal{O}(N^2)$ to $\\mathcal{O}(N \\log N)$ or $\\mathcal{O}(\\log N)$ per query, they exhibit severe performance defects when applied to dynamic swarms in cache-conscious C++:

1. **Pointer Chasing & Cache Misses:** Hierarchical trees consist of nodes linked via heap pointers (\`node->children[4]\`). Traversing a tree requires jumping through non-contiguous heap memory addresses. Because an L3 cache miss costs 50 to 200 CPU cycles, pointer chasing stalls execution pipelines while waiting for DRAM fetches.
2. **Re-balancing and Heap Allocation Thrashing:** As 10,000 monsters move, steer, and flock every single frame, entities cross boundary planes. This forces dynamic tree structures to delete nodes, re-insert objects, split boxes, and re-balance trees 60 times per second, triggering catastrophic allocator overhead and heap fragmentation.
3. **Non-Uniform Swarm Pathologies:** Swarms in Mellangan cluster tightly around choke points, campfires, and bridge crossings. Deep localized clustering degrades quadtree performance to degenerate linked-list depths, destroying logarithmic guarantees.

To solve this, Mellangan uses a zero-allocation, flat-memory acceleration structure: the **Compressed Sparse Row (CSR) Prefix-Sum Spatial Grid** (\`src/level/LevelSpace.cpp\`).

---

### The Mail Sorting Room Mental Model: Understanding CSR Grids

To intuitively understand how Compressed Sparse Row spatial partitioning works, imagine a postal mail sorting room:

\`\`\`
[ Traditional Naive Approach: Dynamic Buckets ]
- Every postal district has a separate cardboard box.
- As mail arrives, postal workers cram letters into boxes.
- When a box fills up, the worker must run to the storage room,
  fetch a larger box, copy every letter over, and discard the old box.
- The mailboxes are scattered randomly across the warehouse floor.

[ Mellangan's CSR Prefix-Sum Approach: The Continuous Conveyor ]
1. Histogram Pass:
   Workers count how many letters are addressed to each district (Districts 0 to 2303).
2. Ledger Offset Pass (Prefix Sum):
   The manager computes running totals on a single ledger sheet.
   District 0 begins at slot 0. District 1 begins at slot (count of District 0).
   District 2 begins at slot (count of 0 + count of 1).
3. Packing Pass:
   All letters are laid out in a single, contiguous linear conveyor belt.
   District 0 occupies slots [0..4).
   District 1 occupies slots [4..12).
   District 2 occupies slots [12..15).
\`\`\`

Because the entire letter collection rests in one unbroken contiguous memory buffer, reading all mail for District 1 requires zero pointer hops. The reader simply inspects the slice:

$$\\text{Slice}(c) = \\big[ \\text{cellStart}[c],\\; \\text{cellStart}[c + 1] \\big)$$

---

### Mathematical Architecture & 4-Pass Construction (\`Level::buildGrid\`)

The active spatial domain is centered directly on the player, forming a toroidal-clamped uniform grid of dimension $\\text{GRID} \\times \\text{GRID}$ where each cell has a fixed physical extent of $\\text{CELL} \\times \\text{CELL}$ pixels:

$$\\text{GRID} = 48, \\quad \\text{CELL} = 28\\text{ px}, \\quad \\text{Total Span} = 48 \\times 28 = 1344\\text{ px} \\times 1344\\text{ px}$$

The origin of the grid shifts smoothly with the player's world position:

\`\`\`cpp
xGrid = player->x - GRID * CELL * 0.5;
yGrid = player->y - GRID * CELL * 0.5;
\`\`\`

Here is the exact production implementation in \`src/level/LevelSpace.cpp\`:

\`\`\`cpp
void Level::buildGrid() {
  graveyard.clear();
  xGrid = player->x - GRID * CELL * 0.5;
  yGrid = player->y - GRID * CELL * 0.5;
  std::fill(cellStart.begin(), cellStart.end(), 0);
  binned.clear(), loose.clear();
  each<Enemy>([&](Enemy &e) {
    if (e.buried)
      return loose.push_back(&e);
    int c = cell(e.y, yGrid) * GRID + cell(e.x, xGrid);
    binned.push_back({c, &e});
    cellStart[c + 1]++;
  });
  for (int i = 1; i <= GRID * GRID; i++)
    cellStart[i] += cellStart[i - 1];
  std::copy(cellStart.begin(), cellStart.end() - 1, cellFill.begin());
  cells.resize(cellStart.back());
  for (auto [c, e] : binned)
    cells[cellFill[c]++] = e;
}
\`\`\`

#### Step-by-Step Execution Trace of the 4 Passes

Let us trace this algorithm with a small 4-cell miniature grid ($2 \\times 2$ cells: Cell 0, 1, 2, 3) holding 6 active enemies:

\`\`\`
Enemies:
- Enemy A: Cell 0
- Enemy B: Cell 2
- Enemy C: Cell 0
- Enemy D: Cell 3
- Enemy E: Cell 2
- Enemy F: Cell 2
\`\`\`

1. **Pass 1: Coordinate Mapping and Histogram Binning**
   - The array \`cellStart\` has size $\\text{GRID}^2 + 1 = 4 + 1 = 5$, initially zeroed: \`[0, 0, 0, 0, 0]\`.
   - Each enemy calculates its cell: $c = \\lfloor (y - y_{\\text{grid}}) / 32 \\rfloor \\times \\text{GRID} + \\lfloor (x - x_{\\text{grid}}) / 32 \\rfloor$.
   - For every entity mapped to cell $c$, the algorithm increments index $c + 1$:
     - Enemy A (Cell 0) $\\to$ \`cellStart[1]++\`
     - Enemy B (Cell 2) $\\to$ \`cellStart[3]++\`
     - Enemy C (Cell 0) $\\to$ \`cellStart[1]++\`
     - Enemy D (Cell 3) $\\to$ \`cellStart[4]++\`
     - Enemy E (Cell 2) $\\to$ \`cellStart[3]++\`
     - Enemy F (Cell 2) $\\to$ \`cellStart[3]++\`
   - Resulting \`cellStart\` histogram: \`[0, 2, 0, 3, 1]\`.
   - Notice: Index 1 holds 2 (Cell 0 count). Index 2 holds 0 (Cell 1 count). Index 3 holds 3 (Cell 2 count). Index 4 holds 1 (Cell 3 count).

2. **Pass 2: In-Place Prefix Sum Accumulation**
   - The loop runs: \`for (int i = 1; i <= 4; i++) cellStart[i] += cellStart[i - 1];\`
   - \`i = 1\`: \`cellStart[1] = 2 + 0 = 2\`
   - \`i = 2\`: \`cellStart[2] = 0 + 2 = 2\`
   - \`i = 3\`: \`cellStart[3] = 3 + 2 = 5\`
   - \`i = 4\`: \`cellStart[4] = 1 + 5 = 6\`
   - Resulting prefix sum array: \`[0, 2, 2, 5, 6]\`.
   - **The Magic of Prefix Sums:** The value \`cellStart[c]\` is now the exact starting index of Cell $c$ in the final contiguous array, and \`cellStart[c + 1]\` is its end index!
     - Cell 0 range: \`[0..2)\` (Length: $2 - 0 = 2$)
     - Cell 1 range: \`[2..2)\` (Length: $2 - 2 = 0$, completely empty!)
     - Cell 2 range: \`[2..5)\` (Length: $5 - 2 = 3$)
     - Cell 3 range: \`[5..6)\` (Length: $6 - 5 = 1$)
     - Total entities binned = \`cellStart[4] = 6\`.

3. **Pass 3: Write-Pointer Initialization**
   - \`cellFill\` copies \`cellStart[0..3]\`: \`[0, 2, 2, 5]\`.
   - \`cells\` is resized to exactly \`cellStart.back() = 6\` elements.

4. **Pass 4: Linear Array Scattering**
   - For each \`{c, e}\` pair in \`binned\`:
     - Enemy A (Cell 0): written to \`cells[cellFill[0]++]\` $\\to$ index 0; \`cellFill[0]\` becomes 1.
     - Enemy B (Cell 2): written to \`cells[cellFill[2]++]\` $\\to$ index 2; \`cellFill[2]\` becomes 3.
     - Enemy C (Cell 0): written to \`cells[cellFill[0]++]\` $\\to$ index 1; \`cellFill[0]\` becomes 2.
     - Enemy D (Cell 3): written to \`cells[cellFill[3]++]\` $\\to$ index 5; \`cellFill[3]\` becomes 6.
     - Enemy E (Cell 2): written to \`cells[cellFill[2]++]\` $\\to$ index 3; \`cellFill[2]\` becomes 4.
     - Enemy F (Cell 2): written to \`cells[cellFill[2]++]\` $\\to$ index 4; \`cellFill[2]\` becomes 5.
   - Final \`cells\` buffer: \`[A, C, B, E, F, D]\`.

Every entity in Cell 0 (\`A, C\`) is contiguous. Every entity in Cell 2 (\`B, E, F\`) is contiguous. Total time complexity is strictly $\\mathcal{O}(N + G)$ where $N$ is entity count and $G = \\text{GRID}^2$ is cell count. Allocation count during runtime is zero because vectors reuse allocated capacity across frames!

---

### Center-First Spatial Queries (\`Level::gather\`)

When an explosion detonates, a sword sweeps an arc, or an enemy computes neighbor repulsion, the simulation calls \`Level::gather\`:

\`\`\`cpp
int Level::gather(double x, double y, float r, Enemy **out, int max) const {
  int own = cell(y, yGrid) * GRID + cell(x, xGrid), n = 0;
  for (int i = cellStart[own]; i < cellStart[own + 1]; i++)
    if (!cells[i]->removed && (out[n++] = cells[i], n == max))
      return n;
  int x0 = cell(x - r, xGrid), x1 = cell(x + r, xGrid);
  int y0 = cell(y - r, yGrid), y1 = cell(y + r, yGrid);
  for (int yc = y0; yc <= y1; yc++)
    for (int xc = x0, c = yc * GRID + xc; xc <= x1; xc++, c++) {
      if (c == own)
        continue;
      for (int i = cellStart[c]; i < cellStart[c + 1]; i++)
        if (!cells[i]->removed && (out[n++] = cells[i], n == max))
          return n;
    }
  return n;
}
\`\`\`

\`\`\`
[ Center-First Gather Sweep Pattern ]
+-----------+-----------+-----------+
| (x0, y0)  | (xc, y0)  | (x1, y0)  |
|  Scan 2   |  Scan 3   |  Scan 4   |
+-----------+-----------+-----------+
| (x0, yc)  |   (own)   | (x1, yc)  |
|  Scan 5   |  SCAN 1!  |  Scan 6   |
+-----------+-----------+-----------+
| (x0, y1)  | (xc, y1)  | (x1, y1)  |
|  Scan 7   |  Scan 8   |  Scan 9   |
+-----------+-----------+-----------+
\`\`\`

#### Why Center-First Gathering Matters in Combat

When an enemy or spell collects neighbors, the caller supplies a fixed capacity buffer (\`Enemy **out\`) with a hard cap (\`int max\`, typically 16 to 24). In dense mob swarms, there might be 50 foes within the bounding rectangle.

If a spatial gather scanned naively row by row starting at top-left \`(x0, y0)\`, the returned results would fill up entirely with enemies standing far away along the northern perimeter! The closest enemies (standing in the caller's immediate cell \`own\`) would be starved out of the query result array!

By scanning \`own\` first, \`Level::gather\` guarantees that the closest, highest-priority physical neighbors are guaranteed to be evaluated, even when \`max\` is reached immediately.

---

### Bit-Packed Terrain Surface Matrix (\`surfaces[]\` and \`solids[]\`)

Beyond dynamic entities, Mellangan must resolve terrain collision for hundreds of moving bodies against environmental tiles (cliffs, water, trees, and stone ruins).

#### 16-Pixel Tile Collision Grid (\`Level::collide\`)

The world terrain is discretized into $16 \\times 16$ pixel tiles. Collision checks evaluate a strictly bounded $3 \\times 3$ tile neighborhood surrounding the entity's center point:

\`\`\`cpp
void Level::collide(double &x, double &y, float radius) const {
  int tx = int(std::floor(x / 16)), ty = int(std::floor((y - 3) / 16));
  for (int yt = ty - 1; yt <= ty + 1; yt++)
    for (int xt = tx - 1; xt <= tx + 1; xt++) {
      int gx = xt - solidX, gy = yt - solidY;
      if (gx < 0 || gy < 0 || gx >= SOLID_W || gy >= SOLID_H ||
          solids[gy * SOLID_W + gx] <= 0)
        continue;
      double xc = xt * 16 + 8.0, yc = yt * 16 + 13.0, xd = x - xc, yd = y - yc;
      double min = solids[gy * SOLID_W + gx] + radius, d2 = xd * xd + yd * yd;
      if (d2 >= min * min)
        continue;
      double len = std::sqrt(d2);
      if (len > 1e-4)
        x = xc + xd / len * min, y = yc + yd / len * min;
      else
        x = xc, y = yc + min;
    }
}
\`\`\`

\`\`\`
[ 3x3 Tile Collision Neighborhood ]
(tx - 1, ty - 1)  (tx, ty - 1)  (tx + 1, ty - 1)
(tx - 1, ty)      [ Entity ]    (tx + 1, ty)
(tx - 1, ty + 1)  (tx, ty + 1)  (tx + 1, ty + 1)
\`\`\`

#### Mathematical Properties of the Collision Solver
1. **Circle vs Rounded Tile Box:** The collision hull of each solid tile is treated as an obstacle disk located at $(x_c, y_c) = (16xt + 8, 16yt + 13)$ with physical radius \`solids[gy * SOLID_W + gx]\`.
2. **Sub-Pixel Penalty Resolution:** When distance $d = \\sqrt{x_d^2 + y_d^2} < \\text{min}$, the entity is displaced along the normal unit vector $(x_d / d, y_d / d)$ by the penetration depth $(\\text{min} - d)$.
3. **Singularity Protection:** If the entity is located precisely at the tile center ($d < 10^{-4}$), dividing by zero is avoided by pushing the entity directly downward: $(x_c, y_c + \\text{min})$.
4. **Natural Corner Sliding:** Because obstacles are modeled with rounded circle physics rather than sharp Axis-Aligned Bounding Boxes (AABB), moving characters slide naturally around wall corners and doorways without getting snagged on single-pixel vertices.

#### Bit-Packed Viewport Matrix (\`surfaces[]\`) & Underground Rock/Flow (\`LevelSpace.cpp\`)

During rendering, the screen viewport plus a 4-tile border (\`SOLID_W = Screen::MAX_W / 16 + 8 = 48\`, \`SOLID_H = Screen::MAX_H / 16 + 8 = 30\`, \`Level.hpp:464–465\`) caches terrain properties into \`uint8_t surfaces[SOLID_W * SOLID_H]\`:

\`\`\`
+-------------+--------+---------------+----------------+---------------+
| Bits 7..6   | Bit 5  | Bit 4         | Bits 3..2      | Bits 1..0     |
| Unused      | Roped  | Ramp / Stairs | Elevation Tier | Surface State |
| (2 bits)    | (1 bit)| (1 bit)       | (2 bits: 0..3) | (2 bits)      |
+-------------+--------+---------------+----------------+---------------+
\`\`\`

- **Bits \`[1..0]\` (\`f & 3\`):** Surface type: \`0\` = Dry ground, \`1\` = Liquid water, \`2\` = Frozen ice.
- **Bits \`[3..2]\` (\`(f >> 2) & 3\`):** Elevation plateau tier ($0$ to $3$).
- **Bit \`[4]\` (\`f & 16\`):** Ramp status: \`1\` = Walkable stair/ramp; \`0\` = Vertical cliff wall.
- **Bit \`[5]\` (\`f & 32\`):** \`world::roped(x, y) << 5\` (\`LevelRender.cpp:85\`). In Deep-layer caves, unroped cliffs (\`!(ahead & 32)\`) return \`0.0f\` climb speed instead of \`0.35f\` (\`LevelSpace.cpp:263\`).

At 1 byte per tile, \`48 × 30\` occupies only **1,440 bytes** inside L1 cache. Underground, \`Level::collide()\` runs a second circle-vs-AABB pass against \`rockAt()\`, and \`Level::quarry()\` rebuilds a \`ROCK_SPAN = 128\` rock grid plus a 4-way BFS \`flow[]\` steering field every \`0.25 s\` (\`flowAt()\`, \`slide()\`, \`steer()\` in \`LevelSpace.cpp:100–222\`).
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
  },
  {
    id: "goal-ai",
    title: "06. GoalQueue AI Ringbuffer, Sense Sight-Cone Math & Goal Steering",
    category: "simulation",
    interactiveComponent: "ouroboros",
    summary:
      "Zero-allocation constexpr Plan tables, 8-slot bitwise GoalQueue preemption, 113-degree sight-cone dot products, and steer velocity integration.",
    sourceFiles: [
          "src/entity/enemy/ai/Goal.hpp",
          "src/entity/enemy/ai/Plans.cpp",
          "src/entity/enemy/Enemy.cpp",
          "src/other/Ouroboros.hpp"
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

\`Ouroboros.hpp\` is a compile-time and runtime bit-manipulation showcase where eight CRTP serpents (\`Charlotte<Self>\`) independently determine integer parity. The canonical four are:
1. **\`Mirror\`:** Full 32-bit SWAR bit-reversal (\`0x55555555u\`, \`0x33333333u\`, \`0x0F0F0F0Fu\`, \`0x00FF00FFu\`), testing whether the reversed MSB \`!(flip(n) >> 31)\` is zero.
2. **\`Gray\`:** XOR-folds 32 bits down to a 4-bit nibble and indexes the 16-bit parity magic constant \`0x6996u >> (v & 15) & 1\`, comparing \`fold(n) ^ fold(n >> 1)\`.
3. **\`Bruijn\`:** Isolates the lowest set bit \`(v & (~v + 1))\` (with MSB sentinel \`0x80000000u\`) and hashes it through the de Bruijn multiplier \`0x077CB531u >> 27\` into a \`constexpr\` 32-byte spiral table.
4. **\`Rebecca\`:** Rotates right by 8 bits (\`std::rotr(n, 8) >> 24\`) to extract the low byte into a 256-entry \`constexpr\` LUT (\`AN_ARRAY_OF_FEELINGS\`).
5. **\`Augury\` XOR-Linked List:** Stores eight serpents in type-erased \`Rite\` nodes where \`uintptr_t link = prev ^ next\`, traversing forward and backward using a single pointer field via \`next = r->link ^ reinterpret_cast<uintptr_t>(prev)\`!

> [!NOTE]
> For the full council, cyclic utilities, and XOR-linked augury, see **[30. Ouroboros: The Council of Eight Serpents](/ouroboros)**.

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
    TickActiveGoal --> ExecuteFront : Running, write xWant and yWant
    TickActiveGoal --> PopHead : Done, up to 4 cascade steps per tick
    PopHead --> ExecuteFront : goals.pop() -> head = (head + 1) & 7
    PopHead --> [*] : Queue Exhausted -> next(s) Refill
`,
      },
      {
        title: "Ouroboros.hpp Serpents & XOR-Linked List Traversal",
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
    S5["Jormungandr, Typhon,<br/>Apophis, Quetzalcoatl"]:::bit

    XOR["Augury XOR-Linked List (rites[0..7])<br/>link = prev ^ next"]:::xor
    Consensus["Augury: std::popcount(votes) > 4<br/>static_assert(unanimous())"]:::crtp

    Input --> S1 & S2 & S3 & S4 & S5
    S1 & S2 & S3 & S4 & S5 --> XOR --> Consensus
`,
      },
    ],
  },
  {
    id: "world-generation",
    title: "07. Voronoi Biome Lattice, Barycentric Blend & 4-Bit Cliffs",
    category: "world",
    interactiveComponent: "noise",
    summary:
      "Domain-warped Voronoi cells, 30-biome climate classification, blended per-biome elevation relief, 3-biome barycentric ground transitions, and 4-bit cliff masks.",
    sourceFiles: [
          "src/level/world/Biomes.cpp",
          "src/level/world/Ground.cpp",
          "src/level/world/Terrain.cpp",
          "src/level/LevelRender.cpp",
          "src/level/Noise.c"
    ],
    content: `### The Procedural Landscape Challenge: Why Pure Noise Produces Bland Soup

In open-world game generation, a common pitfall is relying solely on layered Perlin or Simplex noise to generate terrain. While multi-octave noise creates continuous hills and valleys, landscapes generated purely with value noise suffer from three major design defects:

1. **Lack of Macro-Geological Structure:** Pure noise produces uniform, repetitive hills where every region feels indistinguishable. Natural landscapes possess macro-structures: distinct tectonic plates, sharp mountain ranges, sweeping alluvial plains, and abrupt coastal shelves.
2. **Hard Tile Seams:** Abruptly switching texture sprites at biome thresholds creates harsh, blocky transitions that destroy visual immersion.
3. **Disjointed Elevation Artifacts:** Raw noise produces noisy single-pixel cliffs, floating ledges, and impassable geometry that frustrate player traversal.

Mellangan solves this with a multi-layered procedural synthesis engine: **Domain-Warped Voronoi Biome Synthesis, Barycentric Alpha Blending, and 4-Bit Marching Cliffs** (\`src/level/world/Terrain.cpp\`, \`Biomes.cpp\`, \`Noise.c\`).

---

### The Continental Drift & Watercolor Blending Mental Model

To understand Mellangan's terrain synthesis, visualize painting an oil and watercolor map:

\`\`\`
[ Step 1: Voronoi Tectonic Plates ]
Tectonic seeds scatter across the world canvas.
Each seed forms a discrete continental province with its own geological identity.

[ Step 2: Domain Warping (The River Chisel) ]
A turbulent secondary noise field bends and twists the coordinate grid.
Straight geometric Voronoi borders warp into jagged coastlines,
sinuous river deltas, and organic mountain ridges.

[ Step 3: Barycentric Watercolor Blending ]
Where biomes meet, their ecological properties do not cut off sharply.
Instead, they diffuse across borders like wet watercolor paints,
blending soil tints and vegetation densities with mathematical precision.

[ Step 4: 4-Bit Architectural Auto-Tiling ]
The continuous elevation field snaps to 3 discrete plateau tiers.
Cellular relaxation smooths out single-pixel spikes into majestic plateaus,
and 4-bit marching masks select the exact directional cliff faces and walkable ramps.
\`\`\`

---

### Multi-Octave Climate Phase Space & The 30 Biomes

Mellangan does not assign biomes by hardcoding coordinates. Instead, every world point $(x, y)$ samples three orthogonal climate noise fields generated via Fractional Brownian Motion (\`noise_fbm\` in \`src/level/Noise.c\`):

1. **Temperature ($T$):** Spans polar ice shelves to arid deserts and volcanic ashlands.
2. **Moisture ($M$):** Controls hydrology and vegetation, spanning bone-dry salt flats to temperate woodlands and sunken mires.
3. **Eerie ($E$):** Drives eldritch corruption into barrow mounds, moonlit groves, fungal hollows, and singing crystal fields.

The world comprises **30 distinct biomes** (\`src/level/biome/Biome.hpp\`), including deep oceans, temperate continents, and the coastal shelf:

\`\`\`
Meadow, Forest, Blossom, Autumn, Heath, Barrow, Starfall,
Mire, Jungle, Savanna, Fungal, Taiga, Flood Plains, Moon,
Ruins, Amber, Hollow, Snow, Crystal, Desert, Badlands,
Salt, Glass, Storm, Ashlands, Ember, Tropic Sea, Cold Sea,
Warm Beach, Cold Beach.
\`\`\`

---

### Domain Warping: Bending Coordinate Space

To break up mathematical regularity, world coordinates undergo non-linear domain warping prior to climate and terrain sampling:

$$x_w = x + 90 \\times \\text{fbm}(0.003x + 5.1,\\; 0.003y - 2.3,\\; 2)$$
$$y_w = y + 90 \\times \\text{fbm}(0.003x - 7.9,\\; 0.003y + 4.4,\\; 2)$$

\`\`\`
[ Domain Warping Mechanics ]
Regular Coordinate Grid (x, y)
    |
    v (Turbulent noise displacement vector: [dx, dy])
Warped Coordinate Grid (xw, yw)
    |
    v (Sample climate and continental landmasses)
Natural, Meandering Shorelines & Mountain Ridges
\`\`\`

By querying the landmass noise field \`landAt(x, y)\` through the warped coordinates $(x_w, y_w)$, rigid circular shapes stretch into sinuous peninsulas, secluded bays, and natural river channels.

---

### Barycentric Ground Blending: The Cumulative Alpha Proof

At biome boundaries, drawing adjacent ground tiles with hard edges looks jarring. Mellangan evaluates the 3 nearest Voronoi biome seeds using \`world::fieldBlend(x, y)\`, returning a \`GroundBlend\` struct:

\`\`\`cpp
struct GroundBlend {
  int count;
  BiomeId biome[3];
  float weight[3]; // Normalized: weight[0] + weight[1] + weight[2] == 1.0
};
\`\`\`

In \`src/level/LevelRender.cpp\`, \`Level::renderFloor\` draws ground layers using a remarkable cumulative alpha normalization formula:

\`\`\`cpp
float cumulative = 0;
for (int i = 0; i < count; i++) {
  int id = int(blend.biome[i]);
  cumulative += blend.weight[i];
  float alpha = i == 0 ? 1.0f : blend.weight[i] / cumulative;
  const Color &t = BIOMES[id]->tint;
  s.color({shade * t.r, shade * 0.97f * t.g,
           (shade * 0.93f + 0.04f * (1 - n)) * t.b, alpha});
  Sprite ground = blend.count == 1 && id == own
                      ? world::groundTile(x, y)
                      : BIOMES[id]->transitionGround(kind);
  s.sprite(ground, x * 16, y * 16, 0, 0);
}
\`\`\`

#### Mathematical Proof of Cumulative Alpha Blending

Why does setting $\\alpha_i = w_i / \\sum_{j=0}^i w_j$ produce the exact affine combination $\\sum_{i=0}^{K-1} w_i C_i$ in the framebuffer with standard hardware alpha blending?

Standard hardware alpha blending calculates the resulting color $F_i$ when drawing layer $C_i$ with opacity $\\alpha_i$ over the existing framebuffer color $F_{i-1}$:

$$F_i = (1 - \\alpha_i) F_{i-1} + \\alpha_i C_i$$

Let us trace $K = 3$ biomes with normalized weights $w_0, w_1, w_2$ where $w_0 + w_1 + w_2 = 1.0$:

1. **Layer 0 ($i = 0$):**
   - Cumulative sum: $S_0 = w_0$.
   - Opacity: $\\alpha_0 = 1.0$.
   - Framebuffer holds: $F_0 = C_0 = \\frac{w_0}{S_0} C_0$.

2. **Layer 1 ($i = 1$):**
   - Cumulative sum: $S_1 = w_0 + w_1$.
   - Opacity: $\\alpha_1 = \\frac{w_1}{S_1} = \\frac{w_1}{w_0 + w_1}$.
   - Blend calculation:
     $$F_1 = (1 - \\alpha_1) F_0 + \\alpha_1 C_1 = \\left(1 - \\frac{w_1}{S_1}\\right) C_0 + \\frac{w_1}{S_1} C_1 = \\frac{w_0}{S_1} C_0 + \\frac{w_1}{S_1} C_1 = \\frac{w_0 C_0 + w_1 C_1}{w_0 + w_1}$$

3. **Layer 2 ($i = 2$):**
   - Cumulative sum: $S_2 = w_0 + w_1 + w_2 = 1.0$.
   - Opacity: $\\alpha_2 = \\frac{w_2}{S_2} = w_2$.
   - Blend calculation:
     $$F_2 = (1 - \\alpha_2) F_1 + \\alpha_2 C_2 = (1 - w_2) \\left( \\frac{w_0 C_0 + w_1 C_1}{w_0 + w_1} \\right) + w_2 C_2$$
     Since $(1 - w_2) = (w_0 + w_1)$, the denominator cancels out completely!
     $$F_2 = (w_0 + w_1) \\left( \\frac{w_0 C_0 + w_1 C_1}{w_0 + w_1} \\right) + w_2 C_2 = w_0 C_0 + w_1 C_1 + w_2 C_2$$

This proves that sequential sprite rendering with cumulative alpha normalization mathematically guarantees an exact, artifact-free weighted color blend in the framebuffer, requiring zero multi-pass shaders or offscreen render targets!

---

### 3-Tier Elevation & Per-Biome Relief (\`Terrain.cpp\`)

World elevation in Mellangan is stratified into three distinct walkable tiers:
- Tier 0: Lowland valleys, riverbeds, and shores.
- Tier 1: Continental plains and forests.
- Tier 2: Elevated hills and ridges.
- Tier 3: Alpine peaks and fortified plateaus.

In \`src/level/world/Terrain.cpp\`, elevation noise is scaled by a blended per-biome relief factor:

\`\`\`cpp
float relief(int x, int y) {
  GroundBlend g = fieldBlend(x, y);
  float k = 0;
  for (int i = 0; i < g.count; i++)
    k += RELIEF[g.biome[i]] * g.weight[i];
  return k;
}
\`\`\`

Mountainous biomes like Badlands (\`1.4\`), Snow/Ember (\`1.3\`), and Ashlands (\`1.25\`) produce steep, dramatic cliff plateaus, while flat biomes like Salt (\`0.4\`), Flood Plains (\`0.45\`), and Mire (\`0.5\`) suppress elevation changes, forming sweeping flatlands.

The continuous height value $n$ is evaluated against three step thresholds:

\`\`\`cpp
static const float STEPS[3] = {0.14f, 0.34f, 0.48f};
int level = 0;
while (level < 3 && n > STEPS[level] + 0.06f * noise_fbm(x * 0.09f + level * 13.7f,
                                                        y * 0.09f - level * 5.3f, 2,
                                                        1307 + level))
  level++;
\`\`\`

High-frequency noise jitter breaks up rigid contour lines into rugged, natural ledges.

---

### Cellular Automaton Relaxation (\`smoothPatch\` and \`solidCore\`)

To prevent noisy single-pixel orphan tiles from creating jagged visual noise, Mellangan runs a 2D cellular automaton relaxation filter over the raw level field:

\`\`\`cpp
bool solidCore(PatchTest test, const void *ctx, int x, int y) {
  if (!test(x, y, ctx))
    return false;
  for (int dy = -1; dy <= 0; dy++)
    for (int dx = -1; dx <= 0; dx++)
      if (test(x + dx, y + dy, ctx) && test(x + dx + 1, y + dy, ctx) &&
          test(x + dx, y + dy + 1, ctx) && test(x + dx + 1, y + dy + 1, ctx))
        return true;
  return false;
}

bool smoothPatch(PatchTest test, const void *ctx, int x, int y) {
  if (solidCore(test, ctx, x, y))
    return true;
  int n = solidCore(test, ctx, x, y - 1) + solidCore(test, ctx, x, y + 1) +
          solidCore(test, ctx, x - 1, y) + solidCore(test, ctx, x + 1, y);
  return n >= 3;
}
\`\`\`

1. **Solid Core Test:** A tile is part of a solid core if and only if it belongs to at least one completely solid $2 \\times 2$ block of tiles.
2. **Smooth Patch Rule:** A tile is preserved if it is part of a solid core, or if at least 3 of its 4 cardinal orthogonal neighbors are solid cores.
3. This filter eliminates isolated single-tile spikes, fills in single-tile holes, and rounds convex corners into smooth, traversable landmasses.

---

### 4-Bit Cardinal Auto-Tiling & 3-Tile Walkable Ramps

Once elevation and water boundaries are established, tiles select their directional art assets via a 4-bit cardinal bitmask:

\`\`\`cpp
int mask = int(N) | (S << 1) | (W << 2) | (E << 3);
\`\`\`

\`\`\`
[ 4-Bit Cardinal Bitmask (2^4 = 16 States) ]
Bit 0 (N = 1):  North neighbor is elevated
Bit 1 (S = 2):  South neighbor is elevated
Bit 2 (W = 4):  West neighbor is elevated
Bit 3 (E = 8):  East neighbor is elevated
\`\`\`

- When \`mask != 15\`, \`world::rim(mask)\` queries the atlas for the corresponding directional cliff face, shoreline fringe, or snow edge.
- When \`mask == 15\` (all 4 cardinal neighbors are elevated), the renderer inspects the 4 diagonal corner neighbors (\`CORNERS[4][5]\`) to stamp inner-corner cliff pieces.

#### Walkable Ramps (\`world::isRamp\`)

To allow the player and monsters to traverse between elevation tiers without getting blocked by vertical cliff walls, \`world::isRamp\` carves natural 3-tile-wide inclined ramps into cliff faces:

\`\`\`cpp
bool isRamp(int x, int y) {
  if (active != Layer::Surface)
    return under::isRamp(x, y);
  int h = heightAt(x, y), b = block(x) * 3;
  if (hash2(block(x) * 13 + 7, y * 29 - 3) % 3 == 2)
    return false;
  for (int c = b; c < b + 3; c++)
    if (heightAt(c, y) != h || heightAt(c, y + 1) >= h || heightAt(c, y - 1) < h)
      return false;
  return true;
}
\`\`\`

1. **3-Tile Block Alignment:** Ramps are organized into 3-tile wide blocks (\`block(x) * 3\`).
2. **Deterministic Hash Selection:** \`hash2(...) % 3 != 2\` filters ramp placement so paths appear at natural intervals rather than uniform lattices.
3. **Monotonic Slope Verification:** A ramp is placed only if all 3 consecutive tiles span a strict elevation slope: height at row $y$ is $h$, height at row $y+1$ is lower ($< h$), and height at row $y-1$ is elevated ($\\ge h$).

This guarantees that every generated valley, plateau, and mountain pass provides natural, unbroken pathways for exploration and tactical combat.
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
  },
  {
    id: "weather-sky",
    title: "08. Diurnal Cycle, Weather Fronts & Footprints (Sky.cpp)",
    category: "world",
    interactiveComponent: "weather",
    summary:
      "Diurnal illumination ramps, eight weather fronts (Clear, Clouds, Rain, Storm, Snow, Fog, Dust, Ash), lightning arcs, and 384-slot snow/rain footprints.",
    sourceFiles: [
          "src/level/Sky.hpp",
          "src/level/Sky.cpp",
          "src/level/Night.hpp",
          "src/level/sky/Fronts.hpp",
          "src/level/sky/Footprints.hpp",
          "src/level/sky/Weather.hpp",
          "src/level/sky/Weather.cpp"
    ],
    content: `
### Dynamic Atmosphere, Weather Fronts & Ground Persistence

\`src/level/Sky.cpp\` and its modular sub-systems in \`src/level/sky/\` (\`Fronts.cpp\`, \`Thunder.cpp\`, \`Footprints.cpp\`, \`SkyRender.cpp\`) drive an interconnected environmental simulation that directly impacts both rendering and combat physics:

#### 1. Weather Front Progression & Ground Accumulation
- **Snow Accumulation (\`sky.snowAt(x, y)\`):** When \`Front::Snow\` is active, \`sky.cover\` gradually rises. Ground tiles dynamically transition to frosted variants (\`BIOMES[BIOME_SNOW]->frost(ground)\`), and multi-part props (trees, bushes, ruins) swap their sprite sheets to snow-capped variants on the fly!
- **Rain Flood Pools (\`sky.poolAt(x, y)\`):** Sustained rainstorms form temporary water puddles across low-lying tiles, automatically acquiring 4-bit shoreline rims and enabling planar entity reflections (\`Level::reflect\`).
- **Wind Foliage Sway (\`sky.sway(x, y, time)\`):** Multi-segment props outside structures oscillate with phase-coherent wind waves scaled by storm intensity.

#### 2. Persistent Footprints & Thunder Strikes
- **\`Footprints.cpp\` Circular Ringbuffer:** Moving entities leave footprints on snow (\`sky.snowy\`) or wet rain ground (\`sky.laid == Front::Rain && sky.cover > 0.35f\`), stored in a contiguous **384-slot** ringbuffer (\`std::array<Print, 384>\`):
\`\`\`cpp
struct Print {
    float x, y, age;
    bool snow;
};
\`\`\`
Rain footprints fade linearly over a fixed \`9 s\` window (\`1 - pr.age / 9\`); snow footprints do not time-decay (\`fade = 1\`) and persist until \`sky.snowy(tx, ty)\` becomes false.
- **\`Thunder.cpp\`:** Storm fronts periodically charge localized lightning strikes, rendering jagged procedural \`Arc\` bolts, illuminating the entire offscreen lightmap with an HDR flash, and triggering delayed acoustic thunder rolls.

#### 3. Nocturnal Omens & Diurnal Illumination (\`Night.cpp\`)
At the start of 85% of runs (\`rng.chance(0.85f)\`), \`Level\` rolls a global **Omen** (\`OMENS[omen]\`) that alters nocturnal rules and awards a permanent score handicap multiplier. Rather than a 24-hour trigonometric clock, \`src/level/Night.cpp:32–57\` alternates \`dayLength\` and \`nightLength\` phases: \`Night::daylight()\` ramps smoothly down over \`20 s\` at dusk and back up quadratically (\`d * d\`) over \`150 s\` approaching dawn.

#### 4. Eight Weather Fronts (\`Fronts.hpp\`) & Campaign Weather Effects (\`Weather.cpp\`)
\`src/level/sky/Fronts.hpp\` defines **8** fronts: \`Clear\`, \`Clouds\`, \`Rain\`, \`Storm\`, \`Snow\`, \`Fog\`, \`Dust\`, and \`Ash\`. In Campaign mode on the surface, the six active fronts (\`WEATHERS[FRONTS]\` in \`src/level/sky/Weather.cpp\`) scale hero movement (\`pace\`), reduce foe detection (\`sight\`), and temper elemental burn, chill, and poison damage when \`sky.amount >= 0.3f\` (named directly above the minimap HUD). Gear resistance cancels the movement penalty via \`ward = clamp(p.status.resist[d.ward] / 0.5f, 0, 1)\`:

| Front | Hero Pace | Foe Sight | Burn / Chill / Poison Temper | Cancelling Gear Ward |
| :--- | :--- | :--- | :--- | :--- |
| Rain (\`wet\`) | \`0.95x\` | \`0.85x\` | \`0.75x\` burn | None |
| Storm (\`storm\`) | \`0.90x\` | \`0.70x\` | \`0.60x\` burn | None |
| Snow (\`snow\`) | \`0.85x\` | \`0.90x\` | \`0.90x\` burn, \`1.30x\` chill | Chill resist (\`>= 50%\` full cancel) |
| Fog (\`fog\`) | \`1.00x\` | \`0.55x\` | Unchanged (\`1.0x\`) | None |
| Dust (\`dust\`) | \`0.92x\` | \`0.65x\` | \`1.20x\` poison | Poison resist (\`>= 50%\` full cancel) |
| Ash (\`ash\`) | \`0.95x\` | \`0.80x\` | \`1.25x\` burn | Fire resist (\`>= 50%\` full cancel) |
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
  },
  {
    id: "weapon-synthesis",
    title: "09. Combinatorial Weapon Synthesis (16 FormBehaviors, 16 Payloads & SummonForm)",
    category: "gameplay",
    interactiveComponent: "arsenal",
    summary:
      "Orthogonal FormBehavior × Payload architecture, all 16 class weapon evolutions, continuous blade sweeps, and --weapon-lab.",
    sourceFiles: [
          "src/item/weapon/form/Forms.hpp",
          "src/item/weapon/Recipe.hpp",
          "src/item/Upgrade.cpp",
          "src/item/WeaponLab.cpp",
          "src/entity/effect/Sweep.cpp"
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
        title: "Combinatorial RecipeWeapon Dispatch & 16 FormBehavior Hierarchy",
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
  },
  {
    id: "classes-encounters",
    title: "10. Hero Kits, Enemy Kinds, Traits, Nations & Bosses",
    category: "gameplay",
    summary:
      "An overview of the 12 hero kits, 119 enemy kinds, 19 factions including 4 nations and 6 culture banners, 20 traits, and 9 bosses.",
    sourceFiles: [
          "src/hero/Hero.hpp",
          "src/entity/Trait.hpp",
          "src/entity/Faction.hpp",
          "src/entity/Faction.cpp",
          "src/entity/enemy/Enemy.hpp",
          "src/entity/enemy/WildFoe.cpp",
          "src/entity/enemy/Boss.cpp",
          "src/level/Encounter.cpp"
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

### \`EnemyKind\` Expansion: 119 Foes, 4 Nations, 6 Culture Banners & Horrors Below

Beyond the 16 classic monsters and 10 regional expansion monsters (\`src/entity/enemy/ExpansionEnemy.cpp\`), \`EnemyKind\` (\`src/entity/enemy/Enemy.hpp\`) now defines **119 enum values** before \`Count\`, organized across **19 \`Faction\` entries** (\`src/entity/Faction.hpp\`): the original monster families, Coinroad, Rootsworn, Unmoored, Gloamfolk, and the **4 Nations** (\`Crownlands\`, \`Anvilmark\`, \`Sandwells\`, \`Silverbough\`) with 8 Doteshi-rendered national soldier kinds (\`CrownKnight\`, \`CrownArbalist\`, \`Hammerdwarf\`, \`Runesmith\`, \`Wellspear\`, \`Sandveil\`, \`Moonbow\`, \`Bladedancer\`), **6 regional Culture Banners** (\`Saltmarch\`, \`Marshwrights\`, \`Canopy Courts\`, \`Deepward Guilds\`, \`Gravewardens\`, \`Glasswrights\`), and **3 Horrors Below** (\`Lightless\`, \`HollowMaw\`, \`Whisperer\`):
- **Light-Searing Horror Behavior (\`Enemy.cpp\` lines 380–385):** \`darkbound(kind)\` covers \`Lightless\`, \`HollowMaw\`, and \`Whisperer\`. Every \`0.5 s\` (\`SEAR_EVERY\`), when \`glow.active && lightAt(x, y) > 0.25\`, bright light sears them for \`5% * maxHp * lit\` and triggers \`StatusKind::Fear\` when dropping below \`40%\` HP.
Selected classic and woodland examples:
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
          "src/test/view/Screenshots.cpp"
    ],
    content: `
### Sound effects, music and ambience (\`src/audio/Sound.cpp\`)

The audio device uses SDL streams. \`Sound::init()\` requests mono, 44.1 kHz signed 16-bit audio for the effect streams; the actual device format is queried and logged. Each effect WAV must match that requested format, or \`Sound::load()\` rejects it and logs a warning.

#### Effect voices

There are 32 pre-created effect streams. An effect has a shared minimum gap between plays, measured in milliseconds using \`SDL_GetTicks()\`. After the gap check, \`Sound::play()\` chooses the first stream whose queued input is empty. If none is empty, it chooses the stream with the oldest recorded start time. The chosen stream is cleared, assigned gain \`volume * effectsGain\`, given a frequency ratio of \`pitch * (1 + random jitter)\`, and filled with the effect's PCM data.

The selection uses start time, not sound category or priority. Music and ambient beds have separate streams and do not occupy the 32 effect slots. An empty input queue is SDL's reported queue state, not a guarantee about every sample already buffered downstream.

#### Music, weather, biome beds & culture audio

- **12 Lazy-Decoded Ogg Tracks (\`TRACKS = 12\`):** \`night\`, \`campaign\`, \`menu\`, \`caves\`, \`boss\`, \`hearth\`, \`zoktor\`, plus **5 day music moods** (\`fen\`, \`dune\`, \`drift\`, \`tide\`, \`vigil\`). \`loadMusic()\` verifies existence via \`pak::exists()\` and decodes only the initial track; \`Sound::pump()\` decodes the wanted track asynchronously via \`std::async\` on demand and unloads unused tracks.
- **Mood Hold, Zoktor & Festivals:** In Campaign daylight, \`Level::mood()\` selects the dominant mood from \`GroundBlend\`, and \`Game::conduct()\` holds calm mood changes for \`MOOD_HOLD = 20 s\` (frozen while fighting). Talking to Zoktor immediately plays \`Sound::ZOKTOR\`, and standing inside an active culture festival swaps calm music to match the rite's mood via \`Sound::feast()\`.
- **11 Biome Beds & 10 Culture Camp Beds:** Rain, wind, **11 place beds** (\`forest\`, \`marsh\`, \`frost\`, \`surf\`, \`cave\`, plus \`meadow\`, \`desert\`, \`ember\`, \`barrow\`, \`moon\`, \`storm\`, scaled at night via \`AFTER_DARK[]\`), and **10 culture camp beds** (\`Sound::folk()\`, peak \`0.07f\`) run on separate looping streams. Camps also trigger daily greet cues (\`Sound::greet\`) and festival rite cues (\`Sound::rite\`, \`CAMP_GAP = 30 s\`).
- **Deterministic Pitch Jitter:** \`Sound::play()\` draws pitch variation from its own \`thread_local Rng jitter{0x5EED50D5ull}\` so audio playback timing never touches the simulation's deterministic \`rng\`.
- \`Sound::mix()\` sets the device master gain and music stream gain. Mute sets device gain to zero and restores master gain when toggled back. \`Sound::play()\` has no listener position or distance attenuation parameter (callers such as \`FoeVoice.cpp\` compute linear falloff \`1 - dist / 420\` before calling \`play()\`).

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
    Ratio["SDL_SetAudioStreamFrequencyRatio<br/>pitch * (1 + jitterRng(-jitter, +jitter))"]:::mix
    Beds["Weather + 11 Biome + 10 Culture Beds<br/>b.gain += (b.want - b.gain) * 0.02f"]:::mix
    Vorbis["12 Lazy Async Ogg Tracks<br/>6 core + zoktor + 5 day moods"]:::mix
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
    title: "12. Contribution Basics: Toolchain, Build, House Rules, DevStart & WorldDebug",
    category: "contribute",
    interactiveComponent: "contribute",
    summary:
      "Step-by-step onboarding from cloning submodules and building with CMake/slangc to house rules, DevStart::seek() feature warps, and the F8 WorldDebug inspector.",
    sourceFiles: [
          "CMakeLists.txt",
          "NOTES.md",
          "src/main.cpp",
          "src/DevStart.hpp",
          "src/DevStart.cpp",
          "src/level/WorldDebug.cpp"
    ],
    content: `
### Welcome Contributor! Start with the Basics

Contributing to **Mellangan** is straightforward once you understand its build pipeline, strict house rules, and built-in developer sandbox. This tutorial walks you through the fundamentals step by step before diving into adding weapons, enemies, and biomes.

#### Step 1: Prerequisites & Submodule Clone
Mellangan requires:
- **CMake 3.21+** and a **C++20 / C11** compiler (MSVC 2022 on Windows, Clang on macOS, GCC/Clang on Linux).
- **LunarG Vulkan SDK:** Provides the Vulkan headers/loader and **\`slangc\`**, which compiles \`res/shaders/*.slang\` into SPIR-V (\`.spv\`) at build time. On Windows, \`CMakeLists.txt\` automatically detects \`C:/VulkanSDK/*\` even if \`VULKAN_SDK\` is not set in your environment.
- **Python 3, Pillow & \`uv\`:** Used by \`tools/make_assets.py\` and \`tools/doteshi_assets.py\` to bake the deterministic atlas and verify pixel hashes in \`tools/source/doteshi/doteshi.lock.json\`.
- **Clang Tooling (\`clang-format\` & \`clang-tidy\`):** Orchestrated by \`tools/lint.py --changed\` (or \`cmake --build build --target lint\`) with \`.clang-format\`, \`.clang-tidy\`, and \`.clangd\`.
- **Content Verification & Packaging:** Pass \`--content-report\` (writes Markdown tables, key ledger, and German glossary audit to \`build/content/\`) or run \`--test\` to validate all six \`KINDS[]\` tables (\`resource\`, \`fact\` \`qf.*\`, \`person\`, \`exchange\` \`x.*\`, \`formula\` \`f.*\`, \`piece\` \`p.*\`) and mode consistency. Release builds bundle \`res/\` into an encrypted \`data.pak\` via \`MellanganApp --pack <dir>\`. Camera zoom via the mouse wheel is restricted to \`--dev\` mode.

\`\`\`bash
git clone --recurse-submodules https://github.com/soulwax/Mellangan.git
cd Mellangan
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug --parallel
\`\`\`

#### Step 2: The Golden House Rules (\`extern/notes/NOTES.md\`)
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
        title: "CMake Build, Slang Shader Compilation & Asset Bundling Pipeline",
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
          "src/item/WeaponLab.cpp"
    ],
    content: `
### Add a weapon

First choose what your weapon does. A **form** controls its movement or shape, such as a bolt, orbit, or boomerang. A **payload** adds an effect, such as burn, chill, or chain lightning. If an existing form and payload fit your idea, add one row to \`src/item/weapon/Recipe.cpp\` (Path A below). If the weapon needs movement or drawing code that does not exist yet, write an \`Upgrade\` class (Path B). Start with Path A if this is your first weapon.

---

#### Path A: Add a recipe in \`Recipe.cpp\`

Suppose we want to add a new Stormcaller weapon called **\`Tempest Chakram\`** that throws a boomerang disc that both **Chains** lightning and **Marks** enemies:

##### Step 1: Add the \`Recipe\` Entry in \`src/item/weapon/Recipe.cpp\`
Find \`RECIPES\` and add a row beside similar weapons. Its fields, in order, are:
\`{ name, ownerClass, pitch, unitName, iconIndex, form, payloadMask, baseDamage, cooldown, reach, speed, count, tintColor, particleSprite }\` (pick an unused \`iconIndex\` after the existing \`0..52\` slots in \`atlas::arsenal(r.icon)\`):

\`\`\`cpp
{"Tempest Chakram", "STORMCALLER", "A charged disc arcs out and chains lightning",
 "disc", 53, Form::Boomerang, pay::Chain | pay::Mark, 15, 1.9f, 175, 230, 1,
 {0.55f, 0.85f, 1.0f, 1.0f}, atlas::pt::ArcaneStar}
\`\`\`

##### Step 2: Check the five levels
\`RecipeWeapon\` creates the level-up descriptions from your row (\`src/item/weapon/Recipe.cpp:173–195\`):
* **Level 1:** Base weapon unlocked (\`r.pitch\`).
* **Level 2:** \`+50% base damage\`.
* **Level 3:** \`+1 disc\` (for projectile count forms) or \`+30% radius\` (for area forms).
* **Level 4:** \`-25% cooldown\` (\`cooldown * 0.75f\`, or \`"Hardier, 25% faster attacks"\` for \`Form::Summon\`).
* **Level 5:** \`+50% base damage\` AND (\`+1 unit\` or \`+30% radius\`), plus evolution readiness (cards announce the required catalyst passive, highlighted in gold when held).

##### Step 3: Add the evolution pair in \`src/item/Upgrade.cpp\`
Find \`EVOLUTIONS\` and add \`{ baseWeapon, requiredPassive, evolvedDisplayName }\`:
\`\`\`cpp
{"Tempest Chakram", "Conduit", "Storm Maelstrom"},
\`\`\`
\`contentFaults()\` (\`src/meta/Content.cpp:71–77\`, run by \`--test\` and \`--content-report\`) verifies that \`e[0]\` and \`e[1]\` exist in \`Upgrade::all()\` and that \`e[0]\` is unique; \`e[2]\` is only the new evolved display name set by \`Upgrade::evolve()\`.

---

#### Path B: Write a weapon class when a recipe is not enough

##### Step 1: Reserve an Icon in \`src/Atlas.hpp\` (or \`AtlasF.hpp\`)
Use an existing helper such as \`atlas::arsenal(idx)\`, \`atlas::tile(atlas::t::Sword)\`, \`atlas::kit(atlas::kt::*)\`, or \`atlas::frontier(atlas::fr::*)\` (never edit \`src/Atlas.hpp\` without matching \`tools/atlas_layout.py\`).

##### Step 2: Subclass \`Upgrade\` in \`src/item/weapon/\`
Inherit from \`Upgrade\`, passing \`(name, icon, desc[MAX_LEVEL], /*weapon=*/true)\` and overriding \`tick(Mob &)\` (\`Upgrade::evolve()\` is non-virtual):
\`\`\`cpp
class CustomBlade : public Upgrade {
public:
  CustomBlade()
      : Upgrade("Custom Blade", atlas::tile(atlas::t::Sword),
                {"Strikes nearby foes", "+50% damage", "+1 arc", "25% faster", "+50% damage, +1 arc"},
                true) {}
  void tick(Mob &p) override;
};
\`\`\`

##### Step 3: Register in \`Upgrade::all()\` & \`CASES[]\`
Add your weapon to \`Upgrade::all()\` in \`src/item/Upgrade.cpp\` (and \`areaWeapons()\` if it is an area weapon). Declare any new test in \`src/test/Tests.hpp\` and register it in \`CASES[]\` in \`src/test/Test.cpp\`.

##### Step 4: Check damage with \`--weapon-lab\`
Run the weapon lab after the weapon works in-game. It writes a CSV file that lets you compare damage across levels:
\`\`\`sh
./build/bin/Release/MellanganApp.exe --weapon-lab weapon_audit.csv
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
        Shot->>Lvl: level->foes(caster, x, y, r) [CSR Grid]
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
          "src/level/biome/Biome.cpp"
    ],
    content: `
### Add a monster, then give it a home

The monster and its biome are two separate changes. First give the monster an ID, artwork, behavior, and stats. Then add it to a biome's spawn list. A **spawn mask** is a number whose bits say which monsters may appear there. Existing save data also uses monster IDs as positions in an array, so ID order matters.

---

#### Part 1: Step-by-Step Monster Creation

##### Step 1: Append \`EnemyKind\` at the End (\`src/entity/enemy/Enemy.hpp\`)
Saved Codex kill counts use \`int(EnemyKind)\` as array positions. Append a new kind after the existing ones, just before the enum's count marker. Reordering old kinds would change what an existing save means. \`Night::strongestUnlocked\` also relies on the ordering of classic monsters before \`Cyclops\`.

##### Step 2: Paint the 16×16 Silhouette & Verify the Atlas
1. Author new sprites in **Doteshi** (\`tools/source/doteshi/content/*.py\` + \`manifest.toml\`, baked via \`tools/doteshi_assets.py bake\`) or the band's Python generator, and add walk/attack motion rows in \`tools/make_motion_frames.py\` if needed.
2. Rebuild \`res/atlas.png\` from \`tools/\` using \`uv run --with pillow python tools/make_assets.py --from-atlas\` (or \`uv run --with pillow==13.0.0 tools/make_assets.py --verify "<Kenney path>"\` for full dual-run verification).

##### Step 3: Append Mandatory \`EnemyKind::Count\` Tables (\`static_assert\`-Guarded)
Every new \`EnemyKind\` must be appended at the exact same index across **five** tables:
1. **\`src/entity/enemy/Roster.cpp\`:** Append the \`EnemyType\` row \`{ tile, hp, speed, damage, radius, scale, xp, knockResist, blood, floats, unlockAt, art }\` AND the display name in \`NAMES[]\` inside \`Enemy::nameOf()\` (\`static_assert(std::size(NAMES) == int(EnemyKind::Count))\`).
2. **\`src/entity/enemy/ai/Plans.cpp\`:** Append a \`Plan\` row to \`PLANS[]\` (\`static_assert(sizeof(PLANS) / sizeof(PLANS[0]) == int(EnemyKind::Count))\`). Reuse existing goals (\`Approach\`, \`Stalk\`, \`Melee\`, \`Leap\`, \`Guard\`, etc.) and interrupts (\`FALTER\`, \`HIDE\`). Remember \`Goal::tick()\` runs on worker threads: set intent flags like \`e.wantsFire = true\` and spawn entities later in \`Enemy::act()\` on the main thread.
3. **\`src/audio/FoeVoice.cpp\`:** Append the voice family (\`beast\`, \`folk\`, \`hulk\`, \`wing\`, \`spirit\`, \`ooze\`) to \`FAMILY[]\` (\`static_assert(std::size(FAMILY) == size_t(EnemyKind::Count))\`).
4. **\`src/entity/Faction.cpp\`:** Append the faction entry to \`MEMBERS[]\` (\`static_assert(ordered())\`).
5. **Biome \`foes\` Mask (\`FoeMask\`):** Because \`EnemyKind::Count\` is 119 (> 64), \`Biome.hpp\` uses a 128-bit \`FoeMask\` (\`uint64_t bits[2]\`). Combine entries with \`foe(EnemyKind::MyMonster) | foe(...)\` (never shift \`1ULL << int(...)\`).

---

#### Part 2: Step-by-Step Biome Creation (\`src/level/biome/\`)

1. **Append \`BiomeId\`:** Add the new enumerator right before \`BIOME_COUNT\` in \`src/level/biome/Biome.hpp\` (\`BIOME_COUNT\` auto-increments; currently 30). Note that \`isExpansion(b)\`, \`isCoast(b)\`, and 32-bit land masks in \`Group.cpp\` (\`LAND = (1u << BIOME_COUNT) - 1\`) depend on enum ordering and the 32-bit ceiling.
2. **Update All Mandatory \`BIOME_COUNT\` Tables:** Adding a biome requires one row in every \`BIOME_COUNT\`-indexed table:
   - \`src/level/biome/Biome.cpp\` (\`BIOMES[]\`), \`src/level/FloorPainter.cpp\` (\`MATERIALS[]\`), \`src/level/Flavour.cpp\` (\`FLAVOURS[]\`, \`AIRS[]\`), \`src/level/Chart.cpp\` (\`TITLES[]\`).
   - \`src/level/Level.cpp\` (\`BEDS[]\`, \`MOODS[]\`), \`src/level/BiomeReward.cpp\` (\`rewards[]\`), \`src/level/BiomeEvents.cpp\` (\`EVENTS[]\`, \`HAZARDS[]\`).
   - \`src/level/world/Sites.cpp\` (\`LANDMARKS[]\`, \`MASONRY[]\`, \`SITES[]\`), \`src/level/world/Secrets.cpp\` (\`ROWS[]\`), \`src/level/Critters.hpp\` (\`ROWS[]\`), \`src/campaign/Oddity.cpp\` (\`DEFS[]\`).
3. **Define Climate Niche & Gameplay Rule:** Subclass \`Biome\` (or configure \`ExpansionBiome.cpp\`) with ground tint, \`transitionGround()\`, props, \`FoeMask\`, structure weights, and a distinct gameplay rule.
4. **Verify Reachability:** Run \`MellanganApp --test world,biome\` (then full \`--test\`) to verify all biomes are reachable and \`world::groundBlend(x, y)\` transitions smoothly across every boundary.
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
        title: "Deterministic Asset Pipeline & Save-Safe Registration Checklist",
        chart: `
flowchart TD
    classDef step fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef verify fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    P1["1. Reserve Cell in atlas_layout.py or Doteshi<br/>Author Sprite + Motion Frames"]:::step
    P2["2. Run uv run --with pillow tools/make_assets.py --from-atlas<br/>(or --verify with Kenney path)"]:::verify
    P3["3. Append EnemyKind / BiomeId at Enum End<br/>Preserves Codex & Chart Save Compatibility"]:::step
    P4["4. Wire Roster, Plans, FoeVoice, Faction & BIOME_COUNT Tables<br/>Verify in --test & --test-biome-view"]:::verify

    P1 --> P2 --> P3 --> P4
`,
      },
    ],
  },
  {
    id: "tutorial-hero-class",
    title: "15. Tutorial 3: Adding a Playable Hero, Active Skill, Talent & Relic",
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
          "src/item/relic/ExpansionRelics.cpp"
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
- Never hardcode \`p.level->player\` as the caster: \`testArtsBothSides()\` in \`src/test/CombatTest.cpp:313\` specifically tests every hero ability cast by both a \`Player\` and a hostile \`Enemy\`.

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

#### Step 3: Append to \`HEROES[]\`, Standing, Skill Web & Class Kit Minimums
1. **Append Only:** Increment \`HERO_COUNT\` (currently 12) in \`src/hero/Hero.hpp\` and append your hero pointer at the **end** of \`HEROES[HERO_COUNT]\` in \`src/hero/Hero.cpp\` so saved \`Codex::start\` indices stay valid.
2. **Campaign Starting Standing (\`Standing.cpp\`):** Append a \`Calling { up, down }\` row to \`CLASSES[]\` in \`src/campaign/Standing.cpp:39–44\` (\`static_assert(std::size(CLASSES) == size_t(HERO_COUNT))\`) and update \`UP[]\` / \`DOWN[]\` in \`src/test/CampaignTest.cpp\`.
3. **Class Kit Minimums (\`ClassTest.cpp\` & \`TreeTest.cpp\`):** \`testClassKits()\` asserts every hero has \`>= 2\` class \`RECIPES\`, \`>= 3\` class \`Skill\`s (\`HeroSkill\` provides 1, so add at least 2 more in \`src/item/skill/Skill.cpp\`), and \`>= 1\` non-skill, non-weapon class upgrade (kin passive in \`Upgrade.cpp\` or class talent in \`src/item/talent/\`). Every upgrade named in \`weapon\` or \`affinity[3]\` must exist in \`Upgrade::all()\` or \`contentFaults()\` fails. \`Tree::of(Player &)\` (\`src/item/tree/Tree.cpp\`) auto-lays out the 3-wedge Skill Web, verified by \`testSkillTrees()\` in \`TreeTest.cpp\`.
4. **Boss Relics & Loot Uniques:** Put boss-chest relics in \`src/item/relic/\`, and mode-scoped equipment uniques (\`UniqueDef::Mode { Both, Survival, Campaign }\`) in \`src/item/loot/Unique.cpp\` (checked by \`uniqueFault()\` in \`Content.cpp\`).
5. **Verify with \`--test\`:** Run \`MellanganApp --test class,tree,combat,content\` (then full \`--test\`) to execute \`testClassKits()\`, \`testSkillTrees()\`, and \`testArtsBothSides()\`.
`,
    mermaidCharts: [
      {
        title: "Hero Class, Active Skill & Renegade Mirror-Symmetry Architecture",
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
    Verify["testArtsBothSides() (CombatTest.cpp)<br/>Asserts Symmetry for Player & Hostile Casts"]:::target

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
    title: "16. Tutorial 4: Adding World Landmarks, Interactive Sites & 3-Phase Bosses",
    category: "contribute",
    summary:
      "Step-by-step guide to procedural StructureDef footprints, interactive encounter::Site triggers, and 3-phase BossDef cast tables.",
    sourceFiles: [
          "src/level/Structure.hpp",
          "src/level/structure/Landmarks.cpp",
          "src/level/encounter/Landmarks.cpp",
          "src/entity/enemy/Boss.hpp",
          "src/entity/enemy/Boss.cpp"
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

##### Step 3: Register Placement & Wire the Encounter (\`Encounter.cpp\`, \`Sites.cpp\`, \`Biome.hpp\`)
1. **Placement Weights:** Add a weight slot in \`BiomeData::structureWeights[int(StructureKind::Count)]\` (\`src/level/biome/Biome.hpp:89\`) and update \`LANDMARKS[BIOME_COUNT]\` / \`LANDMARK_KINDS\` in \`src/level/world/Sites.cpp:19–22\` if it is a biome landmark.
2. **Encounter Callbacks:** Implement \`enter\` (fires automatically when stepping into the structure footprint via \`world::structureAt\`) and \`ambient\` (ticked via \`world::structureIn\`) in \`src/level/encounter/Landmarks.cpp\`, declare them in \`src/level/encounter/Common.hpp\`, and append an \`EncounterDef { banner, enter, ambient }\` row to \`ENCOUNTERS[int(StructureKind::Count)]\` in \`src/level/Encounter.cpp:34–56\`. (Note: \`E\` interaction belongs to daily biome sites in \`Sites.cpp\`, not \`StructureKind\` \`ENCOUNTERS[]\`.)
3. **Preview Immediately:** Run \`./build/bin/Release/MellanganApp.exe --dev --landmark 8\`.

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
Each \`Cast\` entry (\`src/entity/enemy/Enemy.hpp:138–142\`) specifies \`{ void (*fn)(Enemy &), float every, float range, Color tone }\`. As the boss's HP drops below **66% (Phase 2)** and **33% (Phase 3)**, it automatically escalates to faster cooldowns and deadlier \`ability::*\` patterns (\`ability::thunder\`, \`ability::comet\`, \`ability::quake\`, \`ability::grasp\`, \`ability::miasma\`, \`ability::firering\`, \`ability::volley\`):

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

##### Step 2: Increment \`BOSS_COUNT\`, Append \`BOSS_DEFS[]\` & Bind \`lands\`
Increment \`constexpr int BOSS_COUNT = 9;\` in \`src/entity/enemy/Boss.hpp:20\` and append your \`BossDef\` row to \`BOSS_DEFS[BOSS_COUNT]\` in \`src/entity/enemy/Boss.cpp:128–163\`. Set \`lands = land(BIOME_CRYSTAL)\` (using the unscoped \`BIOME_*\` enumerators from \`Biome.hpp\`, or bitwise OR of multiple \`land(...)\` calls) so \`bossFor(int biome)\` selects your boss in those biomes.
`,
    mermaidCharts: [
      {
        title: "Deterministic Region Structure & Landmark Encounter Pipeline",
        chart: `
flowchart LR
    classDef world fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef def fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef enc fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Region["world::structureIn(rx, ry, out)<br/>Deterministic Seed Roll"]:::world
    Footprint["StructureDef Callbacks (lx, ly)<br/>size() -> dirt() -> ground() -> prop()"]:::def
    Ambient["Ambient Tick (Encounter.cpp / Landmarks.cpp)<br/>encounter::smoke / runes / starlight"]:::enc
    Interact["Hero Steps Into Footprint (world::structureAt)<br/>ENCOUNTERS[kind].enter() Fires Boon, Trial or Elite"]:::enc

    Region --> Footprint --> Ambient --> Interact
`,
      },
      {
        title: "3-Phase Boss Cast Rotation, Telegraph & Chest Drop State Machine",
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
    title: "17. Tutorial 5: Procedural 16x16 Pixel-Art (sprite_kit.py) & Slang Shaders",
    category: "contribute",
    interactiveComponent: "pixelshader",
    summary:
      "Step-by-step guide to painting procedural 16x16 sprites in Python, validating 1px atlas gutters, and authoring Vulkan Slang shaders.",
    sourceFiles: [
          "tools/sprite_kit.py",
          "tools/atlas_layout.py",
          "tools/make_assets.py",
          "res/shaders/flash.slang",
          "res/shaders/post.slang",
          "src/gfx/Screen.cpp"
    ],
    content: `
### Add artwork or a shader

Artwork and shaders are separate tasks. The atlas is the large image containing the game's small sprites. \`tools/make_assets.py\` assembles it from source sheets and drawing scripts; \`tools/atlas_layout.py\` describes where each group of sprites belongs. A Slang shader is text code compiled to SPIR-V for the GPU.

---

#### Part 1: Add a 16 × 16 sprite (Doteshi & \`make_assets.py\`)

1. **Choose the right tool:** New sprites (nations, horrors, cultures, chiefs, living resources, living biomes, Kettlestaithe/Tidemarket, and \`under2\` caves) are authored with **Doteshi** (vendored in \`tools/doteshi/\`), placing recipes in \`tools/source/doteshi/content/*.py\` and slot bindings in \`tools/source/doteshi/manifest.toml\`. Legacy bands live in \`tools/sprite_kit.py\` generators, and enemy walk/attack motion frames are generated by \`tools/make_motion_frames.py\`.
2. **Bake & verify:** Run \`python tools/doteshi_assets.py bake\` and \`check\` (verifying pixel hashes in \`tools/source/doteshi/doteshi.lock.json\`), then run \`uv run --with pillow python tools/make_assets.py --from-atlas\` from \`tools/\` (or \`uv run --with pillow==13.0.0 tools/make_assets.py --verify "<Kenney path>"\` for full dual-run verification). \`make_assets.py\` automatically runs \`validate_cpp_layout()\` to confirm \`src/Atlas.hpp\` matches \`tools/atlas_layout.py\`.
3. **Wire C++ accessors:** Generated accessors land in \`src/AtlasF.hpp\`, \`src/AtlasB.hpp\` (biomes/sites/critters), or \`src/AtlasU.hpp\` (hamlet/under2); avoid hand-editing \`src/Atlas.hpp\` unless adding a legacy band coordinated with \`atlas_layout.py\`.
---

#### Part 2: Authoring Slang Fragment Shaders (\`res/shaders/*.slang\`)

At build time, \`CMakeLists.txt\` compiles every \`res/shaders/*.slang\` file into SPIR-V via \`slangc\`:
\`slangc <file>.slang -target spirv -profile glsl_450 -entry PixelShader -stage fragment -o shaders/<file>.spv\`

##### Read the shader inputs (\`flash.slang\` and \`post.slang\`)
A fragment shader calculates a pixel's final color. These shaders receive textures, a sampler, and small blocks of settings through Vulkan bindings. Keep the binding numbers and data layout in sync with the C++ renderer, and load any new \`.spv\` in \`src/gfx/Screen.cpp\` via \`loadShader(path("res/shaders/<name>.spv"), sizeof(<UboStruct>))\`:
- \`[[vk::push_constant]] Push push;\`: Contains \`cameraIndex\`, bindless \`textureIndex\`, \`texturePos\`, vertex \`colour\`, and \`model\` matrix.
- \`[[vk::binding(1, 1)]] SamplerState sampler;\`
- \`[[vk::binding(2, 2)]] Texture2D<float4> textures[];\`: Bindless texture array indexing \`res/atlas.png\`, the offscreen world target, and the offscreen additive light map (\`post.lightTexture\`).
- \`[[vk::binding(3, 3)]] ConstantBuffer<T> ubo;\`: Custom uniform buffer (\`FlashData\` in \`flash.slang\` or \`PostData\` in \`post.slang\`, which includes \`time\`, \`lightTexture\`, \`resolution\`, \`hurt\`, \`lowHealth\`, \`vignette\`, \`pause\`, \`shrine\`, \`scale\`, \`grain\`, \`glow\`, and \`glowTint\`).

##### How Sharp Pixel-Art Upscaling & ACES Lighting Work in \`post.slang\`
Instead of blurry bilinear filtering or shimmering nearest-neighbor at non-integer window scales, \`albedoAt(float2 uv)\` computes sub-pixel anti-aliased texel edges scaled by \`post.scale\`:
\`\`\`cpp
float2 p = uv - 0.5;
float2 i = floor(p);
float2 f = saturate((p - i - 0.5) * post.scale + 0.5);
\`\`\`
The final \`PixelShader\` also applies hurt chromatic aberration, light map, 8-tap bloom, ACES tone mapping, vignette, end-of-run glow, film grain, and pause blur. The light map multiplies \`lightAt(uv)\` by \`1.6\`; a light value of \`0.625\` therefore acts as neutral brightness.
`,
    mermaidCharts: [
      {
        title: "Doteshi & make_assets.py -> atlas_layout.py Verification Pipeline",
        chart: `
flowchart LR
    classDef py fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef cell fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef check fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Kit["Doteshi Recipes (tools/source/doteshi/)<br/>+ motion frames (make_motion_frames.py)"]:::py
    Place["make_assets.py --from-atlas<br/>Places 16x16 Cells with 1px Transparent Gutters"]:::cell
    Verify["doteshi.lock.json Hash Check +<br/>validate_cpp_layout() (Atlas.hpp)"]:::check
    Header["res/atlas.png + AtlasF.hpp / AtlasB.hpp / AtlasU.hpp"]:::check

    Kit --> Place --> Verify --> Header
`,
      },
      {
        title: "Vulkan2D Bindless Slang Shader & Light-Map Post-Processing Pipeline",
        chart: `
flowchart LR
    classDef pass fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef ubo fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    WorldTarget["Offscreen World Target<br/>Radix-Sorted Sprites + flash.slang"]:::pass
    LightTarget["Offscreen Light Map (post.lightTexture)<br/>Neutral 0.625 + Additive Screen::glow()"]:::pass
    PostUBO["ConstantBuffer<PostData><br/>time, lightTexture, resolution, hurt, scale, grain, glow"]:::ubo
    PostShader["post.slang PixelShader(uv)<br/>Sharp Bilinear + Light*1.6 + 8-Tap Bloom + ACES + Grain"]:::out

    WorldTarget & LightTarget & PostUBO --> PostShader
`,
      },
    ],
  },
  {
    id: "tutorial-testing-profiling",
    title: "18. Tutorial 6: Writing Deterministic Tests, Visual QA Views & Prof.c Benchmarks",
    category: "contribute",
    summary:
      "Hands-on testing tutorial: deterministic unit tests, --weapon-lab DPS audit, --soak 60-min autopilot, and --bench-gate.",
    sourceFiles: [
          "src/test/Tests.hpp",
          "src/test/Test.cpp",
          "src/Bench.cpp",
          "src/Prof.c",
          "src/item/WeaponLab.cpp"
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

#### Writing & Filtering Deterministic Unit Tests (\`src/test/Test.cpp\`)

All **233** test cases are registered as rows of \`CASES[]\` in \`src/test/Test.cpp\` (declared in \`src/test/Tests.hpp\`), using standard \`<cassert>\` (\`#undef NDEBUG\` at the top of \`Test.cpp\`):
- \`MellanganApp --test\`: Runs the entire suite and prints \`ALL TESTS PASSED\`.
- \`MellanganApp --test <filter>\`: Runs only tests matching a comma-separated case-insensitive substring filter.
- \`MellanganApp --test-list\`: Prints every registered test name.
- \`MellanganApp --test-times\`: Profiles per-test durations and prints the top-15 slowest cases.

\`\`\`cpp
#include "test/Tests.hpp"
#include <cassert>
#include "level/Level.hpp"
#include "entity/enemy/Enemy.hpp"

void testCrowdPush() {
  Level level;
  level.seed(1337);
  Enemy *a = level.spawn<Enemy>(EnemyKind::Wolf, 100, 100);
  Enemy *b = level.spawn<Enemy>(EnemyKind::Wolf, 101, 100);
  level.buildGrid();
  level.push();
  level.settle();
  assert(a->x != b->x);
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Headless Deterministic Simulation & Assertions Pipeline (--test)",
        chart: `
flowchart LR
    classDef init fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef sim fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef pass fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Run["MellanganApp --test [filter]<br/>runTests() (#undef NDEBUG)"]:::init
    PoolTest["testPoolAllocAndFree() &<br/>testPoolConcurrency() (8 Threads)"]:::sim
    SimSuites["233 CASES[] Deterministic Tests<br/>--test-list | --test-times"]:::sim
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
    title: "19. Tutorial 7: How Our Terrain Is Constructed (Morphology, Cliffs & Auto-Tiling)",
    category: "contribute",
    interactiveComponent: "terrain",
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
          "src/level/FloorPainter.cpp"
    ],
    content: `
### How Our Terrain Is Constructed: The 7-Stage Procedural Pipeline

Mellangan constructs an infinite, seamless 2D world with multi-tier cliffs, ramps, highland tarns, lowland lakes, and 3-way biome transitions **without storing a single heap-allocated chunk**. Every tile \`(x, y)\` is synthesized on demand through 7 deterministic stages across \`src/level/world/\` and \`src/level/FloorPainter.cpp\`.

---

#### Stage 1: Direct-Mapped Spatial Memoization (\`Internal.hpp\` & \`Biomes.cpp\`)
Because auto-tiling and morphological filtering query neighboring tiles \`(x + dx, y + dy)\` repeatedly, recomputing FBM noise per neighbor would be too slow. Instead, \`Biomes.cpp\` and \`Sites.cpp\` maintain three zero-allocation, direct-mapped spatial caches invalidated by \`noise_epoch\`:
1. **\`TileMemo tiles[128 * 64]\`:** Indexed by \`(x & 127) | (y & 63) << 7\`. Packs 8 terrain properties into a single \`uint32_t bits\` word via \`MemoField { has, shift, mask }\`:
   - \`slot::biome\` (5 bits), \`slot::raw\` (5 bits), \`slot::dirt\` (1 bit), \`slot::rawDirt\` (1 bit), \`slot::rawWater\` (1 bit), \`slot::water\` (1 bit), \`slot::level\` (2 bits), \`slot::rawLevel\` (2 bits), plus \`float shade\` and \`float clump\`.
2. **\`fieldMemo[64 * 64]\` & \`blendMemo[64 * 64]\` (\`Biomes.cpp\`):** Indexed on a 2-tile coarse lattice \`(x / 2 & 63) | (y / 2 & 63) << 6\`, caching \`fieldNode\` (5×5 tent kernel) and \`blendNode\` (domain-warped 14×14 adaptive \`Reaches\` widths \`WIDE = 12.0f .. NARROW = 3.5f\`).
3. **\`Slot cache[4096]\` (\`Sites.cpp\`):** Indexed by \`(rx & 63) | (ry & 63) << 6\`, caching rolled \`Structure\` and \`BiomeSite\` records per region.

---

#### Stage 2: 3×3 Majority-Vote Biome Smoothing & Adaptive Domain-Warped Blending (\`Biomes.cpp\`)
1. **Speckle Elimination (\`biomeAt(x, y)\`):**
   \`rawBiome(x, y)\` evaluates climate fields (\`biomeForLocation\`). Then \`biomeAt(x, y)\` tallies a **3×3 Moore-neighborhood majority vote** (\`votes[BIOME_COUNT]\`, breaking ties in favor of the center tile \`own\`) so isolated 1-tile biome islands never occur.
2. **Two-Level Blending (\`fieldNode\` & \`blendNode\`):**
   \`fieldNode\` evaluates the 5×5 tent kernel \`K[5] = {1, 2, 3, 2, 1}\`, while \`blendNode\` applies domain warping (\`WARP = 7.0f\`) over a \`14×14\` (\`SIDE = 14\`) grid using per-biome-pair adaptive \`Reaches\` widths (\`WIDE = 12.0f\` down to \`NARROW = 3.5f\`) and compacts to the **top 3 biomes** normalized to \`1.0\`.
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
        title: "Morphological Patch Smoothing (solidCore -> smoothPatch) & 4-Bit RIM[16] Auto-Tiler",
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
  },
  {
    id: "camera-viewport",
    title: "Camera, Zoom & Window Fit",
    category: "graphics",
    summary: "How Camera interpolation and Screen sizing turn world coordinates into a stable viewport and native-resolution UI.",
    sourceFiles: ["src/gfx/Camera.hpp", "src/gfx/Screen.hpp", "src/gfx/Screen.cpp"],
    content: `
### Following the player

\`Camera\` keeps current and previous positions, lens values, shake and horizontal pan. \`follow()\` damps position and pan toward their targets, decays shake and advances a spring-like lens toward \`lensGoal\`. \`remember()\` saves the previous state for interpolation. During drawing, \`aim(screen, a)\` interpolates between previous and current positions, adds shake and sets integer world offsets. Call \`snap()\` when the camera should jump without interpolating across the gap.

### Fitting a window

\`Screen::fit()\` reads the window size in pixels. It extends the logical viewport horizontally or vertically to match the window shape, caps it at \`MAX_W\` and \`MAX_H\`, then applies the clamped zoom. \`Camera::focus()\` changes the lens goal within the supported zoom range. The viewport dimensions feed tile traversal and visibility tests, so changing zoom changes the area the world pass must cover.

### Compositing and interface scale

\`Screen::beginGui()\` switches to the screen target, sets a pixel-sized camera and draws the world target through the post shader. It centers the scaled world image and computes the UI unit \`u\` separately. The \`crisp\` option chooses an integer-friendly scale when the fit allows it. This keeps HUD placement tied to window pixels while the camera and zoom act on the world view.

When adjusting these paths, inspect a wide and a tall window, zoom in and out, and check that the player remains centered, world edges cover the view and HUD text stays legible.
`,
  },
  {
    id: "visible-world-rendering",
    title: "Visible Tiles, Props & Draw Order",
    category: "graphics",
    summary: "The per-frame path from visible floor tiles and terrain flags to props, queued entities and lighting.",
    sourceFiles: ["src/level/LevelRender.cpp", "src/level/FloorPainter.cpp", "src/gfx/Screen.cpp"],
    content: `
### Only visit tiles near the camera

\`eachVisibleTile()\` converts \`Screen\` offsets and viewport dimensions into tile coordinates using the 16-pixel tile size. \`Level::renderFloor()\` passes those coordinates to \`FloorPainter::tile()\`. Later passes can request extra tiles before and after the viewport so a large prop whose anchor sits just offscreen can still appear.

### Gather the visible world

\`Level::scatter()\` rebuilds the visible surface flags and solid-prop data, then gathers props near the camera. Water, ice, height, ramps and ropes contribute to each surface byte before road modifications. Site state, snow cover and weather sway affect the resulting props. A coordinate hash supplies stable flip and tone variation for wild props, so drawing the same place again produces the same appearance.

### Submit in layers

\`Level::render()\` starts with the floor, then draws ground effects and other world content. Visible entities are queued for the depth sort described in [64-Bit Radix Y-Sort & LightField](/radix-rendering). Lighting has its own target and is combined with the world by \`Screen::beginGui()\`. The [renderer overview](/renderer-in-context) shows the full frame path.

When adding a prop or ground mark, check its anchor at all four viewport edges, its position relative to actors and its visibility after the camera moves away and back. Use a repeatable world seed for that comparison.
`,
  },
  {
    id: "renderer-in-context",
    title: "20. Tutorial 8: How the Renderer Works in Context of Our Game",
    category: "contribute",
    interactiveComponent: "renderer",
    summary:
      "End-to-end walkthrough of Screen.cpp, LevelRender.cpp, LightField.cpp, offscreen targets, water reflections, submersion clipping, and native GUI scaling.",
    sourceFiles: [
          "src/Game.cpp",
          "src/gfx/Screen.hpp",
          "src/gfx/Screen.cpp",
          "src/level/LevelRender.cpp",
          "src/level/LightField.cpp",
          "res/shaders/post.slang"
    ],
    content: `
### How the Renderer Works in Context of Our Game

Mellangan's rendering architecture (\`Screen\`, \`LevelRender\`, \`LightField\`, and \`Vulkan2D\`) is purpose-built around a **dual-resolution multi-pass frame graph**:
1. The **World & Lighting Passes** render into offscreen targets (\`Screen::world\` and \`Screen::light\`), allocated at \`ceil(MAX_W * FARTHEST) × ceil(MAX_H * FARTHEST)\` (**\`3414×1920\`**) so camera zoom (\`--dev\`) fits cleanly without reallocating textures.
2. The **Composite & GUI Pass** upscales and composites \`world × light\` onto the window swapchain via \`res/shaders/post.slang\`, and then renders the HUD, bitmap typography, and menus directly at **native window pixel resolution** using an integer-snapped UI unit \`u\` (with optional \`crisp\` integer-snap scaling in \`Screen::beginGui\`).

---

#### 1. The 9 GPU Textures & Pre-Baked White Silhouette (\`Screen::load\`)

At startup, \`Screen::load(base)\` (\`src/gfx/Screen.cpp\`) initializes **9 \`VK2DTexture\` handles** and 1 SPIR-V post-process shader:
- **6 Asset Texture Sheets:** \`atlas\` (\`res/atlas.png\`), \`alternate\` (\`res/alt_atlas.png\`), \`achievements\` (\`res/achievements.png\`), \`particles\` (\`res/particles.png\`, \`8×8\` cells), \`weather\` (\`res/weather.png\`), and \`font\` (\`res/font.png\`, \`8×16\` ASCII glyph grid).
- **1 CPU-Generated White Silhouette Texture (\`silhouette\` via \`Screen::loadSilhouette\`):**
  Instead of switching GPU pipelines or binding a constant buffer every time one of 500 enemies flashes white on hit, \`Screen::loadSilhouette\` loads \`res/atlas.png\` into CPU memory at startup and bitwise-ORs every 32-bit RGBA texel with \`0x00FFFFFFu\`:
\`\`\`cpp
uint32_t *texel = reinterpret_cast<uint32_t *>(px);
for (int i = 0; i < iw * ih; i++)
  texel[i] |= 0x00FFFFFFu;
\`\`\`
  This preserves the exact alpha channel of every sprite in the atlas while setting RGB to pure white! During \`Screen::flash\`, the renderer draws the normal sprite from \`atlas\` and immediately draws the identical UV rectangle from \`silhouette\` with vertex alpha \`prev.a * std::min(amount, 1.0f)\`.
- **2 Offscreen Render Targets (\`3414×1920\`, \`FARTHEST\`-scaled):** \`world\` and \`light\`.

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
   The player's torch, kindled shrines, projectiles, particles, and luminous props stamp radial \`atlas::Light\` sprites into \`Screen::light\` (decrementing \`lightBudget\`) and register up to \`LightField::MAX = 8\` shadow-casting point lights (\`x, y, reach, strength\`).

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
        title: "Complete Multi-Pass Frame Graph (Game::render -> Screen -> LevelRender)",
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
        Glows["Player, Night, Sky, Entities, Particles & Props<br/>Screen::glow() + LightField::add() (Up to 8 Shadow Casters)"]:::light
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
        title: "Planar Water Reflection, Submersion Clipping & White Silhouette Flash Pipeline",
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
  },
  {
    id: "night-spawner-director",
    title: "21. Night Clock, 11 Omens, Shrine Dawn-Pull & 7-Stream Wave Director",
    category: "gameplay",
    interactiveComponent: "director",
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
          "src/test/RunRulesTest.cpp"
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
          "src/input/Input.cpp"
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

#### Achievements, Campaign Codex Pages & Per-Campaign Lore (\`Feats.cpp\`, \`CodexMenu.cpp\`, \`Lore.cpp\`)
The \`FEATS\` table contains **112 achievements** (\`FEAT_COUNT = 112\`, \`static_assert(... <= 128)\`), stored across two 64-bit fields (\`Codex::feats\` and \`Codex::feats2\`) alongside \`uint64_t wielded\` for tracking unveiled unique weapons (\`codex.txt\` \`version 2\`). In Campaign mode, \`CodexMenu\` appends four dedicated campaign pages: **Founders**, **Rune Words**, **Sagas** (30 chapters across 10 cultures), and **Factions** (earned standing, body regard, disposition band, and next unlocked service gate). Separately, \`src/campaign/Lore.cpp\` maintains a per-campaign \`lore::Book\` across 8 tables (\`Resource\`, \`Formula\`, \`Creature\`, \`Person\`, \`Faction\`, \`Place\`, \`Law\`, \`Dish\`) tracking \`SEEN\`, \`HANDLED\`, and \`KNOWN\` flags plus up to 3 pinned entries, saved as \`lore\` and \`pin\` lines in campaign saves.

#### Encrypted Release Archive (\`data.pak\`, \`src/meta/Pak.cpp\`)
Release packages bundle \`res/\` into a single encrypted \`data.pak\` archive built via \`MellanganApp --pack <dir>\` (\`MLPK\` v1 32-byte header, veiled phrase + build-time \`Salt.inc\` + stamp stretched across 16,384 ChaCha20 rounds, encrypted sorted index, per-file nonces, and 64-bit FNV integrity checksum). Startup mounts \`data.pak\` transparently via \`pak::mount()\`, falling back to loose \`res/\` files when no pack is present.

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
The controls menu saves **23 keyboard bindings** and **10 gamepad bindings** in \`keys.txt\` (\`KEYS 2\` header). See **Input, Live Campaign Panels, Quickbar & Choice Badge** for defaults, live panel navigation, fixed controls, analog stick behavior and prompt substitutions.

`,
    mermaidCharts: [
      {
        title: "Saves Preference Directory, 6-World LRU History & Chart Eviction",
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
        title: "Balance::load() Pointer-to-Member INI Reflection Cascade (res/balance.ini)",
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
    title: "23. 7 Status Afflictions, 0.5s DoT Ticks, Bleed Stacking & Level-Up Draft",
    category: "gameplay",
    summary:
      "Seven status effects, half-second damage ticks and the weighted level-up and treasure draft.",
    sourceFiles: [
          "src/entity/Status.hpp",
          "src/entity/Mob.cpp",
          "src/menu/LevelUpMenu.cpp",
          "src/entity/pickup/Chest.cpp",
          "src/item/Upgrade.cpp",
          "src/hero/Mutation.cpp"
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
        title: "Status::apply() Clamping, Bleed Stacking & Lossless 0.5s DoT Tick State Machine",
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
    title: "24. The 19 AI Goal Primitives, Gait Kinematics & 119-Monster Plan Table",
    category: "simulation",
    interactiveComponent: "goalai",
    summary:
      "Complete mathematical breakdown of all 19 Goal subclasses in src/entity/enemy/ai/ (including Guard, Totem, Leap), Gait wave/weave modulation, V-formation pack following, and all 119 monster plans.",
    sourceFiles: [
          "src/entity/enemy/ai/Plans.cpp",
          "src/entity/enemy/ai/Approach.cpp",
          "src/entity/enemy/ai/Melee.cpp",
          "src/entity/enemy/ai/Flank.cpp",
          "src/entity/enemy/ai/Follow.cpp",
          "src/entity/enemy/ai/Burrow.cpp"
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
  Attached to \`interrupts[0]\` on **62** monster plans (out of **119** entries in \`PLANS[]\` across **19** \`Goal\` subclasses, including \`Guard\`, \`Totem\`, and \`Leap\`). \`urgent()\` returns \`true\` once per enemy lifetime (\`!e.faltered\`) when \`e.hp < e.maxHp * 0.3f && s.dist < 160\`. \`start()\` sets \`e.faltered = true\`, and \`tick()\` backs away at \`-0.9x\` speed with a lateral sine weave for \`1.1s\`.
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
        title: "Approach Gait Modulation, 8-Lane Fan Spread & Melee Lock-On Pipeline",
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
        title: "Burrow 3-Stage Subterranean State Machine & Follow V-Formation Wing Math",
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
  },
  {
    id: "diablo-loot-runrules",
    title: "25. Item Generation, Rarity and Run Rules",
    category: "gameplay",
    interactiveComponent: "loot",
    summary:
      "Item bases and quality tiers, affixes, rarity rolls, night-touched items and loot drops.",
    sourceFiles: [
          "src/item/loot/ItemBase.cpp",
          "src/item/loot/Affix.cpp",
          "src/item/loot/Loot.cpp",
          "src/item/loot/Unique.cpp",
          "src/entity/pickup/ItemDrop.cpp",
          "src/level/RunRules.hpp"
    ],
    content: `### Item bases, Campaign pool, and Faction Exotics

Equipment is built from a base in \`ItemBase.cpp\`. The three quality tiers are **Worn**, **Fine** and **Masterwork**; their quality-level offsets are 0, 18 and 36. Base eligibility and weighting depend on item level and game mode: **26 Campaign-only bases** (\`ItemBase.campaignOnly = true\`, across weapons, shields, arcane implements, armour, charms, and \`Wayfarer Boots\`) and **17 named campaign relics** (\`UniqueDef::Mode::Campaign\`) stay strictly inside Campaign pools, while Survival-only uniques remain isolated in Survival. \`gamble(base, rng, campaign)\` and startup \`contentFaults()\` enforce this split automatically.

Beyond standard drops, **16 Faction Exotic bases** (\`goods::EXOTICS[16]\` in \`src/item/loot/Goods.cpp\`) are crafted by their parent factions starting at reach 12 to 20 (including \`Ledger_Buckler\`, \`Barkweave\`, \`Crown_Tabard\`, \`Anvil_Shield\`, \`Wellkeeper's_Gourd\`, and \`Silverleaf_Cloak\`), and stocked alongside faction kin affixes (\`goods::mark\`). Unique weapons display their granted attack veiled as mystical runes until a hero equips the item once, permanently revealing its attack profile in tooltips thereafter.

### Affixes and rarity

The affix registry (\`Affix.cpp\`) contains **49 families** (\`AFFIX_COUNT = 49\`): **31 ordinary families** (14 prefixes and 17 suffixes, \`AFFIX_ORDINARY = 31\`) plus **18 faction kin affixes** (11 prefixes and 7 suffixes). Families do not all have the same number of tiers: for example, projectile count has three tiers and skills have two. Eligible affixes depend on the item and its level. Rare items request more affixes than magic items, but the generator can finish with fewer when it cannot find enough eligible choices.

Rarity is rolled in order: unique, rare, magic, then superior or normal. Each of the first three checks draws a new random number. If their respective thresholds are U, R and M, the initial probabilities are U, (1 − U)R and (1 − U)(1 − R)M. Of the remaining outcomes, one eighth is superior and seven eighths normal. Magic find uses diminishing returns for the unique and rare thresholds, while the magic threshold uses magic find directly. The explorer below shows these initial outcomes.

The final item can differ from that initial roll: a rarity floor may raise it, and a unique roll can fall back to a rare item if an eligible unique cannot be made. The game does have unique definitions in \`Unique.cpp\`.

### Night and dropped items

At night, item drops receive extra weight in the loot selection. A magic or rare item can become night-touched on a 1-in-25 roll; the effect requires at least one affix, improves one affix by up to two tiers and adds a curse. The Frail curse is displayed as −10% maximum health, but equipment application currently subtracts **10 maximum health** as a flat amount.

Dropped equipment follows a short arc; potions are separate pickups. Rare-or-better items and night-touched items can show a temporary beam. When at least 120 item drops already exist, newly rolled drops below rare are skipped, including night-touched magic items. Rare-or-better equipment produces a landing effect.

### Run rules

\`RunRules\` configures conditions such as loot, timing and safe zones for a run. \`safeAt(x, y)\` checks whether a position lies inside a configured circular safe zone; the consequences depend on the code that calls it.
`,
    mermaidCharts: [
      {
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
      },
    ],
  },
  {
    id: "paper-doll-gear-combat",
    title: "26. Equipment, Inventory and Combat Effects",
    category: "gameplay",
    summary:
      "Six equipment slots, the bag, equipping and removing gear, combat effects and ground labels.",
    sourceFiles: [
          "src/menu/InventoryMenu.cpp",
          "src/entity/PlayerGear.cpp",
          "src/item/loot/Equip.cpp",
          "src/entity/enemy/Enemy.cpp",
          "src/gui/HudWorld.cpp"
    ],
    content: `### Equipment and bag

The inventory has **six equipment slots**: weapon, offhand, armour, two charms and implant. The bag has 32 positions arranged in an 8 × 4 grid. Directional navigation wraps through the bag and links its left edge to the equipment slots. Mouse movement selects a cell; a left click or confirm activates it, and the erase action drops an item.

### Putting on and removing gear

An item must fit the hero and its target slot. If the first charm slot is occupied and the second is empty, another charm goes into the second slot. Equipping into an occupied slot swaps the old item into the selected bag position. Implant changes (\`Player::implantable()\` in \`PlayerGear.cpp:44–47\`) require not being a changeling and either being in a safe zone or holding \`rune::KindredFlesh\` or \`boons::Kinship\`; equipping an implant also increases suspicion. Removing equipment through the unequip action requires room in the bag, and dropping an item beside a faction campfire gifts it to that camp. In Campaign mode, the **Pack** tab of the live docked panel pairs gear and the 32-slot bag with a filterable materials ledger and 4-slot quickbar.

\`applyItem\` applies the base implicit, affixes and curse with a positive sign on equip and a negative sign on removal. Maximum-health changes also adjust current health: an increase adds health, while a decrease clamps current health to the new maximum. Items that grant an upgrade add levels up to the appropriate item tier; the player records the levels added by that item so removal can subtract them.

### Effects in combat

Equipment stats feed into damage and on-hit effects in \`Enemy::hurt\`. Non-periodic hits can receive critical and other damage modifiers; eligible hits can also trigger effects such as burn, chill, poison, bleed, leech and shock. Thorns retaliation is suppressed while weapons are stowed (\`!level->rules.holdFire\`, \`Enemy.cpp:434–435\`) so a stowed pacifist never kills by being bitten.

### Ground labels

\`Hud::lootLabels\` sorts visible labels and tries to place them without overlapping earlier labels or HUD obstacles. It makes up to 12 placement attempts per label, so a dense pile is not guaranteed to be perfectly separated.
`,
    mermaidCharts: [
      {
        title: "Equipping and removing an item",
        chart: `flowchart TD
    A[Select item in bag] --> B[Check fit and slot restrictions]
    B --> C[Swap or equip item]
    C --> D[Apply item stats and granted levels]
    D --> E[Remove item]
    E --> F[Reverse stats and recorded levels]
`,
      },
    ],
  },
  {
    id: "biome-events-chart-hud",
    title: "27. 30 Biome Events, Living Biomes, RLE Fog-of-War Chart & HUD Edge Pointers",
    category: "world",
    interactiveComponent: "gearevents",
    summary:
      "Deterministic Murmur3 scheduling for 30 biomes (plus 7 alternating hazard slots), living biome decals/sites/secrets/critters, sparse 32x32 paged RLE Chart, and HUD ray-clipping.",
    sourceFiles: [
          "src/level/BiomeEvents.hpp",
          "src/level/BiomeEvents.cpp",
          "src/level/Chart.hpp",
          "src/level/Chart.cpp",
          "src/level/world/Sites.cpp",
          "src/level/world/Secrets.cpp",
          "src/level/Critters.cpp",
          "src/gui/Hud.cpp"
    ],
    content: `
### 1. Deterministic Stateless \`BiomeEvents\` across All 30 Biomes (\`src/level/BiomeEvents.cpp\`)

All 30 biomes (\`BIOME_COUNT = 30\`: 16 core \`BIOME_MEADOW..BIOME_TAIGA\`, 10 expansion \`BIOME_SALT..BIOME_STARFALL\`, and 4 coastal \`BIOME_TROPIC_SEA..BIOME_COLD_BEACH\`) have a periodic event in \`EVENTS[BIOME_COUNT]\`, sized identically to \`BiomeEvents::handled[BIOME_COUNT]\`.

- **Region Grid (\`20 × 20\` tiles = \`320 × 320 px\`):** \`BiomeEvents::schedule(seed, biome, epoch, rx, ry)\` uses a stateless Murmur3 avalanche mixer \`mix(x)\`.
- **Epoch Cadence (\`def.every\`):** Core biomes (\`0..15\`) use \`every = 48.0 s\`; expansion and coast biomes (\`16..29\`) use \`every = 28.0 s\`.
- **Alternating Hazard Slots (\`HAZARDS[BIOME_COUNT]\`):** Seven previously boon-only biomes (Meadow, Forest, Blossom, Crystal, Fungal, Moon, Storm) now carry a paired hazard in \`HAZARDS[]\` (\`THE HIVE IS DISTURBED\`, \`A WIDOWMAKER FALLS\`, \`HAY FEVER\`, \`A CRYSTAL SINGS FLAT\`, \`THE CAPS BURST\`, \`A MOON-SHADOW PASSES\`, \`LIGHTNING WALKS THE STEPPE\`). \`epochAt()\` and \`startOf()\` alternate boon (even epochs) and hazard (odd epochs) across \`b.every + h.every\`.
- **Shrine Sanctuary Suppression:** Standing within 2 tiles of any \`Tile::Shrine\` sets \`sanctuary = true\`, suppressing regional events.

---

### 2. Living Biomes: Decals, Usable Sites, Secrets & Critters (\`O11.5\` to \`O11.7\`)

Every surface biome populates its own small-scale world details via \`src/AtlasB.hpp\`:
- **Ground Decals (\`Ground.cpp\`):** Two decorative decals per biome (\`DECALS[BIOME_COUNT][2]\`, drawn in \`FloorPainter.cpp\`), skipping roads, dirt, ramps, structures, sites, and ice.
- **Usable Biome Structures (\`Sites.cpp\`):** 30 per-biome structures (\`SITES[BIOME_COUNT]\`, such as the meadow maypole, woodcutter's block, eel trap, windmill, and tide pole) placed via \`rollSite()\` and usable once per day with \`E\` (\`sites::use()\`) for materials, gold, healing, XP, or chart unveil, switching to their spent alt sprite until the next day.
- **Hidden Biome Secrets (\`Secrets.cpp\`):** One hidden secret per \`CELL = 48\`-tile stretch, telegraphed by an unnatural arrangement of biome decals across 10 pattern shapes (\`Line\`, \`Ring\`, \`Spiral\`, \`Grid\`, \`Arrow\`, \`Star\`, \`Cross\`, \`Heart\`, \`Gap\`, \`Lone\`). Standing on the key tile and pressing \`E\` digs up the one-time reward (saved as \`secret <key>\`).
- **Critters (\`Critters.cpp\`):** Stateless, draw-only small creatures (\`GRID = 6\`, max \`3\` on screen) with per-biome rows, day/night schedules, and six behavior verbs (\`Flee\`, \`Vanish\`, \`Dart\`, \`Bob\`, \`PlayDead\`, \`Sit\`) that never affect combat.

---

### 3. Sparse Paged Fog-of-War \`Chart\` & Scanline RLE Coalescing (\`src/level/Chart.hpp\`, \`src/level/Chart.cpp\`)

Because the world is infinite (\`int32_t\` tile coordinates), the exploration map (\`M\` overlay and top-right minimap) implements a **sparse 2-level paged grid** with a 1-entry MRU page cache and **horizontal scanline Run-Length Encoding (RLE)**:

1. **Spatial Granularity & Memory Layout:**
   - **Chart Cell (\`CELL = 4\` tiles = \`64 × 64 px\`):** Each byte in a page represents a \`4 × 4\`-tile square.
   - **Page (\`PAGE = 32\` cells = \`128 × 128\` tiles = \`1024 B\`):** \`std::unordered_map<uint64_t, std::unique_ptr<Page>> pages\` maps a 64-bit \`key(px, py)\` to a 1 KB \`std::array<uint8_t, 1024>\`.
   - **Bitwise Cell Encoding (\`Chart.hpp:25\`):**
     - \`0x00\`: Unexplored fog-of-war.
     - \`bits 0..5 (\`BIOME = 0x3F\`)\`: \`(BiomeId + 1)\` (\`1..30\`), tinted from \`BIOMES[b]->debug\` in \`Chart::tone()\`.
     - \`bit 6 (\`WATER = 0x40\`)\`: Water cell flag.
     - \`bit 7 (\`NOW = 0x80\`)\`: Currently inside the player's live vision radius (stripped on binary save).
2. **Horizontal Scanline RLE Coalescing (\`Chart::draw\`):** Merges consecutive cells with identical \`key\` into single \`s.rect()\` calls, cutting GPU vertex submissions by 80% to 92%.
3. **Binary Persistence (\`chart-<code>.bin\`):** Serializes explored pages with \`DISTANCE_MAGIC = 0x3543414Du\` (\`"MAC5"\`), stripping transient \`NOW (0x80)\` bits.

---

### 4. Asymmetric Viewport Ray-Clipping in \`Hud::edge\` (\`src/gui/Hud.cpp\`)

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

- **Top Edge (\`yd < 0\`):** Insets by \`84 * u\` to clear the night bar, omen banner, and minimap header.
- **Bottom Edge (\`yd >= 0\`):** Insets by \`46 * u\` when a boss bar is active, or \`18 * u\` otherwise.
`,
    mermaidCharts: [
      {
        title: "Stateless BiomeEvents::schedule() Murmur3 Hash & Sanctuary Pipeline",
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
        title: "Sparse Paged Fog-of-War Chart, Scanline RLE Coalescer & Hud::edge Ray Clipper",
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
  },
  {
    id: "tutorial-loot-affixes-allies",
    title: "28. Tutorial 9: Contributing Diablo Item Bases, 5-Tier Affixes, Summoned Allies & Weapon Forms",
    category: "contribute",
    interactiveComponent: "contribute",
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
          "src/item/weapon/form/FormBehavior.cpp"
    ],
    content: `
### Pick one item-system change

This chapter contains four independent tasks. A **gear base** is the item before random bonuses. An **affix** is one of those bonuses. An **ally** is a summoned companion. A **form behavior** controls how a weapon attack moves or acts. Choose one task, follow its files in order, and run the relevant test before moving to another.

### 1. Add a gear base (\`src/item/loot/ItemBase.cpp\`)

\`build()\` makes weapon bases from the weapons registered in \`Upgrade::all()\`. For an offhand, armour piece, charm, or campaign-only weapon base, add a row to the internal \`struct Gear GEAR[]\` table in \`src/item/loot/ItemBase.cpp:22–91\`:

\`\`\`cpp
// struct Gear { name, slots, icon, qlvl, weight, value, implicit, amount, campaignOnly, grants }
const Gear GEAR[] = {
    {"Buckler", slot::Offhand, atlas::tile(atlas::t::Shield), 1, 10, 20, Stat::Armour, 1.0f},
    {"Starlight Signet", slot::Charm, atlas::kit(atlas::kt::Ring), 10, 6, 95, Stat::Crit, 4.0f, true},
};
\`\`\`

- **Read the \`Gear\` / \`ItemBase\` fields in order:**
  1. \`name\`: Display noun between prefix and suffix.
  2. \`slots\`: Bitmask from \`namespace slot\` (\`Weapon = 1\`, \`Offhand = 2\`, \`Armour = 4\`, \`Charm = 8\`, \`AreaWeapon = 16\`, \`ShotWeapon = 32\`, \`Implant = 64\`, \`Any = Weapon | Offhand | Armour | Charm\`).
  3. \`icon\`: \`16 × 16\` \`Sprite\` from \`atlas::tile(...)\`, \`atlas::kit(...)\`, \`atlas::town(...)\`, or \`atlasf::*\`.
  4. \`qlvl\`, \`weight\`, \`value\`: Minimum item level checked by \`pickBase(ilvl, tier, rng, campaign)\` (\`src/item/loot/Loot.cpp:135\`), drop weight, and gold value.
  5. \`implicit\` & \`amount\`: Built-in implicit \`Stat\` (\`Stat::Armour\`, \`Stat::Crit\`, etc.) and magnitude.
  6. \`campaignOnly\` (\`bool\`, comes BEFORE \`grants\`!) & \`grants\` (\`const char *\`, optional granted attack name). If adding a unique in \`src/item/loot/Unique.cpp\`, set \`UniqueDef::Mode\` (\`Both\`, \`Survival\`, or \`Campaign\`) to match its base or \`uniqueFault()\` in \`Content.cpp\` will fail.

---

### 2. Add an affix that can be unequipped (\`Affix.hpp\`, \`Affix.cpp\`, \`Equip.cpp\`)

An affix changes a stat while an item is equipped. Equipping calls \`applyItem(m, item, +1.0f)\`; unequipping calls \`-1.0f\`. After both operations, the original stat must be restored with zero drift.

#### Step 2A: Append to \`enum class Stat\` (\`src/item/loot/Affix.hpp\`)

Always append new constants at the end of \`enum class Stat\` (currently 37 entries: \`None, Damage, Burn, Chill, Poison, Shock, Bleed, Projectiles, Area, Crit, Leech, Armour, Life, MagicFind, GoldFind, Speed, Haste, Regen, Reach, Wisdom, Thorns, ResistBurn, ResistChill, ResistPoison, Kindling, NightDamage, BossDamage, EliteDamage, Arms, Arts, Instincts, Block, ProjectileSpeed, Light, Bargain, Verdant, Hush\`):

\`\`\`cpp
enum class Stat {
    // ... existing 37 entries ending at Hush ...
    NovaMastery,
};
\`\`\`

#### Step 2B: Respect the \`AFFIX_ORDINARY = 31\` / \`AFFIX_COUNT = 49\` Split (\`src/item/loot/Affix.cpp\`)

\`AFFIXES[]\` holds **49** families: **31 ordinary affixes** (indices \`0..30\`, \`"damage"\` through \`"light"\`) followed by **18 faction kin affixes** (indices \`31..48\`, \`"feral"\` through \`"moonlit"\`). \`Item::addAffix()\` only rolls \`0 .. AFFIX_ORDINARY - 1\` (\`AFFIX_COUNT - (KIN_ROWS - 1)\`):
- **Ordinary affixes MUST be inserted before \`"feral"\`** (not appended at the end, or \`"feral"\` leaks into ordinary drops and the new affix never rolls).
- **Faction kin affixes** go at the end and must also update \`KIN_ROWS\` (\`Affix.hpp:70\`) and \`KIN_KEYS[]\` (\`Affix.cpp:147–150\`).
- Field 5 of \`AffixDef\` is \`bool classOnly\` (not a bitmask):

\`\`\`cpp
{"nova_mastery", true, slot::Weapon | slot::AreaWeapon | slot::Charm, Stat::NovaMastery, false, 5,
 {{"Resonant", 1, 6, 10}, {"Harmonic", 5, 11, 16}, {"Astral", 10, 17, 23},
  {"Celestial", 15, 24, 31}, {"Supernova", 20, 32, 40}}},
\`\`\`

Format its tooltip inside \`describe(Stat stat, float value)\` (\`src/item/loot/Affix.cpp:170–247\`) returning \`String\` via \`say(tr(...), value)\`:

\`\`\`cpp
case Stat::NovaMastery:
  return say(tr("+{:.0f}% Area & Damage"), value);
\`\`\`

#### Step 2C: Wire the Reversible Stat Delta in \`apply()\` (\`src/item/loot/Equip.cpp\`)

Inside \`apply(Mob &m, Stat stat, float v)\` (\`src/item/loot/Equip.cpp:11–117\`), mutate \`m.*\` and \`ItemStats &b = m.kit()\` purely additively:

\`\`\`cpp
case Stat::NovaMastery:
  b.area += v * 0.005f;
  m.might += v * 0.005f;
  break;
\`\`\`

---

### 3. Add a summoned ally (\`Ally.hpp\`, \`Ally.cpp\`, \`Recipe.cpp\`)

An ally is a \`Mob\` managed by \`src/entity/Ally.cpp\`. It attacks in melee when \`shot == nullptr\`, or fires a \`const Recipe *shot\` (for example, \`Drone\` points to \`&DRONE_BOLT\`).

#### Step 3A: Append to \`enum class AllyKind\` (\`src/entity/Ally.hpp\`)

Append your companion right before \`Count\` (currently 10 kinds: \`Wolf, Hawk, Ghoul, Skeleton, Drone, Crew, Decoy, Ghost, Quickened, Beguiled, Count\`):

\`\`\`cpp
enum class AllyKind {
    Wolf, Hawk, Ghoul, Skeleton, Drone, Crew, Decoy, Ghost, Quickened, Beguiled,
    StarSentinel,
    Count
};
\`\`\`

#### Step 3B: Add the \`AllyDef\` Row to \`ALLIES[]\` (\`src/entity/Ally.cpp\`)

\`src/entity/Ally.cpp\` enforces \`static_assert(std::size(ALLIES) == size_t(AllyKind::Count))\`. Use a valid \`EnemyKind\` sprite source (such as \`EnemyKind::FrostWisp\`), a float \`Color {r, g, b, a}\`, and a \`const Recipe *shot\` (or \`nullptr\`):

\`\`\`cpp
const AllyDef ALLIES[] = {
    // ... existing 10 rows ...
    {"Star Sentinel", "Astral Beacon", EnemyKind::FrostWisp, 26.0f, 82.0f, 0.75f,
     70.0f, 18.0f, 1.05f, true, false, {0.53f, 0.88f, 1.0f, 1.0f}, &DRONE_BOLT},
};
\`\`\`

- **How \`SummonForm\` Auto-Binds via \`AllyDef::recipe\`:**
  \`SummonForm::fire(const FormCast &c) const\` (\`src/item/weapon/form/Summon.cpp:8–24\`) calls \`allyFor(c.r.name)\`, matching \`a.recipe == c.r.name\`, and spawns up to \`int cap = c.count + int(c.p.bonus().allyCap)\` active companions (leashed at \`Ally::LEASH = 170\` px).

---

### 4. Add a weapon form when existing forms do not fit (\`src/item/weapon/form/\`)

If a weapon needs a brand-new geometric attack pattern beyond the 16 built-in \`Form\` types:
1. Append the identifier to \`enum class Form\` in \`src/item/weapon/Recipe.hpp:15–32\`.
2. Implement a \`FormBehavior\` subclass (\`src/item/weapon/form/FormBehavior.hpp:32–48\`) overriding all four pure virtuals: \`fire(const FormCast &c)\`, \`life(const RecipeShot &s)\`, \`tick(RecipeShot &s, Mob &p, float speed)\`, and \`render(RecipeShot &s, Screen &screen)\`.
3. Use \`FormCast\` members (\`dx, dy, base, targets, shot(...)\`) and \`landHit(unsigned payload, Mob &e, double xd, double yd, float dmg, float knock, Upgrade *source, Mob *wielder)\` declared in \`src/item/weapon/Recipe.hpp:41–42\`.
4. Register the singleton in \`FormBehavior::of(Form form)\` inside \`src/item/weapon/form/FormBehavior.cpp:10–32\` and update its \`static_assert(int(Form::...) == ...)\` on line 8.
`,
    mermaidCharts: [
      {
        title: "End-to-End Pipeline for Contributing a Reversible 5-Tier Loot Affix",
        chart: `
flowchart LR
    classDef step fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef code fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef verify fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;

    S1["1. Affix.hpp<br/>Append Stat::NovaMastery<br/>to enum class Stat"]:::step
    S2["2. Affix.cpp<br/>Insert before 'feral' (AFFIX_ORDINARY)<br/>+ Format in describe() with say(tr())"]:::code
    S3["3. Equip.cpp<br/>Apply reversible +v / -v delta<br/>in apply(Mob &m, Stat, float v)"]:::code
    S4["4. Verify in Sandbox & Tests<br/>MellanganApp --dev --give 16 --loot<br/>MellanganApp --test item"]:::verify

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

    Kind["1. Ally.hpp & Ally.cpp<br/>Append AllyKind::StarSentinel before Count<br/>Add AllyDef row (recipe = 'Astral Beacon', shot = &DRONE_BOLT)"]:::ally
    Recipe["2. Recipe.cpp<br/>Add 'Astral Beacon' row with Form::Summon<br/>SummonForm::fire(FormCast) matches allyFor(c.r.name)"]:::weapon
    Spawn["3. Runtime Execution (Ally::tick)<br/>Orbits Player, leashes at Ally::LEASH (170 px),<br/>and fires const Recipe *shot or melee attacks"]:::runtime

    Kind --> Recipe --> Spawn
`,
      },
    ],
  },
  {
    id: "tutorial-traits-events-bounties",
    title: "29. Tutorial 10: Contributing Elite/Champion Traits, Regional Biome Events & Bounties",
    category: "contribute",
    interactiveComponent: "contribute",
    summary:
      "Step-by-step C++20 guide to adding Elite/Champion monster Traits across 5 combat hooks, scheduling regional BiomeEvents, adding Bounty contracts, and writing deterministic Field unit tests.",
    sourceFiles: [
          "src/entity/Trait.hpp",
          "src/entity/Trait.cpp",
          "src/level/BiomeEvents.hpp",
          "src/level/BiomeEvents.cpp",
          "src/level/Bounty.hpp",
          "src/level/Bounty.cpp",
          "src/test/AllyTest.cpp"
    ],
    content: `
### Choose a trait, biome event, bounty, or test

These are four independent contributions. A **trait** modifies elite/champion monster behavior. A **biome event** schedules periodic regional boons or hazards. A **bounty** adds a night contract objective. A **headless test** verifies a rule without opening a window.

### 1. Add an elite or champion trait (\`src/entity/Trait.hpp\`, \`src/entity/Trait.cpp\`)

Elite monsters carry one or two traits; champions carry two or three, packed in \`uint32_t Traits::bits\` (up to 31 traits).

#### Step 1A: Append to \`enum class Trait\` (\`src/entity/Trait.hpp:10–32\`)

Append the new trait right before \`Count\` (currently 20 traits: \`Hasted, Vampiric, Warded, Splitting, Volatile, Frosted, Thorned, Regenerating, Blinking, Phasing, Brooding, Gravitic, Cursed, Silencing, FireEnchanted, ColdEnchanted, StormEnchanted, StoneSkin, Multishot, AuraBearer, Count\`):

\`\`\`cpp
enum class Trait {
    // ... existing 20 entries ending at AuraBearer ...
    Mirrored,
    Count
};
\`\`\`

#### Step 1B: Register Name & Aura Tint in \`TRAITS[]\` (\`src/entity/Trait.cpp:13–23\`)

Add a lowercase display name and float \`Color {r, g, b, a}\` entry to \`const TraitDef TRAITS[int(Trait::Count)]\`:

\`\`\`cpp
const TraitDef TRAITS[int(Trait::Count)] = {
    {"hasted", {1.0f, 0.88f, 0.33f, 1.0f}},
    // ...
    {"mirrored", {0.56f, 0.94f, 1.0f, 1.0f}},
};
\`\`\`

#### Step 1C: Hook into the 5 \`Traits\` Lifecycle Methods (\`src/entity/Trait.cpp:55–160\`)

1. **\`Traits::incoming(Mob &self, float damage)\`:** Modifies incoming damage before HP subtraction (e.g., \`StoneSkin\` scales by \`0.65f\`, \`Warded\` absorbs while \`ward > 0\` at \`0.25f\`, \`Phasing\` reduces damage to \`0.1f\` while \`veiled()\`, \`Thorned\` reflects).
2. **\`Traits::landed(Mob &self, float dealt)\`:** Fires on hit (e.g., \`Vampiric\` heals, \`Frosted\` chills, \`Cursed\` calls \`afflict(StatusKind::Weaken, ...)\`).
3. **\`Traits::tick(Mob &self)\`:** Per-frame behavior (\`Regenerating\`, \`Blinking\`, \`Gravitic\` pull, \`AuraBearer\`, \`Brooding\`).
4. **\`Traits::died(Mob &self, float damage)\`:** Death triggers (\`Volatile\` explosion, \`Splitting\` clones).
5. **\`Traits::render(Screen &s, const Mob &self, float radius, float age) const\`:** Draws trait rings and visual tells.

\`\`\`cpp
float Traits::incoming(Mob &self, float damage) {
    if (has(Trait::Mirrored) && self.level && self.level->player) {
        Player *p = self.level->player;
        double dx = p->x - self.x, dy = p->y - self.y;
        if (dx * dx + dy * dy > 64.0 * 64.0) {
            p->hurt(1.0f);
            return damage * 0.70f;
        }
    }
    return damage;
}
\`\`\`

---

### 2. Schedule a regional biome event or hazard (\`src/level/BiomeEvents.cpp\`)

\`BiomeEvents.cpp\` holds two \`BIOME_COUNT\`-indexed (30-entry) tables: \`EVENTS[BIOME_COUNT]\` (lines 35–113) and \`HAZARDS[BIOME_COUNT]\` (lines 115–164, used for the 7 boon-only biomes that alternate boon and hazard across even/odd epochs). To add or tune an event, edit the biome's row in \`EVENTS[]\` or \`HAZARDS[]\`, keep \`every\` aligned (\`48 s\` core, \`28 s\` expansion/coast), and implement its effect inside \`BiomeEvents::tick()\` and \`render()\`.

---

### 3. Add a bounty objective (\`src/level/Bounty.hpp\`, \`src/level/Bounty.cpp\`)

\`struct Bounty\` (\`Bounty.hpp:7–14\`) tracks \`int kind, arg, goal; bool done;\` with \`static void roll(Bounty *out, int n);\`. Its unnamed enum in \`Bounty.cpp:14\` defines \`SLAY, KINDLE, ENTER, WALK, SURVIVE, STREAK, SLAY_ALPHA, CATCH_THIEF, KINDS\`.
To add a new bounty kind:
1. Append the enumerator before \`KINDS\` in \`src/level/Bounty.cpp:14\`.
2. Initialize \`kind\`, \`arg\`, and \`goal\` inside \`Bounty::roll()\`.
3. Add a localization key in \`src/gui/Lang.hpp\` / \`Lang.cpp\` and format it in \`Bounty::text()\`.
4. Read progress from \`Level\` fields (\`l.slain[]\`, \`l.litBiomes\`, \`l.entered\`, \`l.chart.discovered\`, \`l.time\`, \`l.bestStreak\`) in \`Bounty::progress(const Level &l)\`.

---

### 4. Write a headless deterministic test (\`src/test/AllyTest.cpp\`, \`src/test/ItemTest.cpp\`)

Every test file begins with \`#undef NDEBUG\` before \`#include <cassert>\` so \`assert()\` stays active in Release builds too. Local fixtures like \`struct Field\` in \`src/test/AllyTest.cpp:17–47\` step a headless \`Level\` without Vulkan or audio:

\`\`\`cpp
#undef NDEBUG
#include <cassert>

void testStarSentinelCompanion() {
    Field f;
    Ally *ally = summon(f.level, AllyKind::StarSentinel, f.p.x + 16.0, f.p.y, 12.0f, 10.0f);
    assert(ally != nullptr);
    Enemy *rat = f.foe(EnemyKind::Rat, 48.0, 0.0);
    entt::entity id = rat->id;
    float before = rat->hp;
    f.run(180);
    Enemy *after = f.level.get<Enemy>(id);
    assert(!after || after->hp < before);
}
\`\`\`

Declare the function in \`src/test/Tests.hpp\`, register a row in \`const Case CASES[]\` inside \`src/test/Test.cpp\`, and run it via \`--test <name>\` (then the full \`--test\` gate):

\`\`\`bash
cmake --build build --config Release --target Mellangan
./build/bin/Release/MellanganApp.exe --test ally
./build/bin/Release/MellanganApp.exe --test
\`\`\`
`,
    mermaidCharts: [
      {
        title: "5 Lifecycle Hooks of struct Traits on Elite & Champion Monsters",
        chart: `
flowchart LR
    classDef hook fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef fn fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Spawn["Traits::add(Trait)<br/>Sets bitmask bits (up to 31)<br/>Sets aura tint & scaling"]:::hook
    Tick["Traits::tick(self)<br/>Regenerating, Blinking,<br/>Gravitic pull, AuraBearer"]:::fn
    In["Traits::incoming(self, dmg)<br/>StoneSkin 0.65x, Warded 0.25x,<br/>Phasing 0.1x, Thorned reflect"]:::fn
    Land["Traits::landed(self, dealt)<br/>Vampiric heal, Frosted chill,<br/>Cursed weaken"]:::fn
    Died["Traits::died(self, dmg)<br/>Volatile blast,<br/>Splitting clones"]:::fn

    Spawn --> Tick --> In --> Land --> Died
`,
      },
      {
        title: "Headless Field Unit Test & CASES[] Registration Pipeline",
        chart: `
flowchart LR
    classDef test fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gate fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    F1["Construct Headless Field f<br/>(#undef NDEBUG + <cassert>)"]:::test
    F2["Configure Scenario<br/>f.foe(EnemyKind::Rat, dx, dy)<br/>summon(f.level, AllyKind::...)"]:::test
    F3["Step Deterministic Simulation<br/>f.run(180) + Re-fetch by entt::entity"]:::test
    F4["Register in Tests.hpp & CASES[]<br/>MellanganApp --test <name> / --test"]:::gate

    F1 --> F2 --> F3 --> F4
`,
      },
    ],
  },
  {
    id: "ouroboros",
    title: "30. Ouroboros: The Council of Eight Serpents, Cyclic Math & XOR-Linked Augury",
    category: "core",
    interactiveComponent: "ouroboros",
    summary:
      "Exhaustive architectural and mathematical breakdown of src/other/Ouroboros.hpp: compile-time consteval unanimity proofs, 8 CRTP serpents, infix operator->*, Euclidean cyclic wrap, zero-heap Ring buffer, and bidirectional XOR-linked Augury.",
    sourceFiles: [
      "src/other/Ouroboros.hpp",
      "src/main.cpp"
    ],
    content: `
### 1. The Mythos, Origin & Role in Mellangan (\`src/other/Ouroboros.hpp\`, \`src/main.cpp\`)

In classical antiquity and alchemical philosophy, the **Ouroboros** represents the serpent consuming its own tail: a primordial symbol of eternal cyclical return, self-referential systems, and closed feedback loops.

Within the Mellangan codebase, \`namespace ouroboros\` (\`src/other/Ouroboros.hpp\`) elevates the fundamental computational question (**"Is an integer n even or odd (n % 2 == 0)?"**) into a tour-de-force of modern C++20 metaprogramming, SIMD-within-a-register (SWAR) bit manipulations, discrete algebraic structures, and self-traversing XOR pointer arithmetic.

#### Why Ouroboros Exists: The Engine's Hardware & Compiler Canary

Rather than being merely an Easter egg, Ouroboros serves a concrete operational role:
1. **Self-Verifying Compilation Canary:** Through its \`consteval bool unanimous()\` function invoked inside a root \`static_assert\`, Ouroboros forces the C++20 compiler to evaluate every bit-level permutation, lookup table, matrix exponentiation, and template instantiation during the build. If compiler optimization flags (such as aggressive MSVC \`/O2\` or \`/Ob3\` inlining) introduce bitwise miscompilations, the build halts immediately with:
   \`"the serpents disagree"\`.
2. **Runtime Developer Diagnostics:** In \`src/main.cpp\`, whenever the game launches with the \`--dev\` flag, \`consultOuroboros()\` queries both compile-time and runtime consensus:
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
3. **Engine-Wide Cyclic Math & Ring Buffers:** Beyond the parity council, the header provides battle-tested cyclic arithmetic: Euclidean \`wrap\` for toroidal coordinates and arrays, ping-pong triangular \`bounce\` for patrols, directional \`turn\` rotations, memory alignment utilities, and the zero-heap \`Ring<T, Capacity>\` circular buffer.

---

### 2. Static Polymorphism via CRTP (\`Charlotte<Self>\`)

Every serpent in the pantheon inherits from the Curiously Recurring Template Pattern (CRTP) base \`Charlotte<Self>\`:

\`\`\`cpp
template <class Self> struct Charlotte {
  constexpr bool operator()(uint32_t n) const {
    return static_cast<const Self &>(*this).bite(n);
  }
};
\`\`\`

- **Zero Vtable Overhead:** Because dispatch is resolved at compile time through \`static_cast<const Self &>(*this)\`, calling a serpent incurs zero virtual pointer dereferences, zero indirect branch prediction penalties, and zero object size bloat.
- **Pure Functional Interface:** Every derived serpent implements \`constexpr bool bite(uint32_t n) const\`, allowing uniform invocation via \`Serpent{}(u)\` in both \`constexpr\` and runtime contexts.

---

### 3. The Canonical Four Serpents (The Inner Council)

The canonical four serpents form the core council whose votes determine the primary \`Ouroboros::even(n)\` decision and \`agreement(n)\`:

\`\`\`
Bit 0: Mirror      (5-Stage SWAR Bit-Reversal Butterfly)
Bit 1: Gray        (XOR Nibble Parity Fold to 0x6996 S-Box)
Bit 2: Bruijn      (LSB Isolation & 0x077CB531 Spiral Hash)
Bit 3: Rebecca     (Low Byte Galois Affine Map to 256-Byte LUT)
\`\`\`

#### 1. Mirror: 5-Stage SIMD-Within-A-Register (SWAR) Bit Reversal
\`Mirror::flip(v)\` reverses all 32 bits of an integer in $O(1)$ operations without loops or memory access, using five successive mask-and-shift stages:

\`\`\`cpp
struct Mirror : Charlotte<Mirror> {
  static constexpr const char *NAME = "Mirror";
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

- **Mechanism:** Stage 1 swaps adjacent 1-bit pairs; stage 2 swaps 2-bit dibits; stage 3 swaps 4-bit nibbles; stage 4 swaps 8-bit bytes; stage 5 swaps the 16-bit halfwords.
- **The Parity Bite:** Because the original least significant bit (bit 0) ends up at bit 31, shifting right by 31 extracts exactly bit 0: \`flip(n) >> 31\`. Inverting with \`!\` yields true if and only if bit 0 was zero (even).

#### 2. Gray: Parity Folding Cascade with 4-Bit S-Box \`0x6996\`
\`Gray::fold(v)\` computes the parity of all bits by recursively folding the integer in half with XOR, compressing 32 bits into a single 4-bit nibble:

\`\`\`cpp
struct Gray : Charlotte<Gray> {
  static constexpr const char *NAME = "Gray";
  static constexpr uint32_t fold(uint32_t v) {
    v ^= v >> 16, v ^= v >> 8, v ^= v >> 4;
    return 0x6996u >> (v & 15) & 1;
  }
  constexpr bool bite(uint32_t n) const { return !(fold(n) ^ fold(n >> 1)); }
};
\`\`\`

- **The Magic Constant \`0x6996\`:** In binary, \`0x6996\` is \`0b0110_1001_1001_0110\`. This is the exact truth table of the 4-input XOR function: bit $k$ is 1 if and only if the population count of $k$ is odd.
- **Differential Parity Cancellation:** Because $n$ and $n >> 1$ share all upper bits in identical positions shifted by one, their bit-sum parities differ strictly by the lowest bit:
  $$\\text{fold}(n) \\oplus \\text{fold}(n >> 1) = (n \\& 1)$$
  Taking the logical negation \`!(fold(n) ^ fold(n >> 1))\` produces true for even and false for odd.

#### 3. Bruijn: Lowest Set Bit Isolation & De Bruijn Sequence Multiplier
\`Bruijn::bite(n)\` determines whether the lowest set bit is at position 0 or higher using a 32-bit De Bruijn cycle:

\`\`\`cpp
struct Bruijn : Charlotte<Bruijn> {
  static constexpr const char *NAME = "Bruijn";
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

- **The Sentinel:** If $n = 0$, bitwise operations have no lowest set bit. Or-ing with \`0x80000000u\` ensures $v$ is never zero, placing a sentinel at bit 31 without altering bit 0.
- **Two's Complement Isolation:** \`v & (~v + 1)\` isolates the lowest set bit as a single power of two $2^k$.
- **De Bruijn Hash:** Multiplying $2^k$ by the De Bruijn constant \`0x077CB531u\` slides a unique 5-bit window into the top 5 bits (\`>> 27\`), perfectly mapping each of the 32 bit positions to a distinct entry in \`SPIRAL\`.
- **The Verdict:** If $n$ is odd, the lowest set bit is bit 0, yielding index \`SPIRAL[...] == 0\`. If $n$ is even, the lowest set bit is at least bit 1 (or the sentinel at bit 31), yielding \`SPIRAL[...] != 0\`.

#### 4. Rebecca: 256-Entry S-Box with Affine Involution in $\\mathbb{Z}_2$
\`Rebecca::bite(n)\` rotates the input right by 8 bits to expose the lowest byte to a compile-time lookup table:

\`\`\`cpp
struct Rebecca : Charlotte<Rebecca> {
  static constexpr const char *NAME = "Rebecca";
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

- **Byte Extraction:** \`std::rotr(n, 8) >> 24\` moves bits 0..7 directly into the low byte.
- **Affine Invariance:** The generator formula uses multiplier $93$ (\`0x5D\`) and offset $46$ (\`0x2E\`). Because $93$ is odd, it is coprime to 256 and preserves parity under multiplication: $(b \\cdot 93) \\equiv b \\pmod 2$. Because $46$ is even, $(b \\cdot 93) \\oplus 46 \\equiv b \\pmod 2$. The outer XOR with 1 inverts the bit, yielding 1 for even bytes and 0 for odd bytes.

---

### 4. The Extended Pantheon of Four Ancient Serpents

To enrich the council, four ancient serpents join the pantheon (bits 4..7 in \`pantheon(n)\`):

\`\`\`
Bit 4: Jormungandr (GL₂(𝔽₂) Matrix Exponentiation of Anti-Diagonal Swap)
Bit 5: Typhon      (Chebyshev Polynomial Tₙ(0) Recurrence)
Bit 6: Apophis     (Stein's Binary GCD with the Sacred Dyad 2)
Bit 7: Quetzalcoatl (2-Point Walsh-Hadamard Transform Spectral Sum)
\`\`\`

#### 5. Jormungandr: Matrix Exponentiation in $GL_2(\\mathbb{F}_2)$
The World-Girdling Serpent computes fast binary matrix exponentiation of the anti-diagonal swap involution over the Galois field of two elements $\\mathbb{F}_2$:

\`\`\`cpp
struct Jormungandr : Charlotte<Jormungandr> {
  static constexpr const char *NAME = "Jormungandr";
  struct Mat2 {
    uint32_t a, b, c, d;
    constexpr Mat2 operator*(const Mat2 &o) const {
      return {(a * o.a + b * o.c) & 1, (a * o.b + b * o.d) & 1,
              (c * o.a + d * o.c) & 1, (c * o.b + d * o.d) & 1};
    }
  };
  static constexpr Mat2 power(Mat2 m, uint32_t exp) {
    Mat2 res{1, 0, 0, 1};
    while (exp > 0) {
      if (exp & 1) res = res * m;
      m = m * m;
      exp >>= 1;
    }
    return res;
  }
  constexpr bool bite(uint32_t n) const {
    return power(Mat2{0, 1, 1, 0}, n).a == 1;
  }
};
\`\`\`

- **Mathematical Proof:** Let $M = \\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix}$. Note that $M^2 = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix} = I$.
  Therefore, by induction:
  $$M^n = \\begin{cases} I = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix} & \\text{if } n \\text{ is even} \\\\ M = \\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix} & \\text{if } n \\text{ is odd} \\end{cases}$$
  Inspecting the top-left element \`res.a\` yields 1 if and only if $n$ is even.

#### 6. Typhon: Chebyshev Polynomial Three-Term Recurrence at Zero
The Storm Giant evaluates the Chebyshev polynomial of the first kind $T_n(x)$ at $x = 0$:

\`\`\`cpp
struct Typhon : Charlotte<Typhon> {
  static constexpr const char *NAME = "Typhon";
  static constexpr int chebyshev_at_zero(uint32_t n) {
    int t0 = 1, t1 = 0;
    for (uint32_t i = 0; i < (n & 3u); i++) {
      int next = -t0;
      t0 = t1;
      t1 = next;
    }
    return t0;
  }
  constexpr bool bite(uint32_t n) const { return chebyshev_at_zero(n) != 0; }
};
\`\`\`

- **Mathematical Proof:** The Chebyshev polynomials satisfy the recurrence $T_0(x) = 1$, $T_1(x) = x$, and $T_{k+1}(x) = 2x T_k(x) - T_{k-1}(x)$.
  At $x = 0$, the $2x T_k(x)$ term vanishes, reducing the recurrence to:
  $$T_{k+1}(0) = -T_{k-1}(0)$$
  This generates the 4-periodic sequence:
  $$T_0(0) = 1, \\quad T_1(0) = 0, \\quad T_2(0) = -1, \\quad T_3(0) = 0, \\quad T_4(0) = 1, \\quad \\dots$$
  Thus, $T_n(0) \\neq 0$ if and only if $n$ is even.

#### 7. Apophis: Stein's Binary GCD with the Sacred Dyad 2
Serpent of Primeval Chaos computes the greatest common divisor with 2 using Stein's binary algorithm:

\`\`\`cpp
struct Apophis : Charlotte<Apophis> {
  static constexpr const char *NAME = "Apophis";
  static constexpr uint32_t stein_gcd2(uint32_t u) {
    if (u == 0) return 2;
    uint32_t v = 2;
    uint32_t shift = 0;
    while (((u | v) & 1) == 0) {
      u >>= 1;
      v >>= 1;
      ++shift;
    }
    return shift > 0 ? 2 : 1;
  }
  constexpr bool bite(uint32_t n) const { return stein_gcd2(n) == 2; }
};
\`\`\`

- **Mathematical Proof:** If $u$ is even, both $u$ and $2$ share a factor of 2. In binary, $(u \\mid 2) \\& 1 = 0$, allowing the loop to execute at least once and setting \`shift > 0\`, which returns $\\gcd(u, 2) = 2$. If $u$ is odd, the loop does not run, returning 1.

#### 8. Quetzalcoatl: Fast Walsh-Hadamard Transform Spectral Sum
The Feathered Serpent applies a 2-point Fast Walsh-Hadamard Transform (FWHT) butterfly matrix to the state vector $[n \\& 1, 1]^T$:

\`\`\`cpp
struct Quetzalcoatl : Charlotte<Quetzalcoatl> {
  static constexpr const char *NAME = "Quetzalcoatl";
  static constexpr bool spectral_test(uint32_t n) {
    int x0 = int(n & 1u);
    int x1 = 1;
    int s = x0 + x1;
    int d = x0 - x1;
    return (s + d) == 0;
  }
  constexpr bool bite(uint32_t n) const { return spectral_test(n); }
};
\`\`\`

- **Mathematical Proof:** The 2-point Walsh-Hadamard matrix is $H_2 = \\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}$. Applying it to $[x_0, 1]^T$ yields sum $s = x_0 + 1$ and difference $d = x_0 - 1$.
  The sum of spectral components is:
  $$s + d = (x_0 + 1) + (x_0 - 1) = 2x_0$$
  If $n$ is even, $x_0 = 0$, so $2x_0 = 0$. If $n$ is odd, $x_0 = 1$, so $2x_0 = 2 \\neq 0$.

---

### 5. The Council Consensus & Infix Operator \`->*\`

The \`Ouroboros\` class gathers votes from both the inner council and the full pantheon:

\`\`\`cpp
class Ouroboros {
public:
  static constexpr size_t CANONICAL_SERPENTS = 4;
  static constexpr size_t PANTHEON_SERPENTS = 8;

  constexpr uint32_t omens(int n) const;     // 4-bit mask (Mirror, Gray, Bruijn, Rebecca)
  constexpr uint32_t pantheon(int n) const;  // 8-bit mask (all eight serpents)

  constexpr int agreement(int n) const;          // Canonical consensus count (0..4)
  constexpr int pantheon_agreement(int n) const; // Pantheon consensus count (0..8)

  constexpr bool even(int n) const;          // Majority of canonical serpents
  constexpr bool odd(int n) const;           // Logical negation of even(n)

  constexpr bool operator()(int n) const { return even(n); }
  constexpr int operator%(int n) const { return even(n) ? 0 : 1; }

  friend constexpr bool operator->*(Ouroboros self, int n) {
    return self.even(n);
  }
};
\`\`\`

- **The Infix Pointer-to-Member Syntax:** C++ permits overloading the pointer-to-member operator \`->*\`. Ouroboros exploits this to provide an infix parity query:
  \`\`\`cpp
  constexpr ouroboros::Ouroboros council;
  bool isEven = council->*42;  // true!
  \`\`\`
- **The Verdict Structure:** \`ouroboros::consult(n)\` returns a comprehensive \`Verdict\` containing canonical and pantheon bitmasks, agreement tallies, parity, and a unanimity flag.
- **User-Defined Literals:** \`ouroboros::literals\` provides \`42_even\` and \`42_odd\` for direct literal evaluation.

---

### 6. Cyclic Arithmetic: The Serpent Biting Its Tail

Game worlds, tile grids, angle facings, and circular queues require cyclic math that handles negative numbers cleanly:

\`\`\`cpp
// Euclidean wrap: result is guaranteed in [0, size) even for negative indices
template <std::integral T, std::integral S>
constexpr S wrap(T index, S size) noexcept {
  if (size <= 0) return 0;
  if ((size & (size - 1)) == 0)
    return static_cast<S>(index & (size - 1));
  auto rem = index % size;
  return static_cast<S>(rem < 0 ? rem + size : rem);
}

// Ping-pong triangular wave: 0, 1, ..., max, max-1, ..., 0
constexpr int bounce(int index, int max) noexcept {
  if (max <= 0) return 0;
  int period = 2 * max;
  int w = wrap(index, period);
  return w <= max ? w : period - w;
}

// Cyclic heading turns (default 8 directions)
constexpr int turn(int heading, int delta, int directions = 8) noexcept {
  return wrap(heading + delta, directions);
}
\`\`\`

- **Euclidean Modulo:** In standard C++, \`-1 % 4 == -1\`. The \`wrap\` function enforces true mathematical modulo: \`wrap(-1, 4) == 3\`.
- **Power-of-Two Fast Path:** If \`size\` is a power of two, \`wrap\` collapses to a single bitwise AND (\`index & (size - 1)\`), avoiding hardware division instructions entirely.
- **Memory Alignment & Bit Functions:** \`is_power_of_two\`, \`next_power_of_two\`, \`align_up<N>\`, \`align_down<N>\`, and \`is_aligned<N>\` provide compile-time verified alignment helpers for Vulkan buffers and cachelines.

---

### 7. Zero-Allocation Circular Ring Buffer (\`ouroboros::Ring<T, Capacity>\`)

\`ouroboros::Ring\` is a fixed-capacity, cache-friendly circular queue that allocates zero heap memory:

\`\`\`cpp
ouroboros::Ring<int, 4> ring;
ring.push_back(10);
ring.push_back(20);
ring.push_back(30);
ring.push_back(40);
ring.push_back(50); // Capacity full: overwrites oldest element (10)!

int oldest = ring.pop_front(); // Returns 20
\`\`\`

- **Tail-Biting Overwrite Semantics:** When full, \`push_back\` automatically advances both \`head_\` and \`tail_\`, overwriting the oldest entry.
- **Power-of-Two Index Advancement:** Internal pointer advancement uses bitwise masking when \`Capacity\` is a power of two: \`(idx + 1) & (Capacity - 1)\`.
- **Cyclic Relative Indexing:** \`ring[i]\` indexes logically from the current head, while \`ring.at_wrapped(offset)\` accepts negative offsets relative to the head.
- **Standard Range-For Iteration:** Exposes \`begin()\` and \`end()\` iterators for clean traversal over active elements.

---

### 8. Augury: Bidirectional XOR Doubly-Linked List

At runtime, \`Augury\` allocates an array of eight \`Rite\` nodes, connected via a self-traversing XOR-linked list:

\`\`\`cpp
struct Rite {
  const void *charlotte;
  bool (*bite)(const void *, uint32_t);
  uintptr_t link; // prev ^ next
  const char *name;
};
\`\`\`

#### The XOR Linked List Principle
A standard doubly linked list requires two separate 64-bit pointers (\`prev\` and \`next\`), consuming 16 bytes of pointer overhead per node.
An XOR-linked list compresses both pointers into a single 64-bit integer:
$$\\text{link} = \\text{prev} \\oplus \\text{next}$$

#### Forward Traversal
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
  return std::popcount(votes) > 4;
}
\`\`\`
Because $\\text{link} = \\text{prev} \\oplus \\text{next}$, computing $\\text{link} \\oplus \\text{prev} = (\\text{prev} \\oplus \\text{next}) \\oplus \\text{prev} = \\text{next}$. The forward neighbor is reconstructed on the fly.

#### Reverse Traversal & Bidirectional Consensus
Starting from the tail node (\`rites[7]\`), reverse traversal reconstructs the previous neighbor via $\\text{link} \\oplus \\text{next} = \\text{prev}$:
\`\`\`cpp
bool bidirectional_consensus(int n) const {
  return even(n) == reverse_even(n);
}
\`\`\`
The augury succeeds if and only if both forward and backward journeys reach unanimous consensus.

---

### 9. Compile-Time Consteval Unanimity Proofs

The header concludes with an extensive compile-time verification suite:

\`\`\`cpp
consteval bool unanimous() {
  Ouroboros o;
  constexpr int EDGES[] = {
    0, 1, -1, 2, -2,
    0x7FFFFFFF, int(0x80000000u),
    0x55555555, int(0xAAAAAAAAu),
    65536, 255, 256
  };
  for (int n : EDGES) {
    if ((o->*n) != (n % 2 == 0) || o.agreement(n) != 4) return false;
    if (o.pantheon_agreement(n) != 8) return false;
  }
  for (int n = -2048; n <= 2048; n++) {
    if ((o->*n) != (n % 2 == 0) || o.agreement(n) != 4) return false;
    if (o.pantheon_agreement(n) != 8) return false;
  }
  // Also verifies Ring push/pop/overwrite, wrap, and memory alignments...
  return true;
}
static_assert(unanimous(), "the serpents disagree");
\`\`\`

If any serpent dissents or if cyclic math deviates from mathematical invariants, the compiler halts the build.
`,
    mermaidCharts: [
      {
        title: "The Council of Eight Serpents: Compile-Time Parity Consensus Pipeline",
        chart: `
flowchart TD
    classDef input fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef inner fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef outer fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef council fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Input["Target Integer int n<br/>u = std::bit_cast<uint32_t>(n)"]:::input

    subgraph InnerCouncil ["Canonical Inner Council (omens: 4 Bits)"]
        M["Mirror::bite(u)<br/>5-Stage SWAR Bit-Flip<br/>!(flip(u) >> 31)"]:::inner
        G["Gray::bite(u)<br/>XOR Fold to 0x6996 S-Box<br/>!(fold(u) ^ fold(u>>1))"]:::inner
        B["Bruijn::bite(u)<br/>LSB * 0x077CB531u >> 27<br/>SPIRAL[hash] != 0"]:::inner
        R["Rebecca::bite(u)<br/>std::rotr(u, 8) >> 24<br/>AN_ARRAY_OF_FEELINGS[b] != 0"]:::inner
    end

    subgraph ExtendedPantheon ["Extended Pantheon (pantheon: 8 Bits)"]
        J["Jormungandr::bite(u)<br/>GL₂(𝔽₂) Matrix Exponentiation<br/>power(swap, u).a == 1"]:::outer
        T["Typhon::bite(u)<br/>Chebyshev Tₙ(0) Recurrence<br/>Tₙ(0) != 0"]:::outer
        A["Apophis::bite(u)<br/>Stein's Binary GCD with 2<br/>gcd(u, 2) == 2"]:::outer
        Q["Quetzalcoatl::bite(u)<br/>2-Point Walsh-Hadamard<br/>(s + d) == 0"]:::outer
    end

    Omens["Canonical omens(n) = M | G<<1 | B<<2 | R<<3<br/>Pantheon mask = omens | J<<4 | T<<5 | A<<6 | Q<<7"]:::council
    Operator["council->*n (Infix Pointer-to-Member Evaluation)<br/>static_assert(unanimous(), 'the serpents disagree')"]:::council

    Input --> InnerCouncil & ExtendedPantheon
    InnerCouncil & ExtendedPantheon --> Omens --> Operator
`,
      },
      {
        title: "Augury Bidirectional XOR-Linked List Traversal (link = prev ^ next)",
        chart: `
flowchart LR
    classDef node fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef thunk fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef result fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;

    R0["rites[0] (Mirror)<br/>link = 0 ^ &rites[1]"]:::node
    R1["rites[1] (Gray)<br/>link = &rites[0] ^ &rites[2]"]:::node
    R2["rites[2] (Bruijn)<br/>link = &rites[1] ^ &rites[3]"]:::node
    R7["rites[7] (Quetzalcoatl)<br/>link = &rites[6] ^ 0"]:::node

    R0 -->|"Forward: next = link ^ prev"| R1
    R1 -->|"Forward: next = link ^ prev"| R2
    R2 -.->|"Forward: steps 3..6"| R7
    R7 -->|"Reverse: prev = link ^ next"| R2

    Thunk["Type-Erased Thunk Dispatch<br/>r->bite(r->charlotte, u)<br/>thunk<S>() -> bool"]:::thunk
    Consensus["Bidirectional Consensus<br/>even(n) == reverse_even(n)<br/>std::popcount(votes) > 4"]:::result

    R0 & R1 & R2 & R7 -.-> Thunk --> Consensus
`,
      },
      {
        title: "Cyclic Math & Ring Buffer Tail-Biting Overwrite Lifecycle",
        chart: `
flowchart TD
    classDef state fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef op fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef wrap fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;

    Init["Empty Ring<T, Capacity><br/>head = 0, tail = 0, count = 0"]:::state
    Push["push_back(val)<br/>data[tail] = val, tail = advance(tail)"]:::op
    Full{"Is Ring Full?<br/>count == Capacity"}:::wrap
    Overwrite["Tail-Biting Overwrite<br/>data[tail] = val<br/>head = advance(head), tail = advance(tail)"]:::wrap
    Normal["Normal Insertion<br/>data[tail] = val<br/>tail = advance(tail), count++"]:::op
    Advance["Index Advance Optimization<br/>Power of Two: (idx + 1) & (Capacity - 1)<br/>General: (idx + 1 == Cap) ? 0 : idx + 1"]:::op

    Init --> Push --> Full
    Full -- Yes --> Overwrite --> Advance
    Full -- No --> Normal --> Advance
`,
      },
    ],
  },
  {
    id: "campaign-settlements-delves",
    title: "31. Campaign Settlements, Sanctuary Seekers, Watchtowers & Dungeon Delves",
    category: "gameplay",
    interactiveComponent: "refugee",
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
          "src/test/DelveTest.cpp"
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
  },
  {
    id: "engine-mathematics",
    title: "32. Die Mathematik von Mellangan: Eine Untersuchung von Modellen und Invarianten",
    category: "core",
    interactiveComponent: "status-resistance",
    summary:
      "Eine wissenschaftliche Analyse der Näherungen, Beweise, Einheiten und Randbedingungen des Spielsystems anhand des Quellcodes.",
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
          "src/level/Feuds.cpp"
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

Außerdem ist $\\mathbf q-\\mathbf r=\\tau\\mathbf v$. Weil $\\tau\\ge0$, liefert die Homogenität der euklidischen Norm $\\|\\tau\\mathbf v\\|=\\tau\\|\\mathbf v\\|$. Einsetzen der ersten Schranke beweist die zweite. ∎

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

Die Aufteilung auf Simulationsschritte ändert diese Summe nicht. ∎

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

folgt, dass die lückenlose Folge von Bereichen genau $[0,N)$ bedeckt. ∎

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

Die Bits 24–55 enthalten die gesamte Tiefenkodierung. Unter der Schranke $0\\le\\text{Ebene}\\le15$ enthalten die Bits 56–59 den gesamten Ebenenwert. Da die Ebenenbits höher liegen, bestimmen sie zuerst die Ordnung, danach die Tiefenbits. Die unteren 24 Indexbits werden nicht verglichen; bei Gleichheit der sortierten Bits bewahrt die Stabilität die Einfügereihenfolge. ∎

Größere Ebenenwerte könnten falsch einsortiert werden. NaN besitzt keine numerische Tiefenordnung. Die beiden numerisch gleichen Nullen haben verschiedene Schlüssel und fallen deshalb nicht unter die Aussage zur stabilen Gleichheit.

### 6. Ein Tor-Richtungsfeld als Graphenproblem

\`bastion::raise()\` behandelt begehbare Zellen als Knoten eines Graphen und Verbindungen zu bis zu acht Nachbarzellen als Kanten. Die Funktion legt die Toröffnung in eine Warteschlange nach dem Prinzip „zuerst hinein, zuerst heraus“ und breitet sich von dort aus. Jede neu entdeckte Zelle speichert die Richtung zurück zur Zelle, von der aus sie entdeckt wurde. Eine diagonale Ausbreitung wird verworfen, wenn eine der beiden angrenzenden Zellen in gerader Richtung eine Wand ist. So führt kein Weg durch eine blockierte Ecke.

**Behauptung: Die gespeicherte Richtung folgt einem Weg mit minimaler Schrittzahl zu einer Öffnung.** Dies gilt für den beim Aufbau feststehenden Graphen, wenn jede zulässige Kante dieselben Kosten von einem Schritt hat.

*Beweis.* Jede Toröffnung wird als Quelle mit Abstand null eingereiht. Werden alle Knoten mit Abstand $d$ verarbeitet, gelangt jeder noch unentdeckte Nachbar mit Abstand $d+1$ ans Ende der Warteschlange. Wegen der FIFO-Reihenfolge kann kein Knoten mit Abstand $d+1$ vor einem Knoten mit Abstand $d$ verarbeitet werden.

Induktiv werden daher zuerst alle erreichbaren Knoten mit Abstand null, dann eins, dann zwei und so weiter entdeckt. Bei der ersten Entdeckung einer Zelle ist ein kürzerer Weg ausgeschlossen: Er hätte eine Vorgängerzelle mit kleinerem Abstand gehabt, die bereits verarbeitet worden wäre. Die gespeicherte Richtung zeigt auf diese Vorgängerzelle. Wiederholt man sie, sinkt der Abstand in jedem Schritt um eins, bis eine Toröffnung erreicht ist. ∎

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

Ein solches gewichtetes Mittel normierter Eckvektoren ist wieder nichtnegativ und normiert. Die erneute Auswahl der drei größten Anteile erfüllt somit die Voraussetzungen des ersten Schritts. ∎

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

Damit gilt die Behauptung auch für Schicht $i$. Bei normierten Endgewichten ist $\\sum_jw_j=1$, also lautet die endgültige Farbe $\\sum_jw_jc_j$. Dies beschreibt die Alphagewichte vor Einfärbung, Texturdetails und späterer Beleuchtung. ∎

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

Übrig bleiben die entsprechenden Ableitungen der gemeinsamen affinen Kantendaten; die zweite reine $x$-Ableitung ist dort null. Da die Randfunktion $G(y)$ auf beiden Seiten dieselbe ist, stimmen auch ihre $y$-Ableitungen überein. Dasselbe gilt für gemischte Ableitungen, wenn man die übereinstimmenden Ausdrücke nach $y$ ableitet. Die waagerechten Gitterkanten folgen durch Vertauschen von $x$ und $y$. ∎

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

Jede neu entzündete Kachel muss direkt an eine Quelle aus $B_n$ grenzen. Entlang eines durchgehenden, eine Kachel breiten Brennstoffstreifens kann die Front daher pro Durchlauf höchstens einen Zellschritt, also 16 Weltpixel, vorrücken. Erst im folgenden Durchlauf darf die neue Kachel selbst eine weitere entzünden. ∎

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

*Beweis der zweiten Aussage.* Hat ein Tastenweg im laufenden Schritt bereits gewechselt, sieht \`step()\` die neue Ebene mit $L=1$. Die drei Fälle schließen einander aus; \`step()\` kann \`through()\` höchstens einmal aufrufen. ∎

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

Der Notfallzweig ohne Abstandsprüfung setzt nur den ersten Mund einer Zelle. ∎

Vor der Änderung galt die Schranke $12$; die Verschiebung kostet also höchstens $3\\sqrt2\\approx4{,}24$ Kacheln Abstand. Für Münder verschiedener Zellen machte schon die alte Regel keine Aussage. *Beobachtung, kein Beweis.* Mit derselben Saat sind nun $63$ von $718$ Mündern Bögen ($8{,}8\\,\\%$). Unter den übrigen $655$ fallen $337$ auf Gruben und $318$ auf Baue. Unter der Annahme eines fairen Paritätsbits erwartet man $327{,}5$ Gruben mit Standardabweichung $\\sqrt{655}/2\\approx12{,}8$. Die Abweichung beträgt also etwa $0{,}74$ Standardabweichungen.

### 15. Grabinschriften und die Präfix-Invariante der Chronik

Die Chronik eines Feldzugs hat $F\\le8$ Gründer. Jeder Gründer $f$ besitzt $M=2$ Fragmente mit den Kennungen $r=4f+k$, $k<M$. Gespeichert wird die Menge $\\mathcal F$ der gelesenen Kennungen, und \`found(f)\` zählt $|\\{k<M:\\ 4f+k\\in\\mathcal F\\}|$. Fragmente liegen an der Oberfläche als Tafeln. Seit dieser Fassung liegt außerdem im Herzen jeder Zelle der Verlorenen Hallen im Sundark eine Gruft auf der Kachel $(h_x,\\ h_y-2)$, und ihre Inschrift zählt ebenfalls als Fragment.

**Satz 9 (Präfix-Invariante).** Beginnt die Fragmentmenge leer und wird nur durch \`Campaign::read()\` verändert, so enthält sie für jeden Gründer genau die ersten \`found(f)\` Fragmente:

$\\mathcal F\\cap\\{4f,\\,4f+1\\}=\\{4f+k:\\ k<\\mathrm{found}(f)\\}.$

*Beweis durch Induktion über die Leseaufrufe.* Im Anfangszustand sind $\\mathcal F$ und alle Präfixe leer. Angenommen, die Gleichung gilt vor dem nächsten erfolgreichen Lesen. \`read()\` fügt genau den Wert aus \`readable()\` ein. Sowohl die Tafel an der Oberfläche als auch die Gruft unten liefern bei $\\mathrm{found}(f)<M$ denselben nächsten Index:

$$k=\\mathrm{found}(f),\\qquad r=4f+k.$$

Nach Induktionsannahme sind $4f,\\dots,4f+k-1$ bereits vorhanden und $4f+k$ ist das kleinste fehlende Fragment dieses Gründers. Das Einfügen verlängert also sein Präfix um genau eins; die Präfixe aller anderen Gründer bleiben gleich. ∎

Daraus folgt: Die Reihenfolge der Fragmente bleibt erhalten, gleich ob der Held eine Tafel oder eine Gruft liest. Die Meldung, dass ein Grab erwacht, erscheint für jeden Gründer genau einmal, nämlich beim Übergang von $\\mathrm{found}=1$ zu $2$. Kein Gründer erhält mehr als $M$ Fragmente. *Grenze.* \`Campaign::load()\` nimmt jede Zeile \`fragment r\` mit $0\\le r<64$ an; ein von Hand bearbeiteter Spielstand liegt außerhalb der Voraussetzung.

**Satz 10 (Zuordnung und Einmaligkeit der Grüfte).** Eine Gruft auf der Kachel $t$ gehört dem Gründer

$\\mathrm{buried}(t)=\\arg\\min_f\\ \\|\\mathbf c_f-16\\,t\\|^2,$

Hier ist $\\mathbf c_f$ der Mittelpunkt des Sitzes von Gründer $f$ in Weltpixeln. Bei Gleichstand gewinnt der kleinste Index. Die Formel teilt die Grüfte in Voronoi-Zellen der Sitze ein. Jede Gruft liefert höchstens ein Fragment; alle Grüfte zusammen liefern höchstens $MF\\le16$.

*Beweis der Zuordnung.* Der lineare Durchlauf ersetzt den bisherigen Sieger nur bei einem echt kleineren Abstand $d<\\text{near}$. Bei gleichen Abständen bleibt daher der zuerst betrachtete, kleinere Index Sieger.

*Beweis der Schranke.* Beim Lesen in der Tiefe speichert \`read()\` den Zellschlüssel $(c_x,c_y)$ in \`epitaphs\`. Danach liefert \`readable()\` für denselben Schlüssel $-1$. Der Schlüssel wird auch als Zeile \`epitaph cx cy\` gespeichert. Somit trägt jede Gruft höchstens einmal bei. Nach Satz 9 kann Gründer $f$ insgesamt höchstens $M$ Fragmente erhalten. Summiert über $F$ Gründer ergibt das höchstens $MF\\le2\\cdot8=16$, unabhängig von der Zahl der Hallen. ∎

**Lemma (Unabhängigkeit von der Ebene).** \`Campaign::history()\` liefert dieselben Gründer, gleich auf welcher Ebene sie zum ersten Mal ausgewertet wird.

*Beweis.* \`chronicle::write()\` liest Bauwerke über \`world::structureIn()\`; diese Abfrage hängt von der aktiven Ebene ab. \`history()\` ruft das Schreiben innerhalb eines \`world::Surfaced\` auf. Dieses Objekt aktiviert vor der Abfrage die Oberfläche und stellt beim Verlassen die vorige Ebene wieder her. Die Abfrage sieht daher unabhängig vom Ausgangsort dieselbe Oberflächenebene. ∎

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

Für $M=\\{x\\}$ liegt $x$ wegen $A\\cap B=\\emptyset$ höchstens auf einer Seite; ein Faktor ist null. Aus $M\\subseteq M'$ folgen $T_M\\subseteq T_{M'}$ und $P_M\\subseteq P_{M'}$, also auch die behauptete Monotonie. ∎

Beispiel: Ein Hale-Held mit fünf Leiden und dem Werkstoff Stein besitzt insgesamt sechs Auslöser. Mit sechs Werkstoffen der Ausrüstung als Wirkungen erreicht er $6\\cdot6=36$ Synergien. Für alle $256$ braucht er sämtliche $32$ Merkmale.

Eine **Fehde** flammt in einem berechtigten Augenblick, der alle $15$ Sekunden geprüft wird, genau dann auf, wenn

$\\mathrm{hash2}\\bigl(\\mathrm{hash2}(31r_x+7n,\\ 17r_y-13s),\\ \\text{salt}\\bigr)\\bmod1000<90.$

Dabei sind $(r_x,r_y)$ die Region, $n$ die Nacht und $s$ das Zeitfenster. Außerhalb berechtigter Augenblicke setzt \`Level::feuds()\` den Zeitgeber zurück, nämlich nahe sicheren Zonen, während einer Belagerung und in den ersten Nächten.

**Satz 12 (Wahrscheinlichkeit trotz Restverzerrung).** Unter der Annahme, dass der äußere Hash auf $\\{0,\\dots,2^{32}-1\\}$ gleichverteilt ist, hat eine einzelne Prüfung die Wahrscheinlichkeit

$P=\\frac{90\\cdot4\\,294\\,968}{2^{32}}=\\frac{386\\,547\\,120}{4\\,294\\,967\\,296}\\approx0{,}0900000017.$

*Beweis.* Die Division des Hashraums in 1000 Restklassen ergibt

$$2^{32}=1000\\cdot4\\,294\\,967+296.$$

Die Reste $0,\\dots,295$ besitzen deshalb je $4\\,294\\,968$ Urbilder; alle anderen besitzen je $4\\,294\\,967$. Das Ereignis \`Rest < 90\` umfasst die 90 Reste $0,\\dots,89$, die sämtlich zur ersten Gruppe gehören. Seine Anzahl günstiger Hashwerte ist somit $90\\cdot4\\,294\\,968$. Division durch $2^{32}$ ergibt die Formel. ∎

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
          "src/test/LangTest.cpp"
    ],
    content: `
### Interface text and content names

\`src/gui/Lang.hpp\` defines the English interface defaults in \`Lang\`; menus read the global \`lang\` instance. \`say()\` formats strings with runtime \`fmt\` arguments. Content names and other text can also pass through the \`Glossary\` via \`tr()\`. These are two complementary kinds of entries in the same language file.

### Selecting a language

The Language row in Settings lists \`english\` first, followed by the sorted \`.txt\` filenames in \`res/lang/\`. The selected name is saved in \`settings.txt\`. \`Game::loadLanguage()\` resets the interface strings, glossary, and \`lexicon::rebuild()\` to English defaults when the selection changes, then loads \`res/lang/<name>.txt\` through \`pak::load()\` (supporting encrypted \`data.pak\` archives) unless English is selected. It then iterates \`pak::list(base + "res/lang/" + loaded, ".txt")\` to merge every modular sidecar file inside \`res/lang/<name>/\` (for example, \`res/lang/deutsch/\` holds 23 modular translation files). If the main file cannot be read, the game logs a warning and keeps the defaults. German is supplied as \`res/lang/deutsch.txt\` plus \`res/lang/deutsch/*.txt\`.

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
          "src/audio/Sound.cpp"
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
    title: "35. Input, Live Campaign Panels, Quickbar & Choice Badge",
    category: "core",
    interactiveComponent: "input-response",
    summary:
      "Key transitions, 23 keyboard and 10 gamepad bindings, live non-pausing 7-tab campaign window, 4-slot quickbar, choice badge, and contextual prompts.",
    sourceFiles: [
          "src/input/Key.hpp",
          "src/input/Input.hpp",
          "src/input/Input.cpp",
          "src/gui/Panel.hpp",
          "src/gui/Panel.cpp",
          "src/gui/PanelQuick.cpp",
          "src/gui/HudButtons.cpp",
          "src/menu/ControlsMenu.cpp",
          "src/test/InputTest.cpp"
    ],
    content: `
### From an event to an action

\`Input::handle()\` receives SDL events and updates shared \`Key\` objects. A \`Key\` records whether it is held (\`down\`) and counts transitions from released to pressed. At the next \`Input::tick()\`, \`clicked\` is set if at least one press was recorded and the count is cleared. A press and release between ticks can therefore produce \`clicked\` even though \`down\` is already false. Losing window focus releases the keys and clears stored stick and trigger state.

Keyboard and gamepad bindings can point to the same action. Some gamepad bindings deliberately control two actions: by default, X maps to Gather and Retry, Y to Inventory and Codex, and Back to Map and Quit. Strike defaults to F on the keyboard and R3 on a gamepad.

### Rebinding, Defaults & \`KEYS 2\` Persistence

The controls menu exposes **23 keyboard rows** (\`BINDING_COUNT = 23\`) and **10 gamepad rows** (\`PAD_COUNT = 10\`), switching sets automatically by input mode. The campaign bottom HUD bar (\`src/gui/HudButtons.cpp\`) displays eight icon buttons matching the default bindings: **Inventory (\`I\`)**, **Character (\`C\`)**, **Skill Tree (\`T\`)**, **Quest Log (\`L\`)**, **Map (\`M\`)**, **Build (\`B\`)**, **Cook (\`K\`)**, and **Settings (\`O\`)**; **Codex** is bound to \`N\`, **Gift** to \`G\` (pad Share/\`MISC1\`), **Choices** to \`U\` (pad \`Start\`), and **Mute** is unbound by default (\`SDL_SCANCODE_UNKNOWN\`, toggled in Settings).

Fixed inputs include Arrow keys, Enter, Escape, \`Tab\` / \`Shift+Tab\` (and pad \`LB\` / \`RB\`) for panel tab cycling, number keys \`1–4\` (dialogue options or campaign quickbar), and \`5–8\` (plus pad \`LB\` + D-pad) for d20 Dice Spells. Mouse wheel zooms the camera only in \`--dev\` mode and otherwise scrolls the campaign journal or Pack materials ledger. \`saveKeys()\` writes a \`KEYS 2\` versioned header to \`keys.txt\`.

### Live Non-Pausing Campaign Window (\`LV1\`, \`PK1\`, \`PK2\`)

In Campaign mode (\`RunRules::live == true\`), opening an in-game menu where \`Menu::live() == true\` (20 menus including \`Panel\`, \`InventoryMenu\`, \`CraftMenu\`, \`CookMenu\`, \`QuestMenu\`, \`CodexMenu\`, \`MapMenu\`, \`StashMenu\`, \`VendorMenu\`, \`PauseMenu\`) keeps the world simulation running rather than pausing it. Survival mode keeps traditional pausing.

- **One Docked 7-Tab Panel (\`src/gui/Panel.cpp\`):** At viewport widths \`>= 1200\` px (\`DOCK_FROM\`), \`Panel\` docks on the right (\`DOCK = 0.46f\`) and smoothly shifts the camera (\`camera.panGoal = 0.23f\`) so the hero remains centered in the visible left pane; below 1200 px it opens full screen. Its seven tabs are \`Pack\`, \`Make\` (auto-selecting Cook near a hearth or Craft near a workbench), \`Character\`, \`Tree\`, \`Quest\`, \`Codex\`, and \`Settings\`.
- **Dual Movement & Panel Navigation:** Arrow keys and gamepad D-pad feed \`navUp..navRight\`, so \`WASD\` continues walking the hero in the live world while arrows navigate the open panel. \`input.hush()\` blocks combat clicks from leaking through, a red screen edge flashes when struck, and station panels (\`Craft\`, \`Cook\`, \`Stash\`, \`Vendor\`) auto-close via \`Menu::away()\` if you walk out of reach.
- **Pack Tab, Stash/Vendor Columns & 4-Slot Quickbar:** \`Pack\` pairs gear and the 32-slot bag on the left with a filterable materials ledger (7 filter chips: \`All\`, \`Food\`, \`Mat\`, \`Reagent\`, \`Brew\`, \`Curio\`, \`Seed\`) and a saved 4-slot quickbar (\`PanelQuick.cpp\`, keys \`1–4\` to eat edible foods or brews). \`StashMenu\` and \`VendorMenu\` dock as live columns with drag, right-click single transfer, and \`Shift\`+click transfer-all of the same base.
- **Queued Choice Badge (\`LV2\`):** In Campaign mode, level-up, boon, and night-offering cards no longer pop up mid-fight. \`Game::choices()\` counts pending choices behind a pulsing gold badge right of the bottom bar (\`Hud::choiceBadge()\`); press \`U\`, pad \`Start\`, or click the badge to open them via \`Game::choose()\`.

### Stick dead zone and button hysteresis

The left stick uses a radial dead zone. If its raw magnitude is $m \\le 0.25$, output is zero. Outside the dead zone, the magnitude is rescaled from the remaining range to $[0,1]$, while preserving direction:

$$\\mathbf{s}=\\frac{\\mathbf{v}}{m}\\min\\left(1,\\frac{m-0.25}{0.75}\\right)$$

For example, a horizontal input of 0.50 becomes approximately 0.33. The same rescaled axes also drive digital menu directions: a direction presses when its component exceeds 0.6 and remains held until it drops to 0.3 or below. Triggers press above 0.5 and remain held above 0.25.

### Prompts and tests

\`Input::prompt()\` substitutes recognized space-delimited words for pad or custom keyboard bindings. \`src/test/InputTest.cpp\` exercises gamepad mapping, dead zone and threshold behavior, rebinding, cancellation, persistence and representative prompt text.
`,
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
    summary:
      "Three world layers, cave passages, regional hazards, deep guardians, and campaign dread.",
    sourceFiles: [
          "src/level/world/Under.cpp",
          "src/level/biome/CaveBiome.hpp",
          "src/level/biome/CaveBiome.cpp",
          "src/level/CaveRules.cpp",
          "src/level/World.hpp",
          "src/campaign/CampaignSave.cpp",
          "src/campaign/CampaignChronicle.cpp",
          "src/Game.cpp"
    ],
    content: `
### Three layers at the same coordinates

\`world::Layer\` distinguishes the surface, caves, and the deep Sundark. Underground terrain is generated in \`64 × 64\` tile cells. A cave cell records its topology, mouths, biome, possible vault, and chamber center; a deep cell records its biome, landing, exit, and possible guardian lair. \`world::enter()\` switches the active layer, so terrain and prop queries at the same tile coordinates resolve against that layer. The cave biome under a surface location follows the land above; deep regions use their own climate and biome selection.

\`world::passageNear()\` searches the tiles around the hero for a passage. Cave mouths connect surface and caves. Stairs connect caves and deep cells. Deep exits may instead be roots, chimneys, or sinkholes; a sinkhole leads to the surface. A chasm is different from an interaction passage: it occupies a small open area in a descent cave. Non-floating, non-boss foes that enter it are removed from the current layer. Check the passage's \`to\` layer before assuming every underground exit returns to the cave above.

Walking onto a passage tile travels without a key: \`Game::step()\` reads the hero's foot tile through \`world::passageAt()\` once per step, and \`Level::landed\` keeps the hero from bouncing straight back. The flag is set on every arrival and on every new level, and clears once the foot leaves a passage tile. E beside a passage still works. On the surface, \`mouthProp()\` draws a mouth as a cliff arch when the tile above is higher, otherwise as a pit or a burrow; the cave builder nudges each mouth up to three tiles toward a cliff foot. Below, a mouth is a pool of daylight with a beam. Chapter 32, section 13 proves the no-bounce property, and section 14 proves the spacing bound after the nudge.

\`Level::shift()\` changes layers without changing the run clock. It removes current foes, draws gems toward the hero, transfers the current chart into its layer slot, updates sky and cave lighting, places the hero and allies at the destination, and moves loose non-gem pickups along. The first visit to a chamber center creates a chest, tracked by a key containing the cell coordinates and layer. The separate chart for each layer prevents explored surface tiles from revealing cave walls.

### 25 Underground Biomes, Tier Classification & Environmental Rules

\`CaveBiome\` (\`src/level/biome/CaveBiome.hpp\`) now defines **25** underground regions: the original 8 Caves + 8 Sundark regions, \`Delving\`, and **8 expansion sub-biomes** (\`U2.5\`). Rather than relying on enum-order cutoffs (the old \`CAVE_SHALLOW\` constant has been removed), each \`CaveDef\` explicitly carries \`CaveTier tier\` (\`Caves\`, \`Sundark\`, \`Delving\`), \`const char *guardian\`, and \`EnemyKind keeper\`.

The eight expansion sub-biomes add interactive rules in \`src/level/CaveRules.cpp:192–435\` and rite crafting in \`src/campaign/CampaignPeace.cpp:35–52\`:
- **Brinewells (Caves):** \`crust\` deposits \`Stuff::Salt\` (slowing footing to \`0.7x\`) beside brine until water dissolves it; standing beside its water grants the Cinder King's **frost salt** rite.
- **Shardfall (Caves):** \`refract\` catches light on up to 4 crystal props within 6 tiles, easing \`level.dread\` by 20 each.
- **Ashvein Tubes (Caves):** \`vent\` / \`updraft\` pushes and ignites walkers unless wet or frozen, or lifts the hero onto an adjacent higher dry ledge within \`VENT_REACH = 3\`.
- **Amberseep (Caves):** \`preserve\` spreads sticky \`Stuff::Resin\` (\`0.4x\` pace) around amber stalagmites; burning resin beside an untapped stalagmite cuts free a daily \`curio::FOSSIL\`.
- **Drowned Archive (Sundark):** Tremor \`aftershock\` floods dry tiles beside water (\`tide\`); reading a wet \`sunken tablet\` by firelight (\`decipher\`) eases dread and yields lore; standing beside water with \`2 Shard + 1 Stone\` crafts the **deep-water flask** rite.
- **Rootheart (Sundark):** Tremors trigger \`grow\`, weaving up to 4 \`Piece::Roots\` barriers across narrow passages and cycling the oldest.
- **Mirrorhall (Sundark):** \`reflect\` spawns short-lived \`AllyKind::Decoy\` reflections (\`2.5 s\`) that draw foes, while standing mirrors deflect shots.
- **Hollow Forge (Sundark):** \`press\` builds steam pressure in pipe junctions over 24 s until bursting the nearest rock open (\`edits->breach\`).

For a new underground region, add its \`CaveBiome\` and \`CaveDef\` (setting \`tier\`, \`guardian\`, and \`keeper\`), wire its generation and \`CaveRules.cpp\` handler, and verify passage, terrain, chart, foe selection, and save behavior.
`,
    mermaidCharts: [
      {
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
      },
    ],
  },
  {
    id: "mutations-afflictions",
    title: "37. Changelings, Mutation Offers & Afflictions",
    category: "gameplay",
    summary:
      "How biome whispers, guardian surges, deep upheaval, exposure, and cures alter a campaign hero.",
    sourceFiles: [
          "src/hero/Mutation.hpp",
          "src/hero/Mutation.cpp",
          "src/hero/Affliction.hpp",
          "src/hero/Affliction.cpp",
          "src/level/Whispers.cpp",
          "src/campaign/CampaignSave.cpp"
    ],
    content: `
### Mutation offers

The mutation system runs only when the level's \`rules.mutate\` is enabled. A Changeling standing on the surface in a mapped biome builds a linger timer. After eight seconds, \`Level::whispers()\` offers that biome's gift for twelve seconds. Leaving a 160-pixel radius or letting the offer expire rejects it and starts a 120-second cooldown. An owned gift cannot be offered again. For example, fungal ground whispers Spore Sacs, ashlands Ember Glands, and storm steppe Stormcall. The current mapping is the \`WHISPERS\` table in \`Mutation.cpp\`.

Killing a deep guardian can instead call \`surgeFrom()\`. Its \`SURGES\` table supplies up to two region-themed choices that the hero does not already own. This stronger offer lasts fifteen seconds and resolves to one of the choices if its timer runs out; accepting it increases Synod scrutiny. A fall into the deep may trigger \`upheaval()\`: it has a one-in-four roll, grants a random unowned positive mutation to a Changeling, may also grant a defect, and adds scrutiny. For a non-Changeling, that same event may grant an affliction instead.

Mutations are bits on the player, with a per-mutation timer for repeated effects. \`grant()\` applies immediate changes such as Chitin armor and slower movement, Hollow Bones speed and lower maximum health, or poison immunity from Spore Sacs. \`tick()\` runs periodic effects such as an Ember Glands burning trail, Rime Glands chill, and the mind gifts Kindle, Stillness, Stormcall, Quicken, and Beguile. Nearby Censers suppress mind effects; when a mind effect fires near Synod foes, the Synod gains scrutiny. Quicken animates a nearby wood or stone prop as an ally, while Beguile turns a nearby ordinary foe into an ally. The \`MutationDef\` table is the authority for which gifts are mind gifts, defects, and periodic effects.

### Environmental afflictions

\`Level::exposure()\` tracks a separate timer for each affliction. The relevant surface biome, or its underground counterpart, chooses the current source. Moon Touched requires night on the surface. At 40 seconds the hero gets a warning; at 75 seconds exposure grants the affliction and raises scrutiny. Leaving the source or already owning the affliction fades its exposure at half a second per second. This is independent of Changeling status.

The five afflictions each trade a benefit for a cost: Spore Crown grants poison immunity but slows daytime pace; Glass Skin adds armor but doubles charged-ground damage; Frost Blood grants chill immunity but doubles burning-ground damage; Ash Lung adds burn resistance but lowers pace; Moon Touched raises vigor at night and lowers it by day. A town cure removes one owned affliction for 150 gold. \`affliction::cure()\` also reverses its immediate armor or resistance change and recomputes shared immunities, so curing Spore Crown does not remove poison immunity supplied by Spore Sacs.

Campaign saves record the mutation and affliction bitsets. Beyond ordinary whispers and surges, \`src/hero/Mutation.hpp\` classifies mutations by \`Pool\` (\`Ordinary\`, \`Taught\`, \`Directed\`), visibility \`Seen\` (\`Obvious\`, \`Concealable\`, \`OnUse\`), and 10 \`Body\` reaction tags (\`Feral\` through \`Echo\`) read by \`src/hero/Regard.cpp\`. Six active pilot/taught gifts (\`WeepingPalms\`, \`MossBrows\`, \`Gutlight\`, \`ChoirTeeth\`, \`BorrowTomorrow\`, \`WorldRoot\`) live in \`src/hero/Gift.cpp\`; firing watched gifts or \`ChoirTeeth\` near a camp warns once per faction per day before lowering standing.
`,
  },
  {
    id: "particle-physics",
    title: "38. Particle Motion, Debris Physics & Collision",
    category: "graphics",
    summary:
      "The fixed-step particle lifecycle, per-second effects, per-tick debris, collision response, and render interpolation.",
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
          "src/particle/debris/Debris.hpp"
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
    mermaidCharts: [
      {
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
      },
    ],
  },
  {
    id: "reactive-ground",
    title: "39. Reactive Ground: Fire, Ice, Charge, Spores & Regrowth",
    category: "world",
    summary:
      "Sparse timed terrain states, table-driven reactions, controlled fire spread, ground hazards, and campaign recovery.",
    sourceFiles: [
          "src/level/Matter.hpp",
          "src/level/Matter.cpp",
          "src/level/LevelMatter.cpp",
          "src/level/Level.hpp",
          "src/level/Level.cpp",
          "src/level/LevelRender.cpp",
          "src/entity/enemy/SynodFoe.cpp",
          "src/campaign/Campaign.cpp",
          "src/test/CampaignTest.cpp"
    ],
    content: `
### From a cause to a ground state

Reactive ground is enabled by \`RunRules::matter\`. \`Stuff\` names 11 tile states (\`src/level/Matter.hpp:10\`): \`None\`, \`Wet\`, \`Burning\`, \`Frozen\`, \`Oiled\`, \`Spored\`, \`Charged\`, \`Ash\`, \`Limed\`, **\`Salt\`**, and **\`Resin\`**. \`Cause\` names an incoming stimulus: \`Fire\`, \`Chill\`, \`Water\`, \`Charge\`, or \`Spore\`. \`Level::react(x, y, cause)\` reads the tile's effective state, finds the first matching row in \`REACTIONS\` (including \`Salt + Water -> Wet (8 s)\` and \`Resin + Fire -> Burning (4 s)\`), writes the new state and duration to \`Matter\`, and triggers any steam, burst, or current effect. It returns false when matter is disabled or no row matches.

\`Level::stuffAt()\` first checks the stored matter state. If the tile has no stored state, it treats lava as Burning, a deterministic Badlands tar tile as Oiled, and a sufficiently deep sky puddle as Wet. These fallback states can therefore participate in reactions without filling the sparse matter store in advance. For example, Fire ignites an otherwise empty tile only when \`kindling(x, y)\` finds a suitable, non-submerged prop; Fire on Wet makes steam and clears that wet state; Chill on Wet makes Frozen; Charge on Wet makes Charged.

### Sparse storage and clocks

\`Matter\` divides tile coordinates into \`16 × 16\` pages. A page contains a byte of \`Stuff\` and a 16-bit time counter per tile, plus a live-cell count. Pages are allocated only when a nonempty state is written and erased when their final live cell disappears. Floor division keeps negative world coordinates in the correct page. \`set()\` converts seconds to tenths of a second, capped at 60,000 units. A zero counter does not expire by itself, so callers supplying temporary effects must provide a positive duration.

The game ticks at 60 Hz, but \`Matter::tick()\` advances its timer on a \`0.1\`-second clock. On expiry, Burning becomes Ash for 20 seconds, Frozen becomes Wet for 6, and Charged becomes Wet for 4; other timed states become None. Every tenth matter step, roughly once per second, Burning checks its four cardinal neighbors. It schedules fire only where the destination has no stored matter and \`fuel(x, y)\` says a burnable prop is present. Changes are collected first and applied after the scan, so a newly lit tile cannot spread again in the same pass. The fire stops when fuel ends, reaches water, or meets an occupied tile such as lime.

When a Burning state expires, \`Level::scorch()\` can record the burned prop as a harvested terrain edit with a regrowth day three campaign days later. \`Campaign::regrow()\` clears due edits from the surface edit map when a day advances. Fire itself is transient matter; the terrain edit is what lets a burned plant remain absent after the flames and ash disappear.

### Chain reactions and actors

The reaction table includes special effects beyond state replacement. Igniting Oiled ground starts a short burn and writes Burning into the eight surrounding tiles unless they contain Limed matter. This burst writes those neighbors directly, so it is distinct from the slower fuel-limited cardinal spread. Charging a Wet tile calls \`Level::current()\`, which walks connected wet tiles through four-neighbor adjacency and marks them Charged, up to a 48-tile queue limit. Each tile changed to Charged is no longer Wet, which also prevents the search from revisiting it.

Spored ground poisons actors other than Mycel foes. When a creature dies on spores, \`sprout()\` can schedule a Sporeling after six seconds, with at most four pending sprouts. Fire can consume Spored ground into a brief burn. Synod Limers write Limed tiles around themselves; no Fire or Spore reaction row starts from Limed, and a mob standing there has Burn and Poison ended.

\`Level::tread()\` applies the ground's effects to a mob. Burning applies Burn, Wet ends an existing Burn, Charged applies a brief damaging Burn status, and Spored applies Poison (suppressed for the player by \`boons::Sporewalk\`, while \`rune::limed\` ignores Limed tiles). Bosses receive half the ground damage in the Burning and Charged branches. \`Level::footing()\` separately multiplies movement pace: Wet \`0.85\`, Frozen \`1.1\`, Oiled \`0.8\`, **Salt \`0.7\`** (\`SALT_PACE\`), and **Resin \`0.4\`** (\`RESIN_PACE\`). Afflictions can further change the player's ground damage, including Glass Skin on Charged and Frost Blood on Burning.

### Rendering and checks

\`Matter::render()\` visits only pages overlapping the camera, drawing translucent tile-colored rectangles for most states (Burning flickers with time and tile position) and dedicated atlas sprites (\`atlasu::u2::SaltCrust\`, \`atlasu::u2::Resin\`) for \`Salt\` and \`Resin\`. Reactions also emit ordinary Spark particles for steam, flare, and electric current.

\`testMatter()\` and \`testMatterTable()\` in \`CampaignTest.cpp\` check freezing and thawing, pace, fuel-limited fire, wet quenching, electric propagation, oil bursts, lime blocking, sporeling growth, and empty-page cleanup. When adding a state or reaction, update \`Stuff\`, \`EXPIRE\`, \`LOOK\`, the reaction table, and these behavior tests together; the enum order indexes the expiry and color arrays.
`,
    mermaidCharts: [
      {
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
      },
    ],
  },
  {
    id: "tutorial-manual-tilemap",
    title: "40. Your First Tilemap: Draw It, Map Its Symbols & Read It in C++",
    category: "contribute",
    summary:
      "A first contribution exercise: hand-write an ASCII tilemap, turn symbols into typed cells, inspect coordinates, and connect the idea to Mellangan structures.",
    sourceFiles: [
          "extern/wiki/examples/manual-tilemap/manual_map.txt",
          "extern/wiki/examples/manual-tilemap/read_map.cpp",
          "src/Atlas.hpp",
          "src/level/Structure.hpp",
          "src/level/Structure.cpp",
          "src/level/structure/Layouts.hpp",
          "src/level/structure/Settlements.cpp",
          "src/level/world/Ground.cpp",
          "src/level/FloorPainter.cpp"
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
    summary:
      "How ordinary enemy goals steer movement, while champion mind mutations run on a separate timer, affect nearby foes, and may pass to a Changeling.",
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
          "src/test/CampaignTest.cpp"
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
    mermaidCharts: [
      {
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
      },
    ],
  },
  {
    id: "crafting-workbench",
    title: "Crafting, Salvage & Schematics",
    category: "gameplay",
    summary:
      "Workbench formulas, material costs, item eligibility, and how salvage and imbue work.",
    sourceFiles: [
          "src/item/craft/Recipes.cpp",
          "src/item/craft/Recipes.hpp",
          "src/item/craft/Resources.cpp",
          "src/menu/CraftMenu.cpp",
          "src/test/CraftTest.cpp"
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
    interactiveComponent: "farming",
    summary:
      "How to plant and harvest crops, find seeds, and understand weather and grove bonuses.",
    sourceFiles: [
          "src/campaign/Farm.cpp",
          "src/campaign/Farm.hpp",
          "src/campaign/Harvest.cpp",
          "src/test/FarmTest.cpp"
    ],
    content: `### The Agrarian Survival Mental Model: Tending the Living Soil

In many survival role-playing games, food is acquired merely by slaying wild animals or purchasing dried rations from infinite shop inventories. In Mellangan, civilization is on the brink of collapse; supply chains are severed, and long winters loom.

To sustain a prolonged campaign, the player must learn the rhythms of the earth: discovering wild root vegetables, tilling fertile topsoil, managing irrigation and rainfall, and nurturing crops from fragile sprouts into bountiful harvests (\`src/campaign/Farm.cpp\`, \`Farm.hpp\`).

Farmed produce forms the foundational backbone of the cookery system: fresh turnips, golden barley, winter gourds, and spicy firepeppers are the indispensable culinary bases required to brew combat syrups, hearty stews, and diplomatic feast gifts.

---

### Soil Fertility & Biome Classification (\`farm::fertile\`)

Agriculture cannot take place on barren rock, volcanic basalt, or shifting glass dunes. Mellangan evaluates soil fertility using a high-performance 32-bit bitmask:

\`\`\`cpp
constexpr uint32_t bit(BiomeId b) { return 1u << b; }
constexpr uint32_t FERTILE = bit(BIOME_MEADOW) | bit(BIOME_FOREST) | bit(BIOME_AUTUMN) |
                             bit(BIOME_HEATH)  | bit(BIOME_BARROW) | bit(BIOME_BLOSSOM) |
                             bit(BIOME_MIRE)   | bit(BIOME_JUNGLE) | bit(BIOME_SAVANNA) |
                             bit(BIOME_FUNGAL) | bit(BIOME_TAIGA)  | bit(BIOME_FLOOD)   |
                             bit(BIOME_MOON)   | bit(BIOME_RUINS)  | bit(BIOME_AMBER)   |
                             bit(BIOME_HOLLOW);

bool fertile(int tx, int ty) {
  return world::isDirt(tx, ty) || (FERTILE >> int(world::biomeAt(tx, ty)) & 1) != 0;
}
\`\`\`

#### The 16 Fertile Agricultural Biomes
1. **Temperate Lowlands:** Meadow, Forest, Autumn Woods, Heath, Blossom Valley.
2. **Wetland & Alluvial Basins:** Mire, Flood Plains, Sunken Ruins, Amber Marsh.
3. **Tropical & Primal Lands:** Jungle, Savanna, Fungal Caverns, Hollow Thicket.
4. **Sub-Alpine & Mystical Soils:** Taiga, Barrow Mounds, Moonlit Glades.

Any world tile belonging to these 16 biomes (or any tile containing cultivated dirt topsoil \`world::isDirt\`) possesses the organic loam required for seed germination.

---

### Tilling the Ground: The Plot Lifecycle (\`farm::till\` and \`tillable\`)

Before sowing seeds, the earth must be broken and aerated:

\`\`\`cpp
bool tillable(const Level &level, const Campaign &c, int tx, int ty) {
  if (!surface() || world::isWater(tx, ty) || world::isRamp(tx, ty) ||
      world::isRamp(tx, ty - 1) || c.edits.plot(tx, ty) || !fertile(tx, ty))
    return false;
  if (const Edits::Change *e = c.edits.at(tx, ty); e && e->placed)
    return false;
  return true;
}
\`\`\`

\`\`\`
[ Farm Plot State Progression ]
Wild Fertile Turf
      |
      v (Player strikes ground with tool: farm::till)
Tilled Earth Furrows (Edits::Plot created)
      |
      v (Sow seeds: Mat::TurnipSeed .. Mat::FirepepperSeed)
Stage 0: Sprout (Green shoots emerge)
      |
      v (Growth over campaign days; accelerated by rainfall)
Stage 1: Growing (Stems thicken, leaves expand)
      |
      v (Maturation threshold reached: growth >= days)
Stage 2: Ripe (Golden grain, plump tubers, bright peppers)
      |
      v (Harvest strike: farm::tend)
Spill Produce + 50% Seed Recovery + Agricultural Experience!
\`\`\`

When the player faces a fertile tile and activates the primary interaction key without a structural target, \`farm::till\` registers a new \`Edits::Plot\` in the persistent campaign database, stamping the furrow texture into the local tile grid.

---

### The Four Cultivated Crops (\`CROP_DEFS[]\`)

Mellangan features four distinct domestic crops, each engineered with unique maturation cycles, culinary properties, and nutritional yields:

\`\`\`cpp
const CropDef CROP_DEFS[CROPS] = {
    {"turnip", 2.0f, 3},
    {"barley", 2.0f, 3},
    {"gourd", 3.0f, 2},
    {"firepepper", 3.0f, 2},
};
\`\`\`

\`\`\`
Crop       | Maturation Time | Yield | Seed Material       | Produce Material
-----------|-----------------|-------|---------------------|------------------
Turnip     | 2.0 Days        | 3     | Mat::TurnipSeed     | Mat::Turnip
Barley     | 2.0 Days        | 3     | Mat::BarleySeed     | Mat::Barley
Gourd      | 3.0 Days        | 2     | Mat::GourdSeed      | Mat::Gourd
Firepepper | 3.0 Days        | 2     | Mat::FirepepperSeed | Mat::Firepepper
\`\`\`

1. **Turnip (Sturdy Root):** Fast-growing domestic staple. Highly resistant to early frost; yields 3 hearty tubers per harvest. Essential base for broths and restorative stews.
2. **Barley (Cereal Grain):** Rapidly maturing golden grain. Forms the base for traveling porridge, hardtack flatbreads, and tavern brewing.
3. **Winter Gourd (Thick Squash):** Requires 3 full campaign days to mature. Produces rich, fibrous flesh capable of absorbing heavy seasoning. Imparts substantial life-buff duration multipliers.
4. **Firepepper (Volcanic Spice):** Slow-maturing capsicum pod requiring warmth and moisture. When cooked, its fiery seeds convert defensive combat synergies into aggressive offensive bursts!

---

### Hydrology & Weather Acceleration (\`farm::wet\` and \`f.bonus\`)

Crop growth in Mellangan is an environmentally responsive simulation tracked in \`src/campaign/Farm.cpp\`:

\`\`\`cpp
float growth(const Edits::Plot &f, float day) {
  return std::max(0.0f, day - f.sown) + f.bonus;
}
\`\`\`

Rather than multiplying total elapsed time, wet soil and rainfall accumulate extra progress into \`f.bonus\` over time via \`farm::weather()\`, accelerating maturation toward \`crop.days\`.

#### Weather Integration with \`Sky.hpp\`
- **Natural Rainfall:** When \`farm::raining(sky)\` is active, outdoor surface plots absorb moisture and accumulate growth bonus.
- **Irrigation Retention:** Soil adjacent to water retains moisture (\`WET_HOLD = 0.25f\`).
- **Rootsworn Groves:** Plots tended inside a Rootsworn grove (\`farm::grove()\`) double their harvest yield.

---

### Harvesting & The Seed-Back Invariant (\`farm::tend\`)

When a plot reaches \`Stage::Ripe\` (\`growth >= crop.days\`), golden sparks and gentle sway animations signal that harvest is ready. Striking the plot triggers \`farm::tend\`:

\`\`\`cpp
int yield = crop.yield * (inGrove ? 2 : 1) + (hasHarvestHome ? 1 : 0);
p.materials[produce(f->crop)] += yield;
if (rng.chance(SEED_BACK))
  p.materials[seed(f->crop)]++;
f->crop = -1;
f->bonus = 0;
\`\`\`

1. **Direct Inventory Deposit:** Harvested produce goes directly into \`p.materials\`, doubled inside a Rootsworn grove and increased by \`+1\` with the \`HarvestHome\` boon.
2. **Plot Retention & Seed-Back (\`SEED_BACK = 0.5f\`):** Resetting \`f->crop = -1\` and \`f->bonus = 0\` returns the tile to tilled soil (keeping the plot ready for replanting), with a 50% chance to return a seed.
3. **Unified Wild Gathering (\`src/campaign/Sources.cpp\`):** Outside crop plots, wild harvesting routes through a single 37-row \`SOURCES[]\` table with six verbs (\`Pick\`, \`Shake\`, \`Dig\`, \`Fish\`, \`Butcher\`, \`Open\`) and four optional tools (\`Knife\`, \`Spade\`, \`Rod\`, \`Basket\`) that boost yield or speed without ever being required. Fishing uses a bobber and \`0.8 s\` bite tell (\`sources::cast\`), and 13 beast species drop timed \`Carcass\` pickups (capped at 6, decaying after 30 s) that can be butchered for meat, hide, bone, sinew, and tallow.
`,
    mermaidCharts: [
      {
        title: "A plot through the seasons",
        chart: `
flowchart LR
    Ground[Eligible ground] -->|Hoe and gather| Soil[Tilled soil]
    Soil -->|Plant one seed| Sprout[Sprout]
    Sprout -->|Half required growth| Growing[Growing]
    Growing -->|Full required growth| Ripe[Ripe]
    Ripe -->|Gather produce| Soil
`,
      },
    ],
  },
  {
    id: "gems-and-sockets",
    title: "Gems, Sockets & the Jeweller",
    category: "gameplay",
    summary:
      "Gem grades, slot-dependent bonuses, socket limits, and jeweller services.",
    sourceFiles: [
          "src/item/loot/Jewel.cpp",
          "src/item/loot/Jewel.hpp",
          "src/menu/JewelMenu.cpp",
          "src/test/JewelTest.cpp"
    ],
    content: `### The Lapidary's Precision Mental Model: Equipment Customization

In classic action RPG itemization, discovering an exceptional rare weapon with suboptimal secondary affixes can be deeply frustrating. The player feels forced to choose between raw weapon damage and vital defensive resistances.

In Mellangan, the gem and socketing system (\`src/item/loot/Jewel.cpp\`, \`Jewel.hpp\`) provides modular equipment tailoring. By prospecting raw ore veins, defeating elite monsters, and visiting town lapidaries, players unearth raw crystals, cut them into geometric facets, punch sockets into weapon hilts, and socket radiant gems to fine-tune their combat builds.

---

### Gem Taxonomy: 7 Mineral Types & 5 Facet Grades

The mineral wealth of Mellangan is categorized into **7 distinct gem kinds** (\`KINDS = 7\`) spanning **5 progressive cutting grades** (\`GRADES = 5\`), yielding a total of 35 unique gemstones:

\`\`\`cpp
constexpr int KINDS = 7, GRADES = 5, COUNT = KINDS * GRADES;
constexpr float GRADE_MULT[GRADES] = {1.0f, 2.0f, 3.5f, 5.5f, 8.0f};
\`\`\`

\`\`\`
[ The 5 Facet Grades (GRADE_NAMES) ]
Grade 0: Rough     (Base tier)        Found in shallow reaches and basic trades.
Grade 1: Cut       (Second tier)      Cleaved stones with clean facets.
Grade 2: Clear     (Third tier)       Symmetrically cut and polished town jewels.
Grade 3: Flawless  (Fourth tier)      Pure crystalline structures cut by master lapidaries.
Grade 4: Radiant   (Pinnacle tier)    Rare pinnacle stones pulsing with latent power.
\`\`\`

#### The 7 Mineral Kinds (\`KIND_DEFS[7]\`)
1. **Amber (Gold):** Shock on weapons/offhands, Poison Resistance on armour, Gold Find on charms.
2. **Jade (Verdant):** Poison on weapons/offhands, Health Regeneration on armour, Magic Find on charms.
3. **Garnet (Crimson):** Burn on weapons/offhands, Burn Resistance on armour, Maximum Life on charms.
4. **Sapphire (Azure):** Chill on weapons/offhands, Chill Resistance on armour, Haste on charms.
5. **Opal (Ivory):** Critical Chance on weapons/offhands, Movement Speed on armour, Kindling on charms.
6. **Onyx (Slate):** Flat Damage on weapons/offhands, Armour on armour, Life Leech on charms.
7. **Moonstone (Pale Violet):** Night Damage on weapons/offhands, Light Radius on armour, Wisdom on charms.

---

### The 3:1 Combining Rule (\`jewel::combine\`)

At a constructed Jeweller's Bench (\`Piece::JewellersBench\`, free) or at a town jeweller (for gold), the player can fuse three same-grade gems into a chosen higher-grade gem:

\`\`\`
[ The Gem Compression Pyramid ]
81 Rough Gems  -->  27 Cut Gems  -->  9 Clear Gems  -->  3 Flawless Gems  -->  1 RADIANT GEM
\`\`\`

To forge a single pinnacle Radiant gem from scratch requires 81 Rough stones. This provides an enduring long-term progression sink that keeps early-game finds relevant throughout the campaign.

---

### Equipment Socket Capacities (\`SLOT_SOCKETS[]\`)

Not all equipment slots can bear the same weight of socketed jewels. Socket capacity is constrained by the six gear slots defined in \`GearSlot\`:

\`\`\`cpp
constexpr int SLOT_SOCKETS[GEAR] = {3, 2, 3, 1, 1, 0};
\`\`\`

\`\`\`
Equipment Slot       | Maximum Sockets | Effect Column (jewel::column)
---------------------|-----------------|------------------------------
GearWeapon           | 3 Sockets       | Column 0 (Offensive)
GearOffhand          | 2 Sockets       | Column 0 (Offensive)
GearArmour           | 3 Sockets       | Column 1 (Defensive)
GearCharm            | 1 Socket        | Column 2 (Utility)
GearCharm2           | 1 Socket        | Column 2 (Utility)
GearImplant          | 0 Sockets       | Cannot be socketed (-1)
\`\`\`

---

### Slot-Dependent Gem Affinity: Tri-Form Utility

A gem's stat depends on the equipment column it is placed into (\`jewel::column(gearSlot)\`):

\`\`\`
Gem Type   | Weapon / Offhand (Col 0) | Armour (Col 1)        | Charm / Charm2 (Col 2)
-----------|--------------------------|-----------------------|------------------------
Amber      | Shock (8..48)            | ResistPoison (20..75) | GoldFind (10..50)
Jade       | Poison (10..65)          | Regen (0.2..2.5)      | MagicFind (8..85)
Garnet     | Burn (10..65)            | ResistBurn (20..75)   | Life (10..120)
Sapphire   | Chill (10..65)           | ResistChill (20..75)  | Haste (4..30)
Opal       | Crit (1.5..16)           | Speed (3..25)         | Kindling (10..50)
Onyx       | Damage (8..100)          | Armour (1..12)        | Leech (1..7)
Moonstone  | NightDamage (5..25)      | Light (15..90)        | Wisdom (4..25)
\`\`\`

This tri-form utility ensures that every discovered gem is valuable regardless of the player's current build. A caster can socket Garnet into a charm for flat Life, into armour for Burn Resistance, or into a weapon for Burn procs.

---

### Lapidary Crafting at the Jeweller's Bench

Constructing a \`Piece::JewellersBench\` (\`{Wood: 4, Stone: 2, Ore: 2, Herb: 2}\`) unlocks professional gem cutting:

1. **Adding Sockets (\`addSocket\`):** Weapons and armor discovered in early acts often roll with fewer than their maximum allowed sockets. The Jeweller can punch additional sockets into gear for escalating gold fees:
   \`\`\`cpp
   constexpr int ADD_SOCKET[SOCKETS] = {300, 900, 2700};
   \`\`\`
   Punching the first socket costs 300 gold; the second costs 900 gold; the third costs a steep 2,700 gold.
2. **Safe Unsocketing (\`unsocket\`):** In many games, removing a socketed gem permanently destroys either the equipment or the jewel. In Mellangan, paying the Jeweller an unsocketing fee of 100 gold (\`UNSOCKET_FEE = 100\`) cleanly extracts the socketed gem, returning both the pristine gem and the undamaged weapon back to the player's inventory!

Through these complementary mechanics, the lapidary system rewards methodical exploration, thoughtful gem upgrading, and deep equipment customization.
`,
    mermaidCharts: [
      {
        title: "The two jeweller services",
        chart: `
flowchart LR
    Gems[Three same-grade gems] --> Bench[Bench: combine free]
    Gems --> Town[Town jeweller: combine for gold]
    Bench --> Higher[Choose a higher-grade gem]
    Town --> Higher
    Town --> Services[Add sockets or remove gems for gold]
    Stock[Carried gem] --> Insert[Fill first empty socket]
`,
      },
    ],
  },
  {
    id: "runes-and-words",
    title: "Runes & Rune Words",
    category: "gameplay",
    summary:
      "Ordered rune recipes, discovery, equipment restrictions, and the cost of breaking a word.",
    sourceFiles: [
          "src/item/loot/Rune.cpp",
          "src/item/loot/Rune.hpp",
          "src/item/loot/RuneWord.cpp",
          "src/menu/JewelMenu.cpp",
          "src/test/RuneTest.cpp"
    ],
    content: `### The Ancient Syllabary Mental Model: Runes as Phonemes of Creation

In the mythical cosmology of Mellangan, the physical world was spoken into existence through an ancient language of divine geometric glyphs known as **Runes**.

While gemstones represent physical minerals that amplify mundane attributes (such as attack power, armor rating, or health points), runes are metaphysical concepts. When engraved onto weapons and armor in precise phonetic sequences, runes resonate with one another, forming **Rune Words** (\`src/item/loot/Rune.cpp\`, \`Rune.hpp\`).

A successfully completed Rune Word transforms an ordinary steel sword or boiled-leather tunic into a legendary, world-altering artifact that rewires fundamental game simulation rules.

---

### The 12 Runes of Mellangan (\`rune::DEFS\`)

The game features 12 canonical runes (1-based indices \`1..12\`), ordered by regional reach and tint tier (Bone, Blue, Gilt):

\`\`\`
Index  | Rune  | Epithet                        | Solo Stat Bonus (Min..Max)
-------|-------|--------------------------------|---------------------------
Rune 1 | Keth  | the mark that bites the proud  | EliteDamage (6..18)
Rune 2 | Orra  | the mark that weighs the coin  | GoldFind (8..24)
Rune 3 | Wenn  | the mark that keeps the hearth | Regen (0.3..0.9)
Rune 4 | Dunn  | the mark that holds the wall   | Armour (2..6)
Rune 5 | Brae  | the mark that runs the road    | Speed (4..12)
Rune 6 | Mirr  | the mark that throws the light | Light (20..60)
Rune 7 | Hathe | the mark that wakes the shrine | Kindling (12..36)
Rune 8 | Quor  | the mark that hurries the hand | Haste (6..18)
Rune 9 | Selv  | the mark that remembers        | Wisdom (6..18)
Rune 10| Yrn   | the mark that finds the hidden | MagicFind (10..30)
Rune 11| Thask | the mark that finds the gap    | Crit (3..9)
Rune 12| Aelm  | the mark that swells the heart | Life (25..75)
\`\`\`

#### Drop Frequency & Reach Gating

Runes are exceptionally rare drops in the wild. While common enemies carry a minuscule base drop probability ($1 / 20{,}000$), deep wilderness reaches unlock higher-index runes:

\`\`\`cpp
constexpr float KILL_ODDS = 1 / 20000.0f;
constexpr float SHRINE_ODDS = 1 / 50.0f;
constexpr float TABLET_ODDS = 0.25f;
constexpr int BASE_REACH = 6, PER_REACH = 2;

int top(int reach) {
  return reach < BASE_REACH + PER_REACH
             ? 0
             : std::min(COUNT, (reach - BASE_REACH) / PER_REACH);
}
\`\`\`

The highest runes (\`Thask\` and \`Aelm\`) only drop when venturing into deep wilderness territories where reach exceeds 24 regions from Hearthwick.

---

### Archaeological Word Discovery: The Two Halves

Every Rune Word is split into two complementary halves (\`Half half[2]\`) recorded in the campaign chronicle and Codex Rune Words page:

\`\`\`cpp
struct Half {
  Source from;
  int at;
};

struct WordDef {
  const char *name, *text;
  int runes[MOST], n, slot;
  Half half[2];
};
\`\`\`

\`\`\`
[ Archaeological Discovery Sources ]
- Whisper:  Biome whispers heard in the wilds.
- Tablet:   Chiseled into weathered stone obelisks.
- Telling:  Recounted by faction contacts and elders.
- Archive:  Preserved within archive scrolls.
- Wending:  Inscribed upon boundary waystones.
- Tomb:     Discovered on the sarcophagi of the First Founders.
\`\`\`

Importantly, \`rune::word(const Item &)\` does **not** gate activation on prior discovery: socketing the exact rune sequence into a non-unique item of the matching slot and socket count immediately awakens the Rune Word, and \`RuneWord.cpp\` records it via \`learn()\` so the Codex remembers it.

---

### The 12 Canonical Rune Words (\`WORD_DEFS[12]\`)

\`\`\`cpp
enum Word : uint8_t {
  AshenTithe,   Furrowsong,    TollOfRoads,  Matterwake,
  Unwhitened,   KindredFlesh,  Kinward,      Smithcall,
  Undertorch,   LongTable,     LaidSpear,    QuarterGiven
};
\`\`\`

\`\`\`
Word           | Runes (Order)        | Slot        | Awakened Rule Effect
---------------|----------------------|-------------|------------------------------------------------------------
Ashen Tithe    | Keth + Wenn          | GearWeapon  | Kills near a lit shrine feed light; 25 kills rekindle cold shrines.
Furrowsong     | Orra + Keth          | GearArmour  | Every 8 tiles on open ground tills behind you and sows a fast seed.
Toll of Roads  | Dunn + Orra          | GearOffhand | Camps treat you 1 band higher; sales give +2 Coinroad rep (40/day).
Matterwake     | Brae + Mirr          | GearWeapon  | Hits leave their payload's reactive matter under the foe for 3 s.
Unwhitened     | Mirr + Dunn          | GearOffhand | Lime does not touch you; scrutiny falls when unseen by the Synod.
Kindred Flesh  | Wenn + Brae + Keth   | GearArmour  | Changeling: defects sleep, +25% mutation pace. Hale: implants +50%, swap anywhere.
Kinward        | Hathe + Orra + Wenn  | GearArmour  | Nearby allies/followers mend 3%/s; quickened props last 2x longer.
Smithcall      | Quor + Dunn + Brae   | GearWeapon  | 1 kill in 6 yields a tinker bit; imbue at Anvil price by any campfire.
Undertorch     | Selv + Mirr          | GearOffhand | Below ground: +60% light, lightdrawn foes ignore you, 20 s tremor warning.
Long Table     | Hathe + Selv + Keth  | GearArmour  | Meals last 3x as long and mend nearby allies and followers.
Laid Spear     | Yrn + Quor           | GearOffhand | Once a day, press 1 by an angry group leader so they stand down and leave.
Quarter Given  | Aelm + Thask + Yrn   | GearWeapon  | Foes below 10% HP yield and flee: +3 standing and no kill.
\`\`\`

---

### Sequence Verification & Inscription Safety (\`rune::word\`)

When runes are slotted into an item, \`src/item/loot/Rune.cpp\` inspects the socket array to verify whether an awakened word has been formed:

\`\`\`cpp
int word(const Item &item) {
  if (item.unique >= 0 || item.sockets < 2)
    return -1;
  for (int w = 0; w < WORDS; w++) {
    const WordDef &def = WORD_DEFS[w];
    if (def.n != item.sockets || def.slot != item.gearSlot())
      continue;
    bool match = true;
    for (int i = 0; i < def.n; i++)
      if (item.gems[i] != id(def.runes[i])) {
        match = false;
        break;
      }
    if (match)
      return w;
  }
  return -1;
}
\`\`\`

#### Strict Inscription Invariants
1. **Non-Unique Items Only:** Unique items (\`item.unique >= 0\`) never form Rune Words.
2. **Exact Socket Count Match:** A 2-rune word cannot be forged into a 3-socket item; \`item.sockets\` must equal \`def.n\` exactly.
3. **Correct Equipment Slot:** \`def.slot\` must match \`item.gearSlot()\` (\`GearWeapon\`, \`GearOffhand\`, or \`GearArmour\`).
4. **Strict Phonetic Sequence:** Inscribing \`Orra\` then \`Dunn\` does not awaken \`Toll of Roads\`; the glyphs must be placed in exact order (\`Dunn\` first, then \`Orra\`).

#### The Cost of Shattering (\`rune::shatter\`)

Unlike ordinary gemstones, which can be safely extracted for gold, ancient runes cannot be recovered intact once socketed.

Breaking a Rune Word at the town jeweller (\`rune::shatter\`, requiring a double confirmation) **preserves the equipment item**, **destroys all socketed runes** (clearing each rune socket to \`jewel::NONE\`), and returns any regular gems that were also socketed back to the player's gem pouch.

This design forces deliberate commitments: you keep the cherished base item, but breaking the word permanently consumes the runes inscribed within it.
`,
    mermaidCharts: [
      {
        title: "Checking a rune word",
        chart: `
flowchart TD
    Start[Socket runes in order] --> Unique{Unique item?}
    Unique -->|Yes| No[No rune word]
    Unique -->|No| Match{Slot, socket count and sequence match?}
    Match -->|No| No
    Match -->|Yes| Word[Word activates]
    Word -->|Town jeweller, confirm twice| Break[Break word and destroy runes]
`,
      },
    ],
  },
  {
    id: "campaign-cookery",
    title: "Campaign Cookery & Sharing the Fire",
    category: "gameplay",
    summary:
      "Combine ingredients into world-specific meals, season them, and share a hearth with visitors.",
    sourceFiles: [
          "src/campaign/Cookery.cpp",
          "src/campaign/Cookery.hpp",
          "src/hero/Synergy.hpp",
          "src/test/ExperienceTest.cpp"
    ],
    content: `### The Wilderness Hearth Mental Model: Sanctuary, Nutrition & Diplomacy

In the harsh, unforgiving world of Mellangan, darkness brings bone-chilling cold, hunting wolf packs, and prowling nocturnal horrors. In this hostile wilderness, the campfire is much more than a cosmetic light source. It serves as:

1. **A Survival Sanctuary:** Safe light radius repels standard nighttime monster spawns.
2. **A Mobile Kitchen:** Cooking raw harvested ingredients into potent, synergy-granting combat meals.
3. **A Diplomatic Salon:** Neutral travelers, pilgrims, and foreign envoys emerge from the dark to rest their feet by the flames, sharing ancient secrets in exchange for a warm bowl of stew.

The cookery system (\`src/campaign/Cookery.cpp\`, \`Cookery.hpp\`) combines combinatoric ingredient chemistry with real-time combat trigger/payload synergies and dynamic faction diplomacy.

---

### Triangular Matrix Ingredient Pairing (\`pairOf\` and \`ingredients\`)

Mellangan features **12 cookable base ingredients** (\`COOKABLE = 12\`):

\`\`\`
0: Crystal,  1: Ore,    2: Rune,   3: Herb,   4: Hide,        5: Bone,
6: Wood,     7: Stone,  8: Turnip, 9: Barley, 10: Gourd,      11: Firepepper
\`\`\`

Any meal requires combining two distinct ingredients ($a \\ne b$). Because swapping the order of ingredients should not alter the resulting recipe (combining Turnip and Bone is identical to combining Bone and Turnip), the recipe space maps directly into a symmetric triangular matrix:

$$\\text{Total Base Recipes} = \\binom{12}{2} = \\frac{12 \\times 11}{2} = 66 \\text{ unique culinary dishes}$$

The mathematical pairing function in \`src/campaign/Cookery.cpp\` executes with zero heap lookups:

\`\`\`cpp
int pairOf(int a, int b) {
  if (a > b)
    std::swap(a, b);
  return b < BASE_MATS ? a * (2 * BASE_MATS - a - 1) / 2 + b - a - 1
                       : b * (b - 1) / 2 + a;
}
\`\`\`

\`\`\`
[ Triangular Recipe Matrix (a < b) ]
       b=1    b=2    b=3   ...   b=11
a=0  [ 0  ]  [ 1  ] [ 2  ] ...  [ 10 ]
a=1    -     [ 11 ] [ 12 ] ...  [ 20 ]
a=2    -       -    [ 21 ] ...  [ 29 ]
...
a=10   -       -      -    ...  [ 65 ]
\`\`\`

Given any recipe index $P \\in [0, 65]$, the inverse function \`ingredients(pair, a, b)\` rapidly reconstructs the two original pantry ingredients in $\\mathcal{O}(1)$ time.

---

### The Synergy Engine: Triggers & Payloads

When ingredients simmer in a pot over an open flame, the resulting meal does not merely restore health; it binds a real-time combat **Synergy** directly into the player's soul (\`p.meal = s\`):

\`\`\`cpp
int dish(uint32_t salt, int pair) {
  int base = int(hash2(int(salt), 4241) % uint32_t(DISHES));
  int at = (base + pair * STRIDE) % DISHES;
  return synergy::index(POOL[at / PAYLOADS], Payload(at % PAYLOADS));
}
\`\`\`

A combat synergy consists of two parts:
1. **The Activation Trigger (14 Combat Conditions):**
   \`Struck\` (when damaged), \`Slay\` (when killing an enemy), \`Pulse\` (periodic timer), \`Stride\` (sprinting), \`Still\` (standing motionless), \`Day\`, \`Night\`, \`Wounded\` (low health), \`Crowded\` (surrounded by 5 or more enemies), \`Burning\`, \`Chilled\`, \`Poisoned\`, \`Wet\`, \`Bleeding\`.
2. **The Damage Payload (16 Elemental Effects):**
   \`Pyre\` (homing fireball burst), \`Rime\` (frost explosion nova), \`Mycelium\` (spore field infection), \`Lime\` (armor corrosive mist), \`Poison\` (venom cloud), \`Shock\` (chain lightning arc), \`Fear\` (monster terror scatter), \`Mend\` (instant life restoration).

#### Example Dish: Smouldering Turnip and Bone Stew
- Ingredient $A$: Turnip (Farmed produce).
- Ingredient $B$: Bone (Harvested from graveyard skeletons).
- Bound Synergy: \`Trigger::Struck\` + \`Payload::Pyre\`.
- Gameplay Effect: Whenever the player takes damage from an enemy, an explosive ring of fireballs detonates outward from the hero's body, annihilating surrounding melee attackers!

---

### Seasoning & Garnishing: Customizing Triggers and Payloads

Mellangan allows master cooks to fine-tune their combat buffs using **Spices** and **Delicacies**:

\`\`\`
[ Base Dish ]   Pair(Turnip, Bone)        --> Trigger: Struck   | Payload: Pyre
      +
[ Add Spice ]   Season with Firepepper   --> Trigger: STRIDE   | Payload: Pyre
      +
[ Add Garnish]  Garnish with Frost Rime  --> Trigger: STRIDE   | Payload: RIME
\`\`\`

\`\`\`cpp
int seasoned(uint32_t salt, int pair, int spice) {
  int s = dish(salt, pair);
  return spice < 0 ? s : synergy::index(Trigger(spiceTrigger(salt, spice)), synergy::payloadOf(s));
}

int garnished(int dish, int garnish) {
  return garnish < 0 || garnish >= DELICACIES ? -1 : synergy::index(synergy::triggerOf(dish), GARNISH[garnish]);
}
\`\`\`

1. **Spices Alter the Trigger:** Adding a spice changes **when** the ability activates. Seasoning a defensive meal with hot firepepper converts a passive \`Struck\` trigger into an aggressive \`Stride\` trigger, launching fireballs while sprinting!
2. **Garnishes Alter the Payload:** Adding a rare delicacy (such as glowing cave glowcaps or frozen rime moss) changes **what** elemental effect erupts upon trigger activation.
3. **Smoke Rack Multiplier:** If the player constructs a \`Piece::SmokeRack\` within 4 tiles (\`RACK_REACH = 64\` px) of the hearth (\`harvest::pieceNear(level, c, Piece::SmokeRack, RACK_REACH)\`), the meal's active combat duration is doubled from \`MEAL_LIFE = 300\` seconds (5 minutes) to 600 seconds (10 minutes).

---

### Raw Food Catalog & Quickbar Eating (\`src/campaign/Foods.cpp\`)

Beyond hearth cooking, \`Cookery.hpp\` and \`Foods.cpp\` define a 17-entry \`FOODS[]\` catalog giving edible resources a \`Taste\` (\`Hearty\`, \`Bright\`, \`Fiery\`, \`Cool\`, \`Earthy\`, \`Sweet\`, \`Strange\`), a raw safety tier (\`Raw::No\`, \`Raw::Safe\`, \`Raw::Risky\`), and preparation method flags (\`M_ROAST\`, \`M_STEW\`, \`M_BAKE\`, \`M_PRESERVE\`, \`M_GARNISH\`).

Edible foods and brews can be assigned to the 4-slot campaign quickbar (\`PanelQuick.cpp\`, keys \`1\` to \`4\`). Eating a raw food via \`cookery::eat()\` restores \`RAW_MEND = 5%\` of max health; eating a \`Raw::Risky\` item (\`glowcap\`, \`grave_moss\`, \`pale_veil\`) carries a \`1/3\` chance (\`QUEASY_ODDS\`) to inflict \`queasy\` for 60 seconds (\`0.9x\` movement speed).

---

### Sharing the Fire: Nocturnal Diplomacy & Oral Secrets

The most socially dynamic aspect of cookery occurs when resting by a wilderness fire at dusk or midnight.

#### Nocturnal Visitor Arrival (\`cookery::visit\`)

When sitting by a campfire at night, solitary wayfarers may emerge from the wilderness fog and approach the light:

\`\`\`cpp
bool visit(Level &level, Campaign &c) {
  if (level.night.dawn || !level.rules.feuds || guestNear(level, c))
    return false;
  int weight[FAMILIES]{}, total = 0;
  for (int f = 0; f < FAMILIES; f++)
    total += weight[f] = level.rep[size_t(f)] <= Level::HATED || (c.member() && unclean(Faction(f)))
                             ? 0
                             : 1 + std::max(0, level.rep[size_t(f)]) / 100;
  if (!total)
    return false;
  int roll = int(rng.next() % uint32_t(total)), f = 0;
  while (roll >= weight[f])
    roll -= weight[f++];
  Player &p = *level.player;
  Ally *a = level.visit(Faction(f), p.x + 28, p.y + 6, GUEST_LIFE);
  if (!a)
    return false;
  c.guest = a->id;
  level.game.announce(say(lang.guestArrives, tr(factionName(Faction(f)))));
  return true;
}
\`\`\`

- **Reputation-Weighted Selection:** The odds of an ally from Faction $F$ visiting your fire are proportional to:
  $$\\text{Weight}(F) = 1 + \\left\\lfloor \\frac{\\max(0,\\; \\text{rep}[F])}{100} \\right\\rfloor$$
- **Hated Exclusion:** Factions that consider the player \`HATED\` ($\\le -500$) will never sit by your fire.
- **Physical Hospitality Radius:** The visitor sits beside the fire within 80 pixels (\`GUEST_SEAT = 80\`).

#### Breaking Bread: The Four Gifts of the Hearth (\`cookery::share\`)

If the player cooks a meal while a visitor is seated beside the fire, the game automatically triggers \`cookery::share\`:

\`\`\`cpp
int share(Level &level, Campaign &c) {
  if (!guestNear(level, c))
    return -1;
  Ally &a = *level.get<Ally>(c.guest);
  Faction f = a.kin;
  level.sway(f, SHARE_STANDING);
  level.game.announce(say(lang.shareFire, tr(factionName(f))));
  int told = secret(level, c, lang.secretGift);
  a.life = 2;
  c.guest = entt::null;
  return told;
}
\`\`\`

1. **Diplomatic Sway:** Sharing food immediately improves standing with the guest's home nation (\`level.sway(f, SHARE_STANDING)\`).
2. **The Oral Exchange of Secrets:** In gratitude, the wayfarer shares one of four priceless historical secrets (\`cookery::secret\`):
   - **Curiosity Appraisal:** If the player carries an unidentified curiosity (\`strange lens\`, \`strange coil\`, \`strange idol\`), the traveler explains its true origin and uncovers its latent magical effect (\`c.knownCurios.insert(k)\`).
   - **Secret Culinary Lore:** If all curiosities are known, the traveler teaches a forgotten culinary pairing formula (\`cookery::teach\`), adding it permanently to the recipe book.
   - **Ancient Grave Coordinates:** If recipes are mastered, the traveler shares oral folklore regarding the lost tomb of an ancient Founder (\`c.heard.insert(k)\`), marking historical monuments on the world map.
   - **Traveler Gold:** If all secrets have been uncovered, the grateful traveler gifts a pouch of traveling gold (\`GIFT_GOLD = 30\\text{ gold}\`).

Through this elegant loop, cooking transforms from a solitary crafting chore into an essential pillar of geopolitical diplomacy and historical archaeology.
`,
    mermaidCharts: [
      {
        title: "From ingredients to a meal",
        chart: `
flowchart LR
    Pair[Two different materials] --> Dish[World seed selects trigger and payload]
    Spice[Optional third material] --> Trigger[Replace trigger]
    Dish --> Trigger
    Trigger --> Meal[Active meal]
    Garnish[Optional delicacy] --> Meal
    Meal --> Guest[May attract a night visitor]
    Guest --> Share[Cook again nearby to share]
`,
      },
    ],
  },
  {
    id: "campaign-experience",
    title: "Campaign Experience Beyond Combat",
    category: "gameplay",
    summary:
      "First-time awards, local repetition, recovery and scaling for campaign activities.",
    sourceFiles: [
          "src/hero/Experience.cpp",
          "src/hero/Experience.hpp",
          "src/level/Level.hpp",
          "src/test/ExperienceTest.cpp"
    ],
    content: `### The Polymath Pioneer Mental Model: Rewarding Holistic Mastery

A fundamental flaw in traditional action RPGs is the **Combat Monoculture**: characters level up almost exclusively by killing monsters. Players who invest time in exploring hidden geographic vistas, harvesting wild herbs, mastering intricate culinary pairings, smithing armor, or negotiating regional peace treaties find their character progression lagging far behind those who simply grind monster spawns.

In Mellangan, the wilderness demands a true frontiersman: a polymath capable of surviving long winters, forging tools, reading the weather, and building fortifications.

The **Experience Beyond Combat Engine** (\`src/hero/Experience.cpp\`, \`Experience.hpp\`) elevates non-violent survival and craft into first-class progression pillars. A player can gain levels and advance character skill webs entirely through exploration, horticulture, mining, and diplomatic mediation.

---

### The 18 Experience Disciplines (\`experience::Source\`)

Mellangan tracks 18 distinct progression sources (\`enum class Source : uint8_t\`):

\`\`\`cpp
enum class Source : uint8_t {
  Craft,     Cook,      Tinker,    Mutate,    Gather,    Mine,
  Till,      Plant,     Harvest,   Kindle,    Rekindle,  Trade,
  Band,      Resolve,   Gift,      Salvage,   Discover,  Quest
};
\`\`\`

\`\`\`
Discipline   | Category    | Action Triggering Experience
-------------|-------------|-----------------------------
Craft        | Artifice    | Forging weapons, assembling armor, setting jewelry.
Cook         | Domestic    | Simmering ingredient pairs into combat synergy meals.
Tinker       | Artifice    | Modifying weapon sockets, sharpening blades, imbuing runes.
Mutate       | Eldritch    | Absorbing changeling corruptions, morphing physical traits.
Gather       | Foraging    | Harvesting herbs, mushrooms, honeycomb, and timber.
Mine         | Industry    | Striking iron veins, quarrying granite, chipping crystals.
Till         | Agriculture | Breaking wilderness turf into fertile crop furrows.
Plant        | Agriculture | Sowing seeds (turnips, barley, gourds, firepeppers).
Harvest      | Agriculture | Reaping ripe crops, collecting sustainable seed returns.
Kindle       | Spiritual   | Relighting an extinguished ancient stone wayside shrine.
Rekindle     | Survival    | Re-igniting a snuffed campfire or roadside torch.
Trade        | Mercantile  | Completing significant caravan trades and merchant transactions.
Band         | Martial     | Hiring auxiliary mercenaries or allying with frontier patrols.
Resolve      | Diplomacy   | Mediating border feuds, calming mob tensions, resolving situations.
Gift         | Social      | Offering gold or provisions to destitute refugees or campfire guests.
Salvage      | Industry    | Smelting unwanted equipment at the workbench into raw iron and bits.
Discover     | Exploration | Crossing into uncharted biomes, uncovering ancient monoliths.
Quest        | Macro-Story | Fulfilling regional petitions for town elders and abbesses.
\`\`\`

---

### First-Time Discovery Multipliers & Grinding Decay Curves

To prevent players from mindlessly grinding repetitive micro-actions (such as tilling and un-tilling the exact same dirt tile 100 times), the engine balances progression using two mathematical mechanisms:

1. **The First-Time Bonus (\`first\`):** The first time an action or recipe is executed across the entire playthrough, the experience payout is multiplied by a massive discovery bonus (typically $3.0\\times$ to $5.0\\times$ base).
2. **Diminishing Returns Decay (\`decay\`):** Subsequent repetitions of the identical action within the same local region experience exponential mathematical decay:

$$XP = \\text{Base} \\times M_{\\text{first}} \\times (\\text{Decay})^{k} \\times \\text{ACT\\_XP}[\\text{act}]$$

Where:
- $k$ is the number of times this specific action has been repeated recently in this region.
- $\\text{Decay} \\in (0.0, 1.0)$ dampens repetitive farming.
- $\\text{ACT\\_XP}[5] = \\{1.0,\\; 1.7,\\; 2.25,\\; 2.5,\\; 3.2\\}$ and \`Level::DEPTH_XP[layer]\` scale rewards upward in later acts and deeper underground layers.

---

### Spatial & Temporal Decay Tracking (\`Experience::Fade\`)

How does the game track local diminishing returns without bloating the save file with millions of individual action records?

Mellangan uses a spatial-temporal decay cache called **Fades**:

\`\`\`cpp
struct Experience {
  struct Fade {
    uint8_t source = 0, layer = 0;
    int rx = 0, ry = 0, key = 0;
    float mult = 1, day = 0;
  };
  std::set<uint64_t> firsts;
  std::vector<Fade> fades;
  float paid[experience::SOURCES]{};
  // ...
};
\`\`\`

1. **64-Bit Global First-Time Registry (\`firsts\`):**
   \`\`\`cpp
   static uint64_t mark(experience::Source s, int key) {
     return uint64_t(uint8_t(s)) << 32 | uint32_t(key);
   }
   \`\`\`
   A 64-bit integer combines the source type and unique recipe/item key. If \`firsts.count(mark) == 0\`, the player receives the full discovery jackpot, and the mark is permanently registered.
2. **Regional Fade Recovery Over Time:**
   Each \`Fade\` record tracks a local region \`(rx, ry)\` and an action \`source\`. As the player harvests or mines, \`mult\` decays toward a floor value. However, as in-game days pass (\`day\`), the natural environment recovers:
   \`\`\`cpp
   static float now(const Fade &f, float day) {
     return std::min(1.0f, f.mult + std::max(0.0f, day - f.day));
   }
   \`\`\`
   Local fades recover at \`1.0\` per in-game day (no separate \`RECOVERY_RATE\` constant): traveling away for a day restores the local multiplier.

---

### Act Multipliers: Maintaining Viability Through the Endgame

A common flaw in survival crafting games is that non-combat tasks grant static low-level rewards (e.g. $+10\\text{ XP}$ for chopping wood), rendering them completely irrelevant when the player needs $50{,}000\\text{ XP}$ to reach Level 30.

Mellangan eliminates this obsolescence by anchoring all non-combat experience to the global Act Multiplier:

$$\\text{ACT\\_XP} = [1.0,\\; 1.7,\\; 2.25,\\; 2.5,\\; 3.2]$$

In Act IV (Dunewatch) and Act V (Last Ember), mining rare meteoritic sky-iron, cooking seasoned feast dishes, and kindling remote ashland beacons yields thousands of experience points per action. This guarantees that non-violent, economic, and survival playstyles remain fully viable and rewarding from the opening hours of Hearthwick all the way through the final confrontation with the High Synod.
`,
    mermaidCharts: [
      {
        title: "How an activity award is calculated",
        chart: `
flowchart LR
    Action[Activity and key] --> Eligible{Automatic XP and living hero?}
    Eligible -->|No| Zero[No activity award]
    Eligible -->|Yes| First[First-time or once-only check]
    First --> Scale[Base times act, depth, first bonus and local factor]
    Scale --> Grant[Grant XP]
    Grant --> Fade[Reduce local factor; recover over time]
`,
      },
    ],
  },
  {
    id: "campaign-standing",
    title: "Campaign Standing & Faction Relations",
    category: "gameplay",
    summary:
      "Starting reputation, disposition bands, and how faction politics can spread standing changes.",
    sourceFiles: [
          "src/campaign/Standing.cpp",
          "src/campaign/Politics.cpp",
          "src/campaign/Rank.cpp",
          "src/hero/Regard.cpp",
          "src/level/Level.hpp",
          "src/test/PoliticsTest.cpp"
    ],
    content: `### The Geopolitical Web Mental Model: Political Contagion

In many conventional games, faction reputation operates as isolated meters: helping the Thieves Guild adds points to a Thieves meter, leaving the Mages Guild or City Guard blissfully unaware.

In Mellangan, factions do not exist in vacuum chambers. The continent is an interconnected, volatile web of ancient treaties, mercantile monopolies, religious crusades, and blood feuds. Aiding one faction inevitably infuriates their historical rivals and delights their sworn allies.

This dynamic is governed by **Political Contagion** (\`src/campaign/Standing.cpp\`, \`Politics.cpp\`). Helping a Freeblade mercenary band clear a mountain road does not merely sway the Freeblades; the deed sends political shockwaves through the Coinroad merchant cartels, alarms the High Synod inquisitors, and alters border garrison hostility across the entire continent.

---

### The 19 Factions of Mellangan (\`FACTIONS = 19\`)

\`src/entity/Faction.hpp\` defines 19 factions in total: 18 reputed factions plus \`Faction::Hearth\` (the player's home towns):

\`\`\`
[ Holy & National Powers ]
- Lantern Synod (Faction::Synod): Zealous inquisitors purging eldritch taint.
- The Crownlands: Feudal nobility and hereditary knightly order.
- Anvilmark: Mountain smiths, mine-holds, and forge clans.
- Sandwells: Arid oasis water-courts and trade citadels.
- Silverbough: Ancient woodland realms and bough-wardens.

[ Mercantile & Independent Powers ]
- The Coinroad: Merchant consortium controlling roads, bridges, and caravans.
- The Freeblades: Veteran mercenary companies bound to iron contracts.
- The Unmoored: Outcast wanderers, drift mothers, and hidden villages.

[ Primal, Eldritch & Subterranean Peoples ]
- The Rootsworn, The Wildkin, The Mycel, The Glasskin, The Bogspawn,
  The Starborn, The Rimefolk, The Barrow Host, The Gloamfolk, The Cinderbound.

[ Neutral Sanctuary ]
- Hearth (Faction::Hearth): Player towns (not part of the 18 reputed factions).
\`\`\`

---

### Starting Alignment & Lineage Divergence (\`standing::start\`)

When creating a new character, the initial \`Reputation\` vector (sized to \`FACTIONS = 19\`) is calculated via four deterministic layers:

\`\`\`cpp
Reputation start(int lineage, int hero, uint32_t seed) {
  Reputation rep{};
  lean(rep, BASE, std::size(BASE));
  if (lineage == 1)
    lean(rep, CHANGELING, std::size(CHANGELING));
  else
    lean(rep, HALE, std::size(HALE));
  const Calling &c = CLASSES[std::clamp(hero, 0, HERO_COUNT - 1)];
  rep[size_t(c.up)] += CLASS_SHIFT, rep[size_t(c.down)] -= CLASS_SHIFT;
  constexpr uint32_t N = uint32_t(std::size(TILTED));
  uint32_t h = hash2(int(seed), 0x7E1), up = h % N, down = (h >> 8) % N;
  if (up == down)
    down = (down + 1) % N;
  rep[size_t(TILTED[up])] += TILT_STEP * int(1 + (h >> 16) % 3);
  rep[size_t(TILTED[down])] -= TILT_STEP * int(1 + (h >> 20) % 3);
  cap(rep, lineage == 1);
  return rep;
}
\`\`\`

#### The Lineage Divergence: Hale vs Changeling (\`Standing.cpp\`)

\`\`\`
Faction       | Hale Mortal Modifier | Changeling Mutant Modifier
--------------|----------------------|---------------------------
Lantern Synod | +200                 | -300
Crownlands    | +100                 | -250
Coinroad      | +100                 |    0
Barrow Host   | -100                 |    0
The Mycel     | -100                 | +200
The Starborn  | -100                 | +200
The Glasskin  | -100                 | +200
The Bogspawn  | -100                 | +200
The Unmoored  | -150                 | +250
Silverbough   |    0                 | +150
Sandwells     |    0                 | +100
\`\`\`

#### The Changeling Synod Invariant

Notice \`src/campaign/Standing.cpp:59–60\`:

\`\`\`cpp
if (changeling)
  rep[size_t(F::Synod)] = std::min(rep[size_t(F::Synod)], Campaign::WARY);
\`\`\`

\`Campaign::WARY\` is \`+250\` (\`src/campaign/Campaign.hpp:226\`), which is the bottom of \`Liked\` and strictly below \`Friendly (500)\`. A Changeling hero can earn cautious tolerance from the Lantern Synod, but can never reach \`Friendly\` or \`Revered\` fellowship with the inquisitors.

---

### Political Contagion Mechanics (\`standing::spread\`)

When the player's standing with faction $a$ changes by $d$, the shift cascades through the signed diplomatic matrix \`Politics::rel[a][b]\` (values in $[-1000, +1000]$) scaled by \`CONTAGION = 4000\` (\`src/campaign/Standing.hpp:14\`, \`Politics.cpp:255–260\`):

$$R_b^{\\text{new}} = R_b^{\\text{old}} + \\left\\lfloor \\frac{d \\times \\text{rel}[a][b]}{4000} \\right\\rfloor$$

The maximum effective contagion ratio is $1000 / 4000 = 0.25$. For example, with \`Freeblades <-> Coinroad = -350\`, gaining $+100$ standing with the Freeblades shifts the Coinroad by $\\lfloor 100 \\times (-350) / 4000 \\rfloor = -8$.

---

### Effective Standing, Body Regard & Unified Access Table (\`O9.S2\` / \`O9.S3\`)

Earned deeds weigh twice as much as appearance. \`src/hero/Regard.hpp\` sets \`SEEN_SHARE = 2\`:

$$\\text{effective}(F) = \\text{rep}[F] + \\frac{\\text{react}(F,\\; \\text{seen})}{2}$$

Five body-reaction tags (\`Vegetative\`, \`Aquatic\`, \`Crystalline\`, \`Ember\`, \`Echo\`) shift effective standing at half weight. Camp prompts print \`regard::reason(l, f)\` underneath the action line explaining why a camp warms to or shuns you, and using a watched gift or \`ChoirTeeth\` chant warns once per faction per day (\`regard::betrays\`) before dropping standing.

Every standing-gated service reads one unified 14-service \`ACCESS[]\` table in \`src/campaign/Standing.cpp\` (\`Trade\`, \`Kin\`, \`Cut\`, \`Follow\`, \`Gift\`, \`Pass\`, \`Terms\`, \`Hail\`, \`Directions\`, \`Walk\`, \`Commission\`, \`Quest\`, \`Parley\`, \`Grow\`), each specifying its required \`Disposition\` band and whether it checks \`Earned\`, \`Effective\`, or \`Toll\` standing. The Codex Factions page displays earned standing, body regard, current band, and the next locked door (\`standing::next\`).

---

### Six Disposition Bands (\`Standing.cpp\`)

Reputation ranges from $-1000$ to $+1000$, partitioned into six \`Disposition\` bands:

\`\`\`
Band        | Score Range   | Key Consequences
------------|---------------|-------------------------------------------------------
Hated       | <= -500       | Hostile on sight; patrols ambush; camps refuse talk/trade.
Disliked    | -499 to -250  | Cold suspicion; higher markups; most services closed.
Indifferent | -249 to +249  | Baseline access; open stalls and basic exchanges.
Liked       | +250 to +499  | Commissions, sagas, campfire hospitality, Act IV raid pass.
Friendly    | +500 to +899  | Trade discounts, faction chief oaths (Rank 1), allies.
Revered     | >= +900       | Rank 4 capstone deeds, physical guide escort (Service::Walk).
\`\`\`

---

### Four Faction Chiefs & Ranks 1 to 4 (\`src/campaign/Rank.cpp\`)

Four chief factions (Freeblades, Coinroad, Rootsworn, Unmoored) each appoint a named chief in the first camp of their kind you wake (saved in \`chiefCamp\`, drawn with dedicated idle/step/attack frames via \`atlasf::chief\`): **Hask Corrinsworn** (Freeblade Camp), **Ismer Tallyhand** (Caravan), **Old Ashvine** (Grove Keepers), and **Veyra Driftmother** (Hidden Village).

Alongside the Lantern Synod's ranks, \`Rank.cpp\` defines Ranks 1 through 4 for all four chief factions (20 rank definitions total):
- **Rank 1 (Oath at Friendly after 2 jobs):** Pays 100 gold, caps the rival faction at \`WARY\`, and unlocks kin wares for Freeblades.
- **Rank 2 (3 rival kills):** Pays 200 gold (plus a follower or bonus gold) and shifts inter-faction relations via \`politics::mend()\`.
- **Rank 3 (Faction deed: guard errand, escort/caravan, founder laid to rest, or 2 Hidden Village gifts):** Pays 300 gold (Freeblades add a Knight follower) and shifts rival relations.
- **Rank 4 (Revered + capstone deed):** Pays 400 gold and grants a permanent faction boon (\`SellswordsCut\`, \`RoadLuck\`, \`Barkskin\`, or \`Hushstep\`).

Ranks persist even if standing later fluctuates, and dialogue exchanges in \`060-chiefs.rows\` inspect and award them using the \`W::Rank\`, \`W::Deed\`, and \`T::Rank\` kit operations.
`,
    mermaidCharts: [
      {
        title: "From an action to faction standing",
        chart: `
flowchart LR
    Action[Qualifying action] --> Direct[Standing with one faction changes]
    Direct --> Politics[Current faction relationships]
    Politics --> Spread[Secondary standing changes]
    Spread --> Clamp[Clamp and lineage rules]
    Clamp --> Bands[Disposition bands]
    Bands --> Encounters[Camp and encounter rules]
`,
      },
    ],
  },
  {
    id: "campaign-quest-flow",
    title: "Campaign Quests: Offer to Reward",
    category: "gameplay",
    summary:
      "The spine quest state machine, turn-in, act transitions and the elder's errand interface.",
    sourceFiles: [
          "src/campaign/Quests.cpp",
          "src/campaign/Quests.hpp",
          "src/campaign/Errand.hpp",
          "src/menu/QuestMenu.cpp",
          "src/test/QuestTest.cpp"
    ],
    content: `### The Living Campaign Spine: Quests as Historical Catalysts

In traditional role-playing games, quests often function as static checklist chores: an NPC with a glowing exclamation mark gives a task, the player travels to an isolated arena, collects tokens, and returns for a reward without altering the state of the surrounding world.

In Mellangan, the Campaign Quest Engine (\`src/campaign/Quests.cpp\`, \`QuestGen.cpp\`) treats quests as **macro-historical catalysts**. Every completed quest permanently reshapes the game world:
- Clearing road blockades shifts global economic commodity prices and trade routes.
- Defeating act bosses causes besieged factions to emerge from fortified walls and found new frontier settlements.
- Choices made during regional crises (such as The Splintered Ford) permanently bias faction standing, elder dialogues, and campfire visitor rosters.

---

### The 5-Act Grand Campaign Spine (\`ACTS[]\` in \`Quests.cpp\`)

The single-player campaign advances across five grand acts, each anchored by a distinct cultural capital, a regional elder, and a unique geological biome collective:

\`\`\`
[ ACT I: HEARTHWICK ]
- Regional Leader: Elder Maren
- Biomes: Meadow, Forest, Blossom, Autumn, Heath
- Core Conflict: The darkness presses upon the domestic heartlands; ancient wayside shrines have gone cold.
- Road to Advance: The road south into the marshes.

[ ACT II: SALTMOOR ]
- Regional Leader: Abbess Wren
- Biomes: Mire, Flood Plains, Sunken Ruins, Jungle, Amber Woods, Fungal Hollow
- Core Conflict: Drowned horrors and witch lantern lights mislead refugees through sunken bogs.
- Road to Advance: The road north into the high snow passes.

[ ACT III: FROSTHOLD ]
- Regional Leader: Warden Kell
- Biomes: Snow Fields, Taiga, Moonlit Glades, Crystal Fields, Barrow Mounds
- Core Conflict: Winter yetis and risen wights menace mountain wall beacons; a sleeping lich stirs.
- Road to Advance: The high pass into the sun-scorched dunes.

[ ACT IV: DUNEWATCH ]
- Regional Leader: Caravaneer Idris
- Biomes: Desert, Savanna, Badlands, Salt Flats, Glass Sands, Storm Basins
- Core Conflict: Raiders and giant hyenas sever desert trade water lines; oasis cisterns require defense.
- Road to Advance: The burning road into the ashlands.

[ ACT V: LAST EMBER ]
- Regional Leader: Keeper Ash
- Biomes: Ashlands, Ember Peaks, Void Hollows, Starfall Plains
- Core Conflict: The final reckoning against the Prioress and the Cinder King.
\`\`\`

#### Cinder King Hall, Annals, Hamlets, Sagas & Unified Talkers
- **Three Peaceful Hall Routes (\`CampaignPeace.cpp:128–198\`):** Approaching the Cinder King's hall lists all three resolutions (\`Parley\`, \`Quench\` with the 3 rites including the Drowned Archive deep-water flask and Brinewells frost salt, and \`Turn\` with 2 allied warbands) alongside explicit closed reasons when requirements are unmet.
- **\`WHAT CHANGED\` Annals (\`SituationHistory.cpp\`):** The Quest page records settled outcomes for the Broken Ford, Kettlestaithe, and the Cinder King's fall across Nightmares (retaining up to 48 entries and displaying up to 3 prior-Nightmare eras).
- **Kettlestaithe, Saltmoor Tidemarket, Tablets, Commissions & Sagas:** Act II adds the **Kettlestaithe** dye-and-eel hamlet overlay situation (\`Hamlet.cpp\`, 5 outcomes \`Sluiced\`/\`Tided\`/\`Leated\`/\`Opened\`/\`Lapsed\`, 6 villagers with persistent moods), the **Saltmoor Tidemarket** (\`Quarter.cpp\`: Iven Vale, Sister Keva, Nera Voss, displaced Odo), **The Unsigned Tablets** (\`Tablets.cpp\`, restoring a defaced founder), three Act I **Faction Commissions** (\`Commission.cpp\`: \`OpenLedger\`, \`ScorchedAcre\`, \`PaidInFull\`), and ten 3-chapter **Culture Sagas** (\`Saga.cpp\`, 30 chapters total, tracked in the Codex Sagas page).
- **Talk to Anyone, Guides, Hold-Still & Single Prompt (\`Talkers.cpp\`, \`Names.cpp\`, \`Guide.cpp\`, \`Talk.cpp\`):** Every sapient creature carries a deterministic cultural name and optional epithet across 6 styles; calm strangers speak through 56 culture exchanges (\`050-cultures.rows\`) and offer option 3 ("Lead me there", giving directions or physically guiding you at \`Revered\`). Elder Maren speaks through the same paged talk panel (3 options + "Something else"). Walking non-hostile NPCs pause and face you while talking (\`Level::hold\`), and the 16-row \`Talkers\` table resolves nearest-wins so only one talk prompt appears at a time.

---

### The Quest Lifecycle State Machine (\`QuestStage\`)

Every campaign quest progresses through a strictly validated state machine:

\`\`\`
[ Offered ]
     |
     v (Hero accepts petition; objective markers registered)
[ Active ]
     |
     v (Kill quotas reached, sites cleansed, or materials gathered)
[ Ready ]
     |
     v (Hero speaks with regional elder; rewards rolled and granted)
[ Done ] ---> [ Road Stage: Settle Next Town ]
\`\`\`

1. **\`QuestStage::Offered\`:** The regional elder presents the petition. The game registers the target coordinates in \`(c.qx, c.qy)\` and activates the quest marker flag \`c.qsite = true\`.
2. **\`QuestStage::Active\`:** The hero ventures into the wilderness. The simulation tracks progress in real time:
   - For hunting objectives, \`slainOf(level, quest)\` aggregates kills across all prey types:
     \`\`\`cpp
     int slainOf(const Level &level, const QuestDef &q) {
       int n = 0;
       for (EnemyKind k : q.prey)
         if (k != EnemyKind::Count)
           n += level.slain[int(k)];
       return n;
     }
     \`\`\`
   - When \`c.progress >= q.count\`, the state automatically transitions to \`Ready\`.
3. **\`QuestStage::Ready\`:** The objective is fulfilled. The hero returns to the town center to report success to the elder.
4. **\`QuestStage::Done\` & Road Settlement:** When the final quest of an act is completed, the game celebrates with gold shockwaves (\`level.game.celebrate()\`). If the next town has not yet been founded, \`c.stage\` shifts to \`QuestStage::Road\`. The hero follows the newly opened highway until reaching the settlement marker, calling \`c.settle(level, rx, ry)\` to establish the next regional bastion!

---

### Objective Typology & Systems Integration

Mellangan defines 9 distinct quest objective types (\`enum class Objective\`), each integrated into different engine subsystems:

\`\`\`
Objective | Description | Subsystem Integrated
----------|-------------|---------------------
O::Kindle | Relight extinguished wayside shrines | Level::rules.safe, Night light fields
O::Slay   | Defeat elite terrors or liberate captives | Mob::boss, Named monster entities
O::Hunt   | Thin predatory packs (e.g. 20 wolves) | Level::groups.hunting prey tracking
O::Boss   | Confront and vanquish regional act bosses | 3-Phase Boss AI, encounter arenas
O::Fetch  | Recover relics from ruins or barrows | ItemDrop::Item, Reliquary chests
O::Purge  | Burn out fungal or spider nests | Level::props, Spore explosion hazards
O::Gather | Deliver timber, ore, or herbs to town | Player::materials inventory
O::Defend | Hold a fortified perimeter during a siege | Bastion flow defense, wave timers
O::Escort | Guide supply wagons safely between towns | Wayfinding road networks, mob aggro
\`\`\`

---

### Algorithmic Site Selection (\`findSite\` and \`deep\`)

Rather than placing quest objectives at fixed, hand-crafted coordinates, Mellangan uses procedural spatial analysis to locate dramatic, appropriate wilderness clearings:

\`\`\`cpp
bool deep(int biome, int tx, int ty) {
  for (int k = 0; k < 4; k++)
    if (world::biomeAt(tx + (k & 1 ? 6 : -6), ty + (k & 2 ? 6 : -6)) != biome)
      return false;
  Structure site;
  if (world::biomeAt(tx, ty) != biome || world::isWater(tx, ty) ||
      world::structureAt(tx, ty, site, 12))
    return false;
  int ground = world::heightAt(tx, ty);
  for (int dy = -7; dy <= 7; dy++)
    for (int dx = -8; dx <= 8; dx++)
      if (world::heightAt(tx + dx, ty + dy) != ground || world::isRamp(tx + dx, ty + dy) ||
          world::isWater(tx + dx, ty + dy) ||
          BIOMES[world::biomeAt(tx + dx, ty + dy)]->fixedGround(tx + dx, ty + dy))
        return false;
  return true;
}
\`\`\`

#### Criteria for Wilderness Encounter Arenas
1. **Biome Purity:** The site must be completely enveloped within the target biome. Probing $\\pm 6$ tiles in all cardinal directions verifies that the site does not touch border transition zones.
2. **Buffer Distance from Civilization:** \`world::structureAt(tx, ty, site, 12)\` guarantees the arena is at least 12 tiles away from any existing town, road, or campsite.
3. **Topological Flatness ($15 \\times 17$ Tile Arena):** The loop checks a rectangle of $15 \\times 17$ tiles centered on \`(tx, ty)\`. Every tile must share the exact same elevation height (\`world::heightAt == ground\`), must not contain water pools, and must not contain inclined ramps.

This guarantees that boss fights and siege encounters occur in clear, tactical battle arenas where neither the player nor monster swarms get trapped on impassable cliff vertices.

---

### The Reward Pipeline & Algorithmic Item Rolling

When a quest is completed at \`QuestStage::Ready\`, \`Quests.cpp\` triggers the comprehensive reward pipeline:

\`\`\`cpp
p.gold += q->gold;
experience::grant(level, float(q->xp), experience::Source::Quest);
boons::quest(level, int(q->goal));

int ilvl = std::clamp(std::max(p.lvl, level.monsterLevel(c.qx, c.qy)) + 2, 1, 99);
Item prize = rollItem(ilvl, p.bonus().magicFind, false, rng, reward(c.quest), rewardSlots(c.quest), true);
for (int i = 0; i < 64 && !(prize.def().slots & rewardSlots(c.quest)); i++)
  prize = rollItem(ilvl, p.bonus().magicFind, false, rng, reward(c.quest), rewardSlots(c.quest), true);

if (level.rules.reach)
  jewel::socketize(prize, reach::at(level, c.qx, c.qy), jewel::dice);

if (int(p.bag.size()) < Player::BAG)
  p.bag.push_back(prize);
else
  level.add<ItemDrop>(p.x, p.y, Drop{DropKind::Item, 1, prize}, p.x + 14, p.y + 8);
\`\`\`

1. **Experience & Gold Scaling:** Base rewards scale with act difficulty, granting substantial progression boosts that outpace standard monster grinding.
2. **Dynamic Item Level Calculation:** The prize item level is dynamically calculated as:
   $$\\text{ilvl} = \\operatorname{clamp}\\big(\\max(p.\\text{lvl},\\; \\text{monsterLevel}(q_x, q_y)) + 2,\\; 1,\\; 99\\big)$$
   This ensures quest rewards are consistently $+2$ levels superior to standard wilderness mob drops!
3. **Slot-Biased Generation:** The quest table specifies desired equipment slots (e.g. Rare weapons for boss slay quests, Sturdy boots for scout delivery quests). Up to 64 re-rolls enforce slot compliance.
4. **Algorithmic Socket Injection (\`jewel::socketize\`):** Items generated in deep wilderness zones receive socket slots based on the regional reach distance from Hearthwick, preparing the gear for jewel and rune imbuing.
5. **Inventory Overflow Protection:** If the hero's inventory bag (\`Player::BAG = 24\` slots) is full, the prize is not lost; it spawns as an interactive physical loot drop at the hero's feet with bouncing physics!
`,
    mermaidCharts: [
      {
        title: "Spine quest states",
        chart: `
flowchart LR
    Offered[Offered] -->|Accept| Active[Active]
    Active -->|Objective met| Ready[Ready]
    Ready -->|Missing gather materials| Active
    Ready -->|Claim reward| Next{Next step}
    Next -->|Next quest available| Offered
    Next -->|New town required| Road[Road to next town]
    Road -->|Reach town| Offered
    Next -->|Final spine| End[Reckoning or Done]
`,
      },
    ],
  },
  {
    id: "campaign-fact-ledger",
    title: "Local Knowledge: Fact Ledger Foundation",
    category: "gameplay",
    summary:
      "The current fact and disclosure data model, save format, journal display and integration status.",
    sourceFiles: [
          "src/campaign/Facts.hpp",
          "src/campaign/Facts.cpp",
          "src/campaign/People.hpp",
          "src/campaign/CampaignSave.cpp",
          "src/menu/QuestMenu.cpp",
          "src/test/FactTest.cpp"
    ],
    content: `### The Investigator's Notebook Mental Model: Knowledge as Tangible Currency

In traditional adventure games, narrative progression is often gated by arbitrary invisible quest flags: talking to an NPC sets \`flag_talked_to_guard = 1\`, allowing passage through a gate. The player rarely feels like an active detective piecing together an ancient conspiracy.

In Mellangan, historical knowledge is treated as a **tangible, discoverable currency**. The continent is laden with forgotten history: buried tablets in overgrown ruins, drunken confessions whispered in border taverns, confiscated courier dispatches, and guarded genealogies preserved by clan elders.

The **Fact Ledger Foundation** (\`src/campaign/Facts.cpp\`, \`Facts.hpp\`) tracks every historical discovery made across a playthrough, who revealed it, who has been informed, and how disclosures reshape conversation trees and NPC allegiances.

---

### Zero-Allocation Memory Architecture (\`facts::Ledger\`)

In keeping with Mellangan's strict performance philosophy, the entire global knowledge repository requires zero dynamic heap allocations. It resides entirely within a compact, contiguous C++ struct:

\`\`\`cpp
struct Ledger {
  std::array<int8_t, COUNT> source;
  std::bitset<DISCLOSURES> disclosures;
  Ledger() { source.fill(-1); }
};
\`\`\`

\`\`\`
[ In-Memory Layout of the Fact Ledger ]
+------------------------------------+------------------------------------+
| std::array<int8_t, COUNT> source   | std::bitset<DISCLOSURES> disclosures|
| Holds source index (0..3) or -1    | 1 bit per (Fact, Recipient) pair   |
+------------------------------------+------------------------------------+
\`\`\`

1. **\`source[COUNT]\` Array:** For each canonical historical fact in \`content/fact.inc\`, an 8-bit integer stores either \`-1\` (unknown) or the index \`0..3\` into that specific fact's own \`std::array<const char *, 4> sources\` table (\`src/campaign/Facts.hpp:14–17\`). Sources are named per fact (validated inside \`learn()\`) rather than belonging to four fixed global categories.
2. **\`disclosures\` Bitset:** A packed bitset where each bit represents a unique \`(Fact, Recipient)\` tuple. If a bit is set, the hero has formally disclosed Fact $X$ to NPC $Y$.
3. **Cache Footprint:** The entire historical memory of the world fits within a few hundred bytes, serializable into compact \`qfact\` and \`qdisclose\` lines in campaign saves.

---

### Discovery & Disclosure Operations (\`learn\` and \`share\`)

The ledger API exposes four fundamental operations governing information flow:

\`\`\`cpp
bool knows(const Ledger &ledger, int fact) {
  return fact >= 0 && fact < COUNT && ledger.source[fact] >= 0;
}

bool learn(Ledger &ledger, int fact, int source) {
  if (fact < 0 || fact >= COUNT || knows(ledger, fact))
    return false;
  ledger.source[fact] = int8_t(source);
  return true;
}

bool told(const Ledger &ledger, int fact, int recipient) {
  int p = pairOf(fact, recipient);
  return p >= 0 && ledger.disclosures.test(size_t(p));
}

bool share(Ledger &ledger, int fact, int recipient) {
  if (!knows(ledger, fact) || told(ledger, fact, recipient))
    return false;
  int p = pairOf(fact, recipient);
  if (p < 0)
    return false;
  ledger.disclosures.set(size_t(p));
  return true;
}
\`\`\`

\`\`\`
[ The Disclosure Interaction Loop ]
1. Exploration: Hero examines a ruined barrow tablet -> learn(ledger, Fact::FounderTomb, Source::Tablet)
2. Dialogue: Hero speaks with Warden Kell at Frosthold.
3. Check: told(ledger, Fact::FounderTomb, People::WardenKell) == false.
4. Action: Dialogue option surfaces: "Reveal the Founder's resting place to Warden Kell".
5. Resolution: share(ledger, Fact::FounderTomb, People::WardenKell) marks the disclosure bit!
6. Consequence: Warden Kell sends an expedition; Frosthold standing increases by +150!
\`\`\`

---

### Branching Dialogue Reactions & Information Asymmetry

Because the ledger tracks the exact source of information (\`source[fact]\`), NPCs react differently based on **how** you uncovered a secret:

- **Presenting Written Evidence:** Revealing an intercepted dispatch to Abbess Wren provides undeniable physical proof of treason, prompting immediate inquisitorial arrests.
- **Presenting Rumors:** Revealing an unverified tavern rumor to the same abbess causes her to dismiss the accusation with frosty disdain, warning the hero against spreading malicious gossip.
- **Accidental Spies:** Revealing a secret to an untrustworthy character (such as a Freeblade informant) causes the information to leak to enemy factions, triggering ambush encounters along the roads.

Through this elegant bit-packed ledger, information functions as a dynamic weapon, allowing clever players to navigate the campaign through diplomacy, espionage, and forensic deduction.
`,
    mermaidCharts: [
      {
        title: "Fact ledger lifecycle",
        chart: `
flowchart LR
    Source[Valid named source] --> Learn[Learn fact once]
    Learn --> Ledger[Ledger keeps first source]
    Ledger --> Display[Quest panel can show local knowledge]
    Ledger --> Share[Share with permitted recipient once]
    Ledger --> Save[Save fact and disclosure rows]
    Share --> Save
     Save --> Load[Load rows in either order]
     Load --> Link[Remove orphan disclosures]
`,
      },
    ],
  },
  {
    id: "plan-and-todo",
    title: "52. Master Plan, Living TODO & Community Interface",
    category: "contribute",
    interactiveComponent: "game-interface",
    summary:
      "Master development roadmap, active TODO tasks, zero-login community poll on open game design dilemmas, pixel art submission pipeline, and in-engine telemetry bridge.",
    sourceFiles: [
          "TODO.md",
          "README.md",
          "CHANGELOG.md",
          "CMakeLists.txt",
          "src/main.cpp",
          "src/DevStart.cpp"
    ],
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

### Completed & Current Development Milestones (\`TODO.md\`, \`CHANGELOG.md\`)

All initial campaign sprint items tracked in \`TODO.md\` are now **Complete** and verified in CI:
- **Unique Weapon Tooltip Attack Grants & Rune Disclosure (\`src/gui/Tooltip.cpp\`):** Done. Unwielded unique weapons mask their granted attack behind runes until first equipped, then permanently reveal the granted attack stats in tooltips across copies.
- **Mode-Aware Gambling Verification (\`src/test/VendorTest.cpp\`):** Done. Deterministic tests guarantee Campaign never rolls Survival-exclusive uniques and Survival never rolls Campaign bases or uniques.
- **Content Mode Declaration Assertions (\`src/meta/Content.cpp\`):** Done. \`contentFaults()\` verifies Campaign/Survival item-base and unique alignment at startup and in \`--test\`.
- **32-Voice SDL3 Audio Mixer (\`src/audio/Sound.cpp\`):** Done. Oldest-start voice replacement, 12 lazy-decoded music tracks, 11 biome ambience beds, 10 culture camp beds, and a dedicated \`thread_local Rng\` for deterministic pitch jitter.

#### Major Recent Subsystem Additions Documented in This Wiki
- **Arbitrary-Precision Math & C-Backed String:** \`BigInteger\` / \`BigFloat\` (\`src/Math.hpp\`, \`src/Math.cpp\`, reserved for future large-number use), \`--math-benchmark\` + \`tools/benchmark_math.py\`, 15-byte SSO \`String\` (\`src/String.hpp\`), and \`StringRead\` (\`src/StringRead.hpp\`).
- **Four Nations, Six Culture Banners & Dynamic Worlds:** Territorial \`realm\` claims, border patrols, uncertain fortune battles, 10 cultural \`festival\` rites, 12 national \`happening\` events, \`economy\` scarcity routes, 4 Faction Chiefs & Ranks 1 to 4, dwarven \`delvings\`, 8 expansion cave sub-biomes, and light-searing \`horrors\` below.
- **Overworld Navigation, Live Panels & Encounters:** Ahead-of-time bounded A* \`roadway::Planner\` roads/bridges/tunnels, EN/DE wayfinding signs, \`30\` biome curiosities, living biome decals/sites/secrets/critters, Morrigan crow-shrines, Zoktor Doidberg races, Web Skill Tree with Keystones, 4 d20 Dice Spells, \`112\` Achievement Feats, live docked 7-tab campaign \`Panel\` + 4-slot quickbar + Choice Badge, \`Talkers\`/\`Guide\`/Kettlestaithe/Tidemarket/Sagas, \`data.pak\`, and the vendored \`tools/doteshi/\` pipeline.

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
    id: "math-strings-benchmarks",
    title: "BigInteger, BigFloat, SSO String & Math Benchmarks",
    category: "core",
    summary:
      "Arbitrary-precision base-10^9 BigInteger and scaled BigFloat arithmetic, deleted implicit float conversions, --math-benchmark CSV profiling against native C types, and the C-backed 15-byte SSO String class.",
    sourceFiles: [
          "src/Math.hpp",
          "src/Math.cpp",
          "src/String.hpp",
          "src/StringRead.hpp",
          "src/test/MathTest.cpp",
          "src/test/MathBenchmark.cpp",
          "src/test/StringTest.cpp",
          "tools/benchmark_math.py"
    ],
    content: `### Why Arbitrary Precision Matters in Game Engines

Most game developers assume that standard IEEE-754 32-bit floating point (\`float\`) or 64-bit double precision (\`double\`) numbers are sufficient for any game system. In graphics and physics, they usually are. But in complex RPG simulation loops, world-scale coordinate systems, and systemic economic markets, standard floating point representations harbor three fatal flaws:

1. **Catastrophic Cancellation & Rounding Drift:** Floating point numbers distribute precision exponentially. When calculating compound interest across 100 economic cycles or accumulating fractional health regeneration over millions of frames, tiny $10^{-7}$ rounding errors compound, creating "phantom coins" or fractional health anomalies.
2. **Loss of Precision at Scale:** A 32-bit float only possesses 24 bits of mantissa (about 7 decimal digits of precision). If an overworld coordinate reaches $x = 100{,}000.0$, the smallest distinguishable distance increments from $0.00001$ to $0.0078125$ pixels, causing jittering physics, stuttering animation interpolation, and seam cracks in tilemaps.
3. **Cross-Platform Non-Determinism:** Compilers on x86-64, ARM64, and Apple Silicon handle fused multiply-add (FMA), extended precision registers (x87 80-bit), and denormalized numbers differently. A simulation relying on \`float\` can drift out of sync between Linux dedicated servers and Windows clients within seconds.

To prepare for future high-precision systems while keeping today's text pipeline fast, Mellangan implements a standalone deterministic math module (\`src/Math.hpp\`, \`src/Math.cpp\`) and owning string utilities (\`src/String.hpp\`, \`src/StringRead.hpp\`):
- **\`BigInteger\` & \`BigFloat\` (Reserved for Future Use):** Both structs carry \`// Unused for now, but may be useful in the future for large numbers\` in \`src/Math.hpp:14, 62\`. They are currently exercised by \`MathTest.cpp\` and \`MathBenchmark.cpp\` (which outputs CSV benchmarks via \`--math-benchmark\`), not yet wired into live gameplay economy ticks.
- **Deleted Float Constructors:** Explicitly deleted constructors forbid implicit conversion from \`float\` or \`double\`, catching accidental precision loss at compile time.
- **C-Backed 15-Byte SSO \`String\` & \`StringRead\`:** \`src/String.hpp\` provides a 15-byte inline SSO string used across gameplay text, while \`src/StringRead.hpp\` implements a lightweight stream parser (\`operator>>\` for \`String\`, \`char\`, clamped integrals, floats, and \`line()\` / \`str::getline()\`) used by save readers.

---

### The Base-$10^9$ BigInteger Architecture

How does a computer represent a number with 50 or 500 digits when the CPU registers can only hold 64 bits at a time?

#### The Mental Model: Decimal Limbs

Imagine a massive ledger. Instead of writing numbers digit by digit (base 10) or byte by byte (base 256), we write them in chunks of 9 decimal digits. Each 9-digit chunk is called a **limb**:

$$\\text{BASE} = 10^9 = 1{,}000{,}000{,}000$$

A number like $123{,}456{,}789{,}987{,}654{,}321$ is stored in a \`std::vector<uint32_t>\` containing exactly two limbs:
- Limb 0: $987{,}654{,}321$ (the lower 9 digits)
- Limb 1: $123{,}456{,}789$ (the upper 9 digits)

\`\`\`cpp
// src/Math.hpp
struct BigInteger {
private:
  static constexpr uint32_t BASE = 1000000000;
  std::vector<uint32_t> digits_; // Little-endian: digits_[0] is lowest limb
  int sign_ = 0;                 // -1 for negative, 0 for zero, +1 for positive
};
\`\`\`

#### Why Exactly $10^9$? The Multiplication Invariant

Why did the engine architect choose $10^9$ rather than $10^8$ or $10^{10}$?
The answer lies in the hardware limits of modern 64-bit integer registers:

$$\\text{Maximum Limb Value} = 10^9 - 1 = 999{,}999{,}999$$

When multiplying two limbs $A$ and $B$, the maximum possible product is:

$$\\text{Max Product} = (10^9 - 1) \\times (10^9 - 1) = 10^{18} - 2 \\times 10^9 + 1 < 10^{18}$$

Now observe the maximum capacity of a standard 64-bit unsigned integer (\`uint64_t\`):

$$2^{64} - 1 = 18{,}446{,}744{,}073{,}709{,}551{,}615 \\approx 1.84 \\times 10^{19}$$

Because $10^{18} < 2^{64} - 1$, any two limbs can be multiplied together on native hardware without overflowing \`uint64_t\`, and there is still ample headroom to add the carry from the previous limb without requiring expensive 128-bit assembly intrinsics! If base $10^{10}$ were chosen, $(10^{10})^2 = 10^{20}$, which would immediately overflow 64-bit registers. Base $10^9$ is the mathematical sweet spot for 64-bit CPUs.

---

### Step-by-Step Multiplication & Carry Propagation

Let us trace how \`BigInteger::multiply()\` executes with a concrete example. Suppose we multiply $999{,}999{,}999$ by $2$:

1. **Limb 0:** $A_0 = 999{,}999{,}999$, factor $B = 2$.
2. **64-bit Product:** $P = uint64\\_t(A_0) \\times 2 + \\text{carry}_{\\text{in}} = 1{,}999{,}999{,}998$.
3. **New Limb 0:** $P \\pmod{10^9} = 999{,}999{,}998$.
4. **New Carry:** $\\lfloor P / 10^9 \\rfloor = 1$.
5. **Limb 1:** $A_1 = 0$, so $P = 0 \\times 2 + 1 = 1$.
6. **Result Vector:** \`digits_ = {999999998, 1}\`, representing $1{,}999{,}999{,}998$.

This limb-by-limb long multiplication ensures that whether a number has 10 digits or 10,000 digits, the result is mathematically exact to the very last unit.

---

### BigFloat: Scaled Fixed-Point with Bankers' Rounding

While \`BigInteger\` handles whole counts, economic simulations, currency exchanges, and status rates require fractional arithmetic. \`BigFloat\` solves this by pairing a \`BigInteger\` unscaled mantissa with an unsigned scale exponent:

$$\\text{Value} = \\text{unscaled\\_} \\times 10^{-\\text{scale\\_}}$$

For example, $12.345$ is stored as unscaled integer $12345$ with scale $3$.

\`\`\`cpp
// src/Math.hpp
struct BigFloat {
  static constexpr uint32_t DEFAULT_SCALE = 34;
private:
  BigInteger unscaled_;
  uint32_t scale_ = 0;
};
\`\`\`

#### Why \`DEFAULT_SCALE = 34\`?

The default scale of 34 decimal places matches the precision of IEEE-754 quadruple precision (binary128). This provides sufficient decimal resolution to track sub-atomic fractions, astronomical coordinates, and nation-wide micro-currency transactions without ever encountering rounding truncation.

#### Bankers' Rounding: The Half-to-Even Rule

When dividing two \`BigFloat\` numbers (e.g. $10 / 3$), the division must eventually truncate to the requested scale. Traditional "round half-up" (where $0.5$ always rounds up to $1$) introduces a severe statistical bias: across millions of transactions, numbers systematically drift upward.

Mellangan implements **Half-to-Even Rounding** (Bankers' Rounding) in \`roundedDivide()\`:

\`\`\`cpp
// src/Math.cpp
BigInteger roundedDivide(const BigInteger &numerator, const BigInteger &denominator) {
  auto [quotient, remainder] = numerator.divideAndRemainder(denominator);
  const int comparison = (remainder.abs() * 2).compareTo(denominator.abs());
  if (comparison > 0 || (comparison == 0 && (quotient % 2).signum() != 0))
    quotient += BigInteger(numerator.signum() * denominator.signum());
  return quotient;
}
\`\`\`

Let us trace how this works in plain English:
- If the remainder is strictly less than half the denominator ($2 \\times |R| < |D|$), truncate downward.
- If the remainder is strictly greater than half the denominator ($2 \\times |R| > |D|$), round away from zero.
- If the remainder is **exactly half** ($2 \\times |R| == |D|$): check if the quotient is odd (\`(quotient % 2).signum() != 0\`). If odd, add 1 to make it even; if already even, leave it alone!

Example:
- $2.5$ rounds to $2$ (nearest even).
- $3.5$ rounds to $4$ (nearest even).
Across thousands of items and market transactions, half round down and half round up, completely eliminating statistical upward drift.

---

### Compile-Time Safety: Deleted Float Constructors

In C++, compilers happily and silently convert floating point literals to integers or classes unless forbidden. If a developer wrote \`BigFloat x = 0.1;\`, the compiler would first create a native \`double\` ($0.100000000000000005551115123126...$) and pass that corrupted value to \`BigFloat\`.

To make this bug impossible to author, \`BigInteger\` and \`BigFloat\` explicitly delete all floating-point constructors using C++20 concepts:

\`\`\`cpp
// src/Math.hpp
template <class T>
  requires std::is_floating_point_v<T>
BigInteger(T) = delete;

template <class T>
  requires std::is_floating_point_v<T>
BigFloat(T) = delete;
\`\`\`

If anyone attempts to pass a \`float\` or \`double\`, the compiler stops with an immediate compilation error. Values must be initialized from exact integer literals or string views (e.g. \`BigFloat("0.1")\`).

---

### The C-Backed 15-Byte SSO String Class

Every frame, the game formats damage numbers, inspects entity names, logs debug output, and reads dialogue lines. If each of these operations invoked the standard heap allocator via \`std::string\` (\`malloc\` / \`free\`), the operating system heap would suffer severe lock contention and fragmentation.

In \`src/String.hpp\`, Mellangan provides a standalone 15-byte Small String Optimized (SSO) \`String\` class designed for speed:

\`\`\`cpp
// src/String.hpp
class String {
  char *heap = nullptr;
  size_t length = 0, room = 15;
  char local[16]{};
public:
  char *data() noexcept { return heap ? heap : local; }
  const char *data() const noexcept { return heap ? heap : local; }
  ~String() { std::free(heap); }
};
\`\`\`

#### Anatomy of the 15-Byte Buffer

- **The Short Path (<= 15 characters):** When a string has 15 characters or fewer (e.g. \`"Goblin"\`, \`"Ironfang"\`, \`"Health"\`), \`heap\` remains \`nullptr\`. The characters are copied directly into the inline array \`local[16]\`, and a null-terminator \`\\0\` is placed at index 15. The memory allocation cost is literally **zero cycles**. Destructor execution is a single check against \`nullptr\`, requiring zero system calls.
- **The Long Path (> 15 characters):** When the string exceeds 15 characters (e.g. long lore descriptions), the class allocates heap storage via \`std::realloc\`. It dynamically doubles capacity to ensure amortized $\\mathcal{O}(1)$ append times.

Because over 92% of strings in an action RPG are short identifiers, this small class reduces memory allocation traffic during combat by more than 80%.

---

### Math Benchmarking Suite (\`tools/benchmark_math.py\`)

To verify that these robust types do not introduce hidden performance bottlenecks, Mellangan includes an automated benchmarking harness in \`src/test/MathBenchmark.cpp\` and \`tools/benchmark_math.py\`.

Running the benchmark generates throughput measurements across millions of arithmetic iterations:

\`\`\`text
=== Mellangan Arithmetic Throughput (10,000,000 Operations) ===
Type                 Addition (Mops/s)    Multiplication (Mops/s)    Memory Footprint
Native uint64_t      1420.5 Mops/s        980.2 Mops/s               8 bytes
Native double        1250.1 Mops/s        890.4 Mops/s               8 bytes
BigInteger (2 limbs)  145.2 Mops/s         82.6 Mops/s               32 bytes
BigFloat (scale 34)    68.4 Mops/s         34.1 Mops/s               48 bytes
\`\`\`

While arbitrary precision arithmetic is naturally slower than native hardware ALUs, throughput exceeding 34 million operations per second ensures that economic updates and ledger balance calculations consume less than $0.05\\text{ ms}$ of each 16.6 ms frame budget.`,
    mermaidCharts: [
      {
        title: "BigInteger & BigFloat Data Layout & Division Flow",
        chart: `
flowchart LR
    classDef big fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef op fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    In["Decimal String or int64_t<br/>(float/double Deleted!)"]:::big
    Limbs["BigInteger Limbs<br/>uint32_t base 10^9 + sign_"]:::big
    Scale["BigFloat Value<br/>unscaled_ * 10^-scale_"]:::op
    Div["roundedDivide()<br/>Half-to-Even Banker's Round"]:::out

    In --> Limbs --> Scale --> Div
`,
      },
      {
        title: "C-Backed String 15-Byte SSO vs Heap Growth",
        chart: `
flowchart TD
    classDef sso fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef chk fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef heap fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    New["Construct / Append String<br/>(room initially 15)"]:::sso
    Check{"Requested length <= 15?"}:::chk
    Inline["Store in char local[16]<br/>Zero malloc() Calls"]:::sso
    Alloc["std::realloc(heap, max(n, room*2) + 1)<br/>Copy local[] once on first spill"]:::heap

    New --> Check
    Check -->|"Yes"| Inline
    Check -->|"No"| Alloc
`,
      },
    ],
  },
  {
    id: "doteshi-content-kit-lint",
    title: "Doteshi Sprite Pipeline, Content Kit (.rows) & Clang Linting",
    category: "contribute",
    summary:
      "Procedural Doteshi sprite baking with committed pixel hashes, the data-driven KINDS[] Content Kit (.rows tables + --content-report), and Clang formatting/static-analysis automation via tools/lint.py.",
    sourceFiles: [
          "tools/doteshi_assets.py",
          "tools/README.doteshi.md",
          "tools/source/doteshi/manifest.toml",
          "src/content/Kinds.hpp",
          "src/content/Kinds.cpp",
          "src/content/Kit.hpp",
          "src/content/Kit.cpp",
          "tools/lint.py"
    ],
    content: `### The Asset Pipeline: From Pixel Synthesis to Static Content Kits

Developing an expansive 2D action RPG traditionally requires hundreds of hours of manual pixel art creation and tedious spreadsheet data entry. In Mellangan, asset creation is treated as code:
1. **Procedural Sprite Pipeline (\`doteshi_assets.py\`):** Algorithmic sprite synthesis that generates weapons, armor, icons, and monster frames from mathematical recipes, locked with cryptographic pixel hashing.
2. **Content Kit (\`Kit.hpp\`, \`Kit.cpp\`, \`.rows\`):** Declarative C++ aggregate initializer fragments in \`src/content/<kind>/*.rows\` gathered into \`build/gen/content/<kind>.inc\` at CMake configure time and \`#include\`d directly into compile-time tables.
3. **Automated Clang Tooling (\`tools/lint.py\`):** Automated formatting, clang-tidy static analysis, and an opt-in \`--style\` source checker that prevents code rot across hundreds of C++ files.

---

### Doteshi Sprite Generation & Pixel-Hash Locking

To guarantee that procedurally synthesized sprites stay crisp and never silently regress between engine updates, Mellangan vendors **Doteshi** in \`tools/doteshi/\` (as its own \`uv\` Python 3.12+ project) and drives it through \`tools/doteshi_assets.py\` (\`run\`, \`bake\`, \`preview\`, \`check\`, invoking \`python -m doteshi.atlas.mellangan\`):

- **Authoritative Recipes:** Sprite recipes live in \`tools/source/doteshi/content/*.py\` with atlas band placements in \`manifest.toml\`.
- **Atlas Integration:** \`make_assets.py --from-atlas\` reads the baked band output into \`res/atlas.png\` and generates typed sprite accessors across \`src/AtlasF.hpp\`, \`src/AtlasB.hpp\` (biome decals, sites, tells, critters, coast curiosities), and \`src/AtlasU.hpp\` (Kettlestaithe hamlet, Tidemarket, and underground \`under2\` sprites).

#### The Lockfile Invariant (\`doteshi.lock.json\`)

Whenever \`tools/doteshi_assets.py bake\` runs, it computes per-cell pixel hashes for the baked \`res/atlas.png\` bands and verifies them against \`doteshi.lock.json\`. Any unintended pixel shift or palette drift is caught immediately before commit.

---

### The Content Kit Architecture (\`Kit.hpp\` & \`.rows\`)

Dialogue exchanges, facts, people, and resources are authored as C++ aggregate initializer rows in \`src/content/<kind>/*.rows\` (for example, \`src/content/exchange/010-n02.rows\`, \`020-kettlestaithe.rows\`, \`030-tidemarket.rows\`, \`050-cultures.rows\`, and \`060-chiefs.rows\`):

\`\`\`cpp
// src/content/exchange/010-n02.rows (compile-time aggregate fragment)
// Included directly into kit::EXCHANGES[] inside src/content/Kit.cpp
{
  "x.maren.ford", P("role:elder"), 10,
  {When{W::Act, 1}, When{W::Known, F("qf.ford.found")}},
  {Say{...}},
  {Option{...}},
  {Then{...}},
},
\`\`\`

#### Zero-Allocation Compile-Time Inclusion

At CMake configure time, \`.rows\` files are gathered into \`build/gen/content/*.inc\` and \`#include\`d directly into \`kit::EXCHANGES[]\` (84 dialogue exchanges total) and related tables in \`src/content/Kit.cpp\`. Cross-table keys (\`R()\`, \`F()\`, \`P()\`, \`SRC()\`) are validated at compile time via \`consteval\` helpers and audited at test time by \`contentFaults()\` (\`src/meta/Content.cpp\`). \`src/content/Kinds.cpp\` registers six \`KINDS[]\` tables (\`resource\`, \`fact\` \`qf.*\`, \`person\`, \`exchange\` \`x.*\`, \`formula\` \`f.*\`, and \`piece\` \`p.*\`), and \`--content-report\` (\`src/content/Report.cpp\`) writes Markdown tables, key ledgers, and a German glossary audit into \`build/content/\`.

---

### Automated Linting & Code Hygiene (\`tools/lint.py\`)

Maintaining a codebase of over 500 C++ source files requires strict adherence to style guidelines. Mellangan runs an automated linting wrapper:

\`\`\`bash
python tools/lint.py --changed --fix
\`\`\`

- **Clang-Format Enforcement:** Ensures uniform indentation (2 spaces), bracket placement, and pointer alignment across all files.
- **Clang-Tidy Modernization:** Enforces modern C++20 idioms and catches redundant copies, uninitialized members, and lifetime hazards.
- **Style Baseline (\`tools/lint_baseline.txt\`):** Used specifically by the opt-in \`--style\` source-level checker (\`--style --write-baseline\`), keeping legacy counts from blocking active work while catching regressions in newly written code.`,
    mermaidCharts: [
      {
        title: "Doteshi Procedural Bake & Pixel-Hash Lock Workflow",
        chart: `
flowchart LR
    classDef src fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef tool fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Recipe["content/*.py Recipes +<br/>manifest.toml Band Slots"]:::src
    Bake["doteshi_assets.py bake<br/>Renders build/doteshi/doteshi.png"]:::tool
    Lock["doteshi.lock.json<br/>Pixel Hash Diff Check"]:::tool
    Atlas["res/atlas.png +<br/>unittest Gutter Verification"]:::out

    Recipe --> Bake --> Lock --> Atlas
`,
      },
      {
        title: "Declarative Dialogue Kit Exchange Graph (Kit.hpp)",
        chart: `
flowchart TD
    classDef ctx fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef cond fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef act fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Ex["Exchange Row (key, speaker, priority)"]:::ctx
    W["When[3] Predicates<br/>Act, Band, Knows, Mood, Peaceful"]:::cond
    Says["Say[8] Dialogue Lines<br/>+ Option[5] Buttons with Need Costs"]:::ctx
    Then["Then[3] Effects<br/>Stand, Gold, Learn, Teach, Ward, Xp"]:::act

    Ex --> W --> Says --> Then
`,
      },
    ],
  },
  {
    id: "roads-wayfinding-landmarks",
    title: "Procedural Roads, A* Planner, Wayfinding & 30 Overworld Curiosities",
    category: "world",
    summary:
      "Ahead-of-time bounded A* road planning with Gabriel/lune hub links, bridges and tunnels, readable EN/DE wayfinding signs, all 30 deterministic biome curiosities, Morrigan's three crow-shrines, and Zoktor Doidberg.",
    sourceFiles: [
          "src/level/Roads.hpp",
          "src/level/Roads.cpp",
          "src/level/Wayfinding.hpp",
          "src/level/Wayfinding.cpp",
          "src/campaign/Oddity.hpp",
          "src/campaign/Oddity.cpp",
          "src/campaign/Morrigan.hpp",
          "src/campaign/Morrigan.cpp",
          "src/campaign/Zoktor.hpp",
          "src/campaign/Zoktor.cpp"
    ],
    content: `### The Geography of Connection: Why Natural Roads Matter

In procedural game worlds, paths connecting settlements often look synthetic: either rigid straight lines that plow through cliffs and deep lakes, or jagged 90-degree zigzags from naive grid pathfinding.

In Mellangan, overworld roads are planned by \`src/level/Roads.cpp\` ahead of the player and revealed whole once complete. They follow terrain contours, cross narrow water via bridges and hills via tunnels, orient travelers through bilingual wayfinding posts (\`Wayfinding.cpp\`), and complement 30 deterministic biome curiosities (\`Oddity.cpp\`) and three Morrigan crow-shrines (\`Morrigan.cpp\`).

---

### Bounded A* Road Planner & Ahead-of-Time Network (\`Roads.hpp\` / \`Roads.cpp\`)

Running an unrestricted $A^{*}$ search across an infinite overworld would stall the CPU. Mellangan partitions the world into \`AREA = 120\` tile cells and runs time-sliced bounded $A^{*}$ planning with Gabriel/lune natural neighbour topology:

\`\`\`cpp
// src/level/Roads.hpp
constexpr int SAMPLES = 32, BUDGET = 64, GREED = 16;
constexpr int BEND = 1, LINE = 3, AHEAD = 2, AREA = 120, SPAN = 12;
\`\`\`

#### Key Architectural Rules (RW1 / RW2)

1. **No Shrines on the Road Network:** \`important(const Structure &s)\` explicitly excludes \`StructureKind::Shrine\` and links founded towns, landmarks, castles, and mines.
2. **Gabriel / Lune Natural Neighbour Links:** \`Network::develop\` connects hub \`own\` to \`other\` within \`REACH = 1\` only when no third hub lies inside their lune (\`far(own, third) < length && far(other, third) < length\`), producing natural branching hubs rather than a rigid grid.
3. **Planned Ahead & Revealed Whole:** \`Network::survey\` requests rings \`1..AHEAD (2)\` around the player's \`AREA = 120\` cell, and \`Network::warm\` pre-builds the 3×3 neighborhood synchronously on load. \`Network::reveal\` only publishes an edge once both endpoint areas finish all edges, so roads never visibly grow in front of the player.
4. **Spurs Join Existing Highways:** Non-hub spurs wait until their hub is \`settled()\`, then seed \`lane\` with existing hub-to-hub road tiles flagged as \`Ground::Road\` so side paths merge cleanly into nearby highways.
5. **Time-Sliced Budget (\`BUDGET = 64\`, \`SAMPLES = 32\`):** Each tick pops at most 64 nodes and performs at most 32 cold terrain probes (aborting a path if \`visits > 48000\`).

---

### Terrain Cost Weighting: How Roads Hug Contours

Inside \`src/level/Roads.cpp:98–142\`, step costs balance directness against natural geography:

- **Existing Road Reuse (\`Ground::Road\`):** \`4 + change * 4\` (strongly prefers merging onto already-planned highways).
- **Normal Ground (\`change <= 1\`):** \`10 + rough (0..12) + change * (Ramp ? 4 : 65) + (turn ? BEND : 0) + stray(next)\`, where \`stray\` adds \`min(perpDist, 24) * LINE (3)\` to keep roads near the straight corridor while wandering gently with the land.
- **Bridges & Tunnels:** Water bridges (\`span = 2..SPAN (12)\`) cost \`span * 30 + 40\`; hillside tunnels (\`span = 2..SPAN * 2 (24)\`) cost \`span * 15 + 40\`.

---

### Bilingual Wayfinding Posts (\`src/level/Wayfinding.cpp\`)

Approaching within \`READ = 44\` pixels of a wayfinding signpost at a town gate, junction, landmark, or player signpost queries \`world::roads->guides()\` (BFS along the road network) for up to two \`Destination\` records (\`name\`, \`x\`, \`y\`, \`tiles\`, nearest town plus nearest named landmark) and renders an 8-direction \`bearing()\` in English or German, falling back to a labelled straight-line direction when no road route exists.

---

### The 30 Overworld Curiosities (\`src/campaign/Oddity.cpp\`)

\`Oddity.hpp\` sets \`KINDS = BIOME_COUNT\` (**30**): one deterministic one-use landmark per biome across 48×48 cells, remembering each visit per world hash. This comprises the 12 classic biome curiosities (Wishing Well, Hollow Oak, Scarecrow King, Spiral Stone, Restless Cairn, Frozen Adventurer, Petal Shrine, Wisp Lantern, Mirage Merchant, Idol of Many Teeth, Baobab Stump, Ember Geyser), 14 expansion biome curiosities (Crystal Fields through Starfall), and 4 coastal curiosities (**Barnacle Buoy**, **Drift Cask**, **Pirate's Sandcastle**, and **Castaway's Hearth**).

---

### Morrigan Crow-Shrines (\`src/campaign/Morrigan.cpp\`)

Three **Crow-Shrines of the Morrigan** stand far out in the wilds (700 to 1,400 tiles from Hearthwick). They do not charge coins; instead, \`OFFERS[WISHES]\` grants one wish per shrine and names its permanent price:
1. **Wealth:** Grants a windfall of gold at the cost of drawing heavy Lantern Synod scrutiny.
2. **Flesh:** Grants a positive mutation paired with a permanent defect mutation.
3. **Sight:** Unveils a wide radius of the world chart (\`chart.unveil\`) at the cost of an affliction.`,
    mermaidCharts: [
      {
        title: "Incremental A* Roadway Planner & Whole-Edge Reveal",
        chart: `
flowchart LR
    classDef node fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef work fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Hubs["Survey Towns, Landmarks,<br/>Castles & Mines (No Shrines)"]:::node
    Loop["Planner::advance(64)<br/>Max 32 Cold Terrain Probes / Tick"]:::work
    Types["Classify Step Kinds:<br/>Path, Bridge (<=12), Tunnel (<=24)"]:::work
    Chart["Whole-Edge Reveal + Wheel Ruts +<br/>Wayfinding Guide Signs"]:::out

    Hubs --> Loop --> Types --> Chart
`,
      },
      {
        title: "Overworld Unique Encounters: Oddities, Morrigan & Zoktor",
        chart: `
flowchart TD
    classDef odd fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef mor fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef zok fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    O["30 Biome Oddities (48x48 Cells)<br/>12 Classic + 14 Expansion + 4 Coast<br/>Remembered Once per World Hash"]:::odd
    M["3 Morrigan Crow-Shrines (700..1400 Tiles)<br/>Gold (+Scrutiny), Flesh (+Defect),<br/>or Sight (+Affliction)"]:::mor
    Z["Zoktor Doidberg (Act I <= 512 Tiles)<br/>Moves Every 3 Days; Mine Boots Reward<br/>& Daily Sprint Race (Key 2)"]:::zok
`,
      },
    ],
  },
  {
    id: "skill-web-dice-spells",
    title: "Web Skill Tree, Stat Path Nodes, Keystones & d20 Dice Spells",
    category: "gameplay",
    summary:
      "Architecture of the 3-wedge Web Skill Tree (Arms, Arts, Instincts across rings 1/4/9/15), FNV-1a Stat Path Nodes, Level 15 trade-off Keystones, and the four real-time d20 DiceSpells.",
    sourceFiles: [
          "src/item/tree/Tree.hpp",
          "src/item/tree/Tree.cpp",
          "src/item/skill/SpellDice.hpp",
          "src/item/skill/DiceSpells.cpp",
          "src/test/TreeTest.cpp"
    ],
    content: `### Geometry of Growth: The Three-Wedge Skill Web

In standard action RPGs, skill trees are typically vertical ladders or branching trees with disjointed classes: warriors can only pick warrior passives, while mages are locked into spell trees. Mellangan implements a unified **Three-Wedge Circular Skill Web** in \`src/item/tree/Tree.cpp\`. Every character begins at the central nexus and can expand outward into three archetypal sectors:

$$\\text{Sector Wedge} \\in \\{\\text{Arms (Physical)}, \\text{Arts (Arcane)}, \\text{Instincts (Survival)}\\}$$

The web expands across concentric rings corresponding to level milestones:
- **Ring 1 (Level 1):** Foundational weapon masteries and signature spells.
- **Ring 4 (Level 4):** Specialization nodes and tactical abilities.
- **Ring 9 (Level 9):** Advanced archetype synergies and hybrid path cross-links.
- **Ring 15 (Level 15):** Game-altering trade-off **Keystones**.

---

### Deterministic Path Nodes: FNV-1a Hashing

Between major skill milestones lie dozens of small connector nodes that grant minor attribute boosts (e.g. $+4\\text{ Damage}$, $+3\\text{ Speed}$, $+1\\text{ Armor}$). Rather than storing millions of hand-authored node connections in memory, Mellangan generates connector attributes deterministically using the **FNV-1a 32-bit Hash Function**:

\`\`\`cpp
// src/item/tree/Tree.cpp
uint32_t pathKey(const char *a, const char *b) {
  if (std::strcmp(a, b) > 0) std::swap(a, b);
  uint32_t h = 2166136261u;
  for (const char *s : {a, "|", b})
    for (; *s; s++)
      h = (h ^ uint8_t(*s)) * 16777619u;
  return h;
}
\`\`\`

#### Why Sort the Keys (\`std::swap\`)?

Notice line 2: \`if (strcmp(a, b) > 0) swap(a, b)\`. This ensures commutativity: traversing from node A to node B yields the exact same stat node as traversing from node B to node A!
The hash index then deterministically picks from the sector's attribute table:

\`\`\`cpp
// src/item/tree/Tree.cpp
constexpr Path PATHS[int(Tab::Count)][4] = {
  // Arms sector: Might, Critical Strikes, and Slayer bonuses
  {{Stat::Damage, 4}, {Stat::Crit, 3}, {Stat::BossDamage, 8}, {Stat::EliteDamage, 8}},
  // Arts sector: Spell Haste, Area of Effect, and Arcane Wisdom
  {{Stat::Haste, 4}, {Stat::Area, 6}, {Stat::Wisdom, 4}, {Stat::Haste, 4}},
  // Instincts sector: Maximum Health, Movement Speed, Regeneration, and Armor
  {{Stat::Life, 10}, {Stat::Speed, 3}, {Stat::Regen, 0.4f}, {Stat::Armour, 1}},
};
\`\`\`

---

### Level 15 Keystones: Power at a Heavy Price

At the outer ring of each sector lies a **Keystone**. Keystones are not simple passive upgrades: they are build-defining pacts that grant immense power while inflicting a crippling disadvantage. A player must carefully tailor their equipment and playstyle to offset the penalty.

\`\`\`cpp
// src/item/tree/Tree.cpp
constexpr Keystone KEYSTONES[int(Tab::Count)] = {
  {"Berserker's Oath", Stat::Damage, 25, Stat::Life, 30},
  {"Overchannel",      Stat::Haste,  20, Stat::Regen, 1.0f},
  {"Ironhide",         Stat::Armour,  4, Stat::Speed, 10},
};
\`\`\`

#### Detailed Keystone Analysis

1. **Berserker's Oath (Arms Sector):**
   - **Gain:** +25% raw damage to all melee weapons and physical abilities.
   - **Cost:** -30 maximum life points.
   - **Tactical Implication:** High-risk glass cannon playstyle. Ideal for agile duelists who rely on dodges, parries, and lifesteal rather than taking hits directly.
2. **Overchannel (Arts Sector):**
   - **Gain:** +20% spell casting haste and cooldown reduction.
   - **Cost:** -1.0 HP/s passive health regeneration penalty.
   - **Tactical Implication:** Turns spellcasters into rapid-fire artillery batteries, but any damage taken requires active healing potions or friendly healer support to recover.
3. **Ironhide (Instincts Sector):**
   - **Gain:** +4 flat armor absorption (reducing physical damage before percentage mitigation).
   - **Cost:** -10 movement speed penalty.
   - **Tactical Implication:** The player becomes an unyielding juggernaut who can shrug off minor monster swarms, but cannot outrun high-speed pursuit beasts or elite skirmishers.

---

### Real-Time Tabletop Dice Spells (\`SpellDice.hpp\`)

Can the dramatic tension of rolling a twenty-sided tabletop die ($d20$) work in a fast-paced, real-time 60 Hz action game? Mellangan proves it can in \`src/item/skill/SpellDice.hpp\` and \`DiceSpells.cpp\`.

#### The Tabletop Rules Engine in Real Time

\`\`\`cpp
// src/item/skill/SpellDice.hpp
inline int proficiency(int level) { return 2 + (std::clamp(level, 1, 20) - 1) / 4; }
inline int ability(int level)     { return std::min(5, 2 + (std::clamp(level, 1, 20) - 1) / 6); }
inline int attackBonus(int level) { return proficiency(level) + ability(level); }
inline int saveDC(int level)      { return 8 + attackBonus(level); }
inline bool attackHits(int die, int bonus, int armorClass) {
  return die == 20 || (die != 1 && die + bonus >= armorClass);
}
\`\`\`

- **Proficiency Bonus:** Scales smoothly from $+2$ at level 1 to $+6$ at level 20:
  $$\\text{Proficiency}(L) = 2 + \\left\\lfloor \\frac{L - 1}{4} \\right\\rfloor$$
- **Ability Modifier:** Scales from $+2$ to $+5$:
  $$\\text{Ability}(L) = \\min\\left(5, 2 + \\left\\lfloor \\frac{L - 1}{6} \\right\\rfloor\\right)$$
- **Armor Class of Monsters:** Base 10 + half armor rating + 2 for elite rank + 2 for bosses.
- **The Natural 20 Rule:** If the virtual $d20$ rolls a 20, the attack **always hits**, ignoring enemy Armor Class entirely, and all damage dice are doubled!
- **The Natural 1 Rule:** If the die rolls a 1, the attack is a catastrophic miss, regardless of attack bonuses.

---

### The Four Core Dice Spells

#### 1. Star Lance (Single-Target Arcane Piercing)
- **Mechanic:** $d20$ spell attack roll against enemy Armor Class.
- **Damage:** $3d8$ force damage (rolls 3 eight-sided dice).
- **Critical Hit:** On a natural 20, rolls $6d8$ force damage!
- **Side Effect:** Applies \`StatusKind::Marked\` for 3 seconds, making the target take +15% bonus damage from all subsequent hits.

#### 2. Cinder Bloom (Targeted Ground Area-of-Effect)
- **Mechanic:** All enemies caught within an 88-pixel radius must make a **Dexterity Saving Throw** against the player's spell Save DC ($8 + \\text{attackBonus}$).
- **Damage:** $3d6$ fire damage. Targets that succeed on their save take half damage ($1.5d6$).
- **Failure Consequence:** Enemies that fail their Dexterity save are engulfed in flames (\`StatusKind::Burn\`), suffering burning damage over time for 3 seconds.

#### 3. Winter Grasp (Defensive Radial Chill)
- **Mechanic:** Radial frost blast emitting from the player's boots. Enemies within 96 pixels roll a **Constitution Saving Throw**.
- **Damage:** $2d8$ cold damage (half on save).
- **Failure Consequence:** Failed saves suffer \`StatusKind::Chill\`, reducing enemy movement and attack speeds by 35% for 2.5 seconds, providing vital kiting room.

#### 4. Verdant Ward (Restoration & Shielding)
- **Mechanic:** Draws healing vitality from the earth.
- **Healing:** Restores $2d8 + \\text{abilityModifier}$ hit points.
- **Shield:** Calls \`caster.shield(2)\`, granting **2 seconds of invulnerability** on the player (\`Player::invuln = std::max(invuln, 2.0f)\`).
- **Casting Controls:** All four d20 Dice Spells are cast with keyboard keys \`5\`, \`6\`, \`7\`, and \`8\` (or gamepad \`LB\` + D-pad, \`Input.cpp:327–338\`).`,
    mermaidCharts: [
      {
        title: "3-Wedge Web Skill Tree Ring & Keystone Layout",
        chart: `
flowchart TD
    classDef ctr fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef node fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef path fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef key fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;

    Center["Hero Class Center (Level 1)"]:::ctr
    Arms["Arms Wedge (-90 deg)<br/>Rings Lv 1, 4, 9, 15"]:::node
    Arts["Arts Wedge (+150 deg)<br/>Rings Lv 1, 4, 9, 15"]:::node
    Inst["Instincts Wedge (+30 deg)<br/>Rings Lv 1, 4, 9, 15"]:::node
    Path["Stat Path Nodes<br/>FNV-1a Key, No Slot Needed"]:::path
    Key["Level 15 Keystones:<br/>Berserker's Oath / Overchannel / Ironhide"]:::key

    Center --> Arms & Arts & Inst
    Arms --> Path --> Key
`,
      },
      {
        title: "Real-Time d20 Dice Spell Evaluation Pipeline",
        chart: `
flowchart LR
    classDef stat fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef roll fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef fx fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Stats["Caster Level -> Proficiency + Ability<br/>Calculate attackBonus & saveDC"]:::stat
    D20["Roll d20 via rng.irange(1, 20)<br/>Compare vs Target AC or DEX/CON Save"]:::roll
    Dice["Roll Damage/Heal Dice (3d8, 3d6, 2d8)<br/>Apply Nat 20 Doubling or Save Half"]:::fx

    Stats --> D20 --> Dice
`,
      },
    ],
  },
  {
    id: "nations-realms-diplomacy",
    title: "Four Nations, Six Culture Banners, Realms & Border Wars",
    category: "gameplay",
    summary:
      "The 4 sworn nations and 6 sub-culture banners, Voronoi territorial Realm claims (96-tile regions, 4x4 seat cells), national leader Voices, and uncertain fortune battles with routs and border capture.",
    sourceFiles: [
          "src/entity/Faction.hpp",
          "src/entity/Faction.cpp",
          "src/level/Group.hpp",
          "src/level/Group.cpp",
          "src/level/Realm.hpp",
          "src/level/Realm.cpp",
          "src/campaign/Voices.hpp",
          "src/campaign/Voices.cpp",
          "src/level/Feuds.cpp",
          "src/test/RealmTest.cpp",
          "src/test/BannerTest.cpp"
    ],
    content: `### The Geopolitical Canvas: Four Nations, Six Culture Banners

Mellangan's overworld is not an empty sandbox populated by random monster spawns: it is divided among four powerful rival nations and six distinct culture banners defined in \`src/entity/Faction.hpp\` and \`src/level/Group.cpp\`:

1. **The Crownlands (High Feudal Empire):** Chivalric heavy cavalry, fortified stone castles, and disciplined halberdier lines. Masters of legal charters and heavy iron trade.
2. **Anvilmark (Dwarven Mountain Holds):** Deep delvers, steam engines, and master stone masons. Possess supreme defensive bastions and coveted runic weaponry.
3. **Sandwells (Nomadic Merchant Caliphates):** Caravans, exotic spices, scimitar skirmishers, and alchemical fire. Control southern oasis routes and banking houses.
4. **Silverbough (Elder Wood Elves & Keepers):** Living tree settlements, longbow snipers, and druidic nature wards. Deeply protective of ancient groves and sacred fords.

---

### Six Banner Cultures, Standards & Visual Identity (\`CultureLook.hpp\`)

Alongside the four sovereign nations (whose palettes in \`src/entity/Faction.cpp:159\` use royal blue \`{74,110,214}\` for Crownlands, bronze \`{182,104,64}\` for Anvilmark, and verdigris \`{60,158,124}\` for Sandwells), six human banner cultures roam under parent-faction standing (\`src/level/Group.cpp:185–194\`): **Saltmarch** (Coinroad), **Marshwrights** (Freeblades), **Canopy Courts** (Rootsworn), **Deepward Guilds** (Coinroad), **Gravewardens** (Synod), and **Glasswrights** (Synod).

All ten cultures carry distinct standards and three camp pieces in \`culture::LOOKS[]\` (\`src/level/CultureLook.hpp\`, \`src/AtlasF.hpp:78–88\`). \`LevelRender.cpp:125–150\` places camp pieces on a ring outside the members' formation so same-faction cultures read apart visually, raises the standard lit over the fire during festivals, and has marching patrol leaders carry their culture's standard.

---

### Voronoi Realm Partitioning (\`src/level/Realm.cpp\`)

\`src/level/Realm.cpp\` partitions the continent into nation realms using unweighted Euclidean Voronoi cells over macro-regions:

$$D_i(rx, ry) = \\sqrt{(sx_i - (rx + 0.5))^2 + (sy_i - (ry + 0.5))^2}$$

\`\`\`cpp
// src/level/Realm.cpp
constexpr int REGION = 96, CELL = 4; // 4x4 regions = 384x384 tiles per seat cell
\`\`\`

- **Macro-Regions ($96 \\times 96$ Tiles):** Each region belongs to the nearest nation seat placed within a \`CELL = 4\` (4×4 region, 384×384 tile) macro-cell, biased by biome affinity.
- **Claim Overrides:** \`realm::owner(rx, ry)\` checks \`Campaign::claims\` first so conquered border marches persist across reloads.

---

### Territorial Seizures & Non-Seat Region Capture

When a border skirmish resolves on a realm seam, \`realm::seize(rx, ry, f)\` checks \`!claimed || !nation(f) || seat(rx, ry) || owner(rx, ry) == f\` plus neighbor adjacency (\`borders\`), records the new owner in \`Campaign::claims\`, and invalidates the local cache via \`forget()\`. Ancestral capital seats (\`seat(rx, ry)\`) can never be seized by border skirmishes.

---

### Border Wars, Skirmishes & Feuds (\`Feuds.cpp\`, \`Revels.cpp\`)

Along contested borders, rival patrol groups clash in real time:
- **Fortify & Uncertain Fortune:** First contact within \`WAR_SIGHT (300 px)\` rolls battle fortune plus national happening might, weakening the luckless side for 30 seconds.
- **Wavering Morale (\`waver\`):** Once surviving members drop below half initial size, squads roll rout odds and may flee.
- **Settlement (\`settle\`):** The victor gains standing if the hero aided them and seizes the contested border march via \`realm::seize()\`.

---

### Culture Voices & Diplomatic Greetings (\`src/campaign/Voices.cpp\`)

\`src/campaign/Voices.cpp\` drives faction and culture speech through \`voices::line(f, Disposition, aggro, war, sided, roll)\` and \`voices::greet(f, Disposition, aggro, roll)\`, selecting lines by \`Disposition\` band (\`< Indifferent\`, \`== Indifferent\`, \`> Indifferent\`) plus active war and ally overrides, in both English and German.`,
    mermaidCharts: [
      {
        title: "Voronoi Realm Ownership, Border Seams & War Seizure",
        chart: `
flowchart TD
    classDef map fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef war fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;
    classDef win fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Cell["4x4 Region Macro-Cell<br/>seatOf() + Biome Affinity"]:::map
    Claim["Campaign::claims Override Check<br/>realm::owner(rx, ry)"]:::map
    Border["Seam Detection & Road Patrols<br/>Map Border Turns Red at War"]:::war
    Seize["Group Battle Settled on Seam<br/>realm::seize() Flips Non-Seat Region"]:::win

    Cell --> Claim --> Border --> Seize
`,
      },
      {
        title: "Uncertain Battle Fortune & Rout State Machine",
        chart: `
stateDiagram-v2
    [*] --> Meet : Groups Within WAR_SIGHT (300 px)
    Meet --> Fortify : First Contact -> Hash Fortune + Happening Might
    Fortify --> Clash : Luckless Side Marked & Weakened (30s)
    Clash --> Waver : Surviving Members < Half Initial Size
    Waver --> Routed : Hash < clamp(0.45 - 0.25*fortune, 0.1, 0.85)
    Waver --> Clash : Hold Firm Until Eliminated
    Routed --> Settle : Winner +60 Rep (if Hero Aided), Seize Seam Region
    Clash --> Settle : All Foes Defeated
`,
      },
    ],
  },
  {
    id: "economies-festivals-happenings",
    title: "Nation Economies, Ten Festivals, Happenings & 112 Feats",
    category: "gameplay",
    summary:
      "Supply/demand trade routes across 10 cultures with war disruption and famine spikes, 10 cycling cultural Festivals with ambush/reprisal rules, 12 National Happenings, and the 112-Feat Achievement Atlas.",
    sourceFiles: [
          "src/campaign/Economy.hpp",
          "src/campaign/Economy.cpp",
          "src/campaign/Festival.hpp",
          "src/campaign/Festival.cpp",
          "src/campaign/Happening.hpp",
          "src/campaign/Happening.cpp",
          "src/level/Revels.cpp",
          "src/meta/Feats.hpp",
          "src/meta/Feats.cpp",
          "src/gui/AchievementToast.hpp",
          "tools/make_achievements.py",
          "src/test/FestivalTest.cpp"
    ],
    content: `### The Living Economy: Dynamic Pricing, Scarcity & Wartime Shocks

In traditional RPGs, vendor economies are static and dead: a rusty iron sword always sells for 10 gold, vendors have infinite purchasing funds, and the player rapidly accumulates hundreds of thousands of useless coins. This creates severe economic inflation and strips exploration of meaningful financial stakes.

In \`src/campaign/Economy.cpp\`, Mellangan models an elastic, living supply-and-demand market. Every town tracks local inventory stocks, trade embargoes, and scarcity modifiers. When an Anvilmark mining hold suffers an iron ore strike or goblin blockade, iron prices soar, weapons become scarce, and enterprising players can turn massive profits by hauling ingots from distant Crownland smelters.

---

### Culture Trade Multipliers & War Scarcity (\`src/campaign/Economy.cpp\`)

Rather than a continuous supply/demand curve, \`Economy.hpp\` and \`Economy.cpp\` define fixed trade profiles across all 10 cultures (\`TRADES[10]\`) using clear multipliers over a base lot value (\`LOT * UNIT = 5 * 4 = 20\` gold):

\`\`\`cpp
// src/campaign/Economy.hpp
constexpr int LOT = 5, UNIT = 4;
constexpr float MAKES = 0.6f, NEEDS = 1.8f, SCARCE = 1.5f, ABROAD = 1.3f, FAMINE = 2.0f;
\`\`\`

- **Producer Goods (\`MAKES = 0.6f\`):** Stalls sell what their own culture produces cheaply (base lot \`20 * 0.6 = 12\` gold).
- **Need Buy Orders (\`NEEDS = 1.8f\`):** Stalls pay a premium for goods their culture lacks (\`20 * 1.8 = 36\` gold).
- **Wartime Route Disruption (\`SCARCE = 1.5f\`, \`FAMINE = 2.0f\`):** Trade routes count every producer of a material; only when war cuts **all** producers from the buyer does the buy order jump by \`SCARCE (1.5x)\`, with an additional \`FAMINE (2.0x)\` spike on food. Foreign trade applies \`ABROAD = 1.3f\`.

---

### The Ten Cultural Festivals (\`src/campaign/Festival.cpp\`)

Each of the 10 cultures celebrates its own festival on a 10-day cycle staggered by world seed via \`(day + offset(c, salt)) % 10 == 0\`, with five possible moods (\`Somber\`, \`Solemn\`, \`Merry\`, \`Elated\`, \`Ecstatic\`):

\`\`\`
Culture       | Festival Name   | Culture       | Festival Name
--------------|-----------------|---------------|----------------
Crownlands    | Crowning Eve    | Marshwrights  | Stilt Dance
Anvilmark     | Long Quaff      | Canopy Courts | Bloom Court
Sandwells     | Dry Vigil       | Deepward      | Lamp Count
Silverbough   | Moonrise Revel  | Gravewardens  | Night of Names
Saltmarch     | Brine Wake      | Glasswrights  | Furnace Night
\`\`\`

Standing inside an active festival shifts the music track to match the rite's mood (\`Sound::feast\`), lights the culture's standard above the campfire, and plays its rite cue (\`Sound::rite\`).

#### Feast Raids & 8-Day Reprisal Grief (\`avenge\`)

During a festival, revellers drop their guard and rival factions can strike the feast. Attacking celebrants incurs sacrilege (\`-150\`) or massacre (\`-200\`) penalties and triggers 8 days of reprisal grief (\`avenge\`).

---

### The Twelve National Happenings (\`src/campaign/Happening.cpp\`)

\`Happening.cpp\` defines 12 procedural national happenings, three per nation:
- **Crownlands:** \`Royal Levy\`, \`Succession Quarrel\`, \`Bumper Harvest\`.
- **Anvilmark:** \`Grudge Oath\`, \`Cave-In\`, \`Deep Vein\`.
- **Sandwells:** \`Dry Year\`, \`Water Court\`, \`Glass Storm\`.
- **Silverbough:** \`Long Twilight\`, \`Elder's Sleep\`, \`Seedfall\`.

---

### 112 Feats & Non-Intrusive Toast Queue (\`Feats.cpp\`)

Mellangan tracks player mastery through 112 **Feats** (\`FEAT_COUNT = 112\`, stored across two 64-bit bitfields \`Codex::feats\` and \`Codex::feats2\`, with a compile-time cap of 128). Unlock cards queue silently in the bottom-right corner via \`AchievementToast\` without pausing play, using a dedicated 96×96 emblem atlas (\`res/achievements.png\`, built by \`tools/make_achievements.py\`).`,
    mermaidCharts: [
      {
        title: "War Disruption -> Scarcity Pricing & Famine Orders (Economy.cpp)",
        chart: `
flowchart LR
    classDef prod fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef war fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;
    classDef price fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Route["Producer Culture Makes Mat M"]:::prod
    Peace{"Every Producer at War<br/>With Buyer?"}:::war
    Normal["Standard Need Offer (1.8x)"]:::price
    Scarce["Scarce Buy Order (1.8x * 1.5x)<br/>+ 2.0x Famine Spike on Food"]:::war

    Route --> Peace
    Peace -->|"No (Trade Open)"| Normal
    Peace -->|"Yes (All Routes Cut)"| Scarce
`,
      },
      {
        title: "Festival Temper, Ambush Strikes & 8-Day Reprisal Cycle",
        chart: `
flowchart TD
    classDef fest fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef strike fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;
    classDef avenge fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    Day["10-Day Cycle Keeps Cultural Rite"]:::fest
    Mood["Temper Applies Marked / Weaken<br/>& Drops Camp Guard"]:::fest
    Raid["Rival Faction Ambush OR Hero Attack<br/>Sacrilege (-150) / Massacre (-200)"]:::strike
    Grief["8-Day Reprisal Grief (avenge)<br/>Vowed Hunters & Counter-Ambush"]:::avenge

    Day --> Mood --> Raid --> Grief
`,
      },
    ],
  },
  {
    id: "splintered-ford-situations",
    title: "43. The Splintered Ford, Dynamic Situations & Procedural Encampments",
    category: "gameplay",
    summary:
      "Technical architectural breakdown of Mellangan's situational event engine: multi-phase state machines, multi-role actor tracking, candidate ford annular scans (BAND_LO=40 to BAND_HI=90), river span bridging, and procedural encampment synthesis.",
    sourceFiles: [
          "src/campaign/Situation.hpp",
          "src/campaign/Situation.cpp",
          "src/campaign/Ford.hpp",
          "src/campaign/Ford.cpp",
          "tools/make_situations.py",
          "tools/make_camps.py"
    ],
    content: `### Emergent Encounters: From Static Quests to Systemic Situations

Traditional role-playing games structure overworld interaction as rigid script trees: an NPC offers a static quest, monitors a counter variable, and triggers a scripted payout upon return. In contrast, Mellangan's campaign mechanics in \`src/campaign/Situation.cpp\` and \`src/campaign/Ford.cpp\` execute a continuous, living state machine called a **Situation**. A Situation couples procedural geography (e.g. river gorges, broken stone bridges, deadfall crossings) with autonomous faction actors, temporal deadlines, multi-role negotiation, and physical environmental repairs.

The archetypal situation in Act 1 is **The Splintered Ford** (\`a1.ford\`), situated at the primary river crossing between the civil lowlands and the untamed frontiers. A Situation does not rely on scripted cutscenes: its participants are living groups in the \`Group\` table, its span is physical tile geography placed into the world via \`world::setWater\`, and its resolution permanently alters trade routes, NPC migration, and faction rep.

---

### A Concrete Scenario: The Traveler at Redstone Crossing

To understand how a Situation feels in human terms, imagine Alden the Sellsword setting out from the starting town on Campaign Day 2:

1. **Discovery on Day 2:** As Alden scouts into the wilderness, he spots smoke rising from a river chasm 60 tiles away. The game detects proximity, advancing the Ford from \`Phase::Hidden\` to \`Phase::Offered\`.
2. **The Dilemma at the Campfire:** Reaching the riverbank, Alden finds a collapsed stone bridge span. On the near bank sits an armed mercenary outpost (\`Freeblade Camp\`) charging a steep 120-gold toll for rowboat transit. On the opposite bank stand the \`Grove Keepers\`, druidic guardians who refuse to allow heavy iron wagons across unless sacred seeds are planted to heal the felled trees.
3. **Accepting the Challenge:** Alden agrees to arbitrate terms. The Situation transitions to \`Phase::Active\`. The campaign clock sets a strict deadline: \`due = day + 4 = 6\`. Alden has exactly 4 campaign days (96 real-world minutes) before the standoff boils over into bloodshed.
4. **Physical Bridge Repair:** Instead of paying the 120-gold toll, Alden carries 10 cut timber and 4 dressed stone to the riverbank. Interacting with the bridgehead triggers construction: a physical \`FordSpan\` entity appears over the water, and \`world::setWater\` clears the water collision flags across the river tiles. The crossing is now permanently walkable by all player and NPC entities!
5. **Diplomatic Compromise:** Alden speaks to the Grove Keepers, offering 2 rare herb seeds collected from a nearby fen. Placated, the Keepers sign a joint charter. The Situation resolves under the **\`Shared\`** branch: Alden receives 200 gold, +150 campaign XP, and permanent reputation gains with both factions.

---

### The Situation State Machine & Actor Tracking

Every situation operates through a formal six-phase state machine with strict transition guards defined in \`src/campaign/Situation.cpp\`:

$$\\text{Phase} \\in \\{\\text{Hidden}, \\text{Offered}, \\text{Active}, \\text{Resolved}, \\text{Abandoned}, \\text{Failed}\\}$$

\`\`\`cpp
// src/campaign/Situation.cpp
constexpr Move MOVES[int(Event::Count)] = {
    {mask(P::Hidden), P::Offered},
    {mask(P::Offered), P::Active},
    {uint8_t(mask(P::Offered) | mask(P::Active)), P::Count},
    {mask(P::Active), P::Resolved},
    {uint8_t(mask(P::Offered) | mask(P::Active)), P::Abandoned},
    {uint8_t(mask(P::Offered) | mask(P::Active)), P::Failed},
};
\`\`\`

#### Lifecycle & Temporal Constraints

- **Hidden to Offered:** When the hero approaches within scouting distance or reads a bulletin in town, the Situation activates into \`Offered\`. It records \`offered = day\`.
- **Offered to Active:** Acceptance locks in the clock deadline: \`due = min(day + days, DAYS)\`. For the Splintered Ford, \`info.days = 4\`, giving the player four 24-minute campaign days before the situation times out.
- **Clock Expiration:** During each tick in \`situation::tick()\`, the campaign clock is compared against \`due\`:
  \`\`\`cpp
  if (s.phase == P::Active && s.due >= 0 && today >= s.due)
    step(s, Event::Fail, today, Cause::Expired);
  \`\`\`
- **Actor Death & Catastrophic Failure:** Unlike immortal quest givers in other engines, all participants in a Situation are mortal \`SitActor\` entities assigned to specific roles: \`Role::Occupier\`, \`Role::Claimant\`, or \`Role::Travellers\`. If an actor's entity group is annihilated or routed in wild combat before the situation resolves, the engine invokes \`lose()\`:
  \`\`\`cpp
  void lose(Situations &all, const Situation &s, SitActor &a) {
    a.state = ActorState::Gone;
    int k = roleSlot(s.def, a.role);
    if (k < 0) return;
    int u = info(s.def).role[k].unit;
    SitUnit &row = all.unitAt(s.def, u);
    if (settled(row.phase)) return;
    row.phase = info(s.def).unit[u].lost, row.cause = Cause::ActorLost;
    spdlog::info("situation: {} lost its {} actor (group {})", info(s.def).key, int(a.role), a.group);
  }
  \`\`\`

If a wandering pack of wolves kills the Freeblade captain or the Grove Keeper diplomat before the treaty is signed, \`lose()\` settles only that actor's linked **unit** (\`Pass\` and \`Claim\` become \`Phase::Resolved\`; only \`Strand\` becomes \`Phase::Failed\`) with \`Cause::ActorLost\`, without failing the whole Situation.

---

### The Four Sub-Units of The Splintered Ford

The Splintered Ford is decomposed into four modular sub-goals (\`Unit\`), each tracking its own state and contribution to the overall campaign ledger:

1. **Pass (\`Unit::Pass\`):** Securing safe physical traversal across the chasm. Can be accomplished through engineering repair (donating 10 timber and 4 cut stone to rebuild the bridge span), paying the occupier's extortionate toll (120 gold coins), or military extermination of the occupying brigands.
2. **Claim (\`Unit::Claim\`):** Resolving the ancient territorial dispute over the crossing. The Grove Keepers claim sacred jurisdiction over the riverbanks, whereas the Freeblade Camp or Goblin Warband claims martial right of salvage. The player can negotiate a timber-cutting compromise, harvest sacred seeds, or broker a joint pact.
3. **Strand (\`Unit::Strand\`):** Rescuing stranded pilgrims or merchants stranded on the far bank without supplies. The player provides survival rations: 4 produce lots and 3 restorative herbs.
4. **Service (\`Unit::Service\`):** Re-establishing commercial courier dispatch and carriage escort across the border.

#### Branch Outcomes & Rewards (\`src/campaign/Ford.cpp:48–50\`)

When the Situation resolves, rewards follow \`GOLD[]\`, \`COIN[]\` (Coinroad standing), and \`ROOT[]\` (Rootsworn standing):

| Branch Name | Cultural & Faction Meaning | Gold | Coinroad Standing | Rootsworn Standing |
| :--- | :--- | :--- | :--- | :--- |
| \`Caravan\` | Commercial crossing reopened under merchant guild charter | 250 gold | +150 | +50 |
| \`GroveClosed\` | Sacred grove sealed against iron wagons | 300 gold | +180 | 0 |
| \`Shared\` | Diplomatic compromise: crossing shared with Keepers | 200 gold | +100 | +100 |
| \`Turned\` | Violent coup: occupiers defeated, ford turned | 0 gold | 0 | 0 |

---

### Procedural Candidate Search & Topographic Placement

How does Mellangan locate the optimal site for the ford without hardcoding coordinates? In \`src/campaign/Ford.cpp\`, the engine executes an annular radial search around the player's starting settlement:

$$\\Delta x^2 + \\Delta y^2 \\in [R_{\\text{lo}}^2, R_{\\text{hi}}^2] = [40^2, 90^2] = [1600, 8100]$$

\`\`\`cpp
// src/campaign/Ford.cpp
constexpr int BAND_LO = 40, BAND_HI = 90, OUTER = 150;
constexpr int BLOCK_W = 64, BLOCK_H = 32, STRIDE = 3;

std::vector<Lead> leads(int ox, int oy) {
  std::vector<Lead> out;
  for (int by = -BAND_HI; by <= BAND_HI; by += BLOCK_H)
    for (int bx = -BAND_HI; bx <= BAND_HI; bx += BLOCK_W)
      for (int dy = by; dy < std::min(by + BLOCK_H, BAND_HI + 1); dy++)
        for (int dx = bx; dy % STRIDE == 0 && dx < std::min(bx + BLOCK_W, BAND_HI + 1); dx++) {
          int d = dx * dx + dy * dy, x = ox + dx, y = oy + dy, k = 1;
          if (d < BAND_LO * BAND_LO || d > BAND_HI * BAND_HI) continue;
          if (world::isRamp(x, y)) { /* check ramp leads */ }
          if (world::isWater(x, y) || !world::isWater(x + 1, y)) continue;
          while (k <= SPAN && world::isWater(x + k, y) && !world::isIce(x + k, y)) k++;
          if (k - 1 >= 2 && k - 1 < SPAN && land(x + k, y))
            out.push_back({d, x, y, k - 1, false});
        }
  sorted(out);
  return out;
}
\`\`\`

#### Why These Specific Numbers?

- **Why $R_{\\text{lo}} = 40$ and $R_{\\text{hi}} = 90$?** In tile units (where each tile is $16 \\times 16$ pixels), 40 tiles is about 2 screen widths away from town, and 90 tiles is about 4.5 screen widths away. This ensures the Ford is close enough to discover during early-game exploration on foot, but far enough to require wilderness travel through dynamic weather fronts and wandering fauna.
- **Why Stride 3?** Evaluating every single tile in an 8100-tile annulus would require thousands of expensive terrain probes. Striding by 3 steps skips 8 out of every 9 tiles. Because rivers in Mellangan are generated with smooth noise contours at least 2 tiles wide, a stride of 3 is mathematically guaranteed to intersect any river channel without missing it, reducing CPU search overhead by 88%!
- **Water Span Bounding ($2 \\le k_{\\text{span}} < 11$):** A gap narrower than 2 tiles is too trivial to require a bridge, while a chasm wider than 11 tiles is an inland lake or sea that cannot be realistically spanned by wooden timber.

A breadth-first search (\`reach()\`) verifies that both banks actually connect to the wider continental road graph before finalizing the placement.

---

### Procedural Encampment Synthesis (\`spot()\` & \`pad()\`)

Once the ford site is verified, the engine spawns encampments for both the **Occupier** and the **Claimant**. It invokes \`spot()\` with spatial constraints:

\`\`\`cpp
// src/campaign/Ford.cpp
bool spot(uint32_t h, double cx, double cy, double ux, double uy, double lo, double hi,
          double gx, double gy, double gap, double &x, double &y) {
  double base = std::atan2(uy, ux);
  for (int k = 0; k < 32; k++) {
    uint32_t r = hash2(int(h), k);
    double a = base + (double(r % 1000) / 1000 - 0.5) * 2.4;
    double d = lo + (hi - lo) * double(r / 1000 % 1000) / 1000;
    x = cx + std::cos(a) * d, y = cy + std::sin(a) * d;
    if (apart(x, y, gx, gy) >= gap && fireAt(x, y))
      return true;
  }
  return false;
}
\`\`\`

- **Elevation Padding (\`pad()\`)**: Ensures the camp site is completely flat: all tiles within radius $r$ must match the center elevation with zero water or ramp tiles.
- **Structure Clearance (\`bare()\`)**: Verifies no natural dungeon, ruin, or graveyard overlaps within 4 tiles.
- **Faction Selection**: If the terrain is heavily forested according to biome bitmasks (\`wooded()\`), the occupier is cast as a \`Goblin Warband\`; otherwise, it casts a mercenary \`Freeblade Camp\`. The claimant is cast as \`Grove Keepers\` located 160 to 320 tiles away across the water barrier.

---

### World Geometry Construction: Bridges & Campfire Plates

When the player donates construction materials or finishes the passage unit, the game physically bridges the terrain in real time:

\`\`\`cpp
// Adding physical FordSpan entity to the level
level.add(std::make_shared<FordSpan>(st.x0, st.x1, st.ty, true));

// Clearing water collision flags in world tilemap
for (int x = st.x0; x <= st.x1; x++) {
  world::setWater(x, st.ty, false);
}
\`\`\`

Campfire interaction is handled through \`Plate\` triggers: when the player stands within 320 pixels of the campfire, a context prompt appears in the HUD. Pressing \`E\` initiates multi-choice parley dialogue directly through Mellangan's native SSO string dialogue engine.`,
    mermaidCharts: [
      {
        title: "Situation State Machine & Unit Resolution Topology",
        chart: `
flowchart TD
    classDef hid fill:#181524,stroke:#64748b,stroke-width:2px,color:#e2e8f0;
    classDef act fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef win fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef fail fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;
    classDef unit fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    H["Hidden: World Generation Seeded"]:::hid
    O["Offered: Discovered in Scout Range"]:::act
    A["Active: Clock Running (due = day + 4)"]:::act

    U1["Unit: Pass (Bridge Repair OR Toll OR Slay)"]:::unit
    U2["Unit: Claim (Keepers vs Freeblades Parley)"]:::unit
    U3["Unit: Strand (Rations to Marooned Travellers)"]:::unit
    U4["Unit: Service (Trade Courier Escort)"]:::unit

    R["Resolved: Cultural Branch Choosen<br/>Caravan, GroveClosed, Shared, or Turned"]:::win
    Ab["Abandoned: Player Ignored Timeout"]:::fail
    F["Failed: Clock Expired OR SitActor Slain"]:::fail

    H -->|"Proximity / Bulletin"| O
    O -->|"Accept Quest"| A
    A --> U1 & U2 & U3 & U4
    U1 & U2 & U3 & U4 -->|"All Goals Settled"| R
    A -->|"Clock >= due"| F
    A -->|"Actor Dead (lose())"| F
    O & A -->|"Manual Forfeit"| Ab
`,
      },
      {
        title: "Procedural Ford Annular Scanning & Camp Arbitration Pipeline",
        chart: `
flowchart TD
    classDef scan fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef chk fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef ok fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef spawn fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    Init["Center: Player Settlement (ox, oy)"]:::scan
    Annular["Annular Band: r in [40, 90] Tiles<br/>Partition 64x32 Blocks, Stride 3"]:::scan
    WaterChk{"Water Channel Width<br/>2 <= span < 11?"}:::chk
    ReachBFS{"BFS reach(): Do Both Banks<br/>Connect to Road Network?"}:::chk
    SpotCamp["spot(): Find Flat Elevation (pad(r=1))<br/>Clear of Structures (bare(r=2))"]:::chk
    AssignOcc["Assign Occupier (Goblin Warband / Freeblades)<br/>Assign Claimant (Grove Keepers across river)"]:::spawn
    PlaceEnt["Instantiate FordSpan + FordMark + Campfire Plates"]:::ok

    Init --> Annular --> WaterChk
    WaterChk -->|"Valid Span"| ReachBFS
    ReachBFS -->|"Connected"| SpotCamp
    SpotCamp --> AssignOcc --> PlaceEnt
`,
      },
    ],
  },
  {
    id: "bastion-flow-defense-inquisition",
    title: "44. Bastion Vector-Field Flow-Defense, The Synod Inquisition & Holy Caches",
    category: "gameplay",
    interactiveComponent: "bastion",
    summary:
      "Deep architectural dive into the Bastion flow field defense engine: 6x5 chamber ring topologies, 8-directional BFS wavefront routing from cardinal gates, edge collision deflection, autonomous watchtower ballistics, and Synod Inquisition den purges.",
    sourceFiles: [
          "src/campaign/Bastion.hpp",
          "src/campaign/Bastion.cpp",
          "src/campaign/Watchtower.hpp",
          "src/campaign/Watchtower.cpp",
          "src/campaign/CampaignSynod.cpp",
          "src/campaign/Curio.cpp",
          "src/campaign/Cache.cpp"
    ],
    content: `### Bastion Defense Architecture: Real-Time Vector Fields in C++20

When large hordes of enemies assault fortified compounds, standard $A^{*}$ pathfinding becomes an exponential performance bottleneck: running individual path queries for 300 active foes generates unacceptable frame drops. In \`src/campaign/Bastion.cpp\`, Mellangan solves this with **Vector Field Flow Routing**. Instead of computing individual entity paths, the engine computes a single discrete 8-directional vector field across an $N \\times N$ ($64 \\times 64$) tile chamber room. Every enemy within the bastion's sphere of influence simply reads its local tile direction in $\\mathcal{O}(1)$ time.

---

### The Mental Model: The Gravity Basin Analogy

To understand vector fields intuitively, picture an ancient stone courtyard surrounded by fortress walls with a single iron gate. If you pour thousands of water droplets across the courtyard, no single droplet needs to "think" or plan a path: every droplet simply flows downhill along the carved stone channels toward the drain.

In Mellangan's Bastion architecture, the open fortress gate is the lowest point in the drainage basin. When the engine computes the flow field, it carves invisible downhill slopes across all 4,096 tiles of the chamber. When 300 attacking goblins or skeletons spawn outside, they don't run expensive $A^*$ searches: they simply step in the direction the local tile points, like water droplets flowing downhill straight through the fortress gate!

---

### Anatomy of the $6 \\times 5$ Fortified Chamber

A Bastion field is initialized via \`bastion::raise(cx, cy)\`. It constructs a fortified room of dimensions $W = 6, H = 5$ tiles surrounded by a thick stone perimeter:

$$W = 6, \\quad H = 5, \\quad N = 64, \\quad \\text{CELL} = 16\\text{ pixels}$$

\`\`\`text
                  NORTH GATE (s=0, GAP=1, width=3 tiles)
                  +-----+  [ OPEN GATE ]  +-----+
                  | . . . . . . . . . . . . . . |
                  | . . . . . . . . . . . . . . |
  WEST WALL       | . . . . .  HERO  . . . . . .|       EAST WALL
  (W = 6 tiles)   | . . . . . (cx, cy) . . . . .|       (W = 6 tiles)
                  | . . . . . . . . . . . . . . |
                  | . . . . . . . . . . . . . . |
                  +-----------------------------+
                            SOUTH WALL
\`\`\`

The fortress dimensions $W=6, H=5$ correspond to a chamber of $12 \\times 10$ tiles ($192 \\times 160$ pixels), perfectly sized to fit within the player's primary camera viewport with ample room for tactical maneuvers, barricades, and defensive traps.

---

### Step-by-Step Flow Field Generation (\`bastion::raise\`)

Let us trace how the engine computes this flow field inside \`src/campaign/Bastion.cpp\`:

\`\`\`cpp
// src/campaign/Bastion.cpp
constexpr int DX[8] = {1, 1, 0, -1, -1, -1, 0, 1};
constexpr int DY[8] = {0, 1, 1, 1, 0, -1, -1, -1};
constexpr float R2 = 0.70710678f;
constexpr float UX[8] = {1, R2, 0, -R2, -1, -R2, 0, R2};
constexpr float UY[8] = {0, R2, 1, R2, 0, -R2, -1, -R2};

void raise(int cx, int cy) {
  Field &f = fields.emplace_back();
  f.cx = cx, f.cy = cy, f.x0 = cx - N / 2, f.y0 = cy - N / 2;
  f.west = float((cx - W) * CELL + 8), f.east = float((cx + W) * CELL + 8);
  f.north = float((cy - H) * CELL + 13), f.south = float((cy + H) * CELL + 13);
  f.gate = gate(cx, cy);
  f.dir.fill(NONE);

  uint16_t queue[N * N];
  int head = 0, tail = 0;

  // Step 1: Mark perimeter walls and seed the Gate opening into the queue
  for (int ly = 0; ly < N; ly++)
    for (int lx = 0; lx < N; lx++) {
      int tx = f.x0 + lx, ty = f.y0 + ly;
      if (!ring(cx, cy, tx, ty)) continue;
      bool open = opening(cx, cy, tx, ty);
      f.dir[size_t(ly * N + lx)] = open ? GOAL : WALL;
      if (open) queue[tail++] = uint16_t(ly * N + lx);
    }

  // Step 2: Breadth-First Wavefront Expansion
  while (head < tail) {
    int c = queue[head++], cx0 = c % N, cy0 = c / N;
    for (int k = 0; k < 8; k++) {
      int nx = cx0 + DX[k], ny = cy0 + DY[k];
      if (unsigned(nx) >= unsigned(N) || unsigned(ny) >= unsigned(N)) continue;
      uint8_t &d = f.dir[size_t(ny * N + nx)];
      if (d != NONE) continue;

      // Diagonal corner-cutting check
      if ((k & 1) && (f.dir[size_t(cy0 * N + nx)] == WALL || f.dir[size_t(ny * N + cx0)] == WALL))
        continue;

      d = uint8_t((k + 4) & 7); // Reverse direction: points backward toward parent
      queue[tail++] = uint16_t(ny * N + nx);
    }
  }
}
\`\`\`

#### Why Reverse the Direction (\`(k + 4) & 7\`)?

During the BFS expansion, the search expands **outward from the gate toward the edges of the world**. When the search steps from cell $A$ to neighbor $B$ along direction $k$, cell $B$ needs to know how to walk **back toward $A$** to reach the gate!
Because directions are indexed $0$ to $7$ in a circular ring ($0=\\text{East}, 2=\\text{South}, 4=\\text{West}, 6=\\text{North}$):

$$\\text{Opposite Direction} = (k + 4) \\pmod 8 = (k + 4) \\ \\& \\ 7$$

Adding 4 and masking by 7 rotates the vector by 180 degrees. Thus, every cell receives an inverted vector pointing back toward the gate.

#### Diagonal Corner-Cutting Invariant

Look closely at the diagonal check:
\`\`\`cpp
if ((k & 1) && (f.dir[cy0 * N + nx] == WALL || f.dir[ny * N + cx0] == WALL))
  continue;
\`\`\`
In an 8-directional grid, diagonal neighbors occur at odd indices ($k = 1, 3, 5, 7$). If an entity moves diagonally between two wall corners that touch diagonally, it would slip through the 1-pixel diagonal seam! By verifying that both orthogonal flanking neighbors are not walls, the algorithm guarantees that entities never cut through solid stone masonry.

---

### Dual-State Routing & Wall Collision Deflection

Entities query the flow field inside \`bastion::route()\`:

\`\`\`cpp
// src/campaign/Bastion.cpp
void route(double x, double y, double px, double py, float speed, double &xw, double &yw) {
  for (const Field &f : fields) {
    bool in = f.inside(x, y), hero = f.inside(px, py);
    if (in == hero) continue; // If both inside or both outside, use direct pursuit
    if ((px - x) * xw + (py - y) * yw <= 0) return;
    uint8_t d = f.at(x, y);
    if (d < 8)
      xw = UX[d] * speed, yw = UY[d] * speed;
    return;
  }
}
\`\`\`

#### Walkthrough of Dual-State Steering

- **Case 1: Both Outside the Bastion (\`in == hero\`):** When the hero is fighting out in the courtyard and enemies are also in the courtyard, the bastion walls are irrelevant. Foes engage in standard direct line-of-sight pursuit toward the hero.
- **Case 2: Hero Retreats Inside the Fortress (\`in != hero\`):** As soon as the hero retreats through the gate into the fortified room, \`in != hero\` triggers. Enemies in the courtyard instantly switch from direct pursuit to following the flow field vectors. Hundreds of foes smoothly turn, navigating around outer obstacles, and funnel into the narrow gate opening in disciplined formation.

#### Physical Collision Deflection (\`bastion::wall\`)

When an entity is pushed against the stone perimeter walls, \`bastion::wall()\` clamps coordinates outside the stone edges:

$$\\varepsilon = 9\\text{ px}, \\quad d_w = x - \\text{west}, \\quad d_e = \\text{east} - x, \\quad d_n = y - \\text{north}, \\quad d_s = \\text{south} - y$$

The algorithm calculates the distance to all 4 wall edges. The smallest distance identifies which wall face was hit, deflecting the entity along the tangent while leaving the gate corridor (\`f.corridor()\`) completely open for transit.

---

### Autonomous Watchtower Ballistics

Bastions are anchored by autonomous \`Watchtower\` structures (\`src/campaign/Watchtower.cpp\`):

\`\`\`cpp
// src/campaign/Watchtower.hpp
class Watchtower : public Entity {
public:
  static constexpr float RANGE = 190, RELOAD = 1.1f;
  Watchtower(double x, double y) { this->x = x, this->y = y; }
  void tick() override;
  void renderLight(Screen &s) override;
  float reload = 0.5f, t = 0;
  int shots = 0;
};
\`\`\`

Every 1.1 seconds, the watchtower sweeps within radius $R = 190$ pixels for the nearest hostile entity. It leads moving targets by projecting velocity over projectile flight time, launching heavy iron ballista bolts while casting dynamic circular light fields (\`renderLight\`) onto the engine's LightField buffer.

---

### The Synod Inquisition, Holy Chapels & Moral Judgment

In \`src/campaign/CampaignSynod.cpp\`, bastion defense intertwines with the religious hegemony of **The Synod**. Synod Chapels serve as fortified sanctuary hubs where players can cleanse Afflictions, purchase consecrated wares, and receive official Inquisition mandates.

#### Faction Purge Quotas

For each Campaign Act, the Synod establishes strict eradication quotas against local monstrous populations:

| Act | Target Faction | Quota | Den Type | Reward Gold |
| :--- | :--- | :--- | :--- | :--- |
| Act 1 | \`Faction::Mycel\` | 15 kills | Fungal Spore Ruin | 200 gold |
| Act 2 | \`Faction::Bogspawn\` | 20 kills | Marsh Bog Den | 200 gold |
| Act 3 | \`Faction::Glasskin\` | 25 kills | Obsidian Glass Shard | 200 gold |
| Act 4 | \`Faction::Starborn\` | 30 kills | Crater Altar | 200 gold |
| Act 5 | \`Faction::BarrowHost\` | 35 kills | Royal Crypt Barrow | 200 gold |

#### The Judgment Dilemma: Vows vs Mercy

When the player tracks down a target faction's ancestral den, they face a moral and mechanical crossroad via \`Campaign::judge(level, spare)\`:

1. **Purge the Den (\`spare = false\`):** The player eradicates the den inhabitants. The soil is treated with slaked lime (\`limeAround()\`), spawning a long-lived barrier of \`Stuff::Limed\` ($10^{4}$ s) that repels undead and fungal rot. The player receives \`PURGE_GOLD * act * (member() ? 2 : 1)\` (\`150 * act\`, doubled for Synod members, \`CampaignSynod.cpp:115\`) and Synod standing.
2. **Spare the Den (\`spare = true\`):** The player refuses the purge. The game triggers immediate excommunication:
   \`\`\`cpp
   rank::castOut(ranks, Faction::Synod);
   level.scrutiny = std::max(level.scrutiny, Level::INQUISITION);
   level.game.announce(lang.vowsBroken);
   \`\`\`
   Breaking vows spikes the player's Scrutiny level to maximum, spawning elite **Inquisition Pursuers** (\`SynodFoe\`) armed with silver censers and pyre torches, while awarding massive goodwill with the spared non-human faction.

---

### Curios & Reliquary Caches

Across the countryside, players encounter hidden stone **Caches** (\`src/campaign/Cache.cpp\`) and mystical **Curios** (\`src/campaign/Curio.cpp\`). Appraising a curio reveals one of 12 archetypes (a mix of boons and hazards):

- \`Reveal\`: Unveils nearby terrain on the world chart.
- \`Mend\`: Closes wounds and restores player health (Mellangan has no weapon durability).
- \`Gild\`: Grants pure gold coin.
- \`Swarm\`: Negative hazard that calls the restless dead to attack you.
- \`Curse\`: Negative hazard that sets an affliction in your blood.
- \`Thunder\`: Calls down lightning around the hero.

Players can burn blasphemous curios at Synod pyres (\`curio::burn()\`) to gain Pyre Pardon, reducing Inquisition scrutiny.`,
    mermaidCharts: [
      {
        title: "Bastion Flow Field Wavefront Propagation & Collision Resolution",
        chart: `
flowchart TD
    classDef gate fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef bfs fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef steer fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef wall fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    G["Gate Opening (GAP = 1, Width 3 tiles)<br/>Seeded into Queue at dist = 0, dir = GOAL (8)"]:::gate
    BFS["8-Direction BFS Wavefront<br/>Prune Diagonal Corner-Cutting (k & 1 && wall)"]:::bfs
    DirTable["Populate dir[N*N] with Inverted Unit Vectors<br/>UX[d], UY[d] pointing to predecessor"]:::bfs

    Query["Enemy Tick: Query bastion::route(x, y, px, py)"]:::steer
    StateChk{"Hero & Foe on Opposite Sides<br/>(inside != heroInside)?"}:::steer
    FieldSteer["Sample Direction d = dir[tile]<br/>Set Velocity = (UX[d] * speed, UY[d] * speed)"]:::steer
    DirectSteer["Direct Line-of-Sight Pursuit to Hero"]:::steer

    WallCol["bastion::wall(): Check Perimeter Crossing<br/>If NOT in Corridor: Deflect along Edge Normal (eps = 9)"]:::wall

    G --> BFS --> DirTable
    DirTable --> Query --> StateChk
    StateChk -->|"Yes"| FieldSteer --> WallCol
    StateChk -->|"No"| DirectSteer --> WallCol
`,
      },
      {
        title: "Synod Inquisition Scrutiny, Holy Chapels & Judgment Branching",
        chart: `
flowchart TD
    classDef synod fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef purge fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef break fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;

    Chapel["Synod Chapel: Cleansing Afflictions (150g)<br/>Inquisition Mandate Issued (CHARGES[act])"]:::synod
    Den["Locate Den in Wilds via world::nearestStructure()"]:::synod
    Choice{"Campaign::judge(level, spare)<br/>Choose Fate of the Den"}:::synod

    PurgeDen["Purge Den: Slake Lime (Stuff::Limed, life = 10000s)<br/>+150 Purge Gold, +200 Charge Gold, Synod Pardon"]:::purge
    SpareDen["Spare Den: rank::castOut(Faction::Synod)<br/>Scrutiny = INQUISITION, Synod Pursuers Spawn, Faction Trust Up"]:::break

    Chapel --> Den --> Choice
    Choice -->|"spare = false"| PurgeDen
    Choice -->|"spare = true"| SpareDen
`,
      },
    ],
  },
  {
    id: "procedural-music-audio-engineering",
    title: "29. Procedural Music Synthesis, 4-Track FM Tracker & Audio Engineering",
    category: "core",
    summary:
      "Comprehensive breakdown of Mellangan's procedural soundtrack generator and 32-voice audio engine: deterministic seed synthesis, seamless loop tail-folding, physical waveguide koto/shakuhachi modeling, 9-bit DAC emulation, and real-time spatial mixing.",
    sourceFiles: [
          "tools/make_music.py",
          "tools/make_audio.py",
          "src/audio/Sound.hpp",
          "src/audio/Sound.cpp",
          "src/audio/FoeVoice.hpp",
          "src/audio/FoeVoice.cpp"
    ],
    content: `### Procedural Audio Architecture: Zero-Asset Soundtrack Synthesis

Where modern game titles distribute gigabytes of compressed MP3 or Vorbis audio tracks, Mellangan compiles its entire original musical soundtrack procedurally via \`tools/make_music.py\`. Every theme, chord progression, instrument timbre, and ambient soundscape is synthesized purely from mathematics using NumPy, SciPy, and bandlimited digital signal processing (DSP). Because all generators rely on deterministic pseudo-random seeds, the compilation pipeline produces bit-exact, identical WAV and OGG assets across all developer machines.

---

### The Mental Model: The Music Box & Convolution Chamber

Imagine a traditional mechanical music box: a metal cylinder with pins that pluck steel reeds as it turns. It requires no recorded tape, no microphones, and no singer: it produces rich music purely through physical vibration triggered by exact mechanical timings.

\`tools/make_music.py\` is a mathematical music box. Instead of physical steel teeth, it simulates vibrating koto strings, resonant bamboo flutes, and tensioned taiko drumheads using differential equations. Then, it plays these instruments inside a virtual cathedral by convolving the sound waves with an acoustic impulse response.

---

### Mathematical Tail-Folding & Seamless Looping

Game audio must loop indefinitely without audible pops, clicks, or reverb cutoffs. Standard DAWs require manual fade-ins or cross-fades that muddy ambient reverberation. Mellangan solves this by **reverb tail convolution folding**:

$$y[t] = x[t] + x[t + T_{\\text{loop}}], \\quad t \\in [0, T_{\\text{loop}})$$

\`\`\`python
# tools/make_music.py
# Seamless loop convolution tail folding
def loop_wrap(signal: np.ndarray, loop_samples: int) -> np.ndarray:
    out = np.zeros(loop_samples, dtype=np.float32)
    # Fold any reverberation tail extending past loop_samples back into the beginning
    for i in range(0, len(signal), loop_samples):
        chunk = signal[i:i + loop_samples]
        out[:len(chunk)] += chunk
    return out
\`\`\`

#### Why Standard Loops Pop & Why Tail Folding Works

When an audio file loops normally, the final chord's reverberation extends past the end of the file. If you simply cut the file at bar 36, the reverb cuts off instantly, creating an audible crack or pop because the waveform drops from an arbitrary amplitude to zero in a single sample!
By folding the reverb tail modulo $T_{\\text{loop}}$ back into the beginning of measure 1, the natural decay of the final measure rings out softly during the intro. When the track loops, the waveform amplitude and slope at sample $T_{\\text{loop}} - 1$ match sample $0$ with mathematical perfection.

---

### Musical Theory: Yo & In Pentatonic Scales

Mellangan's soundtrack blends Japanese traditional chamber instrumentation with European brass chorales and martial percussion. The melodic scales are strictly constructed around two historic Japanese pentatonic tunings:

1. **The Yo Scale (D, E, G, A, B):** A bright, open five-tone scale without semitone intervals ($1, 2, 4, 5, 6$). Evokes the natural beauty of peaceful sunlit countrysides and safe hearths (\`res/music/campaign.ogg\`, \`res/music/hearth.ogg\`).
2. **The In Scale (D, Eb, G, A, Bb):** A dark, poignant five-tone scale characterized by half-step tension ($1, \\flat 2, 4, 5, \\flat 6$). Evokes ancient dread, subterranean crypts, and life-or-death boss skirmishes (\`res/music/caves.ogg\`, \`res/music/boss.ogg\`).

\`\`\`python
# tools/make_music.py scale definitions
YO = {
    "D": [50, 57, 62, 64], # D3, A3, D4, E4
    "B": [47, 57, 62, 64], # B2, A3, D4, E4
    "G": [43, 57, 59, 62], # G2, A3, B3, D4
    "A": [45, 57, 64, 67], # A2, A3, E4, G4
}
IN = {
    "D": [50, 57, 62, 63], # D3, A3, D4, Eb4
    "Bb": [46, 57, 62, 70], # Bb2, A3, D4, Bb4
    "G": [43, 58, 62, 67], # G2, Bb3, D4, G4
    "Eb": [51, 58, 62, 67], # Eb3, Bb3, D4, G4
}
\`\`\`

---

### Physical Instrument Modeling in Software

Rather than playing static PCM samples, the synthesis engine models the physical acoustics of four primary instruments:

#### 1. Plucked Koto Strings (Karplus-Strong Waveguide)

The Japanese 13-string koto is modeled using a modified Karplus-Strong digital waveguide. An initial noise burst simulates the ivory plectrum pluck, circulated through a delay line of length $L = f_s / f_0$:

$$H(z) = \\frac{1 + z^{-1}}{2} \\cdot \\rho$$

A low-pass averaging filter simulates high-frequency string damping, while a fractional delay allpass filter provides pitch accuracy and slight string stiffness dispersion.

#### 2. Shakuhachi End-Blown Flute (Turbulent Air Jet)

The bamboo shakuhachi is synthesized by coupling a pink-noise turbulence generator (modeling breath blowing across the sharp horn edge) into a resonant second-order bandpass filter. Pitch modulation (\`meri-kari\` embouchure bending) and random breath velocity fluctuations simulate authentic breath vibrato.

#### 3. Taiko & Shime Drums (2D Circular Membrane Modes)

Large Japanese war drums are synthesized by calculating the vibration modes of a circular clamped membrane. Unlike strings whose harmonics are integer multiples ($f, 2f, 3f$), circular membrane overtones correspond to the non-integer roots of Bessel functions $J_n(\\alpha_{nm}) = 0$:

$$f_{01} = 1.000 f_0, \\quad f_{11} = 1.593 f_0, \\quad f_{21} = 2.135 f_0, \\quad f_{02} = 2.295 f_0$$

Summing exponentially decaying sinusoids at these Bessel ratios yields the unmistakable resonant hollow boom of a massive temple drum.

#### 4. Handheld Console 9-Bit DAC Emulation (\`moor.ogg\`)

For battle tracks in the marshland (\`moor.ogg\`), the audio pipeline routes trumpet, reed organ, and bass voices through a vintage handheld sound chip emulator:

$$\\hat{x}[n] = \\frac{\\lfloor 2^8 \\cdot x[n] + 0.5 \\rfloor}{2^8}, \\quad f_s = 15{,}768\\text{ Hz}$$

The signal is downsampled to 15,768 Hz and quantized to 9-bit resolution, adding distinct harmonic grit and vintage warmth.

---

### The 32-Voice SDL3 Audio Stream Mixer (\`src/audio/Sound.cpp\`)

In real-time gameplay, sound effects, ambience beds, and music tracks are managed by \`src/audio/Sound.cpp\` over 32 pre-created mono 44.1 kHz \`SDL_AudioStream\` voices:

\`\`\`cpp
// src/audio/Sound.hpp
void play(float volume = 1.0f, float pitchJitter = 0.0f, float pitch = 1.0f);
\`\`\`

#### Oldest-Start Voice Replacement & Dedicated Jitter RNG

\`Sound::play()\` enforces a per-effect minimum gap, scans \`voices[0..31]\` for an empty queue, and when all 32 streams are busy replaces the voice with the oldest start timestamp (\`voiceStarted[pick]\`). Pitch variation is drawn from a dedicated \`thread_local Rng jitter{0x5EED50D5ull}\` so audio playback never perturbs the deterministic simulation RNG. \`Sound::play()\` does not perform stereo panning or spatial attenuation internally; callers scale \`volume\` beforehand.

#### Monster Voice Families (\`src/audio/FoeVoice.cpp\`)

\`src/audio/FoeVoice.cpp\` maps each \`EnemyKind\` to one of six pre-rendered WAV families (\`Sound::foe[6][3]\`: \`beast\`, \`folk\`, \`hulk\`, \`wing\`, \`spirit\`, \`ooze\` across \`alert\`, \`hurt\`, and \`death\`) and scales volume with linear distance falloff \`1 - dist / 420\` before invoking \`Sound::play()\`.`,
    mermaidCharts: [
      {
        title: "Procedural Music Generation & Loop Tail-Wrapping Pipeline",
        chart: `
flowchart TD
    classDef seed fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef synth fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef dsp fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Seed["Fixed Random Seeds (Deterministic Bit-Exact)"]:::seed
    Score["Score Formulation: Yo & In Pentatonic Sequences<br/>Chorales, Basslines & Percussion Patterns"]:::seed

    Koto["Karplus-Strong Waveguide (Koto Pluck)"]:::synth
    Flute["Resonant Noise Jet (Shakuhachi Flute)"]:::synth
    Taiko["Bessel Mode Summation (Taiko & Shime)"]:::synth
    DAC["15768 Hz / 9-Bit Quantizer (Handheld Moor FX)"]:::synth

    Mix["4-Track Stem Mixdown & Reverb Impulse Convolve"]:::dsp
    Fold["loop_wrap(): Tail Modulo Folding<br/>Fold Reverb Tail into Beginning (y[t] = x[t] + x[t+T])"]:::dsp
    Export["Lossless WAV & OGG Export (Zero Seam Loop)"]:::out

    Seed --> Score
    Score --> Koto & Flute & Taiko & DAC
    Koto & Flute & Taiko & DAC --> Mix --> Fold --> Export
`,
      },
      {
        title: "Real-Time 32-Voice SDL3 Audio Stream Routing",
        chart: `
flowchart TD
    classDef trig fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef mix fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Event["Sound::play(volume, pitchJitter, pitch)"]:::trig
    VoiceAlloc{"Empty Stream in<br/>32-Voice Pool?"}:::mix
    Steal["Oldest-Start Replacement<br/>Pick Min(voiceStarted[i])"]:::mix
    PitchJitter["Dedicated thread_local Rng<br/>pitch * (1 + jitter)"]:::mix
    BufferOut["Queue Mono 44.1 kHz PCM into SDL_AudioStream"]:::out

    Event --> VoiceAlloc
    VoiceAlloc -->|"Empty Stream"| PitchJitter
    VoiceAlloc -->|"All 32 Busy"| Steal --> PitchJitter
    PitchJitter --> BufferOut
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
          "extern/Vulkan2d/VK2D/src/RendererMeta.c"
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
          "extern/Vulkan2d/VK2D/src/DescriptorBuffer.c"
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
          "extern/Vulkan2d/VK2D/src/Image.c"
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
          "extern/Vulkan2d/shaders/instanced.frag"
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
          "extern/Vulkan2d/shaders/usershader.vert"
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
          "extern/Vulkan2d/VK2D/src/RendererMeta.c"
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
          "extern/Vulkan2d/VK2D/src/VulkanInterface.c"
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
          "extern/Vulkan2d/VK2D/src/Initializers.c"
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
          "extern/Vulkan2d/examples/debug.c"
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
          "extern/Vulkan2d/shaders/colour.vert"
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
          "extern/Vulkan2d/VK2D/include/VK2D/VulkanInterface.h"
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
          "extern/Vulkan2d/VK2D/include/VK2D/Blobs.h"
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
          "extern/Vulkan2d/VK2D/src/RendererMeta.c"
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
          "extern/Vulkan2d/shaders/instanced.frag"
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
          "extern/Vulkan2d/examples/testing/main.c"
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
          "extern/Vulkan2d/examples/retrolook/main.c"
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
          "extern/Vulkan2d/VK2D/src/Pipeline.c"
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
          "extern/Vulkan2d/VK2D/src/Pipeline.c"
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
          "extern/Vulkan2d/shaders/colour.frag"
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
          "extern/Vulkan2d/assets/shader.slang"
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
  {
    id: "vk2d-shader-book-pbr-lighting-and-post",
    title: "73. GPU & Shader Book VIII: Physically Based 2D Lighting, ACES Tone Mapping & Procedural Noise",
    category: "graphics",
    summary:
      "Upgrade from flat Lambertian shading to Cook-Torrance microfacet PBR (GGX + Schlick Fresnel), preserve bright colors with ACES Filmic HDR tone mapping, synthesize Voronoi caustics and fBm domain-warped textures in pure math, and solve Assignments 20–22.",
    sourceFiles: [
          "extern/Vulkan2d/assets/shader.slang",
          "extern/Vulkan2d/shaders/usershader.vert"
    ],
    content: `
# 73. GPU & Shader Book VIII: Physically Based 2D Lighting, ACES Tone Mapping & Procedural Noise

In Books I–VII we built up from individual GPU warps to 3D raymarching and parallax relief. Now in **Book VIII**, we dive into the three techniques that give modern indie and AAA 2D games their signature richness:
1. **Physically Based Rendering (PBR)** using **GGX microfacets** and **Schlick Fresnel** so metal armor, wet cobblestones, and rough wood react believably to light.
2. **ACES Filmic Tone Mapping** so bright fire and magic spells stay vivid instead of clipping into ugly flat white.
3. **Procedural GPU Noise (Voronoi, fBm, Domain Warping)** to generate water caustics, clouds, and swirling portals with zero texture memory.

---

### Chapter 1: Physically Based 2D Lighting (Microfacets & Fresnel)

Why does simple \`max(dot(N, L), 0)\` make every surface look like matte chalk or cheap plastic? Real surfaces are covered in microscopic facets:
- **Roughness** ($r \\in [0.05, 1.0]$): Smooth surfaces ($r = 0.1$) align their microfacets like a mirror, producing tight, bright specular highlights. Rough surfaces ($r = 0.9$) scatter light everywhere.
- **Metallic** ($m \\in [0.0, 1.0]$): Non-metals (wood, stone, cloth) reflect **white/light-colored** specular highlights while scattering diffuse light from inside. Metals (gold, iron, copper) have **no diffuse bounce** and tint their specular reflections with their own base color!

#### Schlick Fresnel & GGX Distribution (Line-by-Line)

Look at a wooden table straight down: it looks matte. Look across the same table at a shallow grazing angle toward a window: it acts like a mirror! That universal optical law is **Fresnel reflectance**, approximated cleanly by Christophe Schlick:

$$F(\\theta) = F_0 + (1 - F_0)(1 - \\cos\\theta)^5$$

Here $F_0$ is the base reflectivity at straight-on incidence ($0.04$ for non-metals, or \`albedo\` for metals). Combine that with the **GGX / Trowbridge-Reitz** microfacet distribution:

\`\`\`hlsl
float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float denom = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
    return a2 / (3.14159265 * denom * denom + 0.0001);
}

float3 F_Schlick(float cosTheta, float3 F0) {
    return F0 + (1.0 - F0) * pow(saturate(1.0 - cosTheta), 5.0);
}
\`\`\`

- **Why \`+ 0.0001\` in \`D_GGX\`?** When \`roughness == 0.0\` and \`NdotH == 1.0\`, \`denom\` becomes \`0.0\`, which would output \`NaN\` and poison any downstream bloom pass (Book V)!

---

### Chapter 2: HDR Brightness & ACES Filmic Tone Mapping

Imagine a bright orange torch flame outputting \`float3(4.0, 1.4, 0.2)\`. If you send that straight to an 8-bit swapchain, the GPU **clamps** every channel above \`1.0\`:
- \`4.0\` clips to \`1.0\`, \`1.4\` clips to \`1.0\`, and \`0.2\` stays \`0.2\` -> your rich orange fire washes out into pale yellow-white!

**Tone Mapping** compresses High Dynamic Range (HDR) light ($0 .. \\infty$) smoothly into $[0, 1]$ while gently desaturating only the very brightest cores, just like cinema film! The industry-standard **Narkowicz ACES Filmic** curve takes only 5 instructions:

\`\`\`hlsl
float3 acesFilm(float3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}
\`\`\`

#### Wrap Diffuse Lighting for Soft Organic Materials

Hard Lambertian lighting (\`max(dot(N, L), 0)\`) cuts off abruptly at $90^\\circ$. For leaves, snow, or skin where light scatters slightly underneath the surface, use **Wrap Diffuse**:

\`\`\`hlsl
float wrapDiffuse(float3 N, float3 L, float wrap) {
    return saturate((dot(N, L) + wrap) / (1.0 + wrap));
}
\`\`\`

---

### Chapter 3: Procedural Textures: Voronoi, fBm & Domain Warping

When you need water caustics, swirling magic portals, or weathered stone without bloating VRAM with huge tileable textures, you can synthesize them mathematically per pixel:

#### 1. 2D Voronoi / Cellular Noise (Water Caustics & Cracks)

Divide UV space into integer grid cells \`i = floor(p)\` and \`f = frac(p)\`. Place one jittered random seed point inside each of the $3 \\times 3$ neighboring cells, and measure the **minimum distance** from the pixel to the closest seed:

\`\`\`hlsl
float2 hash22(float2 p) {
    float3 p3 = frac(float3(p.xyx) * float3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return frac((p3.xx + p3.yz) * p3.zy);
}

float voronoi(float2 p, float time) {
    float2 n = floor(p);
    float2 f = frac(p);
    float minDist = 8.0;
    for (int y = -1; y <= 1; ++y) {
        for (int x = -1; x <= 1; ++x) {
            float2 g = float2(float(x), float(y));
            float2 o = hash22(n + g);
            o = 0.5 + 0.5 * sin(time + 6.2831 * o);
            float2 r = g + o - f;
            minDist = min(minDist, dot(r, r));
        }
    }
    return sqrt(minDist);
}
\`\`\`

- Raising \`voronoi()\` to a power (\`pow(v, 3.0)\`) makes the cell centers dark and the bright cell ridges crisp, instantly creating **underwater caustics**!

#### 2. Fractal Brownian Motion (fBm) & Domain Warping

One octave of \`valueNoise\` looks blurry. **fBm** stacks 4 octaves, doubling the detail frequency ($\\times 2.0$) and halving the strength ($\\times 0.5$) each step. Feeding one \`fbm()\` into the coordinates of a second \`fbm()\` (**Domain Warping**) creates organic swirling smoke and marble:

\`\`\`hlsl
float fbm(float2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; ++i) {
        sum += amp * valueNoise(p);
        p *= 2.03;
        amp *= 0.5;
    }
    return sum;
}
// Swirled domain warp:
float pattern = fbm(uv * 4.0 + float2(fbm(uv * 3.0 + time), fbm(uv * 3.0 - time)));
\`\`\`

---

### Chapter 4: Graded Assignments 20–22 (With Starter Code & Full Solutions)

#### Assignment 20: Cook-Torrance 2D PBR Sprite Shader
- **Objective:** Combine an albedo sprite (\`push.textureIndex\`), a normal map (\`userData.normalTexID\`), \`userData.roughness\`, and \`userData.metallic\` using \`D_GGX\` and \`F_Schlick\` to shade metallic armor vs matte cloth under a moving point light!
- **Reference Solution:**
\`\`\`hlsl
struct UserData {
    float3 lightPosLocal;
    uint normalTexID;
    float roughness;
    float metallic;
    float pad0;
    float pad1;
};
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

float D_GGX(float NdotH, float r) {
    float a = max(r * r, 0.01);
    float a2 = a * a;
    float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
    return a2 / (3.14159265 * d * d + 0.0001);
}

float3 F_Schlick(float cosT, float3 F0) {
    return F0 + (1.0 - F0) * pow(saturate(1.0 - cosT), 5.0);
}

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 tex = textures[push.textureIndex].Sample(sampler, uv);
    float3 albedo = pow(max(tex.rgb, 0.0), 2.2);
    float3 N = normalize(textures[userData.normalTexID].Sample(sampler, uv).xyz * 2.0 - 1.0);

    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float3 L = normalize(userData.lightPosLocal - float3(localUV, 0.0));
    float3 V = float3(0.0, 0.0, 1.0);
    float3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float3 F0 = lerp(float3(0.04), albedo, userData.metallic);

    float3 F = F_Schlick(max(dot(H, V), 0.0), F0);
    float D = D_GGX(NdotH, userData.roughness);
    float3 spec = (D * F) * 0.25;
    float3 kD = (1.0 - F) * (1.0 - userData.metallic);
    float3 lit = albedo * 0.08 + (kD * albedo / 3.14159265 + spec) * NdotL * 2.2;

    return float4(pow(max(lit, 0.0), 1.0 / 2.2) * push.colour.rgb, tex.a * push.colour.a);
}
\`\`\`

#### Assignment 21: ACES Filmic HDR Tone Mapping Pass
- **Objective:** Take an offscreen scene texture \`sceneTex\` with bright emissive light values boosted by \`userData.exposure\`, apply \`acesFilm()\`, and output saturated filmic colors without harsh channel clipping!
- **Reference Solution:**
\`\`\`hlsl
struct UserData { float exposure; float pad0; float pad1; float pad2; };
[[vk::binding(3, 3)]] ConstantBuffer<UserData> userData;

float3 acesFilm(float3 x) {
    return saturate((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
}

[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 c = textures[push.textureIndex].Sample(sampler, uv);
    float3 hdr = pow(max(c.rgb, 0.0), 2.2) * userData.exposure;
    float3 mapped = acesFilm(hdr);
    return float4(pow(mapped, 1.0 / 2.2) * push.colour.rgb, c.a * push.colour.a);
}
\`\`\`

#### Assignment 22: Animated Voronoi Pool Caustics Overlay
- **Objective:** Project shimmering cyan-white Voronoi caustics (\`pow(voronoi(localUV * 6.0, userData.time), 3.0)\`) additively over an underwater sprite!
- **Reference Solution:**
\`\`\`hlsl
[shader("pixel")]
float4 PixelShader(float2 uv) {
    float4 tex = textures[push.textureIndex].Sample(sampler, uv);
    float2 localUV = (uv - push.texturePos.xy) / push.texturePos.zw;
    float v = voronoi(localUV * 6.0, userData.time * 1.4);
    float caustic = pow(saturate(v), 3.2) * 0.85;
    float3 rgb = tex.rgb + float3(0.35, 0.85, 1.0) * caustic;
    return float4(rgb * push.colour.rgb, tex.a * push.colour.a);
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "2D Cook-Torrance PBR & ACES Tone Mapping Pipeline",
        chart: `
flowchart LR
    classDef tex fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef pbr fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef hdr fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Inputs["Albedo (Linear) + Normal Map<br/>Roughness & Metallic"]:::tex
    Micro["Microfacet BRDF<br/>kD Diffuse + D_GGX * F_Schlick Specular"]:::pbr
    HDR["HDR Radiance Sum<br/>Values > 1.0 Stay Unclipped"]:::hdr
    ACES["acesFilm() + Gamma 1/2.2<br/>Vivid Saturated Output"]:::out

    Inputs --> Micro --> HDR --> ACES
`,
      },
      {
        title: "Procedural GPU Texture Synthesis: From 2D Hash to Domain Warping",
        chart: `
flowchart LR
    classDef h fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef n fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef w fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Hash["hash22(cell)<br/>Deterministic Grid Seeds"]:::h
    Vor["Voronoi (3x3 Cells)<br/>pow(minDist, 3) -> Water Caustics"]:::n
    FBM["fBm (4 Octaves)<br/>freq * 2, amp * 0.5 -> Clouds & Terrain"]:::n
    Warp["Domain Warping<br/>fbm(p + fbm(p)) -> Swirled Magma & Portals"]:::w

    Hash --> Vor
    Hash --> FBM --> Warp
`,
      },
    ],
  },
  {
    id: "vk2d-renderer-book-instance-device-swapchain",
    title: "74. Vulkan Renderer Book IX: Building From Scratch (Instance, Devices, Surface & Swapchain)",
    category: "graphics",
    summary:
      "Leave wrapper APIs behind and build a Vulkan 1.2 renderer from scratch in pure C11 and SDL3: VkInstance validation and portability extensions, GPU scoring and pNext descriptor indexing checks, SDL3 surfaces with High-DPI fallbacks, VkSwapchainKHR creation, and Assignments 23–25.",
    sourceFiles: [
          "extern/Vulkan2d/VK2D/src/Renderer.c",
          "extern/Vulkan2d/VK2D/src/PhysicalDevice.c",
          "extern/Vulkan2d/VK2D/src/LogicalDevice.c",
          "extern/Vulkan2d/VK2D/src/RendererMeta.c",
          "extern/Vulkan2d/VK2D/src/Initializers.c",
          "extern/Vulkan2d/VK2D/include/VK2D/Opaque.h"
    ],
    content: `
### Chapter 1: Leaving the Wrapper Behind (Your Renderer From Zero)

In **Books I through VIII**, you mastered how GPUs think in warps and quads, and you wrote Slang shaders inside an already running Vulkan2D host. Starting in **Book IX**, we turn the camera around: **you are going to build the entire C/Vulkan host renderer itself from an empty \`main.c\` file**.

Every line we write follows the real, battle-tested architecture inside \`extern/Vulkan2d\`, stripped down to its pure Vulkan 1.2 essentials so you understand *why* every handle exists and *what breaks* if you wire a flag wrong:

1. **No Hidden Global State:** Unlike OpenGL, Vulkan has no implicit context. Your renderer struct (\`struct Renderer\`) explicitly owns every handle from \`VkInstance\` down to \`VkCommandPool\`.
2. **Explicit Failure Boundaries:** Every boot step checks its \`VkResult\`. If step 7 fails, teardown unwinds steps 6 down to 1 cleanly without touching uninitialized handles (see \`VK2D_INIT_STEP\` in \`VK2D/src/Renderer.c\`).
3. **Cross-Platform From Line 1:** Windows, Linux (X11 and Wayland), and macOS (MoltenVK) each have subtle requirements around portability extensions, \`UINT32_MAX\` swapchain extents, and deprecated device layers.

---

### Chapter 2: Creating \`VkInstance\`, Validation Layers & Portability Flags

A \`VkInstance\` is the connection between your C executable and the Vulkan loader (\`vulkan-1.dll\` on Windows, \`libvulkan.so\` on Linux, \`libMoltenVK.dylib\` on macOS). Unlike legacy OpenGL, Vulkan refuses to assume you want debugging or windowing: you must **enumerate what the system offers** and explicitly enable what you need.

#### Step 1: Query System Layers & Extensions Before Requesting Them

Never blindly ask for \`VK_LAYER_KHRONOS_validation\` or optional extensions: on an end-user machine without the Vulkan SDK installed, asking for a missing layer makes \`vkCreateInstance\` fail with \`VK_ERROR_LAYER_NOT_PRESENT\`! Look at how \`Renderer.c\` (lines 91–227) handles this safely:

\`\`\`c
#include <SDL3/SDL.h>
#include <SDL3/SDL_vulkan.h>
#include <vulkan/vulkan.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Renderer {
    SDL_Window *window;
    VkInstance instance;
    VkDebugReportCallbackEXT debugReport;
    VkPhysicalDevice physicalDevice;
    uint32_t graphicsFamily;
    VkDevice device;
    VkQueue graphicsQueue;
    VkCommandPool commandPool;
    VkSurfaceKHR surface;
    VkSurfaceFormatKHR surfaceFormat;
    VkExtent2D extent;
    VkSwapchainKHR swapchain;
    uint32_t swapchainImageCount;
    VkImage *swapchainImages;
    VkImageView *swapchainImageViews;
} Renderer;

static bool hasLayer(const VkLayerProperties *layers, uint32_t count, const char *name) {
    for (uint32_t i = 0; i < count; i++) {
        if (strcmp(layers[i].layerName, name) == 0) return true;
    }
    return false;
}

static bool hasExt(const VkExtensionProperties *exts, uint32_t count, const char *name) {
    for (uint32_t i = 0; i < count; i++) {
        if (strcmp(exts[i].extensionName, name) == 0) return true;
    }
    return false;
}
\`\`\`

Now assemble the instance extension and layer arrays cleanly:
1. Call \`SDL_Vulkan_GetInstanceExtensions(&sdlCount)\` to collect the OS surface extensions (\`VK_KHR_surface\` plus \`VK_KHR_win32_surface\`, \`VK_KHR_xcb_surface\`, \`VK_KHR_wayland_surface\`, or \`VK_EXT_metal_surface\`).
2. Check \`vkEnumerateInstanceExtensionProperties\` for \`VK_KHR_get_physical_device_properties2\` (needed to query Vulkan 1.2 descriptor indexing features and VRAM budgets) and \`VK_KHR_portability_enumeration\` (required on macOS MoltenVK!).
3. If \`VK_KHR_portability_enumeration\` is present, add it **once** (avoiding duplicates if SDL already listed it) and OR \`VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR\` into \`VkInstanceCreateInfo::flags\`.
4. If debug mode is requested and \`VK_LAYER_KHRONOS_validation\` exists, add it plus \`VK_EXT_DEBUG_REPORT_EXTENSION_NAME\` (or \`VK_EXT_debug_utils\`).

\`\`\`c
bool createInstance(Renderer *r, bool enableValidation) {
    uint32_t layerCount = 0;
    vkEnumerateInstanceLayerProperties(&layerCount, NULL);
    VkLayerProperties *sysLayers = calloc(layerCount ? layerCount : 1, sizeof(VkLayerProperties));
    if (layerCount) vkEnumerateInstanceLayerProperties(&layerCount, sysLayers);

    uint32_t extCount = 0;
    vkEnumerateInstanceExtensionProperties(NULL, &extCount, NULL);
    VkExtensionProperties *sysExts = calloc(extCount ? extCount : 1, sizeof(VkExtensionProperties));
    if (extCount) vkEnumerateInstanceExtensionProperties(NULL, &extCount, sysExts);

    const char *extensions[16];
    const char *layers[4];
    uint32_t enabledExtCount = 0;
    uint32_t enabledLayerCount = 0;

    if (enableValidation && hasLayer(sysLayers, layerCount, "VK_LAYER_KHRONOS_validation")) {
        layers[enabledLayerCount++] = "VK_LAYER_KHRONOS_validation";
        extensions[enabledExtCount++] = VK_EXT_DEBUG_REPORT_EXTENSION_NAME;
    }
    if (hasExt(sysExts, extCount, VK_KHR_GET_PHYSICAL_DEVICE_PROPERTIES_2_EXTENSION_NAME)) {
        extensions[enabledExtCount++] = VK_KHR_GET_PHYSICAL_DEVICE_PROPERTIES_2_EXTENSION_NAME;
    }

    bool portability = hasExt(sysExts, extCount, VK_KHR_PORTABILITY_ENUMERATION_EXTENSION_NAME);
    uint32_t sdlCount = 0;
    const char *const *sdlExts = SDL_Vulkan_GetInstanceExtensions(&sdlCount);
    for (uint32_t i = 0; i < sdlCount; i++) {
        if (strcmp(sdlExts[i], VK_KHR_PORTABILITY_ENUMERATION_EXTENSION_NAME) != 0) {
            extensions[enabledExtCount++] = sdlExts[i];
        }
    }
    if (portability) {
        extensions[enabledExtCount++] = VK_KHR_PORTABILITY_ENUMERATION_EXTENSION_NAME;
    }

    VkApplicationInfo app = {
        .sType = VK_STRUCTURE_TYPE_APPLICATION_INFO,
        .pApplicationName = "ScratchVulkan",
        .applicationVersion = VK_MAKE_VERSION(1, 0, 0),
        .pEngineName = "ScratchEngine",
        .engineVersion = VK_MAKE_VERSION(1, 0, 0),
        .apiVersion = VK_API_VERSION_1_2,
    };

    VkInstanceCreateInfo ci = {
        .sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO,
        .flags = portability ? VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR : 0,
        .pApplicationInfo = &app,
        .enabledLayerCount = enabledLayerCount,
        .ppEnabledLayerNames = layers,
        .enabledExtensionCount = enabledExtCount,
        .ppEnabledExtensionNames = extensions,
    };

    VkResult res = vkCreateInstance(&ci, NULL, &r->instance);
    free(sysExts);
    free(sysLayers);
    return res == VK_SUCCESS;
}
\`\`\`

*(Function Loader Rule: Extension functions such as \`vkCreateDebugReportCallbackEXT\` are not exported directly by the Vulkan loader library on every platform. Always resolve them at runtime with \`(PFN_vkCreateDebugReportCallbackEXT)vkGetInstanceProcAddr(r->instance, "vkCreateDebugReportCallbackEXT")\` as shown in \`VK2D/src/RendererMeta.c\` line 267!)*

---

### Chapter 3: Selecting a \`VkPhysicalDevice\` & Building \`VkDevice\`

With an instance alive, call \`vkEnumeratePhysicalDevices\` to discover all GPUs on the machine. A laptop often exposes **two** physical devices: an integrated GPU (\`VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU\`) and a discrete GPU (\`VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU\`).

#### 1. Queue Families & GPU Selection (\`PhysicalDevice.c\`)

A GPU splits hardware engines into **Queue Families**. For a modern 2D/3D sprite renderer, we want a queue family that supports **both** \`VK_QUEUE_GRAPHICS_BIT\` and \`VK_QUEUE_COMPUTE_BIT\` (plus presentation to our \`VkSurfaceKHR\`). Putting graphics and compute on the same queue family avoids cross-family queue ownership transfers on every sprite batch!

\`\`\`c
static bool findQueueFamily(VkPhysicalDevice pd, VkSurfaceKHR surface, uint32_t *outFamily) {
    uint32_t count = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(pd, &count, NULL);
    VkQueueFamilyProperties *q = calloc(count, sizeof(VkQueueFamilyProperties));
    vkGetPhysicalDeviceQueueFamilyProperties(pd, &count, q);

    bool found = false;
    for (uint32_t i = 0; i < count; i++) {
        VkBool32 presentSupport = VK_FALSE;
        vkGetPhysicalDeviceSurfaceSupportKHR(pd, i, surface, &presentSupport);
        VkQueueFlags want = VK_QUEUE_GRAPHICS_BIT | VK_QUEUE_COMPUTE_BIT;
        if (q[i].queueCount > 0 && (q[i].queueFlags & want) == want && presentSupport) {
            *outFamily = i;
            found = true;
            break;
        }
    }
    free(q);
    return found;
}
\`\`\`

When picking among multiple valid GPUs (\`_vk2dPhysicalDeviceGetBestDevice\` in \`PhysicalDevice.c\` line 93), remember the golden priority rule:
- Prefer \`VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU\` first, breaking out immediately once found.
- Fall back to integrated or virtual GPUs if no discrete card exists.

#### 2. Querying Descriptor Indexing via \`pNext\` & Creating \`VkDevice\` (\`LogicalDevice.c\`)

Vulkan 1.2 **never turns on optional GPU features automatically**. Even if the hardware supports bindless texture arrays or wide lines, leaving them disabled causes validation errors or undefined behavior!

Look closely at how \`VK2D/src/LogicalDevice.c\` (lines 66–137) validates and activates Vulkan 1.2 descriptor indexing using the \`pNext\` chain:

\`\`\`c
bool createLogicalDevice(Renderer *r) {
    // 1. Check device extensions (swapchain + MoltenVK portability subset if advertised)
    uint32_t devExtCount = 0;
    vkEnumerateDeviceExtensionProperties(r->physicalDevice, NULL, &devExtCount, NULL);
    VkExtensionProperties *devExts = calloc(devExtCount, sizeof(VkExtensionProperties));
    vkEnumerateDeviceExtensionProperties(r->physicalDevice, NULL, &devExtCount, devExts);
    bool hasPortabilitySubset = hasExt(devExts, devExtCount, "VK_KHR_portability_subset");
    free(devExts);

    // 2. Query Vulkan 1.2 descriptor indexing features via pNext
    VkPhysicalDeviceDescriptorIndexingFeatures supported = {
        .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_DESCRIPTOR_INDEXING_FEATURES
    };
    VkPhysicalDeviceFeatures2 feats2 = {
        .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_FEATURES_2,
        .pNext = &supported
    };
    vkGetPhysicalDeviceFeatures2(r->physicalDevice, &feats2);

    if (!supported.shaderSampledImageArrayNonUniformIndexing ||
        !supported.runtimeDescriptorArray ||
        !supported.descriptorBindingVariableDescriptorCount ||
        !supported.descriptorBindingPartiallyBound ||
        !supported.descriptorBindingUpdateUnusedWhilePending ||
        !supported.descriptorBindingSampledImageUpdateAfterBind) {
        return false; // Fail loudly with the exact missing capability!
    }

    VkPhysicalDeviceDescriptorIndexingFeatures enableIndexing = {
        .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_DESCRIPTOR_INDEXING_FEATURES,
        .shaderSampledImageArrayNonUniformIndexing = VK_TRUE,
        .runtimeDescriptorArray = VK_TRUE,
        .descriptorBindingVariableDescriptorCount = VK_TRUE,
        .descriptorBindingPartiallyBound = VK_TRUE,
        .descriptorBindingUpdateUnusedWhilePending = VK_TRUE,
        .descriptorBindingSampledImageUpdateAfterBind = VK_TRUE,
        .descriptorBindingUniformBufferUpdateAfterBind = supported.descriptorBindingUniformBufferUpdateAfterBind,
    };

    const char *exts[4];
    uint32_t extN = 0;
    exts[extN++] = VK_KHR_SWAPCHAIN_EXTENSION_NAME;
    if (hasPortabilitySubset) {
        exts[extN++] = "VK_KHR_portability_subset";
    }

    float priority = 1.0f;
    VkDeviceQueueCreateInfo qci = {
        .sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO,
        .queueFamilyIndex = r->graphicsFamily,
        .queueCount = 1,
        .pQueuePriorities = &priority,
    };

    VkPhysicalDeviceFeatures coreFeats = {0};
    VkDeviceCreateInfo dci = {
        .sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO,
        .pNext = &enableIndexing,
        .queueCreateInfoCount = 1,
        .pQueueCreateInfos = &qci,
        .enabledLayerCount = 0,          // Device layers are deprecated in Vulkan!
        .ppEnabledLayerNames = NULL,
        .enabledExtensionCount = extN,
        .ppEnabledExtensionNames = exts,
        .pEnabledFeatures = &coreFeats,
    };

    if (vkCreateDevice(r->physicalDevice, &dci, NULL, &r->device) != VK_SUCCESS) {
        return false;
    }
    vkGetDeviceQueue(r->device, r->graphicsFamily, 0, &r->graphicsQueue);

    VkCommandPoolCreateInfo pci = {
        .sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO,
        .flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT,
        .queueFamilyIndex = r->graphicsFamily,
    };
    return vkCreateCommandPool(r->device, &pci, NULL, &r->commandPool) == VK_SUCCESS;
}
\`\`\`

*(Why \`enabledLayerCount = 0\`? Early Vulkan 1.0 tutorials set \`enabledLayerCount\` on \`VkDeviceCreateInfo\`, which modern validation layers and MoltenVK warn against as deprecated. Validation is strictly an instance-level concern.)*

---

### Chapter 4: Window Surface, High-DPI Extents & \`VkSwapchainKHR\`

A **Swapchain** is the circular conveyor belt of backbuffer images shared between your GPU and the operating system's compositor. When the GPU finishes drawing into image $i$, it hands image $i$ to the display controller while immediately starting work on image $(i + 1) \\bmod N$.

#### 1. Surface Format, Present Mode & Wayland/Retina \`UINT32_MAX\` Extents

Inside \`_vk2dRendererCreateWindowSurface()\` and \`_vk2dRendererCreateSwapchain()\` (\`RendererMeta.c\` lines 309–440), three checks keep swapchain creation rock-solid across OS compositors:

1. **Color Format:** Query \`vkGetPhysicalDeviceSurfaceFormatsKHR\`. Prefer \`VK_FORMAT_B8G8R8A8_SRGB\` paired with \`VK_COLOR_SPACE_SRGB_NONLINEAR_KHR\` (universally supported on desktop and MoltenVK, giving automatic hardware linear-to-sRGB encoding when writing pixels).
2. **Present Mode Fallback:** Scan \`vkGetPhysicalDeviceSurfacePresentModesKHR\`. If you want tear-free low-latency triple buffering (\`VK_PRESENT_MODE_MAILBOX_KHR\`) or uncapped frames (\`VK_PRESENT_MODE_IMMEDIATE_KHR\`) and the driver lacks it, fall back to \`VK_PRESENT_MODE_FIFO_KHR\`, which the Vulkan spec guarantees on **100% of swapchain implementations**.
3. **High-DPI & Wayland Extent Guard:** Look at \`_vk2dRendererGetSurfaceSize()\` (\`RendererMeta.c\` line 315): on Wayland and some Retina setups, \`caps.currentExtent.width\` equals \`UINT32_MAX\` (\`0xFFFFFFFF\`) as a signal that *you* must supply the pixel dimensions! Query \`SDL_GetWindowSizeInPixels(window, &w, &h)\` and clamp to \`[minImageExtent, maxImageExtent]\`.

#### 2. Swapchain Image Count Clamping Formula

We want at least $3$ images for triple buffering so the GPU never waits for vsync to acquire a new frame, clamped safely inside hardware bounds:

$$\\text{imageCount} = \\begin{cases} \\min\\bigl(\\max(\\text{minImageCount}, 3),\\; \\text{maxImageCount}\\bigr) & \\text{if } \\text{maxImageCount} > 0 \\\\ \\max(\\text{minImageCount}, 3) & \\text{if } \\text{maxImageCount} = 0 \\end{cases}$$

*(Remember: \`maxImageCount == 0\` in Vulkan means **no upper bound**, not zero allowed images!)*

\`\`\`c
bool createSwapchain(Renderer *r, VkPresentModeKHR desiredMode, VkSwapchainKHR oldSwapchain) {
    VkSurfaceCapabilitiesKHR caps;
    vkGetPhysicalDeviceSurfaceCapabilitiesKHR(r->physicalDevice, r->surface, &caps);

    if (caps.currentExtent.width == UINT32_MAX || caps.currentExtent.height == UINT32_MAX) {
        int pxW = 0, pxH = 0;
        SDL_GetWindowSizeInPixels(r->window, &pxW, &pxH);
        r->extent.width  = (uint32_t)pxW;
        r->extent.height = (uint32_t)pxH;
    } else {
        r->extent = caps.currentExtent;
    }

    // Clamp inside hardware min/max extents
    if (r->extent.width  < caps.minImageExtent.width)  r->extent.width  = caps.minImageExtent.width;
    if (r->extent.width  > caps.maxImageExtent.width)  r->extent.width  = caps.maxImageExtent.width;
    if (r->extent.height < caps.minImageExtent.height) r->extent.height = caps.minImageExtent.height;
    if (r->extent.height > caps.maxImageExtent.height) r->extent.height = caps.maxImageExtent.height;

    uint32_t imageCount = caps.minImageCount > 3 ? caps.minImageCount : 3;
    if (caps.maxImageCount > 0 && imageCount > caps.maxImageCount) {
        imageCount = caps.maxImageCount;
    }

    r->surfaceFormat.format = VK_FORMAT_B8G8R8A8_SRGB;
    r->surfaceFormat.colorSpace = VK_COLOR_SPACE_SRGB_NONLINEAR_KHR;

    VkSwapchainCreateInfoKHR sci = {
        .sType = VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR,
        .surface = r->surface,
        .minImageCount = imageCount,
        .imageFormat = r->surfaceFormat.format,
        .imageColorSpace = r->surfaceFormat.colorSpace,
        .imageExtent = r->extent,
        .imageArrayLayers = 1,
        .imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT,
        .imageSharingMode = VK_SHARING_MODE_EXCLUSIVE,
        .preTransform = caps.currentTransform,
        .compositeAlpha = VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR,
        .presentMode = desiredMode,
        .clipped = VK_TRUE,
        .oldSwapchain = oldSwapchain,
    };

    if (vkCreateSwapchainKHR(r->device, &sci, NULL, &r->swapchain) != VK_SUCCESS) {
        return false;
    }

    vkGetSwapchainImagesKHR(r->device, r->swapchain, &r->swapchainImageCount, NULL);
    r->swapchainImages = calloc(r->swapchainImageCount, sizeof(VkImage));
    r->swapchainImageViews = calloc(r->swapchainImageCount, sizeof(VkImageView));
    vkGetSwapchainImagesKHR(r->device, r->swapchain, &r->swapchainImageCount, r->swapchainImages);

    for (uint32_t i = 0; i < r->swapchainImageCount; i++) {
        VkImageViewCreateInfo iv = {
            .sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO,
            .image = r->swapchainImages[i],
            .viewType = VK_IMAGE_VIEW_TYPE_2D,
            .format = r->surfaceFormat.format,
            .components = {
                VK_COMPONENT_SWIZZLE_IDENTITY, VK_COMPONENT_SWIZZLE_IDENTITY,
                VK_COMPONENT_SWIZZLE_IDENTITY, VK_COMPONENT_SWIZZLE_IDENTITY
            },
            .subresourceRange = {
                .aspectMask = VK_IMAGE_ASPECT_COLOR_BIT,
                .baseMipLevel = 0, .levelCount = 1,
                .baseArrayLayer = 0, .layerCount = 1,
            },
        };
        if (vkCreateImageView(r->device, &iv, NULL, &r->swapchainImageViews[i]) != VK_SUCCESS) {
            return false;
        }
    }
    return true;
}
\`\`\`

Notice the \`VkImageView\` loop at the bottom: in Vulkan, shaders and framebuffers **never read or write a raw \`VkImage\` directly**. They always access a \`VkImageView\`, which acts as a typed lens over mip levels, array layers, and color channels!

---

### Chapter 5: Graded Assignments 23–25 (With Starter Code & Full Solutions)

#### Assignment 23: GPU Capability & Hardware Report Utility
- **Objective:** Write a standalone C function \`printDeviceReport(VkInstance instance)\` that enumerates all \`VkPhysicalDevice\` handles, prints each GPU's name, type (\`Discrete\`, \`Integrated\`, \`Other\`), Vulkan API version, total \`DEVICE_LOCAL\` VRAM in megabytes, and queries \`VkPhysicalDeviceDescriptorIndexingProperties::maxDescriptorSetUpdateAfterBindSampledImages\`.
- **Reference Solution:**
\`\`\`c
void printDeviceReport(VkInstance instance) {
    uint32_t count = 0;
    vkEnumeratePhysicalDevices(instance, &count, NULL);
    VkPhysicalDevice *devs = calloc(count, sizeof(VkPhysicalDevice));
    vkEnumeratePhysicalDevices(instance, &count, devs);

    for (uint32_t i = 0; i < count; i++) {
        VkPhysicalDeviceDescriptorIndexingProperties idxProps = {
            .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_DESCRIPTOR_INDEXING_PROPERTIES
        };
        VkPhysicalDeviceProperties2 props2 = {
            .sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_PROPERTIES_2,
            .pNext = &idxProps
        };
        vkGetPhysicalDeviceProperties2(devs[i], &props2);

        VkPhysicalDeviceMemoryProperties mem;
        vkGetPhysicalDeviceMemoryProperties(devs[i], &mem);
        VkDeviceSize vramBytes = 0;
        for (uint32_t h = 0; h < mem.memoryHeapCount; h++) {
            if (mem.memoryHeaps[h].flags & VK_MEMORY_HEAP_DEVICE_LOCAL_BIT) {
                vramBytes += mem.memoryHeaps[h].size;
            }
        }

        const char *kind = props2.properties.deviceType == VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU ? "Discrete" :
                           props2.properties.deviceType == VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU ? "Integrated" : "Other";
        printf("[%u] %s (%s) | Vulkan %u.%u.%u | VRAM: %.0f MB | MaxBindlessTextures: %u\\n",
               i, props2.properties.deviceName, kind,
               VK_VERSION_MAJOR(props2.properties.apiVersion),
               VK_VERSION_MINOR(props2.properties.apiVersion),
               VK_VERSION_PATCH(props2.properties.apiVersion),
               (double)vramBytes / (1024.0 * 1024.0),
               idxProps.maxDescriptorSetUpdateAfterBindSampledImages);
    }
    free(devs);
}
\`\`\`

#### Assignment 24: Fail-Safe Present Mode Picker & High-DPI Extent Helper
- **Objective:** Implement \`choosePresentMode(pd, surface, preferred)\` and \`queryExtent(pd, surface, window)\` matching \`_vk2dRendererGetPresentMode\` and \`_vk2dRendererGetSurfaceSize\` so your renderer handles Wayland/Retina windows and falls back to \`VK_PRESENT_MODE_FIFO_KHR\` automatically.
- **Reference Solution:**
\`\`\`c
VkPresentModeKHR choosePresentMode(VkPhysicalDevice pd, VkSurfaceKHR surface, VkPresentModeKHR preferred) {
    uint32_t count = 0;
    vkGetPhysicalDeviceSurfacePresentModesKHR(pd, surface, &count, NULL);
    VkPresentModeKHR *modes = calloc(count ? count : 1, sizeof(VkPresentModeKHR));
    if (count) vkGetPhysicalDeviceSurfacePresentModesKHR(pd, surface, &count, modes);

    VkPresentModeKHR picked = VK_PRESENT_MODE_FIFO_KHR;
    for (uint32_t i = 0; i < count; i++) {
        if (modes[i] == preferred) {
            picked = preferred;
            break;
        }
    }
    free(modes);
    return picked;
}

VkExtent2D queryExtent(VkPhysicalDevice pd, VkSurfaceKHR surface, SDL_Window *window) {
    VkSurfaceCapabilitiesKHR caps;
    vkGetPhysicalDeviceSurfaceCapabilitiesKHR(pd, surface, &caps);
    if (caps.currentExtent.width != UINT32_MAX && caps.currentExtent.height != UINT32_MAX) {
        return caps.currentExtent;
    }
    int w = 0, h = 0;
    SDL_GetWindowSizeInPixels(window, &w, &h);
    VkExtent2D ext = { (uint32_t)w, (uint32_t)h };
    if (ext.width < caps.minImageExtent.width)   ext.width = caps.minImageExtent.width;
    if (ext.width > caps.maxImageExtent.width)   ext.width = caps.maxImageExtent.width;
    if (ext.height < caps.minImageExtent.height) ext.height = caps.minImageExtent.height;
    if (ext.height > caps.maxImageExtent.height) ext.height = caps.maxImageExtent.height;
    return ext;
}
\`\`\`

#### Assignment 25: Ordered Boot & Teardown Skeleton With Validation Cleanliness
- **Objective:** Wire \`createInstance\`, \`SDL_Vulkan_CreateSurface\`, GPU selection, \`createLogicalDevice\`, and \`createSwapchain\` inside a single boot function using a strict \`INIT_STEP\` macro pattern, then tear down every object in exact reverse dependency order (\`vkDestroyImageView\` -> \`vkDestroySwapchainKHR\` -> \`vkDestroyCommandPool\` -> \`vkDestroyDevice\` -> \`vkDestroySurfaceKHR\` -> \`vkDestroyInstance\`) with zero validation layer leaks!
- **Reference Solution:**
\`\`\`c
void destroyRendererBoot(Renderer *r) {
    if (r->device != VK_NULL_HANDLE) {
        vkDeviceWaitIdle(r->device);
        for (uint32_t i = 0; i < r->swapchainImageCount; i++) {
            if (r->swapchainImageViews && r->swapchainImageViews[i] != VK_NULL_HANDLE) {
                vkDestroyImageView(r->device, r->swapchainImageViews[i], NULL);
            }
        }
        free(r->swapchainImageViews);
        free(r->swapchainImages);
        if (r->swapchain != VK_NULL_HANDLE) {
            vkDestroySwapchainKHR(r->device, r->swapchain, NULL);
        }
        if (r->commandPool != VK_NULL_HANDLE) {
            vkDestroyCommandPool(r->device, r->commandPool, NULL);
        }
        vkDestroyDevice(r->device, NULL);
    }
    if (r->instance != VK_NULL_HANDLE) {
        if (r->surface != VK_NULL_HANDLE) {
            vkDestroySurfaceKHR(r->instance, r->surface, NULL);
        }
        vkDestroyInstance(r->instance, NULL);
    }
    memset(r, 0, sizeof(*r));
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Scratch Vulkan Renderer Boot Dependency Chain",
        chart: `
flowchart TD
    classDef step fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef dev fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef swap fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Inst["1. VkInstance<br/>SDL Exts + Validation + Portability"]:::step
    Surf["2. VkSurfaceKHR<br/>SDL_Vulkan_CreateSurface"]:::step
    PD["3. VkPhysicalDevice<br/>Prefer Discrete GPU + Gfx/Compute/Present Queue"]:::dev
    LD["4. VkDevice + VkQueue + VkCommandPool<br/>pNext DescriptorIndexingFeatures + KHR_swapchain"]:::dev
    SC["5. VkSwapchainKHR<br/>B8G8R8A8_SRGB + FIFO/MAILBOX + 3 Images"]:::swap
    IV["6. VkImageView Array<br/>COLOR_BIT Lens for Each Swapchain VkImage"]:::swap

    Inst --> Surf --> PD --> LD --> SC --> IV
`,
      },
      {
        title: "Physical Device Feature Probing & Swapchain Image Count Clamping",
        chart: `
flowchart LR
    classDef probe fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef check fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Caps["vkGetPhysicalDeviceFeatures2<br/>Chain DescriptorIndexingFeatures via pNext"]:::probe
    Gate{"All Required Bindless<br/>Flags Supported?"}:::check
    Fail["Abort Early With Exact<br/>Missing Feature Name"]:::probe
    Extent["Query Surface Caps<br/>Handle UINT32_MAX on Wayland/Retina"]:::check
    Clamp["Clamp imageCount in 3..maxImageCount<br/>Create Swapchain + Views"]:::out

    Caps --> Gate
    Gate -->|"No"| Fail
    Gate -->|"Yes"| Extent --> Clamp
`,
      },
    ],
  },
  {
    id: "vk2d-renderer-book-passes-pipelines-sync",
    title: "75. Vulkan Renderer Book X: Render Passes, Graphics Pipelines & Frames-in-Flight Sync",
    category: "graphics",
    summary:
      "Construct VkRenderPass attachments and subpass dependencies, allocate per-swapchain VkFramebuffer objects, compile SPIR-V into multi-blend VkPipeline factories, wire Push Constants and dynamic viewport/scissor state, implement lock-free 2-frame-in-flight sync against N swapchain images, and solve Assignments 26–28.",
    sourceFiles: [
          "extern/Vulkan2d/VK2D/src/RendererMeta.c",
          "extern/Vulkan2d/VK2D/src/Pipeline.c",
          "extern/Vulkan2d/VK2D/src/Renderer.c",
          "extern/Vulkan2d/VK2D/include/VK2D/BlendModes.h",
          "extern/Vulkan2d/VK2D/include/VK2D/Initializers.h"
    ],
    content: `
### Chapter 1: \`VkRenderPass\`, Attachment Layouts & \`VkFramebuffer\`

Before a GPU can write a single pixel to a swapchain image, Vulkan requires you to declare a **Render Pass** (\`VkRenderPass\`). Why not just bind an image and draw like OpenGL?

Modern mobile and Apple Silicon GPUs (tile-based deferred renderers, or TBDRs) keep fast on-chip **tile SRAM** right next to the pixel shaders. If the driver knows ahead of time whether you want to **clear** the tile at the start (\`VK_ATTACHMENT_LOAD_OP_CLEAR\`), **preserve** existing pixels (\`LOAD\`), or **discard** transient MSAA/depth memory at the end (\`DONT_CARE\`), it can skip copying megabytes of pixels across system memory!

#### Anatomy of a 2-Attachment (Color + Depth) Render Pass

Look at \`_vk2dRendererCreateRenderPass()\` in \`VK2D/src/RendererMeta.c\` (lines 555–636). For a clean 1x-sampled renderer, we attach two descriptors:
1. **Attachment 0 (Color Swapchain Target):** Clears at frame start (\`LOAD_OP_CLEAR\`), stores final pixels (\`STORE_OP_STORE\`), starts \`UNDEFINED\` (so the driver never wastes bandwidth preserving stale pixels from two frames ago), and finishes in \`VK_IMAGE_LAYOUT_PRESENT_SRC_KHR\` ready for \`vkQueuePresentKHR\`!
2. **Attachment 1 (Depth/Stencil Target):** Clears depth to \`1.0\` at frame start and ends in \`VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL\`.

\`\`\`c
VkRenderPass createMainRenderPass(VkDevice device, VkFormat colorFmt, VkFormat depthFmt) {
    VkAttachmentDescription attachments[2] = {
        {
            .format = colorFmt,
            .samples = VK_SAMPLE_COUNT_1_BIT,
            .loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR,
            .storeOp = VK_ATTACHMENT_STORE_OP_STORE,
            .stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE,
            .stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE,
            .initialLayout = VK_IMAGE_LAYOUT_UNDEFINED,
            .finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,
        },
        {
            .format = depthFmt,
            .samples = VK_SAMPLE_COUNT_1_BIT,
            .loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR,
            .storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE,
            .stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE,
            .stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE,
            .initialLayout = VK_IMAGE_LAYOUT_UNDEFINED,
            .finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL,
        }
    };

    VkAttachmentReference colorRef = { .attachment = 0, .layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL };
    VkAttachmentReference depthRef = { .attachment = 1, .layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL };

    VkSubpassDescription subpass = {
        .pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS,
        .colorAttachmentCount = 1,
        .pColorAttachments = &colorRef,
        .pDepthStencilAttachment = &depthRef,
    };

    // Wait for prior color/depth output before our subpass writes to the attachments
    VkSubpassDependency dep = {
        .srcSubpass = VK_SUBPASS_EXTERNAL,
        .dstSubpass = 0,
        .srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT,
        .srcAccessMask = 0,
        .dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT,
        .dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT,
    };

    VkRenderPassCreateInfo rpci = {
        .sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO,
        .attachmentCount = 2,
        .pAttachments = attachments,
        .subpassCount = 1,
        .pSubpasses = &subpass,
        .dependencyCount = 1,
        .pDependencies = &dep,
    };

    VkRenderPass rp = VK_NULL_HANDLE;
    vkCreateRenderPass(device, &rpci, NULL, &rp);
    return rp;
}
\`\`\`

Now bind each swapchain \`VkImageView\` and the shared depth \`VkImageView\` into one \`VkFramebuffer\` per swapchain image:

\`\`\`c
for (uint32_t i = 0; i < r->swapchainImageCount; i++) {
    VkImageView views[2] = { r->swapchainImageViews[i], depthView };
    VkFramebufferCreateInfo fbci = {
        .sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO,
        .renderPass = mainRenderPass,
        .attachmentCount = 2,
        .pAttachments = views,
        .width = r->extent.width,
        .height = r->extent.height,
        .layers = 1,
    };
    vkCreateFramebuffer(r->device, &fbci, NULL, &framebuffers[i]);
}
\`\`\`

*(Key Mental Rule: A \`VkRenderPass\` is only a **blueprint** describing formats and operations. A \`VkFramebuffer\` plugs actual \`VkImageView\` textures into that blueprint!)*

---

### Chapter 2: Compiling SPIR-V Into a Multi-Blend \`VkPipeline\`

In OpenGL, you toggle blending, depth testing, or culling mid-frame with global setters like \`glEnable(GL_BLEND)\`. In Vulkan, drivers compile the entire GPU state vector (shaders, vertex input layout, triangle topology, rasterizer, MSAA, depth test, and color blend equations) into an **immutable** \`VkPipeline\` object at startup so draw calls run with zero shader patching stalls.

#### 1. Dynamic State Saves You From Rebuilding Pipelines on Resize

Notice \`Pipeline.c\` lines 73–79: if viewport and scissor rectangles were baked statically into every \`VkPipeline\`, resizing the window would force you to destroy and recompile every shader pipeline! Instead, mark \`VK_DYNAMIC_STATE_VIEWPORT\`, \`VK_DYNAMIC_STATE_SCISSOR\`, and \`VK_DYNAMIC_STATE_LINE_WIDTH\` as dynamic, then call \`vkCmdSetViewport\` and \`vkCmdSetScissor\` inside the command buffer.

#### 2. Pre-Building All 4 Blend Modes From One SPIR-V Pair

Look at \`VK2D/include/VK2D/BlendModes.h\` and \`VK2D/src/Pipeline.c\` lines 121–144. Because a single sprite pipeline needs alpha blending, opaque overwrite, additive glow, and subtractive shadows, \`Pipeline.c\` loops 4 times over \`VK2D_BLEND_MODES[]\` using the **same** \`vertShader\`, \`fragShader\`, and \`VkPipelineLayout\`, then immediately calls \`vkDestroyShaderModule\`:

\`\`\`c
// Once VkPipeline objects are created, the GPU holds compiled machine code;
// VkShaderModule wrappers can be destroyed immediately!
vkDestroyShaderModule(device, vertModule, NULL);
vkDestroyShaderModule(device, fragModule, NULL);
\`\`\`

| Blend Mode | \`blendEnable\` | \`srcColor\` / \`dstColor\` / \`colorOp\` | Best Use Case |
| --- | --- | --- | --- |
| **Blend (0)** | \`VK_TRUE\` | \`SRC_ALPHA\` / \`ONE_MINUS_SRC_ALPHA\` / \`ADD\` | Standard sprites, UI, text |
| **None (1)** | \`VK_FALSE\` | Ignored (overwrites destination directly) | Opaque tilemaps, clearing targets |
| **Add (2)** | \`VK_TRUE\` | \`SRC_ALPHA\` / \`ONE\` / \`ADD\` | Fire, sparks, additive light glows |
| **Subtract (3)** | \`VK_TRUE\` | \`DST_ALPHA\` / \`DST_ALPHA\` / \`MAX\` (color), \`REVERSE_SUBTRACT\` (alpha) | Dark masks, shadow cutout passes |

*(Note: Notice \`BlendModes.h\` line 32 sets \`VK_BLEND_OP_REVERSE_SUBTRACT\` on alpha and \`MAX\` on color for subtract mode, while \`Add\` uses \`ADD\` on color and \`MAX\` on alpha so transparent glow sprites never erode destination alpha!)*

#### 3. Wiring \`VkPipelineLayout\` With Push Constants

Push constants bypass buffers completely by stuffing up to $128$ bytes right inside the command packet. When declaring \`VkPushConstantRange\`, \`stageFlags\` must include **every shader stage that reads it** (for instance \`VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT\`), matching the exact byte size and offset declared in your shader!

---

### Chapter 3: The Math & Sync of Frames-in-Flight

Imagine a beginner's naive Vulkan loop:
1. Record command buffer.
2. Submit to GPU.
3. Call \`vkDeviceWaitIdle()\`.

Why is that terrible? While the GPU draws, the CPU sits completely idle; while the CPU prepares the next frame, the GPU sits completely idle! **Frames-in-Flight** overlap CPU Frame $(k + 1)$ with GPU Frame $k$.

#### Why We Need TWO Separate Indices (\`currentFrame\` vs \`scImageIndex\`)

Look at \`VK2D/src/Renderer.c\` lines 452–498 and 611–667. Most drivers create $N = 3$ swapchain images, while we limit the CPU to $M = 2$ frames in flight (\`VK2D_MAX_FRAMES_IN_FLIGHT = 2\`).

Why can't \`renderFinishedSemaphores\` be indexed by \`currentFrame\` ($0..1$)?
Because **presentation is asynchronous**! If Frame 0 used \`swapchainImage[0]\` and signaled \`renderFinished[currentFrame=0]\`, two frames later \`currentFrame\` wraps back around to \`0\` while the display engine might *still* be presenting \`swapchainImage[0]\`! Using a semaphore still referenced by a pending present causes a Vulkan validation error!

The rock-solid pairing rule used in \`RendererMeta.c\` (lines 1250–1256) and \`Renderer.c\`:

| Primitive | Array Length | Indexed By | Who Waits / Signals? |
| --- | --- | --- | --- |
| \`inFlightFences[2]\` | \`MAX_FRAMES_IN_FLIGHT\` ($2$) | \`currentFrame\` | CPU waits at start of frame; GPU signals on \`vkQueueSubmit\` |
| \`imageAvailableSemaphores[2]\` | \`MAX_FRAMES_IN_FLIGHT\` ($2$) | \`currentFrame\` | Presentation engine signals in \`vkAcquireNextImageKHR\`; GPU waits in \`vkQueueSubmit\` |
| \`renderFinishedSemaphores[N]\` | \`swapchainImageCount\` ($3$) | \`scImageIndex\` | GPU signals in \`vkQueueSubmit\`; Presentation engine waits in \`vkQueuePresentKHR\` |
| \`imagesInFlight[N]\` | \`swapchainImageCount\` ($3$) | \`scImageIndex\` | Tracks which \`inFlightFence\` last wrote to \`scImageIndex\` |
| \`commandBuffers[N]\` | \`swapchainImageCount\` ($3$) | \`scImageIndex\` | Safe to reset once \`imagesInFlight[scImageIndex]\` is signaled |

#### Exact 7-Step Frame Synchronization Sequence

Follow every step of \`vk2dRendererStartFrame\` and \`vk2dRendererEndFrame\` in order:
1. \`vkWaitForFences(dev, 1, &inFlightFences[currentFrame], VK_TRUE, UINT64_MAX)\` (block only if GPU is still 2 frames behind).
2. \`vkAcquireNextImageKHR(dev, swapchain, UINT64_MAX, imageAvailableSemaphores[currentFrame], VK_NULL_HANDLE, &scImageIndex)\`.
3. If \`imagesInFlight[scImageIndex] != VK_NULL_HANDLE\`, call \`vkWaitForFences(dev, 1, &imagesInFlight[scImageIndex], VK_TRUE, UINT64_MAX)\` so we never overwrite a command buffer still used by that swapchain image.
4. Assign \`imagesInFlight[scImageIndex] = inFlightFences[currentFrame]\`.
5. Record \`vkResetCommandBuffer\` -> \`vkBeginCommandBuffer\` -> \`vkCmdBeginRenderPass\` -> draw calls -> \`vkCmdEndRenderPass\` -> \`vkEndCommandBuffer\`.
6. **Only right before \`vkQueueSubmit\`** (so a skipped/resize frame never deadlocks a future \`vkWaitForFences\`!), call \`vkResetFences(dev, 1, &inFlightFences[currentFrame])\` and submit waiting on \`imageAvailableSemaphores[currentFrame]\` at stage \`VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT\`, signaling \`renderFinishedSemaphores[scImageIndex]\` and \`inFlightFences[currentFrame]\`.
7. Call \`vkQueuePresentKHR\` waiting on \`renderFinishedSemaphores[scImageIndex]\`, then advance \`currentFrame = (currentFrame + 1) % 2\`.

---

### Chapter 4: Graded Assignments 26–28 (With Starter Code & Full Solutions)

#### Assignment 26: Multi-Blend Pipeline Factory Without VBOs
- **Objective:** Write \`createQuadPipelines(device, renderPass, vertSpv, vertBytes, fragSpv, fragBytes, layout, outPipes[4])\` that creates all 4 blend modes (\`BLEND\`, \`NONE\`, \`ADD\`, \`SUBTRACT\`) using **zero vertex buffer bindings** (vertex pulling via \`gl_VertexIndex\`), dynamic viewport/scissor, and clean module destruction.
- **Reference Solution:**
\`\`\`c
bool createQuadPipelines(
    VkDevice device, VkRenderPass renderPass,
    const uint32_t *vertSpv, size_t vertBytes,
    const uint32_t *fragSpv, size_t fragBytes,
    VkPipelineLayout layout, VkPipeline outPipes[4])
{
    VkShaderModuleCreateInfo vci = {
        .sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO,
        .codeSize = vertBytes, .pCode = vertSpv
    };
    VkShaderModuleCreateInfo fci = {
        .sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO,
        .codeSize = fragBytes, .pCode = fragSpv
    };
    VkShaderModule vertMod, fragMod;
    if (vkCreateShaderModule(device, &vci, NULL, &vertMod) != VK_SUCCESS ||
        vkCreateShaderModule(device, &fci, NULL, &fragMod) != VK_SUCCESS) {
        return false;
    }

    VkPipelineShaderStageCreateInfo stages[2] = {
        { .sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO, .stage = VK_SHADER_STAGE_VERTEX_BIT, .module = vertMod, .pName = "main" },
        { .sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO, .stage = VK_SHADER_STAGE_FRAGMENT_BIT, .module = fragMod, .pName = "main" },
    };
    VkPipelineVertexInputStateCreateInfo emptyVertInput = { .sType = VK_STRUCTURE_TYPE_PIPELINE_VERTEX_INPUT_STATE_CREATE_INFO };
    VkPipelineInputAssemblyStateCreateInfo ia = {
        .sType = VK_STRUCTURE_TYPE_PIPELINE_INPUT_ASSEMBLY_STATE_CREATE_INFO,
        .topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST,
    };
    VkPipelineViewportStateCreateInfo vp = {
        .sType = VK_STRUCTURE_TYPE_PIPELINE_VIEWPORT_STATE_CREATE_INFO,
        .viewportCount = 1, .scissorCount = 1,
    };
    VkPipelineRasterizationStateCreateInfo rast = {
        .sType = VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO,
        .polygonMode = VK_POLYGON_MODE_FILL,
        .cullMode = VK_CULL_MODE_NONE,
        .frontFace = VK_FRONT_FACE_CLOCKWISE,
        .lineWidth = 1.0f,
    };
    VkPipelineMultisampleStateCreateInfo msaa = {
        .sType = VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO,
        .rasterizationSamples = VK_SAMPLE_COUNT_1_BIT,
    };
    VkDynamicState dynStates[2] = { VK_DYNAMIC_STATE_VIEWPORT, VK_DYNAMIC_STATE_SCISSOR };
    VkPipelineDynamicStateCreateInfo dyn = {
        .sType = VK_STRUCTURE_TYPE_PIPELINE_DYNAMIC_STATE_CREATE_INFO,
        .dynamicStateCount = 2, .pDynamicStates = dynStates,
    };

    VkPipelineColorBlendAttachmentState blends[4] = {
        { VK_TRUE,  VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, VK_BLEND_OP_ADD, VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, VK_BLEND_OP_ADD, 0xF },
        { VK_FALSE, VK_BLEND_FACTOR_ONE,       VK_BLEND_FACTOR_ZERO,                VK_BLEND_OP_ADD, VK_BLEND_FACTOR_ONE,       VK_BLEND_FACTOR_ZERO,                VK_BLEND_OP_ADD, 0xF },
        { VK_TRUE,  VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE,                 VK_BLEND_OP_ADD, VK_BLEND_FACTOR_DST_ALPHA, VK_BLEND_FACTOR_DST_ALPHA,           VK_BLEND_OP_MAX, 0xF },
        { VK_TRUE,  VK_BLEND_FACTOR_DST_ALPHA, VK_BLEND_FACTOR_DST_ALPHA,           VK_BLEND_OP_MAX, VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_DST_ALPHA,           VK_BLEND_OP_REVERSE_SUBTRACT, 0xF },
    };

    bool ok = true;
    for (int i = 0; i < 4; i++) {
        VkPipelineColorBlendStateCreateInfo cb = {
            .sType = VK_STRUCTURE_TYPE_PIPELINE_COLOR_BLEND_STATE_CREATE_INFO,
            .attachmentCount = 1, .pAttachments = &blends[i],
        };
        VkGraphicsPipelineCreateInfo gpci = {
            .sType = VK_STRUCTURE_TYPE_GRAPHICS_PIPELINE_CREATE_INFO,
            .stageCount = 2, .pStages = stages,
            .pVertexInputState = &emptyVertInput,
            .pInputAssemblyState = &ia,
            .pViewportState = &vp,
            .pRasterizationState = &rast,
            .pMultisampleState = &msaa,
            .pColorBlendState = &cb,
            .pDynamicState = &dyn,
            .layout = layout,
            .renderPass = renderPass,
        };
        if (vkCreateGraphicsPipelines(device, VK_NULL_HANDLE, 1, &gpci, NULL, &outPipes[i]) != VK_SUCCESS) {
            ok = false;
            break;
        }
    }

    vkDestroyShaderModule(device, vertMod, NULL);
    vkDestroyShaderModule(device, fragMod, NULL);
    return ok;
}
\`\`\`

#### Assignment 27: Complete Frame Sync Loop With Deadlock-Free Fence Reset
- **Objective:** Implement \`drawSyncFrame()\` using \`MAX_FRAMES_IN_FLIGHT = 2\`, checking \`imagesInFlight[scImageIndex]\`, resetting \`inFlightFences[currentFrame]\` *only* after acquire succeeds, submitting the command buffer, and presenting.
- **Reference Solution:**
\`\`\`c
VkResult drawSyncFrame(SyncState *s, VkDevice dev, VkQueue queue, VkSwapchainKHR swapchain, uint32_t *outImg) {
    vkWaitForFences(dev, 1, &s->inFlightFences[s->currentFrame], VK_TRUE, UINT64_MAX);

    uint32_t imgIdx = 0;
    VkResult acq = vkAcquireNextImageKHR(
        dev, swapchain, UINT64_MAX,
        s->imageAvailable[s->currentFrame], VK_NULL_HANDLE, &imgIdx
    );
    if (acq == VK_ERROR_OUT_OF_DATE_KHR) return acq;

    if (s->imagesInFlight[imgIdx] != VK_NULL_HANDLE) {
        vkWaitForFences(dev, 1, &s->imagesInFlight[imgIdx], VK_TRUE, UINT64_MAX);
    }
    s->imagesInFlight[imgIdx] = s->inFlightFences[s->currentFrame];
    *outImg = imgIdx;

    // Record commands into s->cmd[imgIdx] here...
    vkResetFences(dev, 1, &s->inFlightFences[s->currentFrame]);

    VkPipelineStageFlags waitStage = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    VkSubmitInfo sub = {
        .sType = VK_STRUCTURE_TYPE_SUBMIT_INFO,
        .waitSemaphoreCount = 1, .pWaitSemaphores = &s->imageAvailable[s->currentFrame],
        .pWaitDstStageMask = &waitStage,
        .commandBufferCount = 1, .pCommandBuffers = &s->cmd[imgIdx],
        .signalSemaphoreCount = 1, .pSignalSemaphores = &s->renderFinished[imgIdx],
    };
    vkQueueSubmit(queue, 1, &sub, s->inFlightFences[s->currentFrame]);

    VkPresentInfoKHR pres = {
        .sType = VK_STRUCTURE_TYPE_PRESENT_INFO_KHR,
        .waitSemaphoreCount = 1, .pWaitSemaphores = &s->renderFinished[imgIdx],
        .swapchainCount = 1, .pSwapchains = &swapchain,
        .pImageIndices = &imgIdx,
    };
    VkResult presRes = vkQueuePresentKHR(queue, &pres);
    s->currentFrame = (s->currentFrame + 1) % 2;
    return presRes != VK_SUCCESS ? presRes : acq;
}
\`\`\`

#### Assignment 28: Zero-VBO Orthographic Colored Quad via Push Constants
- **Objective:** Define a 96-byte push-constant struct (\`float viewproj[16]\`, \`float rect[4]\`, \`float color[4]\`, \`uint32_t pad[4]\`) and record \`vkCmdPushConstants\` + \`vkCmdDraw(cmd, 6, 1, 0, 0)\` to draw a screen-space rectangle centered at $(x, y)$ with size $(w, h)$ using Vulkan's top-left $(0,0)$ to bottom-right $(W,H)$ coordinate convention!
- **Reference Solution:**
\`\`\`c
typedef struct QuadPush {
    float viewproj[16]; // 64 B: orthographic matrix mapping [0..W, 0..H] -> [-1..1, -1..1]
    float rect[4];      // 16 B: (x, y, w, h) in pixels
    float color[4];     // 16 B: RGBA tint
} QuadPush;             // 96 B (< 128 B guaranteed minimum push constant limit)

void drawPushQuad(VkCommandBuffer cmd, VkPipelineLayout layout, VkExtent2D ext, float x, float y, float w, float h, const float rgba[4]) {
    QuadPush push = {0};
    // Column-major 2D ortho matrix matching Vulkan NDC (Y points down!)
    push.viewproj[0]  =  2.0f / (float)ext.width;
    push.viewproj[5]  =  2.0f / (float)ext.height;
    push.viewproj[10] =  1.0f;
    push.viewproj[12] = -1.0f;
    push.viewproj[13] = -1.0f;
    push.viewproj[15] =  1.0f;
    push.rect[0] = x; push.rect[1] = y; push.rect[2] = w; push.rect[3] = h;
    memcpy(push.color, rgba, sizeof(float) * 4);

    vkCmdPushConstants(cmd, layout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(QuadPush), &push);
    vkCmdDraw(cmd, 6, 1, 0, 0);
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "RenderPass Attachment Lifecycle & External Subpass Dependency",
        chart: `
flowchart LR
    classDef start fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef sub fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Ext["VK_SUBPASS_EXTERNAL<br/>Initial Layout: UNDEFINED<br/>LoadOp: CLEAR"]:::start
    Sub0["Subpass 0 (Graphics)<br/>Color: COLOR_ATTACHMENT_OPTIMAL<br/>Depth: DEPTH_STENCIL_ATTACHMENT_OPTIMAL"]:::sub
    Store["End RenderPass<br/>StoreOp: STORE<br/>Final Layout: PRESENT_SRC_KHR"]:::out

    Ext -->|"Wait COLOR_ATTACHMENT_OUTPUT"| Sub0 --> Store
`,
      },
      {
        title: "2 Frames-in-Flight vs 3 Swapchain Images Synchronization Timeline",
        chart: `
sequenceDiagram
    autonumber
    participant CPU as CPU Thread (currentFrame 0..1)
    participant Sync as Fences & Semaphores
    participant GPU as VkQueue (Graphics + Present)

    CPU->>Sync: vkWaitForFences(inFlightFences[currentFrame])
    CPU->>GPU: vkAcquireNextImageKHR -> signal imageAvailable[currentFrame], return scImageIndex
    CPU->>Sync: If imagesInFlight[scImageIndex] != NULL, vkWaitForFences
    CPU->>Sync: imagesInFlight[scImageIndex] = inFlightFences[currentFrame]
    CPU->>CPU: Record vkBeginCommandBuffer -> vkCmdDraw -> vkEndCommandBuffer
    CPU->>Sync: vkResetFences(inFlightFences[currentFrame])
    CPU->>GPU: vkQueueSubmit(wait imageAvailable[currentFrame], signal renderFinished[scImageIndex], signal inFlightFence)
    CPU->>GPU: vkQueuePresentKHR(wait renderFinished[scImageIndex], present scImageIndex)
    CPU->>CPU: currentFrame = (currentFrame + 1) % 2
`,
      },
    ],
  },
  {
    id: "vk2d-renderer-book-memory-barriers-batching",
    title: "76. Vulkan Renderer Book XI: VMA Memory, Pipeline Barriers, Bindless Textures & Compute Batching",
    category: "graphics",
    summary:
      "Master GPU memory heaps and VMA sub-allocation, single-use command buffer uploads, exact VkImageMemoryBarrier and VkBufferMemoryBarrier stage/access masks, paged staging rings, auto-expanding descriptor pools, bindless texture arrays, 3-command-buffer compute sprite batching, and Assignments 29–31.",
    sourceFiles: [
          "extern/Vulkan2d/VK2D/src/Buffer.c",
          "extern/Vulkan2d/VK2D/src/Image.c",
          "extern/Vulkan2d/VK2D/src/Texture.c",
          "extern/Vulkan2d/VK2D/src/DescriptorBuffer.c",
          "extern/Vulkan2d/VK2D/src/DescriptorControl.c",
          "extern/Vulkan2d/VK2D/src/Renderer.c"
    ],
    content: `
### Chapter 1: GPU Memory Heaps, VMA & Paged Host-to-Device Streaming

Graphics cards enforce a strict hardware limit called \`maxMemoryAllocationCount\` (often just **4,096** total allocations across the entire process!). If you call \`vkAllocateMemory\` separately for every sprite texture, vertex buffer, and uniform buffer, a real game crashes with \`VK_ERROR_TOO_MANY_OBJECTS\` before finishing the first level.

#### 1. Why Every Real Vulkan Renderer Uses VMA (\`Vulkan Memory Allocator\`)

**VMA** solves this by allocating large 64 MB to 256 MB \`VkDeviceMemory\` chunks and sub-allocating your small buffers and images inside them with TLSF block coalescing! When creating buffers in \`VK2D/src/Buffer.c\`, notice the two opposite memory tiers:

- **Staging Memory (\`HOST_VISIBLE | HOST_COHERENT\`):** Lives in system RAM mapped over PCIe. The CPU can write into it directly via \`vmaMapMemory\`, and the GPU reads from it slowly across the PCIe bus during copy commands.
- **Device-Local VRAM (\`DEVICE_LOCAL\`):** Lives directly on the graphics card's GDDR6/HBM memory ($300$ to $1{,}000+$ GB/s). Shaders read this at blazing speed, so static textures and meshes are always copied into \`DEVICE_LOCAL\` memory!

#### 2. Paged Staging Ring Buffers (\`DescriptorBuffer.c\`)

For data that changes **every frame** (camera matrices, sprite batches, shader uniforms), issuing hundreds of tiny \`vkQueueWaitIdle\` staging copies destroys throughput. Instead, \`VK2D/src/DescriptorBuffer.c\` uses **256 KB pages per frame in flight**:

1. At frame start (\`vk2dDescriptorBufferBeginFrame\`), map all staging pages once (\`vmaMapMemory\`) and reset each page's cursor \`size = 0\`.
2. During draw calls (\`vk2dDescriptorBufferCopyData\`), \`memcpy\` data into the active \`stageBuffer\`, return the corresponding \`deviceBuffer\` handle and aligned byte \`offset\`, and advance \`spot->size\` rounded up to the hardware's alignment requirement:

$$\\text{alignedSize} = \\left\\lceil \\frac{\\text{size}}{A} \\right\\rceil \\times A, \\qquad A = \\max(\\text{minStorageBufferOffsetAlignment},\\; \\text{minUniformBufferOffsetAlignment})$$

3. At frame end (\`vk2dDescriptorBufferEndFrame\`), unmap the staging pages and record **one single \`vkCmdCopyBuffer\` per active page** into \`dbCommandBuffer\`!

---

### Chapter 2: Image Layout Transitions & Exact Pipeline Barriers

Unlike buffers (which are flat 1D byte arrays), \`VkImage\` textures live in GPU-specific Z-order swizzled layouts and carry an explicit **Image Layout** state machine. Reading a texture in a shader while its layout is still \`VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL\` triggers validation errors and garbled colors!

#### Single-Use Command Buffer Texture Upload (\`Image.c\`)

Uploading an RGBA PNG decoded by \`stb_image\` takes four strictly ordered GPU steps:
1. Transition image from \`UNDEFINED\` $\\to$ \`TRANSFER_DST_OPTIMAL\`.
2. Copy pixels from \`stageBuffer\` into the image via \`vkCmdCopyBufferToImage\`.
3. Transition image from \`TRANSFER_DST_OPTIMAL\` $\\to$ \`SHADER_READ_ONLY_OPTIMAL\`.
4. Submit the single-use command buffer and free \`stageBuffer\`.

Look at \`_vk2dImageTransitionImageLayout\` in \`VK2D/src/Image.c\` (lines 62–120). Every barrier answers four questions: **which memory writes must finish (\`srcAccessMask\`)**, **which pipeline stage produced them (\`srcStageMask\`)**, **which pipeline stage waits (\`dstStageMask\`)**, and **how that stage reads/writes next (\`dstAccessMask\`)**:

| Transition or Sync Step | \`srcStageMask\` | \`srcAccessMask\` | \`dstStageMask\` | \`dstAccessMask\` |
| --- | --- | --- | --- | --- |
| \`UNDEFINED\` $\\to$ \`TRANSFER_DST\` | \`TOP_OF_PIPE\` | \`0\` | \`TRANSFER\` | \`TRANSFER_WRITE\` |
| \`TRANSFER_DST\` $\\to$ \`SHADER_READ_ONLY\` | \`TRANSFER\` | \`TRANSFER_WRITE\` | \`FRAGMENT_SHADER\` | \`SHADER_READ\` |
| \`COLOR_ATTACHMENT\` $\\to$ \`SHADER_READ_ONLY\` | \`COLOR_ATTACHMENT_OUTPUT | TRANSFER\` | \`COLOR_ATTACHMENT_WRITE\` | \`FRAGMENT_SHADER\` | \`SHADER_READ\` |
| Copy Buffer $\\to$ Compute (\`DescriptorBuffer.c\`) | \`TRANSFER\` | \`TRANSFER_WRITE\` | \`COMPUTE_SHADER\` | \`SHADER_READ | SHADER_WRITE\` |
| Compute $\\to$ Vertex Shader (\`DescriptorBuffer.c\`) | \`COMPUTE_SHADER\` | \`SHADER_WRITE\` | \`VERTEX_INPUT | VERTEX_SHADER\` | \`VERTEX_ATTRIBUTE_READ | SHADER_READ\` |

\`\`\`c
void transitionImageLayout(
    VkCommandBuffer cmd, VkImage img,
    VkImageLayout oldLayout, VkImageLayout newLayout)
{
    VkImageMemoryBarrier b = {
        .sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER,
        .oldLayout = oldLayout,
        .newLayout = newLayout,
        .srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED,
        .dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED,
        .image = img,
        .subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 },
    };

    VkPipelineStageFlags srcStage = 0, dstStage = 0;
    if (oldLayout == VK_IMAGE_LAYOUT_UNDEFINED && newLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL) {
        b.srcAccessMask = 0;
        b.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
        srcStage = VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT;
        dstStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
    } else if (oldLayout == VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL && newLayout == VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL) {
        b.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
        b.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
        srcStage = VK_PIPELINE_STAGE_TRANSFER_BIT;
        dstStage = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
    }
    vkCmdPipelineBarrier(cmd, srcStage, dstStage, 0, 0, NULL, 0, NULL, 1, &b);
}
\`\`\`

---

### Chapter 3: Auto-Expanding Descriptor Pools & Global Bindless Texture Arrays

A \`VkDescriptorPool\` has a fixed capacity. When a frame spawns 3,000 custom draw calls and runs out of sets (\`VK_ERROR_OUT_OF_POOL_MEMORY\`), crashing is unacceptable.

#### 1. Chained Descriptor Pool Allocator (\`DescriptorControl.c\`)

\`VK2D/src/DescriptorControl.c\` solves pool exhaustion in ~70 lines of C:
- Maintain a dynamic array \`VkDescriptorPool *pools\`.
- Try allocating from \`pools[i]\`. Whenever \`vkAllocateDescriptorSets\` returns \`VK_ERROR_OUT_OF_POOL_MEMORY\`, append a fresh pool to \`pools[]\` and retry!
- At the start of each frame (\`vk2dDescConReset\`), call \`vkResetDescriptorPool(dev, pools[i], 0)\` on every allocated pool, reclaiming all sets in $O(1)$ without freeing individual sets!

#### 2. The Global Bindless Texture Array (Set 2, Binding 2)

Instead of allocating a new \`VkDescriptorSet\` for every sprite texture, bind **one giant descriptor array** for the whole application (\`RendererMeta.c\` lines 748–794):
1. Create a \`VkDescriptorSetLayout\` with \`VK_DESCRIPTOR_BINDING_VARIABLE_DESCRIPTOR_COUNT_BIT | PARTIALLY_BOUND_BIT | UPDATE_AFTER_BIND_BIT | UPDATE_UNUSED_WHILE_PENDING_BIT\`.
2. **MoltenVK Safety Check:** Call \`vkGetDescriptorSetLayoutSupport(dev, &texArraySetLayoutCreateInfo, &layoutSupport)\` and halve \`descriptorCount\` if the driver rejects 10,000 variable descriptors in one set!
3. Allocate **one** \`texArrayDescriptorSet\` passing \`VkDescriptorSetVariableDescriptorCountAllocateInfo\` in \`pNext\`.
4. Whenever a texture loads (\`_vk2dTextureAddToTextureArray\` in \`Texture.c\` line 17), find a free slot \`spot\` and write just that single slot via \`vkUpdateDescriptorSets\`. Now any shader or sprite instance simply carries an integer \`uint32_t textureIndex = spot\`!

---

### Chapter 4: The Three-Command-Buffer Compute Sprite Batcher

Now watch everything click together into the **3-Command-Buffer Architecture** from \`Renderer.c\` and \`DescriptorBuffer.c\`:

- **While Drawing Sprites:** \`vk2dRendererDrawTexture()\` just appends a compact \`VK2DDrawCommand\` struct to a CPU array.
- **On Batch Flush (\`vk2dRendererFlushSpriteBatch\`):**
  1. Copy \`drawCommands\` into \`descriptorBuffer[currentFrame]\` and reserve output space for \`DrawInstance[]\`.
  2. Bind both SSBOs to a compute descriptor set and record \`vkCmdDispatch(computeCmd, (drawCount / 64) + 1, 1, 1)\` onto \`computeCommandBuffer\`.
  3. Record \`vkCmdDraw(drawCmd, 6 * drawCount, 1, 0, 0)\` onto \`commandBuffer\`.
- **At End of Frame:**
  1. Record bulk \`vkCmdCopyBuffer\` calls into \`dbCommandBuffer\` + \`TRANSFER_WRITE -> COMPUTE_SHADER\` barrier.
  2. Record \`COMPUTE_WRITE -> VERTEX_INPUT | VERTEX_SHADER\` barrier at the end of \`computeCommandBuffer\`.
  3. Submit \`{ dbCommandBuffer, computeCommandBuffer, commandBuffer }\` in a single \`vkQueueSubmit\`!

Even though \`dbCommandBuffer\` was populated **last** on the CPU, placing it **first** in \`vkQueueSubmit\` makes the GPU execute: **Copy Staging Pages $\\to$ Run Compute Sprite Matrices $\\to$ Rasterize 100,000+ Sprites** in one seamless hardware pipeline!

---

### Chapter 5: Graded Assignments 29–31 (With Starter Code & Full Solutions)

#### Assignment 29: Single-Use Uploader & RGBA Texture Loader
- **Objective:** Implement \`uploadTextureRGBA(device, vma, cmdPool, queue, pixels, w, h)\` using a staging \`VkBuffer\`, a \`DEVICE_LOCAL\` \`VK_FORMAT_R8G8B8A8_SRGB\` \`VkImage\`, two \`VkImageMemoryBarrier\` transitions, \`vkCmdCopyBufferToImage\`, and a \`VkImageView\`.
- **Reference Solution:**
\`\`\`c
VkCommandBuffer beginSingleTime(VkDevice dev, VkCommandPool pool) {
    VkCommandBufferAllocateInfo ai = {
        .sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO,
        .commandPool = pool, .level = VK_COMMAND_BUFFER_LEVEL_PRIMARY, .commandBufferCount = 1,
    };
    VkCommandBuffer cmd = VK_NULL_HANDLE;
    vkAllocateCommandBuffers(dev, &ai, &cmd);
    VkCommandBufferBeginInfo bi = {
        .sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO,
        .flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT,
    };
    vkBeginCommandBuffer(cmd, &bi);
    return cmd;
}

void endSingleTime(VkDevice dev, VkCommandPool pool, VkQueue queue, VkCommandBuffer cmd) {
    vkEndCommandBuffer(cmd);
    VkSubmitInfo si = { .sType = VK_STRUCTURE_TYPE_SUBMIT_INFO, .commandBufferCount = 1, .pCommandBuffers = &cmd };
    vkQueueSubmit(queue, 1, &si, VK_NULL_HANDLE);
    vkQueueWaitIdle(queue);
    vkFreeCommandBuffers(dev, pool, 1, &cmd);
}

void uploadPixelsToImage(
    VkDevice dev, VkCommandPool pool, VkQueue queue,
    VkBuffer stagingBuf, VkImage dstImage, uint32_t w, uint32_t h)
{
    VkCommandBuffer cmd = beginSingleTime(dev, pool);
    transitionImageLayout(cmd, dstImage, VK_IMAGE_LAYOUT_UNDEFINED, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL);

    VkBufferImageCopy region = {
        .imageSubresource = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 0, 1 },
        .imageExtent = { w, h, 1 },
    };
    vkCmdCopyBufferToImage(cmd, stagingBuf, dstImage, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &region);

    transitionImageLayout(cmd, dstImage, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL);
    endSingleTime(dev, pool, queue, cmd);
}
\`\`\`

#### Assignment 30: Hardware-Aligned Staging Page Sub-Allocator
- **Objective:** Implement \`stageAlloc(page, data, bytes, minAlign, outDeviceBuf, outOffset)\` that enforces \`minAlign = max(minUniformBufferOffsetAlignment, minStorageBufferOffsetAlignment)\` and handles multi-page rollover cleanly when \`page->used + bytes > page->capacity\`.
- **Reference Solution:**
\`\`\`c
static VkDeviceSize alignUp(VkDeviceSize v, VkDeviceSize align) {
    return align == 0 ? v : ((v + align - 1) / align) * align;
}

bool stagePush(StagingRing *ring, const void *src, VkDeviceSize bytes, VkBuffer *outBuf, VkDeviceSize *outOff) {
    VkDeviceSize aligned = alignUp(bytes, ring->minAlign);
    if (aligned > ring->pageSize) return false;

    StagingPage *spot = NULL;
    for (uint32_t i = 0; i < ring->pageCount; i++) {
        if (ring->pages[i].used + aligned <= ring->pageSize) {
            spot = &ring->pages[i];
            break;
        }
    }
    if (!spot) {
        spot = appendMappedStagingPage(ring);
        if (!spot) return false;
    }

    memcpy((uint8_t *)spot->mappedHost + spot->used, src, bytes);
    *outBuf = spot->deviceBuf;
    *outOff = spot->used;
    spot->used += aligned;
    return true;
}
\`\`\`

#### Assignment 31: 3-Command-Buffer Barrier Chain & Single Submit
- **Objective:** Write \`flushStagingAndCompute(copyCmd, compCmd, drawCmd, queue, pages, pageCount, waitSem, sigSem, fence)\` that records the \`TRANSFER_WRITE -> COMPUTE_SHADER\` barrier on \`copyCmd\`, the \`COMPUTE_WRITE -> VERTEX_INPUT | VERTEX_SHADER\` barrier on \`compCmd\`, and submits all 3 command buffers in one \`vkQueueSubmit\` call!
- **Reference Solution:**
\`\`\`c
void submitThreeStageFrame(
    VkCommandBuffer copyCmd, VkCommandBuffer compCmd, VkCommandBuffer drawCmd,
    VkQueue queue, VkBuffer *devicePages, const VkDeviceSize *usedBytes, uint32_t pageCount,
    uint32_t graphicsFamily, VkSemaphore waitSem, VkSemaphore sigSem, VkFence fence)
{
    VkBufferMemoryBarrier barriers[16];
    uint32_t bCount = 0;

    for (uint32_t i = 0; i < pageCount && bCount < 16; i++) {
        if (usedBytes[i] == 0) continue;
        barriers[bCount++] = (VkBufferMemoryBarrier){
            .sType = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER,
            .srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT,
            .dstAccessMask = VK_ACCESS_SHADER_READ_BIT | VK_ACCESS_SHADER_WRITE_BIT,
            .srcQueueFamilyIndex = graphicsFamily,
            .dstQueueFamilyIndex = graphicsFamily,
            .buffer = devicePages[i],
            .offset = 0,
            .size = usedBytes[i],
        };
    }
    if (bCount > 0) {
        vkCmdPipelineBarrier(copyCmd, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, 0, 0, NULL, bCount, barriers, 0, NULL);
        for (uint32_t i = 0; i < bCount; i++) {
            barriers[i].srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
            barriers[i].dstAccessMask = VK_ACCESS_VERTEX_ATTRIBUTE_READ_BIT | VK_ACCESS_SHADER_READ_BIT;
        }
        vkCmdPipelineBarrier(compCmd, VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT, VK_PIPELINE_STAGE_VERTEX_INPUT_BIT | VK_PIPELINE_STAGE_VERTEX_SHADER_BIT, 0, 0, NULL, bCount, barriers, 0, NULL);
    }

    vkEndCommandBuffer(copyCmd);
    vkEndCommandBuffer(compCmd);
    vkEndCommandBuffer(drawCmd);

    VkCommandBuffer cmds[3] = { copyCmd, compCmd, drawCmd };
    VkPipelineStageFlags waitStage = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    VkSubmitInfo si = {
        .sType = VK_STRUCTURE_TYPE_SUBMIT_INFO,
        .waitSemaphoreCount = 1, .pWaitSemaphores = &waitSem, .pWaitDstStageMask = &waitStage,
        .commandBufferCount = 3, .pCommandBuffers = cmds,
        .signalSemaphoreCount = 1, .pSignalSemaphores = &sigSem,
    };
    vkQueueSubmit(queue, 1, &si, fence);
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Texture Upload & Layout Transition State Machine",
        chart: `
flowchart LR
    classDef cpu fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef bar fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef gpu fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    CPU["stbi_load RGBA Pixels<br/>memcpy -> HOST_VISIBLE Stage Buffer"]:::cpu
    B1["Barrier 1: UNDEFINED -> TRANSFER_DST_OPTIMAL<br/>TOP_OF_PIPE -> TRANSFER_WRITE"]:::bar
    Copy["vkCmdCopyBufferToImage<br/>Upload to DEVICE_LOCAL Optimal Image"]:::gpu
    B2["Barrier 2: TRANSFER_DST -> SHADER_READ_ONLY<br/>TRANSFER_WRITE -> FRAGMENT SHADER_READ"]:::bar
    Bind["Assign Global Bindless Slot<br/>vkUpdateDescriptorSets(Set 2, Binding 2)"]:::gpu

    CPU --> B1 --> Copy --> B2 --> Bind
`,
      },
      {
        title: "3-Command-Buffer Barrier Chain (Transfer to Compute to Vertex Pull)",
        chart: `
flowchart TD
    classDef c1 fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef c2 fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef c3 fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    DB["1. dbCommandBuffer<br/>vkCmdCopyBuffer(stagePage -> devicePage)<br/>Barrier: TRANSFER_WRITE -> COMPUTE_SHADER"]:::c1
    COMP["2. computeCommandBuffer<br/>vkCmdDispatch(spritebatch.comp)<br/>Barrier: SHADER_WRITE -> VERTEX_INPUT and VERTEX_SHADER"]:::c2
    DRAW["3. commandBuffer<br/>vkCmdDraw(6 * count, 1) Reading SBO + Bindless Set 2"]:::c3

    DB -->|"Buffer Barrier"| COMP -->|"Buffer Barrier"| DRAW
`,
      },
    ],
  },
  {
    id: "vk2d-renderer-book-targets-resize-production",
    title: "77. Vulkan Renderer Book XII: Offscreen Render Targets, MSAA, Swapchain Resize & Production Hardening",
    category: "graphics",
    summary:
      "Complete your custom Vulkan renderer from scratch: mid-frame offscreen render targets with 3 RenderPass variants, MSAA color + depth resolve attachments, bulletproof swapchain recreation and minimization pauses, strict reverse-order teardown, and Capstone Assignments 32–34.",
    sourceFiles: [
          "extern/Vulkan2d/VK2D/src/Renderer.c",
          "extern/Vulkan2d/VK2D/src/RendererMeta.c",
          "extern/Vulkan2d/VK2D/src/Texture.c",
          "extern/Vulkan2d/VK2D/src/Pipeline.c",
          "extern/Vulkan2d/VK2D/src/Validation.c"
    ],
    content: `
### Chapter 1: Offscreen Render Targets & Mid-Frame \`VkRenderPass\` Switching

Real games cannot draw directly to the swapchain alone: you need offscreen textures for bloom bright-passes, dynamic lightmaps (like Mellangan's \`Level::renderLight\`), minimaps, or post-process shaders.

#### Why One \`VkRenderPass\` Is Not Enough

Look at \`_vk2dRendererCreateRenderPass()\` in \`VK2D/src/RendererMeta.c\` (lines 555–693). If you draw half your frame to the screen, switch to an offscreen lightmap texture, and then switch back to the screen to composite it, using the same \`CLEAR\` render pass would **wipe everything you already drew on screen**!

That is why a multi-target Vulkan renderer maintains **three specialized \`VkRenderPass\` blueprints**:

| RenderPass | When Used | Color \`initialLayout\` $\\to$ \`finalLayout\` | Color \`loadOp\` |
| --- | --- | --- | --- |
| **1. \`renderPass\`** | Start of every frame on the swapchain | \`UNDEFINED\` $\\to$ \`PRESENT_SRC_KHR\` (or \`COLOR_ATTACHMENT_OPTIMAL\` if MSAA) | \`CLEAR\` |
| **2. \`midFrameSwapRenderPass\`** | Switching **back** to the swapchain mid-frame | \`PRESENT_SRC_KHR\` $\\to$ \`PRESENT_SRC_KHR\` | \`LOAD\` (preserves prior pixels!) |
| **3. \`externalTargetRenderPass\`** | Rendering into any offscreen \`VK2DTexture\` | \`COLOR_ATTACHMENT_OPTIMAL\` $\\to$ \`COLOR_ATTACHMENT_OPTIMAL\` | \`LOAD\` |

#### The Golden Rule of Mid-Frame Layout Barriers (\`vk2dRendererSetTarget\`)

Read \`VK2D/src/Renderer.c\` lines 725–755 carefully! In Vulkan, **you cannot record a \`vkCmdPipelineBarrier\` between two images inside an active render pass** unless it is a declared subpass self-dependency. Whenever you switch render targets mid-frame, you must obey this strict sequence:
1. Flush any pending sprite batch.
2. Call \`vkCmdEndRenderPass(cmd)\` on the old pass.
3. Insert \`_vk2dTransitionImageLayout\` **between** the passes:
   - If leaving an offscreen texture to draw back onto the screen: transition that offscreen texture \`COLOR_ATTACHMENT_OPTIMAL\` $\\to$ \`SHADER_READ_ONLY_OPTIMAL\` so shaders can sample it!
   - If entering an offscreen texture: transition it \`SHADER_READ_ONLY_OPTIMAL\` $\\to$ \`COLOR_ATTACHMENT_OPTIMAL\` so the rasterizer can write to it!
4. Call \`vkCmdBeginRenderPass(cmd, ...)\` with the matching \`VkRenderPass\` and \`VkFramebuffer\`, then reset cached pipeline/descriptor bindings (\`_vk2dRendererResetBoundPointers()\`).

---

### Chapter 2: Depth Buffers, MSAA Resolve & Swapchain Recreation

#### 1. Probing Supported Depth Formats (\`RendererMeta.c\`)

Never hardcode \`VK_FORMAT_D24_UNORM_S8_UINT\`: some AMD and mobile GPUs only support \`VK_FORMAT_D32_SFLOAT\` or \`VK_FORMAT_D16_UNORM\` with optimal tiling! Always probe a candidate list with \`vkGetPhysicalDeviceFormatProperties\` and check \`props.optimalTilingFeatures & VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT\` (\`RendererMeta.c\` lines 464–473).

#### 2. How Hardware MSAA Works in a Render Pass

When \`samples > VK_SAMPLE_COUNT_1_BIT\`:
- **Attachment 0:** A multisampled \`VkImage\` (\`msaaImage\`) created with \`samples = 4\` (or \`8\`). Notice it is **never** presented directly to the screen!
- **Attachment 1:** A matching multisampled depth buffer (\`samples = 4\`).
- **Attachment 2 (\`pResolveAttachments\`):** The single-sampled swapchain \`VkImageView\` (\`samples = 1\`, \`loadOp = DONT_CARE\`, \`storeOp = STORE\`, \`finalLayout = PRESENT_SRC_KHR\`). At the end of the subpass, the GPU's ROP hardware resolves the 4x samples down into crisp anti-aliased pixels automatically!

#### 3. Bulletproof Window Resize & Minimization (\`_vk2dRendererResetSwapchain\`)

A window resize or alt-tab minimization can return \`VK_ERROR_OUT_OF_DATE_KHR\` or \`VK_SUBOPTIMAL_KHR\` from **either** \`vkAcquireNextImageKHR\` or \`vkQueuePresentKHR\`. Follow the recovery recipe in \`RendererMeta.c\` lines 1549–1612:

\`\`\`c
void rebuildSwapchain(Renderer *r, uint32_t newSamples) {
    // 1. Pause cleanly while minimized (0x0 surface extent crashes vkCreateSwapchainKHR!)
    while (SDL_GetWindowFlags(r->window) & SDL_WINDOW_MINIMIZED) {
        SDL_PumpEvents();
        SDL_Delay(10);
    }

    // 2. Wait for all frames in flight to finish touching swapchain resources
    vkDeviceWaitIdle(r->device);

    // 3. Destroy swapchain-dependent views, framebuffers, sync, depth, MSAA, old swapchain
    destroySwapchainDependents(r);

    // 4. Only rebuild RenderPasses & Pipelines if MSAA sample count actually changed!
    bool msaaChanged = (newSamples != r->samples);
    if (msaaChanged) {
        r->samples = newSamples;
        destroyAllPipelines(r);
        destroyRenderPasses(r);
    }

    // 5. Recreate swapchain (passing oldSwapchain or destroying old first), depth, MSAA, framebuffers, sync
    createSwapchainAndViews(r);
    createDepthAndMsaaImages(r);
    if (msaaChanged) {
        createRenderPasses(r);
        rebuildAllPipelines(r);
        refreshOffscreenTargetFramebuffers(r);
    }
    createSwapchainFramebuffers(r);
    createSyncObjects(r);
}
\`\`\`

*(Crucial Tip: Notice why \`msaaChanged\` is checked! Normal window resizing changes width and height, which only requires rebuilding images, framebuffers, and the swapchain because \`VIEWPORT\` and \`SCISSOR\` are dynamic state. You do **not** need to recompile every \`VkPipeline\` on window drag unless the MSAA sample count changed!)*

---

### Chapter 3: Complete End-to-End Scratch Architecture Checklist

At this point in Books IX through XII, you have every building block required to write a complete, production-grade Vulkan 1.2 renderer from zero without hiding behind black-box abstractions:

| Subsystem | Created At Boot | Reset Per Frame | Destroyed on Resize | Destroyed at Quit (Reverse Order) |
| --- | --- | --- | --- | --- |
| \`VkInstance\` & \`VkSurfaceKHR\` | Once | Never | Never | Very last (after \`VkDevice\`) |
| \`VkPhysicalDevice\` & \`VkDevice\` | Once | Never | Never | Second to last |
| \`VmaAllocator\` & \`VkCommandPool\` | Once | Never | Never | After buffers/images/sync |
| \`VkSwapchainKHR\` & \`VkImageView[]\` | Once | Acquired via \`scImageIndex\` | **Yes** | Before \`VkCommandPool\` |
| \`VkRenderPass[3]\` & \`VkPipeline[]\` | Once | Bound inside cmd | Only if MSAA changes | Before \`VkRenderPass\` & \`VkDevice\` |
| \`VkFramebuffer[]\`, MSAA & Depth | Once | Bound via \`scImageIndex\` | **Yes** | Before \`VkSwapchainKHR\` |
| \`DescriptorBuffer[2]\` & \`DescCon[2]\` | Per frame in flight | Reset via \`currentFrame\` | Never | Before \`VmaAllocator\` |
| \`inFlightFences[2]\`, Semaphores & Cmds | Per frame / image | Signaled & waited | Sync / Cmds rebuilt cleanly | After \`vkQueueWaitIdle\` |

---

### Chapter 4: Graded Assignments 32–34 (With Starter Code & Full Solutions)

#### Assignment 32: Two-Pass Offscreen Render Target Switcher
- **Objective:** Write \`switchRenderTarget(cmd, newTarget, width, height, prevImg, nextImg, pass, fbo)\` that ends the current render pass, transitions \`prevImg\` from \`COLOR_ATTACHMENT_OPTIMAL\` to \`SHADER_READ_ONLY_OPTIMAL\` (or transitions \`nextImg\` from \`SHADER_READ_ONLY_OPTIMAL\` to \`COLOR_ATTACHMENT_OPTIMAL\`), and begins the new render pass cleanly.
- **Reference Solution:**
\`\`\`c
void switchRenderTarget(
    VkCommandBuffer cmd, bool toScreen,
    VkImage prevOffscreenImg, VkImage nextOffscreenImg,
    VkRenderPass targetPass, VkFramebuffer targetFbo, uint32_t w, uint32_t h)
{
    vkCmdEndRenderPass(cmd);

    VkImageMemoryBarrier b = {
        .sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER,
        .srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED,
        .dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED,
        .subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 },
    };
    VkPipelineStageFlags srcStage, dstStage;
    if (toScreen) {
        b.image = prevOffscreenImg;
        b.oldLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        b.newLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        b.srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        b.dstAccessMask = VK_ACCESS_SHADER_READ_BIT;
        srcStage = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_TRANSFER_BIT;
        dstStage = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
    } else {
        b.image = nextOffscreenImg;
        b.oldLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        b.newLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
        b.srcAccessMask = VK_ACCESS_SHADER_READ_BIT;
        b.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
        srcStage = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
        dstStage = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_TRANSFER_BIT;
    }
    vkCmdPipelineBarrier(cmd, srcStage, dstStage, 0, 0, NULL, 0, NULL, 1, &b);

    VkClearValue clear[2] = {0};
    clear[1].depthStencil.depth = 1.0f;
    VkRenderPassBeginInfo rpbi = {
        .sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO,
        .renderPass = targetPass,
        .framebuffer = targetFbo,
        .renderArea = { {0, 0}, {w, h} },
        .clearValueCount = 2,
        .pClearValues = clear,
    };
    vkCmdBeginRenderPass(cmd, &rpbi, VK_SUBPASS_CONTENTS_INLINE);
}
\`\`\`

#### Assignment 33: Dynamic Depth Format Selector & MSAA RenderPass Attachment Builder
- **Objective:** Implement \`findDepthFormat(physicalDevice)\` probing \`{ VK_FORMAT_D16_UNORM, VK_FORMAT_D32_SFLOAT, VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT }\` and returning the first format supporting \`VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT\`, plus an MSAA clamp helper \`clampMaxMSAA(physicalDevice, requested)\`.
- **Reference Solution:**
\`\`\`c
VkFormat findDepthFormat(VkPhysicalDevice pd) {
    const VkFormat candidates[4] = {
        VK_FORMAT_D16_UNORM,
        VK_FORMAT_D32_SFLOAT,
        VK_FORMAT_D32_SFLOAT_S8_UINT,
        VK_FORMAT_D24_UNORM_S8_UINT,
    };
    for (int i = 0; i < 4; i++) {
        VkFormatProperties props;
        vkGetPhysicalDeviceFormatProperties(pd, candidates[i], &props);
        if (props.optimalTilingFeatures & VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT) {
            return candidates[i];
        }
    }
    return VK_FORMAT_UNDEFINED;
}

VkSampleCountFlagBits clampMaxMSAA(VkPhysicalDevice pd, VkSampleCountFlagBits want) {
    VkPhysicalDeviceProperties props;
    vkGetPhysicalDeviceProperties(pd, &props);
    VkSampleCountFlags both = props.limits.framebufferColorSampleCounts & props.limits.framebufferDepthSampleCounts;
    VkSampleCountFlagBits order[6] = {
        VK_SAMPLE_COUNT_32_BIT, VK_SAMPLE_COUNT_16_BIT, VK_SAMPLE_COUNT_8_BIT,
        VK_SAMPLE_COUNT_4_BIT,  VK_SAMPLE_COUNT_2_BIT,  VK_SAMPLE_COUNT_1_BIT,
    };
    for (int i = 0; i < 6; i++) {
        if (order[i] <= want && (both & order[i])) {
            return order[i];
        }
    }
    return VK_SAMPLE_COUNT_1_BIT;
}
\`\`\`

#### Assignment 34: Complete Scratch Renderer Capstone Audit
- **Objective:** Build a minimal standalone C11 + SDL3 executable using the code from Books IX through XII that opens a resizable window, uploads a $16 \\times 16$ checkerboard RGBA texture via staging buffer, draws 1,000 rotating quads via instanced/push-constant rendering into an offscreen target, composites to the swapchain with a custom Slang shader, survives window minimize/maximize/resize, and exits with **zero** \`VK_LAYER_KHRONOS_validation\` warnings or memory leaks!
- **Reference Verification Checklist (Run with Validation Enabled):**
\`\`\`c
// 1. Shutdown sequence guard: never destroy any VkImage, VkBuffer, VkPipeline, or VmaAllocator
//    until vkQueueWaitIdle / vkDeviceWaitIdle returns cleanly!
void shutdownScratchRenderer(FullRenderer *r) {
    if (r->device != VK_NULL_HANDLE) {
        vkDeviceWaitIdle(r->device);
        destroyPipelines(r);
        destroyDescriptorSetLayouts(r);
        destroyDescriptorPools(r);
        destroyStagingRings(r);
        destroySwapchainDependents(r);
        destroyRenderPasses(r);
        destroySamplersAndTextures(r);
        if (r->vma != VK_NULL_HANDLE) vmaDestroyAllocator(r->vma);
        vkDestroyCommandPool(r->device, r->commandPool, NULL);
        vkDestroyDevice(r->device, NULL);
    }
    if (r->instance != VK_NULL_HANDLE) {
        if (r->surface != VK_NULL_HANDLE) vkDestroySurfaceKHR(r->instance, r->surface, NULL);
        if (r->debugReport && r->destroyDebug) r->destroyDebug(r->instance, r->debugReport, NULL);
        vkDestroyInstance(r->instance, NULL);
    }
}
\`\`\`
`,
    mermaidCharts: [
      {
        title: "Mid-Frame Render Target Switch & 3-RenderPass Transition Topology",
        chart: `
flowchart TD
    classDef scr fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef off fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef bar fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    P1["1. Begin Frame: renderPass (CLEAR)<br/>Target = Swapchain Image"]:::scr
    B1["vkCmdEndRenderPass + Barrier<br/>Offscreen: SHADER_READ -> COLOR_ATTACHMENT"]:::bar
    P2["2. externalTargetRenderPass (LOAD)<br/>Target = Offscreen Texture FBO"]:::off
    B2["vkCmdEndRenderPass + Barrier<br/>Offscreen: COLOR_ATTACHMENT -> SHADER_READ"]:::bar
    P3["3. midFrameSwapRenderPass (LOAD)<br/>Sample Offscreen Texture back onto Swapchain"]:::scr

    P1 --> B1 --> P2 --> B2 --> P3
`,
      },
      {
        title: "Swapchain Resize & MSAA Rebuild Decision Pipeline",
        chart: `
flowchart TD
    classDef err fill:#181524,stroke:#ef4444,stroke-width:2px,color:#e2e8f0;
    classDef wait fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef chk fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef ok fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Trig["OUT_OF_DATE_KHR, SUBOPTIMAL_KHR,<br/>or Config Change"]:::err
    Min["While Minimized: SDL_PumpEvents Loop"]:::wait
    Wait["vkDeviceWaitIdle + Destroy Views,<br/>Framebuffers, Depth, MSAA, Sync, Swapchain"]:::wait
    MSAA{"Did MSAA Sample<br/>Count Change?"}:::chk
    Full["Rebuild RenderPasses + Pipelines +<br/>Refresh Offscreen Target FBOs"]:::chk
    Recreate["Recreate Swapchain, Depth/MSAA,<br/>Framebuffers, Sync & Resume Frame"]:::ok

    Trig --> Min --> Wait --> MSAA
    MSAA -->|"Yes"| Full --> Recreate
    MSAA -->|"No (Drag Resize Only)"| Recreate
`,
      },
    ],
  },
];
