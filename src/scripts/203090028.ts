import { Card, CardEffect, TriggerLocation } from '../types/game';
import { createSelectCardQuery, destroyByEffect, getOpponentUid, ownUnits, story } from './BaseUtil';

const cardEffects: CardEffect[] = [story('203090028_forced_battle', '主要阶段使用：选择你的1个单位和对手1个非神蚀单位，直接进行伤害判定。', async (instance, gameState, playerState) => {
    const attackers = ownUnits(playerState).filter(unit => !unit.isExhausted);
    if (attackers.length === 0) return;
    createSelectCardQuery(
      gameState,
      playerState.uid,
      attackers,
      '选择攻击单位',
      '选择你的1个单位作为攻击单位。',
      1,
      1,
      { sourceCardId: instance.gamecardId, effectId: '203090028_forced_battle', step: 'ATTACKER' }
    );
  }, {
    condition: (gameState, playerState) =>
      gameState.phase === 'MAIN' &&
      playerState.isTurn &&
      ownUnits(playerState).some(unit => !unit.isExhausted) &&
      ownUnits(gameState.players[getOpponentUid(gameState, playerState.uid)]).some(unit => !unit.godMark),
    onQueryResolve: async (instance, gameState, playerState, selections, context) => {
      if (context?.step === 'ATTACKER') {
        const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
        const defenders = ownUnits(opponent).filter(unit => !unit.godMark);
        if (defenders.length === 0 || !selections[0]) return;
        createSelectCardQuery(
          gameState,
          playerState.uid,
          defenders,
          '选择防御单位',
          '选择对手的1个非神蚀单位作为防御单位。',
          1,
          1,
          {
            sourceCardId: instance.gamecardId,
            effectId: '203090028_forced_battle',
            step: 'DEFENDER',
            attackerId: selections[0]
          }
        );
        return;
      }

      if (context?.step !== 'DEFENDER') return;
      const attacker = ownUnits(playerState).find(unit => unit.gamecardId === context.attackerId);
    const opponent = gameState.players[getOpponentUid(gameState, playerState.uid)];
      const defender = ownUnits(opponent).find(unit => unit.gamecardId === selections[0]);
    if (!attacker || !defender) return;

    const attackerPower = attacker.power || 0;
    const defenderPower = defender.power || 0;
    if (attackerPower > defenderPower) {
      destroyByEffect(gameState, defender, instance);
    } else if (attackerPower < defenderPower) {
      destroyByEffect(gameState, attacker, instance);
    } else {
      destroyByEffect(gameState, attacker, instance);
      destroyByEffect(gameState, defender, instance);
    }
    }
  })];

/**
 * Auto-generated from Card.xlsx + Card2.xlsx.
 * Source CardID: 203090028
 * Card2 Row: 33
 * Card Row: 33
 * Source CardNo: BT01-G12
 * Package: BT01(U)
 * ID Source: card-xlsx
 * Keywords: N/A
 * Card Detail:
 * 只能在主要阶段中使用，且不能用于对抗。选择你的1个单位作为攻击单位，选择对手的1个非神蚀单位作为防御单位，进行战斗。（直接进入伤害判定步骤）
 * TODO: confirm ID / godMark / rarity variants and implement effects.
 */
const card: Card = {
  id: '203090028',
  fullName: '纠纷',
  specialName: '',
  type: 'STORY',
  color: 'GREEN',
  gamecardId: null as any,
  colorReq: { GREEN: 1 },
  faction: '瑟诺布',
  acValue: 2,
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
