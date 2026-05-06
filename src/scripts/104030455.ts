import { Card, GameState, PlayerState, CardEffect } from '../types/game';

const effect_104030455: CardEffect = {
  id: 'union_evangelist_erosion_keep',
  type: 'CONTINUOUS',
  description: '【持续】在你的侵蚀阶段，当侵蚀区正面的卡牌即将送入墓地时，你可以从中选择一张保留在侵蚀区。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    return gameState.phase === 'EROSION' && gameState.players[gameState.playerIds[gameState.currentTurnPlayer]].uid === playerState.uid;
  },
  erosionKeepReplacement: true
};

const card: Card = {
  id: '104030455',
  gamecardId: null as any,
  fullName: '公会的传道者【白夜】',
  specialName: '白夜',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: {},
  faction: '冒险家公会',
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
  effects: [
    effect_104030455
  ],
  rarity: 'PR',
  availableRarities: ['PR'],
  cardPackage: 'BT04',
  uniqueId: null,
};

export default card;
