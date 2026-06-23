const cleanupIntervalMs = 5 * 60 * 1000;
const buckets = new Set();

const normalizeIdentifier = (value) => String(value || "").trim().toLowerCase() || "anonymous";

const getClientIp = (req) => {
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return req.ips[0];
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const defaultKeyGenerator = (req) => getClientIp(req);

const getRetryAfterSeconds = (resetAt) => Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

export const createRateLimit = ({
  windowMs,
  max,
  message = "Too many requests, please try again later.",
  keyGenerator = defaultKeyGenerator,
}) => {
  const attempts = new Map();
  buckets.add(attempts);

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    const current = attempts.get(key);
    const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

    entry.count += 1;
    attempts.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      const retryAfterSeconds = getRetryAfterSeconds(entry.resetAt);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        message,
        retryAfterSeconds,
      });
    }

    return next();
  };
};

export const authRateLimitKeys = {
  ipAndEmail: (req) => `${getClientIp(req)}:${normalizeIdentifier(req.body?.email)}`,
  ipAndResetToken: (req) => `${getClientIp(req)}:${normalizeIdentifier(req.params?.token)}`,
  ipAndUser: (req) => `${getClientIp(req)}:${normalizeIdentifier(req.user?.userId || req.user?._id || req.user?.id)}`,
};

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const bucket of buckets) {
    for (const [key, entry] of bucket.entries()) {
      if (entry.resetAt <= now) {
        bucket.delete(key);
      }
    }
  }
}, cleanupIntervalMs);

cleanupInterval.unref?.();
