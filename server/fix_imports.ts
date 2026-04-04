import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'server', 'ServerGameService.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix imports
content = content.replace(/import\s+.*from\s+'\.\.\/firebase';\n/, '');
content = content.replace(/import\s+\{\s*GameState.*\}\s+from\s+'\.\.\/types\/game';/, "import { GameState, PlayerState, Card, Deck, TriggerLocation, CardEffect } from '../src/types/game';");
content = content.replace(/import\s+\{\s*CARD_LIBRARY.*\}\s+from\s+'\.\.\/data\/cards';/, "import { CARD_LIBRARY } from '../src/data/cards';");
content = content.replace(/import\s+\{\s*EventEngine.*\}\s+from\s+'\.\/EventEngine';/, "import { EventEngine } from '../src/services/EventEngine';");

// Fix lingering gameId variables
content = content.replace(/this\.handleErosionChoice\(\s*gameId/g, 'this.handleErosionChoice(gameState');
content = content.replace(/this\.executeStartPhase\(\s*gameId/g, 'this.executeStartPhase(gameState');
content = content.replace(/this\.executeDrawPhase\(\s*gameId/g, 'this.executeDrawPhase(gameState');
content = content.replace(/this\.executeErosionPhase\(\s*gameId/g, 'this.executeErosionPhase(gameState');

fs.writeFileSync(filePath, content);
console.log('Fixed imports and residual gameIds');
