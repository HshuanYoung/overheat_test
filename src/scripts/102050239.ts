import { Card, CardEffect } from '../types/game';
import { addContinuousDamage, addContinuousPower, isFeijingUnit, ownUnits, ownerUidOf } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102050239_feijing_boost',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '若你的战场上有具有【菲晶】的单位，这个单位伤害+1、力量+500。',
  condition: (_gameState, playerState) => ownUnits(playerState).some(isFeijingUnit),
  applyContinuous: (gameState, instance) => {
    const ownerUid = ownerUidOf(gameState, instance);
    if (!ownerUid || !ownUnits(gameState.players[ownerUid]).some(isFeijingUnit)) return;
    addContinuousDamage(instance, instance, 1);
    addContinuousPower(instance, instance, 500);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050239
 * Card2 Row: 408
 * Card Row: 278
 * Source CardNo: BT05-R02
 * Package: BT05(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】{你的战场上有具有菲晶的单位}：这个单位+1/+500.
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050239',
  fullName: '沙普城的守门人',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '伊列宇王国',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: true,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
