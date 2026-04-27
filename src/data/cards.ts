/// <reference types="vite/client" />
import { Card } from '../types/game';

// Dynamically load all card scripts from the scripts directory
const cardModules = import.meta.glob('../scripts/*.ts', { eager: true });

const isCardModule = (module: any): module is { default: Card } =>
  !!module?.default &&
  typeof module.default === 'object' &&
  typeof module.default.id === 'string';

export const CARD_LIBRARY: Card[] = Object.values(cardModules).flatMap((module: any): Card[] => {
  if (!isCardModule(module)) {
    return [];
  }

  const baseCard = module.default;
  if (baseCard.availableRarities && baseCard.availableRarities.length > 0) {
    return baseCard.availableRarities.map((r: any) => ({
      ...baseCard,
      rarity: r,
      uniqueId: `${baseCard.id}:${r}`
    }));
  }
  return [{
    ...baseCard,
    uniqueId: `${baseCard.id}:${baseCard.rarity}`
  }];
});

export const CARD_BY_UNIQUE_ID = new Map<string, Card>();
const CARD_BY_REFERENCE = new Map<string, Card>();

for (const card of CARD_LIBRARY) {
  CARD_BY_UNIQUE_ID.set(card.uniqueId, card);

  if (!CARD_BY_REFERENCE.has(card.uniqueId)) {
    CARD_BY_REFERENCE.set(card.uniqueId, card);
  }

  if (!CARD_BY_REFERENCE.has(card.id)) {
    CARD_BY_REFERENCE.set(card.id, card);
  }
}

export function getCardByReference(cardId?: string | null) {
  if (!cardId) {
    return undefined;
  }

  return CARD_BY_REFERENCE.get(cardId);
}
