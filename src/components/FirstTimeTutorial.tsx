// src/components/FirstTimeTutorial.tsx
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check, AlertCircle, Zap, Target, Trophy, Coins, Shield, Activity, Gamepad2, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';

interface TutorialSlide {
    title: string;
    description: string;
    icon: any;
    tips: string[];
    color: string;
}

const slides: TutorialSlide[] = [
    {
        title: "Welcome to Solana Survivors! 🎮",
        description: "A three-phase battle royale where strategy, skill, and survival determine the winner. Only the top 50% survive to share the prize pool!",
        icon: Trophy,
        tips: [
            "Pay entry fee in SOL to join the game",
            "Receive 10x entry fee as virtual balance (vSOL)",
            "Navigate through 3 phases: Allocation, PvP, and The Purge",
            "Top 50% survivors share the prize pool proportionally",
            "Winner takes the biggest share based on final ranking"
        ],
        color: "hsl(280, 100%, 45%)"
    },
    {
        title: "Solana Blockchain Limitation ⛓️",
        description: "Due to Solana's architecture, you must initialize your game state at the start of Phase 1.",
        icon: AlertCircle,
        tips: [
            "Initialize game state = Small transaction (one-time)",
            "This reserves space on Solana for your game data",
            "At game end, you can close your account",
            "Closing returns the lamports (rent) used for storage",
            "This is a technical requirement, not a cost!"
        ],
        color: "hsl(15, 100%, 50%)"
    },
    {
        title: "Phase 1: Resource Allocation 💰",
        description: "Strategically allocate your virtual SOL across different investment pools to grow your balance and earn passive rewards.",
        icon: Coins,
        tips: [
            "Start with 10x entry fee as virtual balance (vSOL)",
            "Allocate to: Mining, Farming, Trading, Research, or Social pools",
            "Each pool has different risk/reward multipliers",
            "Earn passive rewards based on pool performance",
            "Claim rewards periodically to maximize your balance",
            "Diversify allocations to minimize risk"
        ],
        color: "hsl(50, 100%, 50%)"
    },
    {
        title: "Phase 2: PvP Battles 🎯",
        description: "Challenge other players to skill-based mini-games (Rock Paper Scissors). Win their virtual SOL or lose yours!",
        icon: Gamepad2,
        tips: [
            "Select opponent and choose bet amount",
            "Play best-of-5 Rock Paper Scissors matches",
            "Winner takes all bet amount from both players",
            "IMPORTANT: Complete minimum required games to avoid 50% penalty",
            "Max games per opponent prevents farming",
            "Strategic timing and bet sizing matter!"
        ],
        color: "hsl(200, 100%, 50%)"
    },
    {
        title: "Phase 3: The Purge - Battle Royale 💥",
        description: "Real-time survival arena! Players ranked by virtual balance. Bottom 50% are eliminated. Stay in safe zone, use power-ups, and outlive opponents!",
        icon: Target,
        tips: [
            "Move with your mouse to survive",
            "Stay INSIDE the green safe zone - it shrinks over time!",
            "Being outside drains HP continuously",
            "Press 1: Speed Boost (10s, move faster)",
            "Press 2: Shield (8s, protect from damage)",
            "Press 3: Health Pack (restore 200 HP instantly)",
            "Power-up costs increase with each purchase"
        ],
        color: "hsl(120, 80%, 45%)"
    },
    {
        title: "Combat & Strategy ⚡",
        description: "Physical contact with other players can change the tide of battle! Use collisions strategically.",
        icon: Shield,
        tips: [
            "Shield users push opponents harder on collision",
            "Speed users can ram into others for extra force",
            "Use collisions strategically near zone edge",
            "Avoid getting pushed into the danger zone",
            "Combine power-ups for maximum advantage",
            "Final zone forces epic confrontations"
        ],
        color: "hsl(280, 100%, 60%)"
    },
    {
        title: "Winning & Claiming Prizes 🏆",
        description: "Top 50% survivors share the prize pool based on final virtual balance ranking. The richer you are, the more you win!",
        icon: Trophy,
        tips: [
            "Top 50% by virtual balance survive The Purge",
            "Prize pool distributed proportionally to survivors",
            "Highest balance wins the biggest share",
            "Winner takes 99% of prize pool (1% platform fee)",
            "Prize auto-distributed via smart contract",
            "Claim your winnings in the Lobby immediately!",
            "Your stats update in the global leaderboard"
        ],
        color: "hsl(50, 100%, 60%)"
    }
];

interface FirstTimeTutorialProps {
    gameId: number;
    onComplete: () => void;
}

