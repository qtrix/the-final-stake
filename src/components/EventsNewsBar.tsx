// EventsNewsBar - Scrolling ticker for upcoming chaos events
import React, { useEffect, useState } from 'react';
import { ChaosEvent, formatTimeUntilEvent } from '../utils/mockChaosEvents';
import { AlertTriangle, Zap } from 'lucide-react';

interface EventsNewsBarProps {
    upcomingEvents: ChaosEvent[];
    currentTime: Date;
}

const EventsNewsBar: React.FC<EventsNewsBarProps> = ({ upcomingEvents, currentTime }) => {
    const [, setTick] = useState(0);

    // Force re-render every second to update countdown timers
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    if (upcomingEvents.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-20 left-0 right-0 z-40 pointer-events-none">
            <div className="relative h-12 bg-gradient-to-r from-red-600/95 via-orange-600/95 to-red-600/95 border-y-2 border-red-400/50 shadow-lg overflow-hidden">
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>

                {/* Pulsing warning indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-red-700 to-transparent flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
                </div>

                {/* Scrolling content */}
                <div className="absolute inset-0 flex items-center">
                    <div className="animate-scroll-left whitespace-nowrap pl-16">
                        {/* Duplicate events for seamless loop */}
                        {[...upcomingEvents, ...upcomingEvents, ...upcomingEvents].map((event, idx) => (
                            <React.Fragment key={`${event.id}-${idx}`}>
                                <span className="inline-flex items-center gap-3 px-8 text-white font-bold">
                                    <span className="text-2xl animate-bounce">{event.icon}</span>
                                    <span className="text-lg uppercase tracking-wide">{event.title}</span>
                                    <span className="text-sm bg-black/40 px-3 py-1 rounded-full">
                                        {formatTimeUntilEvent(event, currentTime)}
                                    </span>
                                    <span className="text-base opacity-90">
                                        {event.description}
                                    </span>
                                    <Zap className="w-4 h-4 text-yellow-300 animate-pulse" />
                                </span>
                                <span className="inline-block w-px h-6 bg-white/30 mx-6" />
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Right fade effect */}
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-red-700 to-transparent" />
            </div>
        </div>
    );
};

export default EventsNewsBar;