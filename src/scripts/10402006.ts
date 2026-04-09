import { Card, GameState, PlayerState, TriggerLocation, GameEvent, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const trigger_10402006_1: CardEffect = {
  id: '10402006_trigger_1',
  type: 'TRIGGER',
  description: '【诱发】此单位进入战场时，若你的场上存在2个蓝色单位，支付0费用：选择一名玩家（我方或对手），展示其手牌。之后，从该玩家的手牌中选择1张卡，从该玩家的侵蚀前区中选择1张正面向上的卡。被选择的侵蚀前区卡牌加入手牌，被选择的手牌放置在侵蚀前区。',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  playCost: 0,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    // Check if this card entered the unit zone
    const isSelf = event?.sourceCardId === instance.gamecardId || (event?.sourceCard && event.sourceCard.gamecardId === instance.gamecardId);
    if (!isSelf || event?.data?.zone !== 'UNIT') return false;

    // Check for exactly 2 blue units on my field
    const blueUnitsCount = playerState.unitZone.filter(u => u && u.color === 'BLUE' && u.type === 'UNIT').length;
    return blueUnitsCount >= 2;
  },
  execute: (instance: Card, gameState: GameState, playerState: PlayerState) => {
    // Step 1: Choose a player
    const options: { card: Card; source: TriggerLocation }[] = [];
    Object.values(gameState.players).forEach(p => {
      // Find a card to represent the player (preferably a unit or goddess-like card)
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
          effectId: '10402006_trigger_1',
          step: 1
        }
      };
    }
  },
  resolve: (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
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
        gameState.logs.push(`[狐族交易术学徒] 选择了玩家 ${targetPlayer.displayName}`);

        // Reveal the player's hand (temporary: until start of next turn)
        AtomicEffectExecutor.execute(gameState, selectedPlayerUid, {
          type: 'REVEAL_HAND',
          turnDuration: 1
        }, instance);


        // Step 2: Choose a card from that player's hand
        if (targetPlayer.hand.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: targetPlayer.hand.map(c => ({ card: c, source: 'HAND' })),
            title: `选择 ${targetPlayer.displayName} 的手牌`,
            description: '请从该玩家的手牌中选择一张卡',
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
          gameState.logs.push(`[狐族交易术学徒] ${targetPlayer.displayName} 没有手牌，效果结束。`);
        }
      }
    } else if (context.step === 2) {
      const selectedHandCardId = selections[0];
      const selectedPlayerUid = context.selectedPlayerUid;
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
            selectedHandCardId,
            step: 3
          }
        };
      } else {
        gameState.logs.push(`[狐族交易术学徒] ${targetPlayer.displayName} 侵蚀前区没有正面向上的卡，效果结束。`);
      }
    } else if (context.step === 3) {
      const selectedErosionCardId = selections[0];
      const selectedHandCardId = context.selectedHandCardId;
      const selectedPlayerUid = context.selectedPlayerUid;
      const targetPlayer = gameState.players[selectedPlayerUid];

      const handCard = targetPlayer.hand.find(c => c.gamecardId === selectedHandCardId);
      const erosionCard = targetPlayer.erosionFront.find(c => c?.gamecardId === selectedErosionCardId);

      if (handCard && erosionCard) {
        gameState.logs.push(`[狐族交易术学徒] 交换了 ${targetPlayer.displayName} 的手牌 ${handCard.fullName} 和侵蚀卡 ${erosionCard.fullName}`);

        // Perform the swap
        AtomicEffectExecutor.execute(gameState, selectedPlayerUid, {
          type: 'MOVE_FROM_EROSION',
          targetFilter: { gamecardId: selectedErosionCardId },
          destinationZone: 'HAND'
        }, instance);

        AtomicEffectExecutor.execute(gameState, selectedPlayerUid, {
          type: 'MOVE_FROM_HAND',
          targetFilter: { gamecardId: selectedHandCardId },
          destinationZone: 'EROSION_FRONT'
        }, instance);

        const newErosionCard = targetPlayer.erosionFront.find(c => c?.gamecardId === selectedHandCardId);
        if (newErosionCard) {
          newErosionCard.displayState = 'FRONT_UPRIGHT';
        }
      }
    }
  }
};

const card: Card = {
  id: '10402006',
  fullName: '狐族交易术学徒',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  faction: '九尾商会联盟',
  acValue: 1,
  power: 1000,
  basePower: 1000,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [trigger_10402006_1],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;

