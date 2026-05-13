import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, exhaustCost, ownUnits, preventNextDestroy } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101000159_protect',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  description: '横置：选择你的1个其他力量2000以下单位，本回合下一次将被破坏时防止。',
  condition: (_gameState, playerState, instance) =>
    !instance.isExhausted &&
    ownUnits(playerState).some(unit => unit.gamecardId !== instance.gamecardId && (unit.power || 0) <= 2000),
  cost: exhaustCost,
  execute: async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
    if (declaredSelections?.length) {
      const target = declaredSelections[0] ? AtomicEffectExecutor.findCardById(gameState, declaredSelections[0]) : undefined;
      if (target) preventNextDestroy(target, instance, gameState.turnCount);
      return;
    }
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownUnits(playerState).filter(unit => unit.gamecardId !== instance.gamecardId && (unit.power || 0) <= 2000),
      '选择防止破坏的单位',
      '选择你的1个其他力量2000以下单位。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '101000159_protect' },
      () => 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target) preventNextDestroy(target, instance, gameState.turnCount);
  },
  targetSpec: {
    title: '选择防止破坏的单位',
    description: '选择你的1个其他力量2000以下单位。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState, instance) => ownUnits(playerState)
      .filter(unit => unit.gamecardId !== instance.gamecardId && (unit.power || 0) <= 2000)
      .map(card => ({ card, source: 'UNIT' as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000159
 * Card2 Row: 149
 * Card Row: 149
 * Source CardNo: BT02-W09
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖横置〗]选择你的1个这个单位以外的〖力量2000〗以下的单位，本回合中，那个单位下一次将要被破坏时，防止那次破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000159',
  fullName: '白魔术少女「库丽丝塔」',
  specialName: '库丽丝塔',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '无',
  acValue: 2,
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
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
