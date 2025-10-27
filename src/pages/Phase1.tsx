// src/pages/Phase1.tsx - VERSIUNE FINALĂ COMPLETĂ CU FIX
import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pickaxe, Sprout, TrendingUp, FlaskConical, Users, Loader2, Clock, ArrowRight } from 'lucide-react';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useSolanaGame, type PlayerGameState, type GamePoolState } from "../hooks/useSolanaGame";
import type { Game } from "../hooks/useSolanaGame";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import PoolCard from "@/components/phase1/PoolCard";
import AllocationBar from "@/components/phase1/AllocationBar";
import RewardsPanel from "@/components/phase1/RewardsPanel";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import EventsTicker, { GameEvent as UIGameEvent } from "@/components/phase1/EventsTicker";
import EventsNewsBar from '@/components/EventsNewsBar';
import { generateChaosEvents, getUpcomingEvents, ChaosEvent } from '@/utils/mockChaosEvents';

export default function Phase1() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const solanaGame = useSolanaGame();
  const { toast } = useToast();
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [playerState, setPlayerState] = useState<PlayerGameState | null>(null);
  const [poolState, setPoolState] = useState<GamePoolState | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitializingPool, setIsInitializingPool] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isAdvancingPhase, setIsAdvancingPhase] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [phaseEnded, setPhaseEnded] = useState(false);
  const [canAdvancePhase, setCanAdvancePhase] = useState(false);
  const [gameEvents, setGameEvents] = useState<UIGameEvent[]>([]);

  // ✅ Chaos Events State (cu typing corect)
  const [chaosEvents, setChaosEvents] = useState<ChaosEvent[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [upcomingEvents, setUpcomingEvents] = useState<ChaosEvent[]>([]);

  // Resource allocations (percentages, converted to amounts when submitting)
  const [allocations, setAllocations] = useState({
    mining: 20,
    farming: 20,
    trading: 20,
    research: 20,
    social: 20
  });

  // ✅ Generate chaos events when game is loaded
  useEffect(() => {
    if (!currentGame) return;

    console.log('🎮 Generating chaos events for game:', currentGame.gameId);
    // Use actual game start time from contract
    const gameStart = currentGame.phaseStartTime || new Date();
    const events = generateChaosEvents(gameStart, 18); // 18 minute phase
    setChaosEvents(events);

    console.log('✅ Generated chaos events:', events);
    events.forEach(e => {
      console.log(`  ${e.icon} ${e.title} at ${e.timestamp.toLocaleTimeString()}`);
    });
  }, [currentGame?.gameId]);

  // ✅ Update timer and filter upcoming events
  useEffect(() => {
    if (chaosEvents.length === 0) return;

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      // Get events that should be shown (within 2 minutes before event)
      const upcoming = getUpcomingEvents(chaosEvents, now);
      setUpcomingEvents(upcoming);

      // Debug log when events are upcoming
      if (upcoming.length > 0) {
        console.log('⚠️ Upcoming events to display:', upcoming.map(e => e.title));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [chaosEvents]);

  // ✅ Fetch and process game events from contract
  useEffect(() => {
    if (!currentGame?.gameId || !solanaGame.program) return;

    const fetchEvents = async () => {
      try {
        console.log('📊 Fetching game events from contract...');
        const events = await solanaGame.getGameEvents(currentGame.gameId);

        // Convert contract events to UI format
        const uiEvents: UIGameEvent[] = events
          .filter(event => event.phaseNumber === 1) // Only Phase 1 events
          .map((event, index) => {
            // Map event types to UI format
            const eventTypeMap = {
              'SeasonChange': { type: 'season' as const, icon: '🌾' },
              'MarketShift': { type: 'market' as const, icon: '📈' },
              'Breakthrough': { type: 'breakthrough' as const, icon: '🔬' },
              'WhaleEntry': { type: 'whale' as const, icon: '🐋' },
            };

            const poolColorMap = {
              'Mining': 'hsl(210, 100%, 50%)',
              'Farming': 'hsl(120, 80%, 40%)',
              'Trading': 'hsl(15, 100%, 50%)',
              'Research': 'hsl(280, 100%, 50%)',
              'Social': 'hsl(50, 100%, 50%)',
            };

            const eventInfo = eventTypeMap[event.eventType];
            const pool = event.poolAffected.toLowerCase();

            // Generate message based on event type
            let message = '';
            switch (event.eventType) {
              case 'SeasonChange':
                const seasons = ['Winter ❄️', 'Spring 🌸', 'Summer ☀️', 'Autumn 🍂'];
                const season = seasons[event.newValue! % 4];
                message = `Farming Season changed to ${season}!`;
                break;
              case 'MarketShift':
                const markets = ['Crashed 💥', 'Bear 🐻', 'Sideways ➡️', 'Bull 🐂'];
                const market = markets[event.newValue!];
                message = `Trading Market shifted to ${market}!`;
                break;
              case 'Breakthrough':
                message = `Research Pool Breakthrough! ${event.multiplier}x multiplier active`;
                break;
              case 'WhaleEntry':
                message = `Whale entered ${event.poolAffected} Pool! Bonus rewards incoming`;
                break;
            }

            return {
              id: `${event.timestamp.getTime()}-${index}`,
              type: eventInfo.type,
              pool,
              message,
              timestamp: event.timestamp,
              icon: eventInfo.icon,
              color: poolColorMap[event.poolAffected],
            };
          })
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

        console.log('✅ Processed UI events:', uiEvents);
        setGameEvents(uiEvents);
      } catch (error) {
        console.error('❌ Error fetching game events:', error);
      }
    };

    // Fetch immediately
    fetchEvents();

    // Refresh events every 30 seconds
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [currentGame?.gameId, solanaGame.program]);

  // Find the game the player is in
  useEffect(() => {
    // 👇 ADD: Only run this logic if we're on the Phase1 page
    if (!window.location.pathname.includes('/phase1')) {
      console.log('✅ Not on Phase1 page, skipping redirect logic');
      return;
    }

    if (!wallet.publicKey) {
      navigate('/lobby');
      return;
    }

    const playerAddress = wallet.publicKey.toBase58();

    // Try to get gameId from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdParam = urlParams.get('gameId');

    let activeGame: Game | undefined;

    if (gameIdParam) {
      // If gameId is in URL, find that specific game
      const targetGameId = parseInt(gameIdParam, 10);
      activeGame = solanaGame.games.find(
        g => g.gameId === targetGameId && g.gameStarted && g.currentPhase === 1 && g.players.includes(playerAddress)
      );
    } else {
      // Fallback: find first active game player is in
      activeGame = solanaGame.games.find(
        g => g.gameStarted && g.currentPhase === 1 && g.players.includes(playerAddress)
      );
    }

    if (activeGame) {
      setCurrentGame(activeGame);
    } else if (solanaGame.games.length > 0) {
      console.log('🏠 Player not in any Phase 1 game, redirecting to lobby...');
      navigate('/lobby');
    }
  }, [solanaGame.games, wallet.publicKey, navigate]);

  // Update countdown timer and check phase end
  useEffect(() => {
    if (!currentGame || !wallet.publicKey) return;

    const updateTimer = () => {
      const now = Date.now();
      const end = currentGame.phaseEndTime.getTime();
      const advanceDeadline = currentGame.phaseAdvanceDeadline.getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Faza s-a încheiat');
        setPhaseEnded(true);

        // Check if user can advance phase
        const isCreator = currentGame.creator === wallet.publicKey.toBase58();
        const timeoutPassed = now >= advanceDeadline;
        setCanAdvancePhase(isCreator || timeoutPassed);
      } else {
        setPhaseEnded(false);
        setCanAdvancePhase(false);

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [currentGame, wallet.publicKey]);

  // ✅ Fetch player state and pool state ONCE when game is found
  useEffect(() => {
    if (!currentGame || !wallet.publicKey) return;

    console.log('🎮 Current Game entry_fee:', currentGame.entryFee, 'SOL');
    console.log('🎮 Expected virtualBalance:', currentGame.entryFee * 10, 'SOL');

    let isMounted = true;

    const fetchStates = async () => {
      try {
        // Get player and pool state using separate PDAs - SINGLE REQUEST ONLY
        const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey);
        const poolData = await solanaGame.getPoolState(currentGame.gameId);

        if (!isMounted) return;

        // ✅ Normalize player state from lamports to SOL
        if (playerData) {
          console.log('🎮 Raw Player State (before normalization):', playerData);
          console.log('💰 Raw virtualBalance:', playerData.virtualBalance, 'lamports');

          // Normalize all values from lamports to SOL
          const normalizedPlayerState = {
            ...playerData,
            virtualBalance: playerData.virtualBalance / 1e9,
            totalEarned: playerData.totalEarned / 1e9,
            allocations: {
              mining: playerData.allocations.mining / 1e9,
              farming: playerData.allocations.farming / 1e9,
              trading: playerData.allocations.trading / 1e9,
              research: playerData.allocations.research / 1e9,
              social: playerData.allocations.social / 1e9,
            }
          };

          console.log('🎮 Normalized Player State:', normalizedPlayerState);
          console.log('💰 Normalized virtualBalance:', normalizedPlayerState.virtualBalance, 'SOL');

          setPlayerState(normalizedPlayerState);

          // Update allocations from player state if available
          console.log('🔍 Checking allocations restore:', {
            hasActiveAllocation: normalizedPlayerState.hasActiveAllocation,
            allocations: normalizedPlayerState.allocations
          });

          // Calculate total allocated amount (now in SOL)
          const total = normalizedPlayerState.allocations.mining + normalizedPlayerState.allocations.farming +
            normalizedPlayerState.allocations.trading + normalizedPlayerState.allocations.research +
            normalizedPlayerState.allocations.social;

          console.log('🔍 Total allocated SOL:', total);

          // Restore allocations if player has submitted any (total > 0)
          if (total > 0) {
            const restoredAllocations = {
              mining: Math.round((normalizedPlayerState.allocations.mining / total) * 100),
              farming: Math.round((normalizedPlayerState.allocations.farming / total) * 100),
              trading: Math.round((normalizedPlayerState.allocations.trading / total) * 100),
              research: Math.round((normalizedPlayerState.allocations.research / total) * 100),
              social: Math.round((normalizedPlayerState.allocations.social / total) * 100),
            };

            console.log('✅ Restoring allocations:', restoredAllocations);
            setAllocations(restoredAllocations);
          } else {
            console.log('⚠️ No allocations to restore (total = 0)');
          }
        } else {
          setPlayerState(null);
        }

        setPoolState(poolData || null);
        console.log('🏊 Fetched Pool State:', poolData);
      } catch (error) {
        console.error('Error fetching states:', error);
      }
    };

    fetchStates();

    return () => {
      isMounted = false;
    };
  }, [currentGame?.gameId, wallet.publicKey?.toBase58()]);

  // ✅ Periodic fetching every 15 seconds with normalization
  useEffect(() => {
    if (!currentGame?.gameId || !wallet.publicKey || !solanaGame.program) return;

    const intervalId = setInterval(async () => {
      try {
        console.log('💰 [15s Update] Fetching latest player and pool states from contract...');
        const [playerData, poolData] = await Promise.all([
          solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey),
          solanaGame.getPoolState(currentGame.gameId),
        ]);

        if (playerData) {
          // ✅ Normalize from lamports to SOL
          const normalizedPlayerState = {
            ...playerData,
            virtualBalance: playerData.virtualBalance / 1e9,
            totalEarned: playerData.totalEarned / 1e9,
            allocations: {
              mining: playerData.allocations.mining / 1e9,
              farming: playerData.allocations.farming / 1e9,
              trading: playerData.allocations.trading / 1e9,
              research: playerData.allocations.research / 1e9,
              social: playerData.allocations.social / 1e9,
            }
          };

          console.log('💰 [15s Update] Player data updated:', {
            virtualBalance: normalizedPlayerState.virtualBalance,
            lastClaimTime: normalizedPlayerState.lastClaimTime,
            hasActiveAllocation: normalizedPlayerState.hasActiveAllocation,
            allocations: normalizedPlayerState.allocations
          });

          setPlayerState(normalizedPlayerState);
        }

        setPoolState(poolData);
      } catch (error) {
        console.error('❌ Error during 15s update:', error);
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [currentGame?.gameId, wallet.publicKey?.toBase58(), solanaGame.program]);

  const handleAllocationChange = (pool: keyof typeof allocations, value: number[]) => {
    const newValue = value[0];
    console.log(`🎲 handleAllocationChange called: pool=${pool}, newValue=${newValue}, oldValue=${allocations[pool]}`);

    const oldValue = allocations[pool];
    const difference = newValue - oldValue;

    // Distribute the difference across other pools proportionally
    const otherPools = Object.keys(allocations).filter(k => k !== pool) as (keyof typeof allocations)[];
    const totalOther = otherPools.reduce((sum, key) => sum + allocations[key], 0);

    if (totalOther === 0) {
      // If all other pools are 0, can't redistribute
      setAllocations(prev => ({ ...prev, [pool]: newValue }));
      return;
    }

    const newAllocations = { ...allocations, [pool]: newValue };

    // Adjust other pools proportionally
    otherPools.forEach(otherPool => {
      const proportion = allocations[otherPool] / totalOther;
      const adjustment = difference * proportion;
      newAllocations[otherPool] = Math.max(0, allocations[otherPool] - adjustment);
    });

    // Normalize to ensure total is exactly 100
    const total = Object.values(newAllocations).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      Object.keys(newAllocations).forEach(key => {
        newAllocations[key as keyof typeof allocations] = (newAllocations[key as keyof typeof allocations] / total) * 100;
      });
    }

    console.log('🎲 New allocations after adjustment:', newAllocations);
    setAllocations(newAllocations);
  };

  const handleQuickAllocation = (pool: keyof typeof allocations, percentage: number) => {
    console.log(`⚡ handleQuickAllocation: pool=${pool}, percentage=${percentage}`);

    if (percentage === 0) {
      setAllocations(prev => ({ ...prev, [pool]: 0 }));
    } else if (percentage === 100) {
      setAllocations({
        mining: pool === 'mining' ? 100 : 0,
        farming: pool === 'farming' ? 100 : 0,
        trading: pool === 'trading' ? 100 : 0,
        research: pool === 'research' ? 100 : 0,
        social: pool === 'social' ? 100 : 0,
      });
    } else {
      setAllocations(prev => ({ ...prev, [pool]: percentage }));
    }
  };

  const handleSubmitAllocations = async () => {
    console.log('🎯 handleSubmitAllocations called');
    console.log('🎯 Current allocations state:', allocations);
    console.log('🎯 playerState:', playerState);
    console.log('🎯 currentGame:', currentGame);

    if (!currentGame || !playerState) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Player state not initialized",
      });
      return;
    }

    // Check that total allocation is 100%
    const total = Object.values(allocations).reduce((sum, val) => sum + val, 0);
    console.log('🎯 Total allocations:', total);
    if (Math.abs(total - 100) > 0.1) {
      toast({
        variant: "destructive",
        title: "Invalid Allocation",
        description: `Total must be 100%. Currently: ${total}%`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert percentages to amounts based on virtual balance (already in SOL)
      const balance = playerState.virtualBalance;
      const allocationAmounts = {
        mining: (balance * allocations.mining) / 100,
        farming: (balance * allocations.farming) / 100,
        trading: (balance * allocations.trading) / 100,
        research: (balance * allocations.research) / 100,
        social: (balance * allocations.social) / 100,
      };

      console.log('📤 Submitting allocation amounts (SOL):', allocationAmounts);

      await solanaGame.submitAllocations(currentGame.gameId, allocationAmounts);

      toast({
        title: "Allocations Submitted!",
        description: "Your resources have been allocated successfully",
      });

      // Refresh game to get updated player/pool states
      await solanaGame.refreshGames();

      // Manually refresh player state
      const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey!);
      if (playerData) {
        const normalizedPlayerState = {
          ...playerData,
          virtualBalance: playerData.virtualBalance / 1e9,
          totalEarned: playerData.totalEarned / 1e9,
          allocations: {
            mining: playerData.allocations.mining / 1e9,
            farming: playerData.allocations.farming / 1e9,
            trading: playerData.allocations.trading / 1e9,
            research: playerData.allocations.research / 1e9,
            social: playerData.allocations.social / 1e9,
          }
        };
        setPlayerState(normalizedPlayerState);
      }
    } catch (error: any) {
      console.error('Failed to submit allocations:', error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Could not submit allocations",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!currentGame) return;

    setIsClaiming(true);
    try {
      await solanaGame.claimRewards(currentGame.gameId);

      toast({
        title: "Rewards Claimed!",
        description: phaseEnded
          ? "Phase ended. Redirecting to Phase 2..."
          : "Your rewards have been claimed successfully!",
      });

      // Refresh states
      await solanaGame.refreshGames();

      // Manually refresh player state with normalization
      const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey!);
      if (playerData) {
        const normalizedPlayerState = {
          ...playerData,
          virtualBalance: playerData.virtualBalance / 1e9,
          totalEarned: playerData.totalEarned / 1e9,
          allocations: {
            mining: playerData.allocations.mining / 1e9,
            farming: playerData.allocations.farming / 1e9,
            trading: playerData.allocations.trading / 1e9,
            research: playerData.allocations.research / 1e9,
            social: playerData.allocations.social / 1e9,
          }
        };
        setPlayerState(normalizedPlayerState);
      }

      // Only navigate to Phase 2 if phase has ended
      if (phaseEnded) {
        setTimeout(() => {
          navigate(`/phase2?gameId=${currentGame.gameId}`);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Failed to claim rewards:', error);
      toast({
        variant: "destructive",
        title: "Claim Failed",
        description: error.message || "Could not claim rewards",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleAdvancePhase = async () => {
    if (!currentGame) return;

    setIsAdvancingPhase(true);
    try {
      await solanaGame.advancePhase(currentGame.gameId, (progress) => {
        console.log('Phase advance progress:', progress);
        toast({
          title: progress.step,
          description: `Progress: ${progress.progress}%`,
        });
      });

      toast({
        title: "Phase Advanced!",
        description: "Game moved to Phase 2. Your rewards have been claimed. Other players need to claim their rewards before entering Phase 2.",
      });

      // Refresh game to get updated states
      await solanaGame.refreshGames();

      // Refresh player state with normalization
      const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey!);
      if (playerData) {
        const normalizedPlayerState = {
          ...playerData,
          virtualBalance: playerData.virtualBalance / 1e9,
          totalEarned: playerData.totalEarned / 1e9,
          allocations: {
            mining: playerData.allocations.mining / 1e9,
            farming: playerData.allocations.farming / 1e9,
            trading: playerData.allocations.trading / 1e9,
            research: playerData.allocations.research / 1e9,
            social: playerData.allocations.social / 1e9,
          }
        };
        setPlayerState(normalizedPlayerState);
      }

      // Navigate to Phase 2 after a short delay
      setTimeout(() => {
        navigate(`/phase2?gameId=${currentGame.gameId}`);
      }, 2000);
    } catch (error: any) {
      console.error('Failed to advance phase:', error);
      toast({
        variant: "destructive",
        title: "Advance Failed",
        description: error.message || "Could not advance to next phase",
      });
    } finally {
      setIsAdvancingPhase(false);
    }
  };

  // ✅ Calculate pending rewards using SOL values (already normalized)
  const [pendingRewardsData, setPendingRewardsData] = useState({
    total: 0,
    byPool: { mining: 0, farming: 0, trading: 0, research: 0, social: 0 }
  });

  // Update pending rewards every second using EXACT contract logic
  useEffect(() => {
    if (!playerState || !playerState.hasActiveAllocation || !currentGame || !poolState) {
      setPendingRewardsData({
        total: 0,
        byPool: { mining: 0, farming: 0, trading: 0, research: 0, social: 0 }
      });
      return;
    }

    const calculateRewards = () => {
      const now = Date.now();
      const phaseEndTime = currentGame.phaseEndTime.getTime();
      const lastClaim = playerState.lastClaimTime.getTime();

      // Stop accruing rewards after phase ends
      const effectiveNow = Math.min(now, phaseEndTime);
      const elapsedSeconds = Math.max(0, (effectiveNow - lastClaim) / 1000);
      const elapsedHours = elapsedSeconds / 3600.0;

      const byPool = {
        mining: 0,
        farming: 0,
        trading: 0,
        research: 0,
        social: 0,
      };

      // ✅ All allocations are already in SOL now!
      // Mining: 700% per hour (base_rate 7.0)
      if (playerState.allocations.mining > 0) {
        const baseRate = 7.0;
        const difficultyFactor = 1.0 - Math.min(poolState.miningPoolTotal / 10000.0, 0.5);
        const miningRate = baseRate * difficultyFactor;
        byPool.mining = playerState.allocations.mining * miningRate * elapsedHours;
      }

      // Farming: 1000-3000% per hour (depends on season)
      if (playerState.allocations.farming > 0) {
        const seasonMultiplier = (() => {
          switch (poolState.farmingSeason % 4) {
            case 0: return 30.0;  // Summer
            case 1: return 20.0;  // Autumn
            case 2: return 10.0;  // Winter
            default: return 24.0; // Spring
          }
        })();
        const farmingRate = 10.0 * seasonMultiplier;
        byPool.farming = playerState.allocations.farming * farmingRate * elapsedHours;
      }

      // Trading: -6000% to +10000% per hour (can be negative!)
      if (playerState.allocations.trading > 0) {
        const marketMultiplier = (() => {
          switch (poolState.tradingMarketState) {
            case 0: return -60.0; // Bear
            case 1: return 20.0;  // Sideways
            case 2: return 100.0; // Bull
            default: return 0.0;  // Crashed
          }
        })();
        const tradingResult = playerState.allocations.trading * marketMultiplier * elapsedHours;
        if (tradingResult > 0) {
          byPool.trading = tradingResult;
        } else {
          byPool.trading = 0; // Don't show negative for UI display
        }
      }

      // Research: Lottery (0 for now, requires VRF)
      byPool.research = 0;

      // Social: 400% base per hour
      if (playerState.allocations.social > 0) {
        const baseRate = 4.0;
        const collaborationMultiplier = 1.0 + Math.min(poolState.socialPoolParticipants * 0.1, 2.0);
        const socialRate = baseRate * collaborationMultiplier;
        byPool.social = playerState.allocations.social * socialRate * elapsedHours;
      }

      const total = Object.values(byPool).reduce((sum, val) => sum + val, 0);

      console.log('💰 [Pending Rewards] Calculated:', {
        elapsedSeconds: elapsedSeconds.toFixed(0),
        elapsedHours: elapsedHours.toFixed(4),
        total: total.toFixed(4) + ' SOL',
        byPool: {
          mining: byPool.mining.toFixed(4),
          farming: byPool.farming.toFixed(4),
          trading: byPool.trading.toFixed(4),
          research: byPool.research.toFixed(4),
          social: byPool.social.toFixed(4),
        },
        poolState: {
          farmingSeason: poolState.farmingSeason,
          tradingMarketState: poolState.tradingMarketState,
          socialPoolParticipants: poolState.socialPoolParticipants,
        }
      });

      setPendingRewardsData({ total, byPool });
    };

    // Calculate immediately
    calculateRewards();

    // Update every second for smooth counter
    const interval = setInterval(calculateRewards, 1000);
    return () => clearInterval(interval);
  }, [playerState, currentGame, poolState]);

  if (!currentGame) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  // ✅ Calculate virtualBalance as entry_fee * 10
  const virtualBalance = playerState?.virtualBalance || (currentGame.entryFee * 10);

  // Resource pool definitions (after null check)
  const resourcePools = [
    {
      key: 'mining' as const,
      name: 'Mining',
      icon: Pickaxe,
      emoji: '⛏️',
      description: 'Steady, predictable returns with low volatility',
      yieldRange: '3-5%',
      volatility: 'Low',
      riskLevel: 'low' as const,
      currentAPR: '4.2%',
      participants: poolState?.miningPoolTotal || 0,
      color: 'hsl(210, 100%, 50%)',
      bgGradient: 'from-blue-500/20 to-blue-600/10',
      borderColor: 'border-blue-500/30',
      entryFee: currentGame.entryFee,
    },
    {
      key: 'farming' as const,
      name: 'Farming',
      icon: Sprout,
      emoji: '🌾',
      description: 'Seasonal returns with moderate growth potential',
      yieldRange: '4-8%',
      volatility: 'Medium',
      riskLevel: 'medium' as const,
      currentAPR: '6.5%',
      participants: poolState?.farmingPoolTotal || 0,
      color: 'hsl(120, 80%, 40%)',
      bgGradient: 'from-green-500/20 to-green-600/10',
      borderColor: 'border-green-500/30',
      entryFee: currentGame.entryFee,
      specialCondition: poolState ? `Season ${poolState.farmingSeason}` : undefined,
    },
    {
      key: 'trading' as const,
      name: 'Trading',
      icon: TrendingUp,
      emoji: '📈',
      description: 'High risk, high reward with market volatility',
      yieldRange: '2-15%',
      volatility: 'High',
      riskLevel: 'high' as const,
      currentAPR: '12.8%',
      participants: poolState?.tradingPoolTotal || 0,
      color: 'hsl(15, 100%, 50%)',
      bgGradient: 'from-orange-500/20 to-red-600/10',
      borderColor: 'border-orange-500/30',
      entryFee: currentGame.entryFee,
      specialCondition: poolState?.tradingMarketState === 1 ? 'Bull Market 🐂' : undefined,
    },
    {
      key: 'research' as const,
      name: 'Research',
      icon: FlaskConical,
      emoji: '🔬',
      description: 'Breakthrough potential with multiplier events',
      yieldRange: '0-20%',
      volatility: 'Very High',
      riskLevel: 'extreme' as const,
      currentAPR: '8.9%',
      participants: poolState?.researchPoolTotal || 0,
      color: 'hsl(280, 100%, 50%)',
      bgGradient: 'from-purple-500/20 to-pink-600/10',
      borderColor: 'border-purple-500/30',
      entryFee: currentGame.entryFee,
    },
    {
      key: 'social' as const,
      name: 'Social',
      icon: Users,
      emoji: '👥',
      description: 'Cooperative pool with shared rewards',
      yieldRange: '5-7%',
      volatility: 'Low',
      riskLevel: 'medium' as const,
      currentAPR: '5.8%',
      participants: poolState?.socialPoolParticipants || 0,
      color: 'hsl(50, 100%, 50%)',
      bgGradient: 'from-yellow-500/20 to-yellow-600/10',
      borderColor: 'border-yellow-500/30',
      entryFee: currentGame.entryFee,
      specialCondition: poolState && poolState.socialPoolParticipants >= 5 ? 'Whale Bonus 🐋' : undefined,
    },
  ];

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);

  // Format allocation data for AllocationBar
  const allocationData = resourcePools.map(pool => ({
    key: pool.key,
    name: pool.name,
    emoji: pool.emoji,
    color: pool.color,
    allocation: allocations[pool.key],
    amount: (virtualBalance * allocations[pool.key]) / 100,
  }));

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Navbar />

      {/* ✅ Chaos Events News Bar - folosește upcomingEvents (nu upcoming) */}
      <EventsNewsBar
        upcomingEvents={upcomingEvents}
        currentTime={currentTime}
      />

      <main className="relative pb-16 px-4" style={{ zIndex: 10, paddingTop: '6rem' }}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/lobby')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Lobby
            </Button>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  Phase 1: Resource Gathering
                </h1>
                <p className="text-muted-foreground">
                  Game #{currentGame.gameId} • {currentGame.name}
                </p>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Remaining time</p>
                  <p className="text-lg font-bold">{timeRemaining}</p>
                </div>
              </div>
            </div>
          </div>

          {/* State Initialization Check */}
          {!poolState && currentGame.gameStarted && (
            <Alert className="mb-8 border-yellow-500/50 bg-yellow-500/10">
              <Loader2 className="h-5 w-5 animate-spin" />
              <AlertTitle>Pool State Not Initialized</AlertTitle>
              <AlertDescription className="flex flex-col gap-4 mt-2">
                <p>
                  The resource pool state needs to be initialized before players can participate.
                </p>

                {wallet.publicKey?.toBase58() === currentGame.creator ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">You are the game creator. Click below to initialize the pool state:</p>
                    <Button
                      onClick={async () => {
                        setIsInitializingPool(true);
                        try {
                          await solanaGame.initializePoolState(currentGame.gameId);
                          toast({
                            title: "Pool Initialized!",
                            description: "Resource pool state has been initialized. Players can now initialize their states.",
                          });
                          const poolData = await solanaGame.getPoolState(currentGame.gameId);
                          setPoolState(poolData);
                        } catch (error: any) {
                          console.error('Failed to initialize pool:', error);
                          toast({
                            variant: "destructive",
                            title: "Pool Initialization Failed",
                            description: error.message || "Could not initialize pool state",
                          });
                        } finally {
                          setIsInitializingPool(false);
                        }
                      }}
                      disabled={isInitializingPool}
                      className="w-fit"
                    >
                      {isInitializingPool && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isInitializingPool ? 'Initializing Pool...' : 'Initialize Pool State'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">
                    Please wait for the game creator to initialize the resource pool state first.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Player State Initialization - Only show if pool is initialized */}
          {poolState && !playerState && currentGame.gameStarted && (
            <Alert className="mb-8 border-blue-500/50 bg-blue-500/10">
              <Loader2 className="h-5 w-5 animate-spin" />
              <AlertTitle>Your Game State Not Initialized</AlertTitle>
              <AlertDescription className="flex flex-col gap-4 mt-2">
                <p>
                  You need to initialize your player state to participate in this game.
                  Your initial balance will be: <strong>{(currentGame.entryFee * 10).toFixed(4)} SOL</strong>
                </p>

                <Button
                  onClick={async () => {
                    setIsInitializing(true);
                    try {
                      console.log('🎮 Initializing player state for game:', currentGame.gameId);
                      console.log('💰 Entry fee from game:', currentGame.entryFee, 'SOL');
                      console.log('💰 Expected virtualBalance:', currentGame.entryFee * 10, 'SOL');

                      await solanaGame.initializePlayerState(currentGame.gameId);
                      toast({
                        title: "Player State Initialized!",
                        description: "You can now allocate resources and play the game.",
                      });

                      const playerData = await solanaGame.getPlayerState(currentGame.gameId, wallet.publicKey);
                      if (playerData) {
                        const normalizedPlayerState = {
                          ...playerData,
                          virtualBalance: playerData.virtualBalance / 1e9,
                          totalEarned: playerData.totalEarned / 1e9,
                          allocations: {
                            mining: playerData.allocations.mining / 1e9,
                            farming: playerData.allocations.farming / 1e9,
                            trading: playerData.allocations.trading / 1e9,
                            research: playerData.allocations.research / 1e9,
                            social: playerData.allocations.social / 1e9,
                          }
                        };
                        console.log('✅ Player state after init:', normalizedPlayerState);
                        setPlayerState(normalizedPlayerState);
                      }
                    } catch (error: any) {
                      console.error('Failed to initialize player state:', error);
                      toast({
                        variant: "destructive",
                        title: "Initialization Failed",
                        description: error.message || "Could not initialize your player state",
                      });
                    } finally {
                      setIsInitializing(false);
                    }
                  }}
                  disabled={isInitializing}
                  className="w-fit"
                >
                  {isInitializing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isInitializing ? 'Initializing...' : 'Initialize My Game State'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Phase Ended Alert */}
          {phaseEnded && (
            <Alert className="mb-8 border-primary/50 bg-primary/10">
              <Clock className="h-5 w-5" />
              <AlertTitle>Faza 1 s-a încheiat!</AlertTitle>
              <AlertDescription className="flex flex-col gap-4 mt-2">
                <p>
                  Timpul de gathering a expirat. {canAdvancePhase
                    ? "Poți avansa jocul la următoarea fază. După ce avansezi, fiecare jucător va trebui să își claim-uiască propriile recompense pentru a intra în Phase 2."
                    : "Așteaptă ca creatorul să avanseze jocul la următoarea fază, apoi claim-uiește-ți recompensele pentru a continua."}
                </p>

                <div className="flex flex-wrap gap-3">
                  {canAdvancePhase ? (
                    <Button
                      onClick={handleAdvancePhase}
                      disabled={isAdvancingPhase}
                      variant="default"
                    >
                      {isAdvancingPhase && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Advance to Phase 2
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleClaimRewards}
                      disabled={isClaiming || pendingRewardsData.total === 0}
                      variant="default"
                    >
                      {isClaiming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Claim Rewards & Enter Phase 2
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>

                {!canAdvancePhase && currentGame.creator !== wallet.publicKey?.toBase58() && (
                  <p className="text-sm text-muted-foreground">
                    Doar creatorul poate avansa jocul în următoarele 10 minute. După aceea, orice jucător poate avansa faza.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Events Ticker */}
          {console.log('🎬 Current gameEvents:', gameEvents)}
          <EventsTicker events={gameEvents} />

          {/* Rewards Panel and Allocation Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <RewardsPanel
              poolRewards={[
                { pool: 'Mining', emoji: '⛏️', amount: pendingRewardsData.byPool.mining, color: 'hsl(210, 100%, 50%)' },
                { pool: 'Farming', emoji: '🌾', amount: pendingRewardsData.byPool.farming, color: 'hsl(120, 80%, 40%)' },
                { pool: 'Trading', emoji: '📈', amount: pendingRewardsData.byPool.trading, color: 'hsl(15, 100%, 50%)' },
                { pool: 'Research', emoji: '🔬', amount: pendingRewardsData.byPool.research, color: 'hsl(280, 100%, 50%)' },
                { pool: 'Social', emoji: '👥', amount: pendingRewardsData.byPool.social, color: 'hsl(50, 100%, 50%)' },
              ]}
              totalPending={pendingRewardsData.total}
              onClaimRewards={handleClaimRewards}
              isClaiming={isClaiming}
              phaseEnded={phaseEnded}
            />
            <AllocationBar
              pools={allocationData}
              totalBalance={virtualBalance}
            />
          </div>

          {/* Resource Pools */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {resourcePools.map((pool) => (
              <PoolCard
                key={pool.key}
                name={pool.name}
                icon={pool.icon}
                emoji={pool.emoji}
                description={pool.description}
                yieldRange={pool.yieldRange}
                volatility={pool.volatility}
                riskLevel={pool.riskLevel}
                currentAPR={pool.currentAPR}
                participants={pool.participants}
                allocation={allocations[pool.key]}
                color={pool.color}
                bgGradient={pool.bgGradient}
                borderColor={pool.borderColor}
                entryFee={pool.entryFee}
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
              onClick={handleSubmitAllocations}
              disabled={!playerState || !poolState || isSubmitting || Math.abs(totalAllocated - 100) > 0.1}
              className="min-w-[200px]"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {!poolState
                ? 'Initialize Pool State First'
                : totalAllocated !== 100
                  ? `Total: ${totalAllocated.toFixed(1)}% (Need 100%)`
                  : 'Confirm Allocation'}
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}