import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addTempDamage, addTempPower, canPayAccessCost, createSelectCardQuery, ownUnits, paymentCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '103000137_boost',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [6, 8],
  description: '6~8：支付2费，选择你的1个单位，本回合伤害+1、力量+2000。',
  condition: (gameState, playerState, instance) =>
    canPayAccessCost(gameState, playerState, 2, 'GREEN', instance) && ownUnits(playerState).length > 0,
  cost: paymentCost(2, 'GREEN'),
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownUnits(playerState),
      '选择强化单位',
      '选择你的1个单位，本回合中伤害+1、力量+2000。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '103000137_boost' }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target || target.cardlocation !== 'UNIT') return;
    if (AtomicEffectExecutor.findCardOwnerKey(gameState, target.gamecardId) !== _playerState.uid) return;
    addTempDamage(target, instance, 1);
    addTempPower(target, instance, 2000);
  },
  targetSpec: {
    title: '选择强化单位',
    description: '选择你的1个单位，本回合中伤害+1、力量+2000。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'SELF',
    getCandidates: (_gameState, playerState) => ownUnits(playerState).map(card => ({ card, source: 'UNIT' as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000137
 * Card2 Row: 115
 * Card Row: 115
 * Source CardNo: BT02-G09
 * Package: BT02(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖6~8〗【启】:[〖支付2费〗]选择你的1个单位，本回合中〖伤害+1〗〖力量+2000〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000137',
  fullName: '双尾叶鼠',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 2,
  power: 2000,
  basePower: 2000,
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
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
