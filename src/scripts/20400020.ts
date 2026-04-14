import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20400020',
  fullName: '任务：击溃恶党',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'defeat_villains_activate_main',
      type: 'ACTIVATE',
      description: '【回合名称1次】：只能在自己的主要阶段发动。选择对手一个横置单位。在本回合中，当该单位离开战场时，你可以选择对手战场上的一个非神蚀卡牌，放置在对手卡组顶。',
      limitCount: 1,
      limitNameType: true,
      condition: (gameState, playerState) => {
        if (gameState.phase !== 'MAIN' || gameState.players[gameState.playerIds[gameState.currentTurnPlayer]].uid !== playerState.uid) return false;
        
        // Check for opponent horizontal units
        const opponentId = Object.keys(gameState.players).find(id => id !== playerState.uid)!;
        const opponent = gameState.players[opponentId];
        return opponent.unitZone.some(u => u && u.isExhausted);
      },
      execute: async (card, gameState, playerState) => {
        const opponentId = Object.keys(gameState.players).find(id => id !== playerState.uid)!;
        const opponent = gameState.players[opponentId];
        const targets = opponent.unitZone.filter(u => u && u.isExhausted) as Card[];

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' }))),
          title: '选择目标单位',
          description: '选择对手一个横置单位进行标记。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            sourceCardId: card.gamecardId,
            effectIndex: 0,
            step: 1
          }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const targetId = selections[0];
        // Mark the target and current turn
        (card as any).data = {
           ...( (card as any).data || {} ),
           markedTargetId: targetId,
           playedTurn: gameState.turnCount
        };
        gameState.logs.push(`[任务：击溃恶党] 已标记目标单位。当其离开战场时将触发后续效果。`);
      }
    },
    {
      id: 'defeat_villains_trigger_leave',
      type: 'TRIGGER',
      description: '（标记效果触发）当标记单位离场时，将对手战场一张非神蚀卡放置在卡组顶。',
      triggerLocation: ['GRAVE', 'PLAY'],
      triggerEvent: 'CARD_LEFT_ZONE',
      isMandatory: false,
      condition: (gameState, playerState, card, event) => {
        const data = (card as any).data;
        if (!data || !event) return false;
        
        // Must be the marked target leaving in the same turn
        return event.sourceCardId === data.markedTargetId && gameState.turnCount === data.playedTurn;
      },
      execute: async (card, gameState, playerState, event) => {
        const opponentId = Object.keys(gameState.players).find(id => id !== playerState.uid)!;
        const opponent = gameState.players[opponentId];
        const targets = [...opponent.unitZone, ...opponent.itemZone].filter(c => c && !c.godMark) as Card[];

        if (targets.length === 0) return;

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: t.cardlocation as any }))),
          title: '选择对手卡牌回卡组顶',
          description: '标记单位已离场，请选择对手战场一张非神蚀卡放置在对手卡组顶。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            sourceCardId: card.gamecardId,
            effectIndex: 1,
            step: 2
          }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const targetId = selections[0];
        const opponentId = Object.keys(gameState.players).find(id => id !== playerState.uid)!;
        
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          targetFilter: { gamecardId: targetId },
          destinationZone: 'DECK'
        }, card);
        gameState.logs.push(`[任务：击溃恶党] 效果：将对方的一张卡牌放置在卡组顶。`);
      }
    },
    {
      id: 'defeat_villains_activate_erosion',
      type: 'ACTIVATE',
      description: '【对付】：若你的战场上有「冒险家工会」单位且此卡在侵蚀区，舍弃1张手牌：打出此卡。',
      triggerLocation: ['EROSION_FRONT', 'EROSION_BACK'],
      condition: (gameState, playerState) => {
        // Must have Adventure Guild unit
        const hasGuildUnit = playerState.unitZone.some(u => u && u.faction === '冒险家工会');
        return hasGuildUnit && playerState.hand.length > 0;
      },
      cost: async (gameState, playerState, card) => {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: playerState.hand.map(h => ({ card: h, source: 'HAND' })),
          title: '选择舍弃的卡牌',
          description: '舍弃1张手牌以从侵蚀区打出「任务：击溃恶党」。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'ACTIVATE_COST_RESOLVE',
          context: {
             sourceCardId: card.gamecardId,
             effectIndex: 2
          }
        };
        return true;
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        // Discard selected card
        const discardId = selections[0];
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DISCARD_CARD',
          targetFilter: { gamecardId: discardId }
        }, card);

        // Force play self
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'FORCE_PLAY',
          targetFilter: { gamecardId: card.gamecardId }
        }, card);
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
