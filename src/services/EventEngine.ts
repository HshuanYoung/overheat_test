import { GameState, PlayerState, Card, GameEvent, CardEffect, TriggerLocation } from '../types/game';
import { GameService } from './gameService';
import { AtomicEffectExecutor } from './AtomicEffectExecutor';
import { getCardIdentity } from '../lib/utils';

export class EventEngine {
  private static isFullEffectSilenced(gameState: GameState, card: Card) {
    return (card as any).data?.fullEffectSilencedTurn === gameState.turnCount;
  }

  static dispatchEvent(gameState: GameState, event: GameEvent) {
    // 1. Find all active effects that listen to this event
    const triggeredEffects: { card: Card, effect: CardEffect, effectIndex: number, playerUid: string }[] = [];

    const BATTLEFIELD_ZONES: TriggerLocation[] = ['UNIT', 'ITEM'];

    const checkPlayerCards = (player: PlayerState) => {
      // activeZones: units and items are always active. 
      // erosionFront cards are active (e.g. for continuous effects like color), 
      // but TRIGGER effects should only fire if the card is in an allowed triggerLocation.
      const activeZones = [
        ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack,
        ...player.playZone, ...player.grave, ...player.hand, ...player.exile, ...player.deck
      ];

      activeZones.forEach(card => {
        if (card && card.effects) {
          card.effects.forEach((effect, index) => {
            const isEventMatch = !effect.triggerEvent || 
              (Array.isArray(effect.triggerEvent) ? effect.triggerEvent.includes(event.type) : effect.triggerEvent === event.type);

            if ((effect.type === 'TRIGGERED' || effect.type === 'TRIGGER') && isEventMatch) {

              // New: Check if the card's current location is in the effect's triggerLocation array
              // If triggerLocation is not specified, default depends on the card type (usually UNIT/ITEM for units)
              const cardLoc = card.cardlocation as TriggerLocation;
              let allowedLocations = effect.triggerLocation || BATTLEFIELD_ZONES;

              // Story cards can be activated from Hand or Play zone by default
              if (!effect.triggerLocation && card.type === 'STORY') {
                allowedLocations = [...BATTLEFIELD_ZONES, 'HAND', 'PLAY'];
              }

              if (!allowedLocations.includes(cardLoc)) {
                return;
              }

              // Check limits and requirements
              if (!GameService.checkEffectLimitsAndReqs(gameState, player.uid, card, effect, cardLoc, event)) {
                return;
              }

              // Robust Self-Identification
              const isEventSelf = (event.sourceCard === card) ||
                (event.sourceCard?.runtimeFingerprint && event.sourceCard.runtimeFingerprint === card.runtimeFingerprint) ||
                (event.sourceCardId && event.sourceCardId === card.gamecardId) ||
                (event.targetCardId && event.targetCardId === card.gamecardId);

              // Guard: For specific card-entry/action events, default to self-trigger unless explicitly global
              const isMovementEvent = ['CARD_ENTERED_ZONE', 'CARD_LEFT_ZONE', 'CARD_LEFT_FIELD', 'CARD_PLAYED', 'CARD_ATTACK_DECLARED', 'CARD_DESTROYED_BATTLE', 'CARD_DESTROYED_EFFECT'].includes(event.type);

              if (isMovementEvent && !effect.isGlobal && !isEventSelf) {
                // If it's a movement/entry event for another card and this effect is not global, skip it
                return;
              }

              if (!effect.condition || effect.condition(gameState, player, card, event)) {
                // Diagnostic log
                if (event.type === 'CARD_ENTERED_ZONE') {
                  const sourceIdentity = getCardIdentity(gameState, event.playerUid || player.uid, event.sourceCard || { gamecardId: event.sourceCardId });
                  const sourceName = event.sourceCard?.fullName || '未知卡牌';
                  const targetIdentity = getCardIdentity(gameState, player.uid, card);
                  gameState.logs.push(`[Induction-Check] ${targetIdentity} ${card.fullName} evaluates ${sourceIdentity} ${sourceName}. Match!`);
                }
                triggeredEffects.push({ card, effect, effectIndex: index, playerUid: player.uid });
              }
            }
          });
        }
      });
    };

    Object.values(gameState.players).forEach(checkPlayerCards);

    // 2. Queue all valid triggers into the triggeredEffectsQueue for sequential resolution
    for (const { card, effect, effectIndex, playerUid } of triggeredEffects) {
      const hasQueuedDuplicate = !!(
        effect.limitCount === 1 &&
        gameState.triggeredEffectsQueue?.some(item =>
          item.playerUid === playerUid &&
          item.card?.gamecardId === card.gamecardId &&
          (item.effect?.id || '') === (effect.id || '') &&
          item.effectIndex === effectIndex
        )
      );
      const hasPendingDuplicate = !!(
        effect.limitCount === 1 &&
        gameState.pendingQuery?.callbackKey === 'TRIGGER_CHOICE' &&
        gameState.pendingQuery?.playerUid === playerUid &&
        gameState.pendingQuery?.context?.sourceCardId === card.gamecardId &&
        gameState.pendingQuery?.context?.effectIndex === effectIndex
      );

      if (hasQueuedDuplicate || hasPendingDuplicate) {
        continue;
      }

      if (!gameState.triggeredEffectsQueue) gameState.triggeredEffectsQueue = [];
      gameState.triggeredEffectsQueue.push({ card, effect, effectIndex, playerUid, event });
      const identity = getCardIdentity(gameState, playerUid, card);
      gameState.logs.push(`[诱发入队] ${identity} ${card.fullName} 的效果已入队，待系统处理。`);
    }
  }

