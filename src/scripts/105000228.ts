import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, getOpponentUid, markCannotDefendUntilEndOfTurn, moveCard, nameContains, ownUnits } from './BaseUtil';

const cardEffects: CardEffect[] = [{
  id: '105000228_attack_discard',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ATTACK_DECLARED',
  isMandatory: true,
  description: '宣言攻击时，对手可以舍弃1张手牌。若不舍弃，这次战斗中对手不能选择单位宣言防御。',
  condition: (_gameState, _playerState, instance, event) =>
    (event?.data?.attackerIds || []).includes(instance.gamecardId),
  execute: async (instance, gameState, playerState) => {
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const opponent = gameState.players[opponentUid];
    if (opponent.hand.length === 0) {
      ownUnits(opponent).forEach(unit => markCannotDefendUntilEndOfTurn(unit, instance, gameState));
      return;
    }
    createSelectCardQuery(
      gameState,
      opponentUid,
      opponent.hand,
      '是否舍弃手牌',
      '可以选择1张手牌舍弃。若不舍弃，这次战斗中不能选择单位宣言防御。',
      0,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105000228_attack_discard', ownerUid: playerState.uid },
      () => 'HAND'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    const opponentUid = playerState.uid;
    if (selections[0]) {
      const card = playerState.hand.find(candidate => candidate.gamecardId === selections[0]);
      if (card) moveCard(gameState, opponentUid, card, 'GRAVE', instance);
      return;
    }
    ownUnits(playerState).forEach(unit => markCannotDefendUntilEndOfTurn(unit, instance, gameState));
  }
}, {
  id: '105000228_damage_search',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'COMBAT_DAMAGE_CAUSED',
  description: '这个单位对对手造成战斗伤害时，可以将卡组中1张卡名含有《怪盗》的卡加入手牌。',
  condition: (gameState, playerState, instance, event) =>
    event?.playerUid === getOpponentUid(gameState, playerState.uid) &&
    (event.data?.attackerIds || []).includes(instance.gamecardId) &&
    playerState.deck.some(card => nameContains(card, '怪盗')),
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(card => nameContains(card, '怪盗'));
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择怪盗卡',
      '选择卡组中1张卡名含有《怪盗》的卡加入手牌。',
      0,
      1,
      { sourceCardId: instance.gamecardId, effectId: '105000228_damage_search' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.effectId !== '105000228_damage_search') return;
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (selected?.cardlocation === 'DECK') {
      moveCard(gameState, playerState.uid, selected, 'HAND', instance);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
    }
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 105000228
 * Card2 Row: 392
 * Card Row: 262
 * Source CardNo: BT05-Y06
 * Package: BT05(SR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【速攻】
 * 【诱】{这个单位宣言攻击时}:对手可以选择他的1张手牌舍弃。若不舍弃，这次战斗中，对手不能选择单位宣言防御。
 * 【诱】{这个单位对对手造成战斗伤害时}:你可以将你的卡组中的1张卡名含有《怪盗》的卡加入手牌。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '105000228',
  fullName: '偷天的大怪盗「追月」',
  specialName: '追月',
  type: 'UNIT',
  color: 'YELLOW',
  gamecardId: null as any,
  colorReq: { YELLOW: 1 },
  faction: '无',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: true,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT05',
  uniqueId: null as any,
};

export default card;
