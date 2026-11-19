// design/voice/dialogue.json ({kind: {when, lines}}) -> web/src/lines.js, the lines the page speaks.
// node tools/dialogue-to-lines.mjs [dialogue.json]   refuses a file that drops a moment the game uses or has an empty one
import fs from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const src = process.argv[2] || root + 'design/voice/dialogue.json';
const D = JSON.parse(fs.readFileSync(src, 'utf8'));
const old = (await import(root + 'web/src/lines.js')).LINES;
const kinds = Object.keys(D).filter((k) => !k.startsWith('_'));
const missing = Object.keys(old).filter((k) => !kinds.includes(k));
const lines = Object.fromEntries(kinds.map((k) => [k, (Array.isArray(D[k]) ? D[k] : D[k].lines || []).map((t) => String(t).trim()).filter(Boolean)]));
const empty = kinds.filter((k) => !lines[k].length);
const long = kinds.flatMap((k) => lines[k].filter((t) => t.length > 90).map((t) => `${k}: ${t}`));
if (missing.length || empty.length) { console.log('NOT written. missing moments:', missing, 'empty moments:', empty); process.exit(1); }
const extra = kinds.filter((k) => !(k in old));
const body = kinds.map((k) => `  ${k}: [\n${lines[k].map((t) => `    ${JSON.stringify(t)},`).join('\n')}\n  ],`).join('\n');
fs.writeFileSync(root + 'web/src/lines.js', `// Spoken lines for the grumpy old fisherman in Fish All Day.\nexport const LINES = {\n${body}\n};\n`);
const n = kinds.reduce((a, k) => a + lines[k].length, 0);
console.log(`lines.js: ${kinds.length} moments, ${n} lines` + (extra.length ? `; new moments the game does not call yet: ${extra.join(', ')}` : '') + (long.length ? `\nlong lines (big bubble):\n  ${long.join('\n  ')}` : ''));
