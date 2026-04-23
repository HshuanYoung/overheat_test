/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { socket } from '../socket';
import { GameState, Card, CardEffect, TriggerLocation, GameEvent, PlayerState } from '../types/game';

const isFullEffectSilencedThisTurn = (gameState: GameState | null, card: Card) =>
  !!gameState && (card as any).data?.fullEffectSilencedTurn === gameState.turnCount;

const canUse204000145AsPaymentSubstitute = (paymentCard: Card | undefined, cardColor?: string, cost?: number, playingCardId?: string) =>
  !!paymentCard &&
  paymentCard.id === '204000145' &&
  paymentCard.gamecardId !== playingCardId &&
  cardColor === 'BLUE' &&
  !!cost &&
  cost > 0 &&
  cost <= 3;

const canUse205000136AsPaymentSubstitute = (paymentCard: Card | undefined, cardColor?: string, cost?: number, playingCardId?: string) =>
  !!paymentCard &&
  paymentCard.id === '205000136' &&
  paymentCard.gamecardId !== playingCardId &&
  cardColor === 'YELLOW' &&
  !!cost &&
  cost > 0 &&
  cost <= 3;

const getEffectivePlayCost = (player: PlayerState, card: Card) => {
  const baseCost = card.acValue || 0;
  if (card.id === '205110063') {
    const itemCount = player.itemZone.filter(c => c !== null).length;
    return Math.max(0, baseCost - itemCount);
  }
  return baseCost;
};

const hasGlobalDisableAllActivated = (gameState: GameState | null) => {
  if (!gameState) return false;
  return Object.values(gameState.players).some(player =>
    [...player.unitZone, ...player.itemZone, ...player.erosionFront]
      .filter((card): card is Card => !!card)
      .some(card =>
        card.effects?.some(effect =>
          effect.type === 'CONTINUOUS' &&
          effect.content === 'DISABLE_ALL_ACTIVATED' &&
          (!effect.condition || effect.condition(gameState, player, card))
        )
      )
  );
};

