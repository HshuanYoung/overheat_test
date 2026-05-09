import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, isNonGodAccessLe3Item } from './BaseUtil';

const effect_105110162_goddess_trigger: CardEffect = {
  id: '105110162_goddess_trigger',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'GODDESS_TRANSFORMATION',
  limitCount: 1,
  limitNameType: true,
  erosionTotalLimit: [10, 10],
  description: '当你进入女神化时，从卡组选择1张AC为3以下的非神蚀道具放置到战场。',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'GODDESS_TRANSFORMATION' &&
    event.playerUid === playerState.uid,
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(isNonGodAccessLe3Item);
    if (candidates.length === 0) return;

    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择道具',
      '从你的卡组选择1张AC为3以下的非神蚀道具。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105110162_goddess_trigger' },
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
  id: '105110162',
  fullName: '菲晶发明家',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 2,
  power: 2000,
  basePower: 2000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110162_goddess_trigger],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
