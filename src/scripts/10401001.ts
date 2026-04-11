import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { GameService } from '../services/gameService';

const card: Card = {
  id: '10401001',
  fullName: '歌月丽人武者 「风花」',
  specialName: '风花',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
  acValue: 3,
  power: 3000,
  basePower: 3000,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'fuhua_trigger',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '这张卡进入战场时，从你的卡组或墓地中选择一张名称含有「歌月」的故事卡放逐。该能力的效果作为此能力的后续效果执行，不触发对抗响应。',
      condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
        const isOnBattlefield = instance.cardlocation === 'UNIT' || instance.cardlocation === 'ITEM';
        if (!event) return isOnBattlefield;

        const isSelf = event.type === 'CARD_ENTERED_ZONE' &&
          (event.sourceCardId === instance.gamecardId || event.sourceCard === instance);
        const isTargetZone = event.data?.zone === 'UNIT' || event.data?.zone === 'ITEM';

        return isSelf && isTargetZone && isOnBattlefield;
      },
      cost: (gameState, playerState, card) => {
        const options: { card: Card; source: any }[] = [];
        playerState.deck.forEach(c => {
          if (c.fullName.includes('歌月') && c.type === 'STORY') options.push({ card: { ...c }, source: 'DECK' });
        });
        playerState.grave.forEach(c => {
          if (c.fullName.includes('歌月') && c.type === 'STORY') options.push({ card: { ...c }, source: 'GRAVE' });
        });

        if (options.length === 0) return false;

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: options as any,
          title: '选择「歌月」卡牌',
          description: '从你的卡组或墓地中选择一张名称包含「歌月」的故事卡放逐。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'ACTIVATE_COST_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0 }
        };
        return true;
      },
      onQueryResolve: (card, gameState, playerState, selections) => {
        const cardId = selections[0];
        const sourcePlayer = gameState.players[playerState.uid];

        let foundCard: Card | undefined;
        let sourceZone: string | undefined;

        const deckIdx = sourcePlayer.deck.findIndex(c => c.gamecardId === cardId);
        if (deckIdx !== -1) {
          foundCard = sourcePlayer.deck.splice(deckIdx, 1)[0];
          sourceZone = 'DECK';
        } else {
          const graveIdx = sourcePlayer.grave.findIndex(c => c.gamecardId === cardId);
          if (graveIdx !== -1) {
            foundCard = sourcePlayer.grave.splice(graveIdx, 1)[0];
            sourceZone = 'GRAVE';
          }
        }

        if (foundCard) {
          foundCard.cardlocation = 'EXILE';
          sourcePlayer.exile.push(foundCard);
          gameState.logs.push(`[歌月] 已从 ${sourceZone} 放逐 ${foundCard.fullName}。`);
          // Store for execution
          gameState.currentProcessingItem = { ...gameState.currentProcessingItem!, data: { banishedCard: foundCard } } as any;
        }
      },
      execute: (card, gameState, playerState) => {
        const banishedCard = (gameState.currentProcessingItem?.data as any)?.banishedCard;
        if (banishedCard && banishedCard.effects) {
          gameState.logs.push(`[风花] 正在执行 ${banishedCard.fullName} 的效果...`);
          banishedCard.effects.forEach(e => {
            if (e.execute) e.execute(banishedCard, gameState, playerState);
          });
        }
      }
    },
    {
      id: 'fuhua_goddess_activate',
      type: 'ACTIVATE',
      triggerLocation: ['UNIT'],
      limitCount: 1,
      limitGlobal: true,
      description: '【女神化】[一局一次] 侵蚀区背面<9且正面>=2。选择侵蚀区中两张正面向上的卡牌，将其翻至背面。将战场上所有单位返回持有者手牌。',
      condition: (gameState, playerState) => {
        const frontCount = playerState.erosionFront.filter(c => c !== null).length;
        const backCount = playerState.erosionBack.filter(c => c !== null).length;
        return !!playerState.isGoddessMode && backCount < 9 && frontCount >= 2;
      },
      cost: (gameState, playerState, card) => {
        const frontCards = playerState.erosionFront.filter(c => c !== null) as Card[];
        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: frontCards.map(c => ({ card: c, source: 'EROSION_FRONT' as any })),
          title: '选择侵蚀卡翻面',
          description: '请选择侵蚀区两张正面向上的卡牌翻至背面。',
          minSelections: 2,
          maxSelections: 2,
          callbackKey: 'ACTIVATE_COST_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 1 }
        };
        return true;
      },
      onQueryResolve: (card, gameState, playerState, selections) => {
        const sourcePlayer = gameState.players[playerState.uid];
        selections.forEach(id => {
          const idx = sourcePlayer.erosionFront.findIndex(c => c?.gamecardId === id);
          if (idx !== -1) {
            const card = sourcePlayer.erosionFront[idx]!;
            sourcePlayer.erosionFront[idx] = null;
            card.cardlocation = 'EROSION_BACK';
            card.displayState = 'BACK_UPRIGHT';
            const emptyIdx = sourcePlayer.erosionBack.findIndex(c => c === null);
            if (emptyIdx !== -1) sourcePlayer.erosionBack[emptyIdx] = card;
            else sourcePlayer.erosionBack.push(card);
          }
        });
        gameState.logs.push(`${playerState.displayName} 将 2 张侵蚀卡翻至背面。`);
      },
      execute: (card, gameState, playerState) => {
        // Return all units to hand
        Object.values(gameState.players).forEach(player => {
          player.unitZone.forEach((unit, idx) => {
            if (unit) {
              const u = unit;
              player.unitZone[idx] = null;
              u.cardlocation = 'HAND';
              player.hand.push(u);
            }
          });
        });
        gameState.logs.push(`所有单位已返回持有者手牌。`);
      }
    }
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
  faction: '百濑之水城',
};

export default card;
