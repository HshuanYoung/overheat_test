import { Card, GameState, PlayerState, GameEvent } from '../types/game';
import { GameService } from '../services/gameService';

const card: Card = {
  id: '99999999',
  fullName: '测试巨龙 (Test Dragon)',
  specialName: '',
  type: 'UNIT',
  color: 'RED',
  gamecardId: null as any,
  colorReq: { RED: 1 },
  faction: '测试阵营',
  acValue: 3,
  power: 3000,
  basePower: 3000,
  damage: 2,
  baseDamage: 2,
  godMark: false,
  displayState: 'FRONT_UPRIGHT',
  isExhausted: false,
  isrush: false,
  canAttack: true,
  feijingMark: false,
  canResetCount: 0,
  effects: [
    {
      id: 'effect_continuous_1',
      type: 'CONTINUOUS',
      description: '【永续】只要这张卡在单位区，我方所有红色单位力量+1000，对方所有单位无法攻击。',
      applyContinuous: (gameState: GameState, card: Card) => {
        // Find owner
        const ownerUid = Object.keys(gameState.players).find(uid => 
          gameState.players[uid].unitZone.some(c => c?.gamecardId === card.gamecardId)
        );
        if (!ownerUid) return;
        
        // Buff my red units
        const player = gameState.players[ownerUid];
        player.unitZone.forEach(c => {
          if (c && c.color === 'RED' && c.gamecardId !== card.gamecardId) {
            c.power = (c.power || 0) + 1000;
          }
        });

        // Debuff opponent units
        const opponentUid = Object.keys(gameState.players).find(uid => uid !== ownerUid);
        if (opponentUid) {
          const opponent = gameState.players[opponentUid];
          opponent.unitZone.forEach(c => {
            if (c) {
              c.canAttack = false;
            }
          });
        }
      }
    },
    {
      id: 'effect_triggered_1',
      type: 'TRIGGERED',
      triggerEvent: 'CARD_ENTERED_ZONE',
      isMandatory: true,
      description: '【诱发】当其他单位进入战场时，这张卡力量+500。',
      condition: (gameState: GameState, playerState: PlayerState, card: Card, event?: GameEvent) => {
        return event?.data?.zone === 'UNIT' && event?.sourceCardId !== card.gamecardId;
      },
      execute: (card: Card, gameState: GameState, playerState: PlayerState, event?: GameEvent) => {
        if (card.basePower !== undefined) {
          card.basePower += 500;
        }
        card.power = (card.power || 0) + 500;
      }
    },
    {
      id: 'effect_activated_1',
      type: 'ACTIVATED',
      description: '【启动】支付1点侵蚀，抽一张卡。',
      cost: (gameState: GameState, playerState: PlayerState, card: Card) => {
        // Check if player has at least 1 front erosion card
        const faceUpCards = playerState.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT');
        if (faceUpCards.length >= 1) {
          // Pay cost: move 1 to grave
          const cardToGrave = faceUpCards[0];
          GameService.moveCard(gameState, playerState.uid, 'EROSION_FRONT', playerState.uid, 'GRAVE', cardToGrave!.gamecardId);
          return true;
        }
        return false;
      },
      execute: (card: Card, gameState: GameState, playerState: PlayerState, event?: GameEvent) => {
        if (playerState.deck.length > 0) {
          const drawnCard = playerState.deck.pop()!;
          drawnCard.cardlocation = 'HAND';
          playerState.hand.push(drawnCard);
          gameState.logs.push(`${playerState.displayName} 通过 [测试巨龙] 的效果抽了一张卡。`);
        }
      }
    }
  ],
  imageUrl: 'https://picsum.photos/seed/testdragon/400/600',
  fullImageUrl: 'https://picsum.photos/seed/testdragon/800/1200',
  rarity: 'UR',
};

export default card;
