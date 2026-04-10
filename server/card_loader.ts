import fs from 'fs';
import path from 'path';
import { Card } from '../src/types/game';

const SCRIPTS_DIR = path.join(process.cwd(), 'src', 'scripts');

export async function loadServerCards(): Promise<Card[]> {
  const cards: Card[] = [];
  const files = fs.readdirSync(SCRIPTS_DIR);
  
  for (const file of files) {
    if (file.endsWith('.ts')) {
      const cardModule = await import(`../src/scripts/${file}`);
      if (cardModule.default) {
        const baseCard = cardModule.default;
        if (baseCard.availableRarities && baseCard.availableRarities.length > 0) {
          baseCard.availableRarities.forEach((r: any) => {
            cards.push({
              ...baseCard,
              rarity: r,
              uniqueId: `${baseCard.id}:${r}`
            });
          });
        } else {
          cards.push({
            ...baseCard,
            uniqueId: `${baseCard.id}:${baseCard.rarity}`
          });
        }
      }
    }
  }
  return cards;
}

// Map by unique ID for fast lookup
export let SERVER_CARD_LIBRARY: Record<string, Card> = {};

export async function initServerCardLibrary() {
  const cards = await loadServerCards();
  for (const c of cards) {
    SERVER_CARD_LIBRARY[c.uniqueId] = c;
    // Map by base ID as well if it doesn't exist yet (for legacy compat)
    if (!SERVER_CARD_LIBRARY[c.id]) {
      SERVER_CARD_LIBRARY[c.id] = c;
    }
  }
  console.log(`[Server] Loaded ${cards.length} card variations into library.`);
}
