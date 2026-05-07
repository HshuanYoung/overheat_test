import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor, canPutItemOntoBattlefield, canPutUnitOntoBattlefield, createSelectCardQuery, enteredFromHand, moveCard, moveCardAsCost } from './BaseUtil';

const isSilverInstrument = (card: Card) =>
  card.fullName.includes('银乐器');

const canPutSilverInstrumentOntoField = (playerState: any, card: Card) =>
  (card.type === 'ITEM' && canPutItemOntoBattlefield(playerState, card)) ||
  (card.type === 'UNIT' && canPutUnitOntoBattlefield(playerState, card));

const uniqueNameCards = (cards: Card[]) => {
  const seen = new Set<string>();
  return cards.filter(card => {
    if (seen.has(card.fullName)) return false;
    seen.add(card.fullName);
    return true;
  });
};

const cardEffects: CardEffect[] = [{
  id: '103090466_enter_put_instruments',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  description: '从手牌进入单位区时，将墓地中卡名不同的卡名含有《银乐器》的卡尽可能多地放置到战场上。',
  condition: (_gameState, playerState, instance, event?: GameEvent) =>
    event?.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT' &&
    enteredFromHand(instance, event) &&
    playerState.grave.some(card => isSilverInstrument(card) && canPutSilverInstrumentOntoField(playerState, card)),
  execute: async (instance, gameState, playerState) => {
    const targets = uniqueNameCards(
      playerState.grave.filter(card => isSilverInstrument(card) && canPutSilverInstrumentOntoField(playerState, card))
    );
    for (const target of targets) {
      if (!canPutSilverInstrumentOntoField(playerState, target)) continue;
      moveCard(gameState, playerState.uid, target, target.type === 'UNIT' ? 'UNIT' : 'ITEM', instance);
    }
  }
}, {
  id: '103090466_send_two_draw',
  type: 'ACTIVATE',
  triggerLocation: ['UNIT'],
  limitCount: 1,
  limitNameType: true,
  description: '同名1回合1次：你的主要阶段，将卡组中2张卡名不同且卡名含有《银乐器》的卡送去墓地，抽1张卡。',
  condition: (_gameState, playerState) => {
    if (!playerState.isTurn) return false;
    const names = new Set(playerState.deck.filter(isSilverInstrument).map(card => card.fullName));
    return names.size >= 2;
  },
  execute: async (instance, gameState, playerState) => {
    const candidates = playerState.deck.filter(isSilverInstrument);
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择银乐器',
      '选择卡组中2张卡名不同且卡名含有《银乐器》的卡送入墓地，之后抽1张卡。',
      2,
      2,
      { sourceCardId: instance.gamecardId, effectId: '103090466_send_two_draw', step: 'SEND' },
      () => 'DECK'
    );
  },
  onQueryResolve: async (instance, gameState, playerState, selections, context) => {
    if (context?.step !== 'SEND') return;
    const targets = selections
      .map(id => playerState.deck.find(card => card.gamecardId === id))
      .filter((card): card is Card => !!card && isSilverInstrument(card));

    if (targets.length !== 2 || new Set(targets.map(card => card.fullName)).size !== 2) {
      gameState.logs.push(`[${instance.fullName}] 选择的《银乐器》卡不合法，效果结算失败。`);
      return;
    }

    targets.forEach(card => moveCardAsCost(gameState, playerState.uid, card, 'GRAVE', instance));
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
    await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
  }
}];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 103090466
 * Card2 Row: 353
 * Card Row: 593
 * Source CardNo: ST02-G08
 * Package: ST02(TD)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 1.诱发效果，这个单位从手牌进入单位区时，将你的墓地中的卡名不同的卡名含有‘银乐器’的卡最多各一张，尽可能多的放置到战场上。
 * 2.启动效果，卡名一回合一次，你的主要阶段才能发动，将你的卡组中两张卡名不同的卡名带有‘银乐器’的卡送去墓地：抽一张卡
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '103090466',
  fullName: '且听风银「哈路其」',
  specialName: '哈路其',
  type: 'UNIT',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 2 },
  faction: '瑟诺布',
  acValue: 3,
  power: 2500,
  basePower: 2500,
  damage: 2,
  baseDamage: 2,
  godMark: true,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
