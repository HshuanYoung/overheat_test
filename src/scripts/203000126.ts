import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, canPutUnitOntoBattlefield, cardsInZones, createSelectCardQuery, moveCard, nameContains, ownUnits, putUnitOntoField, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203000126_ritual', '同名1回合1次：若你战场有3个以上《图腾》单位，从卡组或墓地将1张《霸者》单位加入手牌后放置到战场。', async (instance, gameState, playerState) => {
  const candidates = cardsInZones(playerState, ['DECK', 'GRAVE']).filter(({ card }) =>
    card.type === 'UNIT' &&
    nameContains(card, '霸者') &&
    canPutUnitOntoBattlefield(playerState, card)
  );
  if (candidates.length === 0) return;
  gameState.pendingQuery = {
    id: Math.random().toString(36).substring(7),
    type: 'SELECT_CARD',
    playerUid: playerState.uid,
    options: AtomicEffectExecutor.enrichQueryOptions(gameState, playerState.uid, candidates),
    title: '选择霸者单位',
    description: '选择卡组或墓地中的1张卡名含有《霸者》的单位卡加入手牌，之后放置到战场。',
    minSelections: 1,
    maxSelections: 1,
    callbackKey: 'EFFECT_RESOLVE',
    context: { sourceCardId: instance.gamecardId, effectId: '203000126_ritual' }
  };
}, {
  limitCount: 1,
  limitNameType: true,
  condition: (_gameState, playerState) => ownUnits(playerState).filter(unit => nameContains(unit, '图腾')).length >= 3,
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const selected = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!selected || (selected.cardlocation !== 'DECK' && selected.cardlocation !== 'GRAVE')) return;
    const fromDeck = selected.cardlocation === 'DECK';
    moveCard(gameState, playerState.uid, selected, 'HAND', instance);
    const inHand = AtomicEffectExecutor.findCardById(gameState, selected.gamecardId);
    if (inHand?.cardlocation === 'HAND') putUnitOntoField(gameState, playerState.uid, inHand, instance);
    if (fromDeck) await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'SHUFFLE_DECK' }, instance);
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203000126
 * Card2 Row: 297
 * Card Row: 536
 * Source CardNo: BT04-G06
 * Package: BT04(R)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 〖同名1回合1次〗：若你的战场上有3个以上的卡名含有《图腾》的单位，将你卡组或墓地中的1张卡名含有《霸者》的单位卡加入手牌之后，将手牌中的那张卡放置到战场上。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203000126',
  fullName: '大灵萨的降灵仪式',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: {},
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'R',
  availableRarities: ['R'],
  cardPackage: 'BT04',
  uniqueId: null as any,
};

export default card;
