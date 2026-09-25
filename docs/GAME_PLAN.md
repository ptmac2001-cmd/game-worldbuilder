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
- The grid is what the **simulation** uses. What you **see** is a smooth,
  detailed 3D landscape built from it (see section 4).

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

### 3.1 Engine: Godot 4 (changed from the browser)

Because the graphics should be **extremely good**, a browser game with 2D
canvas is no longer the right tool. The options:

| Engine      | How good it can look | Fit for this game | Notes |
|-------------|----------------------|-------------------|-------|
| **Godot 4** (recommended) | Very high for a stylised look: real-time global illumination, volumetric fog, custom shaders | Great | Free and open source. Easy to build terrain that changes during play. Project files are plain text, so Claude can work on everything directly. |
| Unity 6     | Very high | Great | Mature, huge asset store. Licensing and pricing have changed a lot in recent years. |
| Unreal 5    | Highest (photorealistic) | Awkward | Its terrain system isn't designed to change during play. Much logic lives in Blueprints, a visual format that can't be edited as text, so it's harder to work on together. Heavy tooling. |

**Recommendation: Godot 4**, with game code in **GDScript** (simple, with fast
iteration). Performance-critical parts can move to C# later if needed.
Target **desktop** (Windows, Mac, Linux), which can later be shipped on Steam.
The browser version is dropped because it would cap the visual quality.

### 3.2 Architecture

Keep the **simulation** separate from the **presentation**, even in an engine.

```
game/
  sim/                 # pure game logic, plain classes, no rendering
    world.gd           # heightmap grid, sea level, terrain types
    terrain.gd         # raise/lower with slope rule, flatness queries
    territory.gd       # who controls each tile
    walkers.gd         # wandering, settling, combat, merging
    settlements.gd     # size tiers, growth, spawning walkers
    worship.gd         # temples, prayer, miracle charge meters
    miracles.gd        # earthquake, swamp, knight, volcano, flood, armageddon
    ai.gd              # rival deity
    rng.gd             # seeded random number generator
    game_state.gd      # owns the state, advances one fixed tick at a time
  view/                # everything you see; reads sim state, never changes it
    terrain_mesh.gd    # builds and animates the 3D landscape
    water.gd
    vegetation.gd
    villagers_view.gd  # draws many villagers at once, efficiently
    buildings_view.gd
    miracle_fx/        # particles, camera shake, and so on
    camera_rig.gd
  ui/                  # HUD, miracle bar, menus
  shaders/
  assets/
  tests/               # simulation tests that run without graphics
```

Key principles:
- **Fixed-timestep simulation** (for example 10 ticks per second). The visuals
  animate smoothly between ticks. The game plays the same on every machine.
- **Seeded RNG and deterministic logic.** This makes replays, save/load, and
  bug reproduction easy, and multiplayer possible later.
- **Commands, not direct changes.** Player clicks and AI decisions both
  produce commands like `RaiseTerrain(x, y)` or `CastMiracle(type, x, y)`. The
  player and the AI then go through exactly the same code.
- **Game logic that can be tested without graphics.** Tests run headless, so
  rule changes can be checked without opening the game.

## 4. Visual direction: making it look extremely good

For a small team, great graphics come from **strong art direction, lighting,
and polish**, not from photorealism. A stylised game looks good for years. A
game that aims for realism and falls short looks dated quickly.

**The target look: a living miniature world.** It should feel like a
beautifully lit diorama sitting on your desk, full of little people. It should
look good both zoomed out over the whole island and zoomed in on one village.

Reference games: *Tiny Glade*, *Townscaper*, *Godus*, *Populous: The
Beginning*, *Before We Leave*, *Settlers* (for bustling life).

### 4.1 Terrain (the star of the show)
- A 3D landscape built from the simulation grid, drawn as **soft terraced
  layers**. Each height step is a visible ledge with rock and soil showing on
  the cliff face. It looks gorgeous and keeps flat land easy to read.
- **Sculpting feels physical:** land rises and sinks with a smooth animation,
  throwing up dust, pebbles tumbling, and grass slowly growing back over
  fresh earth.
- Materials blend automatically by height and slope: sand near water, grass on
  flat ground, rock on cliffs, snow on peaks.
- Grass and flowers sway in the wind, with thousands of blades drawn
  efficiently at once. Trees and rocks are scattered naturally.

### 4.2 Water
- A custom water shader: colour that deepens with depth, foam along
  shorelines, gentle waves, reflections, and light patterns (caustics) in the
  shallows.
- Flooding is a spectacle: the whole sea visibly rises and swallows the
  lowlands.

### 4.3 Light and atmosphere
- A moving sun with a **day/night cycle**. Warm sunsets, and villages lighting
  up at night.
