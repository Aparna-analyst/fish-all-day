import { FISH, RARITY, pick, weigh } from './fish.js';

const STORAGE_KEY = 'fad.v1';
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const stepTime = dt => Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Delays are milliseconds. Demo timing also applies to the first bite.
export function nextBiteDelay(first, demo, rand = Math.random) {
  if (demo) return 20000 + clamp(rand()) * 20000;
  return first ? 45000 : 180000 + clamp(rand()) * 300000;
}

export function createReelState() {
  return { tension: 0.45, progress: 0, over: 0, slack: 0, surge: 0, surgeLeft: 0, surgeIn: 1.2, status: 'reeling' };
}

// A step returns a new state. Timed surges don't depend on the frame rate.
export function reelStep(state, dt, holding, fish, rand = Math.random) {
  const seconds = stepTime(dt);
  if (state.status !== 'reeling' || !seconds) return { ...state };
  const next = { ...state }, pull = clamp(fish.pull), golden = fish.rarity === 'legendary';
  next.surgeIn -= seconds;
  next.surgeLeft = Math.max(0, next.surgeLeft - seconds);
  if (next.surgeIn <= 0) {
    next.surgeLeft = 0.25 + pull * 0.5 + rand() * 0.3;
    next.surge = (0.06 + pull * pull * 0.75) * (0.75 + rand() * 0.5) * (golden ? 1.2 : 1);
    next.surgeIn = next.surgeLeft + 0.6 + (1 - pull) * 1.7 + rand() * (1.5 - pull);
  }
  const force = holding ? 0.32 + pull * 0.25 : -(0.42 + pull * 0.16);
  const tension = next.tension + (force + (next.surgeLeft > 0 ? next.surge : 0)) * seconds;
  next.tension = clamp(tension);
  // Keep strain separately so the visible tension always stays within 0..1.
  next.over = tension > 1 ? next.over + seconds : 0;
  next.slack = next.tension < 0.08 ? next.slack + seconds : 0;
  const inZone = next.tension >= 0.35 && next.tension <= 0.75;
  const effort = golden ? 0.5 : 0.30 + Math.max(0, pull - 0.75) * 0.9;
  const speed = effort / (1 + pull * 0.85 + (fish.rarity === 'rare' ? 0.2 : 0) + (golden ? 0.65 : 0));
  next.progress = clamp(next.progress + (holding && inZone ? speed : inZone ? 0 : -0.035) * seconds);
  if (next.over >= 0.6) next.status = 'snapped';
  else if (next.slack >= 2.5) next.status = 'escaped';
  else if (next.progress >= 1) next.status = 'landed';
  return next;
}

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
function cleanStats(value, today) {
  const raw = value && typeof value === 'object' ? value : {};
  const book = {};
  for (const fish of FISH) {
    const entry = raw.book?.[fish.id];
    if (count(entry?.n)) book[fish.id] = { n: count(entry.n), best: Number.isFinite(entry.best) && entry.best >= 0 ? entry.best : 0 };
  }
  const total = Math.max(count(raw.total), Object.values(book).reduce((sum, entry) => sum + entry.n, 0));
  return { day: today, today: raw.day === today ? Math.min(count(raw.today), total) : 0, total, lost: count(raw.lost), book };
}

