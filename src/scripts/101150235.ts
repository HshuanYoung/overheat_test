import { Card, CardEffect } from '../types/game';
import { addContinuousDamage, addContinuousKeyword, addContinuousPower, ownerUidOf } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101150235_exile_boost',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '你的回合中，若放逐区10张以上且包含同名卡，这个单位伤害+1、力量+500并获得【英勇】。',
  condition: (gameState, playerState) =>
    playerState.isTurn &&
    playerState.exile.length >= 10 &&
    playerState.exile.some(card => card.id === '101150235'),
  applyContinuous: (gameState, instance) => {
    const ownerUid = ownerUidOf(gameState, instance);
    if (!ownerUid || !gameState.players[ownerUid].isTurn) return;
    if (gameState.players[ownerUid].exile.length < 10 || !gameState.players[ownerUid].exile.some(card => card.id === '101150235')) return;
    addContinuousDamage(instance, instance, 1);
    addContinuousPower(instance, instance, 500);
    addContinuousKeyword(instance, instance, 'heroic');
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101150235
 * Card2 Row: 402
 * Card Row: 272
 * Source CardNo: BT05-W06
 * Package: BT05(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】{你的回合中，你的放逐区中的卡有10张以上，其中包含《结界的雪暴法师》}:这个单位〖伤害+1〗〖力量+500〗并获得【英勇】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101150235',
  fullName: '结界的雪暴法师',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '仙雪原',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isHeroic: false,
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
