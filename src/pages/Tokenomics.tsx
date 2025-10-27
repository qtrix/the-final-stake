import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import { Card } from '@/components/ui/card';
import {
  PieChart, TrendingUp, Lock, Users, Zap, Trophy, Flame, ShoppingBag,
  Vote, DollarSign, Shield, Target, Coins, BarChart3, LineChart,
  ArrowRight, CheckCircle2, Clock, Percent, Wallet, Sparkles
} from 'lucide-react';
import fstLogo from '@/assets/token-logo.png';

export default function Tokenomics() {
  const tokenDistribution = [
    {
      label: 'Community Rewards',
      percentage: 30,
      color: '#9333EA',
      amount: '300M',
      gradient: 'from-purple-600 to-purple-400',
      description: 'Play-to-earn, referrals, tournaments'
    },
    {
      label: 'Liquidity & Market Making',
      percentage: 20,
      color: '#F97316',
      amount: '200M',
      gradient: 'from-orange-600 to-orange-400',
      description: 'DEX pools, market stability'
    },
    {
      label: 'Team & Advisors',
      percentage: 15,
      color: '#3B82F6',
      amount: '150M',
      gradient: 'from-blue-600 to-blue-400',
      description: '4-year vesting, 1-year cliff'
    },
    {
      label: 'Ecosystem Development',
      percentage: 15,
      color: '#10B981',
      amount: '150M',
      gradient: 'from-green-600 to-green-400',
      description: 'Partnerships, grants, integrations'
    },
    {
      label: 'Staking Rewards',
      percentage: 10,
      color: '#F59E0B',
      amount: '100M',
      gradient: 'from-amber-600 to-amber-400',
      description: '5-year decreasing schedule'
    },
    {
      label: 'Initial DEX Offering',
      percentage: 5,
      color: '#8B5CF6',
      amount: '50M',
      gradient: 'from-violet-600 to-violet-400',
      description: 'Fair launch, no VCs'
    },
    {
      label: 'Reserve Fund',
      percentage: 5,
      color: '#EC4899',
      amount: '50M',
      gradient: 'from-pink-600 to-pink-400',
      description: 'Emergency & strategic use'
    },
  ];

  const keyMetrics = [
    {
      label: 'Total Supply',
      value: '1B FST',
      subtitle: 'Fixed forever',
      icon: Coins,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Burned by Year 5',
      value: '40-50%',
      subtitle: '400-500M tokens',
      icon: Flame,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10'
    },
    {
      label: 'Staking APY',
      value: '15-50%',
      subtitle: 'Paid in SOL',
      icon: Percent,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Revenue Share',
      value: '10%',
      subtitle: 'To FST stakers',
      icon: DollarSign,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
  ];

  const utilities = [
    {
      icon: ShoppingBag,
      title: 'NFT Marketplace',
      description: 'All character classes, power-ups, and cosmetics require FST',
      highlight: '50% burned',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Target,
      title: 'Entry Fee Discounts',
      description: 'Stake FST to unlock up to 40% discount on game entry fees',
      highlight: 'Up to 40% off',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: DollarSign,
      title: 'Staking Rewards',
      description: 'Earn real yield in SOL from platform revenue, not token inflation',
      highlight: '15-50% APY',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Vote,
      title: 'Governance Rights',
      description: 'Vote on game mechanics, partnerships, treasury, and ecosystem',
      highlight: '1 FST = 1 Vote',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Trophy,
      title: 'Exclusive Access',
      description: 'Premium tournaments, early features, custom lobbies, analytics',
      highlight: 'VIP perks',
      color: 'from-amber-500 to-yellow-500'
    },
    {
      icon: Shield,
      title: 'Revenue Backing',
      description: '30% of platform fees used to buyback and burn FST tokens',
      highlight: 'Price support',
      color: 'from-violet-500 to-purple-500'
    },
  ];

  const burnMechanics = [
    {
      title: 'NFT Purchases',
      percentage: '50%',
      description: 'Half of every NFT sale is permanently burned',
      estimate: '10-50M FST/year',
      icon: Flame
    },
    {
      title: 'Revenue Buyback',
      percentage: '30%',
      description: 'Platform fees used to buy & burn FST from market',
      estimate: '20-40M FST/year',
      icon: TrendingUp
    },
    {
      title: 'Governance Fees',
      percentage: '100%',
      description: 'All proposal submission fees are burned',
      estimate: '0.5-2M FST/year',
      icon: Vote
    },
  ];

  const vestingSchedule = [
    {
      category: 'Community Rewards',
      allocation: '300M',
      percentage: 30,
      vesting: '3 years',
      cliff: 'None',
      color: 'bg-purple-500',
      monthly: '8.3M'
    },
    {
      category: 'Liquidity & MM',
      allocation: '200M',
      percentage: 20,
      vesting: '2 years',
      cliff: '50% instant',
      color: 'bg-orange-500',
      monthly: '4.2M'
    },
    {
      category: 'Team & Advisors',
      allocation: '150M',
      percentage: 15,
      vesting: '4 years',
      cliff: '12 months',
      color: 'bg-blue-500',
      monthly: '3.1M'
    },
    {
      category: 'Ecosystem Dev',
      allocation: '150M',
      percentage: 15,
      vesting: '2 years',
      cliff: 'None',
      color: 'bg-green-500',
      monthly: '6.3M'
    },
    {
      category: 'Staking Rewards',
      allocation: '100M',
      percentage: 10,
      vesting: '5 years',
      cliff: 'Decreasing',
      color: 'bg-amber-500',
      monthly: '1.7M'
    },
    {
      category: 'IDO',
      allocation: '50M',
      percentage: 5,
      vesting: 'Instant',
      cliff: 'None',
      color: 'bg-violet-500',
      monthly: 'N/A'
    },
    {
      category: 'Reserve',
      allocation: '50M',
      percentage: 5,
      vesting: '2 years',
      cliff: 'Full lock',
      color: 'bg-pink-500',
      monthly: 'Locked'
    },
  ];

  const roadmap = [
    {
      quarter: 'Q4 2025',
      title: 'Foundation',
      items: ['Token design finalized', 'Smart contracts audited', 'Whitepaper published'],
      status: 'upcoming'
    },
    {
      quarter: 'Q1 2026',
      title: 'Launch',
      items: ['IDO & TGE', 'DEX listings', 'Staking live', 'First games'],
      status: 'upcoming'
    },
    {
      quarter: 'Q2 2026',
      title: 'Growth',
      items: ['1,000+ players', 'NFT marketplace', 'Mobile app beta'],
      status: 'upcoming'
    },
    {
      quarter: 'Q3 2026',
      title: 'Scale',
      items: ['CEX listings', '10,000 players', 'Governance live'],
      status: 'upcoming'
    },
    {
      quarter: 'Q4 2026',
      title: 'Expansion',
      items: ['25,000 players', 'New game modes', 'Partnerships'],
      status: 'future'
    },
    {
      quarter: '2027+',
      title: 'Maturity',
      items: ['100K+ players', 'Full DAO', '$30M+ revenue'],
      status: 'future'
    },
  ];

  const priceTargets = [
    { period: 'Year 1', price: '$0.10', marketCap: '$100M', multiplier: '5x' },
    { period: 'Year 2', price: '$0.50', marketCap: '$500M', multiplier: '25x' },
    { period: 'Year 3', price: '$1.00', marketCap: '$1B', multiplier: '50x' },
  ];

  return (
    <div className="min-h-screen relative text-white">
      <ParticleBackground />
      <Navbar />

      <div className="container mx-auto px-4 pt-32 pb-16 relative z-10 max-w-7xl">

        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-orange-500/20 border border-purple-500/30 mb-6">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold">Sustainable Tokenomics</span>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-orange-500 blur-2xl opacity-50"></div>
              <img src={fstLogo} alt="FST Token" className="w-20 h-20 relative z-10 drop-shadow-2xl" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black gradient-text">
              $FST Token
            </h1>
          </div>

          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
            The native token powering The Final Stake ecosystem with <span className="text-purple-400 font-semibold">real utility</span>,
            <span className="text-orange-400 font-semibold"> real yield</span>, and
            <span className="text-green-400 font-semibold"> real deflation</span>
          </p>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {keyMetrics.map((metric, index) => (
              <Card key={index} className={`${metric.bgColor} border-none hover:scale-105 transition-all duration-300`}>
                <div className="flex flex-col items-center p-6">
                  <metric.icon className={`w-8 h-8 ${metric.color} mb-3`} />
                  <div className={`text-3xl font-black ${metric.color} mb-1`}>{metric.value}</div>
                  <div className="text-sm font-semibold text-white mb-1">{metric.label}</div>
                  <div className="text-xs text-gray-400">{metric.subtitle}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Dual Token Model */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black gradient-text mb-4">
              The Dual Token Advantage
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              SOL for stability. FST for growth. The perfect economic balance.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-500/30 hover:border-purple-500/50 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-purple-400 mb-2">SOL (Game Currency)</h3>
                  <p className="text-gray-300 mb-4">Entry fees, prize pools, and gameplay use SOL for stable, predictable costs.</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      <span>$15 entry always costs $15</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      <span>No volatility risk for players</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      <span>Instant settlement, low fees</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 border-orange-500/30 hover:border-orange-500/50 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-orange-400 mb-2">FST (Ecosystem Token)</h3>
                  <p className="text-gray-300 mb-4">NFTs, staking, governance, and discounts. Optional but powerful.</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-orange-400" />
                      <span>Real utility: 5+ use cases</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-orange-400" />
                      <span>Real yield: SOL revenue share</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-orange-400" />
                      <span>Real deflation: Triple burn</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Token Distribution */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black gradient-text mb-4">
              Token Distribution
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              1 Billion FST distributed fairly with community-first allocation
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pie Chart */}
            <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 border-gray-700/50">
              <div className="aspect-square flex items-center justify-center p-8">
                <div className="relative w-full max-w-sm aspect-square">
                  {/* Render pie chart segments */}
                  {tokenDistribution.map((item, index) => {
                    const startAngle = tokenDistribution
                      .slice(0, index)
                      .reduce((sum, d) => sum + d.percentage * 3.6, -90);
                    const angle = item.percentage * 3.6;

                    return (
                      <div
                        key={index}
                        className="absolute inset-0 rounded-full transition-all duration-500 hover:scale-105"
                        style={{
                          background: `conic-gradient(from ${startAngle}deg, ${item.color} 0deg ${angle}deg, transparent ${angle}deg)`,
                          filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))'
                        }}
                      />
                    );
                  })}
                  <div className="absolute inset-16 rounded-full bg-gray-900 flex items-center justify-center border-4 border-gray-800">
                    <div className="text-center">
                      <img src={fstLogo} alt="FST" className="w-20 h-20 mx-auto mb-2 drop-shadow-2xl" />
                      <div className="text-3xl font-black gradient-text">$FST</div>
                      <div className="text-sm text-gray-400 font-semibold">1B Supply</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Distribution List */}
            <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 border-gray-700/50">
              <div className="space-y-4">
                {tokenDistribution.map((item, index) => (
                  <div
                    key={index}
                    className="group hover:bg-white/5 p-4 rounded-lg transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: item.color, boxShadow: `0 0 20px ${item.color}80` }}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold text-white mb-1">{item.label}</div>
                            <div className="text-xs text-gray-400">{item.description}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-black" style={{ color: item.color }}>
                              {item.percentage}%
                            </div>
                            <div className="text-xs text-gray-400">{item.amount} FST</div>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 group-hover:scale-105"
                            style={{
                              background: `linear-gradient(to right, ${item.color}, ${item.color}dd)`,
                              width: `${item.percentage}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* Token Utilities */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black gradient-text mb-4">
              Token Utility
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Six powerful use cases that drive real demand and sustainable value
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {utilities.map((utility, index) => (
              <Card
                key={index}
                className="group bg-gradient-to-br from-gray-900/50 to-gray-800/30 border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${utility.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${utility.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <utility.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{utility.title}</h3>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">{utility.description}</p>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${utility.color} text-white text-xs font-bold`}>
                    <Sparkles className="w-3 h-3" />
                    {utility.highlight}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Burn Mechanisms */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black gradient-text mb-4">
              Triple Burn Mechanism
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Three independent burn mechanisms creating massive deflationary pressure
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {burnMechanics.map((burn, index) => (
              <Card
                key={index}
                className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30 hover:border-orange-500/50 transition-all duration-300 hover:scale-105"
              >
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4">
                    <burn.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-4xl font-black text-orange-400 mb-2">{burn.percentage}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{burn.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{burn.description}</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-300 text-xs font-semibold">
                    <Flame className="w-3 h-3" />
                    {burn.estimate}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-8 bg-gradient-to-r from-orange-900/20 to-red-900/20 border-orange-500/30">
            <div className="text-center">
              <div className="text-5xl font-black gradient-text mb-4">400-500M FST</div>
              <div className="text-2xl font-bold text-orange-400 mb-2">Burned by Year 5</div>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Combined effect of all three mechanisms = 40-50% of total supply permanently removed from circulation
              </p>
            </div>
          </Card>
        </section>

        {/* Vesting Schedule */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black gradient-text mb-4">
              Vesting Schedule
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Conservative unlock schedule with 4-year team vesting and 1-year cliff
            </p>
          </div>

          <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 border-gray-700/50 overflow-hidden">
            <div className="space-y-3">
              {vestingSchedule.map((item, index) => (
                <div
                  key={index}
                  className="group hover:bg-white/5 p-4 rounded-lg transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-12 rounded-full ${item.color} flex-shrink-0`}></div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      <div>
                        <div className="font-bold text-white">{item.category}</div>
                        <div className="text-xs text-gray-400">{item.percentage}% allocation</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-black text-purple-400">{item.allocation}M</div>
                        <div className="text-xs text-gray-400">FST</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-white">{item.vesting}</div>
                        <div className="text-xs text-gray-400">Total period</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-orange-400">{item.cliff}</div>
                        <div className="text-xs text-gray-400">Lock/Cliff</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-green-400">{item.monthly}</div>
                        <div className="text-xs text-gray-400">Monthly avg</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Roadmap */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black gradient-text mb-4">
              Launch Roadmap
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Strategic rollout from Q4 2025 through full ecosystem maturity
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-purple-500 via-orange-500 to-green-500 rounded-full hidden lg:block"></div>

            <div className="space-y-8">
              {roadmap.map((milestone, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-8 ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
                >
                  <div className="flex-1 lg:text-right">
                    <Card className={`
                      ${milestone.status === 'upcoming' ? 'bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-500/30' : ''}
                      ${milestone.status === 'future' ? 'bg-gradient-to-br from-gray-900/30 to-gray-800/20 border-gray-700/30' : ''}
                      hover:scale-105 transition-all duration-300
                    `}>
                      <div className="flex flex-col lg:items-end">
                        <div className="text-sm font-bold text-orange-400 mb-2">{milestone.quarter}</div>
                        <h3 className="text-2xl font-black text-white mb-4">{milestone.title}</h3>
                        <div className="space-y-2">
                          {milestone.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-gray-400">
                              <CheckCircle2 className="w-4 h-4 text-purple-400" />
                              <span className="text-sm">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Center dot */}
                  <div className="hidden lg:flex w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 items-center justify-center flex-shrink-0 shadow-2xl relative z-10">
                    <Clock className="w-8 h-8 text-white" />
                  </div>

                  <div className="flex-1"></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Price Targets */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black gradient-text mb-4">
              Price Projections
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Conservative targets based on user growth and revenue projections
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {priceTargets.map((target, index) => (
              <Card
                key={index}
                className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 hover:scale-105 text-center"
              >
                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-2">{target.period}</div>
                  <div className="text-5xl font-black gradient-text mb-2">{target.price}</div>
                  <div className="text-xl font-bold text-orange-400">{target.multiplier}</div>
                </div>
                <div className="pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Market Cap</div>
                  <div className="text-2xl font-bold text-purple-400">{target.marketCap}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section>
          <Card className="bg-gradient-to-br from-purple-900/30 via-orange-900/20 to-green-900/20 border-purple-500/30 text-center overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-orange-500/10"></div>
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black gradient-text mb-6">
                Ready to Join the Ecosystem?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                $FST combines the best of gaming tokens with sound DeFi economics.
                Real utility. Real yield. Real deflation. Built for long-term sustainability.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a
                  href="/play"
                  className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-orange-500 text-white font-bold rounded-xl hover:scale-105 transition-all duration-300 flex items-center gap-2 shadow-2xl"
                >
                  <span>Start Playing Now</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="https://final-stake.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 border-2 border-purple-500 text-purple-400 font-bold rounded-xl hover:bg-purple-500/10 transition-all duration-300"
                >
                  Read Full Documentation
                </a>
              </div>
            </div>
          </Card>
        </section>

      </div>
      <Footer />
    </div>
  );
}