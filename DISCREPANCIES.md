# Wiki vs. `src/` Discrepancy & Change Audit

- **Audit date:** 2026-11-19
- **Status:** **Synced** into `src/data/wikiContent.ts`, `src/data/navigation.ts`, `src/components/RendererPipelineInspector.tsx`, and `src/components/SpatialGridVisualizer.tsx` (`node scripts/verify-all.js` + `tsc --noEmit` passing).
- **Wiki baseline:** `extern/wiki` commit `42e80d0` (2026-11-17)
- **Engine baseline:** `mellangan` commit `f83e5f6` (2026-11-19, post-`0.7.6` `Unreleased`) + working-tree edits (`src/campaign/Cookery.hpp`, `src/campaign/Foods.cpp`, `src/gui/PanelQuick.cpp`, `src/entity/Player.*`, `src/gui/Lang.*`)
- **Scope:** `extern/wiki/src/data/wikiContent.ts`, `extern/wiki/src/data/navigation.ts`, and `extern/wiki/src/components/*.tsx` verified directly against `src/` and `tools/`.

---

## Executive Summary

Since the last wiki sync (`4bf4b95` / `42e80d0`), `mellangan` shipped `0.7.5`, `0.7.6`, and a large set of `Unreleased` changes (live non-pausing campaign panels, unified 7-tab window, Pack/Quickbar/raw foods, nearest-wins talkers, NPC hold-still, unified `SOURCES` harvesting, 8 new Cave/Sundark sub-biomes, living biomes, faction chiefs & Ranks 1–4, Kettlestaithe, Saltmoor Tidemarket, Sagas, `data.pak`, per-campaign `lore::Book`, etc.).

In addition to those post-sync omissions, several existing chapters contain **direct factual contradictions** (fabricated enum/item/festival/rune/gem names, wrong constants, reversed mechanics, or stale architecture) and **stale interactive components**.

| Category | Count |
| --- | ---: |
| Factual Contradictions (wiki says X, `src/` does Y) | 31 |
| Outdated Counts, Names, Keys & Component Constants | 15 |
| Major Undocumented Features / Post-Sync Systems | 28 |

---

## 1. Factual Contradictions (Wiki Claims vs. Actual `src/`)

### 1.1 Items, Loot, Gems, Runes & Cookery

1. **`gems-and-sockets` (`wikiContent.ts` L6741–6820) — Gem names, grades, and slot mapping are fabricated**
   - **Wiki claims:** Grades `Chipped, Flawed, Regular, Flawless, Radiant`; 7 kinds `Ruby, Sapphire, Topaz, Emerald, Amethyst, Diamond, Skull`; `SLOT_SOCKETS = {3, 2, 3, 1, 1, 0}` mapped to `Weapon, Armor, Shield/Offhand, Helm, Boots, Ring/Amulet`.
   - **Actual `src/`:** `src/item/loot/Jewel.cpp:19–46` & `Jewel.hpp:24` define `GRADE_NAMES = {"Rough", "Cut", "Clear", "Flawless", "Radiant"}`; 7 kinds **`Amber, Jade, Garnet, Sapphire, Opal, Onyx, Moonstone`**; 3 effect columns (`Weapon/Offhand`, `Armour`, `Charm/Charm2`); and `SLOT_SOCKETS = {3, 2, 3, 1, 1, 0}` mapped to **`GearWeapon (3), GearOffhand (2), GearArmour (3), GearCharm (1), GearCharm2 (1), GearImplant (0)`**.

2. **`runes-and-words` (`wikiContent.ts` L6880–7029) — Rune names, formulas, discovery gating, and `shatter()` are wrong**
   - **Wiki claims:** 12 runes `Sol, Tyr, Oth, Alg, Wyn, Hag, Nyd, Isa, Jer, Eih, Peor, Sig`; fabricated formulas/slots (e.g. `Furrowsong = Wyn+Oth+Jer` in Hoe, `Toll of Roads` in Boots, `Long Table` in Helm); rune words cannot activate until `known(c, word) == true`; `rune::shatter()` destroys the item and recovers the runes (contradicting its own diagram at L7041).
   - **Actual `src/`:** `src/item/loot/Rune.cpp:28–68, 107–120, 142–152` & `RuneWord.cpp:64–66`:
     - The 12 runes are **`Keth, Orra, Wenn, Dunn, Brae, Mirr, Hathe, Quor, Selv, Yrn, Thask, Aelm`**.
     - Actual formulas/slots include `Ashen Tithe = Keth+Wenn` (2-socket Weapon), `Furrowsong = Orra+Keth` (2-socket Armour), `Toll of Roads = Dunn+Orra` (2-socket Offhand), `Smithcall = Quor+Dunn+Brae` (3-socket Weapon), `Undertorch = Selv+Mirr` (2-socket Offhand), `Long Table = Hathe+Selv+Keth` (3-socket Armour).
     - `rune::word(item)` does **not** require `known()` — socketing the right order activates the word and teaches it via `learn()`.
     - `rune::shatter()` **keeps the item**, **destroys all socketed runes**, and returns regular gems (`jewels[g]++`).

3. **`campaign-cookery` (`wikiContent.ts` L7123–7224) — Four wrong constants**
   - **Wiki claims:** `MEAL_LIFE` is 60 s (120 s smoked), Smoke Rack reach `RACK_REACH` is 5 tiles, `GUEST_SEAT = 36` px, `GIFT_GOLD = 50`, and L7123 says "(16 Elemental Effects)" while listing only 8.
   - **Actual `src/`:** `src/campaign/Cookery.hpp:31, 46–47`: `MEAL_LIFE = 300` s (**600 s** near SmokeRack), `RACK_REACH = 64` px (**4 tiles**), `GUEST_SEAT = 80` px, `GIFT_GOLD = 30` gold; 8 `GARNISH` payloads.

