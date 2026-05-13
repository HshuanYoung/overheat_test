import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canPutUnitOntoBattlefield, isNonGodUnit, markExileAtEndOfTurn, moveCard, story } from './BaseUtil';

const getRushCandidates = (playerState: any) =>
  playerState.grave.filter((card: Card) =>
    isNonGodUnit(card) &&
    (card.power || 0) <= 3000 &&
    canPutUnitOntoBattlefield(playerState, card)
  );

const resolveRushTarget = (instance: Card, gameState: any, playerState: any, targetId?: string) => {
  const target = targetId
    ? getRushCandidates(playerState).find((card: Card) => card.gamecardId === targetId)
    : undefined;
  if (!target) {
    gameState.logs.push(`[${instance.fullName}] 指定对象不合法或已离开墓地，效果不处理。`);
    return;
  }

  const id = target.gamecardId;
  moveCard(gameState, playerState.uid, target, 'UNIT', instance);
  const live = AtomicEffectExecutor.findCardById(gameState, id);
  if (live) {
    live.playedTurn = gameState.turnCount;
    (live as any).data = {
      ...((live as any).data || {}),
      cannotAttackThisTurn: gameState.turnCount,
      cannotAttackThisTurnSourceName: instance.fullName
    };
    markExileAtEndOfTurn(gameState, playerState.uid, live, instance, `203000030_end_exile_${id}`);
  }
};

const cardEffects: CardEffect[] = [story('203000030_revive', '选择墓地中1个力量3000以下的非神蚀单位放置到战场上，回合结束时放逐。', async (instance, gameState, playerState, _event, declaredSelections?: string[]) => {
    resolveRushTarget(instance, gameState, playerState, declaredSelections?.[0]);
  }, {
    condition: (_gameState, playerState) => getRushCandidates(playerState).length > 0,
    targetSpec: {
      title: '选择放置到战场的单位',
      description: '选择你的墓地中的1个力量3000以下的非神蚀单位，放置到战场上。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['GRAVE'],
      controller: 'SELF',
      getCandidates: (_gameState, playerState) => getRushCandidates(playerState)
        .map(card => ({ card, source: 'GRAVE' as any }))
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      resolveRushTarget(instance, gameState, playerState, selections?.[0]);
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
