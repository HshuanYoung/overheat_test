import { Card, GameState, PlayerState, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const activate_104000128_1: CardEffect = {
  id: '104000128_activate_1',
  type: 'ACTIVATE',
  limitCount: 1,
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [4, 6],
  description: '【启】〔回合1次〕：侵蚀区存在4-6张卡牌时，抽1张卡，然后选择1张手牌舍弃。',
  condition: (gameState, playerState) => {
    return true;
  },
  execute: async (card, gameState, playerState) => {
    // 1. Draw 1
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DRAW',
      value: 1
    }, card);

    // 2. Select card to discard
    if (playerState.hand.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options: playerState.hand.map(h => ({ card: { ...h }, source: 'HAND' as any })),
        title: '选择要舍弃的手牌',
        description: '效果结算：请选择1张手牌舍弃。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: card.gamecardId,
          effectId: '104000128_activate_1',
          step: 'DISCARD'
        }
      };
    }
  },
  onQueryResolve: async (card, gameState, playerState, selections, context) => {
    if (context?.step === 'DISCARD') {
      const targetId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'DISCARD_CARD',
        targetFilter: { gamecardId: targetId }
      }, card);
      gameState.logs.push(`[普尔氏·小冰妹] 已舍弃 1 张手牌。`);
    }
  }
};

const card: Card = {
  id: '104000128',
  fullName: '普尔氏·小冰妖',
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
  effects: [activate_104000128_1],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
