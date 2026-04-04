import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'server', 'ServerGameService.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Remove firebase imports
content = content.replace(/import\s+\{([^}]+)\}\s+from\s+'firebase\/firestore';\n/, '');
content = content.replace(/import\s+\{\s*db,\s*auth\s*\}\s+from\s+'\.\.\/firebase';\n/, '');

// 2. Rename GameService to ServerGameService
content = content.replace(/export const GameService = \{/, 'export const ServerGameService = {');

// 3. Transform API signatures: gameId: string -> gameState: GameState
content = content.replace(/async\s+([a-zA-Z0-9_]+)\(gameId:\s*string(,\s*)?/g, 'async $1(gameState: GameState$2');

// 4. Remove Firestore fetch block
const fetchBlockRegex = /\s*const\s+gameRef\s*=\s*doc\(db,\s*GAMES_COLLECTION,\s*gameId\);\s*const\s+gameSnap\s*=\s*await\s+getDoc\(gameRef\);\s*if\s*\(!gameSnap.exists\(\)\)\s*(throw new Error\('[^']+'\)|return);\s*const\s+gameState\s*=\s*gameSnap.data\(\)\s*as\s*GameState;/g;
content = content.replace(fetchBlockRegex, '');

// 5. Replace await setDoc(gameRef, cleanForFirestore(gameState)); with return gameState;
content = content.replace(/await\s+setDoc\(gameRef,\s*cleanForFirestore\(gameState\)\);/g, 'return gameState;');
content = content.replace(/await\s+setDoc\(gameRef,\s*(gameState)\);/g, 'return gameState;');

// 6. remove Firestore cleanForFirestore usages
content = content.replace(/cleanForFirestore\(gameState\)/g, 'gameState');

fs.writeFileSync(filePath, content);
console.log('Transformation complete');
