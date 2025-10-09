/**
 * Game Formulas and Validation Logic
 * 
 * This file contains all the business logic for calculating Phase 2 requirements,
 * validating player eligibility, and checking opponent limits.
 */

export interface PlayerGameStats {
    totalGamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    opponentPlayCounts: Map<string, number>;
    completedRequirement?: boolean;
    participationRate?: number;
}

export interface GameRequirements {
    requiredGames: number;
    maxGamesPerOpponent: number;
    recommendedTimePerGame: number;
    totalEstimatedTime: number;
    minParticipationRate: number;
}

export interface EligibilityCheck {
    eligible: boolean;
    reason?: string;
    missingGames?: number;
    progress?: number;
}

export interface OpponentChallengeCheck {
    canChallenge: boolean;
    reason?: string;
    gamesPlayedAgainst?: number;
}

/**
 * Calculate game requirements based on contract configuration
 * These values should match the contract's Phase 2 requirements
 */
export function calculateGameRequirements(
    requiredGames: number = 5,
    maxGamesPerOpponent: number = 3
): GameRequirements {
    const recommendedTimePerGame = 3; // minutes per game average
    const totalEstimatedTime = requiredGames * recommendedTimePerGame;
    const minParticipationRate = 80; // minimum 80% completion rate

    return {
        requiredGames,
        maxGamesPerOpponent,
        recommendedTimePerGame,
        totalEstimatedTime,
        minParticipationRate
    };
}

/**
 * Check if a player meets the Phase 2 requirements
 * 
 * Requirements:
 * 1. Must play at least requiredGames (e.g., 5 games)
 * 2. Must maintain at least 80% participation (can miss 1 game if requiredGames = 5)
 * 3. Must not exceed maxGamesPerOpponent against any single opponent
 */
export function checkPlayerEligibility(
    playerStats: PlayerGameStats,
    requirements: GameRequirements
): EligibilityCheck {
    const { totalGamesPlayed } = playerStats;
    const { requiredGames, minParticipationRate } = requirements;

    // Calculate minimum required games (80% of required)
    const minRequiredGames = Math.ceil(requiredGames * (minParticipationRate / 100));

    console.log('🔍 [Eligibility Check]', {
        totalGamesPlayed,
        requiredGames,
        minRequiredGames,
        participationRate: (totalGamesPlayed / requiredGames) * 100
    });

    // Check if player has played enough games
    if (totalGamesPlayed < minRequiredGames) {
        const missingGames = minRequiredGames - totalGamesPlayed;
        const progress = (totalGamesPlayed / requiredGames) * 100;

        return {
            eligible: false,
            reason: `You need to play at least ${minRequiredGames} games. You have played ${totalGamesPlayed}. ${missingGames} more game${missingGames > 1 ? 's' : ''} needed.`,
            missingGames,
            progress
        };
    }

    // Player meets requirements
    const progress = Math.min(100, (totalGamesPlayed / requiredGames) * 100);

    return {
        eligible: true,
        progress
    };
}

/**
 * Check if a player can challenge a specific opponent
 * 
 * This prevents farming by limiting how many games can be played
 * against the same opponent.
 */
export function canChallengeOpponent(
    opponentAddress: string,
    playerStats: PlayerGameStats,
    requirements: GameRequirements
): OpponentChallengeCheck {
    const gamesPlayedAgainst = playerStats.opponentPlayCounts.get(opponentAddress) || 0;
    const { maxGamesPerOpponent } = requirements;

    console.log('🔍 [Opponent Check]', {
        opponent: opponentAddress.slice(0, 8) + '...',
        gamesPlayedAgainst,
        maxGamesPerOpponent
    });

    if (gamesPlayedAgainst >= maxGamesPerOpponent) {
        return {
            canChallenge: false,
            reason: `You have already played ${gamesPlayedAgainst} game${gamesPlayedAgainst > 1 ? 's' : ''} against this opponent. Maximum is ${maxGamesPerOpponent}.`,
            gamesPlayedAgainst
        };
    }

    const remainingGames = maxGamesPerOpponent - gamesPlayedAgainst;

    return {
        canChallenge: true,
        gamesPlayedAgainst,
        reason: remainingGames === maxGamesPerOpponent
            ? `You can play up to ${maxGamesPerOpponent} games against this opponent.`
            : `You can play ${remainingGames} more game${remainingGames > 1 ? 's' : ''} against this opponent.`
    };
}

/**
 * Calculate the penalty multiplier for not meeting Phase 2 requirements
 * 
 * Contract logic:
 * - If participation_rate < 50%: 50% penalty (keep only 50% of balance)
 * - If participation_rate < 80%: 25% penalty (keep only 75% of balance)
 * - Otherwise: no penalty
 */
