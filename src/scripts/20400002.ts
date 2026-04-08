import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20400002',
  fullName: '歌月扬帆',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
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
      triggerLocation: ['PLAY'],
      description: '选择你战场上的一个单位返回持有者手牌。若返回的是「风花」单位，可以选择对方一个单位变为横置，且该单位在下一回合开始时无法变为纵置。',
      execute: (card: Card, gameState: GameState, playerState: PlayerState) => {
        // 1. Find a friendly unit to return (Prioritize Fuhua for demonstration)
        const friendlyUnits = playerState.unitZone.filter(c => c !== null);
        if (friendlyUnits.length === 0) return;

        const target = friendlyUnits.find(c => c!.specialName === '风花') || friendlyUnits[0];
        const isFuhua = target!.specialName === '风花';

        // 2. Perform the bounce
        AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          destinationZone: 'HAND',
          targetFilter: { onField: true }, // Selection handled by logic above
          targetCount: 1
        }, card);

        // 3. Conditional debuff
        if (isFuhua) {
          const opponentUid = Object.keys(gameState.players).find(uid => uid !== playerState.uid);
          if (opponentUid) {
            const opponent = gameState.players[opponentUid];
            const enemyTarget = opponent.unitZone.find(c => c !== null);
            if (enemyTarget) {
              // Place horizontally
              enemyTarget.isExhausted = true;
              // Prevent vertical placement next round
              enemyTarget.canResetCount = 1;

              gameState.logs.push(`[歌月影舞] 返回了 风花，使对方单位 ${enemyTarget.fullName} 进入无法重置状态。`);
            }
          }
        }

        gameState.logs.push(`${playerState.displayName} 发动了 [歌月影舞]。`);
      }
    }
  ],
  imageUrl: '/pics/20400002_thumb.jpg',
  fullImageUrl: '/pics/20400002_full.jpg',
  rarity: 'R',
};

export default card;
