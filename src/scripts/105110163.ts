import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_105110163_story_ping: CardEffect = {
  id: '105110163_story_ping',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'EFFECT_ACTIVATED',
  isGlobal: true,
  isMandatory: true,
  description: 'Whenever a player resolves a story card effect, deal 2 effect damage to that story card controller.',
  condition: (gameState, _playerState, instance, event?: GameEvent) => {
    const playedCard = event?.sourceCard || (event?.sourceCardId ? AtomicEffectExecutor.findCardById(gameState, event.sourceCardId) : undefined);
    return (
      instance.cardlocation === 'UNIT' &&
      event?.type === 'EFFECT_ACTIVATED' &&
      playedCard?.type === 'STORY' &&
      !!event.playerUid
    );
  },
  execute: async (instance, gameState, _playerState, event?: GameEvent) => {
    if (!event?.playerUid) return;
    await AtomicEffectExecutor.execute(gameState, event.playerUid, {
      type: 'DEAL_EFFECT_DAMAGE_SELF',
      value: 2
    }, instance);
  }
};

const card: Card = {
  id: '105110163',
  fullName: '魔法否定论者',
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
  effects: [effect_105110163_story_ping],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
