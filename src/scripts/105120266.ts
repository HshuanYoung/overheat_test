import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105120266
 * Card2 Row: 425
 * Card Row: 308
 * Source CardNo: ST04-Y12
 * Package: ST04(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】〖同名1回合1次{这个单位从手牌进入战场时，或这个单位从战场离开时}{将你的墓地中的3张卡名含有《炼金》的放逐}：选择你的卡组中的1张卡名含有《炼金》的非神蚀单位卡，将其放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105120266',
  fullName: '炼金重铸士「娜娜」',
  specialName: '娜娜',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '永生之乡',
  acValue: 4,
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
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
