import fs from 'fs';
import path from 'path';

const backendUrl = "const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';\\n        const token = localStorage.getItem('token');";
const headers = "headers: { 'Authorization': `Bearer \${token}`, 'Content-Type': 'application/json' }";

// 1. Refactor Home.tsx
const homePath = path.join(process.cwd(), 'src', 'components', 'Home.tsx');
let home = fs.readFileSync(homePath, 'utf8');
home = home.replace(/const docRef =.*?;[\s\S]*?const docSnap = await getDoc\(docRef\);[\s\S]*?if \(docSnap\.exists\(\)\) \{[\s\S]+?else \{[\s\S]+?\}\n\s*\}/g,
`       ${backendUrl}
        const res = await fetch(\`\${BACKEND_URL}/api/user/profile\`, { headers: { 'Authorization': \`Bearer \${token}\` }});
        const data = await res.json();
        if (data.favoriteCardId) {
            const card = RAY_CARDS.find(c => c.id === data.favoriteCardId);
            setFavoriteCard(card || RAY_CARDS[0]);
        } else {
            setFavoriteCard(RAY_CARDS[0]);
        }`);
fs.writeFileSync(homePath, home);

// 2. Refactor Profile.tsx
const profPath = path.join(process.cwd(), 'src', 'components', 'Profile.tsx');
let prof = fs.readFileSync(profPath, 'utf8');
prof = prof.replace(/const docRef =.*?;[\s\S]*?const docSnap = await getDoc\(docRef\);[\s\S]*?if \(docSnap\.exists\(\)\) \{[\s\S]+?else \{[\s\S]+?\}\n\s*\}/g,
`       ${backendUrl}
        const res = await fetch(\`\${BACKEND_URL}/api/user/profile\`, { headers: { 'Authorization': \`Bearer \${token}\` }});
        const data = await res.json();
        if (data.favoriteCardId) {
            setFavoriteCardId(data.favoriteCardId);
            setPreviewCard(RAY_CARDS.find(c => c.id === data.favoriteCardId) || null);
        }`);
prof = prof.replace(/await setDoc\(doc\(db,\s*'users',\s*user\.uid\),\s*\{\s*favoriteCardId:\s*cardId\s*\}\);/g,
`       ${backendUrl}
        await fetch(\`\${BACKEND_URL}/api/user/profile\`, { method: 'PUT', ${headers}, body: JSON.stringify({ favoriteCardId: cardId }) });`);
fs.writeFileSync(profPath, prof);

// 3. Refactor DeckBuilder.tsx
const dPath = path.join(process.cwd(), 'src', 'components', 'DeckBuilder.tsx');
let deck = fs.readFileSync(dPath, 'utf8');
deck = deck.replace(/const q = query\(collection.*?;\n\s*const snap = await getDocs\(q\);\n\s*const decks = snap.docs.map.*?\n/g,
`${backendUrl}
const res = await fetch(\`\${BACKEND_URL}/api/user/decks\`, { headers: { 'Authorization': \`Bearer \${token}\` }});
const data = await res.json();
const decks = data.decks as Deck[];\n`);
deck = deck.replace(/await updateDoc\(doc\(db.*?selectedDeckId\),\s*deckData\);/g,
`${backendUrl}
await fetch(\`\${BACKEND_URL}/api/user/decks/\${selectedDeckId}\`, { method: 'PUT', ${headers}, body: JSON.stringify(deckData) });`);
deck = deck.replace(/const docRef = await addDoc\(collection.*?\{[\s\S]*?\}\);[\s\S]*?setSelectedDeckId\(docRef\.id\);/g,
`${backendUrl}
const res = await fetch(\`\${BACKEND_URL}/api/user/decks\`, { method: 'POST', ${headers}, body: JSON.stringify(deckData) });
const data = await res.json();
setSelectedDeckId(data.id);`);
deck = deck.replace(/await deleteDoc\(doc\(db,.*?id\)\);/g,
`${backendUrl}
await fetch(\`\${BACKEND_URL}/api/user/decks/\${id}\`, { method: 'DELETE', headers: { 'Authorization': \`Bearer \${token}\` }});`);
deck = deck.replace(/await addDoc\(collection\(db,\s*`users\/\$\{getAuthUser\(\)\.uid\}\/decks`\),\s*copyData\);/g,
`${backendUrl}
await fetch(\`\${BACKEND_URL}/api/user/decks/\${savedDeck.id}/copy\`, { method: 'POST', headers: { 'Authorization': \`Bearer \${token}\` }});`);
deck = deck.replace(/await updateDoc\(doc\(db,\s*`users\/\$\{getAuthUser\(\)\.uid\}\/decks`.*?newName\s*\}\);/g,
`${backendUrl}
await fetch(\`\${BACKEND_URL}/api/user/decks/\${id}\`, { method: 'PUT', ${headers}, body: JSON.stringify({ name: newName }) });`);
fs.writeFileSync(dPath, deck);

console.log('Rest endpoints bound');