export function calculatePenaltyMultiplier(
    totalGamesPlayed: number,
    requiredGames: number
): number {
    const participationRate = (totalGamesPlayed / requiredGames) * 100;

    console.log('⚠️ [Penalty Check]', {
        totalGamesPlayed,
        requiredGames,
        participationRate: participationRate.toFixed(1) + '%'
    });

    if (participationRate < 50) {
        console.log('⚠️ Severe penalty: 50% (keep only 50% of balance)');
        return 0.5; // Keep only 50%
    } else if (participationRate < 80) {
        console.log('⚠️ Moderate penalty: 25% (keep only 75% of balance)');
        return 0.75; // Keep only 75%
    }

    console.log('✅ No penalty (participation >= 80%)');
    return 1.0; // No penalty
}

/**
 * Get a user-friendly description of the penalty
 */
export function getPenaltyDescription(
    totalGamesPlayed: number,
    requiredGames: number
): string {
    const participationRate = (totalGamesPlayed / requiredGames) * 100;

    if (participationRate < 50) {
        return `⚠️ Severe Penalty: You will lose 50% of your balance for not meeting minimum participation (${participationRate.toFixed(0)}% participation).`;
    } else if (participationRate < 80) {
        return `⚠️ Penalty: You will lose 25% of your balance for low participation (${participationRate.toFixed(0)}% participation).`;
    }

    return `✅ No penalty - You meet the minimum participation requirement (${participationRate.toFixed(0)}% participation).`;
}

/**
 * Calculate optimal game distribution strategy
 * 
 * This helps players understand how to spread their games across
 * different opponents to avoid hitting the maxGamesPerOpponent limit.
 */
export function calculateOptimalGameDistribution(
    totalPlayers: number,
    requiredGames: number,
    maxGamesPerOpponent: number
): {
    minOpponentsNeeded: number;
    optimalDistribution: string;
    warning?: string;
} {
    // Calculate minimum opponents needed
    const minOpponentsNeeded = Math.ceil(requiredGames / maxGamesPerOpponent);

    // Check if it's even possible
    const availableOpponents = totalPlayers - 1; // Exclude self

    if (minOpponentsNeeded > availableOpponents) {
        return {
            minOpponentsNeeded,
            optimalDistribution: 'Not enough opponents in the game!',
            warning: `You need at least ${minOpponentsNeeded} opponents to complete ${requiredGames} games with a max of ${maxGamesPerOpponent} per opponent. There are only ${availableOpponents} other players.`
        };
    }

    // Calculate optimal distribution
    const gamesPerOpponent = Math.floor(requiredGames / minOpponentsNeeded);
    const remainingGames = requiredGames % minOpponentsNeeded;

    let distribution = `Play ${gamesPerOpponent} game${gamesPerOpponent > 1 ? 's' : ''} against ${minOpponentsNeeded} different opponent${minOpponentsNeeded > 1 ? 's' : ''}`;

    if (remainingGames > 0) {
        distribution += `, plus ${remainingGames} additional game${remainingGames > 1 ? 's' : ''}`;
    }

    return {
        minOpponentsNeeded,
        optimalDistribution: distribution
    };
}

/**
 * Get progress status with visual indicators
 */
export function getProgressStatus(
    totalGamesPlayed: number,
    requiredGames: number
): {
    status: 'not-started' | 'in-progress' | 'at-risk' | 'completed';
    color: string;
    icon: string;
    message: string;
} {
    const participationRate = (totalGamesPlayed / requiredGames) * 100;

    if (totalGamesPlayed === 0) {
        return {
            status: 'not-started',
            color: 'text-gray-400',
            icon: '⚪',
            message: 'Not started - Begin playing mini-games!'
        };
    } else if (participationRate < 50) {
        return {
            status: 'at-risk',
            color: 'text-red-400',
            icon: '🔴',
            message: 'At risk - Severe penalty if phase ends now!'
        };
    } else if (participationRate < 80) {
        return {
            status: 'at-risk',
            color: 'text-yellow-400',
            icon: '🟡',
            message: 'At risk - Small penalty if phase ends now'
        };
    } else if (totalGamesPlayed < requiredGames) {
        return {
            status: 'in-progress',
            color: 'text-blue-400',
            icon: '🔵',
            message: 'Good progress - Keep playing to complete requirements'
        };
    } else {
        return {
            status: 'completed',
            color: 'text-green-400',
            icon: '🟢',
            message: 'Requirements completed - You can advance to Phase 3!'
        };
    }
}