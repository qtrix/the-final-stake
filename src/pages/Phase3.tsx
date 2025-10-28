// src/pages/Phase3Lobby.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { io, Socket } from 'socket.io-client';
import { PublicKey } from '@solana/web3.js';
import ParticleBackground from '@/components/ParticleBackground';
import { Clock, Users, Skull, Trophy, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ReadyPlayer {
    walletAddress: string;
    name: string;
    ready: boolean;
    vsolBalance: number;
    markedReadyAt: Date;
}

interface ButtonProps {
    variant?: 'default' | 'hero' | 'secondary' | 'sol-outline';
    size?: 'default' | 'lg';
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
    variant = 'default',
    size = 'default',
    children,
    className = '',
    disabled = false,
    onClick,
}) => {
    const baseClasses = 'inline-flex items-center justify-center font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transform hover:scale-105';

    const variants = {
        default: 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500 shadow-lg hover:shadow-xl',
        hero: 'bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white hover:from-red-700 hover:via-red-800 hover:to-red-900 focus:ring-red-500 shadow-2xl hover:shadow-red-500/25',
        secondary: 'bg-gradient-to-r from-gray-700 to-gray-800 text-white hover:from-gray-600 hover:to-gray-700 focus:ring-gray-500 shadow-lg',
        'sol-outline': 'border-2 border-orange-400 bg-orange-400/10 text-orange-300 hover:bg-orange-400 hover:text-black focus:ring-orange-500 shadow-lg hover:shadow-orange-500/25 backdrop-blur-sm'
    };

    const sizes = {
        default: 'px-6 py-3 text-sm rounded-lg',
        lg: 'px-8 py-4 text-lg rounded-xl'
    };

    return (
        <button
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
};

const Phase3Lobby: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const wallet = useWallet();
    const {
        games,
        markReadyPhase3,
        getPhase3ReadyStates,
        loading
    } = useSolanaGame();

    const [socket, setSocket] = useState<Socket | null>(null);
    const [game, setGame] = useState<any>(null);
    const [readyPlayers, setReadyPlayers] = useState<ReadyPlayer[]>([]);
    const [myReadyState, setMyReadyState] = useState<ReadyPlayer | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [countdownExpired, setCountdownExpired] = useState<boolean>(false);
    const [gameStarting, setGameStarting] = useState<boolean>(false);
    const [checkingGameStart, setCheckingGameStart] = useState<boolean>(false);

    const GAME_SERVER_URL = 'wss://purge-server-production.up.railway.app'; // Change pentru production

    // Load game data
    useEffect(() => {
        if (!gameId) return;

        const currentGame = games.find(g => g.gameId === parseInt(gameId));
        if (currentGame) {
            setGame(currentGame);
        }
    }, [gameId, games]);

    // Load ready players
    const loadReadyPlayers = useCallback(async () => {
        if (!gameId) return;

        try {
            const states = await getPhase3ReadyStates(parseInt(gameId));
            const readyStates: ReadyPlayer[] = states.map(s => ({
                walletAddress: s.player,
                name: s.player.substring(0, 8) + '...',
                ready: s.ready,
                vsolBalance: s.virtualBalance,
                markedReadyAt: s.markedReadyAt,
            }));

            setReadyPlayers(readyStates);

            // Find my ready state
            if (wallet.publicKey) {
                const myState = readyStates.find(s => s.walletAddress === wallet.publicKey!.toBase58());
                setMyReadyState(myState || null);
            }
        } catch (error) {
            console.error('Error loading ready players:', error);
        }
    }, [gameId, getPhase3ReadyStates, wallet.publicKey]);

    useEffect(() => {
        loadReadyPlayers();
        const interval = setInterval(loadReadyPlayers, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, [loadReadyPlayers]);

    // Countdown timer
    useEffect(() => {
        if (!game?.phase3ReadyDeadline) return;

        const updateCountdown = () => {
            const now = new Date().getTime();
            const deadline = new Date(game.phase3ReadyDeadline).getTime();
            const diff = deadline - now;

            if (diff <= 0) {
                setTimeLeft(0);
                setCountdownExpired(true);
            } else {
                setTimeLeft(Math.floor(diff / 1000));
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [game?.phase3ReadyDeadline]);

    // Connect to WebSocket lobby
    useEffect(() => {
        if (!gameId || !wallet.publicKey) return;

        const newSocket = io(GAME_SERVER_URL);

        newSocket.on('connect', () => {
            console.log('🔗 Connected to game server');
            newSocket.emit('join-lobby', {
                gameId: parseInt(gameId),
                walletAddress: wallet.publicKey!.toBase58(),
                name: wallet.publicKey!.toBase58().substring(0, 8),
            });
        });

        newSocket.on('lobby-joined', (data) => {
            console.log('👋 Joined lobby:', data);
        });

        newSocket.on('game-started', (data) => {
            console.log('🎮 Game started!', data);
            navigate(`/game/${gameId}/play`);
        });

        newSocket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [gameId, wallet.publicKey, navigate]);

    // Poll to check if game started by someone else
    useEffect(() => {
        if (!countdownExpired || !gameId) return;

        const checkGameStarted = async () => {
            try {
                setCheckingGameStart(true);
                const response = await fetch(`${GAME_SERVER_URL}/game/${gameId}`);

                if (response.ok) {
                    const data = await response.json();
                    if (data.gameActive) {
                        // Game was started by someone else
                        navigate(`/game/${gameId}/play`);
                    }
                }
            } catch (error) {
                console.log('Game not started yet');
            } finally {
                setCheckingGameStart(false);
            }
        };

        checkGameStarted();
        const interval = setInterval(checkGameStarted, 3000); // Check every 3s

        return () => clearInterval(interval);
    }, [countdownExpired, gameId, navigate, GAME_SERVER_URL]);

    // Mark ready handler
    const handleMarkReady = async () => {
        if (!gameId || loading) return;

        try {
            await markReadyPhase3(parseInt(gameId));
            await loadReadyPlayers();
        } catch (error: any) {
            console.error('Error marking ready:', error);
            alert(error.message || 'Failed to mark ready');
        }
    };

    // Start game handler (after countdown)
    const handleStartGame = async () => {
        if (!socket || !gameId || !countdownExpired) return;

        setGameStarting(true);

        try {
            // Get all ready players
            const playersForGame = readyPlayers
                .filter(p => p.ready)
                .map(p => ({
                    walletAddress: p.walletAddress,
                    name: p.name,
                    vsolBalance: p.vsolBalance,
                }));

            if (playersForGame.length === 0) {
                alert('No ready players!');
                setGameStarting(false);
                return;
            }

            // Tell server to start game
            socket.emit('start-game', {
                gameId: parseInt(gameId),
                readyPlayers: playersForGame,
            });

            // Navigate will happen via socket event 'game-started'
        } catch (error) {
            console.error('Error starting game:', error);
            setGameStarting(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!game) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black flex items-center justify-center">
                <div className="text-white text-2xl">Loading game...</div>
            </div>
        );
    }

    const totalPlayers = game.players.length;
    const playersWithBalance = readyPlayers.length;
    const eliminated = totalPlayers - playersWithBalance;
    const totalVSOL = readyPlayers.reduce((sum, p) => sum + p.vsolBalance, 0);
    const prizePool = game.prizePool / 1e9; // Convert lamports to SOL

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black text-white relative overflow-hidden">
            <ParticleBackground />

            <div className="relative z-10 container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-6xl font-black bg-gradient-to-r from-red-500 via-orange-500 to-red-500 bg-clip-text text-transparent mb-4 drop-shadow-2xl">
                        💀 PHASE 3: THE PURGE 💀
                    </h1>
                    <p className="text-xl text-red-300">
                        Only the strongest survive. Mark ready to enter the arena.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-black/60 backdrop-blur-xl border-2 border-red-500/50 rounded-xl p-6 text-center">
                        <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <div className="text-3xl font-bold text-yellow-400">{totalVSOL.toFixed(0)}</div>
                        <div className="text-sm text-red-300">Total VSOL</div>
                    </div>

                    <div className="bg-black/60 backdrop-blur-xl border-2 border-blue-500/50 rounded-xl p-6 text-center">
                        <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <div className="text-3xl font-bold text-blue-400">{playersWithBalance}</div>
                        <div className="text-sm text-red-300">Active Players</div>
                    </div>

                    <div className="bg-black/60 backdrop-blur-xl border-2 border-gray-500/50 rounded-xl p-6 text-center">
                        <Skull className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <div className="text-3xl font-bold text-gray-400">{eliminated}</div>
                        <div className="text-sm text-red-300">Eliminated</div>
                    </div>

                    <div className="bg-black/60 backdrop-blur-xl border-2 border-orange-500/50 rounded-xl p-6 text-center">
                        <Trophy className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                        <div className="text-3xl font-bold text-orange-400">{prizePool.toFixed(2)}</div>
                        <div className="text-sm text-red-300">Prize Pool (SOL)</div>
                    </div>
                </div>

                {/* Countdown Timer */}
                {!countdownExpired && (
                    <div className="bg-gradient-to-br from-black/90 to-red-950/60 backdrop-blur-xl border-4 border-red-500/70 rounded-2xl p-8 mb-8 text-center shadow-2xl">
                        <Clock className="w-16 h-16 text-red-400 mx-auto mb-4 animate-pulse" />
                        <h2 className="text-4xl font-black text-red-400 mb-2">COUNTDOWN TO BATTLE</h2>
                        <div className="text-8xl font-black bg-gradient-to-r from-red-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
                            {formatTime(timeLeft)}
                        </div>
                        <p className="text-red-300 mt-4 text-xl">
                            Mark yourself ready before time runs out!
                        </p>
                    </div>
                )}

                {/* Game Start Button (after countdown) */}
                {countdownExpired && !gameStarting && (
                    <div className="bg-gradient-to-br from-black/90 to-green-950/60 backdrop-blur-xl border-4 border-green-500/70 rounded-2xl p-8 mb-8 text-center shadow-2xl">
                        <h2 className="text-4xl font-black text-green-400 mb-4">⚔️ READY FOR BATTLE ⚔️</h2>
                        <p className="text-green-300 mb-6 text-lg">
                            Countdown expired! Any ready player can start the game.
                        </p>
                        <Button
                            variant="hero"
                            size="lg"
                            onClick={handleStartGame}
                            disabled={readyPlayers.filter(p => p.ready).length === 0}
                            className="text-2xl px-12 py-6"
                        >
                            {checkingGameStart ? (
                                <>
                                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                                    Checking if started...
                                </>
                            ) : (
                                <>🎮 START THE PURGE</>
                            )}
                        </Button>
                    </div>
                )}

                {/* Starting Screen */}
                {gameStarting && (
                    <div className="bg-gradient-to-br from-black/95 to-red-950/80 backdrop-blur-xl border-4 border-red-500/70 rounded-2xl p-12 mb-8 text-center shadow-2xl">
                        <Loader2 className="w-24 h-24 text-red-500 mx-auto mb-6 animate-spin" />
                        <h2 className="text-5xl font-black text-red-400 mb-4">🔥 STARTING GAME 🔥</h2>
                        <p className="text-red-300 text-xl">Loading arena... Prepare for battle!</p>
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Players List */}
                    <div className="lg:col-span-2 bg-black/60 backdrop-blur-xl border-2 border-red-500/50 rounded-xl p-6">
                        <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center">
                            <Users className="w-6 h-6 mr-2" />
                            Players with VSOL Balance
                        </h2>

                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {readyPlayers.map((player) => (
                                <div
                                    key={player.walletAddress}
                                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${player.ready
                                        ? 'bg-green-500/20 border-green-500/50'
                                        : 'bg-red-500/10 border-red-500/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {player.ready ? (
                                            <CheckCircle className="w-6 h-6 text-green-400" />
                                        ) : (
                                            <XCircle className="w-6 h-6 text-red-400" />
                                        )}
                                        <div>
                                            <div className="font-mono text-sm">{player.name}</div>
                                            <div className="text-xs text-gray-400">{player.walletAddress}</div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-xl font-bold text-orange-400">
                                            {player.vsolBalance.toFixed(0)} VSOL
                                        </div>
                                        <div className={`text-sm font-semibold ${player.ready ? 'text-green-400' : 'text-red-400'}`}>
                                            {player.ready ? '✓ READY' : 'NOT READY'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ready Status & Actions */}
                    <div className="space-y-6">
                        {/* My Status */}
                        <div className="bg-black/60 backdrop-blur-xl border-2 border-orange-500/50 rounded-xl p-6">
                            <h3 className="text-xl font-bold text-orange-400 mb-4">Your Status</h3>

                            {myReadyState ? (
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <div className={`text-6xl mb-2 ${myReadyState.ready ? 'animate-bounce' : ''}`}>
                                            {myReadyState.ready ? '✅' : '⏳'}
                                        </div>
                                        <div className={`text-2xl font-bold ${myReadyState.ready ? 'text-green-400' : 'text-red-400'}`}>
                                            {myReadyState.ready ? 'READY FOR BATTLE' : 'NOT READY'}
                                        </div>
                                    </div>

                                    <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4">
                                        <div className="text-sm text-orange-300 mb-1">Your VSOL Balance</div>
                                        <div className="text-3xl font-bold text-orange-400">
                                            {myReadyState.vsolBalance.toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">⚠️</div>
                                    <div className="text-red-400 font-semibold">Not participating</div>
                                    <div className="text-sm text-gray-400 mt-2">No VSOL balance in Phase 2</div>
                                </div>
                            )}
                        </div>

                        {/* Mark Ready Button */}
                        {myReadyState && !myReadyState.ready && !countdownExpired && (
                            <Button
                                variant="hero"
                                size="lg"
                                onClick={handleMarkReady}
                                disabled={loading}
                                className="w-full text-xl"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Marking Ready...
                                    </>
                                ) : (
                                    <>✓ MARK READY</>
                                )}
                            </Button>
                        )}

                        {/* Info */}
                        <div className="bg-black/60 backdrop-blur-xl border-2 border-blue-500/50 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-blue-400 mb-3">Game Rules</h3>
                            <ul className="space-y-2 text-sm text-gray-300">
                                <li>• All ready players enter the arena</li>
                                <li>• You start with your VSOL balance</li>
                                <li>• Safe zone shrinks over time</li>
                                <li>• Push others out of safe zone</li>
                                <li>• Last player alive wins</li>
                                <li>• If disconnected, you stay in game</li>
                                <li>• Winner takes the entire prize pool</li>
                            </ul>
                        </div>

                        {/* Ready Players Count */}
                        <div className="bg-black/60 backdrop-blur-xl border-2 border-green-500/50 rounded-xl p-6 text-center">
                            <div className="text-5xl font-black text-green-400 mb-2">
                                {readyPlayers.filter(p => p.ready).length}
                            </div>
                            <div className="text-sm text-green-300">Players Ready</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Phase3Lobby;