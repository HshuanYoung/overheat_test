import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000273
 * Card2 Row: 432
 * Card Row: 315
 * Source CardNo: SP02-G02
 * Package: SP02(R,SPR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】〖同名1回合1次〗{你的战场上有白色或蓝色单位，这个单位进入战场时，选择你的一个非神蚀单位}:本回合中，被选择的单位＋1/＋1500。
 * 【启】{选择一个你的「维多利亚」单位}{将你的战场上的白色、蓝色卡各一张横置}:将被选择的单位重置，本回合中，被选择的单位＋1000。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000273',
  fullName: '兽神之辅佐「维拉妮卡」',
  specialName: '维拉妮卡',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 2,
  power: 1000,
  basePower: 1000,
  damage: 1,
  baseDamage: 1,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT07',
  uniqueId: null as any,
};

export default card;
