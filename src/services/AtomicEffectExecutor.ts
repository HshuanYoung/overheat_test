import { GameState, PlayerState, Card, AtomicEffect, CardFilter, TriggerLocation } from '../types/game';
import { GameService } from './gameService';
import { EventEngine } from './EventEngine';

export class AtomicEffectExecutor {
  /**
   * Main entry point for executing atomic effects.
   */
  static execute(
    gameState: GameState,
    playerUid: string,
    effect: AtomicEffect,
    sourceCard?: Card,
    event?: any,
    querySelections?: string[] // IDs of cards selected in a query
  ): void {
    const player = gameState.players[playerUid];
    const opponentUid = Object.keys(gameState.players).find(id => id !== playerUid)!;
    const opponent = gameState.players[opponentUid];

    switch (effect.type) {
      case 'DRAW':
        this.drawCards(gameState, playerUid, effect.value || 1);
        break;

      case 'BOTH_PLAYERS_DRAW':
        Object.keys(gameState.players).forEach(uid => {
          this.drawCards(gameState, uid, effect.value || 1);
        });
        break;

      case 'TURN_EROSION_FACE_DOWN':
        this.turnErosionFaceDown(gameState, playerUid, effect.value || 0);
        break;

      case 'SET_CAN_RESET_COUNT':
        this.applyCanResetChange(gameState, effect, sourceCard);
        break;

      case 'ROTATE_HORIZONTAL':
        this.rotateCards(gameState, playerUid, effect, 'HORIZONTAL', sourceCard);
        break;

      case 'ROTATE_VERTICAL':
        this.rotateCards(gameState, playerUid, effect, 'VERTICAL', sourceCard);
        break;

      case 'SHUFFLE_DECK':
        this.shuffleDeck(gameState, playerUid);
        break;

      case 'REVEAL_DECK':
        this.revealDeck(gameState, playerUid, effect.value || 0);
        break;

      case 'SEARCH_DECK':
        this.searchDeck(gameState, playerUid, effect, sourceCard);
        break;

      case 'MOVE_FROM_HAND':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'GRAVE', 'HAND', sourceCard);
        break;

      case 'MOVE_FROM_EROSION':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'HAND', 'EROSION_FRONT', sourceCard);
        break;

