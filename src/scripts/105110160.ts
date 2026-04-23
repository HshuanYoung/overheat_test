import { Card, CardEffect } from '../types/game';

const effect_105110160_disable_all_activated: CardEffect = {
  id: '105110160_disable_all_activated',
  type: 'CONTINUOUS',
  content: 'DISABLE_ALL_ACTIVATED',
  description: 'All cards lose activated abilities while this unit is active.'
};

const effect_105110160_self_protection: CardEffect = {
  id: '105110160_self_protection',
  type: 'CONTINUOUS',
  description: 'If the opponent is in goddess mode, this unit cannot be destroyed and is unaffected by opponent card effects.',
  applyContinuous: (gameState, instance) => {
    const ownerUid = Object.keys(gameState.players).find(uid =>
      gameState.players[uid].unitZone.some(card => card?.gamecardId === instance.gamecardId)
    );
    const opponentUid = Object.keys(gameState.players).find(uid => uid !== ownerUid);
    const active = !!opponentUid && !!gameState.players[opponentUid]?.isGoddessMode;

    (instance as any).data = {
      ...((instance as any).data || {}),
      indestructibleIfOpponentGoddess: active,
      immuneToOpponentEffectsIfOpponentGoddess: active
    };
  }
};

const card: Card = {
  id: '105110160',
  fullName: '狂妄的科学论者「玛特」',
  specialName: '玛特',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '学院要塞',
  acValue: 1,
  power: 0,
  basePower: 0,
  damage: 0,
  baseDamage: 0,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105110160_disable_all_activated, effect_105110160_self_protection],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
