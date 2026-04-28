import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, battlingUnits, isBattleFreeContext, ownUnits, paymentCost } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101000158_battle_debuff',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  description: '战斗中支付1费，参与攻击的所有单位本回合力量-500。',
  condition: (gameState, playerState) =>
    isBattleFreeContext(gameState) &&
    ownUnits(playerState).filter(unit => AtomicEffectExecutor.matchesColor(unit, 'WHITE')).length >= 2 &&
    battlingUnits(gameState).length > 0,
  cost: paymentCost(1),
  execute: async (instance, gameState) => {
    battlingUnits(gameState).forEach(unit => {
      unit.temporaryPowerBuff = (unit.temporaryPowerBuff || 0) - 500;
      unit.power = (unit.power || 0) - 500;
      const details = unit.temporaryBuffDetails?.power || [];
      details.push({ sourceCardName: instance.fullName, value: -500 });
      unit.temporaryBuffDetails = { ...(unit.temporaryBuffDetails || {}), power: details };
    });
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000158
 * Card2 Row: 148
 * Card Row: 148
 * Source CardNo: BT02-W08
 * Package: BT02(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗:[〖支付1费，我方单位区有两个或以上的白色单位〗]这个能力只能在战斗中发动。参与攻击的所有单位在本回合中〖力量-500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000158',
  fullName: '索拉刺猪',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
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
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
