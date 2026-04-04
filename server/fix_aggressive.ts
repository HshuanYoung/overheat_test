import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let text = fs.readFileSync(filePath, 'utf8');
    
    // Remove ALL imports from ../firebase
    text = text.split('\n').filter(line => !line.includes("'../firebase';") && !line.includes('"../firebase";')).join('\n');
    
    fs.writeFileSync(filePath, text);
}

// 1. Fix Firebase imports across the whole project
const dir = path.join(process.cwd(), 'src', 'components');
fs.readdirSync(dir).forEach(file => {
    fixFile(path.join(dir, file));
});
fixFile(path.join(process.cwd(), 'src', 'services', 'gameService.ts'));
fixFile(path.join(process.cwd(), 'server', 'ServerGameService.ts'));

// 2. Fix ServerGameService ts errors
const sgsPath = path.join(process.cwd(), 'server', 'ServerGameService.ts');
let sgs = fs.readFileSync(sgsPath, 'utf8');
sgs = sgs.replace(/\{\s*'id':\s*tempId,/g, "{");
sgs = sgs.replace(/\{\s*id:\s*tempId,/g, "{");
fs.writeFileSync(sgsPath, sgs);

// 3. Fix gameService.ts lingering gameSnap errors
const gsPath = path.join(process.cwd(), 'src', 'services', 'gameService.ts');
let gs = fs.readFileSync(gsPath, 'utf8');
gs = gs.replace(/const gameSnap = null/g, "const gameSnap = null as any");
gs = gs.replace(/const gameRef = null/g, "const gameRef = null as any");
fs.writeFileSync(gsPath, gs);

// 4. Fix BattleField paymentSelection duplicate key
const bfPath = path.join(process.cwd(), 'src', 'components', 'BattleField.tsx');
let bf = fs.readFileSync(bfPath, 'utf8');
bf = bf.replace(/payload:\s*\{\s*cardId:\s*pendingPlayCard\.gamecardId,\s*paymentSelection:\s*pendingPlayCard\.gamecardId,/g, "payload: { cardId: pendingPlayCard.gamecardId,");
fs.writeFileSync(bfPath, bf);

console.log('Fixed TS errors aggressively');
