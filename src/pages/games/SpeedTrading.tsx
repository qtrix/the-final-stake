import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from '@/components/ParticleBackground';

export default function SpeedTrading() {
    const navigate = useNavigate();
    const [gameState, setGameState] = useState<'playing' | 'finished'>('playing');
    const [timeLeft, setTimeLeft] = useState(60);
    const [score, setScore] = useState(0);
    const [currentPrice, setCurrentPrice] = useState(50000);
    const [priceHistory, setPriceHistory] = useState<number[]>([50000]);
    const [prediction, setPrediction] = useState<'up' | 'down' | null>(null);
    const [round, setRound] = useState(1);
    const [totalRounds] = useState(5);

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0) {
            setGameState('finished');
        }
    }, [timeLeft, gameState]);

    useEffect(() => {
        if (gameState === 'playing') {
            const interval = setInterval(() => {
                const change = (Math.random() - 0.5) * 2000;
                const newPrice = Math.max(1000, currentPrice + change);
                setCurrentPrice(newPrice);
                setPriceHistory(prev => [...prev.slice(-20), newPrice]);
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [gameState, currentPrice]);

    const makePrediction = (direction: 'up' | 'down') => {
        setPrediction(direction);

        setTimeout(() => {
            const change = (Math.random() - 0.5) * 2000;
            const newPrice = Math.max(1000, currentPrice + change);
            const actualDirection = newPrice > currentPrice ? 'up' : 'down';

            if (direction === actualDirection) {
                setScore(score + 1);
            }

            setCurrentPrice(newPrice);
            setPriceHistory(prev => [...prev.slice(-20), newPrice]);
            setPrediction(null);

            if (round < totalRounds) {
                setRound(round + 1);
            }
        }, 3000);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    return (
        <div className="min-h-screen relative">
            <ParticleBackground />

            <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-lg border-b border-border/50">
                <div className="container mx-auto px-4 py-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/phase2')}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Arena
                    </Button>
                </div>
            </nav>

            <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-display font-black mb-4">
                        <span className="gradient-text">📈 Speed Trading</span>
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Predict price movements under pressure
                    </p>
                </div>

                {gameState === 'playing' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-sol-orange" />
                                    <span className="text-lg font-bold">{timeLeft}s</span>
                                </div>
                                <div className="text-lg">
                                    Round: {round}/{totalRounds}
                                </div>
                            </div>
                            <div className="text-lg font-bold">
                                Score: {score}/{totalRounds}
                            </div>
                        </div>

                        <Card className="p-8 mb-8">
                            <div className="text-center mb-6">
                                <h2 className="text-3xl font-bold mb-2">Bitcoin Price</h2>
                                <div className="text-4xl font-black text-sol-orange mb-4">
                                    {formatPrice(currentPrice)}
                                </div>
                                <div className="h-32 bg-background/50 rounded-lg flex items-end justify-center p-4">
                                    <div className="flex items-end gap-1 h-full">
                                        {priceHistory.slice(-10).map((price, index) => {
                                            const height = ((price - Math.min(...priceHistory)) /
                                                (Math.max(...priceHistory) - Math.min(...priceHistory))) * 100;
                                            return (
                                                <div
                                                    key={index}
                                                    className="bg-sol-orange w-3 rounded-t"
                                                    style={{ height: `${Math.max(height, 10)}%` }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {prediction === null && round <= totalRounds && (
                                <div className="flex gap-4 justify-center">
                                    <Button
                                        variant="hero"
                                        onClick={() => makePrediction('up')}
                                        className="flex items-center gap-2"
                                    >
                                        <TrendingUp className="w-5 h-5" />
                                        Price Up
                                    </Button>
                                    <Button
                                        variant="sol-outline"
                                        onClick={() => makePrediction('down')}
                                        className="flex items-center gap-2"
                                    >
                                        <TrendingDown className="w-5 h-5" />
                                        Price Down
                                    </Button>
                                </div>
                            )}

                            {prediction !== null && (
                                <div className="text-center">
                                    <p className="text-lg text-sol-orange font-bold">
                                        Predicting: {prediction === 'up' ? '📈 Price Up' : '📉 Price Down'}
                                    </p>
                                    <p className="text-muted-foreground">Waiting for result...</p>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {gameState === 'finished' && (
                    <Card className="p-8 max-w-md mx-auto text-center">
                        <Trophy className="w-16 h-16 text-sol-orange mx-auto mb-6" />
                        <h2 className="text-2xl font-bold mb-4">Trading Complete!</h2>
                        <p className="text-lg mb-2">Score: {score}/{totalRounds}</p>
                        <p className="text-lg mb-2">Accuracy: {Math.round((score / totalRounds) * 100)}%</p>
                        <p className="text-muted-foreground mb-6">
                            {score >= 3 ? 'Victory! 🎉' : 'Better luck next time!'}
                        </p>
                        <Button variant="sol" onClick={() => navigate('/phase2')}>
                            Back to Arena
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
}
