// server/middleware/validate.js
/**
 * Simple validation middleware.
 * schema: { fieldName: { required: true, type: 'string'|'array'|'number'|... } }
 * Returns 400 with details when validation fails.
 */
export const validate = schema => (req, res, next) => {
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = req.body?.[field];
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${field} is required`);
      continue;
    }
    if (value !== undefined && value !== null && rules.type) {
      const type = Array.isArray(value) ? 'array' : typeof value;
      if (type !== rules.type) {
        errors.push(`${field} must be a ${rules.type}`);
      }
    }
    if (value !== undefined && value !== null && rules.min !== undefined) {
      if (Array.isArray(value) && value.length < rules.min) {
        errors.push(`${field} must contain at least ${rules.min} items`);
      }
    }
  }
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid request', details: errors });
  }
  next();
};
