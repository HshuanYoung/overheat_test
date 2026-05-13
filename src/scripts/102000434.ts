import { Card, CardEffect } from '../types/game';
import { createPlayerSelectQuery, damagePlayerByEffect, getOpponentUid } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102000434_battle_destroy_damage',
  type: 'TRIGGER',
  triggerEvent: 'CARD_DESTROYED_BATTLE',
  triggerLocation: ['GRAVE'],
  description: '这个单位被战斗破坏时，选择1名玩家，给予他2点伤害。',
  condition: (_gameState, _playerState, instance, event) => event?.targetCardId === instance.gamecardId,
  execute: async (instance, gameState, playerState) => {
    createPlayerSelectQuery(gameState, playerState.uid, '选择伤害玩家', '选择1名玩家，给予他2点伤害。', {
      sourceCardId: instance.gamecardId,
      effectId: '102000434_battle_destroy_damage'
    });
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const targetUid = selections[0] === 'PLAYER_SELF' ? playerState.uid : getOpponentUid(gameState, playerState.uid);
    await damagePlayerByEffect(gameState, playerState.uid, targetUid, 2, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102000434
 * Card2 Row: 309
 * Card Row: 548
 * Source CardNo: BT04-R08
 * Package: BT04(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】：这个单位被战斗破坏时，选择1名玩家，给予他2点伤害。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102000434',
  fullName: '狱炎的小魔女',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 1000,
  basePower: 1000,
  damage: 2,
  baseDamage: 2,
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
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
