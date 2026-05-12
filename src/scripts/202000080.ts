import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addInfluence, allCardsOnField, destroyByEffect, ownerOf, story } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '202000080_shenyi_discount',
  type: 'CONTINUOUS',
  triggerLocation: ['HAND', 'PLAY'],
  content: 'SELF_HAND_COST',
  description: '若你的战场上有【神依】单位，这张卡费用减少4。',
  applyContinuous: (gameState, instance) => {
    const owner = ownerOf(gameState, instance);
    if (!owner?.unitZone.some(unit => unit?.isShenyi)) return;
    addInfluence(instance, instance, 'ACCESS值减少4');
  }
}, story('202000080_destroy', '5~7：选择战场上的1张卡，将其破坏。若你的战场上有【神依】单位，这张卡费用减少4。', async (instance, gameState, _playerState, _event, declaredSelections?: string[]) => {
  const target = declaredSelections?.[0] ? AtomicEffectExecutor.findCardById(gameState, declaredSelections[0]) : undefined;
  if (target) destroyByEffect(gameState, target, instance);
}, {
  erosionTotalLimit: [5, 7],
  targetSpec: {
    title: '选择破坏对象',
    description: '选择战场上的1张卡，将其破坏。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT', 'ITEM'],
    getCandidates: gameState => allCardsOnField(gameState).map(card => ({ card, source: card.cardlocation as any }))
  },
  condition: (_gameState, playerState) => {
    const total = playerState.erosionFront.filter(Boolean).length + playerState.erosionBack.filter(Boolean).length;
    return total >= 5 && total <= 7;
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target) destroyByEffect(gameState, target, instance);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202000080
 * Card2 Row: 222
 * Card Row: 222
 * Source CardNo: BT03-R14
 * Package: BT03(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖5~7〗选择战场上的1张卡，将其破坏。若你的战场上有具有【神依】的单位，这张卡的ACCESS值减少4。（最低降到〖0费〗）
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202000080',
  fullName: '神雷',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 2 },
  faction: '无',
  acValue: 6,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
