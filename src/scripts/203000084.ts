import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, getOpponentUid, isNonGodUnit, moveCard, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000084_send_units', '主要阶段中，选择你的与对手的各1个非神蚀单位，将被选择的单位送入墓地。', async (instance, gameState, playerState) => {
  createSelectCardQuery(
    gameState,
    playerState.uid,
    ownUnits(playerState).filter(isNonGodUnit),
    '选择我方单位',
    '选择你的1个非神蚀单位。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '203000084_send_units', step: 'OWN' },
    () => 'UNIT'
  );
}, {
  condition: (gameState, playerState) =>
    gameState.phase === 'MAIN' &&
    playerState.isTurn &&
    ownUnits(playerState).some(isNonGodUnit) &&
    ownUnits(gameState.players[getOpponentUid(gameState, playerState.uid)]).some(isNonGodUnit),
  targetSpec: {
    targetGroups: [{
      title: '选择我方单位',
      description: '选择你的1个非神蚀单位。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['UNIT'],
      controller: 'SELF',
      step: 'OWN',
      getCandidates: (_gameState, playerState) => ownUnits(playerState)
        .filter(isNonGodUnit)
        .map(card => ({ card, source: 'UNIT' as any }))
    }, {
      title: '选择对手单位',
      description: '选择对手的1个非神蚀单位。',
      minSelections: 1,
      maxSelections: 1,
      zones: ['UNIT'],
      controller: 'OPPONENT',
      step: 'OPPONENT',
      getCandidates: (gameState, playerState) => ownUnits(gameState.players[getOpponentUid(gameState, playerState.uid)])
        .filter(isNonGodUnit)
        .map(card => ({ card, source: 'UNIT' as any }))
    }]
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.declaredTargets?.length) {
      const ownTargetId = context.declaredTargets.find((target: any) => target.step === 'OWN')?.gamecardId;
      const opponentTargetId = context.declaredTargets.find((target: any) => target.step === 'OPPONENT')?.gamecardId;
      const ownTarget = ownTargetId ? AtomicEffectExecutor.findCardById(gameState, ownTargetId) : undefined;
      const opponentTarget = opponentTargetId ? AtomicEffectExecutor.findCardById(gameState, opponentTargetId) : undefined;
      if (ownTarget?.cardlocation === 'UNIT') moveCard(gameState, playerState.uid, ownTarget, 'GRAVE', instance);
      if (opponentTarget?.cardlocation === 'UNIT') moveCard(gameState, getOpponentUid(gameState, playerState.uid), opponentTarget, 'GRAVE', instance);
      return;
    }
    if (context?.step === 'OWN') {
      const ownTargetId = selections[0];
      const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      createSelectCardQuery(
        gameState,
        playerState.uid,
        ownUnits(opponent).filter(isNonGodUnit),
        '选择对手单位',
        '选择对手的1个非神蚀单位。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '203000084_send_units', step: 'OPPONENT', ownTargetId },
        () => 'UNIT'
      );
      return;
    }
    if (context?.step !== 'OPPONENT') return;
    const ownTarget = AtomicEffectExecutor.findCardById(gameState, context.ownTargetId);
    const opponentTarget = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (ownTarget?.cardlocation === 'UNIT') moveCard(gameState, playerState.uid, ownTarget, 'GRAVE', instance);
    if (opponentTarget?.cardlocation === 'UNIT') moveCard(gameState, getOpponentUid(gameState, playerState.uid), opponentTarget, 'GRAVE', instance);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000084
 * Card2 Row: 375
 * Card Row: 245
 * Source CardNo: BT05-G09
 * Package: BT05(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * {你的主要阶段，选择战场上的你与对手的各1个非神蚀单位}:将被选择的单位送入墓地。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000084',
  fullName: '魔女的窃窃私语',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
