# Game Plan: a Populous-style world builder

## 1. The core idea

You are a deity. You never control people directly. Instead you **reshape the
land**, and your followers decide on their own where to settle. Flat land means
bigger settlements. Bigger settlements mean more followers. More followers
means more **territory** where you can shape the land, and more **worship**,
which powers your miracles. A rival deity is doing the same thing on the same
map. You win when their followers are gone.

There is no abstract "mana" number. Your power is something you can **see on
the map**: the land your people live on, and the temples where they pray.

### The core loop

```
 shape land in your territory ──► followers settle & grow
          ▲                                │
          │                                ▼
   territory expands ◄──── bigger settlements + temples
                                           │
                                           ▼
                            worship charges miracles ──► strike the rival god
```

Everything in the game should feed this loop. If a feature doesn't make the
loop more interesting, leave it for later.

## 2. Gameplay systems

### 2.1 Terrain

- The world is a grid of **height values stored on the corners (vertices)** of
  the tiles, the way the original game did it. A tile is *flat* when all four
  of its corners are the same height.
- **Slope rule:** neighbouring vertices may differ by at most 1 height step.
  Raising a vertex drags up any neighbours that would break that rule, and
  those drag up their own neighbours. Lowering works the same way in reverse.
  This is what gives Populous its pyramid-shaped hills, and it makes a single
  click feel powerful.
- **Sea level** is height 0. Tiles at or below it are water. Followers who end
  up in water drown.
- Terrain types can be added on top later (grass, rock, swamp, lava, snow).
  Rock can't be built on, swamp kills walkers, and so on.
- The grid is what the **simulation** uses. What you **see** is a low-poly 3D
  landscape built directly from it (see section 4).

### 2.2 Followers (walkers)

- Walkers wander around looking for **unoccupied flat land**. When they find
  some, they build a settlement on it.
- If a walker meets an enemy walker, they fight. The stronger one wins, based
  on how many people each one is carrying.
- If a walker meets a friendly walker, they merge into one stronger walker
  (optional, but it simplifies the simulation).

### 2.3 Settlements

- A settlement's **size tier depends on how much flat land surrounds it**:
  tent → hut → cottage → house → manor → castle. More flat land gives a bigger
  building and a higher population cap.
- Population grows over time. Once a settlement is full, it **sends out a new
  walker** to settle somewhere else. This is how your civilisation spreads.
- If the flat land around a settlement gets destroyed (someone raises the
  terrain under it, or an earthquake hits), the building shrinks or collapses
  and its people come out as walkers.

### 2.4 Your power: Territory and Worship (replaces mana)

The original game had one mana number that paid for everything. Here that job
is split into two things you can see and understand in the game world.

**Territory: where you can shape the land**
- Every settlement claims the land around it. Bigger settlements claim a wider
  area. Your territory shows as a softly glowing border in your tribe's colour.
- **You can reshape land freely, but only inside your own territory.** Raising
  and lowering has no cost. The limit is *where* you can do it.
- To reshape land near the enemy, you have to expand toward them, or send your
  Prophet there (see 2.5).
- Territory is contested: where your borders overlap with the enemy's, the
  larger nearby settlement wins control of that land.
- Why this works better than mana: expanding is its own reward, the
  frontline is visible, and it matches what you'd expect a god to be able to
  do (you have power where people believe in you).

**Worship: what powers your miracles**
- Followers can build **shrines**, which later grow into **temples**. Each
  follower living near one adds to your worship.
- Every miracle has its **own charge meter**, and worship fills them. Stronger
  miracles charge more slowly and need a bigger temple to unlock.
- **A real choice:** you can call followers to the temple to pray. That charges
  your miracles much faster, but while they pray, your people aren't growing
  or spreading.
- Visually, worship is streams of light rising from the temples into the sky,
  so you can see at a glance which god is stronger.

### 2.5 The Prophet (leader and rally point)

- You place a **rally point** (a totem) on the map. The first walker to touch
  it becomes your **Prophet**.
- The Prophet carries **a small bubble of your territory** wherever they go.
  That lets you reshape land and cast miracles deep in enemy land, but only by
  risking them.
- You can order all walkers to *settle*, *gather at the Prophet*, or *fight*.
- If the Prophet dies, a new one can be chosen after a delay. Losing them is
  costly but not game over.

### 2.6 Miracles

Miracles are cast inside your territory or near your Prophet.

| Miracle     | Effect                                                           | Needs                  |
|-------------|------------------------------------------------------------------|------------------------|
| Earthquake  | Randomly scrambles the heights in an area, wrecking flat land    | Shrine                 |
| Swamp       | Turns tiles into swamp that swallows walkers                     | Shrine                 |
| Knight      | Turns your Prophet into a hero who hunts enemy settlements       | Small temple           |
| Volcano     | Raises a huge mountain and scatters rocks that can't be built on | Large temple           |
| Flood       | Lowers the whole world by 1, drowning the lowlands               | Great temple           |
| Armageddon  | Everyone leaves their homes and fights to the death at the centre | Great temple, full charge |

### 2.7 The rival deity (AI)

- The AI plays by **the same rules as you**: the same territory limits and the
  same worship. It doesn't cheat. Its difficulty comes from how fast it reacts
  and how smart it is.
