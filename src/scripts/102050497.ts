import { Card, CardEffect } from '../types/game';
import { damagePlayerByEffect, getOpponentUid } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102050497_alliance_damage',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ATTACK_DECLARED',
  limitCount: 1,
  limitNameType: true,
  description: '同名1回合1次：这个单位组成联军时，给予对手2点伤害。',
  condition: (_gameState, _playerState, instance, event) =>
    !!event?.data?.isAlliance &&
    (event.data?.attackerIds || []).includes(instance.gamecardId),
  execute: async (instance, gameState, playerState) => {
    await damagePlayerByEffect(gameState, playerState.uid, getOpponentUid(gameState, playerState.uid), 2, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050497
 * Card2 Row: 288
 * Card Row: 644
 * Source CardNo: PR03-07R
 * Package: 特殊(PR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 【诱】〖同名1回合1次〗:这个单位组成联军时，给予对手2点伤害。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050497',
  fullName: '追击部队pr',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '伊列宇王国',
  acValue: 2,
  power: 500,
  basePower: 500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'PR',
  availableRarities: ['PR'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
