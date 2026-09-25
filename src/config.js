// World and game constants shared by the simulation and the view.
export const N = 48;          // simulation tiles per side
export const V = N + 1;       // simulation vertices per side
export const STEP = 0.6;      // world height of one terrain step
export const SUB = 4;         // render subdivisions per tile
export const R = N * SUB + 1; // render vertices per side
export const SEA = 0.16;      // water surface height
export const MAX_HEIGHT = 14;

export const SEASON_LENGTH = 50;  // game seconds per season
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const TRIBES = {
  blue: { name: 'Blue', roof: 0x44649f, flag: 0x2f6fe0, shirts: [0x2f5fc4, 0x3a74d8, 0x27498f, 0x4b7fc9], css: '#7fb2ff' },
  red:  { name: 'Red',  roof: 0xa4432f, flag: 0xd8352a, shirts: [0xc43a2f, 0xd85a3a, 0x9e2a24, 0xb8483a], css: '#ff8a7a' },
};

// Ages of civilisation. `score` is the prosperity needed (sum of home sizes).
export const ERAS = [
  { name: 'Agrarian', score: 0 },
  { name: 'Village', score: 12 },
  { name: 'Town', score: 45 },
  { name: 'City', score: 110 },
];

// Landmarks: which age unlocks them and how many tiles (size × size) they need.
export const CIVICS = {
  shrine:    { label: 'Shrine',      era: 0, size: 1, height: 0.9 },
  windmill:  { label: 'Windmill',    era: 1, size: 1, height: 1.6 },
  temple:    { label: 'Temple',      era: 1, size: 2, height: 1.3 },
  towncentre:{ label: 'Town Centre', era: 2, size: 3, height: 2.6 },
  cathedral: { label: 'Cathedral',   era: 3, size: 3, height: 3.2 },
};
