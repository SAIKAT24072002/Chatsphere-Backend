/**
 * Wraps an async route handler and forwards any errors to Express error middleware.
 * Eliminates repetitive try/catch in every controller.
 *
 * Usage:
 *   router.get("/route", asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
