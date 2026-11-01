export interface MermaidDiagramDef {
  title: string;
  chart: string;
}

export interface WikiSection {
  id: string;
  title: string;
  category: 'core' | 'graphics' | 'simulation' | 'world' | 'gameplay';
  summary: string;
  sourceFiles: string[];
  content: string;
  mermaidChart?: MermaidDiagramDef;
  mermaidCharts?: MermaidDiagramDef[];
  interactiveComponent?: 'gameloop' | 'radix' | 'slab' | 'spatial' | 'ouroboros' | 'noise' | 'arsenal';
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
];
