import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Zap, Droplets, Users as UsersIcon, Award } from 'lucide-react';

export interface GameEvent {
    id: string;
    type: 'crash' | 'breakthrough' | 'drought' | 'whale' | 'boom' | 'bonus';
    pool: 'mining' | 'farming' | 'trading' | 'research' | 'social';
    message: string;
    timestamp: Date;
    icon: string;
    color: string;
}

interface EventsTickerProps {
    events: GameEvent[];
}

const eventIcons = {
    crash: TrendingDown,
    breakthrough: Zap,
    drought: Droplets,
    whale: UsersIcon,
    boom: TrendingUp,
    bonus: Award
};

export default function EventsTicker({ events }: EventsTickerProps) {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setOffset((prev) => prev - 1);
        }, 30);

        return () => clearInterval(interval);
    }, []);

    if (events.length === 0) return null;

    // Duplicate events for seamless loop
    const duplicatedEvents = [...events, ...events, ...events];

    return (
        <div className="mb-8 overflow-hidden rounded-lg border-2" style={{
            background: 'hsla(0, 0%, 5%, 0.9)',
            borderColor: 'hsla(280, 100%, 35%, 0.4)'
        }}>
            <div className="py-3 px-4 border-b flex items-center gap-2" style={{
                borderColor: 'hsla(280, 100%, 35%, 0.3)'
            }}>
                <Zap className="w-4 h-4" style={{ color: 'hsl(280, 100%, 70%)' }} />
                <span className="font-bold text-sm gradient-text">LIVE EVENTS</span>
            </div>

            <div className="relative h-16 overflow-hidden">
                <div
                    className="absolute flex items-center gap-8 py-4"
                    style={{
                        transform: `translateX(${offset}px)`,
                        width: 'max-content'
                    }}
                >
                    {duplicatedEvents.map((event, index) => {
                        const Icon = eventIcons[event.type];

                        return (
                            <div
                                key={`${event.id}-${index}`}
                                className="flex items-center gap-3 px-6 py-2 rounded-lg whitespace-nowrap animate-pulse"
                                style={{
                                    background: `${event.color}15`,
                                    border: `1px solid ${event.color}40`,
                                    minWidth: '300px'
                                }}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: event.color }} />
                                <span className="font-semibold" style={{ color: event.color }}>
                                    {event.icon} {event.message}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {event.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
