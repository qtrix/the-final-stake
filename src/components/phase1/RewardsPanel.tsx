import { ArrowRight, Loader2, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RewardsPanelProps {
    poolRewards: Array<{
        pool: string;
        emoji: string;
        amount: number;
        color: string;
    }>;
    totalPending: number;
    onClaimRewards: () => void;
    isClaiming?: boolean;
    phaseEnded?: boolean;
}

export default function RewardsPanel({
    poolRewards,
    totalPending,
    onClaimRewards,
    isClaiming = false,
    phaseEnded = false
}: RewardsPanelProps) {
    return (
        <Card className="border-2 border-primary/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Pending Rewards
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Pool rewards breakdown */}
                <div className="space-y-2">
                    {poolRewards.map((reward) => (
                        <div
                            key={reward.pool}
                            className="flex items-center justify-between p-2 rounded-lg bg-accent/50"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{reward.emoji}</span>
                                <span className="text-sm font-medium">{reward.pool}</span>
                            </div>
                            <span
                                className="text-sm font-bold"
                                style={{ color: reward.color }}
                            >
                                +{(reward.amount).toFixed(4)} SOL
                            </span>
                        </div>
                    ))}
                </div>

                {/* Total pending */}
                <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-lg font-semibold">Total Pending</span>
                        <span className="text-2xl font-bold text-primary">
                            {(totalPending).toFixed(4)} SOL
                        </span>
                    </div>

                    <Button
                        onClick={onClaimRewards}
                        disabled={isClaiming || totalPending === 0}
                        className="w-full"
                        variant={phaseEnded ? "default" : "secondary"}
                    >
                        {isClaiming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {phaseEnded
                            ? "Claim & Advance to Phase 2"
                            : "Claim Rewards"}
                        {phaseEnded && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>

                    {!phaseEnded && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                            You can claim rewards anytime during the phase
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}