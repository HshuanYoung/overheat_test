import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const card: Card = {
  id: '10402021',
  fullName: '龙翼看板娘[小婷]',
  specialName: '小婷',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: {},
  faction: '冒险家公会',
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
  effects: [
    {
      id: 'dragon_wing_receptionist_activate',
      type: 'ACTIVATE',
      limitCount: 1,
      limitNameType: true,
      triggerLocation: ['UNIT'],
      description: '【同名回合1次】横置这张卡：选择你单位区中这张卡以外的1个非「神蚀」的「冒险家公会」单位，以及你侵蚀区正面由你持有的1张非「神蚀」的「冒险家公会」单位卡。将选择的侵蚀区单位卡正面向上的纵置摆放进入单位区，随后将选择的单位区对应的单位正面向上的纵置摆放进入侵蚀区。',
      condition: (gameState, playerState, instance) => {
        if (instance.isExhausted) return false;

        const hasOtherFieldUnit = playerState.unitZone.some(u =>
          u !== null &&
          u.gamecardId !== instance.gamecardId &&
          !u.godMark &&
          u.faction === '冒险家公会'
        );

        const fieldSpecialNames = new Set(playerState.unitZone.filter(u => u && u.specialName).map(u => u!.specialName));
        const itemSpecialNames = new Set(playerState.itemZone.filter(i => i && i.specialName).map(i => i!.specialName));

        const hasErosionUnit = playerState.erosionFront.some(c =>
          c !== null &&
          c.type === 'UNIT' &&
          !c.godMark &&
          c.faction === '冒险家公会' &&
          (!c.specialName || (!fieldSpecialNames.has(c.specialName) && !itemSpecialNames.has(c.specialName)))
        );

        return hasOtherFieldUnit && hasErosionUnit;
      },
      execute: async (card, gameState, playerState) => {
        // 1. Cost: Exhaust
        card.isExhausted = true;
        gameState.logs.push(`${playerState.displayName} 横置了 ${card.fullName} 以触发效果。`);

        // 2. Step 1: Select Field Unit
        const fieldUnits = playerState.unitZone.filter(u =>
          u !== null &&
          u.gamecardId !== card.gamecardId &&
          !u.godMark &&
          u.faction === '冒险家公会'
        ) as Card[];

        gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, fieldUnits.map(u => ({ card: u, source: 'UNIT' as any }))),
          title: '选择战场单位',
          description: '效果结算：请选择你战场上另一个非「神蚀」的「冒险家公会」单位。该单位将被置入侵蚀区。',
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { sourceCardId: card.gamecardId, effectIndex: 0, step: 1 }
        };
      },
      onQueryResolve: async (card, gameState, playerState, selections, context) => {
        const step = context?.step || 1;

        if (step === 1) {
          const fieldUnitId = selections[0];

          // 3. Step 2: Select Erosion Unit
          const fieldSpecialNames = new Set(playerState.unitZone.filter(u => u && u.specialName).map(u => u!.specialName));
          const itemSpecialNames = new Set(playerState.itemZone.filter(i => i && i.specialName).map(i => i!.specialName));

          const erosionUnits = playerState.erosionFront.filter(c =>
            c !== null &&
            c.type === 'UNIT' &&
            !c.godMark &&
            c.faction === '冒险家公会' &&
            (!c.specialName || (!fieldSpecialNames.has(c.specialName) && !itemSpecialNames.has(c.specialName)))
          ) as Card[];

          gameState.pendingQuery = {
            id: Math.random().toString(36).substring(7),
            type: 'SELECT_CARD',
            playerUid: playerState.uid,
            options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, erosionUnits.map(u => ({ card: u, source: 'EROSION_FRONT' as any }))),
            title: '选择侵蚀区单位卡',
            description: '效果结算：请选择你侵蚀区正面一张非「神蚀」的「冒险家公会」单位卡。该卡牌将进入战场。',
            minSelections: 1,
            maxSelections: 1,
            callbackKey: 'EFFECT_RESOLVE',
            context: {
              sourceCardId: card.gamecardId,
              effectIndex: 0,
              step: 2,
              fieldUnitId
            }
          };
        } else if (step === 2) {
          const fieldUnitId = context.fieldUnitId;
          const erosionUnitId = selections[0];

          const fieldUnit = playerState.unitZone.find(u => u?.gamecardId === fieldUnitId);
          const erosionUnit = playerState.erosionFront.find(c => c?.gamecardId === erosionUnitId);

          if (fieldUnit && erosionUnit) {
            // Swap execution
            // Move erosion to field
            erosionUnit.isExhausted = false;
            erosionUnit.displayState = 'FRONT_UPRIGHT';
            await AtomicEffectExecutor.execute(gameState, playerState.uid, {
              type: 'MOVE_FROM_EROSION',
              destinationZone: 'UNIT',
              targetFilter: { gamecardId: erosionUnitId }
            }, card);

            // Move field to erosion
            fieldUnit.displayState = 'FRONT_UPRIGHT';
            await AtomicEffectExecutor.execute(gameState, playerState.uid, {
              type: 'MOVE_FROM_FIELD',
              destinationZone: 'EROSION_FRONT',
              targetFilter: { gamecardId: fieldUnitId }
            }, card);

            gameState.logs.push(`[龙翼看板娘[小婷]] 效果生效：${fieldUnit.fullName} 与 ${erosionUnit.fullName} 进行了互换。`);
          }
        }
      }
    }
  ],
  rarity: 'C',
  availableRarities: ['C'],
  uniqueId: null as any,
};

export default card;
