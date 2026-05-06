import { Card, CardEffect } from '../types/game';
import { addTempPower, damagePlayerByEffect, getOpponentUid, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102060195_opponent_destroy_boost',
  type: 'TRIGGER',
  triggerEvent: ['CARD_DESTROYED_BATTLE', 'CARD_DESTROYED_EFFECT'],
  triggerLocation: ['UNIT'],
  isGlobal: true,
  isMandatory: true,
  limitCount: 1,
  description: '对手的单位被破坏时，本回合你的所有单位力量+500。',
  condition: (_gameState, playerState, _instance, event) =>
    event?.playerUid === getOpponentUid(_gameState, playerState.uid),
  execute: async (instance, _gameState, playerState) => {
    ownUnits(playerState).forEach(unit => addTempPower(unit, instance, 500));
  }
}, {
  id: '102060195_ten_damage',
  type: 'TRIGGER',
  triggerEvent: ['CARD_DESTROYED_BATTLE', 'CARD_DESTROYED_EFFECT'],
  triggerLocation: ['UNIT'],
  isGlobal: true,
  isMandatory: true,
  erosionTotalLimit: [10, 10],
  description: '10+：战场上的单位被破坏时，给予对手1点伤害。',
  condition: () => true,
  execute: async (instance, gameState, playerState) => {
    await damagePlayerByEffect(gameState, playerState.uid, getOpponentUid(gameState, playerState.uid), 1, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102060195
 * Card2 Row: 214
 * Card Row: 214
 * Source CardNo: BT03-R06
 * Package: BT03(SR,ESR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:对手的单位被破坏时，本回合中，你的所有单位〖力量+500〗。（复数单位被同时破坏时只诱发1次）
 * 〖10+〗【诱】:战场上的单位被破坏时，选择1名对手，给予他1点伤害。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102060195',
  fullName: '炎雷的噬魂师「蕾」',
  specialName: '蕾',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 2 },
  faction: '雷霆',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
