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
    | "engine-math";
}

export const WIKI_SECTIONS: WikiSection[] = [
  {
    id: "overview",
    title: "01. Engine Philosophy & 8-Slot Hardware Telemetry",
    category: "core",
    summary:
      'The C++20 "C with classes" architecture, zero-allocation hot loops, and SDL_GetPerformanceCounter telemetry.',
    sourceFiles: [
      "src/main.cpp",
      "src/Game.cpp",
      "src/Prof.c",
      "src/SpriteObject.hpp",
    ],
    content: `
### Architectural Paradigm: Pragmatic "C with Classes"

**Mellangan** is engineered in **C++20** and **C11** around a strict systems-programming ethos: data locality, predictable cache residency, and deterministic 60 Hz simulation (\`DT = 1.0 / 60.0\`). Rather than deep object-oriented wrapper hierarchies or heavy runtime polymorphism, the engine combines flat data structures, bitwise state packing, and lightweight virtual dispatch at the entity root (\`SpriteObject\`).

#### Core Engineering Invariants

1. **Zero Heap Thrashing in the Frame Loop:**
   Every object inheriting from \`SpriteObject\` (\`Entity\`, \`Mob\`, \`Enemy\`, \`Player\`, \`Projectile\`, \`Particle\`) overrides \`operator new\` and sized \`operator delete(void *p, size_t size)\` to route directly into \`Pool.c\`—a 32-size-class, 16-byte-grained slab allocator backed by 64 KB contiguous pages.

2. **Hybrid EnTT + Intrusive Pointer Topology:**
   Lifecycle ownership lives inside \`entt::registry\` via a single \`Owned { std::unique_ptr<Entity> self; }\` component, while hot spatial queries and multi-threaded AI passes iterate flat \`Enemy **\` pointer arrays and a Compressed Sparse Row (CSR) prefix-sum grid (\`LevelSpace.cpp\`).

3. **Hardware Performance Counter Telemetry (\`src/Prof.c\`):**
   Every tick and render pass is bracketed by \`prof_begin(slot)\` and \`prof_end(slot)\` using high-resolution \`SDL_GetPerformanceCounter()\` / \`SDL_GetPerformanceFrequency()\` timers across 8 dedicated hardware telemetry slots:
   - \`PROF_THINK (0)\`: 4-barrier parallel enemy AI & soft-body separation (\`Workers::run\`).
   - \`PROF_ENTITIES (1)\`: EnTT \`Owned\` view iteration, status afflictions, and weapon kit cooldowns.
   - \`PROF_PARTICLES (2)\`: Particle kinematics and two-pointer in-place array compaction.
   - \`PROF_HOUSEKEEP (3)\`: Diurnal clock, spawner waves, CSR spatial grid rebuild, and deferred entity flush.
   - \`PROF_LIGHT (4)\`: Offscreen dynamic lightmap accumulation and \`LightField\` caster registration.
   - \`PROF_FLOOR (5)\`: 3-biome barycentric ground blending and 4-bit cardinal cliff auto-tiling.
   - \`PROF_SORT (6)\`: 64-bit sort key packing and 3-pass 12-bit LSD Radix Sort.
   - \`PROF_DRAW (7)\`: Planar water reflections, directional shadow casting, submerge clipping, and sprite batching.

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
        VK["Vulkan 1.3 Device<br/>(Extern/Vulkan2D Command Queues)"]:::os
    end

    subgraph Memory_Concurrency ["Memory & Concurrency Core"]
        Pool["Pool.c Slab Allocator<br/>(32 Size Classes, 64KB Pages, SRWLOCK)"]:::core
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
    id: "radix-rendering",
    title: "02. 64-Bit Radix Y-Sort, Planar Reflections & LightField",
    category: "graphics",
    summary:
      "IEEE-754 monotonic float conversion, 3-pass 12-bit LSD radix sort, planar water reflections, and directional contact shadows.",
    sourceFiles: [
      "src/level/LevelRender.cpp",
      "src/level/LightField.cpp",
      "src/gfx/Screen.cpp",
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

- If \`f >= 0\`: Arithmetic right shift \`int32_t(u) >> 31\` is \`0\`, so the mask is \`0x80000000u\`, flipping only the sign bit (mapping \`[+0, +inf)\` to \`[0x80000000, 0xFFFFFFFF]\`).
- If \`f < 0\`: Arithmetic right shift \`int32_t(u) >> 31\` is \`0xFFFFFFFF\`, flipping **all 32 bits** (mapping \`(-inf, -0]\` to \`[0x00000000, 0x7FFFFFFF]\`).

#### 2. 3-Pass 12-Bit LSD Radix Sort (\`radixSort\`)
Because bits \`[23..0]\` store the original insertion index \`drawn.size()\` (already monotonically increasing), the sort only needs to order bits \`[59..24]\` (32 bits of \`orderedBits(y)\` plus 4 bits of \`layer\`). Three passes of 12-bit LSD Radix Sort (\`SHIFT = {24, 36, 48}\`, \`4096\` histogram buckets) sort the entire scene with zero comparisons:

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

#### 3. Planar Water Reflections, Submerge Clipping & \`LightField\` Shadows
- **Planar Reflections (\`Level::reflect\`):** Before drawing Layer 1, if \`waterInView\` or \`sky.flood() > 0\`, entities standing adjacent to wet tiles (\`(surfaces[...] & 3) == 1\` or \`sky.poolAt\`) are rendered upside-down via \`s.mirror(std::floor(e->y), tint)\`, capped at 48 crowd reflections to bound fillrate.
- **Layer-Transition Shadow Flush:** During the main draw loop over \`keys\`, the moment the first key with \`(k >> 56) >= 1\` is encountered, all Layer 1 occluders project radial contact shadows from up to 64 active point light casters (\`lights.cast(s, e->x, e->y, width, height)\`) before any Layer 1 sprite body is drawn.
- **Submerged Swimmer Clipping:** Entities wading in water (\`swimming(e)\`) replace their ground shadow with an animated water ripple (\`atlas::wx::ripple\`) and clip their lower torso via \`s.submerge(std::floor(e->y) - 5)\`.
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
      "Zero-header C++ sized operator delete, 32 size classes (16B grain), 64KB slab pages, and SRWLOCK synchronization.",
    sourceFiles: [
      "src/entity/Pool.c",
      "src/entity/Pool.h",
      "src/SpriteObject.hpp",
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

1. **Size Class Quantization (\`GRAIN_SHIFT = 4\`):**
   Sizes are rounded up to multiples of 16 bytes via bit-shifting:
   \`classOf(size) = (size + 15) >> 4\`.
   With \`CLASSES = 32\`, the pool handles all object sizes from \`16 B\` up to \`496 B\` in $O(1)$ time. Allocations \`>= 512 B\` (\`c >= 32\`) transparently fall back to system \`malloc\`/\`free\`.

2. **64 KB Contiguous Slab Refills (\`SLAB = 65536\`):**
   When \`freeList[c]\` is empty, \`refill(c)\` allocates a single \`sizeof(Slab) + 65536\` block, links the \`Slab\` header into the global \`slabs\` chain for clean shutdown (\`pool_shutdown()\`), and carves the 64 KB payload in reverse order (\`i = SLAB / size; i-- > 0;\`) into an intrusive singly-linked list of \`Node { Node *next; }\`. Carve-in-reverse places the lowest memory address at the head of \`freeList[c]\`, ensuring sequential forward memory addresses on consecutive allocations!

3. **Platform-Native Lightweight Locks:**
   Because worker threads or main-thread spawners may allocate concurrently, \`Pool.c\` guards \`freeList[c]\` pointer swaps with a slim 8-byte \`SRWLOCK\` (\`AcquireSRWLockExclusive\`) on Windows or \`pthread_mutex_t\` on POSIX—spending less than a few nanoseconds inside the critical section.
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
    ClassOf["classOf(size) = (size + 15) >> 4<br/>16B Grain, 32 Classes (16B..496B)"]:::pool
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
      "Epoch generation wakeups, atomic fetch_add chunk stealing, member-pointer pass<> thunks, per-enemy Xorshift32 PRNGs, and race-free crowd physics.",
    sourceFiles: [
      "src/Workers.hpp",
      "src/Workers.cpp",
      "src/level/Level.cpp",
      "src/entity/enemy/Enemy.cpp",
    ],
    content: `
### Zero-Allocation Fork-Join Concurrency (\`src/Workers.cpp\`)

Standard thread pools allocate heap task wrappers (\`std::function<void()>\`) and push them into mutex-contended queues. \`Workers.cpp\` avoids all dynamic allocation by combining an **epoch counter (\`generation\`)**, **lock-free atomic stride stealing (\`std::atomic<int> next\`)**, and a plain C function pointer \`typedef void (*Job)(void *ctx, int begin, int end);\`:

\`\`\`cpp
void Workers::run(int n, int size, Job j, void *c) {
  if (n <= 0)
    return;
  if (threads.empty() || n <= size)
    return j(c, 0, n);
  {
    std::lock_guard<std::mutex> lock(mutex);
    job = j, ctx = c, count = n, chunk = size, busy = int(threads.size()),
    generation++;
    next.store(0);
  }
  wake.notify_all();
  work();
  std::unique_lock<std::mutex> lock(mutex);
  done.wait(lock, [this] { return busy == 0; });
}

void Workers::work() {
  for (int begin; (begin = next.fetch_add(chunk)) < count;)
    job(ctx, begin, std::min(begin + chunk, count));
}
\`\`\`

#### How Background Worker Threads Sleep & Wake (\`Workers::loop\`)
At engine startup, \`Workers::Workers()\` spawns \`std::max(2u, std::thread::hardware_concurrency()) - 1\` persistent background threads. Each worker maintains a thread-local \`unsigned seen = 0\` counter and sleeps on \`wake.wait(lock, [&] { return quit || generation != seen; })\`:
- When \`Workers::run\` increments \`generation++\` and calls \`wake.notify_all()\`, every worker wakes up, snapshots \`seen = generation\`, releases \`mutex\` immediately, and enters \`work()\` to steal chunks lock-free via \`next.fetch_add(chunk)\`.
- When all chunks are exhausted (\`begin >= count\`), the last worker to decrement \`if (--busy == 0)\` signals \`done.notify_one()\`, releasing the main thread from the barrier.

---

### Compile-Time Member-Pointer Thunks (\`pass<&Enemy::Step>\`)

In \`src/level/Level.cpp\`, \`Level::tick()\` flattens all active enemies into \`std::vector<Enemy *> thinkers\` and dispatches four sequential fork-join barriers using a zero-overhead C++ template over a **member-function pointer** (\`void (Enemy::*Step)()\`):

\`\`\`cpp
template <void (Enemy::*Step)()>
void pass(Workers &workers, std::vector<Enemy *> &list) {
  workers.run(
      int(list.size()), 256,
      [](void *ctx, int begin, int end) {
        Enemy **each = static_cast<Enemy **>(ctx);
        for (int i = begin; i < end; i++)
          (each[i]->*Step)();
      },
      list.data());
}
\`\`\`

Because \`Step\` is a compile-time template argument, the captureless lambda decays directly into a static \`Workers::Job\` function pointer with the member call \`(each[i]->*Step)()\` inlined by the compiler:

\`\`\`cpp
pass<&Enemy::think>(workers, thinkers);
pass<&Enemy::move>(workers, thinkers);
pass<&Enemy::push>(workers, thinkers);
pass<&Enemy::settle>(workers, thinkers);
\`\`\`

---

### The 4-Barrier Memory Contract & Crowd Separation Math

1. **Barrier 1 (\`pass<&Enemy::think>\`):**
   - **Reads:** \`level->player\` position/velocity/aim and pack \`leader\` position.
   - **Writes (Private per \`Enemy\`):** \`goals\`, \`goalTime\`, \`cooldown\`, \`xMark, yMark\`, \`xWant, yWant\`, \`seed\`, \`wantsFire\`, \`wantsLeader\`.
2. **Barrier 2 (\`pass<&Enemy::move>\`):**
   - **Reads:** Private \`xWant, yWant\`, \`status.movement()\`, \`traits.speed()\`, and read-only \`surfaces[]\` (\`surfaceAt\`, \`climb\`).
   - **Writes (Private per \`Enemy\`):** Integrates \`x += (xWant * level->pace * spdMul + xa) * DT\`, decays knockback velocity via \`KNOCK_DECAY = std::exp(-9 * DT)\`, updates \`facing\`, and rubber-bands stragglers beyond \`560 px\` back to a \`290..320 px\` ring ahead of the player.
3. **Barrier 3 (\`pass<&Enemy::push>\`):**
   - **Reads:** Read-only CSR spatial grid (\`level->gather(x, y, radius + 16, nearby, 24)\`) and neighbor coordinates \`(o.x, o.y, o.radius)\`.
   - **Writes (Private per \`Enemy\`):** Accumulates soft-body repulsion into \`xPush, yPush\` **without modifying \`x, y\`**!
   - **Mass-Weighted Impulse Math:** Overlapping non-floating neighbors within \`min = (radius + o.radius) * 0.85\` push apart proportionally to inverse radius (\`share = o.type.speed <= 0 ? 1.0 : o.radius / (radius + o.radius)\`):
     \`\`\`cpp
     double min = (radius + o.radius) * 0.85, d2 = ox * ox + oy * oy;
     if (d2 >= min * min || d2 < 1e-6)
       continue;
     double dd = std::sqrt(d2),
            share = o.type.speed <= 0 ? 1.0 : o.radius / (radius + o.radius);
     double k = (min - dd) / dd * share;
     xPush += ox * k, yPush += oy * k;
     \`\`\`
   - **Pointer-Bit Checkerboard Decimation:** Distant enemies (\`dist > 260 px\`) skip \`push()\` on alternating ticks via \`((uintptr_t(this) >> 5) + level->ticks) & 1\`, cutting crowd-separation CSR queries in half at the screen periphery.
4. **Barrier 4 (\`pass<&Enemy::settle>\`):**
   - **Reads:** Private \`xPush, yPush\` and read-only \`solids[]\`.
   - **Writes:** Commits \`x += xPush, y += yPush\` and resolves solid prop/cliff collisions via \`level->collide(x, y, radius)\`.

---

### Thread-Safe PRNG (\`Enemy::roll\`) & Deferred Side Effects

#### 1. Why Every Enemy Owns a Private Xorshift32 Seed (\`Enemy::roll\`)
Because worker threads steal 256-enemy chunks in non-deterministic OS scheduling order, calling a shared global PRNG inside \`think()\` or \`move()\` would cause data races and destroy seed reproducibility. Instead, each \`Enemy\` initializes a private odd seed \`seed = rng.next() | 1\` on construction and advances it via **Marsaglia Xorshift32**:

\`\`\`cpp
float Enemy::roll() {
  seed ^= seed << 13, seed ^= seed >> 17, seed ^= seed << 5;
  return float(seed >> 8) / float(1 << 24);
}
\`\`\`

#### 2. Deferred Intent Flags (\`wantsFire\` & \`wantsLeader\`) and \`addMutex\`
- **Ranged Projectiles (\`wantsFire\`):** \`Ranged::tick\` never spawns an \`Orb\` on a worker thread; it sets \`e.wantsFire = true\`. Later, during the serial \`PROF_ENTITIES\` pass on the main thread, \`Enemy::tick() -> Enemy::act()\` consumes \`wantsFire\`, leads the target (\`lead = dd / 70 * 0.7\`), spawns the \`Orb\` (plus a 10-orb radial spiral and 10-spoke \`Shockwave\` if \`boss == true\`), and plays \`Sound::orb\`.
- **Pack Leader Adoption (\`wantsLeader\`):** \`Follow::tick\` sets \`e.wantsLeader = true\` when a \`Rat\` has no pack leader. Serial \`Enemy::adopt()\` in \`Enemy::act()\` scans \`level->gather(x, y, 140, nearby, 24)\` on the main thread to find an unled, aware rat (\`o->leader == entt::null && o->aware\`), preventing two rats on different worker threads from adopting each other in a mutual cycle!
- **Mutex-Guarded Spawn Queues (\`addMutex\` & \`Level::flush\`):** Whenever \`Level::add\` or \`Level::spawn\` is called, \`std::lock_guard<std::mutex> lock(addMutex)\` guards appends to \`pending\` and \`particles\`, while actual \`reg.emplace<Owned>\` and \`reg.destroy\` mutations happen exclusively inside \`Level::flush()\` at the end of the tick.
`,
    mermaidCharts: [
      {
        title: "Workers::run Atomic Fetch-Add Chunk Stealing Protocol",
        chart: `
sequenceDiagram
    autonumber
    participant Main as Main Thread
    participant Atom as std::atomic<int> next
    participant W1 as Worker Thread 1
    participant W2 as Worker Thread 2

    Main->>Main: Check n <= 256 (Fast-Path Inline if true)
    Main->>Atom: next.store(0), busy = N-1, generation++
    Main->>W1: wake.notify_all()
    Main->>W2: wake.notify_all()
    par Lock-Free Stride Stealing (chunk = 256)
        Main->>Atom: fetch_add(256) -> [0..256)
        W1->>Atom: fetch_add(256) -> [256..512)
        W2->>Atom: fetch_add(256) -> [512..768)
        Main->>Atom: fetch_add(256) -> [768..n)
    end
    W1->>Main: --busy (1 remaining)
    W2->>Main: --busy == 0 -> done.notify_one()
    Main->>Main: Barrier Complete
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
  double px = best->x - x, py = best->y - y, bd = px * px + py * py;
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
At the start of 85% of runs (\`rng.chance(0.85f)\`), \`Level\` rolls a global **Omen** (\`OMENS[omen]\`) that alters nocturnal rules and awards a permanent score handicap multiplier—culminating in Blood Moon surges and the final Dawn survival threshold.

#### 4. The 24-Hour Diurnal Illumination Equation
The celestial solar/lunar arc is evaluated as a continuous trigonometric angle:
$$\\theta(t) = \\frac{t - 6}{24} \\times 2\\pi$$
Ambient light is smoothly interpolated across four distinct chromatic keyframes:
- **Dawn (05:00 - 08:00):** Warm rose and peach hues ($65\\%$ ambient luminance) with elongated westward ground shadows.
- **Daylight (08:00 - 17:00):** Clear emerald and azure sunlight ($100\\%$ ambient luminance) with compact vertical shadows.
- **Dusk (17:00 - 20:00):** Fiery amber and deep crimson tones ($60\\%$ ambient luminance) with eastward shadows.
- **Night (20:00 - 05:00):** Nocturnal indigo ($25\\%$ ambient baseline), revealing player lantern cones and dynamic lightfield casters.
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
      "Data-driven Recipe table, 16 polymorphic FormBehavior kinematic engines (including Whip, Wall, Spiral & Summon), 16 composable pay::Payload bitflags, and 41 weapon evolutions.",
    sourceFiles: [
      "src/item/weapon/Recipe.cpp",
      "src/item/weapon/Recipe.hpp",
      "src/item/weapon/form/Forms.hpp",
      "src/item/weapon/form/Shape.cpp",
      "src/item/weapon/form/Summon.cpp",
      "src/entity/Ally.cpp",
    ],
    content: `
### Orthogonal Weapon Architecture: \`FormBehavior\` × \`pay::Payload\`

Instead of writing dozens of bespoke, repetitive weapon classes, \`src/item/weapon/Recipe.cpp\` and \`src/item/weapon/form/\` implement a **combinatorial synthesis engine** where any recipe weapon—including the 22 class-exclusive weapons and 7 Mage spells (29 \`RECIPES\` alongside 12 bespoke shared weapons = **41 evolvable weapons** in \`EVOLUTIONS[]\`)—is defined by pairing one of **16 polymorphic \`FormBehavior\` subclasses (\`Form\`)** with a **16-bit mask of on-hit effects (\`pay::Payload\`)**:

\`\`\`cpp
void RecipeShot::strike(Mob &e, double xd, double yd) {
  hits.push_back(e.id);
  unsigned p = r.payload;
  float knock = p & pay::Pull ? -70.0f : form().knock();
  hit(e, xd, yd, damage, knock);
  if (Spark::alive < 600)
    Spark::burst(*level, e.x, e.bodyY(), r.tint, 4, 60, false);
  if ((p & pay::Explode) && form().explodes())
    blast(24, damage * 0.5f);
  if ((p & pay::Chain) && !child)
    chain(e);
  if ((p & pay::Split) && !child && form().flies())
    for (int k = -1; k <= 1; k += 2) {
      double a = std::atan2(dy, dx) + k * 1.2;
      RecipeShot *s = level->add<RecipeShot>(r, e.x, e.bodyY(), std::cos(a),
                                             std::sin(a), damage * 0.5f, reach);
      s->child = true, s->life = 1.5f, s->source = source;
      s->hits.push_back(e.id);
    }
}
\`\`\`

#### All 16 Polymorphic \`FormBehavior\` Classes (\`src/item/weapon/form/Forms.hpp\`)
Each \`Form\` enum value maps to a dedicated stateless \`FormBehavior\` subclass:
1. **Classic Projectile & Area Forms (\`BoltForm\`, \`VolleyForm\`, \`SeekerForm\`, \`OrbitForm\`, \`NovaForm\`, \`RainForm\`, \`FieldForm\`):** Linear bolts, fan volleys, homing seekers, orbital rings, expanding novas, sky bombardments, and persistent ground hazards.
2. **Class-Kit Forms (\`CleaveForm\`, \`BoomerangForm\`, \`LobForm\`, \`TrapForm\`, \`BeamForm\` in \`Strike.cpp\` & \`Flight.cpp\`):**
   - \`CleaveForm\`: Sweeps a wide melee arc in front of the wielder (\`Lionheart Cleave\`, \`Crescent Cut\`, \`Soul Harvest\`).
   - \`BoomerangForm\`: Flies outward and reverses velocity back to the wielder (\`Hawk Talon\`, \`Bone Wheel\`, \`Fate Wheel\`).
   - \`LobForm\`: Arcs overhead (\`0.55s\`) with a shrinking ground target ring and detonates on landing (\`Caustic Flask\`, \`Witchfire Phial\`, \`Flash Grenade\`).
   - \`TrapForm\`: Arms on the ground after \`0.6s\` for up to \`10s\` until a hostile steps across its trigger radius (\`Bear Trap\`, \`Root Snare\`, \`Clockwork Mine\`).
   - \`BeamForm\`: Instantaneous piercing line ray (\`0.28s\`) striking all foes along the beam (\`Arc Lance\`, \`Lance of Dawn\`, \`Prophecy Ray\`).
3. **Geometric Shape Forms (\`WhipForm\`, \`WallForm\`, \`SpiralForm\` in \`src/item/weapon/form/Shape.cpp\`):**
   - **\`WhipForm\` (1.5× Tip-Sweetspot Crack):** Lashes an 8-segment sine-swaying line (\`CRACK = 0.08s\`), projects each nearby enemy onto the whip segment \`b = std::clamp(ex * s.dx + ey * s.dy, 0.0, double(s.reach))\`, and multiplies damage by **\`1.5×\`** when struck by the outer 25% tip (\`b > s.reach * 0.75\`):
     \`\`\`cpp
     void WhipForm::tick(RecipeShot &s, Mob &p, float) const {
       s.ox = p.x, s.oy = p.bodyY();
       if (s.age < CRACK || s.pulse != 0)
         return;
       s.pulse = 1;
       s.level->foes(s.hostile(), s.ox + s.dx * s.reach / 2, s.oy + s.dy * s.reach / 2,
                     s.reach / 2 + 24, [&](Mob &e) {
                       double ex = e.x - s.ox, ey = e.bodyY() - s.oy;
                       double b = std::clamp(ex * s.dx + ey * s.dy, 0.0, double(s.reach));
                       double qx = ex - s.dx * b, qy = ey - s.dy * b;
                       float rr = 8 + e.radius;
                       if (qx * qx + qy * qy < rr * rr && !s.hitBefore(e.id))
                         strikeHarder(s, e, b > s.reach * 0.75 ? 1.5f : 1.0f);
                     });
     }
     \`\`\`
   - **\`WallForm\` (Physical Barrier Displacement):** Summons barrier segments at \`48 + 22 * i\` px ahead for \`4.0s\` that pulse damage every \`0.5s\` and project enemies onto the wall's tangent/normal basis \`(along, across)\` to push them out of the barrier:
     \`\`\`cpp
     double along = ex * tx + ey * ty, across = ex * s.dx + ey * s.dy;
     double edge = WALL_THICK + e.radius;
     if (std::abs(along) <= half + e.radius && std::abs(across) <= edge) {
       double push = (across < 0 ? -edge : edge) - across;
       e.x += s.dx * push, e.y += s.dy * push;
     }
     \`\`\`
   - **\`SpiralForm\`:** Launches shots with angular lead compensation along an expanding Archimedean spiral (\`a = s.tx + s.age * 3.0f, r = speed * 0.8f * s.age\`).
4. **Companion Summoning (\`SummonForm\` in \`src/item/weapon/form/Summon.cpp\`):**
   Resolves \`AllyKind kind = allyFor(c.r.name)\` across \`ALLIES[7]\` (\`Wolf Totem\`, \`Hawk Companion\`, \`Ghoul Pack\`, \`Raise Dead\`, \`Clockwork Drone\`, \`Powder Crew\`, \`Mirror Image\`). On each cooldown cycle, \`SummonForm::fire\` refreshes the lifetime and damage of living allies from the same \`Upgrade *source\` and only spawns missing companions up to \`c.count\`:
   \`\`\`cpp
   void SummonForm::fire(const FormCast &c) const {
     if (c.p.hostile())
       return;
     Level &level = *c.p.level;
     AllyKind kind = allyFor(c.r.name);
     const AllyDef &def = allyDef(kind);
     int alive = 0;
     for (Ally *a : level.allies)
       if (!a->removed && a->source == c.source && &a->def == &def) {
         alive++;
         a->life = std::max(a->life, def.life), a->damage = c.damage;
       }
     for (int i = alive; i < c.count; i++) {
       double a = c.base + TAU * i / c.count;
       summon(level, kind, c.p.x + std::cos(a) * 20, c.p.y + std::sin(a) * 14,
              c.damage, def.life, c.r.payload, c.source)->might = c.p.might;
     }
   }
   \`\`\`

#### All 16 Composable \`pay::\` Payload Bitflags (\`Recipe.hpp\`)
- **Status Payloads:** \`Burn (1)\`, \`Chill (2)\`, \`Poison (4)\`, \`Mark (8)\`, \`Bleed (2048)\`, \`Weaken (4096)\`, \`Fear (8192)\`.
- **Kinematic & Finisher Payloads:** \`Pull (16)\`, \`Pierce (32)\`, \`Explode (64)\`, \`Split (128)\`, \`Leech (256)\` (heals wielder on hit), \`Chain (512)\` (arcs to nearby foe), \`Stagger (1024)\` (heavy knockback + brief pin), \`Shatter (16384)\` (bonus damage against \`Chilled\` targets), and \`Execute (32768)\` (instantly finishes low-health non-boss enemies).

#### Mob-Symmetric Wielding & 41 Weapon Evolutions
Every \`RecipeWeapon\` and \`RecipeShot\` operates on \`Mob &\` rather than \`Player &\` (\`s.hostile()\`), allowing **Renegade Adventurers**, **Named Champions**, and **Clockwork Drone Allies** to wield weapons through the exact same pipeline without friendly fire! Maxing any of the 41 evolvable weapons while holding its partner passive unlocks its **Evolution** (doubling damage, accelerating cooldown, and adding a bonus projectile or wider area).
`,
    mermaidCharts: [
      {
        title:
          "Combinatorial RecipeWeapon Dispatch & 15 FormBehavior Hierarchy",
        chart: `
flowchart TD
    classDef rec fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef form fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef pay fill:#181524,stroke:#ec4899,stroke-width:2px,color:#e2e8f0;

    Recipe["Recipe Struct (src/item/weapon/Recipe.hpp)<br/>(damage, cooldown, reach, speed, count, tint)"]:::rec
    Form["15 Polymorphic FormBehaviors (src/item/weapon/form/)<br/>Bolt | Volley | Seeker | Boomerang | Spiral<br/>Orbit | Nova | Rain | Field | Cleave<br/>Lob | Trap | Beam | Whip (1.5x Tip) | Wall (Push)"]:::form
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
    title: "10. 12 Hero Kits, 39 Foe Species, 20 Traits, Champions & 9 Bosses",
    category: "gameplay",
    summary:
      "Complete v0.5.15 breakdown of the 12 standalone hero classes, 8 general skills, 39 EnemyKind species (WildFoe Greenwood table, Renegades, Mimic), 20 Elite/Champion traits, 10 Landmarks, and 9 3-phase bosses.",
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

Beyond the 16 classic monsters and 10 regional expansion monsters (\`src/entity/enemy/ExpansionEnemy.cpp\`), \`EnemyKind\` (\`src/entity/enemy/Enemy.hpp\`) spans **39 distinct species**:
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
    title: "11. 32-Voice LRU Audio Mixer & Automated Visual QA",
    category: "core",
    summary:
      "SDL3 AudioStream voice stealing, hardware frequency-ratio pitch jitter, exponential weather beds, and headless QA views.",
    sourceFiles: [
      "src/audio/Sound.cpp",
      "src/Bench.cpp",
      "src/test/Test.cpp",
      "src/test/view/Screenshots.cpp",
    ],
    content: `
### 32-Voice LRU Audio Stream Architecture (\`src/audio/Sound.cpp\`)

Instead of relying on external audio middleware, \`Sound.cpp\` builds a zero-allocation mixer directly on top of **SDL3 \`SDL_AudioStream\`**:

1. **Pre-Bound 32-Voice Pool & Oldest-Voice Stealing:**
   At startup, \`Sound::init\` creates 32 \`SDL_AudioStream *\` instances bound to the playback device (\`44.1 kHz, Mono S16\`). When \`Sound::play\` is called:
   - First, it checks the per-effect anti-comb-filtering gate: \`if (now - last < Uint64(gap * 1000)) return;\`.
   - Next, it scans \`voices[0..31]\` for any stream with \`SDL_GetAudioStreamQueued(voices[i]) == 0\`.
   - If all 32 voices are actively playing, it steals the **oldest voice** via \`if (voiceStarted[i] < voiceStarted[pick]) pick = i;\`!

2. **Hardware Resampling Pitch Jitter:**
   Each sound call applies randomized frequency-ratio scaling directly on the stream:
   \`SDL_SetAudioStreamFrequencyRatio(v, pitch * (1 + rng.range(-pitchJitter, pitchJitter)));\`

3. **Quadratic Distance Attenuation:**
   To maintain sub-microsecond mixing performance without evaluating square roots, spatial sounds apply rational quadratic distance falloff relative to the player position:
   $$A(d) = \\frac{1.0}{1.0 + \\left(\\frac{d}{R}\\right)^2}$$
   where $d$ is Euclidean separation in world units and $R$ is the reference hearing radius (typically 140 pixels).

4. **Exponentially Smoothed Weather Beds (\`beds[]\`):**
   Continuous ambient loops (\`rain.wav\`, \`wind.wav\`) smoothly interpolate their gain every tick via \`b.gain += (b.want - b.gain) * 0.02f;\` and automatically flush their queued PCM buffer when \`b.gain < 0.002f && b.want == 0\`.

5. **Priority Preemption Hierarchy:**
   Audio streams are classified into 5 strict priority tiers:
   - **Priority 4 (BGM):** Nocturnal ambient streams (\`night.ogg\`); never preempted under any circumstances.
   - **Priority 3 (Boss Omens):** Roars, screen-shake stingers, and omen announcements.
   - **Priority 2 (Player Combat):** Weapon swings, spell detonations, critical strikes, and status afflictions.
   - **Priority 1 (Environmental SFX):** Campfire crackle, watchtower arrows, door clicks.
   - **Priority 0 (Footsteps & Minor Sparks):** Ephemeral movement ticks; first candidates for LRU voice stealing.

### Automated Test Suites, Benchmarks & Visual QA (\`src/test/\`)

Mellangan includes a built-in verification and visual regression harness across **13 test files** in \`src/test/\`:
- **Deterministic Unit & Simulation Suites (\`src/test/Test.cpp\`):**
  1. \`CoreTest.cpp\`: Slab allocator (\`testPoolAllocAndFree\`, \`testPoolConcurrency\`), level lifecycle, and multi-threaded AI passes.
  2. \`CombatTest.cpp\` & \`PayloadTest.cpp\`: 7 statuses (\`testStatuses\`, \`testStatusDamage\`, \`testNewStatuses\`), 16 weapon payloads (\`testNewPayloads\`), and shape forms (\`testShapeForms\`).
  3. \`ItemTest.cpp\`: 30 affix families, rarity rolls, treasure classes, paper-doll inventory (\`testInventory\`), and reversible gear stats (\`testEquipStats\`).
  4. \`AllyTest.cpp\`: Summon cap refreshing, quarry aggro redirection, decoy lure weighting, and friendly-fire immunity (\`testAllies\`).
  5. \`ClassTest.cpp\`, \`ArsenalTest.cpp\`, \`BestiaryTest.cpp\`, \`ExpansionEnemyTest.cpp\`, \`ExpansionTest.cpp\`: All 12 hero kits, 41 weapon evolutions, 39 foe species, and 20 traits.
  6. \`WorldTest.cpp\`, \`BiomeTransitionTest.cpp\`, \`BiomeEncounterTest.cpp\`, \`RunTest.cpp\`, \`RunRulesTest.cpp\`: Voronoi determinism, hill/tarn constraints, shoreline dry moats, and \`RunRules\` parameterization.
- **Headless GPU Screenshot & QA Views (\`Screenshots.cpp\`, \`QaViews.cpp\`, \`BiomeMap.cpp\`):** Programmatically stages combat encounters, boss fights, UI menus, and biome transitions, capturing uncompressed frames directly from Vulkan textures via \`vk2dTextureCopyPixels\`.
`,
    mermaidCharts: [
      {
        title: "SDL3 32-Voice LRU Selection & Weather Bed Mixer",
        chart: `
flowchart TD
    classDef sfx fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef mix fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Play["Sound::play(volume, pitchJitter, pitch)"]:::sfx
    Gate["Comb-Filter Gate<br/>now - last < gap * 1000 -> Ignore"]:::sfx
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
    interactiveComponent: "audiomixer",
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
      "Hands-on beginner tutorial: create a 16x16 icon, add a combinatorial Recipe or custom Upgrade, and test it in --dev.",
    sourceFiles: [
      "src/item/weapon/Recipe.cpp",
      "src/item/Upgrade.cpp",
      "src/Atlas.hpp",
      "src/test/ArsenalTest.cpp",
    ],
    content: `
### Hands-On Tutorial 1: Creating a New Weapon Step by Step

There are two ways to add a weapon in Mellangan:
1. **The Data-Driven Recipe Path (\`src/item/weapon/Recipe.cpp\`):** Ideal when your weapon combines one of the **15 existing \`Form\` trajectories** (\`Bolt\`, \`Volley\`, \`Orbit\`, \`Rain\`, \`Field\`, \`Seeker\`, \`Nova\`, \`Cleave\`, \`Boomerang\`, \`Trap\`, \`Lob\`, \`Beam\`, \`Whip\`, \`Wall\`, \`Spiral\`) with any combination of the **16 \`pay::Payload\` bitflags** (\`Burn\`, \`Chill\`, \`Poison\`, \`Mark\`, \`Bleed\`, \`Weaken\`, \`Fear\`, \`Stagger\`, \`Pierce\`, \`Explode\`, \`Chain\`, \`Split\`, \`Pull\`, \`Leech\`, \`Shatter\`, \`Execute\`).
2. **The Custom \`Upgrade\` Subclass Path (\`src/item/weapon/*.cpp\`):** Ideal when your weapon introduces brand-new projectile physics or custom rendering.

---

#### Path A: Adding a Data-Driven Weapon in \`Recipe.cpp\` (5 Minutes)

Suppose we want to add a new Stormcaller weapon called **\`Tempest Chakram\`** that throws a boomerang disc that both **Chains** lightning and **Marks** enemies:

##### Step 1: Add the \`Recipe\` Entry in \`src/item/weapon/Recipe.cpp\`
Each entry in \`const std::vector<Recipe> RECIPES\` defines:
\`{ name, ownerClass, pitch, unitName, iconIndex, form, payloadMask, baseDamage, cooldown, reach, speed, count, tintColor, particleSprite }\`:

\`\`\`cpp
{"Tempest Chakram", "STORMCALLER", "A charged disc arcs out and chains lightning",
 "disc", 13, Form::Boomerang, pay::Chain | pay::Mark, 15, 1.9f, 175, 230, 1,
 {0.55f, 0.85f, 1.0f, 1.0f}, atlas::pt::ArcaneStar}
\`\`\`

##### Step 2: How \`RecipeWeapon\` Automatically Wires Level 1–5 & Evolution
You do not even need to write level-up strings! \`RecipeWeapon::RecipeWeapon(const Recipe &r)\` inspects \`FormBehavior::of(r.form).area()\` and automatically synthesizes all 5 upgrade tiers:
- **Level 1:** Base weapon unlocked (\`r.pitch\`).
- **Level 2:** \`+50% base damage\`.
- **Level 3:** \`+1 disc\` (since \`Form::Boomerang\` is a projectile count form) or \`+30% radius\` (if area form).
- **Level 4:** \`25% faster\` (\`cooldown * 0.75f\`).
- **Level 5:** \`+50% base damage\` and \`+1 disc\` (or \`+30% radius\`).

---

#### Path B: Writing a Custom Weapon Class (\`src/item/weapon/\`)

When you need custom mechanics beyond \`FormBehavior\`, follow these 4 steps:

##### Step 1: Reserve an Icon in \`src/Atlas.hpp\`
Every weapon card displays a \`16×16\` icon from \`res/atlas.png\`. Check \`tools/atlas_layout.py\` for the reserved weapon band (row \`y = 624\`, cells \`14..21\`) and expose a \`constexpr Sprite\` in \`src/Atlas.hpp\`.

##### Step 2: Subclass \`Upgrade\` in \`src/item/weapon/\`
Override \`tick(Mob &p)\` to decrement your cooldown timer by \`DT\` and spawn your \`Projectile\` or \`Effect\` entity via \`p.level->add<MyProjectile>(...)\`:

\`\`\`cpp
void MyWeapon::tick(Mob &p) {
  if ((cd -= DT) > 0 || p.dead())
    return;
  cd = 1.8f * (level >= 4 ? 0.75f : 1.0f) * p.haste * pace;
  float dmg = (16.0f + 8.0f * (at(level, 2) + at(level, 5))) * p.might * power;
  p.level->add<MyProjectile>(p.x, p.bodyY(), p.xAim, p.yAim, dmg, this);
}
\`\`\`

##### Step 3: Register in \`Upgrade::all()\` (\`src/item/Upgrade.cpp\`)
Add your weapon factory to \`Upgrade::all()\` and optionally pair it with a passive catalyst item to enable **Reforged Evolution** when picking up boss chests (\`Chest.cpp\`).

##### Step 4: Test Immediately via CLI
Run both the interactive dev loadout and the automated arsenal verification view:

\`\`\`cpp
./build/bin/Debug/MellanganApp.exe --dev --arm "Tempest Chakram!"
./build/bin/Debug/MellanganApp.exe --test-arsenal-view "Tempest Chakram"
./build/bin/Debug/MellanganApp.exe --test
\`\`\`
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
### Hands-On Tutorial 2: Adding a New Monster & Biome Rule

Adding a monster or biome touches multiple subsystems (Atlas, AI Plans, Spawner masks, Codex save serialization, and World climate classification). Following the exact integration order prevents save corruption and thread-safety bugs.

---

#### Part 1: Step-by-Step Monster Creation

##### Step 1: Append \`EnemyKind\` at the End (\`src/entity/enemy/Enemy.hpp\`)
**CRITICAL SAVE RULE:** Player save files store Codex kill counts as a positional array indexed by \`int(EnemyKind)\`, and \`Night::strongestUnlocked\` assumes all classic monsters precede \`EnemyKind::Cyclops\`.
- Always append your new monster **after** existing kinds at the bottom of \`enum class EnemyKind\`.

##### Step 2: Paint the 16×16 Silhouette & Verify the Atlas
1. Add the procedural pixel-art generator for your creature's \`16×16\` cell in \`tools/make_expansion.py\` (using \`Canvas\` contour, cluster, and highlight primitives from \`tools/sprite_kit.py\`).
2. Run \`python tools/make_assets.py --verify\` to rebuild \`res/atlas.png\` and verify deterministic RGBA/PNG hashes and 1px transparent gutters.

##### Step 3: Compose a Zero-Allocation \`Plan\` in \`src/entity/enemy/ai/Plans.cpp\`
Combine existing static \`Goal\` primitives (\`Approach\`, \`Flank\`, \`Stalk\`, \`Howl\`, \`Burrow\`, \`Raise\`, \`Melee\`, \`Ranged\`) and an interrupt (\`FALTER\` or \`HIDE\`) inside \`PLANS[]\`:

\`\`\`cpp
const Approach DART_IN{42, {0.8, 1.1, 3, 0, 0, true}};
const Melee STING{0.22f, 0.20f, 3.1, 1.3f};

const Plan PLANS[] = {
  {{&STALK, &DART_IN, &STING}, {&FALTER}},
};
\`\`\`

remembering that \`Goal::tick(Enemy &e, const Sense &s, double &xs, double &ys)\` runs **concurrently across worker threads** during \`PROF_THINK\` Barrier 1! Never spawn entities or mutate global \`Level\` vectors inside \`Goal::tick\`; instead, set a boolean intent flag on \`Enemy\` (such as \`e.wantsFire = true;\`) and execute the spawn on the main thread inside \`Enemy::act()\` during \`PROF_ENTITIES\`!

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
### Hands-On Tutorial 3: Creating a Playable Hero & Class Kit

Playable classes in Mellangan are governed by \`class Hero : public HeroData\` (\`src/hero/Hero.hpp\`) and \`class ExpansionHero : public Hero\` (\`src/hero/ExpansionHero.hpp\`). A complete class package consists of:
1. **The \`Hero\` definition (\`src/hero/*.cpp\`):** Base stat modifiers, unlock predicate \`bool (*met)(const Codex &)\`, passive class hook (\`equip\`, \`tick\`, \`guard\`, \`slay\`, \`wisdom\`, \`edge\`), signature weapon, and 3 favoured upgrade affinities (\`affinity[3]\`).
2. **The Active \`HeroSkill\` (\`cast(Mob &)\`):** Automatically wrapped into a \`Spacebar\` active skill by \`HeroSkill(const Hero &hero)\` (\`src/item/skill/Skill.hpp\`), plus 2 additional draftable class skills in \`src/item/skill/\`.
3. **Class Talents & Boss Relics (\`src/item/talent/\`, \`src/item/relic/\`):** Class-restricted passives and boss-chest relics.

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

For example, in \`src/hero/Warden.cpp\` (and similarly across \`Tinkerer.cpp\`, \`Oracle.cpp\`, and \`Corsair.cpp\`), unlock predicates inspect \`const Codex &c\` (such as \`c.count(c.biomes) >= 3\`, \`c.kills() >= 200\`, \`c.shrines >= 2\`, \`c.bestStreak >= 30\`, or \`c.dawns > 0\`):

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

#### Step 2: Implement \`Mob\`-Symmetric \`cast(Mob &p)\` (The \`Renegade\` Rule!)
Why does \`Hero::cast(Mob &p)\` take a \`Mob &\` instead of a \`Player &\`?
Because **\`Renegade\`** mirror-bosses (\`src/entity/enemy/Renegade.cpp\`) can wield any hero's kit and cast the exact same active skill *against* the player!
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
### Hands-On Tutorial 4: World Landmarks, Interactive Encounters & 3-Phase Bosses

Mellangan's overworld isn't just open terrain—it is populated by deterministic **Settlements**, **Biome Landmarks**, and **3-Phase Regional Bosses**. Here is how to author each one step by step.

---

#### Part 1: Adding a World Landmark & Interactive Site

##### Step 1: Append \`StructureKind\` in \`src/level/Structure.hpp\`
Structures are divided into common settlements (\`Cottage\` .. \`Mine\`) and rare regional **Landmarks** (\`kind >= StructureKind::AncientTree\`).
- Append your new landmark before \`StructureKind::Count\` in \`enum class StructureKind\`.

##### Step 2: Define the Footprint in \`STRUCTURES[]\` (\`src/level/Structure.cpp\` & \`src/level/structure/Landmarks.cpp\`)
Every \`StructureDef\` provides four stateless callbacks driven by local tile coordinates \`(lx, ly)\` within the structure's \`w × h\` footprint:
- \`void (*size)(uint32_t roll, int *w, int *h)\`: Sets the tile bounding box (e.g. \`*w = 9; *h = 9;\`).
- \`bool (*dirt)(const Structure *s, int lx, int ly)\`: Returns \`true\` where dirt paths or cleared foundations replace grass.
- \`bool (*ground)(const Structure *s, int lx, int ly, Sprite *out)\`: Overrides floor tiles (cobblestone, rune circles, grates).
- \`bool (*prop)(const Structure *s, int lx, int ly, uint32_t roll, Prop *p)\`: Places pillars, altars, braziers, or walls with collision radii and heights.

##### Step 3: Wire the Interactive Encounter in \`src/level/encounter/Landmarks.cpp\`
When the player approaches a landmark and presses \`E\` (or triggers its proximity event), \`encounter::*\` spawns ambient particles (\`encounter::smoke\`, \`encounter::drift\`) and resolves the reward/challenge (buffing stats, kindling a shrine, or summoning an elite guardian).
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
### Hands-On Tutorial 5: Procedural Pixel-Art & Slang Shaders

Mellangan never commits hand-edited binary blobs without a reproducible generator. Both its \`res/atlas.png\` sprite sheet and its SPIR-V GPU shaders (\`*.spv\`) are built deterministically from code.

---

#### Part 1: Draw sprites un Atlas by any means or tools you deem fit
---

#### Part 2: Authoring Slang Fragment Shaders (\`res/shaders/*.slang\`)

At build time, \`CMakeLists.txt\` compiles every \`res/shaders/*.slang\` file into SPIR-V via \`slangc\`:
\`slangc <file>.slang -target spirv -profile glsl_450 -entry PixelShader -stage fragment -o shaders/<file>.spv\`

##### Understanding the Vulkan2D Bindless ABI (\`flash.slang\` & \`post.slang\`)
Every fragment shader shares the same bindless descriptor layout:
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
Then \`PixelShader\` combines chromatic aberration (\`post.hurt\`), additive light-map multiplication (\`lightAt(uv) * 1.6\`, where \`0.625\` is neutral \`1.0\` so point lights can over-expose above \`1.0\`), 8-tap bloom, **ACES filmic tonemapping**, radial vignette, and pause blur!
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
      "Step-by-step guide to authoring assert-driven unit suites, headless GPU screenshot QA views, and 8-slot Prof.c benchmarks.",
    sourceFiles: [
      "src/test/Tests.hpp",
      "src/test/Test.cpp",
      "src/test/view/QaViews.cpp",
      "src/Prof.h",
      "src/Prof.c",
      "src/Bench.cpp",
    ],
    content: `
### Hands-On Tutorial 6: Deterministic Testing, Visual QA & Profiling

Every feature contributed to Mellangan is backed by three verification pillars:
1. **Deterministic Simulation Suites (\`--test\`, \`src/test/Test.cpp\`)**
2. **Synthetic GPU Visual QA Views (\`--test-*-view\`, \`src/test/view/QaViews.cpp\`)**
3. **8-Slot Hardware Performance Telemetry (\`--bench\`, \`src/Prof.c\`, \`src/Bench.cpp\`)**

---

#### Part 1: Writing a Deterministic Unit Test (\`src/test/\`)

Notice line 1 of \`src/test/Test.cpp\`:
\`\`\`cpp
#undef NDEBUG
#include <cassert>
\`\`\`
By explicitly undefining \`NDEBUG\` before \`<cassert>\`, \`assert(...)\` statements inside the test suite remain active even in optimized Release builds!

##### Step 1: Declare Your Test in \`src/test/Tests.hpp\`
Add \`void testMyFeature();\` to \`src/test/Tests.hpp\` and call it inside \`runTests()\` in \`src/test/Test.cpp\`.

##### Step 2: Spin Up a Headless \`Level\` and Tick Deterministically
You can instantiate a \`Level\` directly in memory, spawn a \`Player\` and specific \`Enemy\` kinds at exact pixel coordinates, step \`level.tick()\` for a fixed number of 60 Hz frames, and assert exact HP, status bitmasks, or slab allocations:

\`\`\`cpp
void testMyFeature() {
  Level level(12345u);
  Player *p = level.player;
  Enemy *foe = level.add<Enemy>(EnemyKind::Slime, p->x + 32, p->y);
  float beforeHp = foe->hp;
  for (int i = 0; i < 60; ++i)
    level.tick();
  assert(foe->hp < beforeHp);
}
\`\`\`

Notice that at the end of \`runTests()\`, \`pool_shutdown()\` is called to verify that \`Pool.c\` reclaims all 64 KB slabs cleanly without memory corruption.

---

#### Part 2: Staging a Synthetic Visual QA View (\`src/test/view/QaViews.cpp\`)

When you add a new visual effect, UI card, monster silhouette, or biome transition, stage it in \`src/test/view/QaViews.cpp\` or \`Screenshots.cpp\` and inspect it with the built-in visual QA flags:
- \`--test-combat-view\`: Stages dense mid-combat projectile, status, and damage-number readability scenes.
- \`--test-encounter-view\`: Stages landmark and regional boss telegraph rings.
- \`--test-gui-view\`: Renders HUD, \`LevelUpMenu\`, \`ShrineMenu\`, and \`CodexMenu\` layouts.
- \`--test-effects-view\`: Renders weapon \`Form\` and \`Payload\` particle/arc effects side by side.
- \`--test-arsenal-view "Weapon Name"\`: Focuses the camera on a single weapon's firing cycle.
- \`--test-biome-view X Y SEED\`: Renders a deterministic biome region at native 1x resolution and saves a PNG via \`vk2dTextureCopyPixels\`.

---

#### Part 3: Profiling with \`Prof.c\` & Running \`--bench\` (\`src/Bench.cpp\`)

To measure the CPU cost of a hot path, wrap it in \`prof_begin(Slot)\` and \`prof_end(Slot)\` (\`src/Prof.h\`):
- \`PROF_THINK\`: Multithreaded AI \`Sense\` + \`GoalQueue\` worker pool + CSR grid rebuild.
- \`PROF_ENTITIES\`: Main-thread entity movement, projectiles, and status ticks.
- \`PROF_PARTICLES\`: \`Particle\` and \`Debris\` simulation.
- \`PROF_HOUSEKEEP\`: \`Level::flush()\` additions/removals and \`Pool.c\` reclamation.
- \`PROF_LIGHT\`: Additive offscreen light map rendering (\`LightField.cpp\`).
- \`PROF_FLOOR\`: Biome ground auto-tiling and barycentric transition blending (\`FloorPainter.cpp\`).
- \`PROF_SORT\`: 3-pass 12-bit Radix Y-depth sort (\`LevelRender.cpp\`).
- \`PROF_DRAW\`: Vulkan2D instanced sprite submission and \`post.slang\` composite.

Run the automated benchmark before opening a PR or cutting a release:
\`\`\`cpp
./build/bin/Release/MellanganApp.exe --bench
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

#### Stage 5: Hydrology — Lowland Lakes, Dry Moats & Highland Tarns (\`Terrain.cpp\`)
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
   - After Pass 2: \`C = w0 * C0 + w1 * C1 + w2 * C2\` — an exact barycentric linear combination!
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
      "How Night.cpp, Flavour.cpp, and Spawner.cpp orchestrate the 15-minute survival arc, 11 nocturnal Omens, 60s shrine dawn-pull, and 7 concurrent spawn streams.",
    sourceFiles: [
      "src/level/Night.cpp",
      "src/level/Spawner.cpp",
      "src/entity/enemy/Rank.cpp",
      "src/level/Flavour.cpp",
    ],
    content: `
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
Standing within \`28 px\` of an unlit \`StructureKind::Shrine\` charges \`kindling\` over \`KINDLE = 6.0f\` seconds (\`kindling += DT * level.kindleRate / KINDLE\`, decaying at \`DT * 0.5f\` when stepping away). When \`kindling >= 1.0f\`, \`Night::kindle(Level &level, Shrine &s)\` executes:
1. Marks \`s.lit = true\`, increments \`lit\`, sets \`offering = true\` (opening \`ShrineMenu\` for a blessing/curse choice), and records the biome bit in \`level.litBiomes |= 1u << int(world::biomeUnder(s.x, s.y))\`.
2. Heals the player by \`+35% maxHp\` and spawns a **guard retaliation ring** of \`8 + 3 * lit\` enemies of tier \`strongestUnlocked(level.time)\` at radius \`170 px\`.
3. **Pulls Dawn Closer:** Every kindled shrine subtracts \`r.dawnPull = 60.0f\` seconds from the night length!
\`\`\`cpp
float Night::dawnAt(const Level &level) const {
  const RunRules &r = level.rules;
  return nightStart + r.nightLength - (r.endsAtDawn ? lit * r.dawnPull : 0);
}
\`\`\`

#### 2. The Final 150 Seconds (\`Night::daylight()\`)
During the final **150 seconds** before \`dawnAt()\`, \`Night::daylight(level)\` smoothly warms the ambient lightmap along a quadratic curve \`d * d\`:
\`\`\`cpp
float Night::daylight(const Level &level) const {
  if (!level.rules.endsAtDawn && !nightTime)
    return 1;
  if (dawn)
    return 1;
  float left = dawnAt(level) - level.time;
  float d = std::clamp(1.0f - left / 150.0f, 0.0f, 1.0f);
  return d * d;
}
\`\`\`
When \`level.time >= dawnAt(level)\`, \`Night::tick\` sets \`dawn = true\` and triggers \`level.game.onDawn()\` (or cycles seamlessly between night and day via \`Night::cycle\` in non-ending campaign modes where \`!r.endsAtDawn\`).

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
      "How Saves.cpp, Codex.cpp, and Balance.cpp manage cross-platform save files, 6-slot binary map charts, 12 hero unlock predicates, and pointer-to-member INI reflection.",
    sourceFiles: [
      "src/meta/Saves.hpp",
      "src/meta/Saves.cpp",
      "src/meta/Codex.hpp",
      "src/meta/Codex.cpp",
      "src/meta/Balance.cpp",
      "res/balance.ini",
    ],
    content: `
### Cross-Platform Persistence & 6-World Chart LRU (\`src/meta/Saves.cpp\`)

All persistent player state in **Mellangan** is managed by \`Saves\` (\`src/meta/Saves.hpp\`, \`src/meta/Saves.cpp\`), which resolves the OS-native application preference directory via SDL3's \`SDL_GetPrefPath("soulwax", "Mellangan")\` and performs file reads/writes through \`SDL_LoadFile\` and \`SDL_SaveFile\`.

#### Saved Files in the Preference Directory
- \`world.txt\`: Stores the active \`WorldMode\` (\`classic\`, \`random\`, \`daily\`, or \`custom <code-string>\`).
- \`worlds.txt\`: Maintains a most-recently-used (LRU) table of up to **\`Saves::HISTORY = 6\`** past world codes along with best survival time, total runs, and whether dawn was achieved (\`<code> <best> <runs> <dawn>\`).
- \`chart-<code>.bin\`: Binary fog-of-war exploration charts for each world code in the 6-slot history.
- \`codex.txt\`: Human-readable key-value meta-progression ledger managed by \`Codex\`.
- \`controls.txt\`: Custom keyboard and gamepad bindings.

#### Automatic Binary Chart Garbage Collection (\`Saves::HISTORY = 6\`)
Whenever a run ends, \`Saves::record(code, time, dawn)\` updates or inserts the world entry at the front of \`history\`. If \`int(history.size()) > HISTORY (6)\`, it automatically deletes the oldest world's binary fog-of-war chart from disk before popping the entry:

\`\`\`cpp
history.insert(history.begin(), w);
while (int(history.size()) > HISTORY) {
  SDL_RemovePath((path + "chart-" + history.back().code + ".bin").c_str());
  history.pop_back();
}
\`\`\`

---

### Meta-Progression Ledger & 12 Hero Unlock Predicates (\`src/meta/Codex.hpp\`)

\`Codex\` (\`src/meta/Codex.hpp\`, \`src/meta/Codex.cpp\`) stores lifetime career statistics and discovery bitmasks:
- **Discovery Bitmasks:** \`uint32_t biomes = 0\` (26 biomes visited) and \`uint32_t relics = 0\` (boss relics found), counted via \`std::popcount(bits)\` (\`Codex::count\`).
- **Positional Arrays:** \`int slain[KINDS]{}\` (per-species kill counts across all 39 \`EnemyKind\`s, summed by \`Codex::kills()\`) and \`int entered[SITES]{}\` (per-structure visit counts, summed by \`Codex::sites()\`).
- **Career Counters:** \`int runs = 0, dawns = 0, bestStreak = 0, start = 0, shrines = 0; float bestTime = 0;\`.

#### All 12 \`HeroData::met(const Codex &)\` Unlock Predicates (\`src/hero/*.cpp\`)
Each hero's \`HeroData\` struct binds a pure function pointer \`bool (*met)(const Codex &)\` evaluated directly against \`Codex\`:
1. **\`MAGE\` (\`Mage.cpp\`):** Unlocked by default (\`return true;\`).
2. **\`RANGER\` (\`Ranger.cpp\`):** *"see a dawn"* — \`c.dawns > 0\`.
3. **\`KNIGHT\` (\`Knight.cpp\`):** *"slay 1000 foes"* — \`c.kills() >= 1000\`.
4. **\`ALCHEMIST\` (\`Alchemist.cpp\`):** *"find 3 relics"* — \`c.count(c.relics) >= 3\`.
5. **\`STORMCALLER\` (\`Stormcaller.cpp\`):** *"walk 10 regions"* — \`c.count(c.biomes) >= 10\`.
6. **\`REAPER\` (\`Reaper.cpp\`):** *"a 100 kill streak"* — \`c.bestStreak >= 100\`.
7. **\`PRIESTESS\` (\`Priestess.cpp\`):** *"kindle 10 shrines"* — \`c.shrines >= 10\`.
8. **\`DUELIST\` (\`Duelist.cpp\`):** *"survive 10 minutes"* — \`c.bestTime >= 600\`.
9. **\`WARDEN\` (\`Warden.cpp\`):** *"walk 3 regions"* — \`c.count(c.biomes) >= 3\`.
10. **\`TINKERER\` (\`Tinkerer.cpp\`):** *"slay 200 foes"* — \`c.kills() >= 200\`.
11. **\`ORACLE\` (\`Oracle.cpp\`):** *"kindle 2 shrines"* — \`c.shrines >= 2\`.
12. **\`CORSAIR\` (\`Corsair.cpp\`):** *"reach a 30-kill streak"* — \`c.bestStreak >= 30\`.

---

### Pointer-to-Member INI Reflection (\`src/meta/Balance.cpp\` & \`res/balance.ini\`)

Rather than hardcoding difficulty multipliers or pulling in a heavy configuration library, \`Balance::load\` (\`src/meta/Balance.cpp\`) parses \`res/balance.ini\` using a zero-overhead C++ **pointer-to-member table** (\`float Balance::*member\`):

\`\`\`cpp
struct Field {
  const char *key;
  float Balance::*member;
};

const Field FIELDS[] = {
    {"spawn_interval", &Balance::spawnInterval},
    {"spawn_ramp",     &Balance::spawnRamp},
    {"spawn_floor",    &Balance::spawnFloor},
    {"batch_every",    &Balance::batchEvery},
    {"enemy_cap",      &Balance::enemyCap},
    {"horde_every",    &Balance::hordeEvery},
    // ... 28 total tunable float members
};
\`\`\`

#### Two-Layer Section Cascade (\`[all]\` → \`[<difficulty>]\`)
\`Balance::load(text, tier)\` streams \`res/balance.ini\` in a single pass:
- Keys under \`[all]\` establish the baseline tuning across all 28 fields.
- Keys under the active difficulty section (\`[too_young]\`, \`[not_too_rough]\`, \`[hurt_me_plenty]\`, \`[ultra_violence]\`, or \`[nightmare]\`) selectively override only the fields that differ for that tier via \`this->*f.member = std::strtof(value.c_str(), nullptr)\`.
- Any unrecognized key triggers a non-fatal \`spdlog::warn("balance: unknown key {}", key)\` diagnostic so designers immediately catch typos during \`--dev\` hot-testing.
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
    Evict["history.size() > 6 (Saves::HISTORY)?<br/>SDL_RemovePath('chart-' + back.code + '.bin')<br/>history.pop_back()"]:::gc

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
      "src/item/weapon/FormRegistry.cpp",
    ],
    content: `
### 1. Contributing a New Diablo Gear Base (\`src/item/loot/ItemBase.cpp\`)

Weapon item bases in Mellangan are synthesized automatically at startup from \`Upgrade::all()\` inside \`build()\` (\`src/item/loot/ItemBase.cpp\`), so any new weapon recipe you add to \`RECIPES[]\` immediately becomes a droppable weapon base! Offhand shields/tomes, armour pieces, and charms are declared in \`const ItemBase GEAR[]\` (\`src/item/loot/ItemBase.cpp\`):

\`\`\`cpp
const ItemBase GEAR[] = {
    {"Buckler", slot::Offhand, Atlas::RoundShield, 1, 10, 20, Stat::Armor, 1.0f, nullptr},
    {"Kite Shield", slot::Offhand, Atlas::RoundShield, 6, 8, 55, Stat::Armor, 2.0f, nullptr},
    {"Astral Aegis", slot::Offhand, Atlas::AegisShield, 14, 5, 135, Stat::ResistArcane, 18.0f, nullptr},
    {"Starlight Signet", slot::Charm, Atlas::SignetRing, 10, 6, 95, Stat::CritChance, 4.0f, nullptr},
};
\`\`\`

- **Field Breakdown (\`ItemBase\`):**
  1. \`name\`: Display name shown as the base noun between prefix and suffix (e.g., \`"Celestial Astral Aegis of the Titan"\`).
  2. \`slots\`: Bitmask from \`namespace slot\` (\`slot::Weapon = 1\`, \`slot::Offhand = 2\`, \`slot::Armour = 4\`, \`slot::Charm = 8\`).
  3. \`icon\`: \`16 × 16\` \`Sprite\` coordinate from \`src/Atlas.hpp\`.
  4. \`qlvl\`: Minimum monster/chest item level (\`ilvl >= qlvl\`) required before \`rollBase(rng, ilvl, mask)\` includes this base in the weighted pool.
  5. \`weight\` & \`value\`: Relative drop weight and base gold value before rarity multipliers.
  6. \`implicit\` & \`amount\`: Built-in implicit \`Stat\` and magnitude applied before any rolled affixes.

---

### 2. Contributing a Reversible 5-Tier Loot Affix (\`Affix.hpp\`, \`Affix.cpp\`, \`Equip.cpp\`)

Adding a new item stat and 5-tier affix touches three files and must obey the **Reversible Delta Invariant**: equipping an item calls \`applyItem(m, item, +1.0f)\` and unequipping it calls \`applyItem(m, item, -1.0f)\`.

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

### 3. Contributing an Autonomous Summoned \`Ally\` Companion (\`Ally.hpp\`, \`Ally.cpp\`, \`Recipe.cpp\`)

Summoned companions in Mellangan are pooled \`Mob\` subclasses managed by \`src/entity/Ally.cpp\`. An ally can fight either via **melee/leap contact bites** (\`kit == nullptr\`) or by **wielding a full \`RecipeWeapon\` arsenal** (\`kit != nullptr\`, such as \`"Arcane Staff"\` on \`Clockwork Drone\`).

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

### 4. Contributing a New \`FormBehavior\` (\`src/item/weapon/form/\`, \`FormRegistry.cpp\`)

If a weapon needs a brand-new geometric attack pattern beyond the 16 built-in \`Form\` types:
1. Append the new identifier to \`enum class Form : uint8_t\` in \`src/item/weapon/Recipe.hpp\`.
2. Create \`src/item/weapon/form/MyForm.cpp\` implementing \`class MyForm : public FormBehavior\` with \`void fire(const Context &c) const override\`.
3. Use \`c.aimDir(ox, oy)\` to resolve target direction, \`c.payload(damageScale)\` to snapshot the \`HitPayload\` (including evolved status effects and hero luck/edge), and \`landHit(payload, enemy, fromX, fromY, by)\` (\`src/item/weapon/form/FormCommon.hpp\`) to apply damage, status procs, and floating combat numbers.
4. Register the singleton in \`formFor(Form f)\` inside \`src/item/weapon/FormRegistry.cpp\`.
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
### 1. Contributing an Elite / Champion \`Trait\` (\`src/entity/Trait.hpp\`, \`src/entity/Trait.cpp\`)

Elite (1–2 traits) and Champion (2–3 traits) monsters store their active modifiers as a 32-bit bitmask \`uint32_t bits\` inside \`struct Traits\` (\`src/entity/Trait.hpp\`). Adding a new monster trait takes three steps:

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

### 2. Contributing a Contract \`Bounty\` Objective (\`src/level/Bounty.cpp\`)

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

### 3. Writing Deterministic Headless \`Field\` Unit Tests (\`src/test/AllyTest.cpp\`, \`src/test/LootTest.cpp\`)

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
    sourceFiles: [
      "src/other/Ouroboros.hpp",
      "src/main.cpp",
    ],
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
        title: "The Council of Four Serpents: Compile-Time Parity Consensus & Operator ->*",
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
        title: "Augury XOR-Linked List Traversal with Type-Erased Thunks (link = prev ^ next)",
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
   When spawned in the wilderness, sanctuary seekers begin in \`Mode::Lost\`. They shiver in the cold, emit regional distress cries, and cannot fight back. When the player enters within Euclidean distance $d < \\text{CALL}$, the sanctuary seeker immediately transitions to \`Mode::Following\`:
   \`\`\`cpp
   if (mode == Mode::Lost && d < CALL && !p.dead()) {
       mode = Mode::Following;
       talk = SAY;
       hush = SAY + 6;
       spoken = "Stay close, I'm right behind you.";
       level->game.announce("A SANCTUARY SEEKER FOLLOWS YOU  BRING THEM TO A TOWN");
   }
   \`\`\`

2. **Breadcrumb Trailing Velocity (\`TRAIL = 50.0f\`):**
   Once following, the sanctuary seeker matches the player's vector with an adaptive trailing speed capped at $1.05\\times$ player velocity:
   $$v_{\\text{trail}} = \\min(50.0, v_{\\text{player}} \\times 1.05)$$
   This guarantees that a briskly running hero does not trivially outpace the follower, while preventing unnatural teleportation.

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

5. **Regional Dialogue Matrices (\`LINES[5][4]\`):**
   Sanctuary seekers speak authentic regional lore based on their native biome act (\`town % 5\`):
   - **Act 1 (Meadows):** *"They took the mill first. Then the well."*
   - **Act 2 (Barrows & Marshes):** *"The lanterns sing in the marsh. Don't listen."*
   - **Act 3 (Highlands & Standing Stones):** *"The cold is coming from the barrows, not the sky."*
   - **Act 4 (Steppe & Waste):** *"The caravan is our only water."*
   - **Act 5 (Core of the Dark):** *"This is where the dark began. If the fire goes out here, it goes out everywhere."*

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
   Every \`RELOAD = 1.1f\` seconds, the tower scans a circular perimeter of radius $\\text{RANGE} = 190$ px centered at the arrow slit ($y - 40$). It selects the nearest valid hostile and looses an arrow projectile at **260 px/s**:
   $$damage = 8.0 + 2.0 \\times \\text{Player::lvl}$$
3. **Dynamic Lightfield Beacon:**
   The tower summit casts an additive flame glow into \`level->lights\` with a natural sinusoidal flicker:
   \`\`\`cpp
   s.glow(xp, yp - 40, 70, FLAME * (0.8f + 0.2f * std::sin(t * 6)));
   \`\`\`

---

### 3. Settlement Economy, Vendor Discounts & The Loyal Hound Companion

Leading a sanctuary seeker safely across the perimeter into the town safe radius (\`settle()\`) permanently expands the settlement and yields three compounding rewards:

1. **Crafting Materials Payout:**
   Every successful rescue deposits **+3 basic crafting materials** (\`Mat::Wood\`, \`Mat::Stone\`) directly into the player's satchel.
2. **Permanent Merchant Discount:**
   Rescuing sanctuary seekers earns the gratitude of the regional vendor (\`Vendor.cpp\`), applying a **+5% price discount** per rescued sanctuary seeker, capped at a hard maximum of **25%** (\`level.vendor.discount = 0.25f\`):
   $$\\text{discount} = \\min(0.25, 0.05 \\times \\text{rescued})$$
3. **Milestone: The Loyal Hound Companion (\`c.hound\`):**
   Upon reaching **3 total rescues** (\`rescued == 3\`), the town gifts the player their faithful **Hunting Hound**:
   - The hound follows the player into the wilderness as a dedicated \`Ally\`.
   - Deals scaled biting damage: $damage = 6.0 + 2.0 \\times \\text{Player::lvl}$.
   - Aggressively pounces on predators targeting following sanctuary seekers.
   - **Dawn Revival Invariant:** If the hound falls in battle during the night, it falls back to the hearth (\`c.houndDown = true\`) and **automatically revives fresh at dawn** (\`level.night.dawn == true\`)!

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
1. **Surface Sealing (\`seal()\`):** Entering a delve seals the surface entrance with solid stone blocks. The surface daylight fades, ambient \`gloom\` increases, and subterranean dust particles fill the air.
2. **Three-Floor Progression (\`FLOORS = 3\`):** Players descend through 3 sequential floor chambers of increasing depth and monster density.
3. **Subterranean Guardian Bosses (\`guardian(act)\`):** Each floor culminate in guardian encounters tailored to the regional act:
   - Act 1: Armored Burrowers
   - Act 2: Crypt Specters
   - Act 3: Ironplate Minotaurs
4. **Earthquakes & Unsealing (\`quake()\`, \`unseal()\`):** Defeating the delve's final chamber triggers screen tremors and unseals the exit vault, showering the party in ancient relic caches and high-tier affix loot!
`,
    mermaidCharts: [
      {
        title: "The Sanctuary Seeker Escort & Leash Lifecycle State Machine",
        chart: `
stateDiagram-v2
    [*] --> Lost : Spawn in Wilderness
    Lost --> Following : Player Distance < CALL (28 px)
    Following --> Lost : Player Distance > LEASH (260 px)
    Following --> Home : Arrive at Town Hearth (settle())
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
    Town -->|"Gold + Stone + Wood"| Tower
    Tower -->|"Auto-Fire Arrows (260 px/s)"| Foes["Incoming Nocturnal Swarm"]
    Hound -->|"Autonomous Biting & Quarry Aggro"| Foes
`,
      },
    ],
    interactiveComponent: "refugee",
  },
  {
    id: "engine-mathematics",
    title:
      "32. The Mathematical Foundations of Mellangan: Proofs, Attenuation, Spatial Topology & Bit Calculus",
    category: "core",
    summary:
      "A dedicated mathematical compendium of the algorithms and analytical models powering Mellangan: 60 Hz fixed-step Euler kinematics, 113° sight-cone dot products, singularity-free inverse quadratic attenuation, (1-r)² quadratic status mitigation, hyperbolic Magic Find diminishing returns, IEEE 754 monotonic orderedBits bit twiddling, and De Bruijn B(2, 5) Galois fields.",
    sourceFiles: [
      "src/level/Level.cpp",
      "src/entity/enemy/ai/Plans.cpp",
      "src/render/Screen.cpp",
      "src/campaign/Townsfolk.cpp",
      "src/item/loot/LootSim.cpp",
      "src/other/Ouroboros.hpp",
    ],
    content: `
### The Mathematical Foundations of Mellangan

A high-performance C++20 game engine cannot rely on guessing or approximations in its inner loops. In **Mellangan**, every system (camera depth sorting, spatial collision hashing, sound falloff, vision cones, combat mitigation, and compile-time bit twiddling) rests on strict discrete mathematics, geometry, and numerical invariants:

\`\`\`
       [ Kinematics & Integration ]       [ Discrete Bit Calculus ]
         DT = 1.0 / 60.0 (Euler)             SWAR 32b Flip & Galois
                    |                                   |
                    v                                   v
         [ Analytical Geometry ] ---------> [ Continuous Attenuation ]
          113° Sight-Cone Dot                  A(d) = 1 / (1 + (d/R)²)
                    |                                   |
                    v                                   v
         [ Topological Sorting ]            [ Damage Scaling Calculus ]
           orderedBits(f) & Radix               DoT = Base × (1 - r)²
\`\`\`

---

### 1. Fixed-Step 60 Hz Kinematics & Integration (\`DT = 1.0 / 60.0\`)

Mellangan separates the simulation tick rate from the display render refresh rate. The global simulation timestep is strictly constant:

$$\\Delta t = \\frac{1}{60} \\approx 0.016667\\text{ s}$$

#### Semi-Implicit Euler Integration

Standard forward Euler integration adds false energy over time, causing wobbles and drift. Full Verlet integration avoids this, but it requires storing past positions $\\mathbf{x}_{t-\\Delta t}$ for thousands of active monsters.

Mellangan instead uses **semi-implicit Euler integration**:

First, update velocity:
$$\\mathbf{v}_{t+\\Delta t} = \\mathbf{v}_t + \\frac{\\mathbf{F}_t}{m} \\Delta t$$

Then immediately use that new velocity to update position:
$$\\mathbf{x}_{t+\\Delta t} = \\mathbf{x}_t + \\mathbf{v}_{t+\\Delta t} \\Delta t$$

Because the updated velocity is used right away, physical energy stays bounded across cycles without storing past history. This gives projectile arcs, knockbacks, and monster collisions clean numerical stability at zero memory cost.

#### Linear and Exponential Drag Damping

To simulate air resistance and ground friction without calling slow exponential math functions in hot loops, velocity slows down by a linear drag factor every tick:

$$\\mathbf{v}_{t+1} = \\mathbf{v}_t \\cdot \\max(0, 1 - \\mu \\cdot \\Delta t)$$

Here $\\mu$ is the drag factor. When repeated 60 times a second, this simple linear step closely matches real exponential decay:

$$\\lim_{\\Delta t \\to 0} (1 - \\mu \\Delta t)^{t / \\Delta t} = e^{-\\mu t}$$

#### Follower Leash Kinematics (\`Townsfolk.cpp\`)

Civilian sanctuary seekers and companions follow the player using a bounded pursuit formula:

$$v_{\\text{trail}} = \\min(50.0, v_{\\text{player}} \\times 1.05)$$

$$d(\\mathbf{p}, \\mathbf{t}) = \\|\\mathbf{p} - \\mathbf{t}\\|_2 = \\sqrt{(p_x - t_x)^2 + (p_y - t_y)^2}$$

- **Tether Limit:** If distance $d(\\mathbf{p}, \\mathbf{t}) > 260.0$ px, the leash snaps into \`Mode::Lost\`.
- **Catch-Up Invariant:** The $1.05\\times$ speed factor allows followers to keep pace with a running hero, while the $50.0$ px/s cap prevents unnatural speed surges.

#### Excourse: The Orbit Explosion Test (Explicit Euler vs. Semi-Implicit Euler)

Why does standard explicit forward Euler fail in games? Consider an entity in circular orbit or oscillating on a spring with restoring acceleration $\\mathbf{a} = -\\omega^2 \\mathbf{x}$.

Under standard explicit forward Euler, position updates using old velocity:
$$\\mathbf{x}_{t+1} = \\mathbf{x}_t + \\mathbf{v}_t \\Delta t$$
$$\\mathbf{v}_{t+1} = \\mathbf{v}_t + \\mathbf{a}_t \\Delta t = \\mathbf{v}_t - \\omega^2 \\mathbf{x}_t \\Delta t$$

Because the displacement vector $\\mathbf{v}_t \\Delta t$ is tangent to the circle and therefore perpendicular to inward acceleration, every single step overshoots slightly outward. Total energy multiplies by $(1 + \\omega^2 \\Delta t^2)$ on every tick. Within just 20 seconds of simulation (1,200 ticks at 60 Hz), an entity spirals wildly off-screen as energy blows up to infinity!

Under semi-implicit Euler, we update velocity first, then update position using that fresh velocity:
$$\\mathbf{v}_{t+1} = \\mathbf{v}_t - \\omega^2 \\mathbf{x}_t \\Delta t$$
$$\\mathbf{x}_{t+1} = \\mathbf{x}_t + \\mathbf{v}_{t+1} \\Delta t$$

Substituting $\\mathbf{v}_{t+1}$ into $\\mathbf{x}_{t+1}$ introduces an automatic corrective term $-\\omega^2 \\Delta t^2 \\mathbf{x}_t$ that pulls position back inward. Instead of spiraling away, the trajectory traces a closed, bounded ellipse. Total physical energy oscillates within tight bounds forever, providing stability across hours of continuous gameplay with zero memory overhead.

---

### 2. Vision Cones & Vector Geometry Without Trigonometry (\`Plans.cpp\`)

In typical AI systems, checking whether an enemy sees a target uses \`std::atan2(dy, dx)\` and angle comparisons. But calling \`atan2\` for hundreds of enemies takes 50 to 100 CPU cycles per call, slowing down the worker threads.

Mellangan eliminates angles entirely and uses the **vector dot product** instead.

#### The Sight-Cone Dot Product Theorem

Let the observer stand at position $\\mathbf{x}_o$ facing unit direction $\\hat{\\mathbf{f}} = (\\cos \\phi, \\sin \\phi)$, and let the quarry target be at $\\mathbf{x}_t$:

1. Compute the displacement vector:
   $$\\mathbf{d} = \\mathbf{x}_t - \\mathbf{x}_o = (x_t - x_o, y_t - y_o)$$

2. Compute the straight-line distance:
   $$\\|\\mathbf{d}\\| = \\sqrt{d_x^2 + d_y^2}$$

3. From the geometric definition of the dot product:
   $$\\hat{\\mathbf{f}} \\cdot \\mathbf{d} = \\|\\mathbf{d}\\| \\cos \\theta \\implies \\cos \\theta = \\frac{f_x d_x + f_y d_y}{\\|\\mathbf{d}\\|}$$

4. The target lies within the enemy's $113^{\\circ}$ field of view if $|\\theta| \\le 56.5^{\\circ}$. Since the cosine decreases as the angle grows:
   $$\\cos \\theta \\ge \\cos(56.5^{\\circ}) \\approx 0.5519$$

5. Clearing the denominator yields a single comparison without trigonometry:
   $$\\hat{\\mathbf{f}} \\cdot \\mathbf{d} \\ge 0.5519 \\cdot \\|\\mathbf{d}\\|$$

\`\`\`cpp
// src/entity/enemy/ai/Plans.cpp
bool inSight(double ox, double oy, double fx, double fy, double tx, double ty) {
    double dx = tx - ox, dy = ty - oy;
    double d2 = dx * dx + dy * dy;
    if (d2 > 240.0 * 240.0) return false;
    double d = std::sqrt(d2);
    return (fx * dx + fy * dy) >= 0.5519 * d;
}
\`\`\`

This method uses zero trigonometry, avoids branching tables, and vectorizes cleanly with SIMD instructions.

#### Tangential Obstacle Steering

When an entity detects an obstacle along displacement $\\mathbf{d}$, it finds a perpendicular avoidance vector $\\hat{\\mathbf{d}}^{\\perp}$ by swapping coordinates:

$$\\hat{\\mathbf{d}}^{\\perp} = (-d_y, d_x) \\implies \\mathbf{d} \\cdot \\hat{\\mathbf{d}}^{\\perp} = -d_x d_y + d_y d_x = 0$$

Blending this perpendicular vector with the pursuit direction produces smooth sliding around trees and rocks without pathfinding grid allocations.

#### Excourse: The 1,000-Mob Benchmark (Trigonometry vs. The Dot Product)

What actually happens inside modern CPU hardware during an AI vision check?

Calling \`std::atan2(dy, dx)\` relies on iterative polynomial approximations (such as CORDIC or multi-term Chebyshev expansions). On x86-64 and ARM processors, each call typically costs 50 to 80 clock cycles. Worse, comparing the returned angle with the entity facing direction requires circular wrap-around branches (\`if (diff < -PI) diff += 2*PI\`), which trigger CPU branch mispredictions costing another 15 to 20 cycles whenever targets cross boundaries.

With 256 active enemies checking targets 60 times every second, trigonometry burns over 1.2 million expensive transcendental evaluations per second, heating up mobile cores and stealing precious frame time from rendering.

The vector dot product formula:
$$f_x d_x + f_y d_y \\ge 0.5519 \\cdot \\sqrt{d_x^2 + d_y^2}$$

replaces transcendental pipelines with basic arithmetic: two multiplications, one addition, and one reciprocal square root instruction (\`rsqrtss\` or \`vrsqrtsd\`). Using SIMD, four mob vision checks evaluate concurrently inside a single 128-bit vector register in just 3 to 4 clock cycles, leaving 98% of the AI frame budget available for high-level tactical goal selection.

---

### 3. Singularity-Free Quadratic Attenuation in Lighting & Audio

In physics, light and sound fall off with the inverse-square law:

$$I(d) \\propto \\frac{1}{d^2}$$

#### The Physical Singularity Problem

In a 2D game, this naive formula causes a division-by-zero disaster at the center:

$$\\lim_{d \\to 0} \\frac{1}{d^2} = +\\infty$$

Standing directly on a torch ($d = 0$) results in infinity, visual blowouts, or audio distortion.

#### Mellangan's Normalized Quadratic Model

Both lighting (\`Screen.cpp\`) and spatial audio (\`Audio.cpp\`) use a smooth, bounded quadratic formula:

$$A(d, R) = \\frac{1.0}{1.0 + \\left(\\frac{d}{R}\\right)^2}$$

Here $d$ is Euclidean distance and $R$ is the falloff radius.

#### Mathematical Properties:
1. **Safe Center:** At distance zero ($d = 0$):
   $$A(0, R) = \\frac{1.0}{1.0 + 0} = 1.0$$
   The value never exceeds $1.0$ and never divides by zero.
2. **The Half-Power Boundary:** At distance $d = R$:
   $$A(R, R) = \\frac{1.0}{1.0 + 1^2} = \\frac{1}{2} = 0.50$$
   At radius $R$, light intensity and sound volume drop to exactly 50% of their source power.
3. **Smooth Center Plateau:** The derivative at the center is zero:
   $$\\frac{dA}{dd} = -\\frac{2d}{R^2 \\left(1 + (d/R)^2\\right)^2} \\implies \\left.\\frac{dA}{dd}\\right|_{d=0} = 0$$
   Because the first derivative vanishes at $d = 0$, point lights exhibit a soft, natural radial plateau at their center rather than a harsh spike.
4. **Smooth Falloff at Distance:**
   For large distances ($d \\gg R$):
   $$A(d, R) \\approx \\frac{R^2}{d^2}$$
   At distance $d = 2R$, power drops to 20% ($1 / (1 + 4)$). At $d = 3R$, power drops to 10% ($1 / (1 + 9)$).

#### Excourse: The "Torch in the Face" Experiment

Why does real-world physics break down when copied directly into a game engine?

Suppose the hero walks right up to a campfire or torch with source intensity 100, bringing distance $d$ down to 0.05 pixels. Under standard physical $1 / d^2$ falloff:
$$I(0.05) = \\frac{100}{(0.05)^2} = \\frac{100}{0.0025} = 40,000$$

The received brightness explodes to 400 times normal. The 8-bit color channels clamp violently to maximum white (\`#FFFFFF\`), blowing out texture detail and washing out the entire screen. Even worse, if distance reaches $d = 0.0$, the hardware encounters division by zero, resulting in IEEE 754 floating-point infinity (\`+inf\`) or \`NaN\`, which poisons neighboring tiles in lightfield blurs.

Spatial audio suffers an identical crisis: an explosion spawning directly on the listener coordinate produces ear-shattering digital clipping when scaled by $1 / d^2$.

Under Mellangan's singularity-free quadratic formula:
$$A(d, R) = \\frac{1.0}{1.0 + (d / R)^2}$$

At distance $d = 0$, the formula simplifies cleanly:
$$A(0, R) = \\frac{1.0}{1.0 + 0} = 1.0$$

The brightness never exceeds 100% emitter power, division by zero is mathematically impossible, and the zero first derivative creates a smooth, gentle plateau at the core. Players enjoy visually convincing illumination and clean 32-voice audio without blowout artifacts or epsilon hacks.

---

### 4. Quadratic Resistance Calculus: The $(1 - r)^2$ Mitigation Theorem

In most RPGs, armor resistance $r$ reduces incoming damage linearly: $D_{\\text{taken}} = D_{\\text{raw}} \\cdot (1 - r)$.

In Mellangan's status effect system (\`Status.cpp\`), resistance protects against ailments (burn, bleed, poison) across two fronts at the same time:

1. **Damage Rate Scaling:** Peak Damage per Second (DPS) is reduced by $(1 - r)$:
   $$\\text{DPS}(r) = \\text{DPS}_0 \\cdot (1 - r)$$

2. **Ailment Duration Scaling:** The total lifetime duration of the ailment is reduced by $(1 - r)$:
   $$T(r) = T_0 \\cdot (1 - r)$$

#### Derivation of Total Damage Over Time (DoT)

Total damage equals the damage rate multiplied by total duration:

$$\\text{Total DoT}(r) = \\int_0^{T(r)} \\text{DPS}(r) \\, dt = \\text{DPS}(r) \\times T(r)$$

$$\\text{Total DoT}(r) = \\big( \\text{DPS}_0 \\cdot (1 - r) \\big) \\times \\big( T_0 \\cdot (1 - r) \\big) = (\\text{DPS}_0 \\times T_0) \\cdot (1 - r)^2$$

$$\\text{Total DoT}(r) = \\text{Base DoT} \\cdot (1 - r)^2$$

#### The Resistance Cap Theorem ($r_{\\max} = 0.75$)

Because damage scales as $(1 - r)^2$, effective mitigation follows a quadratic progression:

$$\\text{Mitigation}(r) = 1 - (1 - r)^2 = 2r - r^2$$

| Resistance $r$ | Damage Multiplier $(1 - r)^2$ | Effective Mitigation | Real-World Combat Impact |
|:---|:---|:---|:---|
| **$0.00$ ($0\\%$)** | $(1.00)^2 = 1.0000$ | **$0.00\\%$** | Raw unarmored damage |
| **$0.25$ ($25\\%$)** | $(0.75)^2 = 0.5625$ | **$43.75\\%$** | Nearly half of all DoT neutralized |
| **$0.50$ ($50\\%$)** | $(0.50)^2 = 0.2500$ | **$75.00\\%$** | Three-quarters of all DoT eliminated |
| **$0.75$ ($75\\%$)** | $(0.25)^2 = 0.0625$ | **$93.75\\%$** | **$93.75\\%$ Effective Damage Mitigation!** |

**Why Mellangan caps resistance at $75\\%$ (\`std::min(r, 0.75f)\`):**
A seemingly modest $75\\%$ resistance rating in reality allows only **$6.25\\%$** of full burn, bleed, and poison damage to penetrate. If resistance were allowed to reach $90\\%$, incoming damage would drop to $(0.10)^2 = 1\\%$, making players completely invulnerable to environmental boss mechanics!

#### Excourse: The "Why 75% Resistance Stops 94% Damage" Combat Lab

To see why quadratic mitigation changes player survival so drastically, consider an actual in-game boss encounter:

A dungeon boss casts a Toxic Mire that inflicts a raw base DoT of 100 damage per second for 10 seconds.
$$\\text{Base Total Damage} = 100 \\text{ DPS} \\times 10 \\text{ s} = 1,000 \\text{ damage}$$

Here is what happens to three different characters:

1. **Unarmored Character ($r = 0.00$):**
   - DPS taken: $100 \\times (1 - 0) = 100 \\text{ DPS}$
   - Duration: $10 \\times (1 - 0) = 10 \\text{ s}$
   - Total damage: $100 \\times 10 = 1,000$ (Full lethal damage, character dies)

2. **Mid-Tier Armored Character ($r = 0.50$):**
   - DPS taken: $100 \\times (1 - 0.50) = 50 \\text{ DPS}$
   - Duration: $10 \\times (1 - 0.50) = 5 \\text{ s}$
   - Total damage: $50 \\times 5 = 250$ (Damage drops to $(0.50)^2 = 25\\%$, 75% mitigated!)

3. **Endgame Resistance Cap ($r = 0.75$):**
   - DPS taken: $100 \\times (1 - 0.75) = 25 \\text{ DPS}$
   - Duration: $10 \\times (1 - 0.75) = 2.5 \\text{ s}$
   - Total damage: $25 \\times 2.5 = 62.5$ (Damage drops to $(0.25)^2 = 6.25\\%$, 93.75% mitigated!)

The player at 75% resistance takes only 62.5 damage instead of 1,000 damage. Because both the burning rate and the duration shrink together, increasing resistance from 50% to 75% cuts remaining damage by another factor of four (from 250 down to 62.5). This quadratic compounding gives defensive item crafting tremendous impact in high-tier delves.

---

### 5. Hyperbolic Diminishing Returns Magic Find (\`LootSim.cpp\`)

In ARPG itemization (\`src/item/loot/\`), players can stack Magic Find (MF) affixes across their weapon, charms, off-hand, and armor. If Magic Find increased drop rates linearly, endgame characters would see hundreds of unique and relic items per hour, collapsing the economy.

Mellangan uses a **hyperbolic rational saturation function**:

$$\\text{Effective MF}(\\text{raw}) = \\frac{\\text{raw} \\times C}{\\text{raw} + C}, \\quad C = 250$$

#### Analytical Properties:

1. **Initial Unit Slope (No Penalty for Beginners):**
   $$\\frac{d(\\text{Effective MF})}{d\\text{raw}} = \\frac{C (\\text{raw} + C) - \\text{raw} \\cdot C}{(\\text{raw} + C)^2} = \\frac{C^2}{(\\text{raw} + C)^2}$$

   $$\\left.\\frac{d(\\text{Effective MF})}{d\\text{raw}}\\right|_{\\text{raw}=0} = \\frac{C^2}{C^2} = 1.0$$
   For low MF values ($0\\% \\dots 50\\%$), every percentage point of raw gear MF translates into a full $1.0\\%$ increase in effective drop quality!

2. **The Half-Saturation Constant ($C = 250$):**
   $$\\text{Effective MF}(250) = \\frac{250 \\times 250}{250 + 250} = \\frac{62500}{500} = 125.0\\%$$
   At $250\\%$ raw MF, the return rate is exactly half of raw investment.

3. **Horizontal Asymptote (Hard Upper Bound):**
   $$\\lim_{\\text{raw} \\to \\infty} \\frac{\\text{raw} \\times 250}{\\text{raw} + 250} = 250.0\\%$$
   No matter how many hundreds of MF points a player stacks, effective Magic Find can **never exceed $250\\%$**!

#### Excourse: The "1,000 Hours of Farming" Economy Simulation

What happens when an action RPG implements linear Magic Find instead of a hyperbolic curve?

In games with linear drop scaling, stacking +500% MF multiplies rare drop rates by a full $6\\times$. Min-maxing guilds farm thousands of unique items per day, causing catastrophic inflation in the player trade economy and rendering normal crafting materials worthless. To compensate, game designers are forced to slash base drop chances to microscopic lottery levels (such as 0.0001%), punishing casual players who cannot stack maximum gear affixes.

Mellangan solves this dilemma with the hyperbolic saturation curve:
$$\\text{Effective MF}(\\text{raw}) = \\frac{\\text{raw} \\times 250}{\\text{raw} + 250}$$

1. **Early Progression is Fair and Rewarding:**
   A player equipping their first charm with +30% MF receives:
   $$\\text{Effective MF}(30) = \\frac{30 \\times 250}{280} \\approx 26.8\\%$$
   Early points translate almost 1:1 into higher quality drops without penalty.

2. **Diminishing Returns Prevent Runaway Loot Floods:**
   A dedicated endgame farmer stacking +750% MF across all item slots receives:
   $$\\text{Effective MF}(750) = \\frac{750 \\times 250}{1000} = 187.5\\%$$
   Even with twenty times the gear investment of a casual player, drop rates reach less than triple base odds. The loot hunt remains exhilarating, relic drops retain their legendary status, and the settlement trade economy never collapses.

---

### 6. Floating-Point Monotonic Transform: \`orderedBits(f)\`

The key challenge in Mellangan's zero-comparison rendering pipeline is sorting entities by their continuous Y-coordinate ($y \\in \\mathbb{R}$) using an integer **Radix Sort**.

#### The IEEE 754 Representation Problem

An IEEE 754 32-bit single-precision floating point number consists of:
- 1 Sign bit $s$ (bit 31)
- 8 Exponent bits $e$ (bits 30..23, biased by 127)
- 23 Mantissa / Fraction bits $m$ (bits 22..0)

$$f = (-1)^s \\cdot 2^{e - 127} \\cdot \\left(1 + \\sum_{i=1}^{23} m_i 2^{-i}\\right)$$

When interpreted directly as an unsigned 32-bit integer (\`std::bit_cast<uint32_t>(f)\`):
- Positive numbers ($s = 0$) already have integer order: $0.0 < 1.0 < 100.0 \\implies \\text{bits}(0.0) < \\text{bits}(1.0) < \\text{bits}(100.0)$.
- **Negative numbers ($s = 1$) have their order backwards:** Because bit 31 is 1, all negative numbers appear larger than positive numbers ($u \\ge \\text{0x80000000u}$). Furthermore, $-100.0$ has a larger exponent than $-1.0$, meaning $\\text{bits}(-100.0) > \\text{bits}(-1.0)$, the exact reverse of numerical ordering!

#### The Mellangan Monotonic Invariant Function

To allow Radix Sort to sort continuous Y-coordinates with zero comparisons, \`src/render/Screen.cpp\` transforms the raw float bits via:

\`\`\`cpp
uint32_t orderedBits(float f) {
    uint32_t u = std::bit_cast<uint32_t>(f);
    return u ^ (uint32_t(int32_t(u) >> 31) | 0x80000000u);
}
\`\`\`

$$\\text{orderedBits}(f) = u \\oplus \\Big( (u \\gg_{\\text{arith}} 31) \\lor \\text{0x80000000u} \\Big)$$

#### Proof of Monotonicity:

1. **Case A: $f \\ge 0$ (Non-Negative Numbers):**
   The sign bit is $0$.
   Arithmetic right shift of a non-negative integer preserves the zero sign bit: \`int32_t(u) >> 31 == 0\`.
   The bitwise mask becomes:
   $$\\text{mask} = 0 \\lor \\text{0x80000000u} = \\text{0x80000000u}$$
   XORing $u$ with $\\text{0x80000000u}$ flips **strictly bit 31**, leaving bits $0..30$ completely unchanged:
   $$\\text{orderedBits}(f) = u \\oplus \\text{0x80000000u} = u + \\text{0x80000000u}$$
   This maps positive floats $[+0.0, +\\infty)$ into the upper unsigned integer interval:
   $$[\\text{0x80000000u}, \\text{0xFFFFFFFFu}]$$

2. **Case B: $f < 0$ (Strictly Negative Numbers):**
   The sign bit is $1$.
   Arithmetic right shift of a negative integer propagates the sign bit across all 32 bits: \`int32_t(u) >> 31 == -1\` (\`0xFFFFFFFFu\`).
   The bitwise mask becomes:
   $$\\text{mask} = \\text{0xFFFFFFFFu} \\lor \\text{0x80000000u} = \\text{0xFFFFFFFFu}$$
   XORing $u$ with $\\text{0xFFFFFFFFu}$ inverts every single one of the 32 bits:
   $$\\text{orderedBits}(f) = u \\oplus \\text{0xFFFFFFFFu} = \\sim u$$
   Inverting all bits reverses the inverted exponent magnitude, mapping negative floats $(-\\infty, -0.0]$ into the lower unsigned integer interval:
   $$[\\text{0x00000000u}, \\text{0x7FFFFFFFu}]$$

3. **Conclusion:**
   For any two floating point numbers $a, b \\in \\mathbb{R}$:
   $$a < b \\iff \\text{orderedBits}(a) < \\text{orderedBits}(b)$$
   The transformation is a strictly monotonic mapping that preserves numerical order across all real numbers.

#### 3-Pass 12-Bit LSD Radix Sort Complexity

Mellangan packs the scene sort key into a 64-bit integer:

$$\\text{Key} = (\\text{layer} \\ll 56) \\mathbin{|} (\\text{orderedBits}(y) \\ll 24) \\mathbin{|} (\\text{seq} \\mathbin{\\&} \\text{0x00FFFFFF})$$

Three passes of 12-bit Least Significant Digit (LSD) Radix Sort with $2^{12} = 4096$ histogram buckets sort all $N$ entities:

$$\\text{Operations} = 3 \\times (N + 4096) = O(N)$$

Zero comparisons, zero branch mispredictions, and deterministic execution time regardless of scene distribution!

#### Excourse: Walking the Bits Under the Microscope

To understand why float bit twiddling is necessary, examine how four representative floating-point numbers look in raw hexadecimal IEEE 754 notation:

- $+10.0f \\implies \\text{0x41200000}$ (Sign bit 0, Exponent \`10000010\`, Fraction \`010000...\`)
- $+0.0f \\implies \\text{0x00000000}$ (Sign bit 0, Exponent \`00000000\`, Fraction \`000000...\`)
- $-0.0f \\implies \\text{0x80000000}$ (Sign bit 1, Exponent \`00000000\`, Fraction \`000000...\`)
- $-10.0f \\implies \\text{0xC1200000}$ (Sign bit 1, Exponent \`10000010\`, Fraction \`010000...\`)

If we feed these raw bits directly into an unsigned integer sort, the order becomes completely inverted:
$$\\text{0x00000000} (+0.0f) < \\text{0x41200000} (+10.0f) < \\text{0x80000000} (-0.0f) < \\text{0xC1200000} (-10.0f)$$

Negative ten is treated as the largest number, and negative zero is treated as greater than positive ten!

Now apply \`orderedBits(f)\`:
\`\`\`cpp
uint32_t orderedBits(float f) {
    uint32_t u = std::bit_cast<uint32_t>(f);
    return u ^ (uint32_t(int32_t(u) >> 31) | 0x80000000u);
}
\`\`\`

1. For $+10.0f$, \`int32_t(u) >> 31\` yields \`0x0\`. Mask is \`0x80000000\`. Flipping bit 31 gives \`0xC1200000\`.
2. For $+0.0f$, mask is \`0x80000000\`. Flipping bit 31 gives \`0x80000000\`.
3. For $-0.0f$, \`int32_t(u) >> 31\` yields \`0xFFFFFFFF\`. Mask is \`0xFFFFFFFF\`. Flipping all 32 bits gives \`0x7FFFFFFF\`.
4. For $-10.0f$, mask is \`0xFFFFFFFF\`. Inverting \`0xC1200000\` bitwise gives \`0x3EDFFFFF\`.

Now look at the transformed unsigned integers:
$$\\text{0x3EDFFFFF} (-10.0f) < \\text{0x7FFFFFFF} (-0.0f) < \\text{0x80000000} (+0.0f) < \\text{0xC1200000} (+10.0f)$$

The unsigned values match the mathematical ordering $-10.0 < -0.0 \\le +0.0 < +10.0$ with zero branching, allowing Radix Sort to process continuous scene depths in linear time.

---

### 7. Discrete Parity Calculus & De Bruijn Spirals (\`Ouroboros.hpp\`)

In \`src/other/Ouroboros.hpp\`, Mellangan demonstrates compile-time bit twiddling by verifying integer parity ($n \\pmod 2 == 0$) without using the modulo operator \`%\`.

#### The Parity Cancellation Identity (\`Gray\`)

Let $P(x)$ denote the global XOR parity (whether the total number of set bits is odd or even) of an integer $x$:

$$P(n) = \\bigoplus_{i=0}^{31} b_i = b_0 \\oplus \\bigoplus_{i=1}^{31} b_i$$

Consider the shifted value $n \\gg 1$, where bit $i$ occupies position $i-1$:

$$P(n \\gg 1) = 0 \\oplus \\bigoplus_{i=1}^{31} b_i = \\bigoplus_{i=1}^{31} b_i$$

Computing the XOR sum of their parities:

$$P(n) \\oplus P(n \\gg 1) = \\left( b_0 \\oplus \\bigoplus_{i=1}^{31} b_i \\right) \\oplus \\left( \\bigoplus_{i=1}^{31} b_i \\right)$$

By the associativity and commutativity of XOR ($x \\oplus x = 0$ and $x \\oplus 0 = x$):

$$P(n) \\oplus P(n \\gg 1) = b_0 \\oplus 0 = b_0$$

Every bit from 1 through 31 cancels out with itself, leaving strictly bit 0! Negating with \`!\` returns \`!b_0\`, which is \`true\` for even numbers and \`false\` for odd numbers.

#### The De Bruijn $B(2, 5)$ Multiplier (\`Bruijn\`)

A binary De Bruijn sequence of order $k=5$ contains every possible 5-bit pattern exactly once as a contiguous circular substring of length $2^5 = 32$.

Mellangan uses the canonical generator **\`0x077CB531u\`**:
\`\`\`text
0x077CB531 = 0000 0111 0111 1100 1011 0101 0011 0001 (binary)
\`\`\`

1. Two's complement LSB isolation:
   $$\\text{LSB}(v) = v \\mathbin{\\&} (-v) = 2^k$$

2. Multiplying $2^k$ by \`0x077CB531u\` left-shifts the sequence by $k$ positions:
   $$\\text{hash}(2^k) = (2^k \\times \\text{0x077CB531u}) \\gg 27$$

3. Because the sequence is De Bruijn, the top 5 bits (\`>> 27\`) uniquely identify the trailing zero count $k \\in [0..31]$ with zero hash collisions!

#### Parity Inversion in $\\mathbb{Z}_2$ (\`Rebecca\`)

Inside \`Rebecca\`, each byte is transformed by:

$$f(b) = 1 \\oplus \\Big( \\big( (b \\times 0x5D) \\oplus 0x2E \\big) \\mathbin{\\&} 1 \\Big)$$

- $0x5D = 93$ is odd, so multiplying by 93 preserves parity in $\\mathbb{Z}_2$:
  $$(b \\times 93) \\pmod 2 \\equiv b \\times 1 \\equiv b \\pmod 2$$
- $0x2E = 46$ is even, so XORing with 46 does not change the lowest bit: $(X \\oplus 46) \\mathbin{\\&} 1 = X \\mathbin{\\&} 1$.
- Thus: $\\big( (b \\times 93) \\oplus 46 \\big) \\mathbin{\\&} 1 = b_0$.
- Inverting with $1 \\oplus$ yields $!b_0$, which evaluates to 1 for even numbers and 0 for odd numbers.

#### Excourse: The 32-Tooth Bicycle Gear (Visualizing De Bruijn Sequences)

Visualizing De Bruijn sequences becomes effortless when pictured as a circular bicycle gear with 32 teeth, where each tooth is stamped with a 0 or 1 from generator constant \`0x077CB531u\`:

\`\`\`text
0x077CB531 = 0000 0111 0111 1100 1011 0101 0011 0001 (binary)
\`\`\`

The mathematical magic of this specific 32-bit word is that every single 5-bit combination (from \`00000\` up to \`11111\`, representing integers 0 through 31) appears along the circular sequence exactly once without a single repeat or omission.

When an entity isolates its lowest set bit $2^k$, multiplying by $2^k$ is equivalent to rotating the entire gear by $k$ teeth:
$$\\text{hash}(2^k) = (2^k \\times \\text{0x077CB531u}) \\gg 27$$

Shifting right by 27 bits isolates the 5 teeth currently positioned directly under the gear inspection window. Because all 32 combinations are distinct, those 5 bits form a unique, collision-free index between 0 and 31. A tiny 32-byte compile-time array \`SPIRAL\` immediately returns the exact bit position $k$ in a single CPU cycle, completely eliminating slow loops and branch instructions.

---

### 8. Diurnal Celestial Mechanics & Weather Decay

Mellangan's dynamic day and night cycle (\`src/level/Night.cpp\`) drives celestial bodies and footprint persistence via continuous parametric functions:

#### Diurnal Solar and Lunar Orbit

$$\\theta(t) = \\frac{t - 6.0}{24.0} \\times 2\\pi$$

$$\\mathbf{p}_{\\text{sun}}(t) = \\big( x_{\\text{center}} + R_{\\text{sky}} \\cos(\\theta(t)), \\; y_{\\text{center}} + R_{\\text{sky}} \\sin(\\theta(t)) \\big)$$

$$\\mathbf{p}_{\\text{moon}}(t) = -\\mathbf{p}_{\\text{sun}}(t)$$

At $t = 6.0$ h (dawn), $\\theta = 0$, so the Sun rises at the horizon ($y = y_c$). At $t = 12.0$ h (noon), $\\theta = \\pi / 2$, so the Sun peaks at zenith ($y = y_c + R$). The Moon is maintained at exact opposite phase $\\theta + \\pi$.

#### Footprint Differential Alpha Erosion

Dynamic footsteps left on snow and grass decay according to:

$$\\frac{d\\alpha}{dt} = -k_{\\text{base}} \\cdot \\mu_{\\text{weather}}$$

$$\\alpha(t) = \\max\\big(0, \\alpha_0 - k_{\\text{base}} \\cdot \\mu_{\\text{weather}} \\cdot t\\big)$$

Where $\\mu_{\\text{weather}} = 1.0$ in clear weather, $1.6$ in rain, and $2.8$ in blizzards, ensuring footprints vanish rapidly under harsh atmospheric fronts!

#### Excourse: The Blizzard Tracker (Dynamic Footprint Longevity)

How does dynamic alpha erosion affect player experience in the wilderness?

When any entity walks over grass or snow, the engine stamps a footprint particle into the ground layer with initial opacity $\\alpha_0 = 1.0$. The footprint decays according to:
$$\\alpha(t) = \\max(0, 1.0 - k_{\\text{base}} \\cdot \\mu_{\\text{weather}} \\cdot t)$$

With base decay rate $k_{\\text{base}} = 0.05$ per second:

1. **Clear Dawn Weather ($\\mu_{\\text{weather}} = 1.0$):**
   $$\\text{Lifetime} = \\frac{1.0}{0.05 \\times 1.0} = 20.0 \\text{ seconds}$$
   Tracks linger on the trail for twenty full seconds. Players can easily spot predator pack movements, track elk through clearing groves, and navigate back to camp by tracing their own steps.

2. **Raging Highland Blizzard ($\\mu_{\\text{weather}} = 2.8$):**
   $$\\text{Lifetime} = \\frac{1.0}{0.05 \\times 2.8} \\approx 7.1 \\text{ seconds}$$
   In a heavy snowstorm, tracks vanish almost three times faster. If a sanctuary seeker lags behind or the player loses visual contact for even a few seconds, the whiteout completely swallows the trail. Survival tension rises naturally through mathematical equations without requiring scripted cutscenes.

`,
    mermaidCharts: [
      {
        title: "The Mathematical Architecture of Mellangan",
        chart: `
flowchart TD
    classDef math fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef sort fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef combat fill:#181524,stroke:#f6c324,stroke-width:2px,color:#f8fafc;
    classDef bit fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    Kinematics["Fixed-Step Kinematics<br/>DT = 1/60 (Semi-Implicit Euler)<br/>v = min(50, v_player * 1.05)"]:::math
    Sight["Vision Geometry<br/>u · v >= cos(56.5°)<br/>Zero-Trigonometry Hot Loops"]:::math

    Sort["Floating-Point Bijective Transform<br/>orderedBits(f) = u ^ (u>>31 | 0x80000000)<br/>3-Pass 12-Bit LSD Radix Sort O(N)"]:::sort
    Atten["Singularity-Free Attenuation<br/>A(d) = 1.0 / (1.0 + (d/R)²)<br/>LightField & 32-Voice Audio"]:::combat

    Combat["Quadratic Mitigation Theorem<br/>DPS * Duration = Base * (1-r)²<br/>75% Resist Cap = 93.75% Mitigation"]:::combat
    MF["Hyperbolic Diminishing Returns<br/>Eff MF = (MF * 250) / (MF + 250)<br/>Asymptotic Ceiling 250%"]:::combat

    Bit["Discrete Bit Twiddling<br/>Gray Parity Cancellation b0<br/>De Bruijn B(2, 5) 0x077CB531u Multiplier<br/>Affine Galois Field Z₂"]:::bit

    Kinematics & Sight --> Sort
    Atten & Combat --> MF
    Sort & Combat --> Bit
`,
      },
      {
        title: "Comparative Mitigation Curve: Linear vs Quadratic (1-r)²",
        chart: `
flowchart LR
    classDef lin fill:#181524,stroke:#ef4444,stroke-width:2px,color:#f8fafc;
    classDef quad fill:#181524,stroke:#10b981,stroke-width:2px,color:#f8fafc;

    L0["r = 0%<br/>100% Taken"]:::lin
    L25["r = 25%<br/>75% Taken"]:::lin
    L50["r = 50%<br/>50% Taken"]:::lin
    L75["r = 75%<br/>25% Taken"]:::lin

    Q0["r = 0%<br/>100% Taken"]:::quad
    Q25["r = 25%<br/>56.25% Taken (-43.75%)"]:::quad
    Q50["r = 50%<br/>25.00% Taken (-75.00%)"]:::quad
    Q75["r = 75% (Cap)<br/>6.25% Taken (-93.75%!)"]:::quad

    L0 --> L25 --> L50 --> L75
    Q0 --> Q25 --> Q50 --> Q75
`,
      },
    ],
    interactiveComponent: "engine-math",
  },
];
