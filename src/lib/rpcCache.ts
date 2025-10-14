interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

class RPCCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private pendingRequests: Map<string, Promise<any>> = new Map();
    private readonly DEFAULT_TTL = 30000; // 30 seconds
    private readonly MIN_REQUEST_INTERVAL = 5000; // 5 seconds between same requests

    /**
     * Get cached data or fetch with deduplication
     */
    async get<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttl: number = this.DEFAULT_TTL
    ): Promise<T> {
        // Check cache first
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && cached.expiresAt > now) {
            console.log(`📦 [Cache HIT] ${key}`);
            return cached.data;
        }

        // Check if request is already pending (deduplication)
        const pending = this.pendingRequests.get(key);
        if (pending) {
            console.log(`⏳ [Cache PENDING] ${key} - waiting for existing request`);
            return pending;
        }

        // Check rate limiting - prevent same request too frequently
        if (cached && (now - cached.timestamp) < this.MIN_REQUEST_INTERVAL) {
            console.log(`⏰ [Cache RATE LIMITED] ${key} - too soon, returning stale data`);
            return cached.data;
        }

        // Fetch new data
        console.log(`🔍 [Cache MISS] ${key} - fetching...`);
        const promise = fetcher();
        this.pendingRequests.set(key, promise);

        try {
            const data = await promise;

            this.cache.set(key, {
                data,
                timestamp: now,
                expiresAt: now + ttl,
            });

            return data;
        } finally {
            this.pendingRequests.delete(key);
        }
    }

    /**
     * Invalidate cache for a key
     */
    invalidate(key: string) {
        this.cache.delete(key);
        console.log(`🗑️ [Cache INVALIDATE] ${key}`);
    }

    /**
     * Invalidate all cache entries matching pattern
     */
    invalidatePattern(pattern: string) {
        const keys = Array.from(this.cache.keys()).filter(k => k.includes(pattern));
        keys.forEach(k => this.cache.delete(k));
        console.log(`🗑️ [Cache INVALIDATE PATTERN] ${pattern} - ${keys.length} entries`);
    }

    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
        console.log('🗑️ [Cache CLEARED]');
    }
}

export const rpcCache = new RPCCache();