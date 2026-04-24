import { Card, GameState, PlayerState, CardEffect } from '../types/game';

const effect_204000026_counter: CardEffect = {
  id: 'gensou_swallow_counter',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  erosionBackLimit: [2, 10],
  description: '【启】手牌中：若我侵蚀区域背面卡牌在2张或以上，对手使用故事卡时：使该故事卡发动无效并送入墓地。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    if (gameState.phase !== 'COUNTERING') return false;

    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    return gameState.counterStack.some(item =>
      item.type === 'PLAY' &&
      item.ownerUid === opponentId &&
      item.card?.type === 'STORY' &&
      !item.isNegated
    );
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid)!;
    let found = false;

    for (let i = gameState.counterStack.length - 1; i >= 0; i--) {
      const item = gameState.counterStack[i];
      const isStory = item.card?.type === 'STORY';
      const isOpponent = item.ownerUid === opponentId;

      if ((item.type === 'PLAY' || item.type === 'EFFECT') && isOpponent && isStory && !item.isNegated) {
        item.isNegated = true;
        found = true;
        gameState.logs.push(`[${instance.fullName}] 成功拦截并使对手的 [${item.card?.fullName || '故事卡'}] 发动无效。`);
        break;
      }
    }

    if (!found) {
      gameState.logs.push(`[${instance.fullName}] 未能在连锁中找到有效的故事卡发动。`);
    }
  }
};

const card: Card = {
  id: '204000026',
  gamecardId: null as any,
  fullName: '吞噬幻想',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 2,
  power: 0,
  basePower: 0,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: false,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_204000026_counter],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null,
};

export default card;
