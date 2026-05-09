import { Card, CardEffect, GameEvent } from '../types/game';
import { AtomicEffectExecutor } from '../services/AtomicEffectExecutor';
import { createChoiceQuery, getOpponentUid, isVirtualGodMarkReveal, shuffleAndRevealTopCards } from './BaseUtil';

const effect_105000474_enter: CardEffect = {
  id: '105000474_enter',
  type: 'TRIGGER',
  triggerLocation: ['UNIT'],
  triggerEvent: 'CARD_ENTERED_ZONE',
  isMandatory: true,
  description: '这个单位进入战场时，洗切你的卡组并展示卡组顶1张卡。若其为神蚀卡，选择1名玩家，随机舍弃该玩家1张手牌。',
  condition: (_gameState, _playerState, instance, event?: GameEvent) =>
    instance.cardlocation === 'UNIT' &&
    event?.type === 'CARD_ENTERED_ZONE' &&
    event.sourceCardId === instance.gamecardId &&
    event.data?.zone === 'UNIT',
  execute: async (instance, gameState, playerState) => {
    const revealedCard = (await shuffleAndRevealTopCards(gameState, playerState.uid, 1, instance))[0];
    if (!isVirtualGodMarkReveal(gameState, revealedCard)) return;

    createChoiceQuery(
      gameState,
      playerState.uid,
      '选择玩家',
      '选择1名玩家随机舍弃1张手牌。',
      [
        { id: playerState.uid, label: '自己' },
        { id: getOpponentUid(gameState, playerState.uid), label: '对手' }
      ],
      { sourceCardId: instance.gamecardId, effectId: '105000474_enter' }
    );
  },
  onQueryResolve: async (instance, gameState, _playerState, selections) => {
    const chosenUid = selections[0];
    const chosenPlayer = gameState.players[chosenUid];
    if (!chosenPlayer || chosenPlayer.hand.length === 0) return;

    const randomCard = chosenPlayer.hand[Math.floor(Math.random() * chosenPlayer.hand.length)];
    await AtomicEffectExecutor.execute(gameState, chosenUid, {
      type: 'DISCARD_CARD',
      targetFilter: { gamecardId: randomCard.gamecardId }
    }, instance);
  }
};

const card: Card = {
  id: '105000474',
  fullName: '猫耳魔偶',
  specialName: '',
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
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  baseIsrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [effect_105000474_enter],
  rarity: 'C',
  availableRarities: ['C'],
  cardPackage: 'BT03',
  uniqueId: null as any,
};

export default card;
