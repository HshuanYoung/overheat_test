
export type CardType = 'UNIT' | 'STORY' | 'ITEM';
export type CardColor = 'RED' | 'WHITE' | 'YELLOW' | 'BLUE' | 'GREEN' | 'NONE';
export type EffectType = 'CONTINUOUS' | 'TRIGGERED' | 'ACTIVATED' | 'ALWAYS' | 'TRIGGER' | 'ACTIVATE';
export type TriggerLocation = 'HAND' | 'UNIT' | 'ITEM' | 'GRAVE' | 'EXILE' | 'EROSION_FRONT' | 'EROSION_BACK' | 'PLAY' | 'DECK';

export type GameEventType = 
  | 'CARD_ENTERED_ZONE'
  | 'CARD_LEFT_ZONE'
  | 'ATTACK_DECLARED'
  | 'DAMAGE_TAKEN'
  | 'EFFECT_ACTIVATED'
  | 'CARD_DISCARDED'
  | 'CARD_DRAWN'
  | 'DECK_SHUFFLED'
  | 'PHASE_CHANGED';

export interface GameEvent {
  type: GameEventType;
  sourceCardId?: string;
  targetCardId?: string;
  playerUid?: string;
  data?: any;
}

export interface CardEffect {
  id?: string;
  type: EffectType;
  limitCount?: number; // For ONCE_PER_TURN and ONCE_PER_GAME, this should be 1. For MULTI_PER_TURN and MULTI_PER_GAME, this can be any positive integer.
  limitNowCount?:number;  //at the start of turn,reset to limitCount，each time use this effect,limitNowCount-1,when limitNowCount is 0,can't use this effect
  limitGlobal?:boolean; //0:use every turn,1:only use once in the whole game
  limitNameType?:boolean; //0:check gameid，1:check cardid
  erosionFrontLimit?: [number, number];   //scope:[2,8] means "this effect can only be triggered when there are 2 to 8 cards in the front erosion zone",[0,11] means not limited
  erosionBackLimit?: [number, number];  
  erosionTotalLimit?: [number, number]; 
  playCost?: number;
  playColorReq?: { [color in CardColor]?: number };
  triggerLocation?: TriggerLocation[];
  factionReq?: string;
  godUnitReq?: boolean;
  targetcost?: [number, number]; // [min, max]
  
  // New Event System Properties
  triggerEvent?: GameEventType;
  isMandatory?: boolean;
  condition?: (gameState: GameState, playerState: PlayerState, card: Card, event?: GameEvent) => boolean;
  cost?: (gameState: GameState, playerState: PlayerState, card: Card) => boolean;
  applyContinuous?: (gameState: GameState, card: Card) => void;
  removeContinuous?: (gameState: GameState, card: Card) => void;
  
  execute?: (card: Card, gameState: GameState, playerState: PlayerState, event?: GameEvent) => void; // The function to execute when the effect is triggered
  content?: string; // Description of the effect: Move, Draw, Add Power, etc.
  description: string; // Human readable text
}

export interface Card {
  id: string;
  gamecardId: string;
  fullName: string;
  specialName?: string;
  type: CardType;
  color: CardColor;
  colorReq: { [color in CardColor]?: number };
  acValue: number;
  baseAcValue?: number;
  power?: number;
  basePower?: number;
  damage?: number;
  baseDamage?: number;
  godMark: boolean;
  baseGodMark?: boolean;
  displayState: 'FRONT_UPRIGHT' | 'FRONT_FACEDOWN' | 'BACK_UPRIGHT';
  isrush?: boolean;
  baseIsrush?: boolean;
  isExhausted?: boolean;
  canAttack?: boolean;
  baseCanAttack?: boolean;
  canActivateEffect?: boolean;
  baseCanActivateEffect?: boolean;
  playedTurn?: number;
  cardlocation?: 'HAND' | 'UNIT' | 'ITEM' | 'GRAVE' | 'EXILE' | 'EROSION_FRONT' | 'EROSION_BACK' | 'PLAY' | 'DECK';
  feijingMark: boolean;
  canResetCount?: number;    //only 0 can be reset,if not 0,at the start of turn,canResetCount-1
  effects?: CardEffect[];
  influencingEffects?: { sourceCardName: string; description: string }[];
  imageUrl: string;
  fullImageUrl: string;
  rarity: 'C' | 'U' | 'R' | 'SR' | 'UR' | 'PR';
  faction: string;
}

export interface PlayerState {
  uid: string;
  deck: Card[];
  hand: Card[];
  grave: Card[];
  exile: Card[];
  itemZone: Card[];
  erosionFront: (Card | null)[];
  erosionBack: (Card | null)[];
  unitZone: (Card | null)[];
  playZone: Card[];
  isTurn: boolean;
  isFirst: boolean;
  displayName: string;
  mulliganDone: boolean;
  hasExhaustedThisTurn: string[];
  isGoddessMode?: boolean;
}

export interface StackItem {
  card: Card;
  ownerUid: string;
  type: 'PLAY' | 'EFFECT';
  effectIndex?: number;
  timestamp: number;
}

export type GamePhase = 
  | 'START' 
  | 'DRAW' 
  | 'EROSION' 
  | 'MAIN' 
  | 'BATTLE_DECLARATION' 
  | 'DEFENSE_DECLARATION' 
  | 'BATTLE_FREE' 
  | 'DAMAGE_CALCULATION' 
  | 'BATTLE_END' 
  | 'DISCARD' 
  | 'COUNTERING' 
  | 'END' 
  | 'MULLIGAN' 
  | 'INIT';

export interface GameState {
  gameId: string;
  phase: GamePhase;
  currentTurnPlayer: 0 | 1; // 0 for first, 1 for second
  turnCount: number; // Starts at 1
  isCountering: 0 | 1; // 1 if countering
  counterStack: StackItem[]; // LIFO
  playerIds: [string, string]; // [FirstPlayerID, SecondPlayerID]
  gameStatus: 1 | 2; // 1: Normal, 2: Interrupted
  winReason?: string;
  winnerId?: string;
  logs: string[];
  players: {
    [uid: string]: PlayerState;
  };
  battleState?: {
    attackers: string[]; // gamecardIds
    defender?: string; // gamecardId
    isAlliance: boolean;
    askConfront?: 'ASKING_OPPONENT' | 'ASKING_TURN_PLAYER';
  };
  effectUsage?: Record<string, number>;
}

export interface Deck {
  id: string;
  name: string;
  cards: string[];
  isFavorite: boolean;
  createdAt: number;
}