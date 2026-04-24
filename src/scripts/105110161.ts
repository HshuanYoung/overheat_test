import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { GameService } from '../services/gameService';
import { createSelectCardQuery } from './_bt02YellowUtils';

const effect_105110161_activate: CardEffect = {
  id: '105110161_activate',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: 'Destroy one allied item, then give one allied unit +1 damage and +500 power this turn.',
  condition: (_gameState, playerState) =>
    playerState.itemZone.some(card => card !== null) &&
    playerState.unitZone.some(card => card !== null),
  execute: async (instance, gameState, playerState) => {
    const ownItems = playerState.itemZone.filter((card): card is Card => !!card);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      ownItems,
      'Choose An Item',
      'Destroy 1 allied item.',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105110161_activate', step: 'DESTROY_ITEM' }
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context.step === 'DESTROY_ITEM') {
      const targetItem = AtomicEffectExecutor.findCardById(gameState, selections[0]);
      if (!targetItem) return;

      await GameService.destroyUnit(gameState, playerState.uid, targetItem.gamecardId, true, playerState.uid);

      const ownUnits = playerState.unitZone.filter((card): card is Card => !!card);
      if (ownUnits.length === 0) return;

      createSelectCardQuery(
        gameState,
        playerState.uid,
        ownUnits,
        'Choose A Unit',
        'Choose 1 allied unit to buff.',
        1,
        1,
        { sourceCardId: instance.gamecardId, effectId: '105110161_activate', step: 'BUFF_UNIT' }
      );
      return;
    }

    if (context.step === 'BUFF_UNIT') {
      const targetId = selections[0];
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'CHANGE_DAMAGE',
        value: 1,
        turnDuration: 1,
        targetFilter: { gamecardId: targetId }
      }, instance);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, {
        type: 'CHANGE_POWER',
        value: 500,
        turnDuration: 1,
        targetFilter: { gamecardId: targetId }
      }, instance);
    }
  }
};

const card: Card = {
  id: '105110161',
  fullName: '学生会执行员',
  specialName: '',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: {},
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
  effects: [effect_105110161_activate],
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
