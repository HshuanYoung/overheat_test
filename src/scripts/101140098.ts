import { Card } from '../types/game';
import { getBt01CardEffects } from './_bt03YellowUtils';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140098
 * Card2 Row: 58
 * Card Row: 58
 * Source CardNo: BT01-W03
 * Package: BT01(SR,ESR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:你的回合开始时，选择你的墓地中的1张卡，放置到卡组底。之后，选择1名对手，将他的卡组顶的1张卡送入墓地。
 * 〖10+〗 【启】〖1回合1次〗:〖[侵蚀2〗]选择战场上的1张卡，将其破坏。
 * 〖10+〗【启】〖1回合1次〗:〖[侵蚀2〗]直到下一次你的回合结束时为止，这个单位变为〖伤害4〗〖力量4000〗并获得【英勇】。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140098',
  fullName: '天翼的审判官「丝梅特」',
  specialName: '丝梅特',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 2 },
  faction: '女神教会',
  acValue: 2,
  power: 0,
  basePower: 0,
  damage: 0,
  baseDamage: 0,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isHeroic: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: getBt01CardEffects('101140098'),
  rarity: 'SR',
  availableRarities: ['SR', 'SER'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
