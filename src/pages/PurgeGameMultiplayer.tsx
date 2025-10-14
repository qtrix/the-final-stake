// src/pages/PurgeGameMultiplayer.tsx - Real Multiplayer Battle Game
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { Button } from '@/components/ui/button';
import { Coins, Heart, Zap, Shield, Wifi, WifiOff } from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import { PlayerState } from '@/types';
import { toast } from 'sonner';

interface PurgeGameMultiplayerProps {
    gameId: number;
    readyPlayers: Array<{ player: string; ready: boolean }>;
    phase3Duration: number;
    onGameEnd: (winner: PublicKey) => void;
}

const PurgeGameMultiplayer: React.FC<PurgeGameMultiplayerProps> = ({
    gameId,
    readyPlayers,
    phase3Duration,
    onGameEnd
}) => {
    const wallet = useWallet();
    const solanaGame = useSolanaGame();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    const [countdown, setCountdown] = useState(15);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameTime, setGameTime] = useState(0);
    const [myPlayer, setMyPlayer] = useState<PlayerState | null>(null);
    const [eliminated, setEliminated] = useState(0);
    const [virtualBalance, setVirtualBalance] = useState(0);
    const [mouse, setMouse] = useState({ x: 450, y: 350 });
    const [safeZone, setSafeZone] = useState({ x: 450, y: 350, radius: 300 });
    const [gameEnded, setGameEnded] = useState(false);

    const [speedUses, setSpeedUses] = useState(0);
    const [shieldUses, setShieldUses] = useState(0);
    const [healthUses, setHealthUses] = useState(0);

    const getSpeedCost = () => 100 + (speedUses * 50);
    const getShieldCost = () => 150 + (shieldUses * 75);
    const getHealthCost = () => 50 + (healthUses * 25);

    // Multiplayer hook
    const { isConnected, otherPlayers, sendUpdate, sendEliminated, sendWinner } = useMultiplayerGame({
        gameId,
        enabled: gameStarted,
        onPlayerUpdate: (playerId, state) => {
            // Player updated - handled by otherPlayers map
        },
        onPlayerEliminated: (playerId) => {
            console.log('Player eliminated:', playerId);
            setEliminated(prev => prev + 1);
            toast.error(`Player eliminated!`);
        },
        onWinnerDeclared: (winnerId) => {
            console.log('Winner declared:', winnerId);
            if (winnerId === wallet.publicKey?.toBase58()) {
                toast.success('🎉 YOU WON!');
            }
            setGameEnded(true);
        }
    });

    // Fetch virtual balance
    useEffect(() => {
        const fetchBalance = async () => {
            if (!wallet.publicKey || !solanaGame) return;

            try {
                const playerState = await solanaGame.getPlayerState(gameId, wallet.publicKey);
                if (playerState) {
                    setVirtualBalance(playerState.virtualBalance / 1e9);
                }
            } catch (error) {
                console.error('Failed to fetch virtual balance:', error);
            }
        };

        if (gameStarted) {
            fetchBalance();
            const interval = setInterval(fetchBalance, 10000);
            return () => clearInterval(interval);
        }
    }, [gameStarted, gameId, wallet.publicKey, solanaGame]);

    // Countdown
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && !gameStarted) {
            setGameStarted(true);
            initializePlayer();
        }
    }, [countdown]);

    // Game timer
    useEffect(() => {
        if (!gameStarted || gameEnded) return;

        const timer = setInterval(() => {
            setGameTime(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStarted, gameEnded]);

    // Safe zone shrinking
    useEffect(() => {
        if (!gameStarted || gameEnded) return;

        const shrinkRate = (300 - 25) / phase3Duration;

        const interval = setInterval(() => {
            setSafeZone(prev => ({
                ...prev,
                radius: Math.max(25, prev.radius - shrinkRate)
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, [gameStarted, phase3Duration, gameEnded]);

    const initializePlayer = () => {
        const playerColors = [
            'hsl(280, 100%, 60%)',
            'hsl(200, 100%, 60%)',
            'hsl(120, 100%, 60%)',
            'hsl(60, 100%, 60%)',
            'hsl(0, 100%, 60%)',
            'hsl(30, 100%, 60%)',
            'hsl(180, 100%, 60%)',
            'hsl(300, 100%, 60%)',
        ];

        const myIndex = readyPlayers.findIndex(p => p.player === wallet.publicKey?.toBase58());
        const angle = (myIndex / readyPlayers.length) * Math.PI * 2;
        const distance = 150;

        const initialPlayer: PlayerState = {
            id: wallet.publicKey!.toBase58(),
            x: 450 + Math.cos(angle) * distance,
            y: 350 + Math.sin(angle) * distance,
            hp: 1000,
            maxHp: 1000,
            alive: true,
            hasShield: false,
            hasSpeed: false,
            name: 'YOU',
            color: playerColors[myIndex % playerColors.length],
            radius: 20,
            vx: 0,
            vy: 0
        };

        setMyPlayer(initialPlayer);
        sendUpdate(initialPlayer);
    };

    // Keyboard controls
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === '1') buyPowerUp('speed');
            if (e.key === '2') buyPowerUp('shield');
            if (e.key === '3') buyPowerUp('health');
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [virtualBalance, speedUses, shieldUses, healthUses, myPlayer]);

    const buyPowerUp = (type: 'speed' | 'shield' | 'health') => {
        if (!myPlayer) return;

        let cost = 0;

        switch (type) {
            case 'speed':
                cost = getSpeedCost();
                if (virtualBalance >= cost && !myPlayer.hasSpeed) {
                    setVirtualBalance(prev => prev - cost);
                    setSpeedUses(prev => prev + 1);
                    setMyPlayer(prev => prev ? { ...prev, hasSpeed: true } : null);
                    toast.success('⚡ Speed activated!');
                    setTimeout(() => {
                        setMyPlayer(prev => prev ? { ...prev, hasSpeed: false } : null);
                    }, 10000);
                }
                break;
            case 'shield':
                cost = getShieldCost();
                if (virtualBalance >= cost && !myPlayer.hasShield) {
                    setVirtualBalance(prev => prev - cost);
                    setShieldUses(prev => prev + 1);
                    setMyPlayer(prev => prev ? { ...prev, hasShield: true } : null);
                    toast.success('🛡️ Shield activated!');
                    setTimeout(() => {
                        setMyPlayer(prev => prev ? { ...prev, hasShield: false } : null);
                    }, 8000);
                }
                break;
            case 'health':
                cost = getHealthCost();
                if (virtualBalance >= cost && myPlayer.hp < myPlayer.maxHp) {
                    setVirtualBalance(prev => prev - cost);
                    setHealthUses(prev => prev + 1);
                    setMyPlayer(prev => prev ? {
                        ...prev,
                        hp: Math.min(prev.maxHp, prev.hp + 200)
                    } : null);
                    toast.success('❤️ Health restored!');
                }
                break;
        }
    };

    // Mouse movement
    const handleMouseMove = useCallback((e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        setMouse({
            x: (e.clientX - rect.left) * (900 / rect.width),
            y: (e.clientY - rect.top) * (700 / rect.height)
        });
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !gameStarted) return;

        canvas.addEventListener('mousemove', handleMouseMove);
        return () => canvas.removeEventListener('mousemove', handleMouseMove);
    }, [handleMouseMove, gameStarted]);

    // Check if outside safe zone
    const isOutsideSafeZone = (x: number, y: number) => {
        const distance = Math.sqrt((x - safeZone.x) ** 2 + (y - safeZone.y) ** 2);
        return distance > safeZone.radius;
    };

    // Game loop
    const gameLoop = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !myPlayer || !gameStarted || gameEnded) return;

        // Clear canvas
        const gradient = ctx.createRadialGradient(450, 350, 0, 450, 350, 500);
        gradient.addColorStop(0, 'rgba(30, 0, 0, 0.95)');
        gradient.addColorStop(0.5, 'rgba(20, 0, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 900, 700);

        // Grid
        ctx.strokeStyle = 'rgba(100, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 900; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 700);
            ctx.stroke();
        }
        for (let y = 0; y < 700; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(900, y);
            ctx.stroke();
        }

        // Safe zone
        const pulseEffect = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;

        ctx.fillStyle = 'rgba(139, 0, 0, 0.3)';
        ctx.fillRect(0, 0, 900, 700);

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        const zoneColor = safeZone.radius <= 50 ? 'rgba(255, 165, 0, ' : 'rgba(0, 255, 0, ';
        ctx.strokeStyle = `${zoneColor}${pulseEffect})`;
        ctx.lineWidth = safeZone.radius <= 50 ? 6 : 4;
        ctx.beginPath();
        ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Update my player position
        if (myPlayer.alive) {
            const dx = mouse.x - myPlayer.x;
            const dy = mouse.y - myPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 2) {
                const speed = myPlayer.hasSpeed ? 5 : 3;
                const moveX = (dx / distance) * speed;
                const moveY = (dy / distance) * speed;

                const newX = Math.max(20, Math.min(880, myPlayer.x + moveX));
                const newY = Math.max(20, Math.min(680, myPlayer.y + moveY));

                // Check safe zone damage
                let newHp = myPlayer.hp;
                if (isOutsideSafeZone(newX, newY)) {
                    newHp = Math.max(0, myPlayer.hp - 1); // 1 HP per frame outside
                }

                const updatedPlayer = {
                    ...myPlayer,
                    x: newX,
                    y: newY,
                    hp: newHp,
                    vx: moveX,
                    vy: moveY,
                    alive: newHp > 0
                };

                setMyPlayer(updatedPlayer);
                sendUpdate(updatedPlayer);

                // Check if eliminated
                if (newHp <= 0 && myPlayer.alive) {
                    sendEliminated();
                    toast.error('💀 You have been eliminated!');
                }
            }
        }

        // Draw player function
        const drawPlayer = (player: PlayerState, isMe: boolean) => {
            if (!player.alive) return;

            // Glow
            const glowGradient = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.radius * 1.8);
            glowGradient.addColorStop(0, player.color.replace(')', ', 0.6)').replace('hsl', 'hsla'));
            glowGradient.addColorStop(0.6, player.color.replace(')', ', 0.2)').replace('hsl', 'hsla'));
            glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius * 1.8, 0, Math.PI * 2);
            ctx.fill();

            // Shield
            if (player.hasShield) {
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#60a5fa';
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Speed aura
            if (player.hasSpeed) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#fbbf24';
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Body
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            ctx.fillStyle = player.color;
            ctx.fill();

            // Name
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(isMe ? 'YOU' : player.name, player.x, player.y - player.radius - 10);
            ctx.fillText(isMe ? 'YOU' : player.name, player.x, player.y - player.radius - 10);

            // HP bar
            const barWidth = player.radius * 2;
            const barHeight = 4;
            const barX = player.x - barWidth / 2;
            const barY = player.y - player.radius - 25;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

            const hpPercent = player.hp / player.maxHp;
            ctx.fillStyle = hpPercent > 0.6 ? '#22c55e' : hpPercent > 0.3 ? '#f59e0b' : '#ef4444';
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        };

        // Draw all players
        drawPlayer(myPlayer, true);
        otherPlayers.forEach(player => drawPlayer(player, false));

        // Crosshair
        if (myPlayer.alive) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(mouse.x - 10, mouse.y);
            ctx.lineTo(mouse.x + 10, mouse.y);
            ctx.moveTo(mouse.x, mouse.y - 10);
            ctx.lineTo(mouse.x, mouse.y + 10);
            ctx.stroke();
        }

        animationRef.current = requestAnimationFrame(gameLoop);
    }, [myPlayer, otherPlayers, mouse, safeZone, gameStarted, gameEnded, sendUpdate, sendEliminated]);

    useEffect(() => {
        if (gameStarted && !gameEnded) {
            animationRef.current = requestAnimationFrame(gameLoop);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [gameLoop, gameStarted, gameEnded]);

    // Check win condition
    useEffect(() => {
        if (!gameStarted || gameEnded || !myPlayer) return;

        const aliveCount = Array.from(otherPlayers.values()).filter(p => p.alive).length + (myPlayer.alive ? 1 : 0);

        if (aliveCount <= 1 && myPlayer.alive) {
            console.log('🏆 You are the winner!');
            sendWinner(myPlayer.id);
            setGameEnded(true);

            setTimeout(() => {
                onGameEnd(wallet.publicKey!);
            }, 2000);
        }
    }, [otherPlayers, myPlayer?.alive, gameStarted, gameEnded, sendWinner, onGameEnd, wallet.publicKey]);

    if (countdown > 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black flex items-center justify-center">
                <ParticleBackground />

                <div className="relative z-10 max-w-4xl mx-auto p-8 text-center">
                    <div className="text-9xl font-black mb-8 animate-pulse text-red-500">
                        {countdown}
                    </div>

                    <h1 className="text-6xl font-black bg-gradient-to-r from-red-600 via-red-400 to-orange-500 bg-clip-text text-transparent mb-8">
                        PREPARE FOR BATTLE
                    </h1>

                    <div className="bg-black/80 border-2 border-red-600 rounded-xl p-8 mb-8">
                        <h3 className="text-2xl font-bold text-red-400 mb-6">⚔️ BATTLE RULES ⚔️</h3>

                        <div className="grid md:grid-cols-2 gap-4 text-left text-red-200">
                            <div className="bg-red-900/30 p-4 rounded-lg">
                                <p className="font-bold text-red-300 mb-2">🎯 Objective</p>
                                <p className="text-sm">Be the last one standing. Survive the shrinking zone.</p>
                            </div>

                            <div className="bg-red-900/30 p-4 rounded-lg">
                                <p className="font-bold text-red-300 mb-2">🎮 Controls</p>
                                <p className="text-sm">Move with mouse. Press 1, 2, 3 for power-ups.</p>
                            </div>

                            <div className="bg-red-900/30 p-4 rounded-lg">
                                <p className="font-bold text-red-300 mb-2">💀 Danger Zone</p>
                                <p className="text-sm">Stay inside the green circle or lose HP.</p>
                            </div>

                            <div className="bg-red-900/30 p-4 rounded-lg">
                                <p className="font-bold text-red-300 mb-2">⚡ Power-Ups</p>
                                <p className="text-sm">Use vSOL balance to buy boosts. Cost increases with use.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                        <p className="text-yellow-300 font-bold">
                            🔥 {readyPlayers.length} Warriors Ready • Winner Takes All 🔥
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const remainingPlayers = Array.from(otherPlayers.values()).filter(p => p.alive).length + (myPlayer?.alive ? 1 : 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black">
            <ParticleBackground />

            {/* Stats Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 border-b-2 border-red-600 p-4 backdrop-blur-md">
                <div className="flex justify-center gap-8 flex-wrap">
                    <div className="text-center">
                        <div className="text-2xl font-black text-green-400">{Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}</div>
                        <div className="text-xs text-red-300">TIME ALIVE</div>
                    </div>

                    <div className="text-center">
                        <div className="text-2xl font-black text-red-400">{remainingPlayers}</div>
                        <div className="text-xs text-red-300">REMAINING</div>
                    </div>

                    <div className="text-center">
                        <div className="text-2xl font-black text-orange-400">{eliminated}</div>
                        <div className="text-xs text-red-300">ELIMINATED</div>
                    </div>

                    <div className="text-center">
                        <div className="text-2xl font-black text-cyan-400">{virtualBalance.toFixed(0)}</div>
                        <div className="text-xs text-red-300">vSOL</div>
                    </div>

                    <div className="text-center">
                        <div className={`text-2xl font-black flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                            {isConnected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
                        </div>
                        <div className="text-xs text-red-300">{isConnected ? 'LIVE' : 'OFFLINE'}</div>
                    </div>
                </div>
            </div>

            {/* Power-Up Buttons */}
            <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
                <div className="max-w-4xl mx-auto flex justify-center gap-4 flex-wrap">
                    <Button
                        onClick={() => buyPowerUp('speed')}
                        disabled={virtualBalance < getSpeedCost() || myPlayer?.hasSpeed || !myPlayer?.alive}
                        className="bg-yellow-600 hover:bg-yellow-700 px-6 py-4"
                    >
                        <Zap className="w-5 h-5 mr-2" />
                        [1] SPEED
                        <span className="ml-2 text-sm">({getSpeedCost()})</span>
                    </Button>

                    <Button
                        onClick={() => buyPowerUp('shield')}
                        disabled={virtualBalance < getShieldCost() || myPlayer?.hasShield || !myPlayer?.alive}
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-4"
                    >
                        <Shield className="w-5 h-5 mr-2" />
                        [2] SHIELD
                        <span className="ml-2 text-sm">({getShieldCost()})</span>
                    </Button>

                    <Button
                        onClick={() => buyPowerUp('health')}
                        disabled={virtualBalance < getHealthCost() || !myPlayer || myPlayer.hp >= myPlayer.maxHp || !myPlayer?.alive}
                        className="bg-pink-600 hover:bg-pink-700 px-6 py-4"
                    >
                        <Heart className="w-5 h-5 mr-2" />
                        [3] HEALTH
                        <span className="ml-2 text-sm">({getHealthCost()})</span>
                    </Button>
                </div>
            </div>

            {/* Game Canvas */}
            <div className="flex items-center justify-center min-h-screen pt-20 pb-24">
                <div className="bg-black/90 border-4 border-red-600 rounded-xl p-4 shadow-2xl">
                    <canvas
                        ref={canvasRef}
                        width={900}
                        height={700}
                        className="rounded-lg cursor-none"
                    />
                    <div className="text-center mt-4 text-red-300 text-sm font-semibold tracking-wide animate-pulse">
                        💀 SURVIVE THE PURGE • ZONE RADIUS: {Math.round(safeZone.radius)}m 💀
                    </div>
                </div>
            </div>

            {gameEnded && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="text-9xl mb-4 animate-bounce">{myPlayer?.alive ? '👑' : '💀'}</div>
                        <h2 className="text-6xl font-black mb-4">
                            {myPlayer?.alive ? (
                                <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
                                    VICTORY!
                                </span>
                            ) : (
                                <span className="bg-gradient-to-r from-red-500 via-red-400 to-orange-500 bg-clip-text text-transparent">
                                    ELIMINATED
                                </span>
                            )}
                        </h2>
                        <p className="text-2xl text-gray-300">
                            {myPlayer?.alive ? 'Submitting results to blockchain...' : 'Better luck next time...'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurgeGameMultiplayer;