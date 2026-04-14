import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20400001',
  fullName: '歌月拂风',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'fufeng_activate',
      type: 'ACTIVATE',
      condition: (gameState: GameState, playerState: PlayerState, card: Card) => {
        // Can only be played if there is at least one valid target unit on the battlefield
        const isFuhuaPresent = playerState.unitZone.some(c => c && c.specialName === '风花');
        const filter = {
          onField: true,
          type: 'UNIT',
          godMark: isFuhuaPresent ? undefined : false
        };

        return Object.values(gameState.players).some(p => 
          p.unitZone.some(u => u && AtomicEffectExecutor.matchesFilter(u, filter as any, card))
        );
      },
      description: '选择战场上一个非神格的单位卡返回持有者手牌。若你的战场上存在「风花」单位，可以选择战场上一个神格单位返回持有者手牌。',
      execute: async (card: Card, gameState: GameState, playerState: PlayerState) => {
        // 1. Check for Fuhua on your side
        const isFuhuaPresent = playerState.unitZone.some(c => c && c.specialName === '风花');

        // 2. Define target filter based on presence of Fuhua
        const filter = {
          onField: true,
          type: 'UNIT',
          // If no Fuhua, must NOT be a God unit
          godMark: isFuhuaPresent ? undefined : false
        };

        // 3. Find valid targets across all players
        const allPotentialTargets: Card[] = [];
        Object.values(gameState.players).forEach(player => {
          player.unitZone.forEach(u => {
            if (u && AtomicEffectExecutor.matchesFilter(u, filter as any, card)) {
              allPotentialTargets.push(u);
            }
          });
        });

        if (allPotentialTargets.length === 0) {
          gameState.logs.push(`[歌月拂风] 没有合法目标。`);
          return;
        }

        // 4. Trigger selection query
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, allPotentialTargets.map(t => ({ card: t, source: 'UNIT' as any }))),
          title: '选择返回手牌的单位',
          description: isFuhuaPresent ? '选择战场上一个单位返回持有者手牌。' : '选择战场上一个非神格单位返回持有者手牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            sourceCardId: card.gamecardId,
            effectId: 'fufeng_activate'
          }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        const targetId = selections[0];
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          destinationZone: 'HAND',
          targetFilter: { gamecardId: targetId }
        }, card);

        gameState.logs.push(`${playerState.displayName} 发动了 [歌月拂风]，将一个单位返回手牌。`);
      }
    }
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