export default function FirstTimeTutorial({ gameId, onComplete }: FirstTimeTutorialProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [understood, setUnderstood] = useState(false);

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(prev => prev + 1);
        } else {
            setUnderstood(true);
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        onComplete();
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSlide]);

    const currentSlideData = slides[currentSlide];
    const Icon = currentSlideData.icon;
    const progress = ((currentSlide + 1) / slides.length) * 100;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
            {/* Modal Container */}
            <div
                className="relative w-full max-w-4xl rounded-2xl border-2 overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(106, 13, 173, 0.95), rgba(255, 94, 0, 0.85))',
                    borderColor: currentSlideData.color,
                    boxShadow: `0 20px 60px ${currentSlideData.color}40`
                }}
            >
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-black/30">
                    <div
                        className="h-full transition-all duration-500"
                        style={{
                            width: `${progress}%`,
                            background: currentSlideData.color
                        }}
                    />
                </div>

                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/20">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center border-2"
                                style={{
                                    borderColor: currentSlideData.color,
                                    background: `${currentSlideData.color}20`
                                }}
                            >
                                <Icon className="w-8 h-8" style={{ color: currentSlideData.color }} />
                            </div>
                            <div>
                                <div className="text-sm font-semibold opacity-75">
                                    Step {currentSlide + 1} of {slides.length}
                                </div>
                                <h2 className="text-2xl font-black text-white">
                                    {currentSlideData.title}
                                </h2>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6 min-h-[450px] max-h-[60vh] overflow-y-auto">
                    <p className="text-lg text-white/90 leading-relaxed">
                        {currentSlideData.description}
                    </p>

                    <div className="space-y-3">
                        {currentSlideData.tips.map((tip, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-4 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10"
                            >
                                <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                                    style={{
                                        background: currentSlideData.color,
                                        color: 'black'
                                    }}
                                >
                                    {index + 1}
                                </div>
                                <p className="text-white/90 text-sm leading-relaxed">
                                    {tip}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Special warning for Solana slide */}
                    {currentSlide === 1 && (
                        <div className="mt-6 p-4 rounded-lg border-2 border-orange-500 bg-orange-500/10">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-orange-200 font-semibold mb-1">
                                        💡 Good News!
                                    </p>
                                    <p className="text-orange-100/80 text-sm">
                                        The lamports used for initialization are NOT a fee - they're just temporary rent.
                                        You get them back when you close your game state after the match ends!
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Special tip for Phase 2 */}
                    {currentSlide === 3 && (
                        <div className="mt-6 p-4 rounded-lg border-2 border-red-500 bg-red-500/10">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-200 font-semibold mb-1">
                                        ⚠️ Important Warning!
                                    </p>
                                    <p className="text-red-100/80 text-sm">
                                        If you don't complete the minimum required games in Phase 2, you'll face a 50% penalty on your virtual balance before Phase 3!
                                        Make sure to play enough matches to avoid this massive penalty.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Special tip for Phase 3 */}
                    {currentSlide === 4 && (
                        <div className="mt-6 p-4 rounded-lg border-2 border-green-500 bg-green-500/10">
                            <div className="flex items-start gap-3">
                                <Trophy className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-green-200 font-semibold mb-1">
                                        🎯 Pro Tip!
                                    </p>
                                    <p className="text-green-100/80 text-sm">
                                        Your virtual balance from Phases 1 & 2 determines your starting HP in Phase 3!
                                        The richer you are, the stronger you start. Bottom 50% are eliminated immediately.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-white/20 bg-black/20">
                    <div className="flex items-center justify-between">
                        <Button
                            onClick={handlePrev}
                            disabled={currentSlide === 0}
                            variant="outline"
                            className="bg-white/10 border-white/20 hover:bg-white/20 disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Previous
                        </Button>

                        <div className="flex gap-2">
                            {slides.map((_, index) => (
                                <div
                                    key={index}
                                    className="w-2 h-2 rounded-full transition-all duration-300"
                                    style={{
                                        background: index === currentSlide
                                            ? currentSlideData.color
                                            : 'rgba(255, 255, 255, 0.2)',
                                        width: index === currentSlide ? '24px' : '8px'
                                    }}
                                />
                            ))}
                        </div>

                        {currentSlide < slides.length - 1 ? (
                            <Button
                                onClick={handleNext}
                                className="font-bold"
                                style={{
                                    background: currentSlideData.color,
                                    color: 'white'
                                }}
                            >
                                Next
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleNext}
                                disabled={understood}
                                className="font-bold bg-green-600 hover:bg-green-700"
                            >
                                {understood ? (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Got it!
                                    </>
                                ) : (
                                    <>
                                        I Understand
                                        <Check className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {understood && (
                        <div className="mt-4 p-4 rounded-lg bg-green-900/30 border border-green-500">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Check className="w-6 h-6 text-green-400" />
                                    <div>
                                        <p className="text-green-200 font-semibold">
                                            Tutorial Complete! 🎉
                                        </p>
                                        <p className="text-green-100/70 text-sm">
                                            You're ready to join the battle. May the odds be in your favor, survivor!
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleComplete}
                                    className="bg-green-600 hover:bg-green-700 font-bold"
                                >
                                    Enter Battle
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/40">
                    Use ← → arrow keys to navigate
                </div>
            </div>
        </div>
    );
}