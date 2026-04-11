import { Card, GameState, PlayerState, TriggerLocation, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const activate_10402007_1: CardEffect = {
  id: '10402007_activate_1',
  type: 'ACTIVATED',
  description: '【启动】在单位区放置为横置：我方选择一名玩家（我方或对手），选择该玩家侵蚀前区的一张正面表示卡并将其送去墓地。之后，将该玩家卡组顶的一张卡放置在侵蚀前区。',
  triggerLocation: ['UNIT'],
  cost: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (instance.isExhausted) return false;
    instance.isExhausted = true;
    // Note: displayState manipulation might be handled by UI or standard engine logic for horizontal cards,
    // but manually setting it to BACK_UPRIGHT is common in this codebase for exhausted status.
    instance.displayState = 'BACK_UPRIGHT';
    return true;
  },
  execute: (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Step 1: Choose a player
    const options: { card: Card; source: TriggerLocation }[] = [];
    Object.values(gameState.players).forEach(p => {
      const repCard = p.unitZone.find(u => u !== null) || p.erosionFront.find(e => e !== null) || p.hand[0] || p.grave[0] || p.deck[0];
      if (repCard) {
        options.push({ card: { ...repCard }, source: repCard.cardlocation as any });
      }
    });

    if (options.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options,
        title: '选择玩家',
        description: '请选择一名玩家以执行效果（选择该玩家的一张卡以确认）',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectIndex: 0,
          step: 1
        }
      };
    }
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const selectedGamecardId = selections[0];
      let selectedPlayerUid = '';
      for (const uid of Object.keys(gameState.players)) {
        const p = gameState.players[uid];
        const allCards = [...p.hand, ...p.unitZone, ...p.itemZone, ...p.grave, ...p.exile, ...p.erosionFront, ...p.erosionBack, ...p.deck];
        if (allCards.some(c => c && c.gamecardId === selectedGamecardId)) {
          selectedPlayerUid = uid;
          break;
        }
      }

      if (selectedPlayerUid) {
        const targetPlayer = gameState.players[selectedPlayerUid];
        const erosionOptions = targetPlayer.erosionFront
          .filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT') as Card[];

        if (erosionOptions.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: erosionOptions.map(c => ({ card: c, source: 'EROSION_FRONT' })),
            title: `选择 ${targetPlayer.displayName} 的侵蚀卡`,
            description: '请从该玩家的侵蚀前区中选择一张正面向上的卡',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              ...context,
              selectedPlayerUid,
              step: 2
            }
          };
        } else {
          gameState.logs.push(`[老练的狐族商人] ${targetPlayer.displayName} 侵蚀前区没有正面向上的卡，效果部分失败。`);
          // Still try to do the deck part
          if (targetPlayer.deck.length > 0) {
            const topCard = targetPlayer.deck.pop()!;
            topCard.cardlocation = 'EROSION_FRONT';
            topCard.displayState = 'FRONT_UPRIGHT';
            const emptyIdx = targetPlayer.erosionFront.findIndex(c => c === null);
            if (emptyIdx !== -1) targetPlayer.erosionFront[emptyIdx] = topCard;
            else targetPlayer.erosionFront.push(topCard);
            gameState.logs.push(`[老练的狐族商人] 将 ${targetPlayer.displayName} 卡组顶的卡放置在了侵蚀前区`);
          }
        }
      }
    } else if (context.step === 2) {
      const selectedErosionCardId = selections[0];
      const selectedPlayerUid = context.selectedPlayerUid;
      const targetPlayer = gameState.players[selectedPlayerUid];

      const erosionCard = targetPlayer.erosionFront.find(c => c?.gamecardId === selectedErosionCardId);
      if (erosionCard) {
        gameState.logs.push(`[老练的狐族商人] 将 ${targetPlayer.displayName} 的侵蚀卡 ${erosionCard.fullName} 送往墓地`);

        // Move to Grave
        AtomicEffectExecutor.execute(gameState, selectedPlayerUid, {
          type: 'MOVE_FROM_EROSION',
          targetFilter: { gamecardId: selectedErosionCardId },
          destinationZone: 'GRAVE'
        }, instance);

        // Place top card of deck to erosion
        if (targetPlayer.deck.length > 0) {
          const topCard = targetPlayer.deck.pop()!;
          topCard.cardlocation = 'EROSION_FRONT';
          topCard.displayState = 'FRONT_UPRIGHT';
          const emptyIdx = targetPlayer.erosionFront.findIndex(c => c === null);
          if (emptyIdx !== -1) targetPlayer.erosionFront[emptyIdx] = topCard;
          else targetPlayer.erosionFront.push(topCard);
          gameState.logs.push(`[老练的狐族商人] 将 ${targetPlayer.displayName} 卡组顶的卡放置在了侵蚀前区`);
        }
      }
    }
  }
};

