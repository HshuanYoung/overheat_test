import { GameState, PlayerState, Card, Deck, TriggerLocation, CardEffect, StackItem, GamePhase, GAME_TIMEOUTS, GameEvent } from '../src/types/game';
import { CARD_LIBRARY } from '../src/data/cards';
import { EventEngine } from '../src/services/EventEngine';
import { AtomicEffectExecutor } from '../src/services/AtomicEffectExecutor';
import { getCardIdentity } from '../src/lib/utils';
import { SERVER_CARD_LIBRARY } from './card_loader';
import { GameService } from '../src/services/gameService';

export const ServerGameService = {
  isFullEffectSilencedThisTurn(gameState: GameState, card: Card) {
    return (card as any).data?.fullEffectSilencedTurn === gameState.turnCount;
  },

  getEffectivePlayCost(player: PlayerState, card: Card) {
    const baseCost = card.baseAcValue ?? card.acValue ?? 0;
    if (card.id === '101140062') {
      const unitCount = player.unitZone.filter(c => c !== null).length;
      return Math.max(0, baseCost - unitCount);
    }
    if (card.id === '202050034' && player.isGoddessMode) {
      return 0;
    }
    if (card.id === '105000117') {
      const hasUnits = player.unitZone.some(c => c !== null);
      const hasFaceUpErosion = player.erosionFront.some(c => c !== null && c.displayState === 'FRONT_UPRIGHT');
      if (!hasUnits && !hasFaceUpErosion) return 0;
    }
    if (card.id === '205110063') {
      const itemCount = player.itemZone.filter(c => c !== null).length;
      return Math.max(0, baseCost - itemCount);
    }
    return baseCost;
  },

  hasGlobalDisableAllActivated(gameState: GameState) {
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
  },

  effectHasErosionRequirement(effect: CardEffect) {
    return !!effect.erosionFrontLimit ||
      !!effect.erosionBackLimit ||
      !!effect.erosionTotalLimit;
  },

  isTenPlusEffect(effect: CardEffect) {
    return !!effect.erosionTotalLimit && effect.erosionTotalLimit[0] >= 10;
  },

  isGoddessTierEffect(effect: CardEffect) {
    if (ServerGameService.isTenPlusEffect(effect)) return true;

    const triggerEvents = Array.isArray(effect.triggerEvent)
      ? effect.triggerEvent
      : effect.triggerEvent
        ? [effect.triggerEvent]
        : [];

    return triggerEvents.includes('GODDESS_TRANSFORMATION');
  },

  effectHasSubGoddessErosionRequirement(effect: CardEffect) {
    return ServerGameService.effectHasErosionRequirement(effect) &&
      !ServerGameService.isGoddessTierEffect(effect);
  },

  hasGlobalDisableErosionRequirementEffects(gameState: GameState) {
    return Object.values(gameState.players).some(player =>
      [...player.unitZone, ...player.itemZone, ...player.erosionFront]
        .filter((card): card is Card => !!card)
        .some(card =>
          card.effects?.some(effect =>
            effect.type === 'CONTINUOUS' &&
            effect.content === 'DISABLE_EROSION_REQUIREMENT_EFFECTS' &&
            (!effect.condition || effect.condition(gameState, player, card))
          )
        )
    );
  },

  getForcedAttackUnit(gameState: GameState, playerId: string) {
    const player = gameState.players[playerId];
    if (!player) return undefined;

    return player.unitZone.find((unit): unit is Card => {
      if (!unit) return false;
      const forcedAttackTurn = (unit as any).data?.forcedAttackTurn;
      if (forcedAttackTurn !== gameState.turnCount) return false;
      if (unit.isExhausted || unit.canAttack === false) return false;

      const isRush = !!unit.isrush;
      const wasPlayedThisTurn = unit.playedTurn === gameState.turnCount;
      return isRush || !wasPlayedThisTurn;
    });
  },

  canUse204000145AsPaymentSubstitute(paymentCard: Card | undefined, cardColor?: string, cost?: number, playingCardId?: string) {
    return !!paymentCard &&
      paymentCard.id === '204000145' &&
      paymentCard.gamecardId !== playingCardId &&
      cardColor === 'BLUE' &&
      !!cost &&
      cost > 0 &&
      cost <= 3;
  },

  canUse205000136AsPaymentSubstitute(paymentCard: Card | undefined, cardColor?: string, cost?: number, playingCardId?: string) {
    return !!paymentCard &&
      paymentCard.id === '205000136' &&
      paymentCard.gamecardId !== playingCardId &&
      cardColor === 'YELLOW' &&
      !!cost &&
      cost > 0 &&
      cost <= 3;
  },

  hydrateCard(card: Card | null) {
    if (!card || (!card.id && !card.uniqueId)) return;
    const masterCard = SERVER_CARD_LIBRARY[card.uniqueId] || SERVER_CARD_LIBRARY[card.id];
    if (!card.baseColorReq) {
      card.baseColorReq = { ...(masterCard?.colorReq || card.colorReq || {}) };
    }
    if (masterCard && masterCard.effects) {
      // Re-assign effects to restore functions lost during JSON serialization
      card.effects = masterCard.effects.map((originalEffect, idx) => {
        const runtimeEffect = card.effects ? card.effects[idx] : null;
        return {
          ...(runtimeEffect || originalEffect),
          condition: originalEffect.condition,
          execute: originalEffect.execute,
          cost: originalEffect.cost,
          onQueryResolve: originalEffect.onQueryResolve,
          resolve: originalEffect.resolve,
          applyContinuous: originalEffect.applyContinuous,
          removeContinuous: originalEffect.removeContinuous
        };
      });
    }
  },

  hydrateGameState(gameState: GameState) {
    if (!gameState || !gameState.players) return;
    Object.values(gameState.players).forEach(player => {
      player.hand.forEach(card => {
        if (card) {
          card.cardlocation = 'HAND';
          ServerGameService.hydrateCard(card);
        }
      });
      player.deck.forEach(card => {
        if (card) {
          card.cardlocation = 'DECK';
          ServerGameService.hydrateCard(card);
        }
      });
      player.grave.forEach(card => {
        if (card) {
          card.cardlocation = 'GRAVE';
          ServerGameService.hydrateCard(card);
        }
      });
      player.exile.forEach(card => {
        if (card) {
          card.cardlocation = 'EXILE';
          ServerGameService.hydrateCard(card);
        }
      });
      player.unitZone.forEach(card => {
        if (card) {
          card.cardlocation = 'UNIT';
          ServerGameService.hydrateCard(card);
        }
      });
      player.itemZone.forEach(card => {
        if (card) {
          card.cardlocation = 'ITEM';
          ServerGameService.hydrateCard(card);
        }
      });
      player.erosionFront.forEach(card => {
        if (card) {
          card.cardlocation = 'EROSION_FRONT';
          ServerGameService.hydrateCard(card);
        }
      });
      player.erosionBack.forEach(card => {
        if (card) {
          card.cardlocation = 'EROSION_BACK';
          ServerGameService.hydrateCard(card);
        }
      });
      player.playZone.forEach(card => {
        if (card) {
          card.cardlocation = 'PLAY';
          ServerGameService.hydrateCard(card);
        }
      });
    }
    );
    // Also hydrate cards in the counter stack
    if (gameState.counterStack) {
      gameState.counterStack.forEach(item => {
        if (item.card) ServerGameService.hydrateCard(item.card);
      });
    }

    // New: Hydrate cards and effects in pending resolutions
    if (gameState.pendingResolutions) {
      gameState.pendingResolutions = gameState.pendingResolutions.map(record => {
        if (!record || !record.card) return record;

        ServerGameService.hydrateCard(record.card);

        // Find the matching effect in the library and restore it entirely
        if (record.card.effects) {
          const masterEffect = record.card.effects[record.effectIndex];
          if (masterEffect) {
            // Merge all properties from the library to restore functions and metadata
            record.effect = { ...record.effect, ...masterEffect };
          }
        }
        return record;
      });
    }

    // New: After restoring all functions, recalculate all continuous effects to ensure stats are correct
    EventEngine.recalculateContinuousEffects(gameState);
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

  has102050091ExhaustedAttack(card: Card | undefined) {
    return !!card && !!(card as any).data?.canAttackExhausted;
  },

  get102050091BattleSaveCandidate(gameState: GameState, playerId: string): Card | undefined {
    const player = gameState.players[playerId];
    if (!player) return undefined;

    const redUnitCount = player.unitZone.filter(unit => unit && unit.color === 'RED').length;
    if (redUnitCount < 2) return undefined;
    if (!player.unitZone.some(unit => unit === null)) return undefined;
    if (player.unitZone.some(unit => unit?.specialName === '迪凯')) return undefined;

    const totalErosion = player.erosionFront.filter(card => card !== null).length + player.erosionBack.filter(card => card !== null).length;
    const readyUnitCount = player.unitZone.filter(unit => unit && !unit.isExhausted).length;
    const deckPaymentCapacity = Math.max(0, 9 - totalErosion);
    if (readyUnitCount + Math.min(player.deck.length, deckPaymentCapacity) < 3) return undefined;

    return player.hand.find(card =>
      card.id === '102050091' &&
      card.effects?.some(effect => effect.id === '102050091_battle_save')
    );
  },

  normalizeForcedGuardBattleState(gameState: GameState) {
    const forcedGuardTargetId = gameState.battleState?.forcedGuardTargetId;
    if (!forcedGuardTargetId || !gameState.battleState) return;

    const defenderPlayerId = gameState.playerIds[gameState.currentTurnPlayer === 0 ? 1 : 0];
    const defenderPlayer = gameState.players[defenderPlayerId];
    const target = defenderPlayer?.unitZone.find(unit => unit?.gamecardId === forcedGuardTargetId);

    if (!target) {
      delete gameState.battleState.forcedGuardTargetId;
      return;
    }

    target.isExhausted = true;
    gameState.battleState.unitTargetId = target.gamecardId;
    gameState.battleState.defender = target.gamecardId;
    gameState.battleState.defenseLockedToTargetId = target.gamecardId;

    if (gameState.phase === 'DEFENSE_DECLARATION') {
      gameState.phase = 'BATTLE_FREE';
      gameState.phaseTimerStart = Date.now();
    }

    if (!gameState.battleState.forcedGuardLogged) {
      gameState.logs.push(`[系统] 强制护卫生效，跳过防御宣告并与 [${target.fullName}] 进行战斗。`);
      gameState.battleState.forcedGuardLogged = true;
    }
  },

  async tryApplyMinotaurShieldGuardOnAttackDeclaration(gameState: GameState, onUpdate?: (state: GameState) => Promise<void>) {
    if (!gameState.battleState) return false;

    const defenderPlayerId = gameState.playerIds[gameState.currentTurnPlayer === 0 ? 1 : 0];
    const defenderPlayer = gameState.players[defenderPlayerId];
    if (!defenderPlayer) return false;

    const hasGuildGodmarkUnit = defenderPlayer.unitZone.some(unit =>
      unit &&
      unit.godMark &&
      unit.faction === '九尾商会联盟'
    );
    if (!hasGuildGodmarkUnit) return false;

    const candidates = defenderPlayer.unitZone.filter((unit): unit is Card =>
      !!unit &&
      unit.id === '104020246' &&
      !unit.isExhausted
    );

    if (candidates.length !== 1) return false;

    const target = candidates[0];
    target.isExhausted = true;
    gameState.battleState.unitTargetId = target.gamecardId;
    gameState.battleState.defender = target.gamecardId;
    gameState.battleState.defenseLockedToTargetId = target.gamecardId;
    gameState.battleState.forcedGuardTargetId = target.gamecardId;
    gameState.battleState.forcedGuardLogged = false;
    gameState.logs.push(`[${target.fullName}] 强制本次攻击与 [${target.fullName}] 进行战斗，跳过防御宣告。`);
    gameState.currentProcessingItem = {
      type: 'EFFECT',
      card: target,
      ownerUid: defenderPlayerId,
      effectIndex: 1,
      timestamp: Date.now()
    };
    if (onUpdate) await onUpdate(gameState);
    await new Promise(resolve => setTimeout(resolve, 1500));
    gameState.currentProcessingItem = null;
    if (onUpdate) await onUpdate(gameState);
    EventEngine.recalculateContinuousEffects(gameState);
    return true;
  },

  refreshCardAsNewInstance(card: Card) {
    const masterCard = SERVER_CARD_LIBRARY[card.uniqueId] || SERVER_CARD_LIBRARY[card.id];
    const newGamecardId = Math.random().toString(36).substring(2, 10);
    card.gamecardId = newGamecardId;
    card.runtimeFingerprint = `FP_${newGamecardId}_${Date.now()}`;
    delete (card as any).data;
    delete (card as any).__playSnapshot;
    card.equipTargetId = undefined;
    card.isExhausted = false;
    card.displayState = 'FRONT_UPRIGHT';
    card.canResetCount = 0;
    card.hasAttackedThisTurn = false;
    card.usedShenyiThisTurn = false;
    card.playedTurn = undefined;
    card.silencedEffectIds = [];
    card.temporaryPowerBuff = 0;
    card.temporaryDamageBuff = 0;
    card.temporaryRush = false;
    card.temporaryAnnihilation = false;
    card.temporaryHeroic = false;
    card.temporaryCanAttackAny = false;
    card.temporaryBuffSources = {};
    card.temporaryBuffDetails = {};
    card.influencingEffects = [];
    if (masterCard) {
      card.basePower = masterCard.basePower ?? masterCard.power;
      card.baseDamage = masterCard.baseDamage ?? masterCard.damage;
      card.baseAcValue = masterCard.baseAcValue ?? masterCard.acValue;
      card.baseIsrush = masterCard.baseIsrush ?? masterCard.isrush;
      card.baseCanAttack = masterCard.baseCanAttack ?? masterCard.canAttack;
      card.baseGodMark = masterCard.baseGodMark ?? masterCard.godMark;
      card.baseCanActivateEffect = masterCard.baseCanActivateEffect ?? masterCard.canActivateEffect ?? true;
    }
    if (card.basePower !== undefined) card.power = card.basePower;
    if (card.baseDamage !== undefined) card.damage = card.baseDamage;
    if (card.baseAcValue !== undefined) card.acValue = card.baseAcValue;
    card.isrush = card.baseIsrush ?? false;
    card.canAttack = card.baseCanAttack ?? true;
    card.godMark = card.baseGodMark ?? card.godMark;
    if (card.baseCanActivateEffect !== undefined) {
      card.canActivateEffect = card.baseCanActivateEffect;
    } else {
      card.canActivateEffect = true;
    }
  },

  checkEffectLimitsAndReqs(gameState: GameState, playerUid: string, card: Card, effect: CardEffect, triggerLocation?: TriggerLocation, event?: GameEvent): { valid: boolean; reason?: string } {
    const player = gameState.players[playerUid];
    const cardData = (card as any).data || {};
    const pseudoGoddessActive = cardData.pseudoGoddessTenPlusTurn === gameState.turnCount;
    const activatedEffectsDisabled = cardData.pseudoGoddessDisableActivatedTurn === gameState.turnCount;
    const globalDisableAllActivated = ServerGameService.hasGlobalDisableAllActivated(gameState);
    const globalDisableErosionRequirementEffects = ServerGameService.hasGlobalDisableErosionRequirementEffects(gameState);
    const effectivePlayer = pseudoGoddessActive ? { ...player, isGoddessMode: true } : player;
    if (!player) return { valid: false, reason: '未找到玩家信息' };

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
      const ignoresTenPlusLimit = pseudoGoddessActive && effect.erosionTotalLimit[0] >= 10;
      if (!ignoresTenPlusLimit && (totalCount < effect.erosionTotalLimit[0] || totalCount > effect.erosionTotalLimit[1])) {
        return { valid: false, reason: '侵蚀区卡牌总数不满足条件' };
      }
    }

    if (ServerGameService.isFullEffectSilencedThisTurn(gameState, card)) {
      return { valid: false, reason: '该卡牌本回合失去所有效果' };
    }

    // 4. Condition Check
    if (effect.condition) {
      if (!effect.condition(gameState, effectivePlayer as PlayerState, card, event)) {
        return { valid: false, reason: '不满足发动条件' };
      }
    }

    if (player.negatedNames && player.negatedNames.includes(card.fullName)) {
      return { valid: false, reason: '该卡牌本回合已被禁止发动' };
    }

    // 6. Effect Negation Check
    if (card.canActivateEffect === false) {
      return { valid: false, reason: '该卡牌已被无效，无法发动效果' };
    }
    if (card.silencedEffectIds && card.silencedEffectIds.includes(effect.id)) {
      return { valid: false, reason: '该效果已被封印' };
    }
    if (activatedEffectsDisabled && (effect.type === 'ACTIVATE' || effect.type === 'ACTIVATED')) {
      return { valid: false, reason: '该卡本回合失去所有【启】能力' };
    }
    if (globalDisableAllActivated && (effect.type === 'ACTIVATE' || effect.type === 'ACTIVATED')) {
      return { valid: false, reason: '当前有持续效果使所有卡失去【启】能力' };
    }
    if (globalDisableErosionRequirementEffects && ServerGameService.effectHasSubGoddessErosionRequirement(effect)) {
      return { valid: false, reason: '当前有持续效果使所有女神化以下的侵蚀区数量要求能力失效' };
    }

    // 7. Faction-lock Check
    if (player.factionLock && card.faction !== player.factionLock) {
      return { valid: false, reason: '已锁定阵营，无法发动该卡牌效果' };
    }

    return { valid: true };
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
    options?: {
      targetIndex?: number;
      faceDown?: boolean;
      insertAtBottom?: boolean;
      isEffect?: boolean;
      effectSourcePlayerUid?: string;
      effectSourceCardId?: string;
    }
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
      EventEngine.handleCardLeftZone(gameState, sourcePlayerId, card, sourceZone, options?.isEffect, targetZone, {
        effectSourcePlayerUid: options?.effectSourcePlayerUid,
        effectSourceCardId: options?.effectSourceCardId
      });
    }

    if (!card) return false;

    if (!(card as any).data) {
      (card as any).data = {};
    }
    (card as any).data.lastMovedFromZone = sourceZone;
    (card as any).data.lastMovedToZone = targetZone;
    if (options?.isEffect) {
      (card as any).data.lastMovedByEffectTurn = gameState.turnCount;
      (card as any).data.lastMoveEffectSourceCardId = options.effectSourceCardId;
    }

    if ((targetZone === 'HAND' || targetZone === 'DECK') && sourceZone !== 'HAND' && sourceZone !== 'DECK') {
      ServerGameService.refreshCardAsNewInstance(card);
    }

    // Movement Replacement logic (e.g. 104010484)
    if (options?.isEffect && (targetZone === 'HAND' || targetZone === 'DECK' || targetZone === 'EROSION_FRONT' || targetZone === 'EROSION_BACK')) {
      if (card.effects) {
        for (const effect of card.effects) {
          if (effect.type === 'CONTINUOUS' && effect.movementReplacementDestination) {
            if (!effect.condition || effect.condition(gameState, targetPlayer, card)) {
              gameState.logs.push(`[替换效果] ${card.fullName} 的移动目的地从 ${targetZone} 被替换为 ${effect.movementReplacementDestination}`);
              targetZone = effect.movementReplacementDestination;
              break;
            }
          }
        }
      }
    }

    card.cardlocation = targetZone;
    if (options?.faceDown !== undefined) {
      card.displayState = options.faceDown ? 'FRONT_FACEDOWN' : 'FRONT_UPRIGHT';
    }
    if (targetZone === 'GRAVE') {
      card.displayState = 'FRONT_UPRIGHT';
      card.isExhausted = false;
    }

    if (targetZone === 'EROSION_FRONT' || targetZone === 'EROSION_BACK') {
      const currentErosion = targetPlayer.erosionFront.filter(c => c !== null).length + targetPlayer.erosionBack.filter(c => c !== null).length;
      if (currentErosion >= 10) {
        gameState.logs.push(`[侵蚀区已满] ${card.fullName} 因侵蚀区已达10张改为送入墓地。`);
        targetZone = 'GRAVE';
        card.cardlocation = 'GRAVE';
        card.displayState = 'FRONT_UPRIGHT';
        card.isExhausted = false;
      }
    }

    if (targetZone === 'UNIT' || targetZone === 'ITEM') {
      ServerGameService.readyCard(card);
      // Mark as played this turn to handle summon sickness/triggers correctly
      card.playedTurn = gameState.turnCount;
    }

    if (
      options?.isEffect &&
      sourceZone === 'DECK' &&
      targetZone === 'UNIT' &&
      options.effectSourceCardId
    ) {
      const sourceCard = ServerGameService.findCardById(gameState, options.effectSourceCardId);
      if (sourceCard?.fullName?.includes('炼金')) {
        (card as any).data.enteredFromDeckByAlchemyTurn = gameState.turnCount;
        (card as any).data.enteredFromDeckByAlchemySourceCardId = sourceCard.gamecardId;
      }
    }

    if (
      options?.isEffect &&
      targetZone === 'GRAVE' &&
      (sourceZone === 'UNIT' || sourceZone === 'ITEM')
    ) {
      (card as any).data.sentToGraveFromFieldByEffectTurn = gameState.turnCount;
      (card as any).data.sentToGraveFromFieldByEffectSourceCardId = options.effectSourceCardId;
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

    EventEngine.handleCardEnteredZone(gameState, targetPlayerId, card, targetZone, options?.isEffect, {
      sourceZone,
      targetZone,
      effectSourcePlayerUid: options?.effectSourcePlayerUid,
      effectSourceCardId: options?.effectSourceCardId
    });
    EventEngine.dispatchMovementSubEvents(gameState, {
      card,
      cardOwnerUid: sourcePlayerId,
      fromZone: sourceZone,
      toZone: targetZone,
      isEffect: options?.isEffect,
      effectSourcePlayerUid: options?.effectSourcePlayerUid,
      effectSourceCardId: options?.effectSourceCardId
    });

    if (targetZone === 'EROSION_BACK') {
      ServerGameService.checkWinConditions(gameState);
    }

    return true;
  },

  canPlayCard(gameState: GameState, player: PlayerState, card: Card): { canPlay: boolean; reason?: string } {
    if (player.negatedNames && player.negatedNames.includes(card.fullName)) {
      return { canPlay: false, reason: `该卡牌 [${card.fullName}] 在本回合已被禁止打出或发动` };
    }

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

    // 1.1 Godmark Limit Check (e.g. 1040101739)
    if (card.godMark) {
      // Check for limits on the field OR on the card itself
      const fieldEffects = player.unitZone
        .filter(u => u !== null)
        .flatMap(u => (u as Card).effects || []);

      const fieldLimitEffect = fieldEffects.find(e => e.type === 'CONTINUOUS' && e.limitGodmarkCount !== undefined);
      const selfLimitEffect = card.effects?.find(e => e.type === 'CONTINUOUS' && e.limitGodmarkCount !== undefined);

      const effectiveLimit = fieldLimitEffect?.limitGodmarkCount ?? selfLimitEffect?.limitGodmarkCount;

      if (effectiveLimit !== undefined) {
        const currentGodmarkCount = player.unitZone.filter(u => u && u.godMark).length;
        if (currentGodmarkCount >= effectiveLimit) {
          return { canPlay: false, reason: `场上神蚀单位数量达到上限 (${effectiveLimit})` };
        }
      }
    }

    // 3. Color Requirements
    const availableColors: Record<string, number> = { RED: 0, WHITE: 0, YELLOW: 0, BLUE: 0, GREEN: 0, NONE: 0 };
    let omniColorCount = 0;

    const checkOmni = (c: Card | null) => {
      if (!c) return false;
      // Use robust ID matching (string/number safe)
      const isTargetId = String(c.id) === '105000481';
      const hasOmniEffect = c.effects && c.effects.some(e => e.id === '105000481_omni');
      return isTargetId || hasOmniEffect;
    };

    // Count fixed colors from Unit Zone
    player.unitZone.forEach(c => {
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



    // 4. Cost Check (AC Value)
    const cost = ServerGameService.getEffectivePlayCost(player, card);
    if (cost < 0) {
      const absCost = Math.abs(cost);
      const faceUpFrontCount = player.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT').length;
      if (faceUpFrontCount < absCost) {
        return { canPlay: false, reason: `侵蚀区正面卡不足以支付费用 (需要 ${absCost} 张)` };
      }
    } else if (cost > 0) {
      let remainingCost = cost;
      const hasSpecialSubstitute = player.hand.some(c =>
        ServerGameService.canUse204000145AsPaymentSubstitute(c, card.color, cost, card.gamecardId) ||
        ServerGameService.canUse205000136AsPaymentSubstitute(c, card.color, cost, card.gamecardId)
      );
      if (hasSpecialSubstitute) {
        remainingCost = 0;
      }

      // I. Check for Feijing card in hand (of the same color)
      const hasFeijing = player.hand.some(c =>
        c.gamecardId !== card.gamecardId &&
        c.feijingMark &&
        c.color === card.color
      );
      if (remainingCost > 0 && hasFeijing) {
        remainingCost = Math.max(0, remainingCost - 3);
      }

      // II. Check for ready units on field
      const readyUnitsCount = player.unitZone.filter(c => c !== null && !c.isExhausted).length;
      remainingCost = Math.max(0, remainingCost - readyUnitsCount);

      // III. Check Erosion space limit (cannot reach 10 total)
      if (remainingCost > 0) {
        const totalErosionCount = player.erosionFront.filter(c => c !== null).length +
          player.erosionBack.filter(c => c !== null).length;
        const canUseWindProduction =
          (player as any).windProductionTurn === gameState.turnCount &&
          totalErosionCount + remainingCost === 10;
        if (!canUseWindProduction && totalErosionCount + remainingCost >= 10) {
          return { canPlay: false, reason: '侵蚀区空间不足 (总数不能超过 9 张)' };
        }
      }
    }

    // 5. Specific Effect Limits & Requirements (using comprehensive check)
    const playEffect = card.effects?.find(e => e.type === 'ACTIVATE' || e.type === 'TRIGGER' || e.type === 'ALWAYS');
    if (playEffect) {
      const isStory = card.type === 'STORY';
      const isAlways = playEffect.type === 'ALWAYS';
      const shouldValidate = isStory || isAlways;

      if (shouldValidate) {
        // Use the comprehensive engine check to validate limits, conditions, and erosion counts
        const validationLocation = card.type === 'STORY' ? 'PLAY' : (card.cardlocation as TriggerLocation);
        const result = ServerGameService.checkEffectLimitsAndReqs(gameState, player.uid, card, playEffect, validationLocation);
        if (!result.valid) {
          return { canPlay: false, reason: result.reason || '不满足发动条件' };
        }
      }
    }

    // 6. Faction-lock Check
    if (player.factionLock && card.faction !== player.factionLock) {
      return { canPlay: false, reason: `受到势力限制：只能打出 [${player.factionLock}] 势力的卡牌` };
    }

    return { canPlay: true };
  },

  playerHasAvailableConfrontationAction(gameState: GameState, playerId: string): boolean {
    const player = gameState.players[playerId];
    if (!player || gameState.phase !== 'COUNTERING' || gameState.priorityPlayerId !== playerId) return false;

    const hasPlayableStory = player.hand.some(card =>
      card.type === 'STORY' &&
      ServerGameService.canPlayCard(gameState, player, card).canPlay
    );
    if (hasPlayableStory) return true;

    const activationZones: { cards: (Card | null)[]; location: TriggerLocation }[] = [
      { cards: player.unitZone, location: 'UNIT' },
      { cards: player.itemZone, location: 'ITEM' },
      { cards: player.erosionFront, location: 'EROSION_FRONT' },
      { cards: player.grave, location: 'GRAVE' },
      { cards: player.hand, location: 'HAND' }
    ];

    return activationZones.some(({ cards, location }) =>
      cards.some(card => {
        if (!card) return false;
        if (card.type === 'STORY' && location === 'HAND') return false;

        return !!card.effects?.some(effect =>
          (effect.type === 'ACTIVATE' || effect.type === 'ACTIVATED') &&
          ServerGameService.checkEffectLimitsAndReqs(gameState, playerId, card, effect, location).valid
        );
      })
    );
  },

  async applyConfrontationStrategy(gameState: GameState, onUpdate?: (state: GameState) => Promise<void>) {
    if (
      gameState.phase !== 'COUNTERING' ||
      !gameState.priorityPlayerId ||
      gameState.pendingQuery ||
      gameState.isResolvingStack ||
      gameState.currentProcessingItem
    ) {
      return gameState;
    }

    const player = gameState.players[gameState.priorityPlayerId];
    if (!player) return gameState;

    const strategy = player.confrontationStrategy || 'AUTO';
    if (strategy === 'ON') return gameState;

    const hasAction = strategy === 'AUTO'
      ? ServerGameService.playerHasAvailableConfrontationAction(gameState, player.uid)
      : false;

    if (strategy === 'AUTO' && hasAction) return gameState;

    const strategyLabel = strategy === 'OFF' ? '全关' : '自动';
    const reason = strategy === 'OFF' ? '跳过所有对抗请求' : '没有可用的对抗动作';
    gameState.logs.push(`[对抗策略] ${player.displayName} 的策略为${strategyLabel}，${reason}，自动进入结算。`);

    await ServerGameService.resolveCounterStack(gameState, onUpdate);
    return gameState;
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
        ServerGameService.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', id);
      }
      return { success: true };
    }

    if (cost > 0) {
      let remainingCost = cost;
      let feijingCard: Card | undefined;
      let use204000145Replacement = false;
      let reservedDeckCard: Card | undefined;

      if (playingCardId) {
        const reservedIndex = player.deck.findIndex(c => c?.gamecardId === playingCardId);
        if (reservedIndex !== -1) {
          reservedDeckCard = player.deck.splice(reservedIndex, 1)[0];
        }
      }

      if (paymentSelection.feijingCardId) {
        if (paymentSelection.feijingCardId === playingCardId) {
          if (reservedDeckCard) player.deck.push(reservedDeckCard);
          return { success: false, reason: '不能使用正在打出的卡牌作为菲晶卡支付费用' };
        }
        feijingCard = player.hand.find(c =>
          c.gamecardId === paymentSelection.feijingCardId &&
          (c.feijingMark || c.id === '204000145' || c.id === '205000136')
        );
        if (feijingCard) {
          if (
            ServerGameService.canUse204000145AsPaymentSubstitute(feijingCard, cardColor, cost, playingCardId) ||
            ServerGameService.canUse205000136AsPaymentSubstitute(feijingCard, cardColor, cost, playingCardId)
          ) {
            remainingCost = 0;
            use204000145Replacement = true;
          } else if (cardColor && feijingCard.color !== cardColor) {
            if (reservedDeckCard) player.deck.push(reservedDeckCard);
            return { success: false, reason: '菲晶卡颜色与打出的卡牌颜色不匹配' };
          } else if (!feijingCard.feijingMark) {
            if (reservedDeckCard) player.deck.push(reservedDeckCard);
            return { success: false, reason: '选择的手牌不能用于代替支付该费用' };
          } else {
            remainingCost = Math.max(0, remainingCost - 3);
          }
        } else {
          if (reservedDeckCard) player.deck.push(reservedDeckCard);
          return { success: false, reason: '选择的手牌支付卡无效' };
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
      cardsToExhaust.forEach(c => ServerGameService.exhaustCard(c));

      if (remainingCost > 0) {
        const totalErosion = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
        if (
          (player as any).windProductionTurn === gameState.turnCount &&
          remainingCost === 10 - totalErosion
        ) {
          gameState.logs.push(`[${(player as any).windProductionSourceName || '风力生产'}] 允许本次ACCESS支付使侵蚀区刚好达到10张。`);
          delete (player as any).windProductionTurn;
          delete (player as any).windProductionSourceName;
        } else
        if (remainingCost >= 10 - totalErosion) {
          if (reservedDeckCard) player.deck.push(reservedDeckCard);
          return { success: false, reason: '侵蚀区空间不足以支付剩余费用 (不能达到 10 张)' };
        }
      }

      if (feijingCard) {
        let fromZone: TriggerLocation = 'UNIT';
        if (player.itemZone.some(c => c?.gamecardId === feijingCard!.gamecardId)) {
          fromZone = 'ITEM';
        } else if (player.erosionFront.some(c => c?.gamecardId === feijingCard!.gamecardId)) {
          fromZone = 'EROSION_FRONT';
        } else if (player.erosionBack.some(c => c?.gamecardId === feijingCard!.gamecardId)) {
          fromZone = 'EROSION_BACK';
        } else if (player.hand.some(c => c?.gamecardId === feijingCard!.gamecardId)) {
          fromZone = 'HAND';
        }
        ServerGameService.moveCard(gameState, playerId, fromZone, playerId, use204000145Replacement ? 'EXILE' : 'GRAVE', feijingCard.gamecardId);
      }
      for (let i = 0; i < remainingCost; i++) {
        // 2. The cards in the damaged deck do not have enough damage value
        if (player.deck.length === 0) {
          if (reservedDeckCard) player.deck.push(reservedDeckCard);
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
      if (reservedDeckCard) {
        player.deck.push(reservedDeckCard);
      }
      return { success: true };
    }

    return { success: false, reason: '未知错误' };
  },

  enterCountering(gameState: GameState, sourcePlayerId: string, stackItem: StackItem) {
    const now = Date.now();
    const elapsed = now - (gameState.phaseTimerStart || now);

    if (gameState.phase !== 'COUNTERING') {
      // If we are leaving a shared phase (MAIN, BATTLE_DECLARATION, BATTLE_FREE), subtract from turn budget
      const sharedPhases: GamePhase[] = ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'];
      if (sharedPhases.includes(gameState.phase)) {
        const actingPlayer = gameState.players[sourcePlayerId];
        if (actingPlayer) {
          actingPlayer.timeRemaining = Math.max(0, (actingPlayer.timeRemaining ?? GAME_TIMEOUTS.MAIN_PHASE_TOTAL) - elapsed);
        }
      }

      gameState.previousPhase = gameState.phase;
      gameState.phase = 'COUNTERING';
      gameState.phaseTimerStart = now; // Independent 15/30s starts now
    }

    gameState.isCountering = 1;
    gameState.counterStack.forEach(item => item.isInterrupted = true);
    gameState.counterStack.push(stackItem);

    // Combo Link Numbering (Link 1 is the trigger, Link 2 is the first response, etc.)
    const linkNumber = gameState.counterStack.length;
    const opponentId = gameState.playerIds.find(id => id !== sourcePlayerId);
    gameState.priorityPlayerId = opponentId;

    const actionDesc = stackItem.type === 'PHASE_END' ? '请求结束阶段' : (stackItem.card ? `发动 ${getCardIdentity(gameState, sourcePlayerId, stackItem.card)} ${stackItem.card.fullName}` : '执行动作');
    gameState.logs.push(`[连锁 Link ${linkNumber}] ${gameState.players[sourcePlayerId].displayName} ${actionDesc}。等待 ${gameState.players[opponentId!].displayName} 响应 (Link ${linkNumber + 1})。`);
  },

  async playCard(gameState: GameState, playerId: string, cardId: string, paymentSelection: { feijingCardId?: string, exhaustUnitIds?: string[], erosionFrontIds?: string[] }) {
    if (gameState.pendingQuery || gameState.isResolvingStack || gameState.currentProcessingItem) {
      throw new Error('当前有未结算步骤，请等待处理完毕。');
    }
    const player = gameState.players[playerId];
    let card = player.hand.find(c => c.gamecardId === cardId);
    let sourceZone: TriggerLocation = 'HAND';

    if (!card) {
      card = player.erosionFront.find(c => c?.gamecardId === cardId) as Card;
      if (card && card.allowPlayFromErosionFront) {
        sourceZone = 'EROSION_FRONT' as TriggerLocation;
      }
    }

    if (!card) throw new Error('Card not found in valid zones for playing');

    const canPlay = ServerGameService.canPlayCard(gameState, player, card);
    if (!canPlay.canPlay) throw new Error(canPlay.reason);

    const isCounteringTurn = gameState.phase === 'COUNTERING' && gameState.priorityPlayerId === playerId;
    const isMainTurn = player.isTurn && gameState.phase === 'MAIN';
    const isBattleFreeTurn = player.isTurn && gameState.phase === 'BATTLE_FREE' && card.type === 'STORY';
    if (!isMainTurn && !isBattleFreeTurn && !isCounteringTurn) {
      throw new Error('当前阶段不能从手牌主动打出该卡');
    }

    const forcedAttackUnit = ServerGameService.getForcedAttackUnit(gameState, playerId);
    if (gameState.phase === 'MAIN' && forcedAttackUnit) {
      throw new Error(`必须先用 [${forcedAttackUnit.fullName}] 宣告攻击`);
    }

    (card as any).__playSnapshot = {
      isGoddessMode: !!player.isGoddessMode,
      phase: gameState.phase
    };

    // RULE 2: During countering phase, only story cards can be played
    if (gameState.phase === 'COUNTERING' && card.type !== 'STORY') {
      throw new Error('对抗阶段只能打出故事卡');
    }

    const cost = ServerGameService.getEffectivePlayCost(player, card);
    const paymentResult = ServerGameService.payCost(gameState, playerId, cost, paymentSelection, card.color, cardId);
    if (!paymentResult.success) throw new Error(paymentResult.reason);

    ServerGameService.moveCard(gameState, playerId, sourceZone, playerId, 'PLAY', cardId);

    // Record faction used
    if (card.faction) {
      if (!player.factionsUsedThisTurn) player.factionsUsedThisTurn = [];
      if (!player.factionsUsedThisTurn.includes(card.faction)) {
        player.factionsUsedThisTurn.push(card.faction);
      }
    }

    const identity = getCardIdentity(gameState, playerId, card);
    gameState.logs.push(`${player.displayName} 打出了 ${identity} ${card.fullName}`);

    EventEngine.dispatchEvent(gameState, {
      type: 'CARD_PLAYED',
      sourceCard: card,
      playerUid: playerId,
      sourceCardId: card.gamecardId
    });

    ServerGameService.enterCountering(gameState, playerId, {
      card,
      ownerUid: playerId,
      type: 'PLAY',
      timestamp: Date.now()
    });

    return gameState;
  },

  async activateEffect(gameState: GameState, playerId: string, cardId: string, effectIndex: number) {
    if (gameState.pendingQuery || gameState.isResolvingStack || gameState.currentProcessingItem) {
      throw new Error('当前有未结算步骤，请等待处理完毕。');
    }
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
    if (!card) findInZones([player.grave], 'GRAVE');
    if (!card) {
      card = player.hand.find(c => c.gamecardId === cardId);
      if (card) location = 'HAND';
    }

    if (!card) throw new Error('Card not found');

    const effect = card.effects?.[effectIndex];
    if (!effect) throw new Error('Effect not found');
    const loc = location || (card.cardlocation as TriggerLocation);
    const result = ServerGameService.checkEffectLimitsAndReqs(gameState, playerId, card, effect, loc);
    if (!result.valid) {
      throw new Error(result.reason || '不满足发动条件或已达到使用次数限制');
    }

    // RULE: STORY cards in HAND must be PLAYED, not ACTIVATED
    // EXCEPT during countering phase if the effect is specifically a hand-trigger
    if (card.type === 'STORY' && location === 'HAND' && gameState.phase !== 'COUNTERING') {
      throw new Error('当前阶段手牌中的故事卡只能通过打出来发动');
    }

    const isCounteringTurn = gameState.phase === 'COUNTERING' && gameState.priorityPlayerId === playerId;
    const isOwnSharedPhase =
      player.isTurn &&
      ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'].includes(gameState.phase);
    if (!isOwnSharedPhase && !isCounteringTurn) {
      throw new Error('当前阶段不能自由发动该起动效果');
    }

    const forcedAttackUnit = ServerGameService.getForcedAttackUnit(gameState, playerId);
    if (gameState.phase === 'MAIN' && forcedAttackUnit) {
      throw new Error(`必须先用 [${forcedAttackUnit.fullName}] 宣告攻击`);
    }

    // RULE 2: During countering phase, only ACTIVATE/ACTIVATED effects can be used
    if (gameState.phase === 'COUNTERING' && effect.type !== 'ACTIVATE' && effect.type !== 'ACTIVATED') {
      throw new Error('对抗阶段只能发动主动效果');
    }

    // 3. Payment/Cost Check
    if (effect.cost) {
      const player = gameState.players[playerId];
      const costResult = await effect.cost(gameState, player, card);

      // If cost triggered a query, wait for it
      if (gameState.pendingQuery) {
        gameState.pendingQuery.callbackKey = 'ACTIVATE_COST_RESOLVE';
        gameState.pendingQuery.context = {
          ...gameState.pendingQuery.context,
          sourceCardId: card.gamecardId,
          effectIndex: effectIndex,
          activationPlayerUid: playerId
        };
        return gameState;
      }

      if (!costResult) {
        throw new Error('发动费用不足或无法支付费用');
      }
    }

    ServerGameService.finalizeEffectActivation(gameState, playerId, card, effect, effectIndex);
    return gameState;

    ServerGameService.recordEffectUsage(gameState, playerId, card, effect);

    // Record faction used
    if (card.faction) {
      if (!player.factionsUsedThisTurn) player.factionsUsedThisTurn = [];
      if (!player.factionsUsedThisTurn.includes(card.faction)) {
        player.factionsUsedThisTurn.push(card.faction);
      }
    }

    const identity = getCardIdentity(gameState, playerId, card);
    gameState.logs.push(`${player.displayName} 发动了 ${identity} ${card.fullName} 的效果: ${effect.description}`);

    ServerGameService.enterCountering(gameState, playerId, {
      card,
      ownerUid: playerId,
      type: 'EFFECT',
      effectIndex,
      timestamp: Date.now()
    });

    return gameState;
  },

  finalizeEffectActivation(gameState: GameState, playerId: string, card: Card, effect: CardEffect, effectIndex: number) {
    const player = gameState.players[playerId];

    ServerGameService.recordEffectUsage(gameState, playerId, card, effect);

    if (card.faction) {
      if (!player.factionsUsedThisTurn) player.factionsUsedThisTurn = [];
      if (!player.factionsUsedThisTurn.includes(card.faction)) {
        player.factionsUsedThisTurn.push(card.faction);
      }
    }

    const identity = getCardIdentity(gameState, playerId, card);
    gameState.logs.push(`${player.displayName} 发动了 ${identity} ${card.fullName} 的效果: ${effect.description}`);

    ServerGameService.enterCountering(gameState, playerId, {
      card,
      ownerUid: playerId,
      type: 'EFFECT',
      effectIndex,
      timestamp: Date.now()
    });
  },

  async passConfrontation(gameState: GameState, playerId: string, onUpdate?: (state: GameState) => Promise<void>) {
    if (gameState.phase !== 'COUNTERING') return;
    if (gameState.priorityPlayerId !== playerId) throw new Error('尚未轮到你进行响应');

    const player = gameState.players[playerId];
    const topItem = gameState.counterStack[gameState.counterStack.length - 1];

    if (topItem.type === 'PHASE_END') {
      gameState.logs.push(`${player.displayName} 接受了阶段结束请求 (Pass)。`);
    } else if (topItem.type === 'ATTACK') {
      gameState.logs.push(`${player.displayName} 接受了攻击宣言 (Pass)。`);
    } else {
      gameState.logs.push(`${player.displayName} 选择不进行对抗 (Pass)。`);
    }

    // RULE 4 & Note 1: Once either side no longer confronts, settlement begins.
    await ServerGameService.resolveCounterStack(gameState, onUpdate);

    return gameState;
  },

  async resolveCounterStack(gameState: GameState, onUpdate?: (state: GameState) => Promise<void>) {
    if (gameState.counterStack.length === 0) return;

    gameState.isResolvingStack = true;
    gameState.priorityPlayerId = undefined;
    const isPhaseEndOnly = gameState.counterStack.length === 1 && gameState.counterStack[0].type === 'PHASE_END' && !gameState.counterStack[0].isInterrupted;
    const phaseEndItem = isPhaseEndOnly ? gameState.counterStack[0] : null;

    if (isPhaseEndOnly) {
      gameState.counterStack.pop();
      gameState.isCountering = 0;
      gameState.isResolvingStack = false;
      gameState.priorityPlayerId = undefined;

      const nextPhase = phaseEndItem!.nextPhase;
      if (gameState.previousPhase) {
        gameState.phase = gameState.previousPhase;
        gameState.previousPhase = undefined;
      }

      if (onUpdate) await onUpdate(gameState);

      if (nextPhase) {
        return ServerGameService.advancePhase(gameState, nextPhase);
      }
      return gameState;
    }

    gameState.logs.push(`[连锁结算] 开始逆向结算 (LIFO)...`);
    if (onUpdate) await onUpdate(gameState);

    // Resolve the entire stack from top to bottom (LIFO)
    while (gameState.counterStack.length > 0) {
      const topItem = gameState.counterStack[gameState.counterStack.length - 1];

      // 1. Visual Highlight: Show which item is being processed
      gameState.currentProcessingItem = topItem;
      if (onUpdate) await onUpdate(gameState);

      // Wait for the front-end to display the effect
      await new Promise(resolve => setTimeout(resolve, 1500));

      const stackItem = gameState.counterStack.pop();
      if (!stackItem) continue;
      if (!stackItem) continue;

      // If we encounter a PHASE_END in a multi-item stack, it means the phase end was interrupted.
      // RULE 3: after confrontation is over, return to 'main' or 'battle_free'.
      if (stackItem.type === 'PHASE_END') {
        gameState.logs.push(`[连锁结算] Link ${gameState.counterStack.length + 1} (阶段请求) 被后续动作中断，取消该请求。`);
        continue;
      }

      const card = stackItem.card;
      const owner = gameState.players[stackItem.ownerUid];

      if (stackItem.isNegated) {
        gameState.logs.push(`[连锁结算] Link ${gameState.counterStack.length + 1} 已被无效，跳过效果执行。`);
        // We still need to cleanup the card if it was played to the field/play zone
        if (stackItem.type === 'PLAY' && card) {
          const isInPlayZone = owner.playZone.some(c => c && c.gamecardId === card.gamecardId);
          if (isInPlayZone) {
            ServerGameService.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'GRAVE', card.gamecardId);
          }
        }
        continue;
      }

      switch (stackItem.type) {
        case 'PLAY':
          if (!card) break;
          if (card.type === 'UNIT') {
            const playZoneCard = owner.playZone.find(c => c && c.gamecardId === card.gamecardId);
            if (playZoneCard) playZoneCard.playedTurn = gameState.turnCount;
            ServerGameService.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'UNIT', card.gamecardId);
          } else if (card.type === 'ITEM' || card.isEquip) {
            const playZoneCard = owner.playZone.find(c => c && c.gamecardId === card.gamecardId);
            if (playZoneCard) playZoneCard.playedTurn = gameState.turnCount;
            ServerGameService.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'ITEM', card.gamecardId);
          } else {
            // STORY card
            const effect = card.effects?.find(e => e.type === 'ALWAYS' || e.type === 'ACTIVATE' || e.type === 'ACTIVATED');
            if (effect) {
              // Enforce limits and requirements (effectively from HAND since it's a STORY card play)
              const result = ServerGameService.checkEffectLimitsAndReqs(gameState, stackItem.ownerUid, card, effect, 'PLAY');
              if (!result.valid) {
                gameState.logs.push(`[连锁结算] ${card.fullName} 的效果未满足条件: ${result.reason || '条件不足'}，结算失败。`);
              } else {
                ServerGameService.recordEffectUsage(gameState, stackItem.ownerUid, card, effect);
                if (effect.execute) {
                  await (effect.execute as any)(card, gameState, owner);
                  EventEngine.dispatchEvent(gameState, {
                    type: 'EFFECT_ACTIVATED',
                    playerUid: stackItem.ownerUid,
                    sourceCardId: card.gamecardId
                  });
                }
              }
            }
            ServerGameService.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'GRAVE', card.gamecardId);
          }
          const identity = getCardIdentity(gameState, stackItem.ownerUid, card);
          gameState.logs.push(`${identity} ${card.fullName} 结算完成`);
          break;

        case 'EFFECT':
          if (!card) break;
          const liveEffectCard = ServerGameService.findCardById(gameState, card.gamecardId) || card;
          if (liveEffectCard !== card) {
            stackItem.card = liveEffectCard;
            gameState.currentProcessingItem = stackItem;
          }
          const data = stackItem.data as any;
          if (data && data.afterSelectionEffects) {
            for (const atomic of data.afterSelectionEffects) {
              await AtomicEffectExecutor.execute(gameState, stackItem.ownerUid, atomic, liveEffectCard, undefined, data.selections);
            }
            gameState.logs.push(`[效果结算] 连锁中的选择效果已结算。`);
          } else {
            const effectIndex = stackItem.effectIndex ?? 0;
            const effect = liveEffectCard.effects?.[effectIndex];
            if (effect) {
              // Execute Atomic Effects if present
              if (effect.atomicEffects && effect.atomicEffects.length > 0) {
                for (const atomic of effect.atomicEffects) {
                  await AtomicEffectExecutor.execute(gameState, stackItem.ownerUid, atomic, liveEffectCard);
                }
              }

              // Execute legacy callback
              if (effect.execute) {
                await (effect.execute as any)(liveEffectCard, gameState, owner);
              }
              EventEngine.recalculateContinuousEffects(gameState);

              const identity = getCardIdentity(gameState, stackItem.ownerUid, liveEffectCard);
              gameState.logs.push(`[效果结算] ${identity} ${liveEffectCard.fullName} 的效果已结算。`);
              if (effect.resolve) {
                gameState.pendingResolutions.push({
                  card: liveEffectCard,
                  effect,
                  playerUid: stackItem.ownerUid
                });
              }
              EventEngine.dispatchEvent(gameState, {
                type: 'EFFECT_ACTIVATED',
                playerUid: stackItem.ownerUid,
                sourceCardId: liveEffectCard.gamecardId
              });
            }
          }
          break;

        case 'ATTACK':
          // Set battle state and transition to defense declaration
          // Merge with existing battleState to preserve unitTargetId and other metadata
          gameState.battleState = {
            ...gameState.battleState,
            attackers: stackItem.attackerIds || [],
            isAlliance: !!stackItem.isAlliance
          };
          gameState.phase = stackItem.skipDefense ? 'BATTLE_FREE' : 'DEFENSE_DECLARATION';
          gameState.logs.push(`[攻击宣言] 连锁结算完成，进入${stackItem.skipDefense ? '战斗自由' : '防御宣言'}阶段`);
          // Clear previous phase so we don't return to MAIN
          gameState.previousPhase = undefined;

          // Re-calculate effects to ensure 302050013's defensePowerRestriction is applied to the new battleState
          EventEngine.recalculateContinuousEffects(gameState);
          break;
      }

      // 2. Clear Highlight: Item has been processed and removed from stack
      gameState.currentProcessingItem = null;
      if (onUpdate) await onUpdate(gameState);

      // PAUSE RESOLUTION: If an effect triggered a user choice, stop here.
      // We will resume once handleQueryChoice is called and finished.
      if (gameState.pendingQuery) {
        gameState.logs.push(`[连锁结算] 暂停结算以等待玩家选择...`);
        gameState.currentProcessingItem = null; // Clear highlight while waiting
        return gameState;
      }

      // Small pause between multiple items
      if (gameState.counterStack.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    await ServerGameService.finishCounteringStack(gameState, onUpdate);
    return gameState;
  },

  async finishCounteringStack(gameState: GameState, onUpdate?: (state: GameState) => Promise<void>) {
    if (gameState.isResolvingStack || gameState.isCountering > 0) {
      // console.log(`[连锁结算] 所有项目结算完成，正在恢复游戏流程...`);
    }

    // CLEANUP: All items resolved
    gameState.isResolvingStack = false;
    gameState.isCountering = 0;
    gameState.priorityPlayerId = undefined;
    gameState.currentProcessingItem = null; // Ensure this is cleared
    gameState.phaseTimerStart = Date.now();

    // After resolving the stack, return to previous phase if it exists
    if (gameState.previousPhase) {
      gameState.phase = gameState.previousPhase;
      gameState.previousPhase = undefined;
    }

    await ServerGameService.checkTriggeredEffects(gameState, onUpdate);

    const interruptedBattlePhases: GamePhase[] = ['DEFENSE_DECLARATION', 'BATTLE_FREE'];
    const shouldReturnToMainAfterInterruptedBattle =
      gameState.phase === 'BATTLE_END' ||
      (interruptedBattlePhases.includes(gameState.phase) && !gameState.battleState);

    if (
      shouldReturnToMainAfterInterruptedBattle &&
      !gameState.pendingQuery &&
      !gameState.isResolvingStack &&
      gameState.isCountering === 0
    ) {
      gameState.phase = 'MAIN';
      gameState.previousPhase = undefined;
      gameState.battleState = undefined;
      gameState.phaseTimerStart = Date.now();
      EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'BATTLE_INTERRUPTED' } });
      gameState.logs.push(`[阶段切换] 战斗已中止，返回主要阶段`);
    }

    const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const currentPlayer = gameState.players[currentPlayerId];
    if (
      currentPlayer &&
      !gameState.pendingQuery &&
      (currentPlayer as any).forceEndTurnRequested === gameState.turnCount &&
      currentPlayer.isTurn
    ) {
      delete (currentPlayer as any).forceEndTurnRequested;
      await ServerGameService.executeEndPhase(gameState, currentPlayer);
      return;
    }

    ServerGameService.normalizeForcedGuardBattleState(gameState);
    EventEngine.recalculateContinuousEffects(gameState);
    ServerGameService.checkBattleInterruption(gameState);
  },

  async checkTriggeredEffects(gameState: GameState, onUpdate?: (state: GameState) => Promise<void>) {
    if (gameState.gameStatus === 2 || gameState.isCountering === 1 || gameState.isResolvingStack || gameState.pendingQuery || gameState.currentProcessingItem) {
      return;
    }

    if (gameState.triggeredEffectsQueue && gameState.triggeredEffectsQueue.length > 0) {
      const trigger = gameState.triggeredEffectsQueue.shift()!;
      const { card, effect, effectIndex, playerUid, event } = trigger;
      const isMandatory = effect.isMandatory;

      if (isMandatory) {
        const identity = getCardIdentity(gameState, playerUid, card);
        gameState.logs.push(`[强制诱发] 发动 ${identity} ${card.fullName} 的效果。`);
        await ServerGameService.executeTriggeredEffect(gameState, playerUid, {
          effectIndex: effectIndex,
          card,
          event
        }, onUpdate);
      } else {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'ASK_TRIGGER',
          playerUid: playerUid,
          options: [],
          title: '发动提示',
          description: `是否发动 ${getCardIdentity(gameState, playerUid, card)} [${card.fullName}] 的诱发效果：${effect.description}`,
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'TRIGGER_CHOICE',
          context: { effectIndex, sourceCardId: card.gamecardId, event }
        };
        gameState.logs.push(`[可选诱发] 等待 ${gameState.players[playerUid].displayName} 选择是否发动 ${card.fullName} 的效果...`);
      }
    } else {
      // Queue is empty, settlement is truly complete
      ServerGameService.checkBattleInterruption(gameState);

      if (gameState.phase === 'START') {
        const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
        const currentPlayer = gameState.players[currentPlayerId];
        if (currentPlayer) {
          await ServerGameService.executeStartPhase(gameState, currentPlayer);
        }
        return;
      }

      // If we were in the middle of ending a turn, resume the transition
      if (gameState.phase === 'END') {
        const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
        const currentPlayer = gameState.players[currentPlayerId];
        if (currentPlayer) {
          await ServerGameService.executeEndPhase(gameState, currentPlayer, true);
        }
      }
    }
  },

  async resolvePlay(gameState: GameState, onUpdate?: (state: GameState) => Promise<void>) {
    return ServerGameService.resolveCounterStack(gameState, onUpdate);
  },

  async handleQueryChoice(gameState: GameState, playerUid: string, queryId: string, selections: string[], onUpdate?: (state: GameState) => Promise<void>) {
    // console.log(`[Server] handleQueryChoice: player=${playerUid}, queryId=${queryId}, selections=`, selections);

    if (!gameState.pendingQuery || gameState.pendingQuery.id !== queryId) {
      // console.warn(`[Server] Invalid query choice request: expected ${gameState.pendingQuery?.id}, got ${queryId}`);
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
    const sourceCard = sourceCardId ? ServerGameService.findCardById(gameState, sourceCardId) : undefined;

    const normalizedType = query.type.replace(/-/g, '_').toUpperCase();

    // 1. Process Core Actions (like Payment) first
    if (normalizedType === 'SELECT_PAYMENT') {
      try {
        const paymentSelection = JSON.parse(selections[0]);
        const result = ServerGameService.payCost(
          gameState,
          playerUid,
          query.paymentCost || 0,
          paymentSelection,
          query.paymentColor,
          query.context?.targetCardId || query.context?.targetId // Use optional chaining for safety
        );

        if (!result.success) {
          gameState.pendingQuery = query; // Restore for retry
          throw new Error(result.reason || '支付失败');
        }

        gameState.logs.push(`[系统] 支付成功，即将进入后续结算。`);

        afterEffects = query.context?.remainingEffects || [];
        currentSelections = query.context?.targetSelections || [];
      } catch (e: any) {
        gameState.pendingQuery = query;
        throw e;
      }
    }

    if (query.callbackKey === 'DIKAI_ATTACK_TARGET_CHOICE') {
      const { attackerIds, isAlliance } = query.context;
      if (currentSelections[0] !== 'YES') {
        await ServerGameService.declareAttack(gameState, playerUid, attackerIds, isAlliance, 'NO_PROMPT', undefined, onUpdate);
        return gameState;
      }

      const opponentId = gameState.playerIds.find(id => id !== playerUid)!;
      const opponent = gameState.players[opponentId];
      const candidates = opponent.unitZone.filter((unit): unit is Card =>
        !!unit &&
        unit.isExhausted &&
        !(unit as any).cannotBeAttackTargetByEffect
      );

      if (candidates.length === 0) {
        await ServerGameService.declareAttack(gameState, playerUid, attackerIds, isAlliance, 'NO_PROMPT', undefined, onUpdate);
        return gameState;
      }

      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid,
        options: AtomicEffectExecutor.enrichQueryOptions(
          gameState,
          playerUid,
          candidates.map(card => ({ card, source: 'UNIT' as TriggerLocation }))
        ),
        title: '选择攻击目标',
        description: '选择对手的1个横置单位。本次攻击将直接进入战斗自由步骤。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'DIKAI_ATTACK_TARGET_SELECT',
        context: { attackerIds, isAlliance }
      };
      return gameState;
    }

    if (query.callbackKey === 'DIKAI_ATTACK_TARGET_SELECT') {
      const { attackerIds, isAlliance } = query.context;
      const targetId = currentSelections[0];
      await ServerGameService.declareAttack(gameState, playerUid, attackerIds, isAlliance, targetId, true, onUpdate);
      return gameState;
    }

    if (query.callbackKey === 'DIKAI_BATTLE_SAVE_CHOICE') {
      const { cardId, targetUnitId, isEffect, sourcePlayerId } = query.context;
      if (currentSelections[0] !== 'YES') {
        const destroyed = await ServerGameService.destroyUnit(gameState, playerUid, targetUnitId, isEffect, sourcePlayerId, false, true);
        if (destroyed === undefined) return gameState;
        if (gameState.battleState) {
          gameState.battleState.resolvedUnitIds = gameState.battleState.resolvedUnitIds || [];
          if (destroyed !== false && !gameState.battleState.resolvedUnitIds.includes(targetUnitId)) {
            gameState.battleState.resolvedUnitIds.push(targetUnitId);
          }
        }
        if (gameState.phase === 'DAMAGE_CALCULATION') {
          await ServerGameService.resolveDamage(gameState);
        }
        return gameState;
      }

      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_PAYMENT',
        playerUid,
        options: [],
        title: '支付费用',
        description: '支付三费，将 [烬晓之光「迪凯」] 从手牌放置到战场上，并防止那次战斗破坏。',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'DIKAI_BATTLE_SAVE_PAYMENT',
        paymentCost: 3,
        context: { cardId, targetUnitId, isEffect, sourcePlayerId }
      };
      return gameState;
    }

    if (query.callbackKey === 'DIKAI_BATTLE_SAVE_PAYMENT') {
      const { cardId, targetUnitId, isEffect, sourcePlayerId } = query.context;
      const player = gameState.players[playerUid];
      const handCard = player.hand.find(card => card.gamecardId === cardId);

      if (handCard && player.unitZone.some(unit => unit === null) && !player.unitZone.some(unit => unit?.specialName === '迪凯')) {
        ServerGameService.moveCard(gameState, playerUid, 'HAND', playerUid, 'UNIT', cardId, {
          isEffect: true,
          effectSourcePlayerUid: playerUid,
          effectSourceCardId: cardId
        });
        gameState.logs.push(`[${handCard.fullName}] 从手牌放置到战场，防止了 [${ServerGameService.findCardById(gameState, targetUnitId)?.fullName || '目标单位'}] 的战斗破坏。`);
        EventEngine.recalculateContinuousEffects(gameState);
        await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
      } else {
        gameState.logs.push('[烬晓之光「迪凯」] 无法放置到战场，防止破坏失败。');
        const destroyed = await ServerGameService.destroyUnit(gameState, playerUid, targetUnitId, isEffect, sourcePlayerId, false, true);
        if (destroyed === undefined) return gameState;
      }

      if (gameState.battleState) {
        gameState.battleState.resolvedUnitIds = gameState.battleState.resolvedUnitIds || [];
        if (!gameState.battleState.resolvedUnitIds.includes(targetUnitId)) {
          gameState.battleState.resolvedUnitIds.push(targetUnitId);
        }
      }

      if (gameState.phase === 'DAMAGE_CALCULATION') {
        await ServerGameService.resolveDamage(gameState);
      }
      return gameState;
    }

    // 2. Trigger Option Processing
    if (query.callbackKey === 'TRIGGER_CHOICE') {
      if (currentSelections[0] === 'YES') {
          gameState.logs.push(`[系统] ${gameState.players[playerUid].displayName} 选择发动 ${sourceCard?.fullName} 的诱发效果。`);
        await ServerGameService.executeTriggeredEffect(gameState, playerUid, {
          effectIndex: query.context.effectIndex,
          card: sourceCard!,
          event: query.context.event
        }, onUpdate);
      } else {
          gameState.logs.push(`[系统] ${gameState.players[playerUid].displayName} 放弃发动 ${sourceCard?.fullName} 的诱发效果。`);
        await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
      }
      return gameState;
    }

    // 3. Generic Effect Resolution (Script-Driven via resolve callback)
    if (query.callbackKey === 'EFFECT_RESOLVE') {
      if (!sourceCard) {
          gameState.logs.push(`[错误] EFFECT_RESOLVE 找不到来源卡 ID: ${sourceCardId}，当前结算失败并继续后续处理。`);
        if (gameState.isResolvingStack) {
          if (gameState.counterStack.length > 0) {
            await ServerGameService.resolveCounterStack(gameState, onUpdate);
          } else {
            await ServerGameService.finishCounteringStack(gameState, onUpdate);
          }
        } else if (!gameState.isCountering) {
          await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
        }
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
      if (effect && effect.onQueryResolve) {
        try {
          gameState.logs.push(`[系统] 正在执行脚本回调 ${effect.id || effectIndex}`);
          await (effect.onQueryResolve as any)(sourceCard, gameState, gameState.players[playerUid], selections, query.context);
          ServerGameService.normalizeForcedGuardBattleState(gameState);
          EventEngine.recalculateContinuousEffects(gameState);
        } catch (err: any) {
          console.error(`[Error] CRASH in onQueryResolve:`, err);
          gameState.logs.push(`[閿欒] 鑴氭湰鍥炶皟鎵ц宕╂簝: ${err.message}`);
        }

        if (gameState.pendingQuery) {
          return gameState;
        }

        if (gameState.phase === 'DAMAGE_CALCULATION' && gameState.battleState?.autoResolveDamage) {
          delete gameState.battleState.autoResolveDamage;
          await ServerGameService.resolveDamage(gameState);
          if (gameState.pendingQuery) {
            return gameState;
          }
        }

        // RESUME RESOLUTION: If this choice was part of a sequential settlement, resume it.
        if (gameState.isResolvingStack) {
          if (gameState.counterStack.length > 0) {
            await ServerGameService.resolveCounterStack(gameState, onUpdate);
          } else {
            // If the stack is now empty, ensure we clean up the "Resolving" state
            await ServerGameService.finishCounteringStack(gameState);
            if (onUpdate) await onUpdate(gameState);
          }
        } else if (!gameState.isCountering) {
          // If not in a stack resolution and not in priority window, likely resuming a triggered effect chain
          await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
        }
        return gameState;
      } else {
        gameState.logs.push(`[错误] EFFECT_RESOLVE 找不到有效回调 (index: ${effectIndex}, id: ${effectId})`);
      }
    }

    if (query.callbackKey === 'ACTIVATE_COST_RESOLVE') {
      if (!sourceCard) {
        gameState.logs.push(`[错误] ACTIVATE_COST_RESOLVE 找不到来源卡 ID: ${sourceCardId}，当前结算失败并继续后续处理。`);
        if (gameState.isResolvingStack) {
          if (gameState.counterStack.length > 0) {
            await ServerGameService.resolveCounterStack(gameState, onUpdate);
          } else {
            await ServerGameService.finishCounteringStack(gameState, onUpdate);
          }
        } else if (!gameState.isCountering) {
          await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
        }
        return gameState;
      }
      const effectIndex = query.context?.effectIndex;
      const effect = sourceCard.effects?.[effectIndex];
      const activationPlayerUid = query.context?.activationPlayerUid || playerUid;

      if (query.context?.costType === 'EROSION_COST') {
        const amount = query.context?.erosionCostAmount || selections.length;
        const player = gameState.players[playerUid];
        const selectedCards = selections
          .map(id => player.erosionFront.find(card => card?.gamecardId === id))
          .filter((card): card is Card => !!card && card.displayState === 'FRONT_UPRIGHT');

        if (selectedCards.length !== amount) {
          gameState.pendingQuery = query;
          throw new Error(`请选择 ${amount} 张正面侵蚀卡支付费用`);
        }

        selectedCards.forEach(card => {
          ServerGameService.moveCard(gameState, playerUid, 'EROSION_FRONT', playerUid, 'EROSION_BACK', card.gamecardId, {
            faceDown: true,
            isEffect: true,
            effectSourcePlayerUid: activationPlayerUid,
            effectSourceCardId: sourceCard.gamecardId
          });
        });
        gameState.logs.push(`[${sourceCard.fullName}] 支付侵蚀${amount}：将 ${amount} 张正面侵蚀卡转为背面。`);
      } else if (effect && effect.onQueryResolve) {
        await (effect.onQueryResolve as any)(sourceCard, gameState, gameState.players[playerUid], selections, query.context);
      }

      if (gameState.pendingQuery) {
        gameState.pendingQuery.callbackKey = 'ACTIVATE_COST_RESOLVE';
        gameState.pendingQuery.context = {
          ...query.context,
          ...gameState.pendingQuery.context,
          sourceCardId: sourceCard.gamecardId,
          effectIndex,
          activationPlayerUid,
          isTrigger: query.context?.isTrigger,
          event: query.context?.event
        };
        return gameState;
      }

      if (query.context?.cancelActivation) {
        return gameState;
      }

      // If it was a trigger cost, execute immediately, otherwise enter countering
      if (query.context?.isTrigger) {
        await ServerGameService.executeTriggeredEffect(gameState, playerUid, {
          card: sourceCard,
          effectIndex,
          event: query.context.event,
          skipCost: true
        }, onUpdate);
      } else if (effect) {
        ServerGameService.finalizeEffectActivation(gameState, activationPlayerUid, sourceCard, effect, effectIndex);
      }
      return gameState;
    }

    if (query.callbackKey === 'SUBSTITUTION_CHOICE') {
      const { subCardId, targetUnitId, isEffect, sourcePlayerId } = query.context;
      gameState.pendingQuery = undefined;

      if (currentSelections[0] === 'YES') {
        // Find equipment
        const player = gameState.players[playerUid];
        const subCardIdx = player.itemZone.findIndex(c => c?.gamecardId === subCardId);
        const subCard = player.itemZone[subCardIdx];
        if (subCardIdx !== -1 && subCard) {
          ServerGameService.moveCard(gameState, playerUid, 'ITEM', playerUid, 'GRAVE', subCardId);
          gameState.logs.push(`[系统] ${subCard.fullName} 代替了承受破坏。`);

          // Mark the unit as resolved (it survived)
          if (gameState.battleState) {
            if (!gameState.battleState.resolvedUnitIds) gameState.battleState.resolvedUnitIds = [];
            if (!gameState.battleState.resolvedUnitIds.includes(targetUnitId)) {
              gameState.battleState.resolvedUnitIds.push(targetUnitId);
            }
          }

          // CRITICAL: Trigger check after substitution
          await ServerGameService.checkTriggeredEffects(gameState);
        }
      } else {
        // Resume default destruction (skip substitution)
        await ServerGameService.destroyUnit(gameState, playerUid, targetUnitId, isEffect, sourcePlayerId, true);

        // Mark the unit as resolved (it was destroyed)
        if (gameState.battleState) {
          if (!gameState.battleState.resolvedUnitIds) gameState.battleState.resolvedUnitIds = [];
          if (!gameState.battleState.resolvedUnitIds.includes(targetUnitId)) {
            gameState.battleState.resolvedUnitIds.push(targetUnitId);
          }
        }
      }

      // Resume battle resolution if in damage calculation
      if (gameState.phase === 'DAMAGE_CALCULATION') {
        await ServerGameService.resolveDamage(gameState);
      }

      return gameState;
    }

    if (query.callbackKey === 'EROSION_KEEP_RESOLVE') {
      const { choice, selectedCardId } = query.context;
      const keepCardId = selections[0]; // If none picked, selections[0] is undefined

      ServerGameService.executeErosionMovements(gameState, playerUid, choice, selectedCardId, keepCardId);

      gameState.phase = 'MAIN';
      gameState.phaseTimerStart = Date.now();
      gameState.logs.push(`${gameState.players[playerUid].displayName} 进入主要阶段`);
      EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'MAIN_PHASE_START' } });
      await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
      return gameState;
    }

    if (query.callbackKey === 'ALLIANCE_DESTRUCTION_RESOLVE') {
      const selectedId = selections[0];
      const attackerId = query.context?.attackerId;
      const defenderId = query.context?.defenderPlayerId;
      const defenderUnitId = query.context?.defenderId;

      const attacker = gameState.players[attackerId];
      const defender = gameState.players[defenderId];
      if (!attacker || !defender || !gameState.battleState) return gameState;

      const selectedUnit = attacker.unitZone.find(u => u?.gamecardId === selectedId);
      const defendingUnit = defender.unitZone.find(u => u?.gamecardId === defenderUnitId);

      if (selectedUnit) {
        const destroyed = await ServerGameService.destroyUnit(gameState, attackerId, selectedId);
        if (destroyed === undefined) return gameState;
        if (destroyed !== false) {
          gameState.logs.push(`[联军结算] ${attacker.displayName} 选择了牺牲 ${selectedUnit.fullName}。`);
          if (!gameState.battleState.resolvedUnitIds?.includes(selectedId)) {
            gameState.battleState.resolvedUnitIds = gameState.battleState.resolvedUnitIds || [];
            gameState.battleState.resolvedUnitIds.push(selectedId);
          }
        }
      }

      if (defendingUnit && !gameState.battleState.resolvedUnitIds?.includes(defenderUnitId)) {
        const destroyedDefender = await ServerGameService.destroyUnit(gameState, defenderId, defenderUnitId);
        if (destroyedDefender === undefined) return gameState;
        if (destroyedDefender !== false) {
          gameState.logs.push(`[联军结算] ${defendingUnit.fullName} 被联军破坏。`);
          gameState.battleState.resolvedUnitIds = gameState.battleState.resolvedUnitIds || [];
          gameState.battleState.resolvedUnitIds.push(defenderUnitId);
        }
      }

      // Continue to finalize battle
      const attackingUnits = gameState.battleState!.attackers.map(id =>
        attacker.unitZone.find(c => c?.gamecardId === id)
      ).filter(Boolean) as Card[];

      // Exhaust remaining units
      attackingUnits.forEach(u => {
        const unit = attacker.unitZone.find(uz => uz?.gamecardId === u.gamecardId);
        if (unit) unit.isExhausted = true;
      });

      // Annihilation for survivor
      const survivors = attackingUnits.filter(u => u.gamecardId !== selectedId);
      ServerGameService.applyAllianceAnnihilationDamage(gameState, defenderId, survivors);

      // Cleanup battle state
      if (gameState.phase === 'SHENYI_CHOICE') {
        gameState.previousPhase = 'MAIN';
      } else {
        gameState.phase = 'MAIN';
      }
      gameState.battleState = undefined;
      gameState.phaseTimerStart = Date.now();

      // RESUME RESOLUTION
      if (gameState.isResolvingStack) {
        await ServerGameService.resolveCounterStack(gameState, onUpdate);
      }
      return gameState;
    }

    if (query.callbackKey === 'COCOLA_ATTACK_CHOICE') {
      const { attackerIds, isAlliance, markedTargetId } = query.context;
      if (currentSelections[0] === 'YES') {
        // Execute attack declaration with forced target and skip defense
        await ServerGameService.declareAttack(gameState, playerUid, attackerIds, isAlliance, markedTargetId, true, onUpdate);
        gameState.logs.push(`[公会看板娘] 强制攻击生效，连锁结算后将跳过防御直接进入战斗自由阶段。`);
      } else {
        // Resume normal attack declaration (pass a special targetId to bypass prompt)
        await ServerGameService.declareAttack(gameState, playerUid, attackerIds, isAlliance, 'NO_PROMPT', undefined, onUpdate);
      }
      return gameState;
    }


    if (afterEffects.length > 0) {
      for (let i = 0; i < afterEffects.length; i++) {
        const effect = afterEffects[i];

        // INTERCEPT: If we need payment, "pause" and issue a SELECT_PAYMENT query
        if (effect.type === 'PAY_CARD_COST') {
          const targetId = currentSelections[0];
          const targetCard = ServerGameService.findCardById(gameState, targetId);
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
          ServerGameService.enterCountering(gameState, playerUid, {
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
          await AtomicEffectExecutor.execute(gameState, playerUid, effect, sourceCard, undefined, currentSelections);
        }
      }
    }

    ServerGameService.checkBattleInterruption(gameState);

    // RESUME RESOLUTION: If this choice was part of a sequential settlement, resume it.
    if (gameState.isResolvingStack) {
      await ServerGameService.resolveCounterStack(gameState, onUpdate);
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

  async declareAttack(gameState: GameState, playerId: string, attackerIds: string[], isAlliance: boolean, targetId?: string, skipDefense?: boolean, onUpdate?: (state: GameState) => Promise<void>) {
    if (gameState.pendingQuery || gameState.isResolvingStack || gameState.currentProcessingItem) {
      throw new Error('当前有未结算步骤，请等待处理完毕。');
    }
    if (gameState.phase !== 'BATTLE_DECLARATION') throw new Error('Not in battle declaration phase');

    const player = gameState.players[playerId];
    const attackers: Card[] = [];

    if (isAlliance && attackerIds.length !== 2) {
      throw new Error('联军攻击必须选择两个单位');
    }
    if (!isAlliance && attackerIds.length !== 1) {
      throw new Error('单体攻击必须选择一个单位');
    }

    const forcedAttackUnit = ServerGameService.getForcedAttackUnit(gameState, playerId);
    if (forcedAttackUnit) {
      if (isAlliance || attackerIds.length !== 1 || attackerIds[0] !== forcedAttackUnit.gamecardId) {
        throw new Error(`本次必须由 [${forcedAttackUnit.fullName}] 单独宣告攻击`);
      }
    }

    // Cocola's marked target prompt
    if (player.markedUnitAttackTarget && !targetId) {
      const opponentId = gameState.playerIds.find(id => id !== playerId)!;
      const opponent = gameState.players[opponentId];
      const targetUnit = opponent.unitZone.find(u => u && u.gamecardId === player.markedUnitAttackTarget);

      if (targetUnit && !(targetUnit as any).cannotBeAttackTargetByEffect) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CHOICE',
          playerUid: playerId,
          options: [
            { id: 'YES', label: '发动(YES)' },
            { id: 'NO', label: '不发动(NO)' }
          ],
          title: '全攻确认',
          description: `是否选择发动【全攻】，攻击指定单位 [${targetUnit.fullName}]？选择“是”将直接进入战斗自由阶段。`,
          callbackKey: 'COCOLA_ATTACK_CHOICE',
          context: { attackerIds, isAlliance, markedTargetId: player.markedUnitAttackTarget }
        };
        return gameState;
      }
    }

    if (!isAlliance && attackerIds.length === 1 && !targetId && !skipDefense) {
      const attackerUnit = player.unitZone.find(unit => unit?.gamecardId === attackerIds[0]);
      const opponentId = gameState.playerIds.find(id => id !== playerId)!;
      const opponent = gameState.players[opponentId];
      const exhaustedTargets = opponent.unitZone.filter((unit): unit is Card =>
        !!unit &&
        unit.isExhausted &&
        !(unit as any).cannotBeAttackTargetByEffect
      );

      if (ServerGameService.has102050091ExhaustedAttack(attackerUnit) && exhaustedTargets.length > 0) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CHOICE',
          playerUid: playerId,
          options: [
            { id: 'YES', label: '攻击横置单位(YES)' },
            { id: 'NO', label: '不攻击横置单位(NO)' }
          ],
          title: '攻击横置单位',
          description: `[${attackerUnit!.fullName}] 可以攻击对手的横置单位。是否选择攻击横置单位？`,
          callbackKey: 'DIKAI_ATTACK_TARGET_CHOICE',
          context: { attackerIds, isAlliance }
        };
        return gameState;
      }
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
      if (isAlliance && (unit as any).data?.cannotAllianceByEffect) {
        throw new Error(`单位 [${unit.fullName}] 由于效果不能组成联军`);
      }
      if ((unit as any).battleForbiddenByEffect) throw new Error(`单位 [${unit.fullName}] 由于效果不能参与战斗`);

      if (targetId) {
        const opponentId = gameState.playerIds.find(id => id !== playerId)!;
        const targetUnit = gameState.players[opponentId]?.unitZone.find(c => c?.gamecardId === targetId);
        if (targetUnit && (targetUnit as any).cannotBeAttackTargetByEffect) {
          throw new Error(`单位 [${targetUnit.fullName}] 由于效果不能成为攻击对象`);
        }
        if (targetId !== 'NO_PROMPT') {
          const canAttackMarkedTarget = player.markedUnitAttackTarget === targetId;
          const canAttackExhaustedTarget =
            !isAlliance &&
            attackerIds.length === 1 &&
            !!targetUnit &&
            targetUnit.isExhausted &&
            ServerGameService.has102050091ExhaustedAttack(unit);
          if (!canAttackMarkedTarget && !canAttackExhaustedTarget) {
            throw new Error('不能攻击该单位');
          }
        }
      }

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
        throw new Error(`单位 [${unit.fullName}] 在本回合打出，没有【速攻】不能攻击`);
      }

      unit.hasAttackedThisTurn = true;
      attackers.push(unit);
    }

    // Exhaust attackers
    for (const unit of attackers) {
      ServerGameService.exhaustCard(unit);
    }

    gameState.battleState = {
      attackers: attackerIds,
      isAlliance,
      unitTargetId: targetId === 'NO_PROMPT' ? undefined : targetId,
      defensePowerRestriction: 0
    };

    let effectiveSkipDefense = !!skipDefense;
    if (!effectiveSkipDefense) {
      effectiveSkipDefense = await ServerGameService.tryApplyMinotaurShieldGuardOnAttackDeclaration(gameState, onUpdate);
    }

    const attackerNames = attackers.map(a => a.fullName).join(' 和 ');
    gameState.logs.push(`${player.displayName} 宣告了攻击 ${attackerNames}${isAlliance ? ' (联军攻击)' : ''}`);

    EventEngine.dispatchEvent(gameState, {
      type: 'CARD_ATTACK_DECLARED',
      sourceCard: attackers[0],
      sourceCardId: attackers[0].gamecardId,
      playerUid: playerId,
      data: { attackerIds, isAlliance }
    });

    ServerGameService.enterCountering(gameState, playerId, {
      ownerUid: playerId,
      type: 'ATTACK',
      attackerIds,
      isAlliance,
      timestamp: Date.now(),
      skipDefense: effectiveSkipDefense
    });

    return gameState;
  },

  async declareDefense(gameState: GameState, playerId: string, defenderId?: string) {
    if (gameState.pendingQuery || gameState.isResolvingStack || gameState.currentProcessingItem) {
      throw new Error('当前有未结算步骤，请等待处理完毕。');
    }
    if (gameState.phase !== 'DEFENSE_DECLARATION') throw new Error('Not in defense declaration phase');
    if (!gameState.battleState) throw new Error('No battle state found');

    const player = gameState.players[playerId];

    if (defenderId) {
      const unit = player.unitZone.find(c => c?.gamecardId === defenderId);
      if (!unit) throw new Error('Defender not found in unit zone');
      if (unit.isExhausted) throw new Error('Defender is already exhausted');
      if ((unit as any).battleForbiddenByEffect) throw new Error(`单位 [${unit.fullName}] 由于效果不能参与战斗`);
      if ((unit as any).data?.cannotDefendTurn === gameState.turnCount) {
        throw new Error(`单位 [${unit.fullName}] 由于 [${(unit as any).data.cannotDefendSourceName || '卡牌效果'}] 不能宣言防御`);
      }

      const lockedTargetId = gameState.battleState.defenseLockedToTargetId;
      if (lockedTargetId && defenderId !== lockedTargetId) {
        throw new Error('由于效果限制，这场战斗中只能由被指定的单位进行防御');
      }

      const minPower = gameState.battleState.defensePowerRestriction || 0;
      if (minPower > 0 && (unit.power || 0) < minPower) {
        throw new Error(`无法防御：对方的效果使得力量值低于 ${minPower} 的单位不能进行防御`);
      }
      const maxPower = gameState.battleState.defenseMaxPowerRestriction;
      if (maxPower !== undefined && (unit.power || 0) >= maxPower) {
        throw new Error(`无法防御：对方的效果使得力量值 ${maxPower} 以上的单位不能进行防御`);
      }
      const attackers = gameState.battleState.attackers
        .map(id => gameState.players[gameState.playerIds[gameState.currentTurnPlayer]].unitZone.find(attacker => attacker?.gamecardId === id))
        .filter(Boolean) as Card[];
      const minExclusive = Math.max(0, ...attackers.map(attacker => (attacker as any).data?.defenseMinPower || 0));
      if (minExclusive > 0 && (unit.power || 0) <= minExclusive) {
        throw new Error(`无法防御：攻击单位的效果使力量值 ${minExclusive} 以下的单位不能防御`);
      }

      ServerGameService.exhaustCard(unit);
      gameState.battleState.defender = defenderId;
      EventEngine.dispatchEvent(gameState, {
        type: 'CARD_DEFENSE_DECLARED',
        sourceCard: unit,
        sourceCardId: unit.gamecardId,
        playerUid: playerId,
        data: { defenderId: unit.gamecardId }
      });
      gameState.logs.push(`${player.displayName} 宣告了防御 ${unit.fullName}`);
    } else {
      gameState.logs.push(`${player.displayName} 选择不防御`);
    }

    // Transition to counter check (for now just move to battle free)
    gameState.phase = 'BATTLE_FREE';
    gameState.phaseTimerStart = Date.now();

    await ServerGameService.checkTriggeredEffects(gameState);

    return gameState;
  },

  async resolveDamage(gameState: GameState) {

    if (gameState.phase !== 'DAMAGE_CALCULATION') throw new Error('Not in damage calculation phase');
    if (!gameState.battleState) throw new Error('No battle state found');

    if (!gameState.battleState.resolvedUnitIds) {
      gameState.battleState.resolvedUnitIds = [];
    }

    const attackerId = gameState.playerIds[gameState.currentTurnPlayer];
    const defenderId = gameState.playerIds[gameState.currentTurnPlayer === 0 ? 1 : 0];
    const attacker = gameState.players[attackerId];
    const defender = gameState.players[defenderId];

    const attackingUnits = gameState.battleState.attackers.map(id =>
      attacker.unitZone.find(c => c?.gamecardId === id)
    ).filter(Boolean) as Card[];

    // Safety check: Ensure attackers still on field
    if (attackingUnits.length === 0) {
      gameState.logs.push(`[系统] 由于所有攻击单位均已离开战场，战斗被中断。`);
      gameState.battleState = undefined;
      gameState.phase = 'MAIN';
      await ServerGameService.checkTriggeredEffects(gameState);
      return gameState;
    }

    // Safety check: Ensure alliance attack still has both units
    if (gameState.battleState.isAlliance && attackingUnits.length < 2) {
      gameState.logs.push(`[系统] 由于联军攻击单位数量不足，战斗被中断。`);
      gameState.battleState = undefined;
      gameState.phase = 'MAIN';
      await ServerGameService.checkTriggeredEffects(gameState);
      return gameState;
    }

    // Handle forced attack target (Effect-based)
    if (!gameState.battleState.defender && gameState.battleState.unitTargetId) {
      const targetUnit = defender.unitZone.find(u => u && u.gamecardId === gameState.battleState!.unitTargetId);
      if (targetUnit) {
        gameState.battleState.defender = targetUnit.gamecardId;
        gameState.logs.push(`[系统] 攻击指向了被指定的单位 ${targetUnit.fullName}`);
      }
    }

    if (!gameState.battleState.defender) {
      // Direct damage to player
      const totalDamage = attackingUnits.reduce((sum, u) => sum + (u.damage || 0), 0);
      const finalDamage = defender.isGoddessMode ? totalDamage * 2 : totalDamage;

      gameState.logs.push(`${attacker.displayName} 对 ${defender.displayName} 造成了 ${finalDamage} 点战斗伤害`);

      EventEngine.dispatchEvent(gameState, {
        type: 'COMBAT_DAMAGE_CAUSED',
        playerUid: defenderId,
        data: {
          amount: finalDamage,
          source: 'BATTLE',
          attackerIds: gameState.battleState.attackers || [],
          isAlliance: !!gameState.battleState.isAlliance
        }
      });

      ServerGameService.applyDamageToPlayer(gameState, defenderId, totalDamage, 'BATTLE');
    } else {
      // Unit combat
      const defendingUnitId = gameState.battleState!.defender;
      const defendingUnit = defender.unitZone.find(c => c?.gamecardId === defendingUnitId);

      if (!defendingUnit) {
        gameState.logs.push(`[系统] 由于指定防御单位离开战场，战斗宣言无效。`);
        gameState.battleState = undefined;
        gameState.phase = 'MAIN';
        await ServerGameService.checkTriggeredEffects(gameState);
        return gameState;
      }

      const defenderPower = defendingUnit.power || 0;

      if (!gameState.battleState.isAlliance) {
        const attackingUnit = attackingUnits[0];
        const attackerPower = attackingUnit.power || 0;

        if (attackerPower > defenderPower) {
          if (!gameState.battleState.resolvedUnitIds.includes(defendingUnit.gamecardId)) {
            const destroyed = await ServerGameService.destroyUnit(gameState, defenderId, defendingUnit.gamecardId);
            if (destroyed === undefined) return gameState; // Wait for substitution choice
            if (destroyed !== false) {
              gameState.logs.push(`${attackingUnit.fullName} 破坏了 ${defendingUnit.fullName}`);
              gameState.battleState.resolvedUnitIds.push(defendingUnit.gamecardId);

              // Annihilation Effect
              if (attackingUnit.isAnnihilation) {
                gameState.logs.push(`【歼灭】效果触发！${attackingUnit.fullName} 对对手造成额外伤害`);
                EventEngine.dispatchEvent(gameState, {
                  type: 'COMBAT_DAMAGE_CAUSED',
                  playerUid: defenderId,
                  data: {
                    amount: attackingUnit.damage || 0,
                    source: 'BATTLE',
                    attackerIds: [attackingUnit.gamecardId],
                    isAlliance: !!gameState.battleState?.isAlliance
                  }
                });
                ServerGameService.applyDamageToPlayer(gameState, defenderId, attackingUnit.damage || 0, 'BATTLE');
              }
            }
          }
        } else if (attackerPower < defenderPower) {
          if (!gameState.battleState.resolvedUnitIds.includes(attackingUnit.gamecardId)) {
            const destroyed = await ServerGameService.destroyUnit(gameState, attackerId, attackingUnit.gamecardId);
            if (destroyed === undefined) return gameState; // Wait for substitution choice
            if (destroyed !== false) {
              gameState.logs.push(`${defendingUnit.fullName} 破坏了 ${attackingUnit.fullName}`);
              gameState.battleState.resolvedUnitIds.push(attackingUnit.gamecardId);
            }
          }
        } else {
          // Mutual destruction
          const alreadyA = gameState.battleState.resolvedUnitIds.includes(attackingUnit.gamecardId);
          const alreadyD = gameState.battleState.resolvedUnitIds.includes(defendingUnit.gamecardId);

          if (!alreadyA || !alreadyD) {
            const destroyedA = alreadyA ? true : await ServerGameService.destroyUnit(gameState, attackerId, attackingUnit.gamecardId);
            const destroyedD = alreadyD ? true : await ServerGameService.destroyUnit(gameState, defenderId, defendingUnit.gamecardId);

            if (destroyedA === undefined || destroyedD === undefined) return gameState; // Wait for substitution choice
            if (destroyedA !== false && !alreadyA) gameState.battleState.resolvedUnitIds.push(attackingUnit.gamecardId);
            if (destroyedD !== false && !alreadyD) gameState.battleState.resolvedUnitIds.push(defendingUnit.gamecardId);

            if (destroyedA !== false && destroyedD !== false) {
              gameState.logs.push(`${attackingUnit.fullName} 和 ${defendingUnit.fullName} 同归于尽`);
            }
          }
        }
      } else {
        // Alliance combat
        const totalAttackerPower = attackingUnits.reduce((sum, u) => sum + (u.power || 0), 0);
        const powerA = attackingUnits[0].power || 0;
        const powerB = attackingUnits[1].power || 0;
        const attackerA = attackingUnits[0];
        const attackerB = attackingUnits[1];
        const aHigher = powerA > defenderPower;
        const bHigher = powerB > defenderPower;
        const aLower = powerA < defenderPower;
        const bLower = powerB < defenderPower;

        const destroyAttacker = async (unit: Card) => {
          const already = gameState.battleState!.resolvedUnitIds.includes(unit.gamecardId);
          if (already) return true;
          const destroyed = await ServerGameService.destroyUnit(gameState, attackerId, unit.gamecardId);
          if (destroyed === undefined) return destroyed;
          if (destroyed !== false) {
            gameState.battleState!.resolvedUnitIds.push(unit.gamecardId);
          }
          return destroyed;
        };

        const destroyDefender = async () => {
          const already = gameState.battleState!.resolvedUnitIds.includes(defendingUnit.gamecardId);
          if (already) return true;
          const destroyed = await ServerGameService.destroyUnit(gameState, defenderId, defendingUnit.gamecardId);
          if (destroyed === undefined) return destroyed;
          if (destroyed !== false) {
            gameState.battleState!.resolvedUnitIds.push(defendingUnit.gamecardId);
          }
          return destroyed;
        };

        if (totalAttackerPower < defenderPower) {
          const res1 = await destroyAttacker(attackingUnits[0]);
          const res2 = await destroyAttacker(attackingUnits[1]);
          if (res1 !== false && res2 !== false) {
            gameState.logs.push(`联军总力量低于 ${defendingUnit.fullName}，攻击方所有单位都被破坏`);
          }
          if (res1 === undefined || res2 === undefined) return gameState;
        } else if (totalAttackerPower === defenderPower) {
          const defenderResult = await destroyDefender();
          const res1 = await destroyAttacker(attackingUnits[0]);
          const res2 = await destroyAttacker(attackingUnits[1]);
          if (defenderResult !== false && res1 !== false && res2 !== false) {
            gameState.logs.push(`联军与 ${defendingUnit.fullName} 同归于尽`);
          }
          if (defenderResult === undefined || res1 === undefined || res2 === undefined) return gameState;
        } else if (aHigher && bHigher) {
          const defenderResult = await destroyDefender();
          if (defenderResult !== false) {
            gameState.logs.push(`${defendingUnit.fullName} 被联军破坏`);
            ServerGameService.applyAllianceAnnihilationDamage(gameState, defenderId, attackingUnits);
          }
          if (defenderResult === undefined) return gameState;
        } else if (aHigher || bHigher) {
          const survivingUnit = aHigher ? attackerA : attackerB;
          const sacrificedUnit = aHigher ? attackerB : attackerA;
          const defenderResult = await destroyDefender();
          const attackerResult = await destroyAttacker(sacrificedUnit);
          if (defenderResult !== false && attackerResult !== false) {
            gameState.logs.push(`${defendingUnit.fullName} 与 ${sacrificedUnit.fullName} 被破坏，${survivingUnit.fullName} 留在场上`);
            ServerGameService.applyAllianceAnnihilationDamage(gameState, defenderId, [survivingUnit]);
          }
          if (defenderResult === undefined || attackerResult === undefined) return gameState;
        } else if (aLower && bLower) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: attackerId,
            options: attackingUnits.map(u => ({ card: u, source: 'UNIT' as TriggerLocation })),
            title: '联军牺牲选择',
            description: `联军总力量 (${totalAttackerPower}) 高于防御单位 (${defenderPower})，请选择一个攻击单位与防御单位一同被破坏。`,
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'ALLIANCE_DESTRUCTION_RESOLVE',
            context: {
              defenderId: defendingUnit.gamecardId,
              attackerId,
              defenderPlayerId: defenderId
            }
          };
          gameState.priorityPlayerId = attackerId;
          gameState.logs.push(`等待 ${attacker.displayName} 选择联军中要被破坏的单位...`);
          return gameState;
        } else {
          const sacrificedUnit = powerA <= powerB ? attackerA : attackerB;
          const survivingUnit = sacrificedUnit.gamecardId === attackerA.gamecardId ? attackerB : attackerA;
          const defenderResult = await destroyDefender();
          const attackerResult = await destroyAttacker(sacrificedUnit);
          if (defenderResult !== false && attackerResult !== false) {
            gameState.logs.push(`${defendingUnit.fullName} 与 ${sacrificedUnit.fullName} 被破坏，${survivingUnit.fullName} 留在场上`);
            ServerGameService.applyAllianceAnnihilationDamage(gameState, defenderId, [survivingUnit]);
          }
          if (defenderResult === undefined || attackerResult === undefined) return gameState;
        }
      }
    }
    if (!gameState.battleState.skipAttackerExhaust) {
      attackingUnits.forEach(u => {
        const unit = attacker.unitZone.find(uz => uz?.gamecardId === u.gamecardId);
        if (unit) unit.isExhausted = true;
      });
    }

    // Re-trigger check for Goddard effects like 302050014 that depend on combat state/phase
    // Process triggers while still in DAMAGE_CALCULATION and with valid battleState
    await ServerGameService.checkTriggeredEffects(gameState);

    // Now set phase back to MAIN or SHENYI if triggered
    if (gameState.phase !== 'SHENYI_CHOICE') {
      gameState.phase = 'MAIN';
      gameState.phaseTimerStart = Date.now();
      EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'BATTLE_END' } });
      gameState.logs.push(`${attacker.displayName} 进入主要阶段 (战斗结算后)`);
    }

    // After all triggers are checked, see if we need to enter Shenyi choice
    if (gameState.pendingShenyi && !gameState.pendingQuery) {
      gameState.previousPhase = gameState.phase === 'DAMAGE_CALCULATION' ? 'MAIN' : gameState.phase;
      gameState.phase = 'SHENYI_CHOICE';
      gameState.logs.push(`等待玩家确认是否触发【神依】`);
    }

    if (gameState.phase !== 'SHENYI_CHOICE' && gameState.phase !== 'DAMAGE_CALCULATION') {
      // Phase might have been changed by a trigger, otherwise move to MAIN
    } else if (gameState.phase === 'DAMAGE_CALCULATION') {
      gameState.phase = 'MAIN';
    }

    gameState.battleState = undefined;
    gameState.phaseTimerStart = Date.now();
    await ServerGameService.checkTriggeredEffects(gameState);
    return gameState;
  },

  applyDamageToPlayer(gameState: GameState, playerId: string, damage: number, source: 'BATTLE' | 'EFFECT' = 'BATTLE') {
    const player = gameState.players[playerId];

    if ((player as any).preventAllDamageTurn === gameState.turnCount) {
      gameState.logs.push(`[${(player as any).preventAllDamageSourceName || '伤害防止'}] 防止了 ${player.displayName} 将要受到的 ${damage} 点伤害。`);
      return;
    }

    let finalAmount = damage;
    let finalDestination: TriggerLocation = 'EROSION_FRONT';

    if (player.isGoddessMode) {
      finalAmount *= 2;
      finalDestination = 'GRAVE';
      gameState.logs.push(`[女神化状态] ${player.displayName} 受到的伤害翻倍并直接进入墓地`);
    }

    if (player.deck.length < finalAmount) {
      gameState.logs.push(`[游戏结束] ${player.displayName} 的卡组中没有足够的卡牌来承受 ${finalAmount} 点伤害，判负。`);
      gameState.gameStatus = 2;
      gameState.winReason = source === 'BATTLE' ? 'DECK_OUT_BATTLE_DAMAGE' : 'DECK_OUT_EFFECT_DAMAGE';
      gameState.winnerId = gameState.playerIds.find(id => id !== playerId);
      return;
    }

    for (let i = 0; i < finalAmount; i++) {
      let card = player.deck.pop()!;
      let loopDestination: TriggerLocation = finalDestination;

      // Check for movement substitution (e.g. 104010484) - Only if not already forced to Grave by Goddess mode
      if (loopDestination === 'EROSION_FRONT' && card.effects) {
        for (const effect of card.effects) {
          if (
            effect.type === 'CONTINUOUS' &&
            effect.movementReplacementDestination &&
            effect.content !== 'REPLACE_DAMAGE_TO_EROSION'
          ) {
            if (!effect.condition || effect.condition(gameState, player, card)) {
              gameState.logs.push(`[替换效果] ${card.fullName} 的移动目的地从 EROSION_FRONT 被替换为 ${effect.movementReplacementDestination}`);
              loopDestination = effect.movementReplacementDestination;
              break;
            }
          }
        }
      }

      if (loopDestination === 'EROSION_FRONT') {
        const replacementSources = Object.values(gameState.players).flatMap(owner =>
          [...owner.unitZone, ...owner.itemZone, ...owner.erosionFront]
            .filter((sourceCard): sourceCard is Card => !!sourceCard)
            .map(sourceCard => ({ sourceCard, owner }))
        );

        for (const { sourceCard, owner } of replacementSources) {
          for (const effect of sourceCard.effects || []) {
            if (
              effect.type === 'CONTINUOUS' &&
              effect.content === 'REPLACE_DAMAGE_TO_EROSION' &&
              effect.movementReplacementDestination
            ) {
              if (!effect.condition || effect.condition(gameState, owner, sourceCard)) {
                gameState.logs.push(`[替换效果] [${sourceCard.fullName}] 将伤害导致的侵蚀改为进入 ${effect.movementReplacementDestination}`);
                loopDestination = effect.movementReplacementDestination;
                break;
              }
            }
          }

          if (loopDestination !== 'EROSION_FRONT') {
            break;
          }
        }
      }

      if (loopDestination === 'EROSION_FRONT') {
        const currentErosion = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
        if (currentErosion >= 10) {
          card.cardlocation = 'GRAVE';
          card.displayState = 'FRONT_UPRIGHT';
          player.grave.push(card);
          gameState.logs.push(`[侵蚀区已满] ${card.fullName} 因侵蚀区已达10张改为送入墓地。`);
        } else {
          card.cardlocation = 'EROSION_FRONT';
          card.displayState = 'FRONT_UPRIGHT';
          const emptyIdx = player.erosionFront.findIndex(c => c === null);
          if (emptyIdx !== -1) player.erosionFront[emptyIdx] = card;
          else player.erosionFront.push(card);
        }
      } else if (loopDestination === 'UNIT') {
        card.cardlocation = 'UNIT';
        card.displayState = 'FRONT_UPRIGHT';
        card.playedTurn = gameState.turnCount;
        const emptyIdx = player.unitZone.findIndex(c => c === null);
        if (emptyIdx !== -1) player.unitZone[emptyIdx] = card;
        else player.unitZone.push(card);
        EventEngine.handleCardEnteredZone(gameState, playerId, card, 'UNIT', true);
      } else if (loopDestination === 'GRAVE') {
        card.cardlocation = 'GRAVE';
        card.displayState = 'FRONT_UPRIGHT';
        player.grave.push(card);
      } else if (loopDestination === 'EXILE') {
        card.cardlocation = 'EXILE';
        card.displayState = 'FRONT_UPRIGHT';
        player.exile.push(card);
      }

      // Check for goddess mode transformation
      const totalErosion = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
      if (totalErosion >= 10 && !player.isGoddessMode) {
        ServerGameService.triggerGoddessTransformation(gameState, playerId);
        // Note: doubling and direct grave destination apply only to damage received thereafter.
      }

      // If more than 10 (non-goddess or legacy check), excess to grave
      const totalAfterPlacement = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
      if (totalAfterPlacement > 10) {
        const lastIdx = player.erosionFront.length - 1;
        const excessCard = player.erosionFront[lastIdx];
        if (excessCard) {
          excessCard.cardlocation = 'GRAVE';
          player.grave.push(excessCard);
          player.erosionFront[lastIdx] = null;
        }
      }
    }

    ServerGameService.checkWinConditions(gameState);
  },

  applyAllianceAnnihilationDamage(gameState: GameState, defenderPlayerId: string, survivingUnits: Card[]) {
    const annihilators = survivingUnits.filter(u => u.isAnnihilation);
    if (annihilators.length === 0) return;

    const totalAnnihilationDamage = annihilators.reduce((sum, u) => sum + (u.damage || 0), 0);
    gameState.logs.push(`【歼灭】效果触发！幸存的联军单位造成额外伤害 (${totalAnnihilationDamage})`);
    EventEngine.dispatchEvent(gameState, {
      type: 'COMBAT_DAMAGE_CAUSED',
      playerUid: defenderPlayerId,
      data: {
        amount: totalAnnihilationDamage,
        source: 'BATTLE',
        attackerIds: annihilators.map(unit => unit.gamecardId),
        isAlliance: true
      }
    });
    ServerGameService.applyDamageToPlayer(gameState, defenderPlayerId, totalAnnihilationDamage, 'BATTLE');
  },

  triggerGoddessTransformation(gameState: GameState, playerId: string) {
    const player = gameState.players[playerId];
    if (player.isGoddessMode) return;

    player.isGoddessMode = true;
    gameState.logs.push(`${player.displayName} 进入了女神化状态！`);

    EventEngine.dispatchEvent(gameState, {
      type: 'GODDESS_TRANSFORMATION',
      playerUid: playerId
    });

    // Shenyi Effect (Interactive)
    const shenyiUnits = player.unitZone.filter(u => u && u.isShenyi && !u.usedShenyiThisTurn && (u.isExhausted || u.displayState.includes('EXHAUSTED')));
    if (shenyiUnits.length > 0) {
      gameState.pendingShenyi = {
        playerUid: playerId,
        cardIds: shenyiUnits.map(u => u!.gamecardId)
      };
      gameState.priorityPlayerId = playerId;
      gameState.logs.push(`${player.displayName} 进入女神化，满足【神依】触发条件。`);
    }
  },

  async destroyUnit(gameState: GameState, playerId: string, gamecardId: string, isEffect: boolean = false, sourcePlayerId?: string, skipSubstitution: boolean = false, skip102050091BattleSave: boolean = false): Promise<boolean | undefined> {
    const player = gameState.players[playerId];
    let unitIdx = player.unitZone.findIndex(c => c?.gamecardId === gamecardId);
    let zone: 'UNIT' | 'ITEM' = 'UNIT';

    if (unitIdx === -1) {
      unitIdx = player.itemZone.findIndex(c => c?.gamecardId === gamecardId);
      if (unitIdx === -1) return false;
      zone = 'ITEM';
    }

    const unit = zone === 'UNIT' ? player.unitZone[unitIdx]! : player.itemZone[unitIdx]!;

    if (!isEffect && (unit as any).data?.combatImmuneUntilOwnNextTurnStartUid === playerId) {
      gameState.logs.push(`[${unit.fullName}] 不会被战斗破坏，本次破坏无效。`);
      return false;
    }

    if (!isEffect && (unit as any).battleImmuneByEffect) {
      gameState.logs.push(`[${unit.fullName}] 因效果不会被战斗破坏。`);
      return false;
    }

    if ((unit as any).data?.indestructibleByEffect) {
      gameState.logs.push(`[${unit.fullName}] 因效果不会被破坏。`);
      return false;
    }

    const opponentUid = gameState.playerIds.find(id => id !== playerId);
    if (
      (unit as any).data?.indestructibleIfOpponentGoddess &&
      opponentUid &&
      gameState.players[opponentUid]?.isGoddessMode
    ) {
      gameState.logs.push(`[${unit.fullName}] 因对手处于女神化状态而不会被破坏。`);
      return false;
    }

    if (
      isEffect &&
      sourcePlayerId &&
      sourcePlayerId !== playerId &&
      gameState.players[sourcePlayerId]?.isGoddessMode &&
      (unit as any).data?.immuneToOpponentEffectsIfOpponentGoddess
    ) {
      gameState.logs.push(`[${unit.fullName}] 因对手处于女神化状态而不受对手卡牌效果影响。`);
      return false;
    }

    if (
      isEffect &&
      sourcePlayerId &&
      sourcePlayerId !== playerId &&
      (unit as any).data?.unaffectedByOpponentCardEffects
    ) {
      gameState.logs.push(`[${unit.fullName}] 不受对手的卡牌效果影响。`);
      return false;
    }

    if ((unit as any).data?.returnToHandOnDestroyTurn === gameState.turnCount) {
      ServerGameService.moveCard(gameState, playerId, zone, playerId, 'HAND', gamecardId, {
        isEffect: true,
        effectSourcePlayerUid: (unit as any).data?.returnToHandOnDestroySourcePlayerUid || playerId,
        effectSourceCardId: (unit as any).data?.returnToHandOnDestroySourceCardId
      });
      gameState.logs.push(`[替换效果] ${unit.fullName} 本回合被破坏时改为返回手牌。`);
      await ServerGameService.checkTriggeredEffects(gameState);
      return false;
    }

    if (!isEffect && !skipSubstitution && !skip102050091BattleSave) {
      const dikai = ServerGameService.get102050091BattleSaveCandidate(gameState, playerId);
      if (dikai) {
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CHOICE',
          playerUid: playerId,
          options: [
            { id: 'YES', label: '发动(YES)' },
            { id: 'NO', label: '不发动(NO)' }
          ],
          title: '战斗破坏防止',
          description: `你的 [${unit.fullName}] 将要被战斗破坏。是否支付三费，将手牌中的 [${dikai.fullName}] 放置到战场并防止那次破坏？`,
          callbackKey: 'DIKAI_BATTLE_SAVE_CHOICE',
          context: {
            cardId: dikai.gamecardId,
            targetUnitId: gamecardId,
            isEffect,
            sourcePlayerId
          }
        };
        return undefined;
      }
    }

    // Check for Substitution effects
    if (!skipSubstitution) {
      const substitutionCards = player.itemZone.filter(c =>
        c !== null &&
        c.effects &&
        c.effects.some(e => e.substitutionFilter && AtomicEffectExecutor.matchesFilter(unit, e.substitutionFilter, c))
      ) as Card[];

      for (const subCard of substitutionCards) {
        const effect = subCard.effects.find(e => e.substitutionFilter && AtomicEffectExecutor.matchesFilter(unit, e.substitutionFilter, subCard));
        const result = ServerGameService.checkEffectLimitsAndReqs(gameState, playerId, subCard, effect);
        if (effect && result.valid) {
          // Issue Query
          const queryId = Math.random().toString(36).substring(7);
          gameState.pendingQuery = {
            id: queryId,
            type: 'SELECT_CHOICE',
            playerUid: playerId,
            options: [
              { id: 'YES', label: '发动(YES)' },
              { id: 'NO', label: '不发动(NO)' }
            ],
            title: '效果发动确认',
            description: `是否发动 [${subCard.fullName}] 的效果，将其送入墓地代替 [${unit.fullName}] 的破坏？`,
            callbackKey: 'SUBSTITUTION_CHOICE',
            context: { subCardId: subCard.gamecardId, targetUnitId: gamecardId, isEffect, sourcePlayerId }
          };
          return undefined; // Indicates pending choice
        }
      }
    }

    // Detect fromZone
    // Detect fromZone
    let fromZone: TriggerLocation = 'UNIT';
    if (player.itemZone.some(c => c?.gamecardId === gamecardId)) {
      fromZone = 'ITEM';
    } else if (player.erosionFront.some(c => c?.gamecardId === gamecardId)) {
      fromZone = 'EROSION_FRONT';
    } else if (player.erosionBack.some(c => c?.gamecardId === gamecardId)) {
      fromZone = 'EROSION_BACK';
    }

    // Default destruction using standard moveCard
    ServerGameService.moveCard(gameState, playerId, fromZone, playerId, 'GRAVE', gamecardId, {
      isEffect,
      effectSourcePlayerUid: sourcePlayerId
    });

    if (isEffect) {
      EventEngine.dispatchEvent(gameState, {
        type: 'CARD_DESTROYED_EFFECT',
        targetCardId: gamecardId,
        playerUid: playerId,
        data: { sourcePlayerId }
      });
    } else {
      EventEngine.dispatchEvent(gameState, {
        type: 'CARD_DESTROYED_BATTLE',
        targetCardId: gamecardId,
        playerUid: playerId,
        data: {
          attackerIds: gameState.battleState?.attackers || [],
          isAlliance: gameState.battleState?.isAlliance || false
        }
      });
    }
    await ServerGameService.checkTriggeredEffects(gameState);
    return true; // Successfully destroyed
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

    await ServerGameService.checkTriggeredEffects(gameState);

    if (player.hand.length <= 6) {
      // Move to next turn
      await ServerGameService.finishTurnTransition(gameState);
    }

    return gameState;
  },

  processBt01DestroyAtEnd(gameState: GameState) {
    const pendingTargets = Object.values(gameState.players).flatMap(player =>
      player.unitZone
        .filter((card): card is Card => !!card && !!(card as any).data?.destroyAtEndBy)
        .map(card => ({ player, card }))
    );

    pendingTargets.forEach(({ player, card }) => {
      const data = (card as any).data || {};
      const sourceName = data.destroyAtEndBy || '卡牌效果';
      const sourcePlayerUid = data.destroyAtEndSourcePlayerUid;
      const sourceCardId = data.destroyAtEndSourceCardId;

      delete data.destroyAtEndBy;
      delete data.destroyAtEndSourceCardId;
      delete data.destroyAtEndSourcePlayerUid;

      const moved = ServerGameService.moveCard(gameState, player.uid, 'UNIT', player.uid, 'GRAVE', card.gamecardId, {
        isEffect: true,
        effectSourcePlayerUid: sourcePlayerUid,
        effectSourceCardId: sourceCardId
      });

      if (!moved) return;

      gameState.logs.push(`[${sourceName}] 的延迟效果在回合结束时破坏了 [${card.fullName}]。`);
      EventEngine.dispatchEvent(gameState, {
        type: 'CARD_DESTROYED_EFFECT',
        targetCardId: card.gamecardId,
        playerUid: player.uid,
        data: { sourcePlayerId: sourcePlayerUid }
      });
    });
  },

  async finishTurnTransition(gameState: GameState) {
    try {

      const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
      const currentPlayer = gameState.players[currentPlayerId];

      if ((currentPlayer as any).loseAtEndOfTurn === gameState.turnCount) {
        gameState.gameStatus = 2;
        gameState.winReason = 'CARD_EFFECT_SPECIAL_WIN';
        gameState.winnerId = gameState.playerIds.find(id => id !== currentPlayerId);
        gameState.winSourceCardName = (currentPlayer as any).loseAtEndOfTurnSourceName || '卡牌效果';
        gameState.logs.push(`[游戏结束] ${currentPlayer.displayName} 因 [${gameState.winSourceCardName}] 的效果在回合结束时判负。`);
        return;
      }

      gameState.currentTurnPlayer = gameState.currentTurnPlayer === 0 ? 1 : 0;
      gameState.turnCount += 1;
      gameState.phase = 'START';
      gameState.phaseTimerStart = Date.now();
      const nextPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
      const nextPlayer = gameState.players[nextPlayerId];

      currentPlayer.isTurn = false;
      nextPlayer.isTurn = true;

      gameState.logs.push(`--- 鍥炲悎 ${gameState.turnCount}: ${nextPlayer.displayName} ---`);

      // 1. Process pending resolutions (End-of-Turn Effects)
      if (gameState.pendingResolutions && gameState.pendingResolutions.length > 0) {
        const resolutions = [...gameState.pendingResolutions];
        gameState.pendingResolutions = []; // Clear queue immediately

        for (const record of resolutions) {
          if (!record.effect || !record.effect.resolve) {
            continue;
          }

          try {
            const player = gameState.players[record.playerUid];
            if (player) {
              // Use Promise.race to prevent potential hangs in resolution scripts
              const resolvePromise = (record.effect.resolve as any)(record.card, gameState, player, record.event);
              await Promise.race([
                resolvePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error("Effect resolution timeout (5s)")), 5000))
              ]);
            }
          } catch (err: any) {
            gameState.logs.push(`[效果错误] ${record.card?.fullName || '未知来源'} 的阶段结束效果处理失败: ${err.message}`);
          }
        }
      }

      ServerGameService.processBt01DestroyAtEnd(gameState);

      // 2. Perform global cleanup/flag reset
      Object.values(gameState.players).forEach(p => {
        p.hasUnitReturnedThisTurn = false;
        p.hasExhaustedThisTurn = [];
        p.negatedNames = [];
        delete (p as any).windProductionTurn;
        delete (p as any).windProductionSourceName;
        delete (p as any).preventAllDamageTurn;
        delete (p as any).preventAllDamageSourceName;

        const allCards = [
          ...p.deck, ...p.hand, ...p.grave, ...p.exile,
          ...p.unitZone, ...p.itemZone, ...p.erosionFront, ...p.erosionBack, ...p.playZone
        ];
        allCards.forEach(card => {
          if (!card) return;
          card.temporaryCanActivateEffect = undefined;
          card.temporaryImmuneToUnitEffects = undefined;
          if ((card as any).data?.clearMirrorActiveTurn !== undefined) {
            delete (card as any).data.clearMirrorActiveTurn;
          }
          if ((card as any).data?.fullEffectSilencedTurn !== undefined) {
            delete (card as any).data.fullEffectSilencedTurn;
            delete (card as any).data.fullEffectSilenceSource;
          }
          if ((card as any).data?.combatImmuneUntilOwnNextTurnStartUid === nextPlayerId) {
            delete (card as any).data.combatImmuneUntilOwnNextTurnStartUid;
            delete (card as any).data.combatImmuneSourceName;
          }
          if ((card as any).data?.forcedAttackTurn !== undefined && (card as any).data.forcedAttackTurn < gameState.turnCount) {
            delete (card as any).data.forcedAttackTurn;
            delete (card as any).data.forcedAttackSourceName;
          }
          if ((card as any).data?.forbiddenAlchemyBanishTurn !== undefined && (card as any).data.forbiddenAlchemyBanishTurn < gameState.turnCount) {
            delete (card as any).data.forbiddenAlchemyBanishTurn;
            delete (card as any).data.forbiddenAlchemySourceName;
            delete (card as any).data.forbiddenAlchemyWillExileAtEndOfTurn;
          }
        });

        p.unitZone.forEach(u => {
          if (u) {
            u.hasAttackedThisTurn = false;
            u.usedShenyiThisTurn = false;
            u.inAllianceGroup = false;

            // Reset Temporary Buffs
            u.temporaryPowerBuff = 0;
            u.temporaryDamageBuff = 0;
            u.temporaryRush = false;
            u.temporaryAnnihilation = false;
            u.temporaryHeroic = false;
            u.temporaryCanAttackAny = false;
            u.temporaryBuffSources = {};
            u.temporaryBuffDetails = {};
            u.isrush = u.baseIsrush;
            u.isAnnihilation = u.baseAnnihilation || false;
            u.isHeroic = u.baseHeroic || false;
            u.power = u.basePower;
            u.damage = u.baseDamage;
          }
        });
      });

      // 3. Recalculate stats after any moves during resolutions
      EventEngine.recalculateContinuousEffects(gameState);

      // 4. Start the next phase
      EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', playerUid: nextPlayerId, data: { phase: 'START' } });
      await ServerGameService.checkTriggeredEffects(gameState);
      if (gameState.pendingQuery || gameState.phase !== 'START') return;
      await ServerGameService.executeStartPhase(gameState, nextPlayer);

    } catch (err: any) {
      gameState.logs.push(`[鑷村懡閿欒] 鍥炲悎鍒囨崲杩囩▼宕╂簝: ${err.message}`);
      // Ensure we don't block the server response despite the crash
      if (gameState.phase === 'DECLARE_END') {
        gameState.phase = 'START';
      }
    }
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

  checkBattleInterruption(gameState: GameState) {
    if (!gameState.battleState) return;

    let contextPhase = gameState.phase;
    if (gameState.phase === 'COUNTERING' || gameState.phase === 'SHENYI_CHOICE') {
      contextPhase = gameState.previousPhase || gameState.phase;
    }

    const battlePhases: GamePhase[] = ['BATTLE_DECLARATION', 'DEFENSE_DECLARATION', 'BATTLE_FREE'];
    if (!battlePhases.includes(contextPhase)) return;

    const turnPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const opponentId = gameState.playerIds[gameState.currentTurnPlayer === 0 ? 1 : 0];

    const turnPlayer = gameState.players[turnPlayerId];
    const opponent = gameState.players[opponentId];

    let defenderGone = false;
    if (gameState.battleState.defender) {
      const defenderFound = opponent.unitZone.some(c => c && c.gamecardId === gameState.battleState!.defender);
      if (!defenderFound) {
        defenderGone = true;
      }
    }

    if (gameState.battleState.unitTargetId) {
      const explicitFound = opponent.unitZone.some(c => c && c.gamecardId === gameState.battleState!.unitTargetId);
      if (!explicitFound) {
        defenderGone = true;
      }
    }

    // Verify attackers exist in their respective owner's zones
    const attackersFound = gameState.battleState.attackers.filter(id => {
      // Check both players since turn order might have shifted or an out-of-turn attack could occur
      return Object.values(gameState.players).some(p => p.unitZone.some(c => c && c.gamecardId === id));
    });

    const allAttackersGone = attackersFound.length === 0;

    if (defenderGone || allAttackersGone) {
      gameState.logs.push(`[战斗中止] ${defenderGone ? '防御/目标单位' : '所有攻击单位'} 已离开字段，战斗中止。`);

      const inConfrontation = gameState.isResolvingStack || (gameState.counterStack && gameState.counterStack.length > 0) || gameState.isCountering > 0;

      if (inConfrontation) {
        if (gameState.phase === 'COUNTERING') {
          gameState.previousPhase = 'MAIN';
        } else {
          gameState.phase = 'MAIN';
        }
        if (gameState.counterStack) {
          gameState.counterStack.forEach(item => {
            if (item.type === 'PHASE_END') {
              item.nextPhase = 'MAIN';
            }
          });
        }
      } else {
        gameState.phase = 'MAIN';
        if (gameState.previousPhase && battlePhases.includes(gameState.previousPhase)) {
          gameState.previousPhase = undefined;
        }
        gameState.phaseTimerStart = Date.now();
      }

      gameState.battleState = undefined;
      EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'BATTLE_INTERRUPTED' } });
    } else if (gameState.battleState.attackers.length !== attackersFound.length) {
      gameState.logs.push(`[战斗继续] 其中一个攻击单位已离开，剩余单位继续攻击。`);
      gameState.battleState.attackers = attackersFound;
    }
  },

  async executeTriggeredEffect(
    gameState: GameState,
    playerUid: string,
    trigger: { card: Card; effect: CardEffect; effectIndex: number; event?: any; skipCost?: boolean },
    onUpdate?: (state: GameState) => Promise<void>
  ) {
    const { card, effectIndex, event, skipCost } = trigger;
    const effect = trigger.effect || card.effects?.[effectIndex];

    if (!effect) {
      await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
      return;
    }

    const triggerLocation = card.cardlocation as TriggerLocation;
    const triggerCheck = ServerGameService.checkEffectLimitsAndReqs(gameState, playerUid, card, effect, triggerLocation, event);
    if (!triggerCheck.valid) {
      await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
      return;
    }

    // 1. Cost check (If needed and not skipped)
    if (effect.cost && !skipCost) {
      const player = gameState.players[playerUid];
      const costResult = await effect.cost(gameState, player, card);

      if (gameState.pendingQuery) {
        // If query triggered by cost, we must wait
        gameState.pendingQuery.callbackKey = 'ACTIVATE_COST_RESOLVE';
        gameState.pendingQuery.context = {
          ...gameState.pendingQuery.context,
          sourceCardId: card.gamecardId,
          effectIndex: effectIndex,
          isTrigger: true, // IMPORTANT: mark as trigger to avoid countering after cost
          event
        };
        return;
      }

      if (!costResult) {
        // Cost failed, proceed to next trigger
        await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
        return;
      }
    }

    // 2. Record usage
    ServerGameService.recordEffectUsage(gameState, playerUid, card, effect);

    // 3. Highlight for UI
    gameState.currentProcessingItem = {
      type: 'EFFECT',
      card,
      ownerUid: playerUid,
      effectIndex,
      timestamp: Date.now(),
      data: { event }
    };
    if (onUpdate) await onUpdate(gameState);

    // Record faction used
    const player = gameState.players[playerUid];
    if (card.faction && player) {
      if (!player.factionsUsedThisTurn) player.factionsUsedThisTurn = [];
      if (!player.factionsUsedThisTurn.includes(card.faction)) {
        player.factionsUsedThisTurn.push(card.faction);
      }
    }

    // Small pause for visual feedback
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 4. Atomic Effects
    if (effect.atomicEffects) {
      for (const atomic of effect.atomicEffects) {
        await AtomicEffectExecutor.execute(gameState, playerUid, atomic, card, event);
      }
    }

    // 5. Execute Legacy Callback
    if (effect.execute) {
      await (effect.execute as any)(card, gameState, gameState.players[playerUid], event);
    }

    ServerGameService.normalizeForcedGuardBattleState(gameState);
    EventEngine.recalculateContinuousEffects(gameState);

    // 6. Dispatch Event
    EventEngine.dispatchEvent(gameState, {
      type: 'EFFECT_ACTIVATED',
      playerUid,
      sourceCardId: card.gamecardId
    });

    gameState.logs.push(`[诱发结算] ${card.fullName} 的展示效果已结算。`);

    // 7. Cleanup highlight
    gameState.currentProcessingItem = null;
    if (onUpdate) await onUpdate(gameState);

    // 8. Resolve persistence
    if (effect.resolve) {
      gameState.pendingResolutions.push({
        card,
        effect,
        playerUid
      });
    }

    // 9. Continue trigger queue if no new query was opened
    if (!gameState.pendingQuery) {
      await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
    }
  },

  async advancePhase(gameState: GameState, action?: string, playerId?: string, onUpdate?: (state: GameState) => Promise<void>) {
    if (gameState.pendingQuery || gameState.isResolvingStack || gameState.currentProcessingItem) {
      throw new Error('当前有未结算阶段，请等待处理完毕。');
    }

    // Identity of the player performing the action
    const actingPlayerId = playerId || gameState.playerIds[gameState.currentTurnPlayer];
    const actingPlayer = gameState.players[actingPlayerId];

    // Identity of the current turn player (for phase transitions)
    const turnPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const turnPlayer = gameState.players[turnPlayerId];

    const now = Date.now();
    const elapsed = now - (gameState.phaseTimerStart || now);
    const sharedPhases: GamePhase[] = ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'];
    const isWaiting = (gameState.counterStack && gameState.counterStack.length > 0) ||
      (gameState.battleState && gameState.battleState.askConfront) ||
      gameState.isResolvingStack ||
      gameState.currentProcessingItem ||
      gameState.pendingQuery;

    if (sharedPhases.includes(gameState.phase) && !isWaiting) {
      if (actingPlayer) {
        actingPlayer.timeRemaining = Math.max(0, (actingPlayer.timeRemaining ?? GAME_TIMEOUTS.MAIN_PHASE_TOTAL) - elapsed);
      }
    }
    gameState.phaseTimerStart = now;

    switch (gameState.phase) {
      case 'INIT':
      case 'MULLIGAN':
        gameState.phase = 'START';
        gameState.turnCount = 1;
        gameState.logs.push(`[阶段切换] 进入开始阶段`);
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'START' } });
        await ServerGameService.checkTriggeredEffects(gameState, onUpdate);
        if (gameState.pendingQuery || gameState.phase !== 'START') return gameState;
        await ServerGameService.executeStartPhase(gameState, turnPlayer);
        break;
      case 'START':
        gameState.phase = 'DRAW';
        gameState.logs.push(`[阶段切换] 进入抽牌阶段`);
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'DRAW' } });
        await ServerGameService.executeDrawPhase(gameState, turnPlayer);
        break;
      case 'DRAW':
        gameState.phase = 'EROSION';
        gameState.logs.push(`[阶段切换] 进入侵蚀阶段`);
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'EROSION' } });
        await ServerGameService.executeErosionPhase(gameState, turnPlayer);
        break;
      case 'EROSION':
        // Handled by handleErosionChoice
        break;
      case 'MAIN':
        if ((action === 'DECLARE_END' || action === 'DISCARD') && ServerGameService.getForcedAttackUnit(gameState, actingPlayerId)) {
          const forcedAttackUnit = ServerGameService.getForcedAttackUnit(gameState, actingPlayerId)!;
          throw new Error(`必须先用 [${forcedAttackUnit.fullName}] 宣告攻击`);
        }
        if (action === 'DECLARE_BATTLE' || action === 'BATTLE_DECLARATION') {
          if (gameState.turnCount === 1) {
            throw new Error('先手玩家第一回合不能进入战斗阶段');
          }
          if (action === 'BATTLE_DECLARATION' || action === 'DECLARE_BATTLE') {
            gameState.phase = 'BATTLE_DECLARATION';
            EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'BATTLE_DECLARATION' } });
            gameState.logs.push(`[阶段切换] ${actingPlayer.displayName} 进入战斗阶段`);
          } else {
            gameState.logs.push(`[对抗请求] ${actingPlayer.displayName} 请求进入战斗阶段`);
            ServerGameService.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'BATTLE_DECLARATION',
              timestamp: Date.now()
            });
          }
        } else if (action === 'DECLARE_END' || action === 'DISCARD') {
          if (action === 'DISCARD') {
            gameState.logs.push(`[阶段切换] 进入弃牌阶段`);
            await ServerGameService.executeEndPhase(gameState, actingPlayer);
          } else {
            gameState.logs.push(`[对抗请求] ${actingPlayer.displayName} 请求结束回合`);
            ServerGameService.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'DISCARD', // Transition to discard/end
              timestamp: Date.now()
            });
          }
        }
        break;
      case 'BATTLE_DECLARATION':
        if (action === 'DECLARE_END' || action === 'DISCARD') {
          if (action === 'DISCARD') {
            gameState.logs.push(`[阶段切换] 进入弃牌阶段`);
            await ServerGameService.executeEndPhase(gameState, actingPlayer);
          } else {
            gameState.logs.push(`[对抗请求] ${actingPlayer.displayName} 请求结束回合`);
            ServerGameService.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'DISCARD',
              timestamp: Date.now()
            });
          }
        } else if (action === 'RETURN_MAIN' || action === 'MAIN') {
          if (action === 'MAIN' || action === 'RETURN_MAIN') {
            gameState.phase = 'MAIN';
            EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'RETURN_MAIN' } });
            gameState.logs.push(`[阶段切换] ${actingPlayer.displayName} 返回主要阶段`);
          } else {
            gameState.logs.push(`[对抗请求] ${actingPlayer.displayName} 请求返回主要阶段`);
            ServerGameService.enterCountering(gameState, actingPlayerId, {
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
          gameState.phase = 'MAIN';
          gameState.logs.push(`[阶段切换] 战斗状态缺失，返回主要阶段`);
          return gameState;
        }

        if (action === 'PROPOSE_DAMAGE_CALCULATION' || action === 'DAMAGE_CALCULATION') {
          if (action === 'DAMAGE_CALCULATION') {
            gameState.phase = 'DAMAGE_CALCULATION';
            gameState.logs.push(`[阶段切换] 进入伤害计算阶段`);
            await ServerGameService.resolveDamage(gameState);
          } else {
            // Use the standard countering system for ending the battle free phase
            ServerGameService.enterCountering(gameState, actingPlayerId, {
              ownerUid: actingPlayerId,
              type: 'PHASE_END',
              nextPhase: 'DAMAGE_CALCULATION',
              timestamp: Date.now()
            });
          }
        } else if (action === 'RETURN_MAIN') {
          gameState.phase = 'MAIN';
          gameState.battleState = undefined;
          EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'RETURN_MAIN' } });
          gameState.logs.push(`[阶段切换] 战斗中止，返回主要阶段`);
        }
        break;
      case 'BATTLE_END':
        gameState.phase = 'MAIN';
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN' } });
        gameState.battleState = undefined;
        gameState.logs.push(`[阶段切换] 战斗结束，返回主要阶段`);
        break;
      case 'DISCARD':
        // Handled by discardCard
        break;
      case 'END':
        // This case is now handled automatically in DECLARE_END
        break;
      case 'SHENYI_CHOICE':
        if (action === 'CONFIRM_SHENYI') {
          const cardIds = gameState.pendingShenyi?.cardIds || [];
          const player = gameState.players[actingPlayerId];
          cardIds.forEach(cid => {
            const unit = player.unitZone.find(u => u?.gamecardId === cid);
            if (unit) {
              ServerGameService.readyCard(unit);
              unit.usedShenyiThisTurn = true;
            }
          });
          gameState.logs.push(`【神依】效果已触发`);
        } else if (action === 'DECLINE_SHENYI') {
          const cardIds = gameState.pendingShenyi?.cardIds || [];
          const player = gameState.players[actingPlayerId];
          cardIds.forEach(cid => {
            const unit = player.unitZone.find(u => u?.gamecardId === cid);
            if (unit) unit.usedShenyiThisTurn = true;
          });
          gameState.logs.push(`已跳过【神依】触发`);
        }

        gameState.phase = gameState.previousPhase || 'MAIN';
        gameState.previousPhase = undefined;
        gameState.pendingShenyi = undefined;
        gameState.priorityPlayerId = undefined;
        gameState.phaseTimerStart = Date.now();
        break;
    }

    return gameState;
  },

  async executeStartPhase(gameState: GameState, player: PlayerState) {
    // console.log(`[ServerGameService] executeStartPhase for ${player.displayName}`);

    // Update public hand duration
    Object.values(gameState.players).forEach(p => {
      if (p.isHandPublic !== undefined && p.isHandPublic > 0) {
        p.isHandPublic -= 1;
        if (p.isHandPublic === 0) {
          gameState.logs.push(`${p.displayName} 的手牌已恢复私密状态`);
        }
      }

      p.negatedNames = [];

      // Reset target protection and effect negation
      [...p.deck, ...p.hand, ...p.grave, ...p.exile, ...p.unitZone, ...p.itemZone, ...p.erosionFront, ...p.erosionBack, ...p.playZone].forEach(c => {
        if (c) {
          c.nextEffectProtection = false;
          c.silencedEffectIds = [];
          c.temporaryCanActivateEffect = undefined;
          c.temporaryImmuneToUnitEffects = undefined;
          if ((c as any).data?.clearMirrorActiveTurn !== undefined) {
            delete (c as any).data.clearMirrorActiveTurn;
          }
          if ((c as any).data?.fullEffectSilencedTurn !== undefined) {
            delete (c as any).data.fullEffectSilencedTurn;
            delete (c as any).data.fullEffectSilenceSource;
          }
          if ((c as any).data?.combatImmuneUntilOwnNextTurnStartUid === player.uid) {
            delete (c as any).data.combatImmuneUntilOwnNextTurnStartUid;
            delete (c as any).data.combatImmuneSourceName;
          }
        }
      });
    });

    player.timeRemaining = (gameState.turnTimerLimit ? gameState.turnTimerLimit * 1000 : GAME_TIMEOUTS.MAIN_PHASE_TOTAL);
    const shouldSkipOwnStartReady = (card: Card | null) =>
      !!card && !!card.effects?.some(effect =>
        effect.type === 'CONTINUOUS' &&
        effect.content === 'SKIP_OWN_START_READY' &&
        (!effect.condition || effect.condition(gameState, player, card))
      );

    const unitsToReset = player.unitZone.filter(card =>
      card && card.isExhausted && (card.canResetCount === 0 || card.canResetCount === undefined)
    );
    const itemsToReset = player.itemZone.filter(card =>
      card &&
      card.isExhausted &&
      (card.canResetCount === 0 || card.canResetCount === undefined) &&
      !shouldSkipOwnStartReady(card)
    );

    // Check if any unit/item has a freeze counter that needs aging
    const unitsToAge = player.unitZone.filter(card =>
      card && card.canResetCount !== undefined && card.canResetCount > 0
    );
    const itemsToAge = player.itemZone.filter(card =>
      card && card.canResetCount !== undefined && card.canResetCount > 0
    );

    if (unitsToReset.length === 0 && itemsToReset.length === 0 && unitsToAge.length === 0 && itemsToAge.length === 0) {
      gameState.logs.push(`${player.displayName} 没有可调度的单位，直接进入抽牌阶段。`);
    } else {
      player.unitZone.forEach(card => {
        if (card) {
          card.temporaryPowerBuff = 0;
          if (card.canResetCount === 0 || card.canResetCount === undefined) {
            ServerGameService.readyCard(card);
          } else if (card && card.canResetCount !== undefined && card.canResetCount > 0) {
            card.canResetCount -= 1;
          }
        }
      });
      player.itemZone.forEach(card => {
        if (card && shouldSkipOwnStartReady(card)) {
          return;
        } else if (card && (card.canResetCount === 0 || card.canResetCount === undefined)) {
          ServerGameService.readyCard(card);
        } else if (card && card.canResetCount !== undefined && card.canResetCount > 0) {
          card.canResetCount -= 1;
        }
      });
      gameState.logs.push(`${player.displayName} 完成了调度。`);
    }

    player.hasExhaustedThisTurn = [];
    player.hasUnitReturnedThisTurn = false;
    player.factionsUsedThisTurn = [];
    player.factionLock = undefined;

    // Automatically move to DRAW phase
    gameState.phase = 'DRAW';
    gameState.phaseTimerStart = Date.now();
    await ServerGameService.executeDrawPhase(gameState, player);
  },

  async executeDrawPhase(gameState: GameState, player: PlayerState) {
    if (player.skipDrawPhase) {
      player.skipDrawPhase = false;
      gameState.logs.push(`${player.displayName} 的抽牌阶段被跳过了。`);
      gameState.phase = 'EROSION';
      await ServerGameService.executeErosionPhase(gameState, player);
      return;
    }

    gameState.logs.push(`${player.displayName} 的抽牌阶段`);


    // First player on first turn does not draw
    if (gameState.turnCount === 1) {
      gameState.logs.push('先手玩家第一回合不抽牌');
      gameState.phase = 'EROSION';
      await ServerGameService.executeErosionPhase(gameState, player);
      return;
    }

    // Check effects at DRAW phase (TODO)
    if (player.deck.length > 0) {
      const card = player.deck.pop();
      if (card) {
        card.cardlocation = 'HAND';
        player.hand.push(card);
        gameState.logs.push(`${player.displayName} 鎶戒簡涓€寮犲崱`);
        EventEngine.dispatchEvent(gameState, {
          type: 'CARD_DRAWN',
          playerUid: player.uid,
          data: { cardId: card.gamecardId }
        });
        await ServerGameService.checkTriggeredEffects(gameState);
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
    await ServerGameService.executeErosionPhase(gameState, player);
  },

  async executeErosionPhase(gameState: GameState, player: PlayerState) {
    // console.log(`[ServerGameService] executeErosionPhase for ${player.displayName}`);
    const handleableCards = player.erosionFront.filter(c => c !== null);
    // console.log(`[ServerGameService] Found ${handleableCards.length} cards in erosion front`);

    if (handleableCards.length === 0) {
      gameState.logs.push(`${player.displayName} 侵蚀区没有正面卡，跳过侵蚀阶段。`);
      gameState.phase = 'MAIN';
      gameState.logs.push(`${player.displayName} 进入主要阶段`);
      EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'MAIN_PHASE_START' } });
      // console.log(`[ServerGameService] No face-up cards, auto-moving to MAIN phase`);
    } else {
      gameState.logs.push(`${player.displayName} 进入侵蚀阶段，请选择处理方式。`);
      // console.log(`[ServerGameService] Waiting for erosion choice`);
    }
  },


  async handleErosionChoice(gameState: GameState, playerId: string, choice: 'A' | 'B' | 'C', selectedCardId?: string) {

    const player = gameState.players[playerId];
    if (gameState.phase !== 'EROSION' || !player.isTurn) throw new Error('Not in erosion phase or not your turn');

    const handleableCards = player.erosionFront.filter(c => c !== null) as Card[];

    // Identify cards going to grave
    let goingToGrave: Card[] = [];
    if (choice === 'A') goingToGrave = [...handleableCards];
    else if (choice === 'B' || choice === 'C') goingToGrave = handleableCards.filter(c => c.gamecardId !== selectedCardId);

    // Check for EROSION_KEEP effects (104030455)
    const keepEffectCard = player.unitZone.find(c =>
      c && c.effects && c.effects.some(e =>
        e.erosionKeepReplacement &&
        (!e.condition || e.condition(gameState, player, c))
      )
    );

    if (keepEffectCard && goingToGrave.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerId,
        options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerId, goingToGrave.map(c => ({ card: c, source: 'EROSION_FRONT' }))),
        title: '选择保留的侵蚀卡',
          description: `由于 [${keepEffectCard.fullName}] 的效果，你可以从即将移至墓地的卡牌中选择一张保留在侵蚀区。`,
        minSelections: 0,
        maxSelections: 1,
        callbackKey: 'EROSION_KEEP_RESOLVE',
        context: {
          choice,
          selectedCardId,
          keepCardSourceId: keepEffectCard.gamecardId
        }
      };
      return;
    }

    ServerGameService.executeErosionMovements(gameState, playerId, choice, selectedCardId);

    if (gameState.phase !== 'SHENYI_CHOICE') {
      gameState.phase = 'MAIN';
      gameState.phaseTimerStart = Date.now();
      gameState.logs.push(`${player.displayName} 进入主要阶段`);
      EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN', reason: 'MAIN_PHASE_START' } });
    } else {
      gameState.previousPhase = 'MAIN';
    }
    await ServerGameService.checkTriggeredEffects(gameState);
  },

  executeErosionMovements(gameState: GameState, playerId: string, choice: 'A' | 'B' | 'C', selectedCardId?: string, keptCardId?: string) {
    const player = gameState.players[playerId];
    const handleableCards = player.erosionFront.filter(c => c !== null) as Card[];

    if (choice === 'A') {
      // a. Move all cards in the Erosion Zone to the Graveyard
      for (const card of handleableCards) {
        if (card.gamecardId === keptCardId) {
          gameState.logs.push(`[白夜效果] ${card.fullName} 被保留在侵蚀区。`);
          continue;
        }
        ServerGameService.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', card.gamecardId);
      }
      gameState.logs.push(`${player.displayName} 将侵蚀区所有正面卡移至墓地。`);
    } else if (choice === 'B') {
      // b. Choose one card to keep; others to Graveyard
      if (!selectedCardId) throw new Error('Please select a card to keep');
      for (const card of handleableCards) {
        if (card.gamecardId !== selectedCardId && card.gamecardId !== keptCardId) {
          ServerGameService.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', card.gamecardId);
        } else if (card.gamecardId === keptCardId && card.gamecardId !== selectedCardId) {
            gameState.logs.push(`[白夜效果] ${card.fullName} 被额外保留在侵蚀区。`);
        }
      }
        gameState.logs.push(`${player.displayName} 选择保留一张正面卡，其余移至墓地。`);
    } else if (choice === 'C') {
      // c. Choose one to hand; others to Graveyard; then top card to Erosion Zone face-down
      if (!selectedCardId) throw new Error('Please select a card to add to hand');
      for (const card of handleableCards) {
        if (card.gamecardId === selectedCardId) {
          ServerGameService.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'HAND', card.gamecardId);
        } else if (card.gamecardId === keptCardId) {
            gameState.logs.push(`[白夜效果] ${card.fullName} 被保留在侵蚀区。`);
        } else {
          ServerGameService.moveCard(gameState, playerId, 'EROSION_FRONT', playerId, 'GRAVE', card.gamecardId);
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
  },

  async executeEndPhase(gameState: GameState, player: PlayerState, skipEvents: boolean = false) {
    if (!skipEvents) {
      gameState.phase = 'END';
      gameState.logs.push(`${player.displayName} 的结束阶段`);

      player.unitZone.forEach(unit => {
        if (!unit || !unit.isHeroic || !unit.hasAttackedThisTurn || !unit.isExhausted) {
          return;
        }

        ServerGameService.readyCard(unit);
        gameState.logs.push(`【英勇】效果触发，${unit.fullName} 在回合结束时被重置。`);
      });

      // Dispatch TURN_END event to allow end-of-turn triggers to fire while it's still the player's turn
      EventEngine.dispatchEvent(gameState, {
        type: 'TURN_END' as any,
        playerUid: player.uid
      });

      // Check if any triggers were added to the queue
      if (gameState.triggeredEffectsQueue && gameState.triggeredEffectsQueue.length > 0) {
        await ServerGameService.checkTriggeredEffects(gameState);
        // If we now have a pending query, don't proceed to turn transition yet
        if (gameState.pendingQuery) return;
        if (gameState.phase !== 'END' || !gameState.players[player.uid]?.isTurn) return;
      }
    }

    player.factionLock = undefined;

    // This block is reachable either initially (if no triggers) or via resumption from checkTriggeredEffects
    if (player.hand.length > 6) {
      gameState.phase = 'DISCARD';
        gameState.logs.push(`${player.displayName} 手牌超过 6 张，请弃置卡牌。`);
    } else {
      player.markedUnitAttackTarget = undefined;
      await ServerGameService.finishTurnTransition(gameState);
    }
  },


  // Create a new game and wait for opponent
  async createGame(deck: Card[]) {
    // Auth check placeholder removed (always truthy in temp environment)

    const validation = ServerGameService.validateDeck(deck);
    if (!validation.valid) throw new Error(validation.error);

    const tempId = Math.random().toString(36).substring(7);
    const initializedDeck = deck.map(card => ({
      ...card,
      baseColorReq: card.baseColorReq ?? { ...(card.colorReq || {}) },
      basePower: card.basePower ?? card.power,
      baseDamage: card.baseDamage ?? card.damage,
      baseIsrush: card.baseIsrush ?? card.isrush,
      isAnnihilation: card.isAnnihilation,
      baseAnnihilation: card.baseAnnihilation ?? card.isAnnihilation,
      isShenyi: card.isShenyi,
      baseShenyi: card.baseShenyi ?? card.isShenyi,
      isHeroic: card.isHeroic,
      baseHeroic: card.baseHeroic ?? card.isHeroic,
      hasAttackedThisTurn: false,
      usedShenyiThisTurn: false,
      baseCanAttack: card.baseCanAttack ?? card.canAttack,
      baseGodMark: card.baseGodMark ?? card.godMark,
      baseAcValue: card.baseAcValue ?? card.acValue,
      baseCanActivateEffect: card.baseCanActivateEffect ?? card.canActivateEffect ?? true
    }));

    const initialPlayerState: PlayerState = {
      uid: ({ uid: "temp", displayName: "temp" } as any).uid,
      displayName: ({ uid: "temp", displayName: "temp" } as any).displayName || 'Player 1',
      deck: ServerGameService.assignGameCardIds(ServerGameService.shuffle([...initializedDeck])),
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
      timeRemaining: GAME_TIMEOUTS.MAIN_PHASE_TOTAL,
      confrontationStrategy: 'AUTO',
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
      phaseTimerStart: 0
    };
    return gameState;
  },

  // Create a practice game with a bot
  async createPracticeGame(deck: Card[]) {
    // Auth check placeholder removed (always truthy in temp environment)

    const validation = ServerGameService.validateDeck(deck);
    if (!validation.valid) throw new Error(validation.error);

    const initializedDeck = deck.map(card => ({
      ...card,
      baseColorReq: card.baseColorReq ?? { ...(card.colorReq || {}) },
      basePower: card.basePower ?? card.power,
      baseDamage: card.baseDamage ?? card.damage,
      baseIsrush: card.baseIsrush ?? card.isrush,
      isAnnihilation: card.isAnnihilation,
      baseAnnihilation: card.baseAnnihilation ?? card.isAnnihilation,
      isShenyi: card.isShenyi,
      baseShenyi: card.baseShenyi ?? card.isShenyi,
      isHeroic: card.isHeroic,
      baseHeroic: card.baseHeroic ?? card.isHeroic,
      hasAttackedThisTurn: false,
      usedShenyiThisTurn: false,
      baseCanAttack: card.baseCanAttack ?? card.canAttack,
      baseGodMark: card.baseGodMark ?? card.godMark,
      baseAcValue: card.baseAcValue ?? card.acValue,
      baseCanActivateEffect: card.baseCanActivateEffect ?? card.canActivateEffect ?? true
    }));

    const tempId = 'practice_' + Math.random().toString(36).substring(7);
    const myState: PlayerState = {
      uid: ({ uid: "temp", displayName: "temp" } as any).uid,
      displayName: ({ uid: "temp", displayName: "temp" } as any).displayName || 'Player 1',
      deck: ServerGameService.assignGameCardIds(ServerGameService.shuffle([...initializedDeck])),
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
      timeRemaining: GAME_TIMEOUTS.MAIN_PHASE_TOTAL,
      confrontationStrategy: 'AUTO',
    };

    const botState: PlayerState = {
      uid: 'BOT_PLAYER',
      displayName: '神蚀 AI',
      deck: ServerGameService.assignGameCardIds(ServerGameService.shuffle([...initializedDeck])), // Bot uses same deck as player
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
      timeRemaining: GAME_TIMEOUTS.MAIN_PHASE_TOTAL,
      confrontationStrategy: 'AUTO',
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
      phaseTimerStart: 0
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
      player.deck = [...player.deck, ...cardsToReturn.map(c => ({ ...c, cardlocation: 'DECK' }))];

      // Shuffle
      player.deck = ServerGameService.shuffle(player.deck);

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
      ServerGameService.executeStartPhase(gameState, firstPlayer);
    }
  },

  async endTurn(gameState: GameState) {
    return ServerGameService.advancePhase(gameState, 'DECLARE_END');
  },

  async surrender(gameState: GameState, playerUid: string) {
    const player = gameState.players[playerUid];
    const opponentId = gameState.playerIds.find(id => id !== playerUid);

    gameState.gameStatus = 2;
    gameState.winnerId = opponentId;
    gameState.winReason = 'SURRENDER';
    gameState.logs.push(`[游戏结束] ${player.displayName} 选择了投降。`);

    return gameState;
  },

  // Bot logic
  async botMove(gameState: GameState, onUpdate?: (state: GameState) => Promise<void>) {
    const bot = gameState.players['BOT_PLAYER'];
    if (!bot) return;

    // Handle Generic Queries (New)
    if (gameState.pendingQuery && gameState.pendingQuery.playerUid === 'BOT_PLAYER') {
      const query = gameState.pendingQuery;
      // console.log(`[Bot] Handling query: ${query.type} (${query.callbackKey})`);

      let selections: string[] = [];

      if (query.type === 'SELECT_PAYMENT') {
        // Simple payment: pick the first N cards needed to cover cost
        const player = gameState.players['BOT_PLAYER'];
        const handIds = player.hand.map(c => c.gamecardId);
        const unitsInZone = player.unitZone.filter(c => c && !c.isExhausted).map(c => c!.gamecardId);

        // Mock a simple payment selection
        const payment = {
          trashIds: handIds.slice(0, query.paymentCost || 0),
          exhaustIds: unitsInZone.slice(0, Math.max(0, (query.paymentCost || 0) - handIds.length))
        };
        selections = [JSON.stringify(payment)];
      } else if (query.callbackKey === 'TRIGGER_CHOICE') {
        selections = ['YES'];
      } else if (query.options && query.options.length > 0) {
        // Pick first N valid options
        const min = query.minSelections || 1;
        selections = query.options.slice(0, min).map(o => o.id);
      } else if (query.type === 'SELECT_TARGET') {
        // If no options but title/description, might be manual click? 
        // But server queries usually have options.
      }

      await ServerGameService.handleQueryChoice(gameState, 'BOT_PLAYER', query.id, selections, onUpdate);
      return;
    }

    // Handle Countering (Bot chooses to pass priority)
    if (gameState.phase === 'COUNTERING') {
      if (gameState.priorityPlayerId === 'BOT_PLAYER') {
        // console.log('[Bot] Passing confrontation priority');
        await ServerGameService.passConfrontation(gameState, 'BOT_PLAYER', onUpdate);
      }
      return;
    }

    // Handle Shenyi Choice (Bot chooses to confirm)
    if (gameState.phase === 'SHENYI_CHOICE' && gameState.priorityPlayerId === 'BOT_PLAYER') {
      await ServerGameService.advancePhase(gameState, 'CONFIRM_SHENYI', 'BOT_PLAYER');
      return;
    }

    // Handle Defense Declaration (Smart Defense)
    if (gameState.phase === 'DEFENSE_DECLARATION') {
      const attackerUid = Object.keys(gameState.players).find(uid => gameState.players[uid].isTurn);
      if (attackerUid && attackerUid !== 'BOT_PLAYER') {
        const attacker = gameState.players[attackerUid];
        const attackingUnits = (gameState.battleState?.attackers || []).map(id =>
          attacker.unitZone.find(c => c?.gamecardId === id)
        ).filter(Boolean) as Card[];
        const totalAttackerPower = attackingUnits.reduce((sum, u) => sum + (u.power || 0), 0);
        const totalAttackerDamage = attackingUnits.reduce((sum, u) => sum + (u.damage || 0), 0);
        const botErosionCount = bot.erosionFront.filter(Boolean).length + bot.erosionBack.filter(Boolean).length;

        const lockedTargetId = gameState.battleState?.defenseLockedToTargetId;
        const minPower = gameState.battleState?.defensePowerRestriction || 0;
        const maxPower = gameState.battleState?.defenseMaxPowerRestriction;
        const availableDefenders = bot.unitZone.filter(c =>
          c &&
          !c.isExhausted &&
          !(c as any).battleForbiddenByEffect &&
          (!lockedTargetId || c.gamecardId === lockedTargetId) &&
          (c.power || 0) >= minPower &&
          (maxPower === undefined || (c.power || 0) < maxPower)
        );

        // 1. Find best "Winner" (Power > Attacker)
        let defender = availableDefenders.find(c => (c.power || 0) > totalAttackerPower);

        // 2. If no winner, find a "Trader" (Power == Attacker)
        if (!defender) {
          defender = availableDefenders.find(c => (c.power || 0) === totalAttackerPower);
        }

        // 3. If still no defender, consider a "Sacrifice" block (Power < Attacker)
        // Heuristic: Sacrifice if health is low (erosion >= 7) OR incoming damage is high (damage >= 2)
        if (!defender && (botErosionCount >= 7 || totalAttackerDamage >= 2)) {
          // Choose the weakest available unit to sacrifice
          defender = [...availableDefenders].sort((a, b) => (a.power || 0) - (b.power || 0))[0];
        }

        if (defender) {
          await ServerGameService.declareDefense(gameState, 'BOT_PLAYER', defender.gamecardId);
        } else {
          await ServerGameService.declareDefense(gameState, 'BOT_PLAYER', undefined);
        }
        return;
      }
    }

    // Handle Discard Phase
    if (gameState.phase === 'DISCARD' && bot.isTurn) {
      if (bot.hand.length > 6) {
        await ServerGameService.discardCard(gameState, 'BOT_PLAYER', bot.hand[0].gamecardId);
      }
      return;
    }

    // Battle Free Phase response (as Opponent)
    if (gameState.phase === 'BATTLE_FREE' && !bot.isTurn) {
      if (gameState.battleState && gameState.battleState.askConfront === 'ASKING_OPPONENT') {
        // console.log('[Bot] Declining confrontation in BATTLE_FREE as Opponent');
        await ServerGameService.advancePhase(gameState, 'DECLINE_CONFRONTATION', 'BOT_PLAYER');
        return;
      }
    }

    if (!bot.isTurn) return;

    // Handle Erosion Phase
    if (gameState.phase === 'EROSION') {
      await ServerGameService.handleErosionChoice(gameState, 'BOT_PLAYER', 'A');
      return;
    }

    // Main Phase Logic
    if (gameState.phase === 'MAIN') {
      const forcedAttackUnit = ServerGameService.getForcedAttackUnit(gameState, 'BOT_PLAYER');
      if (forcedAttackUnit) {
        await ServerGameService.advancePhase(gameState, 'DECLARE_BATTLE');
        return;
      }

      // Sequentially play all possible cards from hand
      for (const card of bot.hand) {
        const canPlay = ServerGameService.canPlayCard(gameState, bot, card);
        if (canPlay.canPlay) {
          try {
            await ServerGameService.playCard(gameState, 'BOT_PLAYER', card.gamecardId, {});
            // We return and let the next botMove tick handle the next card to ensure stack resolution
            return;
          } catch (e) {
            // console.error('Bot failed to play card', e);
          }
        }
      }

      // If no cards can be played, try to enter battle or end turn
      const canAttack = bot.unitZone.some(c => {
        if (!c || c.isExhausted || c.canAttack === false) return false;
        if ((c.damage || 0) < 1) return false; // Rule 2: Robots will not attack with units having damage < 1
        const isRush = !!c.isrush;
        const wasPlayedThisTurn = c.playedTurn === gameState.turnCount;
        return isRush || !wasPlayedThisTurn;
      });

      if (gameState.turnCount > 1 && canAttack) {
        // Enter battle phase only if we haven't already exhausted all attackers this AI iteration
        // To prevent infinite re-entry to BATTLE_DECLARATION from MAIN, we check if there's truly something new to do
        // console.log('[Bot] Entering Battle Phase');
        await ServerGameService.advancePhase(gameState, 'DECLARE_BATTLE');
      } else {
        // console.log('[Bot] Ending Turn');
        await ServerGameService.advancePhase(gameState, 'DECLARE_END');
      }
      return;
    }

    // Battle Declaration Phase
    if (gameState.phase === 'BATTLE_DECLARATION' && bot.isTurn) {
      const forcedAttackUnit = ServerGameService.getForcedAttackUnit(gameState, 'BOT_PLAYER');
      const attacker = forcedAttackUnit || bot.unitZone.find(c => {
        if (!c || c.isExhausted || c.canAttack === false) return false;
        if ((c.damage || 0) < 1) return false; // Rule 2: Robots will not attack with units having damage < 1
        const isRush = !!c.isrush;
        const wasPlayedThisTurn = c.playedTurn === gameState.turnCount;
        return isRush || !wasPlayedThisTurn;
      });
      if (attacker) {
        await ServerGameService.declareAttack(gameState, 'BOT_PLAYER', [attacker.gamecardId], false, undefined, undefined, onUpdate);
      } else {
        await ServerGameService.advancePhase(gameState, 'RETURN_MAIN');
      }
      return;
    }

    // Battle Free Phase (as Turn Player)
    if (gameState.phase === 'BATTLE_FREE' && bot.isTurn) {
      if (!gameState.battleState?.askConfront) {
        // Bot proposes calculation to give player a chance to counter
        // console.log('[Bot] Proposing damage calculation in BATTLE_FREE');
        await ServerGameService.advancePhase(gameState, 'PROPOSE_DAMAGE_CALCULATION');
      } else if (gameState.battleState.askConfront === 'ASKING_TURN_PLAYER') {
        // Player declined, bot now asked if it wants to counter? 
        // Bot usually just declines to get to resolution.
        // console.log('[Bot] Declining confrontation in BATTLE_FREE (ASKING_TURN_PLAYER)');
        await ServerGameService.advancePhase(gameState, 'DECLINE_CONFRONTATION');
      }
      return;
    }

    // Damage Calculation Phase
    if (gameState.phase === 'DAMAGE_CALCULATION') {
      await ServerGameService.resolveDamage(gameState);
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

  async createPracticeGameState(deck: Card[], playerUid: string, playerName: string, turnTimerLimit?: number): Promise<GameState> {
    const initializedDeck = deck.map(card => ({
      ...card,
      baseColorReq: card.baseColorReq ?? { ...(card.colorReq || {}) },
      basePower: card.basePower ?? card.power,
      baseDamage: card.baseDamage ?? card.damage,
      baseIsrush: card.baseIsrush ?? card.isrush,
      isAnnihilation: card.isAnnihilation,
      baseAnnihilation: card.baseAnnihilation ?? card.isAnnihilation,
      isShenyi: card.isShenyi,
      baseShenyi: card.baseShenyi ?? card.isShenyi,
      isHeroic: card.isHeroic,
      baseHeroic: card.baseHeroic ?? card.isHeroic,
      hasAttackedThisTurn: false,
      usedShenyiThisTurn: false,
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
      deck: ServerGameService.assignGameCardIds(ServerGameService.shuffle([...initializedDeck])),
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
      timeRemaining: turnTimerLimit ? turnTimerLimit * 1000 : GAME_TIMEOUTS.MAIN_PHASE_TOTAL,
      confrontationStrategy: 'AUTO',
    };

    const botState: PlayerState = {
      uid: 'BOT_PLAYER',
      displayName: '神蚀 AI',
      deck: ServerGameService.assignGameCardIds(ServerGameService.shuffle([...initializedDeck])),
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
      timeRemaining: turnTimerLimit ? turnTimerLimit * 1000 : GAME_TIMEOUTS.MAIN_PHASE_TOTAL,
      confrontationStrategy: 'AUTO',
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
      mode: 'practice',
      phaseTimerStart: 0,
      turnTimerLimit,
      triggeredEffectsQueue: [],
      pendingResolutions: [],
      effectUsage: {}
    };

    // Correctly set isTurn for the initial player
    const firstPlayerUid = gameState.playerIds[firstIdx];
    gameState.players[firstPlayerUid].isTurn = true;

    return gameState;
  },

  async createMatchGameState(uid1: string, deck1: Card[], uid2: string, deck2: Card[], turnTimerLimit?: number): Promise<GameState> {
    const init1 = ServerGameService.assignGameCardIds(ServerGameService.shuffle(deck1.map(c => ({ ...c, cardlocation: 'DECK', displayState: 'FRONT_FACEDOWN' }))));
    const init2 = ServerGameService.assignGameCardIds(ServerGameService.shuffle(deck2.map(c => ({ ...c, cardlocation: 'DECK', displayState: 'FRONT_FACEDOWN' }))));

    const p1: PlayerState = {
      uid: uid1, displayName: 'Player 1', deck: init1, hand: [], grave: [], exile: [], itemZone: Array(6).fill(null), erosionFront: Array(10).fill(null), erosionBack: Array(10).fill(null), unitZone: Array(6).fill(null), playZone: [],
      isTurn: false, isFirst: false, mulliganDone: false, hasExhaustedThisTurn: [],
      isHandPublic: 0,
      timeRemaining: turnTimerLimit ? turnTimerLimit * 1000 : GAME_TIMEOUTS.MAIN_PHASE_TOTAL,
      confrontationStrategy: 'AUTO',
    };
    const p2: PlayerState = {
      uid: uid2, displayName: 'Player 2', deck: init2, hand: [], grave: [], exile: [], itemZone: Array(6).fill(null), erosionFront: Array(10).fill(null), erosionBack: Array(10).fill(null), unitZone: Array(6).fill(null), playZone: [],
      isTurn: false, isFirst: false, mulliganDone: false, hasExhaustedThisTurn: [],
      isHandPublic: 0,
      timeRemaining: turnTimerLimit ? turnTimerLimit * 1000 : GAME_TIMEOUTS.MAIN_PHASE_TOTAL,
      confrontationStrategy: 'AUTO',
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
      playerIds: [uid1, uid2], gameStatus: 1, logs: ['匹配成功。对局开始。'],
      players: { [uid1]: p1, [uid2]: p2 },
      mode: 'match',
      phaseTimerStart: 0,
      turnTimerLimit,
      triggeredEffectsQueue: [],
      pendingResolutions: [],
      effectUsage: {}
    };

    // Correctly set isTurn for the initial player
    const firstPlayerUid = gameState.playerIds[firstIdx];
    gameState.players[firstPlayerUid].isTurn = true;

    return gameState;
  },
};

// Link shared service to server-side implementation
(GameService as any).destroyUnit = ServerGameService.destroyUnit;
(GameService as any).triggerGoddessTransformation = ServerGameService.triggerGoddessTransformation;
(GameService as any).refreshCardAsNewInstance = ServerGameService.refreshCardAsNewInstance;
