// src/hooks/usePlayerProfile.ts
import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolanaGame } from './useSolanaGame';
import { PublicKey } from '@solana/web3.js';

interface PlayerStats {
    totalWins: number;
    totalGames: number;
    totalKills: number;
    totalEarnings: number;
    winRate: number;
    averageKills: number;
    level: number;
    xp: number;
    rank: string;
    rankTier: number;
}

interface GameHistory {
    gameId: number;
    phase: number;
    position: number;
    kills: number;
    reward: number;
    timestamp: Date;
    isWinner: boolean;
    prizeClaimed?: boolean; // Track if winner claimed their prize
}

interface ProfileCustomization {
    username: string;
    avatarUrl: string;
    bio: string;
}

export const usePlayerProfile = () => {
    const { publicKey } = useWallet();
    const solanaGame = useSolanaGame();

    const [stats, setStats] = useState<PlayerStats>({
        totalWins: 0,
        totalGames: 0,
        totalKills: 0,
        totalEarnings: 0,
        winRate: 0,
        averageKills: 0,
        level: 1,
        xp: 0,
        rank: 'Bronze',
        rankTier: 1
    });

    const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
    const [loading, setLoading] = useState(true);

    // Profile customization (stored in localStorage for now)
    const [profile, setProfile] = useState<ProfileCustomization>(() => {
        if (!publicKey) return { username: '', avatarUrl: '', bio: '' };

        const stored = localStorage.getItem(`profile_${publicKey.toBase58()}`);
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            username: '',
            avatarUrl: '',
            bio: ''
        };
    });

    // Save profile to localStorage
    const updateProfile = (updates: Partial<ProfileCustomization>) => {
        if (!publicKey) return;

        const newProfile = { ...profile, ...updates };
        setProfile(newProfile);
        localStorage.setItem(`profile_${publicKey.toBase58()}`, JSON.stringify(newProfile));
    };

    // Calculate rank based on stats
    const calculateRank = (stats: PlayerStats): { rank: string; tier: number } => {
        const score =
            (stats.totalWins * 100) +
            (stats.totalGames * 10) +
            (stats.totalKills * 5) +
            (stats.totalEarnings * 50);

        if (score >= 10000) return { rank: 'Mythic', tier: 7 };
        if (score >= 5000) return { rank: 'Immortal', tier: 6 };
        if (score >= 2500) return { rank: 'Diamond', tier: 5 };
        if (score >= 1000) return { rank: 'Platinum', tier: 4 };
        if (score >= 500) return { rank: 'Gold', tier: 3 };
        if (score >= 100) return { rank: 'Silver', tier: 2 };
        return { rank: 'Bronze', tier: 1 };
    };

    // Calculate level and XP
    const calculateLevelAndXP = (totalGames: number, totalWins: number, totalKills: number): { level: number; xp: number } => {
        const baseXP = (totalGames * 50) + (totalWins * 200) + (totalKills * 10);
        const level = Math.floor(baseXP / 1000) + 1;
        const xp = baseXP % 1000;
        return { level, xp };
    };

    // Fetch player stats from blockchain
    useEffect(() => {
        const fetchPlayerStats = async () => {
            if (!publicKey || !solanaGame) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // Get all games
                const allGames = solanaGame.games;
                const playerAddress = publicKey.toBase58();

                let totalWins = 0;
                let totalGames = 0;
                let totalKills = 0;
                let totalEarnings = 0;
                const history: GameHistory[] = [];

                // Analyze each game
                for (const game of allGames) {
                    // Check if player participated
                    const isParticipant = game.players.some(p => p === playerAddress);
                    if (!isParticipant) continue;

                    totalGames++;

                    // Check if player won (Phase 3)
                    const isWinner = game.phase3Winner === playerAddress;
                    if (isWinner) {
                        totalWins++; // Count win even if not claimed yet

                        // But only add to earnings if prize was actually claimed
                        if (game.phase3PrizeClaimed) {
                            totalEarnings += game.currentPlayers * game.entryFee * 0.95; // 95% to winner
                        }
                    }

                    // Kills are not tracked in current game version
                    let kills = 0;

                    // Add to history
                    history.push({
                        gameId: game.gameId,
                        phase: game.currentPhase,
                        position: isWinner ? 1 : 0,
                        kills,
                        reward: isWinner ? game.currentPlayers * game.entryFee * 0.95 : 0,
                        timestamp: game.startTime,
                        isWinner,
                        prizeClaimed: game.phase3PrizeClaimed // Track if prize was claimed
                    });
                }

                // Sort history by timestamp (newest first)
                history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

                // Calculate derived stats
                const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
                const averageKills = totalGames > 0 ? totalKills / totalGames : 0;
                const { level, xp } = calculateLevelAndXP(totalGames, totalWins, totalKills);

                const newStats: PlayerStats = {
                    totalWins,
                    totalGames,
                    totalKills,
                    totalEarnings,
                    winRate,
                    averageKills,
                    level,
                    xp,
                    rank: 'Bronze',
                    rankTier: 1
                };

                // Calculate rank
                const { rank, tier } = calculateRank(newStats);
                newStats.rank = rank;
                newStats.rankTier = tier;

                setStats(newStats);
                setGameHistory(history);
            } catch (error) {
                console.error('Failed to fetch player stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayerStats();
    }, [publicKey?.toBase58(), solanaGame.games]);

    // Calculate achievements
    const achievements = useMemo(() => {
        return [
            {
                id: 'first_win',
                title: 'First Victory',
                description: 'Win your first match',
                icon: 'Trophy',
                unlocked: stats.totalWins >= 1,
                rarity: 'Common',
                progress: Math.min(stats.totalWins, 1),
                total: 1
            },
            {
                id: 'veteran',
                title: 'Veteran',
                description: 'Play 10 matches',
                icon: 'Users',
                unlocked: stats.totalGames >= 10,
                rarity: 'Common',
                progress: Math.min(stats.totalGames, 10),
                total: 10
            },
            {
                id: 'killer',
                title: 'Killer Instinct',
                description: 'Get 50 total kills',
                icon: 'Target',
                unlocked: stats.totalKills >= 50,
                rarity: 'Rare',
                progress: Math.min(stats.totalKills, 50),
                total: 50
            },
            {
                id: 'rich',
                title: 'High Roller',
                description: 'Earn 10 SOL total',
                icon: 'Coins',
                unlocked: stats.totalEarnings >= 10,
                rarity: 'Rare',
                progress: Math.min(stats.totalEarnings, 10),
                total: 10
            },
            {
                id: 'champion',
                title: 'Champion',
                description: 'Win 10 matches',
                icon: 'Award',
                unlocked: stats.totalWins >= 10,
                rarity: 'Epic',
                progress: Math.min(stats.totalWins, 10),
                total: 10
            },
            {
                id: 'dominator',
                title: 'Dominator',
                description: 'Maintain 50%+ win rate over 20 games',
                icon: 'Zap',
                unlocked: stats.totalGames >= 20 && stats.winRate >= 50,
                rarity: 'Epic',
                progress: stats.totalGames >= 20 ? stats.winRate : 0,
                total: 50
            },
            {
                id: 'legend',
                title: 'Legend',
                description: 'Win 50 matches',
                icon: 'Star',
                unlocked: stats.totalWins >= 50,
                rarity: 'Legendary',
                progress: Math.min(stats.totalWins, 50),
                total: 50
            },
            {
                id: 'millionaire',
                title: 'Millionaire',
                description: 'Earn 100 SOL total',
                icon: 'TrendingUp',
                unlocked: stats.totalEarnings >= 100,
                rarity: 'Legendary',
                progress: Math.min(stats.totalEarnings, 100),
                total: 100
            }
        ];
    }, [stats]);

    return {
        stats,
        gameHistory,
        achievements,
        profile,
        updateProfile,
        loading
    };
};