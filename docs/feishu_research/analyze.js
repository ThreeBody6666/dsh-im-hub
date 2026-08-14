const fs = require('fs');
const file = process.argv[2];
const d = fs.readFileSync(file, 'utf8');
const m = d.match(/"defaultBranch":"([^"]+)"/);
console.log('defaultBranch:', m && m[1]);
const branches = d.match(/"name":"(master|main|v[0-9][^"]*)"[^}]*"defaultBranch"/g);
const items = [...d.matchAll(/"name":"([^"]+)","path":"([^"]+)","contentType":"([^"]+)"/g)];
console.log('top-level items:', items.length);
for (const it of items.slice(0, 60)) console.log(it[3], it[2]);
