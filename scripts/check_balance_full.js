const fs = require('fs');
const path = 'c:/Users/Elija/OneDrive/Documents/crm/greentree-crm/src/app/page.js';
const s = fs.readFileSync(path, 'utf8');
const lines = s.split(/\r?\n/);
let pc = 0, bc = 0, sc = 0;
let maxPc = 0, maxBc = 0, maxLinePc = 0, maxLineBc = 0;
for (let i = 0; i < lines.length; i++) {
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
  if (i === 1724) console.log('at 1725 =>', 'parens', pc, 'braces', bc, 'brackets', sc);
  if (pc > maxPc) { maxPc = pc; maxLinePc = i+1; }
  if (bc > maxBc) { maxBc = bc; maxLineBc = i+1; }
}
console.log('total parens:', pc, 'braces:', bc, 'brackets:', sc);
console.log('max paren depth', maxPc, 'at line', maxLinePc);
console.log('max brace depth', maxBc, 'at line', maxLineBc);
