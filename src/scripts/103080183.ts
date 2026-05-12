import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, allCardsOnField, createSelectCardQuery, destroyByEffect, ensureData, grantedTotemReviveFromGrave } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103080183_destroy',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  description: '1回合1次：你的回合中，若这个单位本回合被《降灵》效果选择过，选择战场1张非神蚀卡破坏。',
  condition: (gameState, playerState, instance) =>
    playerState.isTurn &&
    ensureData(instance).spiritTargetedTurn === gameState.turnCount &&
    allCardsOnField(gameState).some(card => !card.godMark),
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      allCardsOnField(gameState).filter(card => !card.godMark),
      '选择破坏对象',
      '选择战场上的1张非神蚀卡，将其破坏。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '103080183_destroy' },
      card => card.cardlocation as any
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target && !target.godMark) destroyByEffect(gameState, target, instance);
  },
  targetSpec: {
    title: '选择破坏对象',
    description: '选择战场上的1张非神蚀卡，将其破坏。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT', 'ITEM'],
    getCandidates: gameState => allCardsOnField(gameState)
      .filter(card => !card.godMark)
      .map(card => ({ card, source: card.cardlocation as any }))
  }
}, grantedTotemReviveFromGrave()];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103080183
 * Card2 Row: 196
 * Card Row: 196
 * Source CardNo: BT03-G04
 * Package: BT03(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗:这个能力只能在这个单位有被卡名含有《降灵》的卡选择过为效果对象的你的回合中发动。选择战场上的1张非神蚀卡，将其破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103080183',
  fullName: '地鬼图腾「猎鹰」',
  specialName: '猎鹰',
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
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
