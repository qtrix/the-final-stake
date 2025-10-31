// src/pages/PurgeGameMultiplayer.tsx - ENHANCED VISUALS
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, Heart, Zap, Users, Clock, Target, Skull, Trophy, Swords } from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import { useGameWinnerFlow } from '@/hooks/useGameWinnerFlow';

interface PlayerState {
    id: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    speed: number;
    hasShield: boolean;
    alive: boolean;
    color: string;
}

interface ExplosionParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface TrailPoint {
    x: number;
    y: number;
    life: number;
    color: string;
}

interface SafeZone {
    x: number;
    y: number;
    radius: number;
    targetRadius: number;
}

interface PurgeGameMultiplayerProps {
    gameId: string;
    prizePool: number;
    onGameEnd?: (winner: string) => void;
}

const PurgeGameMultiplayer: React.FC<PurgeGameMultiplayerProps> = ({
    gameId,
    prizePool,
    onGameEnd
}) => {
    const wallet = useWallet();
    const navigate = useNavigate();
    const solanaGame = useSolanaGame();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const keysRef = useRef<Set<string>>(new Set());
    const mouseRef = useRef({ x: 0, y: 0 });
    const lastUpdateTimeRef = useRef<number>(0);
    const updateThrottleRef = useRef<number>(0);
    const interpolatedPlayersRef = useRef<Map<string, PlayerState>>(new Map());
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const gameStartTimeRef = useRef<number>(0);
    const trailPointsRef = useRef<TrailPoint[]>([]);

    const [myPlayer, setMyPlayer] = useState<PlayerState | null>(null);
    const [allPlayers, setAllPlayers] = useState<Map<string, PlayerState>>(new Map());
    const [gameStarted, setGameStarted] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [countdown, setCountdown] = useState<{ remaining: number; isActive: boolean }>({
        remaining: 0,
        isActive: false
    });
    const [explosions, setExplosions] = useState<ExplosionParticle[]>([]);
    const [safeZone, setSafeZone] = useState<SafeZone>({
        x: 450,
        y: 350,
        radius: 400,
        targetRadius: 50
    });
    const [gameTime, setGameTime] = useState(0);
    const [eliminated, setEliminated] = useState(0);
    const [virtualBalance, setVirtualBalance] = useState(0);
    const [speedUses, setSpeedUses] = useState(0);
    const [shieldUses, setShieldUses] = useState(0);
    const [healthUses, setHealthUses] = useState(0);
    const [winnerDeclared, setWinnerDeclared] = useState(false);
    const [isGameEnded, setIsGameEnded] = useState(false);

    const getSpeedCost = useMemo(() => 100 + (speedUses * 50), [speedUses]);
    const getShieldCost = useMemo(() => 150 + (shieldUses * 75), [shieldUses]);
    const getHealthCost = useMemo(() => 50 + (healthUses * 25), [healthUses]);
    const [serverWinner, setServerWinner] = useState<string | null>(null);

    const {
        isConnected,
        otherPlayers,
        gamePhase,
        sendUpdate,
        sendEliminated,
        sendWinner,
        readyPlayers,
        sendMarkReady
    } = useMultiplayerGame({
        gameId,
        enabled: true,
        onPlayerUpdate: useCallback((playerId: string, state: PlayerState) => {
            interpolatedPlayersRef.current.set(playerId, state);
            setAllPlayers(prev => {
                const updated = new Map(prev);
                updated.set(playerId, state);
                return updated;
            });
        }, []),
        onPlayerEliminated: useCallback((playerId) => {
            setEliminated(prev => prev + 1);
            setAllPlayers(prev => {
                const updated = new Map(prev);
                const player = updated.get(playerId);
                if (player) {
                    updated.set(playerId, { ...player, alive: false, hp: 0 });
                }
                return updated;
            });
        }, []),
        onWinnerDeclared: useCallback((winnerId, prizeAmount) => {  // ✅ MODIFICAT
            console.log('[PurgeGame] 🏆 Winner declared:', winnerId.slice(0, 8));
            setGameEnded(true);
            setWinnerDeclared(true);
            setServerWinner(winnerId); // ✅ LINIA NOUĂ

            if (winnerId !== wallet.publicKey?.toBase58()) {
                toast.success('🏆 Winner declared!');
            }
        }, [wallet.publicKey]),

        // ✅ ADAUGĂ ACEST HANDLER NOU:
        onGameEnded: useCallback(() => {
            console.log('[PurgeGame] 🛑 Game ended by server');
            setIsGameEnded(true);
            setGameEnded(true);
        }, []),
        onGamePhaseChange: useCallback((phase) => {
            if (phase === 'countdown') {
                setCountdown({ remaining: 10, isActive: true });
            } else if (phase === 'active') {
                setGameStarted(true);
                setCountdown({ remaining: 0, isActive: false });
                gameStartTimeRef.current = Date.now();
            } else if (phase === 'ended') {
                setGameEnded(true);
            }
        }, []),
        onCountdownSync: useCallback((startTime: number, duration: number) => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, duration - elapsed);
            setCountdown({ remaining, isActive: remaining > 0 });

            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }

            countdownIntervalRef.current = setInterval(() => {
                const newElapsed = (Date.now() - startTime) / 1000;
                const newRemaining = Math.max(0, duration - newElapsed);
                setCountdown({ remaining: newRemaining, isActive: newRemaining > 0 });
                if (newRemaining <= 0) clearInterval(countdownIntervalRef.current!);
            }, 100);
        }, []),
        onGameStateSync: useCallback((syncedTime: number, syncedRadius: number) => {
            setGameTime(syncedTime);
            setSafeZone(prev => ({ ...prev, radius: syncedRadius }));
        }, [])
    });

    useEffect(() => {
        if (isConnected && wallet.publicKey && !readyPlayers.includes(wallet.publicKey.toBase58())) {
            setTimeout(() => {
                sendMarkReady();
            }, 500);
        }
    }, [isConnected, wallet.publicKey, readyPlayers, sendMarkReady]);
    const { declareWinner, isProcessingWinner } = useGameWinnerFlow({
        gameId,
        sendWinner,

        // ✅ ADAUGĂ acești 3 parametri:
        serverWinner: serverWinner,
        serverGameStatus: isGameEnded || gameEnded ? 'ended' : 'active',
        serverPrizeAmount: prizePool,
    });

    console.log('[PurgeGame] 🔍 Hook params:', {
        serverWinner,
        serverGameStatus: (isGameEnded || gameEnded) ? 'ended' : 'active',
        serverPrizeAmount: prizePool,
        isGameEnded,
        gameEnded
    });

    const createExplosion = useCallback((x: number, y: number, color: string): void => {
        const particles: ExplosionParticle[] = [];
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const speed = 3 + Math.random() * 6;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color
            });
        }
        setExplosions(prev => [...prev, ...particles]);
    }, []);

    const initializeAllPlayers = useCallback(async () => {
        if (!wallet.publicKey || !solanaGame) return;

        try {
            const game = solanaGame.games.find(g => g.gameId === parseInt(gameId));
            if (!game) return;

            let readyPlayerAddresses: string[] = [];

            try {
                const readyStates = await solanaGame.getPhase3ReadyStates(parseInt(gameId));
                readyPlayerAddresses = readyStates
                    .filter(state => state.ready)
                    .map(state => state.player);
            } catch (error) {
                console.warn('⚠️ Failed to fetch ready states, using all game players as fallback');
            }

            if (readyPlayerAddresses.length === 0) {
                readyPlayerAddresses = game.players;
            }

            const colors = ['#FF3333', '#33FF33', '#3333FF', '#FFFF33', '#FF33FF', '#33FFFF', '#FF6600', '#00FFFF'];
            const positions = [
                { x: 100, y: 100 },
                { x: 800, y: 100 },
                { x: 100, y: 600 },
                { x: 800, y: 600 },
                { x: 450, y: 100 },
                { x: 450, y: 600 },
                { x: 200, y: 350 },
                { x: 700, y: 350 }
            ];

            const playersMap = new Map<string, PlayerState>();
            const myAddress = wallet.publicKey.toBase58();

            readyPlayerAddresses.forEach((playerAddr, index) => {
                const startPos = positions[index % positions.length];
                const isMe = playerAddr === myAddress;

                const playerState: PlayerState = {
                    id: playerAddr,
                    x: startPos.x,
                    y: startPos.y,
                    hp: 100,
                    maxHp: 100,
                    speed: 3,
                    hasShield: false,
                    alive: true,
                    color: colors[index % colors.length]
                };

                playersMap.set(playerAddr, playerState);

                if (isMe) {
                    setMyPlayer(playerState);
                } else {
                    interpolatedPlayersRef.current.set(playerAddr, playerState);
                }
            });

            setAllPlayers(playersMap);

            if (isConnected) {
                const myState = playersMap.get(myAddress);
                if (myState) {
                    sendUpdate(myState);
                }
            }

        } catch (error) {
            console.error('❌ Failed to initialize players:', error);
        }
    }, [wallet.publicKey, solanaGame, gameId, isConnected, sendUpdate]);

    const throttledSendUpdate = useCallback((player: PlayerState) => {
        const now = performance.now();
        if (now - updateThrottleRef.current > 50) {
            updateThrottleRef.current = now;
            if (isConnected) {
                sendUpdate(player);
            }
        }
    }, [sendUpdate, isConnected]);

    const mouse = useMemo(() => mouseRef.current, [mouseRef.current.x, mouseRef.current.y]);

    const checkPlayerCollisions = useCallback((player: PlayerState, allPlayersMap: Map<string, PlayerState>): PlayerState => {
        let adjustedPlayer = { ...player };
        const playerRadius = 15;

        allPlayersMap.forEach((otherPlayer, otherId) => {
            if (otherId === player.id || !otherPlayer.alive) return;

            const dx = adjustedPlayer.x - otherPlayer.x;
            const dy = adjustedPlayer.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = playerRadius * 2;

            if (distance < minDistance && distance > 0) {
                const overlap = minDistance - distance;
                const angle = Math.atan2(dy, dx);

                adjustedPlayer.x += Math.cos(angle) * overlap * 0.5;
                adjustedPlayer.y += Math.sin(angle) * overlap * 0.5;
            }
        });

        adjustedPlayer.x = Math.max(playerRadius, Math.min(900 - playerRadius, adjustedPlayer.x));
        adjustedPlayer.y = Math.max(playerRadius, Math.min(700 - playerRadius, adjustedPlayer.y));

        return adjustedPlayer;
    }, []);

    const buyPowerUp = useCallback((type: 'speed' | 'shield' | 'health') => {
        if (!myPlayer) return;

        let cost = 0;
        let newPlayer = { ...myPlayer };

        switch (type) {
            case 'speed':
                cost = getSpeedCost;
                if (virtualBalance >= cost) {
                    newPlayer.speed += 0.5;
                    setSpeedUses(prev => prev + 1);
                    setVirtualBalance(prev => prev - cost);
                    toast.success(`⚡ Speed increased to ${newPlayer.speed.toFixed(1)}!`);
                } else {
                    toast.error('Insufficient balance');
                    return;
                }
                break;
            case 'shield':
                cost = getShieldCost;
                if (virtualBalance >= cost && !newPlayer.hasShield) {
                    newPlayer.hasShield = true;
                    setShieldUses(prev => prev + 1);
                    setVirtualBalance(prev => prev - cost);
                    toast.success('🛡️ Shield activated!');
                } else if (newPlayer.hasShield) {
                    toast.error('Shield already active');
                    return;
                } else {
                    toast.error('Insufficient balance');
                    return;
                }
                break;
            case 'health':
                cost = getHealthCost;
                if (virtualBalance >= cost && newPlayer.hp < newPlayer.maxHp) {
                    newPlayer.hp = Math.min(newPlayer.maxHp, newPlayer.hp + 30);
                    setHealthUses(prev => prev + 1);
                    setVirtualBalance(prev => prev - cost);
                    toast.success('❤️ Health restored!');
                } else if (newPlayer.hp >= newPlayer.maxHp) {
                    toast.error('Health already full');
                    return;
                } else {
                    toast.error('Insufficient balance');
                    return;
                }
                break;
        }

        setMyPlayer(newPlayer);
        sendUpdate(newPlayer);
    }, [myPlayer, virtualBalance, getSpeedCost, getShieldCost, getHealthCost, sendUpdate]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (gameStarted && !gameEnded) {
            canvas.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.key.toLowerCase());

            if (e.key === '1') {
                buyPowerUp('speed');
                e.preventDefault();
            } else if (e.key === '2') {
                buyPowerUp('shield');
                e.preventDefault();
            } else if (e.key === '3') {
                buyPowerUp('health');
                e.preventDefault();
            }

            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key.toLowerCase());
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = 900 / rect.width;
            const scaleY = 700 / rect.height;

            mouseRef.current = {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        canvas.addEventListener('mousemove', handleMouseMove);

        const handleMouseEnter = () => {
            canvas.focus();
            canvas.style.cursor = 'none';
        };
        canvas.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [gameStarted, gameEnded, buyPowerUp]);

    useEffect(() => {
        if (!countdown.isActive && !gameStarted && wallet.publicKey && isConnected) {
            initializeAllPlayers();
            setGameStarted(true);
            gameStartTimeRef.current = Date.now();
        }

        if (gameStarted && allPlayers.size === 0 && !myPlayer && wallet.publicKey) {
            initializeAllPlayers();
        }
    }, [countdown.isActive, gameStarted, wallet.publicKey, isConnected, initializeAllPlayers, allPlayers.size, myPlayer]);

    useEffect(() => {
        const fetchInitialBalance = async () => {
            if (!wallet.publicKey || !solanaGame || !gameStarted) return;
            if (virtualBalance !== 0) return;

            try {
                const game = solanaGame.games.find(g => g.gameId === parseInt(gameId));
                if (!game) return;

                try {
                    const playerState = await solanaGame.getPlayerState(parseInt(gameId), wallet.publicKey);
                    if (playerState && playerState.virtualBalance) {
                        const balanceInSol = playerState.virtualBalance / 1_000_000_000;
                        setVirtualBalance(balanceInSol);
                        return;
                    }
                } catch (error) {
                    console.warn('⚠️ Could not fetch player state, using default balance');
                }

                const initialBalance = game.entryFee * 10;
                setVirtualBalance(initialBalance);
            } catch (error) {
                console.error('❌ Failed to set initial balance:', error);
            }
        };

        fetchInitialBalance();
    }, [gameStarted, wallet.publicKey, solanaGame, gameId, virtualBalance]);

    useEffect(() => {
        if (explosions.length === 0) return;

        const interval = setInterval(() => {
            setExplosions(prev =>
                prev
                    .map(p => ({
                        ...p,
                        x: p.x + p.vx,
                        y: p.y + p.vy,
                        life: p.life - 0.015
                    }))
                    .filter(p => p.life > 0)
            );
        }, 16);

        return () => clearInterval(interval);
    }, [explosions.length]);

    const isMouseInBounds = useCallback(() => {
        return mouse.x >= 0 && mouse.x <= 900 && mouse.y >= 0 && mouse.y <= 700;
    }, [mouse]);

    const gameLoop = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', {
            alpha: false,
            desynchronized: true
        });

        if (!canvas || !ctx || !myPlayer || !gameStarted || gameEnded) return;

        const now = performance.now();
        const deltaTime = (now - lastUpdateTimeRef.current) / 1000;
        lastUpdateTimeRef.current = now;

        let newPlayer = { ...myPlayer };

        if (newPlayer.alive) {
            let dx = 0;
            let dy = 0;

            if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= 1;
            if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += 1;
            if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= 1;
            if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += 1;

            if (dx !== 0 && dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx /= length;
                dy /= length;
            }

            newPlayer.x += dx * newPlayer.speed * 60 * deltaTime;
            newPlayer.y += dy * newPlayer.speed * 60 * deltaTime;

            if (dx !== 0 || dy !== 0) {
                trailPointsRef.current.push({
                    x: newPlayer.x,
                    y: newPlayer.y,
                    life: 1,
                    color: newPlayer.color
                });
            }

            newPlayer = checkPlayerCollisions(newPlayer, allPlayers);

            const distFromCenter = Math.sqrt(
                Math.pow(newPlayer.x - safeZone.x, 2) + Math.pow(newPlayer.y - safeZone.y, 2)
            );

            if (distFromCenter > safeZone.radius) {
                if (newPlayer.hasShield) {
                    newPlayer.hasShield = false;
                    toast.warning('🛡️ Shield destroyed by zone!');
                } else {
                    newPlayer.hp -= 10 * deltaTime;

                    if (newPlayer.hp <= 0) {
                        newPlayer.hp = 0;
                        newPlayer.alive = false;
                        createExplosion(newPlayer.x, newPlayer.y, newPlayer.color);
                        sendEliminated();
                        toast.error('💀 You have been eliminated!');
                        setMyPlayer(prev => prev ? { ...prev, alive: false } : null);
                    }
                }
            }
        }

        trailPointsRef.current = trailPointsRef.current
            .map(t => ({ ...t, life: t.life - 0.03 }))
            .filter(t => t.life > 0);

        const interpolationFactor = Math.min(deltaTime * 10, 1);
        otherPlayers.forEach((serverPlayer, playerId) => {
            const current = interpolatedPlayersRef.current.get(playerId);
            if (current && current.alive) {
                const interpolated = {
                    ...current,
                    x: current.x + (serverPlayer.x - current.x) * interpolationFactor,
                    y: current.y + (serverPlayer.y - current.y) * interpolationFactor,
                    hp: current.hp + (serverPlayer.hp - current.hp) * interpolationFactor
                };
                interpolatedPlayersRef.current.set(playerId, interpolated);
            } else {
                interpolatedPlayersRef.current.set(playerId, serverPlayer);
            }
        });

        // ENHANCED RENDERING
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 900, 700);

        // Vignette effect
        const vignette = ctx.createRadialGradient(450, 350, 200, 450, 350, 600);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, 900, 700);

        // Enhanced safe zone
        const zoneGradient = ctx.createRadialGradient(
            safeZone.x, safeZone.y, safeZone.radius * 0.7,
            safeZone.x, safeZone.y, safeZone.radius
        );
        zoneGradient.addColorStop(0, 'rgba(0, 255, 0, 0.02)');
        zoneGradient.addColorStop(0.8, 'rgba(255, 100, 0, 0.1)');
        zoneGradient.addColorStop(1, 'rgba(255, 0, 0, 0.4)');

        ctx.fillStyle = zoneGradient;
        ctx.beginPath();
        ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2);
        ctx.fill();

        // Animated danger border
        const time = Date.now() / 1000;
        ctx.strokeStyle = `rgba(255, ${Math.floor(50 + Math.sin(time * 3) * 50)}, 0, ${0.8 + Math.sin(time * 5) * 0.2})`;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = -time * 20;
        ctx.beginPath();
        ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Enhanced trails
        trailPointsRef.current.forEach(trail => {
            ctx.globalAlpha = trail.life * 0.7;
            const trailGrad = ctx.createRadialGradient(trail.x, trail.y, 0, trail.x, trail.y, 8);
            trailGrad.addColorStop(0, trail.color);
            trailGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = trailGrad;
            ctx.beginPath();
            ctx.arc(trail.x, trail.y, 8, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Enhanced explosions
        explosions.forEach(particle => {
            ctx.globalAlpha = particle.life;
            const expGrad = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, 5);
            expGrad.addColorStop(0, particle.color);
            expGrad.addColorStop(1, 'rgba(255,100,0,0)');
            ctx.fillStyle = expGrad;
            ctx.shadowBlur = 10;
            ctx.shadowColor = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;

        // Other players with enhanced effects
        allPlayers.forEach((player, id) => {
            if (!player.alive || id === newPlayer.id) return;

            const displayPlayer = interpolatedPlayersRef.current.get(id) || player;

            // Player glow
            const playerGlow = ctx.createRadialGradient(displayPlayer.x, displayPlayer.y, 5, displayPlayer.x, displayPlayer.y, 25);
            playerGlow.addColorStop(0, displayPlayer.color);
            playerGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = playerGlow;
            ctx.beginPath();
            ctx.arc(displayPlayer.x, displayPlayer.y, 25, 0, Math.PI * 2);
            ctx.fill();

            // Player body
            ctx.fillStyle = displayPlayer.color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = displayPlayer.color;
            ctx.beginPath();
            ctx.arc(displayPlayer.x, displayPlayer.y, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Shield effect
            if (displayPlayer.hasShield) {
                const shieldPulse = 0.7 + Math.sin(time * 8) * 0.3;
                ctx.strokeStyle = `rgba(0, 255, 255, ${shieldPulse})`;
                ctx.lineWidth = 4;
                ctx.shadowBlur = 20 * shieldPulse;
                ctx.shadowColor = '#00FFFF';
                ctx.beginPath();
                ctx.arc(displayPlayer.x, displayPlayer.y, 24, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // HP bar with glow
            const hpPercent = displayPlayer.hp / displayPlayer.maxHp;
            ctx.shadowBlur = 5;
            ctx.shadowColor = hpPercent > 0.3 ? '#00ff00' : '#ff0000';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(displayPlayer.x - 22, displayPlayer.y - 32, 44, 6);

            const hpGrad = ctx.createLinearGradient(displayPlayer.x - 20, 0, displayPlayer.x + 20, 0);
            hpGrad.addColorStop(0, hpPercent > 0.3 ? '#00ff00' : '#ff0000');
            hpGrad.addColorStop(1, hpPercent > 0.3 ? '#00cc00' : '#cc0000');
            ctx.fillStyle = hpGrad;
            ctx.fillRect(displayPlayer.x - 20, displayPlayer.y - 30, 40 * hpPercent, 4);
            ctx.shadowBlur = 0;

            const isConnectedPlayer = otherPlayers.has(id);
            if (!isConnectedPlayer) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 3;
                ctx.shadowColor = '#000';
                ctx.fillText('DISCONNECTED', displayPlayer.x, displayPlayer.y + 35);
                ctx.shadowBlur = 0;
            }
        });

        // My player with superior effects
        if (newPlayer.alive) {
            // Outer glow
            const myGlow = ctx.createRadialGradient(newPlayer.x, newPlayer.y, 5, newPlayer.x, newPlayer.y, 35);
            myGlow.addColorStop(0, newPlayer.color);
            myGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = myGlow;
            ctx.beginPath();
            ctx.arc(newPlayer.x, newPlayer.y, 35, 0, Math.PI * 2);
            ctx.fill();

            // Player body with pulsing glow
            const playerPulse = 0.8 + Math.sin(time * 4) * 0.2;
            ctx.shadowBlur = 25 * playerPulse;
            ctx.shadowColor = newPlayer.color;
            ctx.fillStyle = newPlayer.color;
            ctx.beginPath();
            ctx.arc(newPlayer.x, newPlayer.y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Shield with advanced animation
            if (newPlayer.hasShield) {
                const shieldPulse = 0.6 + Math.sin(time * 6) * 0.4;

                // Outer shield ring
                ctx.strokeStyle = `rgba(0, 255, 255, ${shieldPulse * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(newPlayer.x, newPlayer.y, 28, 0, Math.PI * 2);
                ctx.stroke();

                // Inner shield ring
                ctx.strokeStyle = `rgba(0, 255, 255, ${shieldPulse})`;
                ctx.lineWidth = 5;
                ctx.shadowBlur = 30 * shieldPulse;
                ctx.shadowColor = '#00FFFF';
                ctx.beginPath();
                ctx.arc(newPlayer.x, newPlayer.y, 24, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // HP bar with enhanced visuals
            const myHpPercent = newPlayer.hp / newPlayer.maxHp;
            ctx.shadowBlur = 8;
            ctx.shadowColor = myHpPercent > 0.3 ? '#00ff00' : '#ff0000';

            ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.fillRect(newPlayer.x - 24, newPlayer.y - 34, 48, 8);

            const myHpGrad = ctx.createLinearGradient(newPlayer.x - 22, 0, newPlayer.x + 22, 0);
            if (myHpPercent > 0.5) {
                myHpGrad.addColorStop(0, '#00ff00');
                myHpGrad.addColorStop(1, '#00cc00');
            } else if (myHpPercent > 0.3) {
                myHpGrad.addColorStop(0, '#ffff00');
                myHpGrad.addColorStop(1, '#ff8800');
            } else {
                myHpGrad.addColorStop(0, '#ff0000');
                myHpGrad.addColorStop(1, '#cc0000');
            }
            ctx.fillStyle = myHpGrad;
            ctx.fillRect(newPlayer.x - 22, newPlayer.y - 32, 44 * myHpPercent, 6);
            ctx.shadowBlur = 0;

            // Enhanced crosshair
            if (isMouseInBounds()) {
                const crosshairPulse = 0.6 + Math.sin(time * 10) * 0.4;

                // Outer ring
                ctx.strokeStyle = `rgba(255, 0, 0, ${crosshairPulse * 0.5})`;
                ctx.lineWidth = 2;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff0000';
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 25, 0, Math.PI * 2);
                ctx.stroke();

                // Inner ring
                ctx.strokeStyle = `rgba(255, 0, 0, ${crosshairPulse})`;
                ctx.lineWidth = 3;
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 18, 0, Math.PI * 2);
                ctx.stroke();

                // Crosshair lines
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(mouse.x - 30, mouse.y);
                ctx.lineTo(mouse.x - 15, mouse.y);
                ctx.moveTo(mouse.x + 15, mouse.y);
                ctx.lineTo(mouse.x + 30, mouse.y);
                ctx.moveTo(mouse.x, mouse.y - 30);
                ctx.lineTo(mouse.x, mouse.y - 15);
                ctx.moveTo(mouse.x, mouse.y + 15);
                ctx.lineTo(mouse.x, mouse.y + 30);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Center dot
                ctx.fillStyle = `rgba(255, 0, 0, ${crosshairPulse})`;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (newPlayer.alive && (newPlayer.x !== myPlayer.x || newPlayer.y !== myPlayer.y || newPlayer.hp !== myPlayer.hp)) {
            // ✅ Nu trimite update dacă jocul s-a terminat
            if (!isGameEnded && !gameEnded) {
                setMyPlayer(newPlayer);
                throttledSendUpdate(newPlayer);
            }
        }

        animationRef.current = requestAnimationFrame(gameLoop);
    }, [myPlayer, gameStarted, gameEnded, safeZone, otherPlayers, explosions, throttledSendUpdate, mouse, isMouseInBounds, createExplosion, sendEliminated, allPlayers, checkPlayerCollisions]);

    useEffect(() => {
        if (gameStarted && !gameEnded && myPlayer) {
            lastUpdateTimeRef.current = performance.now();
            animationRef.current = requestAnimationFrame(gameLoop);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [gameStarted, gameEnded, myPlayer, gameLoop]);

    useEffect(() => {
        if (!gameStarted || gameEnded || !myPlayer || winnerDeclared || isProcessingWinner || isGameEnded) return;

        const gameRunTime = Date.now() - gameStartTimeRef.current;
        if (gameRunTime < 10000) {
            return;
        }

        const aliveCount = Array.from(allPlayers.values()).filter(p => p.alive).length;

        // ✅ Când rămâne un singur jucător alive
        if (aliveCount === 1 && myPlayer.alive) {
            console.log('[PurgeGame] 🏆 I am the winner! Declaring...');

            setWinnerDeclared(true);
            setServerWinner(myPlayer.id);
            // ✅ Folosește noul hook pentru a declara winner-ul
            declareWinner(myPlayer.id, prizePool * 0.95);
        }
    }, [myPlayer, allPlayers, gameStarted, gameEnded, winnerDeclared, isProcessingWinner, isGameEnded, declareWinner]);

    if (gameEnded) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-red-950/50 to-black flex items-center justify-center relative overflow-hidden">
                <ParticleBackground />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.2)_0%,transparent_70%)]"></div>

                <div className="text-center z-10 animate-slide-up">
                    <Skull className="w-32 h-32 text-red-500 mx-auto mb-8 animate-pulse" />
                    <h1 className="text-8xl font-black mb-6 animate-danger-pulse" style={{
                        background: 'linear-gradient(135deg, #ff0000, #ff6600)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 0 30px rgba(255,0,0,0.8))'
                    }}>
                        PURGE COMPLETE
                    </h1>
                    <p className="text-3xl text-white/80 mb-12 font-semibold">The final judgment has been cast</p>
                    <Button
                        size="lg"
                        onClick={() => navigate('/lobby')}
                        className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xl px-12 py-6 rounded-xl shadow-2xl animate-pulse-glow"
                    >
                        Return to Lobby
                    </Button>
                </div>
            </div>
        );
    }

    const remainingPlayers = Array.from(allPlayers.values()).filter(p => p.alive).length;

    if (countdown.isActive && countdown.remaining > 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-red-950/40 to-black flex items-center justify-center relative overflow-hidden">
                <ParticleBackground />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.15)_0%,transparent_70%)]"></div>

                <div className="text-center z-10 space-y-8 animate-slide-up">
                    <div className="relative">
                        <Swords className="w-24 h-24 text-red-500 mx-auto mb-6 animate-pulse" />
                        <h1 className="text-7xl font-black mb-8 animate-danger-pulse" style={{
                            background: 'linear-gradient(135deg, #ff0000, #ff6600)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 40px rgba(255,0,0,0.9))'
                        }}>
                            PREPARE FOR PURGE
                        </h1>

                        <div className="relative inline-block">
                            <div className="text-[180px] font-black leading-none animate-danger-pulse" style={{
                                background: 'linear-gradient(180deg, #ffffff, #ff0000)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                filter: 'drop-shadow(0 0 60px rgba(255,0,0,1))'
                            }}>
                                {Math.ceil(countdown.remaining)}
                            </div>
                            <div className="absolute inset-0 blur-3xl opacity-50" style={{
                                background: 'radial-gradient(circle, rgba(255,0,0,0.8), transparent)'
                            }}></div>
                        </div>

                        <p className="text-3xl font-bold mt-8 animate-neon-pulse" style={{
                            color: '#00ffff',
                            textShadow: '0 0 20px rgba(0,255,255,0.8)'
                        }}>
                            Survival begins soon...
                        </p>
                    </div>

                    <div className="glass-panel max-w-2xl mx-auto p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <Users className="w-8 h-8 text-red-400" />
                            <span className="text-3xl text-white font-black">
                                {readyPlayers.length} WARRIORS READY
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-6 text-left text-white/90 text-lg font-semibold">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 animate-pulse"></div>
                                <span>Use WASD or Arrow Keys to move</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 animate-pulse"></div>
                                <span>Press 1, 2, 3 for power-ups</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 animate-pulse"></div>
                                <span>Stay inside the shrinking zone</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 animate-pulse"></div>
                                <span>Last survivor claims victory</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 text-2xl font-black animate-pulse" style={{
                        color: '#ffaa00',
                        textShadow: '0 0 15px rgba(255,170,0,0.8)'
                    }}>
                        <Trophy className="w-8 h-8" />
                        <span>WINNER TAKES ALL</span>
                        <Trophy className="w-8 h-8" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-red-950/30 to-black relative overflow-hidden">
            <ParticleBackground />

            <div className="fixed inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-black/40 pointer-events-none"></div>
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.9)_100%)] pointer-events-none"></div>

            {/* Enhanced HUD */}
            <div className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-4 border-red-600/60 p-4" style={{
                borderRadius: 0,
                backdropFilter: 'blur(20px)',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.95), rgba(0,0,0,0.85))'
            }}>
                <div className="flex justify-center gap-8 flex-wrap">
                    <div className="text-center group transition-transform hover:scale-110">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-5 h-5 text-red-400 animate-pulse" />
                            <span className="text-red-300 font-bold text-sm uppercase tracking-wider">Alive</span>
                        </div>
                        <div className="text-4xl font-black" style={{
                            background: 'linear-gradient(135deg, #ffffff, #ff0000)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {remainingPlayers}
                        </div>
                    </div>

                    <div className="text-center group transition-transform hover:scale-110">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
                            <span className="text-yellow-300 font-bold text-sm uppercase tracking-wider">Time</span>
                        </div>
                        <div className="text-4xl font-black" style={{
                            background: 'linear-gradient(135deg, #ffffff, #ffaa00)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}
                        </div>
                    </div>

                    <div className="text-center group transition-transform hover:scale-110">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-cyan-400 animate-pulse" />
                            <span className="text-cyan-300 font-bold text-sm uppercase tracking-wider">Zone</span>
                        </div>
                        <div className="text-4xl font-black animate-neon-pulse" style={{
                            color: '#00ffff'
                        }}>
                            {Math.round(safeZone.radius)}m
                        </div>
                    </div>

                    <div className="text-center group transition-transform hover:scale-110">
                        <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-5 h-5 text-red-500 animate-pulse" />
                            <span className="text-red-300 font-bold text-sm uppercase tracking-wider">Health</span>
                        </div>
                        <div className="text-4xl font-black" style={{
                            background: myPlayer && myPlayer.hp > 30 ? 'linear-gradient(135deg, #00ff00, #ffffff)' : 'linear-gradient(135deg, #ff0000, #ff6600)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {myPlayer?.hp.toFixed(0) || 0}
                        </div>
                    </div>

                    <div className="text-center group transition-transform hover:scale-110">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl animate-pulse">💰</span>
                            <span className="text-yellow-300 font-bold text-sm uppercase tracking-wider">Balance</span>
                        </div>
                        <div className="text-4xl font-black" style={{
                            background: 'linear-gradient(135deg, #ffaa00, #ffffff)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {virtualBalance.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Power-ups Panel */}
            <div className="fixed bottom-4 right-4 z-40">
                <div className="glass-panel p-6 shadow-2xl min-w-[260px] neon-border border-cyan-500/50">
                    <div className="text-center mb-4">
                        <h3 className="text-2xl font-black mb-2 animate-neon-pulse" style={{ color: '#00ffff' }}>
                            POWER-UPS
                        </h3>
                        <p className="text-sm text-gray-400 font-semibold">Press hotkey to activate</p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => buyPowerUp('speed')}
                            disabled={virtualBalance < getSpeedCost}
                            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-800 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-bold transition-all shadow-lg hover:shadow-cyan-500/50 hover:scale-105"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3">
                                    <Zap className="w-5 h-5" />
                                    <span className="text-lg">SPEED BOOST</span>
                                </div>
                                <span className="text-sm bg-black/40 px-3 py-1 rounded-full font-black">1</span>
                            </div>
                            <div className="text-sm font-semibold opacity-90">{getSpeedCost.toFixed(2)} vSOL</div>
                        </button>

                        <button
                            onClick={() => buyPowerUp('shield')}
                            disabled={virtualBalance < getShieldCost || myPlayer?.hasShield}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-800 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-bold transition-all shadow-lg hover:shadow-purple-500/50 hover:scale-105"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-5 h-5" />
                                    <span className="text-lg">SHIELD</span>
                                </div>
                                <span className="text-sm bg-black/40 px-3 py-1 rounded-full font-black">2</span>
                            </div>
                            <div className="text-sm font-semibold opacity-90">{getShieldCost.toFixed(2)} vSOL</div>
                        </button>

                        <button
                            onClick={() => buyPowerUp('health')}
                            disabled={virtualBalance < getHealthCost || (myPlayer?.hp ?? 0) >= (myPlayer?.maxHp ?? 100)}
                            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:from-gray-700 disabled:to-gray-800 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-bold transition-all shadow-lg hover:shadow-red-500/50 hover:scale-105"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3">
                                    <Heart className="w-5 h-5" />
                                    <span className="text-lg">HEAL</span>
                                </div>
                                <span className="text-sm bg-black/40 px-3 py-1 rounded-full font-black">3</span>
                            </div>
                            <div className="text-sm font-semibold opacity-90">{getHealthCost.toFixed(2)} vSOL</div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Enhanced Game Canvas */}
            <div className="flex items-center justify-center min-h-screen pt-24 pb-8 px-4">
                <div className="relative" style={{
                    filter: 'drop-shadow(0 0 60px rgba(255,0,0,0.4))'
                }}>
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-2xl blur-xl opacity-75 animate-pulse"></div>

                    <div className="relative glass-panel border-4 border-red-600/70 p-4">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-t-xl animate-pulse"></div>

                        <canvas
                            ref={canvasRef}
                            width={900}
                            height={700}
                            tabIndex={0}
                            className="w-full h-auto bg-black rounded-lg outline-none focus:ring-4 focus:ring-red-500/50 transition-all"
                            style={{ cursor: 'none' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurgeGameMultiplayer;