export function loadStats(storage, today = localDay()) {
  try { return cleanStats(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'), today); }
  catch { return cleanStats(null, today); }
}

export function recordCatch(stats, fish, kg, today = localDay()) {
  const next = cleanStats(stats, today), previous = next.book[fish.id];
  next.today++; next.total++;
  next.book[fish.id] = { n: (previous?.n ?? 0) + 1, best: Math.max(previous?.best ?? 0, kg) };
  return next;
}

export function createGame({ fisher = null, demo = false } = {}) {
  const ids = ['bite', 'hold', 'biteClock', 'needle', 'landBar', 'card', 'cardRarity', 'cardName', 'cardWeight', 'cardNew', 'cardBest', 'cardFish', 'keepFishing', 'book', 'bookGrid', 'bookTotals', 'closeBook', 'bookScroll', 'bBook', 'toast', 'toastMessage', 'nToday'];
  const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  let storage;
  try { storage = window.localStorage; } catch { /* This tab can still keep score in memory. */ }
  let stats = loadStats(storage), actor = null, previousSeated;
  let started = false, disposed = false, first = true, mode = 'idle', fish = null, reel = null;
  let biteTimer = null, deadlineTimer = null, clockTimer = null, cardTimer = null, toastTimer = null;
  let deadline = 0, pointer = null, space = false, ratchet = 0, dayCheck = 0, focusBeforeBook = null;
  let sound = {};
  // alerts.js creates its tab icons on import; pure helpers above work without a DOM.
  const soundReady = import('./alerts.js').then(api => {
    if (disposed) return;
    sound = api;
    if (started) sound.unlockSound?.();
    if (mode === 'bite') sound.startAlert?.(fish.name);
  });
  const listeners = [];
  function listen(target, name, fn, options) {
    target.addEventListener(name, fn, options);
    listeners.push(() => target.removeEventListener(name, fn, options));
  }
  function save() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(stats)); }
    catch { storage = null; }
    ui.nToday.textContent = stats.today;
  }
  function resetDay() {
    const today = localDay();
    if (stats.day !== today) { stats = { ...stats, day: today, today: 0 }; save(); }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    ui.toastMessage.textContent = message; ui.toast.hidden = false;
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 3500);
  }
  function clearBite() {
    clearTimeout(deadlineTimer); clearInterval(clockTimer);
    deadlineTimer = clockTimer = null;
    sound.stopAlert?.(); pointer = null; space = false; ratchet = 0;
    ui.bite.hidden = true; ui.bite.classList.remove('danger', 'slack', 'reeling', 'holding');
  }
  function hideCard() {
    clearTimeout(cardTimer); cardTimer = null; ui.card.hidden = true;
    if (document.activeElement === ui.keepFishing) ui.bBook.focus({ preventScroll: true });
  }
  function paintFish(element, colour) { element.style.setProperty('--fish-colour', colour); }
  function showBook() {
    resetDay(); renderBook(); release();
    focusBeforeBook = document.activeElement; ui.book.hidden = false;
    ui.closeBook.focus({ preventScroll: true });
  }
  function closeBook() {
    ui.book.hidden = true;
    const target = focusBeforeBook?.isConnected && !focusBeforeBook.closest('[hidden]') ? focusBeforeBook : ui.bBook;
    target.focus({ preventScroll: true });
  }
  function renderBook() {
    ui.bookTotals.textContent = `${Object.keys(stats.book).length}/${FISH.length} species found · ${stats.total} caught · ${stats.lost} rods lost`;
    ui.bookGrid.replaceChildren(...FISH.map(item => {
      const caught = stats.book[item.id], cell = document.createElement('article');
      cell.className = `bookEntry${caught ? '' : ' uncaught'}`;
      const shape = document.createElement('span'); shape.className = 'fishShape'; shape.setAttribute('aria-hidden', 'true');
      paintFish(shape, caught ? item.colour : '#171e1b');
      const name = document.createElement('h3'); name.textContent = caught ? item.name : '???';
      const rarity = document.createElement('span'); rarity.className = 'bookRarity'; rarity.textContent = caught ? RARITY[item.rarity] : 'Not caught yet';
      const detail = document.createElement('p'); detail.textContent = caught ? `${caught.n} caught · Best ${caught.best.toFixed(2)} kg` : 'Still out there.';
      cell.append(shape, name, rarity, detail); return cell;
    }));
  }
  function finish(result) {
    if (mode !== 'bite' && mode !== 'reeling') return;
    mode = 'settling'; clearBite();
    if (result === 'landed') {
      const kg = weigh(fish), previous = stats.book[fish.id], firstCatch = stats.total === 0;
      stats = recordCatch(stats, fish, kg); save();
      ui.cardRarity.textContent = RARITY[fish.rarity]; ui.cardName.textContent = fish.name;
      ui.cardWeight.textContent = `${kg.toFixed(2)} kg`;
      ui.cardNew.hidden = !!previous; ui.cardBest.hidden = !previous || kg <= previous.best;
      ui.card.dataset.rarity = fish.rarity; paintFish(ui.cardFish, fish.colour);
      ui.card.hidden = false; clearTimeout(cardTimer); cardTimer = setTimeout(hideCard, 9000);
      sound.splash?.(); actor?.land?.(fish, kg);
      if (firstCatch) soundReady.then(() => { if (!disposed) sound.askNotify?.(); });
    } else if (result === 'escaped') {
      actor?.escape?.(); toast('It got away.');
    } else {
      stats = { ...stats, lost: stats.lost + 1 }; save(); actor?.lose?.();
      toast(result === 'snapped' ? 'The line snapped!' : 'He got pulled in. He will be back with a new rod.');
    }
    if (!ui.book.hidden) renderBook();
  }
  function updateClock() {
    if (mode !== 'bite') return;
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    ui.biteClock.textContent = String(remaining);
    if (!remaining) finish('missed');
  }
  function beginBite() {
    biteTimer = null;
    if (!started || disposed || mode !== 'idle' || actor?.phase !== 'seated') return;
    first = false; mode = 'bite'; fish = pick(); reel = createReelState();
    hideCard(); pointer = null; space = false; deadline = Date.now() + 10000;
    ui.hold.textContent = 'Hold to reel'; ui.bite.querySelector('.biteTitle').textContent = 'Bite!';
    ui.needle.style.left = '45%'; ui.landBar.style.width = '0%'; ui.bite.hidden = false;
    updateClock(); sound.startAlert?.(fish.name); actor?.bite?.();
    deadlineTimer = setTimeout(updateClock, 10000);
    clockTimer = setInterval(updateClock, 100);
  }
  function schedule() {
    if (started && !disposed && mode === 'idle' && biteTimer === null && actor?.phase === 'seated') {
      biteTimer = setTimeout(beginBite, nextBiteDelay(first, demo));
    }
  }
  function onSeated() {
    if (mode === 'settling') mode = 'idle';
    schedule();
  }
  function setFisher(next) {
    if (actor === next || disposed) return;
    if (actor?.onSeated === onSeated) actor.onSeated = previousSeated;
    clearTimeout(biteTimer); biteTimer = null;
    if (mode === 'bite' || mode === 'reeling') clearBite();
    mode = 'idle'; actor = next; previousSeated = actor?.onSeated;
    if (actor) actor.onSeated = onSeated;
    schedule();
  }
  function press() {
    if (mode === 'bite') {
      if (Date.now() >= deadline) { finish('missed'); return false; }
      clearTimeout(deadlineTimer); clearInterval(clockTimer); deadlineTimer = clockTimer = null;
      sound.stopAlert?.(); mode = 'reeling'; ui.bite.classList.add('reeling');
      ui.bite.querySelector('.biteTitle').textContent = 'Reel it in!';
    }
    return mode === 'reeling';
  }
  function release() { pointer = null; space = false; ui.bite.classList.remove('holding'); }
  listen(ui.bite, 'pointerdown', event => {
    if (event.button !== 0 || pointer !== null || !ui.book.hidden || !press()) return;
    event.preventDefault(); pointer = event.pointerId;
    ui.bite.setPointerCapture?.(pointer);
  });
  const releasePointer = event => { if (pointer === event.pointerId) pointer = null; };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(window, name, releasePointer);
  listen(window, 'keydown', event => {
    if (event.code === 'Escape' && !ui.book.hidden) { event.preventDefault(); closeBook(); return; }
    if (!ui.book.hidden) {
      if (event.code === 'Tab') { event.preventDefault(); ui.closeBook.focus(); }
      return;
    }
    if (event.code !== 'Space' || event.repeat) return;
    if (event.target.closest?.('button, a, input, textarea, select, [contenteditable]') && !ui.bite.contains(event.target)) return;
    if (press()) { event.preventDefault(); space = true; }
  });
  listen(window, 'keyup', event => { if (event.code === 'Space') { if (space) event.preventDefault(); space = false; } });
  listen(window, 'blur', release);
  listen(document, 'visibilitychange', () => { release(); resetDay(); updateClock(); });
  listen(ui.bBook, 'click', () => ui.book.hidden ? showBook() : closeBook());
  listen(ui.closeBook, 'click', closeBook);
  listen(ui.keepFishing, 'click', hideCard);
  // The scene locks touch gestures, so the book handles its own touch scrolling.
  let bookDrag = null;
  listen(ui.bookScroll, 'pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    bookDrag = { id: event.pointerId, y: event.clientY, top: ui.bookScroll.scrollTop };
    ui.bookScroll.setPointerCapture?.(event.pointerId);
  });
  listen(ui.bookScroll, 'pointermove', event => {
    if (bookDrag?.id === event.pointerId) ui.bookScroll.scrollTop = bookDrag.top + bookDrag.y - event.clientY;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(ui.bookScroll, name, () => { bookDrag = null; });

  save(); setFisher(fisher);
  return {
    setFisher,
    start() {
      if (disposed || started) return;
      started = true; sound.unlockSound?.(); schedule();
    },
    update(dt) {
      if (disposed || !started) return;
      const seconds = stepTime(dt);
      dayCheck -= seconds;
      if (dayCheck <= 0) { resetDay(); dayCheck = 1; }
      schedule(); updateClock();
      if (mode !== 'reeling') return;
      const holding = pointer !== null || space;
      reel = reelStep(reel, seconds, holding, fish);
      ui.needle.style.left = `${reel.tension * 100}%`; ui.landBar.style.width = `${reel.progress * 100}%`;
      ui.bite.classList.toggle('holding', holding); ui.bite.classList.toggle('danger', reel.tension >= 0.85);
      ui.bite.classList.toggle('slack', reel.tension < 0.15);
      ui.hold.textContent = reel.tension >= 0.85 ? 'Let go!' : holding ? 'Reeling…' : 'Hold to reel';
      ui.biteClock.textContent = reel.tension >= 0.85 ? 'Too tight! Let go.' : reel.tension < 0.15 ? 'Too loose! Hold to reel.' : 'Keep the line in the green';
      actor?.reel?.(reel.tension, reel.progress);
      ratchet += seconds;
      if (holding && ratchet >= 1 / (4 + reel.tension * 8)) { sound.tick?.(); ratchet = 0; }
      if (!holding) ratchet = 0;
      if (reel.status !== 'reeling') finish(reel.status);
    },
    destroy() {
      disposed = true; started = false; clearTimeout(biteTimer); clearTimeout(cardTimer); clearTimeout(toastTimer);
      clearBite(); ui.card.hidden = ui.book.hidden = ui.toast.hidden = true;
      if (actor?.onSeated === onSeated) actor.onSeated = previousSeated;
      listeners.forEach(remove => remove());
    },
  };
}
