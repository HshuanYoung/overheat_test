import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const getErosionCount = (player: PlayerState) => {
  const front = player.erosionFront.filter(c => c !== null).length;
  const back = player.erosionBack.filter(c => c !== null).length;
  return front + back;
};

const card: Card = {
  id: '10403054',
  fullName: '援护药师【文】',
  specialName: '文',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '冒险家公会',
  acValue: 2,
  power: 500,
  basePower: 500,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'wen_search_from_erosion',
      type: 'TRIGGER',
      triggerEvent: 'CARD_EROSION_TO_FIELD',
      description: '【诱】：这个单位从侵蚀区进入单位区时，你可以选择发动：将这个单位横置，并从你的卡组中选择一张「冒险家公会」道具卡加入手牌，随后洗牌。',
      isMandatory: false,
      condition: (gameState, playerState, instance, event) => {
        return event?.sourceCardId === instance.gamecardId;
      },
      execute: async (instance, gameState, playerState) => {
        const itemOptions = playerState.deck.filter(c =>
          c.type === 'ITEM' && c.faction === '冒险家公会'
        );

        if (itemOptions.length === 0) {
          gameState.logs.push(`[援护药师【文】] 卡组中没有「冒险家公会」道具卡。`);
          return;
        }

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, itemOptions.map(c => ({ card: c, source: 'DECK' as any }))),
          title: '检索「冒险家公会」道具',
          description: '发动效果：将此单位横置，并从卡组中选择一张「冒险家公会」道具卡加入手牌。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: {
            sourceCardId: instance.gamecardId,
            effectIndex: 0,
            step: 1
          }
        };
      },
      onQueryResolve: async (instance, gameState, playerState, selections) => {
        const targetId = selections[0];

        // Exhaust the unit as part of the effect
        instance.isExhausted = true;

        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_DECK',
          targetFilter: { gamecardId: targetId },
          destinationZone: 'HAND'
        }, instance);

        gameState.logs.push(`[援护药师【文】] 横置了自身并将卡牌从卡组加入了手牌。`);

        // Shuffle deck
        await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
      }
    },
    {
      id: 'wen_swap_activate',
      type: 'ACTIVATE',
      limitCount: 1,
      limitNameType: true,
      triggerLocation: ['UNIT'],
      description: '【启】〔同名回合1次〕：侵蚀区处于3-7且在你的回合，支付1点费用，将这个单位以正面表示置入侵蚀区：选择你侵蚀区正面一张「文」以外的「冒险家公会」单位卡，将其纵置摆放进入单位区。',
      condition: (gameState, playerState, instance) => {
        if (!playerState.isTurn) return false;

        const erosionCount = getErosionCount(playerState);
        if (erosionCount < 3 || erosionCount > 7) return false;

        const fieldSpecialNames = new Set(playerState.unitZone.filter(u => u && u.specialName).map(u => u!.specialName));
        const itemSpecialNames = new Set(playerState.itemZone.filter(i => i && i.specialName).map(i => i!.specialName));

        const hasValidTarget = playerState.erosionFront.some(c =>
          c !== null &&
          c.type === 'UNIT' &&
          c.faction === '冒险家公会' &&
          c.specialName !== instance.specialName &&
          (!c.specialName || (!fieldSpecialNames.has(c.specialName) && !itemSpecialNames.has(c.specialName)))
        );

        return hasValidTarget;
      },
      execute: async (card, gameState, playerState) => {
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
            effectIndex: 1,
            step: 1
          }
        };
        gameState.logs.push(`[援护药师【文】] 等待 ${playerState.displayName} 支付 1 点费用...`);
      },
      onQueryResolve: async (card, gameState, playerState, selections, context) => {
        const step = context?.step || 1;
        const sourcePlayer = gameState.players[playerState.uid];

        if (step === 1) {
          gameState.logs.push(`[援护药师【文】] 费用支付成功。`);

          // Move self to erosion front
          await AtomicEffectExecutor.execute(gameState, playerState.uid, {
            type: 'MOVE_FROM_FIELD',
            destinationZone: 'EROSION_FRONT',
            targetFilter: { gamecardId: card.gamecardId }
          }, card);

          card.displayState = 'FRONT_UPRIGHT';

          const fieldSpecialNames = new Set(playerState.unitZone.filter(u => u && u.specialName).map(u => u!.specialName));
          const itemSpecialNames = new Set(playerState.itemZone.filter(i => i && i.specialName).map(i => i!.specialName));

          const validTargets = sourcePlayer.erosionFront.filter(c =>
            c !== null &&
            c.type === 'UNIT' &&
            c.faction === '冒险家公会' &&
            !c.fullName.includes('文') &&
            (!c.specialName || (!fieldSpecialNames.has(c.specialName) && !itemSpecialNames.has(c.specialName)))
          ) as Card[];

          if (validTargets.length === 0) {
            gameState.logs.push(`[援护药师【文】] 侵蚀区中没有符合条件的目标单位，效果结束。`);
            return;
          }

          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, validTargets.map(u => ({ card: u, source: 'EROSION_FRONT' as any }))),
            title: '选择侵蚀卡进入战场',
            description: '请选择一张侵蚀区正面的「冒险家公会」单位（非文）。其将进入战场。',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              sourceCardId: card.gamecardId,
              effectIndex: 1,
              step: 2
            }
          };
        } else if (step === 2) {
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

            gameState.logs.push(`[援护药师【文】] 效果生效：${targetCard.fullName} 从侵蚀区进入了战场。`);
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
