import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempDamage, addTempKeyword, addTempPowerUntilEndOfTurn, createSelectCardQuery, markReturnToDeckBottomAtEnd, nameContains, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103080258_boost_return',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '选择你的1个其他卡名含有《神木》的单位，本回合伤害+1、力量+1000并获得【歼灭】，回合结束时放置到卡组底。',
  condition: (_gameState, playerState, instance) =>
    ownUnits(playerState).some(unit => unit.gamecardId !== instance.gamecardId && nameContains(unit, '神木')),
  execute: async (instance, gameState, playerState) => {
    const targets = ownUnits(playerState).filter(unit => unit.gamecardId !== instance.gamecardId && nameContains(unit, '神木'));
    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      '选择神木单位',
      '选择你的战场上的1个《神木震慑者》以外的卡名含有《神木》的单位。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '103080258_boost_return' },
      () => 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target || target.cardlocation !== 'UNIT') return;
    addTempDamage(target, instance, 1);
    addTempPowerUntilEndOfTurn(target, instance, 1000, gameState);
    addTempKeyword(target, instance, 'annihilation');
    markReturnToDeckBottomAtEnd(target, instance, gameState, playerState.uid);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103080258
 * Card2 Row: 368
 * Card Row: 299
 * Source CardNo: BT05-G02
 * Package: BT05(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖同名1回合1次〗{选择你的战场上的1个《神木震慑者》以外的卡名含有《神木》的单位}:本回合中，被选择的单位〖伤害+1〗〖力量+1000〗并获得【歼灭】。本回合结束时，将那个单位放置到你的卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103080258',
  fullName: '神木震慑者',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: {},
  faction: '神木森',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isAnnihilation: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
