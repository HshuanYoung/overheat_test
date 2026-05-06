import { Card } from '../types/game';

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 205000149
 * Card2 Row: 268
 * Card Row: 624
 * Source CardNo: SP01-Y02
 * Package: SP01(R,SPR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 将你的卡组洗切，公开你的卡组顶的1张卡。若那张卡是神蚀卡，将对手战场上的〖力量2000〗以下的所有非神蚀单位破坏；若那张卡是非神蚀单位卡，将所有玩家战场上的〖力量2000〗以下的所有非神蚀单位破坏。将公开的那张卡按原样放回。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '205000149',
  fullName: '魔偶姬的巧克力',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 3 },
  faction: '无',
  acValue: 4,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT06',
  uniqueId: null as any,
};

export default card;
