// server/middleware/requireRole.js
/**
 * Role‑based access middleware.
 * Usage: app.get('/admin', jwtAuth, requireRole('admin'), (req, res) => {...});
 */
export function requireRole(role) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: '未登录', requestId: req.requestId });
    }
    // In this demo, token payload may include a `role` field. If missing, fallback to 'user'.
    const userRole = user.role || 'user';
    if (userRole !== role) {
      return res.status(403).json({ error: '权限不足', requestId: req.requestId });
    }
    next();
  };
}
