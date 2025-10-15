// src/pages/Phase2.tsx - COMPLETE VERSION WITH RETRY LOGIC AND ADVANCE TO PHASE 3
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useSolanaGame, type Challenge, type MiniGameType } from '@/hooks/useSolanaGame';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import PhaseCountdown from '@/components/PhaseCountdown';
import GameModal from '@/components/phase2/GameModal';
import TransactionOverlay from '@/components/TransactionOverlay';
import {
    Swords, Users, Trophy, Coins, ArrowLeft, Loader2, Clock, Zap,
    AlertTriangle, Target, TrendingUp, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
    calculateGameRequirements,
    checkPlayerEligibility,
    canChallengeOpponent,
    getPenaltyDescription,
    getProgressStatus,
    calculateOptimalGameDistribution,
    type PlayerGameStats
} from '@/lib/gameFormulas';

// ✅ Helper function to retry transactions with fresh blockhash
const retryTransaction = async <T,>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
): Promise<T> => {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 [${operationName}] Attempt ${attempt}/${maxRetries}`);
            const result = await operation();
            console.log(`✅ [${operationName}] Success on attempt ${attempt}`);
            return result;
        } catch (error: any) {
            lastError = error;
            const errorMessage = error?.message || String(error);

            // Check if error is retryable
            const isRetryable =
                errorMessage.includes('already been processed') ||
                errorMessage.includes('Blockhash not found') ||
                errorMessage.includes('block height exceeded') ||
                errorMessage.includes('Transaction simulation failed');

            console.error(`❌ [${operationName}] Attempt ${attempt} failed:`, errorMessage);

            if (!isRetryable || attempt === maxRetries) {
                console.error(`❌ [${operationName}] Non-retryable error or max retries reached`);
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.log(`⏳ [${operationName}] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

export default function Phase2() {
    const navigate = useNavigate();
    const wallet = useWallet();
    const solanaGame = useSolanaGame();

    const [currentGame, setCurrentGame] = useState<any>(null);
    const [playerState, setPlayerState] = useState<any>(null);
    const [allPlayers, setAllPlayers] = useState<any[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<PublicKey | null>(null);
    const [challengeAmount, setChallengeAmount] = useState('');
    const [selectedGameType, setSelectedGameType] = useState<MiniGameType | ''>('');
    const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
    const [receivedChallenges, setReceivedChallenges] = useState<Challenge[]>([]);
    const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(false);
    const [transactionLoading, setTransactionLoading] = useState(false);
    const [showGameModal, setShowGameModal] = useState(false);
    const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);

    const [gameRequirements, setGameRequirements] = useState<any>(null);
    const [playerStats, setPlayerStats] = useState<PlayerGameStats | null>(null);
    const [eligibilityStatus, setEligibilityStatus] = useState<any>(null);
    const [progressStatus, setProgressStatus] = useState<any>(null);
    const [optimalDistribution, setOptimalDistribution] = useState<any>(null);
    const [lastGameCompletedTime, setLastGameCompletedTime] = useState(0);
    const [phaseExpired, setPhaseExpired] = useState(false);

    const [canAdvanceToPhase3, setCanAdvanceToPhase3] = useState(false);
    const [timeUntilAdvance, setTimeUntilAdvance] = useState<string>('');
    const [isCreator, setIsCreator] = useState(false);

    const lastFetchTimeRef = useRef<number>(0);
    const FETCH_INTERVAL = 20000;

    const gameTypes: { id: MiniGameType; name: string; icon: string; description: string }[] = [
        { id: 'RockPaperScissors', name: 'Rock Paper Scissors', icon: '✂️', description: 'Best of 5 rounds' },
    ];

    const checkStatus = (challenge: Challenge, statusToCheck: string): boolean => {
        return challenge.status.toLowerCase() === statusToCheck.toLowerCase();
    };

    useEffect(() => {
        if (!window.location.pathname.includes('/phase2')) {
            return;
        }
        if (!wallet.publicKey) {
            navigate('/');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const gameIdParam = urlParams.get('gameId');

        if (!gameIdParam) {
            toast.error('Game ID missing from URL');
            return;
        }

        if (!solanaGame.games || solanaGame.games.length === 0) return;

        const gameId = parseInt(gameIdParam);
        const game = solanaGame.games.find(g => g.gameId === gameId);

        if (game) {
            console.log('✅ Game found:', game.gameId);
            setCurrentGame(game);
            setIsCreator(game.creator === wallet.publicKey.toBase58());

            const now = new Date().getTime();
            const phaseEnd = new Date(game.phaseEndTime).getTime();
            setPhaseExpired(now >= phaseEnd);
        } else {
            toast.error(`Game ${gameId} not found`);
        }
    }, [wallet.publicKey, solanaGame.games, navigate]);

    useEffect(() => {
        if (!currentGame || !wallet.publicKey) return;

        const updateAdvanceTimer = () => {
            const now = Date.now();
            const phaseEndTime = new Date(currentGame.phaseEndTime).getTime();
            const timeoutDeadline = phaseEndTime + 600000; // 10 minutes after phase end

            if (now < phaseEndTime) {
                setPhaseExpired(false);
                setCanAdvanceToPhase3(false);

                const diff = phaseEndTime - now;
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeUntilAdvance(`Phase ends in ${minutes}m ${seconds}s`);
            } else if (now >= phaseEndTime && now < timeoutDeadline) {
                setPhaseExpired(true);

                if (isCreator) {
                    setCanAdvanceToPhase3(true);
                    setTimeUntilAdvance('Creator can advance now');
                } else {
                    const diff = timeoutDeadline - now;
                    const minutes = Math.floor(diff / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    setCanAdvanceToPhase3(false);
                    setTimeUntilAdvance(`Waiting for creator (${minutes}m ${seconds}s until timeout)`);
                }
            } else {
                setPhaseExpired(true);
                setCanAdvanceToPhase3(true);
                setTimeUntilAdvance('Anyone can advance now');
            }
        };

        updateAdvanceTimer();
        const interval = setInterval(updateAdvanceTimer, 1000);
        return () => clearInterval(interval);
    }, [currentGame, wallet.publicKey, isCreator]);

    useEffect(() => {
        if (!currentGame) return;

        const requirements = calculateGameRequirements(
            currentGame.phase2RequiredGames || 5,
            currentGame.phase2MaxGamesPerOpponent || 3
        );
        setGameRequirements(requirements);

        const distribution = calculateOptimalGameDistribution(
            currentGame.players.length,
            requirements.requiredGames,
            requirements.maxGamesPerOpponent
        );
        setOptimalDistribution(distribution);
    }, [currentGame]);

    useEffect(() => {
        const fetchPlayerStats = async () => {
            if (!currentGame?.gameId || !wallet.publicKey || !gameRequirements) return;

            const stats = await solanaGame.getPlayerPhase2Stats(
                currentGame.gameId,
                wallet.publicKey
            );

            const playerGameStats: PlayerGameStats = {
                totalGamesPlayed: stats.totalGamesPlayed,
                gamesWon: stats.gamesWon,
                gamesLost: stats.gamesLost,
                opponentPlayCounts: new Map(Object.entries(stats.opponentPlayCounts)),
                completedRequirement: false,
                participationRate: 0
            };

            if (gameRequirements) {
                const eligibility = checkPlayerEligibility(playerGameStats, gameRequirements);
                playerGameStats.completedRequirement = eligibility.eligible;
                playerGameStats.participationRate =
                    (stats.totalGamesPlayed / gameRequirements.requiredGames) * 100;
                setEligibilityStatus(eligibility);

                const progress = getProgressStatus(
                    stats.totalGamesPlayed,
                    gameRequirements.requiredGames
                );
                setProgressStatus(progress);
            }

            setPlayerStats(playerGameStats);
        };

        fetchPlayerStats();
    }, [currentGame?.gameId, wallet.publicKey, gameRequirements, lastGameCompletedTime]);

    useEffect(() => {
        const fetchData = async () => {
            const now = Date.now();
            if (now - lastFetchTimeRef.current < FETCH_INTERVAL) return;
            if (!currentGame?.gameId || !wallet.publicKey || !solanaGame.program) return;

            try {
                lastFetchTimeRef.current = now;

                const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey);
                setPlayerState(playerData);

                const playersData = await Promise.all(
                    currentGame.players.map(async (playerAddress: string) => {
                        try {
                            const playerPubkey = new PublicKey(playerAddress);
                            const playerState = await solanaGame.getPlayerState(currentGame.gameId, playerPubkey);
                            const virtualBalance = playerState?.virtualBalance ? playerState.virtualBalance / 1e9 : 0;

                            return {
                                address: playerAddress,
                                publicKey: playerPubkey,
                                virtualBalance
                            };
                        } catch (error) {
                            return {
                                address: playerAddress,
                                publicKey: new PublicKey(playerAddress),
                                virtualBalance: 0
                            };
                        }
                    })
                );

                const otherPlayers = playersData.filter(p => p.address !== wallet.publicKey.toBase58());
                setAllPlayers(otherPlayers);

                const [pending, active] = await Promise.all([
                    solanaGame.getPendingChallenges(currentGame.gameId),
                    solanaGame.getActiveChallenges(currentGame.gameId),
                ]);

                setReceivedChallenges(pending);
                setActiveChallenges(active);
            } catch (error) {
                console.error('Error fetching Phase 2 data:', error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, FETCH_INTERVAL);
        return () => clearInterval(interval);
    }, [currentGame?.gameId, wallet.publicKey, solanaGame.program]);

    // ✅ FIXED: Advance to Phase 3 with retry logic
    const handleAdvanceToPhase3 = async () => {
        if (!currentGame) {
            toast.error('Game not found');
            return;
        }

        setLoading(true);
        setTransactionLoading(true);

        try {
            // Retry logic for advance phase
            await retryTransaction(
                () => solanaGame.advanceToPhase3(currentGame.gameId, (progress: any) => {
                    console.log('Phase 3 advance progress:', progress);
                    // ✅ FIX: Don't return the toast result
                    toast.info(progress.step, {
                        description: `Progress: ${progress.progress}%`,
                    });
                }),
                'Advance to Phase 3'
            );

            toast.success('Advanced to Phase 3!', {
                description: 'Game moved successfully to Phase 3. All eligible players can now mark READY.',
            });

            // Refresh games
            await solanaGame.refreshGames();

            // Refresh player state
            if (wallet.publicKey) {
                const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey);
                if (playerData) {
                    const normalizedPlayerState = {
                        ...playerData,
                        virtualBalance: playerData.virtualBalance / 1e9,
                        totalEarned: playerData.totalEarned / 1e9,
                        allocations: playerData.allocations
                            ? {
                                mining: playerData.allocations.mining / 1e9,
                                farming: playerData.allocations.farming / 1e9,
                                trading: playerData.allocations.trading / 1e9,
                                research: playerData.allocations.research / 1e9,
                                social: playerData.allocations.social / 1e9,
                            }
                            : {},
                    };
                    setPlayerState(normalizedPlayerState);
                }
            }

            // Navigate to Phase 3 after delay
            setTimeout(() => {
                navigate(`/phase3?gameId=${currentGame.gameId}`);
            }, 2000);
        } catch (error: any) {
            console.error('❌ Error advancing to Phase 3:', error);
            toast.error('Advance Failed', {
                description: error.message || 'Could not advance to Phase 3',
            });
        } finally {
            setLoading(false);
            setTransactionLoading(false);
        }
    };

    const sendChallenge = async () => {
        if (!selectedPlayer || !challengeAmount || !selectedGameType) {
            toast.error('Please select player, amount, and game type');
            return;
        }

        if (phaseExpired) {
            toast.error('⏰ Phase 2 has ended - no more challenges allowed!');
            return;
        }

        if (currentGame?.gameId !== 0 && !currentGame?.gameId) {
            console.error('❌ Game not found!');
            toast.error('Game not found. Refresh the page.');
            return;
        }

        if (playerStats && gameRequirements) {
            const canChallenge = canChallengeOpponent(
                selectedPlayer.toBase58(),
                playerStats,
                gameRequirements
            );

            if (!canChallenge.canChallenge) {
                toast.error(canChallenge.reason || 'Cannot challenge this opponent');
                return;
            }
        }

        const amount = parseFloat(challengeAmount);
        const balanceInSol = playerState?.virtualBalance ? playerState.virtualBalance / 1e9 : 0;
        if (amount > balanceInSol) {
            toast.error('Insufficient balance');
            return;
        }

        setLoading(true);
        setTransactionLoading(true);
        try {
            // ✅ Retry logic for create challenge
            await retryTransaction(
                () => solanaGame.createChallenge(
                    currentGame.gameId,
                    selectedPlayer,
                    amount,
                    selectedGameType as MiniGameType
                ),
                'Create Challenge'
            );

            toast.success('Challenge sent! 🎮');

            setSelectedPlayer(null);
            setChallengeAmount('');
            setSelectedGameType('');

            const mine = await solanaGame.getMyChallenges(currentGame.gameId);
            setMyChallenges(mine);
        } catch (error: any) {
            console.error('❌ Error:', error);
            toast.error(error.message || 'Failed to send challenge');
        } finally {
            setLoading(false);
            setTransactionLoading(false);
        }
    };

    const handleChallenge = async (challenge: Challenge, accept: boolean) => {
        if (currentGame?.gameId !== 0 && !currentGame?.gameId) return;

        if (phaseExpired && accept) {
            toast.error('⏰ Phase 2 has ended - cannot accept challenges!');
            return;
        }

        setLoading(true);
        setTransactionLoading(true);
        try {
            // ✅ Retry logic for respond to challenge
            await retryTransaction(
                () => solanaGame.respondToChallenge(challenge.publicKey, currentGame.gameId, accept),
                'Respond to Challenge'
            );

            if (accept) {
                toast.success('Challenge accepted! 🎯');
                const active = await solanaGame.getActiveChallenges(currentGame.gameId);
                setActiveChallenges(active);

                const updatedChallenge = active.find(c => c.publicKey.equals(challenge.publicKey));
                if (updatedChallenge && checkStatus(updatedChallenge, 'Accepted')) {
                    await retryTransaction(
                        () => solanaGame.markReady(updatedChallenge.publicKey),
                        'Mark Ready'
                    );
                    toast.info('Marked as ready');
                }
            } else {
                toast.info(`Challenge declined (${challenge.opponentDeclineCount + 1}/5)`);
            }

            const pending = await solanaGame.getPendingChallenges(currentGame.gameId);
            const active = await solanaGame.getActiveChallenges(currentGame.gameId);
            setReceivedChallenges(pending);
            setActiveChallenges(active);
            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            toast.error(error.message || 'Failed to respond');
        } finally {
            setLoading(false);
            setTransactionLoading(false);
        }
    };

    const handleStartGame = async (challenge: Challenge) => {
        if (!wallet.publicKey) return;

        if (phaseExpired) {
            toast.error('⏰ Phase 2 has ended - cannot start new games!');
            return;
        }

        setLoading(true);
        setTransactionLoading(true);
        try {
            // ✅ Retry logic for start game
            await retryTransaction(
                () => solanaGame.startMiniGame(challenge.publicKey),
                'Start Mini Game'
            );

            toast.success('Game started! 🎮');
            setCurrentChallenge(challenge);
            setShowGameModal(true);
        } catch (error: any) {
            if (error.message?.includes('InvalidChallengeStatus')) {
                setCurrentChallenge(challenge);
                setShowGameModal(true);
            } else {
                toast.error(error.message || 'Failed to start');
            }
        } finally {
            setLoading(false);
            setTransactionLoading(false);
        }
    };

    const handleMarkReady = async (challenge: Challenge) => {
        setLoading(true);
        setTransactionLoading(true);
        try {
            // ✅ Retry logic for mark ready
            await retryTransaction(
                () => solanaGame.markReady(challenge.publicKey),
                'Mark Ready'
            );

            toast.success('Marked as ready!');
            const active = await solanaGame.getActiveChallenges(currentGame.gameId);
            setActiveChallenges(active);
            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            toast.error(error.message || 'Failed');
        } finally {
            setLoading(false);
            setTransactionLoading(false);
        }
    };

    const handleGameEnd = async (winner: PublicKey) => {
        if (!currentChallenge || (currentGame?.gameId !== 0 && !currentGame?.gameId)) return;

        if (!winner.equals(wallet.publicKey!)) {
            console.log('❌ You lost - no transaction needed');
            toast.error('Better luck next time!');

            setShowGameModal(false);
            setCurrentChallenge(null);
            setLastGameCompletedTime(Date.now());

            const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey!);
            setPlayerState(playerData);

            const mine = await solanaGame.getMyChallenges(currentGame.gameId);
            setMyChallenges(mine);

            lastFetchTimeRef.current = Date.now();
            return;
        }

        const loser = winner.equals(currentChallenge.challenger)
            ? currentChallenge.opponent
            : currentChallenge.challenger;

        setTransactionLoading(true);
        try {
            toast.info('🏆 Finalizing transaction...');

            // ✅ Retry logic for claim win
            await retryTransaction(
                () => solanaGame.claimMiniGameWin(
                    currentChallenge.publicKey,
                    currentGame.gameId,
                    winner,
                    loser
                ),
                'Claim Mini Game Win'
            );

            toast.success('🎉 Victory! Rewards claimed!');

            setShowGameModal(false);
            setCurrentChallenge(null);
            setLastGameCompletedTime(Date.now());

            const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey!);
            setPlayerState(playerData);

            const mine = await solanaGame.getMyChallenges(currentGame.gameId);
            setMyChallenges(mine);

            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            toast.error(error.message || 'Failed to claim win');
        } finally {
            setTransactionLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            <ParticleBackground />

            <div className="relative z-20">
                <Navbar />
            </div>

            <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/lobby')}
                    className="mb-6 flex items-center gap-2 hover:bg-sol-orange/10"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Lobby
                </Button>

                <div className="text-center mb-12">
                    <h1 className="text-5xl md:text-7xl font-display font-black mb-4">
                        <span className="gradient-text">⚔️ Phase 2: Battle Arena</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground mb-6">
                        Challenge other players to skill-based mini-games
                    </p>
                </div>

                {currentGame?.phaseEndTime && (
                    <div className="mb-8">
                        <PhaseCountdown targetTime={new Date(currentGame.phaseEndTime)} phaseName="Phase 2" />
                    </div>
                )}

                {/* Advance to Phase 3 Card */}
                {phaseExpired && (
                    <Card className="mb-8 border-2 border-red-600 bg-gradient-to-r from-red-900/30 to-orange-900/30 backdrop-blur-md animate-pulse">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-2xl">
                                <AlertTriangle className="w-6 h-6 text-red-400" />
                                Phase 2 Has Ended!
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert className="bg-yellow-900/30 border-yellow-600">
                                <Clock className="h-4 w-4" />
                                <AlertTitle>⏰ Time's Up!</AlertTitle>
                                <AlertDescription>
                                    Phase 2 has ended. {timeUntilAdvance}
                                    {!canAdvanceToPhase3 && !isCreator && (
                                        <div className="mt-2 text-sm">
                                            The creator can advance immediately, or anyone can advance after the 10-minute timeout.
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>

                            {canAdvanceToPhase3 && (
                                <div className="space-y-3">
                                    <Alert className="bg-red-900/30 border-red-600">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>⚠️ Important</AlertTitle>
                                        <AlertDescription>
                                            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                                                <li>Players who didn't complete 80% of required games will lose 50% of their balance</li>
                                                <li>All pending challenges will be cancelled</li>
                                                <li>No more games can be started in Phase 2</li>
                                            </ul>
                                        </AlertDescription>
                                    </Alert>

                                    <Button
                                        onClick={handleAdvanceToPhase3}
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 py-6 text-xl font-bold shadow-lg shadow-red-600/50"
                                        size="lg"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                                                Advancing...
                                            </>
                                        ) : (
                                            <>
                                                <ArrowRight className="w-6 h-6 mr-2" />
                                                {isCreator ? 'Advance to Phase 3 (Creator)' : 'Advance to Phase 3'}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {!canAdvanceToPhase3 && (
                                <div className="text-center py-4">
                                    <Clock className="w-12 h-12 mx-auto mb-3 text-yellow-400 animate-spin" />
                                    <p className="text-lg text-muted-foreground">
                                        {timeUntilAdvance}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Rest of the UI remains the same... */}
                {gameRequirements && (
                    <Card className="mb-8 border-2 border-sol-purple/30 bg-gradient-to-r from-sol-purple/10 to-sol-orange/10 backdrop-blur-md">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <Trophy className="w-8 h-8 text-sol-purple flex-shrink-0 mt-1" />
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold mb-2">Phase 2 Requirements</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Required Games</p>
                                            <p className="text-2xl font-bold text-sol-orange">
                                                {gameRequirements.requiredGames}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Min {Math.ceil(gameRequirements.requiredGames * 0.8)} to avoid penalty
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Max per Opponent</p>
                                            <p className="text-2xl font-bold text-sol-purple">
                                                {gameRequirements.maxGamesPerOpponent}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Prevents farming</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Est. Time</p>
                                            <p className="text-2xl font-bold text-green-400">
                                                ~{gameRequirements.totalEstimatedTime}min
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {gameRequirements.recommendedTimePerGame}min per game
                                            </p>
                                        </div>
                                    </div>

                                    {optimalDistribution && !optimalDistribution.warning && (
                                        <Alert className="mt-4 border-blue-500/50 bg-blue-500/10">
                                            <Target className="h-4 w-4" />
                                            <AlertTitle>Strategy Tip</AlertTitle>
                                            <AlertDescription>
                                                {optimalDistribution.optimalDistribution} to complete requirements.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {optimalDistribution?.warning && (
                                        <Alert className="mt-4 border-red-500/50 bg-red-500/10">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Warning</AlertTitle>
                                            <AlertDescription>{optimalDistribution.warning}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {playerStats && gameRequirements && progressStatus && (
                    <Card className={`mb-8 border-2 backdrop-blur-md ${eligibilityStatus?.eligible
                        ? 'border-green-500/50 bg-green-500/10'
                        : playerStats.participationRate! < 50
                            ? 'border-red-500/50 bg-red-500/10'
                            : 'border-yellow-500/50 bg-yellow-500/10'
                        }`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                Your Progress
                                <span className="ml-auto text-2xl">{progressStatus.icon}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>Games Completed</span>
                                        <span className="font-bold">
                                            {playerStats.totalGamesPlayed} / {gameRequirements.requiredGames}
                                        </span>
                                    </div>
                                    <div className="h-4 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${eligibilityStatus?.eligible ? 'bg-green-500' :
                                                playerStats.participationRate! < 50 ? 'bg-red-500' : 'bg-yellow-500'
                                                }`}
                                            style={{
                                                width: `${Math.min(100, (playerStats.totalGamesPlayed / gameRequirements.requiredGames) * 100)}%`
                                            }}
                                        />
                                    </div>
                                    <p className={`text-sm mt-1 ${progressStatus.color}`}>
                                        {progressStatus.message}
                                    </p>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-3 rounded-lg bg-accent/50">
                                        <p className="text-xs text-muted-foreground mb-1">Wins</p>
                                        <p className="text-2xl font-bold text-green-400">{playerStats.gamesWon}</p>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-accent/50">
                                        <p className="text-xs text-muted-foreground mb-1">Losses</p>
                                        <p className="text-2xl font-bold text-red-400">{playerStats.gamesLost}</p>
                                    </div>
                                    <div className="text-center p-3 rounded-lg bg-accent/50">
                                        <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                                        <p className="text-2xl font-bold text-sol-orange">
                                            {playerStats.totalGamesPlayed > 0
                                                ? Math.round((playerStats.gamesWon / playerStats.totalGamesPlayed) * 100)
                                                : 0}%
                                        </p>
                                    </div>
                                </div>

                                {eligibilityStatus && (
                                    <div className={`p-4 rounded-lg ${eligibilityStatus.eligible
                                        ? 'bg-green-500/20 border border-green-500/30'
                                        : 'bg-yellow-500/20 border border-yellow-500/30'
                                        }`}>
                                        <p className={`font-semibold ${eligibilityStatus.eligible ? 'text-green-400' : 'text-yellow-400'
                                            }`}>
                                            {eligibilityStatus.eligible
                                                ? '✅ You meet the requirements!'
                                                : `⚠️ ${eligibilityStatus.reason}`
                                            }
                                        </p>

                                        {!eligibilityStatus.eligible && playerStats.participationRate !== undefined && (
                                            <p className="text-sm text-muted-foreground mt-2">
                                                {getPenaltyDescription(
                                                    playerStats.totalGamesPlayed,
                                                    gameRequirements.requiredGames
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="mb-8 border-2 border-sol-orange/30 bg-gradient-to-br from-background/80 to-accent/20 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Trophy className="w-6 h-6 text-sol-orange" />
                            Your Stats
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="text-center p-4 rounded-lg bg-accent/50">
                                <p className="text-sm text-muted-foreground mb-2">Virtual Balance</p>
                                <p className="text-3xl font-bold text-sol-orange">
                                    {playerState?.virtualBalance
                                        ? (playerState.virtualBalance / 1e9).toFixed(4)
                                        : '0.0000'} vSOL
                                </p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-accent/50">
                                <p className="text-sm text-muted-foreground mb-2">Games Played</p>
                                <p className="text-3xl font-bold text-sol-purple">
                                    {playerStats?.totalGamesPlayed || 0}
                                </p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-accent/50">
                                <p className="text-sm text-muted-foreground mb-2">Challenges Received</p>
                                <p className="text-3xl font-bold text-green-400">{receivedChallenges.length}</p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-accent/50">
                                <p className="text-sm text-muted-foreground mb-2">Active Games</p>
                                <p className="text-3xl font-bold text-yellow-400">{activeChallenges.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <Card className="border-2 border-sol-orange/30 backdrop-blur-md bg-background/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Swords className="w-5 h-5 text-sol-orange" />
                                Send Challenge
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-3">Select Player</label>
                                <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                                    {allPlayers.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>No other players yet</p>
                                        </div>
                                    ) : (
                                        allPlayers.map((player, idx) => {
                                            const isSelected = selectedPlayer?.toString() === player.address;
                                            const shortAddress = `${player.address.slice(0, 4)}...${player.address.slice(-4)}`;
                                            const gamesPlayed = playerStats?.opponentPlayCounts.get(player.address) || 0;
                                            const canChallenge = !gameRequirements || gamesPlayed < gameRequirements.maxGamesPerOpponent;

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => canChallenge && setSelectedPlayer(player.publicKey)}
                                                    disabled={!canChallenge || phaseExpired}
                                                    className={`w-full p-4 rounded-lg border-2 transition-all text-left relative ${!canChallenge || phaseExpired
                                                        ? 'border-red-500/30 bg-red-500/5 opacity-50 cursor-not-allowed'
                                                        : isSelected
                                                            ? 'border-sol-orange bg-sol-orange/20 shadow-lg shadow-sol-orange/25 scale-[1.02]'
                                                            : 'border-border/50 hover:border-sol-orange/50 hover:bg-accent/50'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            {isSelected && canChallenge && !phaseExpired && (
                                                                <div className="w-6 h-6 rounded-full bg-sol-orange flex items-center justify-center flex-shrink-0">
                                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="font-mono text-sm font-medium block">{shortAddress}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    Player {idx + 1} • Played: {gamesPlayed}/{gameRequirements?.maxGamesPerOpponent || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-bold text-sol-orange">
                                                                {player.virtualBalance.toFixed(4)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">SOL</div>
                                                        </div>
                                                    </div>
                                                    {(!canChallenge || phaseExpired) && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                                            <span className="text-xs font-semibold text-red-400">
                                                                {phaseExpired ? 'Phase ended' : 'Max games reached'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-3">Select Game Type</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {gameTypes.map((game) => {
                                        const isSelected = selectedGameType === game.id;
                                        return (
                                            <button
                                                key={game.id}
                                                onClick={() => setSelectedGameType(game.id)}
                                                disabled={phaseExpired}
                                                className={`p-4 rounded-lg border-2 transition-all relative group ${phaseExpired ? 'opacity-50 cursor-not-allowed' :
                                                    isSelected
                                                        ? 'border-sol-orange bg-sol-orange/20 shadow-lg shadow-sol-orange/25 scale-[1.02]'
                                                        : 'border-border/50 hover:border-sol-orange/50 hover:bg-accent/50'
                                                    }`}
                                            >
                                                {isSelected && !phaseExpired && (
                                                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-sol-orange flex items-center justify-center">
                                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-4">
                                                    <div className="text-4xl">{game.icon}</div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium mb-1">{game.name}</div>
                                                        <div className="text-xs text-muted-foreground">{game.description}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-3">Bet Amount (SOL)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={challengeAmount}
                                        onChange={(e) => setChallengeAmount(e.target.value)}
                                        disabled={phaseExpired}
                                        className="w-full px-4 py-3 rounded-lg bg-background border-2 border-border/50 focus:outline-none focus:ring-2 focus:ring-sol-orange focus:border-sol-orange transition-all text-lg font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="0.1"
                                        step="0.01"
                                        min="0.01"
                                        max={playerState?.virtualBalance ? playerState.virtualBalance / 1e9 : 0}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                                        vSOL
                                    </span>
                                </div>
                                {playerState && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Max: {(playerState.virtualBalance / 1e9).toFixed(4)} SOL
                                    </p>
                                )}
                            </div>

                            <Button
                                variant="sol"
                                onClick={sendChallenge}
                                disabled={!selectedPlayer || !challengeAmount || !selectedGameType || loading || phaseExpired}
                                className="w-full mt-2 h-12 text-base font-bold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : phaseExpired ? (
                                    '⏰ Phase Ended'
                                ) : (
                                    <>
                                        <Swords className="w-5 h-5 mr-2" />
                                        Send Challenge
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-green-400/30 backdrop-blur-md bg-background/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Users className="w-5 h-5 text-green-400" />
                                Received Challenges
                                {receivedChallenges.length > 0 && (
                                    <span className="ml-auto bg-green-400/20 text-green-400 text-sm px-3 py-1 rounded-full font-bold animate-pulse">
                                        {receivedChallenges.length}
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {receivedChallenges.length === 0 ? (
                                <p className="text-muted-foreground text-center py-12">
                                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    No challenges yet
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                                    {receivedChallenges.map((challenge) => {
                                        const gameTypeData = gameTypes.find(g => g.id === challenge.gameType);
                                        return (
                                            <div
                                                key={challenge.challengeId}
                                                className="p-4 border-2 border-green-400/30 rounded-lg bg-green-400/5 hover:bg-green-400/10 transition-all"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-mono text-sm font-bold">
                                                            {challenge.challenger.toBase58().slice(0, 8)}...
                                                        </p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                            <span>{gameTypeData?.icon}</span>
                                                            {gameTypeData?.name}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-sol-orange">{challenge.betAmount.toFixed(4)} SOL</p>
                                                        <p className="text-xs text-green-400">{challenge.status}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="sol"
                                                        size="sm"
                                                        onClick={() => handleChallenge(challenge, true)}
                                                        disabled={loading || phaseExpired}
                                                        className="flex-1"
                                                    >
                                                        {phaseExpired ? '⏰ Phase Ended' : '✓ Accept'}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleChallenge(challenge, false)}
                                                        disabled={loading}
                                                        className="flex-1 border-red-500 text-red-400 hover:bg-red-500/10"
                                                    >
                                                        × Decline ({challenge.opponentDeclineCount}/5)
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {activeChallenges.length > 0 && (
                    <Card className="mb-8 border-2 border-yellow-400/30 bg-yellow-400/5 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Zap className="w-5 h-5 text-yellow-400" />
                                Active Challenges - Ready to Play
                                <span className="ml-auto bg-yellow-400/20 text-yellow-400 text-sm px-3 py-1 rounded-full font-bold animate-pulse">
                                    {activeChallenges.length}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeChallenges.map((challenge) => {
                                    const isChallenger = challenge.challenger.equals(wallet.publicKey!);
                                    const opponentAddr = isChallenger
                                        ? challenge.opponent.toBase58()
                                        : challenge.challenger.toBase58();
                                    const gameTypeData = gameTypes.find(g => g.id === challenge.gameType);

                                    return (
                                        <div
                                            key={challenge.challengeId}
                                            className="p-5 border-2 border-sol-orange/50 rounded-lg bg-gradient-to-br from-sol-orange/10 to-sol-orange/5 hover:shadow-lg hover:shadow-sol-orange/20 transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1">vs</p>
                                                    <p className="font-mono text-sm font-bold">
                                                        {opponentAddr.slice(0, 8)}...
                                                    </p>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300 font-medium animate-pulse">
                                                    {challenge.status}
                                                </span>
                                            </div>

                                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                                <span>{gameTypeData?.icon}</span>
                                                {gameTypeData?.name}
                                            </p>

                                            <p className="font-bold text-sol-orange text-lg mb-4">
                                                {challenge.betAmount.toFixed(4)} SOL
                                            </p>

                                            {checkStatus(challenge, 'Accepted') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleMarkReady(challenge)}
                                                    disabled={loading}
                                                    className="w-full border-sol-orange text-sol-orange hover:bg-sol-orange/10"
                                                >
                                                    ✓ Mark Ready
                                                </Button>
                                            )}

                                            {checkStatus(challenge, 'BothReady') && (
                                                <Button
                                                    variant="sol"
                                                    size="sm"
                                                    onClick={() => handleStartGame(challenge)}
                                                    disabled={loading || phaseExpired}
                                                    className="w-full animate-pulse"
                                                >
                                                    {phaseExpired ? '⏰ Phase Ended' : '🎮 Start Game!'}
                                                </Button>
                                            )}

                                            {checkStatus(challenge, 'InProgress') && (
                                                <Button
                                                    variant="hero"
                                                    size="sm"
                                                    onClick={() => {
                                                        setCurrentChallenge(challenge);
                                                        setShowGameModal(true);
                                                    }}
                                                    className="w-full"
                                                >
                                                    ↩️ Resume Game
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-2 border-sol-purple/30 backdrop-blur-md bg-background/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Coins className="w-5 h-5 text-sol-purple" />
                            My Challenges
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {myChallenges.length === 0 ? (
                            <p className="text-muted-foreground text-center py-12">
                                <Swords className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                No challenges sent yet
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myChallenges.map((challenge) => {
                                    const gameTypeData = gameTypes.find(g => g.id === challenge.gameType);
                                    return (
                                        <div
                                            key={challenge.challengeId}
                                            className="p-4 border-2 border-border rounded-lg bg-accent/30 hover:bg-accent/50 transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="font-mono text-sm font-bold">
                                                    {challenge.opponent.toBase58().slice(0, 12)}...
                                                </p>
                                                <span className={`text-xs px-2 py-1 rounded font-medium ${checkStatus(challenge, 'Pending') ? 'bg-yellow-500/20 text-yellow-300' :
                                                    checkStatus(challenge, 'Accepted') || checkStatus(challenge, 'BothReady') ? 'bg-green-500/20 text-green-300' :
                                                        'bg-red-500/20 text-red-300'
                                                    }`}>
                                                    {challenge.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                                <span>{gameTypeData?.icon}</span>
                                                {gameTypeData?.name}
                                            </p>
                                            <p className="font-bold text-sol-orange">{challenge.betAmount.toFixed(4)} SOL</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <TransactionOverlay show={transactionLoading} message="Finalizing transaction..." />

            {showGameModal && currentChallenge && wallet.publicKey && (
                <GameModal
                    challengePDA={currentChallenge.publicKey}
                    challengeId={currentChallenge.challengeId.toString()}
                    gameType={currentChallenge.gameType}
                    challenger={currentChallenge.challenger}
                    opponent={currentChallenge.opponent}
                    betAmount={currentChallenge.betAmount}
                    myAddress={wallet.publicKey}
                    onGameEnd={handleGameEnd}
                    onClose={() => {
                        setShowGameModal(false);
                        setCurrentChallenge(null);
                    }}
                />
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 130, 0, 0.3);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 130, 0, 0.5);
                }
            `}</style>
        </div>
    );
}