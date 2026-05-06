import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000272
 * Card2 Row: 431
 * Card Row: 314
 * Source CardNo: SP02-G01
 * Package: SP02(R,SPR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】{这个单位进入战场时}[横置，舍弃一张手牌]:你可以将你的卡组中一张具有异彩的卡加入手牌。
 * 【启】〖1回合1次〗{选择你的墓地中的一张非神蚀单位卡}:将被选择的卡放逐。本回合中，这个单位也具备被放逐的卡的颜色。
 * “接下来，我们来听听三队的主将有什么想说的吧！
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000272',
  fullName: '狐族报道员',
  specialName: '',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 500,
  basePower: 500,
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
  cardPackage: 'BT07',
  uniqueId: null as any,
};

export default card;
