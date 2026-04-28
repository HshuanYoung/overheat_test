import { Card, CardEffect } from '../types/game';
import { addContinuousDamage, addInfluence, attackingUnits } from './BaseUtil';

const isIleu = (card: Card) => String(card.faction || '').includes('伊列宇王国');

const cardEffects: CardEffect[] = [{
  id: '102050143_alliance_boost',
  type: 'CONTINUOUS',
  description: '与<伊列宇王国>单位组成联军攻击中，所有参战单位伤害+1并获得歼灭。',
  applyContinuous: (gameState, instance) => {
    const attackers = attackingUnits(gameState);
    if (!gameState.battleState?.isAlliance || !attackers.some(unit => unit.gamecardId === instance.gamecardId)) return;
    if (!attackers.some(unit => unit.gamecardId !== instance.gamecardId && isIleu(unit))) return;
    attackers.forEach(unit => {
      addContinuousDamage(unit, instance, 1);
      unit.isAnnihilation = true;
      addInfluence(unit, instance, '获得效果: 【歼灭】');
    });
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050143
 * Card2 Row: 127
 * Card Row: 127
 * Source CardNo: BT02-R04
 * Package: BT02(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 【永】:这个单位与<伊列宇王国>单位组成联军的攻击中，你的所有参战单位〖伤害+1〗并获得【歼灭】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050143',
  fullName: '红莲军师「切尔斯」',
  specialName: '切尔斯',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '伊列宇王国',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  isAnnihilation: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
