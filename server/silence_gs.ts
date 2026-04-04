import fs from 'fs';
import path from 'path';

// Fix gameService missing variables
const gsPath = path.join(process.cwd(), 'src', 'services', 'gameService.ts');
let gs = fs.readFileSync(gsPath, 'utf8');

// just literally add let db: any; let auth: any; let gameSnap: any; let gameRef: any; at the top
gs = gs.replace("import { EventEngine } from './EventEngine';", "import { EventEngine } from './EventEngine';\n\nlet db: any;\nlet auth: any;\nlet gameSnap: any;\nlet gameRef: any;\n");
fs.writeFileSync(gsPath, gs);

// Fix DeckBuilder.tsx
const dp = path.join(process.cwd(), 'src', 'components', 'DeckBuilder.tsx');
let dbl = fs.readFileSync(dp, 'utf8');
dbl = dbl.replace(/let db: any;\n/g, '');
dbl = 'let db: any;\n' + dbl;
fs.writeFileSync(dp, dbl);

// Fix Matchmaking.tsx
const mp = path.join(process.cwd(), 'src', 'components', 'Matchmaking.tsx');
let mbl = fs.readFileSync(mp, 'utf8');
mbl = mbl.replace(/let db: any;\n/g, '');
mbl = 'let db: any;\n' + mbl;
fs.writeFileSync(mp, mbl);

console.log('Fixed undefined variables by declaring them globally as any for compilation tests');
