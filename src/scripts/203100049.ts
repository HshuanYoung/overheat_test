import { Card, CardEffect } from '../types/game';
import { AtomicEffectExecutor, createSelectCardQuery, ensureData, getOpponentUid, moveCard, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203100049_control_witch', '创痕3：选择对手1个单位，你得到其控制权。只要你控制着那个单位，那个单位也视为卡名含有《魔女》。', async (instance, gameState, playerState) => {
  const opponentUid = getOpponentUid(gameState, playerState.uid);
  const targets = ownUnits(gameState.players[opponentUid]);
  if (targets.length === 0 || !playerState.unitZone.some(slot => slot === null)) return;
  createSelectCardQuery(
    gameState,
    playerState.uid,
    targets,
    '选择取得控制权的单位',
    '选择对手的1个单位，你得到其控制权。',
    1,
    1,
    { sourceCardId: instance.gamecardId, effectId: '203100049_control_witch' }
  );
}, {
  erosionBackLimit: [3, 10],
  targetSpec: {
    title: '选择取得控制权的单位',
    description: '选择对手的1个单位，你得到其控制权。',
    minSelections: 1,
    maxSelections: 1,
    zones: ['UNIT'],
    controller: 'OPPONENT',
    getCandidates: (gameState, playerState) => {
      const opponentUid = getOpponentUid(gameState, playerState.uid);
      return ownUnits(gameState.players[opponentUid]).map(card => ({ card, source: 'UNIT' as any }));
    }
  },
  onQueryResolve: async (instance, gameState, playerState, selections) => {
    const opponentUid = getOpponentUid(gameState, playerState.uid);
    const target = selections[0] ? AtomicEffectExecutor.findCardById(gameState, selections[0]) : undefined;
    if (!target || target.cardlocation !== 'UNIT') return;
    const data = ensureData(target);
    data.controlChangedBy = instance.fullName;
    data.extraNameContainsWitchBy = instance.fullName;
    data.originalControllerUid = opponentUid;
    moveCard(gameState, opponentUid, target, 'UNIT', instance, { toPlayerUid: playerState.uid });
  }
})];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203100049
 * Card2 Row: 118
 * Card Row: 118
 * Source CardNo: BT02-G12
 * Package: BT02(SR,ESR)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 【创痕3】选择对手的1个单位，你得到其控制权。只要你控制着那个单位，那个单位同时也视为卡名含有《魔女》的单位。
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203100049',
  fullName: '魔女凭依',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 3 },
  faction: '艾柯利普斯',
  acValue: 7,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  feijingMark: false,
  canResetCount: 0,
  effects: cardEffects,
  rarity: 'SR',
  availableRarities: ['SR'],
  cardPackage: 'BT02',
  uniqueId: null as any,
};

export default card;
