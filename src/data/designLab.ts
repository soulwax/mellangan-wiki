import type { WikiSection } from "./wikiContent";

const THEME = `
    classDef cls fill:#181524,stroke:#f6c324,stroke-width:2px,color:#e2e8f0;
    classDef sys fill:#181524,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef fx fill:#181524,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef gate fill:#181524,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;`;

export const DESIGN_LAB: WikiSection = {
    id: "design-lab",
    title: "Design Lab: Trees, Spellcraft & Ultimates",
    category: "gameplay",
    summary:
        "A playground for the campaign's class trees, the Spellcraft forge, Space ultimates and combat juice: the owner's inputs, ideas, combinations and diagrams.",
    sourceFiles: [
        "Docs/plan/ult0-design.md",
        "src/input/Input.cpp",
        "src/entity/Player.cpp",
        "src/particle/TextParticle.cpp",
        "src/menu/TreeMenu.hpp",
        "src/hero/Fuse.hpp",
    ],
    content: `
This chapter is a thinking table, not a spec. The frozen record is **Docs/plan/ult0-design.md**; everything marked *idea* below is a candidate to play with, and nothing here is implemented unless it says so. All of it is **campaign only**; Survival is untouched.

## 1. Owner inputs, saved (2026-11-25)

| Topic | Decision |
| --- | --- |
| Level ceiling | 20 is a good ceiling |
| Trees | Aligned like WoW vanilla: every class has **three trees**, one per playstyle |
| Points and tier gates | Use the lead's recommendation, "make something fun" |
| Spell combination | Combining spells is **transmutation**: never learned automatically; a separate **fourth tree**, radically different, to forge one's own combinations |
| Legacy | Today's upgrades stay as a legacy tree, still usable, for maximum flexibility in human-tested runs |
| Space | An **ultimate**, unlocked at later levels, roughly **5 per class**, think Dota |
| Ultimate look | Freestyle per class, beautiful particle visuals; the stronger the spell, the stronger the impact must be felt |
| Numbers | DPS and healing numbers float up; crits float up and momentarily **plop** bigger |
| Class skill key | **Q** (shipped, ULT0a) |
| Gamepad | A stays the class skill; the ultimate shares **L3** with Drop Item (LT is already the skill tree) |
| Weapon cards | None in the campaign; level-up weapon cards are Survival only |
| Auto-fire | Allies and foes auto-fire to some extent |
| Hold-fire | Hold or toggle, chosen in Settings |
| Localisation | German last, in the end phase |
| Style | Gothic chibi, electro funk, Caves of Qud, real-time combat |

## 2. What is already built

- **Q** casts the class skill, **Space** calls the ultimate slot (a stub until ULT2), **L3** is the pad ultimate. Space still confirms in menus, build mode and dialogue.
- Big damage numbers plop in (0.7x to 1.5x in 0.12 s, then settle). Draw-only; no randomness.
- The Spellcraft tab is a fusing seat of two sockets over the tree's points, with a ring of known fusions and signature hints.

## 3. The five layers of one hero

A hero would be built from five layers that never replace each other: the **class** (base stats and the class skill), three **trees** (points, vanilla style), the **legacy** column (today's level-up upgrades), **Spellcraft** (use-grown forging), and the **ultimate** (Space).

## 4. Point rules (recommended)

- 1 point per level from level 2, plus 1 from each act's last quest: about 19 by level 20.
- Tier *n* needs 3 x (n minus 1) points already spent in that tree; the capstone (tier 5) needs 12, and costs 1.
- A normal build reaches one capstone and about half a second tree; nobody takes everything.
- Respec at a hearth for gold (50 x level), the first one each act free.

## 5. Ideas to play with

**Trees**
1. Every tree has one *keystone* that changes how the class skill or the ultimate behaves (a rule change, not a number).
2. A tree can lean on a stat the others ignore: Focus, crits, armor, dash, allies.
3. Mixed capstones: a hybrid node that opens only if two trees each hold 6 points.
4. A "respec scar": the first respec of an act is free, later ones leave a cosmetic mark on the hero card.
5. Tree names matter in dialogue: NPCs react to your strongest tree.
6. One tree per class is a "support" tree that also buffs Lene.
7. Capstones show in the world: a small aura or sound you can read across the screen.
8. Legacy picks and tree picks can share *synergy tags* so old builds stay strong.

**Ultimates**
1. Telegraph first: a 0.3-0.6 s windup with a sound sting and a ring on the ground.
2. Cooldown shortened by kills, never by haste (keeps haste rare).
3. Spend all Focus: choosing to cast spells or the ultimate is a real trade.
4. Overcharge: hold Space to hold the ultimate back and widen it (hold or toggle in Settings).
5. A combo window after an ultimate: the next spell cast within 3 s is boosted.
6. Ultimates scale with the tier of the foes hit, so they stay fun late.
7. Each ultimate has a *finisher* shot: the biggest hit says its total once, large.
8. Equip one at a time at a hearth; the other four are unlocks you can swap to for a boss.

**Spellcraft**
1. Witnessing: you may only fuse a pair after seeing it (cast near, seen cast by a foe, read in a book).
2. Reagents: essence of a school, a shard, a rite remnant.
3. A signature rider rolls on the first fusion of a pair and is shown before you commit.
4. Marks: each fusion earns marks with use; three marks ascend it.
5. Failed forges leave a *residue* item that is itself a reagent.
6. A fusion's name is yours to write once (a naming prompt).
7. Foes can carry fusions too, so witnessing happens in fights.
8. A "grimoire page" reward for a quest that teaches one pair outright.

**Juice**
1. Hit-stop of 3-6 frames on ultimates, none on small hits.
2. Screen kick scaled by the damage fraction of the target's health.
3. Healing numbers rise slower and greener than damage.
4. A crit chain: three crits in a row make the third number larger still.
5. Particle budget per frame, with the ultimate owning the largest share.
6. Muted mode: a Settings option to calm numbers and shake for players who want less.

## 6. Spell combination ideas (examples, not data)

These are *ideas* for transmutation pairs; the real book is the 48 spells in the game. Treat the names as brainstorm.

| Parent A | Parent B | Idea | Possible rider |
| --- | --- | --- | --- |
| Fire | Frost | Steam Burst | blinds foes in a cone |
| Fire | Storm | Firestorm | chains between burning foes |
| Frost | Storm | Hail | slows then stuns |
| Arcane | Fire | Plasma | pierces armor |
| Arcane | Frost | Rimeglass | shatters on crit |
| Light | Fire | Sunspear | heals allies it passes |
| Shadow | Frost | Black Ice | foes slip and take extra from dashes |
| Shadow | Arcane | Voidstep | a short blink that leaves a hazard |
| Earth | Storm | Magnetite Rain | pulls loot toward you |
| Earth | Fire | Magma Seam | leaves a burning trail |
| Poison | Fire | Venom Flare | detonates poison stacks |
| Light | Arcane | Prism | splits into three weaker beams |

## 7. Ultimates, first draft

Unlock levels 6 / 9 / 12 / 15 / 18. Numbers belong to the cards; names are first draft.

| Class | Trees | Ultimates |
| --- | --- | --- |
| Mage | Pyre, Frost, Arcane | Meteor Fall, Glacier Choir, Arcane Collapse, Prism Beam, Star Rain |
| Ranger | Hunter, Trapper, Wind | Thousand Arrows, Briar Field, Falcon Strike, Wild Hunt, Eclipse Shot |
| Knight | Bulwark, Vanguard, Oath | Shield Wall, Titan's Charge, Banner of the Fallen, Judgement Drop, Last Stand |
| Alchemist | Toxin, Fire, Gold | Cauldron Burst, Philosopher's Fire, Quicksilver Flood, Gold Rush, Transmute Field |
| Stormcaller | Thunder, Gale, Tide | Chain Tempest, Eye of the Storm, Tidal Crash, Skyfall, Tempest Avatar |
| Reaper | Harvest, Blight, Shade | Scythe Whirl, Reap the Row, Grave Tide, Soul Feast, Dread Harvest |
| Priestess | Radiance, Mercy, Wrath | Sanctum, Dawnbreak, Chorus of Mercy, Seraph's Rebuke, Sunfall |
| Duelist | Parry, Flurry, Poise | Blade Dance, Riposte Storm, Thousand Cuts, Perfect Form, Last Duel |
| Warden | Root, Stone, Beast | Thorn Prison, Quake Ring, Elder Stride, Mother Bear, Verdant Tide |
| Tinkerer | Turrets, Gadgets, Overclock | Sentry Array, Mine Carpet, Tesla Net, Mech Frame, Overload Core |
| Oracle | Foresight, Hex, Fate | Doom Mark, Echoed Hour, Fate Thread, Prophecy, Black Sun |
| Corsair | Cannon, Cutlass, Rum | Broadside, Boarding Party, Kraken's Grasp, Powder Keg Chain, Storm Cannon |

## 8. Open questions to chew on

- Should a tree capstone change the *ultimate* or the *class skill*?
- Does the legacy column cost points, or stay free forever?
- Can a fusion ever become an ultimate (a late Spellcraft reward)?
- How loud should the ultimates be for players who want a calm game?
- Which two classes should feel most unlike each other?
- Should Lene ever get an ultimate?
- Should foes' elites have ultimates with the same telegraph rules?
`,
    mermaidCharts: [
        {
            title: "Twelve Classes, Thirty-Six Trees (draft names)",
            chart: `
mindmap
  root((12 classes))
    Mage
      Pyre
      Frost
      Arcane
    Ranger
      Hunter
      Trapper
      Wind
    Knight
      Bulwark
      Vanguard
      Oath
    Alchemist
      Toxin
      Fire
      Gold
    Stormcaller
      Thunder
      Gale
      Tide
    Reaper
      Harvest
      Blight
      Shade
    Priestess
      Radiance
      Mercy
      Wrath
    Duelist
      Parry
      Flurry
      Poise
    Warden
      Root
      Stone
      Beast
    Tinkerer
      Turrets
      Gadgets
      Overclock
    Oracle
      Foresight
      Hex
      Fate
    Corsair
      Cannon
      Cutlass
      Rum
`,
        },
        {
            title: "The Five Layers of One Hero",
            chart: `
flowchart TD${THEME}
    Class["Class<br/>stats and the class skill (Q)"]:::cls
    Trees["Three trees<br/>points, tiers, capstone"]:::sys
    Legacy["Legacy column<br/>today's level-up upgrades"]:::sys
    Craft["Spellcraft<br/>use-grown forging"]:::fx
    Ult["Ultimate<br/>Space, one equipped"]:::fx
    Class --> Trees
    Class --> Legacy
    Trees -->|"capstone riders"| Ult
    Craft -->|"ascended fusions"| Ult
    Legacy -.->|"synergy tags"| Trees
    Craft -.->|"spell book rows"| Class
`,
        },
        {
            title: "Where Points Come From and Where They Go",
            chart: `
flowchart LR${THEME}
    Lv["Levels 2 to 20<br/>1 point each"]:::sys --> Pool(("Point pool<br/>about 19"))
    Act["Act-ending quests<br/>+1 each"]:::sys --> Pool
    Pool --> A["Tree A"]:::cls
    Pool --> B["Tree B"]:::cls
    Pool --> C["Tree C"]:::cls
    Hearth["Hearth respec<br/>50 x level gold<br/>first free each act"]:::gate -.->|"refunds all"| Pool
`,
        },
        {
            title: "Tier Gates, Vanilla Style",
            chart: `
flowchart TD${THEME}
    T1["Tier 1<br/>needs 0 spent"]:::gate --> T2["Tier 2<br/>needs 3 spent"]:::gate
    T2 --> T3["Tier 3<br/>needs 6 spent"]:::gate
    T3 --> T4["Tier 4<br/>needs 9 spent"]:::gate
    T4 --> T5["Tier 5 capstone<br/>needs 12 spent, costs 1"]:::cls
`,
        },
        {
            title: "A Typical 19-Point Build",
            chart: `
pie showData
    title Where the points go in a normal build
    "Capstone tree (12 gate + 1 capstone)" : 13
    "Second tree" : 6
`,
        },
        {
            title: "What Space, Q and L3 Do Now",
            chart: `
flowchart TD${THEME}
    Q["Q key"]:::cls --> Skill["Class skill<br/>Player::cast"]:::fx
    Sp["Space key<br/>confirm"]:::cls --> Ctx{"Context"}:::gate
    Ctx -->|"menu or dialogue"| Confirm["Confirm"]:::sys
    Ctx -->|"build mode"| Place["Place the piece"]:::sys
    Ctx -->|"tutorial wake"| Hand["Hand control back"]:::sys
    Ctx -->|"in play"| Ult["Ultimate<br/>stub until ULT2"]:::fx
    PA["Pad A"]:::cls --> Ctx2{"Context"}:::gate
    Ctx2 -->|"menu"| Confirm
    Ctx2 -->|"in play"| Skill
    L3["Pad L3"]:::cls --> Ctx3{"Context"}:::gate
    Ctx3 -->|"inventory"| Drop["Drop item"]:::sys
    Ctx3 -->|"in play"| Ult
`,
        },
        {
            title: "Ultimate Unlock Timeline",
            chart: `
timeline
    title Five ultimates per class
    Level 6 : First ultimate : Space wakes up
    Level 9 : Second ultimate : a choice appears
    Level 12 : Third ultimate : trees add riders
    Level 15 : Fourth ultimate : a boss-swap option
    Level 18 : Fifth ultimate : the signature one
    Level 20 : Ceiling : last capstone points
`,
        },
        {
            title: "Life of One Ultimate",
            chart: `
stateDiagram-v2
    [*] --> Locked
    Locked --> Ready: level reached and equipped
    Ready --> Telegraph: Space pressed with full Focus
    Telegraph --> Cast: 0.3 to 0.6 s windup
    Cast --> HitStop: impact lands
    HitStop --> Cooldown: 3 to 6 frames
    Cooldown --> Ready: 60 to 120 s, kills shorten it
    Telegraph --> Ready: interrupted, Focus refunded
`,
        },
        {
            title: "Spellcraft Loop: Witness, Forge, Ascend",
            chart: `
flowchart TD${THEME}
    See["Witness a pair<br/>cast near, seen, or read"]:::sys --> Sock["Place both parents<br/>in the two sockets"]:::fx
    Sock --> Reag["Add a reagent<br/>school essence, shard, remnant"]:::fx
    Reag --> Sig{"First time for this pair?"}:::gate
    Sig -->|"yes"| Roll["Roll a signature rider<br/>shown before commit"]:::fx
    Sig -->|"no"| Fuse
    Roll --> Fuse["Fuse"]:::fx
    Fuse --> Use["Use it in fights<br/>earn marks"]:::sys
    Use --> Marks{"Three marks?"}:::gate
    Marks -->|"no"| Use
    Marks -->|"yes"| Asc["Ascended form<br/>bigger visuals, one extra rider"]:::cls
    Fuse -.->|"failed forge"| Res["Residue item<br/>itself a reagent"]:::sys
`,
        },
        {
            title: "Transmutation Pairs: Idea Web",
            chart: `
flowchart LR${THEME}
    Fire((Fire)):::cls
    Frost((Frost)):::cls
    Storm((Storm)):::cls
    Arcane((Arcane)):::cls
    Light((Light)):::cls
    Shadow((Shadow)):::cls
    Fire --- Steam["Steam Burst"]:::fx --- Frost
    Fire --- Firestorm["Firestorm"]:::fx --- Storm
    Frost --- Hail["Hail"]:::fx --- Storm
    Arcane --- Plasma["Plasma"]:::fx --- Fire
    Arcane --- Rime["Rimeglass"]:::fx --- Frost
    Light --- Sun["Sunspear"]:::fx --- Fire
    Shadow --- Ice["Black Ice"]:::fx --- Frost
    Shadow --- Void["Voidstep"]:::fx --- Arcane
    Light --- Prism["Prism"]:::fx --- Arcane
`,
        },
        {
            title: "From a Hit to a Felt Impact",
            chart: `
sequenceDiagram
    autonumber
    participant S as Strike or spell
    participant D as Damage roll
    participant N as Number particle
    participant J as Juice
    participant P as Particles
    S->>D: hit lands
    D->>D: crit roll and multipliers
    D->>N: value and crit flag
    N->>N: rise, fade, plop if crit
    D->>J: damage as fraction of target health
    J->>J: hit-stop and screen kick if large
    J->>P: burst sized by strength within the frame budget
    Note over J,P: draw-only, never consumes rng
`,
        },
        {
            title: "The Crit Plop Curve (shipped)",
            chart: `
xychart-beta
    title "Big number scale over its first half second"
    x-axis "seconds" [0, 0.05, 0.1, 0.12, 0.2, 0.3, 0.5]
    y-axis "scale" 0 --> 1.6
    line [0.7, 1.03, 1.37, 1.5, 1.28, 1.0, 1.0]
`,
        },
        {
            title: "Class Design Space (idea)",
            chart: `
quadrantChart
    title Where each class might sit
    x-axis "Simple to play" --> "Complex to play"
    y-axis "Steady damage" --> "Burst damage"
    quadrant-1 "Complex burst"
    quadrant-2 "Simple burst"
    quadrant-3 "Simple steady"
    quadrant-4 "Complex steady"
    Mage: [0.55, 0.8]
    Ranger: [0.35, 0.45]
    Knight: [0.15, 0.2]
    Alchemist: [0.8, 0.5]
    Stormcaller: [0.5, 0.85]
    Reaper: [0.6, 0.6]
    Priestess: [0.45, 0.15]
    Duelist: [0.85, 0.7]
    Warden: [0.3, 0.3]
    Tinkerer: [0.9, 0.35]
    Oracle: [0.7, 0.4]
    Corsair: [0.25, 0.7]
`,
        },
        {
            title: "Player Mood Across a Campaign (idea)",
            chart: `
journey
    title Power curve of one hero
    section Act I
      First spells: 3: Hero
      Level 6 ultimate wakes: 5: Hero
    section Act II
      First capstone in reach: 4: Hero
      Second ultimate: 5: Hero
    section Act III
      Spellcraft marks pay off: 4: Hero
      A boss that needs the right ultimate: 3: Hero
    section Act IV and V
      Ascended fusion: 5: Hero
      Fifth ultimate: 5: Hero
      The last fight: 4: Hero
`,
        },
        {
            title: "Level-Up Offer: Tree Points, Legacy, Spellcraft",
            chart: `
flowchart TD${THEME}
    Up["Level up"]:::sys --> Pt["+1 tree point<br/>spend in the tree menu (T)"]:::cls
    Up --> Leg["Legacy offer<br/>today's upgrade cards"]:::sys
    Up --> Un{"Ultimate level?<br/>6, 9, 12, 15, 18"}:::gate
    Un -->|"yes"| New["New ultimate unlocked<br/>equip at a hearth"]:::fx
    Pt --> Ask{"Spend now or later?"}:::gate
    Ask -->|"now"| Tree["Tier-gated tree nodes"]:::cls
    Ask -->|"later"| Bank["Points stay banked"]:::sys
    Craft["Spellcraft (never automatic)<br/>witness, reagent, fuse, marks"]:::fx -.-> Tree
`,
        },
        {
            title: "Data Shape of the New Systems (draft)",
            chart: `
classDiagram
    class Hero {
      name
      cooldown
      cast()
    }
    class TreeDef {
      heroIndex
      name
      tiers
    }
    class NodeDef {
      key
      tier
      maxRank
      needsSpent
      rule
    }
    class UltimateDef {
      key
      unlockLevel
      cooldown
      palette
    }
    class FusionMark {
      pairKey
      marks
      ascended
    }
    Hero "1" --> "3" TreeDef
    TreeDef "1" --> "many" NodeDef
    Hero "1" --> "5" UltimateDef
    Hero "1" --> "many" FusionMark
    NodeDef ..> UltimateDef : capstone rider
`,
        },
        {
            title: "Card Order (what depends on what)",
            chart: `
flowchart LR${THEME}
    ULT1["ULT1 numbers and juice<br/>plop shipped"]:::fx
    ULT0a["ULT0a Q and Space<br/>shipped"]:::fx
    ULT0b["ULT0b trees, tiers, UI"]:::sys
    ULT2["ULT2 sixty ultimates<br/>six batches"]:::sys
    ULT3["ULT3 Spellcraft growth"]:::sys
    CB1["CB1 weave flag, aiming,<br/>auto-fire, hold or toggle"]:::sys
    ULT0a --> ULT0b
    ULT0a --> ULT2
    ULT1 --> ULT2
    ULT0a --> CB1
    ULT0b --> ULT3
`,
        },
        {
            title: "Respec Flow",
            chart: `
flowchart TD${THEME}
    H["At a hearth"]:::cls --> F{"Free respec left this act?"}:::gate
    F -->|"yes"| Free["Refund all points, no gold"]:::sys
    F -->|"no"| Pay{"Can pay 50 x level gold?"}:::gate
    Pay -->|"yes"| Paid["Refund all points, spend gold"]:::sys
    Pay -->|"no"| Stay["Keep the build"]:::sys
    Free --> Re["Spend again, tier gates re-apply"]:::fx
    Paid --> Re
`,
        },
        {
            title: "Rider Network (idea): what a capstone or fusion can add",
            chart: `
mindmap
  root((Riders))
    Reach
      Pierce
      Chain
      Echo
      Split
    Status
      Burn
      Chill
      Stun
      Poison
    Support
      Heal allies
      Shield
      Haste a little
    Terrain
      Hazard trail
      Wall
      Pull loot
    Payoff
      Shatter on crit
      Detonate stacks
      Execute low health
`,
        },
        {
            title: "Combat Feel Pipeline by Strength",
            chart: `
flowchart LR${THEME}
    Small["Small hit"]:::sys --> n1["Number only"]:::fx
    Mid["Crit or spell"]:::sys --> n2["Number plops<br/>+ spark burst"]:::fx
    Big["Heavy spell"]:::sys --> n3["Plop + kick<br/>+ bigger burst"]:::fx
    Ult["Ultimate"]:::cls --> n4["Telegraph, hit-stop,<br/>screen kick, palette flash,<br/>total number"]:::fx
`,
        },
    ],
};
