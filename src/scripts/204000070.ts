import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '204000070',
  fullName: '伏击',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'ambush_activate',
      type: 'ACTIVATE',
      triggerLocation: ['HAND', 'PLAY'],
      description: '选择战场上一个在本回合进入战场的单位，将其返回持有者的手牌。',
      condition: (gameState: GameState, playerState: PlayerState, card: Card) => {
        // Find if there's any unit that entered the battlefield this turn
        return Object.values(gameState.players).some(p =>
          p.unitZone.some(u => u !== null && u.playedTurn === gameState.turnCount)
        );
      },
      execute: async (card: Card, gameState: GameState, playerState: PlayerState) => {
        const targets: Card[] = [];
        Object.values(gameState.players).forEach(p => {
          p.unitZone.forEach(u => {
            if (u !== null && u.playedTurn === gameState.turnCount) {
              targets.push(u);
            }
          });
        });

        if (targets.length === 0) {
          gameState.logs.push(`[伏击] 没有合法目标。`);
          return;
        }

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(t => ({ card: t, source: 'UNIT' as any }))),
          title: '选择返回手牌的单位',
          description: '请选择一个本回合进入战场的单位返回持有者手牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            sourceCardId: card.gamecardId,
            effectIndex: 0
          }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const targetId = selections[0];

        // Find target for log
        let targetCard: Card | undefined;
        Object.values(gameState.players).forEach(p => {
          const found = p.unitZone.find(u => u?.gamecardId === targetId);
          if (found) targetCard = found;
        });

        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          destinationZone: 'HAND',
          targetFilter: { gamecardId: targetId }
        }, card);

        gameState.logs.push(`${playerState.displayName} 发动了 [伏击]，将在本回合登场的 ${targetCard?.fullName || '一个单位'} 返回手牌。`);
      },
      targetSpec: {
        title: '选择返回手牌的单位',
        description: '请选择一个本回合进入战场的单位返回持有者手牌。',
        minSelections: 1,
        maxSelections: 1,
        zones: ['UNIT'],
        getCandidates: gameState => Object.values(gameState.players)
          .flatMap(player => player.unitZone.filter((card): card is Card => !!card && card.playedTurn === gameState.turnCount))
          .map(card => ({ card, source: 'UNIT' as any }))
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
