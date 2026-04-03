import { GameState, PlayerState, Card, GameEvent, CardEffect } from '../types/game';

export class EventEngine {
  static dispatchEvent(gameState: GameState, event: GameEvent) {
    // 1. Find all active effects that listen to this event
    const triggeredEffects: { card: Card, effect: CardEffect, playerUid: string }[] = [];

    const checkPlayerCards = (player: PlayerState) => {
      const activeZones = [...player.unitZone, ...player.itemZone, ...player.erosionFront];
      activeZones.forEach(card => {
        if (card && card.effects) {
          card.effects.forEach(effect => {
            if ((effect.type === 'TRIGGERED' || effect.type === 'TRIGGER') && effect.triggerEvent === event.type) {
              if (!effect.condition || effect.condition(gameState, player, card, event)) {
                triggeredEffects.push({ card, effect, playerUid: player.uid });
              }
            }
          });
        }
      });
    };

    Object.values(gameState.players).forEach(checkPlayerCards);

    // 2. Execute mandatory effects first, then optional (or add to stack)
    // For simplicity, we'll execute them sequentially right now.
    // In a real Yu-Gi-Oh like game, they might go on a chain/stack.
    for (const { card, effect, playerUid } of triggeredEffects) {
      const player = gameState.players[playerUid];
      if (effect.isMandatory) {
        if (effect.execute) {
          effect.execute(card, gameState, player, event);
          gameState.logs.push(`[诱发效果] ${player.displayName} 的 ${card.fullName} 触发了效果。`);
        }
      } else {
        // Optional effects could be added to a pending queue for the player to decide
        // For now, we auto-execute or we could add to counterStack
        if (effect.execute) {
          effect.execute(card, gameState, player, event);
          gameState.logs.push(`[诱发效果] ${player.displayName} 的 ${card.fullName} 触发了效果。`);
        }
      }
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
            if (effect.type === 'CONTINUOUS' && effect.applyContinuous) {
              effect.applyContinuous(gameState, card);
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
      sourceCardId: card.gamecardId,
      playerUid,
      data: { zone }
    });
  }

  static handleCardLeftZone(gameState: GameState, playerUid: string, card: Card, zone: string) {
    this.recalculateContinuousEffects(gameState);
    
    this.dispatchEvent(gameState, {
      type: 'CARD_LEFT_ZONE',
      sourceCardId: card.gamecardId,
      playerUid,
      data: { zone }
    });
  }
}
