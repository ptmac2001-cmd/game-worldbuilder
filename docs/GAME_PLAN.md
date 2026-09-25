# Game Plan: a Populous-style world builder

## 1. The core idea

You are a deity. You never control people directly. Instead you **reshape the
land**, and your followers decide on their own where to settle. Flat land means
bigger settlements. Bigger settlements mean more followers. More followers give
you more **mana**, and mana pays for terrain edits and divine powers. A rival
deity is doing the same thing on the same map. You win when their followers are
gone.

### The core loop

```
 flatten land ──► followers settle & grow ──► population generates mana
      ▲                                                  │
      └──────── spend mana on terrain + powers ◄─────────┘
                           │
                           ▼
              hurt the enemy's land and people
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

### 2.4 Mana

- Mana builds up every tick in proportion to your total population. Larger
  settlements can be worth a little more per person, which rewards good
  terraforming.
- Mana is spent on:
  - raising or lowering terrain (cheap, spent constantly)
  - divine powers (expensive, used for big moments)

### 2.5 Leader and rally point (the "Papal Magnet")

- You place a **rally point** (an ankh or totem) on the map.
- The first walker to touch it becomes your **leader**. You can then order all
  walkers to *settle*, *gather at the rally point*, or *fight*.
- This is the only direct control the player has, and it matters a lot for
  tactics.

### 2.6 Divine powers (unlocked as your mana cap grows)

| Power       | Effect                                                          | Cost     |
|-------------|-----------------------------------------------------------------|----------|
| Earthquake  | Randomly scrambles the heights in an area, wrecking flat land   | Low      |
| Swamp       | Turns tiles into swamp that swallows walkers                    | Low      |
| Knight      | Turns your leader into a hero who hunts enemy settlements       | Medium   |
| Volcano     | Raises a huge mountain and scatters rocks that can't be built on| High     |
| Flood       | Lowers the whole world by 1, drowning the lowlands              | Very high|
| Armageddon  | Everyone leaves their homes and fights to the death at the centre | Max    |

### 2.7 The rival deity (AI)

- The AI uses the **same rules and mana budget** as the player. It doesn't
  cheat. Its difficulty comes from how fast it reacts and how smart it is.
- Simple priority-based behaviour works well here:
  1. Flatten land next to its own settlements.
  2. Use a power when its mana goes over a threshold and a good target exists
     (the densest cluster of enemy buildings, for example).
  3. Move its rally point toward the player once its population is ahead.
- Difficulty settings change how often it acts, how well it picks targets, and
  which powers it's allowed to use.

### 2.8 Win, lose, and progression

- **Win:** the enemy has no walkers and no settlements left. **Lose:** the
  same happens to you.
- A **campaign of worlds**. Each world has its own map seed, terrain type
  (grassland, desert, snow, lava), enemy AI level, and set of allowed powers.
  Like the original, you could jump ahead a variable number of worlds
  depending on how well you did.

## 3. Technical approach

### 3.1 Recommended stack

**TypeScript + Vite + HTML5 Canvas** (or PixiJS once we need more sprites),
tested with **Vitest**.

Why:
- It runs in any browser, so it's easy to share and there's nothing to install
  to play.
- A 2D isometric view was the original look. It's much simpler than 3D and
  still looks great.
- Iteration is fast: save a file and the page reloads instantly.

Alternatives, if you prefer:
- **Godot (GDScript/C#):** a full engine with an editor, a good fit if you want
  to lay out levels and UI visually, or you plan to ship on Steam.
- **Three.js:** a real 3D heightmap with a rotating camera. It looks more
  modern but adds complexity. The simulation plan below stays the same, so we
  could switch to this later.

### 3.2 Architecture

Keep the **simulation** separate from the **presentation**:

```
src/
  sim/            # pure game logic: no DOM, no rendering, fully testable
    world.ts      # heightmap, tiles, sea level, terrain types
    terrain.ts    # raise/lower with slope propagation, flatness queries
    walkers.ts    # wandering, settling, combat, merging
    settlements.ts# size tiers, growth, spawning walkers
    mana.ts       # income and spending
    powers.ts     # earthquake, swamp, knight, volcano, flood, armageddon
    ai.ts         # rival deity
    rng.ts        # seeded random number generator
    game.ts       # owns the state, advances one fixed tick at a time
  render/
    iso.ts        # world <-> screen coordinate maths
    terrainRenderer.ts
    spriteRenderer.ts
    minimap.ts
  ui/
    hud.ts        # mana bar, power buttons, population comparison
    input.ts      # mouse/keyboard → commands
  main.ts
