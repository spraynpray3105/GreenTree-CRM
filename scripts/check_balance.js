const fs = require('fs');
const path = 'c:/Users/Elija/OneDrive/Documents/crm/greentree-crm/src/app/page.js';
const s = fs.readFileSync(path, 'utf8');
const lines = s.split(/\r?\n/);
const upto = 1725;
let pc = 0, bc = 0, sc = 0;
for (let i = 0; i < upto && i < lines.length; i++) {
  const line = lines[i];
  let inS = false, inD = false, inT = false, esc = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === "'" && !inD && !inT) inS = !inS;
    else if (ch === '"' && !inS && !inT) inD = !inD;
    else if (ch === '`' && !inS && !inD) inT = !inT;
    if (inS || inD || inT) continue;
    if (ch === '(') pc++;
    if (ch === ')') pc--;
    if (ch === '{') bc++;
    if (ch === '}') bc--;
    if (ch === '[') sc++;
    if (ch === ']') sc--;
  }
}
console.log('up to line', upto, 'parens:', pc, 'braces:', bc, 'brackets:', sc);

// print last 40 lines around error
const start = Math.max(0, 1700);
for (let i = start; i < Math.min(lines.length, 1740); i++) {
  console.log((i+1).toString().padStart(4,' ')+': '+lines[i]);
}