- Soft shadows, real-time global illumination (light bouncing off the ground),
  volumetric fog, and god rays through clouds. Cloud shadows drift across the
  land.
- Post-processing: **tilt-shift depth of field** (the miniature look), bloom,
  ambient occlusion, and colour grading per world theme.

### 4.4 Life
- Hundreds or thousands of animated villagers, drawn efficiently as one batch.
  They walk, build, farm, pray, fight, and panic when disaster strikes.
- Buildings are **visibly built stage by stage**, and upgrade in front of you
  as you flatten more land. Chimney smoke, market stalls, livestock.
- Territory borders glow softly on the ground in each tribe's colour. Worship
  shows as streams of light rising from temples.

### 4.5 Miracles as spectacle
- Earthquake: the ground cracks open, the camera shakes, dust rises, buildings
  crumble.
- Volcano: the mountain erupts from the earth, lava flows glow, ash falls, and
  rocks rain down.
- Swamp: the ground darkens, bubbles and mist appear.
- Sound design matters as much as visuals here.

### 4.6 Camera
- Smooth orbit, rotate, and zoom, from a view of the whole world down to
  street level.

### 4.7 Performance target
- 60 frames per second at 1080p on a mid-range gaming PC.
- Worlds of about 128×128 tiles, with up to about 2,000 villagers.
- Lower graphics presets for weaker machines.

### 4.8 Art assets (an honest note)
The code side can be written from scratch: shaders, terrain, water, lighting,
particles, animation systems, and a lot of **procedural** content (terrain,
vegetation placement, buildings assembled from modular pieces). **3D models and
character animations, though, need to come from somewhere:**

1. **Prototype:** free CC0 packs (Quaternius, KayKit, Kenney). They look
   decent, cost nothing, and have a consistent style.
2. **Final look:** a paid stylised pack (for example Synty, roughly $20–$150),
   or a commissioned 3D artist for a truly unique look.
3. Whatever we choose, we keep **one consistent style**. Mixing styles is the
   quickest way to make a game look cheap.

## 5. Roadmap

Each milestone ends with something you can play or see. The graphics bar is
proven **early** (M2), not left until the end.

**M0: Project skeleton**
- Godot 4 project, folder layout, fixed-tick simulation loop, headless test
  runner.

**M1: Sculpt the world**
- Heightmap generation from a seed. Terraced 3D terrain mesh built from it.
- Raise and lower land with the slope rule, with smooth animation.
- Camera: orbit, zoom, pan.
- ✅ *Playable:* a terrain sandbox.

**M2: Look development (the "screenshot" milestone)**
- Terrain materials, water shader, sun and sky, day/night, fog, shadows,
  tilt-shift and colour grading. Grass, trees, rocks.
- ✅ *Goal:* a screenshot that looks like a finished game. If it doesn't, we
  iterate here before building more.

**M3: Life appears**
- Villagers wander and look for flat land. Settlements with size tiers, built
  stage by stage.
- Population growth, and full settlements sending out new villagers.
- Territory that grows from settlements and limits where you can sculpt.
- ✅ *Playable:* shape land and watch a civilisation spread.

**M4: Worship and miracles**
- Shrines and temples, prayer, and per-miracle charge meters.
- Rally point and Prophet, with settle/gather/fight orders.
- First miracles: Earthquake and Swamp, with full visual effects.

**M5: A rival god**
- A second tribe with its own colour. Contested borders.
- Villager combat, and attacking or capturing settlements. AI deity.
- Win/lose screens.
- ✅ *Playable:* a complete one-level game. **This is the big milestone.**

**M6: The full pantheon and campaign**
- Knight, Volcano, Flood, Armageddon.
- AI difficulty levels. World themes. Campaign progression, save/load.

**M7: Final art and polish**
- Final art assets, animation, audio and music, tutorial, balancing,
  settings, and graphics presets.

**Stretch ideas**
- Online multiplayer (made possible by the deterministic simulation).
- A world editor, and sharing worlds by seed.
- More gods, more miracles, heroes.

## 6. Open questions

1. **Worship and territory:** does this replacement for mana feel right? (See
   section 2.4. The other options considered were renaming mana to "faith" and
   making it visible, or a Prophet who casts everything personally, as in
   *Populous: The Beginning*.)
2. **Engine:** is Godot 4 on desktop OK? It means no browser version.
3. **Look:** a stylised miniature world (recommended), or are you after
   realism?
4. **Art budget:** free asset packs only, a paid pack, or a hired artist for
   the final look?
5. **Your machine:** what computer will you mostly play and develop on? This
   sets how far we push the graphics.
6. **Rules:** a close homage to Populous, or add our own twists (seasons,
   resources, tech eras)?
