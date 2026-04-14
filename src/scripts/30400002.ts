import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect: CardEffect = {
  id: 'shuixian_trigger',
  type: 'TRIGGER',
  triggerEvent: 'CARD_ENTERED_ZONE',
  triggerLocation: ['ITEM'],
  isGlobal: true,
  isMandatory: false,
  limitCount: 1,
  limitGlobal: false,
  description: '一回合一次，当你的单位因效果返回手牌时，若你的手牌在1张及以上，可以丢弃一张手牌，将侵蚀区正面的一张卡加入手牌。',
  condition: (gameState: GameState, playerState: PlayerState, card: Card, event?: any) => {
    // 1. General readiness check
    if (!event) {
      return card.cardlocation === 'ITEM' || card.cardlocation === 'UNIT';
    }

    // 2. Specific Event validation
    if (!event.data?.isEffect) {
      return false;
    }

    if (event.type !== 'CARD_ENTERED_ZONE' || event.data?.zone !== 'HAND' || event.playerUid !== playerState.uid) {
      return false;
    }

    const movedCard = event.sourceCard;
    if (!movedCard || movedCard.type !== 'UNIT') {
      return false;
    }

    return playerState.hand.length >= 1;
  },
  execute: async (card: Card, gameState: GameState, playerState: PlayerState) => {
    if (playerState.hand.length === 0) return;

    // Stage 1: Discard cost
    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: playerState.hand.map(c => ({ card: c, source: 'HAND' as any })),
      title: '选择丢弃的手牌',
      description: '请选择一张手牌作为【水仙心法】的效果发动费用丢弃。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 1 }
    };
  },
  onQueryResolve: async (card, gameState, playerState, selections, context) => {
    const step = context?.step || 1;

    if (step === 1) {
      const discardId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'DISCARD_CARD',
        targetFilter: { gamecardId: discardId }
      }, card);
      gameState.logs.push(`${playerState.displayName} 丢弃了卡牌。`);

      // Stage 2: Pick from erosion
      const erosionOptions = playerState.erosionFront.filter(c => c !== null) as Card[];
      if (erosionOptions.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: erosionOptions.map(c => ({ card: c, source: 'EROSION_FRONT' as any })),
          title: '选择加入手牌的卡',
          description: '从你的侵蚀区正面选择一张卡加入手牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 2 }
        };
      } else {
        gameState.logs.push(`[水仙心法] 侵蚀区没有可选卡卡牌。`);
      }
    } else if (step === 2) {
      const targetId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'MOVE_FROM_EROSION',
        destinationZone: 'HAND',
        targetFilter: { gamecardId: targetId }
      }, card);
      gameState.logs.push(`[水仙心法] ${playerState.displayName} 将侵蚀区的卡牌加入手牌。`);
    }
  }
};

const card: Card = {
  id: '30400002',
  fullName: '水仙心法',
  specialName: '',
  type: 'ITEM',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { 'BLUE': 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
