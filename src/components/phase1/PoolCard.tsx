import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PoolCardProps {
    name: string;
    icon: LucideIcon;
    emoji: string;
    description: string;
    yieldRange: string;
    volatility: string;
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    color: string;
    bgGradient: string;
    borderColor: string;
    allocation: number;
    entryFee: number;
    participants: number;
    currentAPR: string;
    specialCondition?: string;
    onAllocationChange: (value: number[]) => void;
    onQuickAllocation: (percentage: number) => void;
}

const riskColors = {
    low: 'hsl(120, 60%, 50%)',
    medium: 'hsl(50, 100%, 60%)',
    high: 'hsl(15, 100%, 50%)',
    extreme: 'hsl(280, 80%, 60%)'
};

export default function PoolCard({
    name,
    icon: Icon,
    emoji,
    description,
    yieldRange,
    volatility,
    riskLevel,
    color,
    bgGradient,
    borderColor,
    allocation,
    entryFee,
    participants,
    currentAPR,
    specialCondition,
    onAllocationChange,
    onQuickAllocation
}: PoolCardProps) {
    const allocatedAmount = (entryFee * allocation / 100).toFixed(3);

    return (
        <Card
            className="p-6 hover:scale-[1.01] transition-all duration-300 hover:shadow-2xl"
            style={{
                background: bgGradient,
                borderColor: borderColor,
                borderWidth: '2px'
            }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                    <div
                        className="p-3 rounded-xl animate-pulse"
                        style={{
                            background: color,
                            boxShadow: `0 0 30px ${color}60`
                        }}
                    >
                        <Icon className="w-7 h-7 text-white" />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-2xl font-bold" style={{ color }}>
                                {emoji} {name}
                            </h3>
                            <Badge
                                variant="outline"
                                style={{
                                    borderColor: riskColors[riskLevel],
                                    color: riskColors[riskLevel]
                                }}
                            >
                                {volatility} Risk
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{description}</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-4xl font-black mb-1" style={{ color }}>
                        {allocation.toFixed(1)}%
                    </div>
                    <div className="text-sm font-semibold" style={{ color: 'hsl(0, 0%, 70%)' }}>
                        {allocatedAmount} SOL
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg" style={{
                background: 'hsla(0, 0%, 0%, 0.3)',
                border: `1px solid ${borderColor}`
            }}>
                <div>
                    <div className="text-xs text-muted-foreground mb-1">Current APR</div>
                    <div className="font-bold" style={{ color }}>{currentAPR}</div>
                </div>
                <div>
                    <div className="text-xs text-muted-foreground mb-1">Hourly Yield</div>
                    <div className="font-bold" style={{ color }}>{yieldRange}</div>
                </div>
                <div>
                    <div className="text-xs text-muted-foreground mb-1">Participants</div>
                    <div className="font-bold" style={{ color }}>{participants}</div>
                </div>
            </div>

            {/* Special Condition */}
            {specialCondition && (
                <div
                    className="mb-4 p-2 rounded-lg text-sm font-semibold text-center animate-pulse"
                    style={{
                        background: `${color}20`,
                        border: `1px solid ${color}40`,
                        color
                    }}
                >
                    ⚡ {specialCondition}
                </div>
            )}

            {/* Slider */}
            <div className="mb-4">
                <Slider
                    value={[allocation]}
                    onValueChange={onAllocationChange}
                    max={100}
                    step={0.1}
                    className="w-full"
                    style={{
                        '--slider-color': color
                    } as any}
                />
            </div>

            {/* Quick Allocation Buttons */}
            <div className="grid grid-cols-4 gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQuickAllocation(0)}
                    className="text-xs"
                >
                    Clear
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQuickAllocation(25)}
                    className="text-xs"
                >
                    25%
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQuickAllocation(50)}
                    className="text-xs"
                >
                    50%
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQuickAllocation(100)}
                    className="text-xs font-bold"
                    style={{ borderColor: color, color }}
                >
                    MAX
                </Button>
            </div>
        </Card>
    );
}
