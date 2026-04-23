import { Card, CardEffect, GameState, PlayerState, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { EventEngine } from '../services/EventEngine';

const VIRTUAL_GOD_MARK_IDS = new Set(['105000472', '105000473']);

export const getOpponentUid = (gameState: GameState, playerUid: string) =>
  Object.keys(gameState.players).find(uid => uid !== playerUid)!;

export const getTopDeckCards = (player: PlayerState, count: number) =>
  player.deck.slice(-count).reverse();

export const revealDeckCards = (gameState: GameState, playerUid: string, count: number, sourceCard?: Card) => {
  const cards = getTopDeckCards(gameState.players[playerUid], count);
  const hasPuppetRevealBoost =
    !!sourceCard &&
    sourceCard.fullName.includes('魔偶') &&
    gameState.players[playerUid].unitZone.some(unit => unit && unit.id === '105000446');

  if (hasPuppetRevealBoost) {
    cards.forEach(card => {
      (card as any).data = {
        ...((card as any).data || {}),
        bt04PuppetRevealTurn: gameState.turnCount,
        bt04PuppetRevealPlayerUid: playerUid,
        bt04PuppetRevealSourceCardId: sourceCard.gamecardId
      };
    });
  }
  if (cards.length > 0) {
    EventEngine.dispatchEvent(gameState, {
      type: 'REVEAL_DECK',
      playerUid,
      data: {
        cards,
        sourceCardId: sourceCard?.gamecardId,
        sourceCardName: sourceCard?.fullName
      }
    });
  }
  return cards;
};

export const shuffleAndRevealTopCards = async (
  gameState: GameState,
  playerUid: string,
  count: number,
  sourceCard?: Card
) => {
  await AtomicEffectExecutor.execute(gameState, playerUid, { type: 'SHUFFLE_DECK' }, sourceCard);
  return revealDeckCards(gameState, playerUid, count, sourceCard);
};

export const isVirtualGodMarkReveal = (gameState: GameState, card: Card | undefined) =>
  !!card &&
  (
    card.godMark ||
    VIRTUAL_GOD_MARK_IDS.has(String(card.id)) ||
    (card as any).data?.bt04PuppetRevealTurn === gameState.turnCount
  );

export const createSelectCardQuery = (
  gameState: GameState,
  playerUid: string,
  cards: Card[],
  title: string,
  description: string,
  minSelections: number,
  maxSelections: number,
  context: any,
  sourceResolver?: (card: Card) => TriggerLocation
) => {
  gameState.pendingQuery = {
    id: Math.random().toString(36).substring(7),
    type: 'SELECT_CARD',
    playerUid,
    options: AtomicEffectExecutor.enrichQueryOptions(
      gameState,
      playerUid,
      cards.map(card => ({
        card,
        source: sourceResolver ? sourceResolver(card) : (card.cardlocation as TriggerLocation)
      }))
    ),
    title,
    description,
    minSelections,
    maxSelections,
    callbackKey: 'EFFECT_RESOLVE',
    context
  };
};

export const createChoiceQuery = (
  gameState: GameState,
  playerUid: string,
  title: string,
  description: string,
  options: { id: string; label: string }[],
  context: any
) => {
  gameState.pendingQuery = {
    id: Math.random().toString(36).substring(7),
    type: 'SELECT_CHOICE',
    playerUid,
    options,
    title,
    description,
    minSelections: 1,
    maxSelections: 1,
    callbackKey: 'EFFECT_RESOLVE',
    context
  };
};

export const moveCard = (
  gameState: GameState,
  ownerUid: string,
  card: Card,
  toZone: TriggerLocation,
  sourceCard?: Card,
  options?: { insertAtBottom?: boolean; faceDown?: boolean; toPlayerUid?: string }
) => {
  const targetPlayerUid = options?.toPlayerUid || ownerUid;
  AtomicEffectExecutor.moveCard(
    gameState,
    ownerUid,
    card.cardlocation as TriggerLocation,
    targetPlayerUid,
    toZone,
    card.gamecardId,
    true,
    {
      insertAtBottom: options?.insertAtBottom,
      faceDown: options?.faceDown,
      effectSourcePlayerUid: (sourceCard ? AtomicEffectExecutor.findCardOwnerKey(gameState, sourceCard.gamecardId) : ownerUid) || ownerUid,
      effectSourceCardId: sourceCard?.gamecardId
    }
  );
};

export const moveCardsToBottom = (
  gameState: GameState,
  ownerUid: string,
  cards: Card[],
  sourceCard?: Card
) => {
  cards.forEach(card => moveCard(gameState, ownerUid, card, 'DECK', sourceCard, { insertAtBottom: true }));
};

export const getBattlefieldUnits = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => player.unitZone.filter((card): card is Card => !!card));

