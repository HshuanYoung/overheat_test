import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_105110111_continuous: CardEffect = {
  id: '105110111_continuous',
  type: 'CONTINUOUS',
  description: '你每控制1张道具，这个单位伤害+1、力量+500，最多伤害+3、力量+1500。',
  applyContinuous: (gameState, instance) => {
    const ownerUid = AtomicEffectExecutor.findCardOwnerKey(gameState, instance.gamecardId);
    if (!ownerUid) return;

    const owner = gameState.players[ownerUid];
    const itemCount = owner.itemZone.filter(card => !!card).length;
    const bonusCount = Math.min(itemCount, 3);
    if (bonusCount <= 0) return;

    instance.damage = (instance.damage || 0) + bonusCount;
    instance.power = (instance.power || 0) + bonusCount * 500;
    instance.influencingEffects = instance.influencingEffects || [];
    instance.influencingEffects.push({
      sourceCardName: instance.fullName,
      description: `道具卡数量加成：+${bonusCount}伤害 / +${bonusCount * 500}力量`
    });
  }
};

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105110111
 * Card2 Row: 77
 * Card Row: 77
 * Source CardNo: BT01-Y05
 * Package: BT01(C),ST04(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【永】:你的战场上每有1张道具卡，这个单位〖伤害+1〗〖力量+500〗。但是，最多只能通过这个能力〖伤害+3〗〖力量+1500〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105110111',
  fullName: '菲晶工程师',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 3,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110111_continuous],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
