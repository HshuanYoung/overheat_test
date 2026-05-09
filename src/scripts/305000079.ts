import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutItemOntoBattlefield, createSelectCardQuery } from './BaseUtil';

const isSelfDestroyedByOwnEffect = (instance: Card, playerState: any, event?: GameEvent) => {
  if (!event) return false;
  if (event.type === 'CARD_DESTROYED_EFFECT') {
    return event.targetCardId === instance.gamecardId &&
      event.data?.sourcePlayerId === playerState.uid;
  }
  return event.type === 'CARD_LEFT_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'ITEM' &&
    event.data?.targetZone === 'GRAVE' &&
    event.data?.isEffect &&
    event.data?.effectSourcePlayerUid === playerState.uid;
};

const effect_305000079_trigger: CardEffect = {
  id: '305000079_trigger',
  type: 'TRIGGER',
  triggerLocation: ['GRAVE'],
  triggerEvent: ['CARD_DESTROYED_EFFECT', 'CARD_LEFT_ZONE'],
  isMandatory: true,
  description: '这张卡被你的卡牌效果破坏并送入墓地时，从你的卡组选择1张「幻想舞台的礼帽」放置到战场。',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'GRAVE' &&
    isSelfDestroyedByOwnEffect(instance, playerState, event),
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card =>
      card.id === '305000079' &&
      canPutItemOntoBattlefield(playerState, card)
    );
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择礼帽',
      '从你的卡组选择1张「幻想舞台的礼帽」。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '305000079_trigger' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: 'ITEM'
    }, instance);
  }
};

const card: Card = {
  id: '305000079',
  fullName: '幻想舞台的礼帽',
  specialName: '',
  type: 'ITEM',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_305000079_trigger],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
