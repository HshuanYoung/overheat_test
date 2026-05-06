import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105000323
 * Card2 Row: 445
 * Card Row: 380
 * Source CardNo: SP02-Y03
 * Package: SP02(R,SPR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】〖同名1回合1次〗{这个单位进入战场时，选择你的战场上的1个红色或白色的没有颜色限制的非神蚀单位、或「斯蒂芬妮」单位}[将你的卡组顶的1张卡背面放逐]：本回合中，这个单位获得被选择的单位的一个启能力，得到的能力在发动一次后失去。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105000323',
  fullName: '天魔管理员',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 3,
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
  effects: [],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT06',
  uniqueId: null as any,
};

export default card;
