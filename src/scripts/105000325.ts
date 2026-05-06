import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105000325
 * Card2 Row: 447
 * Card Row: 382
 * Source CardNo: SP02-Y09
 * Package: SP02(OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】{你的主要阶段}[将你的战场上的5种颜色的单位各1个横置]：将手牌中的这张卡放置到战场上。
 * 【诱】〖1游戏1次〗{由于这张卡的【启】能力的效果进入战场时}：所有玩家将手牌、侵蚀区、墓地中的所有卡返回持有者的卡组，将卡组洗切。之后，所有玩家抽5张卡。发动这个能力之后，本回合中，你的单位不能宣言攻击。这个回合结束之后，再进行1次你的回合。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105000325',
  fullName: '炉火之梦「真理」',
  specialName: '真理',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { RED: 1, WHITE: 1, YELLOW: 1, BLUE: 1, GREEN: 1 },
  faction: '无',
  acValue: 9,
  power: 4000,
  basePower: 4000,
  damage: 4,
  baseDamage: 4,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'UR',
  availableRarities: ['UR'],
  cardPackage: 'BT07',
  uniqueId: null as any,
};

export default card;
