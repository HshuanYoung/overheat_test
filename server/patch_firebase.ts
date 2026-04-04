import fs from 'fs';
import path from 'path';

const gamePath = path.join(process.cwd(), 'src', 'services', 'gameService.ts');
let content = fs.readFileSync(gamePath, 'utf-8');

// Strip out firebase and firestore imports
content = content.replace(/import\s+\{[^}]+\}\s+from\s+'firebase\/firestore';\n/, '');
content = content.replace(/import\s+\{ db, auth \}\s+from\s+'\.\.\/firebase';\n/, '');

// Replace `cleanForFirestore` with a simple deep copy using JSON since we don't need Date for tests yet
content = content.replace(/export function cleanForFirestore\(obj: any\): any \{[\s\S]+?return obj;\n\}/, 'export function cleanForFirestore(obj: any): any { return JSON.parse(JSON.stringify(obj)); }');

// Stub out all the db calls inside GameService to do nothing or throw
content = content.replace(/const gameRef[^\n]+/g, '// Stubbed');
content = content.replace(/const gameSnap = await getDoc[^\n]+/g, '// Stubbed');
content = content.replace(/if \(!gameSnap.*?\)\s*\{[^\}]+\}/g, '// Stubbed');
content = content.replace(/const gameState = gameSnap.data[^\n]+/g, 'const gameState: any = {}; // Stubbed');
content = content.replace(/await setDoc\(.*?\);/g, '// Stubbed');
content = content.replace(/await updateDoc\(.*?\);/g, '// Stubbed');

fs.writeFileSync(gamePath, content);
console.log('gameService.ts patched for frontend');
