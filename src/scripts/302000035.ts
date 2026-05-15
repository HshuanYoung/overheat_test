import { Card, GameState, PlayerState, CardEffect } from '../types/game';

const effectDamageBoost: CardEffect = {
  id: '302000035_boost',
  type: 'CONTINUOUS',
  description: '【永续】在你的回合，由你的卡牌给对方造成的各种效果伤害增加1。',
  applyContinuous: (gameState: GameState, card: Card) => {
    // Find owner
    let owner: PlayerState | undefined;
    for (const uid of Object.keys(gameState.players)) {
      const p = gameState.players[uid];
      const hasCard = p.itemZone.some(c => c && c.gamecardId === card.gamecardId);
      if (hasCard) {
        owner = p;
        break;
      }
    }

    if (owner && owner.isTurn) {
      owner.effectDamageModifier = (owner.effectDamageModifier || 0) + 1;
    }
  }
};

const card: Card = {
  id: '302000035',
  fullName: '燃魂魔剑',
  specialName: '燃魂魔剑',
  type: 'ITEM',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effectDamageBoost],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
