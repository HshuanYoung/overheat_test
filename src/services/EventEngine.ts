import { GameState, PlayerState, Card, GameEvent, CardEffect, TriggerLocation } from '../types/game';
import { GameService } from './gameService';
import { AtomicEffectExecutor } from './AtomicEffectExecutor';

export class EventEngine {
  static dispatchEvent(gameState: GameState, event: GameEvent) {
    // 1. Find all active effects that listen to this event
    const triggeredEffects: { card: Card, effect: CardEffect, playerUid: string }[] = [];

    const BATTLEFIELD_ZONES: TriggerLocation[] = ['UNIT', 'ITEM'];

    const checkPlayerCards = (player: PlayerState) => {
      // activeZones: units and items are always active. 
      // erosionFront cards are active (e.g. for continuous effects like color), 
      // but TRIGGER effects should only fire if the card is in an allowed triggerLocation.
      const activeZones = [...player.unitZone, ...player.itemZone, ...player.erosionFront];

      activeZones.forEach(card => {
        if (card && card.effects) {
          card.effects.forEach(effect => {
            if ((effect.type === 'TRIGGERED' || effect.type === 'TRIGGER') && effect.triggerEvent === event.type) {

              // New: Check if the card's current location is in the effect's triggerLocation array
              // If triggerLocation is not specified, default depends on the card type (usually UNIT/ITEM for units)
              const cardLoc = card.cardlocation as TriggerLocation;
              const allowedLocations = effect.triggerLocation || BATTLEFIELD_ZONES;

              if (!allowedLocations.includes(cardLoc)) {
                return;
              }

              // Check limits and requirements
              if (!GameService.checkEffectLimitsAndReqs(gameState, player.uid, card, effect, cardLoc)) {
                return;
              }

              // Robust Self-Identification
              const isEventSelf = (event.sourceCard === card) ||
                (event.sourceCard?.runtimeFingerprint && event.sourceCard.runtimeFingerprint === card.runtimeFingerprint) ||
                (event.sourceCardId && event.sourceCardId === card.gamecardId);
              
              // Guard: For specific card-entry/action events, default to self-trigger unless explicitly global
              const isMovementEvent = ['CARD_ENTERED_ZONE', 'CARD_LEFT_ZONE', 'CARD_PLAYED', 'CARD_ATTACK_DECLARED'].includes(event.type);
              
              if (isMovementEvent && !effect.isGlobal && !isEventSelf) {
                // If it's a movement/entry event for another card and this effect is not global, skip it
                return;
              }

              if (!effect.condition || effect.condition(gameState, player, card, event)) {
                // Diagnostic log
                if (event.type === 'CARD_ENTERED_ZONE') {
                  const sourceName = event.sourceCard?.fullName || '未知卡牌';
                  const sourceGID = event.sourceCard?.gamecardId || event.sourceCardId || 'N/A';
                  gameState.logs.push(`[Induction-Check] ${card.fullName} (${card.gamecardId}) evaluates ${sourceName} (${sourceGID}). Match!`);
                }
                triggeredEffects.push({ card, effect, playerUid: player.uid });
              }
            }
          });
        }
      });
    };

    Object.values(gameState.players).forEach(checkPlayerCards);

    // 2. Execute mandatory effects first, then optional (or add to stack)
    for (const { card, effect, playerUid } of triggeredEffects) {
      const player = gameState.players[playerUid];

      // Execute Atomic Effects if present
      if (effect.atomicEffects && effect.atomicEffects.length > 0) {
        effect.atomicEffects.forEach(atomic => {
          AtomicEffectExecutor.execute(gameState, playerUid, atomic, card, event);
        });
      }

      // Execute legacy callback if present
      if (effect.execute) {
        effect.execute(card, gameState, player, event);
      }

      GameService.recordEffectUsage(gameState, playerUid, card, effect);
      gameState.logs.push(`[诱发效果] ${player.displayName} 的 ${card.fullName} 触发了效果: ${effect.description}`);

      // Special event for triggering
      this.dispatchEvent(gameState, {
        type: 'EFFECT_TRIGGERED',
        playerUid,
        sourceCardId: card.gamecardId,
        data: { effectId: effect.id }
      });
    }
  }

  static recalculateContinuousEffects(gameState: GameState) {
    // 1. Reset all cards to base stats
    const resetCards = (player: PlayerState) => {
      const allCards = [
        ...player.deck, ...player.hand, ...player.grave, ...player.exile,
        ...player.unitZone, ...player.itemZone, ...player.erosionFront, ...player.erosionBack, ...player.playZone
      ];
      allCards.forEach(card => {
        if (card) {
          if (card.basePower !== undefined) card.power = card.basePower;
          if (card.baseDamage !== undefined) card.damage = card.baseDamage;
          if (card.baseIsrush !== undefined) card.isrush = card.baseIsrush;
          if (card.baseCanAttack !== undefined) card.canAttack = card.baseCanAttack;
          if (card.baseGodMark !== undefined) card.godMark = card.baseGodMark;
          if (card.baseAcValue !== undefined) card.acValue = card.baseAcValue;
          if (card.baseCanActivateEffect !== undefined) card.canActivateEffect = card.baseCanActivateEffect;
        }
      });
    };
    Object.values(gameState.players).forEach(resetCards);

    // 2. Apply all continuous effects from active zones
    const applyEffects = (player: PlayerState) => {
      const activeZones = [...player.unitZone, ...player.itemZone, ...player.erosionFront];
      activeZones.forEach(card => {
        if (card && card.effects) {
          card.effects.forEach(effect => {
            if (effect.type === 'CONTINUOUS') {
              if (effect.applyContinuous) {
                effect.applyContinuous(gameState, card);
              }
              if (effect.atomicEffects) {
                effect.atomicEffects.forEach(atomic => {
                  // Only applying stat changes for continuous atomic effects for now
                  AtomicEffectExecutor.execute(gameState, player.uid, atomic, card);
                });
              }
            }
          });
        }
      });
    };
    Object.values(gameState.players).forEach(applyEffects);
  }

  static handleCardEnteredZone(gameState: GameState, playerUid: string, card: Card, zone: string) {
    this.recalculateContinuousEffects(gameState);

    this.dispatchEvent(gameState, {
      type: 'CARD_ENTERED_ZONE',
      sourceCard: card,
      sourceCardId: card.gamecardId,
      playerUid,
      data: { zone }
    });
  }

  static handleCardLeftZone(gameState: GameState, playerUid: string, card: Card, zone: string) {
    this.recalculateContinuousEffects(gameState);

    this.dispatchEvent(gameState, {
      type: 'CARD_LEFT_ZONE',
      sourceCard: card,
      sourceCardId: card.gamecardId,
      playerUid,
      data: { zone }
    });
  }
}
