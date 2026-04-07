// VERSION: 2026-04-07-IND-FIX-01
import express from 'express';
console.log('[Server] index.ts is starting up...');
import { createServer } from 'http';

import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, dbInit } from './db';
import { generateToken, verifyToken } from './auth';
import { initServerCardLibrary, SERVER_CARD_LIBRARY } from './card_loader';
import { ServerGameService } from './ServerGameService';
import { PlayerState, Card } from '../src/types/game';

// Initialize Game Library
// Initialize Game Library will be awaited below.


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// In-memory locks to prevent concurrent modifications of the same game state
const gameLocks = new Map<string, Promise<any>>();

async function withGameLock<T>(gameId: string, action: () => Promise<T>): Promise<T> {
    const existingLock = gameLocks.get(gameId) || Promise.resolve();
    const newLock = existingLock.then(async () => {
        try {
            return await action();
        } catch (err) {
            console.error(`[Lock] Error in locked action for game ${gameId}:`, err);
            // Re-throw to allow the caller to handle it, but the lock chain continues
            throw err;
        }
    });
    gameLocks.set(gameId, newLock.catch(() => { })); // Ensure chain doesn't break on errors
    return newLock;
}

// Helper: Validate User Deck
async function validateUserDeck(uId: string, dId: string): Promise<{ valid: boolean; cards?: Card[]; error?: string }> {
    try {
        const dRows = await pool.query('SELECT cards FROM decks WHERE id = ? AND user_id = ?', [dId, uId]);
        if (dRows.length === 0) return { valid: false, error: '未找到卡组' };

        let cIds = typeof dRows[0].cards === 'string' ? JSON.parse(dRows[0].cards) : dRows[0].cards;
        if (!Array.isArray(cIds)) cIds = [];

        const cObjs = cIds.map((idVal: string) => {
            return (SERVER_CARD_LIBRARY as any)[idVal];
        }).filter(Boolean);

        if (cObjs.length !== cIds.length) {
            return { valid: false, error: '部分卡牌在服务器库中未找到' };
        }

        const vRes = ServerGameService.validateDeck(cObjs as any);
        if (!vRes.valid) return { valid: false, error: vRes.error };

        return { valid: true, cards: cObjs as any };
    } catch (err) {
        console.error('Validate deck error:', err);
        return { valid: false, error: '数据库错误' };
    }
}

async function handleBotMove(gameState: any, gameId: string) {
    const bot = gameState.players['BOT_PLAYER'];
    if (!bot) return;

    // The bot should move if it's its turn OR if it's being asked for a confrontation response
    const isBotAsked = gameState.battleState && gameState.battleState.askConfront === 'ASKING_OPPONENT';
    const shouldBotMove = bot.isTurn || isBotAsked;

    // console.log(`[Bot] handleBotMove checking: bot.isTurn? ${bot.isTurn}, isBotAsked? ${isBotAsked}`);
    if (!shouldBotMove) return;

    // Use a delay to simulate thinking and allow final state propagation
    setTimeout(async () => {
        await withGameLock(gameId, async () => {
            try {
                // Re-fetch state inside the lock to get the most recent version
                const stateRows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
                if (stateRows.length === 0) return;
                const currentGameState = typeof stateRows[0].state === 'string' ? JSON.parse(stateRows[0].state) : stateRows[0].state;
                ServerGameService.hydrateGameState(currentGameState);

                await ServerGameService.botMove(currentGameState);

                await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(currentGameState), gameId]);
                io.to(gameId).emit('gameStateUpdate', currentGameState);

                // Re-trigger if bot still needs to move
                const nextState = currentGameState;
                const bot = nextState.players['BOT_PLAYER'];
                if (bot) {
                    const currentPlayerId = nextState.playerIds[nextState.currentTurnPlayer];
                    const isBotAsked = nextState.battleState && nextState.battleState.askConfront === 'ASKING_OPPONENT';
                    const isBotPriority = nextState.priorityPlayerId === 'BOT_PLAYER';

                    if (currentPlayerId === 'BOT_PLAYER' || isBotAsked || isBotPriority) {
                        // console.log('[Bot] Bot still needs to move, queuing next move...');
                        handleBotMove(nextState, gameId);
                    }
                }
            } catch (err) {
                console.error('[Bot] handleBotMove error:', err);
            }
        });
    }, 1000);
}

