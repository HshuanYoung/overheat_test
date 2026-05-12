import { Card, CardEffect } from '../types/game';
import { createSelectCardQuery, exhaustCost, moveCardsToBottom } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101000205_bottom_grave',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '同名1回合1次，横置：若本回合你的侵蚀区有卡被放逐，选择墓地2张卡放置到卡组底。',
  condition: (_gameState, playerState, instance) =>
    !instance.isExhausted &&
    playerState.exiledFromErosionTurn === _gameState.turnCount &&
    playerState.grave.length >= 2,
  cost: exhaustCost,
  execute: async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
    if (declaredSelections?.length) {
      const cards = declaredSelections
        .map(id => playerState.grave.find(card => card.gamecardId === id))
        .filter((card): card is Card => !!card);
      moveCardsToBottom(gameState, playerState.uid, cards, instance);
      return;
    }
    createSelectCardQuery(
      gameState,
      playerState.uid,
      playerState.grave,
      '选择墓地的卡',
      '选择你的墓地中的2张卡，将其放置到卡组底。',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '101000205_bottom_grave' },
      () => 'GRAVE'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const cards = selections
      .map(id => playerState.grave.find(card => card.gamecardId === id))
      .filter((card): card is Card => !!card);
    moveCardsToBottom(gameState, playerState.uid, cards, instance);
  },
  targetSpec: {
    title: '选择墓地的卡',
    description: '选择你的墓地中的2张卡，将其放置到卡组底。',
    minSelections: 2,
    maxSelections: 2,
    zones: ['GRAVE'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState) => playerState.grave.map(card => ({ card, source: 'GRAVE' as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000205
 * Card2 Row: 231
 * Card Row: 231
 * Source CardNo: BT03-W06
 * Package: BT03(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖同名1回合1次〗:[〖横置〗]这个能力只能在你的侵蚀区中有卡被放逐的回合中发动。选择你的墓地中的2张卡，将其放置到卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000205',
  fullName: '仙雪侍从巫女',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 1000,
  basePower: 1000,
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
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
