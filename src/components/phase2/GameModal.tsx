import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CryptoTriviaGame from './games/CryptoTriviaGame';
import RockPaperScissorsGame from './games/RockPaperScissorsGame';
import SpeedTradingGame from './games/SpeedTradingGame';
import MemeBattleGame from './games/MemeBattlesGame';
import { X, Clock, Trophy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface GameModalProps {
    challengePDA: PublicKey;
    challengeId: string;
    gameType: 'CryptoTrivia' | 'RockPaperScissors' | 'SpeedTrading' | 'MemeBattle';
    challenger: PublicKey;
    opponent: PublicKey;
    betAmount: number;
    myAddress: PublicKey;
    onGameEnd: (winner: PublicKey) => Promise<void>;
    onClose: () => void;
}

export default function GameModal({
    challengePDA,
    challengeId,
    gameType,
    challenger,
    opponent,
    betAmount,
    myAddress,
    onGameEnd,
    onClose
}: GameModalProps) {
    const [timeLeft, setTimeLeft] = useState(180);
    const [canClose, setCanClose] = useState(false);
    const [gameResult, setGameResult] = useState<{
        winner: PublicKey;
        loser: PublicKey;
    } | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);

    const isChallenger = challenger.equals(myAddress);
    const opponentAddress = isChallenger ? opponent : challenger;

    // 🔍 Debug logging
    useEffect(() => {
        console.log('🎮 [GameModal] Initialized with:', {
            gameType,
            challengeId,
            isChallenger,
            myAddress: myAddress.toBase58(),
            challenger: challenger.toBase58(),
            opponent: opponent.toBase58(),
            betAmount
        });
    }, []);

    useEffect(() => {
        console.log('🎮 [GameModal] State changed:', {
            gameStarted,
            canClose,
            timeLeft,
            hasResult: !!gameResult
        });
    }, [gameStarted, canClose, timeLeft, gameResult]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (!gameResult) {
                        const winner = opponentAddress;
                        const loser = myAddress;
                        setGameResult({ winner, loser });
                        toast.error('Time ran out! You lose by timeout.');
                    }
                    setCanClose(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [gameResult]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!canClose && gameStarted) {
                e.preventDefault();
                e.returnValue = "Game in progress! Leaving will result in a loss.";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [canClose, gameStarted]);

    const handleGameComplete = async (winner: PublicKey) => {
        console.log('🎮 [GameModal] Game completed! Winner:', winner.toBase58());
        const loser = winner.equals(challenger) ? opponent : challenger;
        setGameResult({ winner, loser });
        setCanClose(true);

        setClaiming(true);
        try {
            await onGameEnd(winner);

            if (winner.equals(myAddress)) {
                toast.success(`🎉 You won ${(betAmount * 2).toFixed(4)} SOL!`);
            } else {
                toast.info('Better luck next time!');
            }
        } catch (error: any) {
            console.error('Error claiming win:', error);
            toast.error('Failed to claim winnings on-chain');
        } finally {
            setClaiming(false);
        }
    };

    const handleGameStart = () => {
        console.log('🎮 [GameModal] Game started!');
        setGameStarted(true);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getGameTitle = () => {
        switch (gameType) {
            case 'CryptoTrivia': return '🧠 Crypto Trivia';
            case 'RockPaperScissors': return '✂️ Crypto Battle';
            case 'SpeedTrading': return '📈 Speed Trading';
            case 'MemeBattle': return '🎭 Meme Battle';
        }
    };

    console.log('🎮 [GameModal] Rendering with gameType:', gameType);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
        >
            <Card className="w-full max-w-5xl max-h-[95vh] overflow-y-auto relative animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="sticky top-0 bg-background/98 backdrop-blur-lg border-b border-border z-10 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Clock className={`w-5 h-5 ${timeLeft < 30 ? 'text-red-400 animate-pulse' : 'text-sol-orange'}`} />
                                <span className={`text-2xl font-bold tabular-nums ${timeLeft < 30 ? 'text-red-400' : ''}`}>
                                    {formatTime(timeLeft)}
                                </span>
                            </div>
                            {timeLeft < 30 && (
                                <span className="text-red-400 text-sm font-medium animate-pulse flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4" />
                                    Hurry up!
                                </span>
                            )}
                        </div>

                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-1">{getGameTitle()}</h2>
                            <div className="text-sm text-muted-foreground">Prize Pool</div>
                            <div className="text-xl font-bold text-sol-orange">
                                {(betAmount * 2).toFixed(4)} SOL
                            </div>
                        </div>

                        {canClose && !claiming && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="absolute top-4 right-4"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        )}
                    </div>

                    {!canClose && !gameStarted && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                            <p className="text-sm text-yellow-300 flex items-center justify-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Window cannot be closed until game ends or times out!
                            </p>
                        </div>
                    )}
                </div>

                {/* Game Content */}
                <div className="p-6">
                    {/* Normalize gameType for comparison */}
                    {gameType.toLowerCase() === 'cryptotrivia' && (
                        <CryptoTriviaGame
                            onComplete={handleGameComplete}
                            challenger={challenger}
                            opponent={opponent}
                            myAddress={myAddress}
                            challengeId={challengeId}
                            onGameStart={handleGameStart}
                        />
                    )}

                    {gameType.toLowerCase() === 'rockpaperscissors' && (
                        <RockPaperScissorsGame
                            onComplete={handleGameComplete}
                            challenger={challenger}
                            opponent={opponent}
                            myAddress={myAddress}
                            challengeId={challengeId}
                            onGameStart={handleGameStart}
                        />
                    )}

                    {gameType.toLowerCase() === 'speedtrading' && (
                        <SpeedTradingGame
                            onComplete={handleGameComplete}
                            challenger={challenger}
                            opponent={opponent}
                            myAddress={myAddress}
                            challengeId={challengeId}
                            onGameStart={handleGameStart}
                        />
                    )}

                    {gameType.toLowerCase() === 'memebattle' && (
                        <MemeBattleGame
                            onComplete={handleGameComplete}
                            challenger={challenger}
                            opponent={opponent}
                            myAddress={myAddress}
                            challengeId={challengeId}
                            onGameStart={handleGameStart}
                        />
                    )}

                    {/* 🔍 Debug info */}
                    <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs">
                        <p className="font-mono">Game Type (raw): {gameType}</p>
                        <p className="font-mono">Game Type (lower): {gameType.toLowerCase()}</p>
                        <p className="font-mono">Game Started: {gameStarted ? 'Yes' : 'No'}</p>
                        <p className="font-mono">Can Close: {canClose ? 'Yes' : 'No'}</p>
                        <p className="font-mono">Time Left: {timeLeft}s</p>
                    </div>
                </div>

                {/* Result Display */}
                {gameResult && (
                    <div className="border-t border-border p-8 text-center bg-gradient-to-b from-background to-accent/20">
                        <Trophy className={`w-20 h-20 mx-auto mb-4 ${gameResult.winner.equals(myAddress) ? 'text-yellow-400' : 'text-gray-400'
                            }`} />
                        <h2 className="text-3xl font-bold mb-3">
                            {gameResult.winner.equals(myAddress) ? (
                                <span className="text-green-400 animate-pulse">🎉 Victory!</span>
                            ) : (
                                <span className="text-red-400">Game Over</span>
                            )}
                        </h2>
                        <p className="text-lg text-muted-foreground mb-2">
                            {gameResult.winner.equals(myAddress)
                                ? `You won ${(betAmount * 2).toFixed(4)} SOL!`
                                : `You lost ${betAmount.toFixed(4)} SOL`
                            }
                        </p>
                        {claiming && (
                            <div className="mt-4">
                                <div className="inline-flex items-center gap-2 text-sol-orange">
                                    <div className="w-4 h-4 border-2 border-sol-orange border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm font-medium">Claiming winnings on-chain...</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Close Button */}
                {canClose && !claiming && (
                    <div className="border-t border-border p-6">
                        <Button
                            variant="sol"
                            onClick={onClose}
                            className="w-full h-12 text-lg"
                        >
                            Close Game
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}