4. **`paper-doll-gear-combat` (`wikiContent.ts` L3918) — Incomplete implant rule**
   - **Wiki claims:** Implant changes require not being a changeling and being in a safe zone.
   - **Actual `src/`:** `src/entity/PlayerGear.cpp:44–47` (`Player::implantable()`) also permits implanting outside safe zones when the player has `rune::KindredFlesh` or `boons::Kinship`.

### 1.2 Campaign Standing, Nations, Economies, Festivals, Situations & Farming

5. **`campaign-standing` (`wikiContent.ts` L7405–7550) — Wrong cap, wrong tiers, wrong contagion math**
   - **Wiki claims:** Changeling Synod standing is capped at `Campaign::WARY = -100`; 5 reputation tiers (`HATED <= -500`, `WARY -499..-100`, `NEUTRAL -99..+99`, `FRIENDLY +100..+499`, `REVERED >= +500`); political contagion damping $\lambda \approx 0.35$ (`+100` Freeblades $\rightarrow$ `-35` Coinroad).
   - **Actual `src/`:** `src/campaign/Campaign.hpp:226`, `Standing.cpp:59–60, 104–111`, `Standing.hpp:14`, `Politics.cpp:35, 255–260`:
     - `Campaign::WARY = 250` (Changeling Synod cap is `+250`, bottom of `Liked`).
     - **6** `Disposition` bands: `Hated (<= -500)`, `Disliked (-499..-250)`, `Indifferent (-249..+249)`, `Liked (+250..+499)`, `Friendly (+500..+899)`, `Revered (>= +900)`.
     - Contagion is `hero[b] += d * p.rel[a][b] / 4000` (`CONTAGION = 4000`; max multiplier `0.25`; `+100` Freeblades with `rel = -350` yields `-8`, not `-35`).

6. **`nations-realms-diplomacy` (`wikiContent.ts` L8746–8812) — Fabricated Voronoi math, `seize()`, and `voices::hail()`**
   - **Wiki claims:** Elevation-weighted Voronoi $D_i(x,y) = \text{dist} \cdot W_{\text{elevation}}$, `CELL = 4` as a 4-tile stride, fabricated `seize()` (`isCapitalSeat`, `reg.contested`, `recomputeBorders()`), and fabricated `voices::hail(f, standing)` with `+80/+20/-20/-80` thresholds.
   - **Actual `src/`:** `src/level/Realm.cpp:14, 49–76, 152–168` uses unweighted Euclidean `std::hypot` over `4×4`-region macro-cells (`REGION = 96` tiles, so `CELL = 4` regions = 384 tiles); `seize(rx, ry, f)` checks `nation/seat/owner/borders`, writes `Campaign::claims`, and calls `forget()`. `src/campaign/Voices.cpp:81–100` exposes `voices::line()` and `voices::greet()` keyed on `Disposition`, `aggro`, `war`, and `sided`.

7. **`economies-festivals-happenings` (`wikiContent.ts` L8875–8940) — Fabricated pricing formula, festival names/schedule, and happening names**
   - **Wiki claims:** `ELASTICITY = 0.45f`, `TARIFF_PEACE = 1.0f`, `TARIFF_WAR = 1.65f` (contradicting its own diagram at L8972–8973); fabricated festival names ("Feast of the First Anvil", "The Silver Solstice", etc.) on fixed Days 10/20/30/40/50; fabricated Happenings ("Iron Shortage", "Locust Cloud", "Star Shower", etc.).
   - **Actual `src/`:**
     - `src/campaign/Economy.hpp:13–14` & `Economy.cpp:34–80`: fixed multipliers on `LOT * UNIT = 20`: `MAKES = 0.6f`, `NEEDS = 1.8f`, `SCARCE = 1.5f`, `ABROAD = 1.3f`, `FAMINE = 2.0f` across `TRADES[10]`.
     - `src/campaign/Festival.cpp:15–26, 57–59`: 10 festivals (`Crowning Eve`, `Long Quaff`, `Dry Vigil`, `Moonrise Revel`, `Brine Wake`, `Stilt Dance`, `Bloom Court`, `Lamp Count`, `Night of Names`, `Furnace Night`), scheduled per culture via `(day + offset(c, salt)) % 10 == 0` with 5 moods (`Somber..Ecstatic`).
     - `src/campaign/Happening.cpp:35–48`: 12 actual Happenings (3 per nation: `Royal Levy`, `Succession Quarrel`, `Bumper Harvest`, `Grudge Oath`, `Cave-In`, `Deep Vein`, `Dry Year`, `Water Court`, `Glass Storm`, `Long Twilight`, `Elder's Sleep`, `Seedfall`).

8. **`splintered-ford-situations` (`wikiContent.ts` L9073, L9090–9095) — Actor loss and branch rewards inaccurate**
   - **Wiki claims:** Killing the captain/diplomat immediately fails the whole Situation with `Cause::ActorLost`; `GroveClosed` awards "50 Root boons"; `Caravan`/`GroveClosed`/`Shared` list "150/180/100 coin" and "+60 standing with both".
   - **Actual `src/`:** `src/campaign/Situation.cpp:30–32, 74–85`: `lose()` settles only the linked unit (`Pass`/`Claim` become `Resolved`, only `Strand` becomes `Failed`). `src/campaign/Ford.cpp:48–50`: `GOLD = {0,250,300,200,0}`, `COIN = {0,150,180,100,0}` (Coinroad standing), `ROOT = {0,50,0,100,0}` (Rootsworn standing).

9. **`bastion-flow-defense-inquisition` (`wikiContent.ts` L9440, L9453–9462) — Purge gold and Curio effects wrong**
   - **Wiki claims:** Purging a den pays flat "150 purge gold"; `Curio::Mend` restores "100% weapon durability"; `Swarm` summons defensive hornets; `Curse` triples magic find.
   - **Actual `src/`:** `src/campaign/CampaignSynod.cpp:115` pays `PURGE_GOLD * act * (member() ? 2 : 1)` (`150 * act`, doubled for Synod members). `src/campaign/Curio.cpp:39–52`: `Mend` heals HP (no weapon durability exists), `Swarm` summons restless dead against you, `Curse` inflicts an affliction (negative, no magic find).