  static recalculateContinuousEffects(gameState: GameState) {
    // 0. Update Goddess Mode status based on erosion count
    Object.values(gameState.players).forEach(player => {
      const totalErosion = player.erosionFront.filter(c => c !== null).length + 
                           player.erosionBack.filter(c => c !== null).length;
      
      if (player.isGoddessMode && totalErosion < 10) {
        player.isGoddessMode = false;
        gameState.logs.push(`${player.displayName} 的侵蚀区卡牌不足 10 张，退出了女神化状态。`);
        
        this.dispatchEvent(gameState, {
          type: 'GODDESS_EXIT',
          playerUid: player.uid
        });
      }
    });

    // 0. Reset global battle properties that are recalculated
    if (gameState.battleState) {
      gameState.battleState.defensePowerRestriction = 0;
    }

    // 1. Reset all cards to base stats
    const resetCards = (player: PlayerState) => {
      const allCards = [
        ...player.deck, ...player.hand, ...player.grave, ...player.exile,
        ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack, ...player.playZone
      ];
      allCards.forEach(card => {
        if (card) {
          if (!card.baseColorReq) {
            card.baseColorReq = { ...(card.colorReq || {}) };
          }
          card.colorReq = { ...(card.baseColorReq || {}) };
          if (card.basePower !== undefined) card.power = card.basePower + (card.temporaryPowerBuff || 0);
          if (card.baseDamage !== undefined) card.damage = card.baseDamage + (card.temporaryDamageBuff || 0);
          if (card.baseIsrush !== undefined) card.isrush = card.baseIsrush || !!card.temporaryRush;
          if (card.baseCanAttack !== undefined) card.canAttack = card.baseCanAttack;
          if (card.temporaryCanAttackAny !== undefined && card.temporaryCanAttackAny) {
            // "Full Attack" logic: potentially update some property that battle system checks
            // For now we just keep the property on the object
          }
          if (card.baseGodMark !== undefined) card.godMark = card.baseGodMark;
          if (card.baseAcValue !== undefined) card.acValue = card.baseAcValue;
          card.canActivateEffect = card.baseCanActivateEffect !== undefined ? card.baseCanActivateEffect : true;
          if (card.temporaryCanActivateEffect !== undefined) {
            card.canActivateEffect = card.temporaryCanActivateEffect;
          }
          card.isImmuneToUnitEffects = card.baseIsImmuneToUnitEffects ?? false;
          if (card.temporaryImmuneToUnitEffects !== undefined) {
            card.isImmuneToUnitEffects = card.temporaryImmuneToUnitEffects;
          }
          if (card.baseShenyi !== undefined) card.isShenyi = card.baseShenyi;
          card.influencingEffects = [];
          if (card.cardlocation === 'ITEM' && card.isExhausted) {
            card.influencingEffects.push({ sourceCardName: '系统状态', description: '已横置' });
          }
          if ((card.cardlocation === 'UNIT' || card.cardlocation === 'ITEM') && card.nextEffectProtection) {
            card.influencingEffects.push({ sourceCardName: '变装', description: '已变装' });
          }

          if (card.temporaryPowerBuff) {
            const source = card.temporaryBuffSources?.['power'] || '效果';
            card.influencingEffects.push({ sourceCardName: source, description: `临时力量加成: +${card.temporaryPowerBuff}` });
          }
          if (card.temporaryDamageBuff) {
            const source = card.temporaryBuffSources?.['damage'] || '效果';
            card.influencingEffects.push({ sourceCardName: source, description: `临时伤害加成: +${card.temporaryDamageBuff}` });
          }
          if (card.temporaryRush) {
            const source = card.temporaryBuffSources?.['rush'] || '效果';
            card.influencingEffects.push({ sourceCardName: source, description: '获得【速攻】' });
          }
          if (card.temporaryCanAttackAny) {
            const source = card.temporaryBuffSources?.['full_attack'] || '效果';
            card.influencingEffects.push({ sourceCardName: source, description: '获得【全攻】' });
          }
          if ((card as any).data?.clearMirrorActiveTurn === gameState.turnCount) {
            card.influencingEffects.push({ sourceCardName: '明镜止水', description: '已明镜止水' });
          }
        }
      });
      player.effectDamageModifier = 0;
    };
    Object.values(gameState.players).forEach(resetCards);
    Object.values(gameState.players).forEach(player => {
      [...player.deck, ...player.hand, ...player.grave, ...player.exile, ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack, ...player.playZone].forEach(card => {
        if (card && this.isFullEffectSilenced(gameState, card)) {
          if (!card.influencingEffects) card.influencingEffects = [];
          card.influencingEffects.push({
            sourceCardName: (card as any).data?.fullEffectSilenceSource || '系统状态',
            description: '本回合失去所有效果'
          });
        }
        if (card && (card as any).data?.combatImmuneUntilOwnNextTurnStartUid) {
          if (!card.influencingEffects) card.influencingEffects = [];
          card.influencingEffects.push({
            sourceCardName: (card as any).data?.combatImmuneSourceName || '系统状态',
            description: '获得效果: 【永续】不会被战斗破坏'
          });
        }
      });
    });

    // 2. Apply all continuous effects from active zones
    const applyEffects = (player: PlayerState) => {
      const activeZones = [...player.unitZone, ...player.itemZone, ...player.erosionFront];
      activeZones.forEach(card => {
        if (card && card.effects) {
          if (this.isFullEffectSilenced(gameState, card)) {
            return;
          }
          card.effects.forEach(effect => {
            if (effect.applyContinuous) {
              effect.applyContinuous(gameState, card);
            }
            if (effect.type === 'CONTINUOUS' && effect.atomicEffects) {
              effect.atomicEffects.forEach(atomic => {
                // Only applying stat changes for continuous atomic effects for now
                AtomicEffectExecutor.execute(gameState, player.uid, atomic, card);
              });
            }
          });
        }
      });
    };
    Object.values(gameState.players).forEach(applyEffects);

    // 3. New: Equipment Influence Display
    const allUnitMap = new Map<string, Card>();
    Object.values(gameState.players).forEach(p => {
      p.unitZone.forEach(u => { if (u) allUnitMap.set(u.gamecardId, u); });
    });

    Object.values(gameState.players).forEach(p => {
      p.itemZone.forEach(item => {
        if (item && item.equipTargetId) {
          const target = allUnitMap.get(item.equipTargetId);
          if (target) {
            // Add entry to Equipment
            if (!item.influencingEffects) item.influencingEffects = [];
            const equipDescription = `已装备给 ${target.fullName}`;
            if (!item.influencingEffects.some(e => e.sourceCardName === target.fullName && e.description === equipDescription)) {
              item.influencingEffects.push({
                sourceCardName: target.fullName,
                description: equipDescription
              });
            }

            // Ensure Unit also shows it (most scripts do this, but defensive check)
            if (!target.influencingEffects) target.influencingEffects = [];
            if (!target.influencingEffects.some(e => e.sourceCardName === item.fullName)) {
              target.influencingEffects.push({
                sourceCardName: item.fullName,
                description: '装备中'
              });
            }
          }
        }
      });
    });

    // 4. Status Effect & Mission Mark Display
    Object.values(gameState.players).forEach(p => {
      p.unitZone.forEach(u => {
        if (!u) return;
        if (!u.influencingEffects) u.influencingEffects = [];

        // Display Silenced Effects
        if (u.silencedEffectIds && u.silencedEffectIds.length > 0) {
          if (!u.influencingEffects.some(e => e.description === '效果已被封印')) {
            u.influencingEffects.push({
              sourceCardName: '系统状态',
              description: '效果已被封印'
            });
          }
        }

        // Display Mission Marks (from Grave or Field)
        Object.values(gameState.players).forEach(owner => {
          const possibleSources = [...owner.grave, ...owner.unitZone, ...owner.itemZone, ...owner.playZone];
          possibleSources.forEach(source => {
            if (source && (source as any).data && (source as any).data.markedTargetId === u.gamecardId) {
              if (gameState.turnCount === (source as any).data.playedTurn) {
                if (!u.influencingEffects.some(e => e.sourceCardName === source.fullName)) {
                  u.influencingEffects.push({
                    sourceCardName: source.fullName,
                    description: '已标记'
                  });
                }
              }
            }
          });
        });
      });
    });
  }

