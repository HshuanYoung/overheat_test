import fs from 'fs';
import path from 'path';

const matchPath = path.join(process.cwd(), 'src', 'components', 'Matchmaking.tsx');
let match = fs.readFileSync(matchPath, 'utf8');

match = match.replace(/import \{ collection, query, where, onSnapshot, getDocs \} from 'firebase\/firestore';\n/, '');
match = match.replace(/const q = query\(collection\(db,\s*'games'\),\s*where\('status',\s*'==',\s*'WAITING'\)\);\s*const unsubscribe = onSnapshot\(q.*?\)\);\s*return \(\) => unsubscribe\(\);/gs, 
`const fetchGames = async () => {
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(\`\${BACKEND_URL}/api/games\`);
        const data = await res.json();
        setWaitingGames(data.games || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);`);

match = match.replace(/const loadDecks = async \(\) => \{\s*if \(\!getAuthUser\(\)\) return;\s*const q = query\(collection\(db,\s*`users\/\$\{getAuthUser\(\)\.uid\}\/decks`\)\);\s*const snap = await getDocs\(q\);\s*const decks = snap\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as Deck\)\);\s*setMyDecks\(decks\);\s*if \(decks\.length > 0\) setSelectedDeckId\(decks\[0\]\.id\);\s*\};/g,
`const loadDecks = async () => {
      if (!getAuthUser()) return;
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const res = await fetch(\`\${BACKEND_URL}/api/user/decks\`, { headers: { 'Authorization': \`Bearer \${token}\` }});
      const data = await res.json();
      setMyDecks(data.decks || []);
      if (data.decks?.length > 0) setSelectedDeckId(data.decks[0].id);
    };`);

match = match.replace(/await GameService\.createGame\(cards\)/g, "await fetch(import.meta.env.VITE_BACKEND_URL + '/api/games', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).then(d => d.gameId)");
match = match.replace(/await GameService\.createPracticeGame\(cards\)/g, "await fetch(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001' + '/api/games', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).then(d => d.gameId)");
match = match.replace(/await GameService\.joinGame\(gameId, cards\)/g, "");

fs.writeFileSync(matchPath, match);

// And we need to add the endpoint GET /api/games
const index = path.join(process.cwd(), 'server', 'index.ts');
let st = fs.readFileSync(index, 'utf8');
st = st.replace(/\/\/ Socket\.IO logic/g, 
`app.get('/api/games', async (req, res): Promise<void> => {
    try {
        const rows = await pool.query('SELECT * FROM games WHERE status = 0');
        const games = rows.map((r: any) => ({
             id: r.id, 
             ...(typeof r.state === 'string' ? JSON.parse(r.state) : r.state)
        }));
        res.json({ games });
    } catch (e) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Socket.IO logic`);
fs.writeFileSync(index, st);

// Finally, strip the dummy db leftovers from profile and home
function stripDb(p) {
    if(!fs.existsSync(p)) return;
    let text = fs.readFileSync(p, 'utf8');
    text = text.replace(/import\s*\{\s*doc.*?\}\s*from\s*'firebase\/firestore';\n/g, '');
    fs.writeFileSync(p, text);
}
stripDb(path.join(process.cwd(), 'src', 'components', 'Profile.tsx'));
stripDb(path.join(process.cwd(), 'src', 'components', 'Home.tsx'));
stripDb(path.join(process.cwd(), 'src', 'components', 'DeckBuilder.tsx'));
stripDb(path.join(process.cwd(), 'src', 'components', 'BattleField.tsx'));

console.log('Matchmaking and remaining errors patched.');
