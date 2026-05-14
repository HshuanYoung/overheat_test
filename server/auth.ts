import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { pool } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

export type AuthTokenPayload = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  sessionVersion: number;
  email?: string | null;
  iat?: number;
  exp?: number;
};

export const generateToken = (
  userId: string,
  username: string,
  displayName: string,
  role: string,
  sessionVersion: number,
  email?: string | null
) => {
  return jwt.sign({ userId, username, displayName, role, sessionVersion, email: email || null }, JWT_SECRET, { expiresIn: '24h' });
};

export const decodeToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch (err) {
    return null;
  }
};

export const verifyToken = async (token: string) => {
  const decoded = decodeToken(token);
  if (!decoded?.userId) {
    return null;
  }

  try {
    const rows = await pool.query(
      'SELECT username, display_name, role, email, session_version FROM users WHERE id = ? LIMIT 1',
      [decoded.userId]
    );
    if (!rows.length) {
      return null;
    }

    const user = rows[0];
    const sessionVersion = Number(user.session_version ?? 0);
    if (sessionVersion !== Number(decoded.sessionVersion ?? -1)) {
      return null;
    }

    return {
      userId: decoded.userId,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      email: user.email || null,
      sessionVersion
    };
  } catch (err) {
    return null;
  }
};

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
  
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const user = await verifyToken(token);
        if (user) {
            (req as any).user = user;
            next();
            return;
        }
    }
    
    res.sendStatus(401);
};
