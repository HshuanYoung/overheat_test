import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'server', 'ServerGameService.ts');
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/const '' = Math\.random\(\)\.toString\(36\)\.substring\(7\);/g, "const tempId = Math.random().toString(36).substring(7);");
text = text.replace(/const '' = 'practice_' \+ Math\.random\(\)\.toString\(36\)\.substring\(7\);/g, "const tempId = 'practice_' + Math.random().toString(36).substring(7);");
text = text.replace(/\{\s*'',\s*phase:/g, "{ id: tempId, phase:");

fs.writeFileSync(file, text);
