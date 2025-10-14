// src/components/PhaseCountdown.tsx
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle } from 'lucide-react';

interface PhaseCountdownProps {
    targetTime: Date;
    phaseName?: string;
}

export default function PhaseCountdown({ targetTime, phaseName = "Phase 2" }: PhaseCountdownProps) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isExpired, setIsExpired] = useState(false);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const target = new Date(targetTime).getTime();
            const difference = target - now;

            if (difference <= 0) {
                setIsExpired(true);
                setTimeLeft("TIME'S UP!");
                setProgress(0);
                return;
            }

            // Calculate progress (assuming 24h phase)
            const totalDuration = 24 * 60 * 60 * 1000; // 24 hours in ms
            const elapsed = totalDuration - difference;
            const progressPercentage = Math.min(100, (elapsed / totalDuration) * 100);
            setProgress(100 - progressPercentage);

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            let timeString = '';
            if (days > 0) {
                timeString = `${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
                timeString = `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                timeString = `${minutes}m ${seconds}s`;
            } else {
                timeString = `${seconds}s`;
            }

            setTimeLeft(timeString);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [targetTime]);

    if (isExpired) {
        return (
            <Card className="border-2 border-red-500 bg-red-500/10 animate-pulse">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center gap-4">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                        <div className="text-center">
                            <h3 className="text-2xl font-black text-red-400 mb-1">TIME'S UP!</h3>
                            <p className="text-sm text-red-300">⚠️ Prepare for the Purge ⚠️</p>
                            <p className="text-xs text-muted-foreground mt-2">No more games can be played</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const isUrgent = progress < 20; // Last 20% = urgent

    return (
        <Card className={`border-2 transition-all ${isUrgent
                ? 'border-red-500/50 bg-red-500/10 animate-pulse'
                : 'border-sol-orange/50 bg-sol-orange/10'
            }`}>
            <CardContent className="p-6">
                <div className="flex items-center gap-4">
                    <Clock className={`w-8 h-8 ${isUrgent ? 'text-red-400' : 'text-sol-orange'}`} />
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground font-medium">{phaseName} Ends In</span>
                            <span className={`text-2xl font-black ${isUrgent ? 'text-red-400' : 'text-sol-orange'}`}>
                                {timeLeft}
                            </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-gradient-to-r from-sol-purple to-sol-orange'
                                    }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}