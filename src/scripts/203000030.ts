import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, canPutUnitOntoBattlefield, createSelectCardQuery, isNonGodUnit, markExileAtEndOfTurn, moveCard, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000030_revive', '选择墓地中1个力量3000以下的非神蚀单位放置到战场上，回合结束时放逐。', async (instance, gameState, playerState) => {
    const candidates = playerState.grave.filter(card => isNonGodUnit(card) && (card.power || 0) <= 3000 && canPutUnitOntoBattlefield(playerState, card));
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择放置到战场的单位',
      '选择你的墓地中的1个力量3000以下的非神蚀单位，放置到战场上。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '203000030_revive' },
      () => 'GRAVE'
    );
  }, {
    condition: (_gameState, playerState) => playerState.grave.some(card => isNonGodUnit(card) && (card.power || 0) <= 3000 && canPutUnitOntoBattlefield(playerState, card)),
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = playerState.grave.find(card => card.gamecardId === selections[0] && isNonGodUnit(card) && (card.power || 0) <= 3000 && canPutUnitOntoBattlefield(playerState, card));
    if (!target) return;
    const id = target.gamecardId;
    moveCard(gameState, playerState.uid, target, 'UNIT', instance);
    const live = AtomicEffectExecutor.findCardById(gameState, id);
    if (live) {
      live.playedTurn = gameState.turnCount;
      markExileAtEndOfTurn(gameState, playerState.uid, live, instance, `203000030_end_exile_${id}`);
    }
    }
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000030
 * Card2 Row: 35
 * Card Row: 35
 * Source CardNo: BT01-G14
 * Package: BT01(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的墓地中的1个〖力量3000〗以下的非神蚀单位，放置到战场上。回合结束时，将那个单位放逐。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000030',
  fullName: '突袭',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
