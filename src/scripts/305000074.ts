import { Card, CardEffect } from '../types/game';
import { createChoiceQuery, getOnlyGodMarkUnit, moveCard } from './BaseUtil';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_305000074_trigger: CardEffect = {
  id: '305000074_trigger',
  type: 'TRIGGER',
  triggerLocation: ['ITEM'],
  triggerEvent: 'PHASE_CHANGED',
  description: '每个对手回合开始时，若你只控制1个神蚀单位，你可以查看对手卡组顶1张卡，并将其放置到卡组顶或卡组底。',
  condition: (gameState, playerState, instance, event) =>
    instance.cardlocation === 'ITEM' &&
    event?.type === 'PHASE_CHANGED' &&
    event.data?.phase === 'START' &&
    !playerState.isTurn &&
    !!getOnlyGodMarkUnit(playerState),
  execute: async (instance, gameState, playerState) => {
    const opponentUid = gameState.playerIds.find(uid => uid !== playerState.uid)!;
    const opponent = gameState.players[opponentUid];
    const topCard = opponent.deck[opponent.deck.length - 1];
    if (!topCard) return;

    createChoiceQuery(
      gameState,
      playerState.uid,
      '卡组顶选择',
      `对手卡组顶卡牌：${topCard.fullName}`,
      [
        { id: 'TOP', label: '留在卡组顶' },
        { id: 'BOTTOM', label: '放到卡组底' }
      ],
      {
        sourceCardId: instance.gamecardId,
        effectId: '305000074_trigger',
        targetId: topCard.gamecardId,
        opponentUid
      }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections, context) => {
    if (selections[0] !== 'BOTTOM') return;
    const target = AtomicEffectExecutor.findCardById(gameState, context.targetId);
    if (!target) return;
    moveCard(gameState, context.opponentUid, target, 'DECK', instance, { insertAtBottom: true });
  }
};

const card: Card = {
  id: '305000074',
  fullName: '「神眼吊坠」',
  specialName: '神眼吊坠',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305000074_trigger],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
