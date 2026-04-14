import { Card, GameState, PlayerState, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const effect_10401042_continuous: CardEffect = {
  id: '10401042_continuous',
  type: 'CONTINUOUS',
  triggerLocation: ['UNIT'],
  description: '【永】若我方单位区仅有一位神蚀单位，且该单位AC值在5点或以上，该单位AC+1、攻击力+500，且获得【神依】。',
  applyContinuous: (gameState: GameState, instance: Card) => {
    // Find owner
    const ownerUid = Object.keys(gameState.players).find(uid =>
      gameState.players[uid].unitZone.some(c => c?.gamecardId === instance.gamecardId)
    );
    if (!ownerUid) return;

    const playerState = gameState.players[ownerUid];
    const godmarkUnits = playerState.unitZone.filter(u => u && u.godMark);

    if (godmarkUnits.length === 1) {
      const target = godmarkUnits[0] as Card;
      if (target.acValue >= 5) {
        target.damage = (target.damage || 0) + 1;
        target.power = (target.power || 0) + 500;
        target.isShenyi = true;

        if (!target.influencingEffects) target.influencingEffects = [];
        target.influencingEffects.push({
          sourceCardName: instance.fullName,
          description: '攻击力+500，伤害值+1，获得【神依】'
        });
      }
    }
  }
};

const effect_10401042_trigger: CardEffect = {
  id: '10401042_trigger',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  description: '【诱发】当此单位从手牌进入对战区时，若我方对战区仅有一位神蚀单位，抽一张牌。',
  condition: (gameState: GameState, playerState: PlayerState, instance: Card, event?: GameEvent) => {
    if (!event) return false;

    const isSelf = event.type === 'CARD_ENTERED_ZONE' &&
      (event.sourceCardId === instance.gamecardId || event.sourceCard === instance);
    const isTargetZone = event.data?.zone === 'UNIT';

    if (!isSelf || !isTargetZone) return false;

    // Check for exactly one godmark unit
    const godmarkUnits = playerState.unitZone.filter(u => u && u.godMark);
    return godmarkUnits.length === 1;
  },
  execute: async (instance: Card, gameState: GameState, playerState: PlayerState) => {
    await AtomicEffectExecutor.execute(gameState, playerState.uid, {
      type: 'DRAW',
      value: 1
    }, instance);
    gameState.logs.push(`[${instance.fullName}] 发动：因战场上仅有一位神蚀单位，抽了一张牌。`);
  }
};

const card: Card = {
  id: '10401042',
  fullName: '水城名厨【加玲】',
  specialName: '加玲',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { 'BLUE': 1 },
  faction: '百濑之水城',
  acValue: 2,
  power: 1000,
  basePower: 1000,
  damage: 1,
  baseDamage: 1,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    effect_10401042_continuous,
    effect_10401042_trigger
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null,
};

export default card;