10. **`campaign-fact-ledger` (`wikiContent.ts` L7810–7841) — Source indices are per-fact, not 4 universal types**
    - **Wiki claims:** `source[fact]` indices `0..3` are 4 fixed categories (`Archaeological Tablets`, `Tavern Whispers`, `Intercepted Military Dispatches`, `Clan Elders`).
    - **Actual `src/`:** `src/campaign/Facts.hpp:14–17` & `Facts.cpp:11–18, 31–36`: each `facts::Def` specifies its own `std::array<const char *, 4> sources` of per-fact named source keys.

11. **`campaign-quest-flow` (`wikiContent.ts` L7625, L7679) — Wrong Act V boss name & objective enum**
    - **Wiki claims:** Act V is against "the Prioress and the Synod King"; lists `O::Survive`.
    - **Actual `src/`:** `src/campaign/Quests.cpp:191–194` names the **Cinder King**; `src/campaign/Quests.hpp:13` defines `Objective::Defend`.

12. **`campaign-experience` (`wikiContent.ts` L7310, L7349–7353) — Fabricated `RECOVERY_RATE` and missing `DEPTH_XP`**
    - **Wiki claims:** Recovery uses `elapsed * RECOVERY_RATE`; omits `DEPTH_XP` from `worth()`.
    - **Actual `src/`:** `src/hero/Experience.cpp:91, 160` recovers at `1.0`/day (`day - f.day`, no `RECOVERY_RATE` constant) and multiplies `worth()` by `Level::DEPTH_XP[layer]`.

13. **`campaign-farming` (`wikiContent.ts` L6656–6696) — Fabricated growth formula, harvest behavior, and nonexistent unlocks**
    - **Wiki claims:** `growth()` multiplies by `(1 + WET_BOOST)`; `tend()` spills produce on the ground and calls `clearPlot()` (contradicting its own Mermaid chart at L6707); farming unlocks automated scarecrows and stone planters.
    - **Actual `src/`:** `src/campaign/Farm.cpp:79, 109–136`: `growth()` is `std::max(0.0f, day - f.sown) + f.bonus`; `tend()` adds directly to `p.materials`, doubles yield in a Rootsworn `grove()` (`+1` with `HarvestHome`), and resets `crop = -1, bonus = 0` while keeping the plot. No scarecrows or stone planters exist.

### 1.3 World, Terrain, Caves, Roads, Weather, Reactive Ground & Audio

14. **`biome-events-chart-hud` (`wikiContent.ts` L3945–3998) — Outdated biome count, bit layout, palette, and fabricated event names**
    - **Wiki claims:** `BIOME_COUNT = 26` (`Grassland`..`Void`, `Oasis`..`Caldera`); `Chart` uses bits `0..6` for `(BiomeId + 1)` indexing `BIOME_TINTS[26]`; cites nonexistent events (`FAIRY RING`, `OASIS BLOOM`, `SPRING THAW`, `GOLD RUSH`, `VOID RIFT`, `LOCUST SWARM`).
    - **Actual `src/`:** `src/level/biome/Biome.hpp:9–41` has `BIOME_COUNT = 30`; `src/level/BiomeEvents.hpp:20` & `BiomeEvents.cpp:35–164` define 30 `EVENTS` plus `HAZARDS` for the 7 boon-only biomes. `src/level/Chart.hpp:25` uses `NOW = 0x80`, `WATER = 0x40` (bit 6), and `BIOME = 0x3F` (bits `0..5`), and `Chart::tone()` (`Chart.cpp:54–59`) derives colors from `BIOMES[b]->debug`.

15. **`terrain-construction` (`wikiContent.ts` L3079, L3086–3089) — Wrong `Sites.cpp` cache size and `blendNode` algorithm**
    - **Wiki claims:** `Sites.cpp` uses `Slot cache[256]`; `blendNode` uses the 5×5 tent kernel `K[5] = {1,2,3,2,1}`.
    - **Actual `src/`:** `src/level/world/Sites.cpp:170–171, 216–217` uses `static Slot cache[4096]`. `src/level/world/Biomes.cpp:17, 104–150` uses the 5×5 tent kernel for `fieldNode` (`fieldMemo[64*64]`), while `blendNode` (`blendMemo[64*64]`) runs a domain-warped (`WARP = 7.0f`) `14×14` grid with per-biome-pair adaptive `Reaches` widths (`WIDE = 12.0f .. NARROW = 3.5f`).

16. **`caves-sundark` (`wikiContent.ts` L6096, L6108) — `CAVE_SHALLOW` removed; 25 cave biomes (not 16)**
    - **Wiki claims:** `CaveBiome` has 8 shallow + 8 deep regions separated by `CAVE_SHALLOW`.
    - **Actual `src/`:** `CAVE_SHALLOW` was removed. `src/level/biome/CaveBiome.hpp:8–59` defines **25** `CaveBiome`s classified by `CaveTier tier` (`Caves`, `Sundark`, `Delving`) and `guardian`/`keeper` fields.

17. **`roads-wayfinding-landmarks` (`wikiContent.ts` L8383–8530) — Wrong A\* constants, shrines, Wayfinding struct, Curiosities, and Morrigan pacts**
    - **Wiki claims:** `SAMPLES = 48` and fabricated cost weights; Mermaid chart includes Shrines in road survey; Wayfinding uses 48 px radius and fabricated `struct Sign` with 4 cardinals; "26 Overworld Curiosities" with 6 fabricated table rows; Morrigan shrines charge `EYE_COIN = 15 / FEATHER_COIN = 25 / TALON_COIN = 40` (contradicting its own Mermaid chart at L8531).
    - **Actual `src/`:**
      - `src/level/Roads.hpp:18` & `Roads.cpp:34–37, 98–142`: `SAMPLES = 32`, `BUDGET = 64`, `LINE = 3`, `AHEAD = 2`, `AREA = 120`, `SPAN = 12`; `important()` explicitly excludes `StructureKind::Shrine`.
      - `src/level/Wayfinding.hpp:8–17` & `Wayfinding.cpp:11–63`: `READ = 44` px, `struct Destination`, 8-direction `bearing()`.
      - `src/campaign/Oddity.hpp:17` & `Oddity.cpp:86–126`: **`KINDS = 30`** (includes 4 coast curiosities).
      - `src/campaign/Morrigan.cpp:64–96`: 3 wish-with-price offers (`wealth` + Synod scrutiny, `flesh` mutation + defect, `sight` unveil + affliction) with no coin cost.

