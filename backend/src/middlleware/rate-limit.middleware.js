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

const createRateLimitBucket = ({ windowMs, max, keyGenerator }) => {
  const attempts = new Map();
  buckets.add(attempts);

  return (target) => {
    const now = Date.now();
    const key = keyGenerator(target);
    const current = attempts.get(key);
    const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

    entry.count += 1;
    attempts.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const retryAfterSeconds = getRetryAfterSeconds(entry.resetAt);

    return {
      allowed: entry.count <= max,
      key,
      limit: max,
      remaining,
      resetAt: entry.resetAt,
      retryAfterSeconds,
    };
  };
};

export const getPositiveEnvNumber = (names, fallback) => {
  for (const name of names) {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return fallback;
};

export const createRateLimit = ({
  windowMs,
  max,
  message = "Too many requests, please try again later.",
  keyGenerator = defaultKeyGenerator,
}) => {
  const checkLimit = createRateLimitBucket({ windowMs, max, keyGenerator });

  return (req, res, next) => {
    const result = checkLimit(req);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfterSeconds);
      return res.status(429).json({
        message,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }

    return next();
  };
};

export const createRateLimitChecker = ({
  windowMs,
  max,
  keyGenerator = defaultKeyGenerator,
}) => createRateLimitBucket({ windowMs, max, keyGenerator });

export const authRateLimitKeys = {
  ipAndEmail: (req) => `${getClientIp(req)}:${normalizeIdentifier(req.body?.email)}`,
  ipAndResetToken: (req) => `${getClientIp(req)}:${normalizeIdentifier(req.params?.token)}`,
  ipAndUser: (req) => `${getClientIp(req)}:${normalizeIdentifier(req.user?.userId || req.user?._id || req.user?.id)}`,
};

export const chatRateLimitKeys = {
  user: (req) => normalizeIdentifier(req.user?.userId || req.user?._id || req.user?.id),
  userAndBooking: (req) =>
    `${normalizeIdentifier(req.user?.userId || req.user?._id || req.user?.id)}:booking:${normalizeIdentifier(req.params?.bookingId)}`,
  userAndConversation: (req) =>
    `${normalizeIdentifier(req.user?.userId || req.user?._id || req.user?.id)}:conversation:${normalizeIdentifier(req.params?.id)}`,
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
