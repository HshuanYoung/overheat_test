import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, ensureData, moveCard, moveTopDeckTo, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('201000039_sync', '创痕3：卡组顶2张放置到侵蚀区。回合结束时，墓地2张《同步集中》以外白色卡放到卡组底。', async (instance, gameState, playerState) => {
    moveTopDeckTo(gameState, playerState.uid, 2, 'EROSION_FRONT', instance);
    ensureData(instance).syncEndTurn = gameState.turnCount;
    (playerState as any).syncEndBottomTurn = gameState.turnCount;
    (playerState as any).syncEndBottomSourceId = instance.gamecardId;
  }, { erosionBackLimit: [3, 10] }), {
    id: '201000039_end_bottom',
    type: 'TRIGGER',
    triggerEvent: 'TURN_END' as any,
    triggerLocation: ['GRAVE'],
    isMandatory: true,
    description: '回合结束时，选择墓地最多2张《同步集中》以外白色卡放到卡组底。',
    condition: (_gameState, playerState, instance, event) =>
      event?.playerUid === playerState.uid &&
      (
        ensureData(instance).syncEndTurn === _gameState.turnCount ||
        (
          (playerState as any).syncEndBottomTurn === _gameState.turnCount &&
          (playerState as any).syncEndBottomSourceId === instance.gamecardId
        )
      ) &&
      playerState.grave.some(card => card.id !== '201000039' && AtomicEffectExecutor.matchesColor(card, 'WHITE')),
    execute: async (instance, gameState, playerState) => {
      const candidates = playerState.grave.filter(card => card.id !== '201000039' && AtomicEffectExecutor.matchesColor(card, 'WHITE'));
      const count = Math.min(2, candidates.length);
      createSelectCardQuery(
        gameState,
        playerState.uid,
        candidates,
        '选择放回卡组底的卡',
        `选择你的墓地中的${count}张《同步集中》以外的白色卡，放置到卡组底。`,
        count,
        count,
        { sourceCardId: instance.gamecardId, effectId: '201000039_end_bottom' },
        () => 'GRAVE'
      );
    },
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      selections
        .map(id => playerState.grave.find(card => card.gamecardId === id))
        .filter((card): card is Card => !!card)
        .forEach(card => moveCard(gameState, playerState.uid, card, 'DECK', instance, { insertAtBottom: true }));
      delete ensureData(instance).syncEndTurn;
      delete (playerState as any).syncEndBottomTurn;
      delete (playerState as any).syncEndBottomSourceId;
    }
  }];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 201000039
 * Card2 Row: 70
 * Card Row: 70
 * Source CardNo: BT01-W15
 * Package: BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【创痕3】（你的侵蚀区中的背面卡有3张以上时才有效）将你的卡组顶的2张卡放置到侵蚀区。回合结束时，选择你的墓地中的2张《同步集中》以外的白色卡，放置到卡组底。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '201000039',
  fullName: '同步集中',
  specialName: '',
  type: 'STORY',
  color: 'WHITE',
  gamecardId: null as any,
  colorReq: { WHITE: 1 },
  faction: '无',
  acValue: 0,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