18. **`weather-sky` (`wikiContent.ts` L1846, L1867–1911) — Wrong `Footprints` buffer/struct, front count, and diurnal clock**
    - **Wiki claims:** 256-slot `Footprint { x, y, angle, age, maxAge, isRight }` with `weatherDecayMultiplier` on mud/sand/water/snow; 4 weather fronts (including `Sand`); 24-hour trigonometric solar/lunar clock.
    - **Actual `src/`:** `src/level/sky/Footprints.hpp:13–18` & `Footprints.cpp:6–35`: **384-slot** `Print { float x, y, age; bool snow; }`, stamped only on snow or rain (`cover > 0.35f`), fixed 9 s fade on rain, no time decay on snow. `src/level/sky/Fronts.hpp:5` has **8** fronts (`Clear, Clouds, Rain, Storm, Snow, Fog, Dust, Ash`). `src/level/Night.cpp:32–57` alternates `dayLength`/`nightLength` with 20 s dusk / 150 s dawn ramps.

19. **`reactive-ground` (`wikiContent.ts` L6249, L6267, L6271) — Missing `Salt` & `Resin` states and sprite rendering**
    - **Wiki claims:** 9 `Stuff` states, 3 footing multipliers, and `Matter::render()` only draws translucent rectangles.
    - **Actual `src/`:** `src/level/Matter.hpp:10`, `LevelMatter.cpp:46–47, 150–160`, `Matter.cpp:31, 119–123`: **11** `Stuff` states (adding **`Salt`** `0.7x` pace, dissolves with Water; **`Resin`** `0.4x` pace, burns with Fire), and `Salt`/`Resin` render as atlas sprites (`atlasu::u2::SaltCrust`, `atlasu::u2::Resin`).

20. **`procedural-music-audio-engineering` (`wikiContent.ts` L9624–9708) & `audio-qa` (`wikiContent.ts` L2227–2262) — Contradictory mixer, `FoeVoice`, track loading, and RNG**
    - **Wiki claims:** `procedural-music-audio-engineering` claims `Sound::play(id, x, y, vol)` does inverse-square attenuation, constant-power stereo panning, and energy/cosine-ramp LRU voice stealing, and `FoeVoice.cpp` synthesizes voices at runtime with a 2-formant sawtooth filter. `audio-qa` claims 6 tracks decoded at init, 5 place beds, and pitch jitter using simulation `rng`.
    - **Actual `src/`:**
      - `src/audio/Sound.hpp:27–53` & `Sound.cpp:35–74, 126–155, 477–503`: 32 mono SDL3 streams with oldest-start-time replacement (`voiceStarted[pick]`), no spatialization/panning/cosine ramp; **12** music tracks decoded **lazily via `std::async`**; **11** biome ambience beds + **10** culture camp beds; pitch jitter uses a dedicated `thread_local Rng jitter{0x5EED50D5ull}` so playback never perturbs deterministic simulation `rng`.
      - `src/audio/FoeVoice.cpp:14–36`: maps `EnemyKind` to 6 pre-rendered WAV families (`Sound::foe[6][3]`) with linear falloff `1 - dist / 420`.

### 1.4 Core Engine, Rendering, Combat, Persistence, Math & Dev Tools

21. **`renderer-in-context` (`wikiContent.ts` L3199–3312) & `RendererPipelineInspector.tsx` (L46, L60, L98) — Wrong `LightField::MAX`, texture count, and render target size**
    - **Wiki claims:** `LightField::MAX = 16` (contradicting `overview` L169 and `radix-rendering` L326 which say 8); 7 `VK2DTexture` handles; `world` and `light` targets are `640×360`; no zoom or crisp GUI snap.
    - **Actual `src/`:** `src/level/LightField.hpp:12` has `MAX = 8`. `src/gfx/Screen.hpp:35–36` & `Screen.cpp:57–70, 95–100, 138–140` load **9** `VK2DTexture` handles (adding `alternate` and `achievements`), allocate `world`/`light` at **`3414×1920`** (`MAX_W/H * FARTHEST`), apply camera `zoom`, and support `crisp` integer-snap GUI scaling.

22. **`spatial-grid` (`wikiContent.ts` L1037–1259) & `SpatialGridVisualizer.tsx` (L396–397) — Wrong `GRID`, `CELL`, `SOLID_W×SOLID_H`, and `surfaces[]` Bit 5**
    - **Wiki claims:** `GRID = 64`, `CELL = 32` px (`4096` cells, `2048×2048`); `surfaces[]` is `128×72` (`9,216` bytes, 3-tile border); Bits `7..5` unused.
    - **Actual `src/`:** `src/level/Level.hpp:462–465`, `LevelRender.cpp:78–85`, `LevelSpace.cpp:263`: `GRID = 48`, `CELL = 28` px (**2,304 cells**, `1344×1344`); `SOLID_W × SOLID_H = 48 × 30` (**1,440 bytes**, 4-tile border); **Bit 5 (`32`) encodes `world::roped(x, y) << 5`** for Deep-layer cliff climbing.

23. **`workers-concurrency` (`wikiContent.ts` L919–936) — Wrong `Enemy::roll()` return type and nonexistent `spawnSpike`**
    - **Wiki claims:** `uint32_t Enemy::roll()` and deferred intent flag `e.spawnSpike = true`.
    - **Actual `src/`:** `src/entity/enemy/Enemy.hpp:168–171, 247` declares `float roll();`; no `spawnSpike` member exists (deferred flags are `rallies`, `pounced`, `wantsLeader`, `wantsFire`).

