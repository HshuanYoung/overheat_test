import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050276
 * Card2 Row: 435
 * Card Row: 318
 * Source CardNo: SP02-R01
 * Package: SP02(SR,XSR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】【异彩3】（〖同名1回合1次〗[将你的墓地中的3种颜色的非神蚀单位卡各1张放逐]:将手牌中的这张卡放置到战场上）。
 * 【诱】{这个单位参与的战斗的战斗自由步骤开始时}[将你的战场上的1个黄色或蓝色非神蚀单位送入墓地]:这次战斗中，你可以使这个单位+2+1500。
 * 【启】〖同名1回合1次〗{你的主要阶段中，选择1名对手}[将你的战场上的1个黄色或蓝色非神蚀单位送入墓地]:给予选择的玩家2点伤害。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050276',
  fullName: '炽月·女王「凯萨琳」',
  specialName: '凯萨琳',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 3 },
  faction: '伊列宇王国',
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
