import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { Button } from '@/components/ui/button';
import { Coins, Heart, Zap, Shield, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import { PlayerState } from '@/types';
import { toast } from 'sonner';

interface PurgeGameMultiplayerProps {
    gameId: number;
    readyPlayers: Array<{ player: string; ready: boolean }>;
    phase3Duration: number;
    onGameEnd: (winner: PublicKey) => void;
}

interface CountdownState {
    remaining: number;
    isActive: boolean;
}

interface ExplosionParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

interface TrailParticle {
    x: number;
    y: number;
    alpha: number;
}

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

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
    const countdownIntervalRef = useRef<NodeJS.Timeout>();
    const lastUpdateTimeRef = useRef<number>(Date.now());
    const updateThrottleRef = useRef<number>(0);
    const lastBalanceFetchRef = useRef<number>(0);
    const particlesRef = useRef<ExplosionParticle[]>([]);

    const interpolatedPlayersRef = useRef<Map<string, PlayerState>>(new Map());

    const [countdown, setCountdown] = useState<CountdownState>({ remaining: 0, isActive: false });
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
    const [winnerDeclared, setWinnerDeclared] = useState(false);

    const getSpeedCost = useMemo(() => 100 + (speedUses * 50), [speedUses]);
    const getShieldCost = useMemo(() => 150 + (shieldUses * 75), [shieldUses]);
    const getHealthCost = useMemo(() => 50 + (healthUses * 25), [healthUses]);

    const { isConnected, otherPlayers, gamePhase, sendUpdate, sendEliminated, sendWinner } = useMultiplayerGame({
        gameId,
        enabled: true,
        onPlayerUpdate: useCallback((player: PlayerState) => {
            interpolatedPlayersRef.current.set(player.id, player);
        }, []),
        onPlayerEliminated: useCallback((playerId) => {
            setEliminated(prev => prev + 1);
            toast.error('Player eliminated!');
        }, []),
        onWinnerDeclared: useCallback((winnerId) => {
            if (winnerId === wallet.publicKey?.toBase58()) {
                toast.success('🏆 YOU WON!');
            }
            setGameEnded(true);
        }, [wallet.publicKey]),
        onGamePhaseChange: useCallback((phase) => {
            if (phase === 'countdown') {
                setCountdown({ remaining: 15, isActive: true });
                toast.info('⚔️ Battle starting in 15 seconds...');
            } else if (phase === 'active') {
                setGameStarted(true);
                initializePlayer();
                toast.success('🎮 Battle started!');
            } else if (phase === 'ended') {
                setGameEnded(true);
            }
        }, []),
        onCountdownSync: useCallback((startTime: number, duration: number) => {
            const calculateRemaining = () => {
                const now = Date.now();
                const endTime = startTime + duration;
                return Math.max(0, Math.ceil((endTime - now) / 1000));
            };

            setCountdown({ remaining: calculateRemaining(), isActive: true });

            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

            countdownIntervalRef.current = setInterval(() => {
                const remaining = calculateRemaining();
                setCountdown({ remaining, isActive: remaining > 0 });
                if (remaining <= 0) clearInterval(countdownIntervalRef.current);
            }, 100);
        }, [])
    });

    const createExplosion = useCallback((x: number, y: number, color: string): void => {
        const particles: ExplosionParticle[] = [];
        for (let i = 0; i < 15; i++) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 30,
                maxLife: 30,
                color,
                size: Math.random() * 4 + 2
            });
        }
        particlesRef.current = [...particlesRef.current, ...particles];
    }, []);

    const createTrailParticle = useCallback((x: number, y: number): TrailParticle => {
        return { x, y, alpha: 1.0 };
    }, []);

    const initializePlayer = useCallback(() => {
        if (!wallet.publicKey) return;

        const playerColors = [
            'hsl(280, 100%, 60%)', 'hsl(200, 100%, 60%)', 'hsl(120, 100%, 60%)', 'hsl(60, 100%, 60%)',
            'hsl(0, 100%, 60%)', 'hsl(30, 100%, 60%)', 'hsl(180, 100%, 60%)', 'hsl(300, 100%, 60%)',
        ];

        const myIndex = readyPlayers.findIndex(p => p.player === wallet.publicKey?.toBase58());
        const validIndex = myIndex >= 0 ? myIndex : 0;
        const angle = (validIndex / Math.max(readyPlayers.length, 1)) * Math.PI * 2;
        const distance = 150;

        const initialPlayer: PlayerState = {
            id: wallet.publicKey.toBase58(),
            x: 450 + Math.cos(angle) * distance,
            y: 350 + Math.sin(angle) * distance,
            hp: 1000,
            maxHp: 1000,
            alive: true,
            hasShield: false,
            hasSpeed: false,
            name: wallet.publicKey.toBase58().slice(0, 5),
            color: playerColors[validIndex % playerColors.length],
            radius: 20,
            vx: 0,
            vy: 0,
            trail: [],
            pulsePhase: 0
        };

        setMyPlayer(initialPlayer);
        interpolatedPlayersRef.current.set(initialPlayer.id, initialPlayer);
        sendUpdate(initialPlayer);
    }, [wallet.publicKey, readyPlayers, sendUpdate]);

    const throttledSendUpdate = useCallback((player: PlayerState) => {
        const now = Date.now();
        if (now - updateThrottleRef.current > 50) {
            updateThrottleRef.current = now;
            sendUpdate(player);
        }
    }, [sendUpdate]);

    const buyPowerUp = useCallback((type: 'speed' | 'shield' | 'health') => {
        if (!myPlayer || !myPlayer.alive) {
            console.log('[PowerUp] Cannot buy - player dead or null');
            return;
        }

        let cost = 0;

        switch (type) {
            case 'speed':
                cost = getSpeedCost;
                console.log('[PowerUp] Speed - Cost:', cost, 'Balance:', virtualBalance, 'HasSpeed:', myPlayer.hasSpeed);

                if (virtualBalance >= cost && !myPlayer.hasSpeed) {
                    setVirtualBalance(prev => prev - cost);
                    setSpeedUses(prev => prev + 1);

                    const updatedPlayer = {
                        ...myPlayer,
                        hasSpeed: true
                    };

                    setMyPlayer(updatedPlayer);
                    sendUpdate(updatedPlayer);
                    toast.success('⚡ Speed activated for 10s!');

                    setTimeout(() => {
                        setMyPlayer(prev => {
                            if (!prev) return null;
                            const deactivated = { ...prev, hasSpeed: false };
                            sendUpdate(deactivated);
                            toast.info('⚡ Speed boost ended');
                            return deactivated;
                        });
                    }, 10000);
                } else {
                    if (virtualBalance < cost) toast.error('Not enough vSOL!');
                    if (myPlayer.hasSpeed) toast.warning('Speed already active!');
                }
                break;

            case 'shield':
                cost = getShieldCost;
                console.log('[PowerUp] Shield - Cost:', cost, 'Balance:', virtualBalance, 'HasShield:', myPlayer.hasShield);

                if (virtualBalance >= cost && !myPlayer.hasShield) {
                    setVirtualBalance(prev => prev - cost);
                    setShieldUses(prev => prev + 1);

                    const updatedPlayer = { ...myPlayer, hasShield: true };

                    setMyPlayer(updatedPlayer);
                    sendUpdate(updatedPlayer);
                    toast.success('🛡️ Shield activated for 8s!');

                    setTimeout(() => {
                        setMyPlayer(prev => {
                            if (!prev) return null;
                            const deactivated = { ...prev, hasShield: false };
                            sendUpdate(deactivated);
                            toast.info('🛡️ Shield expired');
                            return deactivated;
                        });
                    }, 8000);
                } else {
                    if (virtualBalance < cost) toast.error('Not enough vSOL!');
                    if (myPlayer.hasShield) toast.warning('Shield already active!');
                }
                break;

            case 'health':
                cost = getHealthCost;
                console.log('[PowerUp] Health - Cost:', cost, 'Balance:', virtualBalance, 'HP:', myPlayer.hp, 'MaxHP:', myPlayer.maxHp);

                if (virtualBalance >= cost && myPlayer.hp < myPlayer.maxHp) {
                    setVirtualBalance(prev => prev - cost);
                    setHealthUses(prev => prev + 1);

                    const healAmount = 200;
                    const updatedPlayer = {
                        ...myPlayer,
                        hp: Math.min(myPlayer.maxHp, myPlayer.hp + healAmount)
                    };

                    setMyPlayer(updatedPlayer);
                    sendUpdate(updatedPlayer);
                    toast.success(`❤️ Restored ${healAmount} HP!`);
                } else {
                    if (virtualBalance < cost) toast.error('Not enough vSOL!');
                    if (myPlayer.hp >= myPlayer.maxHp) toast.warning('HP already full!');
                }
                break;
        }
    }, [myPlayer, virtualBalance, getSpeedCost, getShieldCost, getHealthCost, sendUpdate]);

    useEffect(() => {
        if (!countdown.isActive && !gameStarted && wallet.publicKey && readyPlayers.length > 0 && isConnected) {
            const timer = setTimeout(() => {
                setGameStarted(true);
                initializePlayer();
                toast.success('⚔️ Battle started!');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown.isActive, gameStarted, wallet.publicKey, readyPlayers.length, isConnected, initializePlayer]);

    // ✅ OPTIMIZED: Fetch balance ONLY on game start and when buying power-ups
    useEffect(() => {
        const fetchBalance = async () => {
            if (!wallet.publicKey || !solanaGame || !gameStarted) return;

            const now = Date.now();
            if (now - lastBalanceFetchRef.current < 10000) return; // Max 1 request per 10 seconds
            lastBalanceFetchRef.current = now;

            try {
                const playerState = await solanaGame.getPlayerState(gameId, wallet.publicKey);
                if (playerState) {
                    setVirtualBalance(playerState.virtualBalance / 1e9);
                }
            } catch (error) {
                console.error('[Balance] Fetch failed:', error);
            }
        };

        if (gameStarted) {
            fetchBalance(); // Initial fetch only
        }
    }, [gameStarted, gameId, wallet.publicKey, solanaGame]);

    useEffect(() => {
        if (!gameStarted || gameEnded) return;
        const timer = setInterval(() => setGameTime(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, [gameStarted, gameEnded]);

    useEffect(() => {
        if (!gameStarted || gameEnded) return;

        const shrinkRate = (300 - 25) / (phase3Duration * 60);

        const interval = setInterval(() => {
            setSafeZone(prev => ({
                ...prev,
                radius: Math.max(25, prev.radius - shrinkRate)
            }));
        }, 16);

        return () => clearInterval(interval);
    }, [gameStarted, phase3Duration, gameEnded]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === '1') buyPowerUp('speed');
            if (e.key === '2') buyPowerUp('shield');
            if (e.key === '3') buyPowerUp('health');
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [buyPowerUp]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        setMouse({
            x: (e.clientX - rect.left) * (900 / rect.width),
            y: (e.clientY - rect.top) * (700 / rect.height)
        });
    }, []);

    // ✅ MOBILE: Touch controls
    const handleTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || !e.touches[0]) return;

        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        setMouse({
            x: (touch.clientX - rect.left) * (900 / rect.width),
            y: (touch.clientY - rect.top) * (700 / rect.height)
        });
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !gameStarted) return;

        canvas.width = 900;
        canvas.height = 700;
        canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchstart', handleTouchMove, { passive: false });

        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchstart', handleTouchMove);
        };
    }, [handleMouseMove, handleTouchMove, gameStarted]);

    const isOutsideSafeZone = useCallback((x: number, y: number) => {
        const dx = x - safeZone.x;
        const dy = y - safeZone.y;
        return (dx * dx + dy * dy) > (safeZone.radius * safeZone.radius);
    }, [safeZone]);

    // ✅ ENHANCED COLLISION with push force and damage
    const handlePlayerCollision = useCallback((p1: PlayerState, p2: PlayerState) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = p1.radius + p2.radius;

        if (distance < minDistance && distance > 0) {
            // Calculate push force
            const overlap = minDistance - distance;
            const pushForce = overlap * 0.5;
            const angle = Math.atan2(dy, dx);
            const pushX = Math.cos(angle) * pushForce;
            const pushY = Math.sin(angle) * pushForce;

            // Shield collision - push back and explosion
            if (p1.hasShield && !p2.hasShield) {
                createExplosion(p2.x, p2.y, p2.color);
                toast.warning('💥 Shield collision!');
                return { pushX: pushX * 2, pushY: pushY * 2, damage: 0 }; // Double push with shield
            }
            // Speed collision - faster push
            else if (p1.hasSpeed && !p2.hasSpeed) {
                createExplosion((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, '#f59e0b');
                return { pushX: pushX * 1.5, pushY: pushY * 1.5, damage: 0 };
            }
            // Normal collision - mutual push
            else {
                return { pushX, pushY, damage: 0 };
            }
        }

        return null;
    }, [createExplosion]);

    // ✅ Check if mouse is inside canvas bounds
    const isMouseInCanvas = useCallback(() => {
        return mouse.x >= 0 && mouse.x <= 900 && mouse.y >= 0 && mouse.y <= 700;
    }, [mouse]);

    const gameLoop = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { alpha: false });

        if (!canvas || !ctx || !myPlayer || !gameStarted || gameEnded) return;

        const now = Date.now();
        const deltaTime = (now - lastUpdateTimeRef.current) / 1000;
        lastUpdateTimeRef.current = now;

        // Enhanced background
        const gradient = ctx.createRadialGradient(450, 350, 0, 450, 350, 500);
        gradient.addColorStop(0, 'rgba(30, 0, 0, 0.95)');
        gradient.addColorStop(0.5, 'rgba(20, 0, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 900, 700);

        // Grid overlay
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

        const safeZoneTime = now * 0.005;
        const pulseEffect = Math.sin(safeZoneTime) * 0.3 + 0.7;

        // Death zone
        ctx.fillStyle = 'rgba(139, 0, 0, 0.3)';
        ctx.fillRect(0, 0, 900, 700);

        // Safe zone cutout
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(safeZone.x, safeZone.y, Math.max(25, safeZone.radius), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // Safe zone border
        const zoneColor = safeZone.radius <= 50 ? 'rgba(255, 165, 0, ' : 'rgba(0, 255, 0, ';
        ctx.strokeStyle = `${zoneColor}${pulseEffect})`;
        ctx.lineWidth = safeZone.radius <= 50 ? 6 : 4;
        ctx.beginPath();
        ctx.arc(safeZone.x, safeZone.y, Math.max(25, safeZone.radius), 0, Math.PI * 2);
        ctx.stroke();

        // Danger border
        const dangerIntensity = safeZone.radius <= 50 ? 1.2 : 1.0;
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulseEffect * dangerIntensity})`;
        ctx.lineWidth = safeZone.radius <= 50 ? 8 : 6;
        ctx.setLineDash([15, 8]);
        ctx.beginPath();
        ctx.arc(safeZone.x, safeZone.y, Math.max(40, safeZone.radius + 15), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Final zone warning
        if (safeZone.radius <= 40) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 3;
            const warningText = 'FINAL ZONE!';
            ctx.strokeText(warningText, 450, 100);
            ctx.fillText(warningText, 450, 100);
        }

        // Update my player with trail
        if (myPlayer.alive) {
            const dx = mouse.x - myPlayer.x;
            const dy = mouse.y - myPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 2) {
                const speed = myPlayer.hasSpeed ? 5 : 3;
                const moveX = (dx / distance) * speed;
                const moveY = (dy / distance) * speed;

                let newX = Math.max(20, Math.min(880, myPlayer.x + moveX));
                let newY = Math.max(20, Math.min(680, myPlayer.y + moveY));

                // ✅ Check collisions with other players and apply push
                Array.from(interpolatedPlayersRef.current.values()).forEach(otherPlayer => {
                    if (otherPlayer.id !== myPlayer.id && otherPlayer.alive) {
                        const tempPlayer = { ...myPlayer, x: newX, y: newY };
                        const collision = handlePlayerCollision(tempPlayer, otherPlayer);

                        if (collision) {
                            // Apply push force to my player
                            newX += collision.pushX;
                            newY += collision.pushY;

                            // Keep within bounds
                            newX = Math.max(20, Math.min(880, newX));
                            newY = Math.max(20, Math.min(680, newY));

                            // Send push update to other player (they should be pushed back)
                            const pushedOtherPlayer = {
                                ...otherPlayer,
                                x: Math.max(20, Math.min(880, otherPlayer.x - collision.pushX)),
                                y: Math.max(20, Math.min(680, otherPlayer.y - collision.pushY))
                            };
                            // Update their interpolated position
                            interpolatedPlayersRef.current.set(otherPlayer.id, pushedOtherPlayer);
                        }
                    }
                });

                let newHp = myPlayer.hp;

                // ✅ Only take damage if mouse is in canvas AND outside safe zone
                if (isMouseInCanvas() && isOutsideSafeZone(newX, newY)) {
                    newHp = Math.max(0, myPlayer.hp - 1);
                } else if (!isMouseInCanvas() && isOutsideSafeZone(newX, newY)) {
                    // Player is outside canvas - no HP loss
                    newHp = myPlayer.hp;
                }

                const trail = [...(myPlayer.trail || []), createTrailParticle(myPlayer.x, myPlayer.y)];
                if (trail.length > 8) trail.shift();

                const updatedPlayer = {
                    ...myPlayer,
                    x: newX,
                    y: newY,
                    hp: newHp,
                    vx: moveX,
                    vy: moveY,
                    alive: newHp > 0,
                    trail,
                    pulsePhase: (myPlayer.pulsePhase || 0) + 0.15
                };

                setMyPlayer(updatedPlayer);
                interpolatedPlayersRef.current.set(updatedPlayer.id, updatedPlayer);
                throttledSendUpdate(updatedPlayer);

                if (newHp <= 0 && myPlayer.alive) {
                    createExplosion(myPlayer.x, myPlayer.y, myPlayer.color);
                    sendEliminated();
                    toast.error('💀 You have been eliminated!');
                }
            }
        }

        // Interpolate other players
        const interpolationFactor = Math.min(deltaTime * 10, 1);
        otherPlayers.forEach((serverPlayer, playerId) => {
            const current = interpolatedPlayersRef.current.get(playerId);
            if (current && current.alive) {
                const interpolated = {
                    ...serverPlayer,
                    x: lerp(current.x, serverPlayer.x, interpolationFactor),
                    y: lerp(current.y, serverPlayer.y, interpolationFactor),
                };
                interpolatedPlayersRef.current.set(playerId, interpolated);
            } else {
                interpolatedPlayersRef.current.set(playerId, serverPlayer);
            }
        });

        // Update and draw particles
        if (particlesRef.current) {
            particlesRef.current = particlesRef.current.filter(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.vx *= 0.95;
                particle.vy *= 0.95;
                particle.life--;

                if (particle.life > 0) {
                    const alpha = particle.life / particle.maxLife;
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
                    ctx.fillStyle = particle.color.includes('rgba') ? particle.color : particle.color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
                    ctx.fill();
                    return true;
                }
                return false;
            });
        }

        // Enhanced drawing function
        const drawPlayer = (p: PlayerState, isMe: boolean) => {
            if (!p.alive) return;

            // Trail
            if (p.trail && p.trail.length > 0) {
                p.trail.forEach((point, index) => {
                    const alpha = (index + 1) / p.trail.length * 0.5;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, p.radius * 0.2 * alpha, 0, Math.PI * 2);
                    ctx.fillStyle = p.color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
                    ctx.fill();
                });
            }

            const pulseRadius = p.radius + Math.sin(p.pulsePhase || 0) * 1.5;

            // Glow
            const glowGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulseRadius * 1.8);
            glowGradient.addColorStop(0, p.color.replace('hsl', 'hsla').replace(')', ', 0.6)'));
            glowGradient.addColorStop(0.6, p.color.replace('hsl', 'hsla').replace(')', ', 0.2)'));
            glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, pulseRadius * 1.8, 0, Math.PI * 2);
            ctx.fill();

            // Shield
            if (p.hasShield) {
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#60a5fa';
                ctx.beginPath();
                ctx.arc(p.x, p.y, pulseRadius + 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Speed
            if (p.hasSpeed) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#fbbf24';
                ctx.beginPath();
                ctx.arc(p.x, p.y, pulseRadius + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Body with gradient
            const bodyGradient = ctx.createRadialGradient(p.x - pulseRadius / 3, p.y - pulseRadius / 3, 0, p.x, p.y, pulseRadius);
            bodyGradient.addColorStop(0, p.color.replace('hsl', 'hsla').replace(')', ', 1)'));
            bodyGradient.addColorStop(0.7, p.color);
            bodyGradient.addColorStop(1, p.color.replace(/\d+%/, '25%'));
            ctx.beginPath();
            ctx.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = bodyGradient;
            ctx.fill();

            // Highlight
            ctx.beginPath();
            ctx.arc(p.x - pulseRadius / 4, p.y - pulseRadius / 4, pulseRadius / 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();

            // Name
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            const displayName = isMe ? myPlayer.name : p.name;
            ctx.strokeText(displayName, p.x, p.y - pulseRadius - 15);
            ctx.fillText(displayName, p.x, p.y - pulseRadius - 15);

            // HP Bar
            const barWidth = pulseRadius * 1.8;
            const barHeight = 4;
            const barX = p.x - barWidth / 2;
            const barY = p.y - pulseRadius - 30;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

            const hpPercent = p.hp / p.maxHp;
            ctx.fillStyle = hpPercent > 0.6 ? '#22c55e' : hpPercent > 0.3 ? '#f59e0b' : '#ef4444';
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            // HP Text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 8px Arial';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.strokeText(`${p.hp}/${p.maxHp}`, p.x, barY - 6);
            ctx.fillText(`${p.hp}/${p.maxHp}`, p.x, barY - 6);
        };

        // Draw all players
        drawPlayer(myPlayer, true);
        interpolatedPlayersRef.current.forEach((player, playerId) => {
            if (playerId !== myPlayer.id) {
                drawPlayer(player, false);
            }
        });

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

        // Arena border
        const borderTime = now * 0.002;
        const borderGlow = Math.sin(borderTime) * 0.4 + 0.6;
        ctx.strokeStyle = `rgba(255, 0, 0, ${borderGlow})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, 898, 698);

        animationRef.current = requestAnimationFrame(gameLoop);
    }, [myPlayer, otherPlayers, mouse, safeZone, gameStarted, gameEnded, throttledSendUpdate, sendEliminated, isOutsideSafeZone, createExplosion, createTrailParticle, handlePlayerCollision, isMouseInCanvas]);

    useEffect(() => {
        if (gameStarted && !gameEnded && myPlayer) {
            lastUpdateTimeRef.current = Date.now();
            animationRef.current = requestAnimationFrame(gameLoop);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [gameStarted, gameEnded, myPlayer, gameLoop]);

    useEffect(() => {
        if (!gameStarted || gameEnded || !myPlayer || winnerDeclared || !isConnected) return;

        const aliveCount = Array.from(otherPlayers.values()).filter(p => p.alive).length + (myPlayer.alive ? 1 : 0);

        if (aliveCount === 1 && myPlayer.alive && otherPlayers.size >= readyPlayers.length - 1) {
            setWinnerDeclared(true);
            sendWinner(myPlayer.id);
            setGameEnded(true);

            setTimeout(() => {
                onGameEnd(wallet.publicKey!);
            }, 2000);
        }
    }, [otherPlayers, myPlayer?.alive, gameStarted, gameEnded, isConnected, readyPlayers.length, winnerDeclared, sendWinner, wallet.publicKey, onGameEnd, myPlayer]);

    useEffect(() => {
        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    const remainingPlayers = Array.from(otherPlayers.values()).filter(p => p.alive).length + (myPlayer?.alive ? 1 : 0);

    // COUNTDOWN SCREEN
    if (countdown.isActive && countdown.remaining > 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black flex items-center justify-center">
                <ParticleBackground />
                <div className="relative z-10 max-w-4xl mx-auto p-8 text-center">
                    <div className="flex items-center justify-center gap-4 mb-8">
                        {isConnected ? (
                            <Wifi className="w-12 h-12 text-green-400 animate-pulse" />
                        ) : (
                            <WifiOff className="w-12 h-12 text-red-400 animate-pulse" />
                        )}
                        <span className="text-2xl font-bold text-gray-300">
                            {isConnected ? 'CONNECTED' : 'CONNECTING...'}
                        </span>
                    </div>

                    <div className="text-9xl font-black mb-8 animate-pulse text-red-500">
                        {countdown.remaining}
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
                                <p className="text-sm">Stay inside the green circle or lose HP continuously.</p>
                            </div>
                            <div className="bg-red-900/30 p-4 rounded-lg">
                                <p className="font-bold text-red-300 mb-2">⚡ Power-Ups</p>
                                <p className="text-sm">Use vSOL to buy boosts. Cost increases with each use.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                        <p className="text-yellow-300 font-bold">
                            🔥 {readyPlayers.length} Warriors Ready • Winner Takes All 🔥
                        </p>
                    </div>

                    {!isConnected && (
                        <div className="mt-6 bg-red-900/40 border border-red-500 rounded-lg p-4 flex items-center justify-center gap-3">
                            <AlertCircle className="w-6 h-6 text-red-400" />
                            <p className="text-red-300 font-semibold">Connecting to game server...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // MAIN GAME SCREEN
    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black relative overflow-hidden">
            <ParticleBackground />

            <div className="fixed inset-0 bg-gradient-to-b from-transparent via-red-900/10 to-black/30 pointer-events-none"></div>
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none"></div>

            {/* Top Stats Bar - MOBILE RESPONSIVE */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b-2 border-red-600/50 p-2 sm:p-4">
                <div className="flex justify-center gap-2 sm:gap-8 flex-wrap text-xs sm:text-base">
                    <div className="text-center group">
                        <div className="text-lg sm:text-3xl font-black text-green-400 font-mono tracking-wider group-hover:text-green-300 transition-colors">
                            {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}
                        </div>
                        <div className="text-[10px] sm:text-xs text-red-300 font-semibold tracking-wide">TIME</div>
                    </div>

                    <div className="text-center group">
                        <div className="text-lg sm:text-3xl font-black text-red-400 group-hover:text-red-300 transition-colors">{remainingPlayers}</div>
                        <div className="text-[10px] sm:text-xs text-red-300 font-semibold tracking-wide">ALIVE</div>
                    </div>

                    <div className="text-center group">
                        <div className="text-lg sm:text-3xl font-black text-orange-400 group-hover:text-orange-300 transition-colors">{eliminated}</div>
                        <div className="text-[10px] sm:text-xs text-red-300 font-semibold tracking-wide">DEAD</div>
                    </div>

                    <div className="text-center group">
                        <div className="text-lg sm:text-3xl font-black text-cyan-400 flex items-center gap-1 sm:gap-2 group-hover:text-cyan-300 transition-colors">
                            <Coins className="w-4 h-4 sm:w-6 sm:h-6" />
                            {virtualBalance.toFixed(0)}
                        </div>
                        <div className="text-[10px] sm:text-xs text-red-300 font-semibold tracking-wide">vSOL</div>
                    </div>

                    <div className="text-center group">
                        <div className="text-lg sm:text-3xl font-black text-pink-400 flex items-center gap-1 sm:gap-2 group-hover:text-pink-300 transition-colors">
                            <Heart className="w-4 h-4 sm:w-6 sm:h-6" />
                            {myPlayer?.hp || 0}
                        </div>
                        <div className="text-[10px] sm:text-xs text-red-300 font-semibold tracking-wide">HP</div>
                    </div>

                    <div className="text-center group hidden sm:block">
                        <div className="text-xl sm:text-2xl font-black text-cyan-400 group-hover:text-cyan-300 transition-colors">
                            {Math.round(safeZone.radius)}m
                        </div>
                        <div className="text-xs text-red-300 font-semibold tracking-wide">ZONE</div>
                    </div>

                    <div className="text-center">
                        <div className={`text-lg sm:text-2xl font-black flex items-center gap-1 sm:gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                            {isConnected ? <Wifi className="w-4 h-4 sm:w-6 sm:h-6" /> : <WifiOff className="w-4 h-4 sm:w-6 sm:h-6" />}
                        </div>
                        <div className="text-[10px] sm:text-xs text-red-300 font-semibold tracking-wide hidden sm:block">{isConnected ? 'ON' : 'OFF'}</div>
                    </div>
                </div>
            </div>

            {/* Power-ups Bar - MOBILE: Bottom, DESKTOP: Right */}
            <div className="fixed bottom-4 left-0 right-0 sm:right-4 sm:left-auto sm:top-1/2 sm:-translate-y-1/2 sm:bottom-auto z-40 px-4 sm:px-0">
                <div className="bg-black/90 backdrop-blur-xl border-2 border-red-600/50 rounded-xl p-3 sm:p-4 shadow-2xl shadow-red-900/50 max-w-full sm:max-w-[200px] mx-auto">
                    <div className="text-center mb-2 sm:mb-3">
                        <h3 className="text-xs sm:text-sm font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent mb-1">
                            💀 ARSENAL 💀
                        </h3>
                        <p className="text-red-300 text-[10px] sm:text-xs">Press 1, 2, 3</p>
                    </div>
                    <div className="flex sm:flex-col gap-2 sm:gap-3 justify-center">
                        <Button
                            onClick={() => buyPowerUp('speed')}
                            disabled={virtualBalance < getSpeedCost || myPlayer?.hasSpeed || !myPlayer?.alive}
                            className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed px-2 sm:px-3 py-2 sm:py-2.5 font-bold text-white text-[10px] sm:text-xs border-2 border-yellow-500/50 shadow-lg hover:shadow-yellow-500/25 transition-all flex-1 sm:w-full"
                        >
                            <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                                <div className="flex items-center gap-1">
                                    <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">[1] SPEED</span>
                                    <span className="sm:hidden">SPD</span>
                                </div>
                                <span className="text-[9px] sm:text-xs opacity-75">({getSpeedCost})</span>
                            </div>
                        </Button>

                        <Button
                            onClick={() => buyPowerUp('shield')}
                            disabled={virtualBalance < getShieldCost || myPlayer?.hasShield || !myPlayer?.alive}
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed px-2 sm:px-3 py-2 sm:py-2.5 font-bold text-white text-[10px] sm:text-xs border-2 border-blue-500/50 shadow-lg hover:shadow-blue-500/25 transition-all flex-1 sm:w-full"
                        >
                            <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                                <div className="flex items-center gap-1">
                                    <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">[2] SHIELD</span>
                                    <span className="sm:hidden">SHD</span>
                                </div>
                                <span className="text-[9px] sm:text-xs opacity-75">({getShieldCost})</span>
                            </div>
                        </Button>

                        <Button
                            onClick={() => buyPowerUp('health')}
                            disabled={virtualBalance < getHealthCost || !myPlayer || myPlayer.hp >= myPlayer.maxHp || !myPlayer?.alive}
                            className="bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-2 sm:px-3 py-2 sm:py-2.5 font-bold text-white text-[10px] sm:text-xs border-2 border-pink-500/50 shadow-lg hover:shadow-pink-500/25 transition-all flex-1 sm:w-full"
                        >
                            <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                                <div className="flex items-center gap-1">
                                    <Heart className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">[3] HEALTH</span>
                                    <span className="sm:hidden">HP</span>
                                </div>
                                <span className="text-[9px] sm:text-xs opacity-75">({getHealthCost})</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Game Canvas - MOBILE FRIENDLY */}
            <div className="flex items-start justify-center min-h-screen pt-16 sm:pt-24 pb-20 sm:pb-8 px-2 sm:px-4">
                <div className="bg-gradient-to-br from-black/90 to-red-950/40 backdrop-blur-xl border-2 sm:border-4 border-red-600/60 rounded-xl sm:rounded-2xl p-2 sm:p-4 shadow-2xl shadow-red-900/70 relative overflow-hidden w-full max-w-[920px]">
                    <div className="absolute top-0 left-0 w-full h-1 sm:h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>
                    <div className="absolute bottom-0 left-0 w-full h-1 sm:h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>

                    <canvas
                        ref={canvasRef}
                        width={900}
                        height={700}
                        className="rounded-lg sm:rounded-xl cursor-none touch-none bg-black border border-red-500/50 sm:border-2 shadow-inner w-full h-auto"
                        style={{ aspectRatio: '900/700', maxWidth: '100%', display: 'block' }}
                    />
                    <div className="text-center mt-2 sm:mt-3 text-red-300 text-[10px] sm:text-sm font-semibold tracking-wide animate-pulse">
                        💀 SURVIVE • ZONE: {Math.round(safeZone.radius)}m 💀
                    </div>
                </div>
            </div>

            {/* Game Over Screen */}
            {gameEnded && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-gradient-to-br from-black/95 to-red-950/80 border-4 border-red-500 rounded-2xl p-12 max-w-2xl mx-4 text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent animate-pulse"></div>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>

                        <div className="mb-8 relative z-10">
                            {myPlayer?.alive ? (
                                <>
                                    <div className="text-9xl mb-6 animate-bounce">👑</div>
                                    <h2 className="text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-4 drop-shadow-2xl">
                                        ULTIMATE SURVIVOR
                                    </h2>
                                    <p className="text-2xl text-yellow-300 font-bold tracking-wide mb-4">
                                        YOU HAVE CONQUERED THE ARENA
                                    </p>
                                    <p className="text-red-300 text-lg">
                                        Blood has been spilled. Bodies have fallen. You alone remain.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="text-9xl mb-6 animate-pulse">💀</div>
                                    <h2 className="text-6xl font-black bg-gradient-to-r from-red-500 via-red-400 to-orange-500 bg-clip-text text-transparent mb-4 drop-shadow-2xl">
                                        ELIMINATED
                                    </h2>
                                    <p className="text-2xl text-red-400 font-bold tracking-wide mb-4">
                                        YOUR JOURNEY ENDS HERE
                                    </p>
                                    <p className="text-red-300 text-lg">
                                        You fought bravely, but the arena has claimed another soul.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
                            <div className="bg-black/60 border border-red-500/50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-green-400 mb-2">
                                    {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}
                                </div>
                                <div className="text-sm text-red-300">Time Survived</div>
                                <div className="text-xs text-red-400 mt-1">Every second was a victory</div>
                            </div>

                            <div className="bg-black/60 border border-red-500/50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-red-400 mb-2">{eliminated}</div>
                                <div className="text-sm text-red-300">Players Eliminated</div>
                                <div className="text-xs text-red-400 mt-1">Casualties of war</div>
                            </div>

                            <div className="bg-black/60 border border-red-500/50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-cyan-400 mb-2">
                                    {Math.round(safeZone.radius)}m
                                </div>
                                <div className="text-sm text-red-300">Final Zone Size</div>
                                <div className="text-xs text-red-400 mt-1">The last battlefield</div>
                            </div>
                        </div>

                        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 relative z-10">
                            <p className="text-yellow-300 font-bold text-lg">
                                {myPlayer?.alive
                                    ? '🏆 Winner claimed - Processing blockchain transaction...'
                                    : '⏳ Waiting for final results...'}
                            </p>
                        </div>

                        {myPlayer?.alive && (
                            <div className="mt-6 text-green-400 text-sm animate-pulse relative z-10">
                                ✓ Prize pool will be distributed shortly
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurgeGameMultiplayer;