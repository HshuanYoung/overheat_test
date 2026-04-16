import { GameState, PlayerState, Card, GameEvent, CardEffect, TriggerLocation } from '../types/game';
import { GameService } from './gameService';
import { AtomicEffectExecutor } from './AtomicEffectExecutor';
import { getCardIdentity } from '../lib/utils';

export class EventEngine {
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
        ...player.grave, ...player.hand, ...player.exile, ...player.deck
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
              const allowedLocations = effect.triggerLocation || BATTLEFIELD_ZONES;

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
              const isMovementEvent = ['CARD_ENTERED_ZONE', 'CARD_LEFT_ZONE', 'CARD_PLAYED', 'CARD_ATTACK_DECLARED', 'CARD_DESTROYED_BATTLE', 'CARD_DESTROYED_EFFECT'].includes(event.type);

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
          if (card.baseCanActivateEffect !== undefined) card.canActivateEffect = card.baseCanActivateEffect;
          if (card.baseIsImmuneToUnitEffects !== undefined) card.isImmuneToUnitEffects = card.baseIsImmuneToUnitEffects;
          if (card.baseShenyi !== undefined) card.isShenyi = card.baseShenyi;
          card.influencingEffects = [];

          if (card.temporaryPowerBuff) {
            card.influencingEffects.push({ sourceCardName: '系统', description: `临时力量强化: +${card.temporaryPowerBuff}` });
          }
          if (card.temporaryDamageBuff) {
            card.influencingEffects.push({ sourceCardName: '系统', description: `临时伤害强化: +${card.temporaryDamageBuff}` });
          }
          if (card.temporaryRush) {
            card.influencingEffects.push({ sourceCardName: '系统', description: '获得【速攻】' });
          }
          if (card.temporaryCanAttackAny) {
            card.influencingEffects.push({ sourceCardName: '系统', description: '获得【全攻】' });
          }
        }
      });
      player.effectDamageModifier = 0;
    };
    Object.values(gameState.players).forEach(resetCards);

    // 2. Apply all continuous effects from active zones
    const applyEffects = (player: PlayerState) => {
      const activeZones = [...player.unitZone, ...player.itemZone, ...player.erosionFront];
      activeZones.forEach(card => {
        if (card && card.effects) {
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
        if (item && item.isEquip && item.equipTargetId) {
          const target = allUnitMap.get(item.equipTargetId);
          if (target) {
            // Add entry to Equipment
            if (!item.influencingEffects) item.influencingEffects = [];
            item.influencingEffects.push({
              sourceCardName: target.fullName,
              description: '已装备此单位'
            });

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

  static handleCardLeftZone(gameState: GameState, playerUid: string, card: Card, fromZone: TriggerLocation, isEffect?: boolean, targetZone?: TriggerLocation) {
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
      data: { zone: fromZone, isEffect: !!isEffect, targetZone }
    });
  }
}