24. **`skill-web-dice-spells` (`wikiContent.ts` L8677) — `Verdant Ward` shield mechanic wrong**
    - **Wiki claims:** Grants a "2-hit physical barrier that blocks incoming projectile strikes completely."
    - **Actual `src/`:** `src/item/skill/DiceSpells.cpp:134` calls `caster.shield(2)`, which on `Player` (`src/entity/Player.hpp:91`) grants **2 seconds of invulnerability** (`invuln = std::max(invuln, seconds)`).

25. **`persistence-codex-balance` (`wikiContent.ts` L3494) — Achievement count & bitfield contradiction**
    - **Wiki claims:** `FEATS` has 64 achievements in a single 64-bit field with `static_assert(... <= 64)` (contradicting `navigation.ts` L295 which says `112 Feats`).
    - **Actual `src/`:** `src/meta/Feats.cpp:71–198` has **112** feats (`static_assert(... <= 128)`) stored in **`uint64_t feats, feats2`** (`src/meta/Codex.hpp:17–21`, `Codex.cpp:56–101`) alongside `uint64_t wielded` (`version 2`).

26. **`doteshi-content-kit-lint` (`wikiContent.ts` L8289–8345) — `.rows` format, Doteshi snippet, and `lint_baseline.txt` are wrong**
    - **Wiki claims:** `.rows` files (`010-n02.rows`) are pipe-delimited weapon stat tables parsed at runtime by `Kit.cpp`; fabricates `draw_runic_claymore()` in `tools/doteshi_assets.py` and fake `doteshi.lock.json` pointing to `res/sprites/weapons.png`; attributes `tools/lint_baseline.txt` to clang-tidy.
    - **Actual `src/` & `tools/`:** `.rows` files are **compile-time C++ aggregate initializers `#include`d into `kit::EXCHANGES[]`** (`src/content/Kit.cpp:33–55`, `010-n02.rows`) for NPC dialogue exchanges. Doteshi is vendored in `tools/doteshi/`, recipes live in `tools/source/doteshi/content/*.py` with `manifest.toml` and `doteshi.lock.json` cell hashes for `res/atlas.png`. `tools/lint_baseline.txt` (`tools/lint.py:15–16`) is for the opt-in `--style` checker, not clang-tidy.

27. **`tutorial-testing-profiling` (`wikiContent.ts` L2994–3023) — Nonexistent `test/Test.hpp` and `test_assert`**
    - **Wiki claims:** Example includes `#include "test/Test.hpp"`, calls `test_assert(...)`, and diagram says "27 Deterministic Gameplay Suites".
    - **Actual `src/`:** `src/test/Test.cpp:1–319` & `src/test/Tests.hpp`: neither `test/Test.hpp` nor `test_assert` exists; tests declare prototypes in `Tests.hpp`, register in `CASES[]` (**233** test cases), and use standard `<cassert>` `assert(...)`.

28. **`math-strings-benchmarks` (`wikiContent.ts` L8035–8044, L8213–8222) — `BigInteger`/`BigFloat` are unused in gameplay**
    - **Wiki claims:** `BigInteger` and `BigFloat` actively drive economic updates and ledger balances every frame, and shows a non-CSV custom benchmark table.
    - **Actual `src/`:** `src/Math.hpp:14, 62` explicitly comment `// Unused for now, but may be useful in the future for large numbers.` They are only exercised by `MathTest.cpp` and `MathBenchmark.cpp` (which outputs CSV).

29. **`overview` (`wikiContent.ts` L122) — `String.hpp` header claim**
    - **Wiki claims:** `src/String.hpp` has "zero STL header bloat".
    - **Actual `src/`:** `src/String.hpp:3–23` includes `<algorithm>`, `<filesystem>`, `<functional>`, `<iterator>`, `<ostream>`, `<stdexcept>`, `<string>`, `<string_view>`, `<vector>`, and `<spdlog/fmt/fmt.h>`.

30. **`plan-and-todo` (`wikiContent.ts` L7964) — Nonexistent file path**
    - **Wiki claims:** `32-Voice LRU Audio Mixer (src/audio/AudioMixer.cpp)`.
    - **Actual `src/`:** `src/audio/` has only `Sound.hpp/cpp` and `FoeVoice.hpp/cpp` (no `AudioMixer.cpp`).

31. **`contribute-basics` (`wikiContent.ts` L2299, L2325) — Stale root `NOTES.md` reference**
    - **Wiki claims:** Directs contributors to root `NOTES.md`.
    - **Actual repo:** Root `NOTES.md` is absent/stale; `CLAUDE.md:7–9` points to `extern/notes/NOTES.md` and `extern/notes/NOTES-INDEX.md`.

---

## 2. Outdated Counts, Names, Keys & Component Drift

