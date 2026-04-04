import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

export const generateToken = (userId: string, username: string, displayName: string, role: string) => {
  return jwt.sign({ userId, username, displayName, role }, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch (err) {
    return null;
  }
};

export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
  
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const user = verifyToken(token);
        if (user) {
            (req as any).user = user;
            next();
            return;
        }
    }
    
    res.sendStatus(401);
};
