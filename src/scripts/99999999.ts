import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '99999999',
  fullName: '实验巨龙 (Test Dragon)',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '九尾商会联盟',
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
      limitNameType: true,
      description: '【启动】[一回合一次][手牌]（对抗阶段亦可） 将这张卡丢弃，抽1张卡。',
      cost: async (gameState: GameState, playerState: PlayerState, card: Card) => {
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DISCARD_CARD',
          targetFilter: { gamecardId: card.gamecardId }
        }, card);
        gameState.logs.push(`${playerState.displayName} 丢弃了 ${card.fullName}`);
        return true;
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
      description: '【启动】[一局一次][战场]（对抗阶段亦可） 侵蚀区存在4-6张卡牌时，将此卡横置，选择场上一个[非红色][非侵蚀区]且[费用<3][力量<3000]的单位破坏。',
      condition: (gameState: GameState, playerState: PlayerState, card: Card) => {
        const erosionCount = playerState.erosionFront.filter(c => c !== null).length +
          playerState.erosionBack.filter(c => c !== null).length;
        if (erosionCount < 4 || erosionCount > 6) return false;

        const hasTarget = Object.values(gameState.players).some(p => {
          return p.unitZone.some(u => {
            if (!u) return false;
            return u.color !== 'RED' && u.acValue < 3 && u.power < 3000;
          });
        });

        return hasTarget;
      },
      cost: async (gameState: GameState, playerState: PlayerState, card: Card) => {
        if (card.isExhausted) return false;
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'ROTATE_HORIZONTAL',
          targetFilter: { gamecardId: card.gamecardId }
        }, card);
        return true;
      },
      execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
        const options: any[] = [];
        Object.keys(gameState.players).forEach(uid => {
          const p = gameState.players[uid];
          const isMine = uid === playerState.uid;
          p.unitZone.forEach(u => {
            if (u && u.color !== 'RED' && u.acValue < 3 && u.power < 3000) {
              options.push({
                card: u,
                source: u.cardlocation as any,
                isMine: isMine,
                ownerName: p.displayName
              });
            }
          });
        });

        if (options.length > 0) {
          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options,
            title: '选择破坏目标',
            description: '请选择场上一个费用<3且力量<3000的非红色单位破坏',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              sourceCardId: instance.gamecardId,
              effectIndex: 1
            }
          };
        }
      },
      onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[]) => {
        const targetId = selections[0];
        await AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'DESTROY_CARD',
          targetFilter: { gamecardId: targetId }
        }, instance);
        gameState.logs.push(`[实验巨龙] 破坏效果已结算`);
      }
    },
    {
      id: 'testdragon_effect_3',
      type: 'TRIGGER',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '【诱发】这张卡进入战场时，场上除这张卡以外的所有卡牌返回持有者手牌。',
      condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
        const isOnBattlefield = instance.cardlocation === 'UNIT' || instance.cardlocation === 'ITEM';
        if (!event) return isOnBattlefield;

        const isSelf = event.type === 'CARD_ENTERED_ZONE' &&
          (event.sourceCardId === instance.gamecardId || event.sourceCard === instance);

        const isTargetZone = event.data?.zone === 'UNIT' || event.data?.zone === 'ITEM';
        return isSelf && isTargetZone && isOnBattlefield;
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
  rarity: 'UR',
  availableRarities: ['UR'],
  uniqueId: null,
};

export default card;
