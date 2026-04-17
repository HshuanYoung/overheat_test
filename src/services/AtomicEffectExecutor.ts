import { GameState, PlayerState, Card, AtomicEffect, CardFilter, TriggerLocation } from '../types/game';
import { GameService } from './gameService';
import { EventEngine } from './EventEngine';
import { getCardIdentity } from '../lib/utils';

export class AtomicEffectExecutor {
  /**
   * Enriches query options with ownership metadata.
   */
  static enrichQueryOptions(gameState: GameState, viewerUid: string, options: any[]): any[] {
    return options.map(opt => {
      if (!opt.card) return opt;
      const cardId = opt.card.gamecardId;
      let cardOwner: PlayerState | undefined;

      // Special handles for player-as-card selection
      if (cardId === 'PLAYER_SELF') {
        return {
          ...opt,
          isMine: true,
          ownerName: gameState.players[viewerUid].displayName
        };
      }
      if (cardId === 'PLAYER_OPPONENT') {
        const opponentId = Object.keys(gameState.players).find(id => id !== viewerUid);
        return {
          ...opt,
          isMine: false,
          ownerName: opponentId ? gameState.players[opponentId].displayName : 'OPPONENT'
        };
      }

      // Find real owner
      for (const uid of Object.keys(gameState.players)) {
        const p = gameState.players[uid];
        const hasCard = [...p.hand, ...p.unitZone, ...p.itemZone, ...p.grave, ...p.exile, ...p.erosionFront, ...p.erosionBack, ...p.deck]
          .some(c => c && c.gamecardId === cardId);
        if (hasCard) {
          cardOwner = p;
          break;
        }
      }

      return {
        ...opt,
        id: cardId, // Ensure ID is present for bot and frontend selection
        isMine: cardOwner ? cardOwner.uid === viewerUid : false,
        ownerName: cardOwner ? cardOwner.displayName : 'UNKNOWN'
      };
    });
  }

  /**
   * Main entry point for executing atomic effects.
   */
  static async execute(
    gameState: GameState,
    playerUid: string,
    effect: AtomicEffect,
    sourceCard?: Card,
    event?: any,
    querySelections?: string[] // IDs of cards selected in a query
  ): Promise<void> {
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
        this.turnErosionFaceDown(gameState, playerUid, effect.value || 0, sourceCard, querySelections);
        break;


      case 'ROTATE_HORIZONTAL':
        this.rotateCards(gameState, playerUid, effect, 'HORIZONTAL', sourceCard, querySelections);
        break;

      case 'ROTATE_VERTICAL':
        this.rotateCards(gameState, playerUid, effect, 'VERTICAL', sourceCard, querySelections);
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
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'GRAVE', 'HAND', sourceCard, querySelections);
        break;

