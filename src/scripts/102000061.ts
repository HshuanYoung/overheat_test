import { Card, CardEffect } from '../types/game';
import { allCardsOnField, createSelectCardQuery, destroyByEffect, erosionCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102000061_ten_destroy_card',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  erosionFrontLimit: [2, 10],
  erosionTotalLimit: [10, 10],
  description: '10+，1回合1次，侵蚀2：选择1张卡，将其破坏。',
  condition: (gameState, playerState) =>
    allCardsOnField(gameState).length > 0,
  cost: erosionCost(2),
  execute: async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
    if (declaredSelections?.length) {
      const target = allCardsOnField(gameState).find(card => card.gamecardId === declaredSelections[0]);
      if (target) destroyByEffect(gameState, target, instance);
      return;
    }
    const candidates = allCardsOnField(gameState);
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择破坏对象',
      '选择1张卡，将其破坏。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '102000061_ten_destroy_card' },
      card => card.cardlocation || 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = allCardsOnField(gameState).find(card => card.gamecardId === selections[0]);
    if (target) destroyByEffect(gameState, target, instance);
  },
  targetSpec: {
    title: '选择破坏对象',
    description: '选择1张卡，将其破坏。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT', 'ITEM'],
    getCandidates: gameState => allCardsOnField(gameState).map(card => ({ card, source: card.cardlocation as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102000061
 * Card2 Row: 2
 * Card Row: 2
 * Source CardNo: ST01-R05
 * Package: ST01(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖10+〗【启】〖1回合1次〗:[〖侵蚀2〗]选择1张卡，将其破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102000061',
  fullName: '小公主「赛利亚」',
  specialName: '赛利亚',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 2 },
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
