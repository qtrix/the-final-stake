import { ArrowLeft, CheckCircle, Clock, Rocket, Trophy, Gamepad2, Smartphone, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Roadmap() {
  const navigate = useNavigate();

  const milestones = [
    {
      id: 1,
      quarter: "Q4 2024",
      title: "Foundation & Concept",
      description: "Game concept development, core team assembly, and technical architecture design",
      status: "completed",
      icon: CheckCircle,
      features: [
        "Game design document finalization",
        "Core team recruitment",
        "Technical stack selection",
        "Initial funding secured"
      ]
    },
    {
      id: 2,
      quarter: "Q1 2025",
      title: "Alpha Development",
      description: "Core game mechanics, blockchain integration, and NFT collection launch",
      status: "in-progress",
      icon: Gamepad2,
      features: [
        "Battle royale mechanics implementation",
        "Solana blockchain integration",
        "NFT weapons & characters launch",
        "Closed alpha testing begins"
      ]
    },
    {
      id: 3,
      quarter: "Q2 2025",
      title: "Beta Launch & Tournaments",
      description: "Public beta release, competitive tournaments, and community building",
      status: "upcoming",
      icon: Trophy,
      features: [
        "Open beta launch",
        "First major tournament ($50K prize pool)",
        "Staking & farming pools activation",
        "Community governance implementation"
      ]
    },
    {
      id: 4,
      quarter: "Q3 2025",
      title: "Full Launch & Ecosystem",
      description: "Official game launch, ecosystem expansion, and partnership integrations",
      status: "upcoming",
      icon: Rocket,
      features: [
        "Full game launch on Solana",
        "Cross-chain bridge implementation",
        "Major gaming partnerships",
        "eSports league establishment"
      ]
    },
    {
      id: 5,
      quarter: "Q4 2025",
      title: "Mobile & Global Expansion",
      description: "Mobile version release and global market penetration",
      status: "planned",
      icon: Smartphone,
      features: [
        "Mobile app launch (iOS & Android)",
        "Multi-language support",
        "Regional tournaments worldwide",
        "Integration with major gaming platforms"
      ]
    },
    {
      id: 6,
      quarter: "Q1 2026",
      title: "Metaverse Integration",
      description: "Virtual world expansion and metaverse ecosystem development",
      status: "planned",
      icon: Globe,
      features: [
        "3D metaverse world launch",
        "Virtual real estate system",
        "Cross-game asset utilization",
        "VR/AR compatibility"
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 border-green-400';
      case 'in-progress':
        return 'text-orange-400 border-orange-400';
      case 'upcoming':
        return 'text-blue-400 border-blue-400';
      case 'planned':
        return 'text-purple-400 border-purple-400';
      default:
        return 'text-gray-400 border-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in-progress':
        return <Clock className="w-4 h-4" />;
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
            Follow our journey as we build the ultimate blockchain battle royale experience
          </p>
        </div>

        {/* Timeline */}
        <div className="relative max-w-4xl mx-auto">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 via-orange-500 to-purple-500 opacity-30"></div>
          
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
                          ? 'radial-gradient(circle, hsl(280 100% 35% / 0.3), hsl(15 100% 50% / 0.1))'
                          : 'rgba(0, 0, 0, 0.8)'
                      }}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                  </div>

                  {/* Content */}
                  <div 
                    className="flex-grow p-8 rounded-2xl border border-white/20 backdrop-blur-lg hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, rgba(106, 13, 173, 0.1), rgba(255, 94, 0, 0.05))',
                      boxShadow: milestone.status === 'in-progress' 
                        ? '0 10px 30px rgba(255, 94, 0, 0.3)' 
                        : '0 4px 20px rgba(106, 13, 173, 0.4)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-black text-orange-400">{milestone.quarter}</span>
                          <div className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${getStatusColor(milestone.status)}`}>
                            {getStatusIcon(milestone.status)}
                            {milestone.status.replace('-', ' ').toUpperCase()}
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">{milestone.title}</h3>
                        <p className="text-gray-300">{milestone.description}</p>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {milestone.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-400 mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
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
              Be part of the future of blockchain gaming. Follow our progress and get early access to exclusive features.
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
                className="px-8 py-3 rounded-xl font-semibold border border-white/20 text-white hover:bg-white/10 transition-all duration-300"
              >
                Join Discord
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