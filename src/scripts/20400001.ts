import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20400001',
  fullName: '歌月拂风',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
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
      triggerLocation: ['PLAY'],
      description: '选择战场上一个非神格的单位卡返回持有者手牌。若你的战场上存在「风花」单位，可以选择战场上一个神格单位返回持有者手牌。',
      execute: (card: Card, gameState: GameState, playerState: PlayerState) => {
        // 1. Check for Fuhua on your side
        const isFuhuaPresent = playerState.unitZone.some(c => c && c.specialName === '风花');

        // 2. Define target filter based on presence of Fuhua
        const filter = {
          onField: true,
          type: 'UNIT',
          // If no Fuhua, must NOT be a God unit
          godMark: isFuhuaPresent ? undefined : false 
        };

        // 3. Find and return the first valid target to hand
        // (In a full implementation, this would trigger a UI selection event)
        AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          destinationZone: 'HAND',
          targetFilter: filter as any,
          targetCount: 1
        }, card);
        
        gameState.logs.push(`${playerState.displayName} 发动了 [歌月拂风]。`);
      }
    }
  ],
  imageUrl: '/pics/20400001_thumb.jpg',
  fullImageUrl: '/pics/20400001_full.jpg',
  rarity: 'R',
};

export default card;
