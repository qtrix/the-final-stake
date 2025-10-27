// src/pages/Phase3.tsx - Phase 3 Lobby (UPDATED)

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolanaGame } from '../hooks/useSolanaGame';
import { usePurgeMultiplayer } from '../hooks/usePurgeMultiplayer';
import { Game } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Clock, Users, Trophy, AlertCircle, CheckCircle, Loader2,
    Target, Zap, Coins, Wifi, WifiOff, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Phase3 = () => {
    const navigate = useNavigate();
    const wallet = useWallet();
    const solanaGame = useSolanaGame();

    const {
        games,
        markReadyPhase3,
        loading,
    } = solanaGame || {};

    // State
    const [currentGame, setCurrentGame] = useState<Game | null>(null);
    const [gameId, setGameId] = useState<number | null>(null);
    const [isMarkingReady, setIsMarkingReady] = useState(false);

    // Multiplayer hook
    const {
        connected,
        reconnecting,
        connectionQuality,
        gamePhase,
        countdown,
        players,
        playersArray,
        readyPlayers,
        totalPlayers,
        readyCount,
        sendReady,
    } = usePurgeMultiplayer({
        gameId: gameId?.toString() || '0',
        playerId: wallet.publicKey?.toString() || '',
        enabled: !!wallet.publicKey && !!gameId
    });

    // Find current Phase 3 game
    useEffect(() => {
        if (!games || games.length === 0) return;

        const phase3Game = games.find(g =>
            g.currentPhase === 3 &&
            !g.isFinished
        );

        if (phase3Game) {
            setCurrentGame(phase3Game);
            setGameId(phase3Game.gameId);
            console.log('[Phase3] Found game:', phase3Game.gameId);
        }
    }, [games]);

    // Check if current player is ready
    const myPlayer = players[wallet.publicKey?.toString() || ''];
    const isReady = myPlayer?.ready || false;

    // Handle mark ready
    const handleMarkReady = async () => {
        if (!gameId || !wallet.publicKey || !markReadyPhase3) {
            toast.error('Not ready to mark ready');
            return;
        }

        setIsMarkingReady(true);

        try {
            // 1. Execute Solana transaction
            console.log('[Phase3] Marking ready on chain...');
            await markReadyPhase3(gameId);

            // 2. Notify WebSocket server
            console.log('[Phase3] Notifying WebSocket server...');
            sendReady();

            toast.success('✅ Marked as ready!');
        } catch (error: any) {
            console.error('[Phase3] Failed to mark ready:', error);
            toast.error(error.message || 'Failed to mark ready');
        } finally {
            setIsMarkingReady(false);
        }
    };

    // Connection status indicator
    const ConnectionStatus = () => (
        <div className="flex items-center gap-2 text-sm">
            {connected ? (
                <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Connected</span>
                    {connectionQuality !== 'good' && (
                        <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                            {connectionQuality}
                        </Badge>
                    )}
                </>
            ) : reconnecting ? (
                <>
                    <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                    <span className="text-yellow-400">Reconnecting...</span>
                </>
            ) : (
                <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Disconnected</span>
                </>
            )}
        </div>
    );

    // Countdown display
    const CountdownDisplay = () => {
        if (!countdown) return null;

        return (
            <Alert className="bg-orange-900/30 border-orange-500 mb-6">
                <Clock className="h-4 w-4" />
                <AlertTitle className="text-orange-300 font-bold text-2xl">
                    Game Starting in {countdown}s
                </AlertTitle>
                <AlertDescription className="text-orange-200">
                    Prepare for battle! Non-ready players will be eliminated.
                </AlertDescription>
            </Alert>
        );
    };

    // Game info display
    const GameInfo = () => {
        if (!currentGame) return null;

        return (
            <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        Game #{gameId}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-400">Phase</p>
                            <p className="text-2xl font-bold text-purple-400">3</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Prize Pool</p>
                            <p className="text-2xl font-bold text-green-400">
                                {((currentGame.prizePool || 0) / 1e9).toFixed(2)} SOL
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Status</p>
                            <Badge variant="outline" className={
                                gamePhase === 'waiting' ? 'text-blue-400 border-blue-400' :
                                    gamePhase === 'countdown' ? 'text-orange-400 border-orange-400' :
                                        gamePhase === 'active' ? 'text-green-400 border-green-400' :
                                            'text-red-400 border-red-400'
                            }>
                                {gamePhase}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Players</p>
                            <p className="text-2xl font-bold text-blue-400">
                                {totalPlayers}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Players list
    const PlayersList = () => (
        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Users className="w-6 h-6" />
                        Players in Lobby
                    </span>
                    <Badge variant="outline" className="text-green-400 border-green-400">
                        {readyCount}/{totalPlayers} Ready
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {playersArray.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Waiting for players to join...</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {playersArray.map((player) => (
                            <div
                                key={player.id}
                                className={`flex items-center justify-between p-3 rounded-lg ${player.id === wallet.publicKey?.toString()
                                        ? 'bg-purple-900/30 border border-purple-500'
                                        : 'bg-black/20'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {player.ready ? (
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <Clock className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <p className="font-mono text-sm">
                                            {player.walletAddress.slice(0, 8)}...{player.walletAddress.slice(-6)}
                                        </p>
                                        {player.id === wallet.publicKey?.toString() && (
                                            <Badge variant="outline" className="text-purple-400 border-purple-400 mt-1">
                                                You
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-400">
                                        {(player.vsolBalance / 1e9).toFixed(2)} VSOL
                                    </p>
                                    {player.ready && (
                                        <Badge variant="outline" className="text-green-400 border-green-400 mt-1">
                                            Ready
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // Ready button
    const ReadyButton = () => {
        if (gamePhase !== 'waiting') return null;

        return (
            <Button
                onClick={handleMarkReady}
                disabled={!connected || isReady || isMarkingReady}
                className={`w-full py-8 text-2xl font-black ${isReady
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                    }`}
                size="lg"
            >
                {isMarkingReady ? (
                    <>
                        <Loader2 className="w-8 h-8 mr-3 animate-spin" />
                        Marking Ready...
                    </>
                ) : isReady ? (
                    <>
                        <CheckCircle className="w-8 h-8 mr-3" />
                        ✅ YOU ARE READY
                    </>
                ) : (
                    <>
                        <UserCheck className="w-8 h-8 mr-3" />
                        MARK READY
                    </>
                )}
            </Button>
        );
    };

    // Main render
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 relative overflow-hidden">
            <ParticleBackground />

            <div className="relative z-20">
                <Navbar />
            </div>

            <main className="relative z-10 container mx-auto px-4 pt-24 pb-16">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-6xl md:text-8xl font-black mb-4">
                            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                                PHASE 3
                            </span>
                        </h1>
                        <p className="text-2xl text-gray-300 mb-4">
                            The Final Battle
                        </p>
                        <ConnectionStatus />
                    </div>

                    {/* Countdown */}
                    <CountdownDisplay />

                    {/* Game Info */}
                    <div className="mb-6">
                        <GameInfo />
                    </div>

                    {/* Game Phase Warning */}
                    {gamePhase === 'countdown' && (
                        <Alert className="bg-red-900/30 border-red-500 mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="text-red-300 font-bold">
                                Countdown Started!
                            </AlertTitle>
                            <AlertDescription className="text-red-200">
                                {isReady
                                    ? 'You are ready for battle. Prepare yourself!'
                                    : 'You are NOT ready! You will be eliminated when the game starts!'}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Ready Button */}
                    {gamePhase === 'waiting' && (
                        <div className="mb-6">
                            <ReadyButton />
                        </div>
                    )}

                    {/* Instructions */}
                    {gamePhase === 'waiting' && (
                        <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/50 mb-6">
                            <CardContent className="pt-6">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Target className="w-6 h-6 text-blue-400" />
                                    Game Rules
                                </h3>
                                <ul className="space-y-2 text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <Zap className="w-5 h-5 text-yellow-400 mt-0.5" />
                                        Mark yourself as ready to join the battle
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Users className="w-5 h-5 text-blue-400 mt-0.5" />
                                        Game starts when 2+ players are ready
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Clock className="w-5 h-5 text-orange-400 mt-0.5" />
                                        10 second countdown before game start
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Trophy className="w-5 h-5 text-green-400 mt-0.5" />
                                        Safe zone shrinks every 60 seconds
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Target className="w-5 h-5 text-red-400 mt-0.5" />
                                        Stay inside the safe zone or take damage
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Coins className="w-5 h-5 text-yellow-400 mt-0.5" />
                                        Last player standing wins the prize pool
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Players List */}
                    <PlayersList />

                    {/* Connection Issues */}
                    {!connected && !reconnecting && (
                        <Alert className="bg-red-900/30 border-red-500 mt-6">
                            <WifiOff className="h-4 w-4" />
                            <AlertTitle className="text-red-300 font-bold">
                                Connection Lost
                            </AlertTitle>
                            <AlertDescription className="text-red-200">
                                Unable to connect to game server. Please refresh the page.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Phase3;