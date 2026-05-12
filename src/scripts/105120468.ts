import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createSelectCardQuery, getBattlefieldCards } from './BaseUtil';

const effect_105120468_activate: CardEffect = {
  id: '105120468_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitGlobal: true,
  limitNameType: true,
  description: '每局游戏一次，若这个单位从卡组进入战场，放逐战场上1张卡。',
  condition: (gameState, _playerState, instance) =>
    instance.cardlocation === 'UNIT' &&
    (instance as any).data?.lastMovedFromZone === 'DECK' &&
    (instance as any).data?.lastMovedToZone === 'UNIT' &&
    getBattlefieldCards(gameState).length > 0,
  execute: async (instance, gameState, playerState) => {
    createSelectCardQuery(
      gameState,
      playerState.uid,
      getBattlefieldCards(gameState),
      '选择卡牌',
      '选择战场上1张卡放逐。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105120468_activate' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'BANISH_CARD',
      targetFilter: { gamecardId: selections[0], onField: true }
    }, instance);
  },
  targetSpec: {
    title: '选择卡牌',
    description: '选择战场上1张卡放逐。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT', 'ITEM'],
    getCandidates: gameState => getBattlefieldCards(gameState).map(card => ({ card, source: card.cardlocation as any }))
  }
};

const card: Card = {
  id: '105120468',
  fullName: '炼金猎杀者「暗影」',
  specialName: '暗影',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 2 },
  faction: '永生之乡',
  acValue: 2,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105120468_activate],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