export const getBattlefieldCards = (gameState: GameState) =>
  Object.values(gameState.players).flatMap(player => [
    ...player.unitZone.filter((card): card is Card => !!card),
    ...player.itemZone.filter((card): card is Card => !!card)
  ]);

export const findUnitOnBattlefield = (gameState: GameState, gamecardId?: string) => {
  if (!gamecardId) return undefined;
  return getBattlefieldUnits(gameState).find(card => card.gamecardId === gamecardId);
};

export const canPutUnitOntoBattlefield = (player: PlayerState, card: Card) =>
  player.unitZone.some(slot => slot === null) &&
  (!card.specialName || !player.unitZone.some(unit => unit?.specialName === card.specialName));

export const canPutItemOntoBattlefield = (player: PlayerState, card: Card) =>
  !card.specialName || !player.itemZone.some(item => item?.specialName === card.specialName);

export const hasTruthUnit = (player: PlayerState) =>
  player.unitZone.some(unit => unit && unit.type === 'UNIT' && (unit.specialName === '真理' || unit.fullName.includes('真理')));

export const getOnlyGodMarkUnit = (player: PlayerState) => {
  const godmarkUnits = player.unitZone.filter((unit): unit is Card => !!unit && unit.godMark);
  return godmarkUnits.length === 1 ? godmarkUnits[0] : undefined;
};

export const countItemTypes = (player: PlayerState) =>
  new Set(player.itemZone.filter((card): card is Card => !!card).map(card => card.id)).size;

export const universalEquipEffect: CardEffect = {
  id: 'equip_universal',
  type: 'ACTIVATE',
  description: '主要阶段中，选择你的1个单位装备这张卡，或解除装备状态。',
  limitCount: 1,
  limitNameType: false,
  triggerLocation: ['ITEM'],
  condition: gameState => gameState.phase === 'MAIN',
  execute: async (card, gameState, playerState) => {
    const currentTargetId = card.equipTargetId;
    const options = currentTargetId
      ? [{ card, source: 'ITEM' as const }]
      : playerState.unitZone
          .filter((unit): unit is Card => !!unit)
          .map(unit => ({ card: unit, source: 'UNIT' as const }));

    if (options.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, options),
      title: currentTargetId ? '解除装备' : '选择装备目标',
      description: currentTargetId ? '选择这张卡自身以解除装备。' : `选择1个单位装备 ${card.fullName}。`,
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: card.gamecardId,
        effectId: 'equip_universal'
      }
    };
  },
  onQueryResolve: async (card, gameState, playerState, selections) => {
    const selectedId = selections[0];
    if (selectedId === card.gamecardId) {
      card.equipTargetId = undefined;
      EventEngine.recalculateContinuousEffects(gameState);
      return;
    }

    const target = playerState.unitZone.find(unit => unit?.gamecardId === selectedId);
    if (!target) return;

    card.equipTargetId = target.gamecardId;
    EventEngine.recalculateContinuousEffects(gameState);
  }
};
