import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { canPutItemOntoBattlefield, createSelectCardQuery, markReturnToDeckBottomAtEnd, silenceAllEffectsUntil } from './BaseUtil';

const effect_105000469_enter: CardEffect = {
  id: '105000469_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  description: '这个单位进入战场时，你可以从卡组将1张礼帽道具放置到战场。其场上能力无效，回合结束时将其放置到卡组底。',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card =>
      card.type === 'ITEM' &&
      (card.fullName.includes('礼帽') || card.id === '305000079') &&
      canPutItemOntoBattlefield(playerState, card)
    );
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择礼帽道具',
      '你可以从卡组选择1张礼帽道具。',
      0,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105000469_enter' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    if (selections.length === 0) return;

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_DECK',
      targetFilter: { gamecardId: selections[0] },
      destinationZone: 'ITEM'
    }, instance);

    const item = AtomicEffectExecutor.findCardById(gameState, selections[0]);
    if (!item || item.cardlocation !== 'ITEM') return;

    silenceAllEffectsUntil(item, instance, gameState.turnCount, ['ITEM']);
    markReturnToDeckBottomAtEnd(item, instance, gameState, playerState.uid);
  }
};

const card: Card = {
  id: '105000469',
  fullName: '幻想舞台的塑形师',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000469_enter],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
