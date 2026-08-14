// Helper: fetch a URL over http or https and save to a file
const http = require('http');
const https = require('https');
const fs = require('fs');

function fetchOnce(url, outFile) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (research)' }, timeout: 45000 }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; if (d.length > 80 * 1024 * 1024) { req.destroy(); reject(new Error('too big')); } });
      r.on('end', () => {
        if (outFile) fs.writeFileSync(outFile, d);
        resolve({ status: r.statusCode, length: d.length, body: d });
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', (e) => reject(e));
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetch(url, outFile, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetchOnce(url, outFile);
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

module.exports = { fetch };

if (require.main === module) {
  const url = process.argv[2];
  const out = process.argv[3];
  fetch(url, out).then((r) => {
    console.log('status', r.status, 'len', r.length);
    if (!out && r.length < 5000) console.log(r.body);
  }).catch((e) => { console.log('ERR', e.message); process.exit(1); });
}
