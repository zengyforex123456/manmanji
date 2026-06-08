// server/middleware/jwtAuth.js
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * JWT authentication middleware.
 * - Expects Authorization header: "Bearer <token>".
 * - On success attaches req.user and a requestId to req.
 * - On failure responds with 401.
 */
export function jwtAuth(req, res, next) {
  const requestId = uuidv4(); // for tracing
  req.requestId = requestId;
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header', requestId });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload; // e.g., { phone, ts }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token', requestId });
  }
}
