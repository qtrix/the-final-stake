import { ArrowLeft, CheckCircle, Clock, Rocket, Trophy, Gamepad2, Smartphone, Globe, Code, Users, Zap, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Roadmap() {
  const navigate = useNavigate();

  const milestones = [
    {
      id: 1,
      quarter: "September 2025",
      title: "Conception & Planning",
      description: "Initial concept development and game design foundation",
      status: "completed",
      icon: Target,
      features: [
        "Core game concept: Blockchain Battle Royale",
        "Economic model design",
        "Solana blockchain selected",
        "Development roadmap established"
      ]
    },
    {
      id: 2,
      quarter: "October 14, 2025",
      title: "Devnet Launch",
      description: "First deployment to Solana Devnet - Smart contracts live",
      status: "completed",
      icon: Rocket,
      features: [
        "Game registry smart contract deployed",
        "Multi-phase game mechanics implemented",
        "NFT integration foundation",
        "Initial testing environment established"
      ]
    },
    {
      id: 3,
      quarter: "October 21-28, 2025",
      title: "Colosseum Hackathon",
      description: "Participated in Solana's premier blockchain gaming competition",
      status: "completed",
      icon: Trophy,
      features: [
        "Competed against top Solana projects",
        "Showcased innovative game mechanics",
        "Community feedback integration",
        "Networked with Solana ecosystem leaders"
      ]
    },
    {
      id: 4,
      quarter: "November 2025",
      title: "Alpha Testing & Refinement",
      description: "Community testing phase with core mechanics optimization",
      status: "in-progress",
      icon: Gamepad2,
      features: [
        "Closed alpha with early supporters",
        "Phase 1-3 gameplay balancing",
        "Mini-games implementation (Rock-Paper-Scissors, Trivia)",
        "Economic model stress testing"
      ]
    },
    {
      id: 5,
      quarter: "December 2025",
      title: "Public Beta & UI Polish",
      description: "Open beta launch with enhanced user experience",
      status: "upcoming",
      icon: Users,
      features: [
        "Public beta on Solana Devnet",
        "Advanced UI/UX improvements",
        "Tutorial system implementation",
        "Community governance foundation"
      ]
    },
    {
      id: 6,
      quarter: "Q1 2026",
      title: "Mainnet Launch",
      description: "Official launch on Solana Mainnet with full ecosystem",
      status: "upcoming",
      icon: Zap,
      features: [
        "Mainnet smart contract deployment",
        "First official tournaments ($10K+ prize pools)",
        "NFT marketplace integration",
        "Staking & rewards program launch"
      ]
    },
    {
      id: 7,
      quarter: "Q2 2026",
      title: "Ecosystem Expansion",
      description: "Additional game modes and competitive features",
      status: "planned",
      icon: Globe,
      features: [
        "Team battle royale mode",
        "Seasonal competitions & leaderboards",
        "Partnership with major Solana projects",
        "Cross-protocol integrations"
      ]
    },
    {
      id: 8,
      quarter: "Q3 2026",
      title: "Mobile & Multiplatform",
      description: "Cross-platform accessibility and mobile experience",
      status: "planned",
      icon: Smartphone,
      features: [
        "Progressive Web App launch",
        "Mobile-optimized gameplay",
        "Multi-language support",
        "Regional tournaments worldwide"
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 border-green-400 bg-green-400/10';
      case 'in-progress':
        return 'text-orange-400 border-orange-400 bg-orange-400/10';
      case 'upcoming':
        return 'text-blue-400 border-blue-400 bg-blue-400/10';
      case 'planned':
        return 'text-purple-400 border-purple-400 bg-purple-400/10';
      default:
        return 'text-gray-400 border-gray-400 bg-gray-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'upcoming':
        return <Clock className="w-4 h-4" />;
      case 'planned':
        return <Clock className="w-4 h-4 opacity-50" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

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
              Development Roadmap
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            From concept to the ultimate Solana battle royale experience - tracking our journey
          </p>
        </div>

        {/* Timeline */}
        <div className="relative max-w-4xl mx-auto">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-orange-500 to-purple-500 opacity-30"></div>

          <div className="space-y-12">
            {milestones.map((milestone, index) => {
              const Icon = milestone.icon;

              return (
                <div key={milestone.id} className="relative flex items-start gap-8">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`w-16 h-16 rounded-full border-2 flex items-center justify-center backdrop-blur-lg ${getStatusColor(milestone.status)}`}
                      style={{
                        background: milestone.status === 'completed'
                          ? 'radial-gradient(circle, hsl(120 100% 35% / 0.3), hsl(120 100% 50% / 0.1))'
                          : milestone.status === 'in-progress'
                            ? 'radial-gradient(circle, hsl(15 100% 50% / 0.3), hsl(280 100% 35% / 0.1))'
                            : 'rgba(0, 0, 0, 0.8)'
                      }}
                    >
                      <Icon className={`w-8 h-8 ${milestone.status === 'in-progress' ? 'animate-pulse' : ''}`} />
                    </div>

                    {/* Connecting line animation for completed */}
                    {milestone.status === 'completed' && index < milestones.length - 1 && (
                      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-gradient-to-b from-green-500 to-transparent"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div
                    className="flex-grow p-8 rounded-2xl border border-white/20 backdrop-blur-lg hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-[1.02]"
                    style={{
                      background: milestone.status === 'completed'
                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(106, 13, 173, 0.05))'
                        : milestone.status === 'in-progress'
                          ? 'linear-gradient(135deg, rgba(255, 94, 0, 0.15), rgba(106, 13, 173, 0.1))'
                          : 'linear-gradient(135deg, rgba(106, 13, 173, 0.1), rgba(255, 94, 0, 0.05))',
                      boxShadow: milestone.status === 'in-progress'
                        ? '0 10px 40px rgba(255, 94, 0, 0.4)'
                        : milestone.status === 'completed'
                          ? '0 4px 20px rgba(34, 197, 94, 0.3)'
                          : '0 4px 20px rgba(106, 13, 173, 0.2)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-xl md:text-2xl font-black text-orange-400">{milestone.quarter}</span>
                          <div className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${getStatusColor(milestone.status)}`}>
                            {getStatusIcon(milestone.status)}
                            {milestone.status.replace('-', ' ').toUpperCase()}
                          </div>
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{milestone.title}</h3>
                        <p className="text-gray-300 text-sm md:text-base">{milestone.description}</p>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      {milestone.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${milestone.status === 'completed'
                              ? 'bg-green-400'
                              : milestone.status === 'in-progress'
                                ? 'bg-orange-400'
                                : 'bg-purple-400'
                            }`}></div>
                          <span className="text-sm text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Special badges for notable milestones */}
                    {milestone.id === 3 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                          <Trophy className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm font-semibold text-yellow-400">Hackathon Participant</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Section */}
        <div className="max-w-4xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            className="p-6 rounded-xl backdrop-blur-lg border border-white/20 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(106, 13, 173, 0.05))'
            }}
          >
            <div className="text-3xl font-black text-green-400 mb-2">3</div>
            <div className="text-sm text-gray-400">Milestones Completed</div>
          </div>

          <div
            className="p-6 rounded-xl backdrop-blur-lg border border-white/20 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 94, 0, 0.1), rgba(106, 13, 173, 0.05))'
            }}
          >
            <div className="text-3xl font-black text-orange-400 mb-2">1</div>
            <div className="text-sm text-gray-400">In Progress</div>
          </div>

          <div
            className="p-6 rounded-xl backdrop-blur-lg border border-white/20 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(106, 13, 173, 0.05))'
            }}
          >
            <div className="text-3xl font-black text-blue-400 mb-2">2</div>
            <div className="text-sm text-gray-400">Upcoming</div>
          </div>

          <div
            className="p-6 rounded-xl backdrop-blur-lg border border-white/20 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(106, 13, 173, 0.05))'
            }}
          >
            <div className="text-3xl font-black text-purple-400 mb-2">2</div>
            <div className="text-sm text-gray-400">Planned</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
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
                Join the Revolution
              </span>
            </h3>
            <p className="text-gray-300 mb-6">
              We're building the future of blockchain gaming on Solana. Be part of our journey from alpha to global phenomenon.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3 rounded-xl font-semibold border border-white/20 text-white hover:bg-white/10 transition-all duration-300"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.2); opacity: 0.4; }
        }
      `}</style>
      <Footer />
    </div>
  );
}