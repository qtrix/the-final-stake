import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, TrendingUp, Coins, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PoolReward {
    pool: string;
    emoji: string;
    amount: number;
    color: string;
}

interface RewardsPanelProps {
    poolRewards: PoolReward[];
    totalPending: number;
    onClaimRewards: () => Promise<void>;
}

export default function RewardsPanel({ poolRewards, totalPending, onClaimRewards }: RewardsPanelProps) {
    const [isClaiming, setIsClaiming] = useState(false);
    const [showClaimEffect, setShowClaimEffect] = useState(false);
    const { toast } = useToast();

    const handleClaim = async () => {
        if (totalPending === 0) {
            toast({
                title: "No rewards to claim",
                description: "Keep playing to earn rewards!",
                variant: "destructive"
            });
            return;
        }

        setIsClaiming(true);
        try {
            await onClaimRewards();

            // Show claim effect
            setShowClaimEffect(true);
            setTimeout(() => setShowClaimEffect(false), 2000);

            toast({
                title: "🎉 Rewards Claimed!",
                description: `You claimed ${totalPending.toFixed(4)} SOL!`,
            });
        } catch (error) {
            toast({
                title: "Claim failed",
                description: error instanceof Error ? error.message : "Failed to claim rewards",
                variant: "destructive"
            });
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <Card className="p-6 mb-8 relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.15), hsla(280, 100%, 50%, 0.05))',
            border: '2px solid hsla(280, 100%, 50%, 0.5)',
            boxShadow: '0 0 40px hsla(280, 100%, 50%, 0.3)'
        }}>
            {/* Claim Effect */}
            {showClaimEffect && (
                <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <div className="text-6xl font-black animate-scale-in" style={{
                        color: 'hsl(280, 100%, 70%)',
                        textShadow: '0 0 30px hsl(280, 100%, 50%)',
                        animation: 'float-up 2s ease-out'
                    }}>
                        +{totalPending.toFixed(4)} SOL
                    </div>
                </div>
            )}

            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl animate-pulse" style={{
                        background: 'hsl(280, 100%, 50%)',
                        boxShadow: '0 0 30px hsl(280, 100%, 50%)'
                    }}>
                        <Trophy className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">Pending Rewards</h2>
                        <p className="text-sm text-muted-foreground">Accumulated from all pools</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-4xl font-black mb-1" style={{
                        color: 'hsl(280, 100%, 70%)',
                        textShadow: '0 0 20px hsl(280, 100%, 50%)'
                    }}>
                        {totalPending.toFixed(4)} SOL
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <TrendingUp className="w-3 h-3" />
                        Live updating
                    </div>
                </div>
            </div>

            {/* Rewards Breakdown */}
            <div className="grid grid-cols-5 gap-3 mb-6">
                {poolRewards.map((reward) => (
                    <div
                        key={reward.pool}
                        className="p-3 rounded-lg text-center transition-all hover:scale-105"
                        style={{
                            background: `${reward.color}15`,
                            border: `1px solid ${reward.color}30`
                        }}
                    >
                        <div className="text-2xl mb-1">{reward.emoji}</div>
                        <div className="text-sm font-bold" style={{ color: reward.color }}>
                            +{reward.amount.toFixed(4)}
                        </div>
                        <div className="text-xs text-muted-foreground">{reward.pool}</div>
                    </div>
                ))}
            </div>

            {/* Claim Button */}
            <Button
                size="lg"
                className="w-full text-xl font-bold py-6 relative overflow-hidden group"
                onClick={handleClaim}
                disabled={isClaiming || totalPending === 0}
                style={{
                    background: totalPending > 0
                        ? 'linear-gradient(135deg, hsl(280, 100%, 50%), hsl(280, 100%, 40%))'
                        : 'hsl(0, 0%, 20%)',
                    boxShadow: totalPending > 0 ? '0 0 30px hsl(280, 100%, 50%)' : 'none'
                }}
            >
                <span className="relative z-10 flex items-center justify-center gap-2">
                    {isClaiming ? (
                        <>
                            <Sparkles className="w-5 h-5 animate-spin" />
                            Claiming...
                        </>
                    ) : totalPending > 0 ? (
                        <>
                            <Coins className="w-5 h-5" />
                            Claim {totalPending.toFixed(4)} SOL
                        </>
                    ) : (
                        <>
                            <Trophy className="w-5 h-5" />
                            No Rewards Yet
                        </>
                    )}
                </span>

                {totalPending > 0 && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                )}
            </Button>

            {totalPending === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-3">
                    Resources are accumulating. Check back soon!
                </p>
            )}
        </Card>
    );
}
