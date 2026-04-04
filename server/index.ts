import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, dbInit } from './db';
import { generateToken, verifyToken } from './auth';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Initialize MariaDB Connection
dbInit();

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

// Create Game Endpoint
app.post('/api/games', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    
    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);
    
    if (!user) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

    try {
        const gameId = Math.random().toString(36).substring(2, 9);
        const initialState = {
             playerIds: [user.userId],
             players: {},
             status: 'WAITING',
             phase: 'INIT',
             turnCount: 0,
             currentTurnPlayer: 0,
             logs: []
        };
        await pool.query('INSERT INTO games (id, state, status) VALUES (?, ?, 0)', [gameId, JSON.stringify(initialState)]);
        res.json({ gameId });
    } catch (err) {
        console.error('Create game error:', err);
        res.status(500).json({ error: 'Final internal server error' });
    }
});


// Profile Endpoint
app.get('/api/user/profile', async (req, res): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const user = verifyToken(authHeader.split(' ')[1]);
    if (!user) { res.status(401).json({ error: 'Invalid token' }); return; }
    
    try {
        const rows = await pool.query('SELECT favorite_card_id FROM users WHERE id = ?', [user.userId]);
        res.json({ favoriteCardId: rows.length > 0 ? rows[0].favorite_card_id : null });
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
        await pool.query(
            'INSERT INTO decks (id, user_id, name, cards, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [deckId, user.userId, deckData.name, JSON.stringify(deckData.cards || []), Date.now(), Date.now()]
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
            await pool.query('UPDATE decks SET name = ?, cards = ?, updated_at = ? WHERE id = ? AND user_id = ?', 
                [deckData.name, JSON.stringify(deckData.cards), Date.now(), deckId, user.userId]);
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

// Socket.IO logic
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('authenticate', (token) => {
        const user = verifyToken(token);
        if (user) {
            (socket as any).user = user;
            socket.emit('authenticated');
        } else {
            socket.emit('unauthorized');
        }
    });

    socket.on('joinGame', async (gameId) => {
        const user = (socket as any).user;
        if (!user) return;

        socket.join(gameId);
        
        try {
            const rows = await pool.query('SELECT state FROM games WHERE id = ?', [gameId]);
            if (rows.length > 0) {
                const gameState = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
                
                // If player not in playerIds, and < 2 players, add them
                if (!gameState.playerIds.includes(user.userId) && gameState.playerIds.length < 2) {
                    gameState.playerIds.push(user.userId);
                    await pool.query('UPDATE games SET state = ? WHERE id = ?', [JSON.stringify(gameState), gameId]);
                }
                
                io.to(gameId).emit('gameStateUpdate', gameState);
            }
        } catch (err) {
            console.error('Error joining game:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
