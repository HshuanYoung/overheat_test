import { Card, CardEffect, TriggerLocation } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, moveCard, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('202050032_sac_draw', '选择你的1个重置单位送入墓地。之后抽1张卡。', async (instance, gameState, playerState) => {
    const candidates = ownUnits(playerState).filter(unit => !unit.isExhausted);
    if (candidates.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      candidates,
      '选择送入墓地的单位',
      '选择你的1个重置单位，将其送入墓地。之后，抽1张卡。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '202050032_sac_draw' }
    );
  }, {
    condition: (_gameState, playerState) => ownUnits(playerState).some(unit => !unit.isExhausted),
    onQueryResolve: async (instance, gameState, playerState, selections) => {
      const target = ownUnits(playerState).find(unit => unit.gamecardId === selections[0]);
      if (!target) return;
      moveCard(gameState, playerState.uid, target, 'GRAVE', instance);
      await AtomicEffectExecutor.execute(gameState, playerState.uid, { type: 'DRAW', value: 1 }, instance);
    }
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 202050032
 * Card2 Row: 50
 * Card Row: 50
 * Source CardNo: BT01-R12
 * Package: ST01(TD),BT01(C)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 选择你的1个重置单位，将其送入墓地。之后，抽1张卡。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '202050032',
  fullName: '决裂',
  specialName: '',
  type: 'STORY',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '伊列宇王国',
  acValue: -5,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'U',
  availableRarities: ['U', 'C'],
  cardPackage: 'BT01',
  uniqueId: null as any,
};

export default card;
