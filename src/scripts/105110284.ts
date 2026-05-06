import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105110284
 * Card2 Row: 443
 * Card Row: 326
 * Source CardNo: SP02-Y01
 * Package: SP02(SR,XSR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【创痕1】【启】〖1回合1次〗{你的主要阶段}[将你卡组顶的1张卡背面放逐]：公开你卡组顶的1张卡。根据那张卡的颜色处理以下效果：
 * ◆	红色：所有对手将他自己的卡组顶的3张卡送入墓地。
 * ◆	白色：恢复3（随机选择你墓地中的3张卡，放置到你的卡组底）。
 * ◆	黄色：所有对手选择他自己的1张手牌舍弃。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105110284',
  fullName: '天魔大公主「斯蒂芬妮」',
  specialName: '斯蒂芬妮',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 3 },
  faction: '学院要塞',
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
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
