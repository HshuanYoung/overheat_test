import { Card, CardEffect } from '../types/game';
import { battlingUnits, createSelectCardQuery, ensureData, faceUpErosion, freezeUntil, isBattleFreeContext, moveCardAsCost, untilOpponentEndTurn } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101150236_combat_immune',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  description: '这个单位参与的战斗中，放逐2张正面侵蚀，本回合这个单位不会被战斗破坏。',
  condition: (gameState, playerState, instance) =>
    !!gameState.battleState &&
    battlingUnits(gameState).some(unit => unit.gamecardId === instance.gamecardId) &&
    faceUpErosion(playerState).length >= 2,
  cost: async (gameState, playerState, instance) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      faceUpErosion(playerState),
      '选择放逐的侵蚀卡',
      '选择侵蚀区中的2张正面卡放逐作为费用。',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '101150236_combat_immune', step: 'COST' },
      () => 'EROSION_FRONT'
    );
    return true;
  },
  execute: async (instance, _gameState, playerState) => {
    const data = ensureData(instance);
    data.combatImmuneUntilOwnNextTurnStartUid = playerState.uid;
    data.combatImmuneSourceName = instance.fullName;
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step !== 'COST') return;
    selections.forEach(id => {
      const target = playerState.erosionFront.find(card => card?.gamecardId === id);
      if (target) moveCardAsCost(gameState, playerState.uid, target, 'EXILE', instance);
    });
  }
}, {
  id: '101150236_freeze_battle',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [0, 3],
  limitCount: 1,
  limitNameType: true,
  description: '0~3：战斗自由步骤中，若放逐区15张以上，冻结这次战斗的所有参战单位直到对手回合结束。',
  condition: (gameState, playerState) =>
    isBattleFreeContext(gameState) &&
    playerState.exile.length >= 15 &&
    battlingUnits(gameState).length > 0,
  execute: async (instance, gameState, playerState) => {
    battlingUnits(gameState).forEach(unit => freezeUntil(unit, instance, untilOpponentEndTurn(gameState, playerState.uid)));
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101150236
 * Card2 Row: 403
 * Card Row: 273
 * Source CardNo: BT05-W07
 * Package: BT05(ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】{这个单位参与的战斗中}[将你的侵蚀区中的2张正面卡放逐]:本回合中，这个单位不会被战斗破坏。
 * 〖0~3〗【启】〖同名1回合1次〗{战斗自由步骤中，你的放逐区中的卡有15张以上}:直到对手的回合结束时为止，将这次战斗中的所有参战单位冻结（不能发动能力，不能宣言攻击和防御，也不会被破坏）。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101150236',
  fullName: '圣境霜华「欧若拉」',
  specialName: '欧若拉',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '仙雪原',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SER',
  availableRarities: ['SER'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
