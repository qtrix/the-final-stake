// src/pages/Phase3Winner.tsx - Winner Page with Confetti
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Coins, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const Phase3Winner: React.FC = () => {
    const navigate = useNavigate();
    const wallet = useWallet();
    const solanaGame = useSolanaGame();
    const [searchParams] = useSearchParams();

    const gameId = parseInt(searchParams.get('gameId') || '0');
    const winnerAddress = searchParams.get('winner') || '';
    const prizeAmount = parseFloat(searchParams.get('prize') || '0');

    const [claiming, setClaiming] = useState(false);
    const [claimed, setClaimed] = useState(false);

    const isWinner = wallet.publicKey?.toBase58() === winnerAddress;

    // Confetti effect on mount
    useEffect(() => {
        if (isWinner) {
            const duration = 5000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

            const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

            const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);

                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
                });
                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
                });
            }, 250);

            return () => clearInterval(interval);
        }
    }, [isWinner]);

    const handleClaimPrize = async () => {
        if (!solanaGame || !wallet.publicKey) return;

        setClaiming(true);
        try {
            await solanaGame.claimPhase3Prize(gameId);

            toast.success('🎉 Prize claimed successfully!');
            setClaimed(true);

            await solanaGame.refreshGames();
        } catch (error: any) {
            console.error('Failed to claim prize:', error);
            toast.error(error.message || 'Failed to claim prize');
        } finally {
            setClaiming(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 relative overflow-hidden">
            <ParticleBackground />

            <div className="relative z-20">
                <Navbar />
            </div>

            <main className="relative z-10 container mx-auto px-4 pt-24 pb-16">
                <div className="max-w-4xl mx-auto">

                    {isWinner ? (
                        <div className="text-center mb-12">
                            <div className="text-9xl mb-6 animate-bounce">👑</div>

                            <h1 className="text-7xl md:text-9xl font-black mb-6">
                                <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent animate-pulse">
                                    VICTORY!
                                </span>
                            </h1>

                            <p className="text-3xl md:text-4xl text-yellow-300 font-bold mb-4">
                                YOU ARE THE ULTIMATE SURVIVOR
                            </p>

                            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                                You have conquered the arena and eliminated all opponents.
                                The prize pool is yours to claim!
                            </p>
                        </div>
                    ) : (
                        <div className="text-center mb-12">
                            <div className="text-9xl mb-6">🏆</div>

                            <h1 className="text-7xl md:text-9xl font-black mb-6">
                                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-red-500 bg-clip-text text-transparent">
                                    GAME OVER
                                </span>
                            </h1>

                            <p className="text-3xl md:text-4xl text-purple-300 font-bold mb-4">
                                A CHAMPION HAS BEEN CROWNED
                            </p>

                            <p className="text-xl text-gray-300">
                                Better luck next time, warrior.
                            </p>
                        </div>
                    )}

                    {/* Winner Card */}
                    <Card className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border-2 border-yellow-500 backdrop-blur-md mb-8">
                        <CardContent className="pt-8">
                            <div className="flex items-center justify-center gap-4 mb-6">
                                <Trophy className="w-16 h-16 text-yellow-400" />
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Winner</p>
                                    <p className="text-2xl font-mono font-bold text-yellow-300">
                                        {winnerAddress.slice(0, 8)}...{winnerAddress.slice(-8)}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-black/40 rounded-lg p-6 mb-6">
                                <div className="flex items-center justify-center gap-3 mb-2">
                                    <Coins className="w-8 h-8 text-green-400" />
                                    <p className="text-4xl font-black text-green-400">
                                        {prizeAmount.toFixed(4)} SOL
                                    </p>
                                </div>
                                <p className="text-sm text-gray-400 text-center">
                                    Prize Amount (99% of pool)
                                </p>
                            </div>

                            {isWinner && !claimed && (
                                <Button
                                    onClick={handleClaimPrize}
                                    disabled={claiming}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-8 text-2xl font-black"
                                    size="lg"
                                >
                                    {claiming ? (
                                        <>
                                            <Loader2 className="w-8 h-8 mr-3 animate-spin" />
                                            Claiming Prize...
                                        </>
                                    ) : (
                                        <>
                                            💰 CLAIM YOUR PRIZE
                                        </>
                                    )}
                                </Button>
                            )}

                            {claimed && (
                                <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6 text-center">
                                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                                    <p className="text-green-300 font-bold text-2xl mb-2">
                                        ✅ Prize Claimed Successfully!
                                    </p>
                                    <p className="text-green-400 text-lg">
                                        {prizeAmount.toFixed(4)} SOL has been transferred to your wallet
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stats Grid */}
                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                        <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-500/30">
                            <CardContent className="pt-6 text-center">
                                <p className="text-4xl font-bold text-blue-400 mb-2">Game #{gameId}</p>
                                <p className="text-sm text-gray-400">Game ID</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-500/30">
                            <CardContent className="pt-6 text-center">
                                <p className="text-4xl font-bold text-purple-400 mb-2">Phase 3</p>
                                <p className="text-sm text-gray-400">The Purge</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-orange-900/30 to-red-800/20 border-orange-500/30">
                            <CardContent className="pt-6 text-center">
                                <p className="text-4xl font-bold text-orange-400 mb-2">1</p>
                                <p className="text-sm text-gray-400">Survivor</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Game Summary */}
                    {isWinner && (
                        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700 mb-8">
                            <CardContent className="pt-6">
                                <h3 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                                    🎉 YOUR VICTORY SUMMARY
                                </h3>
                                <div className="space-y-4 text-gray-300">
                                    <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
                                        <span>Total Prize Pool:</span>
                                        <span className="font-bold text-green-400">{(prizeAmount / 0.99).toFixed(4)} SOL</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
                                        <span>Platform Fee (1%):</span>
                                        <span className="font-bold text-red-400">{((prizeAmount / 0.99) * 0.01).toFixed(4)} SOL</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-green-900/30 rounded-lg border-2 border-green-500">
                                        <span className="font-bold">Your Prize (99%):</span>
                                        <span className="font-black text-2xl text-green-400">{prizeAmount.toFixed(4)} SOL</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={() => navigate('/lobby')}
                            className="flex-1 py-6 text-lg"
                            size="lg"
                        >
                            Return to Lobby
                        </Button>

                        <Button
                            onClick={() => navigate('/profile')}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-6 text-lg"
                            size="lg"
                        >
                            View Profile
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Phase3Winner;