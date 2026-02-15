const fs = require('fs');
const path = 'c:/Users/Elija/OneDrive/Documents/crm/greentree-crm/src/app/page.js';
const s = fs.readFileSync(path, 'utf8');
const lines = s.split(/\r?\n/);
const stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inS = false, inD = false, inT = false, esc = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === "'" && !inD && !inT) { inS = !inS; continue; }
    if (ch === '"' && !inS && !inT) { inD = !inD; continue; }
    if (ch === '`' && !inS && !inD) { inT = !inT; continue; }
    if (inS || inD || inT) continue;
    if (ch === '(') stack.push({tok:'(', line:i+1, col:j+1});
    else if (ch === '{') stack.push({tok:'{', line:i+1, col:j+1});
    else if (ch === '[') stack.push({tok:'[', line:i+1, col:j+1});
    else if (ch === ')') {
      if (stack.length && stack[stack.length-1].tok === '(') stack.pop(); else stack.push({tok:')', line:i+1, col:j+1});
    }
    else if (ch === '}') {
      if (stack.length && stack[stack.length-1].tok === '{') stack.pop(); else stack.push({tok:'}', line:i+1, col:j+1});
    }
    else if (ch === ']') {
      if (stack.length && stack[stack.length-1].tok === '[') stack.pop(); else stack.push({tok:']', line:i+1, col:j+1});
    }
  }
}
console.log('Unclosed stack (bottom->top):');
console.log(stack);
if (stack.length) {
  console.log('Last unclosed token on stack:', stack[stack.length-1]);
}