| Wiki Location | Wiki Claim | Actual `src/` |
| --- | --- | --- |
| `input-controls` L6031, `persistence-codex-balance` L3527 | 18 keyboard rows, 9 gamepad rows | `src/input/Input.hpp:19, 27`: **`BINDING_COUNT = 23`**, **`PAD_COUNT = 10`** (`GIFT`, `CHARACTER`, `QUEST LOG`, `COOK`, `CHOICES` added) |
| `navigation.ts` L123, `goal-ai` L1326, `goal-steering-catalog` L3687–3775 | 16 AI Goals, 39-Monster Plan Table, 19 `Falter` interrupts | `src/entity/enemy/ai/`: **19** `Goal` subclasses (+`Guard`, `Totem`, `Leap`); `Plans.cpp:82–203`: **119** `PLANS[]`; **62** plans attach `&FALTER` |
| `navigation.ts` L181, `biome-events-chart-hud` L3945 | 26 BiomeEvents | `src/level/biome/Biome.hpp:41`: **30** biomes (`BIOME_COUNT = 30`) |
| `navigation.ts` L189, `roads-wayfinding-landmarks` L8383 | 26 Overworld Curiosities | `src/campaign/Oddity.hpp:17`: **30** (`KINDS = BIOME_COUNT`, +4 coast curiosities) |
| `world-generation` L1595–1599 | Lists `Blossom` twice, omits `Starfall` | `src/level/biome/Biome.hpp:9–41`: one `BIOME_BLOSSOM`, includes `BIOME_STARFALL` (25) |
| `diablo-loot-runrules` L3862, L3868 | 25 campaignOnly bases, 15 campaign relics, 31 affixes | `ItemBase.cpp:65–90`: **26** `campaignOnly` bases; `Unique.cpp`: **17** `Mode::Campaign` relics; `Affix.cpp:20–143`: **`AFFIX_COUNT = 49`** (31 ordinary + 18 faction kin) |
| `weapon-synthesis` L2033 | 82 evolutions | `src/item/Upgrade.cpp:62–143`: **81** `EVOLUTIONS` entries |
| `campaign-standing` L7405–7483 | 13 factions, "The High Synod", missing 3 lineage modifiers | `Faction.hpp:8–33`: **19** factions (`"LANTERN SYNOD"` in `Faction.cpp:146`); `Standing.cpp:27–33` adds `BarrowHost (-100)` for Hale and `Silverbough (+150)`/`Sandwells (+100)` for Changeling |
| `contribute-basics` L2316 | 4 `KINDS[]` (`resource`, `fact`, `person`, `exchange`) | `src/content/Kinds.cpp:241–259`: **6** `KINDS[]` (+`formula` `f.*`, `piece` `p.*`) |
| `tutorial-testing-profiling` L3023 | 27 test suites | `src/test/Test.cpp:84–319`: **233** `CASES[]` test cases |
| `classes-encounters` L2111, L2168 | `Enemy.cpp:380–385`, `Landmarks.cpp` | `src/entity/enemy/Enemy.cpp:388–393`; `src/level/structure/Landmarks.cpp` & `src/level/encounter/Landmarks.cpp` |
| `navigation.ts` L222 | "32-Voice LRU Audio Mixer" | `src/audio/Sound.cpp:481–503` uses oldest-start-time replacement, not LRU |
| `RendererPipelineInspector.tsx` L46, L60, L98 | `LightField::MAX = 16`, `world` `640×360` | `LightField::MAX = 8`; `world` `3414×1920` (`FARTHEST`) |
| `SpatialGridVisualizer.tsx` L396–397 | `surfaces[]` Bit 5 `Unused` | `LevelRender.cpp:85`: Bit 5 = `world::roped(x, y) << 5` |

---

## 3. Undocumented Features & Post-Sync Systems (`0.7.5`, `0.7.6`, `Unreleased`)

### 3.1 Live Campaign UI, Input & Quickbar
1. **Non-pausing live campaign panels (`LV1`):** `Menu::live()` across 20 menus, `Game::livePanel()`, `input.hush()`, WASD movement while arrow keys/D-pad drive `navUp..navRight`, red-edge hit flash, and station-range auto-close (`Menu::away`). (`src/Game.cpp:252–260`, `src/menu/Menu.hpp:19–25`, `src/input/Input.cpp:247–250`)
2. **One docked 7-tab Campaign Panel (`PK1`):** `Panel` (`src/gui/Panel.hpp/cpp`) docks right at `46%` width (`>= 1200` px) with `camera.panGoal = 0.23f` (full-screen below 1200 px), hosting `Pack`, `Make`, `Character`, `Tree`, `Quest`, `Codex`, and `Settings` tabs, cycled with `Tab`/`Shift+Tab` and `LB`/`RB`.
3. **Pack tab, Materials Ledger, 4-Slot Quickbar & Raw Food Eating (`PK2` + working tree):** `InventoryMenu(game, true)` (`src/menu/InventoryMenu.cpp:170–229, 459–520`) adds 7 material filter chips and a saved 4-slot quickbar (`src/gui/PanelQuick.cpp`, keys `1–4`). Uncommitted `src/campaign/Cookery.hpp` + `src/campaign/Foods.cpp` add a 17-entry `FOODS[]` catalog (`Taste`, `Raw::No/Safe/Risky`, method flags) and `cookery::eat()` (5% maxHp heal, 1/3 chance of 60 s `queasy` at `0.9x` speed on risky raw foods).
4. **Live docked Stash & Vendor columns (`PK2`):** `StashMenu` and `VendorMenu` dock into `Panel::rect(s)` with drag, right-click single transfer, and `Shift`+click transfer-all of same base.
5. **Queued Choice Badge (`LV2`):** Campaign level-up, boon, and night-offering cards queue in `Game::choices()` behind a pulsing gold badge (`src/gui/HudButtons.cpp:70–114`) opened via `U` (`CHOICES`), pad `Start`, or click (`Game::choose()`).
6. **Bottom 8-button HUD bar & new defaults (`PK0`):** `I` Inventory, `C` Character, `T` Skill Tree, `L` Quest Log, `M` Map, `B` Build, `K` Cook, `O` Settings, `N` Codex, `U` Choices; `MUTE` unbound by default; `KEYS 2` file header; `5–8` / `LB`+D-pad for d20 Dice Spells; `--dev`-only mouse wheel zoom (`src/gui/HudButtons.cpp`, `src/input/Input.cpp`).

### 3.2 Dialogue, Talkers, Naming & Guides
7. **Talk to Anyone (`role:anyone`), Cultural Naming & 56 Culture Exchanges (`O9.D2`):** Deterministic naming across 6 cultural styles (`src/entity/Names.cpp`), 56 culture exchanges in `050-cultures.rows` (84 total exchanges), calm strangers answer who they are / what is near / culture lines.
8. **"Lead me there" Guide System:** Option 3 (`src/level/Guide.hpp/cpp`) gives verbal directions at `Service::Directions` or physically walks the hero to a Seat/Camp/Landmark at `Service::Walk` (`Revered`).
9. **Nearest-wins single talk prompt (`DLG2b`/`DLG2c`):** 16-row `Talkers` table (`src/campaign/Talkers.hpp/cpp`) ensures only the nearest eligible talker displays its plate while errands stay attached to their host.
10. **Walking NPCs hold still & face player (`DLG1`):** `Level::hold()` (`src/level/Talk.cpp`) pauses calm walking townsfolk and strangers while talking.
11. **Elder Maren in talk panel (`N04a`) & 3-option talk paging:** `Hamlet.cpp:1206–1296` moves Elder Maren out of the quest page and pages talk choices 3 at a time via `"Something else"`.

