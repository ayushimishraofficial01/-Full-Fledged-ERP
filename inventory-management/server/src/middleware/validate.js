/**
 * Validates and coerces req[part] with a zod schema. Unknown keys are stripped,
 * so only whitelisted fields ever reach controllers or MongoDB.
 */
module.exports = (schema, part = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[part] ?? {});
  if (!result.success) return next(result.error);
  req[part] = result.data;
  next();
};
