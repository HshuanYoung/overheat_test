import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, destroyByEffect, getOpponentUid } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102060194_destroy',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  erosionTotalLimit: [5, 7],
  description: '5~7，1回合1次：你的回合中，若这个单位力量3500以上，选择对手战场1张非神蚀卡破坏。',
  condition: (gameState, playerState, instance) => {
    if (!playerState.isTurn || (instance.power || 0) < 3500) return false;
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
    return [...opponent.unitZone, ...opponent.itemZone].some(card => card && !card.godMark);
  },
  execute: async (instance, gameState, playerState) => {
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const opponent = gameState.players[opponentUid];
    const targets = [...opponent.unitZone, ...opponent.itemZone].filter((card): card is Card => !!card && !card.godMark);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      '选择破坏对象',
      '选择对手战场上的1张非神蚀卡，将其破坏。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '102060194_destroy' },
      card => card.cardlocation as any
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target && !target.godMark) destroyByEffect(gameState, target, instance);
  },
  targetSpec: {
    title: '选择破坏对象',
    description: '选择对手战场上的1张非神蚀卡，将其破坏。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT', 'ITEM'],
    controller: 'OPPONENT',
    getCandidates: (gameState, playerState) => {
      const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      return [...opponent.unitZone, ...opponent.itemZone]
        .filter((card): card is Card => !!card && !card.godMark)
        .map(card => ({ card, source: card.cardlocation as any }));
    }
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102060194
 * Card2 Row: 213
 * Card Row: 213
 * Source CardNo: BT03-R05
 * Package: BT03(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 〖5~7〗【启】〖1回合1次〗:这个能力只能在你的回合中发动。若这个单位的力量是〖力量3500〗以上，选择对手的战场上的1张非神蚀卡，将其破坏。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102060194',
  fullName: '迅雷的雷术师',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '雷霆',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
