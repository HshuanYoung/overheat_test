import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempKeyword, canPayAccessCost, exhaustCost, isNonGodUnit, ownUnits, paymentCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '303090020_give_annihilation',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  description: '支付1费并横置：选择你的1个非神蚀单位，本回合获得歼灭。',
  condition: (gameState, playerState, instance) =>
    !instance.isExhausted &&
    canPayAccessCost(gameState, playerState, 1, 'GREEN', instance) &&
    ownUnits(playerState).some(isNonGodUnit),
  cost: async (gameState, playerState, instance) => {
    const paid = await paymentCost(1, 'GREEN')!(gameState, playerState, instance);
    if (paid) await exhaustCost(gameState, playerState, instance);
    return paid;
  },
  targetSpec: {
    title: '选择获得歼灭的单位',
    description: '选择你的1个非神蚀单位，本回合获得【歼灭】。',
    minSelections: 1,
    maxSelections: 1,
    controller: 'SELF',
    zones: ['UNIT'],
    getCandidates: (_gameState, playerState) => ownUnits(playerState).filter(isNonGodUnit).map(card => ({ card, source: 'UNIT' }))
  },
  execute: async (instance, gameState, _playerState, _event, declaredSelections?: string[]) => {
    const target = declaredSelections?.[0] ? AtomicEffectExecutor.findCardById(gameState, declaredSelections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempKeyword(target, instance, 'annihilation');
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempKeyword(target, instance, 'annihilation');
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 303090020
 * Card2 Row: 121
 * Card Row: 121
 * Source CardNo: BT02-G15
 * Package: BT02(U),ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖支付1费〗，〖横置〗]选择你的1个非神蚀单位，本回合中，获得【歼灭】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '303090020',
  fullName: '银乐器古筝',
  specialName: '',
  type: 'ITEM',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '瑟诺布',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
