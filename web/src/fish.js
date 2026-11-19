// What can bite. weight in kg [min, max]; pull is how hard it fights (0..1); odds are relative.
export const RARITY = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary', junk: 'Junk' };
export const FISH = [
  { id: 'perch', name: 'Stripy Perch', rarity: 'common', kg: [0.2, 0.9], pull: 0.25, odds: 22, colour: '#c9b23a' },
  { id: 'roach', name: 'Red-eye Roach', rarity: 'common', kg: [0.1, 0.6], pull: 0.2, odds: 20, colour: '#b9c2c8' },
  { id: 'bream', name: 'Bronze Bream', rarity: 'common', kg: [0.5, 2.5], pull: 0.3, odds: 16, colour: '#b98a3c' },
  { id: 'trout', name: 'Rainbow Trout', rarity: 'uncommon', kg: [0.6, 3.5], pull: 0.45, odds: 10, colour: '#d78aa0' },
  { id: 'carp', name: 'Big Lazy Carp', rarity: 'uncommon', kg: [2, 9], pull: 0.55, odds: 8, colour: '#a07a3a' },
  { id: 'catfish', name: 'Whiskered Catfish', rarity: 'uncommon', kg: [1.5, 12], pull: 0.6, odds: 6, colour: '#5d5a52' },
  { id: 'pike', name: 'Grumpy Pike', rarity: 'rare', kg: [2, 14], pull: 0.75, odds: 4, colour: '#6f8a3c' },
  { id: 'bluegill', name: 'Little Bluegill', rarity: 'common', kg: [0.05, 0.4], pull: 0.15, odds: 14, colour: '#4f7fb8' },
  { id: 'eel', name: 'Slippery Eel', rarity: 'rare', kg: [0.4, 3], pull: 0.7, odds: 3, colour: '#4a4a34' },
  { id: 'sturgeon', name: 'Ancient Sturgeon', rarity: 'rare', kg: [8, 40], pull: 0.85, odds: 1.5, colour: '#7d8794' },
  { id: 'golden', name: 'The Golden One', rarity: 'legendary', kg: [3, 6], pull: 0.9, odds: 0.4, colour: '#f2c230' },
  { id: 'boot', name: 'Old Boot', rarity: 'junk', kg: [0.6, 1.2], pull: 0.1, odds: 4, colour: '#5a3e2b' },
  { id: 'can', name: 'Rusty Can', rarity: 'junk', kg: [0.05, 0.2], pull: 0.05, odds: 4, colour: '#8a8f86' },
  { id: 'keyboard', name: 'Somebody\'s Keyboard', rarity: 'junk', kg: [0.5, 1], pull: 0.1, odds: 1.5, colour: '#3a3d44' },
  { id: 'duck', name: 'Rubber Duck', rarity: 'junk', kg: [0.03, 0.05], pull: 0.02, odds: 1.5, colour: '#f5d22c' },
];
export function pick(rand = Math.random) {
  const total = FISH.reduce((s, f) => s + f.odds, 0); let x = rand() * total;
  for (const f of FISH) { x -= f.odds; if (x <= 0) return f; }
  return FISH[0];
}
export function weigh(f, rand = Math.random) { const t = Math.pow(rand(), 2.2); return +(f.kg[0] + (f.kg[1] - f.kg[0]) * t).toFixed(2); }
