// Firebase imports removed - logic is now database-agnostic
import { GameState, PlayerState, Card, Deck, TriggerLocation, CardEffect, StackItem, GamePhase, GAME_TIMEOUTS } from '../src/types/game';
import { CARD_LIBRARY } from '../src/data/cards';
import { EventEngine } from '../src/services/EventEngine';
import { AtomicEffectExecutor } from '../src/services/AtomicEffectExecutor';
import { SERVER_CARD_LIBRARY } from './card_loader';

export function cleanForFirestore(obj: any): any {
  if (obj === undefined) {
    return undefined;
  }
  if (obj === null) {
    return null;
  }
  if (typeof obj === 'function') {
    return undefined;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj;
    }
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = cleanForFirestore(obj[key]);
        if (value !== undefined) {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export const ServerGameService = {
  hydrateCard(card: Card | null) {
    if (!card || (!card.id && !card.uniqueId)) return;
    const masterCard = SERVER_CARD_LIBRARY[card.uniqueId] || SERVER_CARD_LIBRARY[card.id];
    if (masterCard && masterCard.effects) {
      // Re-assign effects to restore functions lost during JSON serialization
      card.effects = masterCard.effects.map((originalEffect, idx) => {
        const runtimeEffect = card.effects ? card.effects[idx] : null;
        return {
          ...(runtimeEffect || originalEffect),
          condition: originalEffect.condition,
          execute: originalEffect.execute,
          cost: originalEffect.cost,
          resolve: originalEffect.resolve
        };
      });
    }
  },

  hydrateGameState(gameState: GameState) {
    if (!gameState || !gameState.players) return;
    Object.values(gameState.players).forEach(player => {
      const allZones = [
        player.hand, player.deck, player.grave, player.exile,
        player.unitZone, player.itemZone, player.erosionFront, player.erosionBack,
        player.playZone
      ];
      allZones.forEach(zone => {
        if (Array.isArray(zone)) {
          zone.forEach(card => this.hydrateCard(card));
        }
      });
    });
    // Also hydrate cards in the counter stack
    if (gameState.counterStack) {
      gameState.counterStack.forEach(item => {
        if (item.card) this.hydrateCard(item.card);
      });
    }
  },

  // Validate deck: 50 cards, max 10 God Mark, max 4 per card
  validateDeck(cards: Card[]): { valid: boolean; error?: string } {
    if (cards.length !== 50) {
      return { valid: false, error: `卡组必须正好为 50 张卡牌 (当前: ${cards.length})` };
    }
    const godMarkCount = cards.filter(c => c.godMark).length;
    if (godMarkCount > 10) {
      return { valid: false, error: `卡组中带有神蚀标记的卡牌不能超过 10 张 (当前: ${godMarkCount})` };
    }

    // Check for max 4 of each card
    const counts: { [id: string]: number } = {};
    for (const card of cards) {
      counts[card.id] = (counts[card.id] || 0) + 1;
      if (counts[card.id] > 4) {
        return { valid: false, error: `同名卡牌 [${card.fullName}] 在卡组中不能超过 4 张` };
      }
    }

    return { valid: true };
  },

  exhaustCard(card: Card) {
    if (card) {
      card.isExhausted = true;
    }
  },

  readyCard(card: Card) {
    if (card) {
      card.isExhausted = false;
    }
  },

  checkEffectLimitsAndReqs(gameState: GameState, playerUid: string, card: Card, effect: CardEffect, triggerLocation?: TriggerLocation): boolean {
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
        // Global limit (per game)
        if (effect.limitNameType) {
          // By card name
          key = `game_${playerUid}_name_${card.id}_${effect.id}`;
        } else {
          // By instance
          key = `game_${playerUid}_instance_${card.gamecardId}_${effect.id}`;
        }
      } else {
        // Turn limit
        if (effect.limitNameType) {
          // By card name
          key = `turn_${gameState.turnCount}_${playerUid}_name_${card.id}_${effect.id}`;
        } else {
          // By instance
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
    // 4. Condition Check
    if (effect.condition) {
      if (!effect.condition(gameState, player, card)) {
        return false;
      }
    }

    return true;
  },

  recordEffectUsage(gameState: GameState, playerUid: string, card: Card, effect: CardEffect) {
    if (!effect.limitCount) return;

    if (!gameState.effectUsage) {
      gameState.effectUsage = {};
    }

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

    gameState.effectUsage[key] = (gameState.effectUsage[key] || 0) + 1;
  },

  moveCard(
    gameState: GameState,
    sourcePlayerId: string,
    sourceZone: TriggerLocation,
    targetPlayerId: string,
    targetZone: TriggerLocation,
    cardId: string,
    options?: { targetIndex?: number; faceDown?: boolean; insertAtBottom?: boolean }
  ): boolean {
    const sourcePlayer = gameState.players[sourcePlayerId];
    const targetPlayer = gameState.players[targetPlayerId];
    if (!sourcePlayer || !targetPlayer) return false;

    let card: Card | null = null;
    let sourceArray: any[] = [];

    switch (sourceZone) {
      case 'HAND': sourceArray = sourcePlayer.hand; break;
      case 'GRAVE': sourceArray = sourcePlayer.grave; break;
      case 'EXILE': sourceArray = sourcePlayer.exile; break;
      case 'PLAY': sourceArray = sourcePlayer.playZone; break;
      case 'DECK': sourceArray = sourcePlayer.deck; break;
      case 'UNIT': sourceArray = sourcePlayer.unitZone; break;
      case 'ITEM': sourceArray = sourcePlayer.itemZone; break;
      case 'EROSION_FRONT': sourceArray = sourcePlayer.erosionFront; break;
      case 'EROSION_BACK': sourceArray = sourcePlayer.erosionBack; break;
    }

    const index = sourceArray.findIndex(c => c && (c.gamecardId === cardId || c.id === cardId));
    if (index !== -1) {
      card = sourceArray[index];
      if (sourceZone === 'UNIT' || sourceZone === 'ITEM' || sourceZone === 'EROSION_FRONT' || sourceZone === 'EROSION_BACK') {
        sourceArray[index] = null;
      } else {
        sourceArray.splice(index, 1);
      }
      EventEngine.handleCardLeftZone(gameState, sourcePlayerId, card, sourceZone);
    }

    if (!card) return false;

    card.cardlocation = targetZone;
    if (options?.faceDown !== undefined) {
      card.displayState = options.faceDown ? 'FRONT_FACEDOWN' : 'FRONT_UPRIGHT';
    }

    if (targetZone === 'UNIT' || targetZone === 'ITEM') {
      this.readyCard(card);
      // Mark as played this turn to handle summon sickness/triggers correctly
      card.playedTurn = gameState.turnCount;
    }

    let targetArray: any[] = [];
    switch (targetZone) {
      case 'HAND': targetArray = targetPlayer.hand; break;
      case 'GRAVE': targetArray = targetPlayer.grave; break;
      case 'EXILE': targetArray = targetPlayer.exile; break;
      case 'PLAY': targetArray = targetPlayer.playZone; break;
      case 'DECK': targetArray = targetPlayer.deck; break;
      case 'UNIT': targetArray = targetPlayer.unitZone; break;
      case 'ITEM': targetArray = targetPlayer.itemZone; break;
      case 'EROSION_FRONT': targetArray = targetPlayer.erosionFront; break;
      case 'EROSION_BACK': targetArray = targetPlayer.erosionBack; break;
    }

    if (targetZone === 'UNIT' || targetZone === 'ITEM' || targetZone === 'EROSION_FRONT' || targetZone === 'EROSION_BACK') {
      if (options?.targetIndex !== undefined && options.targetIndex >= 0 && options.targetIndex < targetArray.length) {
        targetArray[options.targetIndex] = card;
      } else {
        const emptyIndex = targetArray.findIndex(c => c === null);
        if (emptyIndex !== -1) {
          targetArray[emptyIndex] = card;
        } else {
          targetArray.push(card);
        }
      }
    } else {
      if (options?.insertAtBottom) {
        targetArray.unshift(card);
      } else {
        targetArray.push(card);
      }
    }

    EventEngine.handleCardEnteredZone(gameState, targetPlayerId, card, targetZone);

    // 3. There are 10 cards on the back of the erosion area
    this.checkWinConditions(gameState);

    return true;
  },

  canPlayCard(player: PlayerState, card: Card): { canPlay: boolean; reason?: string } {
    if (card.type === 'UNIT') {
      if (!player.unitZone.some(c => c === null)) {
        return { canPlay: false, reason: '单位区已满' };
      }
      if (card.specialName && player.unitZone.some(c => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: '单位区已有同名专用卡' };
      }
    } else if (card.type === 'ITEM') {
      if (card.specialName && player.itemZone.some(c => c?.specialName === card.specialName)) {
        return { canPlay: false, reason: '道具区已有同名专用卡' };
      }
    }

    // 3. Color Requirements
    const availableColors: Record<string, number> = { RED: 0, WHITE: 0, YELLOW: 0, BLUE: 0, GREEN: 0, NONE: 0 };
    const countColors = (c: Card | null) => {
      if (c && c.color !== 'NONE') availableColors[c.color] = (availableColors[c.color] || 0) + 1;
    };
    player.unitZone.forEach(countColors);
    for (const [color, reqCount] of Object.entries(card.colorReq || {})) {
      if ((availableColors[color] || 0) < (reqCount as number)) {
        return { canPlay: false, reason: `缺少颜色: ${color}` };
      }
    }

    // 4. Cost Check (AC Value)
    const cost = card.acValue || 0;
    if (cost < 0) {
      const absCost = Math.abs(cost);
      const faceUpFrontCount = player.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT').length;
      if (faceUpFrontCount < absCost) {
        return { canPlay: false, reason: `侵蚀区正面卡不足以支付费用 (需要 ${absCost} 张)` };
      }
    } else if (cost > 0) {
      let remainingCost = cost;

      // I. Check for Feijing card in hand (of the same color)
      const hasFeijing = player.hand.some(c =>
        c.gamecardId !== card.gamecardId &&
        c.feijingMark &&
        c.color === card.color
      );
      if (hasFeijing) {
        remainingCost = Math.max(0, remainingCost - 3);
      }

      // II. Check for ready units on field
      const readyUnitsCount = player.unitZone.filter(c => c !== null && !c.isExhausted).length;
      remainingCost = Math.max(0, remainingCost - readyUnitsCount);

      // III. Check Erosion space limit (cannot reach 10 total)
      if (remainingCost > 0) {
        const totalErosionCount = player.erosionFront.filter(c => c !== null).length +
          player.erosionBack.filter(c => c !== null).length;
        if (totalErosionCount + remainingCost >= 10) {
          return { canPlay: false, reason: '侵蚀区空间不足 (总数不能超过 9 张)' };
        }
      }
    }

    // 5. Specific Effect Limits (e.g. erosionBackLimit)
    const playEffect = card.effects.find(e => e.type === 'ACTIVATE' || e.type === 'TRIGGER' || e.type === 'ALWAYS');
    if (playEffect?.erosionBackLimit) {
      const backCount = player.erosionBack.filter(c => c !== null).length;
      if (backCount < playEffect.erosionBackLimit[0] || backCount > playEffect.erosionBackLimit[1]) {
        return { canPlay: false, reason: '侵蚀区背面卡数量不符合要求' };
      }
    }

    return { canPlay: true };
  },

  payCost(gameState: GameState, playerId: string, cost: number, paymentSelection: { feijingCardId?: string, exhaustUnitIds?: string[], erosionFrontIds?: string[] }, cardColor?: string, playingCardId?: string): { success: boolean; reason?: string } {
    const player = gameState.players[playerId];
    if (cost === 0) return { success: true };

    if (cost < 0) {
      const absCost = Math.abs(cost);
      if (!paymentSelection.erosionFrontIds || paymentSelection.erosionFrontIds.length !== absCost) {
        return { success: false, reason: `请选择 ${absCost} 张侵蚀区正面卡` };
      }

      for (const id of paymentSelection.erosionFrontIds) {
        if (!player.erosionFront.some(c => c?.gamecardId === id)) {
          return { success: false, reason: '选择的侵蚀区卡牌无效' };
        }
      }

      for (const id of paymentSelection.erosionFrontIds) {
        this.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', id);
      }
      return { success: true };
    }

    if (cost > 0) {
      let remainingCost = cost;
      let feijingCard: Card | undefined;

      if (paymentSelection.feijingCardId) {
        if (paymentSelection.feijingCardId === playingCardId) {
          return { success: false, reason: '不能使用正在打出的卡牌作为菲晶卡支付费用' };
        }
        feijingCard = player.hand.find(c => c.gamecardId === paymentSelection.feijingCardId && c.feijingMark);
        if (feijingCard) {
          if (cardColor && feijingCard.color !== cardColor) {
            return { success: false, reason: '菲晶卡颜色与打出的卡牌颜色不匹配' };
          }
          remainingCost = Math.max(0, remainingCost - 3);
        }
      }

      const cardsToExhaust: Card[] = [];
      if (paymentSelection.exhaustUnitIds) {
        for (const uid of paymentSelection.exhaustUnitIds) {
          if (remainingCost <= 0) break;
          const card = [...player.unitZone].find(c => c?.gamecardId === uid && !c.isExhausted);
          if (card) {
            cardsToExhaust.push(card);
            remainingCost -= 1;
          }
        }
      }

      // Actually exhaust them
      cardsToExhaust.forEach(c => this.exhaustCard(c));

      if (remainingCost > 0) {
        const totalErosion = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
        if (remainingCost >= 10 - totalErosion) {
          return { success: false, reason: '侵蚀区空间不足以支付剩余费用 (不能达到10张)' };
        }
      }

      if (feijingCard) {
        this.moveCard(gameState, playerId, 'HAND', playerId, 'GRAVE', feijingCard.gamecardId);
      }
      for (let i = 0; i < remainingCost; i++) {
        // 2. The cards in the damaged deck do not have enough damage value
        if (player.deck.length === 0) {
          gameState.logs.push(`[游戏结束] ${player.displayName} 的卡组中没有足够的卡牌来支付剩余费用，判负。`);
          gameState.gameStatus = 2;
          gameState.winReason = 'DECK_OUT_COST';
          gameState.winnerId = gameState.playerIds.find(id => id !== playerId);
          return { success: false, reason: 'DECK OUT' };
        }
        const topCard = player.deck.pop();
        if (topCard) {
          topCard.cardlocation = 'EROSION_FRONT';
          topCard.displayState = 'FRONT_UPRIGHT';
          const emptyIndex = player.erosionFront.findIndex(c => c === null);
          if (emptyIndex !== -1) {
            player.erosionFront[emptyIndex] = topCard;
          } else {
            player.erosionFront.push(topCard);
          }
        }
      }
      return { success: true };
    }

    return { success: false, reason: '未知错误' };
  },

  enterCountering(gameState: GameState, sourcePlayerId: string, stackItem: StackItem, initialPassCount: number = 0) {
    const now = Date.now();
    const elapsed = now - (gameState.phaseTimerStart || now);

    if (gameState.phase !== 'COUNTERING') {
      // If we are leaving a shared phase (MAIN, BATTLE_DECLARATION, BATTLE_FREE), subtract from turn budget
      const sharedPhases: GamePhase[] = ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'];
      if (sharedPhases.includes(gameState.phase)) {
        gameState.mainPhaseTimeRemaining = Math.max(0, (gameState.mainPhaseTimeRemaining || 300000) - elapsed);
      }

      gameState.previousPhase = gameState.phase;
      gameState.phase = 'COUNTERING';
      gameState.phaseTimerStart = now; // Independent 30s starts now
    }

    gameState.isCountering = 1;
    gameState.counterStack.push(stackItem);
    gameState.passCount = initialPassCount;

    // In TCGs, usually the non-active player gets the first chance to respond
    const opponentId = gameState.playerIds.find(id => id !== sourcePlayerId);
    gameState.priorityPlayerId = opponentId;

    gameState.logs.push(`[对抗开始] 等待 ${gameState.players[opponentId!].displayName} 响应。`);
  },

  async playCard(gameState: GameState, playerId: string, cardId: string, paymentSelection: { feijingCardId?: string, exhaustUnitIds?: string[], erosionFrontIds?: string[] }) {
    const player = gameState.players[playerId];
    const card = player.hand.find(c => c.gamecardId === cardId);
    if (!card) throw new Error('Card not found in hand');

    const canPlay = this.canPlayCard(player, card);
    if (!canPlay.canPlay) throw new Error(canPlay.reason);

    const cost = card.acValue;
    const paymentResult = this.payCost(gameState, playerId, cost, paymentSelection, card.color, cardId);
    if (!paymentResult.success) throw new Error(paymentResult.reason);

    this.moveCard(gameState, playerId, 'HAND', playerId, 'PLAY', cardId);
    gameState.logs.push(`${player.displayName} 打出了 ${card.fullName}`);

    EventEngine.dispatchEvent(gameState, {
      type: 'CARD_PLAYED',
      sourceCard: card,
      playerUid: playerId,
      sourceCardId: card.gamecardId
    });

    this.enterCountering(gameState, playerId, {
      card,
      ownerUid: playerId,
      type: 'PLAY',
      timestamp: Date.now()
    });

    return gameState;
  },

  async activateEffect(gameState: GameState, playerId: string, cardId: string, effectIndex: number) {
    // Find card in hand or on field
    const player = gameState.players[playerId];
    let card: Card | undefined;
    let location: TriggerLocation | undefined;

    const findInZones = (zones: (Card | null)[][], loc: TriggerLocation) => {
      for (const zone of zones) {
        const found = zone.find(c => c?.gamecardId === cardId);
        if (found) { card = found; location = loc; break; }
      }
    };

    findInZones([player.unitZone], 'UNIT');
    if (!card) findInZones([player.itemZone], 'ITEM');
    if (!card) findInZones([player.erosionFront], 'EROSION_FRONT');
    if (!card) findInZones([player.erosionBack], 'EROSION_BACK');
    if (!card) {
      card = player.hand.find(c => c.gamecardId === cardId);
      if (card) location = 'HAND';
    }

    if (!card) throw new Error('Card not found');

    const effect = card.effects?.[effectIndex];
    if (!effect) throw new Error('Effect not found');

    if (!this.checkEffectLimitsAndReqs(gameState, playerId, card, effect, location)) {
      throw new Error('不满足发动条件或已达到使用次数限制');
    }

    // 3. Payment/Cost Check
    if (effect.cost) {
      if (!effect.cost(gameState, player, card)) {
        throw new Error('发动费用不足或无法支付费用');
      }
    }

    this.recordEffectUsage(gameState, playerId, card, effect);
    gameState.logs.push(`${player.displayName} 发动了 ${card.fullName} 的效果: ${effect.description}`);

    this.enterCountering(gameState, playerId, {
      card,
      ownerUid: playerId,
      type: 'EFFECT',
      effectIndex,
      timestamp: Date.now()
    });

    return gameState;
  },

  async passConfrontation(gameState: GameState, playerId: string) {
    if (gameState.phase !== 'COUNTERING') return;
    if (gameState.priorityPlayerId !== playerId) throw new Error('尚未轮到你进行响应');

    gameState.passCount += 1;
    gameState.logs.push(`${gameState.players[playerId].displayName} 选择不进行对抗`);

    // Special Case: Phase End (Clean Pass)
    const isPhaseEndOnly = gameState.counterStack.length === 1 && gameState.counterStack[0].type === 'PHASE_END';
    const phaseEndItem = isPhaseEndOnly ? gameState.counterStack[0] : null;
    const isOpponentPassing = phaseEndItem && playerId !== phaseEndItem.ownerUid;

    // Resolve immediately if:
    // 1. Both players passed (passCount >= 2)
    // 2. OR it's a PHASE_END and the opponent just passed (passCount >= 1)
    if (isPhaseEndOnly && (gameState.passCount >= 2 || (isOpponentPassing && gameState.passCount >= 1))) {
      gameState.counterStack.pop();
      gameState.isCountering = 0;
      gameState.priorityPlayerId = undefined;
      gameState.passCount = 0;

      // CRITICAL: Restore the phase we are transitioning FROM
      // This ensures advancePhase's switch(gameState.phase) hits the correct case.
      if (gameState.previousPhase) {
        gameState.phase = gameState.previousPhase;
        gameState.previousPhase = undefined;
      }

      if (phaseEndItem!.nextPhase) {
        return this.advancePhase(gameState, phaseEndItem!.nextPhase);
      }
    }

    if (gameState.passCount >= 2) {
      await this.resolveCounterStack(gameState);
    } else {
      // Switch priority
      const nextId = gameState.playerIds.find(id => id !== playerId);
      gameState.priorityPlayerId = nextId;
    }

    return gameState;
  },

  async resolveCounterStack(gameState: GameState) {
    if (gameState.counterStack.length === 0) return;

    // Special Case: If it's just a PHASE_END and we are resolving (likely due to a timeout)
    // AND it's the ONLY item, we should ADVANCE.
    if (gameState.counterStack.length === 1 && gameState.counterStack[0].type === 'PHASE_END') {
      const item = gameState.counterStack.pop()!;
      gameState.isCountering = 0;
      gameState.passCount = 0;
      gameState.priorityPlayerId = undefined;

      if (gameState.previousPhase) {
        gameState.phase = gameState.previousPhase;
        gameState.previousPhase = undefined;
      }

      if (item.nextPhase) {
        return this.advancePhase(gameState, item.nextPhase);
      }
      return gameState;
    }

    gameState.logs.push(`[连锁结算] 开始处理对抗请求...`);

    // Resolve the entire stack from top to bottom (LIFO)
    while (gameState.counterStack.length > 0) {
      const stackItem = gameState.counterStack.pop();
      if (!stackItem) continue;

      const card = stackItem.card;
      const owner = gameState.players[stackItem.ownerUid];

      switch (stackItem.type) {
        case 'PLAY':
          if (!card) break;
          if (card.type === 'UNIT') {
            const playZoneCard = owner.playZone.find(c => c && c.gamecardId === card.gamecardId);
            if (playZoneCard) playZoneCard.playedTurn = gameState.turnCount;
            this.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'UNIT', card.gamecardId);
          } else if (card.type === 'ITEM' || card.isEquip) {
            const playZoneCard = owner.playZone.find(c => c && c.gamecardId === card.gamecardId);
            if (playZoneCard) playZoneCard.playedTurn = gameState.turnCount;
            this.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'ITEM', card.gamecardId);
          } else {
            // STORY card
            const effect = card.effects?.find(e => e.type === 'ALWAYS' || e.type === 'ACTIVATE' || e.type === 'ACTIVATED');
            if (effect && effect.execute) {
              effect.execute(card, gameState, owner);
              EventEngine.dispatchEvent(gameState, {
                type: 'EFFECT_ACTIVATED',
                playerUid: stackItem.ownerUid,
                sourceCardId: card.gamecardId
              });
            }
            this.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'GRAVE', card.gamecardId);
          }
          gameState.logs.push(`${card.fullName} 结算完成`);
          break;

        case 'EFFECT':
          if (!card) break;
          const data = stackItem.data as any;
          if (data && data.afterSelectionEffects) {
            data.afterSelectionEffects.forEach((atomic: any) => {
              AtomicEffectExecutor.execute(gameState, stackItem.ownerUid, atomic, card, undefined, data.selections);
            });
            gameState.logs.push(`[效果结算] 连锁中的选择效果已结算。`);
          } else {
            const effectIndex = stackItem.effectIndex ?? 0;
            const effect = card.effects?.[effectIndex];
            if (effect) {
              // Execute Atomic Effects if present
              if (effect.atomicEffects && effect.atomicEffects.length > 0) {
                effect.atomicEffects.forEach(atomic => {
                  AtomicEffectExecutor.execute(gameState, stackItem.ownerUid, atomic, card);
                });
              }

              // Execute legacy callback
              if (effect.execute) {
                effect.execute(card, gameState, owner);
              }

              gameState.logs.push(`[效果结算] ${card.fullName} 的效果已结算。`);
              EventEngine.dispatchEvent(gameState, {
                type: 'EFFECT_ACTIVATED',
                playerUid: stackItem.ownerUid,
                sourceCardId: card.gamecardId
              });
            }
          }
          break;

        case 'ATTACK':
          // Set battle state and transition to defense declaration
          gameState.battleState = {
            attackers: stackItem.attackerIds || [],
            isAlliance: !!stackItem.isAlliance
          };
          gameState.phase = 'DEFENSE_DECLARATION';
          gameState.logs.push(`[攻击宣告] 进入防御宣言阶段`);
          // Special return: if an attack was responded to, we go to defense declaration instead of previousPhase
          gameState.previousPhase = undefined;
          break;

        case 'PHASE_END':
          // A confrontation occurred (stack length was > 1 or something else was resolved first)
          // Yu-Gi-Oh rule: If a chain happens on Phase End, the phase does not end automatically.
          gameState.logs.push(`[阶段请求] 受到对抗影响，结算完毕后将返回原阶段。`);
          break;
      }
    }

    // After resolving the stack, return to previous phase if it exists
    if (gameState.previousPhase) {
      gameState.phase = gameState.previousPhase;
      gameState.previousPhase = undefined;
    }

    gameState.isCountering = 0;
    gameState.priorityPlayerId = undefined;
    gameState.passCount = 0;
    gameState.phaseTimerStart = Date.now();

    return gameState;
  },

  async resolvePlay(gameState: GameState) {
    return this.resolveCounterStack(gameState);
  },

  async handleQueryChoice(gameState: GameState, playerUid: string, queryId: string, selections: string[]) {
    console.log(`[Server] handleQueryChoice: player=${playerUid}, queryId=${queryId}, selections=`, selections);

    if (!gameState.pendingQuery || gameState.pendingQuery.id !== queryId) {
      console.warn(`[Server] Invalid query choice request: expected ${gameState.pendingQuery?.id}, got ${queryId}`);
      throw new Error('无效的选择请求');
    }
    if (gameState.pendingQuery.playerUid !== playerUid) {
      throw new Error('不属于你的选择请求');
    }

    const query = gameState.pendingQuery;
    gameState.pendingQuery = undefined;

    let afterEffects = query.afterSelectionEffects || [];
    let currentSelections = selections;
    const sourceCardId = query.context?.sourceCardId;

    // Robust source card finding: Check if id exists
    const sourceCard = sourceCardId ? this.findCardById(gameState, sourceCardId) : undefined;

    const normalizedType = query.type.replace(/-/g, '_').toUpperCase();

    // 1. Process Core Actions (like Payment) first
    if (normalizedType === 'SELECT_PAYMENT') {
      try {
        const paymentSelection = JSON.parse(selections[0]);
        const result = this.payCost(
          gameState,
          playerUid,
          query.paymentCost || 0,
          paymentSelection,
          query.paymentColor,
          query.context?.targetCardId // Use optional chaining for safety
        );

        if (!result.success) {
          gameState.pendingQuery = query; // Restore for retry
          throw new Error(result.reason || '支付失败');
        }

        gameState.logs.push(`[系统] 支付成功，即将进入后续结算`);

        afterEffects = query.context?.remainingEffects || [];
        currentSelections = query.context?.targetSelections || [];
      } catch (e: any) {
        gameState.pendingQuery = query;
        throw e;
      }
    }

    // 2. Generic Effect Resolution (Script-Driven via resolve callback)
    if (query.callbackKey === 'EFFECT_RESOLVE') {
      if (!sourceCard) {
        gameState.logs.push(`[错误] EFFECT_RESOLVE 找不到来源卡 ID: ${sourceCardId}`);
        return gameState;
      }

      const effectIndex = query.context?.effectIndex;
      const effectId = query.context?.effectId;

      // Ensure sourceCard.effects exists and find the effect
      let effect: CardEffect | undefined;
      if (effectIndex !== undefined) {
        effect = sourceCard.effects?.[effectIndex];
      } else if (effectId) {
        effect = sourceCard.effects?.find(e => e.id === effectId);
      }

      if (effect && effect.resolve) {
        gameState.logs.push(`[系统] 正在执行脚本回调 ${effect.id || effectIndex}`);
        effect.resolve(sourceCard, gameState, gameState.players[playerUid], selections, query.context);
        EventEngine.recalculateContinuousEffects(gameState);
        return gameState;
      } else {
        gameState.logs.push(`[错误] EFFECT_RESOLVE 找不到有效回调 (index: ${effectIndex}, id: ${effectId})`);
      }
    }


    if (afterEffects.length > 0) {
      for (let i = 0; i < afterEffects.length; i++) {
        const effect = afterEffects[i];

        // INTERCEPT: If we need payment, "pause" and issue a SELECT_PAYMENT query
        if (effect.type === 'PAY_CARD_COST') {
          const targetId = currentSelections[0];
          const targetCard = this.findCardById(gameState, targetId);
          if (targetCard && targetCard.acValue && targetCard.acValue !== 0) {
            gameState.pendingQuery = {
              id: Math.random().toString(36).substring(7),
              type: 'SELECT_PAYMENT',
              playerUid,
              options: [], // Not used for payment
              title: `支付费用: ${targetCard.fullName}`,
              description: `请选择如何支付 ${targetCard.acValue} 点费用。`,
              minSelections: 1,
              maxSelections: 1,
              callbackKey: 'GENERIC_RESOLVE',
              paymentCost: targetCard.acValue,
              paymentColor: targetCard.color,
              context: {
                ...query.context,
                targetCardId: targetId,
                targetSelections: currentSelections,
                remainingEffects: afterEffects.slice(i + 1)
              }
            };
            return gameState; // Exit handleQueryChoice, waiting for payment
          }
          continue; // No cost to pay
        }

        if (query.executionMode === 'ON_STACK') {
          const queryCard = sourceCard || query.options[0]?.card;
          this.enterCountering(gameState, playerUid, {
            ownerUid: playerUid,
            type: 'EFFECT',
            card: queryCard,
            timestamp: Date.now(),
            data: {
              afterSelectionEffects: [effect], // Push one by one to stack? 
              selections: currentSelections
            } as any
          });
        } else {
          // IMMEDIATE resolution
          AtomicEffectExecutor.execute(gameState, playerUid, effect, sourceCard, undefined, currentSelections);
        }
      }
    }

    return gameState;
  },

  findCardById(gameState: GameState, gamecardId: string): Card | undefined {
    for (const player of Object.values(gameState.players)) {
      const zones = [player.hand, player.deck, player.grave, player.exile, player.unitZone, player.itemZone, player.erosionFront, player.erosionBack];
      for (const zone of zones) {
        const found = zone.find(c => c?.gamecardId === gamecardId);
        if (found) return found;
      }
    }
    return undefined;
  },

  async declareAttack(gameState: GameState, playerId: string, attackerIds: string[], isAlliance: boolean) {

    if (gameState.phase !== 'BATTLE_DECLARATION') throw new Error('Not in battle declaration phase');

    const player = gameState.players[playerId];
    const attackers: Card[] = [];

    if (isAlliance && attackerIds.length !== 2) {
      throw new Error('联军攻击必须选择两个单位');
    }
    if (!isAlliance && attackerIds.length !== 1) {
      throw new Error('单体攻击必须选择一个单位');
    }

    if (!isAlliance) {
      for (const id of attackerIds) {
        const unit = player.unitZone.find(c => c?.gamecardId === id);
        if (unit?.inAllianceGroup) {
          throw new Error(`单位 [${unit.fullName}] 处于联军状态，只能进行联军攻击`);
        }
      }
    }

    for (const id of attackerIds) {
      const unit = player.unitZone.find(c => c?.gamecardId === id);
      if (!unit) throw new Error('Attacker not found in unit zone');
      if (unit.isExhausted) throw new Error('Attacker is already exhausted');
      if (unit.canAttack === false) throw new Error(`单位 [${unit.fullName}] 无法攻击`);

      // Interpretation: entering "allied territory" makes them participants in an alliance
      if (isAlliance) {
        unit.inAllianceGroup = true;
      }

      // Attack conditions:
      // a. Upright, isrush=true, can attack this turn
      // b. Upright, isrush=false, not played this turn
      const isRush = !!unit.isrush;
      const wasPlayedThisTurn = unit.playedTurn === gameState.turnCount;
      if (!isRush && wasPlayedThisTurn) {
        throw new Error(`单位 [${unit.fullName}] 在本回合打出，没有【疾走】不能攻击`);
      }

      attackers.push(unit);
    }

    // Exhaust attackers
    for (const unit of attackers) {
      this.exhaustCard(unit);
    }

    gameState.battleState = {
      attackers: attackerIds,
      isAlliance
    };

    const attackerNames = attackers.map(a => a.fullName).join(' 和 ');
    gameState.logs.push(`${player.displayName} 宣告了攻击: ${attackerNames}${isAlliance ? ' (联军攻击)' : ''}`);

    EventEngine.dispatchEvent(gameState, {
      type: 'CARD_ATTACK_DECLARED',
      sourceCard: attackers[0], // Use first attacker as source for simplicity, or omit if not card-specific
      playerUid: playerId,
      data: { attackerIds, isAlliance }
    });

    this.enterCountering(gameState, playerId, {
      ownerUid: playerId,
      type: 'ATTACK',
      attackerIds,
      isAlliance,
      timestamp: Date.now()
    });

    return gameState;
  },

  async declareDefense(gameState: GameState, playerId: string, defenderId?: string) {

    if (gameState.phase !== 'DEFENSE_DECLARATION') throw new Error('Not in defense declaration phase');
    if (!gameState.battleState) throw new Error('No battle state found');

    const player = gameState.players[playerId];

    if (defenderId) {
      const unit = player.unitZone.find(c => c?.gamecardId === defenderId);
      if (!unit) throw new Error('Defender not found in unit zone');
      if (unit.isExhausted) throw new Error('Defender is already exhausted');

      this.exhaustCard(unit);
      gameState.battleState.defender = defenderId;
      gameState.logs.push(`${player.displayName} 宣告了防御: ${unit.fullName}`);
    } else {
      gameState.logs.push(`${player.displayName} 选择不防御`);
    }

    // Transition to counter check (for now just move to battle free)
    gameState.phase = 'BATTLE_FREE';
    gameState.phaseTimerStart = Date.now();

    return gameState;
  },

  async resolveDamage(gameState: GameState) {

    if (gameState.phase !== 'DAMAGE_CALCULATION') throw new Error('Not in damage calculation phase');
    if (!gameState.battleState) throw new Error('No battle state found');

    const attackerId = gameState.playerIds[gameState.currentTurnPlayer];
    const defenderId = gameState.playerIds[gameState.currentTurnPlayer === 0 ? 1 : 0];
    const attacker = gameState.players[attackerId];
    const defender = gameState.players[defenderId];

    const attackingUnits = gameState.battleState.attackers.map(id =>
      attacker.unitZone.find(c => c?.gamecardId === id)
    ).filter(Boolean) as Card[];

    if (!gameState.battleState.defender) {
      // Direct damage to player
      let totalDamage = attackingUnits.reduce((sum, u) => sum + (u.damage || 0), 0);
      if (defender.isGoddessMode) {
        totalDamage *= 2;
        gameState.logs.push(`${defender.displayName} 处于女神化状态，受到的伤害翻倍！`);
      }

      gameState.logs.push(`${attacker.displayName} 对 ${defender.displayName} 造成了 ${totalDamage} 点战斗伤害`);

      EventEngine.dispatchEvent(gameState, {
        type: 'COMBAT_DAMAGE_CAUSED',
        playerUid: defenderId,
        data: { amount: totalDamage, source: 'BATTLE' }
      });

      this.applyDamageToPlayer(gameState, defenderId, totalDamage);
    } else {
      // Unit combat
      const defendingUnit = defender.unitZone.find(c => c?.gamecardId === gameState.battleState!.defender) as Card;
      const defenderPower = defendingUnit.power || 0;

      if (!gameState.battleState.isAlliance) {
        const attackingUnit = attackingUnits[0];
        const attackerPower = attackingUnit.power || 0;

        if (attackerPower > defenderPower) {
          this.destroyUnit(gameState, defenderId, defendingUnit.gamecardId);
          gameState.logs.push(`${attackingUnit.fullName} 破坏了 ${defendingUnit.fullName}`);
        } else if (attackerPower < defenderPower) {
          this.destroyUnit(gameState, attackerId, attackingUnit.gamecardId);
          gameState.logs.push(`${defendingUnit.fullName} 破坏了 ${attackingUnit.fullName}`);
        } else {
          this.destroyUnit(gameState, attackerId, attackingUnit.gamecardId);
          this.destroyUnit(gameState, defenderId, defendingUnit.gamecardId);
          gameState.logs.push(`${attackingUnit.fullName} 和 ${defendingUnit.fullName} 同归于尽`);
        }
      } else {
        // Alliance combat
        const totalAttackerPower = attackingUnits.reduce((sum, u) => sum + (u.power || 0), 0);
        const powerA = attackingUnits[0].power || 0;
        const powerB = attackingUnits[1].power || 0;

        if (defenderPower < Math.min(powerA, powerB)) {
          // Defender destroyed
          this.destroyUnit(gameState, defenderId, defendingUnit.gamecardId);
          gameState.logs.push(`${defendingUnit.fullName} 被联军破坏`);
        } else if (defenderPower > totalAttackerPower) {
          // Both attackers destroyed
          this.destroyUnit(gameState, attackerId, attackingUnits[0].gamecardId);
          this.destroyUnit(gameState, attackerId, attackingUnits[1].gamecardId);
          gameState.logs.push(`联军被 ${defendingUnit.fullName} 击溃，两个单位都被破坏`);
        } else {
          // Defender power is between min and total
          // Prompt user to choose? For now, automatic logic as per rules
          // aa. 如果防御单位的力量值高于其中一个的力量值但是不高于联军总力量值，则力量值最低的被破坏送去墓地。
          // ab. 如果防御单位的力量值高于任意一个攻击单位的力量值但是不高于联军总力量值，则攻击方玩家选择一个攻击单位送去墓地。
          // These rules seem to imply the same thing if powers are different.
          // Let's just pick the lower power one to destroy.
          const unitToDestroy = powerA <= powerB ? attackingUnits[0] : attackingUnits[1];
          this.destroyUnit(gameState, attackerId, unitToDestroy.gamecardId);
          gameState.logs.push(`${defendingUnit.fullName} 抵挡了联军，${unitToDestroy.fullName} 被破坏`);
        }
      }
    }
    // Mark all attackers as exhausted
    attackingUnits.forEach(u => {
      const unit = attacker.unitZone.find(uz => uz?.gamecardId === u.gamecardId);
      if (unit) unit.isExhausted = true;
    });

    gameState.phase = 'MAIN';
    gameState.battleState = undefined;
    gameState.phaseTimerStart = Date.now();
    return gameState;
  },

  applyDamageToPlayer(gameState: GameState, playerId: string, damage: number) {
    const player = gameState.players[playerId];

    // 2. The cards in the damaged deck do not have enough damage value
    if (player.deck.length < damage) {
      gameState.logs.push(`[游戏结束] ${player.displayName} 的卡组中没有足够的卡牌来承受 ${damage} 点伤害，判负。`);
      gameState.gameStatus = 2;
      gameState.winReason = 'DECK_OUT_DAMAGE';
      gameState.winnerId = gameState.playerIds.find(id => id !== playerId);
      return;
    }

    for (let i = 0; i < damage; i++) {
      const card = player.deck.pop()!;
      card.cardlocation = 'EROSION_FRONT';
      card.displayState = 'FRONT_UPRIGHT';

      // Find empty spot in erosionFront
      const emptyIdx = player.erosionFront.findIndex(c => c === null);
      if (emptyIdx !== -1) {
        player.erosionFront[emptyIdx] = card;
      } else {
        player.erosionFront.push(card);
      }

      // Check for goddess mode
      const totalErosion = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
      if (totalErosion >= 10) {
        player.isGoddessMode = true;
        gameState.logs.push(`${player.displayName} 进入了女神化状态！`);
      }

      // If more than 10, excess to grave
      const currentTotal = player.erosionFront.filter(c => c !== null).length;
      if (currentTotal > 10) {
        const lastIdx = player.erosionFront.length - 1;
        const excessCard = player.erosionFront[lastIdx];
        if (excessCard) {
          excessCard.cardlocation = 'GRAVE';
          player.grave.push(excessCard);
          player.erosionFront[lastIdx] = null;
        }
      }
    }

    // Check 10 erosion back condition just in case (though it's mostly in moveCard)
    this.checkWinConditions(gameState);
  },

  destroyUnit(gameState: GameState, playerId: string, gamecardId: string) {
    const player = gameState.players[playerId];
    const idx = player.unitZone.findIndex(c => c?.gamecardId === gamecardId);
    if (idx !== -1) {
      const card = player.unitZone[idx]!;
      card.cardlocation = 'GRAVE';
      player.grave.push(card);
      player.unitZone[idx] = null;

      EventEngine.dispatchEvent(gameState, {
        type: 'CARD_DESTROYED_BATTLE',
        targetCardId: gamecardId,
        playerUid: playerId
      });
    }
  },

  async discardCard(gameState: GameState, playerId: string, cardId: string) {

    if (gameState.phase !== 'DISCARD') throw new Error('Not in discard phase');
    const player = gameState.players[playerId];

    const cardIdx = player.hand.findIndex(c => c.gamecardId === cardId);
    if (cardIdx === -1) throw new Error('Card not found in hand');

    const card = player.hand.splice(cardIdx, 1)[0];
    card.cardlocation = 'GRAVE';
    player.grave.push(card);
    gameState.logs.push(`${player.displayName} 弃置了一张卡牌`);

    EventEngine.dispatchEvent(gameState, {
      type: 'CARD_DISCARDED',
      playerUid: playerId,
      data: { cardId: card.gamecardId }
    });

    if (player.hand.length <= 6) {
      // Move to next turn
      this.finishTurnTransition(gameState);
    }

    return gameState;
  },

  finishTurnTransition(gameState: GameState) {
    const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const currentPlayer = gameState.players[currentPlayerId];

    gameState.currentTurnPlayer = gameState.currentTurnPlayer === 0 ? 1 : 0;
    gameState.turnCount += 1;
    gameState.phase = 'START';
    gameState.phaseTimerStart = Date.now();
    const nextPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const nextPlayer = gameState.players[nextPlayerId];

    currentPlayer.isTurn = false;
    nextPlayer.isTurn = true;

    gameState.logs.push(`--- 回合 ${gameState.turnCount}: ${nextPlayer.displayName} ---`);
    gameState.mainPhaseTimeRemaining = GAME_TIMEOUTS.MAIN_PHASE_TOTAL;
    this.executeStartPhase(gameState, nextPlayer);
  },

  checkWinConditions(gameState: GameState): boolean {
    if (gameState.gameStatus === 2) return true; // Already over

    for (const player of Object.values(gameState.players)) {
      // 3. There are 10 cards on the back of the erosion area
      const erosionBackCount = player.erosionBack.filter(c => c !== null).length;
      if (erosionBackCount >= 10) {
        gameState.gameStatus = 2;
        gameState.winReason = 'EROSION_BACK_FULL';
        gameState.winnerId = gameState.playerIds.find(id => id !== player.uid);
        gameState.logs.push(`[游戏结束] ${player.displayName} 的侵蚀区背面达到 10 张，判负。`);
        return true;
      }
    }
    return false;
  },

  async advancePhase(gameState: GameState, action?: string, playerId?: string) {
    console.log(`[ServerGameService] advancePhase call, action: ${action}, phase: ${gameState.phase}, playerId: ${playerId}`);

    const now = Date.now();
    const elapsed = now - (gameState.phaseTimerStart || now);

    // If we are leaving a shared phase (MAIN, BATTLE_DECLARATION, BATTLE_FREE), subtract from turn budget
    const sharedPhases: GamePhase[] = ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'];
    if (sharedPhases.includes(gameState.phase)) {
      gameState.mainPhaseTimeRemaining = Math.max(0, (gameState.mainPhaseTimeRemaining || GAME_TIMEOUTS.MAIN_PHASE_TOTAL) - elapsed);
    }

    gameState.phaseTimerStart = now;

    // Identity of the player performing the action
    const actingPlayerId = playerId || gameState.playerIds[gameState.currentTurnPlayer];
    const actingPlayer = gameState.players[actingPlayerId];

    // Identity of the current turn player (for phase transitions)
    const turnPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const turnPlayer = gameState.players[turnPlayerId];

    switch (gameState.phase) {
      case 'INIT':
      case 'MULLIGAN':
        gameState.phase = 'START';
        gameState.turnCount = 1;
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'START' } });
        this.executeStartPhase(gameState, turnPlayer);
        break;
      case 'START':
        gameState.phase = 'DRAW';
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'DRAW' } });
        this.executeDrawPhase(gameState, turnPlayer);
        break;
      case 'DRAW':
        gameState.phase = 'EROSION';
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'EROSION' } });
        this.executeErosionPhase(gameState, turnPlayer);
        break;
      case 'EROSION':
        // Handled by handleErosionChoice
        break;
      case 'MAIN':
        if (action === 'DECLARE_BATTLE' || action === 'BATTLE_DECLARATION') {
          if (gameState.turnCount === 1) {
            throw new Error('先手玩家第一回合不能进入战斗阶段');
          }
          if (action === 'BATTLE_DECLARATION') {
            gameState.phase = 'BATTLE_DECLARATION';
            EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'BATTLE_DECLARATION' } });
            gameState.logs.push(`${actingPlayer.displayName} 进入战斗阶段`);
          } else {
            this.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'BATTLE_DECLARATION',
              timestamp: Date.now()
            }, 1); // Start with 1 pass (the proposer)
          }
        } else if (action === 'DECLARE_END' || action === 'DISCARD') {
          if (action === 'DISCARD') {
            this.executeEndPhase(gameState, actingPlayer);
          } else {
            this.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'DISCARD', // Transition to discard/end
              timestamp: Date.now()
            }, 1); // Start with 1 pass (the proposer)
          }
        }
        break;
      case 'BATTLE_DECLARATION':
        if (action === 'DECLARE_END' || action === 'DISCARD') {
          if (action === 'DISCARD') {
            this.executeEndPhase(gameState, actingPlayer);
          } else {
            this.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'DISCARD',
              timestamp: Date.now()
            }, 1);
          }
        } else if (action === 'RETURN_MAIN' || action === 'MAIN') {
          if (action === 'MAIN') {
            gameState.phase = 'MAIN';
            EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN' } });
            gameState.logs.push(`${actingPlayer.displayName} 返回主要阶段`);
          } else {
            this.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'MAIN',
              timestamp: Date.now()
            });
          }
        }
        break;
      case 'BATTLE_FREE':
        if (!gameState.battleState) {
          console.warn('[ServerGameService] BATTLE_FREE without battleState, returning to MAIN');
          gameState.phase = 'MAIN';
          return gameState;
        }

        if (action === 'PROPOSE_DAMAGE_CALCULATION' || action === 'DAMAGE_CALCULATION') {
          if (action === 'DAMAGE_CALCULATION') {
            gameState.phase = 'DAMAGE_CALCULATION';
            gameState.battleState.askConfront = undefined;
            await this.resolveDamage(gameState);
          } else {
            // Propose calculation - ask opponent first
            gameState.battleState.askConfront = 'ASKING_OPPONENT';
            gameState.phaseTimerStart = Date.now();
            gameState.logs.push(`等待对手确认是否进行对抗`);
          }
        } else if (action === 'CONFIRM_CONFRONTATION') {
          gameState.battleState.askConfront = undefined;
          this.enterCountering(gameState, actingPlayerId, {
            ownerUid: actingPlayerId,
            type: 'PHASE_END',
            nextPhase: 'DAMAGE_CALCULATION',
            timestamp: Date.now()
          }, 1);
          gameState.logs.push(`在自由阶段展开对抗！`);
        } else if (action === 'DECLINE_CONFRONTATION') {
          if (gameState.battleState.askConfront === 'ASKING_OPPONENT') {
            // Opponent declined, ask turn player if they want to counter? 
            gameState.battleState.askConfront = 'ASKING_TURN_PLAYER';
            gameState.phaseTimerStart = Date.now();
          } else {
            // Both declined or turn player declined
            gameState.phase = 'DAMAGE_CALCULATION';
            gameState.battleState.askConfront = undefined;
            gameState.logs.push(`进入伤害判定`);
            await this.resolveDamage(gameState);
          }
        } else if (action === 'RETURN_MAIN') {
          gameState.phase = 'MAIN';
          gameState.battleState = undefined;
          gameState.logs.push(`战斗中止，返回主要阶段`);
        }
        break;
      case 'BATTLE_END':
        gameState.phase = 'MAIN';
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN' } });
        gameState.battleState = undefined;
        gameState.logs.push(`战斗结束，返回主要阶段`);
        break;
      case 'DISCARD':
        // Handled by discardCard
        break;
      case 'END':
        // This case is now handled automatically in DECLARE_END
        break;
    }

    return gameState;
  },

  executeStartPhase(gameState: GameState, player: PlayerState) {
    console.log(`[ServerGameService] executeStartPhase for ${player.displayName}`);

    // Update public hand duration
    Object.values(gameState.players).forEach(p => {
      if (p.isHandPublic !== undefined && p.isHandPublic > 0) {
        p.isHandPublic -= 1;
        if (p.isHandPublic === 0) {
          gameState.logs.push(`${p.displayName} 的手牌已恢复私密状态`);
        }
      }
    });

    gameState.mainPhaseTimeRemaining = GAME_TIMEOUTS.MAIN_PHASE_TOTAL;
    const unitsToReset = player.unitZone.filter(c => c && c.isExhausted && c.canResetCount === 0);

    const itemsToReset = player.itemZone.filter(c => c && c.isExhausted && c.canResetCount === 0);

    if (unitsToReset.length === 0 && itemsToReset.length === 0) {
      gameState.logs.push(`${player.displayName} 没有可调度的单位，直接进入抽牌阶段。`);
    } else {
      player.unitZone.forEach(card => {
        if (card && card.canResetCount === 0) {
          this.readyCard(card);
        } else if (card && card.canResetCount !== undefined && card.canResetCount > 0) {
          card.canResetCount -= 1;
        }
      });
      player.itemZone.forEach(card => {
        if (card && card.canResetCount === 0) {
          this.readyCard(card);
        } else if (card && card.canResetCount !== undefined && card.canResetCount > 0) {
          card.canResetCount -= 1;
        }
      });
      gameState.logs.push(`${player.displayName} 完成了调度。`);
    }

    player.hasExhaustedThisTurn = [];

    // Automatically move to DRAW phase
    gameState.phase = 'DRAW';
    gameState.phaseTimerStart = Date.now();
    this.executeDrawPhase(gameState, player);
  },

  executeDrawPhase(gameState: GameState, player: PlayerState) {
    console.log(`[ServerGameService] executeDrawPhase for ${player.displayName}`);
    gameState.logs.push(`${player.displayName} 的抽卡阶段`);


    // First player on first turn does not draw
    if (gameState.turnCount === 1) {
      gameState.logs.push('先手玩家第一回合不抽卡');
      gameState.phase = 'EROSION';
      this.executeErosionPhase(gameState, player);
      return;
    }

    // Check effects at DRAW phase (TODO)
    if (player.deck.length > 0) {
      const card = player.deck.pop();
      if (card) {
        card.cardlocation = 'HAND';
        player.hand.push(card);
        gameState.logs.push(`${player.displayName} 抽了一张卡`);
        EventEngine.dispatchEvent(gameState, {
          type: 'CARD_DRAWN',
          playerUid: player.uid,
          data: { cardId: card.gamecardId }
        });
      }
    } else {
      // 1. During the card drawing stage, there are no cards available for drawing
      gameState.logs.push(`[游戏结束] ${player.displayName} 在抽牌阶段卡组已空，判负。`);
      gameState.gameStatus = 2;
      gameState.winReason = 'DECK_OUT_DRAW';
      gameState.winnerId = gameState.playerIds.find(id => id !== player.uid);
      return; // Stop processing further phases
    }

    // Automatically move to EROSION phase
    gameState.phase = 'EROSION';
    this.executeErosionPhase(gameState, player);
  },

  executeErosionPhase(gameState: GameState, player: PlayerState) {
    console.log(`[ServerGameService] executeErosionPhase for ${player.displayName}`);
    const faceUpCards = player.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT');
    console.log(`[ServerGameService] Found ${faceUpCards.length} face-up cards in erosion front`);

    if (faceUpCards.length === 0) {
      gameState.logs.push(`${player.displayName} 侵蚀区没有正面卡，跳过侵蚀阶段。`);
      gameState.phase = 'MAIN';
      gameState.logs.push(`${player.displayName} 进入主要阶段`);
      console.log(`[ServerGameService] No face-up cards, auto-moving to MAIN phase`);
    } else {
      gameState.logs.push(`${player.displayName} 进入侵蚀阶段，请选择处理方式。`);
      console.log(`[ServerGameService] Waiting for erosion choice`);
    }
  },


  async handleErosionChoice(gameState: GameState, playerId: string, choice: 'A' | 'B' | 'C', selectedCardId?: string) {

    const player = gameState.players[playerId];
    if (gameState.phase !== 'EROSION' || !player.isTurn) throw new Error('Not in erosion phase or not your turn');

    const faceUpCards = player.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT') as Card[];

    if (choice === 'A') {
      // a. Move all face-up cards in the Erosion Zone to the Graveyard
      for (const card of faceUpCards) {
        this.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', card.gamecardId);
      }
      gameState.logs.push(`${player.displayName} 将侵蚀区所有正面卡移至墓地。`);
    } else if (choice === 'B') {
      // b. Choose one face-up card to keep; others to Graveyard
      if (!selectedCardId) throw new Error('Please select a card to keep');
      for (const card of faceUpCards) {
        if (card.gamecardId !== selectedCardId) {
          this.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', card.gamecardId);
        }
      }
      gameState.logs.push(`${player.displayName} 选择保留一张正面卡，其余移至墓地。`);
    } else if (choice === 'C') {
      // c. Choose one to hand; others to Graveyard; then top card to Erosion Zone face-down
      if (!selectedCardId) throw new Error('Please select a card to add to hand');
      for (const card of faceUpCards) {
        if (card.gamecardId === selectedCardId) {
          this.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'HAND', card.gamecardId);
        } else {
          this.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', card.gamecardId);
        }
      }

      // Place top card of deck face-down in Erosion Zone
      if (player.deck.length > 0) {
        const topCard = player.deck.pop()!;
        topCard.cardlocation = 'EROSION_BACK';
        topCard.displayState = 'FRONT_FACEDOWN';
        const emptyIndex = player.erosionBack.findIndex(c => c === null);
        if (emptyIndex !== -1) {
          player.erosionBack[emptyIndex] = topCard;
        } else {
          player.erosionBack.push(topCard);
        }
      }
      gameState.logs.push(`${player.displayName} 将一张正面卡加入手牌，其余移至墓地，并补充了一张背面卡。`);
    }

    gameState.phase = 'MAIN';
    gameState.logs.push(`${player.displayName} 进入主要阶段`);
  },

  executeEndPhase(gameState: GameState, player: PlayerState) {
    gameState.logs.push(`${player.displayName} 的结束阶段`);

    if (player.hand.length > 6) {
      gameState.phase = 'DISCARD';
      gameState.logs.push(`${player.displayName} 手牌超过 6 张，请弃置卡牌。`);
    } else {
      this.finishTurnTransition(gameState);
    }
  },


  // Create a new game and wait for opponent
  async createGame(deck: Card[]) {
    // Auth check placeholder removed (always truthy in temp environment)

    const validation = this.validateDeck(deck);
    if (!validation.valid) throw new Error(validation.error);

    const tempId = Math.random().toString(36).substring(7);
    const initializedDeck = deck.map(card => ({
      ...card,
      basePower: card.basePower ?? card.power,
      baseDamage: card.baseDamage ?? card.damage,
      baseIsrush: card.baseIsrush ?? card.isrush,
      baseCanAttack: card.baseCanAttack ?? card.canAttack,
      baseGodMark: card.baseGodMark ?? card.godMark,
      baseAcValue: card.baseAcValue ?? card.acValue,
      baseCanActivateEffect: card.baseCanActivateEffect ?? card.canActivateEffect ?? true
    }));

    const initialPlayerState: PlayerState = {
      uid: ({ uid: "temp", displayName: "temp" } as any).uid,
      displayName: ({ uid: "temp", displayName: "temp" } as any).displayName || 'Player 1',
      deck: this.assignGameCardIds(this.shuffle([...initializedDeck])),
      hand: [],
      grave: [],
      exile: [],
      itemZone: [],
      erosionFront: [],
      erosionBack: [],
      unitZone: Array(6).fill(null),
      playZone: [],
      isTurn: false,
      isFirst: true,
      mulliganDone: false,
      hasExhaustedThisTurn: [],
      isHandPublic: 0,
    };

    // Initial Draw 4
    for (let i = 0; i < 4; i++) {
      const card = initialPlayerState.deck.pop();
      if (card) initialPlayerState.hand.push(card);
    }

    const gameState: GameState = {
      gameId: "temp", phase: 'INIT',
      currentTurnPlayer: 0,
      turnCount: 0,
      isCountering: 0,
      counterStack: [],
      passCount: 0,
      playerIds: [({ uid: "temp", displayName: "temp" } as any).uid, ''],
      gameStatus: 1,
      logs: ['游戏已创建。等待对手加入...'],
      players: {
        [({ uid: "temp", displayName: "temp" } as any).uid]: initialPlayerState
      },
      phaseTimerStart: Date.now()
    };
    return gameState;
  },

  // Create a practice game with a bot
  async createPracticeGame(deck: Card[]) {
    // Auth check placeholder removed (always truthy in temp environment)

    const validation = this.validateDeck(deck);
    if (!validation.valid) throw new Error(validation.error);

    const initializedDeck = deck.map(card => ({
      ...card,
      basePower: card.basePower ?? card.power,
      baseDamage: card.baseDamage ?? card.damage,
      baseIsrush: card.baseIsrush ?? card.isrush,
      baseCanAttack: card.baseCanAttack ?? card.canAttack,
      baseGodMark: card.baseGodMark ?? card.godMark,
      baseAcValue: card.baseAcValue ?? card.acValue,
      baseCanActivateEffect: card.baseCanActivateEffect ?? card.canActivateEffect ?? true
    }));

    const tempId = 'practice_' + Math.random().toString(36).substring(7);
    const myState: PlayerState = {
      uid: ({ uid: "temp", displayName: "temp" } as any).uid,
      displayName: ({ uid: "temp", displayName: "temp" } as any).displayName || 'Player 1',
      deck: this.assignGameCardIds(this.shuffle([...initializedDeck])),
      hand: [],
      grave: [],
      exile: [],
      itemZone: [],
      erosionFront: [],
      erosionBack: [],
      unitZone: Array(6).fill(null),
      playZone: [],
      isTurn: false,
      isFirst: false,
      mulliganDone: false,
      hasExhaustedThisTurn: [],
      isHandPublic: 0,
    };

    const botState: PlayerState = {
      uid: 'BOT_PLAYER',
      displayName: '神蚀 AI',
      deck: this.assignGameCardIds(this.shuffle([...initializedDeck])), // Bot uses same deck as player
      hand: [],
      grave: [],
      exile: [],
      itemZone: [],
      erosionFront: [],
      erosionBack: [],
      unitZone: Array(6).fill(null),
      playZone: [],
      isTurn: false,
      isFirst: false,
      mulliganDone: true, // Bot skips mulligan
      hasExhaustedThisTurn: [],
      isHandPublic: 0,
    };

    // Initial Draw 4 for both
    for (let i = 0; i < 4; i++) {
      const card1 = myState.deck.pop();
      if (card1) myState.hand.push(card1);
      const card2 = botState.deck.pop();
      if (card2) botState.hand.push(card2);
    }

    // Random first player
    const uids = [({ uid: "temp", displayName: "temp" } as any).uid, 'BOT_PLAYER'];
    const firstIdx = Math.floor(Math.random() * uids.length) as 0 | 1;
    const firstPlayerUid = uids[firstIdx];

    myState.isFirst = firstPlayerUid === myState.uid;
    botState.isFirst = firstPlayerUid === botState.uid;

    const gameState: GameState = {
      gameId: "temp", phase: 'MULLIGAN',
      currentTurnPlayer: firstIdx,
      turnCount: 0,
      isCountering: 0,
      counterStack: [],
      passCount: 0,
      playerIds: [uids[0], uids[1]],
      gameStatus: 1,
      logs: ['练习赛开始。请进行调度 (Mulligan)。'],
      players: {
        [({ uid: "temp", displayName: "temp" } as any).uid]: myState,
        'BOT_PLAYER': botState
      },
      phaseTimerStart: Date.now()
    };
    return gameState;
  },

  async performMulligan(gameState: GameState, cardIdsToReturn: string[], uid: string) {
    const player = gameState.players[uid];
    if (!player || player.mulliganDone) return;

    if (cardIdsToReturn.length > 0) {
      // Return cards to deck
      const cardsToReturn: Card[] = [];
      for (const gamecardId of cardIdsToReturn) {
        const index = player.hand.findIndex(c => c.gamecardId === gamecardId);
        if (index !== -1) {
          cardsToReturn.push(player.hand.splice(index, 1)[0]);
        }
      }
      player.deck = [...player.deck, ...cardsToReturn];

      // Shuffle
      player.deck = this.shuffle(player.deck);

      // Draw same number
      for (let i = 0; i < cardIdsToReturn.length; i++) {
        const card = player.deck.pop();
        if (card) {
          card.cardlocation = 'HAND';
          player.hand.push(card);
        }
      }

      gameState.logs.push(`${player.displayName} 进行了调度，更换了 ${cardIdsToReturn.length} 张卡牌。`);
    } else {
      gameState.logs.push(`${player.displayName} 接受了初始手牌。`);
    }

    player.mulliganDone = true;

    // Check if both players are done
    const allDone = Object.values(gameState.players).every(p => p.mulliganDone);
    if (allDone) {
      gameState.phase = 'START';
      gameState.turnCount = 1;
      // Find the first player
      const firstPlayerIdx = gameState.players[gameState.playerIds[0]].isFirst ? 0 : 1;
      gameState.currentTurnPlayer = firstPlayerIdx as 0 | 1;

      const firstPlayerUid = gameState.playerIds[gameState.currentTurnPlayer];
      gameState.players[firstPlayerUid].isTurn = true;
      gameState.logs.push(`调度结束。第 1 回合开始，由 ${gameState.players[firstPlayerUid].displayName} 先行。`);

      const firstPlayer = gameState.players[firstPlayerUid];
      this.executeStartPhase(gameState, firstPlayer);
    }
  },

  async endTurn(gameState: GameState) {
    return this.advancePhase(gameState, 'DECLARE_END');
  },

  // Bot logic
  async botMove(gameState: GameState) {
    const bot = gameState.players['BOT_PLAYER'];
    if (!bot) return;

    // Handle Countering (Bot chooses to pass priority)
    if (gameState.phase === 'COUNTERING') {
      if (gameState.priorityPlayerId === 'BOT_PLAYER') {
        console.log('[Bot] Passing confrontation priority');
        await this.passConfrontation(gameState, 'BOT_PLAYER');
      }
      return;
    }

    // Handle Defense Declaration (Bot chooses not to defend)
    if (gameState.phase === 'DEFENSE_DECLARATION') {
      const attackerUid = Object.keys(gameState.players).find(uid => gameState.players[uid].isTurn);
      if (attackerUid !== 'BOT_PLAYER') {
        // Bot is the defender - skip defense
        await this.declareDefense(gameState, 'BOT_PLAYER', undefined);
        return;
      }
    }

    // Handle Discard Phase
    if (gameState.phase === 'DISCARD' && bot.isTurn) {
      if (bot.hand.length > 6) {
        await this.discardCard(gameState, 'BOT_PLAYER', bot.hand[0].gamecardId);
      }
      return;
    }

    // Battle Free Phase response (as Opponent)
    if (gameState.phase === 'BATTLE_FREE' && !bot.isTurn) {
      if (gameState.battleState && gameState.battleState.askConfront === 'ASKING_OPPONENT') {
        console.log('[Bot] Declining confrontation in BATTLE_FREE as Opponent');
        await this.advancePhase(gameState, 'DECLINE_CONFRONTATION', 'BOT_PLAYER');
        return;
      }
    }

    if (!bot.isTurn) return;

    // Handle Erosion Phase
    if (gameState.phase === 'EROSION') {
      await this.handleErosionChoice(gameState, 'BOT_PLAYER', 'A');
      return;
    }

    // Main Phase Logic
    if (gameState.phase === 'MAIN') {
      // Sequentially play all possible cards from hand
      for (const card of bot.hand) {
        const canPlay = this.canPlayCard(bot, card);
        if (canPlay.canPlay) {
          try {
            await this.playCard(gameState, 'BOT_PLAYER', card.gamecardId, {});
            // We return and let the next botMove tick handle the next card to ensure stack resolution
            return;
          } catch (e) {
            // console.error('Bot failed to play card', e);
          }
        }
      }

      // If no cards can be played, try to enter battle or end turn
      const canAttack = bot.unitZone.some(c => {
        if (!c || c.isExhausted) return false;
        const isRush = !!c.isrush;
        const wasPlayedThisTurn = c.playedTurn === gameState.turnCount;
        return isRush || !wasPlayedThisTurn;
      });

      if (gameState.turnCount > 1 && canAttack) {
        // Enter battle phase only if we haven't already exhausted all attackers this AI iteration
        // To prevent infinite re-entry to BATTLE_DECLARATION from MAIN, we check if there's truly something new to do
        console.log('[Bot] Entering Battle Phase');
        await this.advancePhase(gameState, 'DECLARE_BATTLE');
      } else {
        console.log('[Bot] Ending Turn');
        await this.advancePhase(gameState, 'DECLARE_END');
      }
      return;
    }

    // Battle Declaration Phase
    if (gameState.phase === 'BATTLE_DECLARATION' && bot.isTurn) {
      const attacker = bot.unitZone.find(c => {
        if (!c || c.isExhausted) return false;
        const isRush = !!c.isrush;
        const wasPlayedThisTurn = c.playedTurn === gameState.turnCount;
        return isRush || !wasPlayedThisTurn;
      });
      if (attacker) {
        await this.declareAttack(gameState, 'BOT_PLAYER', [attacker.gamecardId], false);
      } else {
        await this.advancePhase(gameState, 'RETURN_MAIN');
      }
      return;
    }

    // Battle Free Phase (as Turn Player)
    if (gameState.phase === 'BATTLE_FREE' && bot.isTurn) {
      if (!gameState.battleState?.askConfront) {
        // Bot proposes calculation to give player a chance to counter
        console.log('[Bot] Proposing damage calculation in BATTLE_FREE');
        await this.advancePhase(gameState, 'PROPOSE_DAMAGE_CALCULATION');
      } else if (gameState.battleState.askConfront === 'ASKING_TURN_PLAYER') {
        // Player declined, bot now asked if it wants to counter? 
        // Bot usually just declines to get to resolution.
        console.log('[Bot] Declining confrontation in BATTLE_FREE (ASKING_TURN_PLAYER)');
        await this.advancePhase(gameState, 'DECLINE_CONFRONTATION');
      }
      return;
    }

    // Damage Calculation Phase
    if (gameState.phase === 'DAMAGE_CALCULATION') {
      await this.resolveDamage(gameState);
      return;
    }
  },

  // Helper: Assign unique gamecardId to all cards in a deck
  assignGameCardIds(deck: Card[]): Card[] {
    return deck.map((card, index) => ({
      ...card,
      gamecardId: `${card.id}_${index}_${Math.random().toString(36).substring(2, 7)}`
    }));
  },

  // Helper: Shuffle deck
  shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  async createPracticeGameState(deck: Card[], playerUid: string, playerName: string): Promise<GameState> {
    const initializedDeck = deck.map(card => ({
      ...card,
      basePower: card.basePower ?? card.power,
      baseDamage: card.baseDamage ?? card.damage,
      baseIsrush: card.baseIsrush ?? card.isrush,
      baseCanAttack: card.baseCanAttack ?? card.canAttack,
      baseGodMark: card.baseGodMark ?? card.godMark,
      baseAcValue: card.baseAcValue ?? card.acValue,
      baseCanActivateEffect: card.baseCanActivateEffect ?? card.canActivateEffect ?? true,
      cardlocation: 'DECK',
      displayState: 'FRONT_FACEDOWN'
    }));

    const myState: PlayerState = {
      uid: playerUid,
      displayName: playerName,
      deck: this.assignGameCardIds(this.shuffle([...initializedDeck])),
      hand: [],
      grave: [],
      exile: [],
      itemZone: Array(6).fill(null),
      erosionFront: Array(10).fill(null),
      erosionBack: Array(10).fill(null),
      unitZone: Array(6).fill(null),
      playZone: [],
      isTurn: false,
      isFirst: false,
      mulliganDone: false,
      hasExhaustedThisTurn: [],
      isHandPublic: 0,
    };

    const botState: PlayerState = {
      uid: 'BOT_PLAYER',
      displayName: '神蚀 AI',
      deck: this.assignGameCardIds(this.shuffle([...initializedDeck])),
      hand: [],
      grave: [],
      exile: [],
      itemZone: Array(6).fill(null),
      erosionFront: Array(10).fill(null),
      erosionBack: Array(10).fill(null),
      unitZone: Array(6).fill(null),
      playZone: [],
      isTurn: false,
      isFirst: false,
      mulliganDone: true,
      hasExhaustedThisTurn: [],
      isHandPublic: 0,
    };

    // Draw 4
    for (let i = 0; i < 4; i++) {
      const c1 = myState.deck.pop(); if (c1) { c1.cardlocation = 'HAND'; myState.hand.push(c1); }
      const c2 = botState.deck.pop(); if (c2) { c2.cardlocation = 'HAND'; botState.hand.push(c2); }
    }

    const firstIdx = Math.floor(Math.random() * 2) as 0 | 1;
    myState.isFirst = firstIdx === 0;
    botState.isFirst = firstIdx === 1;

    const gameState: GameState = {
      gameId: "temp",
      phase: 'MULLIGAN',
      currentTurnPlayer: firstIdx,
      turnCount: 0,
      isCountering: 0,
      counterStack: [],
      passCount: 0,
      playerIds: [playerUid, 'BOT_PLAYER'],
      gameStatus: 1,
      logs: ['练习赛开始。由 AI 作为对手。'],
      players: {
        [playerUid]: myState,
        'BOT_PLAYER': botState
      },
      phaseTimerStart: Date.now(),
      mainPhaseTimeRemaining: GAME_TIMEOUTS.MAIN_PHASE_TOTAL
    };

    // Correctly set isTurn for the initial player
    const firstPlayerUid = gameState.playerIds[firstIdx];
    gameState.players[firstPlayerUid].isTurn = true;

    return gameState;
  },

  async createMatchGameState(uid1: string, deck1: Card[], uid2: string, deck2: Card[]): Promise<GameState> {
    const init1 = this.assignGameCardIds(this.shuffle(deck1.map(c => ({ ...c, cardlocation: 'DECK', displayState: 'FRONT_FACEDOWN' }))));
    const init2 = this.assignGameCardIds(this.shuffle(deck2.map(c => ({ ...c, cardlocation: 'DECK', displayState: 'FRONT_FACEDOWN' }))));

    const p1: PlayerState = {
      uid: uid1, displayName: 'Player 1', deck: init1, hand: [], grave: [], exile: [], itemZone: Array(6).fill(null), erosionFront: Array(10).fill(null), erosionBack: Array(10).fill(null), unitZone: Array(6).fill(null), playZone: [],
      isTurn: false, isFirst: false, mulliganDone: false, hasExhaustedThisTurn: [],
      isHandPublic: 0,
    };
    const p2: PlayerState = {
      uid: uid2, displayName: 'Player 2', deck: init2, hand: [], grave: [], exile: [], itemZone: Array(6).fill(null), erosionFront: Array(10).fill(null), erosionBack: Array(10).fill(null), unitZone: Array(6).fill(null), playZone: [],
      isTurn: false, isFirst: false, mulliganDone: false, hasExhaustedThisTurn: [],
      isHandPublic: 0,
    };

    for (let i = 0; i < 4; i++) {
      const c1 = p1.deck.pop(); if (c1) { c1.cardlocation = 'HAND'; p1.hand.push(c1); }
      const c2 = p2.deck.pop(); if (c2) { c2.cardlocation = 'HAND'; p2.hand.push(c2); }
    }

    const firstIdx = Math.floor(Math.random() * 2) as 0 | 1;
    p1.isFirst = firstIdx === 0;
    p2.isFirst = firstIdx === 1;

    const gameState: GameState = {
      gameId: "match", phase: 'MULLIGAN', currentTurnPlayer: firstIdx, turnCount: 0, isCountering: 0, counterStack: [],
      passCount: 0,
      playerIds: [uid1, uid2], gameStatus: 1, logs: ['匹配成功。对局开始'],
      players: { [uid1]: p1, [uid2]: p2 },
      phaseTimerStart: Date.now(),
      mainPhaseTimeRemaining: GAME_TIMEOUTS.MAIN_PHASE_TOTAL
    };

    // Correctly set isTurn for the initial player
    const firstPlayerUid = gameState.playerIds[firstIdx];
    gameState.players[firstPlayerUid].isTurn = true;

    return gameState;
  }
};
