import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pickaxe, Sprout, TrendingUp, FlaskConical, Users } from 'lucide-react';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useSolanaGame } from "../hooks/useSolanaGame";
import type { Game } from "../hooks/useSolanaGame";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import PoolCard from "@/components/phase1/PoolCard";
import AllocationBar from "@/components/phase1/AllocationBar";
import EventsTicker, { GameEvent } from "@/components/phase1/EventsTicker";
import RewardsPanel from "@/components/phase1/RewardsPanel";
import { useToast } from "@/hooks/use-toast";

export default function Phase1() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const solanaGame = useSolanaGame();
  const { toast } = useToast();
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  
  // Resource allocations (percentages)
  const [allocations, setAllocations] = useState({
    mining: 20,
    farming: 20,
    trading: 20,
    research: 20,
    social: 20
  });

  // Mock rewards state (will be replaced with blockchain data)
  const [pendingRewards, setPendingRewards] = useState({
    mining: 0,
    farming: 0,
    trading: 0,
    research: 0,
    social: 0
  });

  // Mock events (will be replaced with blockchain events)
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([
    {
      id: '1',
      type: 'breakthrough',
      pool: 'research',
      message: 'Research Pool Breakthrough! 10x multiplier active',
      timestamp: new Date(),
      icon: '🔬',
      color: 'hsl(280, 80%, 60%)'
    },
    {
      id: '2',
      type: 'whale',
      pool: 'social',
      message: 'Whale entered Social Pool! Bonus rewards incoming',
      timestamp: new Date(Date.now() - 60000),
      icon: '🐋',
      color: 'hsl(50, 100%, 60%)'
    },
    {
      id: '3',
      type: 'boom',
      pool: 'trading',
      message: 'Trading Pool surge! +45% returns',
      timestamp: new Date(Date.now() - 120000),
      icon: '📈',
      color: 'hsl(15, 100%, 50%)'
    }
  ]);

  // Find the game the player is in
  useEffect(() => {
    if (!wallet.publicKey) {
      navigate('/lobby');
      return;
    }

    const playerAddress = wallet.publicKey.toBase58();
    const activeGame = solanaGame.games.find(
      g => g.gameStarted && g.players.includes(playerAddress)
    );

    if (activeGame) {
      setCurrentGame(activeGame);
    } else if (solanaGame.games.length > 0) {
      // Only redirect if games have been loaded and player is not in any started game
      console.log('🏠 Player not in any started game, redirecting to lobby...');
      navigate('/lobby');
    }
  }, [solanaGame.games, wallet.publicKey, navigate]);

  // Simulate rewards accumulation
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingRewards(prev => ({
        mining: prev.mining + (allocations.mining * 0.00001),
        farming: prev.farming + (allocations.farming * 0.00002),
        trading: prev.trading + (allocations.trading * 0.00003),
        research: prev.research + (allocations.research * 0.00001),
        social: prev.social + (allocations.social * 0.000015)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [allocations]);

  const handleAllocationChange = (pool: keyof typeof allocations, value: number[]) => {
    const newValue = value[0];
    const oldValue = allocations[pool];
    const difference = newValue - oldValue;
    
    // Calculate total of other pools
    const otherPools = Object.keys(allocations).filter(p => p !== pool) as (keyof typeof allocations)[];
    const otherTotal = otherPools.reduce((sum, p) => sum + allocations[p], 0);
    
    // Adjust other pools proportionally
    const newAllocations = { ...allocations, [pool]: newValue };
    
    if (otherTotal > 0) {
      otherPools.forEach(p => {
        const proportion = allocations[p] / otherTotal;
        newAllocations[p] = Math.max(0, allocations[p] - (difference * proportion));
      });
    }
    
    // Normalize to ensure total is 100
    const total = Object.values(newAllocations).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      Object.keys(newAllocations).forEach(key => {
        newAllocations[key as keyof typeof allocations] = 
          (newAllocations[key as keyof typeof allocations] / total) * 100;
      });
    }
    
    setAllocations(newAllocations);
  };

  const handleQuickAllocation = (pool: keyof typeof allocations, percentage: number) => {
    if (percentage === 0) {
      // Clear this pool
      const newAllocations = { ...allocations };
      const toDistribute = newAllocations[pool];
      newAllocations[pool] = 0;
      
      // Distribute to other pools proportionally
      const otherPools = Object.keys(allocations).filter(p => p !== pool) as (keyof typeof allocations)[];
      const otherTotal = otherPools.reduce((sum, p) => sum + newAllocations[p], 0);
      
      if (otherTotal > 0) {
        otherPools.forEach(p => {
          const proportion = newAllocations[p] / otherTotal;
          newAllocations[p] = newAllocations[p] + (toDistribute * proportion);
        });
      } else {
        // If all others are 0, distribute equally
        otherPools.forEach(p => {
          newAllocations[p] = toDistribute / otherPools.length;
        });
      }
      
      setAllocations(newAllocations);
    } else {
      handleAllocationChange(pool, [percentage]);
    }
  };

  const handleClaimRewards = async () => {
    // TODO: Call blockchain contract to claim rewards
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate transaction
    
    setPendingRewards({
      mining: 0,
      farming: 0,
      trading: 0,
      research: 0,
      social: 0
    });
  };

  const resourcePools = [
    {
      key: 'mining' as const,
      name: 'Mining Pool',
      icon: Pickaxe,
      emoji: '⛏️',
      yieldRange: '2-5%/h',
      volatility: 'Low',
      riskLevel: 'low' as const,
      description: 'Stable hourly yields, low volatility, safe and reliable',
      color: 'hsl(200, 70%, 50%)',
      bgGradient: 'linear-gradient(135deg, hsla(200, 70%, 50%, 0.15), hsla(200, 70%, 50%, 0.05))',
      borderColor: 'hsla(200, 70%, 50%, 0.4)',
      currentAPR: '3.5%',
      participants: 42,
      specialCondition: undefined
    },
    {
      key: 'farming' as const,
      name: 'Farming Pool',
      icon: Sprout,
      emoji: '🌾',
      yieldRange: '5-15%/h',
      volatility: 'Medium',
      riskLevel: 'medium' as const,
      description: 'Variable yields affected by seasons and weather events',
      color: 'hsl(120, 60%, 50%)',
      bgGradient: 'linear-gradient(135deg, hsla(120, 60%, 50%, 0.15), hsla(120, 60%, 50%, 0.05))',
      borderColor: 'hsla(120, 60%, 50%, 0.4)',
      currentAPR: '8.2%',
      participants: 38,
      specialCondition: '🌞 Summer Bonus Active'
    },
    {
      key: 'trading' as const,
      name: 'Trading Pool',
      icon: TrendingUp,
      emoji: '📈',
      yieldRange: '-30% to +50%/h',
      volatility: 'High',
      riskLevel: 'high' as const,
      description: 'Extreme volatility with crash risks and boom potential',
      color: 'hsl(15, 100%, 50%)',
      bgGradient: 'linear-gradient(135deg, hsla(15, 100%, 50%, 0.15), hsla(15, 100%, 50%, 0.05))',
      borderColor: 'hsla(15, 100%, 50%, 0.4)',
      currentAPR: '24.7%',
      participants: 51,
      specialCondition: '📊 Market Volatility High'
    },
    {
      key: 'research' as const,
      name: 'Research Pool',
      icon: FlaskConical,
      emoji: '🔬',
      yieldRange: '1% chance for 10x/h',
      volatility: 'Extreme',
      riskLevel: 'extreme' as const,
      description: 'Lottery-style pool with rare breakthrough events for massive gains',
      color: 'hsl(280, 80%, 60%)',
      bgGradient: 'linear-gradient(135deg, hsla(280, 80%, 60%, 0.15), hsla(280, 80%, 60%, 0.05))',
      borderColor: 'hsla(280, 80%, 60%, 0.4)',
      currentAPR: '0.5%',
      participants: 29,
      specialCondition: '⚗️ Breakthrough Imminent'
    },
    {
      key: 'social' as const,
      name: 'Social Pool',
      icon: Users,
      emoji: '🤝',
      yieldRange: '3-12%/h',
      volatility: 'Medium',
      riskLevel: 'medium' as const,
      description: 'Bonus rewards scale with alliance participation and collaboration',
      color: 'hsl(50, 100%, 60%)',
      bgGradient: 'linear-gradient(135deg, hsla(50, 100%, 60%, 0.15), hsla(50, 100%, 60%, 0.05))',
      borderColor: 'hsla(50, 100%, 60%, 0.4)',
      currentAPR: '6.8%',
      participants: 45,
      specialCondition: '🐋 Whale Detected'
    }
  ];

  const handleConfirmAllocation = () => {
    // TODO: Submit allocation to blockchain
    toast({
      title: "Allocation Confirmed!",
      description: "Your resources have been allocated successfully.",
    });
    console.log('Allocations submitted:', allocations);
  };

  const totalPendingRewards = Object.values(pendingRewards).reduce((sum, val) => sum + val, 0);

  const poolRewardsData = resourcePools.map(pool => ({
    pool: pool.name,
    emoji: pool.emoji,
    amount: pendingRewards[pool.key],
    color: pool.color
  }));

  const allocationBarData = resourcePools.map(pool => ({
    key: pool.key,
    name: pool.name,
    emoji: pool.emoji,
    color: pool.color,
    allocation: allocations[pool.key],
    amount: (currentGame?.entryFee || 0) * allocations[pool.key] / 100
  }));

  if (!currentGame) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black mb-4 gradient-text animate-fade-in">
            Phase 1: Resource Gathering
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Allocate your {currentGame.entryFee} SOL across five resource pools and watch your rewards grow!
          </p>
        </div>

        {/* Events Ticker */}
        <EventsTicker events={gameEvents} />

        {/* Rewards Panel */}
        <RewardsPanel
          poolRewards={poolRewardsData}
          totalPending={totalPendingRewards}
          onClaimRewards={handleClaimRewards}
        />

        {/* Allocation Summary */}
        <AllocationBar
          pools={allocationBarData}
          totalBalance={currentGame.entryFee}
        />

        {/* Resource Pools */}
        <div className="grid gap-6 mb-8">
          {resourcePools.map(pool => (
            <PoolCard
              key={pool.key}
              name={pool.name}
              icon={pool.icon}
              emoji={pool.emoji}
              description={pool.description}
              yieldRange={pool.yieldRange}
              volatility={pool.volatility}
              riskLevel={pool.riskLevel}
              color={pool.color}
              bgGradient={pool.bgGradient}
              borderColor={pool.borderColor}
              allocation={allocations[pool.key]}
              entryFee={currentGame.entryFee}
              participants={pool.participants}
              currentAPR={pool.currentAPR}
              specialCondition={pool.specialCondition}
              onAllocationChange={(value) => handleAllocationChange(pool.key, value)}
              onQuickAllocation={(percentage) => handleQuickAllocation(pool.key, percentage)}
            />
          ))}
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="px-12 py-6 text-xl font-bold relative overflow-hidden group"
            onClick={handleConfirmAllocation}
            style={{
              background: 'linear-gradient(135deg, hsl(280, 100%, 50%), hsl(280, 100%, 40%))',
              boxShadow: '0 0 40px hsl(280, 100%, 50%)'
            }}
          >
            <span className="relative z-10">Confirm Allocation & Start Playing</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
