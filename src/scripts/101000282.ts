import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101000282
 * Card2 Row: 441
 * Card Row: 324
 * Source CardNo: SP02-W03
 * Package: SP02(SR,XSR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】｛这个单位由于战斗或对手的卡的效果从战场上离开时｝：恢复3（随机选择你的墓地中的3张卡，将其放置到你的卡组底）。
 * 【启】〖同名1回合1次〗｛你的回合中，选择你战场上的1个红色或黄色的非神蚀单位、或卡名含有《天魔》的单位｝[将你的墓地中的红色、白色、黄色中的2种颜色的卡各1张放逐]：将战场上的被选择的单位放逐，之后，将那个单位放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101000282',
  fullName: '天魔自由人「艾瑟儿」',
  specialName: '艾瑟儿',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '无',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT06',
  uniqueId: null as any,
};

export default card;
