import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { addTempDamage, addTempKeyword, addTempPower, getOpponentUid, isFaction, moveCardAsCost, moveRandomGraveToDeckBottom, ownItems, ownUnits } from './BaseUtil';

const ownXenobuFieldCardsExceptSelf = (playerState: { unitZone: (Card | null)[]; itemZone: (Card | null)[] }, instance: Card) =>
  [...playerState.unitZone, ...playerState.itemZone]
    .filter((card): card is Card => !!card && card.gamecardId !== instance.gamecardId && isFaction(card, '瑟诺布'));

const cardEffects: CardEffect[] = [{
  id: '303090077_xenobu_combat_recover',
  type: 'TRIGGER',
  triggerEvent: 'COMBAT_DAMAGE_CAUSED',
  triggerLocation: ['ITEM'],
  description: '你的<瑟诺布>单位对对手造成战斗伤害时，可以随机将墓地中的1张卡放置到卡组底。',
  condition: (gameState, playerState, _instance, event?: GameEvent) => {
    if (event?.playerUid !== getOpponentUid(gameState, playerState.uid) || playerState.grave.length === 0) return false;
    const attackerIds = event.data?.attackerIds || [];
    return attackerIds.some((id: string) => {
      const attacker = AtomicEffectExecutor.findCardById(gameState, id);
      return !!attacker && attacker.cardlocation === 'UNIT' && isFaction(attacker, '瑟诺布');
    });
  },
  execute: async (instance, gameState, playerState) => {
    moveRandomGraveToDeckBottom(gameState, playerState.uid, 1, instance);
  }
}, {
  id: '303090077_xenobu_anthem',
  type: 'ACTIVATE',
  triggerLocation: ['ITEM'],
  limitCount: 1,
  limitNameType: true,
  description: '你的主要阶段，若你战场上这张卡以外的<瑟诺布>卡有10张以上，将这张卡放逐：本回合你的所有<瑟诺布>单位伤害+2、力量+2000，并获得英勇和歼灭。',
  condition: (gameState, playerState, instance) =>
    gameState.phase === 'MAIN' &&
    playerState.isTurn &&
    ownXenobuFieldCardsExceptSelf(playerState, instance).length >= 10,
  cost: async (gameState, playerState, instance) => {
    if (!ownItems(playerState).some(item => item.gamecardId === instance.gamecardId)) return false;
    moveCardAsCost(gameState, playerState.uid, instance, 'EXILE', instance);
    return true;
  },
  execute: async (instance, _gameState, playerState) => {
    ownUnits(playerState).filter(unit => isFaction(unit, '瑟诺布')).forEach(unit => {
      addTempDamage(unit, instance, 2);
      addTempPower(unit, instance, 2000);
      addTempKeyword(unit, instance, 'heroic');
      addTempKeyword(unit, instance, 'annihilation');
    });
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 303090077
 * Card2 Row: 354
 * Card Row: 594
 * Source CardNo: ST02-G13
 * Package: ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 1.诱发效果，你的‘瑟诺布’单位对对手造成战斗伤害时可以选择是否发动：随机将你墓地的中1张卡，将其放置到你的卡组底。
 * 2.启动效果，卡名一回合一次，你的战场上的这张卡以外的‘瑟诺布’的卡有10张或者以上，将这张卡放逐：本回合，你的所有‘瑟诺布’单位获得+2/+2000，并获得英勇和歼灭。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '303090077',
  fullName: '风车故里「瑟诺布」',
  specialName: '瑟诺布',
  type: 'ITEM',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '瑟诺布',
  acValue: 0,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
