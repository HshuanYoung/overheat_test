/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { socket } from '../socket';
import { GameState, Card, CardEffect, TriggerLocation } from '../types/game';

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
    if (!player || !card) return { canPlay: false };

    // 0. Faction Lock Check
    if (player.factionLock && card.faction !== player.factionLock) {
      return { canPlay: false, reason: `受到派系限制：只能打出 [${player.factionLock}] 派系的卡牌` };
    }

    // 1. Zone Checks
    if (card.type === 'UNIT') {
      if (!player.unitZone.some((c: any) => c === null)) {
        return { canPlay: false, reason: 'UNIT ZONE IS FULL' };
      }
      if (card.specialName && player.unitZone.some((c: any) => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: 'ALREADY HAS UNIQUE UNIT' };
      }
      
      // Godmark Limit Check (e.g. 浪漫歌月【风花】)
      if (card.godMark) {
        // Find if any card on field has a limitGodmarkCount restriction, or if this card has one
        const fieldEffects = player.unitZone
          .filter((u: any) => u !== null)
          .flatMap((u: any) => u.effects || []);
        
        const fieldLimitEffect = fieldEffects.find((e: any) => e.type === 'CONTINUOUS' && e.limitGodmarkCount !== undefined);
        const selfLimitEffect = card.effects?.find((e: any) => e.type === 'CONTINUOUS' && e.limitGodmarkCount !== undefined);
        
        const effectiveLimit = fieldLimitEffect?.limitGodmarkCount ?? selfLimitEffect?.limitGodmarkCount;
        
        if (effectiveLimit !== undefined) {
          const currentGodmarkCount = player.unitZone.filter((u: any) => u && u.godMark).length;
          if (currentGodmarkCount >= effectiveLimit) {
            return { canPlay: false, reason: `GODMARK LIMIT REACHED (${effectiveLimit})` };
          }
        }
      }
    } else if (card.type === 'ITEM') {
      if (card.specialName && player.itemZone.some((c: any) => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: 'ALREADY HAS UNIQUE ITEM' };
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
      return { canPlay: false, reason: `缺少颜色需求 (缺口: ${totalDeficit}, 可用变色单位: ${omniColorCount})` };
    }

    // 3. Cost Check (AC Value)
    const cost = card.acValue || 0;
    if (cost < 0) {
      const absCost = Math.abs(cost);
      const faceUpFrontCount = player.erosionFront.filter((c: any) => c !== null && c.displayState === 'FRONT_UPRIGHT').length;
      if (faceUpFrontCount < absCost) {
        return { canPlay: false, reason: `EROSION FRONT HAS LESS THAN ${absCost} CARDS` };
      }
    } else if (cost > 0) {
      let remainingCost = cost;

      // I. Check for Feijing card in hand (of the same color)
      const hasFeijing = player.hand.some((c: any) =>
        c.gamecardId !== card.gamecardId &&
        c.feijingMark &&
        c.color === card.color
      );
      if (hasFeijing) {
        remainingCost = Math.max(0, remainingCost - 3);
      }

      // II. Check for ready units on field
      const readyUnitsCount = player.unitZone.filter((c: any) => c !== null && !c.isExhausted).length;
      remainingCost = Math.max(0, remainingCost - readyUnitsCount);

      // III. Check Erosion space limit (cannot reach 10 total)
      if (remainingCost > 0) {
        const totalErosionCount = player.erosionFront.filter((c: any) => c !== null).length +
          player.erosionBack.filter((c: any) => c !== null).length;
        if (totalErosionCount + remainingCost >= 10) {
          return { canPlay: false, reason: 'EROSION ZONE IS FULL (LIMIT 9)' };
        }
      }
    }

    // 4. Special Effect Limits (Erosion Back)
    const playEffect = card.effects?.find(e => e.type === 'ACTIVATE' || e.type === 'TRIGGER' || e.type === 'ALWAYS');
    if (playEffect) {
      // Determine if this effect's conditions should block playing the card from hand
      const isStory = card.type === 'STORY';
      const isAlways = playEffect.type === 'ALWAYS';
      const isHandTrigger = playEffect.type === 'TRIGGER' && playEffect.triggerLocation?.includes('HAND');

      const shouldValidate = isStory || isAlways || isHandTrigger;

      if (shouldValidate) {
        if (playEffect.erosionBackLimit) {
          const backCount = player.erosionBack.filter((c: any) => c !== null).length;
          if (backCount < playEffect.erosionBackLimit[0] || backCount > playEffect.erosionBackLimit[1]) {
            return { canPlay: false, reason: 'INVALID EROSION BACK COUNT' };
          }
        }

        // Check condition (Frontend check only if no complex dependencies)
        if (gameState && playEffect.condition) {
          try {
            if (!playEffect.condition(gameState, player, card)) {
              return { canPlay: false, reason: '不满足发动条件' };
            }
          } catch (e) {
            // If condition fails due to server-only data, we skip frontend enforcement
          }
        }
      }
    }

    return { canPlay: true };
  },


  checkEffectLimitsAndReqs(gameState: GameState | null, playerUid: string, card: Card, effect: CardEffect, triggerLocation: TriggerLocation, event?: GameEvent): boolean {
    if (!gameState || !gameState.players) return true;
    const player = gameState.players[playerUid];
    if (!player) return false;

    // 1. Trigger Location
    if (effect.triggerLocation && triggerLocation) {
      if (!effect.triggerLocation.includes(triggerLocation)) {
        return false;
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
        return false;
      }
    }

    // 3. Erosion Limits
    if (effect.erosionFrontLimit) {
      const frontCount = player.erosionFront.filter(c => c !== null).length;
      if (frontCount < effect.erosionFrontLimit[0] || frontCount > effect.erosionFrontLimit[1]) return false;
    }
    if (effect.erosionBackLimit) {
      const backCount = player.erosionBack.filter(c => c !== null).length;
      if (backCount < effect.erosionBackLimit[0] || backCount > effect.erosionBackLimit[1]) return false;
    }
    if (effect.erosionTotalLimit) {
      const totalCount = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
      if (totalCount < effect.erosionTotalLimit[0] || totalCount > effect.erosionTotalLimit[1]) return false;
    }

    // 4. Condition Check (Simplified for UI, only if no async needed)
    if (effect.condition) {
      try {
        if (!effect.condition(gameState, player, card, event)) {
          return false;
        }
      } catch (e) {
        // Condition might fail if it relies on server-only properties
        return false;
      }
    }

    return true;
  },

  recordEffectUsage(game: GameState | null, playerUid: string, card: Card, effect: CardEffect) {
    // Persistent usage recorded on server
  }
};
