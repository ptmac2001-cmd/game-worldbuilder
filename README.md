# game-worldbuilder

A "god game" in the spirit of *Populous* (1989). You shape the land, and your
followers settle it and grow from a farming hamlet into a city with a
cathedral. A rival tribe does the same, and nature can wreck it all.

Built with plain JavaScript and [Three.js](https://threejs.org/). Everything
is drawn in code: no 3D models or art files.

## Run it

```sh
npm install
npm run dev      # opens a local dev server with instant reload
npm run build    # writes dist/index.html, one self-contained file you can open from disk
npm test         # rules tests (terrain slope rule, flat-land checks)
```

## How to play

- **Raise / Lower** (keys 1, 2): click a corner of the land. Right-click or
  Shift-click does the opposite. Drag to orbit, right-drag to pan, scroll to zoom.
- Flat land lets homes grow: **hut → cottage → manor**, or **townhouses and
  keeps** in later ages.
- **Ages:** each tribe's prosperity (the size of its homes) moves it through
  the Agrarian, Village, Town and City Ages. Each age unlocks bigger homes and
  landmarks:

  | Age      | Homes                          | Landmarks                    |
  |----------|--------------------------------|------------------------------|
  | Agrarian | huts, farmsteads               | Shrine                       |
  | Village  | huts, cottages, manors         | Windmills, Temple (2×2)      |
  | Town     | cottages, townhouses, manors   | Town Centre (3×3)            |
  | City     | cottages, townhouses, keeps    | Cathedral (3×3)              |

  Landmarks need a block of flat land. If none exists, the HUD tells you what
  size to flatten.
- **Farms:** agrarian homes are surrounded by crop fields and fenced pastures
  with sheep, cows, pigs and chickens. As towns grow, pastures give way to
  cobbled streets.
- **Seasons:** spring blossom, summer crops, autumn colours and harvest
  haystacks, then winter snow on the land and roofs, bare trees and shore ice.
- **Disasters** (keys 3–6): Earthquake, Volcano and Tornado strike where you
  click, and Flood sinks the whole world by one step. With *Nature strikes* on,
  they also happen on their own every few minutes.
- **Speed:** Pause (Space), 1×, 4× or 12×. *Blue god helps* lets an AI shape land
  for your tribe. *Graphics* switches between High and Fast.

## URL options (handy for testing)

`?seed=42` new island · `?speed=4` · `?nature=off` · `?quality=fast` ·
`?warp=600` fast-forward 600 game seconds ·
`?focus=cathedral,red,6` point the camera at a building ·
`?cam=x,y,z,tx,ty,tz` set the camera

## Code map

```
src/config.js            world size, ages, landmarks, tribes
src/sim/terrain.js       heightmap and the Populous slope rule (pure, tested)
src/view/terrainView.js  terrain mesh and shader (seasons, fields, streets, lava)
src/view/architecture.js every building, assembled from primitives
src/view/vegetation.js   trees, grass, flowers, rocks with seasonal shaders
src/view/water.js, sky.js, particles.js
src/game/settlements.js  homes, ages, landmarks, farmland, AI gods
src/game/villagers.js, animals.js, disasters.js
src/ui/hud.js            toolbar, status panel, event log
```

The design and roadmap are in [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md).
