// src/pages/MultiplayerPurgeGame.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { io, Socket } from 'socket.io-client';
import ParticleBackground from '@/components/ParticleBackground';
import { ArrowLeft, Zap, Shield, Heart, Trophy, Skull, Users } from 'lucide-react';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { PublicKey } from '@solana/web3.js';

interface Player {
    walletAddress: string;
    name: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    hp: number;
    maxHp: number;
    alive: boolean;
    hasShield: boolean;
    hasSpeed: boolean;
    disconnected: boolean;
}

interface SafeZone {
    x: number;
    y: number;
    radius: number;
}

interface GameState {
    players: Player[];
    safeZone: SafeZone;
    eliminated: number;
    elapsedTime: number;
}

interface PowerUp {
    type: 'speed' | 'shield' | 'health';
    cost: number;
    active: boolean;
    duration?: number;
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

const MultiplayerPurgeGame: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const wallet = useWallet();
    const { submitPhase3Winner } = useSolanaGame();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });

    const [connected, setConnected] = useState(false);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myPlayer, setMyPlayer] = useState<Player | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<{ address: string; name: string } | null>(null);
    const [vsolBalance, setVsolBalance] = useState(1000);

    const [powerUps, setPowerUps] = useState<PowerUp[]>([
        { type: 'speed', cost: 100, active: false, duration: 10 },
        { type: 'shield', cost: 150, active: false, duration: 8 },
        { type: 'health', cost: 1, active: false }
    ]);

    const GAME_SERVER_URL = 'wss://purge-server-production.up.railway.app';

    // Connect to game server
    useEffect(() => {
        if (!gameId || !wallet.publicKey) return;

        const socket = io(GAME_SERVER_URL);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('🔗 Connected to game server');
            setConnected(true);

            // Join the game
            socket.emit('join-game', {
                gameId: parseInt(gameId),
                walletAddress: wallet.publicKey!.toBase58(),
                name: wallet.publicKey!.toBase58().substring(0, 8),
            });
        });

        socket.on('game-joined', (data) => {
            console.log('🎮 Joined game:', data);
            setMyPlayer(data.yourPlayer);
            if (data.yourPlayer) {
                setVsolBalance(data.gameState.players.find((p: Player) =>
                    p.walletAddress === wallet.publicKey!.toBase58()
                )?.hp || 1000);
            }
        });

        socket.on('game-state', (state: GameState) => {
            setGameState(state);

            // Update my player
            const me = state.players.find(p => p.walletAddress === wallet.publicKey!.toBase58());
            if (me) {
                setMyPlayer(me);
            }
        });

        socket.on('game-over', (data) => {
            console.log('🏆 Game Over:', data);
            setGameOver(true);
            setWinner({
                address: data.winner,
                name: data.winnerName,
            });
        });

        socket.on('player-eliminated', (data) => {
            console.log('💀 Player eliminated:', data);
        });

        socket.on('powerup-activated', (data) => {
            console.log('⚡ Power-up activated:', data);
            setPowerUps(prev => prev.map(p =>
                p.type === data.type ? { ...p, active: true } : p
            ));

            if (data.duration) {
                setTimeout(() => {
                    setPowerUps(prev => prev.map(p =>
                        p.type === data.type ? { ...p, active: false } : p
                    ));
                }, data.duration * 1000);
            }
        });

        socket.on('disconnect', () => {
            console.log('🔌 Disconnected from server');
            setConnected(false);
        });

        socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            alert(error.message);
        });

        return () => {
            socket.disconnect();
        };
    }, [gameId, wallet.publicKey]);

    // Mouse tracking
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            mouseRef.current = {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };

            // Send movement to server
            if (socketRef.current && wallet.publicKey && myPlayer?.alive) {
                socketRef.current.emit('player-move', {
                    gameId: parseInt(gameId!),
                    walletAddress: wallet.publicKey.toBase58(),
                    targetX: mouseRef.current.x,
                    targetY: mouseRef.current.y,
                });
            }
        };

        canvas.addEventListener('mousemove', handleMouseMove);
        return () => canvas.removeEventListener('mousemove', handleMouseMove);
    }, [gameId, wallet.publicKey, myPlayer?.alive]);

    // Drawing loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !gameState) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            // Clear canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw safe zone
            const gradient = ctx.createRadialGradient(
                gameState.safeZone.x,
                gameState.safeZone.y,
                0,
                gameState.safeZone.x,
                gameState.safeZone.y,
                gameState.safeZone.radius
            );
            gradient.addColorStop(0, 'rgba(0, 255, 0, 0.05)');
            gradient.addColorStop(0.7, 'rgba(0, 255, 0, 0.1)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0.3)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(
                gameState.safeZone.x,
                gameState.safeZone.y,
                gameState.safeZone.radius,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // Draw safe zone border
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.arc(
                gameState.safeZone.x,
                gameState.safeZone.y,
                gameState.safeZone.radius,
                0,
                Math.PI * 2
            );
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw all players
            gameState.players.forEach((player) => {
                if (!player.alive) return;

                // Player glow
                const playerGradient = ctx.createRadialGradient(
                    player.x, player.y, 0,
                    player.x, player.y, player.radius * 2
                );
                playerGradient.addColorStop(0, player.color + 'ff');
                playerGradient.addColorStop(0.5, player.color + '88');
                playerGradient.addColorStop(1, player.color + '00');

                ctx.fillStyle = playerGradient;
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.radius * 2, 0, Math.PI * 2);
                ctx.fill();

                // Player body
                ctx.fillStyle = player.color;
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
                ctx.fill();

                // Shield effect
                if (player.hasShield) {
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Speed effect
                if (player.hasSpeed) {
                    ctx.strokeStyle = '#ffff00';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // HP bar
                const barWidth = 40;
                const barHeight = 4;
                const barX = player.x - barWidth / 2;
                const barY = player.y - player.radius - 10;

                ctx.fillStyle = '#ff0000';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                ctx.fillStyle = '#00ff00';
                const hpWidth = (player.hp / player.maxHp) * barWidth;
                ctx.fillRect(barX, barY, hpWidth, barHeight);

                // Disconnected indicator
                if (player.disconnected) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('💤', player.x, player.y - player.radius - 20);
                }

                // Name (only for my player)
                if (player.walletAddress === wallet.publicKey?.toBase58()) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 3;
                    ctx.strokeText('YOU', player.x, player.y + player.radius + 20);
                    ctx.fillText('YOU', player.x, player.y + player.radius + 20);
                }
            });

            requestAnimationFrame(draw);
        };

        draw();
    }, [gameState, wallet.publicKey]);

    // Buy power-up
    const buyPowerUp = (type: 'speed' | 'shield' | 'health') => {
        if (!socketRef.current || !wallet.publicKey || !myPlayer?.alive) return;

        const powerUp = powerUps.find(p => p.type === type);
        if (!powerUp || powerUp.active) return;

        if (vsolBalance < powerUp.cost) {
            alert('Not enough VSOL!');
            return;
        }

        socketRef.current.emit('buy-powerup', {
            gameId: parseInt(gameId!),
            walletAddress: wallet.publicKey.toBase58(),
            type,
        });

        setVsolBalance(prev => prev - powerUp.cost);
    };

    // Submit winner to blockchain
    const handleSubmitWinner = async () => {
        if (!winner || !gameId) return;

        try {
            await submitPhase3Winner(
                parseInt(gameId),
                new PublicKey(winner.address)
            );
            alert('Winner submitted to blockchain!');
        } catch (error) {
            console.error('Error submitting winner:', error);
            alert('Failed to submit winner');
        }
    };

    const alivePlayers = gameState?.players.filter(p => p.alive).length || 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black text-white relative overflow-hidden">
            <ParticleBackground />

            <div className="relative z-10 container mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Button
                        variant="secondary"
                        onClick={() => navigate(`/game/${gameId}/lobby`)}
                        disabled={!gameOver}
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Lobby
                    </Button>

                    <h1 className="text-4xl font-black bg-gradient-to-r from-red-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
                        💀 THE PURGE 💀
                    </h1>

                    <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-lg border-2 border-orange-500/50">
                        <Skull className="w-5 h-5 text-red-400" />
                        <span className="text-orange-400 font-bold">{gameState?.eliminated || 0}</span>
                        <span className="text-gray-400">eliminated</span>
                    </div>
                </div>

                {!connected && (
                    <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-lg p-4 mb-4 text-center">
                        <p className="text-yellow-300 font-semibold">⚠️ Connecting to game server...</p>
                    </div>
                )}

                {/* Game Stats */}
                <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-black/60 backdrop-blur-xl border-2 border-green-500/50 rounded-xl p-4 text-center">
                        <Users className="w-6 h-6 text-green-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-green-400">{alivePlayers}</div>
                        <div className="text-xs text-gray-400">Survivors</div>
                    </div>

                    <div className="bg-black/60 backdrop-blur-xl border-2 border-blue-500/50 rounded-xl p-4 text-center">
                        <Heart className="w-6 h-6 text-red-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-red-400">
                            {myPlayer ? Math.max(0, Math.floor(myPlayer.hp)) : 0}
                        </div>
                        <div className="text-xs text-gray-400">Your HP</div>
                    </div>

                    <div className="bg-black/60 backdrop-blur-xl border-2 border-orange-500/50 rounded-xl p-4 text-center">
                        <Trophy className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-orange-400">{vsolBalance}</div>
                        <div className="text-xs text-gray-400">VSOL</div>
                    </div>

                    <div className="bg-black/60 backdrop-blur-xl border-2 border-purple-500/50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400">
                            {gameState?.elapsedTime || 0}s
                        </div>
                        <div className="text-xs text-gray-400">Time Elapsed</div>
                    </div>
                </div>

                {/* Power-ups */}
                {myPlayer?.alive && !gameOver && (
                    <div className="bg-black/60 backdrop-blur-xl border-2 border-orange-500/50 rounded-xl p-4 mb-6">
                        <h3 className="text-lg font-bold text-orange-400 mb-3">Power-Ups</h3>
                        <div className="flex gap-3">
                            <Button
                                variant={powerUps.find(p => p.type === 'speed')?.active ? 'secondary' : 'sol-outline'}
                                onClick={() => buyPowerUp('speed')}
                                disabled={powerUps.find(p => p.type === 'speed')?.active || vsolBalance < 100}
                                className="flex items-center gap-2"
                            >
                                <Zap className="w-5 h-5" />
                                SPEED (100)
                            </Button>

                            <Button
                                variant={powerUps.find(p => p.type === 'shield')?.active ? 'secondary' : 'sol-outline'}
                                onClick={() => buyPowerUp('shield')}
                                disabled={powerUps.find(p => p.type === 'shield')?.active || vsolBalance < 150}
                                className="flex items-center gap-2"
                            >
                                <Shield className="w-5 h-5" />
                                SHIELD (150)
                            </Button>

                            <Button
                                variant="sol-outline"
                                onClick={() => buyPowerUp('health')}
                                disabled={!myPlayer || myPlayer.hp >= myPlayer.maxHp || vsolBalance < 1}
                                className="flex items-center gap-2"
                            >
                                <Heart className="w-5 h-5" />
                                HEAL (1)
                            </Button>
                        </div>
                    </div>
                )}

                {/* Game Canvas */}
                <div className="bg-black/60 backdrop-blur-xl border-2 border-red-600/60 rounded-2xl p-6 mb-6">
                    <canvas
                        ref={canvasRef}
                        width={900}
                        height={700}
                        className="w-full rounded-xl cursor-none bg-gradient-to-br from-black via-red-950 to-black border-2 border-red-500/50"
                        style={{ aspectRatio: '9/7' }}
                    />
                </div>

                {/* Game Over */}
                {gameOver && winner && (
                    <div className="bg-gradient-to-br from-black/95 to-red-950/80 backdrop-blur-xl border-4 border-red-500/70 rounded-2xl p-10 text-center">
                        <div className="mb-6">
                            {winner.address === wallet.publicKey?.toBase58() ? (
                                <>
                                    <div className="text-8xl mb-4 animate-bounce">👑</div>
                                    <h2 className="text-5xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-4">
                                        VICTORY!
                                    </h2>
                                    <p className="text-2xl text-yellow-300 font-bold">
                                        YOU ARE THE ULTIMATE SURVIVOR!
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="text-8xl mb-4">💀</div>
                                    <h2 className="text-5xl font-black text-red-400 mb-4">
                                        ELIMINATED
                                    </h2>
                                    <p className="text-2xl text-red-300">
                                        Winner: {winner.name}
                                    </p>
                                </>
                            )}
                        </div>

                        {winner.address === wallet.publicKey?.toBase58() && (
                            <Button
                                variant="hero"
                                size="lg"
                                onClick={handleSubmitWinner}
                                className="text-xl px-12 py-6"
                            >
                                🏆 SUBMIT WINNER TO BLOCKCHAIN
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultiplayerPurgeGame;