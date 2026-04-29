import { Card, CardEffect } from '../types/game';
import { addTempDamage, addTempPower, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103000139_enter_team_boost',
  type: 'TRIGGER',
  triggerEvent: 'CARD_ENTERED_ZONE',
  triggerLocation: ['UNIT'],
  description: '从手牌进入战场时，本回合你的所有单位伤害+1、力量+1000。',
  condition: (_gameState, _playerState, instance, event) => {
    const enteredFromHand =
      event?.data?.sourceZone === 'HAND' ||
      (event?.data?.sourceZone === 'PLAY' && (instance as any).__playSnapshot?.sourceZone === 'HAND');
    return event?.sourceCardId === instance.gamecardId &&
      event.data?.zone === 'UNIT' &&
      enteredFromHand;
  },
  execute: async (instance, _gameState, playerState) => {
    ownUnits(playerState).forEach(unit => {
      addTempDamage(unit, instance, 1);
      addTempPower(unit, instance, 1000);
    });
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000139
 * Card2 Row: 117
 * Card Row: 117
 * Source CardNo: BT02-G11
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【神依】
 * 【诱】:这个单位从手牌进入战场时，本回合中，你的所有单位〖伤害+1〗〖力量+1000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000139',
  fullName: '丛林霸者「古·拉夫」',
  specialName: '古·拉夫',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '无',
  acValue: 5,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isShenyi: true,
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
