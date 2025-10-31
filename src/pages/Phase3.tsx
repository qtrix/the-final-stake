// src/pages/Phase3.tsx - Complete Phase 3 Page with REDUCED POLLING
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Clock, Users, Trophy, AlertCircle, CheckCircle, Loader2,
    Target, Zap, Coins, UserX, Wallet, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PurgeGameMultiplayer from '@/pages/PurgeGameMultiplayer';
import { wsManager } from '@/utils/websocketManager';
import { retryTransaction } from '@/utils/transactionHelper';


const Phase3 = () => {
    const navigate = useNavigate();
    const wallet = useWallet();
    const solanaGame = useSolanaGame();

    const {
        program,
        games,
        getPhase3ReadyStates,
        markReadyPhase3,
        startPhase3Game,
    } = solanaGame;

    const [gameId, setGameId] = useState<number | null>(null);
    const [currentGame, setCurrentGame] = useState<any>(null);
    const [readyStates, setReadyStates] = useState<Array<{ player: string; ready: boolean }>>([]);
    const [isReady, setIsReady] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState('Calculating...');
    const [canAdvance, setCanAdvance] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [showBattleGame, setShowBattleGame] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [serverGamePhase, setServerGamePhase] = useState<'waiting' | 'countdown' | 'active' | 'ended'>('waiting');
    const [hasTriggeredAutoStart, setHasTriggeredAutoStart] = useState(false);

    const [totalMiniGamesPlayed, setTotalMiniGamesPlayed] = useState(0);
    const [totalEliminated, setTotalEliminated] = useState(0);
    const [totalPrizePool, setTotalPrizePool] = useState(0);
    const [totalVirtualBalance, setTotalVirtualBalance] = useState(0);

    const isFetchingReadyStates = useRef(false);
    const autoStartTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!wallet.publicKey || !gameId) return;

        const playerId = wallet.publicKey.toBase58();

        console.log('[Phase3] Connecting to WebSocket...');

        const handlersId = `phase3-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        wsManager.connect(gameId.toString(), playerId, handlersId, {
            onConnected: () => {
                console.log('[Phase3] WebSocket connected');
                setWsConnected(true);
                toast.success('Connected to game server');

                // ✅ ADAUGĂ AICI: Trimite prize amount la server
                if (currentGame) {
                    const prizeAmount = currentGame.entryFee * currentGame.players.length * 0.99;
                    wsManager.send({
                        type: 'set_prize_amount',
                        gameId: gameId.toString(),
                        prizeAmount
                    });
                    console.log('[Phase3] 💰 Sent prize amount to server:', prizeAmount);
                }
            },
            onDisconnected: () => {
                console.log('[Phase3] WebSocket disconnected');
                setWsConnected(false);
            },
            onGamePhaseChange: (phase) => {
                console.log('[Phase3] Server game phase:', phase);
                setServerGamePhase(phase);

                if (phase === 'countdown') {
                    toast.info('⚔️ Battle countdown started!', { duration: 3000 });
                    setRedirecting(true);
                    setTimeout(() => {
                        setShowBattleGame(true);
                        setRedirecting(false);
                    }, 1000);
                } else if (phase === 'active') {
                    if (!showBattleGame) {
                        setShowBattleGame(true);
                    }
                }
            }
        });

        return () => {
            console.log('[Phase3] Unregistering WebSocket handlers');
            wsManager.unregisterHandler(handlersId);
        };
    }, [wallet.publicKey, gameId, showBattleGame, currentGame]);

    useEffect(() => {
        if (!program) {
            setIsInitializing(true);
            return;
        }

        if (wallet.connecting) {
            setIsInitializing(true);
            return;
        }

        setIsInitializing(false);

        if (!wallet.publicKey) {
            navigate('/');
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const gameIdParam = params.get('gameId');

        if (!gameIdParam) {
            toast.error('No game ID provided');
            navigate('/lobby');
            return;
        }

        const parsedGameId = parseInt(gameIdParam);
        setGameId(parsedGameId);
    }, [program, wallet.connecting, wallet.publicKey, navigate]);

    useEffect(() => {
        if (gameId === null || !games || games.length === 0) return;

        const game = games.find(g => g.gameId === gameId);
        if (game) {
            setCurrentGame(game);

            if (game.currentPhase !== 3) {
                toast.info(`Game is in Phase ${game.currentPhase}, not Phase 3`);
                navigate('/lobby');
            }
        } else {
            toast.error(`Game ${gameId} not found`);
            navigate('/lobby');
        }
    }, [gameId, games, navigate]);

    // ✅ FIXED: Calculate stats ONCE, not repeatedly
    useEffect(() => {
        if (!currentGame) return;

        const calculateStats = async () => {
            try {
                const eliminated = currentGame.maxPlayers - currentGame.currentPlayers;
                setTotalEliminated(eliminated);

                const prizePool = currentGame.entryFee * currentGame.players.length;
                setTotalPrizePool(prizePool);

                // ✅ Simple calculation instead of fetching balance for each player
                const totalVirtual = prizePool * 10;
                setTotalVirtualBalance(totalVirtual);

                let totalGames = 0;
                try {
                    if (currentGame.phase1GamesPlayed !== undefined) {
                        totalGames = currentGame.phase1GamesPlayed;
                    } else if (currentGame.miniGamesPlayed !== undefined) {
                        totalGames = currentGame.miniGamesPlayed;
                    } else {
                        totalGames = 0;
                    }
                } catch {
                    totalGames = 0;
                }
                setTotalMiniGamesPlayed(totalGames);
            } catch (error) {
                console.error('Error calculating stats:', error);
            }
        };

        calculateStats();
    }, [currentGame?.gameId]); // ✅ Only when gameId changes

    // ✅ FIXED: Fetch ready states less frequently
    const fetchReadyStates = async () => {
        if (!currentGame || !getPhase3ReadyStates || !wallet.publicKey) return;
        if (isFetchingReadyStates.current) return;

        // ✅ Don't fetch if game already started
        if (currentGame.phase3Started || showBattleGame) {
            console.log('[Phase3] Game started, skipping ready states fetch');
            return;
        }

        isFetchingReadyStates.current = true;

        try {
            const states = await getPhase3ReadyStates(currentGame.gameId);
            setReadyStates(states);

            const myState = states.find(s => s.player === wallet.publicKey?.toBase58());
            setIsReady(myState?.ready || false);

            console.log('[Phase3] Ready states:', states.filter(s => s.ready).length, '/', states.length);
        } catch (error) {
            console.error('[Phase3] Error fetching ready states:', error);
        } finally {
            isFetchingReadyStates.current = false;
        }
    };

    // ✅ FIXED: Poll every 30 seconds instead of 5 seconds
    useEffect(() => {
        if (!currentGame || currentGame.currentPhase !== 3) return;
        if (currentGame.phase3Started || showBattleGame) return; // ✅ Don't poll if game started

        fetchReadyStates();
        const interval = setInterval(fetchReadyStates, 30000); // ✅ 30 seconds instead of 5

        return () => clearInterval(interval);
    }, [currentGame?.gameId, currentGame?.currentPhase, currentGame?.phase3Started, showBattleGame]);

    useEffect(() => {
        if (!currentGame) return;

        if (currentGame.phase3Started && !showBattleGame && !redirecting) {
            console.log('[Phase3] 🚨 Phase 3 already started! Force redirecting to battle game...');

            toast.info('⚔️ Battle in progress! Joining now...', { duration: 2000 });

            setRedirecting(true);

            setTimeout(() => {
                console.log('[Phase3] 🎮 Showing battle game NOW');
                setShowBattleGame(true);
                setRedirecting(false);
            }, 1500);
        }
    }, [currentGame?.phase3Started, showBattleGame, redirecting]);

    const updateTimer = () => {
        if (!currentGame) return;

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

                if (date.getTime() < new Date('2020-01-01').getTime()) {
                    return null;
                }

                return date;
            } catch (error) {
                return null;
            }
        };

        const now = Date.now();
        const extendedDeadline = parseDeadline(currentGame.phase3ExtendedDeadline);
        const readyDeadline = parseDeadline(currentGame.phase3ReadyDeadline);

        let deadline: Date | null = null;

        if (extendedDeadline && extendedDeadline.getTime() > now) {
            deadline = extendedDeadline;
        } else if (readyDeadline && readyDeadline.getTime() > now) {
            deadline = readyDeadline;
        } else if (readyDeadline) {
            deadline = readyDeadline;
        } else {
            setTimeRemaining('N/A');
            setCanAdvance(false);
            return;
        }

        const diff = deadline.getTime() - now;

        if (diff <= 0) {
            setTimeRemaining('EXPIRED');
            setCanAdvance(true);
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);

        const readyCount = readyStates.filter(s => s.ready).length;
        setCanAdvance(diff <= 0 && readyCount >= 2);
    };

    useEffect(() => {
        if (!currentGame || currentGame.currentPhase !== 3) return;

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [currentGame, readyStates]);

    useEffect(() => {
        if (!currentGame || currentGame.currentPhase !== 3) return;
        if (!wsConnected) return;

        const checkDeadline = () => {
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
                    if (date.getTime() < new Date('2020-01-01').getTime()) return null;
                    return date;
                } catch (error) {
                    return null;
                }
            };

            const extendedDeadline = parseDeadline(currentGame.phase3ExtendedDeadline);
            const readyDeadline = parseDeadline(currentGame.phase3ReadyDeadline);

            if (extendedDeadline && extendedDeadline.getTime() > now) {
                deadline = extendedDeadline;
            } else if (readyDeadline && readyDeadline.getTime() > now) {
                deadline = readyDeadline;
            }

            if (deadline) {
                wsManager.send({
                    type: 'set_deadline',
                    gameId: currentGame.gameId.toString(),
                    deadline: deadline.getTime()
                });

                const timeUntilDeadline = deadline.getTime() - now;

                if (timeUntilDeadline > 0 && timeUntilDeadline <= 2000) {
                    const readyCount = readyStates.filter(s => s.ready).length;

                    if (readyCount >= 2 && !currentGame.phase3Started) {
                        console.log('[Phase3] ⏰ Deadline expired - Auto-starting game');

                        setTimeout(() => {
                            if (startPhase3Game) {
                                handleStartGame();
                            }
                        }, timeUntilDeadline + 100);
                    }
                }
            }
        };

        checkDeadline();
        const interval = setInterval(checkDeadline, 1000);

        return () => clearInterval(interval);
    }, [currentGame, wsConnected, readyStates, startPhase3Game]);

    useEffect(() => {
        if (!currentGame || !readyStates.length) return;
        if (currentGame.phase3Started) return;
        if (!wsConnected) return;
        if (hasTriggeredAutoStart) return;

        const readyCount = readyStates.filter(s => s.ready).length;
        const totalPlayers = currentGame.currentPlayers;

        if (readyCount === totalPlayers && totalPlayers > 0) {
            console.log(`[Phase3] 🎮 ALL PLAYERS READY! (${readyCount}/${totalPlayers}) - TRIGGERING AUTO-START`);

            const now = Date.now();
            let deadline: Date | null = null;

            const parseDeadline = (dl: any): Date | null => {
                if (!dl) return null;
                try {
                    let date: Date;
                    if (dl instanceof Date) date = dl;
                    else if (typeof dl === 'number') date = new Date(dl);
                    else if (typeof dl === 'string') date = new Date(dl);
                    else date = new Date(dl);
                    if (isNaN(date.getTime())) return null;
                    if (date.getTime() < new Date('2020-01-01').getTime()) return null;
                    return date;
                } catch { return null; }
            };

            const extendedDeadline = parseDeadline(currentGame.phase3ExtendedDeadline);
            const readyDeadline = parseDeadline(currentGame.phase3ReadyDeadline);

            if (extendedDeadline && extendedDeadline.getTime() > now) {
                deadline = extendedDeadline;
            } else if (readyDeadline && readyDeadline.getTime() > now) {
                deadline = readyDeadline;
            }

            const timeUntilDeadline = deadline ? Math.ceil((deadline.getTime() - now) / 1000) : 0;

            setHasTriggeredAutoStart(true);

            if (timeUntilDeadline > 0) {
                toast.success(`🎮 All ${totalPlayers} players ready! Starting when deadline expires in ${timeUntilDeadline}s...`, {
                    duration: 5000,
                    icon: '⚔️'
                });
            } else {
                toast.success(`🎮 All ${totalPlayers} players ready! Starting now...`, {
                    duration: 3000,
                    icon: '⚔️'
                });
            }
        }
    }, [readyStates, currentGame?.currentPlayers, currentGame?.phase3Started, wsConnected, hasTriggeredAutoStart, currentGame?.phase3ExtendedDeadline, currentGame?.phase3ReadyDeadline]);

    useEffect(() => {
        if (!hasTriggeredAutoStart) return;
        if (!currentGame || !startPhase3Game) return;

        const now = Date.now();
        let deadline: Date | null = null;

        const parseDeadline = (dl: any): Date | null => {
            if (!dl) return null;
            try {
                let date: Date;
                if (dl instanceof Date) date = dl;
                else if (typeof dl === 'number') date = new Date(dl);
                else if (typeof dl === 'string') date = new Date(dl);
                else date = new Date(dl);

                if (isNaN(date.getTime())) return null;
                if (date.getTime() < new Date('2020-01-01').getTime()) return null;
                return date;
            } catch {
                return null;
            }
        };

        const extendedDeadline = parseDeadline(currentGame.phase3ExtendedDeadline);
        const readyDeadline = parseDeadline(currentGame.phase3ReadyDeadline);

        if (extendedDeadline && extendedDeadline.getTime() > now) {
            deadline = extendedDeadline;
        } else if (readyDeadline && readyDeadline.getTime() > now) {
            deadline = readyDeadline;
        }

        if (!deadline) {
            console.log('[Phase3] ❌ No valid deadline found, cannot auto-start');
            setHasTriggeredAutoStart(false);
            return;
        }

        const timeUntilDeadline = deadline.getTime() - now;
        const waitTime = Math.max(timeUntilDeadline + 500, 1000);

        console.log(`[Phase3] ⏱️ Starting countdown... waiting ${(waitTime / 1000).toFixed(1)} seconds until deadline`);

        const countdownTimer = setTimeout(async () => {
            console.log('[Phase3] 🚀 Deadline passed! Auto-starting game NOW...');

            try {
                console.log('[Phase3] 📞 Calling startPhase3Game...');
                await retryTransaction(
                    () => startPhase3Game(currentGame.gameId),
                    'Auto-Start Phase 3 Game',
                    3 // maxRetries
                );

                console.log('[Phase3] 📡 Sending WebSocket start_game...');
                wsManager.send({
                    type: 'start_game',
                    gameId: currentGame.gameId.toString()
                });

                toast.success('⚔️ Phase 3 Started!');
                console.log('[Phase3] ✅ Auto-start SUCCESS!');

                console.log('[Phase3] 🎮 Forcing redirect to battle game...');
                setRedirecting(true);

                setTimeout(() => {
                    console.log('[Phase3] 🎮 Showing battle game NOW');
                    setShowBattleGame(true);
                    setRedirecting(false);
                }, 2000);

            } catch (error: any) {
                console.error('[Phase3] ❌ Auto-start FAILED:', error);
                toast.error(error.message || 'Failed to auto-start game');
                setHasTriggeredAutoStart(false);
            }
        }, waitTime);

        console.log('[Phase3] ✅ Countdown timer set');

        return () => {
            console.log('[Phase3] 🧹 Component unmounting, clearing countdown');
            clearTimeout(countdownTimer);
        };
    }, [hasTriggeredAutoStart, currentGame?.gameId, currentGame?.phase3ExtendedDeadline, currentGame?.phase3ReadyDeadline, startPhase3Game]);

    const handleMarkReady = async () => {
        if (!currentGame || !markReadyPhase3) return;

        setLoading(true);

        try {
            await retryTransaction(
                () => markReadyPhase3(currentGame.gameId),
                'Mark Ready Phase 3',
                3 // maxRetries
            );

            wsManager.send({
                type: 'mark_ready',
                gameId: currentGame.gameId.toString()
            });

            toast.success('✅ Marked as ready!');
            await fetchReadyStates();
        } catch (error: any) {
            console.error('Failed to mark ready:', error);
            toast.error(error.message || 'Failed to mark ready');
        } finally {
            setLoading(false);
        }
    };

    const handleStartGame = async () => {
        if (!currentGame || !startPhase3Game) return;

        setLoading(true);

        try {
            await retryTransaction(
                () => startPhase3Game(currentGame.gameId),
                'Start Phase 3 Game',
                3 // maxRetries
            );

            await solanaGame.refreshGames();

            wsManager.send({
                type: 'start_game',
                gameId: currentGame.gameId.toString()
            });

            toast.success('⚔️ Starting Phase 3...');

            console.log('[Phase3] 🎮 Manual start - forcing redirect to battle game...');
            setRedirecting(true);

            setTimeout(() => {
                console.log('[Phase3] 🎮 Showing battle game NOW');
                setShowBattleGame(true);
                setRedirecting(false);
            }, 2000);

        } catch (error: any) {
            console.error('Failed to start Phase 3 game:', error);
            toast.error(error.message || 'Failed to start game');
            setHasTriggeredAutoStart(false);
        } finally {
            setLoading(false);
        }
    };

    const handleBattleEnd = async (winnerAddress: string) => {
        if (!currentGame || !solanaGame) return;
        console.log('[Phase3] Winner:', winnerAddress);
        // try {
        //     console.log('[Phase3] Submitting battle winner:', winnerAddress);

        //     const winnerPubkey = new PublicKey(winnerAddress);
        //     await solanaGame.submitPhase3Winner(currentGame.gameId, winnerPubkey);

        //     toast.success('🏆 Winner submitted to blockchain!');

        //     const prizeAmount = (totalPrizePool * 0.99).toFixed(4);

        //     setTimeout(() => {
        //         navigate(`/phase3/winner?gameId=${currentGame.gameId}&winner=${winnerAddress}&prize=${prizeAmount}`);
        //     }, 2000);

        // } catch (error: any) {
        //     console.error('Failed to submit winner:', error);
        //     toast.error(error.message || 'Failed to submit winner');
        // }
    };

    if (showBattleGame && currentGame) {
        return (
            <PurgeGameMultiplayer
                gameId={currentGame.gameId.toString()}
                prizePool={totalPrizePool}
                onGameEnd={handleBattleEnd}
            />
        );
    }

    if (redirecting) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
                <ParticleBackground />
                <div className="text-center z-10">
                    <div className="text-8xl mb-8 animate-pulse">⚔️</div>
                    <h1 className="text-5xl font-bold mb-4">Entering Battle Arena...</h1>
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-red-500" />
                </div>
            </div>
        );
    }

    if (isInitializing || !program || wallet.connecting || !wallet.publicKey || !currentGame || gameId === null) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
                <ParticleBackground />
                <div className="text-center z-10">
                    <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-red-500" />
                    <p className="text-xl">Loading Phase 3...</p>
                </div>
            </div>
        );
    }

    const readyCount = readyStates.filter(s => s.ready).length;
    const totalPlayers = currentGame.currentPlayers;
    const isExtended = !!currentGame.phase3ExtendedDeadline &&
        new Date(currentGame.phase3ExtendedDeadline).getTime() > new Date('2020-01-01').getTime();
    const isCreator = wallet.publicKey?.toBase58() === currentGame.creator;
    const allPlayersReady = readyCount === totalPlayers && totalPlayers > 0;

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <ParticleBackground />

            <div className="fixed inset-0 bg-gradient-to-b from-transparent via-red-900/10 to-black/30 pointer-events-none"></div>

            <Navbar />

            <main className="container mx-auto px-4 py-8 relative z-10">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12 pt-20">
                        <h1 className="text-5xl md:text-7xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500">
                            FINAL BATTLE
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground mb-6">
                            Mark yourself READY to participate in the final battle!
                        </p>

                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${wsConnected
                            ? 'bg-green-900/30 border border-green-600'
                            : 'bg-red-900/30 border border-red-600'
                            }`}>
                            {wsConnected ? (
                                <>
                                    <Wifi className="w-5 h-5 text-green-400 animate-pulse" />
                                    <span className="text-green-300 font-semibold">Connected to Server</span>
                                </>
                            ) : (
                                <>
                                    <WifiOff className="w-5 h-5 text-red-400" />
                                    <span className="text-red-300 font-semibold">Connecting...</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                        <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-600/50 backdrop-blur-md">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                                    <div>
                                        <p className="text-xs text-blue-300 uppercase tracking-wider">Players Ready</p>
                                        <p className="text-2xl md:text-3xl font-bold text-blue-400">
                                            {readyCount}/{totalPlayers}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border-yellow-600/50 backdrop-blur-md">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Trophy className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
                                    <div>
                                        <p className="text-xs text-yellow-300 uppercase tracking-wider">Prize Pool</p>
                                        <p className="text-2xl md:text-3xl font-bold text-yellow-400">
                                            {totalPrizePool.toFixed(4)} SOL
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-red-900/30 to-red-800/20 border-red-600/50 backdrop-blur-md">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <UserX className="w-6 h-6 md:w-8 md:h-8 text-red-400" />
                                    <div>
                                        <p className="text-xs text-red-300 uppercase tracking-wider">Eliminated</p>
                                        <p className="text-2xl md:text-3xl font-bold text-red-400">
                                            {totalEliminated}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-600/50 backdrop-blur-md">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Target className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
                                    <div>
                                        <p className="text-xs text-green-300 uppercase tracking-wider">Mini-Games</p>
                                        <p className="text-2xl md:text-3xl font-bold text-green-400">
                                            {totalMiniGamesPlayed}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-600/50 backdrop-blur-md">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Wallet className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />
                                    <div>
                                        <p className="text-xs text-purple-300 uppercase tracking-wider">Virtual Balance</p>
                                        <p className="text-2xl md:text-3xl font-bold text-purple-400">
                                            {totalVirtualBalance.toFixed(4)} SOL
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 border-orange-600/50 backdrop-blur-md">
                            <CardContent className="p-4 md:p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Coins className="w-6 h-6 md:w-8 md:h-8 text-orange-400" />
                                    <div>
                                        <p className="text-xs text-orange-300 uppercase tracking-wider">Winner Prize</p>
                                        <p className="text-2xl md:text-3xl font-bold text-orange-400">
                                            {(totalPrizePool * 0.99).toFixed(4)} SOL
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="border-2 border-red-600 bg-gradient-to-br from-red-900/30 to-red-800/20 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    <Clock className="w-6 h-6 text-red-400" />
                                    Time Remaining
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center">
                                    <p className={`text-5xl font-mono font-black ${canAdvance ? 'text-red-500 animate-pulse' : 'text-red-400'}`}>
                                        {timeRemaining}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-2 border-blue-600 bg-gradient-to-br from-blue-900/30 to-blue-800/20 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    <Users className="w-6 h-6 text-blue-400" />
                                    Players ({readyCount}/{totalPlayers})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {currentGame.players.map((playerAddr: string) => {
                                        const playerReady = readyStates.find(s => s.player === playerAddr);
                                        const isMe = playerAddr === wallet.publicKey?.toBase58();

                                        return (
                                            <div
                                                key={playerAddr}
                                                className={`p-3 rounded-lg border transition-all ${isMe
                                                    ? 'bg-blue-600/20 border-blue-500'
                                                    : 'bg-muted/50 border-border/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-3 h-3 rounded-full ${playerReady?.ready ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-mono text-sm font-bold">
                                                                {playerAddr.slice(0, 8)}...{playerAddr.slice(-8)}
                                                            </p>
                                                            {isMe && (
                                                                <Badge className="bg-blue-600 text-white text-xs">YOU</Badge>
                                                            )}
                                                        </div>
                                                        <p className={`text-xs ${playerReady?.ready ? 'text-green-400' : 'text-muted-foreground'
                                                            }`}>
                                                            {playerReady?.ready ? '✓ Ready' : '○ Not Ready'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {allPlayersReady && !currentGame.phase3Started && serverGamePhase === 'waiting' && (
                        <Card className="mt-6 border-2 border-green-600 bg-gradient-to-r from-green-900/40 to-emerald-900/30 backdrop-blur-md animate-pulse">
                            <CardContent className="p-6 text-center">
                                <div className="flex items-center justify-center gap-4">
                                    <CheckCircle className="w-10 h-10 text-green-400 animate-bounce" />
                                    <div>
                                        <p className="text-3xl font-black text-green-300">
                                            🎮 ALL PLAYERS READY!
                                        </p>
                                        <p className="text-lg text-green-200 mt-2">
                                            {timeRemaining !== 'EXPIRED' && timeRemaining !== 'N/A'
                                                ? `Auto-starting when deadline expires (${timeRemaining})...`
                                                : 'Auto-starting now...'}
                                        </p>
                                    </div>
                                    <CheckCircle className="w-10 h-10 text-green-400 animate-bounce" />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {serverGamePhase !== 'waiting' && (
                        <Card className="mt-6 border-2 border-orange-600 bg-gradient-to-r from-orange-900/30 to-yellow-900/20 backdrop-blur-md">
                            <CardContent className="p-6 text-center">
                                <div className="flex items-center justify-center gap-4">
                                    <Zap className="w-8 h-8 text-orange-400 animate-pulse" />
                                    <div>
                                        <p className="text-2xl font-bold text-orange-300">
                                            Server Status: {serverGamePhase.toUpperCase()}
                                        </p>
                                        <p className="text-sm text-orange-200 mt-1">
                                            {serverGamePhase === 'countdown' && 'Battle starting soon...'}
                                            {serverGamePhase === 'active' && 'Battle in progress!'}
                                            {serverGamePhase === 'ended' && 'Battle concluded'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="mt-6 space-y-4">
                        {currentGame.phase3Started && !showBattleGame && (
                            <Card className="border-2 border-orange-600 bg-gradient-to-br from-orange-900/40 to-red-900/30 backdrop-blur-md animate-pulse">
                                <CardContent className="pt-6 space-y-4">
                                    <Button
                                        onClick={() => {
                                            console.log('[Phase3] 🎮 Manual join battle clicked');
                                            setRedirecting(true);
                                            setTimeout(() => {
                                                setShowBattleGame(true);
                                                setRedirecting(false);
                                            }, 1000);
                                        }}
                                        className="w-full bg-orange-600 hover:bg-orange-700 py-8 text-xl font-bold"
                                        size="lg"
                                    >
                                        ⚔️ JOIN BATTLE NOW!
                                    </Button>

                                    <Alert className="bg-orange-900/30 border-orange-600">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Battle Already Started!</AlertTitle>
                                        <AlertDescription className="text-sm mt-2">
                                            The Phase 3 battle is already in progress. Click above to join immediately!
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        )}

                        {serverGamePhase === 'waiting' && !canAdvance && !currentGame.phase3Started && (
                            <Card className="border-2 border-blue-600 bg-gradient-to-br from-blue-900/30 to-blue-800/20 backdrop-blur-md">
                                <CardContent className="pt-6">
                                    <Button
                                        onClick={handleMarkReady}
                                        disabled={loading || isReady || !wsConnected}
                                        className={`w-full py-8 text-xl font-bold ${isReady
                                            ? 'bg-green-600 hover:bg-green-600 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                        size="lg"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : isReady ? (
                                            <>
                                                <CheckCircle className="w-6 h-6 mr-2" />
                                                ✓ You are READY
                                            </>
                                        ) : (
                                            <>
                                                <Target className="w-6 h-6 mr-2" />
                                                Mark as READY
                                            </>
                                        )}
                                    </Button>

                                    {isReady && (
                                        <Alert className="mt-4 border-green-500/50 bg-green-500/10">
                                            <CheckCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                You're ready! Waiting for other players...
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {!wsConnected && (
                                        <Alert className="mt-4 border-red-500/50 bg-red-500/10">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                Connecting to game server...
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {(canAdvance || allPlayersReady) && serverGamePhase === 'waiting' && !currentGame.phase3Started && (
                            <Card className="border-2 border-red-600 bg-gradient-to-br from-red-900/30 to-red-800/20 backdrop-blur-md">
                                <CardContent className="pt-6 space-y-4">
                                    <Button
                                        onClick={handleStartGame}
                                        disabled={loading || !wsConnected}
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
                                                🚀 START PHASE 3 NOW
                                            </>
                                        )}
                                    </Button>

                                    <Alert className="bg-yellow-900/30 border-yellow-600">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Manual Start Available:</AlertTitle>
                                        <AlertDescription className="text-sm mt-2">
                                            {allPlayersReady && !canAdvance && '🎮 All players ready! You can start immediately or wait for auto-start.'}
                                            {canAdvance && readyCount === 0 && !isExtended && '⏰ Deadline expired - This will extend deadline by 1 hour'}
                                            {canAdvance && readyCount === 0 && isExtended && '📊 No players ready - Prize will be redistributed'}
                                            {canAdvance && readyCount === 1 && '🏆 Only 1 player ready - They win automatically!'}
                                            {canAdvance && readyCount >= 2 && `⚔️ ${readyCount} players ready - Battle starts!`}
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <Card className="mt-6 border-2 border-purple-600 bg-gradient-to-br from-purple-900/30 to-purple-800/20 backdrop-blur-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-purple-400" />
                                Phase 3 Rules
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p>• Mark yourself READY within {isExtended ? '1 hour' : '30 minutes'}</p>
                            <p>• If ALL players ready → Game auto-starts when deadline expires!</p>
                            <p>• If 0 players ready → Deadline extends by 1 hour</p>
                            <p>• If 1 player ready → Auto-winner declared</p>
                            <p>• If 2+ players ready → Battle begins at deadline!</p>
                            <p>• Winner takes 99% of prize pool</p>
                            <p>• All players see synchronized countdown</p>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Phase3;