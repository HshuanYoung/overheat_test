import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempPowerUntilEndOfTurn, canPayAccessCost, createSelectCardQuery, ownUnits, paymentCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103090135_boost_other',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  description: '支付1费，选择这个单位以外你的1个<瑟诺布>单位，本回合力量+1000。',
  condition: (gameState, playerState, instance) =>
    canPayAccessCost(gameState, playerState, 1, 'GREEN', instance) &&
    ownUnits(playerState).some(unit => unit.gamecardId !== instance.gamecardId && unit.faction === '瑟诺布'),
  cost: paymentCost(1, 'GREEN'),
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownUnits(playerState).filter(unit => unit.gamecardId !== instance.gamecardId && unit.faction === '瑟诺布'),
      '选择强化单位',
      '选择这个单位以外的你的1个<瑟诺布>单位，本回合力量+1000。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '103090135_boost_other' }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempPowerUntilEndOfTurn(target, instance, 1000, gameState);
  },
  targetSpec: {
    title: '选择强化单位',
    description: '选择这个单位以外的你的1个<瑟诺布>单位，本回合力量+1000。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState, instance) => ownUnits(playerState)
      .filter(unit => unit.gamecardId !== instance.gamecardId && unit.faction === '瑟诺布')
      .map(card => ({ card, source: 'UNIT' as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103090135
 * Card2 Row: 113
 * Card Row: 113
 * Source CardNo: BT02-G07
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗:[〖支付1费〗]选择这个单位以外的你的1个<瑟诺布>单位，本回合中〖力量+1000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103090135',
  fullName: '银乐团指挥',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '瑟诺布',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 2,
  baseDamage: 2,
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
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
