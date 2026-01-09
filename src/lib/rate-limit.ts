import { NextRequest } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting
// For production with multiple instances, consider using Redis
const store: RateLimitStore = {};

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 10 * 60 * 1000);

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

/**
 * Rate limiter function
 * @param identifier - Unique identifier (e.g., IP address, username)
 * @param config - Configuration with maxAttempts and windowMs
 * @returns Object with allowed status and remaining attempts
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = { maxAttempts: 5, windowMs: 15 * 60 * 1000 } // 5 attempts per 15 minutes
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = store[identifier];

  if (!record || record.resetTime < now) {
    // Create new record
    store[identifier] = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetTime: store[identifier].resetTime,
    };
  }

  // Increment existing record
  record.count++;

  if (record.count > config.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  return {
    allowed: true,
    remaining: config.maxAttempts - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Get IP address from request
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * Reset rate limit for a specific identifier
 */
export function resetRateLimit(identifier: string): void {
  delete store[identifier];
}
