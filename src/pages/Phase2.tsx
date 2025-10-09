// src/pages/Phase2.tsx - VERSIUNE COMPLETĂ CU TOT DESIGN-UL ORIGINAL
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
import CountdownTimer from '@/components/CountdownTimer';
import GameModal from '@/components/phase2/GameModal';
import {
    Swords, Users, Trophy, Coins, ArrowLeft, Loader2, Clock, Zap,
    AlertTriangle, Target, TrendingUp
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
    const [showGameModal, setShowGameModal] = useState(false);
    const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);

    const [gameRequirements, setGameRequirements] = useState<any>(null);
    const [playerStats, setPlayerStats] = useState<PlayerGameStats | null>(null);
    const [eligibilityStatus, setEligibilityStatus] = useState<any>(null);
    const [progressStatus, setProgressStatus] = useState<any>(null);
    const [optimalDistribution, setOptimalDistribution] = useState<any>(null);

    const lastFetchTimeRef = useRef<number>(0);
    const FETCH_INTERVAL = 20000;

    const gameTypes: { id: MiniGameType; name: string; icon: string; description: string }[] = [
        { id: 'CryptoTrivia', name: 'Crypto Trivia', icon: '🧠', description: '10 questions, 10s each' },
        { id: 'RockPaperScissors', name: 'Crypto Battle', icon: '✂️', description: 'Best of 5 rounds' },
        { id: 'SpeedTrading', name: 'Speed Trading', icon: '📈', description: '60s to maximize profit' },
        { id: 'MemeBattle', name: 'Meme Battle', icon: '🎭', description: 'Best of 3 meme showdown' },
    ];

    const checkStatus = (challenge: Challenge, statusToCheck: string): boolean => {
        return challenge.status.toLowerCase() === statusToCheck.toLowerCase();
    };

    useEffect(() => {
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
        } else {
            toast.error(`Game ${gameId} not found`);
        }
    }, [wallet.publicKey, solanaGame.games, navigate]);

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
            if (currentGame?.gameId !== 0 && !currentGame?.gameId) return;
            if (!wallet.publicKey || !gameRequirements) return;

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
        const interval = setInterval(fetchPlayerStats, 15000);
        return () => clearInterval(interval);
    }, [currentGame?.gameId, wallet.publicKey, gameRequirements]);

    useEffect(() => {
        const fetchData = async () => {
            const now = Date.now();
            if (now - lastFetchTimeRef.current < FETCH_INTERVAL) return;
            if (currentGame?.gameId !== 0 && !currentGame?.gameId) return;
            if (!wallet.publicKey || !solanaGame.program) return;

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

                const pending = await solanaGame.getPendingChallenges(currentGame.gameId);
                const active = await solanaGame.getActiveChallenges(currentGame.gameId);
                const mine = await solanaGame.getMyChallenges(currentGame.gameId);

                setReceivedChallenges(pending);
                setActiveChallenges(active);
                setMyChallenges(mine);
            } catch (error) {
                console.error('Error fetching Phase 2 data:', error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, FETCH_INTERVAL);
        return () => clearInterval(interval);
    }, [currentGame?.gameId, wallet.publicKey, solanaGame.program]);

    const sendChallenge = async () => {
        console.log('🎮 [sendChallenge] Starting:', {
            selectedPlayer: selectedPlayer?.toBase58(),
            challengeAmount,
            selectedGameType,
            currentGameId: currentGame?.gameId
        });

        if (!selectedPlayer || !challengeAmount || !selectedGameType) {
            toast.error('Please select player, amount, and game type');
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
        try {
            console.log('📤 Creating challenge with gameId:', currentGame.gameId);

            await solanaGame.createChallenge(
                currentGame.gameId,
                selectedPlayer,
                amount,
                selectedGameType as MiniGameType
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
        }
    };

    const handleChallenge = async (challenge: Challenge, accept: boolean) => {
        if (currentGame?.gameId !== 0 && !currentGame?.gameId) return;

        setLoading(true);
        try {
            await solanaGame.respondToChallenge(challenge.publicKey, currentGame.gameId, accept);

            if (accept) {
                toast.success('Challenge accepted! 🎯');
                const active = await solanaGame.getActiveChallenges(currentGame.gameId);
                setActiveChallenges(active);

                const updatedChallenge = active.find(c => c.publicKey.equals(challenge.publicKey));
                if (updatedChallenge && checkStatus(updatedChallenge, 'Accepted')) {
                    await solanaGame.markReady(updatedChallenge.publicKey);
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
        }
    };

    const handleStartGame = async (challenge: Challenge) => {
        if (!wallet.publicKey) return;

        setLoading(true);
        try {
            await solanaGame.startMiniGame(challenge.publicKey);
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
        }
    };

    const handleMarkReady = async (challenge: Challenge) => {
        setLoading(true);
        try {
            await solanaGame.markReady(challenge.publicKey);
            toast.success('Marked as ready!');
            const active = await solanaGame.getActiveChallenges(currentGame.gameId);
            setActiveChallenges(active);
            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            toast.error(error.message || 'Failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGameEnd = async (winner: PublicKey) => {
        if (!currentChallenge || (currentGame?.gameId !== 0 && !currentGame?.gameId)) return;

        const loser = winner.equals(currentChallenge.challenger)
            ? currentChallenge.opponent
            : currentChallenge.challenger;

        try {
            await solanaGame.claimMiniGameWin(
                currentChallenge.publicKey,
                currentGame.gameId,
                winner,
                loser
            );

            toast.success(winner.equals(wallet.publicKey!) ? '🎉 You won!' : 'Better luck next time!');

            const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey!);
            setPlayerState(playerData);

            const mine = await solanaGame.getMyChallenges(currentGame.gameId);
            setMyChallenges(mine);
            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            toast.error(error.message || 'Failed to claim win');
        }
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <ParticleBackground />
            <Navbar />

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
                    {currentGame?.phaseEndTime && (
                        <div className="inline-block">
                            <CountdownTimer targetTime={new Date(currentGame.phaseEndTime)} />
                        </div>
                    )}
                </div>

                {/* Requirements Banner */}
                {gameRequirements && (
                    <Card className="mb-8 border-2 border-sol-purple/30 bg-gradient-to-r from-sol-purple/10 to-sol-orange/10">
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

                {/* Player Progress Card */}
                {playerStats && gameRequirements && progressStatus && (
                    <Card className={`mb-8 border-2 ${eligibilityStatus?.eligible
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

                {/* Player Stats */}
                <Card className="mb-8 border-2 border-sol-orange/30 bg-gradient-to-br from-background to-accent/20">
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
                                        : '0.0000'} SOL
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
                    {/* Send Challenge */}
                    <Card className="border-2 border-sol-orange/30">
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
                                                    disabled={!canChallenge}
                                                    className={`w-full p-4 rounded-lg border-2 transition-all text-left relative ${!canChallenge
                                                        ? 'border-red-500/30 bg-red-500/5 opacity-50 cursor-not-allowed'
                                                        : isSelected
                                                            ? 'border-sol-orange bg-sol-orange/20 shadow-lg shadow-sol-orange/25 scale-[1.02]'
                                                            : 'border-border/50 hover:border-sol-orange/50 hover:bg-accent/50'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            {isSelected && canChallenge && (
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
                                                    {!canChallenge && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                                            <span className="text-xs font-semibold text-red-400">
                                                                Max games reached
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
                                <div className="grid grid-cols-2 gap-3">
                                    {gameTypes.map((game) => {
                                        const isSelected = selectedGameType === game.id;
                                        return (
                                            <button
                                                key={game.id}
                                                onClick={() => setSelectedGameType(game.id)}
                                                className={`p-4 rounded-lg border-2 transition-all relative group ${isSelected
                                                    ? 'border-sol-orange bg-sol-orange/20 shadow-lg shadow-sol-orange/25 scale-[1.02]'
                                                    : 'border-border/50 hover:border-sol-orange/50 hover:bg-accent/50'
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-sol-orange flex items-center justify-center">
                                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="text-4xl mb-2">{game.icon}</div>
                                                <div className="text-xs font-medium mb-1">{game.name}</div>
                                                <div className="text-xs text-muted-foreground">{game.description}</div>
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
                                        className="w-full px-4 py-3 rounded-lg bg-background border-2 border-border/50 focus:outline-none focus:ring-2 focus:ring-sol-orange focus:border-sol-orange transition-all text-lg font-mono"
                                        placeholder="0.1"
                                        step="0.01"
                                        min="0.01"
                                        max={playerState?.virtualBalance ? playerState.virtualBalance / 1e9 : 0}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                                        SOL
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
                                onClick={() => {
                                    console.log('🔴 Button click:', {
                                        selectedPlayer: selectedPlayer?.toBase58(),
                                        challengeAmount,
                                        selectedGameType,
                                        gameId: currentGame?.gameId
                                    });
                                    sendChallenge();
                                }}
                                disabled={!selectedPlayer || !challengeAmount || !selectedGameType || loading}
                                className="w-full mt-2 h-12 text-base font-bold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Swords className="w-5 h-5 mr-2" />
                                        Send Challenge
                                        <span className="ml-2 text-xs opacity-50">
                                            ({selectedPlayer ? '✓' : '✗'} {challengeAmount ? '✓' : '✗'} {selectedGameType ? '✓' : '✗'})
                                        </span>
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Received Challenges */}
                    <Card className="border-2 border-green-400/30">
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
                                                        disabled={loading}
                                                        className="flex-1"
                                                    >
                                                        ✓ Accept
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

                {/* Active Challenges */}
                {activeChallenges.length > 0 && (
                    <Card className="mb-8 border-2 border-yellow-400/30 bg-yellow-400/5">
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
                                                    disabled={loading}
                                                    className="w-full animate-pulse"
                                                >
                                                    🎮 Start Game!
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

                {/* My Challenges */}
                <Card className="border-2 border-sol-purple/30">
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

            {/* Loading Overlay */}
            {loading && (
                <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <Card className="p-8">
                        <Loader2 className="w-12 h-12 animate-spin text-sol-orange mx-auto mb-4" />
                        <p className="text-center font-medium">Processing transaction...</p>
                        <p className="text-center text-sm text-muted-foreground mt-2">Please wait...</p>
                    </Card>
                </div>
            )}

            {/* Game Modal */}
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

            {/* Custom Scrollbar Styles */}
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