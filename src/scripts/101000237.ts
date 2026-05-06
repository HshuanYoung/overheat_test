import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, isFeijingCard, moveCardAsCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101000237_exile_feijing_draw',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '你的主要阶段，放逐墓地中2张具有【菲晶】的卡，抽1张卡。',
  condition: (gameState, playerState) =>
    gameState.phase === 'MAIN' &&
    playerState.isTurn &&
    playerState.grave.filter(isFeijingCard).length >= 2,
  cost: async (gameState, playerState, instance) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      playerState.grave.filter(isFeijingCard),
      '选择菲晶卡',
      '选择墓地中的2张具有【菲晶】的卡放逐作为费用。',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '101000237_exile_feijing_draw', step: 'COST' },
      () => 'GRAVE'
    );
    return true;
  },
  execute: async (instance, gameState, playerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step !== 'COST') return;
    selections.forEach(id => {
      const target = playerState.grave.find(card => card.gamecardId === id);
      if (target) moveCardAsCost(gameState, playerState.uid, target, 'EXILE', instance);
    });
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000237
 * Card2 Row: 404
 * Card Row: 274
 * Source CardNo: BT05-W08
 * Package: BT05(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖同名1回合1次〗{你的主要阶段}[将你的墓地中的2张具有【菲晶】的卡放逐]:抽1张卡。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000237',
  fullName: '边境的向导',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 1,
  power: 1000,
  basePower: 1000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
