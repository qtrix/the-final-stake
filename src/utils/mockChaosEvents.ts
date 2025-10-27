// Mock Chaos Events System for Phase 1
// Events are scheduled at specific timestamps during the game

export type ChaosEventType =
    | 'rug_pull'
    | 'yield_surge'
    | 'whale_alert'
    | 'market_crash'
    | 'iq_test';

export type PoolType = 'mining' | 'farming' | 'trading' | 'research' | 'social';

export interface ChaosEvent {
    id: string;
    type: ChaosEventType;
    title: string;
    description: string;
    icon: string;
    color: string;
    timestamp: Date; // When the event happens
    warningTime: number; // Minutes before to show warning (2 minutes)
    affectedPool?: PoolType;
    probability?: Record<PoolType, number>;
    impact: string;
    educationalValue: string;
    realWorldExample: string;
}

/**
 * Generate chaos events for a game starting at a specific time
 * @param gameStartTime - The timestamp when the game starts (e.g., Date at 12:00)
 * @param phaseDurationMinutes - How long Phase 1 lasts (default 18 minutes)
 * @returns Array of chaos events scheduled throughout the phase
 */
export function generateChaosEvents(
    gameStartTime: Date,
    phaseDurationMinutes: number = 18
): ChaosEvent[] {
    const events: ChaosEvent[] = [];
    const startTime = gameStartTime.getTime();

    // Helper to create timestamp
    const timeAt = (minutes: number, seconds: number = 0) =>
        new Date(startTime + (minutes * 60 + seconds) * 1000);

    // 🔴 EVENT #1: "The Rug Pull" at 2:30
    const rugPullPool = selectRandomPool(['trading', 'research', 'farming', 'social'], [40, 30, 20, 10]);
    events.push({
        id: 'rug_pull_1',
        type: 'rug_pull',
        title: '🔴 RUG PULL ALERT',
        description: `${capitalizePool(rugPullPool)} Pool crashes to 0% APY! All future yield lost!`,
        icon: '🔴',
        color: '#ef4444',
        timestamp: timeAt(2, 30),
        warningTime: 2,
        affectedPool: rugPullPool,
        probability: { trading: 40, research: 30, farming: 20, social: 10, mining: 0 },
        impact: 'All funds in this pool lose future yield potential',
        educationalValue: 'Never put all eggs in one basket - Diversification is key',
        realWorldExample: 'Terra/LUNA collapse, FTX crash'
    });

    // 🎓 EVENT #2: "The IQ Test" at 4:00
    events.push({
        id: 'iq_test_1',
        type: 'iq_test',
        title: '🎓 DeFi IQ TEST',
        description: 'Pop quiz incoming! Answer correctly or lose 20% of your balance',
        icon: '🎓',
        color: '#8b5cf6',
        timestamp: timeAt(4, 0),
        warningTime: 2,
        impact: 'Failure results in -20% balance penalty',
        educationalValue: 'Forces learning, tests DeFi knowledge',
        realWorldExample: 'Understanding protocols before investing'
    });

    // 📈 EVENT #3: "Yield Surge" at 5:00
    const surgePools: PoolType[] = ['mining', 'farming', 'trading', 'research', 'social'];
    const surgePool = surgePools[Math.floor(Math.random() * surgePools.length)];
    events.push({
        id: 'yield_surge_1',
        type: 'yield_surge',
        title: '📈 YIELD SURGE',
        description: `${capitalizePool(surgePool)} Pool gets +100% APY boost for 2 hours!`,
        icon: '📈',
        color: '#10b981',
        timestamp: timeAt(5, 0),
        warningTime: 2,
        affectedPool: surgePool,
        impact: 'Players in this pool gain massive advantage',
        educationalValue: 'Importance of timing and positioning for opportunities',
        realWorldExample: 'Sudden liquidity incentives, DeFi airdrops'
    });

    // 💥 EVENT #4: "Market Crash" at 6:45
    events.push({
        id: 'market_crash_1',
        type: 'market_crash',
        title: '💥 MARKET CRASH',
        description: 'ALL players lose 30-50% of total balance!',
        icon: '💥',
        color: '#dc2626',
        timestamp: timeAt(6, 45),
        warningTime: 2,
        impact: 'Everyone loses 30-50% - field equalizes',
        educationalValue: 'Black swan events, importance of risk management',
        realWorldExample: '2022 crypto crash, COVID market crash'
    });

    // 🐋 EVENT #5: "Whale Alert" at 7:15
    events.push({
        id: 'whale_alert_1',
        type: 'whale_alert',
        title: '🐋 WHALE ALERT',
        description: 'Random player receives 2x balance bonus!',
        icon: '🐋',
        color: '#06b6d4',
        timestamp: timeAt(7, 15),
        warningTime: 2,
        impact: 'Creates immediate power imbalance',
        educationalValue: 'Market manipulation, whale movements impact',
        realWorldExample: 'Large institutional buying/selling pressure'
    });

    // Additional smaller events for variety
    // 🔥 EVENT #6: "Flash Crash" at 9:30
    const crashPool = surgePools[Math.floor(Math.random() * surgePools.length)];
    events.push({
        id: 'flash_crash_1',
        type: 'rug_pull',
        title: '🔥 FLASH CRASH',
        description: `${capitalizePool(crashPool)} Pool temporarily loses 50% APY`,
        icon: '🔥',
        color: '#f97316',
        timestamp: timeAt(9, 30),
        warningTime: 2,
        affectedPool: crashPool,
        impact: 'Temporary APY reduction',
        educationalValue: 'Volatility and temporary market disruptions',
        realWorldExample: 'Flash crashes in traditional markets'
    });

    // ⚡ EVENT #7: "Lightning Round" at 12:00
    events.push({
        id: 'lightning_round_1',
        type: 'yield_surge',
        title: '⚡ LIGHTNING ROUND',
        description: 'ALL pools get +50% APY for 3 minutes!',
        icon: '⚡',
        color: '#eab308',
        timestamp: timeAt(12, 0),
        warningTime: 2,
        impact: 'Temporary boost to all pools',
        educationalValue: 'Taking advantage of short-term opportunities',
        realWorldExample: 'Limited-time yield farming events'
    });

    // 🎯 EVENT #8: "Smart Money Move" at 15:00
    events.push({
        id: 'smart_money_1',
        type: 'whale_alert',
        title: '🎯 SMART MONEY',
        description: 'Top 3 diversified players get 1.5x bonus',
        icon: '🎯',
        color: '#14b8a6',
        timestamp: timeAt(15, 0),
        warningTime: 2,
        impact: 'Rewards strategic diversification',
        educationalValue: 'Smart portfolio allocation pays off',
        realWorldExample: 'Successful hedge fund strategies'
    });

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Get events that should be shown as warnings (within 2 minutes before event)
 * @param events - All chaos events
 * @param currentTime - Current timestamp
 * @returns Events that should be shown as upcoming warnings
 */
export function getUpcomingEvents(
    events: ChaosEvent[],
    currentTime: Date
): ChaosEvent[] {
    const now = currentTime.getTime();

    return events.filter(event => {
        const eventTime = event.timestamp.getTime();
        const warningStartTime = eventTime - (event.warningTime * 60 * 1000);

        // Show if: current time is between (eventTime - 2min) and eventTime
        return now >= warningStartTime && now < eventTime;
    });
}

/**
 * Get events that have already happened
 * @param events - All chaos events
 * @param currentTime - Current timestamp
 * @returns Events that already occurred
 */
export function getPastEvents(
    events: ChaosEvent[],
    currentTime: Date
): ChaosEvent[] {
    const now = currentTime.getTime();
    return events.filter(event => event.timestamp.getTime() <= now);
}

/**
 * Get the next upcoming event (not yet in warning window)
 * @param events - All chaos events
 * @param currentTime - Current timestamp
 * @returns Next event that will happen
 */
export function getNextEvent(
    events: ChaosEvent[],
    currentTime: Date
): ChaosEvent | null {
    const now = currentTime.getTime();
    const futureEvents = events.filter(event => event.timestamp.getTime() > now);
    return futureEvents.length > 0 ? futureEvents[0] : null;
}

// Helper functions
function capitalizePool(pool: PoolType): string {
    return pool.charAt(0).toUpperCase() + pool.slice(1);
}

function selectRandomPool(pools: PoolType[], probabilities: number[]): PoolType {
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (let i = 0; i < pools.length; i++) {
        cumulative += probabilities[i];
        if (rand <= cumulative) {
            return pools[i];
        }
    }

    return pools[pools.length - 1];
}

/**
 * Format time remaining until event
 * @param event - The chaos event
 * @param currentTime - Current timestamp
 * @returns Formatted string like "in 1m 30s"
 */
export function formatTimeUntilEvent(event: ChaosEvent, currentTime: Date): string {
    const diff = event.timestamp.getTime() - currentTime.getTime();

    if (diff <= 0) return 'NOW';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
        return `in ${minutes}m ${seconds}s`;
    }
    return `in ${seconds}s`;
}