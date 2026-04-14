import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const getErosionCount = (player: PlayerState) => {
  const front = player.erosionFront.filter(c => c !== null).length;
  const back = player.erosionBack.filter(c => c !== null).length;
  return front + back;
};

const card: Card = {
  id: '10403032',
  fullName: '破阵游侠【芙蕾雅】',
  specialName: '芙蕾雅',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '冒险家工会',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'freya_ranger_activate',
      type: 'ACTIVATE',
      limitCount: 1,
      limitNameType: true,
      triggerLocation: ['UNIT'],
      description: '【起】〔同名回合1次〕：侵蚀区处于3-7且在你的回合，支付1点费用，将这个单位以正面表示置入侵蚀区：选择你侵蚀区正面一张「芙蕾雅」以外的「冒险家工会」单位卡，将其纵置摆放进入单位区。',
      condition: (gameState, playerState, instance) => {
        // 1. During player's turn
        if (gameState.activePlayerUid !== playerState.uid) return false;

        // 2. Erosion count 3-7
        const erosionCount = getErosionCount(playerState);
        if (erosionCount < 3 || erosionCount > 7) return false;

        // 3. Valid target exists in erosionFront
        const hasValidTarget = playerState.erosionFront.some(c => 
          c !== null && 
          c.type === 'UNIT' && 
          c.faction === '冒险家工会' && 
          !c.fullName.includes('芙蕾雅')
        );

        return hasValidTarget;
      },
      execute: async (card, gameState, playerState) => {
        // Step 1: Request 1 fee payment
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_PAYMENT',
          playerUid: playerState.uid,
          options: [],
          title: `支付 [${card.fullName}] 的费用`,
          description: `请支付 1 点费用以发动效果。`,
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          paymentCost: 1,
          paymentColor: card.color,
          context: { 
            sourceCardId: card.gamecardId, 
            effectIndex: 0, 
            step: 1 
          }
        };
        gameState.logs.push(`[破阵游侠【芙蕾雅】] 等待 ${playerState.displayName} 支付 1 点费用...`);
      },
      onQueryResolve: async (card, gameState, playerState, selections, context) => {
        const step = context?.step || 1;
        const sourcePlayer = gameState.players[playerState.uid];

        if (step === 1) {
          // Step 2: Payment successful, move self to erosion front
          gameState.logs.push(`[破阵游侠【芙蕾雅】] 费用支付成功。`);

          // Move self to erosion front
          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'MOVE_FROM_FIELD',
            destinationZone: 'EROSION_FRONT',
            targetFilter: { gamecardId: card.gamecardId }
          }, card);
          
          card.displayState = 'FRONT_UPRIGHT';

          // Request target selection from erosion front
          const validTargets = sourcePlayer.erosionFront.filter(c => 
            c !== null && 
            c.type === 'UNIT' && 
            c.faction === '冒险家工会' && 
            !c.fullName.includes('芙蕾雅')
          ) as Card[];

          if (validTargets.length === 0) {
            gameState.logs.push(`[破阵游侠【芙蕾雅】] 侵蚀区中没有符合条件的目标单位，效果结束。`);
            return;
          }

          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, validTargets.map(u => ({ card: u, source: 'EROSION_FRONT' as any }))),
            title: '选择侵蚀卡进入战场',
            description: '请选择一张侵蚀区正面的「冒险家工会」单位（非芙蕾雅）。其将进入战场。',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: { 
              sourceCardId: card.gamecardId, 
              effectIndex: 0, 
              step: 2 
            }
          };
        } else if (step === 2) {
          // Step 3: Move target to unit zone
          const targetId = selections[0];
          const targetCard = sourcePlayer.erosionFront.find(c => c?.gamecardId === targetId);

          if (targetCard) {
            targetCard.isExhausted = false;
            targetCard.displayState = 'FRONT_UPRIGHT';

            await AtomicEffectExecutor.execute(gameState, playerState.uid, {
              type: 'MOVE_FROM_EROSION',
              destinationZone: 'UNIT',
              targetFilter: { gamecardId: targetId }
            }, card);

            gameState.logs.push(`[破阵游侠【芙蕾雅】] 效果生效：${targetCard.fullName} 从侵蚀区进入了战场。`);
          }
        }
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
