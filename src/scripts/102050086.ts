import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, addTempPower } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '102050086_attack_buff',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ATTACK_DECLARED',
    triggerLocation: ['UNIT'],
    isGlobal: true,
    description: '你的<伊列宇王国>单位攻击时，本回合中那个单位力量+500。',
    condition: (_gameState, playerState, _instance, event) => event?.playerUid === playerState.uid,
    execute: async (instance, gameState, _playerState, event) => {
      const attacker = event?.sourceCardId ? AtomicEffectExecutor.findCardById(gameState, event.sourceCardId) : undefined;
      if (attacker && attacker.faction === '伊列宇王国') addTempPower(attacker, instance, 500);
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050086
 * Card2 Row: 40
 * Card Row: 40
 * Source CardNo: BT01-R02
 * Package: ST01(TD),BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:你的<伊列宇王国>单位攻击时，本回合中，那个单位〖力量+500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050086',
  fullName: '皇家直属卫兵',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '伊列宇王国',
  acValue: 2,
  power: 1500,
  basePower: 1500,
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