export const GameService = {
  async advancePhase(gameId: string, action?: any) {
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
    if (typeof window !== 'undefined') {
      socket.emit('gameAction', {
        gameId: (gameState as any).gameId,
        action: 'DESTROY_UNIT',
        payload: { gamecardId, isEffect, sourcePlayerId, skipSubstitution }
      });
    }
  },

  canPlayCard(gameState: GameState | null, player: PlayerState, card: Card): { canPlay: boolean; reason?: string } {
    if (!player || !card) return { canPlay: false, reason: 'Missing player or card' };

    if (player.factionLock && card.faction !== player.factionLock) {
      return { canPlay: false, reason: `Faction locked to [${player.factionLock}]` };
    }

    if (card.type === 'UNIT') {
      if (!player.unitZone.some(cardInZone => cardInZone === null)) {
        return { canPlay: false, reason: 'Unit zone is full' };
      }
      if (card.specialName && player.unitZone.some(cardInZone => cardInZone?.specialName === card.specialName)) {
        return { canPlay: false, reason: 'A unit with the same special name already exists' };
      }

      if (card.godMark) {
        const fieldEffects = player.unitZone.filter(cardInZone => cardInZone !== null).flatMap(cardInZone => cardInZone?.effects || []);
        const fieldLimitEffect = fieldEffects.find(effect => effect.type === 'CONTINUOUS' && effect.limitGodmarkCount !== undefined);
        const selfLimitEffect = card.effects?.find(effect => effect.type === 'CONTINUOUS' && effect.limitGodmarkCount !== undefined);
        const effectiveLimit = fieldLimitEffect?.limitGodmarkCount ?? selfLimitEffect?.limitGodmarkCount;

        if (effectiveLimit !== undefined) {
          const currentGodmarkCount = player.unitZone.filter(cardInZone => cardInZone && cardInZone.godMark).length;
          if (currentGodmarkCount >= effectiveLimit) {
            return { canPlay: false, reason: `God-mark limit reached (${effectiveLimit})` };
          }
        }
      }
    } else if (card.type === 'ITEM') {
      if (card.specialName && player.itemZone.some(cardInZone => cardInZone?.specialName === card.specialName)) {
        return { canPlay: false, reason: 'An item with the same special name already exists' };
      }
    }

    const availableColors: Record<string, number> = { RED: 0, WHITE: 0, YELLOW: 0, BLUE: 0, GREEN: 0, NONE: 0 };
    let omniColorCount = 0;

    const checkOmni = (target: Card | null) => {
      if (!target) return false;
      const isTargetId = String(target.id) === '105000481';
      const hasOmniEffect = target.effects?.some(effect => effect.id === '105000481_omni');
      return isTargetId || !!hasOmniEffect;
    };

    player.unitZone.forEach(cardInZone => {
      if (!cardInZone) return;
      if (checkOmni(cardInZone)) {
        omniColorCount++;
      } else if (cardInZone.color !== 'NONE') {
        availableColors[cardInZone.color] = (availableColors[cardInZone.color] || 0) + 1;
      }
    });

    let totalDeficit = 0;
    for (const [color, reqCount] of Object.entries(card.colorReq || {})) {
      totalDeficit += Math.max(0, (reqCount as number) - (availableColors[color] || 0));
    }

    if (totalDeficit > omniColorCount) {
      return { canPlay: false, reason: `Color requirement not met (missing ${totalDeficit})` };
    }

    const cost = getEffectivePlayCost(player, card);
    if (cost < 0) {
      const absCost = Math.abs(cost);
      const faceUpFrontCount = player.erosionFront.filter(cardInZone => cardInZone !== null && cardInZone.displayState === 'FRONT_UPRIGHT').length;
      if (faceUpFrontCount < absCost) {
        return { canPlay: false, reason: `Need ${absCost} face-up erosion cards` };
      }
    } else if (cost > 0) {
      let remainingCost = cost;
      const hasSpecialSubstitute = player.hand.some(cardInHand =>
        canUse204000145AsPaymentSubstitute(cardInHand, card.color, cost, card.gamecardId) ||
        canUse205000136AsPaymentSubstitute(cardInHand, card.color, cost, card.gamecardId)
      );
      if (hasSpecialSubstitute) {
        remainingCost = 0;
      }

      const hasFeijing = player.hand.some(cardInHand =>
        cardInHand.gamecardId !== card.gamecardId &&
        cardInHand.feijingMark &&
        cardInHand.color === card.color
      );
      if (remainingCost > 0 && hasFeijing) {
        remainingCost = Math.max(0, remainingCost - 3);
      }

      const readyUnitsCount = player.unitZone.filter(cardInZone => cardInZone !== null && !cardInZone.isExhausted).length;
      remainingCost = Math.max(0, remainingCost - readyUnitsCount);

      if (remainingCost > 0) {
        const totalErosionCount = player.erosionFront.filter(cardInZone => cardInZone !== null).length +
          player.erosionBack.filter(cardInZone => cardInZone !== null).length;
        if (totalErosionCount + remainingCost >= 10) {
          return { canPlay: false, reason: 'Not enough erosion space to pay the remaining cost' };
        }
      }
    }

    const playEffect = card.effects?.find(effect => effect.type === 'ACTIVATE' || effect.type === 'TRIGGER' || effect.type === 'ALWAYS');
    if (playEffect) {
      const shouldValidate = card.type === 'STORY' || playEffect.type === 'ALWAYS';
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
    const cardData = (card as any).data || {};
    const pseudoGoddessActive = cardData.pseudoGoddessTenPlusTurn === gameState.turnCount;
    const activatedEffectsDisabled = cardData.pseudoGoddessDisableActivatedTurn === gameState.turnCount;
    const globalDisableAllActivated = hasGlobalDisableAllActivated(gameState);
    const effectivePlayer = pseudoGoddessActive && player ? { ...player, isGoddessMode: true } : player;
    if (!player) return { valid: false, reason: 'Player data not found' };

    if (effect.triggerLocation && triggerLocation && !effect.triggerLocation.includes(triggerLocation)) {
      return { valid: false, reason: 'Invalid trigger location' };
    }

    if (effect.limitCount) {
      const usageMap = gameState.effectUsage || {};
      let key = '';
      if (effect.limitGlobal) {
        key = effect.limitNameType
          ? `game_${playerUid}_name_${card.id}_${effect.id}`
          : `game_${playerUid}_instance_${card.gamecardId}_${effect.id}`;
      } else {
        key = effect.limitNameType
          ? `turn_${gameState.turnCount}_${playerUid}_name_${card.id}_${effect.id}`
          : `turn_${gameState.turnCount}_${playerUid}_instance_${card.gamecardId}_${effect.id}`;
      }
      if ((usageMap[key] || 0) >= effect.limitCount) {
        return { valid: false, reason: 'Effect usage limit reached' };
      }
    }

    if (effect.erosionFrontLimit) {
      const frontCount = player.erosionFront.filter(cardInZone => cardInZone !== null).length;
      if (frontCount < effect.erosionFrontLimit[0] || frontCount > effect.erosionFrontLimit[1]) {
        return { valid: false, reason: 'Front erosion count requirement not met' };
      }
    }
    if (effect.erosionBackLimit) {
      const backCount = player.erosionBack.filter(cardInZone => cardInZone !== null).length;
      if (backCount < effect.erosionBackLimit[0] || backCount > effect.erosionBackLimit[1]) {
        return { valid: false, reason: 'Back erosion count requirement not met' };
      }
    }
    if (effect.erosionTotalLimit) {
      const totalCount = player.erosionFront.filter(cardInZone => cardInZone !== null).length +
        player.erosionBack.filter(cardInZone => cardInZone !== null).length;
      const ignoresTenPlusLimit = pseudoGoddessActive && effect.erosionTotalLimit[0] >= 10;
      if (!ignoresTenPlusLimit && (totalCount < effect.erosionTotalLimit[0] || totalCount > effect.erosionTotalLimit[1])) {
        return { valid: false, reason: 'Total erosion count requirement not met' };
      }
    }

    if (isFullEffectSilencedThisTurn(gameState, card)) {
      return { valid: false, reason: 'This card loses all effects this turn' };
    }

    if (effect.condition) {
      try {
        if (!effect.condition(gameState, effectivePlayer as PlayerState, card, event)) {
          return { valid: false, reason: 'Condition not met' };
        }
      } catch {
        return { valid: false, reason: 'Condition not met' };
      }
    }

    if (activatedEffectsDisabled && (effect.type === 'ACTIVATE' || effect.type === 'ACTIVATED')) {
      return { valid: false, reason: 'This card loses activated abilities this turn' };
    }

    if (globalDisableAllActivated && (effect.type === 'ACTIVATE' || effect.type === 'ACTIVATED')) {
      return { valid: false, reason: 'All activated abilities are currently disabled' };
    }

    return { valid: true };
  },

  recordEffectUsage(_game: GameState | null, _playerUid: string, _card: Card, _effect: CardEffect) {
    // Persistent usage is recorded on the server.
  }
};
