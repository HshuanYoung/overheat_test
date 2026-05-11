import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LOCATION_LABELS: Record<string, string> = {
  HAND: '手牌',
  UNIT: '单位区',
  ITEM: '道具区',
  GRAVE: '墓地',
  EXILE: '放逐区',
  EROSION_FRONT: '侵蚀区(正)',
  EROSION_BACK: '侵蚀区(背)',
  PLAY: '处理中',
  DECK: '牌库'
};

const CARD_TYPE_LABELS: Record<string, string> = {
  UNIT: '单位',
  ITEM: '道具',
  STORY: '故事'
};

const CARD_COLOR_LABELS: Record<string, string> = {
  RED: '红',
  BLUE: '蓝',
  GREEN: '绿',
  YELLOW: '黄',
  WHITE: '白',
  NONE: '无'
};

const PHASE_LABELS: Record<string, string> = {
  RPS: '猜拳阶段',
  FIRST_PLAYER_CHOICE: '先后攻选择',
  START: '开始阶段',
  DRAW: '抽牌阶段',
  EROSION: '侵蚀阶段',
  MAIN: '主要阶段',
  BATTLE_DECLARATION: '攻击宣言',
  DEFENSE_DECLARATION: '防御宣言',
  BATTLE_FREE: '战斗自由',
  DAMAGE_CALCULATION: '伤害结算',
  COUNTERING: '对抗阶段',
  END: '结束阶段',
  DISCARD: '弃牌阶段',
  MULLIGAN: '调度阶段',
  SHENYI_CHOICE: '神依选择'
};

export function getCardImageUrl(
  cardId: string,
  rarity: string,
  _thumbnail: boolean = false,
  availableRarities: string[] = []
) {
  const rarityUpper = (rarity || 'C').toUpperCase();
  const normalizedRarities = availableRarities.map(r => (r || '').toUpperCase()).filter(Boolean);
  const hasMultipleRarities = normalizedRarities.length > 1;
  const baseRarity = normalizedRarities[0];
  const rarityPath = hasMultipleRarities && rarityUpper !== baseRarity ? `/${rarityUpper}` : '';

  return `/pics${rarityPath}/${cardId}.jpg`;
}

export function getLocationLabel(location?: string | null): string {
  if (!location) return '未知';
  return LOCATION_LABELS[location] || location;
}

export function getCardTypeLabel(type?: string | null): string {
  if (!type) return '未知';
  return CARD_TYPE_LABELS[type] || type;
}

export function getCardColorLabel(color?: string | null): string {
  if (!color) return '未知';
  return CARD_COLOR_LABELS[color] || color;
}

export function getPhaseLabel(phase?: string | null): string {
  if (!phase) return '未知阶段';
  return PHASE_LABELS[phase] || phase.replace(/_/g, ' ');
}

export function getCardIdentity(gameState: any, playerUid: string, card: any): string {
  if (!card) return '[未知]';

  const player = gameState.players[playerUid];
  const loc = getLocationLabel(card.cardlocation);
  const ownerLabel = player ? (player.displayName || '玩家') : '未知';

  return `[${ownerLabel}|${loc}]`;
}
