import { Card, GameState, PlayerState, CardEffect } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';

const universalEquipEffect: CardEffect = {
  id: 'equip_universal',
  type: 'ACTIVATED',
  description: '【起】〔回合1次〕：在你的主要阶段，你可以选择你场上的一个单位，装备这张卡；或者解除这张卡的装备状态。',
  limitCount: 1,
  limitNameType: false,
  triggerLocation: ['ITEM'],
  condition: (gameState) => gameState.phase === 'MAIN',
  execute: (card, gameState, playerState) => {
    const currentHostId = card.equipTargetId;
    const units = playerState.unitZone.filter(u => u && u.gamecardId !== currentHostId) as Card[];
    
    // Construct options: other units + self (if equipped)
    const options = units.map(u => ({ card: u, source: 'UNIT' as any }));
    if (currentHostId) {
      options.push({ card: card, source: 'ITEM' as any });
    }

    if (options.length === 0) {
      gameState.logs.push(`没有可供装备的目标单位`);
      return;
    }

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: options,
      title: currentHostId ? '重新装备 或 解除装备' : '选择装备目标',
      description: currentHostId ? '选择另一个单位重新装备，或者选择此装备本身以解除装备状态。' : `选择一个单位装备 ${card.fullName}`,
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: { 
        sourceCardId: card.gamecardId, 
        effectId: 'equip_universal'
      }
    };
  },
  resolve: (card, gameState, playerState, selections, context) => {
    const selectedId = selections[0];
    if (selectedId === card.gamecardId) {
      // Unequip
      gameState.logs.push(`${card.fullName} 解除了装备状态`);
      card.equipTargetId = undefined;
    } else {
      // Equip or Move
      card.equipTargetId = selectedId;
      const targetUnit = playerState.unitZone.find(u => u?.gamecardId === selectedId);
      gameState.logs.push(`${card.fullName} 装备到了 ${targetUnit?.fullName || '未知单位'}`);
    }
  }
};

const handActivationEffect: CardEffect = {
  id: 'hand_activation',
  type: 'ACTIVATED',
  description: '【起】：我方场上存在2个或以上蓝色单位。支付2费用，在手牌中发动：选择我方2个非神蚀单位（不能是战斗中的单位）返回持有者手牌。之后，将这张卡放置在战场上，并选择我方场上一个单位装备。',
  triggerLocation: ['HAND'],
  condition: (gameState, playerState) => {
    const blueUnitsCount = playerState.unitZone.filter(u => u && u.color === 'BLUE').length;
    return blueUnitsCount >= 2;
  },
  execute: (card, gameState, playerState) => {
    const queryId = Math.random().toString(36).substring(7);
    gameState.pendingQuery = {
      id: queryId,
      type: 'SELECT_PAYMENT',
      playerUid: playerState.uid,
      options: [],
      title: '发动效果：支付费用',
      description: '请支付2费用以发动效果。',
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      paymentCost: 2,
      paymentColor: card.color,
      context: { 
        sourceCardId: card.gamecardId, 
        effectIndex: 1, // Index of handActivationEffect
        step: 1
      }
    };
  },
  resolve: (card, gameState, playerState, selections, context) => {
    // Note: handleQueryChoice in ServerGameService handles SELECT_PAYMENT special case
    // and resumes the 'remainingEffects' if using structured effects. 
    // However, when using 'resolve', SELECT_PAYMENT choice is passed back here.

    if (context.step === 1) {
      // Step 1: After payment, select 2 units to return to hand
      const targets = playerState.unitZone.filter(u => u && !u.godMark && 
          !(gameState.battleState?.attackers || []).includes(u.gamecardId) && 
          gameState.battleState?.defender !== u.gamecardId) as Card[];
      
      gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: targets.map(t => ({ card: t, source: 'UNIT' as any })),
          title: '选择返回手牌的单位',
          description: '请选择2个非神蚀且不在战斗中的单位。',
          minSelections: 2,
          maxSelections: 2,
          callbackKey: 'EFFECT_RESOLVE',
          context: { ...context, step: 2 }
      };
    } else if (context.step === 2) {
      // Step 2: Return units to hand, move self to field, then select equip target
      for (const id of selections) {
          const targetCard = playerState.unitZone.find(c => c?.gamecardId === id);
          if (targetCard) {
            gameState.logs.push(`[效果] ${targetCard.fullName} 返回了手牌`);
          }
      }
      
      // Let's use AtomicEffectExecutor for Step 2
      selections.forEach(id => {
          AtomicEffectExecutor.execute(gameState, playerState.uid, {
              type: 'MOVE_FROM_FIELD',
              targetFilter: { gamecardId: id },
              destinationZone: 'HAND'
          }, card);
      });

      // Move self to ITEM zone
      AtomicEffectExecutor.execute(gameState, playerState.uid, {
          type: 'MOVE_FROM_HAND',
          targetFilter: { gamecardId: card.gamecardId },
          destinationZone: 'ITEM'
      }, card);

      // Select equip target
      const units = playerState.unitZone.filter(u => u !== null) as Card[];
      gameState.pendingQuery = {
          id: Math.random().toString(36).substring(7),
          type: 'SELECT_CARD',
          playerUid: playerState.uid,
          options: units.map(u => ({ card: u, source: 'UNIT' as any })),
          title: '选择装备目标',
          description: `请选择一个单位装备 ${card.fullName}`,
          minSelections: 1,
          maxSelections: 1,
          callbackKey: 'EFFECT_RESOLVE',
          context: { ...context, step: 3 }
      };
    } else if (context.step === 3) {
      // Step 3: Finalize equipment
      const targetId = selections[0];
      card.equipTargetId = targetId;
      const targetUnit = findCardInUnitZone(gameState, targetId);
      gameState.logs.push(`${card.fullName} 装备到了 ${targetUnit?.fullName || '未知单位'}`);
    }
  }
};

// Continuous Effect helper
const applyContinuousBonus = (gameState: GameState, card: Card) => {
  if (card.equipTargetId) {
    const target = findCardInUnitZone(gameState, card.equipTargetId);
    if (target) {
      target.power = (target.power || 0) + 1000;
      target.damage = (target.damage || 0) + 1;
    }
  }
};

const findCardInUnitZone = (gameState: GameState, gamecardId: string): Card | undefined => {
  for (const player of Object.values(gameState.players)) {
    const found = player.unitZone.find(u => u?.gamecardId === gamecardId);
    if (found) return found;
  }
  return undefined;
};

const card: Card = {
  id: '30401001',
  fullName: '「小太刀——歌月」',
  specialName: '小太刀——歌月',
  type: 'ITEM',
  isEquip: true,
  color: 'BLUE',
  gamecardId: null,
  colorReq: {'BLUE': 2},
  faction: '无',
  acValue: 3,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    universalEquipEffect,
    handActivationEffect,
    {
      type: 'CONTINUOUS',
      description: '装备此卡的单位：伤害+1，力量+1000。',
      applyContinuous: applyContinuousBonus
    }
  ],
  imageUrl: '/pics/30401001_thumb.jpg',
  fullImageUrl: '/pics/30401001_full.jpg',
  rarity: 'R',
};

export default card;
