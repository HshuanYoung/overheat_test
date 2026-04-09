/// <reference types="vite/client" />
import { Card } from '../types/game';

// Dynamically load all card scripts from the scripts directory
const cardModules = import.meta.glob('../scripts/*.ts', { eager: true });

export const CARD_LIBRARY: Card[] = Object.values(cardModules).flatMap((module: any) => {
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
