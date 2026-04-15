import { Card, GameState, PlayerState, CardEffect } from '../types/game';

const continuous_10400033_1: CardEffect = {
  id: '10400033_continuous_1',
  type: 'CONTINUOUS',
  description: '【永】若你的手牌有3张或以上，这个单位的力量+500。',
  applyContinuous: (gameState: GameState, card: Card) => {
    // Determine the owner by checking unit zones
    const playerUid = Object.keys(gameState.players).find(uid =>
      gameState.players[uid].unitZone.some(u => u?.gamecardId === card.gamecardId)
    );

    if (!playerUid) return;
    const player = gameState.players[playerUid];

    if (player.hand.length >= 3) {
      card.power = (card.power || 0) + 500;
      if (!card.influencingEffects) card.influencingEffects = [];
      card.influencingEffects.push({
        sourceCardName: card.fullName,
        description: '力量+500 (手牌3张或以上)'
      });
    }
  }
};

const card: Card = {
  id: '10400033',
  fullName: '普尔式·变色龙',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [continuous_10400033_1],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
