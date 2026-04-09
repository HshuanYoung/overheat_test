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
      description: '这张卡进入战场时，从你的卡组或墓地中选择一张名称含有「歌月」的故事卡放逐。该能力的效果作为此能力的后续效果执行，不触发对抗响应。',
      condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
        // Absolute Identification Check
        const isSelf = event?.type === 'CARD_ENTERED_ZONE' &&
          ((event?.sourceCard === instance && !!instance.runtimeFingerprint) ||
            (event?.sourceCard?.runtimeFingerprint && event?.sourceCard?.runtimeFingerprint === instance.runtimeFingerprint) ||
            (event?.sourceCardId && event?.sourceCardId === instance.gamecardId && !!instance.gamecardId));

        const isOnBattlefield = event?.data?.zone === 'UNIT' || event?.data?.zone === 'ITEM';
        return isSelf && isOnBattlefield;
      },
      execute: (card: Card, gameState: GameState, playerState: PlayerState) => {
        // 1. Search Deck and Grave for "歌月" cards
        const options: { card: Card; source: any }[] = [];

        playerState.deck.forEach(c => {
          if (c.fullName.includes('歌月') && c.type === 'STORY') {
            options.push({ card: { ...c }, source: 'DECK' });
          }
        });

        playerState.grave.forEach(c => {
          if (c.fullName.includes('歌月') && c.type === 'STORY') {
            options.push({ card: { ...c }, source: 'GRAVE' });
          }
        });

        if (options.length > 0) {
          // 2. Set pending query for the player
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: options as any,
            title: '选择「歌月」卡牌',
            description: '从你的卡组或墓地中选择一张名称含有「歌月」的故事卡放逐。',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'GENERIC_RESOLVE',
            context: { sourceCardId: card.gamecardId },
            afterSelectionEffects: [
              {
                type: 'BANISH_CARD',
                targetFilter: { querySelection: true }
              },
              {
                type: 'PAY_CARD_COST',
                targetFilter: { querySelection: true }
              },
              {
                type: 'EXECUTE_CARD_EFFECTS',
                targetFilter: { querySelection: true }
              }
            ],
            executionMode: 'IMMEDIATE'
          };
          gameState.logs.push(`[风花] 正在寻找「歌月」卡牌...`);
        } else {
          gameState.logs.push(`[风花] 未在卡组或墓地中找到「歌月」卡牌。`);
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
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
  faction: '百濑之水城',
};

export default card;
