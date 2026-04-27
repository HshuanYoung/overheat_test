import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103000084
 * Card2 Row: 32
 * Card Row: 32
 * Source CardNo: BT01-G11
 * Package: BT01(SR,ESR,OHR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖我方单位区有两个或者以上的绿色单位〗，将你的战场上的3个非神蚀单位送入墓地]这个能力只能在你的主要阶段中从墓地发动，且不能用于对抗。将这张卡放置到战场上，本回合中，这个单位获得【速攻】【歼灭】。 
 * 〖10+〗 【启】〖1游戏1次〗:[〖侵蚀2〗]选择对手的2个非神蚀单位，将其横置。下次对手的回合开始阶段中，那些单位不能重置。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103000084',
  fullName: '苍穹的飞狮「奇美拉」',
  specialName: '奇美拉',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '无',
  acValue: 3,
  power: 3500,
  basePower: 3500,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  isAnnihilation: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('103000084'),
  rarity: 'SR',
  availableRarities: ['SR', 'SER'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
