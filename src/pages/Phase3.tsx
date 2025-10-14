// src/pages/Phase3.tsx - Complete Phase 3 Page
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useSolanaGame } from '../hooks/useSolanaGame';
import { Game, Phase3ReadyState } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Clock, Users, Trophy, AlertCircle, CheckCircle, Loader2,
    Target, Zap, Coins, UserX, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PurgeGameMultiplayer from '@/pages/PurgeGameMultiplayer';

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

            const delay = Math.pow(2, attempt - 1) * 1000;
            console.log(`⏳ [${operationName}] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

const Phase3 = () => {
    const navigate = useNavigate();
    const wallet = useWallet();
    const solanaGame = useSolanaGame();
    const {
        games,
        markReadyPhase3,
        startPhase3Game,
        getPhase3ReadyStates,
        claimPlatformFee,
        loading,
        program,
    } = solanaGame || {};

    const [currentGame, setCurrentGame] = useState<Game | null>(null);
    const [gameId, setGameId] = useState<number | null>(null);
    const [readyStates, setReadyStates] = useState<Phase3ReadyState[]>([]);
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [canAdvance, setCanAdvance] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [showBattleGame, setShowBattleGame] = useState(false);
    const [redirecting, setRedirecting] = useState(false);

    const [totalMiniGamesPlayed, setTotalMiniGamesPlayed] = useState(0);
    const [totalEliminated, setTotalEliminated] = useState(0);
    const [totalPrizePool, setTotalPrizePool] = useState(0);
    const [totalVirtualBalance, setTotalVirtualBalance] = useState(0);

    const isFetchingReadyStates = useRef(false);
    const hasTriedAutoAdvance = useRef(false);



    useEffect(() => {
        if (!program) {
            console.log('⏳ Waiting for program to initialize...');
            setIsInitializing(true);
            return;
        }

        if (wallet.connecting) {
            console.log('⏳ Wallet is connecting...');
            setIsInitializing(true);
            return;
        }

        setIsInitializing(false);

        if (!wallet.publicKey) {
            console.log('⚠️ Wallet not connected, redirecting to home');
            navigate('/');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const gameIdParam = urlParams.get('gameId');

        if (!gameIdParam) {
            toast.error('Game ID missing from URL');
            navigate('/lobby');
            return;
        }

        const parsedGameId = parseInt(gameIdParam);
        console.log('✅ Setting gameId:', parsedGameId);
        setGameId(parsedGameId);
    }, [program, wallet.connecting, wallet.publicKey, navigate]);

    useEffect(() => {
        if (gameId === null || !games || games.length === 0) {
            console.log('⏳ Waiting for games...');
            return;
        }

        const game = games.find(g => g.gameId === gameId);
        if (game) {
            console.log('✅ Game found:', game.gameId, 'Phase:', game.currentPhase);
            console.log('📊 Full Game data:', game);
            setCurrentGame(game);

            if (game.currentPhase !== 3) {
                console.log('⚠️ Game is not in Phase 3');
                toast.info(`Game is in Phase ${game.currentPhase}, not Phase 3`);
                navigate('/lobby');
            }
        } else {
            console.log('❌ Game not found:', gameId);
            toast.error(`Game ${gameId} not found`);
            navigate('/lobby');
        }
    }, [gameId, games, navigate]);

    useEffect(() => {
        console.log('🔍 Checking phase3 status:', {
            hasCurrentGame: !!currentGame,
            showingBattle: showBattleGame,
            phase3Started: currentGame?.phase3Started,
            readyStatesLength: readyStates.length,
            hasTriedAutoAdvance: hasTriedAutoAdvance.current
        });

        if (!currentGame || showBattleGame) {
            console.log('⏸️ Skipping phase3 check - no game or already showing battle');
            return;
        }

        if (currentGame.phase3Started && readyStates.length > 0 && !hasTriedAutoAdvance.current) {
            const readyCount = readyStates.filter(s => s.ready).length;

            console.log('🎮 Phase3 already started!', {
                readyCount,
                readyPlayers: readyStates.filter(s => s.ready).map(s => s.player.slice(0, 8))
            });

            if (readyCount >= 2) {
                hasTriedAutoAdvance.current = true;

                console.log('✅ Auto-redirecting to battle...');
                toast.success('⚔️ Battle in progress! Joining arena...', { duration: 2000 });

                setTimeout(() => {
                    console.log('🚀 Setting showBattleGame = true');
                    setShowBattleGame(true);
                }, 1500);
            } else {
                console.log('⚠️ Not enough ready players for battle:', readyCount);
            }
        } else {
            console.log('⏳ Waiting for phase3 to start or more ready states');
        }
    }, [currentGame?.phase3Started, readyStates, showBattleGame]);

    useEffect(() => {
        if (!currentGame) return;

        const calculateStats = async () => {
            try {
                const eliminated = currentGame.players.length - currentGame.currentPlayers;
                setTotalEliminated(eliminated);

                const prizePool = currentGame.entryFee * currentGame.players.length;
                setTotalPrizePool(prizePool);
                console.log('💰 Prize Pool (entry_fee * players):', prizePool.toFixed(4), 'SOL');

                let totalVirtual = 0;
                try {
                    const balancePromises = currentGame.players.map(async (playerAddr) => {
                        try {
                            const playerPubkey = new PublicKey(playerAddr);
                            const playerState = await solanaGame.getPlayerState(
                                currentGame.gameId,
                                playerPubkey
                            );
                            return playerState?.virtualBalance ? playerState.virtualBalance / 1e9 : 0;
                        } catch {
                            return 0;
                        }
                    });

                    const balances = await Promise.all(balancePromises);
                    totalVirtual = balances.reduce((sum, bal) => sum + bal, 0);
                    console.log('💎 Total Virtual Balance:', totalVirtual.toFixed(4), 'SOL');
                } catch (error) {
                    console.error('Error calculating virtual balance:', error);
                    totalVirtual = prizePool * 10;
                }
                setTotalVirtualBalance(totalVirtual);

                let totalGames = 0;
                try {
                    if (currentGame.totalPhase2GamesPlayed !== undefined) {
                        totalGames = currentGame.totalPhase2GamesPlayed;
                    } else {
                        for (const playerAddr of currentGame.players) {
                            try {
                                const playerPubkey = new PublicKey(playerAddr);
                                const stats = await solanaGame.getPlayerPhase2Stats(
                                    currentGame.gameId,
                                    playerPubkey
                                );
                                totalGames += stats.totalGamesPlayed || 0;
                            } catch (err) {
                                console.warn('Could not fetch stats for player:', playerAddr);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching mini games count:', error);
                    totalGames = 0;
                }
                setTotalMiniGamesPlayed(totalGames);

                console.log('✅ Stats updated:', {
                    eliminated,
                    prizePool: prizePool.toFixed(4),
                    virtualBalance: totalVirtual.toFixed(4),
                    miniGames: totalGames
                });
            } catch (error) {
                console.error('❌ Error calculating stats:', error);
            }
        };

        calculateStats();
    }, [currentGame?.gameId, currentGame?.players, currentGame?.currentPlayers]);

    useEffect(() => {
        if (!currentGame || currentGame.currentPhase !== 3) return;

        const wrappedFetchReadyStates = async () => {
            if (isFetchingReadyStates.current) {
                console.log('⏸️ Ready states fetch already in progress, skipping...');
                return;
            }
            await fetchReadyStates();
        };

        wrappedFetchReadyStates();
        const interval = setInterval(wrappedFetchReadyStates, 15000);
        return () => clearInterval(interval);
    }, [currentGame?.gameId, currentGame?.currentPhase]);

    useEffect(() => {
        if (!currentGame || currentGame.currentPhase !== 3) return;

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [currentGame, readyStates]);

    const fetchReadyStates = async () => {
        if (!currentGame || !getPhase3ReadyStates || !wallet.publicKey) return;
        if (isFetchingReadyStates.current) return;

        isFetchingReadyStates.current = true;

        try {
            const states = await getPhase3ReadyStates(currentGame.gameId);
            setReadyStates(states);

            const myState = states.find(s => s.player === wallet.publicKey?.toBase58());
            setIsReady(myState?.ready || false);

            console.log('✅ Ready states fetched:', states.length, 'players');
            console.log('✅ Ready count:', states.filter(s => s.ready).length);
        } catch (error) {
            console.error('❌ Error fetching ready states:', error);
        } finally {
            isFetchingReadyStates.current = false;
        }
    };

    const updateTimer = () => {
        if (!currentGame) return;

        const now = Date.now();
        let deadline: Date | null = null;

        const parseDeadline = (dl: any): Date | null => {
            if (!dl) return null;

            try {
                let date: Date;

                if (dl instanceof Date) {
                    date = dl;
                } else if (typeof dl === 'number') {
                    date = new Date(dl);
                } else if (typeof dl === 'string') {
                    date = new Date(dl);
                } else {
                    date = new Date(dl);
                }

                if (isNaN(date.getTime())) return null;

                // Reject dates before 2020 (likely uninitialized)
                if (date.getTime() < new Date('2020-01-01').getTime()) {
                    console.warn('⚠️ Deadline is before 2020, probably uninitialized:', date);
                    return null;
                }

                return date;
            } catch (error) {
                console.error('Failed to parse deadline:', error);
                return null;
            }
        };

        const extendedDeadline = parseDeadline(currentGame.phase3ExtendedDeadline);
        const readyDeadline = parseDeadline(currentGame.phase3ReadyDeadline);

        if (extendedDeadline && extendedDeadline.getTime() > now) {
            deadline = extendedDeadline;
            console.log('✅ Using extended deadline:', deadline.toISOString());
        } else if (readyDeadline && readyDeadline.getTime() > now) {
            deadline = readyDeadline;
            console.log('✅ Using ready deadline:', deadline.toISOString());
        } else if (readyDeadline) {
            deadline = readyDeadline;
            console.log('⏰ Using expired ready deadline:', deadline.toISOString());
        } else {
            console.warn('⚠️ No valid deadline found');
            setTimeRemaining('N/A');
            setCanAdvance(false);
            return;
        }

        const diff = deadline.getTime() - now;

        if (diff <= 0) {
            console.log('🔴 TIME EXPIRED!');
            setTimeRemaining('EXPIRED');
            setCanAdvance(true);

            if (!currentGame.phase3Started && !hasTriedAutoAdvance.current) {
                hasTriedAutoAdvance.current = true;

                console.log('🚀 Time expired - auto-advancing...');
                toast.info('⏰ Deadline expired! Starting Phase 3...', { duration: 2000 });

                setTimeout(async () => {
                    await handleStartGame();
                }, 2000);
            }
            return;
        }

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        if (hours > 0) {
            setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else {
            setTimeRemaining(`${minutes}m ${seconds}s`);
        }
        setCanAdvance(false);
    };

    const handleMarkReady = async () => {
        if (!currentGame || !markReadyPhase3) return;
        try {
            await retryTransaction(
                () => markReadyPhase3(currentGame.gameId),
                'Mark Ready Phase 3'
            );
            toast.success('✅ Marked as ready!');
            await fetchReadyStates();
        } catch (error: any) {
            console.error('Failed to mark ready:', error);
            toast.error(error.message || 'Failed to mark ready');
        }
    };

    const handleStartGame = async () => {
        if (!currentGame || !startPhase3Game) return;

        try {
            await retryTransaction(
                () => startPhase3Game(currentGame.gameId),
                'Start Phase 3 Game'
            );

            const readyCount = readyStates.filter(s => s.ready).length;
            const isExtended = !!currentGame.phase3ExtendedDeadline &&
                new Date(currentGame.phase3ExtendedDeadline).getTime() > new Date('2020-01-01').getTime();

            if (readyCount === 0) {
                toast.info(isExtended
                    ? '📊 Prize redistributed proportionally'
                    : '⏰ Deadline extended by 1 hour'
                );
                await solanaGame.refreshGames();

            } else if (readyCount === 1) {
                const winner = readyStates.find(s => s.ready);
                const prizeAmount = totalPrizePool * 0.99;

                toast.success(`🏆 Auto-winner: ${winner?.player.slice(0, 8)}...`);

                setTimeout(() => {
                    navigate(`/phase3/winner?gameId=${currentGame.gameId}&winner=${winner?.player}&prize=${prizeAmount}`);
                }, 2000);

            } else {
                toast.success('⚔️ THE PURGE BEGINS!');
                setRedirecting(true);

                setTimeout(() => {
                    setShowBattleGame(true);
                    setRedirecting(false);
                }, 1000);
            }
        } catch (error: any) {
            console.error('Failed to start Phase 3 game:', error);
            toast.error(error.message || 'Failed to start game');
        }
    };

    const handleBattleEnd = async (winnerAddress: string) => {
        if (!currentGame || !solanaGame) return;

        try {
            console.log('🏆 Submitting battle winner to blockchain:', winnerAddress);

            const winnerPubkey = new PublicKey(winnerAddress);
            await solanaGame.submitPhase3Winner(currentGame.gameId, winnerPubkey);

            setShowBattleGame(false);

            const prizeAmount = totalPrizePool * 0.99;

            toast.success('🎉 Winner declared on-chain!');

            setTimeout(() => {
                navigate(`/phase3/winner?gameId=${currentGame.gameId}&winner=${winnerAddress}&prize=${prizeAmount}`);
            }, 2000);

        } catch (error: any) {
            console.error('Failed to submit battle winner:', error);
            toast.error('Failed to declare winner on-chain');
        }
    };

    const handleClaimFee = async () => {
        if (!currentGame || !claimPlatformFee) return;
        try {
            await retryTransaction(
                () => claimPlatformFee(currentGame.gameId),
                'Claim Platform Fee'
            );
            toast.success('💰 Platform fee claimed!');
        } catch (error: any) {
            console.error('Failed to claim fee:', error);
            toast.error(error.message || 'Failed to claim fee');
        }
    };

    if (isInitializing || !program || wallet.connecting || !wallet.publicKey || !currentGame || gameId === null) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
                <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="pt-6 text-center">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-sol-orange" />
                        <p className="text-lg">
                            {!program
                                ? 'Initializing program...'
                                : wallet.connecting
                                    ? 'Connecting wallet...'
                                    : !wallet.publicKey
                                        ? 'Waiting for wallet...'
                                        : !games || games.length === 0
                                            ? 'Loading games...'
                                            : 'Loading Phase 3...'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const readyCount = readyStates.filter(s => s.ready).length;
    const totalPlayers = currentGame.currentPlayers;
    const isExtended = !!currentGame.phase3ExtendedDeadline &&
        new Date(currentGame.phase3ExtendedDeadline).getTime() > new Date('2020-01-01').getTime();
    const isCreator = wallet.publicKey?.toBase58() === currentGame.creator;

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <ParticleBackground />

            <div className="relative z-20">
                <Navbar />
            </div>

            {showBattleGame && currentGame && (
                <div className="fixed inset-0 z-50 bg-black">
                    <PurgeGameMultiplayer
                        gameId={currentGame.gameId}
                        readyPlayers={readyStates}
                        phase3Duration={currentGame.phases.phase3Duration}
                        onGameEnd={(winnerPubkey) => handleBattleEnd(winnerPubkey.toBase58())}
                    />
                </div>
            )}

            {redirecting && (
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-8xl mb-8 animate-pulse">⚔️</div>
                        <h2 className="text-6xl font-black bg-gradient-to-r from-red-600 via-red-400 to-orange-500 bg-clip-text text-transparent mb-4">
                            ENTERING ARENA
                        </h2>
                        <p className="text-2xl text-red-300">Prepare for battle...</p>
                    </div>
                </div>
            )}

            <main className="relative z-10 container mx-auto px-4 pt-24 pb-16">

                <div className="text-center mb-8">
                    <h1 className="text-5xl md:text-7xl font-display font-black mb-4">
                        <span className="gradient-text">⚔️ PHASE 3: THE PURGE</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground mb-6">
                        Mark yourself READY to participate in the final battle!
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 backdrop-blur-md">
                        <CardContent className="pt-6 text-center">
                            <Users className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                            <p className="text-sm text-muted-foreground mb-1">Total Players</p>
                            <p className="text-3xl font-bold text-blue-400">{totalPlayers}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30 backdrop-blur-md">
                        <CardContent className="pt-6 text-center">
                            <Target className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                            <p className="text-sm text-muted-foreground mb-1">Mini Games</p>
                            <p className="text-3xl font-bold text-purple-400">{totalMiniGamesPlayed}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30 backdrop-blur-md">
                        <CardContent className="pt-6 text-center">
                            <UserX className="w-8 h-8 mx-auto mb-2 text-red-400" />
                            <p className="text-sm text-muted-foreground mb-1">Eliminated</p>
                            <p className="text-3xl font-bold text-red-400">{totalEliminated}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30 backdrop-blur-md">
                        <CardContent className="pt-6 text-center">
                            <Coins className="w-8 h-8 mx-auto mb-2 text-green-400" />
                            <p className="text-sm text-muted-foreground mb-1">Prize Pool</p>
                            <p className="text-3xl font-bold text-green-400">{totalPrizePool.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">SOL</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/30 backdrop-blur-md">
                        <CardContent className="pt-6 text-center">
                            <Wallet className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
                            <p className="text-sm text-muted-foreground mb-1">Virtual Balance</p>
                            <p className="text-3xl font-bold text-cyan-400">{totalVirtualBalance.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">SOL</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/30 backdrop-blur-md">
                        <CardContent className="pt-6 text-center">
                            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                            <p className="text-sm text-muted-foreground mb-1">Ready</p>
                            <p className="text-3xl font-bold text-yellow-400">{readyCount}/{totalPlayers}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="mb-8 border-2 border-red-600 bg-gradient-to-r from-red-900/30 to-orange-900/20 backdrop-blur-md">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Clock className="w-8 h-8 text-red-400" />
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        {isExtended ? 'Extended Deadline' : 'Ready Deadline'}
                                    </p>
                                    <p className="text-xl font-bold">
                                        {canAdvance ? 'TIME EXPIRED!' : 'Time Remaining'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className={`text-5xl font-mono font-black ${canAdvance ? 'text-red-500 animate-pulse' : 'text-red-400'
                                    }`}>
                                    {timeRemaining}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {currentGame.phase3Started && !showBattleGame && readyCount >= 2 && (
                    <Card className="mb-8 border-2 border-green-600 bg-gradient-to-r from-green-900/30 to-emerald-900/20 backdrop-blur-md animate-pulse">
                        <CardContent className="p-6 text-center">
                            <div className="text-6xl mb-4">⚔️</div>
                            <h3 className="text-3xl font-bold text-green-400 mb-4">
                                THE PURGE IS ACTIVE!
                            </h3>
                            <p className="text-xl text-gray-300 mb-6">
                                {readyCount} warriors are battling in the arena right now!
                            </p>
                            <Button
                                onClick={() => {
                                    console.log('🔧 Manual join battle clicked');
                                    hasTriedAutoAdvance.current = true;
                                    setRedirecting(true);
                                    setTimeout(() => {
                                        setShowBattleGame(true);
                                        setRedirecting(false);
                                    }, 1000);
                                }}
                                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 py-8 px-12 text-2xl font-black"
                                size="lg"
                            >
                                💀 JOIN THE BATTLE NOW 💀
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <div className="grid lg:grid-cols-3 gap-8 mb-8">

                    <Card className="lg:col-span-2 border-2 border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-2xl">
                                <Users className="w-6 h-6" />
                                Players Status
                                <Badge variant="secondary" className="ml-auto">
                                    {readyCount} / {totalPlayers} Ready
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {currentGame.players.length === 0 ? (
                                <div className="text-center text-gray-400 py-12">
                                    <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg">No players yet...</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {currentGame.players.map((playerAddr, index) => {
                                        const playerReady = readyStates.find(s => s.player === playerAddr);
                                        const isCurrentUser = playerAddr === wallet.publicKey?.toBase58();

                                        return (
                                            <div
                                                key={playerAddr}
                                                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${isCurrentUser
                                                    ? 'border-sol-orange bg-sol-orange/10'
                                                    : playerReady?.ready
                                                        ? 'border-green-500/50 bg-green-500/10'
                                                        : 'border-gray-700 bg-gray-800/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-3 h-3 rounded-full ${playerReady?.ready ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                                                        }`} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-mono text-sm font-bold">
                                                                {playerAddr.slice(0, 8)}...{playerAddr.slice(-6)}
                                                            </p>
                                                            {isCurrentUser && (
                                                                <Badge variant="default" className="text-xs">YOU</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Player #{index + 1}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    {playerReady?.ready ? (
                                                        <Badge variant="default" className="bg-green-600">
                                                            ✓ READY
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-gray-700">
                                                            Waiting...
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {!currentGame.phase3Started && !canAdvance && (
                            <Card className="border-2 border-blue-600 bg-gradient-to-br from-blue-900/30 to-blue-800/20 backdrop-blur-md">
                                <CardContent className="pt-6">
                                    <Button
                                        onClick={handleMarkReady}
                                        disabled={loading || isReady}
                                        className={`w-full py-8 text-xl font-bold ${isReady
                                            ? 'bg-green-600 hover:bg-green-600 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                        size="lg"
                                    >
                                        {isReady ? (
                                            <>
                                                <CheckCircle className="w-6 h-6 mr-2" />
                                                YOU ARE READY
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-6 h-6 mr-2" />
                                                MARK READY
                                            </>
                                        )}
                                    </Button>
                                    {isReady && (
                                        <Alert className="mt-4 border-green-500/50 bg-green-500/10">
                                            <CheckCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                You're ready! Wait for others or deadline to expire.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {canAdvance && !currentGame.phase3Started && (
                            <Card className="border-2 border-red-600 bg-gradient-to-br from-red-900/30 to-red-800/20 backdrop-blur-md">
                                <CardContent className="pt-6 space-y-4">
                                    <Button
                                        onClick={handleStartGame}
                                        disabled={loading}
                                        className="w-full bg-red-600 hover:bg-red-700 py-8 text-xl font-bold"
                                        size="lg"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                                                Starting...
                                            </>
                                        ) : (
                                            <>
                                                🚀 START PHASE 3
                                            </>
                                        )}
                                    </Button>

                                    <Alert className="bg-yellow-900/30 border-yellow-600">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>What happens next:</AlertTitle>
                                        <AlertDescription className="text-sm mt-2">
                                            {readyCount === 0 && !isExtended && '⏰ Deadline will be extended by 1 hour'}
                                            {readyCount === 0 && isExtended && '📊 Prize will be redistributed proportionally'}
                                            {readyCount === 1 && '🏆 Auto-winner! Only 1 player ready'}
                                            {readyCount >= 2 && `🎮 Game starts with ${readyCount} ready players`}
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-lg">ℹ️ Phase 3 Rules</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground space-y-2">
                                <p>• Mark yourself READY within {isExtended ? '1 hour' : '30 minutes'}</p>
                                <p>• If 0 players ready → Deadline extends by 1 hour</p>
                                <p>• If 1 player ready → Auto-winner declared</p>
                                <p>• If 2+ players ready → Battle begins!</p>
                                <p>• Winner takes 99% of prize pool</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {currentGame.phase3Winner && (
                    <Card className="mb-8 border-2 border-yellow-500 bg-gradient-to-r from-yellow-600/30 to-yellow-800/20 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="text-4xl flex items-center gap-3">
                                <Trophy className="w-10 h-10 text-yellow-400" />
                                WINNER DECLARED!
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-4">
                            <p className="font-mono text-2xl font-bold">
                                {currentGame.phase3Winner.slice(0, 12)}...{currentGame.phase3Winner.slice(-8)}
                            </p>
                            <div className="text-3xl font-black text-yellow-400">
                                💰 Prize: {(totalPrizePool * 0.99).toFixed(4)} SOL
                            </div>
                            <p className="text-sm text-yellow-200">
                                (After 1% platform fee deduction)
                            </p>
                        </CardContent>
                    </Card>
                )}

                {isCreator && currentGame.platformFeeCollected > 0 && (
                    <Card className="mb-8 border-purple-600 bg-gradient-to-br from-purple-900/30 to-purple-800/20 backdrop-blur-md">
                        <CardContent className="pt-6">
                            <Button
                                onClick={handleClaimFee}
                                disabled={loading}
                                className="w-full bg-purple-600 hover:bg-purple-700 py-6 text-lg font-bold"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Claiming...
                                    </>
                                ) : (
                                    <>
                                        💰 Claim Platform Fee ({(currentGame.platformFeeCollected / 1e9).toFixed(4)} SOL)
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/lobby')}
                        className="flex-1"
                        size="lg"
                    >
                        ← Back to Lobby
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => navigate('/profile')}
                        className="flex-1"
                        size="lg"
                    >
                        View Profile →
                    </Button>
                </div>
            </main>

            <Footer />

            <style>{`
            .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(255, 130, 0, 0.5);
                border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 130, 0, 0.7);
            }
        `}</style>
        </div>
    );
};

export default Phase3;