- Simple priority-based behaviour works well here:
  1. Flatten land inside its territory, next to its settlements.
  2. Build shrines and temples once it has enough people.
  3. Cast a miracle once one is charged and a good target is in range (the
     densest cluster of enemy buildings, for example).
  4. Push its Prophet toward the player once it's ahead.
- Difficulty settings change how often it acts, how well it picks targets, and
  which miracles it's allowed to use.

### 2.8 Win, lose, and progression

- **Win:** the enemy has no walkers and no settlements left. **Lose:** the
  same happens to you.
- A **campaign of worlds**. Each world has its own map seed, theme (green
  islands, desert, snow, volcanic), enemy AI level, and set of allowed
  miracles.

## 3. Technical approach

### 3.1 Stack: plain JavaScript + Three.js in the browser

This is a hobby project, not a commercial one, so we use the simplest stack
that still looks great:

- **JavaScript** (ES modules), no engine, nothing to install to play.
- **Three.js** for 3D rendering: lighting, soft shadows, fog, water, and
  thousands of animated objects. It's more than enough for a charming
  low-poly world.
- **Vite** as the dev server once the game outgrows one file. Save a file and
  the browser reloads instantly.
- **Vitest** for a handful of tests on the game rules (the slope rule, for
  example).

Is JavaScript too limiting? **No, not for this game.** Populous is a
simulation of a small grid and a few hundred people, and a browser handles
that easily. The only limit is photorealistic, AAA-style graphics, which we
aren't aiming for.

A working proof is in [`prototype/index.html`](../prototype/index.html). Open
it in a browser to sculpt an island and watch villagers settle the flat land.
It's about 1,000 lines of plain JavaScript with no art files.

### 3.2 Architecture

Keep the **simulation** separate from the **drawing code**. That keeps the
rules easy to test and change.

```
index.html
src/
  sim/                # pure game logic: no Three.js, no DOM
    world.js          # heightmap grid, sea level, terrain types
    terrain.js        # raise/lower with slope rule, flatness queries
    territory.js      # who controls each tile
    walkers.js        # wandering, settling, combat
    settlements.js    # size tiers, growth, spawning walkers
    worship.js        # temples, prayer, miracle charge meters
    miracles.js
    ai.js             # rival deity
    rng.js            # seeded random numbers
    game.js           # owns the state, advances one fixed tick at a time
  view/               # Three.js: reads sim state, never changes it
    terrainMesh.js
    water.js
    props.js          # trees, rocks, buildings
    villagers.js
    effects.js        # miracle particles, camera shake
    camera.js
  ui/                 # HTML overlay: miracle buttons, population bars
  main.js
```

Principles (all cheap to follow from the start):
- **Fixed-tick simulation** (for example 10 ticks per second). The visuals
  animate smoothly in between.
- **Seeded random numbers**, so the same seed always gives the same world.
  That helps with bugs and with sharing worlds.
- **Player and AI use the same commands** (`raise(x, z)`,
  `castMiracle(type, x, z)`).

## 4. Visual style

A **detailed, stylised miniature world**, generated entirely in code:

- **Terrain:** a shader paints the land by height, slope and season: grass,
  earth, rock, snow, beaches, crop fields, pastures, cobbled streets, lava and
  basalt, and earthquake cracks.
- **Architecture:** every building is assembled from dozens to hundreds of
  primitives: timber framing, shuttered windows with flower boxes, dormers,
  chimneys with smoke, stepped brick gables, shop awnings, a columned temple
  with a painted pediment, a clock-tower town hall with a fountain and market,
  and a domed cathedral with bell towers. New buildings rise behind
  scaffolding.
- **Seasons:** every material responds. Trees blossom, turn gold and red,
  then go bare. Fields sprout, ripen and are harvested. Snow settles on land
  and roofs, ice forms at the shore, and the light changes colour.
- **Weather and disasters:** snowfall, rainstorms with whitecaps, erupting
  volcanoes with lava bombs and ash, tornadoes with debris, and camera shake.
- **Post-processing:** ambient occlusion, bloom and filmic tone mapping (the
  Fast graphics setting turns off the most expensive parts).

## 5. Roadmap

**Done**
- M0 Prototype: slope-rule terrain, sculpting, water, villagers.
- M1 Proper project: Vite, modules, tests, single-file build.
- M2 Settlements that grow: hut → cottage → manor, townhouses and keeps.
- Ages of civilisation (Agrarian → City) with landmarks: shrine, windmill,
  temple, town centre, cathedral.
- Farms with crop fields and fenced livestock while agrarian; streets in towns.
- Seasons, weather and natural disasters (earthquake, volcano, tornado, flood).
- A rival tribe whose AI god shapes land for it.
- Tribe conflict: battles with gear that improves each age, sieges that
  capture buildings, militia, arrow towers, rally flag with Settle, Gather
  and Attack commands, Leaders, a rival war AI (Peaceful, Normal or
  Aggressive), and victory or defeat.

**Next**
- **Worship and territory** (section 2.4): temples generate worship that
  charges miracles, and sculpting is limited to your territory.
- A campaign of islands with rising difficulty.
- Sound and music.

## 6. Open questions

1. **Territory and worship:** does this feel better than mana (section 2.4)?
   Disasters are currently free to cast while this is decided.
2. **Rules:** a close homage to Populous, or add our own twists?
3. **Controls:** is left-click to raise and right-click to lower OK, or
   would you prefer the original's overhead-map feel?
