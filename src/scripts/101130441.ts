import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130441
 * Card2 Row: 318
 * Card Row: 557
 * Source CardNo: BT04-W07
 * Package: BT04(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】〖1回合1次〗：[将你的墓地中的3张卡放逐]选择战场上的1个<圣王国>的非神蚀单位，将其重置，本回合中〖力量+500〗。
 * 〖10+〗【启】〖一回合一次〗：这个能力只能在你进行过10次以上卡名含有《殿堂》的单位参与的攻击的回合中发动。将对手的卡组顶的5张卡正面放逐。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130441',
  fullName: '圣王子「卢恩」',
  specialName: '卢恩',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '圣王国',
  acValue: 3,
  power: 2000,
  basePower: 2000,
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
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
