import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempPower, createSelectCardQuery, exhaustCost, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102060191_power',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  description: '横置：你的回合中，选择你的1个单位，本回合力量+1000。',
  condition: (_gameState, playerState, instance) => playerState.isTurn && !instance.isExhausted && ownUnits(playerState).length > 0,
  cost: exhaustCost,
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownUnits(playerState),
      '选择单位',
      '选择你的1个单位，本回合中力量+1000。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '102060191_power' },
      () => 'UNIT'
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (target?.cardlocation === 'UNIT') addTempPower(target, instance, 1000);
  },
  targetSpec: {
    title: '选择单位',
    description: '选择你的1个单位，本回合中力量+1000。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState) => ownUnits(playerState).map(card => ({ card, source: 'UNIT' as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102060191
 * Card2 Row: 210
 * Card Row: 210
 * Source CardNo: BT03-R02
 * Package: BT03(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖横置〗]这个能力只能在你的回合中发动。选择你的1个单位，本回合中〖力量+1000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102060191',
  fullName: '迅雷的符咒师',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: {},
  faction: '雷霆',
  acValue: 2,
  power: 1500,
  basePower: 1500,
  damage: 2,
  baseDamage: 2,
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
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
