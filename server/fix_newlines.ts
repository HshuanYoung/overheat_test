import fs from 'fs';
import path from 'path';

function fixNewlines(filePath) {
    if (!fs.existsSync(filePath)) return;
    let text = fs.readFileSync(filePath, 'utf8');
    text = text.replace(/\\n\s*const token/g, "\n        const token");
    fs.writeFileSync(filePath, text);
}

fixNewlines(path.join(process.cwd(), 'src', 'components', 'Home.tsx'));
fixNewlines(path.join(process.cwd(), 'src', 'components', 'Profile.tsx'));
fixNewlines(path.join(process.cwd(), 'src', 'components', 'DeckBuilder.tsx'));

console.log('Fixed newlines');
