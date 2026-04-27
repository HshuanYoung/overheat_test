import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, addTempDamage, addTempPower, createSelectCardQuery, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('201130038_blessing', '选择你的1个白色单位，本回合伤害+1、力量+2000。', async (instance, gameState, playerState) => {
    const candidates = ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'WHITE'));
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择白色单位',
      '选择你的1个白色单位，本回合中伤害+1、力量+2000。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '201130038_blessing' }
    );
  }, {
    condition: (_gameState, playerState) => ownUnits(playerState).some(unit => AtomicEffectExecutor.matchesColor(unit, 'WHITE')),
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = ownUnits(playerState).find(unit => unit.gamecardId === selections[0]);
    if (target) {
      addTempDamage(target, instance, 1);
      addTempPower(target, instance, 2000);
    }
    }
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 201130038
 * Card2 Row: 69
 * Card Row: 69
 * Source CardNo: BT01-W14
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的1个白色单位，本回合中，〖伤害+1〗〖力量+2000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '201130038',
  fullName: '神威祝福',
  specialName: '',
  type: 'STORY',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '圣王国',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
