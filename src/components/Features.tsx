import React from 'react';
import fstLogo from '@/assets/token-logo.png';

export default function Features() {
  const featureData = [
    {
      icon: "⚔️",
      title: "Strategic Warfare",
      description:
        "Outsmart 99 opponents through resource management, alliances, and tactical battles. Only the smartest survive.",
    },
    {
      icon: "💎",
      title: (<><img src={fstLogo} alt="$FST Logo" className="inline w-7 h-7 align-text-bottom mx-1" /> $FST Token</>),
      description:
        "Deflationary tokenomics with staking rewards, governance rights, and exclusive NFT access.",
    },
    {
      icon: "🎮",
      title: "Play-to-Earn",
      description:
        "Fully on-chain gaming with real SOL rewards. Every match is a chance to multiply your investment.",
    },
    {
      icon: "🏆",
      title: "Esports Ready",
      description:
        "Competitive tournaments with massive prize pools and community events starting Q2 2026.",
    },
    {
      icon: "🔗",
      title: "Multi-Chain",
      description:
        "Expanding to Ethereum, BASE, and SUI in Q3 2026 for maximum accessibility.",
    },
    {
      icon: "🛡️",
      title: "Fair & Transparent",
      description:
        "100% on-chain mechanics ensure complete fairness and verifiable gameplay.",
    },
  ];

  return (
    <section id="features" className="py-16 lg:py-24 relative">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-center mb-16">
          <span className="gradient-text">Why FINAL STAKE?</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featureData.map((feature, index) => (
            <div
              key={index}
              className="card-sol p-8 group relative overflow-hidden"
            >
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] 
                              bg-gradient-radial from-sol-orange/10 to-transparent" />
              </div>

              <div className="relative z-10">
                <div className="text-5xl mb-6">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-4 text-secondary">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
