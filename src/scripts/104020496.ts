import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, allUnitsOnField, createSelectCardQuery, markCannotResetNextStart } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '104020496_entry_no_reset',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  description: '进入战场时，选择战场上1张ACCESS值2以下的非神蚀单位，下次开始阶段不能重置。',
  condition: (gameState, _playerState, instance, event) =>
    event?.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    allUnitsOnField(gameState).some(unit => !unit.godMark && (unit.acValue || 0) <= 2),
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      allUnitsOnField(gameState).filter(unit => !unit.godMark && (unit.acValue || 0) <= 2),
      '选择不能重置的单位',
      '选择战场上1张ACCESS值2以下的非神蚀单位，下一次开始阶段不能重置。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '104020496_entry_no_reset' },
      () => 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT' && !target.godMark && (target.acValue || 0) <= 2) {
      markCannotResetNextStart(target, instance);
    }
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 104020496
 * Card2 Row: 286
 * Card Row: 642
 * Source CardNo: PR03-05B
 * Package: 特殊(PR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:这个单位进入战场时，选择战场上的1张ACCESS值+2以下的非神蚀单位，下一次对手的回合开始阶段中，那个单位不能〖重置〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '104020496',
  fullName: '幻国迷偶 代号Newpr',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  faction: '九尾商会联盟',
  acValue: 2,
  power: 1000,
  basePower: 1000,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
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
