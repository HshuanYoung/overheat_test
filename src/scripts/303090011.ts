import { Card, CardEffect } from '../types/game';
import { addTempPower, cannotBeChosenAsEffectTarget, createSelectCardQuery, exhaustCost, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '303090011_buff',
    type: 'ACTIVATE',
    triggerLocation: ['ITEM'],
    description: '横置：选择你的1个单位，本回合力量+500。',
    condition: (_gameState, _playerState, instance) => !instance.isExhausted,
    cost: exhaustCost,
    execute: async (instance, gameState, playerState) => {
      const candidates = ownUnits(playerState).filter(unit => !cannotBeChosenAsEffectTarget(unit, instance));
      if (candidates.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择单位',
        '选择你的1个单位，本回合中力量+500。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '303090011_buff' }
      );
    },
    onQueryResolve: async (instance, _gameState, playerState, selections) => {
      const target = ownUnits(playerState).find(unit =>
        unit.gamecardId === selections[0] &&
        !cannotBeChosenAsEffectTarget(unit, instance)
      );
      if (target) addTempPower(target, instance, 500);
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 303090011
 * Card2 Row: 37
 * Card Row: 37
 * Source CardNo: BT01-G16
 * Package: BT01(C),ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖横置〗]选择你的1个单位，本回合中〖力量+500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '303090011',
  fullName: '银乐器小号',
  specialName: '',
  type: 'ITEM',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '瑟诺布',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
