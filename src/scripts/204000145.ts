import { Card, CardEffect, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_204000145_counter: CardEffect = {
  id: '204000145_counter_silence',
  type: 'ACTIVATE',
  triggerLocation: ['HAND', 'PLAY'],
  description: '【启】只能在对抗对手发动场上的单位卡的效果时发动。本回合中，那张卡和同名卡失去所有效果，然后将这张卡放逐。',
  condition: (gameState: GameState, playerState: PlayerState) => {
    if (gameState.phase !== 'COUNTERING') return false;

    const opponentId = gameState.playerIds.find(id => id !== playerState.uid);
    if (!opponentId) return false;

    return gameState.counterStack.some(item =>
      item.type === 'EFFECT' &&
      item.ownerUid === opponentId &&
      !item.isNegated &&
      item.card?.type === 'UNIT' &&
      item.card?.cardlocation === 'UNIT'
    );
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const opponentId = gameState.playerIds.find(id => id !== playerState.uid);
    if (!opponentId) return;

    let targetCard: Card | undefined;

    for (let i = gameState.counterStack.length - 1; i >= 0; i--) {
      const item = gameState.counterStack[i];
      if (
        item.type === 'EFFECT' &&
        item.ownerUid === opponentId &&
        !item.isNegated &&
        item.card?.type === 'UNIT' &&
        item.card?.cardlocation === 'UNIT'
      ) {
        item.isNegated = true;
        targetCard = item.card;
        break;
      }
    }

    if (!targetCard) {
      gameState.logs.push(`[${instance.fullName}] 未能找到可处理的对手单位效果。`);
      return;
    }

    const allCards = Object.values(gameState.players)
      .flatMap(player => [
        ...player.deck,
        ...player.hand,
        ...player.grave,
        ...player.exile,
        ...player.unitZone,
        ...player.itemZone,
        ...player.erosionFront,
        ...player.erosionBack,
        ...player.playZone
      ])
      .filter(Boolean) as Card[];

    const matchedCards = allCards.filter(card => card.fullName === targetCard!.fullName);

    matchedCards.forEach(card => {
      const silencedEffectIds = (card.effects || [])
        .map(effect => effect.id)
        .filter((id): id is string => !!id);

      card.temporaryCanActivateEffect = false;
      card.canActivateEffect = false;
      card.silencedEffectIds = silencedEffectIds;
      (card as any).data = {
        ...((card as any).data || {}),
        fullEffectSilencedTurn: gameState.turnCount,
        fullEffectSilenceSource: instance.fullName
      };
    });

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'BANISH_CARD',
      targetFilter: { gamecardId: instance.gamecardId }
    }, instance);

    gameState.logs.push(`[${instance.fullName}] 使 [${targetCard.fullName}] 及其同名卡在本回合失去所有效果，并将自身放逐。`);
  }
};

const card: Card = {
  id: '204000145',
  fullName: '碍爱伞',
  specialName: '',
  type: 'STORY',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_204000145_counter],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT01',
  uniqueId: null,
};

export default card;
