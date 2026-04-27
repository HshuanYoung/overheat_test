import { Card, CardEffect, TriggerLocation } from '../types/game';
import { createSelectCardQuery, moveCard } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '101130102_alliance_bottom',
    type: 'TRIGGER',
    triggerEvent: 'CARD_DESTROYED_BATTLE',
    triggerLocation: ['UNIT'],
    isGlobal: true,
    description: '此单位参与的联军攻击中战斗破坏对手单位时，可以将墓地1张卡放到卡组底。',
    condition: (_gameState, playerState, instance, event) =>
      event?.playerUid !== playerState.uid &&
      event?.data?.isAlliance &&
      event.data.attackerIds?.includes(instance.gamecardId) &&
      playerState.grave.length > 0,
    execute: async (instance, gameState, playerState) => {
      createSelectCardQuery(
        gameState,
        playerState.uid,
        playerState.grave,
        '选择放回卡组底的卡',
        '选择你的墓地中的1张卡，放置到卡组底。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '101130102_alliance_bottom' },
        () => 'GRAVE'
      );
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = playerState.grave.find(card => card.gamecardId === selections[0]);
      if (target) moveCard(gameState, playerState.uid, target, 'DECK', instance, { insertAtBottom: true });
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101130102
 * Card2 Row: 62
 * Card Row: 62
 * Source CardNo: BT01-W07
 * Package: ST01(TD),BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:这个单位参与的联军攻击中，战斗破坏对手单位时，你可以选择你的墓地中的1张卡，放置到卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101130102',
  fullName: '索拉城的卫兵',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '圣王国',
  acValue: 2,
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
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
