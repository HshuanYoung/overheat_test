import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, damagePlayerByEffect, moveCard } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '102050089_damage_search',
    type: 'TRIGGER',
    triggerEvent: 'COMBAT_DAMAGE_CAUSED',
    triggerLocation: ['UNIT'],
    isMandatory: false,
    description: '给予对手战斗伤害时，可以从卡组将1张<伊列宇王国>神蚀卡加入手牌。之后给予你1点伤害。',
    condition: (_gameState, playerState, instance, event) => {
      const attackerIds = event?.data?.attackerIds || [];
      return event?.playerUid !== playerState.uid &&
        attackerIds.includes(instance.gamecardId) &&
        playerState.deck.some(card => card.faction === '伊列宇王国' && card.godMark);
    },
    execute: async (instance, gameState, playerState) => {
      const candidates = playerState.deck.filter(card => card.faction === '伊列宇王国' && card.godMark);
      if (candidates.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择加入手牌的卡',
        '选择你的卡组中的1张<伊列宇王国>神蚀卡，将其加入手牌。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '102050089_damage_search' },
        () => 'DECK'
      );
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = playerState.deck.find(card => card.gamecardId === selections[0]);
      if (target) {
        moveCard(gameState, playerState.uid, target, 'HAND', instance);
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
      }
      await damagePlayerByEffect(gameState, playerState.uid, playerState.uid, 1, instance);
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 102050089
 * Card2 Row: 43
 * Card Row: 43
 * Source CardNo: BT01-R05
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 〖5~7〗【诱】:这个单位给予对手战斗伤害时，你可以选择你的卡组中的1张<伊列宇王国>的神蚀卡，将其加入手牌。之后，给予你1点伤害。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '102050089',
  fullName: '赛利亚骑士团',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '伊列宇王国',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
