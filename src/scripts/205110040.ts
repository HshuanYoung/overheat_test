import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const formatHandRevealLog = (cards: Card[]) =>
  cards.length === 0
    ? '[]'
    : cards.map((card, index) => `${index + 1}.[${card.fullName}]`).join(' ');

const effect_205110040_activate: CardEffect = {
  id: '205110040_activate',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  description: '展示对手手牌，之后该对手舍弃1张非单位卡。',
  condition: (gameState, playerState) => {
    const opponentUid = gameState.playerIds.find(id => id !== playerState.uid);
    return !!opponentUid && gameState.players[opponentUid].hand.length > 0;
  },
  execute: async (instance, gameState, playerState) => {
    const opponentUid = gameState.playerIds.find(id => id !== playerState.uid);
    if (!opponentUid) return;

    const opponent = gameState.players[opponentUid];
    opponent.isHandPublic = 1;
    gameState.logs.push(
      `[${instance.id}] revealed ${opponent.displayName}'s hand: ${formatHandRevealLog(opponent.hand)}`
    );

    const discardableCards = opponent.hand.filter(card => card.type !== 'UNIT');
    if (discardableCards.length === 0) {
      gameState.logs.push(`[${instance.id}] revealed ${opponent.displayName}'s hand, but no non-unit card could be discarded.`);
      opponent.isHandPublic = 0;
      return;
    }

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: opponentUid,
      options: AtomicEffectExecutor.enrichQueryOptions(
        gameState,
        opponentUid,
        discardableCards.map(card => ({ card, source: 'HAND' as const }))
      ),
      title: '舍弃卡牌',
      description: '从你的手牌中选择1张非单位卡舍弃。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '205110040_activate',
        revealedPlayerUid: opponentUid
      }
    };
  },
  onQueryResolve: async (instance, gameState, _playerState, selections, context) => {
    const revealedPlayerUid = context?.revealedPlayerUid;
    if (!revealedPlayerUid) return;

    const revealedPlayer = gameState.players[revealedPlayerUid];
    revealedPlayer.isHandPublic = 0;
    if (selections.length === 0) return;

    const targetId = selections[0];
    const targetCard = AtomicEffectExecutor.findCardById(gameState, targetId);
    await AtomicEffectExecutor.execute(gameState, revealedPlayerUid, {
      type: 'DISCARD_CARD',
      targetFilter: { gamecardId: targetId }
    }, instance);

    if (targetCard) {
      gameState.logs.push(`[${instance.id}] made ${revealedPlayer.displayName} discard [${targetCard.fullName}].`);
    }
  }
};

const card: Card = {
  id: '205110040',
  fullName: '机密窥探',
  specialName: '',
  type: 'STORY',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_205110040_activate],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
