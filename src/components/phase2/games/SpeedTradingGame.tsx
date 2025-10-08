// src/components/phase2/games/SpeedTradingGame.tsx
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
    onComplete: (winner: PublicKey) => Promise<void>;
    challenger: PublicKey;
    opponent: PublicKey;
    myAddress: PublicKey;
    challengeId: string;
    onGameStart: () => void;
}

export default function SpeedTradingGame({
    onComplete,
    challenger,
    opponent,
    myAddress,
    onGameStart
}: Props) {
    const [myBalance, setMyBalance] = useState(1000);
    const [opponentBalance, setOpponentBalance] = useState(1000);
    const [currentPrice, setCurrentPrice] = useState(100);
    const [priceHistory, setPriceHistory] = useState<number[]>([100]);
    const [timeLeft, setTimeLeft] = useState(60);
    const [myPosition, setMyPosition] = useState<'long' | 'short' | null>(null);
    const [entryPrice, setEntryPrice] = useState<number | null>(null);
    const [gameStarted, setGameStarted] = useState(false);

    useEffect(() => {
        if (!gameStarted) {
            onGameStart();
            setGameStarted(true);
        }
    }, []);

    // Price simulation
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentPrice(prev => {
                const change = (Math.random() - 0.5) * 10;
                const newPrice = Math.max(50, Math.min(150, prev + change));
                setPriceHistory(h => [...h.slice(-20), newPrice]);
                return newPrice;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Game over
                    if (myBalance > opponentBalance) {
                        onComplete(myAddress);
                    } else if (opponentBalance > myBalance) {
                        const opponentAddr = challenger.equals(myAddress) ? opponent : challenger;
                        onComplete(opponentAddr);
                    } else {
                        onComplete(challenger);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [myBalance, opponentBalance]);

    // Opponent AI trading
    useEffect(() => {
        const oppInterval = setInterval(() => {
            const rand = Math.random();
            if (rand > 0.9) {
                const oppChange = (Math.random() - 0.5) * 100;
                setOpponentBalance(prev => Math.max(0, prev + oppChange));
            }
        }, 3000);

        return () => clearInterval(oppInterval);
    }, []);

    const openPosition = (type: 'long' | 'short') => {
        if (myPosition) closePosition();
        setMyPosition(type);
        setEntryPrice(currentPrice);
    };

    const closePosition = () => {
        if (!myPosition || !entryPrice) return;

        const priceDiff = currentPrice - entryPrice;
        const profit = myPosition === 'long' ? priceDiff * 10 : -priceDiff * 10;

        setMyBalance(prev => Math.max(0, prev + profit));
        setMyPosition(null);
        setEntryPrice(null);
    };

    const unrealizedPnL = myPosition && entryPrice
        ? (myPosition === 'long' ? (currentPrice - entryPrice) : (entryPrice - currentPrice)) * 10
        : 0;

    return (
        <div className="space-y-6">
            {/* Timer & Scores */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center border-2 border-green-500/30 bg-green-500/10">
                    <div className="text-sm text-muted-foreground mb-1">Your Balance</div>
                    <div className={`text-2xl font-bold ${myBalance >= 1000 ? 'text-green-400' : 'text-red-400'}`}>
                        ${myBalance.toFixed(0)}
                    </div>
                </Card>

                <Card className="p-4 text-center border-2 border-sol-orange/30 bg-sol-orange/10">
                    <div className="text-sm text-muted-foreground mb-1">Time Left</div>
                    <div className="text-2xl font-bold text-sol-orange">{timeLeft}s</div>
                </Card>

                <Card className="p-4 text-center border-2 border-red-500/30 bg-red-500/10">
                    <div className="text-sm text-muted-foreground mb-1">Opponent</div>
                    <div className="text-2xl font-bold text-red-400">${opponentBalance.toFixed(0)}</div>
                </Card>
            </div>

            {/* Price Chart */}
            <Card className="p-6 bg-accent/30">
                <div className="flex items-end justify-between h-40 gap-1">
                    {priceHistory.map((price, i) => (
                        <div
                            key={i}
                            className="flex-1 bg-sol-orange/50 rounded-t transition-all"
                            style={{
                                height: `${(price / 150) * 100}%`,
                                opacity: 0.3 + (i / priceHistory.length) * 0.7
                            }}
                        />
                    ))}
                </div>
                <div className="mt-4 text-center">
                    <div className="text-4xl font-bold text-sol-orange">
                        ${currentPrice.toFixed(2)}
                    </div>
                </div>
            </Card>

            {/* Position Info */}
            {myPosition && (
                <Card className={`p-4 border-2 ${unrealizedPnL >= 0 ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-sm text-muted-foreground">Open Position</div>
                            <div className="text-lg font-bold">
                                {myPosition === 'long' ? '📈 LONG' : '📉 SHORT'} @ ${entryPrice?.toFixed(2)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-muted-foreground">Unrealized P&L</div>
                            <div className={`text-2xl font-bold ${unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Trading Buttons */}
            <div className="grid grid-cols-2 gap-4">
                {!myPosition ? (
                    <>
                        <Button
                            onClick={() => openPosition('long')}
                            className="h-20 text-lg bg-green-500 hover:bg-green-600"
                        >
                            <TrendingUp className="w-6 h-6 mr-2" />
                            BUY / LONG
                        </Button>
                        <Button
                            onClick={() => openPosition('short')}
                            className="h-20 text-lg bg-red-500 hover:bg-red-600"
                        >
                            <TrendingDown className="w-6 h-6 mr-2" />
                            SELL / SHORT
                        </Button>
                    </>
                ) : (
                    <Button
                        onClick={closePosition}
                        className="col-span-2 h-20 text-lg"
                        variant="outline"
                    >
                        CLOSE POSITION
                    </Button>
                )}
            </div>

            <Card className="p-4 bg-accent/50">
                <p className="text-sm text-center text-muted-foreground">
                    Trade wisely! Highest balance after 60 seconds wins 🏆
                </p>
            </Card>
        </div>
    );
}