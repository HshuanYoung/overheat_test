import { Card, CardEffect, GameEvent, GameState, PlayerState } from '../types/game';
import { EventEngine } from '../services/EventEngine';

const trigger_10401043_power_up: CardEffect = {
  id: '10401043_power_up',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_FIELD_TO_HAND',
  isGlobal: true,
  limitCount: 1,
  limitNameType: true,
  description: '【诱发】【卡名一回合一次】战场上的单位由于卡的效果返回手牌时：本回合中，这个单位力量值+500。',
  condition: (_gameState: GameState, _playerState: PlayerState, _instance: Card, event?: GameEvent) => {
    if (!event || event.type !== 'CARD_FIELD_TO_HAND') return false;

    const isUnitLeavingField = event.data?.zone === 'UNIT';
    const isByCardEffect = !!event.data?.isEffect;

    return isUnitLeavingField && isByCardEffect;
  },
  execute: async (instance: Card, gameState: GameState) => {
    instance.temporaryPowerBuff = (instance.temporaryPowerBuff || 0) + 500;
    instance.temporaryBuffSources = {
      ...(instance.temporaryBuffSources || {}),
      power: instance.fullName
    };

    EventEngine.recalculateContinuousEffects(gameState);
    gameState.logs.push(`[${instance.fullName}] 诱发效果生效：本回合力量值+500。`);
  }
};

const card: Card = {
  id: '10401043',
  gamecardId: null as any,
  fullName: '水城武士',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  colorReq: {},
  faction: '百濑之水城',
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
  effects: [trigger_10401043_power_up],
  rarity: 'U',
  availableRarities: ['U'],
  uniqueId: null,
};

export default card;
