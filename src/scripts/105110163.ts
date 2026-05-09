import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { addInfluence } from './BaseUtil';

const effect_105110163_story_ping: CardEffect = {
  id: '105110163_story_ping',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_PLAYED',
  isGlobal: true,
  isMandatory: true,
  description: '每当玩家使用故事卡时，对该故事卡的控制者造成2点效果伤害。',
  condition: (gameState, _playerState, instance, event?: GameEvent) => {
    const playedCard = event?.sourceCard || (event?.sourceCardId ? AtomicEffectExecutor.findCardById(gameState, event.sourceCardId) : undefined);
    return (
      instance.cardlocation === 'UNIT' &&
      event?.type === 'CARD_PLAYED' &&
      playedCard?.type === 'STORY' &&
      !!event.playerUid
    );
  },
  execute: async (instance, gameState, _playerState, event?: GameEvent) => {
    if (!event?.playerUid) return;
    const playedCard = event.sourceCard || (event.sourceCardId ? AtomicEffectExecutor.findCardById(gameState, event.sourceCardId) : undefined);
    if (playedCard?.type === 'STORY') {
      addInfluence(playedCard, instance, '使用故事卡时受到2点效果伤害');
    }
    await AtomicEffectExecutor.execute(gameState, event.playerUid, {
      type: 'DEAL_EFFECT_DAMAGE_SELF',
      value: 2
    }, instance);
  }
};

const effect_105110163_story_ping_hint: CardEffect = {
  id: '105110163_story_ping_hint',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '你的故事卡受到影响：使用时对其控制者造成2点效果伤害。',
  applyContinuous: (gameState, instance) => {
    if (instance.cardlocation !== 'UNIT') return;

    Object.values(gameState.players).forEach(player => {
      [...player.hand, ...player.playZone].forEach(card => {
        if (card?.type === 'STORY') {
          addInfluence(card, instance, '使用时受到2点效果伤害');
        }
      });
    });
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
  effects: [effect_105110163_story_ping, effect_105110163_story_ping_hint],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
