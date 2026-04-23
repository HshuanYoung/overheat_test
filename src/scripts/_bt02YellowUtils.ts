import { Card, GameState, PlayerState, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

export const getOpponentUid = (gameState: GameState, playerUid: string) =>
  Object.keys(gameState.players).find(uid => uid !== playerUid)!;

export const getTopDeckCards = (player: PlayerState, count: number) =>
  player.deck.slice(-count).reverse();

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

export const moveCard = (
  gameState: GameState,
  ownerUid: string,
  card: Card,
  toZone: TriggerLocation,
  sourceCard?: Card,
  options?: { insertAtBottom?: boolean; faceDown?: boolean }
) => {
  AtomicEffectExecutor.moveCard(
    gameState,
    ownerUid,
    card.cardlocation as TriggerLocation,
    ownerUid,
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

export const isAlchemyCard = (card: Card) => card.fullName.includes('炼金');
export const isTruthOrHickUnit = (card: Card) => card.type === 'UNIT' && (card.specialName === '真理' || card.specialName === '希克');
export const isValkyrieUnit = (card: Card) => card.type === 'UNIT' && card.specialName === '瓦尔基里';
export const isYellowHandCard = (card: Card) => card.cardlocation === 'HAND' && card.color === 'YELLOW';
export const isNonGodAccessLe3Item = (card: Card) => card.type === 'ITEM' && !card.godMark && (card.acValue || 0) <= 3;
export const isNonGodAccessLe3UnitOrItem = (card: Card) =>
  !card.godMark &&
  (card.type === 'UNIT' || card.type === 'ITEM') &&
  (card.acValue || 0) <= 3;