      case 'MOVE_FROM_EROSION_BACK':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'GRAVE', 'EROSION_BACK', sourceCard);
        break;

      case 'MOVE_FROM_FIELD':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'HAND', 'UNIT', sourceCard);
        break;

      case 'NEGATE_EFFECT':
        this.negateEffect(gameState, effect, sourceCard);
        break;

      case 'IMMUNE_COMBAT_DESTRUCTION':
        this.applyImmunity(gameState, effect, 'COMBAT', sourceCard);
        break;

      case 'IMMUNE_EFFECT':
        this.applyImmunity(gameState, effect, 'EFFECT', sourceCard);
        break;

      case 'CHANGE_POWER':
        this.applyStatChange(gameState, effect, 'power', sourceCard);
        break;

      case 'CHANGE_DAMAGE':
        this.applyStatChange(gameState, effect, 'damage', sourceCard);
        break;

      case 'CHANGE_AC':
        this.applyStatChange(gameState, effect, 'acValue', sourceCard);
        break;

      case 'CHANGE_GOD_MARK':
        this.applyStatChange(gameState, effect, 'godMark', sourceCard);
        break;

      case 'DEAL_EFFECT_DAMAGE':
        if (effect.value) this.dealDamage(gameState, opponentUid, effect.value, 'EFFECT');
        break;

      case 'DEAL_COMBAT_DAMAGE':
        if (effect.value) this.dealDamage(gameState, opponentUid, effect.value, 'BATTLE');
        break;

      case 'DESTROY_CARD':
        this.destroyCards(gameState, playerUid, effect);
        break;

      case 'BANISH_CARD':
        this.moveCards(gameState, playerUid, effect, 'EXILE', undefined, sourceCard, querySelections);
        break;

      case 'DISCARD_CARD':
        this.moveCards(gameState, playerUid, effect, 'GRAVE', 'HAND', sourceCard, querySelections);
        break;

      case 'REVEAL_HAND':
        gameState.logs.push(`${player.displayName} 展示了手牌`);
        EventEngine.dispatchEvent(gameState, { type: 'REVEAL_HAND', playerUid });
        break;

      case 'SKIP_PHASE':
        // logic for skipping next phase
        gameState.logs.push(`跳过阶段: ${effect.params?.phase}`);
        break;

      case 'FORCE_END_PHASE':
        gameState.logs.push(`强制结束当前阶段`);
        // This might need integration with ServerGameService.advancePhase
        break;

      case 'EXECUTE_CARD_EFFECTS':
        this.executeCardEffects(gameState, playerUid, effect, sourceCard, querySelections);
        break;

      case 'PAY_CARD_COST':
        // This is handled by ServerGameService's handleQueryChoice
        break;

      default:
        console.warn(`AtomicEffectExecutor: Effect type ${effect.type} not fully implemented yet.`);
        break;
    }

    // After any atomic effect, we might need to recalculate continuous effects
    EventEngine.recalculateContinuousEffects(gameState);
  }

  private static executeCardEffects(gameState: GameState, playerUid: string, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    const player = gameState.players[playerUid];

    targets.forEach(card => {
      if (card.effects) {
        card.effects.forEach(e => {
          if (e.atomicEffects) {
            e.atomicEffects.forEach(atomic => {
              this.execute(gameState, playerUid, atomic, card, undefined, querySelections);
            });
          }
          if (e.execute) {
            e.execute(card, gameState, player);
          }
        });
      }
    });
  }

  private static drawCards(gameState: GameState, playerUid: string, count: number) {
    const player = gameState.players[playerUid];
    for (let i = 0; i < count; i++) {
      if (player.deck.length > 0) {
        const card = player.deck.pop()!;
        card.cardlocation = 'HAND';
        player.hand.push(card);
        EventEngine.dispatchEvent(gameState, {
          type: 'CARD_DRAWN',
          sourceCard: card,
          playerUid,
          sourceCardId: card.gamecardId
        });
      } else {
        // Loss condition: Deck out during draw
        if (gameState.gameStatus !== 2) {
          gameState.gameStatus = 2;
          gameState.winReason = 'DECK_OUT_DRAW_EFFECT';
          gameState.winnerId = gameState.playerIds.find(id => id !== playerUid);
          gameState.logs.push(`[游戏结束] ${player.displayName} 尝试抽牌但卡组已空，判负。`);
        }
        return;
      }
    }
    gameState.logs.push(`${player.displayName} 抽了 ${count} 张卡`);
  }

  private static shuffleDeck(gameState: GameState, playerUid: string) {
    const player = gameState.players[playerUid];
    // Fisher-Yates shuffle
    for (let i = player.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
    }
    EventEngine.dispatchEvent(gameState, {
      type: 'DECK_SHUFFLED',
      playerUid
    });
    gameState.logs.push(`${player.displayName} 洗了卡组`);
  }

  private static applyStatChange(gameState: GameState, effect: AtomicEffect, stat: 'power' | 'damage' | 'acValue' | 'godMark', sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      if (effect.value !== undefined) {
        if (stat === 'power') {
          if (effect.turnDuration === 0 || effect.turnDuration === -1) {
            card.basePower = (card.basePower || 0) + effect.value;
          }
          card.power = (card.power || 0) + effect.value;
          EventEngine.dispatchEvent(gameState, { type: 'CARD_POWER_CHANGED', targetCardId: card.gamecardId, data: { delta: effect.value } });
        } else if (stat === 'damage') {
          if (effect.turnDuration === 0 || effect.turnDuration === -1) {
            card.baseDamage = (card.baseDamage || 0) + effect.value;
          }
          card.damage = (card.damage || 0) + effect.value;
          EventEngine.dispatchEvent(gameState, { type: 'CARD_DAMAGE_CHANGED', targetCardId: card.gamecardId, data: { delta: effect.value } });
        } else if (stat === 'acValue') {
          if (effect.turnDuration === 0 || effect.turnDuration === -1) {
            card.baseAcValue = (card.baseAcValue || 0) + effect.value;
          }
          card.acValue = (card.acValue || 0) + effect.value;
          EventEngine.dispatchEvent(gameState, { type: 'CARD_AC_CHANGED', targetCardId: card.gamecardId, data: { delta: effect.value } });
        } else if (stat === 'godMark') {
          card.godMark = !!effect.value;
          EventEngine.dispatchEvent(gameState, { type: 'CHANGE_GOD_MARK' as any, targetCardId: card.gamecardId, data: { value: !!effect.value } });
        }
      }
    });
  }

  private static dealDamage(gameState: GameState, playerUid: string, amount: number, source: 'BATTLE' | 'EFFECT') {
    const player = gameState.players[playerUid];

    // Loss condition: Insufficient deck for damage
    if (player.deck.length < amount) {
      if (gameState.gameStatus !== 2) {
        gameState.gameStatus = 2;
        gameState.winReason = source === 'BATTLE' ? 'DECK_OUT_BATTLE_DAMAGE' : 'DECK_OUT_EFFECT_DAMAGE';
        gameState.winnerId = gameState.playerIds.find(id => id !== playerUid);
        gameState.logs.push(`[游戏结束] ${player.displayName} 受到伤害但卡组不足以支付，判负。`);
      }
      return;
    }

    gameState.logs.push(`${player.displayName} 受到了 ${amount} 点 ${source === 'BATTLE' ? '战斗' : '效果'} 伤害`);

    for (let i = 0; i < amount; i++) {
      const card = player.deck.pop()!;
      card.displayState = 'FRONT_UPRIGHT';
      card.cardlocation = 'EROSION_FRONT';
      const emptyIndex = player.erosionFront.findIndex(c => c === null);
      if (emptyIndex !== -1) player.erosionFront[emptyIndex] = card;
      else player.erosionFront.push(card);
    }

    EventEngine.dispatchEvent(gameState, {
      type: source === 'BATTLE' ? 'COMBAT_DAMAGE_CAUSED' : 'EFFECT_DAMAGE_CAUSED',
      playerUid,
      data: { amount }
    });
  }

  private static destroyCards(gameState: GameState, playerUid: string, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      // Find which player owns the card
      for (const pUid of Object.keys(gameState.players)) {
        const p = gameState.players[pUid];
        if (p.unitZone.some(c => c?.gamecardId === card.gamecardId) ||
          p.itemZone.some(c => c?.gamecardId === card.gamecardId)) {
          this.moveCard(gameState, pUid, card.cardlocation as any, pUid, 'GRAVE', card.gamecardId);
          EventEngine.dispatchEvent(gameState, {
            type: 'CARD_DESTROYED_EFFECT',
            targetCardId: card.gamecardId,
            playerUid: pUid
          });
          break;
        }
      }
    });
  }

  private static moveCards(gameState: GameState, playerUid: string, effect: AtomicEffect, toZone: TriggerLocation, fromZonePref?: TriggerLocation, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    // Limit by targetCount if specified
    const finalTargets = effect.targetCount ? targets.slice(0, effect.targetCount) : targets;

    finalTargets.forEach(card => {
      // Find current zone and OWNER
      const currentZone = card.cardlocation as TriggerLocation;

      // Look for the actual owner of the target card
      let ownerUid = playerUid;
      for (const uid of Object.keys(gameState.players)) {
        const p = gameState.players[uid];
        const allZones = [p.hand, p.unitZone, p.itemZone, p.grave, p.exile, p.deck, p.erosionFront, p.erosionBack];
        if (allZones.some(zone => zone.some(c => c && c.gamecardId === card.gamecardId))) {
          ownerUid = uid;
          break;
        }
      }

      this.moveCard(gameState, ownerUid, currentZone, ownerUid, toZone, card.gamecardId);

      // If moving to unit zone from anywhere, mark as played this turn to ensure summon sickness applies
      if (toZone === 'UNIT' && card) {
        card.playedTurn = gameState.turnCount;
      }
    });
  }

  private static rotateCards(gameState: GameState, playerUid: string, effect: AtomicEffect, direction: 'HORIZONTAL' | 'VERTICAL', sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      card.displayState = direction === 'HORIZONTAL' ? 'BACK_UPRIGHT' : 'FRONT_UPRIGHT'; // Simplified for now
      EventEngine.dispatchEvent(gameState, { type: 'CARD_ROTATED', targetCardId: card.gamecardId, data: { direction } });
    });
  }

  private static revealDeck(gameState: GameState, playerUid: string, count: number) {
    const player = gameState.players[playerUid];
    const cards = player.deck.slice(-count).reverse();
    gameState.logs.push(`${player.displayName} 展示了卡组顶部的 ${cards.length} 张卡: ${cards.map(c => c.fullName).join(', ')}`);
    EventEngine.dispatchEvent(gameState, { type: 'REVEAL_DECK', playerUid, data: { cards } });
  }

  private static searchDeck(gameState: GameState, playerUid: string, effect: AtomicEffect, sourceCard?: Card) {
    const player = gameState.players[playerUid];
    const results = player.deck.filter(c => this.matchesFilter(c, effect.targetFilter, sourceCard));
    if (results.length > 0) {
      // In a real game, this would be a UI choice if there are multiple. 
      // For atomic execution, we might pick the first one or the specific one.
      const card = results[0];
      this.moveCard(gameState, playerUid, 'DECK', playerUid, effect.destinationZone || 'HAND', card.gamecardId);
      this.shuffleDeck(gameState, playerUid);
    }
  }

  private static negateEffect(gameState: GameState, effect: AtomicEffect, sourceCard?: Card) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard);
    targets.forEach(card => {
      // logic to negate card effects
      gameState.logs.push(`${card.fullName} 的效果被无效了`);
      EventEngine.dispatchEvent(gameState, { type: 'EFFECT_COUNTERED', targetCardId: card.gamecardId });
    });
  }

  private static applyImmunity(gameState: GameState, effect: AtomicEffect, type: 'COMBAT' | 'EFFECT', sourceCard?: Card) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard);
    targets.forEach(card => {
      // Implementation depends on where immunities are checked (EventEngine or GameService)
      gameState.logs.push(`${card.fullName} 获得了对${type === 'COMBAT' ? '战斗' : '效果'}的免疫`);
    });
  }

  static matchesFilter(card: Card, filter?: CardFilter, sourceCard?: Card, querySelections?: string[]): boolean {
    if (!filter) return true;

    if (filter.querySelection && querySelections) {
      if (!querySelections.includes(card.gamecardId)) return false;
    }

    if (filter.id && card.id !== filter.id) return false;
    if (filter.gamecardId && card.gamecardId !== filter.gamecardId) return false;
    if (filter.type) {
      if (filter.type === 'ITEM') {
        if (card.type !== 'ITEM' && !card.isEquip) return false;
      } else {
        if (card.type !== filter.type) return false;
      }
    }
    if (filter.color && card.color !== filter.color) return false;
    if (filter.faction && card.faction !== filter.faction) return false;
    if (filter.godMark !== undefined && card.godMark !== filter.godMark) return false;
    if (filter.minPower !== undefined && (card.power || 0) < filter.minPower) return false;
    if (filter.maxPower !== undefined && (card.power || 0) > filter.maxPower) return false;
    if (filter.minAc !== undefined && card.acValue < filter.minAc) return false;
    if (filter.maxAc !== undefined && card.acValue > filter.maxAc) return false;

    // Exclusions
    if (filter.excludeColor && card.color === filter.excludeColor) return false;
    if (filter.excludeSelf && sourceCard && card.gamecardId === sourceCard.gamecardId) return false;
    if (filter.excludeId && card.id === filter.excludeId) return false;
    if (filter.excludeGamecardId && card.gamecardId === filter.excludeGamecardId) return false;

    if (filter.fuzzyName && !card.fullName.includes(filter.fuzzyName)) return false;

    // Field/Zone check
    if (filter.onField && !['UNIT', 'ITEM'].includes(card.cardlocation as string)) return false;
    if (filter.zone && !filter.zone.includes(card.cardlocation as any)) return false;

    return true;
  }

  static findTargets(gameState: GameState, filter?: CardFilter, sourceCard?: Card, querySelections?: string[]): Card[] {
    const results: Card[] = [];
    const checkCard = (card: Card | null) => {
      if (card && this.matchesFilter(card, filter, sourceCard, querySelections)) results.push(card);
    };

    Object.values(gameState.players).forEach(player => {
      const zones = [player.hand, player.unitZone, player.itemZone, player.grave, player.exile, player.deck, player.erosionFront, player.erosionBack];
      zones.forEach(zone => zone.forEach(checkCard));
    });

    return results;
  }

  private static moveCard(gameState: GameState, playerUid: string, fromZone: TriggerLocation, toPlayerUid: string, toZone: TriggerLocation, cardId: string) {
    const sourcePlayer = gameState.players[playerUid];
    const targetPlayer = gameState.players[toPlayerUid];

    let card: Card | undefined;
    let fromArray: (Card | null)[] = [];

    // Localized movement logic to handle specific Yu-Gi-Oh events
    const findInZone = (zone: (Card | null)[], loc: TriggerLocation) => {
      if (loc === fromZone) fromArray = zone;
    };
    findInZone(sourcePlayer.hand, 'HAND');
    findInZone(sourcePlayer.unitZone, 'UNIT');
    findInZone(sourcePlayer.itemZone, 'ITEM');
    findInZone(sourcePlayer.grave, 'GRAVE');
    findInZone(sourcePlayer.exile, 'EXILE');
    findInZone(sourcePlayer.deck, 'DECK');
    findInZone(sourcePlayer.erosionFront, 'EROSION_FRONT');
    findInZone(sourcePlayer.erosionBack, 'EROSION_BACK');

    const idx = fromArray.findIndex(c => c?.gamecardId === cardId);
    if (idx !== -1) {
      card = fromArray[idx]!;
      if (['UNIT', 'ITEM', 'EROSION_FRONT', 'EROSION_BACK'].includes(fromZone)) {
        fromArray[idx] = null;
      } else {
        fromArray.splice(idx, 1);
      }
    }

    if (!card) return;

    card.cardlocation = toZone;
    let toArray: (Card | null)[] = [];
    const findToZone = (zone: (Card | null)[], loc: TriggerLocation) => {
      if (loc === toZone) toArray = zone;
    };
    findToZone(targetPlayer.hand, 'HAND');
    findToZone(targetPlayer.unitZone, 'UNIT');
    findToZone(targetPlayer.itemZone, 'ITEM');
    findToZone(targetPlayer.grave, 'GRAVE');
    findToZone(targetPlayer.exile, 'EXILE');
    findToZone(targetPlayer.deck, 'DECK');
    findToZone(targetPlayer.erosionFront, 'EROSION_FRONT');
    findToZone(targetPlayer.erosionBack, 'EROSION_BACK');

    if (['UNIT', 'ITEM', 'EROSION_FRONT', 'EROSION_BACK'].includes(toZone)) {
      const emptyIdx = toArray.findIndex(c => c === null);
      if (emptyIdx !== -1) toArray[emptyIdx] = card;
      else toArray.push(card);
    } else {
      toArray.push(card);
    }

    // Specific Events based on movement
    this.dispatchMovementEvents(gameState, playerUid, card, fromZone, toZone);
  }

  private static dispatchMovementEvents(gameState: GameState, playerUid: string, card: Card, from: TriggerLocation, to: TriggerLocation) {
    // Use centralized EventEngine handlers for movement events to avoid double dispatches
    if (from !== to) {
      EventEngine.handleCardLeftZone(gameState, playerUid, card, from);
      EventEngine.handleCardEnteredZone(gameState, playerUid, card, to);
    }

    // Dispatch specific movement-related sub-events if necessary
    if (from === 'DECK' && to === 'EROSION_FRONT') {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_DECK_TO_EROSION_UP', playerUid, sourceCardId: card.gamecardId });
    } else if (from === 'EROSION_FRONT' && ['UNIT', 'ITEM'].includes(to)) {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_EROSION_TO_FIELD', playerUid, sourceCardId: card.gamecardId });
    } else if (from === 'EROSION_FRONT' && to === 'HAND') {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_EROSION_TO_HAND', playerUid, sourceCardId: card.gamecardId });
    } else if (from === 'HAND' && to === 'GRAVE') {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_DISCARDED', playerUid, sourceCardId: card.gamecardId });
    } else if (['UNIT', 'ITEM'].includes(from) && to === 'HAND') {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_FIELD_TO_HAND', playerUid, sourceCardId: card.gamecardId });
    } else if (['UNIT', 'ITEM'].includes(from)) {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_LEFT_FIELD', playerUid, sourceCardId: card.gamecardId });
    }
  }

  private static turnErosionFaceDown(gameState: GameState, playerUid: string, count: number) {
    const player = gameState.players[playerUid];
    const faceUpCards = [...player.erosionFront, ...player.erosionBack]
      .filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT');

    const targets = faceUpCards.slice(0, count);
    targets.forEach(card => {
      if (card) {
        card.displayState = 'FRONT_FACEDOWN';
      }
    });

    gameState.logs.push(`${player.displayName} 将 ${targets.length} 张侵蚀区的卡翻面。`);
  }

  private static applyCanResetChange(gameState: GameState, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      if (effect.value !== undefined) {
        card.canResetCount = effect.value;
      }
    });
  }
}