const activate_10402007_2: CardEffect = {
  id: '10402007_activate_2',
  type: 'ACTIVATED',
  description: '【启动】卡名每回合限一次。当侵蚀区的卡片数量为4-6张时，将单位横置：选择一名玩家（我方或对手），该玩家抽2张卡。之后，由该玩家选择一张其手牌，并将其放置在侵蚀前区。',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState) => {
    const totalErosion = playerState.erosionFront.filter(c => c !== null).length + playerState.erosionBack.filter(c => c !== null).length;
    return totalErosion >= 4 && totalErosion <= 6;
  },
  cost: (gameState: GameState, playerState: PlayerState, instance: Card) => {
    if (instance.isExhausted) return false;
    instance.isExhausted = true;
    instance.displayState = 'BACK_UPRIGHT';
    return true;
  },
  execute: (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Step 1: Choose a player
    const options: { card: Card; source: TriggerLocation }[] = [];
    Object.values(gameState.players).forEach(p => {
      const repCard = p.unitZone.find(u => u !== null) || p.erosionFront.find(e => e !== null) || p.hand[0] || p.grave[0] || p.deck[0];
      if (repCard) {
        options.push({ card: { ...repCard }, source: repCard.cardlocation as any });
      }
    });

    if (options.length > 0) {
      gameState.pendingQuery = {
        id: Math.random().toString(36).substring(7),
        type: 'SELECT_CARD',
        playerUid: playerState.uid,
        options,
        title: '选择玩家',
        description: '请选择一名玩家以执行效果',
        minSelections: 1,
        maxSelections: 1,
        callbackKey: 'EFFECT_RESOLVE',
        context: {
          sourceCardId: instance.gamecardId,
          effectIndex: 1,
          step: 1
        }
      };
    }
  },
  onQueryResolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step === 1) {
      const selectedGamecardId = selections[0];
      let selectedPlayerUid = '';
      for (const uid of Object.keys(gameState.players)) {
        const p = gameState.players[uid];
        const allCards = [...p.hand, ...p.unitZone, ...p.itemZone, ...p.grave, ...p.exile, ...p.erosionFront, ...p.erosionBack, ...p.deck];
        if (allCards.some(c => c && c.gamecardId === selectedGamecardId)) {
          selectedPlayerUid = uid;
          break;
        }
      }

      if (selectedPlayerUid) {
        const targetPlayer = gameState.players[selectedPlayerUid];
        gameState.logs.push(`[老练的狐族商人] 选择了玩家 ${targetPlayer.displayName}，该玩家抽2张卡`);

        // Draw 2 cards
        AtomicEffectExecutor.execute(gameState, selectedPlayerUid, {
          type: 'DRAW',
          value: 2
        }, instance);

        // Step 2: The SELECTED player chooses a card from hand
        if (targetPlayer.hand.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: selectedPlayerUid, // The selected player makes the choice
            options: targetPlayer.hand.map(c => ({ card: c, source: 'HAND' })),
            title: '选择一张手牌',
            description: '请选择一张手牌将其放置在侵蚀前区',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              ...context,
              selectedPlayerUid,
              step: 2
            }
          };
        }
      }
    } else if (context.step === 2) {
      const selectedHandCardId = selections[0];
      const selectedPlayerUid = context.selectedPlayerUid;
      const targetPlayer = gameState.players[selectedPlayerUid];

      const handCard = targetPlayer.hand.find(c => c.gamecardId === selectedHandCardId);
      if (handCard) {
        gameState.logs.push(`[老练的狐族商人] ${targetPlayer.displayName} 将手牌 ${handCard.fullName} 放置在了侵蚀前区`);

        AtomicEffectExecutor.execute(gameState, selectedPlayerUid, {
          type: 'MOVE_FROM_HAND',
          targetFilter: { gamecardId: selectedHandCardId },
          destinationZone: 'EROSION_FRONT'
        }, instance);

        // Ensure it is face up
        const newErosionCard = targetPlayer.erosionFront.find(c => c?.gamecardId === selectedHandCardId);
        if (newErosionCard) {
          newErosionCard.displayState = 'FRONT_UPRIGHT';
        }
      }
    }
  }
};

const card: Card = {
  id: '10402007',
  fullName: '老练的狐族商人',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { 'BLUE': 1 },
  faction: '九尾商会联盟',
  acValue: 2,
  power: 1500,
  basePower: 1500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [activate_10402007_1, activate_10402007_2],
  rarity: 'PR',
  availableRarities: ['R', 'PR'],
  uniqueId: null,
};

export default card;
