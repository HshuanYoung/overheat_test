import { Card, CardEffect } from '../types/game';
import { addInfluence, allUnitsOnField, createSelectCardQuery, erosionCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101000063_ten_reset_units',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  erosionTotalLimit: [10, 10],
  description: '10+，1回合1次，侵蚀2：选择2个非神蚀单位，将其重置。',
  condition: (gameState, playerState) =>
    allUnitsOnField(gameState).filter(unit => !unit.godMark).length >= 2,
  cost: erosionCost(2),
  execute: async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
    if (declaredSelections?.length) {
      const targets = allUnitsOnField(gameState).filter(unit => declaredSelections.includes(unit.gamecardId));
      targets.forEach(target => {
        target.isExhausted = false;
        addInfluence(target, instance, '因效果重置');
      });
      return;
    }
    const candidates = allUnitsOnField(gameState).filter(unit => !unit.godMark);
    if (candidates.length < 2) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择重置单位',
      '选择2个非神蚀单位，将其重置。',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '101000063_ten_reset_units' },
      card => card.cardlocation || 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const targets = allUnitsOnField(gameState).filter(unit => selections.includes(unit.gamecardId));
    targets.forEach(target => {
      target.isExhausted = false;
      addInfluence(target, instance, '因效果重置');
    });
  },
  targetSpec: {
    title: '选择重置单位',
    description: '选择2个非神蚀单位，将其重置。',
    minSelections: 2,
    maxSelections: 2,
    zones: ['UNIT'],
    getCandidates: gameState => allUnitsOnField(gameState)
      .filter(unit => !unit.godMark)
      .map(card => ({ card, source: card.cardlocation as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000063
 * Card2 Row: 4
 * Card Row: 4
 * Source CardNo: ST01-W08
 * Package: ST01(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖10+〗【启】〖1回合1次〗:[〖侵蚀2〗]选择2个非神蚀单位，将其重置。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000063',
  fullName: '小圣女「柯莉尔」',
  specialName: '柯莉尔',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '无',
  acValue: 2,
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
