export interface MermaidDiagramDef {
  title: string;
  chart: string;
}

export interface WikiSection {
  id: string;
  title: string;
  category: 'core' | 'graphics' | 'simulation' | 'world' | 'gameplay' | 'contribute';
  summary: string;
  sourceFiles: string[];
  content: string;
  mermaidChart?: MermaidDiagramDef;
  mermaidCharts?: MermaidDiagramDef[];
  interactiveComponent?: 'gameloop' | 'radix' | 'slab' | 'spatial' | 'ouroboros' | 'noise' | 'arsenal' | 'contribute' | 'pixelshader' | 'terrain' | 'renderer';
}

export const WIKI_SECTIONS: WikiSection[] = [
  {
    id: 'overview',
    title: '01. Engine Philosophy & 8-Slot Hardware Telemetry',
    category: 'core',
    summary: 'The C++20 "C with classes" architecture, zero-allocation hot loops, and SDL_GetPerformanceCounter telemetry.',
    sourceFiles: ['src/main.cpp', 'src/Game.cpp', 'src/Prof.c', 'src/SpriteObject.hpp'],
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
        title: 'Engine Subsystem Dependency Topology',
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
        title: 'End-to-End Frame Lifecycle & Telemetry Sequence',
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
    interactiveComponent: 'gameloop',
  },
  {
    id: 'radix-rendering',
    title: '02. 64-Bit Radix Y-Sort, Planar Reflections & LightField',
    category: 'graphics',
    summary: 'IEEE-754 monotonic float conversion, 3-pass 12-bit LSD radix sort, planar water reflections, and directional contact shadows.',
    sourceFiles: ['src/level/LevelRender.cpp', 'src/level/LightField.cpp', 'src/gfx/Screen.cpp'],
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
        title: '64-Bit Sort Key & 3-Pass 12-Bit Radix Sort Architecture',
        chart: `
flowchart LR
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
        title: 'Dynamic LightField Contact Shadow & Perlin Flicker Pipeline',
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
    interactiveComponent: 'radix',
  },
  {
    id: 'memory-slab',
    title: '03. Intrusive Slab Allocator (Pool.c) & Sized Deallocation',
    category: 'simulation',
    summary: 'Zero-header C++ sized operator delete, 32 size classes (16B grain), 64KB slab pages, and SRWLOCK synchronization.',
    sourceFiles: ['src/entity/Pool.c', 'src/entity/Pool.h', 'src/SpriteObject.hpp'],
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
        title: 'Sized Virtual Destructor to Slab Size-Class Routing',
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
        title: 'SpriteObject Polymorphic Class Hierarchy & Size Classes',
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
    interactiveComponent: 'slab',
  },
  {
    id: 'workers-concurrency',
    title: '04. Lock-Free Atomic Stride Worker Pool & 4-Barrier AI',
    category: 'simulation',
    summary: 'Epoch generation wakeups, atomic fetch_add chunk stealing, main-thread work participation, and race-free separation.',
    sourceFiles: ['src/Workers.hpp', 'src/Workers.cpp', 'src/level/Level.cpp', 'src/entity/enemy/Enemy.cpp'],
    content: `
### Zero-Allocation Fork-Join Concurrency (\`src/Workers.cpp\`)

Standard thread pools allocate heap task wrappers (\`std::function<void()>\`) and push them into mutex-contended queues. \`Workers.cpp\` avoids all dynamic allocation by combining an **epoch counter (\`generation\`)** with **lock-free atomic stride stealing (\`std::atomic<int> next\`)**:

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

#### Key Concurrency Design Decisions
1. **Small-Batch Fast Path (\`n <= 256\`):** If fewer than 256 enemies exist on the map, \`Workers::run\` executes \`j(c, 0, n)\` directly on the calling thread—zero mutex locks, zero condition-variable syscalls.
2. **Caller Thread Participation:** After calling \`wake.notify_all()\`, the main thread immediately invokes \`work()\` itself, competing alongside the \`N - 1\` background threads via \`next.fetch_add(chunk)\` so no physical core sits idle waiting.
3. **Why 4 Sequential Barriers in \`Level::tick()\`?**
   \`Level::tick()\` runs four separate \`workers.run(n, 256, ...)\` passes over \`thinkers\`:
   - **Pass 1 (\`Enemy::think\`):** Reads player & leader positions, updates \`GoalQueue\`, writes private \`xWant, yWant\`.
   - **Pass 2 (\`Enemy::move\`):** Advances \`x, y\` by velocity + knockback decay (\`exp(-9 * DT)\`) and resolves terrain collisions.
   - **Pass 3 (\`Enemy::push\`):** Queries the read-only CSR spatial grid (\`level->gather\`) to compute soft-body repulsion impulses into private \`xPush, yPush\` fields **without modifying \`x, y\`**.
   - **Pass 4 (\`Enemy::settle\`):** Adds \`xPush, yPush\` to \`x, y\` and re-runs \`level->collide(x, y, radius)\`.

   Splitting \`push()\` and \`settle()\` across a barrier guarantees **zero read-write data races** on \`Enemy::x, y\` and makes multi-threaded crowd physics deterministic! Furthermore, distant enemies (\`dist > 260px\`) skip \`push()\` on alternating frames using pointer-bit checkerboard parity: \`((uintptr_t(this) >> 5) + level->ticks) & 1\`.
`,
    mermaidCharts: [
      {
        title: 'Workers::run Atomic Fetch-Add Chunk Stealing Protocol',
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
        title: '4-Barrier Race-Free Crowd Separation Architecture',
        chart: `
flowchart LR
    classDef b1 fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef b2 fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef b3 fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef b4 fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    B1["Barrier 1: Enemy::think()<br/>Reads: Player, Leader<br/>Writes: xWant, yWant, goals"]:::b1
    B2["Barrier 2: Enemy::move()<br/>Reads: surfaces[], solids[]<br/>Writes: x, y, xa, ya"]:::b2
    B3["Barrier 3: Enemy::push()<br/>Reads: CSR Grid & neighbor x, y<br/>Writes: xPush, yPush ONLY"]:::b3
    B4["Barrier 4: Enemy::settle()<br/>Reads: xPush, yPush<br/>Writes: x += xPush, y += yPush"]:::b4

    B1 ==>|Sync| B2 ==>|Sync| B3 ==>|Sync| B4
`,
      },
    ],
  },
  {
    id: 'spatial-grid',
    title: '05. CSR Prefix-Sum Spatial Grid & Bit-Packed Terrain',
    category: 'simulation',
    summary: 'Zero-bucket-vector counting sort spatial hash (buildGrid/gather) and 5-bit surface/elevation/ramp byte packing.',
    sourceFiles: ['src/level/LevelSpace.cpp', 'src/level/LevelRender.cpp', 'src/level/Level.hpp'],
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
        title: 'CSR Prefix-Sum Grid Construction & Gather Pipeline',
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
        title: 'Collision & Elevation Resolution (LevelSpace.cpp)',
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
    interactiveComponent: 'spatial',
  },
  {
    id: 'goal-ai',
    title: '06. GoalQueue AI Ringbuffer, Static Plans & Ouroboros',
    category: 'simulation',
    summary: 'Zero-allocation constexpr Plan tables, 8-slot bitwise GoalQueue with interrupt preemption, and Ouroboros bit-twiddling.',
    sourceFiles: ['src/entity/enemy/ai/Goal.hpp', 'src/entity/enemy/ai/Plans.cpp', 'src/other/Ouroboros.hpp'],
    content: `
### Zero-Allocation Composable Enemy AI (\`Goal.hpp\` & \`Plans.cpp\`)

Even with thousands of active enemies, Mellangan allocates **zero bytes on the heap** for AI behavior trees. Every \`Goal\` (\`Approach\`, \`Flank\`, \`Stalk\`, \`Howl\`, \`Burrow\`, \`Raise\`, \`Melee\`, \`Ranged\`, \`Falter\`, \`Hide\`, \`Escape\`, \`Lurk\`) is instantiated once as an immutable \`const\` object in static storage inside \`src/entity/enemy/ai/Plans.cpp\`:

\`\`\`cpp
struct Plan {
  const Goal *steps[6];
  const Goal *interrupts[2];
};

class GoalQueue {
public:
  const Goal *front() const { return size ? items[head] : nullptr; }
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

#### How \`GoalQueue\` Executes & Preempts
1. **Bitwise Ring Indexing (\`& 7\`):** Because capacity is fixed at 8 pointers, index wrapping uses bitwise AND \`& 7\` instead of integer division modulo.
2. **Interrupt Preemption (\`pushFront\`):** On every tick, the enemy checks its plan's \`interrupts[2]\` (such as \`FALTER\` when staggered or \`HIDE\` when approached). If \`g->urgent(enemy, sense)\` returns true and is not already at \`front()\`, \`goals.pushFront(g)\` decrements \`head = (head + 7) & 7\` in $O(1)$ time, immediately suspending the current action and resuming it once the interrupt returns \`GoalState::Done\`!

### Arcane C++20 Bit-Twiddling: \`src/other/Ouroboros.hpp\`

\`Ouroboros.hpp\` is a self-verifying compile-time (\`consteval\`) and runtime bit-manipulation showcase where four CRTP serpents (\`Charlotte<Self>\`) independently determine integer parity without using \`% 2\`:
1. **\`Mirror\`:** Full 32-bit SWAR bit-reversal (\`0x55555555u\`, \`0x33333333u\`, \`0x0F0F0F0Fu\`, \`0x00FF00FFu\`), testing whether the reversed MSB \`!(flip(n) >> 31)\` is zero.
2. **\`Gray\`:** XOR-folds 32 bits down to a 4-bit nibble and indexes the 16-bit parity magic constant \`0x6996u >> (v & 15) & 1\`, comparing \`fold(n) ^ fold(n >> 1)\`.
3. **\`Bruijn\`:** Isolates the lowest set bit \`(v & (~v + 1))\` (with MSB sentinel \`0x80000000u\`) and hashes it through the de Bruijn multiplier \`0x077CB531u >> 27\` into a \`constexpr\` 32-byte spiral table.
4. **\`Rebecca\`:** Rotates right by 8 bits (\`std::rotr(n, 8) >> 24\`) to extract the low byte into a 256-entry \`constexpr\` LUT (\`AN_ARRAY_OF_FEELINGS\`).
5. **\`Augury\` XOR-Linked List:** Stores the four serpents in type-erased \`Rite\` nodes where \`uintptr_t link = prev ^ next\`, traversing forward using a single pointer field via \`next = r->link ^ reinterpret_cast<uintptr_t>(prev)\`!
`,
    mermaidCharts: [
      {
        title: 'Enemy GoalQueue State Machine & Interrupt Preemption',
        chart: `
stateDiagram-v2
    [*] --> RefillPlan : GoalQueue Empty
    RefillPlan --> ExecuteFront : Push Plan.steps[0..5]
    ExecuteFront --> CheckInterrupts : Every Tick (Sense Evaluated)
    CheckInterrupts --> PreemptHead : interrupt->urgent(e, sense) == true
    PreemptHead --> ExecuteFront : goals.pushFront(FALTER / HIDE)<br/>head = (head + 7) & 7
    CheckInterrupts --> TickActiveGoal : No Urgent Interrupt
    TickActiveGoal --> ExecuteFront : GoalState::Running (Write xWant, yWant)
    TickActiveGoal --> PopHead : GoalState::Done
    PopHead --> ExecuteFront : goals.pop() -> head = (head + 1) & 7
    PopHead --> [*] : Queue Exhausted
`,
      },
      {
        title: 'Ouroboros.hpp CRTP Serpents & XOR-Linked List Traversal',
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
    interactiveComponent: 'ouroboros',
  },
  {
    id: 'world-generation',
    title: '07. Voronoi Biome Lattice, Barycentric Blend & 4-Bit Cliffs',
    category: 'world',
    summary: 'Domain-warped Voronoi cells, 26-biome climate classification, 3-biome barycentric ground transitions, and 4-bit cliff masks.',
    sourceFiles: ['src/level/world/Biomes.cpp', 'src/level/world/Ground.cpp', 'src/level/LevelRender.cpp', 'src/level/Noise.c'],
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
        title: 'Procedural Biome & Barycentric Ground Blending Pipeline',
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
        title: 'World Structures, Settlements & Landmarks Hierarchy',
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
    interactiveComponent: 'noise',
  },
  {
    id: 'weather-sky',
    title: '08. Diurnal Cycle, Weather Fronts & Footprints (Sky.cpp)',
    category: 'world',
    summary: 'Continuous diurnal illumination, weather fronts (Rain, Snow, Storm, Sand), lightning arcs, and persistent snow/mud footprints.',
    sourceFiles: ['src/level/Sky.hpp', 'src/level/Sky.cpp', 'src/level/Night.hpp', 'src/level/sky/Fronts.hpp', 'src/level/sky/Footprints.hpp'],
    content: `
### Dynamic Atmosphere, Weather Fronts & Ground Persistence

\`src/level/Sky.cpp\` and its modular sub-systems in \`src/level/sky/\` (\`Fronts.cpp\`, \`Thunder.cpp\`, \`Footprints.cpp\`, \`SkyRender.cpp\`) drive an interconnected environmental simulation that directly impacts both rendering and combat physics:

#### 1. Weather Front Progression & Ground Accumulation
- **Snow Accumulation (\`sky.snowAt(x, y)\`):** When \`Front::Snow\` is active, \`sky.cover\` gradually rises. Ground tiles dynamically transition to frosted variants (\`BIOMES[BIOME_SNOW]->frost(ground)\`), and multi-part props (trees, bushes, ruins) swap their sprite sheets to snow-capped variants on the fly!
- **Rain Flood Pools (\`sky.poolAt(x, y)\`):** Sustained rainstorms form temporary water puddles across low-lying tiles, automatically acquiring 4-bit shoreline rims and enabling planar entity reflections (\`Level::reflect\`).
- **Wind Foliage Sway (\`sky.sway(x, y, time)\`):** Multi-segment props outside structures oscillate with phase-coherent wind waves scaled by storm intensity.

#### 2. Persistent Footprints & Thunder Strikes
- **\`Footprints.cpp\`:** Moving entities leave oriented footprint decals in snow, mud, sand, and shallow water that fade over time.
- **\`Thunder.cpp\`:** Storm fronts periodically charge localized lightning strikes, rendering jagged procedural \`Arc\` bolts, illuminating the entire offscreen lightmap with an HDR flash, and triggering delayed acoustic thunder rolls.

#### 3. Nocturnal Omens (\`Night.cpp\`)
At the start of 85% of runs (\`rng.chance(0.85f)\`), \`Level\` rolls a global **Omen** (\`OMENS[omen]\`) that alters nocturnal rules and awards a permanent score handicap multiplier—culminating in Blood Moon surges and the final Dawn survival threshold.
`,
    mermaidCharts: [
      {
        title: 'Atmospheric Fronts & Surface Mutation State Machine',
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
        title: 'Multi-Target Offscreen Lighting & Post-Process Pipeline',
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
    id: 'weapon-synthesis',
    title: '09. Combinatorial Weapon Synthesis (Recipe.cpp & FormBehavior)',
    category: 'gameplay',
    summary: 'Data-driven Recipe table, 10 polymorphic FormBehavior kinematic engines, and 11 composable pay::Payload bitflags.',
    sourceFiles: ['src/item/weapon/Recipe.cpp', 'src/item/weapon/Recipe.hpp', 'src/item/weapon/form/FormBehavior.hpp'],
    content: `
### Orthogonal Weapon Architecture: \`FormBehavior\` × \`pay::Payload\`

Instead of writing dozens of bespoke, repetitive weapon classes, \`src/item/weapon/Recipe.cpp\` implements a **combinatorial synthesis engine** where any weapon is defined by pairing a **kinematic trajectory (\`Form\`)** with a **bitmask of on-hit effects (\`pay::Payload\`)**:

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

#### Level Progression & Reforged Evolution Math
Every \`RecipeWeapon\` automatically generates its 5-level upgrade descriptions and scales according to whether its \`FormBehavior::of(r.form).area()\` is an **Area Form** (\`Field\`, \`Nova\`, \`Cleave\`, \`Trap\`, \`Beam\`) or a **Count Form** (\`Bolt\`, \`Volley\`, \`Orbit\`, \`Rain\`, \`Seeker\`, \`Boomerang\`, \`Lob\`):
- **Damage (\`Lv.2\` & \`Lv.5\`):** \`r.damage * (1 + 0.5f * (at(level, 2) + at(level, 5))) * p.might * power\`
- **Cooldown (\`Lv.4\`):** \`r.cooldown * (level >= 4 ? 0.75f : 1.0f) * p.haste * pace\`
- **Projectile Count (\`Lv.3\`, \`Lv.5\`, \`Evolved\`):** \`r.count + (area ? 0 : at(level, 3) + at(level, 5) + evolved)\`
- **Area Reach (\`Lv.3\`, \`Lv.5\`, \`Evolved\`):** \`r.reach * (area ? 1 + 0.3f * (at(level, 3) + at(level, 5)) + 0.25f * evolved : 1)\`
`,
    mermaidCharts: [
      {
        title: 'Combinatorial RecipeWeapon Dispatch & Payload Pipeline',
        chart: `
flowchart LR
    classDef rec fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef form fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef pay fill:#181524,stroke:#ec4899,stroke-width:2px,color:#e2e8f0;

    Recipe["Recipe Struct<br/>(damage, cooldown, reach, speed, count)"]:::rec
    Form["FormBehavior::of(r.form)<br/>Bolt | Volley | Orbit | Rain | Field<br/>Seeker | Nova | Cleave | Boomerang | Trap | Lob | Beam"]:::form
    Shot["RecipeShot Entity<br/>Tracks hits[] vector & hitsLeft"]:::form
    Payload["Bitmask Payload (r.payload)<br/>Burn | Chill | Poison | Mark | Stagger<br/>Pierce | Explode | Chain | Split | Pull | Leech"]:::pay

    Recipe --> Form --> Shot --> Payload
    Payload -.->|pay::Split (!child)| Shot
`,
      },
      {
        title: 'Base Signature Weapons & Relic Evolution Synergies',
        chart: `
flowchart TD
    classDef wpn fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef cat fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef evo fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    W1["Level 5 Base Weapon<br/>(Staff, Blade, Bow, Knives, Halo, Scythe...)"]:::wpn
    C1["Matching Passive Catalyst<br/>(Passive.cpp / Relic Synergy)"]:::cat
    Chest["Boss / Encounter Chest Drop<br/>(Chest.cpp)"]:::cat
    Reforge["Evolved Artifact (evolved = true)<br/>+35% Power Multiplier + Bonus Count / +25% Area"]:::evo

    W1 --> Chest
    C1 --> Chest
    Chest --> Reforge
`,
      },
    ],
    interactiveComponent: 'arsenal',
  },
  {
    id: 'classes-encounters',
    title: '10. 12 Hero Classes, Elite Traits & Multi-Phase Bosses',
    category: 'gameplay',
    summary: 'Hero class kits, TraitSet elite modifiers, multi-phase boss enrages, and regional world encounters.',
    sourceFiles: ['src/hero/Hero.hpp', 'src/entity/Trait.hpp', 'src/entity/enemy/Boss.cpp', 'src/level/Encounter.cpp'],
    content: `
### The 12 Playable Hero Classes (\`src/hero/\`)

Each hero class combines a starting signature weapon, an active cooldown \`Skill\`, class-specific \`Talent\` cards, and intrinsic stat modifiers:
- **Mage (\`Mage.cpp\`):** Arcane scholar with teleport \`Blink\` and +15% XP gem mastery.
- **Knight (\`Knight.cpp\`):** Armored vanguard with \`Shield Charge\` and timed block mitigation.
- **Ranger (\`Ranger.cpp\`):** Swift marksman with piercing \`Volley\` and 15% evasion.
- **Alchemist (\`Alchemist.cpp\`):** Volatile apothecary with \`Miasma\` zones and reagent drops.
- **Stormcaller (\`Stormcaller.cpp\`):** Conduit of tempests with sky-bound \`Chain Storm\`.
- **Reaper (\`Reaper.cpp\`):** Harvester of souls with life-draining \`Soul Siphon\`.
- **Priestess (\`Priestess.cpp\`):** Radiant healer with undead-repelling \`Sacred Light\`.
- **Duelist (\`Duelist.cpp\`):** Blade master with critical-strike \`Lunge\` and \`Riposte\`.
- **Warden (\`ExpansionHero.cpp\`):** Sylvan protector commanding \`Thornwhip\` and \`Root Snare\`.
- **Tinkerer (\`ExpansionHero.cpp\`):** Clockwork artificer deploying \`Clockwork Mine\` and \`Flash Grenade\`.
- **Oracle (\`ExpansionHero.cpp\`):** Astral seer wielding \`Prophecy Ray\` and \`Fate Wheel\`.
- **Corsair (\`ExpansionHero.cpp\`):** High-seas raider firing \`Chain Shot\` and \`Riptide\` vortices.

### Elite \`TraitSet\` & Multi-Phase Boss Enrages (\`Boss.cpp\`)

- **Elite Affixes (\`Trait.cpp\`):** Elites spawn with bit-packed \`TraitSet\` modifiers (\`Hasted\`, \`Vampiric\`, \`Warded\`, \`Splitting\`, \`Volatile\`, \`Frosted\`), scaling HP, speed, and on-hit/on-death triggers (\`traits.landed(*this, dmg)\`).
- **3-Phase Boss Enrage Thresholds:** In \`Enemy::tick()\`, bosses check \`if (def && phase < 2 && hp < maxHp * float(2 - phase) / 3) enrage();\`. At **66% HP** (Phase 1) and **33% HP** (Phase 2), the boss triggers \`enrage()\`, accelerating attack cadence, radial 10-orb bullet patterns, and shockwave telegraphs!
`,
    mermaidCharts: [
      {
        title: 'Boss Phase Enrage & Telegraph Execution Loop',
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
        title: 'Enemy Damage, Status Affliction & Elite Trait Pipeline',
        chart: `
flowchart LR
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
    id: 'audio-qa',
    title: '11. 32-Voice LRU Audio Mixer & Automated Visual QA',
    category: 'core',
    summary: 'SDL3 AudioStream voice stealing, hardware frequency-ratio pitch jitter, exponential weather beds, and headless QA views.',
    sourceFiles: ['src/audio/Sound.cpp', 'src/Bench.cpp', 'src/test/Test.cpp', 'src/test/view/Screenshots.cpp'],
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

3. **Exponentially Smoothed Weather Beds (\`beds[]\`):**
   Continuous ambient loops (\`rain.wav\`, \`wind.wav\`) smoothly interpolate their gain every tick via \`b.gain += (b.want - b.gain) * 0.02f;\` and automatically flush their queued PCM buffer when \`b.gain < 0.002f && b.want == 0\`.

### Automated Test Suites, Benchmarks & Visual QA (\`src/test/\`)

Mellangan includes a built-in verification and visual regression harness:
- **Deterministic Unit & Simulation Suites (\`Test.cpp\`):** Exercises \`CoreTest\`, \`WorldTest\`, \`CombatTest\`, \`ClassTest\`, \`ArsenalTest\`, \`BiomeTransitionTest\`, \`BiomeEncounterTest\`, and \`RunTest\`.
- **Headless GPU Screenshot & QA Views (\`Screenshots.cpp\`, \`QaViews.cpp\`, \`BiomeMap.cpp\`):** Programmatically stages combat encounters, boss fights, UI menus, and biome transitions, capturing uncompressed frames directly from Vulkan textures via \`vk2dTextureCopyPixels\`.
`,
    mermaidCharts: [
      {
        title: 'SDL3 32-Voice LRU Selection & Weather Bed Mixer',
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
        title: 'Automated Test Harness, Benchmark & GPU Screenshot Pipeline',
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
    id: 'contribute-basics',
    title: '12. Contribution Basics: Toolchain, Build, House Rules & --dev',
    category: 'contribute',
    summary: 'Step-by-step onboarding from cloning submodules and building with CMake/slangc to house rules and --dev hotkeys.',
    sourceFiles: ['CMakeLists.txt', 'NOTES.md', 'README.md', 'src/main.cpp', 'src/DevStart.cpp'],
    content: `
### Welcome Contributor! Start with the Basics

Contributing to **Mellangan** is straightforward once you understand its build pipeline, strict house rules, and built-in developer sandbox. This tutorial walks you through the fundamentals step by step before diving into adding weapons, enemies, and biomes.

#### Step 1: Prerequisites & Submodule Clone
Mellangan requires:
- **CMake 3.21+** and a **C++20 / C11** compiler (MSVC 2022 on Windows, Clang on macOS, GCC/Clang on Linux).
- **LunarG Vulkan SDK:** Provides the Vulkan headers/loader and **\`slangc\`**, which compiles \`res/shaders/*.slang\` into SPIR-V (\`.spv\`) at build time. On Windows, \`CMakeLists.txt\` automatically detects \`C:/VulkanSDK/*\` even if \`VULKAN_SDK\` is not set in your environment.
- **Python 3 + Pillow 13.0.0:** Used only when regenerating or verifying the deterministic sprite atlas (\`tools/make_assets.py\`).

\`\`\`cpp
git clone --recurse-submodules https://github.com/soulwax/Mellangan.git
cd Mellangan
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug --parallel
\`\`\`

#### Step 2: The Golden House Rules (\`NOTES.md\`)
Every pull request or task packet must obey five non-negotiable conventions:
1. **No Code Comments:** Never write \`//\` or \`/* */\` comments inside \`.cpp\`, \`.hpp\`, \`.c\`, or \`.h\` files. Code should be self-explanatory with concise identifiers; architectural rationale belongs in \`NOTES.md\`, \`README.md\`, or \`CHANGELOG.md\`.
2. **Pragmatic "C with Classes":** Use plain structs, fixed arrays, and direct loops where they fit; use classes for clear ownership and virtual extension points (\`SpriteObject\`, \`Entity\`, \`Mob\`, \`Upgrade\`, \`Goal\`, \`Biome\`).
3. **Submodule Boundaries:** Only \`extern/Vulkan2D\` and \`extern/wiki\` may be modified when needed. Treat \`extern/entt\`, \`extern/spdlog\`, and \`extern/stb\` as strictly read-only.
4. **Append-Only Enums (Save Compatibility):** \`EnemyKind\`, \`BiomeId\`, and \`HeroId\` indices are serialized in player saves, charts, and Codex progress. Always append new enum values at the end—never reorder or insert in the middle.
5. **No Unverified Commits:** Always run \`--test\` in a Debug build (so \`assert()\` checks are compiled in) and inspect visual changes at 1x native scale before considering a task complete.

#### Step 3: Fast Iteration with \`--dev\` and Startup Flags
Never play for 10 minutes manually just to reach a test case! \`src/main.cpp\` and \`src/DevStart.cpp\` provide instant teleports and loadouts:
- **Hotkeys in \`--dev\` mode:**
  - \`F5\`: Instant Level-Up menu.
  - \`F6\`: Skip +30 seconds on the night clock.
  - \`F7\`: Toggle God Mode (invulnerability).
  - \`F8\`: Toggle World Debug HUD (tile coordinates, biome blend weights, \`Prof.c\` timings).
  - \`F9\`: Warp to the nearest generated structure or shrine.
  - \`F10\`: Cycle to the next weather front (\`Rain\`, \`Snow\`, \`Storm\`, \`Sand\`).
- **Command-Line Warp Flags:**
  - \`--arm "Ember Lance!,Bastion Shields"\`: Starts the run pre-equipped with those upgrades (append \`!\` to start at Level 5 Evolved).
  - \`--biome 12\`: Spawns directly inside Biome ID 12 (\`CrystalFields\`).
  - \`--at -220,-192\`: Spawns at exact tile coordinates \`(-220, -192)\`.
  - \`--cliff\`, \`--ramp\`, \`--peak\`, \`--lake\`, \`--landmark N\`: Teleports directly to the nearest matching terrain feature.
`,
    mermaidCharts: [
      {
        title: 'CMake Build, Slang Shader Compilation & Asset Bundling Pipeline',
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
        title: 'Contributor Development & Verification Loop',
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
    interactiveComponent: 'contribute',
  },
  {
    id: 'tutorial-weapon',
    title: '13. Tutorial 1: Adding a New Weapon, Recipe & Evolution',
    category: 'contribute',
    summary: 'Hands-on beginner tutorial: create a 16x16 icon, add a combinatorial Recipe or custom Upgrade, and test it in --dev.',
    sourceFiles: ['src/item/weapon/Recipe.cpp', 'src/item/Upgrade.cpp', 'src/Atlas.hpp', 'src/test/ArsenalTest.cpp'],
    content: `
### Hands-On Tutorial 1: Creating a New Weapon Step by Step

There are two ways to add a weapon in Mellangan:
1. **The Data-Driven Recipe Path (\`src/item/weapon/Recipe.cpp\`):** Ideal when your weapon combines one of the 12 existing \`Form\` trajectories (\`Bolt\`, \`Volley\`, \`Orbit\`, \`Rain\`, \`Field\`, \`Seeker\`, \`Nova\`, \`Cleave\`, \`Boomerang\`, \`Trap\`, \`Lob\`, \`Beam\`) with any combination of \`pay::Payload\` bitflags (\`Burn\`, \`Chill\`, \`Poison\`, \`Mark\`, \`Stagger\`, \`Pierce\`, \`Explode\`, \`Chain\`, \`Split\`, \`Pull\`, \`Leech\`).
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
        title: 'Step-by-Step Weapon & Evolution Registration Flow',
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
        title: 'Projectile Lifecycle & Slab Memory Reclamation',
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
    id: 'tutorial-enemy-biome',
    title: '14. Tutorial 2: Adding a Monster, AI Plan & Biome Niche',
    category: 'contribute',
    summary: 'Advanced tutorial: append save-safe EnemyKind enums, compose zero-allocation GoalQueue plans, and register a new Biome.',
    sourceFiles: ['src/entity/enemy/Enemy.hpp', 'src/entity/enemy/Roster.cpp', 'src/entity/enemy/ai/Plans.cpp', 'src/level/biome/Biome.cpp'],
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
        title: 'Thread-Safe Monster AI Intent vs Main-Thread Action Contract',
        chart: `
flowchart LR
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
        title: 'Deterministic Asset Pipeline & Save-Safe Registration Checklist',
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
    id: 'tutorial-hero-class',
    title: '15. Tutorial 3: Adding a Playable Hero, Active Skill, Talent & Relic',
    category: 'contribute',
    summary: 'Step-by-step guide to defining HeroData, Mob-symmetric active skills, class talents, boss relics, and Codex unlock predicates.',
    sourceFiles: ['src/hero/Hero.hpp', 'src/hero/Hero.cpp', 'src/hero/ExpansionHero.cpp', 'src/item/skill/Skill.hpp', 'src/item/talent/ExpansionTalents.cpp', 'src/item/relic/ExpansionRelics.cpp'],
    content: `
### Hands-On Tutorial 3: Creating a Playable Hero & Class Kit

Playable classes in Mellangan are governed by \`class Hero : public HeroData\` (\`src/hero/Hero.hpp\`). A complete class package consists of:
1. **The \`Hero\` definition (\`src/hero/\`):** Base stat modifiers, unlock predicate \`bool (*met)(const Codex &)\`, passive class hook (\`equip\`, \`tick\`, \`guard\`, \`slay\`, \`wisdom\`, \`edge\`), signature weapon, and 3 favoured upgrade affinities (\`affinity[3]\`).
2. **The Active \`HeroSkill\` (\`cast(Mob &)\`):** Automatically wrapped into a \`Spacebar\` active skill by \`HeroSkill(const Hero &hero)\` (\`src/item/skill/Skill.hpp\`).
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

For example, in \`src/hero/ExpansionHero.cpp\`, unlock predicates inspect \`const Codex &c\` (such as \`c.count(c.biomes) >= 3\`, \`c.kills() >= 200\`, \`c.shrines >= 2\`, or \`c.bestStreak >= 30\`):

\`\`\`cpp
bool chronomancer(const Codex &c) { return c.nightsSurvived >= 1; }

const HeroData CHRONO_DATA = {
    "CHRONOMANCER", "Hourglass Shard", "Weaver of fractured seconds",
    "Cooldowns tick 15% faster below half health", "survive until dawn", chronomancer, 84,
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
        title: 'Hero Class, Active Skill & Renegade Mirror-Symmetry Architecture',
        chart: `
flowchart LR
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
        title: 'Codex Unlock Predicate, Class Affinity & Relic Synergy Flow',
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
    id: 'tutorial-structures-boss',
    title: '16. Tutorial 4: Adding World Landmarks, Interactive Sites & 3-Phase Bosses',
    category: 'contribute',
    summary: 'Step-by-step guide to procedural StructureDef footprints, interactive encounter::Site triggers, and 3-phase BossDef cast tables.',
    sourceFiles: ['src/level/Structure.hpp', 'src/level/structure/Landmarks.cpp', 'src/level/encounter/Landmarks.cpp', 'src/entity/enemy/Boss.hpp', 'src/entity/enemy/Boss.cpp'],
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
        title: 'Deterministic Region Structure & Landmark Encounter Pipeline',
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
        title: '3-Phase Boss Cast Rotation, Telegraph & Chest Drop State Machine',
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
    id: 'tutorial-pixel-shader',
    title: '17. Tutorial 5: Procedural 16x16 Pixel-Art (sprite_kit.py) & Slang Shaders',
    category: 'contribute',
    summary: 'Step-by-step guide to painting procedural 16x16 sprites in Python, validating 1px atlas gutters, and authoring Vulkan Slang shaders.',
    sourceFiles: ['tools/sprite_kit.py', 'tools/atlas_layout.py', 'tools/make_assets.py', 'res/shaders/flash.slang', 'res/shaders/post.slang', 'src/gfx/Screen.cpp'],
    content: `
### Hands-On Tutorial 5: Procedural Pixel-Art & Slang Shaders

Mellangan never commits hand-edited binary blobs without a reproducible generator. Both its \`res/atlas.png\` sprite sheet and its SPIR-V GPU shaders (\`*.spv\`) are built deterministically from code.

---

#### Part 1: Authoring 16×16 Sprites with \`tools/sprite_kit.py\`

\`tools/sprite_kit.py\` implements a tiny procedural pixel painter (\`class Canvas\`) designed to match the crisp **Kenney Tiny Town** aesthetic:
- **Flat 3-Tone Top-Left Lighting:** Shapes receive a 3-color tuple \`pal = (dark_shadow, mid_base, light_highlight)\` lit from \`LIGHT = (-0.6, -0.8)\`.
- **Automatic 1px Dark Outline:** Calling \`c.image(outline=True)\` walks every opaque pixel's 4-connected neighbors \`((1,0), (-1,0), (0,1), (0,-1))\` and stamps \`OUTLINE = (63, 38, 49, 255)\` around the silhouette.
- **Primitive Methods on \`Canvas(16, 16)\`:**
  - \`c.cluster(x, y, rows, color)\`: Paints ASCII pattern strings where any character other than \`'.'\` places a pixel.
  - \`c.ellipse(cx, cy, rx, ry, pal, dither=0.0, seed=0)\`: Renders a 3-tone shaded ellipse with optional deterministic hash dithering.
  - \`c.rect(x0, y0, x1, y1, pal)\` and \`c.tri(cx, top, bottom, half, pal)\`: Shaded geometric primitives.
  - \`c.material(points, dark, light, seed, density=0.2)\`: Applies deterministic coordinate-hash micro-texture.

##### Step-by-Step Atlas Workflow:
1. Check \`BANDS\` and \`EXPANSION_ACTORS\` / \`EXPANSION_PROPS\` / \`ARSENAL\` in \`tools/atlas_layout.py\` for an available cell index.
2. Add your \`Canvas(16, 16)\` function in \`tools/make_expansion.py\` or \`tools/make_arsenal.py\` and call \`place_cell(atlas, band, index, sprite)\`.
3. Run the dual-pass verifier:
\`\`\`cpp
python tools/make_assets.py --verify
\`\`\`
\`--verify\` runs the entire asset generator **twice** and asserts that every cell's 1px gutter is \`RGBA(0,0,0,0)\`, no bands overlap, and both runs produce **byte-identical RGBA and PNG SHA-256 hashes**!

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
        title: 'sprite_kit.py Procedural Canvas -> atlas_layout.py Gutter Verifier Pipeline',
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
        title: 'Vulkan2D Bindless Slang Shader & Light-Map Post-Processing Pipeline',
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
    interactiveComponent: 'pixelshader',
  },
  {
    id: 'tutorial-testing-profiling',
    title: '18. Tutorial 6: Writing Deterministic Tests, Visual QA Views & Prof.c Benchmarks',
    category: 'contribute',
    summary: 'Step-by-step guide to authoring assert-driven unit suites, headless GPU screenshot QA views, and 8-slot Prof.c benchmarks.',
    sourceFiles: ['src/test/Tests.hpp', 'src/test/Test.cpp', 'src/test/view/QaViews.cpp', 'src/Prof.h', 'src/Prof.c', 'src/Bench.cpp'],
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
        title: 'Headless Deterministic Simulation & Assertions Pipeline (--test)',
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
        title: 'Prof.c 8-Slot Frame Budget & Visual QA Readback Architecture',
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
    id: 'terrain-construction',
    title: '19. Tutorial 7: How Our Terrain Is Constructed (Morphology, Cliffs & Auto-Tiling)',
    category: 'contribute',
    summary: 'Complete 7-layer synthesis of TileMemo bit-packing, 5x5 tent biome blending, solidCore/smoothPatch morphology, 4-tier plateaus, and RIM[16] auto-tiling.',
    sourceFiles: ['src/level/World.hpp', 'src/level/world/Internal.hpp', 'src/level/world/Biomes.cpp', 'src/level/world/Terrain.cpp', 'src/level/world/Ground.cpp', 'src/level/world/Sites.cpp', 'src/level/world/Props.cpp', 'src/level/FloorPainter.cpp'],
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
        title: 'Complete 7-Stage Procedural Terrain Construction Pipeline',
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
        title: 'Morphological Patch Smoothing (solidCore -> smoothPatch) & 4-Bit RIM[16] Auto-Tiler',
        chart: `
flowchart LR
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
    interactiveComponent: 'terrain',
  },
  {
    id: 'renderer-in-context',
    title: '20. Tutorial 8: How the Renderer Works in Context of Our Game',
    category: 'contribute',
    summary: 'End-to-end walkthrough of Screen.cpp, LevelRender.cpp, LightField.cpp, offscreen targets, water reflections, submersion clipping, and native GUI scaling.',
    sourceFiles: ['src/Game.cpp', 'src/gfx/Screen.hpp', 'src/gfx/Screen.cpp', 'src/level/LevelRender.cpp', 'src/level/LightField.cpp', 'res/shaders/post.slang'],
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
        title: 'Complete Multi-Pass Frame Graph (Game::render -> Screen -> LevelRender)',
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
        title: 'Planar Water Reflection, Submersion Clipping & White Silhouette Flash Pipeline',
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
    interactiveComponent: 'renderer',
  },
];
