// src/pages/HowToPlay.tsx
import { ArrowLeft, Gamepad2, Users, Trophy, Coins, Zap, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function HowToPlay() {
    const navigate = useNavigate();

    const phases = [
        {
            id: 1,
            phase: "Phase 1",
            title: "Resource Allocation",
            description: "Strategically allocate your virtual SOL across different pools to earn rewards",
            icon: Coins,
            steps: [
                "Receive initial virtual balance (10x entry fee)",
                "Allocate funds to Mining, Farming, Trading, Research, or Social pools",
                "Earn passive rewards based on pool performance",
                "Claim rewards periodically to grow your balance"
            ],
            tips: [
                "Diversify allocations to minimize risk",
                "Monitor pool multipliers and adjust strategy",
                "Social pool rewards increase with more participants",
                "Claim rewards before phase ends to avoid loss"
            ]
        },
        {
            id: 2,
            phase: "Phase 2",
            title: "PvP Battles",
            description: "Challenge other players to skill-based mini-games and win their virtual SOL",
            icon: Gamepad2,
            steps: [
                "Select opponent from player list",
                "Choose bet amount and game type (Rock Paper Scissors)",
                "Wait for opponent to accept challenge",
                "Compete in best-of-5 match",
                "Winner takes all bet amount from both players"
            ],
            tips: [
                "You must complete minimum required games to avoid 50% penalty",
                "Max games per opponent prevents farming",
                "Higher bets = higher rewards but more risk",
                "Strategic timing matters - challenge when you have advantage"
            ]
        },
        {
            id: 3,
            phase: "Phase 3",
            title: "The Purge",
            description: "Final showdown where only the richest survive to claim the prize pool",
            icon: Trophy,
            steps: [
                "All players ranked by virtual balance",
                "Bottom 50% are eliminated (The Purge)",
                "Top 50% share the prize pool proportionally",
                "Highest balance wins the biggest share",
                "Real SOL paid out based on final rankings"
            ],
            tips: [
                "Maximize virtual balance in Phase 1 & 2",
                "Avoid 50% penalty by meeting Phase 2 requirements",
                "Risk vs reward: aggressive play can pay off",
                "Strategic alliances in social pools help survival"
            ]
        }
    ];

    const gameRules = [
        {
            title: "Entry & Setup",
            icon: Target,
            rules: [
                "Pay entry fee in SOL to join game",
                "Entry fee funds the prize pool",
                "Receive 10x entry fee as virtual balance",
                "Virtual balance used for gameplay only"
            ]
        },
        {
            title: "Gameplay Mechanics",
            icon: Zap,
            rules: [
                "Each phase has time limit - manage time wisely",
                "Virtual SOL earned/lost affects final ranking",
                "Phase transitions happen automatically",
                "Real-time updates sync across all players"
            ]
        },
        {
            title: "Winning Strategy",
            icon: Trophy,
            rules: [
                "Balance risk and safety in allocations",
                "Complete Phase 2 requirements to avoid penalty",
                "Maximize virtual balance before Phase 3",
                "Top 50% survive and split prize pool"
            ]
        }
    ];

    return (
        <div className="min-h-screen relative text-white">
            <ParticleBackground />
            <Navbar />

            <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6">
                        <span
                            className="bg-clip-text text-transparent animate-pulse"
                            style={{
                                background: 'linear-gradient(135deg, hsl(280 100% 35%), hsl(15 100% 50%))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            How to Play
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Master the three-phase battle royale and become a Solana Survivor
                    </p>
                </div>

                {/* Phases */}
                <div className="space-y-12 mb-16">
                    {phases.map((phase, index) => {
                        const Icon = phase.icon;

                        return (
                            <div
                                key={phase.id}
                                className="p-8 rounded-2xl border border-white/20 backdrop-blur-lg hover:border-orange-500/50 transition-all duration-300"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(106, 13, 173, 0.1), rgba(255, 94, 0, 0.05))',
                                    boxShadow: '0 4px 20px rgba(106, 13, 173, 0.4)'
                                }}
                            >
                                <div className="flex items-start gap-6">
                                    <div
                                        className="w-16 h-16 rounded-full border-2 border-orange-400 flex items-center justify-center backdrop-blur-lg flex-shrink-0"
                                        style={{
                                            background: 'radial-gradient(circle, hsl(280 100% 35% / 0.3), hsl(15 100% 50% / 0.1))'
                                        }}
                                    >
                                        <Icon className="w-8 h-8 text-orange-400" />
                                    </div>

                                    <div className="flex-grow">
                                        <div className="mb-4">
                                            <span className="text-sm font-semibold text-orange-400">{phase.phase}</span>
                                            <h3 className="text-2xl font-bold text-white mb-2">{phase.title}</h3>
                                            <p className="text-gray-300">{phase.description}</p>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                                    How it Works
                                                </h4>
                                                <div className="space-y-2">
                                                    {phase.steps.map((step, idx) => (
                                                        <div key={idx} className="flex items-start gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                <span className="text-xs font-bold text-orange-400">{idx + 1}</span>
                                                            </div>
                                                            <span className="text-sm text-gray-300">{step}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                                                    Pro Tips
                                                </h4>
                                                <div className="space-y-2">
                                                    {phase.tips.map((tip, idx) => (
                                                        <div key={idx} className="flex items-start gap-2">
                                                            <div className="text-purple-400 mt-1 flex-shrink-0">💡</div>
                                                            <span className="text-sm text-gray-300">{tip}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Game Rules */}
                <div className="mb-16">
                    <h2 className="text-3xl font-bold text-center mb-8">
                        <span
                            className="bg-clip-text text-transparent"
                            style={{
                                background: 'linear-gradient(135deg, hsl(280 100% 35%), hsl(15 100% 50%))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            Essential Rules
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {gameRules.map((category, index) => {
                            const Icon = category.icon;

                            return (
                                <div
                                    key={index}
                                    className="p-6 rounded-xl border border-white/20 backdrop-blur-lg"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(106, 13, 173, 0.1), rgba(255, 94, 0, 0.05))'
                                    }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <Icon className="w-6 h-6 text-orange-400" />
                                        <h3 className="text-lg font-bold text-white">{category.title}</h3>
                                    </div>
                                    <ul className="space-y-2">
                                        {category.rules.map((rule, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0"></div>
                                                {rule}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CTA */}
                <div className="text-center">
                    <div
                        className="max-w-2xl mx-auto p-8 rounded-2xl border border-white/20 backdrop-blur-lg"
                        style={{
                            background: 'linear-gradient(135deg, rgba(106, 13, 173, 0.1), rgba(255, 94, 0, 0.05))'
                        }}
                    >
                        <h3 className="text-2xl font-bold mb-4">
                            <span
                                className="bg-clip-text text-transparent"
                                style={{
                                    background: 'linear-gradient(135deg, hsl(280 100% 35%), hsl(15 100% 50%))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}
                            >
                                Ready to Survive?
                            </span>
                        </h3>
                        <p className="text-gray-300 mb-6">
                            Join the battle royale and prove you have what it takes to be the ultimate survivor
                        </p>
                        <button
                            onClick={() => navigate('/lobby')}
                            className="px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
                            style={{
                                background: 'linear-gradient(135deg, hsl(280 100% 35%), hsl(15 100% 50%))',
                                boxShadow: '0 6px 30px rgba(255, 94, 0, 0.6)'
                            }}
                        >
                            Enter Battle Lobby
                        </button>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}