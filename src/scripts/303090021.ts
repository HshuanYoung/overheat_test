import { Card, CardEffect } from '../types/game';
import { getBattlefieldUnits, markAccessTapValue } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '303090021_all_access_plus_two',
  type: 'CONTINUOUS',
  triggerLocation: ['ITEM'],
  description: '你的战场上所有单位获得横置支付ACCESS时可当作+1或+2。',
  applyContinuous: (gameState, instance) => {
    const ownerUid = Object.entries(gameState.players).find(([, player]) =>
      player.itemZone.some(item => item?.gamecardId === instance.gamecardId)
    )?.[0];
    if (!ownerUid) return;
    getBattlefieldUnits(gameState)
      .filter(unit => gameState.players[ownerUid].unitZone.some(own => own?.gamecardId === unit.gamecardId))
      .forEach(unit => markAccessTapValue(unit, instance, 2));
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 303090021
 * Card2 Row: 122
 * Card Row: 122
 * Source CardNo: BT02-G16
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:你的战场上的所有单位获得“【永】:通过〖横置〗这个单位来支付的ACCESS值，可以当作+2。”的能力。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '303090021',
  fullName: '「第一风车塔」',
  specialName: '第一风车塔',
  type: 'ITEM',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '瑟诺布',
  acValue: 4,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
