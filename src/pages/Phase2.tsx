import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useSolanaGame, type Challenge, type MiniGameType } from '@/hooks/useSolanaGame';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import CountdownTimer from '@/components/CountdownTimer';
import GameModal from '@/components/phase2/GameModal';
import { Swords, Users, Trophy, Coins, ArrowLeft, Loader2, Wifi, WifiOff, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

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

    // Rate limiting
    const lastFetchTimeRef = useRef<number>(0);
    const FETCH_INTERVAL = 20000; // 10 seconds

    const gameTypes: { id: MiniGameType; name: string; icon: string; description: string }[] = [
        { id: 'CryptoTrivia', name: 'Crypto Trivia', icon: '🧠', description: '10 questions, 10s each' },
        { id: 'RockPaperScissors', name: 'Crypto Battle', icon: '✂️', description: 'Best of 5 rounds' },
        { id: 'SpeedTrading', name: 'Speed Trading', icon: '📈', description: '60s to maximize profit' },
        { id: 'MemeBattle', name: 'Meme Battle', icon: '🎭', description: 'Best of 3 meme showdown' },
    ];

    // Helper function for case-insensitive status check
    const checkStatus = (challenge: Challenge, statusToCheck: string): boolean => {
        return challenge.status.toLowerCase() === statusToCheck.toLowerCase();
    };

    useEffect(() => {
        if (!wallet.publicKey) {
            navigate('/');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('gameId');

        console.log('🔍 [Phase2] Looking for game:', gameId, 'in games:', solanaGame.games);

        if (gameId && solanaGame.games) {
            const game = solanaGame.games.find(g => g.gameId === parseInt(gameId));
            console.log('🔍 [Phase2] Found game:', game);
            if (game) {
                setCurrentGame(game);
            }
        }
    }, [wallet.publicKey, solanaGame.games, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            // Rate limiting check
            const now = Date.now();
            const timeSinceLastFetch = now - lastFetchTimeRef.current;

            if (timeSinceLastFetch < FETCH_INTERVAL) {
                console.log(`⏰ Rate limit: waiting ${Math.ceil((FETCH_INTERVAL - timeSinceLastFetch) / 1000)}s before next fetch`);
                return;
            }

            if (currentGame?.gameId === undefined || !wallet.publicKey || !solanaGame.program) {
                console.log('🔍 [Phase2] Skipping fetch:', {
                    hasGame: !!currentGame,
                    gameId: currentGame?.gameId,
                    hasWallet: !!wallet.publicKey,
                    hasProgram: !!solanaGame.program
                });
                return;
            }

            try {
                lastFetchTimeRef.current = now;
                console.log('🔍 [Phase2] Fetching player data for gameId:', currentGame.gameId);

                const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey);
                console.log('🔍 [Phase2] My player state:', playerData);
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
                            console.error(`Error fetching player ${playerAddress}:`, error);
                            return {
                                address: playerAddress,
                                publicKey: new PublicKey(playerAddress),
                                virtualBalance: 0
                            };
                        }
                    })
                );

                console.log('🔍 [Phase2] All players data:', playersData);

                const otherPlayers = playersData.filter(p => p.address !== wallet.publicKey.toBase58());
                console.log('🔍 [Phase2] Other players (filtered):', otherPlayers);
                setAllPlayers(otherPlayers);

                const pending = await solanaGame.getPendingChallenges(currentGame.gameId);
                const active = await solanaGame.getActiveChallenges(currentGame.gameId);
                const mine = await solanaGame.getMyChallenges(currentGame.gameId);

                console.log('🔍 [Phase2] Pending challenges:', pending);
                console.log('🔍 [Phase2] Active challenges:', active);
                console.log('🔍 [Phase2] My challenges:', mine);

                setReceivedChallenges(pending);
                setActiveChallenges(active);
                setMyChallenges(mine);
            } catch (error) {
                console.error('Error fetching Phase 2 data:', error);
            }
        };

        fetchData();

        // Set interval to 10 seconds
        const interval = setInterval(fetchData, FETCH_INTERVAL);
        return () => clearInterval(interval);
    }, [currentGame?.gameId, wallet.publicKey, solanaGame.program]);

    const sendChallenge = async () => {
        if (!selectedPlayer || !challengeAmount || !selectedGameType) {
            toast.error('Please select a player, amount, and game type');
            return;
        }

        const amount = parseFloat(challengeAmount);
        const balanceInSol = playerState?.virtualBalance ? playerState.virtualBalance / 1e9 : 0;
        if (amount > balanceInSol) {
            toast.error('Insufficient balance');
            return;
        }

        if (!currentGame?.gameId) {
            toast.error('Game not found');
            return;
        }

        setLoading(true);
        try {
            await solanaGame.createChallenge(
                currentGame.gameId,
                selectedPlayer,
                amount,
                selectedGameType as MiniGameType
            );

            toast.success('Challenge sent on-chain! 🎮');

            setSelectedPlayer(null);
            setChallengeAmount('');
            setSelectedGameType('');

            const mine = await solanaGame.getMyChallenges(currentGame.gameId);
            setMyChallenges(mine);
        } catch (error: any) {
            console.error('Error sending challenge:', error);
            toast.error(error.message || 'Failed to send challenge');
        } finally {
            setLoading(false);
        }
    };

    const handleChallenge = async (challenge: Challenge, accept: boolean) => {
        if (!currentGame?.gameId) return;

        setLoading(true);
        try {
            console.log('🎯 Responding to challenge:', {
                challengePDA: challenge.publicKey.toBase58(),
                accept,
                gameId: currentGame.gameId
            });

            await solanaGame.respondToChallenge(challenge.publicKey, currentGame.gameId, accept);

            if (accept) {
                toast.success('Challenge accepted! 🎯');

                // Refresh challenges
                const active = await solanaGame.getActiveChallenges(currentGame.gameId);
                setActiveChallenges(active);

                const updatedChallenge = active.find(c =>
                    c.publicKey.equals(challenge.publicKey)
                );

                if (updatedChallenge) {
                    console.log('✅ Challenge now in active state:', updatedChallenge.status);
                    if (checkStatus(updatedChallenge, 'Accepted')) {
                        await solanaGame.markReady(updatedChallenge.publicKey);
                        toast.info('Marked as ready. Waiting for opponent...');

                        pollForBothReady(updatedChallenge.publicKey);
                    }
                }
            } else {
                const declineCount = challenge.opponentDeclineCount + 1;
                if (declineCount >= 5) {
                    toast.warning('Challenge force-accepted after 5 declines!');
                } else {
                    toast.info(`Challenge declined (${declineCount}/5)`);
                }
            }

            // Refresh all challenge lists
            const pending = await solanaGame.getPendingChallenges(currentGame.gameId);
            const active = await solanaGame.getActiveChallenges(currentGame.gameId);
            setReceivedChallenges(pending);
            setActiveChallenges(active);

            // Force update last fetch time
            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            console.error('Error responding to challenge:', error);
            toast.error(error.message || 'Failed to respond to challenge');
        } finally {
            setLoading(false);
        }
    };

    const pollForBothReady = async (challengePDA: PublicKey) => {
        const maxAttempts = 60;
        let attempts = 0;

        const checkStatus = async () => {
            if (attempts >= maxAttempts || !currentGame?.gameId) {
                return;
            }

            try {
                const active = await solanaGame.getActiveChallenges(currentGame.gameId);
                const challenge = active.find(c => c.publicKey.equals(challengePDA));

                if (challenge && (challenge.status.toLowerCase() === 'bothready')) {
                    toast.success('Both players ready! Starting game...');
                    setCurrentChallenge(challenge);
                    await handleStartGame(challenge);
                    return;
                }

                attempts++;
                setTimeout(checkStatus, 1000);
            } catch (error) {
                console.error('Error checking challenge status:', error);
            }
        };

        checkStatus();
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
            console.error('Error starting game:', error);

            if (error.message?.includes('InvalidChallengeStatus')) {
                setCurrentChallenge(challenge);
                setShowGameModal(true);
            } else {
                toast.error(error.message || 'Failed to start game');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMarkReady = async (challenge: Challenge) => {
        setLoading(true);
        try {
            await solanaGame.markReady(challenge.publicKey);
            toast.success('Marked as ready! ✓');

            // Refresh challenges
            const active = await solanaGame.getActiveChallenges(currentGame.gameId);
            setActiveChallenges(active);

            // Force update last fetch time
            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            console.error('Error marking ready:', error);
            toast.error(error.message || 'Failed to mark ready');
        } finally {
            setLoading(false);
        }
    };

    const handleGameEnd = async (winner: PublicKey) => {
        if (!currentChallenge || !currentGame?.gameId) return;

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

            // Force update last fetch time
            lastFetchTimeRef.current = Date.now();
        } catch (error: any) {
            console.error('Error claiming win:', error);
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
                                <p className="text-sm text-muted-foreground mb-2">Challenges Sent</p>
                                <p className="text-3xl font-bold text-sol-purple">{myChallenges.length}</p>
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
                                            <p>No other players in this game yet</p>
                                        </div>
                                    ) : (
                                        allPlayers.map((player, index) => {
                                            const isSelected = selectedPlayer?.toString() === player.address;
                                            const shortAddress = `${player.address.slice(0, 4)}...${player.address.slice(-4)}`;
                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => setSelectedPlayer(player.publicKey)}
                                                    className={`w-full p-4 rounded-lg border-2 transition-all text-left relative group ${isSelected
                                                        ? 'border-sol-orange bg-sol-orange/20 shadow-lg shadow-sol-orange/25 scale-[1.02]'
                                                        : 'border-border/50 hover:border-sol-orange/50 hover:bg-accent/50'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            {isSelected && (
                                                                <div className="w-6 h-6 rounded-full bg-sol-orange flex items-center justify-center flex-shrink-0">
                                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="font-mono text-sm font-medium block">{shortAddress}</span>
                                                                <span className="text-xs text-muted-foreground">Player {index + 1}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-bold text-sol-orange">
                                                                {player.virtualBalance.toFixed(4)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">SOL</div>
                                                        </div>
                                                    </div>
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
                                onClick={sendChallenge}
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

                                    // Debug log
                                    console.log('Challenge status check:', {
                                        id: challenge.challengeId,
                                        status: challenge.status,
                                        isAccepted: checkStatus(challenge, 'Accepted'),
                                        isBothReady: checkStatus(challenge, 'BothReady'),
                                        isInProgress: checkStatus(challenge, 'InProgress')
                                    });

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