### 3.3 Factions, Chiefs, Ranks & Campaign Storylines
12. **Half-weight body reaction (`O9.S3`) & Unified Standing Access Table (`O9.S2`):** `regard::of(l, f) = rep + react / 2` (`src/hero/Regard.hpp/cpp`), 14-service `ACCESS[]` table (`src/campaign/Standing.cpp:116–149`), camp prompt reaction subline (`HudCampaign.cpp`), and once-per-day betrayal warnings for `ChoirTeeth` chant and watched gifts (`Regard.cpp:166–182`, `Gift.cpp:133–157`).
13. **Four Faction Chiefs & Ranks 1–4 (`O9.B2`/`O9.B3`):** Hask Corrinsworn, Ismer Tallyhand, Old Ashvine, Veyra Driftmother with custom sprites (`atlasf::chief`), 20 rank definitions (`src/campaign/Rank.cpp`), deeds, gold/ally/boon rewards, rival `politics::mend` shifts, and `W::Rank`/`W::Deed`/`T::Rank` kit ops (`060-chiefs.rows`).
14. **Kettlestaithe Hamlet (`Q06a/b`):** Act II overlay situation `h1.staithe` (`src/campaign/Hamlet.cpp`, `020-kettlestaithe.rows`), 5 outcomes (`Sluiced`, `Tided`, `Leated`, `Opened`, `Lapsed`), 6 villagers with persistent `PeopleState`.
15. **Saltmoor Tidemarket (`Q06b2`):** `src/campaign/Quarter.cpp` + `030-tidemarket.rows`: Iven Vale (dynamic trader), Sister Keva (daily Synod scrutiny fee), Nera Voss (dusk boat), and displaced Odo Rusk.
16. **The Unsigned Tablets (`C12.2a`), 3 Act I Faction Commissions (`C06b`) & 10 Culture Sagas (`O8.B4b`):** `Tablets.cpp` (restored founder), `Commission.cpp` (`OpenLedger`, `ScorchedAcre`, `PaidInFull`), `Saga.cpp` (30 chapters, 10 boons, Codex Sagas page).
17. **Quest `WHAT CHANGED` Annals (`C09`) & Cinder King Hall 3 Peaceful Routes (`C07`):** `SituationHistory.cpp` tracks outcomes across Nightmares; `CampaignPeace.cpp:128–198` lists `Parley`, `Quench`, and `Turn` with explicit closed reasons.
18. **Culture Standards, Ring Camp Pieces, 6 Banner Cultures & Color Shifts (`O8.V1/V2/F1`):** `CultureLook.hpp`, `LevelRender.cpp:125–150`, `Faction.cpp:159`, `Group.cpp:185–194`.

### 3.4 Living Biomes, Caves, Roads, Harvesting & Audio
19. **Living Biomes (`O11.5`–`O11.9`):** 7 boon-only biomes alternating `HAZARDS` (`BiomeEvents.cpp:115–164`), 2 ground decals per surface biome (`Ground.cpp`), 30 once/day usable biome structures with spent sprites (`Sites.cpp`), 1 secret per 48-tile cell with decal tells (`Secrets.cpp`), draw-only critters (`Critters.cpp`, max 3/screen), 4 coast curiosities (`Oddity.cpp`).
20. **8 New Cave/Sundark Sub-Biomes, Environmental Mechanics, Tremor Reactions & Cave Rites (`U2.5`):** `Brinewell`, `Shardfall`, `Ashvein`, `Amberseep`, `DrownedArchive`, `Rootheart`, `Mirrorhall`, `HollowForge` (`CaveBiome.cpp`, `CaveRules.cpp:192–435`, `CampaignPeace.cpp:35–52`).
21. **RW1/RW2 Road Planner:** Gabriel/lune natural neighbour hubs, `AHEAD = 2` ring planning + synchronous `warm()`, whole-edge reveal (`complete()`/`reveal()`), `LINE = 3` line-following penalty, spurs joining existing highways (`Roads.cpp:237–456`).
22. **Unified `SOURCES[]` Harvesting & Carcasses (`IT1`):** 37-row `SOURCES[]` table (`src/campaign/Sources.cpp`), 6 verbs (`Pick, Shake, Dig, Fish, Butcher, Open`), optional tool bonuses (`Knife, Spade, Rod, Basket`), fishing bobber/bite tell, 13 beast `Carcass` drops (cap 6, 30 s).
23. **Expanded Audio & Music (`O11.8`, `O8.S1/S2`):** 6 new biome ambience beds (11 total), 5 day music moods with 20 s hold (`Game::conduct`), Zoktor dialogue music, 10 culture camp beds, daily greet/rite cues, and festival mood music swap (`Sound.cpp`, `Revels.cpp`).

