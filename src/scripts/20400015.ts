import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '20400015',
  fullName: '交易失败',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '',
  acValue: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'failed_transaction_activate',
      type: 'ACTIVATE',
      description: '【对付】：若你的侵蚀区背面卡牌在2张及以上，对抗对手打出道具卡或道具的效果发动，将其无效。若是对打出的道具卡发动，则将其送入其持有者的墓地。',
      condition: (gameState, playerState) => {
        // 1. Back erosion requirement
        const backCount = playerState.erosionBack.filter(c => c !== null).length;
        if (backCount < 2) return false;

        // 2. Must be in countering phase opposing an opponent's item declaration
        if (gameState.phase !== 'COUNTERING') return false;
        
        const topItem = gameState.counterStack[gameState.counterStack.length - 1];
        if (!topItem) return false;

        // Must be opponent's item
        const isOpponent = topItem.ownerUid !== playerState.uid;
        const isItem = topItem.card?.type === 'ITEM';
        
        return isOpponent && isItem;
      },
      execute: async (card, gameState, playerState) => {
        // When execute is called, 'failed_transaction' has been popped from the stack.
        // The item we are countering is now at the top of the counterStack.
        const targetItem = gameState.counterStack[gameState.counterStack.length - 1];
        
        if (targetItem && targetItem.ownerUid !== playerState.uid && targetItem.card?.type === 'ITEM') {
          targetItem.isNegated = true;
          gameState.logs.push(`[交易失败] 已无效 ${targetItem.card.fullName} 的发动。`);

          // If it was a PLAY action (playing the card from hand), send it to grave
          if (targetItem.type === 'PLAY') {
            const ownerId = targetItem.ownerUid;
            await AtomicEffectExecutor.execute(gameState, ownerId, {
              type: 'MOVE_FROM_FIELD', // Movement from PLAY zone is handled via MOVE_FROM_FIELD with appropriate target
              destinationZone: 'GRAVE',
              targetFilter: { gamecardId: targetItem.card.gamecardId }
            }, card);
            gameState.logs.push(`[交易失败] ${targetItem.card.fullName} 已被送入墓地。`);
          }
        } else {
          gameState.logs.push(`[交易失败] 未找到合法的对抗目标，效果失效。`);
        }
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
