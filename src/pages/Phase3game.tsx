// src/pages/Phase3Game.tsx - Battle Royale Game Arena

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePurgeMultiplayer } from '../hooks/usePurgeMultiplayer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Users, Target, Zap } from 'lucide-react';

interface LocalPlayer {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    hp: number;
    maxHp: number;
    isAlive: boolean;
}

const Phase3Game: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const wallet = useWallet();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();

    // Local player state
    const [localPlayer, setLocalPlayer] = useState<LocalPlayer>({
        x: 1000,
        y: 1000,
        vx: 0,
        vy: 0,
        rotation: 0,
        hp: 100,
        maxHp: 100,
        isAlive: true
    });

    // Input state
    const keysPressed = useRef<Set<string>>(new Set());
    const lastSentUpdate = useRef(Date.now());

    // Multiplayer
    const {
        connected,
        players,
        activePlayers,
        safeZone,
        sendUpdate,
        sendEliminated,
        connectionQuality
    } = usePurgeMultiplayer({
        gameId: gameId || '1',
        playerId: wallet.publicKey?.toString() || '',
        enabled: !!wallet.publicKey
    });

    // Constants
    const PLAYER_RADIUS = 20;
    const PLAYER_SPEED = 200;
    const MAP_WIDTH = 2000;
    const MAP_HEIGHT = 2000;
    const CAMERA_LERP = 0.1;

    // Camera state
    const camera = useRef({ x: 1000, y: 1000 });

    // Handle keyboard input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysPressed.current.add(e.key.toLowerCase());
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysPressed.current.delete(e.key.toLowerCase());
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Check if player is in safe zone
    const checkSafeZone = useCallback(() => {
        if (!safeZone) return true;

        const dx = localPlayer.x - safeZone.centerX;
        const dy = localPlayer.y - safeZone.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance <= safeZone.radius;
    }, [localPlayer, safeZone]);

    // Update local player
    const updateLocalPlayer = useCallback((deltaTime: number) => {
        if (!localPlayer.isAlive) return;

        const dt = deltaTime / 1000; // Convert to seconds

        // Calculate velocity from input
        let vx = 0;
        let vy = 0;

        if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) {
            vy -= PLAYER_SPEED;
        }
        if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) {
            vy += PLAYER_SPEED;
        }
        if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) {
            vx -= PLAYER_SPEED;
        }
        if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
            vx += PLAYER_SPEED;
        }

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            const magnitude = Math.sqrt(vx * vx + vy * vy);
            vx = (vx / magnitude) * PLAYER_SPEED;
            vy = (vy / magnitude) * PLAYER_SPEED;
        }

        // Update position
        let newX = localPlayer.x + vx * dt;
        let newY = localPlayer.y + vy * dt;

        // Clamp to map bounds
        newX = Math.max(PLAYER_RADIUS, Math.min(MAP_WIDTH - PLAYER_RADIUS, newX));
        newY = Math.max(PLAYER_RADIUS, Math.min(MAP_HEIGHT - PLAYER_RADIUS, newY));

        // Calculate rotation
        let rotation = localPlayer.rotation;
        if (vx !== 0 || vy !== 0) {
            rotation = Math.atan2(vy, vx);
        }

        // Check safe zone damage
        const isInSafeZone = checkSafeZone();
        let newHp = localPlayer.hp;

        if (!isInSafeZone && safeZone) {
            // Apply damage (5 HP per second)
            newHp = Math.max(0, localPlayer.hp - 5 * dt);

            if (newHp <= 0 && localPlayer.isAlive) {
                sendEliminated();
                setLocalPlayer(prev => ({ ...prev, isAlive: false, hp: 0 }));
                return;
            }
        }

        // Update state
        setLocalPlayer(prev => ({
            ...prev,
            x: newX,
            y: newY,
            vx,
            vy,
            rotation,
            hp: newHp
        }));

        // Send update to server (throttled)
        const now = Date.now();
        if (now - lastSentUpdate.current > 50) { // 20 updates/sec
            sendUpdate({
                x: newX,
                y: newY,
                velocityX: vx,
                velocityY: vy,
                rotation,
                hp: newHp,
                isInSafeZone
            });
            lastSentUpdate.current = now;
        }
    }, [localPlayer, sendUpdate, sendEliminated, checkSafeZone, safeZone]);

    // Render game
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Update camera to follow player (smooth)
        camera.current.x += (localPlayer.x - camera.current.x) * CAMERA_LERP;
        camera.current.y += (localPlayer.y - camera.current.y) * CAMERA_LERP;

        // Clear canvas
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Save context
        ctx.save();

        // Translate to camera position
        ctx.translate(
            canvas.width / 2 - camera.current.x,
            canvas.height / 2 - camera.current.y
        );

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 100;
        for (let x = 0; x < MAP_WIDTH; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, MAP_HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y < MAP_HEIGHT; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(MAP_WIDTH, y);
            ctx.stroke();
        }

        // Draw map border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

        // Draw safe zone
        if (safeZone) {
            // Draw safe zone circle
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(safeZone.centerX, safeZone.centerY, safeZone.radius, 0, Math.PI * 2);
            ctx.stroke();

            // Fill safe zone
            ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
            ctx.fill();

            // Draw target radius if shrinking
            if (safeZone.shrinking && safeZone.targetRadius < safeZone.radius) {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.arc(safeZone.centerX, safeZone.centerY, safeZone.targetRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw danger zone (outside safe zone)
            ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctx.beginPath();
            ctx.rect(0, 0, MAP_WIDTH, MAP_HEIGHT);
            ctx.arc(safeZone.centerX, safeZone.centerY, safeZone.radius, 0, Math.PI * 2, true);
            ctx.fill();
        }

        // Draw other players
        activePlayers.forEach(player => {
            if (player.id === wallet.publicKey?.toString()) return; // Skip self

            const isInSafeZone = safeZone ?
                Math.sqrt(
                    Math.pow(player.x - safeZone.centerX, 2) +
                    Math.pow(player.y - safeZone.centerY, 2)
                ) <= safeZone.radius : true;

            // Draw player circle
            ctx.fillStyle = isInSafeZone ? '#3b82f6' : '#ef4444';
            ctx.beginPath();
            ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
            ctx.fill();

            // Draw direction indicator
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(player.rotation);
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(PLAYER_RADIUS, 0);
            ctx.lineTo(PLAYER_RADIUS - 10, -5);
            ctx.lineTo(PLAYER_RADIUS - 10, 5);
            ctx.fill();
            ctx.restore();

            // Draw health bar
            const healthBarWidth = 40;
            const healthBarHeight = 5;
            const healthPercent = player.hp / player.maxHp;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(
                player.x - healthBarWidth / 2,
                player.y - PLAYER_RADIUS - 15,
                healthBarWidth,
                healthBarHeight
            );

            ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
            ctx.fillRect(
                player.x - healthBarWidth / 2,
                player.y - PLAYER_RADIUS - 15,
                healthBarWidth * healthPercent,
                healthBarHeight
            );

            // Draw player name
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
                player.walletAddress.slice(0, 6) + '...',
                player.x,
                player.y - PLAYER_RADIUS - 20
            );
        });

        // Draw local player
        if (localPlayer.isAlive) {
            const isInSafeZone = checkSafeZone();

            // Draw player circle
            ctx.fillStyle = isInSafeZone ? '#8b5cf6' : '#ef4444';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(localPlayer.x, localPlayer.y, PLAYER_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw direction indicator
            ctx.save();
            ctx.translate(localPlayer.x, localPlayer.y);
            ctx.rotate(localPlayer.rotation);
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(PLAYER_RADIUS, 0);
            ctx.lineTo(PLAYER_RADIUS - 10, -5);
            ctx.lineTo(PLAYER_RADIUS - 10, 5);
            ctx.fill();
            ctx.restore();

            // Draw health bar
            const healthBarWidth = 40;
            const healthBarHeight = 5;
            const healthPercent = localPlayer.hp / localPlayer.maxHp;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(
                localPlayer.x - healthBarWidth / 2,
                localPlayer.y - PLAYER_RADIUS - 15,
                healthBarWidth,
                healthBarHeight
            );

            ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
            ctx.fillRect(
                localPlayer.x - healthBarWidth / 2,
                localPlayer.y - PLAYER_RADIUS - 15,
                healthBarWidth * healthPercent,
                healthBarHeight
            );

            // Draw "YOU" label
            ctx.fillStyle = '#8b5cf6';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('YOU', localPlayer.x, localPlayer.y - PLAYER_RADIUS - 25);
        }

        ctx.restore();
    }, [localPlayer, activePlayers, safeZone, wallet.publicKey, checkSafeZone]);

    // Game loop
    useEffect(() => {
        let lastTime = Date.now();

        const gameLoop = () => {
            const now = Date.now();
            const deltaTime = now - lastTime;
            lastTime = now;

            updateLocalPlayer(deltaTime);
            render();

            animationFrameRef.current = requestAnimationFrame(gameLoop);
        };

        gameLoop();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [updateLocalPlayer, render]);

    // Resize canvas
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // HUD
    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black">
            {/* Game Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0"
                style={{ cursor: 'none' }}
            />

            {/* HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Top HUD */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto">
                    <Card className="bg-black/80 border-purple-500/50 backdrop-blur-sm px-6 py-3">
                        <div className="flex items-center gap-3">
                            <Heart className="w-5 h-5 text-red-400" />
                            <div>
                                <p className="text-xs text-gray-400">Health</p>
                                <p className="text-2xl font-bold text-white">
                                    {Math.ceil(localPlayer.hp)}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-black/80 border-blue-500/50 backdrop-blur-sm px-6 py-3">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-blue-400" />
                            <div>
                                <p className="text-xs text-gray-400">Alive</p>
                                <p className="text-2xl font-bold text-white">
                                    {activePlayers.length + 1}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-black/80 border-green-500/50 backdrop-blur-sm px-6 py-3">
                        <div className="flex items-center gap-3">
                            <Target className="w-5 h-5 text-green-400" />
                            <div>
                                <p className="text-xs text-gray-400">Safe Zone</p>
                                <p className="text-2xl font-bold text-white">
                                    {safeZone ? Math.ceil(safeZone.radius) : 0}m
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Connection Status */}
                <div className="absolute top-4 right-4">
                    <Badge variant="outline" className={
                        connected ? 'text-green-400 border-green-400' : 'text-red-400 border-red-400'
                    }>
                        {connected ? '🟢 Connected' : '🔴 Disconnected'}
                    </Badge>
                    {connectionQuality !== 'good' && (
                        <Badge variant="outline" className="ml-2 text-yellow-400 border-yellow-400">
                            {connectionQuality}
                        </Badge>
                    )}
                </div>

                {/* Controls */}
                <div className="absolute bottom-4 left-4">
                    <Card className="bg-black/80 border-gray-700 backdrop-blur-sm px-4 py-2">
                        <p className="text-xs text-gray-400 mb-1">Controls:</p>
                        <p className="text-sm text-white">WASD / Arrow Keys - Move</p>
                    </Card>
                </div>

                {/* Warning if outside safe zone */}
                {!checkSafeZone() && localPlayer.isAlive && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Card className="bg-red-900/90 border-red-500 backdrop-blur-sm px-8 py-6">
                            <div className="text-center">
                                <Zap className="w-12 h-12 text-red-400 mx-auto mb-2 animate-pulse" />
                                <p className="text-2xl font-bold text-white mb-1">
                                    ⚠️ DANGER ZONE
                                </p>
                                <p className="text-red-200">
                                    Return to safe zone or take damage!
                                </p>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Death screen */}
                {!localPlayer.isAlive && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                        <Card className="bg-red-900/90 border-red-500 px-12 py-8">
                            <div className="text-center">
                                <p className="text-6xl font-black text-red-400 mb-4">
                                    ELIMINATED
                                </p>
                                <p className="text-xl text-gray-300 mb-6">
                                    You have been eliminated from the game
                                </p>
                                <p className="text-sm text-gray-400">
                                    Spectating remaining players...
                                </p>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Phase3Game;