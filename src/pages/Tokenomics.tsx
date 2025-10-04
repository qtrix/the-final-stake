import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, TrendingUp, Lock, Users, Zap, Trophy } from 'lucide-react';
import fstLogo from '@/assets/token-logo.png';

export default function Tokenomics() {
  const tokenDistribution = [
    { label: 'Play-to-Earn Rewards', percentage: 40, color: 'hsl(280, 100%, 35%)' },
    { label: 'Staking & Liquidity', percentage: 20, color: 'hsl(15, 100%, 50%)' },
    { label: 'Team & Development', percentage: 15, color: 'hsl(200, 70%, 50%)' },
    { label: 'Community & Marketing', percentage: 10, color: 'hsl(120, 60%, 50%)' },
    { label: 'Partnerships', percentage: 10, color: 'hsl(45, 100%, 50%)' },
    { label: 'Treasury Reserve', percentage: 5, color: 'hsl(280, 50%, 60%)' },
  ];

  const tokenomicsFeatures = [
    {
      icon: TrendingUp,
      title: 'Deflationary Model',
      description: '2% of every transaction is burned, reducing total supply over time',
      color: 'text-sol-orange'
    },
    {
      icon: Lock,
      title: 'Staking Rewards',
      description: 'Earn up to 25% APY by staking $FST tokens in liquidity pools',
      color: 'text-sol-purple'
    },
    {
      icon: Users,
      title: 'Governance Rights',
      description: 'Vote on game mechanics, tournaments, and ecosystem development',
      color: 'text-secondary'
    },
    {
      icon: Zap,
      title: 'Utility Token',
      description: 'Required for entry fees, exclusive tournaments, and NFT marketplace',
      color: 'text-primary'
    },
    {
      icon: Trophy,
      title: 'Tournament Prizes',
      description: 'Major competitive events with $FST prize pools up to 1M tokens',
      color: 'text-sol-orange'
    },
    {
      icon: PieChart,
      title: 'Revenue Share',
      description: '10% of platform revenue distributed to $FST stakers quarterly',
      color: 'text-sol-purple'
    }
  ];

  return (
    <div className="min-h-screen relative text-white">
      <ParticleBackground />
      <Navbar />

      <div className="container mx-auto px-4 pt-32 pb-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src={fstLogo} alt="FST Token" className="w-16 h-16 animate-pulse-glow" />
            <h1 className="text-4xl md:text-6xl font-black gradient-text">
              $FST Tokenomics
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            The native token powering FINAL STAKE ecosystem with deflationary mechanics and real utility
          </p>
        </div>

        {/* Token Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          <Card className="text-center">
            <div className="text-3xl font-black gradient-text mb-2">100M</div>
            <div className="text-sm text-muted-foreground">Total Supply</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-black text-sol-orange mb-2">2%</div>
            <div className="text-sm text-muted-foreground">Burn Rate</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-black text-sol-purple mb-2">25%</div>
            <div className="text-sm text-muted-foreground">Max Staking APY</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-black gradient-text mb-2">Q3 2026</div>
            <div className="text-sm text-muted-foreground">TGE Date</div>
          </Card>
        </div>

        {/* Token Distribution */}
        <div className="mb-16">
          <h2 className="text-3xl font-black text-center mb-12 gradient-text">Token Distribution</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <div className="aspect-square flex items-center justify-center">
                <div className="relative w-full max-w-sm">
                  {tokenDistribution.map((item, index) => {
                    const startAngle = tokenDistribution.slice(0, index).reduce((sum, d) => sum + (d.percentage * 3.6), -90);
                    const angle = item.percentage * 3.6;

                    return (
                      <div
                        key={index}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(from ${startAngle}deg, ${item.color} 0deg ${angle}deg, transparent ${angle}deg)`,
                          opacity: 0.8
                        }}
                      />
                    );
                  })}
                  <div className="absolute inset-12 rounded-full bg-background flex items-center justify-center">
                    <div className="text-center">
                      <img src={fstLogo} alt="FST" className="w-16 h-16 mx-auto mb-2" />
                      <div className="text-2xl font-black gradient-text">$FST</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                {tokenDistribution.map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-sm font-bold" style={{ color: item.color }}>
                          {item.percentage}%
                        </span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: item.color,
                            width: `${item.percentage}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-black text-center mb-12 gradient-text">Token Utility</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tokenomicsFeatures.map((feature, index) => (
              <Card key={index} className="group hover:scale-105 transition-transform duration-300">
                <div className={`w-12 h-12 rounded-lg bg-gradient-sol flex items-center justify-center mb-4 ${feature.color}`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-secondary">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Vesting Schedule */}
        <Card>
          <h2 className="text-3xl font-black text-center mb-8 gradient-text">Vesting Schedule</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-4 px-4 text-secondary">Category</th>
                  <th className="text-left py-4 px-4 text-secondary">Allocation</th>
                  <th className="text-left py-4 px-4 text-secondary">Vesting Period</th>
                  <th className="text-left py-4 px-4 text-secondary">Lock Period</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-4 px-4">Play-to-Earn Rewards</td>
                  <td className="py-4 px-4 font-bold text-sol-purple">40M FST</td>
                  <td className="py-4 px-4">5 years</td>
                  <td className="py-4 px-4">None</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-4 px-4">Team & Development</td>
                  <td className="py-4 px-4 font-bold text-sol-orange">15M FST</td>
                  <td className="py-4 px-4">4 years</td>
                  <td className="py-4 px-4">1 year cliff</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-4 px-4">Staking & Liquidity</td>
                  <td className="py-4 px-4 font-bold text-sol-purple">20M FST</td>
                  <td className="py-4 px-4">3 years</td>
                  <td className="py-4 px-4">6 months</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-4 px-4">Community & Marketing</td>
                  <td className="py-4 px-4 font-bold text-sol-orange">10M FST</td>
                  <td className="py-4 px-4">2 years</td>
                  <td className="py-4 px-4">None</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-4 px-4">Partnerships</td>
                  <td className="py-4 px-4 font-bold text-sol-purple">10M FST</td>
                  <td className="py-4 px-4">3 years</td>
                  <td className="py-4 px-4">3 months</td>
                </tr>
                <tr>
                  <td className="py-4 px-4">Treasury Reserve</td>
                  <td className="py-4 px-4 font-bold text-sol-orange">5M FST</td>
                  <td className="py-4 px-4">5 years</td>
                  <td className="py-4 px-4">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
