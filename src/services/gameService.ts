import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GameState, PlayerState, Card, Deck, TriggerLocation } from '../types/game';
import { CARD_LIBRARY } from '../data/cards';
import { EventEngine } from './EventEngine';

const GAMES_COLLECTION = 'games';

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

export const GameService = {
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

    const availableColors: Record<string, number> = { RED: 0, WHITE: 0, YELLOW: 0, BLUE: 0, GREEN: 0, NONE: 0 };
    const countColors = (c: Card | null) => {
      if (c && c.color !== 'NONE') availableColors[c.color] = (availableColors[c.color] || 0) + 1;
    };
    player.unitZone.forEach(countColors);
    player.itemZone.forEach(countColors);
    player.erosionFront.forEach(countColors);

    for (const [color, reqCount] of Object.entries(card.colorReq || {})) {
      if ((availableColors[color] || 0) < (reqCount as number)) {
        return { canPlay: false, reason: `缺少颜色: ${color}` };
      }
    }

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
        const topCard = player.deck.pop();
        if (topCard) {
          topCard.cardlocation = 'EROSION_FRONT';
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

  async playCard(gameId: string, playerId: string, cardId: string, paymentSelection: { feijingCardId?: string, exhaustUnitIds?: string[], erosionFrontIds?: string[] }) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');
    const gameState = gameSnap.data() as GameState;

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

    gameState.phase = 'COUNTERING';
    gameState.isCountering = 1;
    gameState.counterStack.push({
      card,
      ownerUid: playerId,
      type: 'PLAY',
      timestamp: Date.now()
    });

    await setDoc(gameRef, cleanForFirestore(gameState));
  },

  async resolvePlay(gameId: string) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) return;
    const gameState = gameSnap.data() as GameState;

    if (gameState.counterStack.length === 0) return;

    // Resolve the entire stack from top to bottom
    while (gameState.counterStack.length > 0) {
      const stackItem = gameState.counterStack.pop();
      if (!stackItem) continue;

      const card = stackItem.card;

      if (stackItem.type === 'EFFECT') {
        // Execute the effect
        const effectIndex = stackItem.effectIndex ?? 0;
        const effect = card.effects?.[effectIndex];
        if (effect && effect.execute) {
          effect.execute(card, gameState, gameState.players[stackItem.ownerUid]);
          gameState.logs.push(`[效果结算] ${card.fullName} 的效果已结算。`);
          EventEngine.dispatchEvent(gameState, {
            type: 'EFFECT_ACTIVATED',
            playerUid: stackItem.ownerUid,
            sourceCardId: card.gamecardId
          });
        }
      } else {
        if (card.type === 'UNIT') {
          const playZoneCard = gameState.players[stackItem.ownerUid].playZone.find(c => c && c.gamecardId === card.gamecardId);
          if (playZoneCard) playZoneCard.playedTurn = gameState.turnCount;
          this.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'UNIT', card.gamecardId);
        } else if (card.type === 'ITEM') {
          const playZoneCard = gameState.players[stackItem.ownerUid].playZone.find(c => c && c.gamecardId === card.gamecardId);
          if (playZoneCard) playZoneCard.playedTurn = gameState.turnCount;
          this.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'ITEM', card.gamecardId);
        } else {
          // STORY card
          const effect = card.effects?.find(e => e.type === 'ALWAYS' || e.type === 'ACTIVATE' || e.type === 'ACTIVATED');
          if (effect && effect.execute) {
            effect.execute(card, gameState, gameState.players[stackItem.ownerUid]);
            EventEngine.dispatchEvent(gameState, {
              type: 'EFFECT_ACTIVATED',
              playerUid: stackItem.ownerUid,
              sourceCardId: card.gamecardId
            });
          }
          this.moveCard(gameState, stackItem.ownerUid, 'PLAY', stackItem.ownerUid, 'GRAVE', card.gamecardId);
        }
        gameState.logs.push(`${card.fullName} 结算完成`);
      }
    }

    gameState.phase = 'MAIN';
    gameState.isCountering = 0;

    await setDoc(gameRef, cleanForFirestore(gameState));
  },

  async declareAttack(gameId: string, playerId: string, attackerIds: string[], isAlliance: boolean) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');
    const gameState = gameSnap.data() as GameState;

    if (gameState.phase !== 'BATTLE_DECLARATION') throw new Error('Not in battle declaration phase');
    
    const player = gameState.players[playerId];
    const attackers: Card[] = [];

    if (isAlliance && attackerIds.length !== 2) {
      throw new Error('联军攻击必须选择两个单位');
    }
    if (!isAlliance && attackerIds.length !== 1) {
      throw new Error('单体攻击必须选择一个单位');
    }

    for (const id of attackerIds) {
      const unit = player.unitZone.find(c => c?.gamecardId === id);
      if (!unit) throw new Error('Attacker not found in unit zone');
      if (unit.isExhausted) throw new Error('Attacker is already exhausted');
      if (unit.canAttack === false) throw new Error(`单位 [${unit.fullName}] 无法攻击`);
      
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
      type: 'ATTACK_DECLARED',
      playerUid: playerId,
      data: { attackerIds, isAlliance }
    });

    // Transition to counter check (for now just move to defense declaration)
    gameState.phase = 'DEFENSE_DECLARATION';

    await setDoc(gameRef, cleanForFirestore(gameState));
  },

  async declareDefense(gameId: string, playerId: string, defenderId?: string) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');
    const gameState = gameSnap.data() as GameState;

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

    await setDoc(gameRef, cleanForFirestore(gameState));
  },

  async resolveDamage(gameId: string) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');
    const gameState = gameSnap.data() as GameState;

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
        type: 'DAMAGE_TAKEN',
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

    gameState.phase = 'MAIN';
    gameState.battleState = undefined;
    await setDoc(gameRef, cleanForFirestore(gameState));
  },

  applyDamageToPlayer(gameState: GameState, playerId: string, damage: number) {
    const player = gameState.players[playerId];
    for (let i = 0; i < damage; i++) {
      if (player.deck.length > 0) {
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
          // This logic might need refinement based on which one to move to grave
          // For now, just move the last one added
          const lastIdx = player.erosionFront.length - 1;
          const excessCard = player.erosionFront[lastIdx];
          if (excessCard) {
            excessCard.cardlocation = 'GRAVE';
            player.grave.push(excessCard);
            player.erosionFront[lastIdx] = null;
          }
        }
      } else {
        // Deck out
        gameState.gameStatus = 2;
        gameState.winReason = 'DECK_OUT';
        gameState.winnerId = gameState.playerIds.find(id => id !== playerId);
        break;
      }
    }
  },

  destroyUnit(gameState: GameState, playerId: string, gamecardId: string) {
    const player = gameState.players[playerId];
    const idx = player.unitZone.findIndex(c => c?.gamecardId === gamecardId);
    if (idx !== -1) {
      const card = player.unitZone[idx]!;
      card.cardlocation = 'GRAVE';
      player.grave.push(card);
      player.unitZone[idx] = null;
    }
  },

  async discardCard(gameId: string, playerId: string, cardId: string) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');
    const gameState = gameSnap.data() as GameState;

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

    await setDoc(gameRef, cleanForFirestore(gameState));
  },

  finishTurnTransition(gameState: GameState) {
    const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const currentPlayer = gameState.players[currentPlayerId];

    gameState.currentTurnPlayer = gameState.currentTurnPlayer === 0 ? 1 : 0;
    gameState.turnCount += 1;
    gameState.phase = 'START';
    const nextPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const nextPlayer = gameState.players[nextPlayerId];
    
    currentPlayer.isTurn = false;
    nextPlayer.isTurn = true;
    
    gameState.logs.push(`--- 回合 ${gameState.turnCount}: ${nextPlayer.displayName} ---`);
    this.executeStartPhase(gameState, nextPlayer);
  },

  async advancePhase(gameId: string, action?: 'DECLARE_BATTLE' | 'DECLARE_END' | 'RETURN_MAIN') {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) return;
    const gameState = gameSnap.data() as GameState;

    const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const currentPlayer = gameState.players[currentPlayerId];

    switch (gameState.phase) {
      case 'INIT':
      case 'MULLIGAN':
        gameState.phase = 'START';
        gameState.turnCount = 1;
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'START' } });
        this.executeStartPhase(gameState, currentPlayer);
        break;
      case 'START':
        gameState.phase = 'DRAW';
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'DRAW' } });
        this.executeDrawPhase(gameState, currentPlayer);
        break;
      case 'DRAW':
        gameState.phase = 'EROSION';
        EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'EROSION' } });
        this.executeErosionPhase(gameState, currentPlayer);
        break;
      case 'EROSION':
        // Handled by handleErosionChoice
        break;
      case 'MAIN':
        if (action === 'DECLARE_BATTLE') {
          if (gameState.turnCount === 1) {
            throw new Error('先手玩家第一回合不能进入战斗阶段');
          }
          gameState.phase = 'BATTLE_DECLARATION';
          EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'BATTLE_DECLARATION' } });
          gameState.logs.push(`${currentPlayer.displayName} 进入战斗阶段`);
        } else if (action === 'DECLARE_END') {
          this.executeEndPhase(gameState, currentPlayer);
        }
        break;
      case 'BATTLE_DECLARATION':
        if (action === 'DECLARE_END') {
          this.executeEndPhase(gameState, currentPlayer);
        } else if (action === 'RETURN_MAIN') {
          gameState.phase = 'MAIN';
          EventEngine.dispatchEvent(gameState, { type: 'PHASE_CHANGED', data: { phase: 'MAIN' } });
          gameState.logs.push(`${currentPlayer.displayName} 返回主要阶段`);
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

    await setDoc(gameRef, cleanForFirestore(gameState));
  },

  executeStartPhase(gameState: GameState, player: PlayerState) {
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
    this.executeDrawPhase(gameState, player);
  },

  executeDrawPhase(gameState: GameState, player: PlayerState) {
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
      gameState.logs.push(`${player.displayName} 卡组为空！`);
      gameState.gameStatus = 2;
      gameState.winReason = 'DECK_OUT';
      gameState.winnerId = gameState.playerIds.find(id => id !== player.uid);
    }
    
    // Automatically move to EROSION phase
    gameState.phase = 'EROSION';
    this.executeErosionPhase(gameState, player);
  },

  executeErosionPhase(gameState: GameState, player: PlayerState) {
    const faceUpCards = player.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT');
    if (faceUpCards.length === 0) {
      gameState.logs.push(`${player.displayName} 侵蚀区没有正面卡，跳过侵蚀阶段。`);
      gameState.phase = 'MAIN';
      gameState.logs.push(`${player.displayName} 进入主要阶段`);
    } else {
      gameState.logs.push(`${player.displayName} 进入侵蚀阶段，请选择处理方式。`);
    }
  },

  async handleErosionChoice(gameId: string, playerId: string, choice: 'A' | 'B' | 'C', selectedCardId?: string) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found');
    const gameState = gameSnap.data() as GameState;

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

    await setDoc(gameRef, cleanForFirestore(gameState));
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
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    const validation = this.validateDeck(deck);
    if (!validation.valid) throw new Error(validation.error);

    const gameId = Math.random().toString(36).substring(7);
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
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || 'Player 1',
      deck: this.shuffle([...initializedDeck]),
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
    };

    // Initial Draw 4
    for (let i = 0; i < 4; i++) {
      const card = initialPlayerState.deck.pop();
      if (card) initialPlayerState.hand.push(card);
    }

    const gameState: GameState = {
      gameId,
      phase: 'INIT',
      currentTurnPlayer: 0,
      turnCount: 0,
      isCountering: 0,
      counterStack: [],
      playerIds: [auth.currentUser.uid, ''],
      gameStatus: 1,
      logs: ['游戏已创建。等待对手加入...'],
      players: {
        [auth.currentUser.uid]: initialPlayerState
      }
    };

    await setDoc(doc(db, GAMES_COLLECTION, gameId), cleanForFirestore({
      ...gameState,
      status: 'WAITING',
      createdAt: Date.now()
    }));
    return gameId;
  },

  // Create a practice game with a bot
  async createPracticeGame(deck: Card[]) {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
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

    const gameId = 'practice_' + Math.random().toString(36).substring(7);
    const myState: PlayerState = {
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || 'Player 1',
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
    };

    // Initial Draw 4 for both
    for (let i = 0; i < 4; i++) {
      const card1 = myState.deck.pop();
      if (card1) myState.hand.push(card1);
      const card2 = botState.deck.pop();
      if (card2) botState.hand.push(card2);
    }

    // Random first player
    const uids = [auth.currentUser.uid, 'BOT_PLAYER'];
    const firstIdx = Math.floor(Math.random() * uids.length) as 0 | 1;
    const firstPlayerUid = uids[firstIdx];
    
    myState.isFirst = firstPlayerUid === myState.uid;
    botState.isFirst = firstPlayerUid === botState.uid;

    const gameState: GameState = {
      gameId,
      phase: 'MULLIGAN',
      currentTurnPlayer: firstIdx,
      turnCount: 0,
      isCountering: 0,
      counterStack: [],
      playerIds: [uids[0], uids[1]],
      gameStatus: 1,
      logs: ['练习赛开始。请进行调度 (Mulligan)。'],
      players: {
        [auth.currentUser.uid]: myState,
        'BOT_PLAYER': botState
      }
    };

    await setDoc(doc(db, GAMES_COLLECTION, gameId), cleanForFirestore({
      ...gameState,
      status: 'ACTIVE',
      createdAt: Date.now()
    }));
    return gameId;
  },

  // Mulligan action
  async performMulligan(gameId: string, cardIdsToReturn: string[]) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) return;
    
    const game = gameSnap.data() as GameState;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    const player = game.players[uid];
    if (player.mulliganDone) return;

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
      
      game.logs.push(`${player.displayName} 进行了调度，更换了 ${cardIdsToReturn.length} 张卡牌。`);
    } else {
      game.logs.push(`${player.displayName} 接受了初始手牌。`);
    }

    player.mulliganDone = true;

    // Check if both players are done
    const allDone = Object.values(game.players).every(p => p.mulliganDone);
    if (allDone) {
      game.phase = 'START';
      game.turnCount = 1;
      // Find the first player
      const firstPlayerIdx = game.players[game.playerIds[0]].isFirst ? 0 : 1;
      game.currentTurnPlayer = firstPlayerIdx as 0 | 1;
      
      const firstPlayerUid = game.playerIds[game.currentTurnPlayer];
      game.players[firstPlayerUid].isTurn = true;
      game.logs.push(`调度结束。第 1 回合开始，由 ${game.players[firstPlayerUid].displayName} 先行。`);
      
      const firstPlayer = game.players[firstPlayerUid];
      this.executeStartPhase(game, firstPlayer);
    }

    await updateDoc(gameRef, cleanForFirestore({
      players: game.players,
      phase: game.phase,
      turnCount: game.turnCount,
      currentTurnPlayer: game.currentTurnPlayer,
      logs: game.logs
    }));
  },

  async endTurn(gameId: string) {
    return this.advancePhase(gameId, 'DECLARE_END');
  },

  // Bot logic
  async botMove(gameId: string) {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) return;
    
    const game = gameSnap.data() as GameState;
    const bot = game.players['BOT_PLAYER'];
    if (!bot) return;

    // Handle Countering (Bot chooses not to counter)
    if (game.phase === 'COUNTERING') {
      const lastStackItem = game.counterStack[game.counterStack.length - 1];
      if (lastStackItem && lastStackItem.ownerUid !== 'BOT_PLAYER') {
        // Player played a card, bot chooses not to counter
        await this.resolvePlay(gameId);
        return;
      }
      return;
    }

    // Handle Defense Declaration
    if (game.phase === 'DEFENSE_DECLARATION') {
      const attackerUid = Object.keys(game.players).find(uid => game.players[uid].isTurn);
      if (attackerUid !== 'BOT_PLAYER') {
        // Bot is the defender
        const availableDefender = bot.unitZone.find(c => c && !c.isExhausted);
        if (availableDefender) {
          await this.declareDefense(gameId, 'BOT_PLAYER', availableDefender.gamecardId);
        } else {
          await this.declareDefense(gameId, 'BOT_PLAYER', undefined);
        }
        return;
      }
    }

    // Handle Discard Phase
    if (game.phase === 'DISCARD' && bot.isTurn) {
      if (bot.hand.length > 6) {
        await this.discardCard(gameId, 'BOT_PLAYER', bot.hand[0].gamecardId);
      }
      return;
    }

    if (!bot.isTurn) return;

    // Handle Erosion Phase
    if (game.phase === 'EROSION') {
      await this.handleErosionChoice(gameId, 'BOT_PLAYER', 'A');
      return;
    }

    // Main Phase Logic
    if (game.phase === 'MAIN') {
      // Try to play cards in order
      for (const card of bot.hand) {
        const canPlay = this.canPlayCard(bot, card);
        if (canPlay.canPlay) {
          try {
            // Bot plays with default payment (deck to erosion)
            await this.playCard(gameId, 'BOT_PLAYER', card.gamecardId, {});
            return; // Exit and wait for next botMove call or player response
          } catch (e) {
            console.error('Bot failed to play card', e);
          }
        }
      }

      // If no cards can be played, try to enter battle or end turn
      const canAttack = bot.unitZone.some(c => {
        if (!c || c.isExhausted) return false;
        const isRush = !!c.isrush;
        const wasPlayedThisTurn = c.playedTurn === game.turnCount;
        return isRush || !wasPlayedThisTurn;
      });

      if (game.turnCount > 1 && canAttack) {
        // Enter battle phase
        await this.advancePhase(gameId, 'DECLARE_BATTLE');
      } else {
        await this.advancePhase(gameId, 'DECLARE_END');
      }
      return;
    }

    // Battle Declaration Phase
    if (game.phase === 'BATTLE_DECLARATION' && bot.isTurn) {
      const attacker = bot.unitZone.find(c => {
        if (!c || c.isExhausted) return false;
        const isRush = !!c.isrush;
        const wasPlayedThisTurn = c.playedTurn === game.turnCount;
        return isRush || !wasPlayedThisTurn;
      });
      if (attacker) {
        await this.declareAttack(gameId, 'BOT_PLAYER', [attacker.gamecardId], false);
      } else {
        await this.advancePhase(gameId, 'RETURN_MAIN');
      }
      return;
    }

    // Battle Free Phase
    if (game.phase === 'BATTLE_FREE' && bot.isTurn) {
      // Bot just ends battle free phase
      await updateDoc(gameRef, { phase: 'DAMAGE_CALCULATION' });
      return;
    }

    // Damage Calculation Phase
    if (game.phase === 'DAMAGE_CALCULATION') {
      await this.resolveDamage(gameId);
      return;
    }
  },

  // Join an existing game
  async joinGame(gameId: string, deck: Card[]) {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    const validation = this.validateDeck(deck);
    if (!validation.valid) throw new Error(validation.error);

    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) throw new Error('Game not found');
    const gameData = gameSnap.data() as GameState;
    
    if ((gameData as any).status !== 'WAITING') throw new Error('Game already full');

    const opponentState: PlayerState = {
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || 'Player 2',
      deck: this.assignGameCardIds(this.shuffle([...deck])),
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
    };

    // Initial Draw 4
    for (let i = 0; i < 4; i++) {
      const card = opponentState.deck.pop();
      if (card) opponentState.hand.push(card);
    }

    // Random first player
    const uids = [Object.keys(gameData.players)[0], auth.currentUser.uid];
    const firstIdx = Math.floor(Math.random() * uids.length) as 0 | 1;
    const firstPlayerUid = uids[firstIdx];
    
    const players = {
      ...gameData.players,
      [auth.currentUser.uid]: opponentState
    };

    players[uids[0]].isFirst = firstPlayerUid === uids[0];
    players[uids[1]].isFirst = firstPlayerUid === uids[1];

    await updateDoc(gameRef, cleanForFirestore({
      players,
      playerIds: uids,
      phase: 'MULLIGAN',
      currentTurnPlayer: firstIdx,
      status: 'ACTIVE',
      logs: [...gameData.logs, `${opponentState.displayName} 加入了游戏。请进行调度 (Mulligan)。`]
    }));
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
  }
};
