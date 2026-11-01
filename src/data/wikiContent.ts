export interface WikiSection {
  id: string;
  title: string;
  category: 'core' | 'graphics' | 'simulation' | 'world' | 'gameplay';
  summary: string;
  content: string;
  mermaidChart?: {
    title: string;
    chart: string;
  };
  interactiveComponent?: 'gameloop' | 'slab' | 'noise';
}

export const WIKI_SECTIONS: WikiSection[] = [
  {
    id: 'overview',
    title: 'Game Overview & Engine Philosophy',
    category: 'core',
    summary: 'The core gameplay loop, C++20 "C with classes" paradigm, and zero-overhead systems architecture.',
    content: `
### What is Mellangan?

**Mellangan** is a high-performance top-down action survival game ("v-survivors" genre) engineered in modern **C++20**. Unlike typical survivors games that lock the player in flat arenas, Mellangan immerses the hero in an expansive, seamlessly transitioning multi-biome world. The objective is to traverse uncharted lands, seek out ancient monolith shrines scattered across continents, and kindle them while outlasting escalating nocturnal hordes and skilled bosses.

### Architectural Philosophy: "C with Classes"

The engine deliberately adheres to the pragmatic **"C with classes"** design paradigm popularized by early game engines (e.g., Notch's *Minecraft*, Carmack's *Doom/Quake* engines). Key tenets include:

1. **Memory Locality Over Dynamic Abstraction:**
   Objects are organized as flat, cache-friendly data structures. Deep inheritance hierarchies, heavy virtual function dispatch tables, and pervasive smart-pointer wrapping are avoided on performance-critical paths.

2. **Zero Runtime Heap Thrashing:**
   The game executes without standard \`malloc\`/\`free\` during the active simulation frame. Entities, particles, and collision objects are provisioned from pre-allocated fixed-size memory slabs managed by a custom slab allocator (\`entity/Pool.c\`).

3. **Deterministic & Cache-Coherent World Simulation:**
   World coordinates, noise sampling, and entity queries are designed to execute identically across seeds, decoupling fixed simulation ticks (\`DT = 0.016s\`, 60 Hz) from the variable presentation refresh rate.

4. **Multi-Threaded Work Isolation:**
   Expensive AI pathfinding and steering calculations are delegated to a dedicated worker thread pool (\`Workers.hpp\`), allowing the main thread to focus purely on input, collision response, and Vulkan command dispatch.
`,
    mermaidChart: {
      title: 'High-Level Engine Subsystem Hierarchy',
      chart: `
flowchart TD
    classDef os fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef core fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef sim fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef gfx fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef data fill:#181524,stroke:#ec4899,stroke-width:2px,color:#e2e8f0;

    subgraph OS_Layer ["Operating System & Platform"]
        SDL["SDL3 Subsystems<br/>(Video, Audio Streams, Events)"]:::os
        VK["Vulkan 1.3 / 1.4 Driver<br/>(Device Queues & Swapchain)"]:::os
    end

    subgraph Core_Engine ["Engine Infrastructure"]
        Game["Game Loop & State Control<br/>(Game.cpp)"]:::core
        Workers["Worker Thread Pool<br/>(Workers.hpp - Multi-Core)"]:::core
        Pool["Slab Memory Allocator<br/>(Pool.c - 64B Slots)"]:::core
        Registry["EnTT ECS Registry<br/>(Entity Component Views)"]:::core
    end

    subgraph World_Simulation ["World & Gameplay Simulation"]
        WorldGen["Procedural World Lattice<br/>(Voronoi Cells & FBM Noise)"]:::sim
        Sky["Atmosphere & Weather Simulation<br/>(Sky.cpp - Lighting & Wind)"]:::sim
        Level["Level Simulation & Spawner<br/>(Level.cpp & Spawner.cpp)"]:::sim
        GOAP_AI["Enemy AI Goal Planning<br/>(Plans.cpp & Steering)"]:::sim
    end

    subgraph Graphics_Pipeline ["Vulkan2D Renderer"]
        VK2D["Vulkan2D Context<br/>(Texture.c & Device.c)"]:::gfx
        Atlas["Batched Sprite Atlas<br/>(res/atlas.png)"]:::gfx
        Shaders["SPIR-V Shaders<br/>(post.spv, flash.spv, water)"]:::gfx
        Screen["Screen Projection & GUI<br/>(Screen.cpp)"]:::gfx
    end

    SDL --> Game
    VK --> VK2D
    Game --> Workers
    Game --> Level
    Level --> Pool
    Level --> Registry
    Level --> WorldGen
    Level --> Sky
    Workers --> GOAP_AI
    Level --> Screen
    Screen --> VK2D
    VK2D --> Shaders
    VK2D --> Atlas
`,
    },
    interactiveComponent: 'gameloop',
  },
  {
    id: 'game-loop',
    title: 'Frame Pipeline & Fixed Timestep Lifecycle',
    category: 'core',
    summary: 'The deterministic 60 Hz simulation loop, worker thread dispatch, and command buffer submission.',
    content: `
### The 60 Hz Fixed Timestep Architecture

Modern displays run at variable refresh rates (60 Hz, 144 Hz, 240 Hz, VRR/G-Sync). To guarantee that projectile physics, collision detection, and damage calculations remain completely deterministic and glitch-free, Mellangan decouples simulation from presentation:

\`\`\`cpp
// Fixed timestep accumulation
constexpr float DT = 1.0f / 60.0f; // 16.666 ms
timeAccumulator += frameDeltaTime;
while (timeAccumulator >= DT) {
  game.tick();          // Entity positions, AI goals, spawns
  timeAccumulator -= DT;
}
game.render();          // Interpolated sprite & light pass
vk2dRendererPresent();  // Vulkan swapchain presentation
\`\`\`

### Frame Execution Sequence

Each frame traverses five strictly staged phases:
1. **Event Ingestion:** SDL3 pumps system inputs (keyboard, mouse vectors, gamepad buttons, window resizing).
2. **Simulation Phase (\`Game::tick\`):** Player velocity integration, status effect decay, world event evaluation, and horde wave timers.
3. **Asynchronous Worker Jobs:** Worker threads pull batches of enemy AI goals, evaluating distance heuristics and steering vectors in parallel.
4. **Collision & Slab Resolution:** Grid-based spatial partitioning evaluates projectile-mob overlaps and gem pickup radii using contiguous memory structures.
5. **Render Pass & Presentation:** Terrain tiles, shadow hulls, dynamic light sources, character sprites, and post-processing shaders are queued into Vulkan command buffers.
`,
    mermaidChart: {
      title: 'Frame Lifecycle Sequence Diagram',
      chart: `
sequenceDiagram
    autonumber
    actor User as Player Input
    participant Main as Main Thread (Game.cpp)
    participant Workers as Worker Pool (Workers.hpp)
    participant Level as Simulation (Level.cpp)
    participant VK2D as Vulkan2D Engine
    participant GPU as Vulkan GPU Device

    User->>Main: Keyboard / Mouse Events (SDL3)
    Main->>Main: Accumulate Delta Time (DT = 1/60s)
    loop While accumulator >= DT
        Main->>Level: level->tick()
        Level->>Workers: Dispatch AI Goal Jobs
        activate Workers
        Level->>Level: Update Player & Spawners
        Workers-->>Level: Return Steering Vectors & Actions
        deactivate Workers
        Level->>Level: Resolve Collisions & Sided Damage
        Level->>Level: Advance Sky, Weather & Omens
    end
    Main->>VK2D: Begin Frame & Set Offscreen Target
    Main->>VK2D: Draw Ground & Terrain Mesh
    Main->>VK2D: Render Dynamic Light Quads
    Main->>VK2D: Batch Draw Entities & Particles
    Main->>VK2D: Apply Post-Process Shaders (flash/post.spv)
    Main->>VK2D: Draw HUD & GUI Choice Cards
    Main->>GPU: vk2dRendererPresent() (Command Submit)
    GPU-->>User: Display Frame on Swapchain
`,
    },
    interactiveComponent: 'gameloop',
  },
  {
    id: 'vulkan2d-graphics',
    title: 'Vulkan2D Graphics & Shader Pipeline',
    category: 'graphics',
    summary: 'Custom Vulkan 1.3 render pass, Slang/SPIR-V compilation, light rendering, water reflections, and GPU staging.',
    content: `
### Vulkan2D Renderer Architecture

Mellangan utilizes a tailored 2D graphics engine located in \`extern/Vulkan2D\`. Built on top of pure Vulkan without bulky third-party abstraction layers, it provides instantaneous batching of textured quads, custom render targets, and custom SPIR-V compute/fragment shaders.

#### Shader Pipeline & Compilation
Shaders are authored in **Slang** / modern GLSL and compiled into binary **SPIR-V** (\`.spv\`) at build time:
- \`flash.spv\`: Performs high-speed entity whiteout flashes upon taking damage without rebinding textures or allocating separate draw calls.
- \`post.spv\`: Full-screen post-processing shader applying vignette shading, nocturnal color grading, and ambient darkness masking based on the player's dynamic torch radius.
- **Water & Shore Shaders:** Computes real-time water wave displacement, ripple reflections of nearby foes, and shore foam blending.

#### Native GPU Readback & Screenshot API
Mellangan implements a custom GPU staging buffer readback pipeline (\`vk2dTextureCopyPixels\` in \`Texture.c\`). Render targets with \`VK_IMAGE_USAGE_TRANSFER_SRC_BIT\` allow zero-overhead, uncompressed 1440x810 pixel readbacks to host memory for high-fidelity screenshot generation:

\`\`\`c
// Memory barrier transition to TRANSFER_SRC
VkImageMemoryBarrier barrier = {
  .sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER,
  .oldLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL,
  .newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
  .image = tex->img,
  // ...
};
vkCmdPipelineBarrier(cmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,
                     VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, NULL, 0, NULL, 1, &barrier);
vkCmdCopyImageToBuffer(cmd, tex->img, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL, stagingBuffer, 1, &region);
\`\`\`
`,
    mermaidChart: {
      title: 'Vulkan GPU Command & Memory Pipeline',
      chart: `
flowchart LR
    classDef cpu fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef mem fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef gpu fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    subgraph Host_Memory ["Host CPU Memory"]
        Verts["Instanced Vertex Buffer<br/>(Quad UVs, Positions, Tints)"]:::cpu
        Lights["Dynamic Light Map<br/>(Light Radii, Colors, Falloffs)"]:::cpu
        Staging["Host-Visible Staging Buffer<br/>(Mapped Readback Buffer)"]:::mem
    end

    subgraph Vulkan_Pipeline ["Vulkan GPU Execution"]
        CmdBuf["Single-Use / Frame Command Buffer"]:::gpu
        Pass1["Render Pass 1:<br/>Terrain & Ground Blend"]:::gpu
        Pass2["Render Pass 2:<br/>Dynamic Light Acc"]:::gpu
        Pass3["Render Pass 3:<br/>Sprites & Particles"]:::gpu
        PostPass["Fragment Shader Pass:<br/>post.spv & flash.spv"]:::gpu
    end

    subgraph Display_Output ["Presentation & Readback"]
        Swapchain["Vulkan Swapchain Image<br/>(Screen Presentation)"]:::out
        PNG["PNG Image Write<br/>(stbi_write_png)"]:::out
    end

    Verts --> CmdBuf
    Lights --> CmdBuf
    CmdBuf --> Pass1 --> Pass2 --> Pass3 --> PostPass
    PostPass --> Swapchain
    PostPass -.->|vkCmdCopyImageToBuffer| Staging
    Staging -.-> PNG
`,
    },
  },
  {
    id: 'memory-slab',
    title: 'Memory Management & EnTT Entity Architecture',
    category: 'simulation',
    summary: 'The Pool.c slab allocator, 64-byte entity slots, EnTT registry integration, and cache-conscious allocation.',
    content: `
### The 64-Byte Slab Allocator (\`Pool.c\`)

Dynamic memory allocation in game loops introduces two catastrophic flaws: variable latency spikes (stop-the-world allocator locks) and heap fragmentation. Mellangan eliminates both through a custom slab allocator (\`src/entity/Pool.c\` and \`src/entity/Pool.h\`):

- **Uniform Slot Size:** Every dynamically active entity (enemies, arrows, explosive bombs, orbiting blades, gems) fits inside a pre-sized 64-byte slot.
- **Intrusive Free List:** Unused slots store a pointer to the next free slot directly inside their unused memory space. Allocation is simply popping the head pointer in \`O(1)\`; deallocation is pushing onto the free list in \`O(1)\`.
- **Zero Cache Miss Spillage:** Slabs are allocated in contiguous 64KB blocks, keeping related mobs residing adjacent in CPU L1/L2 caches.

### EnTT Entity Component System Integration

For entity tagging, spatial tracking, and lifecycle management, Mellangan links the header-only **EnTT** framework:
- Sparse sets provide cache-coherent iteration over active mobs.
- Tags such as \`Owned\`, \`Boss\`, and \`Elites\` allow instantaneous grouping without traversing the entire entity roster.
`,
    mermaidChart: {
      title: 'Slab Allocator Memory Block Architecture',
      chart: `
classDiagram
    class PoolSlab {
        +uint8_t memory[64KB]
        +Slot slots[1024]
        +int free_head
        +alloc() Slot*
        +free(Slot* ptr) void
    }
    class Slot {
        +uint8_t data[64]
        +Slot* next_free
    }
    class Entity {
        +double x, y
        +double xa, ya
        +float hp, maxHp
        +uint32_t flags
        +virtual tick() void
        +virtual render() void
    }
    class Enemy {
        +EnemyKind kind
        +GoalQueue goals
        +Traits traits
    }
    class Projectile {
        +double speed
        +float damage
        +bool hostile
    }

    PoolSlab "1" *-- "many" Slot : contains
    Slot <|-- Entity : casts into
    Entity <|-- Enemy : specializes
    Entity <|-- Projectile : specializes
`,
    },
    interactiveComponent: 'slab',
  },
  {
    id: 'multithreaded-ai',
    title: 'Multithreaded Worker Pool & AI Goal Planning',
    category: 'simulation',
    summary: 'Workers.hpp thread pool, lockless work queues, and Goal-Oriented Action Planning (GOAP) steering.',
    content: `
### Multi-Threaded Task Dispatch (\`Workers.hpp\`)

When hordes scale to hundreds of concurrent creatures, running AI navigation and hazard aversion on a single CPU core causes severe frame drops. Mellangan features a dedicated, low-latency thread pool:

1. **Hardware Core Utilization:**
   At startup, \`Workers::init(std::thread::hardware_concurrency() - 1)\` creates background worker threads pinned to physical cores.
2. **Batch Job Slicing:**
   The active enemy roster is partitioned into contiguous slices (e.g., 64 mobs per batch) and dispatched to worker queues.
3. **Thread-Safe AI Evaluation:**
   Worker threads sample read-only world state (player location, nearest obstacles, noise terrain). AI decisions (steering direction, target velocity) are written into local buffers and applied atomically to the main simulation during the synchronization barrier.

### Goal-Oriented Action Planning (GOAP)

Enemies in Mellangan do not follow brittle scripted switch statements. Instead, each enemy kind maintains a priority-ordered \`GoalQueue\`:
- \`LookOut\`: Passive awareness scanning.
- \`Approach\`: Distance-closing steering towards the player.
- \`Stalk\`: Maintaining perimeter spacing while flanking.
- \`Melee\` / \`Ranged\`: Execution of attacks with windup telegraphs.
- \`Lurk\`: Specialized behavior for Mimics—camouflaged until approached.
- \`HazardAvoidance\`: Steers around cliff drops and toxic bog pools.
`,
    mermaidChart: {
      title: 'Worker Thread Dispatch & Goal Planning Flow',
      chart: `
flowchart TD
    classDef main fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef worker fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef ai fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;

    Main["Main Simulation Thread<br/>(Level::tick)"]:::main
    Queue["Job Queue (Workers.hpp)<br/>Atomic Work Distribution"]:::main

    W1["Worker Thread 1<br/>(Core 1)"]:::worker
    W2["Worker Thread 2<br/>(Core 2)"]:::worker
    W3["Worker Thread 3<br/>(Core 3)"]:::worker

    AI1["Evaluate Goal Queue<br/>(Mobs 0..63)"]:::ai
    AI2["Evaluate Goal Queue<br/>(Mobs 64..127)"]:::ai
    AI3["Evaluate Goal Queue<br/>(Mobs 128..191)"]:::ai

    Barrier["Thread Barrier & Join<br/>Apply Steering Vectors to Mob Positions"]:::main

    Main -->|Slice Active Mobs| Queue
    Queue --> W1
    Queue --> W2
    Queue --> W3
    W1 --> AI1
    W2 --> AI2
    W3 --> AI3
    AI1 --> Barrier
    AI2 --> Barrier
    AI3 --> Barrier
    Barrier --> Main
`,
    },
  },
  {
    id: 'world-generation',
    title: 'Procedural Generation, Biomes & Landmarks',
    category: 'world',
    summary: 'Deterministic Voronoi cell lattice, Perlin/FBM climate noise, cliff heights, and landmark placement.',
    content: `
### Procedural Generation Architecture

The world of Mellangan is completely infinite, deterministic, and generated procedurally without loading screens.

#### 1. Coordinate Hashing & Climate Space
World space is sampled using fractional Brownian motion (fBm) and multi-octave Perlin noise:
- **Temperature ($T$):** Defines the macro climate from Arctic snowfields to volcanic ashlands.
- **Moisture ($M$):** Determines vegetation density, separating arid deserts from lush jungles and wet mires.
- **Eerie ($E$):** Modulates uncanny, corrupted terrain (Barrows, Hollow Caverns, Crystal Fields).

#### 2. The Voronoi Biome Cell Lattice
To prevent chaotic pixel noise and create coherent continents, the world is subdivided into large cellular zones (\`BIOME_CELL = 32\` tiles). A pseudo-random Voronoi jitter algorithm calculates the dominant biome center:

\`\`\`cpp
void siteOf(int x, int y, int &sx, int &sy) {
  float fx = x + noise_fbm(...) * 30.0f;
  float fy = y + noise_fbm(...) * 30.0f;
  int cx = std::floor(fx / BIOME_CELL), cy = std::floor(fy / BIOME_CELL);
  // Find closest jittered cell seed
}
\`\`\`

#### 3. Cliffs, Ramps, and Lakes
- **High Ground Mechanics:** Elevated plateaus grant +15% attack damage against foes below.
- **Matching Stone Cliffs:** Cliffs adapt their material to their biome (Sandstone in deserts, Basalt in ashlands, Ice in snowfields, Mossy stone in greenwood).
- **Timber & Stone Ramps:** Natural staircases are carved into cliff walls, permitting smooth full-speed traversal.
- **Lakes & Water:** Water features calculate depth-based reflection ripples and swimming drag physics.

#### 4. Towering World Landmarks
Every ~80x80 tiles spawns a rare landmark with permanent run blessings:
- **The Ancient Tree:** Lantern-fruit oak healing the player and granting +15 Max HP.
- **Fallen Star:** Scorched impact crater releasing light blasts, gems, and treasure.
- **The Colossus:** Gigantic ancient skeletal ribcage guarded by rising undead.
- **The Monolith:** Runic black obelisk charting surrounding terrain on the minimap.
- **The Crystal Spire:** Resets class skill cooldown instantly and yields +5% might.
`,
    mermaidChart: {
      title: 'Procedural Biome Generation Pipeline',
      chart: `
flowchart TD
    classDef input fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef noise fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef biome fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef deco fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;

    Coords["World Coordinates (x, y) & World Seed"]:::input
    
    subgraph Noise_Sampling ["Multi-Octave Noise Sampling"]
        Temp["Temperature Noise<br/>fBm(x*0.018, y*0.018)"]:::noise
        Moist["Moisture Noise<br/>Perlin(x*0.09, y*0.09)"]:::noise
        Eerie["Eerie / Danger Noise<br/>Perlin(x*0.04, y*0.04)"]:::noise
    end

    subgraph Biome_Lattice ["Lattice & Classification"]
        Voronoi["Cell Center Jitter<br/>(BIOME_CELL = 32)"]:::biome
        Classifier["Climate Lookup Table<br/>(26 Distinct Biomes)"]:::biome
        Blend["Sub-Tile Transition Blend<br/>(Smooth Edge Normalization)"]:::biome
    end

    subgraph Feature_Decoration ["Terrain Features & Landmarks"]
        Cliffs["Cliff & Plateau Heightmap<br/>(Sandstone/Basalt/Ice)"]:::deco
        Stairs["Stairway & Ramp Placement<br/>(Full-speed access routes)"]:::deco
        Lakes["Water Bodies & Reflections<br/>(Lowland depression sampling)"]:::deco
        Landmarks["Landmarks & Shrines<br/>(Ancient Tree, Monolith, Spire)"]:::deco
    end

    Coords --> Noise_Sampling
    Noise_Sampling --> Biome_Lattice
    Voronoi --> Classifier --> Blend
    Blend --> Feature_Decoration
`,
    },
    interactiveComponent: 'noise',
  },
  {
    id: 'weather-sky',
    title: 'Sky Simulation, Weather & Dynamic Atmosphere',
    category: 'world',
    summary: 'The Sky.cpp atmospheric simulation, raymarched lighting gradients, dynamic weather, and blood moon omens.',
    content: `
### Atmospheric Light & Sky Simulation (\`Sky.cpp\`)

The atmosphere in Mellangan is driven by continuous mathematical illumination curves:

1. **The Diurnal Light Curve:**
   A full day cycle spans 15 minutes of real time, divided into Dawn, Day, Dusk, and Night:
   - **Day:** High ambient sunlight, cool shadow offsets.
   - **Night:** Deep indigo darkness, requiring dynamic player torches and shrine lanterns.
   - **Blood Moon:** Crimson sky tinting where elite foes spawn with +50% experience bounty.

2. **Dynamic Weather Systems:**
   Weather dynamically tracks regional humidity and elevation:
   - **Rain & Thunder:** Directional rain streaks with puddles, water ripples, and thunder strikes.
   - **Blizzard:** Drifting snow flakes and freezing wind vectors that slow entities without fire.
   - **Sandstorms:** Obscuring dust clouds with reduced visibility in deserts.

3. **Regional World Events:**
   - *Warm Breeze* (Meadows: gentle regeneration).
   - *Old Oaks Shelter* (Greenwood: shockwaves pushing enemies away).
   - *Wildfire* (Heath: spreading ground flame patches).
   - *The Barrow* (Barrows: skeletons rising from the earth).
`,
    mermaidChart: {
      title: 'Diurnal Cycle & Weather State Transitions',
      chart: `
stateDiagram-v2
    [*] --> DAWN
    DAWN --> DAY : Sun Rises (Warm Light)
    DAY --> DUSK : Shadows Lengthen
    DUSK --> NIGHT : Ambient Light Drops
    NIGHT --> BLOOD_MOON : Omen Trigger (Elites +50% XP)
    BLOOD_MOON --> NIGHT : Blood Moon Ends
    NIGHT --> DAWN : Shrines Lit / Night Survived
    
    state NIGHT {
        [*] --> Clear_Night
        Clear_Night --> Blizzard : Taiga / Snow
        Clear_Night --> Rainstorm : Forest / Mire
        Clear_Night --> Sandstorm : Desert / Badlands
    }
`,
    },
  },
  {
    id: 'combat-arsenal',
    title: 'Combat Systems, Elite Traits & Boss Mechanics',
    category: 'gameplay',
    summary: '12 character classes, weapon evolution recipes, elite enemy affixes, and boss rotation telegraphs.',
    content: `
### 12 Playable Character Classes

Mellangan features 12 distinct hero classes, each with specialized traits, starting weapons, and active skills:

1. **Mage:** Keeper of arcana. \`Blink\` teleportation burst; gains +15% XP from gems.
2. **Ranger:** Master archer. \`Volley\` piercing spread; 15% evasion dodge.
3. **Knight:** Heavy vanguard. \`Shield Charge\`; 50% damage reduction on guard cooldown.
4. **Alchemist:** Brewmaster. \`Miasma\` toxic puddle; random potion drops.
5. **Stormcaller:** Electrician. \`Chain Storm\` calling lightning bolts from the sky.
6. **Reaper:** Death harvester. \`Soul Siphon\` scythe sweep with life steal.
7. **Priestess:** Divine conduit. \`Sacred Light\` healing nova that repels undead.
8. **Duelist:** Fencer. \`Lunge\` precision strike; guaranteed critical hits.
9. **Warden:** Forest guardian. \`Rootbound\` mending vines and thorns.
10. **Tinkerer:** Engineer. \`Sentry\` deploying autonomous clockwork turrets.
11. **Oracle:** Stargazer. \`Revelation\` marking foes for 35% damage amplification.
12. **Corsair:** Swashbuckler. \`Broadside\` dashing forward with five piercing pistol shots.

### Elite Enemy Affixes & Modifiers

Elites glow with radiant trait rings, challenging player positioning:
- **Hasted (Yellow):** 40% increased movement speed.
- **Vampiric (Red):** Heals itself whenever damaging the player.
- **Warded (Blue Double Ring):** Absorbs 5 hits completely before shattering in an explosion.
- **Splitting (Green):** Divides into two agile copies upon death.
- **Volatile (Orange):** Emits a circular warning telegraph, detonating shortly after death.
- **Frosted (Cyan):** Leaves a permanent ice trail that slows the player.

### Boss Attack Rotations

Bosses in Mellangan execute telegraph-warned ability cycles:
- **The Lich:** Blinks across the arena, calls localized thunderbolts, and summons Comet strikes.
- **The Pack Lord:** Roars a War Cry boosting nearby wolf packs, dashes forward with Duelist lunges, and howls a healing nova.
- **The Cyclops:** Releases sweeping 7-arrow volleys and strikes the ground with shockwave tremors.
`,
    mermaidChart: {
      title: 'Weapon Evolution & Recipe Synergies',
      chart: `
flowchart LR
    classDef base fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef passive fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef evolved fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;

    subgraph Base_Weapons ["Base Weapons (Level 5)"]
        Staff["Arcane Staff"]:::base
        Knife["Orbiting Knives"]:::base
        Blade["Moon Blade"]:::base
        Rod["Storm Rod"]:::base
        Nova["Frost Nova"]:::base
    end

    subgraph Passive_Relics ["Passive Catalyst Relics"]
        Tome["Arcane Tome<br/>(+Might)"]:::passive
        Boots["Swift Boots<br/>(+Speed)"]:::passive
        Amulet["Silver Amulet<br/>(+Crit)"]:::passive
        Magnet["Lodestar Ring<br/>(+Reach)"]:::passive
        Heart["Troll Heart<br/>(+Regen)"]:::passive
    end

    subgraph Evolved_Weapons ["Evolved Master Artifacts"]
        E_Staff["Starfall Cataclysm<br/>(Continuous orbital beams)"]:::evolved
        E_Knife["Phantom Blades<br/>(Infinite penetration spiral)"]:::evolved
        E_Blade["Lunar Eclipse<br/>(360 cleave with bleed)"]:::evolved
        E_Rod["Thunder God Wrath<br/>(Screen-wide chain shock)"]:::evolved
        E_Nova["Absolute Zero<br/>(Freezes foes shatter-crit)"]:::evolved
    end

    Staff --- Tome --> E_Staff
    Knife --- Boots --> E_Knife
    Blade --- Amulet --> E_Blade
    Rod --- Magnet --> E_Rod
    Nova --- Heart --> E_Nova
`,
    },
  },
  {
    id: 'audio-system',
    title: 'Audio Pipeline & Sound Engineering',
    category: 'simulation',
    summary: 'SDL3 low-latency audio streams, procedural sound effect synthesis, and streaming Vorbis music.',
    content: `
### Modern SDL3 Audio Engine

Mellangan leverages modern SDL3 audio streaming APIs (\`src/audio/Sound.cpp\`):

- **Zero-Allocation Stream Mixing:** Audio buffers are mixed at 44.1 kHz 16-bit stereo with minimal 441-frame buffers, eliminating audio latency and stutter during dense combat encounters.
- **Procedural Pitch Shifting & Positional Pan:**
  Sound effects apply micro-randomized pitch variations (\`0.92f - 1.08f\`) on every hit, slash, and explosion, preventing repetitive acoustic fatigue.
- **Spatial Volume Falloff:** Sounds generated by offscreen bosses, ambient waterfalls, and campfires attenuate smoothly based on Euclidean distance to the player's viewport.
- **Embedded Ogg Vorbis Streaming:** Ambient soundtrack music (\`res/music/night.ogg\`) is streamed and decoded on the fly via \`stb_vorbis\`, keeping executable memory footprint negligible.
`,
    mermaidChart: {
      title: 'Audio Pipeline & Mixing Architecture',
      chart: `
flowchart LR
    classDef src fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef mix fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef out fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;

    WAV["Sound Effects (WAV)<br/>(Hits, Casts, Slashes, Howls)"]:::src
    OGG["Music Streams (OGG)<br/>(night.ogg via stb_vorbis)"]:::src
    Weather["Ambient Loops<br/>(rain.wav, wind.wav)"]:::src

    subgraph Audio_Mixer ["SDL3 Low-Latency Stream Mixer"]
        Pitch["Pitch & Volume Shifter<br/>(Micro-randomized variation)"]:::mix
        Pan["Positional Panner<br/>(Distance & Angle Attenuation)"]:::mix
        Buffer["Audio Stream Buffer<br/>(44.1 kHz, 2ch, 441 frames)"]:::mix
    end

    Device["Hardware Sound Card<br/>(SDL_AudioStream)"]:::out

    WAV --> Pitch --> Pan --> Buffer
    OGG --> Buffer
    Weather --> Pan --> Buffer
    Buffer --> Device
`,
    },
  },
];

