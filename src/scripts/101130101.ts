import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, moveCard, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '101130101_bottom',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    description: '放逐此单位：选择墓地1张卡放到卡组底。',
    condition: (_gameState, playerState) =>
      ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'WHITE')).length >= 2 &&
      playerState.grave.length > 0,
    cost: async (gameState, playerState, instance) => {
      moveCard(gameState, playerState.uid, instance, 'EXILE', instance);
      return true;
    },
    execute: async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
      if (declaredSelections?.length) {
        const target = playerState.grave.find(card => card.gamecardId === declaredSelections[0]);
        if (target) moveCard(gameState, playerState.uid, target, 'DECK', instance, { insertAtBottom: true });
        return;
      }
      createSelectCardQuery(
        gameState,
        playerState.uid,
        playerState.grave,
        '选择放回卡组底的卡',
        '选择你的墓地中的1张卡，放置到卡组底。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '101130101_bottom' },
        () => 'GRAVE'
      );
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = playerState.grave.find(card => card.gamecardId === selections[0]);
      if (target) moveCard(gameState, playerState.uid, target, 'DECK', instance, { insertAtBottom: true });
    },
    targetSpec: {
      title: '选择放回卡组底的卡',
      description: '选择你的墓地中的1张卡，放置到卡组底。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['GRAVE'],
      controller: 'SELF',
      getCandidates: (_gameState, playerState) => playerState.grave.map(card => ({ card, source: 'GRAVE' as any }))
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130101
 * Card2 Row: 61
 * Card Row: 61
 * Source CardNo: BT01-W06
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖支付0费，我方场上有两个或以上的白色单位〗，将这个单位放逐]选择你的墓地中的1张卡，放置到卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130101',
  fullName: '祈祷中的少女',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '圣王国',
  acValue: 1,
  power: 500,
  basePower: 500,
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
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