      case 'MOVE_FROM_EROSION':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'HAND', 'EROSION_FRONT', sourceCard, querySelections);
        break;

      case 'MOVE_FROM_EROSION_BACK':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'GRAVE', 'EROSION_BACK', sourceCard, querySelections);
        break;

      case 'MOVE_FROM_DECK':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'HAND', 'DECK', sourceCard, querySelections);
        break;
      case 'MOVE_FROM_FIELD':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'HAND', 'UNIT', sourceCard, querySelections);
        break;

      case 'MOVE_FROM_GRAVE':
        this.moveCards(gameState, playerUid, effect, effect.destinationZone || 'HAND', 'GRAVE', sourceCard, querySelections);
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
        this.applyStatChange(gameState, effect, 'power', sourceCard, querySelections);
        break;
      case 'CHANGE_DAMAGE':
        this.applyStatChange(gameState, effect, 'damage', sourceCard, querySelections);
        break;
      case 'CHANGE_AC':
        this.applyStatChange(gameState, effect, 'acValue', sourceCard, querySelections);
        break;
      case 'CHANGE_GOD_MARK':
        this.applyStatChange(gameState, effect, 'godMark', sourceCard, querySelections);
        break;

      case 'SET_CAN_RESET_COUNT':
        this.setCanResetCount(gameState, effect, sourceCard, querySelections);
        break;

      case 'DEAL_EFFECT_DAMAGE':
        if (effect.value) this.dealDamage(gameState, opponentUid, playerUid, effect.value, 'EFFECT', effect.destinationZone);
        break;

      case 'DEAL_COMBAT_DAMAGE':
        if (effect.value) this.dealDamage(gameState, opponentUid, playerUid, effect.value, 'BATTLE');
        break;

      case 'DESTROY_CARD':
        await this.destroyCards(gameState, playerUid, effect, sourceCard, querySelections);
        break;

      case 'BANISH_CARD':
        this.moveCards(gameState, playerUid, effect, 'EXILE', undefined, sourceCard, querySelections);
        break;

      case 'DISCARD_CARD':
        this.moveCards(gameState, playerUid, effect, 'GRAVE', 'HAND', sourceCard, querySelections);
        break;

      case 'REVEAL_HAND':
        player.isHandPublic = effect.turnDuration !== undefined ? effect.turnDuration : -1;
        gameState.logs.push(`${player.displayName} 展示了手牌`);
        EventEngine.dispatchEvent(gameState, { type: 'REVEAL_HAND', playerUid });
        break;

      case 'SKIP_PHASE':
        // logic for skipping next phase
        gameState.logs.push(`跳过阶段: ${effect.params?.phase}`);
        break;

      case 'FORCE_PLAY':
        {
          const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
          targets.forEach(c => {
            const ownerUid = this.findCardOwnerKey(gameState, c.gamecardId) || playerUid;
            this.moveCard(gameState, ownerUid, c.cardlocation as any, ownerUid, 'PLAY', c.gamecardId, true);
            EventEngine.dispatchEvent(gameState, {
              type: 'CARD_PLAYED',
              sourceCard: c,
              playerUid: ownerUid,
              sourceCardId: c.gamecardId
            });
          });
        }
        break;

      case 'EXECUTE_CARD_EFFECTS':
        await this.executeCardEffects(gameState, playerUid, effect, sourceCard, querySelections);
        break;

      case 'PAY_CARD_COST':
        // This is handled by ServerGameService's handleQueryChoice
        break;

      case 'CHANGE_CAN_ACTIVATE':
        this.applySilence(gameState, effect, sourceCard, querySelections);
        break;

      case 'IMMUNE_UNIT_EFFECTS':
        this.applyUnitImmunity(gameState, effect, sourceCard, querySelections);
        break;

      case 'DEAL_EFFECT_DAMAGE_SELF':
        if (effect.value) this.dealDamage(gameState, playerUid, playerUid, effect.value, 'EFFECT', effect.destinationZone);
        break;

      case 'GAIN_KEYWORD':
        this.applyKeyword(gameState, effect, sourceCard, querySelections);
        break;

      default:
        // console.warn(`AtomicEffectExecutor: Effect type ${effect.type} not fully implemented yet.`);
        break;
    }

    // After any atomic effect, we might need to recalculate continuous effects
    EventEngine.recalculateContinuousEffects(gameState);
  }

  private static async executeCardEffects(gameState: GameState, playerUid: string, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    const player = gameState.players[playerUid];

    for (const card of targets) {
      if (card.effects) {
        for (const e of card.effects) {
          if (e.atomicEffects) {
            for (const atomic of e.atomicEffects) {
              await this.execute(gameState, playerUid, atomic, card, undefined, querySelections);
            }
          }
          if (e.execute) {
            e.execute(card, gameState, player);
          }
        }
      }
    }
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
      if (this.shouldSkipEffect(gameState, card)) return;

      if (effect.value !== undefined) {
        if (!card.temporaryBuffSources) card.temporaryBuffSources = {};
        const sourceName = sourceCard ? sourceCard.fullName : '效果';

        if (stat === 'power') {
          if (effect.turnDuration === 0 || effect.turnDuration === -1) {
            card.basePower = (card.basePower || 0) + effect.value;
          } else if (effect.turnDuration === 1) {
            card.temporaryPowerBuff = (card.temporaryPowerBuff || 0) + effect.value;
            card.temporaryBuffSources['power'] = sourceName;
          }
          card.power = (card.power || 0) + effect.value;
          EventEngine.dispatchEvent(gameState, { type: 'CARD_POWER_CHANGED', targetCardId: card.gamecardId, data: { delta: effect.value } });
        } else if (stat === 'damage') {
          if (effect.turnDuration === 0 || effect.turnDuration === -1) {
            card.baseDamage = (card.baseDamage || 0) + effect.value;
          } else if (effect.turnDuration === 1) {
            card.temporaryDamageBuff = (card.temporaryDamageBuff || 0) + effect.value;
            card.temporaryBuffSources['damage'] = sourceName;
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

  private static dealDamage(gameState: GameState, targetPlayerUid: string, dealerPlayerUid: string, amount: number, source: 'BATTLE' | 'EFFECT', destination?: TriggerLocation) {
    const player = gameState.players[targetPlayerUid];
    const dealer = gameState.players[dealerPlayerUid];

    let finalAmount = amount;
    if (source === 'EFFECT' && dealer.effectDamageModifier) {
      finalAmount += dealer.effectDamageModifier;
    }

    // New Goddess Mode Rules: 
    // 1. Damage is doubled
    // 2. Damage goes to Graveyard instead of Erosion
    let finalDestination = destination || 'EROSION_FRONT';
    if (player.isGoddessMode) {
      finalAmount *= 2;
      finalDestination = 'GRAVE';
      gameState.logs.push(`[女神化状态] ${player.displayName} 受到的伤害翻倍并直接进入墓地！`);
    }

    // Loss condition check
    if (player.deck.length < finalAmount) {
      if (gameState.gameStatus !== 2) {
        gameState.gameStatus = 2;
        gameState.winReason = source === 'BATTLE' ? 'DECK_OUT_BATTLE_DAMAGE' : 'DECK_OUT_EFFECT_DAMAGE';
        gameState.winnerId = gameState.playerIds.find(id => id !== targetPlayerUid);
        gameState.logs.push(`[游戏结束] ${player.displayName} 受到伤害但卡组不足以支付，判负。`);
      }
      return;
    }

    gameState.logs.push(`${player.displayName} 受到了 ${finalAmount} 点 ${source === 'BATTLE' ? '战斗' : '效果'} 伤害`);

    for (let i = 0; i < finalAmount; i++) {
      const card = player.deck.pop()!;
      card.displayState = 'FRONT_UPRIGHT';
      card.cardlocation = finalDestination;

      if (finalDestination === 'EROSION_FRONT') {
        const emptyIndex = player.erosionFront.findIndex(c => c === null);
        if (emptyIndex !== -1) player.erosionFront[emptyIndex] = card;
        else player.erosionFront.push(card);
      } else if (finalDestination === 'GRAVE') {
        player.grave.push(card);
      } else if (finalDestination === 'HAND') {
        player.hand.push(card);
      }

      // Check for goddess transformation during resolution
      const totalErosion = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
      if (totalErosion >= 10 && !player.isGoddessMode) {
        (GameService as any).triggerGoddessTransformation(gameState, targetPlayerUid);
        // Note: doubling and direct grave destination apply only to damage received thereafter.
      }
    }

    // Post-loop cleanup: Excess erosion front cards to Grave
    const totalAfterPlacement = player.erosionFront.filter(c => c !== null).length + player.erosionBack.filter(c => c !== null).length;
    if (totalAfterPlacement > 10) {
      for (let j = 10; j < player.erosionFront.length; j++) {
        const excessCard = player.erosionFront[j];
        if (excessCard) {
          excessCard.cardlocation = 'GRAVE';
          player.grave.push(excessCard);
          player.erosionFront[j] = null;
        }
      }
    }

    EventEngine.dispatchEvent(gameState, {
      type: source === 'BATTLE' ? 'COMBAT_DAMAGE_CAUSED' : 'EFFECT_DAMAGE_CAUSED',
      playerUid: targetPlayerUid,
      data: { amount: finalAmount, destination: finalDestination }
    });
  }

  private static async destroyCards(gameState: GameState, playerUid: string, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    const finalTargets = effect.targetCount ? targets.slice(0, effect.targetCount) : targets;

    for (const card of finalTargets) {
      if (this.shouldSkipEffect(gameState, card)) continue;

      // Find which player owns the card
      for (const pUid of Object.keys(gameState.players)) {
        const p = gameState.players[pUid];
        if (p.unitZone.some(c => c?.gamecardId === card.gamecardId) ||
          p.itemZone.some(c => c?.gamecardId === card.gamecardId)) {

          // Use ServerGameService.destroyUnit for proper logic/substitution
          await GameService.destroyUnit(gameState, pUid, card.gamecardId, true, playerUid);
          break;
        }
      }
    }
  }

  private static moveCards(gameState: GameState, playerUid: string, effect: AtomicEffect, toZone: TriggerLocation, fromZonePref?: TriggerLocation, sourceCard?: Card, querySelections?: string[]) {
    // Ensure we only look in the preferred zone if provided and no specific zone filter is set
    let filter = effect.targetFilter;
    if (fromZonePref && (!filter || !filter.zone)) {
      filter = { ...filter, zone: [fromZonePref] };
    }

    const targets = this.findTargets(gameState, filter, sourceCard, querySelections);

    // For deck movements, top card is the last card in the array. 
    // findTargets returns them in array order [bottom...top].
    // If no specific IDs are targeted, we should reverse to pick from the top.
    let processedTargets = targets;
    if (fromZonePref === 'DECK' && (!effect.targetFilter || (!effect.targetFilter.gamecardId && !effect.targetFilter.id)) && !querySelections) {
      processedTargets = [...targets].reverse();
    }

    // Limit by targetCount. Default to 1 for MOVE_FROM_DECK if not specified to prevent moving whole deck.
    const defaultCount = (fromZonePref === 'DECK' && !querySelections) ? 1 : undefined;
    const count = effect.targetCount !== undefined ? effect.targetCount : defaultCount;
    const finalTargets = count !== undefined ? processedTargets.slice(0, count) : processedTargets;

    finalTargets.forEach(card => {
      if (this.shouldSkipEffect(gameState, card)) return;

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

      this.moveCard(gameState, ownerUid, currentZone, ownerUid, toZone, card.gamecardId, true);

      // If moving to unit zone from anywhere, mark as played this turn to ensure summon sickness applies
      if (toZone === 'UNIT' && card) {
        card.playedTurn = gameState.turnCount;
      }
    });
  }

  private static rotateCards(gameState: GameState, playerUid: string, effect: AtomicEffect, direction: 'HORIZONTAL' | 'VERTICAL', sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      if (this.shouldSkipEffect(gameState, card)) return;

      card.isExhausted = direction === 'HORIZONTAL';
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
      this.moveCard(gameState, playerUid, 'DECK', playerUid, effect.destinationZone || 'HAND', card.gamecardId, true);
      this.shuffleDeck(gameState, playerUid);
    }
  }

  private static setCanResetCount(gameState: GameState, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      if (this.shouldSkipEffect(gameState, card)) return;

      card.canResetCount = effect.value || 0;
      const ownerUid = this.findCardOwnerKey(gameState, card.gamecardId) || '';
      const identity = getCardIdentity(gameState, ownerUid, card);
      gameState.logs.push(`${identity} ${card.fullName} 的调度重置计数被设为 ${card.canResetCount}`);
    });
  }

  private static negateEffect(gameState: GameState, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      if (this.shouldSkipEffect(gameState, card)) return;

      // logic to negate card effects
      const ownerUid = this.findCardOwnerKey(gameState, card.gamecardId) || '';
      const identity = getCardIdentity(gameState, ownerUid, card);
      gameState.logs.push(`${identity} ${card.fullName} 的效果被无效了`);
      EventEngine.dispatchEvent(gameState, { type: 'EFFECT_COUNTERED', targetCardId: card.gamecardId });
    });
  }

  private static applyImmunity(gameState: GameState, effect: AtomicEffect, type: 'COMBAT' | 'EFFECT', sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      const ownerUid = this.findCardOwnerKey(gameState, card.gamecardId) || '';
      const identity = getCardIdentity(gameState, ownerUid, card);
      gameState.logs.push(`${identity} ${card.fullName} 获得了对${type === 'COMBAT' ? '战斗' : '效果'}的免疫`);
    });
  }

  static findCardById(gameState: GameState, cardId: string): Card | undefined {
    for (const uid of Object.keys(gameState.players)) {
      const p = gameState.players[uid];
      const zones = [p.hand, p.unitZone, p.itemZone, p.grave, p.exile, p.deck, p.erosionFront, p.erosionBack];
      for (const zone of zones) {
        const card = zone.find(c => c && c.gamecardId === cardId);
        if (card) return card;
      }
    }
    return undefined;
  }

  static findCardOwnerKey(gameState: GameState, cardId: string): string | undefined {
    for (const uid of Object.keys(gameState.players)) {
      const p = gameState.players[uid];
      const hasCard = [...p.hand, ...p.unitZone, ...p.itemZone, ...p.grave, ...p.exile, ...p.erosionFront, ...p.erosionBack, ...p.deck]
        .some(c => c && c.gamecardId === cardId);
      if (hasCard) return uid;
    }
    return undefined;
  }

  static matchesColor(card: Card, targetColor: string): boolean {
    if (card.color === targetColor) return true;

    // Robust check for 10500055 (string/number safe)
    const isOmni = String(card.id) === '10500055' || (card.effects && card.effects.some(e => e.id === '10500055_omni'));

    if (isOmni && ['UNIT', 'EROSION_FRONT'].includes(card.cardlocation as string)) {
      return true;
    }

    return false;
  }

  static matchesFilter(card: Card, filter?: CardFilter, sourceCard?: Card, querySelections?: string[], currentZone?: TriggerLocation): boolean {
    if (!filter) return true;

    if (filter.querySelection && querySelections) {
      if (!querySelections.includes(card.gamecardId)) return false;
    }

    if (filter.id && card.id !== filter.id) return false;
    if (filter.hasOwnProperty('gamecardId') && card.gamecardId !== filter.gamecardId) return false;
    if (filter.type) {
      if (filter.type === 'ITEM') {
        if (card.type !== 'ITEM' && !card.isEquip) return false;
      } else {
        if (card.type !== filter.type) return false;
      }
    }
    if (filter.color && !this.matchesColor(card, filter.color)) return false;
    if (filter.faction && card.faction !== filter.faction) return false;
    if (filter.godMark !== undefined && card.godMark !== filter.godMark) return false;
    if (filter.minPower !== undefined && (card.power || 0) < filter.minPower) return false;
    if (filter.maxPower !== undefined && (card.power || 0) > filter.maxPower) return false;
    if (filter.minAc !== undefined && card.acValue < filter.minAc) return false;
    if (filter.maxAc !== undefined && card.acValue > filter.maxAc) return false;

    // Exclusions
    if (filter.excludeColor && card.color === filter.excludeColor) return false;
    if (filter.excludeSelf && sourceCard && card.gamecardId === sourceCard.gamecardId) return false;
    if (filter.excludeId && card.id !== filter.id) return false;
    if (filter.excludeGamecardId && card.gamecardId === filter.excludeGamecardId) return false;

    if (filter.fuzzyName && !card.fullName.includes(filter.fuzzyName)) return false;
    if (filter.isExhausted !== undefined && card.isExhausted !== filter.isExhausted) return false;

    // Field/Zone check (with robust fallback)
    const effectiveLocation = (card.cardlocation as TriggerLocation) || currentZone;
    if (filter.onField && !['UNIT', 'ITEM'].includes(effectiveLocation as string)) return false;
    if (filter.zone && !filter.zone.includes(effectiveLocation as any)) return false;

    return true;
  }

  static findTargets(gameState: GameState, filter?: CardFilter, sourceCard?: Card, querySelections?: string[]): Card[] {
    const results: Card[] = [];

    Object.values(gameState.players).forEach(player => {
      const zones: { data: (Card | null)[], type: TriggerLocation }[] = [
        { data: player.hand, type: 'HAND' },
        { data: player.unitZone, type: 'UNIT' },
        { data: player.itemZone, type: 'ITEM' },
        { data: player.grave, type: 'GRAVE' },
        { data: player.exile, type: 'EXILE' },
        { data: player.deck, type: 'DECK' },
        { data: player.erosionFront, type: 'EROSION_FRONT' },
        { data: player.erosionBack, type: 'EROSION_BACK' }
      ];

      zones.forEach(zone => {
        zone.data.forEach(card => {
          if (!card) return;

          // Check for immunity to unit effects
          if (card.isImmuneToUnitEffects && sourceCard && sourceCard.type === 'UNIT') {
            if (card.gamecardId !== sourceCard.gamecardId) return;
          }

          if (this.matchesFilter(card, filter, sourceCard, querySelections, zone.type)) {
            results.push(card);
          }
        });
      });
    });

    return results;
  }

  static moveCard(gameState: GameState, playerUid: string, fromZone: TriggerLocation, toPlayerUid: string, toZone: TriggerLocation, cardId: string, isEffect?: boolean, options?: { faceDown?: boolean }) {
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

    // Movement Replacement logic (e.g. 10401041)
    if (isEffect && (toZone === 'HAND' || toZone === 'DECK' || toZone === 'EROSION_FRONT' || toZone === 'EROSION_BACK')) {
      if (card.effects) {
        for (const effect of card.effects) {
          if (effect.type === 'CONTINUOUS' && effect.movementReplacementDestination) {
            const player = gameState.players[toPlayerUid];
            if (!effect.condition || effect.condition(gameState, player, card)) {
              gameState.logs.push(`[替换效果] ${card.fullName} 的移动目的地从 ${toZone} 被替换为 ${effect.movementReplacementDestination}`);
              toZone = effect.movementReplacementDestination;
              break;
            }
          }
        }
      }
    }

    if (options?.faceDown !== undefined) {
      card.displayState = options.faceDown ? 'FRONT_FACEDOWN' : 'FRONT_UPRIGHT';
    } else if (toZone === 'EROSION_FRONT') {
      card.displayState = 'FRONT_UPRIGHT';
    } else if (toZone === 'EROSION_BACK') {
      card.displayState = 'FRONT_FACEDOWN';
    }

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
    this.dispatchMovementEvents(gameState, playerUid, card, fromZone, toZone, isEffect);
  }

  private static dispatchMovementEvents(gameState: GameState, playerUid: string, card: Card, from: TriggerLocation, to: TriggerLocation, isEffect?: boolean) {
    // Use centralized EventEngine handlers for movement events to avoid double dispatches
    if (from !== to) {
      EventEngine.handleCardLeftZone(gameState, playerUid, card, from, isEffect, to);
      EventEngine.handleCardEnteredZone(gameState, playerUid, card, to, isEffect);
    }

    // Dispatch specific movement-related sub-events if necessary
    if (to === 'EROSION_FRONT') {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_TO_EROSION_FRONT', playerUid, sourceCardId: card.gamecardId });
    }

    if (from === 'DECK' && to === 'EROSION_FRONT') {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_DECK_TO_EROSION_UP', playerUid, sourceCard: card, sourceCardId: card.gamecardId });
    } else if ((from === 'EROSION_FRONT' || from === 'EROSION_BACK') && ['UNIT', 'ITEM'].includes(to)) {
      EventEngine.dispatchEvent(gameState, { type: 'CARD_EROSION_TO_FIELD', playerUid, sourceCard: card, sourceCardId: card.gamecardId, data: { sourceZone: from } });
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

  private static turnErosionFaceDown(gameState: GameState, playerUid: string, count: number, sourceCard?: Card, querySelections?: string[]) {
    const player = gameState.players[playerUid];

    // 1. Identify Target Cards
    let targets: Card[] = [];
    if (querySelections && querySelections.length > 0) {
      targets = this.findTargets(gameState, { querySelection: true }, sourceCard, querySelections);
    } else {
      const faceUpCards = player.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT') as Card[];
      targets = faceUpCards.slice(0, count);
    }

    // 2. Flip and Move Each Card
    targets.forEach(targetCard => {
      if (!targetCard) return;

      // a. Remove from current spot in Front
      const frontIdx = player.erosionFront.findIndex(c => c?.gamecardId === targetCard.gamecardId);
      if (frontIdx !== -1) player.erosionFront[frontIdx] = null;

      // b. Update Card State
      targetCard.displayState = 'BACK_UPRIGHT';
      targetCard.cardlocation = 'EROSION_BACK';

      // c. Shift existing back cards (Move 0->1, 1->2... up to 9)
      for (let i = 9; i > 0; i--) {
        player.erosionBack[i] = player.erosionBack[i - 1];
      }
      // d. Place at slot 0
      player.erosionBack[0] = targetCard;

      gameState.logs.push(`[系统] ${player.displayName} 的卡片 [${targetCard.fullName}] 已由于效果移动到侵蚀区背面。`);
    });

    if (targets.length > 0) {
      gameState.logs.push(`${player.displayName} 将 ${targets.length} 张侵蚀区的卡翻面并转至背面区域。`);
    }
  }

  private static applySilence(gameState: GameState, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      if (effect.value !== undefined) {
        const val = !!effect.value;
        if (effect.turnDuration === 0 || effect.turnDuration === -1) {
          card.baseCanActivateEffect = val;
        }
        card.canActivateEffect = val;
        gameState.logs.push(`${card.fullName} 的效果在本回合内被屏蔽了。`);
      }
    });
  }

  private static applyUnitImmunity(gameState: GameState, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    targets.forEach(card => {
      if (effect.value !== undefined) {
        const val = !!effect.value;
        if (effect.turnDuration === 0 || effect.turnDuration === -1) {
          card.baseIsImmuneToUnitEffects = val;
        }
      }
    });
  }

  private static shouldSkipEffect(gameState: GameState, card: Card): boolean {
    if (card && card.nextEffectProtection) {
      card.nextEffectProtection = false;
      const ownerUid = this.findCardOwnerKey(gameState, card.gamecardId) || '';
      const identity = ownerUid ? getCardIdentity(gameState, ownerUid, card) : `[${card.fullName}]`;
      gameState.logs.push(`${identity} 的护盾生效，抵消了本次效果！`);
      return true;
    }
    return false;
  }

  private static applyKeyword(gameState: GameState, effect: AtomicEffect, sourceCard?: Card, querySelections?: string[]) {
    const targets = this.findTargets(gameState, effect.targetFilter, sourceCard, querySelections);
    const keyword = effect.params?.keyword;
    const duration = effect.turnDuration ?? 0;

    targets.forEach(card => {
      if (this.shouldSkipEffect(gameState, card)) return;
      if (!card.temporaryBuffSources) card.temporaryBuffSources = {};
      const sourceName = sourceCard ? sourceCard.fullName : '效果';

      if (keyword === 'RUSH') {
        if (duration === 1) {
          card.temporaryRush = true;
          card.temporaryBuffSources['rush'] = sourceName;
        }
        else card.baseIsrush = true;
        card.isrush = true;
      } else if (keyword === 'FULL_ATTACK') {
        if (duration === 1) {
          card.temporaryCanAttackAny = true;
          card.temporaryBuffSources['full_attack'] = sourceName;
        }
      }
    });

    gameState.logs.push(`应用了关键字: ${keyword} (持续: ${duration === 1 ? '本回合' : '永久'})`);
  }
}
