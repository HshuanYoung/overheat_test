import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src', 'components', 'BattleField.tsx');
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/try {\s*await updateDoc\(doc\(db,\s*'games',\s*gameId\),\s*cleanForFirestore\(game\)\);\s*}\s*catch\s*\(error\)\s*{\s*console.error\("Error activating ability:",\s*error\);\s*}/g, 
`try {
    socket.emit('gameAction', { gameId, action: 'ACTIVATE_EFFECT', payload: { cardId: card.gamecardId, effectIndex: effectIndex } });
} catch (error) {
    console.error("Error activating ability:", error);
}`);

text = text.replace(/payload:\s*\{\s*cardId:\s*myUid,\s*paymentSelection:\s*pendingPlayCard\.gamecardId,\s*\{/g, 'payload: { cardId: pendingPlayCard.gamecardId, paymentSelection: {');

fs.writeFileSync(file, text);
console.log('Fixed BattleField');
