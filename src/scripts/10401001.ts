import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { GameService } from '../services/gameService';

const card: Card = {
  id: '10401001',
  fullName: '歌月丽人武者 「风花」',
  specialName: '风花',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 2 },
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'fuhua_trigger',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '这张卡进入战场时，从你的卡组或墓地中选择一张名称含有「歌月」的卡牌放逐。该能力的效果作为此能力的后续效果执行，不触发对抗响应。',
      condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
        // Absolute Identification Check
        const isSelf = event?.type === 'CARD_ENTERED_ZONE' && 
                       ( (event?.sourceCard === instance && !!instance.runtimeFingerprint) || 
                         (event?.sourceCard?.runtimeFingerprint && event?.sourceCard?.runtimeFingerprint === instance.runtimeFingerprint) ||
                         (event?.sourceCardId && event?.sourceCardId === instance.gamecardId && !!instance.gamecardId) );
        
        const isOnBattlefield = event?.data?.zone === 'UNIT' || event?.data?.zone === 'ITEM';
        return isSelf && isOnBattlefield;
      },
      execute: (card: Card, gameState: GameState, playerState: PlayerState) => {
        // 1. Search Deck and Grave
        const pool = [...playerState.deck, ...playerState.grave];
        const target = pool.find(c => c && c.fullName.includes('歌月'));
        
        if (target) {
          // 2. Exile it
          const fromZone = playerState.deck.includes(target) ? 'DECK' : 'GRAVE';
          GameService.moveCard(gameState, playerState.uid, fromZone, playerState.uid, 'EXILE', target.gamecardId);
          gameState.logs.push(`[风花] 放逐了 ${target.fullName} 并执行其效果。`);

          // 3. Execute its atomic effects immediately (bypassing the counter stack)
          if (target.effects) {
            target.effects.forEach(effect => {
               if (effect.atomicEffects) {
                 effect.atomicEffects.forEach(atomic => {
                   AtomicEffectExecutor.execute(gameState, playerState.uid, atomic, target);
                 });
               }
            });
          }
        }
      }
    },
    {
      id: 'fuhua_goddess_activate',
      type: 'ACTIVATE',
      triggerLocation: ['UNIT'],
      limitCount: 1,
      limitGlobal: true,
      description: '【女神化】[一局一次] 选择侵蚀区中两张正面向上的卡牌，将其翻至背面。将战场上所有单位返回持有者手牌。',
      condition: (gameState: GameState, playerState: PlayerState) => {
        return !!playerState.isGoddessMode;
      },
      atomicEffects: [
        {
          type: 'TURN_EROSION_FACE_DOWN',
          value: 2
        },
        {
          type: 'MOVE_FROM_FIELD',
          targetFilter: {
            type: 'UNIT',
            onField: true
          },
          destinationZone: 'HAND'
        }
      ]
    }
  ],
  imageUrl: '/pics/10401001_thumb.jpg',
  fullImageUrl: '/pics/10401001_full.jpg',
  rarity: 'SR',
  faction: '百濑之水城',
};

export default card;
