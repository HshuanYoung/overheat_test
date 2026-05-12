import { Card, CardEffect, TriggerLocation } from '../types/game';
import { createSelectCardQuery, exileByEffect } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '101000105_exile_grave',
    type: 'ACTIVATE',
    triggerLocation: ['UNIT'],
    limitCount: 1,
    description: '你的回合中，选择1名玩家墓地中的1张卡放逐。',
    condition: (gameState, playerState) =>
      playerState.isTurn &&
      gameState.phase === 'MAIN' &&
      Object.values(gameState.players).some(player => player.grave.length > 0),
    execute: async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
      if (declaredSelections?.length) {
        const target = Object.values(gameState.players)
          .flatMap(player => player.grave)
          .find(card => card.gamecardId === declaredSelections[0]);
        if (target) exileByEffect(gameState, target, instance);
        return;
      }
      const candidates = Object.values(gameState.players).flatMap(player => player.grave);
      if (candidates.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择放逐卡牌',
        '选择任意玩家墓地中的1张卡，将其放逐。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '101000105_exile_grave' },
        () => 'GRAVE'
      );
    },
    onQueryResolve: async (instance, gameState, _playerState, selections) => {
      const target = Object.values(gameState.players)
        .flatMap(player => player.grave)
        .find(card => card.gamecardId === selections[0]);
      if (target) exileByEffect(gameState, target, instance);
    },
    targetSpec: {
      title: '选择放逐卡牌',
      description: '选择任意玩家墓地中的1张卡，将其放逐。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['GRAVE'],
      getCandidates: gameState => Object.values(gameState.players)
        .flatMap(player => player.grave)
        .map(card => ({ card, source: 'GRAVE' as any }))
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000105
 * Card2 Row: 65
 * Card Row: 65
 * Source CardNo: BT01-W10
 * Package: ST01(TD),BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗:你的回合中才可以发动。选择1名玩家的墓地中的1张卡，将其放逐。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000105',
  fullName: '宫廷信鸽',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 1,
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
