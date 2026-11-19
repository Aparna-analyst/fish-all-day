import test from 'node:test';
import assert from 'node:assert/strict';
import { FISH } from '../../web/src/fish.js';
import { createReelState, reelStep, nextBiteDelay, loadStats, recordCatch, localDay } from '../../web/src/game.js';

const perch = FISH.find(fish => fish.id === 'perch');
const today = '2026-11-18';
const empty = () => ({ day: today, today: 0, total: 0, lost: 0, book: {} });
const storageFor = value => ({ getItem(key) { assert.equal(key, 'fad.v1'); return JSON.stringify(value); } });

function random(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function play(fish, player, seed = 1, fps = 60) {
  let state = createReelState(), frames = 0;
  const rand = random(seed);
  while (state.status === 'reeling' && frames < 90 * fps) {
    state = reelStep(state, 1 / fps, player(state), fish, rand); frames++;
  }
  return { state, seconds: frames / fps };
}

test('a simple player lands every common fish in 6–12 seconds', () => {
  for (const fish of FISH.filter(item => item.rarity === 'common')) {
    for (const seed of [1, 7, 42, 300]) {
      for (const fps of [30, 60]) {
        const { state, seconds } = play(fish, state => state.tension < 0.55, seed, fps);
        assert.equal(state.status, 'landed', `${fish.name}, seed ${seed}, ${fps} fps`);
        assert.ok(seconds >= 6 && seconds <= 12, `${fish.name}: ${seconds.toFixed(2)} seconds`);
      }
    }
  }
});

test('rare fish take about 12–20 seconds with a steady player', () => {
  for (const fish of FISH.filter(item => item.rarity === 'rare')) {
    for (const seed of [1, 7, 42, 300]) {
      const { state, seconds } = play(fish, state => state.tension < 0.55, seed);
      assert.equal(state.status, 'landed');
      assert.ok(seconds >= 12 && seconds <= 20, `${fish.name}: ${seconds.toFixed(2)} seconds`);
    }
  }
});

test('never reeling lets a common fish escape', () => {
  const { state, seconds } = play(perch, () => false);
  assert.equal(state.status, 'escaped');
  assert.equal(state.progress, 0);
  assert.ok(seconds > 2.5 && seconds < 5);
});

test('the Golden One takes sustained control but can still be landed', () => {
  for (const seed of [1, 7, 42, 300]) {
    const { state, seconds } = play(FISH.find(fish => fish.id === 'golden'), state => state.tension < 0.55, seed);
    assert.equal(state.status, 'landed');
    assert.ok(seconds >= 20 && seconds <= 45, `${seconds.toFixed(2)} seconds`);
  }
});

test('holding forever snaps the line before landing', () => {
  for (const fish of FISH) {
    const { state } = play(fish, () => true);
    assert.equal(state.status, 'snapped', fish.name);
    assert.ok(state.over >= 0.6);
    assert.ok(state.progress < 1);
  }
});

test('a brief strain is recoverable, and slack needs 2.5 seconds', () => {
  let state = { ...createReelState(), tension: 1, over: 0.5 };
  state = reelStep(state, 0.05, false, perch, () => 0.5);
  assert.equal(state.over, 0);
  assert.equal(state.status, 'reeling');
  state = { ...createReelState(), tension: 0, slack: 2.4, surgeIn: 10 };
  state = reelStep(state, 0.05, false, perch);
  assert.equal(state.status, 'reeling');
  state = reelStep(state, 0.05, false, perch);
  state = reelStep(state, 0.05, false, perch);
  assert.equal(state.status, 'escaped');
});

test('huge frame gaps are clamped, invalid gaps do nothing, and input is not mutated', () => {
  const state = Object.freeze(createReelState());
  assert.deepEqual(reelStep(state, 1000, true, perch), reelStep(state, 0.05, true, perch));
  for (const dt of [-1, NaN, Infinity, 0]) assert.deepEqual(reelStep(state, dt, true, perch), state);
  const ended = { ...state, status: 'landed', progress: 1 };
  assert.deepEqual(reelStep(ended, 0.05, false, perch), ended);
});

test('surges scale up for the Golden One', () => {
  const state = { ...createReelState(), surgeIn: 0 };
  const common = reelStep(state, 0.05, false, perch, () => 0.5);
  const golden = reelStep(state, 0.05, false, FISH.find(fish => fish.id === 'golden'), () => 0.5);
  assert.ok(golden.surge > common.surge * 4);
  assert.ok(golden.surgeIn < common.surgeIn);
});

test('scheduler uses 45 seconds first, 3–8 minutes later, and 20–40 seconds in demo', () => {
  for (const value of [0, 0.5, 1]) {
    assert.equal(nextBiteDelay(true, false, () => value), 45000);
    assert.equal(nextBiteDelay(false, false, () => value), 180000 + value * 300000);
    for (const first of [true, false]) assert.equal(nextBiteDelay(first, true, () => value), 20000 + value * 20000);
  }
});

test('missing, corrupt, blocked and malformed storage start with a usable score', () => {
  const blocked = { getItem() { throw new Error('Storage blocked'); } };
  for (const storage of [undefined, null, {}, blocked, { getItem: () => '{broken' }]) {
    assert.deepEqual(loadStats(storage, today), empty());
  }
  for (const value of [null, [], 42, 'wrong', { day: today, today: -1, total: '3', lost: -4, book: { perch: { n: -1, best: -2 } } }]) {
    assert.deepEqual(loadStats(storageFor(value), today), empty());
  }
  assert.equal(recordCatch(loadStats(blocked, today), perch, 0.5, today).total, 1);
});

test('load rolls the local day over without losing the book or lifetime counters', () => {
  const stats = { day: '2026-11-17', today: 4, total: 9, lost: 2, book: { perch: { n: 9, best: 0.86 } } };
  assert.deepEqual(loadStats(storageFor(stats), today), { ...stats, day: today, today: 0 });
  assert.equal(localDay(new Date(2026, 0, 2, 0, 5)), '2026-01-02');
});

test('catch updates counts and best weight without mutating the previous score', () => {
  const before = empty();
  const first = recordCatch(before, perch, 0.5, today);
  const smaller = recordCatch(first, perch, 0.3, today);
  const larger = recordCatch(smaller, perch, 0.8, today);
  assert.deepEqual(before, empty());
  assert.deepEqual(first.book.perch, { n: 1, best: 0.5 });
  assert.deepEqual(smaller.book.perch, { n: 2, best: 0.5 });
  assert.deepEqual(larger.book.perch, { n: 3, best: 0.8 });
  assert.equal(larger.total, 3); assert.equal(larger.today, 3);
  assert.deepEqual(loadStats(storageFor(larger), today), larger);
});

test('the first catch after midnight resets today and preserves rods lost', () => {
  const old = { ...empty(), day: '2026-11-17', today: 8, total: 8, lost: 2, book: { perch: { n: 8, best: 0.7 } } };
  const next = recordCatch(old, perch, 0.5, today);
  assert.equal(next.day, today); assert.equal(next.today, 1); assert.equal(next.total, 9); assert.equal(next.lost, 2);
  assert.deepEqual(next.book.perch, { n: 9, best: 0.7 });
});

test('partial storage keeps valid species and repairs invalid counters', () => {
  const stats = loadStats(storageFor({ day: today, today: 99, total: 0, lost: 3, book: { perch: { n: 2, best: 'oops' }, unknown: { n: 40, best: 2 } } }), today);
  assert.deepEqual(stats, { day: today, today: 2, total: 2, lost: 3, book: { perch: { n: 2, best: 0 } } });
});
