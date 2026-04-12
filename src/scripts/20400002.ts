import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20400002',
  fullName: '歌月扬帆',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '无',
  acValue: -3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'yingwu_activate',
      type: 'ACTIVATE',
      condition: (gameState: GameState, playerState: PlayerState) => {
        // Can only be played if the player has at least one unit on the battlefield
        return playerState.unitZone.some(c => c !== null);
      },
      description: '选择你战场上的一个单位返回持有者手牌。若返回的是「风花」单位，可以选择对方一个单位变为横置，且该单位在下一回合开始时无法变为纵置。',
      execute: (card: Card, gameState: GameState, playerState: PlayerState) => {
        const friendlyUnits = playerState.unitZone.filter(c => c !== null) as Card[];
        if (friendlyUnits.length === 0) {
          gameState.logs.push(`[歌月扬帆] 没有可选单位。`);
          return;
        }

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: friendlyUnits.map(u => ({ card: u, source: 'UNIT' as any })),
          title: '选择返回手牌的单位',
          description: '请选择你战场上的一个单位返回持有者手牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 1 }
        };
      },
      onQueryResolve: (card, gameState, playerState, selections, context) => {
        const step = context?.step || 1;
        const sourcePlayer = gameState.players[playerState.uid];

        if (step === 1) {
          const targetId = selections[0];
          const target = sourcePlayer.unitZone.find(u => u?.gamecardId === targetId);
          if (!target) return;

          const isFuhua = target.specialName === '风花';
          
          // Perform bounce
          AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'MOVE_FROM_FIELD',
            destinationZone: 'HAND',
            targetFilter: { gamecardId: targetId }
          }, card);

          gameState.logs.push(`${playerState.displayName} 将 ${target.fullName} 返回手牌。`);

          if (isFuhua) {
            const opponentUid = Object.keys(gameState.players).find(uid => uid !== playerState.uid);
            if (opponentUid) {
              const opponent = gameState.players[opponentUid];
              const enemyTargets = opponent.unitZone.filter(u => u !== null) as Card[];
              if (enemyTargets.length > 0) {
                gameState.pendingQuery = {
                  id: Math.random().toString(36).substring(7),
                  type: 'SELECT_CARD',
                  playerUid: playerState.uid, // Our side selects
                  options: enemyTargets.map(u => ({ card: u, source: 'UNIT' as any })),
                  title: '选择对方单位横置',
                  description: '返回的是「风花」单位，可以选择对方一个单位变为横置且下回合无法重置。',
                  minSelections: 1,
                  maxSelections: 1,
                  callbackKey: 'EFFECT_RESOLVE',
                  context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 2 }
                };
                return;
              }
            }
          }
        } else if (step === 2) {
          const targetId = selections[0];
          let enemyTarget: Card | undefined;
          Object.values(gameState.players).forEach(p => {
             if (p.uid !== playerState.uid) {
               const found = p.unitZone.find(u => u?.gamecardId === targetId);
               if (found) enemyTarget = found;
             }
          });

          if (enemyTarget) {
            enemyTarget.isExhausted = true;
            enemyTarget.canResetCount = 1;
            gameState.logs.push(`[歌月扬帆] 使对方单位 ${enemyTarget.fullName} 横置且下回合无法重置。`);
          }
        }
      }
    }
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;
