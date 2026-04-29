import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000426
 * Card2 Row: 296
 * Card Row: 535
 * Source CardNo: BT04-G05
 * Package: BT04(ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【歼灭】
 * 【永】：你的战场上只能有一个神蚀单位。与这个单位进行战斗的对方的所有单位在那个战斗阶段中，所有效果无效。（不包括关键词效果）
 * 【启】〖同名一回合一次〗：[从你的手牌，卡组，墓地放逐合计2张「萨拉拉」的神蚀卡]这个能力只能在你的主要阶段发动。选择1名对手，将他卡组顶的3张卡送去墓地。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000426',
  fullName: '风清无音「萨拉拉」',
  specialName: '萨拉拉',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '无',
  acValue: 5,
  power: 4000,
  basePower: 4000,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isAnnihilation: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'SER',
  availableRarities: ['SER'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
