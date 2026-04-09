import { Card, GameState, PlayerState } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '10401004',
  fullName: '剑仙子',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  acValue: 2,
  power: 500,
  damage: 0,
  baseDamage: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'jianxianzi_activate',
      type: 'ACTIVATE',
      description: '【启动】[名称一回合一次] 我方场上存在3个蓝色单位时，0费：此卡在单位区时可以启动，将此卡返回持有者手牌。之后，选择我方侵蚀区前排一张正面向上的卡牌，返回持有者卡组并洗牌。',
      triggerLocation: ['UNIT'],
      limitCount: 1,
      limitNameType: true,
      condition: (gameState: GameState, playerState: PlayerState) => {
        // Condition: 3 BLUE units on field
        const blueUnits = playerState.unitZone.filter(c => c && c.color === 'BLUE' && c.type === 'UNIT');
        return blueUnits.length >= 3;
      },
      cost: (gameState: GameState, playerState: PlayerState, card: Card) => {
        // Pay 0 fee
        return true;
      },
      execute: (instance: Card, gameState: GameState, playerState: PlayerState) => {
        // 1. Return this card to hand
        AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_FIELD',
          targetFilter: { gamecardId: instance.gamecardId },
          destinationZone: 'HAND'
        }, instance);

        // 2. Identify frontal cards in erosion zone (Front Row only)
        const erosionOptions: { card: Card; source: any }[] = [];
        const frontalCards = playerState.erosionFront
          .filter(c => c && c.displayState === 'FRONT_UPRIGHT');

        frontalCards.forEach(c => {
          if (c) {
            erosionOptions.push({
              card: { ...c },
              source: 'EROSION_FRONT'
            });
          }
        });

        if (erosionOptions.length > 0) {
          // 3. Set pending query for erosion card selection
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: erosionOptions as any,
            title: '选择侵蚀区前排卡牌',
            description: '选择一张前排正面向上的卡牌返回卡组并洗牌。',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'GENERIC_RESOLVE',
            context: { sourceCardId: instance.gamecardId },
            afterSelectionEffects: [
              {
                type: 'MOVE_FROM_EROSION',
                targetFilter: { querySelection: true },
                destinationZone: 'DECK'
              },
              {
                type: 'SHUFFLE_DECK'
              }
            ],
            executionMode: 'IMMEDIATE'
          };
          gameState.logs.push(`[剑仙子] 返回手牌，请选择要回收的前排侵蚀卡...`);
        } else {
          gameState.logs.push(`[剑仙子] 返回手牌，但我方侵蚀区前排没有正面向上的卡牌可回收。`);
        }
      }
    }
  ],
  rarity: 'SR',
  availableRarities: ['SR'],
  uniqueId: null,
  faction: '百濑之水城',
};

export default card;
