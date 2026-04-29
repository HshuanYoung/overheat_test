import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canPutUnitOntoBattlefield, createSelectCardQuery, isFaction, markReturnToDeckBottomAtEnd, putUnitOntoField, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203080083_prepare', '若你的战场上有<神木森>神蚀单位，将卡组中1张<神木森>单位放置到战场上。回合结束时，将那个单位放置到卡组底。', async (instance, gameState, playerState) => {
  const candidates = playerState.deck.filter(card => card.type === 'UNIT' && isFaction(card, '神木森') && canPutUnitOntoBattlefield(playerState, card));
  createSelectCardQuery(
    gameState,
    playerState.uid,
    candidates,
    '选择神木森单位',
    '选择卡组中的1张<神木森>单位卡放置到战场上。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '203080083_prepare' },
    () => 'DECK'
  );
}, {
  condition: (_gameState, playerState) =>
    playerState.unitZone.some(unit => unit && unit.godMark && isFaction(unit, '神木森')) &&
    playerState.deck.some(card => card.type === 'UNIT' && isFaction(card, '神木森') && canPutUnitOntoBattlefield(playerState, card)),
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (selected?.cardlocation !== 'DECK') return;
    const ok = putUnitOntoField(gameState, playerState.uid, selected, instance);
    if (!ok) return;
    const moved = AtomicEffectExecutor.findCardById(gameState, selected.gamecardId);
    if (moved) markReturnToDeckBottomAtEnd(moved, instance, gameState, playerState.uid);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203080083
 * Card2 Row: 374
 * Card Row: 244
 * Source CardNo: BT05-G08
 * Package: BT05(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * {若你的战场上有<神木森>的神蚀单位}:将你的卡组中的1张<神木森>单位卡放置到战场上。本回合结束时，将那个单位放置到你的卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203080083',
  fullName: '降灵的准备',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '神木森',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
