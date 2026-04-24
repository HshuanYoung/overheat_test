import { Card, GameState, PlayerState, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const trigger_104010172: CardEffect = {
  id: '104010172_trigger',
  type: 'TRIGGER',
  erosionTotalLimit: [1, 4],
  description: '【诱发】【名称一回合一次】侵蚀区数量为1-4时，当此单位因你的卡牌效果从单位区返回手牌时：你可以发动。从手牌中选择一张除「水仙-灵法师」以外、「百濑之水城」势力的单位卡放置到战场上。',
  triggerLocation: ['HAND'],
  triggerEvent: 'CARD_FIELD_TO_HAND',
  isMandatory: false,
  limitCount: 1,
  limitNameType: true,
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    if (!playerState.unitZone.some(u => u === null)) return false;
    if (!event || event.type !== 'CARD_FIELD_TO_HAND') return false;

    const isSelf =
      event.sourceCard === instance ||
      event.sourceCardId === instance.gamecardId ||
      event.data?.previousSourceCardId === instance.gamecardId;
    const isFromUnitZone = event.data?.zone === 'UNIT';
    const isByEffect = !!event.data?.isEffect;
    const isMyEffect = event.data?.effectSourcePlayerUid === playerState.uid;

    if (!isSelf || !isFromUnitZone || !isByEffect || !isMyEffect) return false;

    const targets = playerState.hand.filter(c =>
      c.gamecardId !== instance.gamecardId &&
      c.type === 'UNIT' &&
      c.faction === '百濑之水城' &&
      c.fullName !== '水仙--灵法师'
    );

    return targets.length > 0;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    const targets = playerState.hand.filter(c =>
      c.gamecardId !== instance.gamecardId &&
      c.type === 'UNIT' &&
      c.faction === '百濑之水城' &&
      c.fullName !== '水仙--灵法师'
    ) as Card[];

    if (targets.length === 0) return;

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, targets.map(c => ({ card: c, source: 'HAND' }))),
      title: '选择放置的单位',
      description: '请选择一张「百濑之水城」单位放置到战场上。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: instance.gamecardId,
        effectId: '104010172_trigger',
        step: 1
      }
    };
  },
  onQueryResolve: async (instance: Card, gameState: GameState, playerState: PlayerState, selections: string[], context: any) => {
    if (context.step !== 1) return;

    const targetId = selections[0];
    const targetCard = playerState.hand.find(c => c.gamecardId === targetId);
    if (!targetCard) return;

    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'MOVE_FROM_HAND',
      targetFilter: { gamecardId: targetId },
      destinationZone: 'UNIT'
    }, instance);

    gameState.logs.push(`[${instance.fullName}] 效果：将手牌中的 ${targetCard.fullName} 放置到了战场上。`);
  }
};

const card: Card = {
  id: '104010172',
  fullName: '水仙--灵法师',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '百濑之水城',
  acValue: 2,
  power: 1500,
  basePower: 1500,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [trigger_104010172],
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT03',
  uniqueId: null,
};

export default card;
