import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCardImageUrl(cardId: string, rarity: string, thumbnail: boolean = false) {
  const rarityUpper = (rarity || 'C').toUpperCase();
  const base = '/pics';
  if (thumbnail) {
    return `${base}/${rarityUpper}/thumbnail/${cardId}.jpg`;
  }
  return `${base}/${rarityUpper}/${cardId}.jpg`;
}