function triggerBotIfNeeded(gameState: any, gameId: string) {
    const bot = gameState.players['BOT_PLAYER'];
    if (!bot) return;

    const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
    const isBotAsked = gameState.battleState && gameState.battleState.askConfront === 'ASKING_OPPONENT';
    const isBotPriority = gameState.priorityPlayerId === 'BOT_PLAYER';

    if (currentPlayerId === 'BOT_PLAYER' || isBotAsked || isBotPriority) {
        console.log(`[Bot] Triggering bot move for game ${gameId}. Reason: ${currentPlayerId === 'BOT_PLAYER' ? 'Turn' : isBotAsked ? 'Confrontation' : 'Priority'}`);
        handleBotMove(gameState, gameId);
    }
}

async function advancePhase(gameState: any, gameId: string, playerId?: string, socket?: any, action?: any) {
    try {
        console.log(`[Socket] advancePhase for game ${gameId}, action: ${action}, playerId: ${playerId}`);
        await ServerGameService.advancePhase(gameState, action, playerId);

        await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
        io.to(gameId).emit('gameStateUpdate', gameState);

        triggerBotIfNeeded(gameState, gameId);
    } catch (err: any) {
        console.error('[Socket] advancePhase error:', err);
        if (socket) socket.emit('error', err.message || '阶段切换失败');
    }
}

app.use(cors());

