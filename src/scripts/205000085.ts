import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, getOpponentUid, nameContains, ownItems, ownUnits, readyByEffect, story } from './BaseUtil';

const isTargetUnit = (card: Card) => nameContains(card, '怪盗') || nameContains(card, '魔术家');

const cardEffects: CardEffect[] = [story('205000085_reset_exhaust', '选择你的1个卡名含有《怪盗》或《魔术家》的单位，破坏你的1张道具卡。之后重置被选择单位，并横置对手1个单位。', async (instance, gameState, playerState) => {
  createSelectCardQuery(
    gameState,
    playerState.uid,
    ownUnits(playerState).filter(isTargetUnit),
    '选择我方单位',
    '选择你的战场上的1个卡名含有《怪盗》或《魔术家》的单位。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '205000085_reset_exhaust', step: 'OWN' },
    () => 'UNIT'
  );
}, {
  limitCount: 1,
  limitNameType: true,
  condition: (gameState, playerState) =>
    ownUnits(playerState).some(isTargetUnit) &&
    ownItems(playerState).length > 0 &&
    ownUnits(gameState.players[getOpponentUid(gameState, playerState.uid)]).length > 0,
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'OWN') {
      createSelectCardQuery(
        gameState,
        playerState.uid,
        ownItems(playerState),
        '选择破坏道具',
        '选择你的战场上的1张道具卡破坏。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '205000085_reset_exhaust', step: 'ITEM', ownTargetId: selections[0] },
        () => 'ITEM'
      );
      return;
    }
    if (context?.step === 'ITEM') {
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DESTROY_CARD', targetFilter: { gamecardId: selections[0] } }, instance);
      const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      createSelectCardQuery(
        gameState,
        playerState.uid,
        ownUnits(opponent),
        '选择对手单位',
        '选择对手的1个单位，将其横置。',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '205000085_reset_exhaust', step: 'OPPONENT', ownTargetId: context.ownTargetId },
        () => 'UNIT'
      );
      return;
    }
    if (context?.step !== 'OPPONENT') return;
    const ownTarget = AtomicEffectExecutor.findCardById(gameState, context.ownTargetId);
    if (ownTarget) readyByEffect(gameState, ownTarget, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'ROTATE_HORIZONTAL', targetFilter: { gamecardId: selections[0] } }, instance);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 205000085
 * Card2 Row: 394
 * Card Row: 264
 * Source CardNo: BT05-Y08
 * Package: BT05(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖同名1回合1次〗{选择你的战场上的1个卡名含有《怪盗》或《魔术家》的单位}:将你的战场上的1张道具卡破坏。之后，将被选择的单位〖重置〗，选择对手的1个单位，将其〖横置〗。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '205000085',
  fullName: '怪盗？魔术？钟结！',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '无',
  acValue: 2,
  godMark: true,
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
