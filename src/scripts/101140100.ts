import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, allCardsOnField, appendEndResolution, createSelectCardQuery, exileByEffect, moveCard, ownUnits, ownerUidOf } from './BaseUtil';

const cardEffects: CardEffect[] = [{
    id: '101140100_blink',
    type: 'TRIGGER',
    triggerEvent: 'CARD_ENTERED_ZONE',
    triggerLocation: ['UNIT'],
    description: '入场时，若你的<女神教会>单位有3个以上，放逐战场上1张其他卡，下一次你的回合结束时返回。',
    condition: (_gameState, playerState, instance, event) => event?.sourceCardId === instance.gamecardId && event.data?.zone === 'UNIT' && ownUnits(playerState).filter(unit => unit.faction === '女神教会').length >= 3,
    execute: async (instance, gameState, playerState) => {
      const candidates = allCardsOnField(gameState).filter(card => card.gamecardId !== instance.gamecardId);
      if (candidates.length === 0) return;
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择放逐对象',
        '选择战场上的1张这个单位以外的卡，将其放逐。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '101140100_blink' },
        card => card.cardlocation || 'UNIT'
      );
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = allCardsOnField(gameState).find(card => card.gamecardId === selections[0]);
      if (!target) return;
      const ownerUid = ownerUidOf(gameState, target);
      const zone = target.cardlocation as TriggerLocation;
      const id = target.gamecardId;
      exileByEffect(gameState, target, instance);
      appendEndResolution(gameState, playerState.uid, instance, '101140100_return', (source, state) => {
        const exiled = AtomicEffectExecutor.findCardById(state, id);
        if (exiled && ownerUid) moveCard(state, ownerUid, exiled, zone, source);
      });
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 101140100
 * Card2 Row: 60
 * Card Row: 60
 * Source CardNo: BT01-W05
 * Package: ST01(TD),BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【诱】:这个单位进入战场时，若你的战场上的<女神教会>单位有3个以上，选择战场上的1张这个单位以外的卡，将其放逐。下一次你的回合结束时，将那张卡放置到其持有者的战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '101140100',
  fullName: '教会调查团',
  specialName: '',
  type: 'UNIT',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: {},
  faction: '女神教会',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
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
