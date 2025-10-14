// src/pages/PurgeGame.tsx - BLOCKCHAIN INTEGRATED VERSION
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ParticleBackground from '@/components/ParticleBackground';
import { ArrowLeft, Zap, Shield, Coins, Heart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Type definitions
interface ButtonProps {
    variant?: 'default' | 'hero' | 'secondary' | 'sol-outline';
    size?: 'default' | 'lg';
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
}

interface Player {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    speed: number;
    hasShield: boolean;
    hasSpeed: boolean;
    alive: boolean;
    name: string;
    hp: number;
    maxHp: number;
    trail: TrailParticle[];
    pulsePhase: number;
    vx?: number;
    vy?: number;
    targetX?: number;
    targetY?: number;
}

interface Enemy extends Player {
    targetX: number;
    targetY: number;
    vx: number;
    vy: number;
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

interface PowerUp {
    id: string;
    type: 'speed' | 'shield' | 'health';
    cost: number;
    duration: number;
    active: boolean;
}

interface SafeZone {
    x: number;
    y: number;
    radius: number;
}

interface Mouse {
    x: number;
    y: number;
}

// ✅ NEW: Props for blockchain integration
interface BlockchainPlayer {
    address: string;
    name: string;
    isYou: boolean;
}

interface PurgeGameProps {
    players?: BlockchainPlayer[];
    onGameEnd?: (winnerAddress: string) => void;
    onClose?: () => void;
}

const Button: React.FC<ButtonProps> = ({
    variant = 'default',
    size = 'default',
    children,
    className = '',
    disabled = false,
    onClick,
    ...props
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
            {...props}
        >
            {children}
        </button>
    );
};

const PurgeGame: React.FC<PurgeGameProps> = ({
    players: externalPlayers,
    onGameEnd,
    onClose
}) => {
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const particlesRef = useRef<ExplosionParticle[]>([]);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [gameOver, setGameOver] = useState<boolean>(false);
    const [solBalance, setSolBalance] = useState<number>(1000);
    const [player, setPlayer] = useState<Player | null>(null);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [mouse, setMouse] = useState<Mouse>({ x: 450, y: 350 });
    const [gameTime, setGameTime] = useState<number>(0);
    const maxGameTime = 120;
    const [survivorsCount, setSurvivorsCount] = useState<number>(10);
    const [kills, setKills] = useState<number>(0);
    const [safeZone, setSafeZone] = useState<SafeZone>({ x: 450, y: 350, radius: 300 });
    const [winnerDeclared, setWinnerDeclared] = useState<boolean>(false);

    const powerUps: PowerUp[] = [
        { id: 'speed', type: 'speed', cost: 100, duration: 10, active: false },
        { id: 'shield', type: 'shield', cost: 150, duration: 8, active: false },
        { id: 'health', type: 'health', cost: 1, duration: 0, active: false }
    ];

    const [activePowerUps, setActivePowerUps] = useState<PowerUp[]>(powerUps);

    // ✅ Check if we're in blockchain mode
    const isBlockchainMode = !!externalPlayers && externalPlayers.length > 0;

    const createExplosion = useCallback((x: number, y: number, color: string): void => {
        const particles: ExplosionParticle[] = [];
        for (let i = 0; i < 12; i++) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 25,
                maxLife: 25,
                color,
                size: Math.random() * 3 + 1
            });
        }
        particlesRef.current = [...particlesRef.current, ...particles];
    }, []);

    const createTrailParticle = useCallback((x: number, y: number, color: string): TrailParticle => {
        return { x, y, alpha: 1.0 };
    }, []);

    // ✅ MODIFIED: Initialize game with blockchain players or NPCs
    const initializeGame = useCallback((): void => {
        setGameStarted(true);
        setGameOver(false);
        setGameTime(0);
        setKills(0);
        setWinnerDeclared(false);
        particlesRef.current = [];
        setSafeZone({ x: 450, y: 350, radius: 300 });
        setActivePowerUps(powerUps);

        if (isBlockchainMode && externalPlayers) {
            // ✅ BLOCKCHAIN MODE: Use real players
            console.log('🎮 Initializing blockchain game with players:', externalPlayers);

            const myPlayerData = externalPlayers.find(p => p.isYou);
            const otherPlayersData = externalPlayers.filter(p => !p.isYou);

            const newPlayer: Player = {
                id: myPlayerData?.address || 'player',
                x: 450,
                y: 350,
                radius: 20,
                color: 'hsl(280, 100%, 60%)',
                speed: 3,
                hasShield: false,
                hasSpeed: false,
                alive: true,
                name: 'YOU',
                hp: 1000,
                maxHp: 1000,
                trail: [],
                pulsePhase: 0
            };

            const newEnemies: Enemy[] = otherPlayersData.map((p, i) => {
                const hue = (i * 360 / otherPlayersData.length);
                const angle = (i / otherPlayersData.length) * Math.PI * 2;
                const distance = 150 + Math.random() * 50;

                return {
                    id: p.address,
                    x: 450 + Math.cos(angle) * distance,
                    y: 350 + Math.sin(angle) * distance,
                    radius: 15 + Math.random() * 5,
                    color: `hsl(${hue}, 85%, 65%)`,
                    speed: 1.5 + Math.random() * 1,
                    hasShield: false,
                    hasSpeed: false,
                    alive: true,
                    name: p.name,
                    hp: 1000,
                    maxHp: 1000,
                    targetX: 450,
                    targetY: 350,
                    trail: [],
                    pulsePhase: Math.random() * Math.PI * 2,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2
                };
            });

            setPlayer(newPlayer);
            setEnemies(newEnemies);
            setSurvivorsCount(1 + newEnemies.length);

            console.log('✅ Blockchain game initialized with', newEnemies.length + 1, 'players');
        } else {
            // ✅ NPC MODE: Original game with AI enemies
            console.log('🎮 Initializing NPC game');

            const newPlayer: Player = {
                id: 'player',
                x: 450,
                y: 350,
                radius: 20,
                color: 'hsl(280, 100%, 60%)',
                speed: 3,
                hasShield: false,
                hasSpeed: false,
                alive: true,
                name: 'YOU',
                hp: 1000,
                maxHp: 1000,
                trail: [],
                pulsePhase: 0
            };

            const enemyNames: string[] = ['HUNTER', 'SHADOW', 'VIPER', 'STORM', 'BLADE', 'GHOST', 'RAZOR', 'FURY', 'VOID'];
            const newEnemies: Enemy[] = [];

            for (let i = 0; i < 9; i++) {
                const hue = (i * 40) % 360;
                const angle = (i / 9) * Math.PI * 2;
                const distance = 100 + Math.random() * 100;
                newEnemies.push({
                    id: `enemy-${i}`,
                    x: 450 + Math.cos(angle) * distance,
                    y: 350 + Math.sin(angle) * distance,
                    radius: 15 + Math.random() * 5,
                    color: `hsl(${hue}, 85%, 65%)`,
                    speed: 1.5 + Math.random() * 1,
                    hasShield: false,
                    hasSpeed: false,
                    alive: true,
                    name: enemyNames[i],
                    hp: 1000,
                    maxHp: 1000,
                    targetX: 450,
                    targetY: 350,
                    trail: [],
                    pulsePhase: Math.random() * Math.PI * 2,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2
                });
            }

            setPlayer(newPlayer);
            setEnemies(newEnemies);
            setSurvivorsCount(10);
        }
    }, [isBlockchainMode, externalPlayers]);

    const buyPowerUp = useCallback((powerUpType: PowerUp['type']): void => {
        const powerUp = activePowerUps.find(p => p.type === powerUpType);
        if (!powerUp || powerUp.active || solBalance < powerUp.cost) return;

        if (powerUpType === 'health') {
            if (player && player.hp < player.maxHp) {
                setSolBalance(prev => prev - powerUp.cost);
                setPlayer(prev => prev ? {
                    ...prev,
                    hp: Math.min(prev.maxHp, prev.hp + 100)
                } : null);
            }
            return;
        }

        setSolBalance(prev => prev - powerUp.cost);
        setActivePowerUps(prev => prev.map(p =>
            p.type === powerUpType ? { ...p, active: true } : p
        ));

        if (player) {
            setPlayer(prev => prev ? {
                ...prev,
                hasSpeed: powerUpType === 'speed' ? true : prev.hasSpeed,
                hasShield: powerUpType === 'shield' ? true : prev.hasShield,
                speed: powerUpType === 'speed' ? prev.speed * 1.6 : prev.speed
            } : null);
        }

        setTimeout(() => {
            setActivePowerUps(prev => prev.map(p =>
                p.type === powerUpType ? { ...p, active: false } : p
            ));

            if (powerUpType === 'speed') {
                setPlayer(prev => prev ? {
                    ...prev,
                    hasSpeed: false,
                    speed: prev.speed / 1.6
                } : null);
            } else if (powerUpType === 'shield') {
                setPlayer(prev => prev ? { ...prev, hasShield: false } : null);
            }
        }, powerUp.duration * 1000);
    }, [activePowerUps, player, solBalance]);

    const handleMouseMove = useCallback((e: MouseEvent): void => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        setMouse({
            x: (e.clientX - rect.left) * (900 / rect.width),
            y: (e.clientY - rect.top) * (700 / rect.height)
        });
    }, []);

    const isOutsideSafeZone = useCallback((p: Player | Enemy): boolean => {
        const distance = Math.sqrt((p.x - safeZone.x) ** 2 + (p.y - safeZone.y) ** 2);
        return distance > safeZone.radius;
    }, [safeZone]);

    const gameLoop = useCallback((): void => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !player || !gameStarted || gameOver) return;

        // Enhanced background with grid
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

        // Enhanced safe zone with warnings
        const safeZoneTime = Date.now() * 0.005;
        const pulseEffect = Math.sin(safeZoneTime) * 0.3 + 0.7;

        // Death zone overlay
        ctx.fillStyle = 'rgba(139, 0, 0, 0.3)';
        ctx.fillRect(0, 0, 900, 700);

        // Cut out safe zone
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

        // Danger zone border
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

        // Update player position with trail
        if (player && player.alive) {
            const dx = mouse.x - player.x;
            const dy = mouse.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 2) {
                const moveX = (dx / distance) * player.speed;
                const moveY = (dy / distance) * player.speed;

                setPlayer(prev => {
                    if (!prev) return null;
                    const newX = Math.max(20, Math.min(880, prev.x + moveX));
                    const newY = Math.max(20, Math.min(680, prev.y + moveY));

                    const trail = [...prev.trail, createTrailParticle(prev.x, prev.y, prev.color)];
                    if (trail.length > 8) trail.shift();

                    return {
                        ...prev,
                        x: newX,
                        y: newY,
                        trail,
                        pulsePhase: prev.pulsePhase + 0.15
                    };
                });
            }
        }

        // Enhanced enemy AI
        setEnemies(prev => prev.map(enemy => {
            if (!enemy.alive) return enemy;

            let targetX = enemy.targetX;
            let targetY = enemy.targetY;

            let closestDistance = Infinity;
            let closestTarget: Player | Enemy | null = null;

            if (player && player.alive) {
                const playerDistance = Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2);
                if (playerDistance < closestDistance) {
                    closestDistance = playerDistance;
                    closestTarget = player;
                }
            }

            prev.forEach(otherEnemy => {
                if (otherEnemy.id !== enemy.id && otherEnemy.alive) {
                    const distance = Math.sqrt((enemy.x - otherEnemy.x) ** 2 + (enemy.y - otherEnemy.y) ** 2);
                    if (distance < closestDistance && distance < 120) {
                        closestDistance = distance;
                        closestTarget = otherEnemy;
                    }
                }
            });

            if (closestTarget && closestDistance < 150) {
                targetX = closestTarget.x;
                targetY = closestTarget.y;
            } else {
                if (Math.random() < 0.05) {
                    targetX = 100 + Math.random() * 700;
                    targetY = 100 + Math.random() * 500;
                }
            }

            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                const moveX = (dx / distance) * enemy.speed;
                const moveY = (dy / distance) * enemy.speed;

                const newX = Math.max(20, Math.min(880, enemy.x + moveX));
                const newY = Math.max(20, Math.min(680, enemy.y + moveY));

                const trail = [...enemy.trail, createTrailParticle(enemy.x, enemy.y, enemy.color)];
                if (trail.length > 5) trail.shift();

                const newVx = (newX - enemy.x) * 0.1 + enemy.vx * 0.7;
                const newVy = (newY - enemy.y) * 0.1 + enemy.vy * 0.7;

                return {
                    ...enemy,
                    x: newX,
                    y: newY,
                    targetX,
                    targetY,
                    trail,
                    pulsePhase: enemy.pulsePhase + 0.12,
                    vx: Math.max(-enemy.speed, Math.min(enemy.speed, newVx)),
                    vy: Math.max(-enemy.speed, Math.min(enemy.speed, newVy))
                };
            }

            return enemy;
        }));

        // Simple collision system
        if (player && player.alive) {
            enemies.forEach(enemy => {
                if (!enemy.alive) return;

                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = player.radius + enemy.radius;

                if (distance < minDistance && distance > 0) {
                    const pushForce = (minDistance - distance) * 0.3;
                    const angle = Math.atan2(dy, dx);
                    const pushX = Math.cos(angle) * pushForce;
                    const pushY = Math.sin(angle) * pushForce;

                    if (player.hasShield && !enemy.hasShield) {
                        createExplosion(enemy.x, enemy.y, enemy.color);
                    } else if (player.hasSpeed && !enemy.hasSpeed) {
                        createExplosion((player.x + enemy.x) / 2, (player.y + enemy.y) / 2, '#f59e0b');
                    }

                    setPlayer(prev => prev ? {
                        ...prev,
                        x: Math.max(20, Math.min(880, prev.x + pushX * 0.5)),
                        y: Math.max(20, Math.min(680, prev.y + pushY * 0.5))
                    } : null);

                    setEnemies(prevEnemies => prevEnemies.map(e =>
                        e.id === enemy.id ? {
                            ...e,
                            x: Math.max(20, Math.min(880, e.x - pushX * 0.5)),
                            y: Math.max(20, Math.min(880, e.y - pushY * 0.5))
                        } : e
                    ));
                }
            });
        }

        // Update and draw particles
        if (particlesRef.current) {
            particlesRef.current = particlesRef.current.filter(particle => {
                if (!particle) return false;

                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.vx *= 0.95;
                particle.vy *= 0.95;
                particle.life--;

                if (particle.life > 0) {
                    const alpha = particle.life / particle.maxLife;
                    const safeSize = Math.max(0.5, particle.size * alpha);
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, safeSize, 0, Math.PI * 2);
                    ctx.fillStyle = particle.color.includes('rgba') ? particle.color : particle.color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
                    ctx.fill();
                    return true;
                }
                return false;
            });
        }

        // Enhanced drawing function
        const drawPlayer = (p: Player | Enemy): void => {
            if (!p || !p.alive) return;

            if (p.trail && p.trail.length > 0) {
                p.trail.forEach((point, index) => {
                    const alpha = (index + 1) / p.trail.length * 0.5;
                    const radius = Math.max(0.5, p.radius * 0.2 * alpha);
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = p.color.includes('hsla') ? p.color.replace(')', `, ${alpha})`) : p.color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
                    ctx.fill();
                });
            }

            const pulseRadius = p.radius + Math.sin(p.pulsePhase) * 1.5;

            const glowGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulseRadius * 1.8);
            const glowColor1 = p.color.includes('hsla') ? p.color.replace(')', ', 0.6)') : p.color.replace('hsl', 'hsla').replace(')', ', 0.6)');
            const glowColor2 = p.color.includes('hsla') ? p.color.replace(')', ', 0.2)') : p.color.replace('hsl', 'hsla').replace(')', ', 0.2)');
            glowGradient.addColorStop(0, glowColor1);
            glowGradient.addColorStop(0.6, glowColor2);
            glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.beginPath();
            ctx.arc(p.x, p.y, pulseRadius * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = glowGradient;
            ctx.fill();

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

            const bodyGradient = ctx.createRadialGradient(p.x - pulseRadius / 3, p.y - pulseRadius / 3, 0, p.x, p.y, pulseRadius);
            const bodyColor1 = p.color.includes('hsla') ? p.color : p.color.replace('hsl', 'hsla').replace(')', ', 1)');
            bodyGradient.addColorStop(0, bodyColor1);
            bodyGradient.addColorStop(0.7, p.color);
            bodyGradient.addColorStop(1, p.color.replace(/\d+%/, '25%'));

            ctx.beginPath();
            ctx.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = bodyGradient;
            ctx.fill();

            const highlightRadius = Math.max(2, pulseRadius / 3);
            ctx.beginPath();
            ctx.arc(p.x - pulseRadius / 4, p.y - pulseRadius / 4, highlightRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.strokeText(p.name, p.x, p.y - pulseRadius - 15);
            ctx.fillText(p.name, p.x, p.y - pulseRadius - 15);

            if (typeof p.hp === 'number' && typeof p.maxHp === 'number') {
                const barWidth = pulseRadius * 1.8;
                const barHeight = 4;
                const barX = p.x - barWidth / 2;
                const barY = p.y - pulseRadius - 30;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

                const hpPercent = p.hp / p.maxHp;
                const hpColor = hpPercent > 0.6 ? '#22c55e' : hpPercent > 0.3 ? '#f59e0b' : '#ef4444';
                ctx.fillStyle = hpColor;
                ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);

                ctx.fillStyle = 'white';
                ctx.font = 'bold 8px Arial';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.strokeText(`${p.hp}/${p.maxHp}`, p.x, barY - 6);
                ctx.fillText(`${p.hp}/${p.maxHp}`, p.x, barY - 6);
            }

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = 'bold 10px Arial';
            ctx.strokeText(Math.round(pulseRadius).toString(), p.x, p.y + 3);
            ctx.fillText(Math.round(pulseRadius).toString(), p.x, p.y + 3);
        };

        if (player && player.alive) drawPlayer(player);
        enemies.filter(e => e.alive).forEach(drawPlayer);

        if (mouse.x >= 0 && mouse.x <= 900 && mouse.y >= 0 && mouse.y <= 700) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(mouse.x - 10, mouse.y);
            ctx.lineTo(mouse.x + 10, mouse.y);
            ctx.moveTo(mouse.x, mouse.y - 10);
            ctx.lineTo(mouse.x, mouse.y + 10);
            ctx.stroke();
        }

        const borderTime = Date.now() * 0.002;
        const borderGlow = Math.sin(borderTime) * 0.4 + 0.6;
        ctx.strokeStyle = `rgba(255, 0, 0, ${borderGlow})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, 898, 698);

        animationRef.current = requestAnimationFrame(gameLoop);
    }, [player, enemies, mouse, gameStarted, gameOver, safeZone, createTrailParticle, createExplosion]);

    // Game timer and events
    useEffect(() => {
        if (!gameStarted || gameOver) return;

        const timer = setInterval(() => {
            setGameTime(prev => {
                if (prev >= maxGameTime) {
                    setGameOver(true);
                    return maxGameTime;
                }
                return prev + 1;
            });

            setSafeZone(prev => ({
                ...prev,
                radius: Math.max(25, prev.radius - 1.5)
            }));

            setPlayer(prev => {
                if (!prev || !prev.alive) return prev;

                if (isOutsideSafeZone(prev)) {
                    const newHp = Math.max(0, prev.hp - 50);
                    if (newHp <= 0) {
                        createExplosion(prev.x, prev.y, prev.color);
                        setSurvivorsCount(count => count - 1);
                        return { ...prev, alive: false, hp: 0 };
                    }
                    return { ...prev, hp: newHp };
                }
                return prev;
            });

            setEnemies(prev => prev.map(enemy => {
                if (!enemy.alive) return enemy;

                if (isOutsideSafeZone(enemy)) {
                    const newHp = Math.max(0, enemy.hp - 50);
                    if (newHp <= 0) {
                        createExplosion(enemy.x, enemy.y, enemy.color);
                        setSurvivorsCount(count => count - 1);
                        return { ...enemy, alive: false, hp: 0 };
                    }
                    return { ...enemy, hp: newHp };
                }
                return enemy;
            }));

            setTimeout(() => {
                setEnemies(currentEnemies => {
                    const aliveEnemyCount = currentEnemies.filter(e => e.alive).length;

                    setPlayer(currentPlayer => {
                        const playerAlive = currentPlayer && currentPlayer.alive ? 1 : 0;
                        const totalAlive = aliveEnemyCount + playerAlive;

                        if (totalAlive <= 1) {
                            setGameOver(true);
                            setSurvivorsCount(playerAlive);
                        }

                        return currentPlayer;
                    });

                    return currentEnemies;
                });
            }, 100);
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStarted, gameOver, isOutsideSafeZone, createExplosion]);

    useEffect(() => {
        if (gameStarted && player) {
            animationRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [gameLoop, gameStarted, player]);

    useEffect(() => {
        if (!gameStarted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = 900;
        canvas.height = 700;
        canvas.addEventListener('mousemove', handleMouseMove);

        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
        };
    }, [handleMouseMove, gameStarted]);

    // ✅ NEW: Handle game end callback for blockchain
    useEffect(() => {
        if (gameOver && !winnerDeclared && onGameEnd) {
            setWinnerDeclared(true);

            // Determine winner
            let winnerAddress = '';

            if (player && player.alive) {
                winnerAddress = player.id;
                console.log('🏆 Player won! Address:', winnerAddress);
            } else {
                const aliveEnemy = enemies.find(e => e.alive);
                if (aliveEnemy) {
                    winnerAddress = aliveEnemy.id;
                    console.log('🏆 Enemy won! Address:', winnerAddress);
                }
            }

            if (winnerAddress) {
                console.log('📤 Sending winner to blockchain:', winnerAddress);
                setTimeout(() => {
                    onGameEnd(winnerAddress);
                }, 2000); // 2 second delay to show results
            }
        }
    }, [gameOver, winnerDeclared, onGameEnd, player, enemies]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black relative overflow-hidden">
            <ParticleBackground />

            <div className="fixed inset-0 bg-gradient-to-b from-transparent via-red-900/10 to-black/30 pointer-events-none"></div>
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none"></div>

            {/* ✅ Close button for blockchain mode */}
            {isBlockchainMode && onClose && (
                <button
                    onClick={onClose}
                    className="fixed top-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-all duration-300 shadow-lg"
                >
                    <X className="w-6 h-6" />
                </button>
            )}

            {!isBlockchainMode && (
                <div className="relative z-10 pt-6 pb-4">
                    <div className="max-w-7xl mx-auto px-6">
                        <button
                            className="inline-flex items-center gap-2 text-red-300 hover:text-red-100 transition-all duration-300 mb-6 group"
                            onClick={() => navigate('/')}
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="font-semibold tracking-wide">ESCAPE THE ARENA</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
                <div className="text-center mb-8">
                    <div className="relative">
                        <div className="absolute inset-0 text-6xl md:text-8xl font-black text-red-500 opacity-20 animate-pulse transform translate-x-1 translate-y-1">
                            THE PURGE
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-red-600 via-red-400 to-orange-500 bg-clip-text text-transparent mb-4 tracking-wider relative drop-shadow-2xl">
                            THE PURGE
                        </h1>
                        <div className="flex items-center justify-center gap-3 text-red-400 text-xl font-bold tracking-widest mb-2">
                            <span className="text-2xl animate-pulse">💀</span>
                            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                {isBlockchainMode ? 'BLOCKCHAIN BATTLE' : 'FINAL DESTINATION'}
                            </span>
                            <span className="text-2xl animate-pulse">💀</span>
                        </div>
                        <div className="text-lg text-red-300 font-semibold tracking-wider">
                            ONLY ONE SHALL REMAIN
                        </div>
                    </div>
                    <p className="text-xl text-red-200 max-w-2xl mx-auto mt-6 leading-relaxed">
                        {isBlockchainMode
                            ? 'Real players. Real stakes. Winner takes all.'
                            : 'Welcome to the final arena where survival is everything.'}
                        <br />
                        <span className="text-red-400 font-bold">Kill or be killed. There are no second chances.</span>
                    </p>
                </div>

                {!gameStarted ? (
                    <div className="max-w-5xl mx-auto">
                        <div className="bg-gradient-to-br from-black/80 to-red-950/60 backdrop-blur-xl border-2 border-red-600/40 rounded-2xl p-8 mb-8 shadow-2xl shadow-red-900/50 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent animate-pulse"></div>

                            <div className="text-center mb-8 relative z-10">
                                <h2 className="text-3xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-2">
                                    ⚠️ SURVIVAL PROTOCOL ⚠️
                                </h2>
                                <div className="text-red-300 text-sm font-semibold tracking-widest mb-4">
                                    READ CAREFULLY - YOUR LIFE DEPENDS ON IT
                                </div>
                                <div className="h-1 w-48 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 mx-auto rounded-full animate-pulse"></div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 text-red-100 relative z-10">
                                <div className="bg-black/60 p-6 rounded-xl border border-red-500/30 hover:border-red-400/50 transition-all duration-300">
                                    <h3 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
                                        🎯 <span>OBJECTIVE: ELIMINATE ALL</span>
                                    </h3>
                                    <p className="leading-relaxed text-red-200">
                                        Kill every other contestant. The arena shrinks - stay inside or die.
                                        <span className="text-red-400 font-bold">Only one can survive.</span>
                                    </p>
                                </div>
                                <div className="bg-black/60 p-6 rounded-xl border border-red-500/30 hover:border-red-400/50 transition-all duration-300">
                                    <h3 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
                                        🎮 <span>MOVEMENT: MOUSE CONTROL</span>
                                    </h3>
                                    <p className="leading-relaxed text-red-200">
                                        Follow your cursor to move. Swift reactions separate the living from the dead.
                                        <span className="text-red-400 font-bold"> Stay agile.</span>
                                    </p>
                                </div>
                                <div className="bg-black/60 p-6 rounded-xl border border-red-500/30 hover:border-red-400/50 transition-all duration-300">
                                    <h3 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
                                        ⚡ <span>POWER-UPS: SURVIVAL TOOLS</span>
                                    </h3>
                                    <p className="leading-relaxed text-red-200">
                                        Speed boosts, shields, health packs. Buy them with Blood Money.
                                        <span className="text-red-400 font-bold"> Spend wisely or die.</span>
                                    </p>
                                </div>
                                <div className="bg-black/60 p-6 rounded-xl border border-red-500/30 hover:border-red-400/50 transition-all duration-300">
                                    <h3 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
                                        💀 <span>DANGER ZONE: DEATH AWAITS</span>
                                    </h3>
                                    <p className="leading-relaxed text-red-200">
                                        Red zone = death. Green zone = temporary safety. Zone shrinks constantly.
                                        <span className="text-red-400 font-bold"> Nowhere to hide.</span>
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-center relative z-10">
                                <p className="text-red-300 font-bold text-lg">
                                    ⚠️ WARNING: This is a fight to the death. No mercy. No alliances. ⚠️
                                </p>
                                <p className="text-red-400 text-sm mt-2">
                                    {isBlockchainMode
                                        ? 'Real players compete for the prize pool. Only one survives.'
                                        : 'The weak will be eliminated. The strong will prevail.'}
                                </p>
                            </div>
                        </div>

                        <div className="text-center">
                            <Button
                                variant="hero"
                                size="lg"
                                onClick={initializeGame}
                                className="text-2xl px-16 py-6 text-white font-black tracking-wider transform hover:scale-110 transition-all duration-300 shadow-2xl shadow-red-900/50 border-2 border-red-500/50"
                            >
                                <span className="flex items-center gap-3">
                                    <span className="text-3xl animate-pulse">💀</span>
                                    ENTER THE ARENA
                                    <span className="text-3xl animate-pulse">💀</span>
                                </span>
                            </Button>
                            <p className="text-red-400 text-sm mt-4 font-semibold">
                                Click to begin your fight for survival...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-black/80 backdrop-blur-xl border-2 border-red-600/50 rounded-2xl p-6 mb-6 shadow-2xl shadow-red-900/50 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>

                            <div className="flex justify-center">
                                <div className="flex gap-8">
                                    <div className="text-center group">
                                        <div className="text-3xl font-black text-green-400 font-mono tracking-wider group-hover:text-green-300 transition-colors">
                                            {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}
                                        </div>
                                        <div className="text-sm text-red-300 font-semibold tracking-wide">TIME ALIVE</div>
                                    </div>
                                    <div className="text-center group">
                                        <div className="text-3xl font-black text-red-400 group-hover:text-red-300 transition-colors">{survivorsCount}</div>
                                        <div className="text-sm text-red-300 font-semibold tracking-wide">REMAINING</div>
                                    </div>
                                    {!isBlockchainMode && (
                                        <>
                                            <div className="text-center group">
                                                <div className="text-3xl font-black text-orange-400 flex items-center gap-2 group-hover:text-orange-300 transition-colors">
                                                    <Coins className="w-6 h-6" />
                                                    {solBalance}
                                                </div>
                                                <div className="text-sm text-red-300 font-semibold tracking-wide">BLOOD MONEY</div>
                                            </div>
                                            <div className="text-center group">
                                                <div className="text-3xl font-black text-red-500 group-hover:text-red-400 transition-colors">{kills}</div>
                                                <div className="text-sm text-red-300 font-semibold tracking-wide">KILLS</div>
                                            </div>
                                        </>
                                    )}
                                    <div className="text-center group">
                                        <div className="text-3xl font-black text-pink-400 flex items-center gap-2 group-hover:text-pink-300 transition-colors">
                                            <Heart className="w-6 h-6" />
                                            {player?.hp || 0}
                                        </div>
                                        <div className="text-sm text-red-300 font-semibold tracking-wide">VITALITY</div>
                                    </div>
                                    <div className="text-center group">
                                        <div className="text-2xl font-black text-cyan-400 group-hover:text-cyan-300 transition-colors">
                                            {Math.round(safeZone.radius)}m
                                        </div>
                                        <div className="text-sm text-red-300 font-semibold tracking-wide">DEATH ZONE</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!isBlockchainMode && (
                            <div className="bg-black/80 backdrop-blur-xl border-2 border-red-600/50 rounded-2xl p-6 mb-6 shadow-2xl shadow-red-900/50 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-900/10 to-transparent animate-pulse"></div>

                                <div className="text-center mb-4 relative z-10">
                                    <h3 className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                                        💀 SURVIVAL ARSENAL 💀
                                    </h3>
                                    <p className="text-red-300 text-sm mt-1">Purchase power-ups to increase your chances of survival</p>
                                </div>
                                <div className="flex justify-center gap-4 relative z-10">
                                    <Button
                                        variant={activePowerUps.find(p => p.type === 'speed')?.active ? 'secondary' : 'sol-outline'}
                                        onClick={() => buyPowerUp('speed')}
                                        disabled={activePowerUps.find(p => p.type === 'speed')?.active || solBalance < 100}
                                        className="flex items-center gap-2 px-6 py-3 font-bold tracking-wide"
                                    >
                                        <Zap className="w-5 h-5" />
                                        ADRENALINE RUSH
                                        <span className="text-xs opacity-75">(100)</span>
                                    </Button>
                                    <Button
                                        variant={activePowerUps.find(p => p.type === 'shield')?.active ? 'secondary' : 'sol-outline'}
                                        onClick={() => buyPowerUp('shield')}
                                        disabled={activePowerUps.find(p => p.type === 'shield')?.active || solBalance < 150}
                                        className="flex items-center gap-2 px-6 py-3 font-bold tracking-wide"
                                    >
                                        <Shield className="w-5 h-5" />
                                        DEATH BARRIER
                                        <span className="text-xs opacity-75">(150)</span>
                                    </Button>
                                    <Button
                                        variant="sol-outline"
                                        onClick={() => buyPowerUp('health')}
                                        disabled={!player || player.hp >= player.maxHp || solBalance < 1}
                                        className="flex items-center gap-2 px-6 py-3 font-bold tracking-wide"
                                    >
                                        <Heart className="w-5 h-5" />
                                        BLOOD TRANSFUSION
                                        <span className="text-xs opacity-75">(1)</span>
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-black/90 to-red-950/40 backdrop-blur-xl border-2 border-red-600/60 rounded-2xl p-6 mb-6 shadow-2xl shadow-red-900/70 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>
                            <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>

                            <canvas
                                ref={canvasRef}
                                width={900}
                                height={700}
                                className="w-full rounded-xl cursor-none bg-gradient-to-br from-black via-red-950 to-black border-2 border-red-500/50 shadow-inner"
                                style={{ aspectRatio: '9/7', maxHeight: '700px' }}
                            />
                            <div className="text-center mt-4 text-red-300 text-sm font-semibold tracking-wide animate-pulse">
                                💀 DEATH ARENA ACTIVE • SURVIVE AT ALL COSTS 💀
                            </div>
                        </div>

                        {gameOver && (
                            <div className="bg-gradient-to-br from-black/95 to-red-950/80 backdrop-blur-xl border-2 border-red-500/70 rounded-2xl p-10 text-center shadow-2xl shadow-red-900/80 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent animate-pulse"></div>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>

                                <div className="mb-6 relative z-10">
                                    {survivorsCount === 1 ? (
                                        <div>
                                            <div className="text-8xl mb-4 animate-bounce">👑</div>
                                            <h2 className="text-5xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-4 drop-shadow-2xl">
                                                ULTIMATE SURVIVOR
                                            </h2>
                                            <p className="text-2xl text-yellow-300 font-bold tracking-wide mb-2">
                                                YOU HAVE CONQUERED THE ARENA
                                            </p>
                                            <p className="text-red-300 text-lg">
                                                {isBlockchainMode
                                                    ? 'The prize pool is yours. Winner takes all.'
                                                    : 'Blood has been spilled. Bodies have fallen. You alone remain.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-8xl mb-4 animate-pulse">💀</div>
                                            <h2 className="text-5xl font-black bg-gradient-to-r from-red-500 via-red-400 to-orange-500 bg-clip-text text-transparent mb-4 drop-shadow-2xl">
                                                ELIMINATED
                                            </h2>
                                            <p className="text-2xl text-red-400 font-bold tracking-wide mb-2">
                                                YOUR JOURNEY ENDS HERE
                                            </p>
                                            <p className="text-red-300 text-lg">
                                                You fought bravely, but the arena has claimed another soul.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid md:grid-cols-3 gap-6 mb-8 text-red-100 relative z-10">
                                    <div className="bg-black/60 p-6 rounded-xl border border-red-500/50">
                                        <div className="text-3xl font-bold text-green-400 mb-2">{gameTime}s</div>
                                        <div className="text-sm text-red-300">Time Survived</div>
                                        <div className="text-xs text-red-400 mt-1">Every second was a victory</div>
                                    </div>
                                    <div className="bg-black/60 p-6 rounded-xl border border-red-500/50">
                                        <div className="text-3xl font-bold text-red-400 mb-2">{kills}</div>
                                        <div className="text-sm text-red-300">Souls Claimed</div>
                                        <div className="text-xs text-red-400 mt-1">Your victims won't be forgotten</div>
                                    </div>
                                    <div className="bg-black/60 p-6 rounded-xl border border-red-500/50">
                                        <div className="text-3xl font-bold text-orange-400 mb-2">
                                            {survivorsCount === 1 ? 1000 : Math.floor(gameTime * 2 + kills * 25)}
                                        </div>
                                        <div className="text-sm text-red-300">Blood Money Earned</div>
                                        <div className="text-xs text-red-400 mt-1">The price of survival</div>
                                    </div>
                                </div>

                                {isBlockchainMode && (
                                    <div className="mb-8 relative z-10">
                                        <p className="text-yellow-300 text-xl font-bold mb-2">
                                            {survivorsCount === 1 ? '🏆 WINNER CLAIMED - Submitting to blockchain...' : '⏳ Waiting for winner confirmation...'}
                                        </p>
                                    </div>
                                )}

                                {!isBlockchainMode && (
                                    <>
                                        <div className="mb-8 relative z-10">
                                            <p className="text-red-200 text-lg leading-relaxed">
                                                {survivorsCount === 1 ? (
                                                    <>
                                                        <span className="text-yellow-400 font-bold">LEGENDARY VICTORY!</span> You have proven yourself as the ultimate predator.
                                                        The arena bows to your supremacy. Your name will be written in blood and remembered forever.
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-red-400 font-bold">RESPECTABLE PERFORMANCE.</span> You survived {gameTime} seconds
                                                        and eliminated {kills} competitors in this brutal arena.
                                                        {kills > 0 ? " Your kills will be remembered." : " You fought with honor."}
                                                    </>
                                                )}
                                            </p>
                                        </div>

                                        <Button
                                            variant="hero"
                                            size="lg"
                                            onClick={() => {
                                                setGameStarted(false);
                                                setGameOver(false);
                                                setSolBalance(prev => prev + (survivorsCount === 1 ? 1000 : Math.floor(gameTime * 2 + kills * 25)));
                                            }}
                                            className="text-xl px-12 py-4 font-black tracking-wider shadow-2xl shadow-red-900/50 border-2 border-red-500/50 relative z-10"
                                        >
                                            <span className="flex items-center gap-3">
                                                <span className="text-2xl">💀</span>
                                                {survivorsCount === 1 ? "CLAIM YOUR THRONE AGAIN" : "SEEK REDEMPTION"}
                                                <span className="text-2xl">💀</span>
                                            </span>
                                        </Button>

                                        <p className="text-red-400 text-sm mt-4 font-semibold relative z-10">
                                            {survivorsCount === 1 ? "The arena awaits your return, champion..." : "Will you rise from the ashes?"}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PurgeGame;