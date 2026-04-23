import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_205110040_activate: CardEffect = {
  id: '205110040_activate',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  description: 'Reveal an opponent hand, then that opponent discards a non-unit card.',
  condition: (gameState, playerState) => {
    const opponentUid = gameState.playerIds.find(id => id !== playerState.uid);
    return !!opponentUid && gameState.players[opponentUid].hand.length > 0;
  },
  execute: async (instance, gameState, playerState) => {
    const opponentUid = gameState.playerIds.find(id => id !== playerState.uid);
    if (!opponentUid) return;

    const opponent = gameState.players[opponentUid];
    opponent.isHandPublic = 1;

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
      title: 'Discard A Card',
      description: 'Choose 1 non-unit card from your hand to discard.',
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
    if (!revealedPlayerUid || selections.length === 0) return;

    const revealedPlayer = gameState.players[revealedPlayerUid];
    revealedPlayer.isHandPublic = 0;

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
  cardPackage: 'BT01,ST04',
  uniqueId: null as any,
};

export default card;
