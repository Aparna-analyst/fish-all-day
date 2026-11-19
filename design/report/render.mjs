
import { createRequire } from 'module';
const require = createRequire('/Users/sid/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const [src, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + src, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
await p.pdf({ path: out, width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
await b.close(); console.log('pdf', out);
