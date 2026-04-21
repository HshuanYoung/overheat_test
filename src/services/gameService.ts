/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { socket } from '../socket';
import { GameState, Card, CardEffect, TriggerLocation, GameEvent } from '../types/game';

const isFullEffectSilencedThisTurn = (gameState: GameState | null, card: Card) =>
  !!gameState && (card as any).data?.fullEffectSilencedTurn === gameState.turnCount;

const canUse20400008AsPaymentSubstitute = (paymentCard: Card | undefined, cardColor?: string, cost?: number, playingCardId?: string) =>
  !!paymentCard &&
  paymentCard.id === '20400008' &&
  paymentCard.gamecardId !== playingCardId &&
  cardColor === 'BLUE' &&
  !!cost &&
  cost > 0 &&
  cost <= 3;

/**
 * GameService (Frontend Proxy)
 * 
 * This service acts as a proxy to the server. 
 * Rule logic is handled by ServerGameService on the backend.
 */
export const GameService = {
  // --- Socket Proxy Actions ---

  async advancePhase(gameId: string, action?: any) {
    console.log(gameId);
    socket.emit('gameAction', { gameId, action: 'END_PHASE', payload: action });
  },

  async performMulligan(gameId: string, cardIds: string[]) {
    socket.emit('gameAction', { gameId, action: 'MULLIGAN', payload: cardIds });
  },

  async playCard(gameId: string, playerId: string, cardId: string, paymentSelection: any) {
    socket.emit('gameAction', { gameId, action: 'PLAY_CARD', payload: { cardId, paymentSelection } });
  },

  async declareAttack(gameId: string, playerId: string, attackerIds: string[], isAlliance: boolean) {
    socket.emit('gameAction', { gameId, action: 'ATTACK', payload: { attackerIds, isAlliance } });
  },

  async declareDefense(gameId: string, playerId: string, defenderId?: string) {
    socket.emit('gameAction', { gameId, action: 'DEFEND', payload: { defenderId } });
  },

  async passConfrontation(gameId: string) {
    socket.emit('gameAction', { gameId, action: 'PASS_CONFRONTATION' });
  },

  async activateEffect(gameId: string, playerId: string, cardId: string, effectIndex: number) {
    socket.emit('gameAction', { gameId, action: 'ACTIVATE_EFFECT', payload: { cardId, effectIndex } });
  },

  async resolvePlay(gameId: string) {
    socket.emit('gameAction', { gameId, action: 'RESOLVE_PLAY' });
  },

  async resolveDamage(gameId: string) {
    socket.emit('gameAction', { gameId, action: 'RESOLVE_DAMAGE' });
  },


  async handleErosionChoice(gameId: string, playerId: string, choice: 'A' | 'B' | 'C', selectedCardId?: string) {
    socket.emit('gameAction', { gameId, action: 'EROSION_CHOICE', payload: { choice, selectedCardId } });
  },

  async handleShenyiChoice(gameId: string, action: 'CONFIRM_SHENYI' | 'DECLINE_SHENYI') {
    socket.emit('gameAction', { gameId, action });
  },

  async discardCard(gameId: string, playerId: string, cardId: string) {
    socket.emit('gameAction', { gameId, action: 'DISCARD', payload: { cardId } });
  },

  async submitQueryChoice(gameId: string, queryId: string, selections: string[]) {
    socket.emit('gameAction', { gameId, action: 'SUBMIT_QUERY_CHOICE', payload: { queryId, selections } });
  },

  moveCard(gameOrId: GameState | string, playerId: string, fromZone: TriggerLocation, toPlayerId: string, toZone: TriggerLocation, cardId: string): boolean {
    if (typeof gameOrId === 'string') {
      socket.emit('gameAction', { gameId: gameOrId, action: 'MOVE_CARD', payload: { fromZone, toPlayerId, toZone, cardId } });
    }
    return true;
  },

  async destroyUnit(gameState: GameState, playerId: string, gamecardId: string, isEffect: boolean = false, sourcePlayerId?: string, skipSubstitution: boolean = false) {
    // This is a stub for shared code (AtomicEffectExecutor).
    // On the server, this will be replaced by the real implementation from ServerGameService.
    // On the client, we emit a socket event.
    if (typeof window !== 'undefined') {
       socket.emit('gameAction', { gameId: (gameState as any).gameId, action: 'DESTROY_UNIT', payload: { gamecardId, isEffect, sourcePlayerId, skipSubstitution } });
    }
  },

  // --- Local UI Utilities ---
  canPlayCard(gameState: GameState | null, player: any, card: Card): { canPlay: boolean; reason?: string } {
    if (!player || !card) return { canPlay: false, reason: '未找到玩家或卡牌' };

    // 0. Faction Lock Check
    if (player.factionLock && card.faction !== player.factionLock) {
      return { canPlay: false, reason: `受到阵营锁定限制：只能打出 [${player.factionLock}] 阵营的卡牌` };
    }

    // 1. Zone Checks
    if (card.type === 'UNIT') {
      if (!player.unitZone.some((c: any) => c === null)) {
        return { canPlay: false, reason: '单位区已满' };
      }
      if (card.specialName && player.unitZone.some((c: any) => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: '场上已存在同名的唯一单位' };
      }
      
      // Godmark Limit Check
      if (card.godMark) {
        const fieldEffects = player.unitZone
          .filter((u: any) => u !== null)
          .flatMap((u: any) => u.effects || []);
        
        const fieldLimitEffect = fieldEffects.find((e: any) => e.type === 'CONTINUOUS' && e.limitGodmarkCount !== undefined);
        const selfLimitEffect = card.effects?.find((e: any) => e.type === 'CONTINUOUS' && e.limitGodmarkCount !== undefined);
        
        const effectiveLimit = fieldLimitEffect?.limitGodmarkCount ?? selfLimitEffect?.limitGodmarkCount;
        
        if (effectiveLimit !== undefined) {
          const currentGodmarkCount = player.unitZone.filter((u: any) => u && u.godMark).length;
          if (currentGodmarkCount >= effectiveLimit) {
            return { canPlay: false, reason: `已达到女神个体限制 (上限: ${effectiveLimit})` };
          }
        }
      }
    } else if (card.type === 'ITEM') {
      if (card.specialName && player.itemZone.some((c: any) => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: '场上已存在同名的唯一物品' };
      }
    }

    // 2. Color Requirements
    const availableColors: Record<string, number> = { RED: 0, WHITE: 0, YELLOW: 0, BLUE: 0, GREEN: 0, NONE: 0 };
    let omniColorCount = 0;

    const checkOmni = (c: any) => {
      if (!c) return false;
      const isTargetId = String(c.id) === '10500055';
      const hasOmniEffect = c.effects && c.effects.some((e: any) => e.id === '10500055_omni');
      return isTargetId || hasOmniEffect;
    };

    player.unitZone.forEach((c: any) => {
      if (!c) return;
      if (checkOmni(c)) {
        omniColorCount++;
      } else if (c.color !== 'NONE') {
        availableColors[c.color] = (availableColors[c.color] || 0) + 1;
      }
    });

    let totalDeficit = 0;
    for (const [color, reqCount] of Object.entries(card.colorReq || {})) {
      const deficit = Math.max(0, (reqCount as number) - (availableColors[color] || 0));
      totalDeficit += deficit;
    }

    if (totalDeficit > omniColorCount) {
      return { canPlay: false, reason: `不满足颜色需求 (缺少: ${totalDeficit})` };
    }

    // 3. Cost Check (AC Value)
    const cost = card.acValue || 0;
    if (cost < 0) {
      const absCost = Math.abs(cost);
      const faceUpFrontCount = player.erosionFront.filter((c: any) => c !== null && c.displayState === 'FRONT_UPRIGHT').length;
      if (faceUpFrontCount < absCost) {
        return { canPlay: false, reason: `侵蚀区正面卡牌不足 (需要: ${absCost})` };
      }
    } else if (cost > 0) {
      let remainingCost = cost;
      const has20400008Substitute = player.hand.some((c: any) =>
        canUse20400008AsPaymentSubstitute(c, card.color, cost, card.gamecardId)
      );
      if (has20400008Substitute) {
        remainingCost = 0;
      }
      const hasFeijing = player.hand.some((c: any) =>
        c.gamecardId !== card.gamecardId &&
        c.feijingMark &&
        c.color === card.color
      );
      if (remainingCost > 0 && hasFeijing) {
        remainingCost = Math.max(0, remainingCost - 3);
      }
      const readyUnitsCount = player.unitZone.filter((c: any) => c !== null && !c.isExhausted).length;
      remainingCost = Math.max(0, remainingCost - readyUnitsCount);

      if (remainingCost > 0) {
        const totalErosionCount = player.erosionFront.filter((c: any) => c !== null).length +
          player.erosionBack.filter((c: any) => c !== null).length;
        if (totalErosionCount + remainingCost >= 10) {
          return { canPlay: false, reason: '卡组剩余卡牌不足以承担侵蚀代价' };
        }
      }
    }

    // 4. Special Effect Limits & Reqs
    const playEffect = card.effects?.find(e => e.type === 'ACTIVATE' || e.type === 'TRIGGER' || e.type === 'ALWAYS');
    if (playEffect) {
      const isStory = card.type === 'STORY';
      const isAlways = playEffect.type === 'ALWAYS';
      const shouldValidate = isStory || isAlways;

      if (shouldValidate) {
        const result = GameService.checkEffectLimitsAndReqs(gameState, player.uid, card, playEffect, card.cardlocation as TriggerLocation);
        if (!result.valid) {
          return { canPlay: false, reason: result.reason };
        }
      }
    }

    return { canPlay: true };
  },


  checkEffectLimitsAndReqs(gameState: GameState | null, playerUid: string, card: Card, effect: CardEffect, triggerLocation: TriggerLocation, event?: GameEvent): { valid: boolean; reason?: string } {
    if (!gameState || !gameState.players) return { valid: true };
    const player = gameState.players[playerUid];
    if (!player) return { valid: false, reason: '未找到玩家数据' };

    // 1. Trigger Location
    if (effect.triggerLocation && triggerLocation) {
      if (!effect.triggerLocation.includes(triggerLocation)) {
        return { valid: false, reason: '发动位置不符合效果要求' };
      }
    }

    // 2. Limits
    if (effect.limitCount) {
      const usageMap = gameState.effectUsage || {};
      let key = '';
      if (effect.limitGlobal) {
        if (effect.limitNameType) {
          key = `game_${playerUid}_name_${card.id}_${effect.id}`;
        } else {
          key = `game_${playerUid}_instance_${card.gamecardId}_${effect.id}`;
        }
      } else {
        if (effect.limitNameType) {
          key = `turn_${gameState.turnCount}_${playerUid}_name_${card.id}_${effect.id}`;
        } else {
          key = `turn_${gameState.turnCount}_${playerUid}_instance_${card.gamecardId}_${effect.id}`;
        }
      }

      const currentUsage = usageMap[key] || 0;
      if (currentUsage >= effect.limitCount) {
        return { valid: false, reason: '已达到该效果的发动次数限制' };
      }
    }

    // 3. Erosion Limits
    if (effect.erosionFrontLimit) {
      const frontCount = player.erosionFront.filter(c => c !== null).length;
      if (frontCount < effect.erosionFrontLimit[0] || frontCount > effect.erosionFrontLimit[1]) {
        return { valid: false, reason: '侵蚀区正面卡牌数量不满足条件' };
      }
    }
    if (effect.erosionBackLimit) {
      const backCount = player.erosionBack.filter(c => c !== null).length;
      if (backCount < effect.erosionBackLimit[0] || backCount > effect.erosionBackLimit[1]) {
        return { valid: false, reason: '侵蚀区背面卡牌数量不满足条件' };
      }
    }
    if (effect.erosionTotalLimit) {
      const totalCount = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
      if (totalCount < effect.erosionTotalLimit[0] || totalCount > effect.erosionTotalLimit[1]) {
        return { valid: false, reason: '侵蚀区卡牌总数不满足条件' };
      }
    }

    if (isFullEffectSilencedThisTurn(gameState, card)) {
      return { valid: false, reason: '该卡牌本回合失去所有效果' };
    }

    // 4. Condition Check
    if (effect.condition) {
      try {
        if (!effect.condition(gameState, player, card, event)) {
          return { valid: false, reason: '不满足发动条件' };
        }
      } catch (e) {
        return { valid: false, reason: '不满足发动条件' };
      }
    }

    return { valid: true };
  },

  recordEffectUsage(game: GameState | null, playerUid: string, card: Card, effect: CardEffect) {
    // Persistent usage recorded on server
  }
};
