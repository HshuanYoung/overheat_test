import { Card, CardEffect } from '../types/game';
import { addTempPower, allUnitsOnField, damagePlayerByEffect, getOpponentUid } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '305000041_destroyed',
  type: 'TRIGGER',
  triggerLocation: ['GRAVE'],
  triggerEvent: 'CARD_DESTROYED_EFFECT',
  limitCount: 1,
  limitNameType: true,
  isMandatory: true,
  description: '这张卡被破坏时，对所有对手造成2点伤害。本回合中，战场上所有非神蚀单位力量变为0。',
  condition: (_gameState, _playerState, instance, event) =>
    event?.targetCardId === instance.gamecardId,
  execute: async (instance, gameState, playerState) => {
    await damagePlayerByEffect(gameState, playerState.uid, getOpponentUid(gameState, playerState.uid), 2, instance);
    allUnitsOnField(gameState)
      .filter(unit => !unit.godMark)
      .forEach(unit => addTempPower(unit, instance, -(unit.power || 0)));
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 305000041
 * Card2 Row: 396
 * Card Row: 266
 * Source CardNo: BT05-Y10
 * Package: BT05(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】〖同名1回合1次〗{这张卡被破坏时}:对所有对手造成2点伤害。本回合中，战场上的所有非神蚀单位的力量值变为〖力量0〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '305000041',
  fullName: '伪装的怪盗礼帽',
  specialName: '',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