  static handleCardEnteredZone(gameState: GameState, playerUid: string, card: Card, zone: string, isEffect?: boolean) {
    this.recalculateContinuousEffects(gameState);

    this.dispatchEvent(gameState, {
      type: 'CARD_ENTERED_ZONE',
      sourceCard: card,
      sourceCardId: card.gamecardId,
      playerUid,
      data: { zone, isEffect: !!isEffect }
    });
  }

  static handleCardLeftZone(
    gameState: GameState,
    playerUid: string,
    card: Card,
    fromZone: TriggerLocation,
    isEffect?: boolean,
    targetZone?: TriggerLocation,
    options?: {
      effectSourcePlayerUid?: string;
      effectSourceCardId?: string;
      previousSourceCardId?: string;
    }
  ) {
    this.recalculateContinuousEffects(gameState);

    // Track "Returned from battlefield" (Bounce)
    if (fromZone === 'UNIT' && (targetZone === 'HAND' || targetZone === 'DECK')) {
      const player = gameState.players[playerUid];
      if (player) {
        player.hasUnitReturnedThisTurn = true;
      }
    }

    this.dispatchEvent(gameState, {
      type: 'CARD_LEFT_ZONE',
      sourceCard: card,
      sourceCardId: card.gamecardId,
      playerUid,
      data: {
        zone: fromZone,
        isEffect: !!isEffect,
        targetZone,
        effectSourcePlayerUid: options?.effectSourcePlayerUid,
        effectSourceCardId: options?.effectSourceCardId,
        previousSourceCardId: options?.previousSourceCardId
      }
    });
  }

