// Download with retries; when this Mac's DNS cannot find Aholo's file server, ask public DNS and go there directly.
import { execFileSync } from 'node:child_process';
export async function download(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  const host = new URL(url).hostname;
  const ip = execFileSync('dig', ['+short', '@8.8.8.8', host]).toString().trim().split('\n').filter(l => /^\d+\.\d+\.\d+\.\d+$/.test(l)).pop();
  if (!ip) throw new Error('no address for ' + host);
  return execFileSync('curl', ['-s', '--fail', '--retry', '4', '--connect-timeout', '20', '--max-time', '300', '--resolve', `${host}:443:${ip}`, url], { maxBuffer: 1 << 30 });
}
