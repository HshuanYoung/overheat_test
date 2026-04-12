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

export function getCardIdentity(gameState: any, playerUid: string, card: any): string {
  if (!card) return '[未知]';
  
  const player = gameState.players[playerUid];
  
  const locationMap: Record<string, string> = {
    'HAND': '手牌',
    'UNIT': '单位区',
    'ITEM': '道具区',
    'GRAVE': '墓地',
    'EXILE': '离场区',
    'EROSION_FRONT': '侵蚀区(正)',
    'EROSION_BACK': '侵蚀区(背)',
    'PLAY': '决斗场',
    'DECK': '卡组'
  };

  const loc = locationMap[card.cardlocation] || card.cardlocation || '未知';
  const ownerLabel = player ? (player.displayName || '玩家') : '未知';

  return `[${ownerLabel}|${loc}]`;
}
