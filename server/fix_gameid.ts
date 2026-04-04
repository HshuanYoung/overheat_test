import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'server', 'ServerGameService.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace usages of gameId being passed recursively
content = content.replace(/this\.([a-zA-Z0-9_]+)\(\s*gameId/g, 'this.$1(gameState');

fs.writeFileSync(filePath, content);
console.log('Fixed recursive gameId calls');
