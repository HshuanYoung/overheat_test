import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, allUnitsOnField, canPayAccessCost, createSelectCardQuery, freezeUntil, ownerUidOf, paymentCost, untilOpponentEndTurn, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101150234_freeze',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '你的回合中，若放逐区6张以上且包含同名卡，支付2费并有2个以上白色单位，冻结1个非神蚀单位直到对手回合结束。',
  condition: (gameState, playerState) =>
    playerState.isTurn &&
    playerState.exile.length >= 6 &&
    playerState.exile.some(card => card.id === '101150234') &&
    ownUnits(playerState).filter(unit => unit.color === 'WHITE').length >= 2 &&
    canPayAccessCost(gameState, playerState, 2, 'WHITE') &&
    allUnitsOnField(gameState).some(unit => !unit.godMark),
  cost: paymentCost(2, 'WHITE'),
  execute: async (instance, gameState, playerState) => {
    const targets = allUnitsOnField(gameState).filter(unit => !unit.godMark);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      targets,
      '选择冻结目标',
      '选择战场上的1个非神蚀单位冻结。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '101150234_freeze' },
      card => card.cardlocation as any
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target || target.godMark || target.cardlocation !== 'UNIT') return;
    const ownerUid = ownerUidOf(gameState, target);
    if (!ownerUid) return;
    freezeUntil(target, instance, untilOpponentEndTurn(gameState, playerState.uid));
  },
  targetSpec: {
    title: '选择冻结目标',
    description: '选择战场上的1个非神蚀单位冻结。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    getCandidates: gameState => allUnitsOnField(gameState)
      .filter(unit => !unit.godMark)
      .map(card => ({ card, source: card.cardlocation as any }))
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101150234
 * Card2 Row: 401
 * Card Row: 271
 * Source CardNo: BT05-W05
 * Package: BT05(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖同名1回合1次〗{你的回合中，你的放逐区中的卡有6张以上，其中包含《结界的冰封术士》，选择战场上的1个非神蚀单位}[〖支付2费，我方单位区有两个或以上的白色单位〗]:直到对手的回合结束时为止，将被选择的单位冻结（不能发动能力，不能宣言攻击和防御，也不会被破坏）。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101150234',
  fullName: '结界的冰封术士',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '仙雪原',
  acValue: 2,
  power: 2000,
  basePower: 2000,
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
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
