import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, addContinuousDamage, addContinuousKeyword, addContinuousPower, createSelectCardQuery, enteredFromHand, ownUnits, searchDeckEffect } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '101140435_lone_god_boost',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '若你的战场上的神蚀单位仅有1个，这个单位伤害+1、力量+2000并获得【英勇】。',
  applyContinuous: (gameState, instance) => {
    const owner = Object.values(gameState.players).find(player => player.unitZone.some(unit => unit?.gamecardId === instance.gamecardId));
    if (!owner || owner.unitZone.filter(unit => unit?.godMark).length !== 1) return;
    addContinuousDamage(instance, instance, 1);
    addContinuousPower(instance, instance, 2000);
    addContinuousKeyword(instance, instance, 'heroic');
  }
}, {
  ...searchDeckEffect('101140435_enter_search', '同名1回合1次：从手牌进入战场时，可以选择卡组中1张《战天使》以外力量1500以下<女神教会>单位加入手牌。', card =>
    card.type === 'UNIT' &&
    card.fullName !== '战天使' &&
    card.faction === '女神教会' &&
    (card.power || card.basePower || 0) <= 1500
  ),
  limitCount: 1,
  limitNameType: true,
  condition: (_gameState, _playerState, instance, event) =>
    event?.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    enteredFromHand(instance, event)
} as CardEffect];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140435
 * Card2 Row: 312
 * Card Row: 551
 * Source CardNo: BT04-W01
 * Package: BT04(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】：若你的战场上的神蚀单位仅有一个的话，这个单位〖伤害+1〗〖力量+2000〗并获得【英勇】。
 * 【诱】〖同名1回合1次〗：这个单位从手牌进入战场时，你可以选择你的卡组中的一张《战天使》以外的〖力量1500〗以下的<女神教会>的单位卡，将其加入手牌。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140435',
  fullName: '战天使',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '女神教会',
  acValue: 2,
  power: 1000,
  basePower: 1000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  isHeroic: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
