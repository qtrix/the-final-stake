// src/components/phase2/RockPaperScissorsGame.tsx - VERSIUNE COMPLETĂ FIXATĂ

import { useState, useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BattleHandler, type BattleState } from '@/lib/battleHandler';
import { rpsEngine, type RPSMove } from '@/lib/gameEngines/rockPaperScissors';
import { Clock, Trophy, Zap, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface RockPaperScissorsGameProps {
    challengeId: string;
    playerAddress: PublicKey;
    opponentAddress: PublicKey;
    betAmount: number;
    onGameEnd: (winner: PublicKey) => void;
}

export default function RockPaperScissorsGame({
    challengeId,
    playerAddress,
    opponentAddress,
    betAmount,
    onGameEnd,
}: RockPaperScissorsGameProps) {
    const [battleState, setBattleState] = useState<BattleState | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(30);

    const battleHandlerRef = useRef<BattleHandler | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // ✅ Initialize battle handler ONCE
    useEffect(() => {
        console.log('🎮 [INIT] Initializing battle handler');

        const handler = new BattleHandler(
            challengeId,
            playerAddress,
            opponentAddress,
            betAmount,
            30
        );

        handler.onUpdate((state) => {
            if (!mountedRef.current) return;
            console.log('🔄 Battle state updated:', state.battleStatus);
            setBattleState(state);
        });

        handler.onTimeoutEvent(() => {
            if (!mountedRef.current) return;
            console.log('⏰ Round timeout triggered');
            toast.warning('⏰ Round timeout! Auto-submitting move...');
        });

        handler.onGameEndEvent((winner) => {
            if (!mountedRef.current) return;
            console.log('🏆 Game ended, winner:', winner.toBase58());
            const isWinner = winner.equals(playerAddress);

            if (isWinner) {
                toast.success('🎉 You won the game!');
            } else {
                toast.error('😞 You lost the game');
            }

            setTimeout(() => {
                if (mountedRef.current) {
                    onGameEnd(winner);
                }
            }, 3000);
        });

        battleHandlerRef.current = handler;
        setBattleState(handler.getState());

        // Start battle after short delay
        setTimeout(() => {
            if (mountedRef.current) {
                console.log('🚀 Starting battle...');
                handler.startBattle();
            }
        }, 500);

        return () => {
            console.log('🧹 [CLEANUP] Unmounting game component');
            mountedRef.current = false;

            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }

            if (battleHandlerRef.current) {
                battleHandlerRef.current.destroy();
                battleHandlerRef.current = null;
            }
        };
    }, []);

    // ✅ FIX: Timer countdown effect
    useEffect(() => {
        if (!battleHandlerRef.current) return;

        // Clear any existing timer
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        // Only run timer when battle is in progress and player hasn't moved
        if (battleState?.battleStatus !== 'in_progress' || battleState?.playerMove) {
            return;
        }

        console.log('⏱️ Starting countdown timer');

        // Update timer every 100ms for smooth countdown
        timerIntervalRef.current = setInterval(() => {
            if (!battleHandlerRef.current || !mountedRef.current) {
                return;
            }

            const remaining = battleHandlerRef.current.getTimeRemaining();
            const roundedTime = Math.ceil(remaining);

            setTimeRemaining(roundedTime);

            // Log when time is running low
            if (roundedTime <= 5 && roundedTime > 0) {
                console.log(`⏰ ${roundedTime} seconds remaining!`);
            }

            // Stop timer when it reaches 0
            if (remaining <= 0) {
                console.log('⏰ Timer expired!');
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
            }
        }, 100);

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [battleState?.battleStatus, battleState?.playerMove]);

    // ✅ FIX: Handle move selection
    const handleMove = (move: RPSMove) => {
        console.log('🎯 Player selected move:', move);

        if (!battleHandlerRef.current) {
            console.error('❌ Battle handler not initialized');
            toast.error('Game not ready');
            return;
        }

        if (battleState?.playerMove) {
            console.log('⚠️ Already submitted a move:', battleState.playerMove);
            toast.warning('Move already submitted!');
            return;
        }

        if (battleState?.battleStatus !== 'in_progress') {
            console.log('⚠️ Battle not in progress, status:', battleState?.battleStatus);
            toast.error('Wait for battle to start');
            return;
        }

        if (timeRemaining <= 0) {
            console.log('⚠️ Time expired');
            toast.error('Time expired!');
            return;
        }

        // Submit move to battle handler
        try {
            battleHandlerRef.current.submitMove(move);
            console.log('✅ Move submitted successfully');

            // Stop timer after move is submitted
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }

            toast.success(`You chose ${move.toUpperCase()}! 🎯`);
        } catch (error: any) {
            console.error('❌ Error submitting move:', error);
            toast.error(error.message || 'Failed to submit move');
        }
    };

    if (!battleState) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-sol-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Initializing battle...</p>
                </div>
            </div>
        );
    }

    const { gameState, battleStatus, playerMove, opponentConnected, waitingForOpponent, error } = battleState;
    const lastRound = gameState.rounds[gameState.rounds.length - 1];
    const timeProgress = (timeRemaining / 30) * 100;

    return (
        <div className="space-y-6">
            {/* Connection Status */}
            <Card className={`${battleStatus === 'connecting' ? 'bg-blue-500/10 border-blue-500/30' :
                    battleStatus === 'waiting_for_opponent' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        battleStatus === 'error' ? 'bg-red-500/10 border-red-500/30' :
                            'bg-green-500/10 border-green-500/30'
                }`}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {battleStatus === 'connecting' && (
                                <>
                                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm">Connecting to server...</span>
                                </>
                            )}
                            {battleStatus === 'waiting_for_opponent' && (
                                <>
                                    <WifiOff className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm">Waiting for opponent to join...</span>
                                </>
                            )}
                            {battleStatus === 'in_progress' && (
                                <>
                                    <Wifi className="w-4 h-4 text-green-400" />
                                    <span className="text-sm">Connected - Both players ready!</span>
                                </>
                            )}
                            {battleStatus === 'error' && (
                                <>
                                    <WifiOff className="w-4 h-4 text-red-400" />
                                    <span className="text-sm text-red-400">{error || 'Connection error'}</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${opponentConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
                            <span className="text-xs text-muted-foreground">
                                {opponentConnected ? 'Opponent online' : 'Waiting...'}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Scores */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Your Score</p>
                        <p className="text-4xl font-bold text-green-400">{gameState.playerScore}</p>
                    </CardContent>
                </Card>

                <Card className="bg-sol-orange/10 border-sol-orange/30">
                    <CardContent className="p-4 text-center">
                        <Trophy className="w-8 h-8 mx-auto mb-2 text-sol-orange" />
                        <p className="text-sm text-muted-foreground">Round {gameState.currentRound}/5</p>
                        <p className="text-xs text-muted-foreground mt-1">Best of 5</p>
                    </CardContent>
                </Card>

                <Card className="bg-red-500/10 border-red-500/30">
                    <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Opponent</p>
                        <p className="text-4xl font-bold text-red-400">{gameState.opponentScore}</p>
                    </CardContent>
                </Card>
            </div>

            {/* ✅ FIXED: Timer with countdown */}
            {battleStatus === 'in_progress' && !playerMove && gameState.gameStatus === 'playing' && (
                <Card className="bg-accent/50 border-sol-orange/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-sol-orange" />
                                <span className="font-semibold">Time Remaining</span>
                            </div>
                            <span className={`text-2xl font-bold ${timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-sol-orange'
                                }`}>
                                {timeRemaining}s
                            </span>
                        </div>
                        <Progress value={timeProgress} className="h-2" />
                        {timeRemaining <= 5 && timeRemaining > 0 && (
                            <p className="text-xs text-red-400 text-center mt-2 animate-pulse font-semibold">
                                ⚠️ HURRY UP!
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Waiting for opponent */}
            {battleStatus === 'in_progress' && playerMove && waitingForOpponent && (
                <Card className="bg-blue-500/10 border-blue-500/30 animate-pulse">
                    <CardContent className="p-6 text-center">
                        <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-lg font-semibold mb-2">Waiting for opponent...</p>
                        <p className="text-sm text-muted-foreground mb-3">
                            You chose: <span className="text-2xl ml-2">{rpsEngine.getMoveEmoji(playerMove)}</span>
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Result display - shown when both moves received */}
            {lastRound && lastRound.opponentMove && lastRound.playerMove && gameState.gameStatus === 'playing' && (
                <Card className={`border-2 ${lastRound.result === 'win' ? 'bg-green-500/20 border-green-500' :
                        lastRound.result === 'lose' ? 'bg-red-500/20 border-red-500' :
                            'bg-yellow-500/20 border-yellow-500'
                    } animate-in fade-in zoom-in duration-500`}>
                    <CardContent className="p-8 text-center">
                        <div className="text-6xl mb-4">
                            {lastRound.result === 'win' ? '🎉' : lastRound.result === 'lose' ? '😞' : '🤝'}
                        </div>
                        <h3 className={`text-3xl font-bold mb-4 ${rpsEngine.getResultColor(lastRound.result)}`}>
                            {rpsEngine.getResultText(lastRound.result)}
                        </h3>
                        <div className="flex justify-center items-center gap-8 text-4xl">
                            <div className="text-center">
                                <div className="mb-2">{rpsEngine.getMoveEmoji(lastRound.playerMove)}</div>
                                <p className="text-sm text-muted-foreground">You</p>
                            </div>
                            <div className="text-2xl text-muted-foreground">VS</div>
                            <div className="text-center">
                                <div className="mb-2">{rpsEngine.getMoveEmoji(lastRound.opponentMove)}</div>
                                <p className="text-sm text-muted-foreground">Opponent</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Game finished */}
            {gameState.gameStatus === 'finished' && (
                <Card className={`border-2 ${gameState.winner === 'player' ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'
                    }`}>
                    <CardContent className="p-8 text-center">
                        <div className="text-6xl mb-4">
                            {gameState.winner === 'player' ? '🏆' : '💔'}
                        </div>
                        <h2 className="text-4xl font-bold mb-4">
                            {gameState.winner === 'player' ? 'Victory!' : 'Defeat'}
                        </h2>
                        <p className="text-xl mb-6">
                            Final Score: {gameState.playerScore} - {gameState.opponentScore}
                        </p>
                        <p className="text-lg text-muted-foreground">
                            {gameState.winner === 'player'
                                ? `You won ${(betAmount * 2).toFixed(4)} SOL!`
                                : `You lost ${betAmount.toFixed(4)} SOL`}
                        </p>
                        <p className="text-sm text-muted-foreground mt-4">
                            Claiming rewards in 3 seconds...
                        </p>
                        <div className="mt-6">
                            <Progress value={100} className="h-2" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ✅ FIXED: Move buttons with handleMove */}
            {battleStatus === 'in_progress' && !playerMove && gameState.gameStatus === 'playing' && (
                <div className="grid grid-cols-3 gap-4">
                    <Button
                        onClick={() => handleMove('rock')}
                        disabled={timeRemaining <= 0}
                        variant="outline"
                        className="h-32 flex flex-col items-center justify-center border-2 hover:border-sol-orange hover:bg-sol-orange/10 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-6xl mb-2">🪨</span>
                        <span className="font-bold">ROCK</span>
                    </Button>

                    <Button
                        onClick={() => handleMove('paper')}
                        disabled={timeRemaining <= 0}
                        variant="outline"
                        className="h-32 flex flex-col items-center justify-center border-2 hover:border-sol-orange hover:bg-sol-orange/10 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-6xl mb-2">📄</span>
                        <span className="font-bold">PAPER</span>
                    </Button>

                    <Button
                        onClick={() => handleMove('scissors')}
                        disabled={timeRemaining <= 0}
                        variant="outline"
                        className="h-32 flex flex-col items-center justify-center border-2 hover:border-sol-orange hover:bg-sol-orange/10 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-6xl mb-2">✂️</span>
                        <span className="font-bold">SCISSORS</span>
                    </Button>
                </div>
            )}

            {/* Round History */}
            {gameState.rounds.length > 0 && (
                <Card className="bg-accent/30">
                    <CardContent className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Round History
                        </h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {gameState.rounds.map((round) => (
                                <div
                                    key={round.roundNumber}
                                    className={`flex items-center justify-between p-3 rounded-lg ${round.result === 'win' ? 'bg-green-500/10' :
                                            round.result === 'lose' ? 'bg-red-500/10' :
                                                'bg-yellow-500/10'
                                        }`}
                                >
                                    <span className="text-sm text-muted-foreground">Round {round.roundNumber}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">{rpsEngine.getMoveEmoji(round.playerMove)}</span>
                                        <span className="text-xs text-muted-foreground">vs</span>
                                        <span className="text-2xl">{rpsEngine.getMoveEmoji(round.opponentMove)}</span>
                                    </div>
                                    <span className={`text-sm font-semibold ${rpsEngine.getResultColor(round.result)}`}>
                                        {rpsEngine.getResultText(round.result)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}