import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempDamage, addTempPower, allUnitsOnField, createSelectCardQuery, moveCardAsCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102000197_sac_boost',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  description: '将这个单位送入墓地：选择战场上1个单位，本回合伤害+1、力量+500。',
  condition: gameState => allUnitsOnField(gameState).length > 0,
  cost: async (gameState, playerState, instance) => {
    moveCardAsCost(gameState, playerState.uid, instance, 'GRAVE', instance);
    return true;
  },
  execute: async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
    if (declaredSelections?.length) {
      const target = declaredSelections[0] ? AtomicEffectExecutor.findCardById(gameState, declaredSelections[0]) : undefined;
      if (target?.cardlocation === 'UNIT') {
        addTempDamage(target, instance, 1);
        addTempPower(target, instance, 500);
      }
      return;
    }
    createSelectCardQuery(
      gameState,
      playerState.uid,
      allUnitsOnField(gameState),
      '选择单位',
      '选择战场上的1个单位，本回合中伤害+1、力量+500。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '102000197_sac_boost' },
      () => 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') {
      addTempDamage(target, instance, 1);
      addTempPower(target, instance, 500);
    }
  },
  targetSpec: {
    title: '选择单位',
    description: '选择战场上的1个单位，本回合中伤害+1、力量+500。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    getCandidates: gameState => allUnitsOnField(gameState).map(card => ({ card, source: 'UNIT' as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102000197
 * Card2 Row: 216
 * Card Row: 216
 * Source CardNo: BT03-R08
 * Package: BT03(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[将这个单位送入墓地]选择战场上的1个单位，本回合中〖伤害+1〗〖力量+500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102000197',
  fullName: '雷云的妖精',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 500,
  basePower: 500,
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
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
