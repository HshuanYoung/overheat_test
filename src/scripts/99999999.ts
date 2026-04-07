import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { GameService } from '../services/gameService';

const card: Card = {
  id: '99999999',
  fullName: '实验巨龙 (Test Dragon)',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '测试',
  acValue: 4,
  power: 3500,
  basePower: 3500,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'testdragon_effect_1',
      type: 'ACTIVATE',
      triggerLocation: ['HAND'],
      limitCount: 1,
      limitGlobal: false,
      description: '【启动】[一回合一次][手牌] 将这张卡丢弃，抽1张卡。',
      cost: (gameState: GameState, playerState: PlayerState, card: Card) => {
        // Discard self
        return GameService.moveCard(gameState, playerState.uid, 'HAND', playerState.uid, 'GRAVE', card.gamecardId);
      },
      atomicEffects: [
        {
          type: 'DRAW',
          value: 1
        }
      ]
    },
    {
      id: 'testdragon_effect_2',
      type: 'ACTIVATE',
      triggerLocation: ['UNIT'],
      limitCount: 1,
      limitGlobal: true,
      description: '【启动】[一局一次][战场] 侵蚀区存在AC值为4-6的卡牌时，将此卡横置，选择场上一个[非红色][非侵蚀区]且[费用<3][力量<3000]的单位破坏。',
      condition: (gameState: GameState, playerState: PlayerState) => {
        const erosionCards = [...playerState.erosionFront, ...playerState.erosionBack];
        return erosionCards.some(c => c && c.acValue >= 4 && c.acValue <= 6);
      },
      cost: (gameState: GameState, playerState: PlayerState, card: Card) => {
        if (card.isExhausted) return false;
        card.isExhausted = true;
        return true;
      },
      atomicEffects: [
        {
          type: 'DESTROY_CARD',
          targetFilter: {
            type: 'UNIT',
            excludeColor: 'RED',
            maxAc: 2,
            maxPower: 2999,
            onField: true
          },
          targetCount: 1
        }
      ]
    },
    {
      id: 'testdragon_effect_3',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '【诱发】这张卡进入战场时，场上除这张卡以外的所有卡牌返回持有者手牌。',
      condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
        // Absolute Identification Check
        const isSelf = event?.type === 'CARD_ENTERED_ZONE' && 
                       ( (event?.sourceCard === instance && !!instance.runtimeFingerprint) || 
                         (event?.sourceCard?.runtimeFingerprint && event?.sourceCard?.runtimeFingerprint === instance.runtimeFingerprint) ||
                         (event?.sourceCardId && event?.sourceCardId === instance.gamecardId && !!instance.gamecardId) );
        
        const isOnBattlefield = event?.data?.zone === 'UNIT' || event?.data?.zone === 'ITEM';
        return isSelf && isOnBattlefield;
      },
      atomicEffects: [
        {
          type: 'MOVE_FROM_FIELD',
          targetFilter: {
            excludeSelf: true,
            onField: true
          },
          destinationZone: 'HAND'
        }
      ]
    }
  ],
  imageUrl: 'https://picsum.photos/seed/testdragon/400/600',
  fullImageUrl: 'https://picsum.photos/seed/testdragon/800/1200',
  rarity: 'UR',
};

export default card;
