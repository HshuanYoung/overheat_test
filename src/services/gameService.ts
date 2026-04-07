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

  async discardCard(gameId: string, playerId: string, cardId: string) {
    socket.emit('gameAction', { gameId, action: 'DISCARD', payload: { cardId } });
  },

  // --- Local UI Utilities ---
  canPlayCard(player: any, card: Card): { canPlay: boolean; reason?: string } {
    if (!player || !card) return { canPlay: false };

    // 1. Zone Checks
    if (card.type === 'UNIT') {
      if (!player.unitZone.some((c: any) => c === null)) {
        return { canPlay: false, reason: 'UNIT ZONE IS FULL' };
      }
      if (card.specialName && player.unitZone.some((c: any) => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: 'ALREADY HAS UNIQUE UNIT' };
      }
    } else if (card.type === 'ITEM') {
      if (card.specialName && player.itemZone.some((c: any) => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: 'ALREADY HAS UNIQUE ITEM' };
      }
    }

    // 2. Color Requirements
    const availableColors: Record<string, number> = { RED: 0, WHITE: 0, YELLOW: 0, BLUE: 0, GREEN: 0, NONE: 0 };
    const countColors = (c: any) => {
      if (c && c.color !== 'NONE') availableColors[c.color] = (availableColors[c.color] || 0) + 1;
    };
    player.unitZone.forEach(countColors);
    player.itemZone.forEach(countColors);
    player.erosionFront.forEach(countColors);

    for (const [color, reqCount] of Object.entries(card.colorReq || {})) {
      if ((availableColors[color] || 0) < (reqCount as number)) {
        return { canPlay: false, reason: `MISSING COLOR: ${color}` };
      }
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
    const playEffect = card.effects.find(e => e.type === 'ACTIVATE' || e.type === 'TRIGGER' || e.type === 'ALWAYS');
    if (playEffect?.erosionBackLimit) {
      const backCount = player.erosionBack.filter((c: any) => c !== null).length;
      if (backCount < playEffect.erosionBackLimit[0] || backCount > playEffect.erosionBackLimit[1]) {
        return { canPlay: false, reason: 'INVALID EROSION BACK COUNT' };
      }
    }

    return { canPlay: true };
  },


  checkEffectLimitsAndReqs(game: GameState | null, playerUid: string, card: Card, effect: CardEffect, triggerLocation: TriggerLocation) {
    return true; // Simplified for UI
  },

  recordEffectUsage(game: GameState | null, playerUid: string, card: Card, effect: CardEffect) {
    // Persistent usage recorded on server
  }
};
