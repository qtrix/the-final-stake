import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface PoolAllocation {
    key: string;
    name: string;
    emoji: string;
    color: string;
    allocation: number;
    amount: number;
}

interface AllocationBarProps {
    pools: PoolAllocation[];
    totalBalance: number;
}

export default function AllocationBar({ pools, totalBalance }: AllocationBarProps) {
    const totalAllocated = pools.reduce((sum, pool) => sum + pool.amount, 0);
    const allocatedPercentage = totalBalance > 0 ? (totalAllocated / totalBalance) * 100 : 0;

    return (
        <Card className="p-6 mb-8" style={{
            background: 'hsla(0, 0%, 5%, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '2px solid hsla(280, 100%, 35%, 0.4)'
        }}>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold gradient-text">Allocation Summary</h2>
                <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total Balance</div>
                    <div className="text-2xl font-bold" style={{ color: 'hsl(280, 100%, 70%)' }}>
                        {totalBalance.toFixed(3)} SOL
                    </div>
                </div>
            </div>

            {/* Visual Bar Graph */}
            <div className="mb-6 h-12 rounded-lg overflow-hidden flex" style={{
                background: 'hsla(0, 0%, 0%, 0.5)',
                border: '1px solid hsla(280, 100%, 35%, 0.3)'
            }}>
                {pools.map((pool) => {
                    const width = pool.allocation;
                    if (width === 0) return null;

                    return (
                        <div
                            key={pool.key}
                            className="h-full flex items-center justify-center transition-all duration-500 hover:brightness-125 relative group"
                            style={{
                                width: `${width}%`,
                                background: `linear-gradient(180deg, ${pool.color}, ${pool.color}90)`,
                                borderRight: '1px solid rgba(0,0,0,0.3)'
                            }}
                        >
                            {width > 8 && (
                                <div className="text-white font-bold text-sm drop-shadow-lg">
                                    {pool.emoji} {width.toFixed(1)}%
                                </div>
                            )}

                            {/* Tooltip on hover */}
                            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                <div className="bg-black/90 px-3 py-2 rounded-lg border" style={{ borderColor: pool.color }}>
                                    <div className="text-xs text-muted-foreground">{pool.name}</div>
                                    <div className="font-bold" style={{ color: pool.color }}>
                                        {pool.amount.toFixed(3)} SOL ({width.toFixed(1)}%)
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detailed Grid */}
            <div className="grid grid-cols-5 gap-4">
                {pools.map(pool => (
                    <div
                        key={pool.key}
                        className="p-3 rounded-lg transition-all duration-300 hover:scale-105"
                        style={{
                            background: `${pool.color}10`,
                            border: `1px solid ${pool.color}30`
                        }}
                    >
                        <div className="text-2xl mb-1 text-center">{pool.emoji}</div>
                        <div className="text-center">
                            <div className="text-xl font-bold mb-1" style={{ color: pool.color }}>
                                {pool.allocation.toFixed(1)}%
                            </div>
                            <div className="text-xs font-semibold" style={{ color: 'hsl(0, 0%, 70%)' }}>
                                {pool.amount.toFixed(3)} SOL
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{pool.name}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Progress indicator */}
            <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Allocated</span>
                    <span className="font-semibold" style={{
                        color: allocatedPercentage === 100 ? 'hsl(120, 60%, 50%)' : 'hsl(50, 100%, 60%)'
                    }}>
                        {allocatedPercentage.toFixed(1)}%
                    </span>
                </div>
                <Progress
                    value={allocatedPercentage}
                    className="h-2"
                />
            </div>
        </Card>
    );
}
