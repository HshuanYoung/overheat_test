import { Card, CardEffect } from '../types/game';
import { addContinuousDamage, addContinuousPower, addInfluence } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '102000147_ten_plus',
  type: 'CONTINUOUS',
  erosionTotalLimit: [10, 10],
  description: '10+：伤害+1，力量+1000，获得速攻。',
  applyContinuous: (_gameState, instance) => {
    addContinuousDamage(instance, instance, 1);
    addContinuousPower(instance, instance, 1000);
    instance.isrush = true;
    addInfluence(instance, instance, '获得效果: 【速攻】');
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102000147
 * Card2 Row: 131
 * Card Row: 131
 * Source CardNo: BT02-R08
 * Package: BT02(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖10+〗【永】:这个单位〖伤害+1〗〖力量+1000〗并获得【速攻】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102000147',
  fullName: '司雷福的狂战士',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
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