```

Key principles:
- **Fixed-timestep simulation** (for example 10 ticks per second), with the
  renderer interpolating between ticks. The game runs the same on every machine.
- **Seeded RNG and deterministic logic.** Replays, save/load, and bug
  reproduction come almost for free, and multiplayer becomes possible later.
- **Commands, not direct mutation.** Player input and AI decisions both produce
  commands like `RaiseTerrain(x, y)` or `CastPower(type, x, y)` that the
  simulation applies. The player and the AI then go through exactly the same
  code path.
- **Plain data for game state** (arrays and objects), so saving is just JSON.

### 3.3 Rendering notes

- Isometric projection: `screenX = (x - y) * tileW/2`,
  `screenY = (x + y) * tileH/2 - height * stepH`.
- Draw tiles back-to-front (by `x + y`). Shade each tile by its slope direction
  to get cheap, readable lighting.
- To pick a vertex under the mouse, invert the projection, then check nearby
  vertices at different heights and choose the closest on screen.
- A **minimap** and edge/drag scrolling are essential. The original only
  showed a small window of a large world.

## 4. Roadmap

Each milestone ends with something you can play or see.

**M0: Project skeleton** (small)
- Vite + TypeScript + Vitest, a canvas that fills the page, a game loop with a
  fixed tick.

**M1: Sculpt the world**
- Heightmap generation from a seed (noise plus smoothing), water at sea level.
- Isometric rendering with slope shading.
- Left click raises a vertex, right click lowers it, with slope propagation.
- Camera scrolling and a minimap.
- ✅ *Playable:* a relaxing terrain sandbox.

**M2: Life appears**
- Walkers wander and seek flat land.
- Settlements with size tiers based on surrounding flat area.
- Population growth, and full settlements spawning new walkers.
- Drowning, and settlements collapsing when their land is destroyed.
- ✅ *Playable:* shape land and watch a civilisation spread.

**M3: Faith and power**
- Mana income and a mana bar; terrain edits cost mana.
- Rally point, leader, and the settle/gather/fight commands.
- First powers: Earthquake and Swamp.

**M4: A rival god**
- A second tribe with its own colour.
- Walker combat, and attacking or capturing enemy settlements.
- Basic AI deity.
- Win/lose screens.
- ✅ *Playable:* a complete one-level game. **This is the big milestone.**

**M5: The full pantheon**
- Knight, Volcano, Flood, Armageddon.
- AI difficulty levels.
- World themes (grass, desert, snow, lava) with different rules.
- A campaign of worlds with progression, plus save/load.

**M6: Polish**
- Real sprite art and animations, sound effects, music.
- Tutorial / first-world guidance.
- Balancing pass (mana costs, growth rates, AI tuning).
- Settings, pause, speed control.

**Stretch ideas**
- Online or hot-seat multiplayer (made possible by the deterministic sim).
- Procedural world editor, so you can share seeds with friends.
- *Populous II*-style additions: more gods and powers, heroes.
- A 3D renderer (Three.js) on top of the same simulation.

## 5. Open questions

1. **Platform:** is a browser game (recommended) OK, or do you want a desktop
   or engine-based build (Godot)?
2. **Look:** classic 2D isometric pixel art (recommended to start), or modern
   3D?
3. **Faithfulness:** a close homage to Populous's rules, or something
   Populous-inspired with our own twists (seasons, resources, tech eras, etc.)?
4. **Art:** placeholder shapes first and real art later (recommended), or are
   you planning to draw or commission sprites?
5. **Scope:** single-player vs. AI only for now (recommended), or is
   multiplayer important early?
