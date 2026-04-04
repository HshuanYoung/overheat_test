import fs from 'fs';
import path from 'path';

const battlePath = path.join(process.cwd(), 'src', 'components', 'BattleField.tsx');
let content = fs.readFileSync(battlePath, 'utf-8');

// Replace Firebase imports
content = content.replace(/import { onSnapshot, doc, updateDoc, arrayUnion } from 'firebase\/firestore';\n/, '');
content = content.replace(/import { db, auth } from '\.\.\/firebase';\n/, '');

// Add socket imports
content = content.replace(/import { GameState.* } from '\.\.\/types\/game';/, "import { GameState, PlayerState, Card, StackItem, CardEffect, TriggerLocation } from '../types/game';\nimport { socket, getAuthUser } from '../socket';");

// Replace auth instance usage
content = content.replace(/auth\.currentUser\?/g, 'getAuthUser()?');
content = content.replace(/auth\.currentUser/g, 'getAuthUser()');

// Replace GameService direct calls with socket.emit
content = content.replace(/GameService\.resolvePlay\(gameId\);/g, "socket.emit('gameAction', { gameId, action: 'RESOLVE_PLAY' });");
content = content.replace(/GameService\.botMove\(gameId\);/g, "// Bot moves must be moved to backend entirely based on game state loops, or emitted");
content = content.replace(/GameService\.playCard\(gameId,\s*([^,]+),\s*([^)]+)\);/g, "socket.emit('gameAction', { gameId, action: 'PLAY_CARD', payload: { cardId: $1, paymentSelection: $2 } });");
content = content.replace(/GameService\.declareAttack\(gameId,\s*([^,]+),\s*([^)]+)\);/g, "socket.emit('gameAction', { gameId, action: 'DECLARE_ATTACK', payload: { attackerIds: $1, isAlliance: $2 } });");
content = content.replace(/GameService\.declareDefense\(gameId,\s*([^)]+)\);/g, "socket.emit('gameAction', { gameId, action: 'DECLARE_DEFENSE', payload: { defenderId: $1 } });");
content = content.replace(/GameService\.resolveDamage\(gameId\);/g, "socket.emit('gameAction', { gameId, action: 'RESOLVE_DAMAGE' });");
content = content.replace(/GameService\.advancePhase\(gameId,\s*([^)]+)\);/g, "socket.emit('gameAction', { gameId, action: 'ADVANCE_PHASE', payload: { action: $1 } });");

// Replace onSnapshot with socket.on
content = content.replace(/const unsubscribe = onSnapshot\(doc\(db, 'games', gameId\), \(doc\) => {\s*if \(doc\.exists\(\)\) {\s*setGame\(doc\.data\(\) as GameState\);\s*}\s*}\);\s*return \(\) => unsubscribe\(\);/gs, 
"socket.emit('joinGame', gameId);\nsocket.on('gameStateUpdate', (newState) => { setGame(newState); });\nreturn () => { socket.off('gameStateUpdate'); };");

// Fix `import { GameService, cleanForFirestore } from '../services/gameService';` -> Remove it since we moved it to backend
content = content.replace(/import { GameService, cleanForFirestore } from '\.\.\/services\/gameService';\n/, '');
content = content.replace(/import { GameService } from '\.\.\/services\/gameService';\n/, '');

fs.writeFileSync(battlePath, content);
console.log('BattleField.tsx refactored');

const matchPath = path.join(process.cwd(), 'src', 'components', 'Matchmaking.tsx');
let matchContent = fs.readFileSync(matchPath, 'utf-8');
matchContent = matchContent.replace(/import { db, auth } from '\.\.\/firebase';\n/, '');
matchContent = matchContent.replace(/import { .* } from 'firebase\/firestore';\n/, '');
matchContent = matchContent.replace(/auth\.currentUser/g, 'getAuthUser()');

matchContent = matchContent.replace(/const createGame = async \(\) => \{.+?\};/s, 
`const createGame = async () => {
    try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(\`\${BACKEND_URL}/api/games\`, {
            method: 'POST',
            headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
        });
        const data = await res.json();
        if (data.gameId) navigate(\`/battle/\${data.gameId}\`);
    } catch (e) {
        console.error(e);
    }
};`);
matchContent = matchContent.replace(/import { getAuthUser } from '\.\.\/socket';/, '');
matchContent = matchContent.replace(/import React, { useState } from 'react';/, "import React, { useState } from 'react';\nimport { getAuthUser } from '../socket';");

fs.writeFileSync(matchPath, matchContent);
console.log('Matchmaking.tsx refactored');
