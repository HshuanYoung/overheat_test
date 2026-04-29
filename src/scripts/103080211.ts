import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, isFaction, isNonGodUnit, moveCard, putUnitOntoField } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103080211_rebirth',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '选择墓地中1张《神木复生灵萨》以外的<神木森>非神蚀单位，将这个单位放置到卡组底，之后将选择的单位放置到战场上。',
  condition: (_gameState, playerState) =>
    playerState.grave.some(card => card.id !== '103080211' && isFaction(card, '神木森') && isNonGodUnit(card)),
  execute: async (instance, gameState, playerState) => {
    const targets = playerState.grave.filter(card => card.id !== '103080211' && isFaction(card, '神木森') && isNonGodUnit(card));
    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      '选择复生单位',
      '选择墓地中的1张《神木复生灵萨》以外的<神木森>非神蚀单位卡。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '103080211_rebirth' },
      () => 'GRAVE'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target?.cardlocation || target.cardlocation !== 'GRAVE') return;
    moveCard(gameState, playerState.uid, instance, 'DECK', instance, { insertAtBottom: true });
    putUnitOntoField(gameState, playerState.uid, target, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103080211
 * Card2 Row: 369
 * Card Row: 239
 * Source CardNo: BT05-G03
 * Package: BT05(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖同名1回合1次〗{选择的你墓地中的1张《神木复生灵萨》以外的<神木森>非神蚀单位卡}:将这个单位放置到你的卡组底。之后，将被选择的单位放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103080211',
  fullName: '神木复生灵萨',
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
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