### 3.5 Platform, Persistence, Lore, Combat & Engine Internals
24. **`data.pak` Encrypted Archive (`src/meta/Pak.cpp`):** `MLPK` v1 ChaCha20 encrypted resource pack (`--pack <dir>`), 16,384-round key stretching, loose `res/` dev fallback.
25. **Per-Campaign `lore::Book` (`CX1`) & 4 Campaign Codex Pages:** `src/campaign/Lore.cpp` (8 tables, `SEEN`/`HANDLED`/`KNOWN`, pins, saved as `lore`/`pin`) + Codex Founders, Rune Words, Sagas, and Factions pages (`CodexMenu.cpp`).
26. **Modular Sidecar Language Directories & Split Atlas Headers:** `res/lang/<name>/*.txt` loaded via `pak::list()` (`Game.cpp:879–904`); `src/AtlasB.hpp` and `src/AtlasU.hpp`.
27. **Test CLI Filters, Stable Keys & `--content-report`:** `--test <filter>`, `--test-list`, `--test-times` (`Test.cpp:321–396`); `f.*` / `p.*` stable keys (`Recipes.cpp`, `Harvest.cpp`); `build/content/` Markdown & German glossary audit (`Report.cpp`).
28. **Engine/Combat Details:** Underground `rock[]` AABB collision & 0.25 s BFS `flow[]` (`LevelSpace.cpp:100–222`); `Mutation` `Pool`/`Seen`/`Body` tags + 6 pilot gifts (`Mutation.hpp`, `Gift.cpp`); `StringRead.hpp`; loner grudge fix (`Aggro.cpp:47–61`); stowed thorns fix (`Enemy.cpp:434–435`); unique weapon veiled-rune tooltip reveal (`Tooltip.cpp:82–124`).

---

## 4. Chapter-by-Chapter Sync Checklist

| Wiki Chapter / File | Priority | Main Fixes Needed |
| --- | --- | --- |
| `gems-and-sockets` | High | Replace fabricated gem/grade names & slot mapping with `Jewel.cpp` |
| `runes-and-words` | High | Replace fabricated rune names/formulas, remove `known()` gate, fix `shatter()` |
| `doteshi-content-kit-lint` | High | Fix `.rows` (compile-time C++ exchanges), vendored `tools/doteshi/`, `--style` baseline |
| `campaign-standing` | High | Fix `WARY = 250`, 6 bands, `/4000` contagion, 19 factions; add `O9.S2/S3`, Chiefs & Ranks 1–4 |
| `procedural-music-audio-engineering` & `audio-qa` | High | Remove fabricated spatial/formant claims; document 12 lazy tracks, 11 biome + 10 camp beds, dedicated jitter RNG |
| `economies-festivals-happenings` & `nations-realms-diplomacy` | High | Replace fabricated economy/festival/happening/Voronoi/voices details; add 6 banners, culture looks & color shifts |
| `roads-wayfinding-landmarks` | High | Fix `SAMPLES = 32`, exclude shrines, fix `Wayfinding`/Morrigan/`Oddity` (30); add RW1/RW2 planner |
| `caves-sundark` | High | Remove `CAVE_SHALLOW`; add 8 new sub-biomes, environmental rules, tremor reactions & cave rites |
| `biome-events-chart-hud` & `world-generation` | High | Update 26 → 30 biomes, `Chart` bit layout, 7 `HAZARDS`; add decals, sites, secrets, critters; fix `Blossom`/`Starfall` |
| `campaign-cookery` | High | Fix `MEAL_LIFE`, `RACK_REACH`, `GUEST_SEAT`, `GIFT_GOLD`; add `Foods.cpp` raw eating & quickbar |
| `input-controls` & **new UI/Panel chapter** | High | Update 23/10 bindings, `PK0`–`PK2`, `LV1`/`LV2` live docked 7-tab panel, choice badge, WASD vs arrows |
| `spatial-grid` & `SpatialGridVisualizer.tsx` | High | Fix `GRID=48`, `CELL=28`, `48×30` `surfaces[]`, Bit 5 `roped`; add underground `rock[]`/`flow[]` |
| `renderer-in-context` & `RendererPipelineInspector.tsx` | High | Fix `LightField::MAX=8`, 9 textures, `3414×1920` `FARTHEST` targets, zoom & crisp GUI |
| `persistence-codex-balance` & `menu-language` | Medium | Fix 112 feats (`feats`/`feats2`); add `data.pak`, `lore::Book`, 4 campaign Codex pages, `res/lang/<name>/` |
| `campaign-quest-flow`, `splintered-ford-situations`, `campaign-fact-ledger` | Medium | Fix Cinder King, `Defend`, `lose()`, Ford standing, per-fact sources; add Kettlestaithe, Tidemarket, Tablets, Commissions, Sagas, `Talkers`, `Guide`, `WHAT CHANGED`, 3 King hall routes |
| `campaign-farming` & **new Harvesting (`Sources`) section** | Medium | Fix `growth()`/`tend()`, remove scarecrows; document `SOURCES[]` verbs, tools, fishing & carcasses |
| `goal-steering-catalog`, `goal-ai`, `navigation.ts` | Medium | Update 19 goals, 119 plans, 62 `Falter`, 30 biomes/curiosities, oldest-start audio mixer |
| `weather-sky` & `reactive-ground` | Medium | Fix 384 `Footprints`, 8 fronts, diurnal ramps; add `Salt`/`Resin` & sprite rendering |
| `bastion-flow-defense-inquisition`, `mutations-afflictions`, `campaign-experience` | Medium | Fix purge gold & Curio effects; add `Mutation` pools/body tags/`Gift.cpp`; fix `Experience` recovery & `DEPTH_XP` |
| `tutorial-testing-profiling`, `contribute-basics`, `crafting-workbench` | Medium | Fix `Test.hpp`/`test_assert`, 233 tests, `--test` filters, 6 `KINDS[]`, `f.*`/`p.*`, `--pack`, `AtlasB`/`AtlasU` |
| `skill-web-dice-spells`, `diablo-loot-runrules`, `paper-doll-gear-combat`, `weapon-synthesis` | Low | Fix `Verdant Ward` (2 s invuln), 5–8 keys, 26/17/49 loot counts, 81 evolutions, implant rules, veiled uniques, stowed thorns |
| `math-strings-benchmarks`, `overview`, `workers-concurrency`, `terrain-construction`, `plan-and-todo` | Low | Note `BigInt`/`BigFloat` unused, `String.hpp` STL headers, `StringRead.hpp`, `float roll()`/no `spawnSpike`, `cache[4096]`/`blendNode`, remove `AudioMixer.cpp` |
