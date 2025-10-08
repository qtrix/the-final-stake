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
    return (
        <Card
            className="p-4 hover:scale-[1.01] transition-all duration-200 border-2"
            style={{
                borderColor: borderColor,
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div
                        className="p-2 rounded-lg"
                        style={{ background: color }}
                    >
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold" style={{ color }}>
                            {emoji} {name}
                        </h3>
                        <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                                borderColor: riskColors[riskLevel],
                                color: riskColors[riskLevel]
                            }}
                        >
                            {volatility} Risk
                        </Badge>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-3xl font-black" style={{ color }}>
                        {allocation.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {entryFee.toFixed(3)} SOL
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground mb-3">{description}</p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                    <div className="text-xs text-muted-foreground">APR</div>
                    <div className="text-sm font-bold" style={{ color }}>{currentAPR}</div>
                </div>
                <div>
                    <div className="text-xs text-muted-foreground">Yield</div>
                    <div className="text-sm font-bold" style={{ color }}>{yieldRange}</div>
                </div>
                <div>
                    <div className="text-xs text-muted-foreground">Players</div>
                    <div className="text-sm font-bold" style={{ color }}>{participants}</div>
                </div>
            </div>

            {/* Special Condition */}
            {specialCondition && (
                <div
                    className="mb-3 p-2 rounded text-xs font-semibold text-center"
                    style={{
                        background: `${color}20`,
                        color
                    }}
                >
                    ⚡ {specialCondition}
                </div>
            )}

            {/* Slider */}
            <div className="mb-2">
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
            <div className="grid grid-cols-4 gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onQuickAllocation(0)}
                    className="text-xs h-7"
                >
                    Clear
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onQuickAllocation(25)}
                    className="text-xs h-7"
                >
                    25%
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onQuickAllocation(50)}
                    className="text-xs h-7"
                >
                    50%
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onQuickAllocation(100)}
                    className="text-xs h-7 font-bold"
                    style={{ color }}
                >
                    MAX
                </Button>
            </div>
        </Card>
    );
}
