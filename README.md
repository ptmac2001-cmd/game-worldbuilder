# game-worldbuilder

A "god game" in the spirit of *Populous* (1989): you shape the land, your
followers settle it, and their worship powers your miracles against
a rival deity.

Built with plain JavaScript and [Three.js](https://threejs.org/), and runs in
the browser.

## Try the prototype

Open [`prototype/index.html`](prototype/index.html) in a browser. It loads
Three.js from a CDN, so no install is needed.

- **Left-click:** raise land · **Right-click / Shift-click:** lower land
  (or use the Raise/Lower button on touchscreens)
- **Drag:** orbit · **Right-drag:** pan · **Scroll:** zoom

Two tribes of villagers wander the island and build on flat land. Settlements
grow from huts to cottages to manors, with farm fields, as you flatten more
land around them. Flood them and they drown.

For testing, you can set the starting camera with
`?cam=x,y,z,targetX,targetY,targetZ`.

## Plan

See [`docs/GAME_PLAN.md`](docs/GAME_PLAN.md) for the design and roadmap.
