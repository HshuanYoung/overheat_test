import fs from 'fs';
import path from 'path';

// Fix Matchmaking
const mp = path.join(process.cwd(), 'src', 'components', 'Matchmaking.tsx');
let m = fs.readFileSync(mp, 'utf8');
m = m.replace(
`    const q = query(collection(db, 'games'), where('status', '==', 'WAITING'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWaitingGames(games);
    });
    return () => unsubscribe();`,
`    const fetchGames = async () => {
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(BACKEND_URL + '/api/games');
        const data = await res.json();
        setWaitingGames(data.games || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);`
);
m = m.replace(
`    const loadDecks = async () => {
      if (!getAuthUser()) return;
      const q = query(collection(db, \`users/\${getAuthUser().uid}/decks\`));
      const snap = await getDocs(q);
      const decks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Deck));
      setMyDecks(decks);
      if (decks.length > 0) setSelectedDeckId(decks[0].id);
    };`,
`    const loadDecks = async () => {
      if (!getAuthUser()) return;
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const res = await fetch(BACKEND_URL + '/api/user/decks', { headers: { 'Authorization': \`Bearer \${token}\` }});
      const data = await res.json();
      setMyDecks(data.decks || []);
      if (data.decks?.length > 0) setSelectedDeckId(data.decks[0].id);
    };`
);
fs.writeFileSync(mp, m);

// Fix Profile
const pp = path.join(process.cwd(), 'src', 'components', 'Profile.tsx');
let p = fs.readFileSync(pp, 'utf8');
p = p.replace(
`      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNickname(data.displayName || user.displayName || 'User');
        setFavoriteCardId(data.favoriteCardId || null);
      }`,
`      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const res = await fetch(BACKEND_URL + '/api/user/profile', { headers: { 'Authorization': \`Bearer \${token}\` }});
      const data = await res.json();
      setFavoriteCardId(data.favoriteCardId || null);`
);
p = p.replace(
`      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: nickname,
        favoriteCardId: favoriteCardId,
        updatedAt: Date.now()
      }, { merge: true });`,
`      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      await fetch(BACKEND_URL + '/api/user/profile', { method: 'PUT', headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ favoriteCardId }) });`
);
fs.writeFileSync(pp, p);

// Fix Home
const homep = path.join(process.cwd(), 'src', 'components', 'Home.tsx');
let hm = fs.readFileSync(homep, 'utf8');
hm = hm.replace(
`        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.favoriteCardId) {
            const card = RAY_CARDS.find(c => c.id === data.favoriteCardId);
            if (card) {
              setFavoriteCard(card);
            } else {
              setFavoriteCard(RAY_CARDS[0]);
            }
          } else {
            setFavoriteCard(RAY_CARDS[0]);
          }
        } else {
          setFavoriteCard(RAY_CARDS[0]);
        }`,
`        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const token = localStorage.getItem('token');
        const res = await fetch(\`\${BACKEND_URL}/api/user/profile\`, { headers: { 'Authorization': \`Bearer \${token}\` }});
        const data = await res.json();
        if (data.favoriteCardId) {
            const card = RAY_CARDS.find(c => c.id === data.favoriteCardId);
            setFavoriteCard(card || RAY_CARDS[0]);
        } else {
            setFavoriteCard(RAY_CARDS[0]);
        }`
);
fs.writeFileSync(homep, hm);

// We should also scrub whatever DeckBuilder still has because it was corrupted.
// I will just download a safe version or scrub it heavily.
const dp = path.join(process.cwd(), 'src', 'components', 'DeckBuilder.tsx');
let dbf = fs.readFileSync(dp, 'utf8');
dbf = dbf.replace(/const q = query\(collection.*?;\s*const snap = await getDocs\(q\);\s*const decks = snap\.docs\.map.*?;\s*/s,
`    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');
    const res = await fetch(BACKEND_URL + '/api/user/decks', { headers: { 'Authorization': \`Bearer \${token}\` }});
    const data = await res.json();
    const decks: Deck[] = data.decks || [];\n    `);
dbf = dbf.replace(/await updateDoc\(doc\(db,\s*`users.*?\),\s*deckData\);/s,
`const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const token = localStorage.getItem('token');
        await fetch(BACKEND_URL + '/api/user/decks/' + selectedDeckId, { method: 'PUT', headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify(deckData) });`);

dbf = dbf.replace(/const docRef = await addDoc\(collection\(db,\s*`users.*?\),\s*\{\s*\.\.\.deckData,\s*createdAt:\s*Date\.now\(\)\s*\}\);/s,
`const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const token = localStorage.getItem('token');
        const res = await fetch(BACKEND_URL + '/api/user/decks', { method: 'POST', headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify(deckData) });
        const data = await res.json();
        const docRef = { id: data.id };`);

dbf = dbf.replace(/await deleteDoc\(doc\(db,\s*`users.*?\),\s*id\)\);/s,
`const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');
    await fetch(BACKEND_URL + '/api/user/decks/' + id, { method: 'DELETE', headers: { 'Authorization': \`Bearer \${token}\` }});`);

dbf = dbf.replace(/await updateDoc\(doc\(db,\s*`users.*?\),\s*\{\s*name:\s*newName\s*\}\);/s,
`const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');
    await fetch(BACKEND_URL + '/api/user/decks/' + id, { method: 'PUT', headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });`);

// The previous script wrote crazy string interpolations on line 50. Let's just strip 'db' usages out entirely natively
fs.writeFileSync(dp, dbf);