// Background Timer for 30s Auto-Advance
setInterval(async () => {
    try {
        const games = await pool.query('SELECT id FROM games WHERE status = 0');
        for (const row of games) {
            const gameId = row.id;

            // Use the lock to ensure we don't conflict with player actions
            await withGameLock(gameId, async () => {
                // Re-fetch state inside the lock to get the most recent version
                const stateRows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
                if (stateRows.length === 0) return;

                const gameState = typeof stateRows[0].state === 'string' ? JSON.parse(stateRows[0].state) : stateRows[0].state;
                if (!gameState) return;
                ServerGameService.hydrateGameState(gameState);
                if (!gameState.phaseTimerStart) return;

                const now = Date.now();
                const phaseElapsed = now - (gameState.phaseTimerStart || now);
                const checkInterval = 2000;

                const sharedPhases = ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'];
                const independentPhases = ['EROSION', 'DEFENSE_DECLARATION', 'COUNTERING', 'MULLIGAN'];

                if (sharedPhases.includes(gameState.phase)) {
                    // Shared 300s budget logic
                    const isWaitingForOpponent =
                        (gameState.counterStack && gameState.counterStack.length > 0) ||
                        (gameState.battleState && gameState.battleState.askConfront);

                    if (isWaitingForOpponent) {
                        if (phaseElapsed > 30000) {
                            console.log(`[Timer] Confrontation timeout in ${gameState.phase} for game ${gameId}, auto-advancing.`);
                            gameState.logs.push('响应超时，自动推进。');
                            if (gameState.phase === 'BATTLE_FREE') {
                                await ServerGameService.advancePhase(gameState, 'DECLINE_CONFRONTATION');
                            } else if (gameState.counterStack && gameState.counterStack.length > 0) {
                                await ServerGameService.resolveCounterStack(gameState);
                            }

                            gameState.phaseTimerStart = Date.now();
                            await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                            io.to(gameId).emit('gameStateUpdate', gameState);

                            const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
                            if (currentPlayerId === 'BOT_PLAYER' || gameState.priorityPlayerId === 'BOT_PLAYER') {
                                handleBotMove(gameState, gameId);
                            }
                        }
                    } else {
                        gameState.mainPhaseTimeRemaining = (gameState.mainPhaseTimeRemaining || 300000) - checkInterval;

                        if (gameState.mainPhaseTimeRemaining <= 0) {
                            console.log(`[Timer] Shared budget timeout for game ${gameId}, auto-advancing.`);
                            gameState.logs.push('阶段时间耗尽，强制推进。');
                            if (gameState.phase === 'BATTLE_FREE') {
                                await ServerGameService.advancePhase(gameState, 'PROPOSE_DAMAGE_CALCULATION');
                            } else {
                                await ServerGameService.advancePhase(gameState, 'DECLARE_END');
                            }
                            gameState.mainPhaseTimeRemaining = 300000;
                            gameState.phaseTimerStart = Date.now();
                        }

                        await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                        io.to(gameId).emit('gameStateUpdate', gameState);

                        const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
                        if (currentPlayerId === 'BOT_PLAYER' || gameState.priorityPlayerId === 'BOT_PLAYER') {
                            handleBotMove(gameState, gameId);
                        }
                    }
                } else if (independentPhases.includes(gameState.phase)) {
                    if (phaseElapsed > 30000) {
                        console.log(`[Timer] Auto-advancing game ${gameId} due to timeout in phase ${gameState.phase}`);

                        if (gameState.phase === 'MULLIGAN') {
                            Object.values(gameState.players).forEach((p: any) => { p.mulliganDone = true; });
                            gameState.phase = 'START';
                            gameState.turnCount = 1;
                            const firstUid = gameState.playerIds[gameState.currentTurnPlayer];
                            gameState.playerIds.forEach((uid: string) => {
                                gameState.players[uid].isTurn = (uid === firstUid);
                            });
                            gameState.logs.push('调度超时，自动开始游戏。');
                        } else if (gameState.phase === 'EROSION') {
                            const playerUid = gameState.playerIds[gameState.currentTurnPlayer];
                            gameState.logs.push(`侵蚀阶段超时，自动选择方案 A。`);
                            await ServerGameService.handleErosionChoice(gameState, playerUid, 'A');
                        } else if (gameState.phase === 'DEFENSE_DECLARATION') {
                            const defenderUid = gameState.playerIds[gameState.currentTurnPlayer === 0 ? 1 : 0];
                            await ServerGameService.declareDefense(gameState, defenderUid, undefined);
                        } else if (gameState.phase === 'COUNTERING') {
                            await ServerGameService.resolveCounterStack(gameState);
                        } else {
                            await ServerGameService.advancePhase(gameState);
                        }

                        gameState.phaseTimerStart = Date.now();
                        await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                        io.to(gameId).emit('gameStateUpdate', gameState);

                        const currentPlayerId = gameState.playerIds[gameState.currentTurnPlayer];
                        if (currentPlayerId === 'BOT_PLAYER' || gameState.priorityPlayerId === 'BOT_PLAYER') {
                            handleBotMove(gameState, gameId);
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error('[Timer] Error in auto-advance loop:', err);
    }
}, 2000); // Check every 2 seconds
app.use(express.json());

// Initialize MariaDB Connection
// Initialize MariaDB Connection and then start server
// dbInit() was moved to start() below


// Login Endpoint
app.post('/api/login', async (req, res): Promise<void> => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' });
        return;
    }

    try {
        const rows = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = generateToken(user.id, user.username, user.display_name, user.role);
        res.json({ token, user: { uid: user.id, displayName: user.display_name, email: user.username } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Practice Game
app.post('/api/games/practice', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { deckId } = req.body;
    if (!deckId) { res.status(400).json({ error: '请选择卡组' }); return; }

    try {
        const validation = await validateUserDeck(user.userId, deckId);
        if (!validation.valid) { res.status(400).json({ error: validation.error }); return; }

        const gameId = 'practice_' + Math.random().toString(36).substring(2, 9);
        const gameState = await ServerGameService.createPracticeGameState(validation.cards!, user.userId, user.displayName);
        gameState.gameId = gameId;

        await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(gameState)]);
        res.json({ gameId });
    } catch (err) {
        console.error('Create practice game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Friend Match (generates 8-digit room code)
app.post('/api/games/friend', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const roomCode = Math.random().toString(10).substring(2, 10).padEnd(8, '0');
        const gameId = 'friend_' + roomCode;
        const userIdStr = user.userId.toString();
        const initialState = {
            playerIds: [userIdStr],
            players: {},
            status: 'WAITING',
            phase: 'INIT',
            turnCount: 0,
            currentTurnPlayer: 0,
            logs: [],
            mode: 'friend',
            roomCode: roomCode,
            counterStack: [],
            isCountering: 0,
            effectUsage: {}
        };

        await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(initialState)]);
        res.json({ gameId, roomCode });
    } catch (err) {
        console.error('Create friend game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Join Friend Match by room code
app.post('/api/games/friend/join', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { roomCode } = req.body;
    if (!roomCode) { res.status(400).json({ error: '请输入房间码' }); return; }

    try {
        const gameId = 'friend_' + roomCode;
        const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
        if (rows.length === 0) {
            res.status(404).json({ error: '未找到该房间' });
            return;
        }
        const gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
        if (gameState.playerIds.length >= 2) {
            res.status(400).json({ error: '房间已满' });
            return;
        }
        const userIdStr = user.userId.toString();
        if (gameState.playerIds.includes(userIdStr)) {

            res.status(400).json({ error: '你已在该房间中' });
            return;
        }
        gameState.playerIds.push(user.userId);
        gameState.status = 'READY';
        await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
        res.json({ gameId });
    } catch (err) {
        console.error('Join friend game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Matchmaking Queue
const matchmakingQueue: { userId: string; socketId?: string; timestamp: number; deck?: Card[] }[] = [];

app.post('/api/games/matchmaking', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const { deckId } = req.body;
        if (!deckId) { res.status(400).json({ error: '请选择卡组' }); return; }

        const validation = await validateUserDeck(user.userId, deckId);
        if (!validation.valid) { res.status(400).json({ error: validation.error }); return; }

        // Remove self if already in queue
        const existingIdx = matchmakingQueue.findIndex(q => q.userId === user.userId);
        if (existingIdx !== -1) matchmakingQueue.splice(existingIdx, 1);

        // Check if someone else is waiting
        const opponent = matchmakingQueue.shift();
        if (opponent && opponent.userId !== user.userId) {
            // Create a match
            const gameId = 'match_' + Math.random().toString(36).substring(2, 9);
            const gameState = await ServerGameService.createMatchGameState(opponent.userId, opponent.deck!, user.userId, validation.cards!);
            gameState.gameId = gameId;

            await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(gameState)]);

            // Notify the opponent via socket
            if (opponent.socketId) {
                io.to(opponent.socketId).emit('matchFound', { gameId });
            }

            res.json({ gameId, matched: true });
        } else {
            // Add to queue
            matchmakingQueue.push({ userId: user.userId, deck: validation.cards, timestamp: Date.now() });
            res.json({ matched: false, position: matchmakingQueue.length });
        }
    } catch (err) {
        console.error('Matchmaking error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel matchmaking
app.post('/api/games/matchmaking/cancel', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    const idx = matchmakingQueue.findIndex(q => q.userId === user.userId);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);
    res.json({ success: true });
});

// Legacy create game (kept for compatibility)
app.post('/api/games', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const mode = req.body?.practice ? 'practice' : 'match';
        const prefix = mode === 'practice' ? 'practice_' : 'match_';
        const gameId = prefix + Math.random().toString(36).substring(2, 9);
        const initialState = {
            playerIds: mode === 'practice' ? [user.userId, 'BOT_PLAYER'] : [user.userId],
            players: {},
            status: mode === 'practice' ? 'READY' : 'WAITING',
            phase: 'INIT',
            turnCount: 0,
            currentTurnPlayer: 0,
            logs: [],
            mode,
            counterStack: [],
            isCountering: 0,
            effectUsage: {}
        };
        await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(initialState)]);
        res.json({ gameId });
    } catch (err) {
        console.error('Create game error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Profile Endpoint
app.get('/api/user/profile', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const rows = await pool.query('SELECT favorite_card_id, coins FROM users WHERE id = ?', [user.userId]);
        res.json({ favoriteCardId: rows.length > 0 ? rows[0].favorite_card_id : null, coins: rows.length > 0 ? Number(rows[0].coins) : 0 });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.put('/api/user/profile', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const { favoriteCardId } = req.body;
        await pool.query('UPDATE users SET favorite_card_id = ? WHERE id = ?', [favoriteCardId, user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Decks Endpoints
app.get('/api/user/decks', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const rows = await pool.query('SELECT * FROM decks WHERE user_id = ?', [user.userId]);
        const decks = rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            cards: typeof r.cards === 'string' ? JSON.parse(r.cards) : r.cards,
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at)
        }));
        res.json({ decks });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.post('/api/user/decks', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckData = req.body;
        const deckId = Math.random().toString(36).substring(2, 10);

        // Ensure we only store IDs
        let cardIds = deckData.cards || [];
        if (cardIds.length > 0 && typeof cardIds[0] === 'object') {
            cardIds = cardIds.map((c: any) => c.id);
        }

        await pool.query(
            'INSERT INTO decks (id, user_id, name, cards, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [deckId, user.userId, deckData.name, JSON.stringify(cardIds), Date.now(), Date.now()]
        );
        res.json({ id: deckId });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.put('/api/user/decks/:id', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckId = req.params.id;
        const deckData = req.body;

        if (deckData.cards) {
            let cardIds = deckData.cards;
            if (cardIds.length > 0 && typeof cardIds[0] === 'object') {
                cardIds = cardIds.map((c: any) => c.id);
            }
            await pool.query('UPDATE decks SET name = ?, cards = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [deckData.name, JSON.stringify(cardIds), Date.now(), deckId, user.userId]);
        } else {
            await pool.query('UPDATE decks SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                [deckData.name, Date.now(), deckId, user.userId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.delete('/api/user/decks/:id', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckId = req.params.id;
        await pool.query('DELETE FROM decks WHERE id = ? AND user_id = ?', [deckId, user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.post('/api/user/decks/:id/copy', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const deckId = req.params.id;
        const rows = await pool.query('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, user.userId]);
        if (rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }

        const original = rows[0];
        const newDeckId = Math.random().toString(36).substring(2, 10);
        await pool.query(
            'INSERT INTO decks (id, user_id, name, cards, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [newDeckId, user.userId, original.name + ' (副本)', typeof original.cards === 'string' ? original.cards : JSON.stringify(original.cards), Date.now(), Date.now()]
        );
        res.json({ id: newDeckId });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.get('/api/games', async (req, res): Promise<void> => {
    try {
        const rows = await pool.query('SELECT * FROM games WHERE status = 0');
        const games = rows.map((r: any) => ({
            id: r.id,
            ...(typeof r.state === 'string' ? JSON.parse(r.state) : r.state)
        }));
        res.json({ games });
    } catch (e) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Collection Endpoint
app.get('/api/user/collection', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    try {
        const rows = await pool.query('SELECT card_id, quantity FROM user_cards WHERE user_id = ?', [user.userId]);
        const collection: Record<string, number> = {};
        for (const r of rows) {
            collection[r.card_id] = Number(r.quantity);
        }
        res.json({ collection });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Store - Buy Pack Endpoint
const CARD_POOL = [
    '10400002', '10400003', '10401001', '10401004', '10401005', '10401008',
    '10402006', '10402007', '20400001', '20400002', '20400003', '20400004',
    '20400005', '20400007', '20403006', '30400002', '30401001', '99999999'
];

// Rarity mapping for each card (must match the card scripts)
const CARD_RARITIES: Record<string, string> = {
    '10400002': 'U', '10400003': 'U', '10401001': 'SR', '10401004': 'SR',
    '10401005': 'C', '10401008': 'SR', '10402006': 'R', '10402007': 'PR',
    '20400001': 'R', '20400002': 'U', '20400003': 'R', '20400004': 'U',
    '20400005': 'U', '20400007': 'U', '20403006': 'U', '30400002': 'U',
    '30401001': 'R', '99999999': 'UR',
};

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

app.post('/api/store/buy-pack', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Check coins
        const userRows = await conn.query('SELECT coins FROM users WHERE id = ?', [user.userId]);
        const coins = Number(userRows[0].coins);
        if (coins < 10) {
            await conn.rollback();
            res.status(400).json({ error: '金币不足' });
            return;
        }

        // Get pity counters
        let pityRows = await conn.query('SELECT * FROM pack_history WHERE user_id = ?', [user.userId]);
        if (pityRows.length === 0) {
            await conn.query('INSERT INTO pack_history (user_id, total_packs, packs_since_sr, packs_since_ur) VALUES (?, 0, 0, 0)', [user.userId]);
            pityRows = [{ total_packs: 0, packs_since_sr: 0, packs_since_ur: 0 }];
        }
        let packsSinceSR = Number(pityRows[0].packs_since_sr) + 1;
        let packsSinceUR = Number(pityRows[0].packs_since_ur) + 1;
        const totalPacks = Number(pityRows[0].total_packs) + 1;

        // Build rarity pools
        const cuPool = CARD_POOL.filter(id => CARD_RARITIES[id] === 'C' || CARD_RARITIES[id] === 'U');
        const rPool = CARD_POOL.filter(id => CARD_RARITIES[id] === 'R');
        const srPool = CARD_POOL.filter(id => CARD_RARITIES[id] === 'SR');
        const urPool = CARD_POOL.filter(id => CARD_RARITIES[id] === 'UR' || CARD_RARITIES[id] === 'SER');

        // Pick 4 C/U cards
        const drawnCards: string[] = [];
        for (let i = 0; i < 4; i++) {
            drawnCards.push(pickRandom(cuPool));
        }

        // Pick 1 R+ card with pity
        let guaranteedCard: string;
        if (packsSinceUR >= 50 && urPool.length > 0) {
            // UR/SER pity
            guaranteedCard = pickRandom(urPool);
            packsSinceUR = 0;
            packsSinceSR = 0;
        } else if (packsSinceSR >= 10 && srPool.length > 0) {
            // SR pity
            guaranteedCard = pickRandom(srPool);
            packsSinceSR = 0;
        } else {
            // Normal R+ roll with weighted odds
            const roll = Math.random();
            if (roll < 0.02 && urPool.length > 0) {
                guaranteedCard = pickRandom(urPool);
                packsSinceUR = 0;
                packsSinceSR = 0;
            } else if (roll < 0.12 && srPool.length > 0) {
                guaranteedCard = pickRandom(srPool);
                packsSinceSR = 0;
            } else if (rPool.length > 0) {
                guaranteedCard = pickRandom(rPool);
            } else {
                guaranteedCard = pickRandom(cuPool);
            }
        }
        drawnCards.push(guaranteedCard);

        // Deduct coins
        await conn.query('UPDATE users SET coins = coins - 10 WHERE id = ?', [user.userId]);

        // Add cards to collection
        for (const cardId of drawnCards) {
            await conn.query(
                `INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, 1)
                 ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
                [user.userId, cardId]
            );
        }

        // Update pity counters
        await conn.query(
            'UPDATE pack_history SET total_packs = ?, packs_since_sr = ?, packs_since_ur = ? WHERE user_id = ?',
            [totalPacks, packsSinceSR, packsSinceUR, user.userId]
        );

        await conn.commit();

        const newCoinsRow = await pool.query('SELECT coins FROM users WHERE id = ?', [user.userId]);

        res.json({
            cards: drawnCards.map(id => ({ id, rarity: CARD_RARITIES[id] || 'C' })),
            newCoins: Number(newCoinsRow[0].coins),
            totalPacks,
            packsSinceSR,
            packsSinceUR,
        });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error('Buy pack error:', err);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        if (conn) conn.release();
    }
});

// Socket.IO logic
// Helper to create initial player state
function createInitialPlayer(deckCards: Card[], displayName: string, isFirst: boolean): PlayerState {
    const fullDeck: Card[] = deckCards.map(c => {
        const uniqueId = Math.random().toString(36).substring(2, 10);
        return {
            ...c,
            gamecardId: uniqueId,
            runtimeFingerprint: `FP_${uniqueId}_${Date.now()}`,
            isExhausted: false,
            displayState: 'FRONT_UPRIGHT',
            cardlocation: 'DECK'
        };
    });

    // Perform Durstenfeld shuffle (Fisher-Yates) 
    for (let i = fullDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
    }

    // Draw initial 4 cards
    const hand = fullDeck.splice(0, 4).map(c => ({ ...c, cardlocation: 'HAND' as any }));

    return {
        uid: '', // Will be set by caller
        displayName: displayName,
        hand: hand,
        deck: fullDeck,
        grave: [],
        exile: [],
        playZone: [],
        unitZone: new Array(5).fill(null),
        itemZone: new Array(2).fill(null),
        erosionFront: new Array(10).fill(null),
        erosionBack: new Array(10).fill(null),
        isFirst: isFirst,
        mulliganDone: false,
        hasExhaustedThisTurn: [],
        isGoddessMode: false,
        isTurn: isFirst
    };

}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('authenticate', (token) => {
        const user = verifyToken(token);
        if (user) {
            (socket as any).user = user;
            const queueEntry = matchmakingQueue.find(q => q.userId === user.userId);
            if (queueEntry) queueEntry.socketId = socket.id;
            socket.emit('authenticated');
        } else {
            socket.emit('unauthorized');
        }
    });

    socket.on('joinGame', async (data: { gameId: string, deckId?: string }) => {
        const user = (socket as any).user;
        if (!user) {
            console.log('[Socket] joinGame failed: Socket not authenticated');
            socket.emit('error', '未授权，请重试');
            return;
        }

        const userIdStr = user.userId.toString();
        const gameId = typeof data === 'string' ? data : data.gameId;
        const deckId = typeof data === 'object' ? data.deckId : undefined;

        console.log(`[Socket] Request gameId: ${gameId}`);
        if (!gameId || gameId === 'undefined') {
            console.log('[Socket] joinGame failed: Missing or invalid gameId');
            socket.emit('error', '无效的房间ID');
            return;
        }

        socket.join(gameId);
        console.log(`[Socket] User ${userIdStr} attempting to join game ${gameId}`);

        try {
            const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
            if (rows.length === 0) {
                console.log(`[Socket] joinGame failed: Game ${gameId} not found in DB`);
                socket.emit('error', '未找到游戏战场');
                return;
            }

            const gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
            ServerGameService.hydrateGameState(gameState);
            if (!gameState.players) gameState.players = {};

            // Initialize human player if they haven't been initialized yet
            if (!gameState.players[userIdStr] && deckId) {
                console.log(`[Socket] Initializing player ${userIdStr} in game ${gameId}`);
                const deckRows = await pool.query('SELECT * FROM decks WHERE id = ?', [deckId]);
                if (deckRows.length > 0) {
                    const deckCardsRaw = typeof deckRows[0].cards === 'string' ? JSON.parse(deckRows[0].cards) : deckRows[0].cards;

                    if (Object.keys(SERVER_CARD_LIBRARY).length === 0) {
                        console.log('[Socket] WARNING: Card library was empty, initializing now...');
                        await initServerCardLibrary();
                    }

                    const deckCards: Card[] = deckCardsRaw.map((id: string) => SERVER_CARD_LIBRARY[id]).filter(Boolean);

                    // Validate Deck
                    const validation = ServerGameService.validateDeck(deckCards);
                    if (!validation.valid) {
                        console.log(`[Socket] joinGame failed: Deck validation failed for user ${userIdStr}`);
                        socket.emit('error', `卡组非法: ${validation.error}`);
                        return;
                    }

                    const isFirst = gameState.playerIds.indexOf(userIdStr) === 0;

                    const player = createInitialPlayer(deckCards, user.displayName || user.username || '玩家', isFirst);
                    player.uid = userIdStr;
                    gameState.players[userIdStr] = player;

                    if (gameState.mode === 'practice' && !gameState.players['BOT_PLAYER']) {
                        const botPlayer = createInitialPlayer(deckCards, '机器人', !isFirst);
                        botPlayer.uid = 'BOT_PLAYER';
                        botPlayer.mulliganDone = true;
                        gameState.players['BOT_PLAYER'] = botPlayer;
                    }

                    const initializedPlayerCount = Object.keys(gameState.players).length;
                    if (gameState.phase === 'INIT' && initializedPlayerCount >= 2) {
                        gameState.phase = 'MULLIGAN';
                        gameState.status = 'ACTIVE';
                        gameState.logs.push('所有玩家已准备就绪。开始调度阶段。');
                    }

                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                } else {
                    console.error(`[Socket] joinGame error: Deck ${deckId} not found`);
                }
            }

            console.log(`[Socket] joinGame success: Emitting state for ${userIdStr} in ${gameId}`);
            socket.emit('gameStateUpdate', gameState);
            io.to(gameId).emit('gameStateUpdate', gameState);

        } catch (err) {
            console.error('[Socket] joinGame exception:', err);
            socket.emit('error', '战场同步过程中发生错误');
        }
    });

    socket.on('gameAction', async (data: { gameId: string, action: string, payload?: any }) => {
        const user = (socket as any).user;
        if (!user) return;

        const { gameId, action, payload } = data;

        await withGameLock(gameId, async () => {
            try {
                const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
                if (rows.length === 0) return;

                let gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
                ServerGameService.hydrateGameState(gameState);
                const myUid = user.userId.toString();
                const player = gameState.players[myUid];
                if (!player) {
                    console.log(`[Socket] Action ${action} rejected: Player ${myUid} not found in game ${gameId}`);
                    return;
                }

                if (action === 'MULLIGAN') {
                    const selectedIds: string[] = payload || [];
                    if (player.mulliganDone) return;

                    if (selectedIds.length > 0) {
                        const cardsToSwap = player.hand.filter((c: any) => selectedIds.includes(c.gamecardId));
                        player.hand = player.hand.filter((c: any) => !selectedIds.includes(c.gamecardId));

                        cardsToSwap.forEach((c: any) => {
                            c.cardlocation = 'DECK';
                            player.deck.push(c);
                        });

                        for (let i = 0; i < selectedIds.length; i++) {
                            const newCard = player.deck.shift();
                            if (newCard) {
                                newCard.cardlocation = 'HAND';
                                player.hand.push(newCard);
                            }
                        }

                        for (let i = player.deck.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [player.deck[i], player.deck[j]] = [player.deck[j], player.deck[i]];
                        }

                        gameState.logs.push(`${player.displayName} 更换了 ${selectedIds.length} 张卡牌。`);
                    } else {
                        gameState.logs.push(`${player.displayName} 接受了初始手牌。`);
                    }

                    player.mulliganDone = true;

                    const allDone = Object.values(gameState.players).every((p: any) => p.mulliganDone);
                    if (allDone) {
                        gameState.phase = 'START';
                        gameState.turnCount = 1;

                        const currentUid = gameState.playerIds[gameState.currentTurnPlayer];
                        gameState.playerIds.forEach((uid: string) => {
                            gameState.players[uid].isTurn = (uid === currentUid);
                        });

                        gameState.logs.push(`调度结束。第 1 回合开始，由 ${gameState.players[currentUid].displayName} 先行。`);
                        await advancePhase(gameState, gameId, myUid, socket);
                        return;
                    }

                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'PLAY_CARD') {
                    const { cardId, paymentSelection } = payload;
                    await ServerGameService.playCard(gameState, myUid, cardId, paymentSelection);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'ATTACK') {
                    const { attackerIds, alliance } = payload;
                    await ServerGameService.declareAttack(gameState, myUid, attackerIds, alliance);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'DEFEND') {
                    const { defenderId } = payload;
                    await ServerGameService.declareDefense(gameState, myUid, defenderId);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'RESOLVE_DAMAGE') {
                    await ServerGameService.resolveDamage(gameState);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'EROSION_CHOICE') {
                    const { choice, selectedCardId } = payload;
                    await ServerGameService.handleErosionChoice(gameState, myUid, choice, selectedCardId);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'DISCARD') {
                    const { cardId } = payload;
                    await ServerGameService.discardCard(gameState, myUid, cardId);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'ACTIVATE_EFFECT') {
                    const { cardId, effectIndex } = payload;
                    await ServerGameService.activateEffect(gameState, myUid, cardId, effectIndex);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'PASS_CONFRONTATION') {
                    await ServerGameService.passConfrontation(gameState, myUid);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                    io.to(gameId).emit('gameStateUpdate', gameState);
                } else if (action === 'RESOLVE_PLAY') {
                    if (gameState.phase === 'COUNTERING') {
                        await ServerGameService.resolveCounterStack(gameState);
                        await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                        io.to(gameId).emit('gameStateUpdate', gameState);
                    }
                } else if (action === 'END_PHASE') {
                    if (player.isTurn || gameState.phase === 'BATTLE_FREE' || gameState.phase === 'COUNTERING') {
                        await advancePhase(gameState, gameId, myUid, socket, payload);
                    }
                }

                triggerBotIfNeeded(gameState, gameId);
            } catch (err) {
                console.error('Game action error:', err);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Main bootstrap function
const start = async () => {
    try {
        console.log('[Server] Initializing card library...');
        await initServerCardLibrary();
        console.log('[Server] Connecting to database...');
        await dbInit();

        const PORT = process.env.PORT || 3001;
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('[Server] Fatal initialization error:', err);
        process.exit(1);
    }
};

start();

