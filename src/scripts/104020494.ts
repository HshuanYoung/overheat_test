import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canActivateDefaultTiming, createPlayerSelectQuery, createSelectCardQuery, exhaustCost, faceUpErosion, getOpponentUid, moveCard, moveTopDeckTo, totalErosionCount } from './BaseUtil';

const resolvePlayerUid = (gameState: any, controllerUid: string, selection: string) =>
  selection === 'PLAYER_SELF' ? controllerUid : getOpponentUid(gameState, controllerUid);

const cardEffects: CardEffect[] = [{
  id: '104020494_erosion_cycle',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  cost: exhaustCost,
  description: '横置：选择1名玩家侵蚀区1张正面卡送入墓地。之后，将其卡组顶1张放置到侵蚀区。',
  condition: (gameState, playerState, instance) =>
    canActivateDefaultTiming(gameState, playerState) &&
    !instance.isExhausted &&
    Object.values(gameState.players).some(player => faceUpErosion(player).length > 0),
  execute: async (instance, gameState, playerState) => {
    createPlayerSelectQuery(gameState, playerState.uid, '选择玩家', '选择1名玩家处理侵蚀区。', {
      sourceCardId: instance.gamecardId,
      effectId: '104020494_erosion_cycle',
      step: 'PLAYER',
      controllerUid: playerState.uid
    });
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'PLAYER') {
      const targetUid = resolvePlayerUid(gameState, context.controllerUid || playerState.uid, selections[0]);
      const targetPlayer = gameState.players[targetUid];
      createSelectCardQuery(gameState, context.controllerUid || playerState.uid, faceUpErosion(targetPlayer), '选择正面侵蚀卡', '选择该玩家侵蚀区中的1张正面卡送入墓地。', 1, 1, {
        sourceCardId: instance.gamecardId,
        effectId: '104020494_erosion_cycle',
        step: 'EROSION',
        targetUid
      }, () => 'EROSION_FRONT');
      return;
    }
    if (context?.step === 'EROSION') {
      const targetUid = context.targetUid;
      const card = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
      if (card?.cardlocation === 'EROSION_FRONT') moveCard(gameState, targetUid, card, 'GRAVE', instance);
      moveTopDeckTo(gameState, targetUid, 1, 'EROSION_FRONT', instance);
    }
  }
}, {
  id: '104020494_draw_charge',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  erosionTotalLimit: [4, 6],
  limitCount: 1,
  limitNameType: true,
  cost: exhaustCost,
  description: '4~6，同名1回合1次，横置：选择1名玩家抽2张卡，之后那名玩家选择1张手牌放置到侵蚀区。',
  condition: (gameState, playerState, instance) =>
    canActivateDefaultTiming(gameState, playerState) &&
    !instance.isExhausted &&
    totalErosionCount(playerState) >= 4 &&
    totalErosionCount(playerState) <= 6,
  execute: async (instance, gameState, playerState) => {
    createPlayerSelectQuery(gameState, playerState.uid, '选择抽牌玩家', '选择1名玩家抽2张卡，之后其选择1张手牌放置到侵蚀区。', {
      sourceCardId: instance.gamecardId,
      effectId: '104020494_draw_charge',
      step: 'PLAYER',
      controllerUid: playerState.uid
    });
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step === 'PLAYER') {
      const controllerUid = context.controllerUid || playerState.uid;
      const targetUid = resolvePlayerUid(gameState, controllerUid, selections[0]);
      await AtomicEffectExecutor.execute(gameState, targetUid, { type: 'DRAW', value: 2 }, instance);
      const targetPlayer = gameState.players[targetUid];
      if (targetPlayer.hand.length === 0) return;
      createSelectCardQuery(gameState, targetUid, targetPlayer.hand, '选择放置到侵蚀区的手牌', '选择你自己的1张手牌，放置到侵蚀区。', 1, 1, {
        sourceCardId: instance.gamecardId,
        effectId: '104020494_draw_charge',
        step: 'HAND_TO_EROSION',
        targetUid
      }, () => 'HAND');
      return;
    }
    if (context?.step === 'HAND_TO_EROSION') {
      const targetUid = context.targetUid || playerState.uid;
      const card = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
      if (card?.cardlocation === 'HAND') moveCard(gameState, targetUid, card, 'EROSION_FRONT', instance);
    }
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 104020494
 * Card2 Row: 284
 * Card Row: 640
 * Source CardNo: PR03-03B
 * Package: 特殊(PR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【启】:[〖横置〗]选择1名玩家的侵蚀区中的1张正面卡，将其送入墓地。之后，将他的卡组顶的1张卡放置到侵蚀区。 
 * 〖4~6〗【启】〖同名1回合1次〗:[〖横置〗]选择1名玩家抽2张卡，之后，那名玩家选择他自己的1张手牌，放置到侵蚀区。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '104020494',
  fullName: '老练的狐族商人pr',
  specialName: '',
  type: 'UNIT',
  color: 'BLUE',
  gamecardId: null as any,
  colorReq: { BLUE: 1 },
  faction: '九尾商会联盟',
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
  effects: cardEffects,
  rarity: 'PR',
  availableRarities: ['PR'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
