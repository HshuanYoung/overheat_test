import { Card, GameState, PlayerState, CardEffect, TriggerLocation } from '../types/game';
import { EventEngine } from '../services/EventEngine';

const getErosionCount = (player: PlayerState) => {
  const front = player.erosionFront.filter(c => c !== null).length;
  const back = player.erosionBack.filter(c => c !== null).length;
  return front + back;
};

const findCardInUnitZone = (gameState: GameState, gamecardId: string): Card | undefined => {
  for (const player of Object.values(gameState.players)) {
    const found = player.unitZone.find(u => u?.gamecardId === gamecardId);
    if (found) return found;
  }
  return undefined;
};

const universalEquipEffect: CardEffect = {
  id: 'equip_universal',
  type: 'ACTIVATED',
  description: '【起】〔回合1次〕：在你的主要阶段，你可以选择你场上的一个单位，装备这张卡；或者解除这张卡的装备状态。',
  limitCount: 1,
  limitNameType: false,
  triggerLocation: ['ITEM'],
  condition: (gameState) => gameState.phase === 'MAIN',
  execute: async (card, gameState, playerState) => {
    const currentHostId = card.equipTargetId;
    const options: any[] = [];

    if (currentHostId) {
      options.push({ card: card, source: 'ITEM' as any });
    } else {
      const units = playerState.unitZone.filter(u => u !== null) as Card[];
      options.push(...units.map(u => ({ card: u, source: 'UNIT' as any })));
    }

    if (options.length === 0) {
      gameState.logs.push(`[系统] 没有可供操作的目标单位`);
      return;
    }

    gameState.pendingQuery = {
      id: Math.random().toString(36).substring(7),
      type: 'SELECT_CARD',
      playerUid: playerState.uid,
      options: options,
      title: currentHostId ? '解除装备' : '选择装备目标',
      description: currentHostId ? '选择卡牌本身以确认解除装备状态。' : `选择一个单位进行装备 ${card.fullName}`,
      minSelections: 1,
      maxSelections: 1,
      callbackKey: 'EFFECT_RESOLVE',
      context: {
        sourceCardId: card.gamecardId,
        effectId: 'equip_universal'
      }
    };
  },
  onQueryResolve: async (card, gameState, playerState, selections, context) => {
    const selectedId = selections[0];
    if (selectedId === card.gamecardId) {
      gameState.logs.push(`[效果] ${card.fullName} 已解除装备`);
      card.equipTargetId = undefined;
    } else {
      card.equipTargetId = selectedId;
      const targetUnit = playerState.unitZone.find(u => u?.gamecardId === selectedId);
      gameState.logs.push(`[效果] ${card.fullName} 装备到了 ${targetUnit?.fullName || '未知单位'}`);
    }
    EventEngine.recalculateContinuousEffects(gameState);
  }
};

const applyContinuousBonus = (gameState: GameState, card: Card) => {
  if (!card.equipTargetId) return;

  const playerUid = Object.keys(gameState.players).find(uid =>
    gameState.players[uid].itemZone.some(c => c?.gamecardId === card.gamecardId)
  );
  if (!playerUid) return;

  const target = findCardInUnitZone(gameState, card.equipTargetId);
  const player = gameState.players[playerUid];

  if (target) {
    // 1. Basic Stat Boost: +1 Damage / +1000 Power
    target.power = (target.power || 0) + 1000;
    target.damage = (target.damage || 0) + 1;

    if (!target.influencingEffects) target.influencingEffects = [];
    target.influencingEffects.push({
      sourceCardName: card.fullName,
      description: '力量+1000，伤害+1'
    });

    // 2. Defense Restriction
    if (gameState.battleState && gameState.battleState.attackers.includes(card.equipTargetId)) {
      const erosionCount = getErosionCount(player);
      if (erosionCount >= 5 && erosionCount <= 7) {
        // Alliance Exception: if in coalition, and other units can be defended, this effect is ineffective.
        if (gameState.battleState.isAlliance) {
          // If in an alliance, assume the other unit makes the attack "defendable" by normal units.
        } else {
          // Set restriction: Opponent cannot defend with units power < 2500
          const currentRestriction = gameState.battleState.defensePowerRestriction || 0;
          gameState.battleState.defensePowerRestriction = Math.max(currentRestriction, 2500);

          if (!target.influencingEffects) target.influencingEffects = [];
          target.influencingEffects.push({
            sourceCardName: card.fullName,
            description: '对方不能使用力量值低于 2500 的单位防御此攻击'
          });
        }
      }
    }
  } else {
    // Release equipment if target is gone
    gameState.logs.push(`[系统] ${card.fullName} 的装备对象已离开战场，装备已解除。`);
    card.equipTargetId = undefined;
  }
};

const card: Card = {
  id: '30205010',
  fullName: '武斗神姬「史嘉蒂」',
  specialName: '史嘉蒂',
  type: 'ITEM',
  isEquip: true,
  color: 'RED',
  gamecardId: null as any,
  colorReq: { 'RED': 1 },
  faction: '伊列宇王国',
  acValue: 3,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: [
    universalEquipEffect,
    {
      id: 'continuous_bonus',
      type: 'CONTINUOUS',
      description: '装备此卡的单位：伤害+1，力量+1000。侵蚀区处于5-7时，对手不能用力量值低于2500的单位防御此攻击（联军时，若联军其他单位可被防御则失效）。',
      applyContinuous: applyContinuousBonus
    }
  ],
  rarity: 'R',
  availableRarities: ['R'],
  uniqueId: null as any,
};

export default card;