  static dispatchMovementSubEvents(
    gameState: GameState,
    {
      card,
      cardOwnerUid,
      fromZone,
      toZone,
      isEffect,
      effectSourcePlayerUid,
      effectSourceCardId,
      previousSourceCardId,
      skipLeftFieldEvent,
      onlyLeftFieldEvent
    }: {
      card: Card;
      cardOwnerUid: string;
      fromZone: TriggerLocation;
      toZone: TriggerLocation;
      isEffect?: boolean;
      effectSourcePlayerUid?: string;
      effectSourceCardId?: string;
      previousSourceCardId?: string;
      skipLeftFieldEvent?: boolean;
      onlyLeftFieldEvent?: boolean;
    }
  ) {
    const data = {
      isEffect: !!isEffect,
      zone: fromZone,
      sourceZone: fromZone,
      targetZone: toZone,
      effectSourcePlayerUid,
      effectSourceCardId,
      previousSourceCardId
    };

    if (onlyLeftFieldEvent) {
      if (['UNIT', 'ITEM'].includes(fromZone)) {
        this.dispatchEvent(gameState, {
          type: 'CARD_LEFT_FIELD',
          playerUid: cardOwnerUid,
          sourceCard: card,
          sourceCardId: card.gamecardId,
          data
        });
      }
      return;
    }

    if (toZone === 'EROSION_FRONT') {
      this.dispatchEvent(gameState, {
        type: 'CARD_TO_EROSION_FRONT',
        playerUid: cardOwnerUid,
        sourceCard: card,
        sourceCardId: card.gamecardId,
        data
      });
    }

    if (fromZone === 'DECK' && toZone === 'EROSION_FRONT') {
      this.dispatchEvent(gameState, {
        type: 'CARD_DECK_TO_EROSION_UP',
        playerUid: cardOwnerUid,
        sourceCard: card,
        sourceCardId: card.gamecardId,
        data
      });
    } else if ((fromZone === 'EROSION_FRONT' || fromZone === 'EROSION_BACK') && ['UNIT', 'ITEM'].includes(toZone)) {
      this.dispatchEvent(gameState, {
        type: 'CARD_EROSION_TO_FIELD',
        playerUid: cardOwnerUid,
        sourceCard: card,
        sourceCardId: card.gamecardId,
        data
      });
    } else if (fromZone === 'EROSION_FRONT' && toZone === 'HAND') {
      this.dispatchEvent(gameState, {
        type: 'CARD_EROSION_TO_HAND',
        playerUid: cardOwnerUid,
        sourceCard: card,
        sourceCardId: card.gamecardId,
        data
      });
    } else if (fromZone === 'HAND' && toZone === 'GRAVE') {
      this.dispatchEvent(gameState, {
        type: 'CARD_DISCARDED',
        playerUid: cardOwnerUid,
        sourceCard: card,
        sourceCardId: card.gamecardId,
        data
      });
    } else if (['UNIT', 'ITEM'].includes(fromZone) && toZone === 'HAND') {
      this.dispatchEvent(gameState, {
        type: 'CARD_FIELD_TO_HAND',
        playerUid: cardOwnerUid,
        sourceCard: card,
        sourceCardId: card.gamecardId,
        data
      });
    }

    if (!skipLeftFieldEvent && ['UNIT', 'ITEM'].includes(fromZone)) {
      this.dispatchEvent(gameState, {
        type: 'CARD_LEFT_FIELD',
        playerUid: cardOwnerUid,
        sourceCard: card,
        sourceCardId: card.gamecardId,
        data
      });
    }
  }
}
