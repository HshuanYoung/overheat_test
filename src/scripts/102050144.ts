import { Card, CardEffect } from '../types/game';
import { damagePlayerByEffect, getOpponentUid } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102050144_enter_damage',
  type: 'TRIGGER',
  triggerEvent: 'CARD_ENTERED_ZONE',
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [5, 7],
  description: '5~7：进入战场时，给对手造成1点效果伤害。',
  condition: (_gameState, _playerState, instance, event) =>
    event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    await damagePlayerByEffect(gameState, playerState.uid, getOpponentUid(gameState, playerState.uid), 1, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050144
 * Card2 Row: 128
 * Card Row: 128
 * Source CardNo: BT02-R05
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 〖5~7〗【诱】:这个单位进入战场时，给对手造成一点效果伤害。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050144',
  fullName: '晶路铁骑',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '伊列宇王国',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
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
