import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '10401001',
  fullName: '歌月丽人武者 「风花」',
  specialName: '风花',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
  acValue: 4,
  power: 3000,
  basePower: 3000,
  damage: 3,
  baseDamage: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'fuhua_trigger',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '【诱】这张卡进入战场时，从你的卡组或墓地中选择一张名称含有「歌月」的故事卡放逐。该能力的效果作为此能力的后续效果执行，不触发对抗响应。',
      condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
        const isOnBattlefield = instance.cardlocation === 'UNIT' || instance.cardlocation === 'ITEM';
        if (!event) return isOnBattlefield;

        const isSelf = event.type === 'CARD_ENTERED_ZONE' &&
          (event.sourceCardId === instance.gamecardId || event.sourceCard === instance);
        const isTargetZone = event.data?.zone === 'UNIT' || event.data?.zone === 'ITEM';

        return isSelf && isTargetZone && isOnBattlefield;
      },
      execute: async (card, gameState, playerState) => {
        const checkCardViable = (c: Card) => {
          // 1. Basic Type and Name Check
          if (!(c.fullName.includes('歌月') && c.type === 'STORY')) return false;

          // 2. Cost Check (AC Value)
          const cost = c.acValue || 0;
          if (cost > 0) {
            // Check if player has enough space in erosion zone (limit 9)
            const currentErosion = playerState.erosionFront.filter(e => e !== null).length +
              playerState.erosionBack.filter(e => e !== null).length;
            if (currentErosion + cost >= 10) return false;
          } else if (cost < 0) {
            // Negative cost requires enough face-up erosion cards
            const frontCount = playerState.erosionFront.filter(e => e !== null && e.displayState === 'FRONT_UPRIGHT').length;
            if (frontCount < Math.abs(cost)) return false;
          }

          // 3. Condition Check
          const activateEffect = c.effects?.find(e => e.type === 'ACTIVATE');
          if (activateEffect && activateEffect.condition) {
            try {
              if (!activateEffect.condition(gameState, playerState, c)) return false;
            } catch (e) {
              return false;
            }
          }

          return true;
        };

        const options: { card: Card; source: any }[] = [];
        for (const c of playerState.deck) {
          if (checkCardViable(c)) options.push({ card: { ...c }, source: 'DECK' });
        }
        for (const c of playerState.grave) {
          if (checkCardViable(c)) options.push({ card: { ...c }, source: 'GRAVE' });
        }

        if (options.length === 0) {
          gameState.logs.push(`[风花] 没有符合执行条件的「歌月」卡牌。`);
          return;
        }

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: options as any,
          title: '选择「歌月」卡牌',
          description: '从你的卡组或墓地中选择一张名称包含「歌月」的故事卡放逐并执行其效果。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0 }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections, context) => {
        const step = context?.step || 1;
        const sourcePlayer = gameState.players[playerState.uid];

        if (step === 1) {
          const cardId = selections[0];
          const foundCard = AtomicEffectExecutor.findCardById(gameState, cardId);

          if (foundCard) {
            await AtomicEffectExecutor.execute(gameState, playerState.uid, {
              type: 'MOVE_FROM_DECK', // Assuming it could be in deck or grave, AtomicEffectExecutor.execute should handle it if type is refined, 
              // but we can use specific ones or a generic MOVE if implemented.
              // For now, I'll use explicit checks since MOVE_FROM_GRAVE/DECK are separate.
              targetFilter: { gamecardId: cardId },
              destinationZone: 'EXILE'
            }, card);

            gameState.logs.push(`[风花] 已放逐 ${foundCard.fullName}。`);

            // Check if payment is required
            if (foundCard.acValue && foundCard.acValue !== 0) {
              gameState.pendingQuery = {
                id: Math.random().toString(36).substring(7),
                type: 'SELECT_PAYMENT',
                playerUid: playerState.uid,
                options: [],
                title: `支付 [${foundCard.fullName}] 的费用`,
                description: `请支付 ${foundCard.acValue} 点费用以执行其效果。`,
                minSelections: 1,
                maxSelections: 1,
                callbackKey: 'EFFECT_RESOLVE',
                paymentCost: foundCard.acValue,
                paymentColor: foundCard.color,
                context: {
                  sourceCardId: card.gamecardId,
                  effectIndex: 0,
                  step: 2,
                  banishedCardId: foundCard.gamecardId
                }
              };
              gameState.logs.push(`[风花] 等待 ${sourcePlayer.displayName} 支付费用...`);
              return;
            }

            // If no payment, execute immediately
            if (foundCard.effects) {
              for (const e of foundCard.effects) {
                if (e.execute) await (e.execute as any)(foundCard!, gameState, sourcePlayer);
              }
            }
          }
        } else if (step === 2) {
          const cardId = context.banishedCardId;
          const foundCard = sourcePlayer.exile.find(c => c.gamecardId === cardId);
          if (foundCard && foundCard.effects) {
            gameState.logs.push(`[风花] 费用支付成功，正在执行 ${foundCard.fullName} 的效果...`);
            for (const e of foundCard.effects) {
              if (e.execute) await (e.execute as any)(foundCard, gameState, sourcePlayer);
            }
          }
        }
      }
    },
    {
      id: 'fuhua_goddess_activate',
      type: 'ACTIVATE',
      triggerLocation: ['UNIT'],
      limitCount: 1,
      limitGlobal: true,
      description: '【启】【女神化】[一局一次] 侵蚀区背面<9且正面>=2。选择侵蚀区中两张正面向上的卡牌，将其翻至背面。将战场上所有单位返回持有者手牌。',
      condition: (gameState, playerState) => {
        const frontCount = playerState.erosionFront.filter(c => c !== null).length;
        const backCount = playerState.erosionBack.filter(c => c !== null).length;
        return !!playerState.isGoddessMode && backCount < 9 && frontCount >= 2;
      },
      cost: async (gameState, playerState, card) => {
        const frontCards = playerState.erosionFront.filter(c => c !== null) as Card[];
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: frontCards.map(c => ({ card: c, source: 'EROSION_FRONT' as any })),
          title: '选择侵蚀卡翻面',
          description: '请选择侵蚀区两张正面向上的卡牌翻至背面。',
          minSelections: 2,
          maxSelections: 2,
          callbackKey: 'ACTIVATE_COST_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 1 }
        };
        return true;
      },
      onQueryResolve: async (card, gameState, playerState, selections) => {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'TURN_EROSION_FACE_DOWN',
          value: selections.length
        }, card, undefined, selections);

        gameState.logs.push(`${playerState.displayName} 将 2 张侵蚀卡翻至背面。`);
      },
      execute: async (card, gameState, playerState) => {
        // Return all units to hand
        for (const player of Object.values(gameState.players)) {
          for (const unit of player.unitZone) {
            if (unit) {
              await AtomicEffectExecutor.execute(gameState, player.uid, {
                type: 'MOVE_FROM_FIELD',
                destinationZone: 'HAND',
                targetFilter: { gamecardId: unit.gamecardId }
              }, card);
            }
          }
        }
        gameState.logs.push(`所有单位已返回持有者手牌。`);
      }
    }
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
  faction: '百濑之水城',
};

export default card;
