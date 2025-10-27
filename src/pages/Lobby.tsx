import { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Clock, Trophy, TrendingUp, Play, UserPlus, Eye, Crown, Zap, Calendar, Timer, Plus, RefreshCw, AlertCircle, XCircle, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Coins, Award, Medal } from 'lucide-react';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FirstTimeTutorial from "../components/FirstTimeTutorial";
import CountdownTimer from "../components/CountdownTimer";
import { useSolanaGame } from "../hooks/useSolanaGame";
import type { Game } from "../hooks/useSolanaGame";
import WalletConnectModal from "../components/WalletConnectModal";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";

// Button Component (inline)
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'sol' | 'sol-outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

// Helper to normalize status
const normalizeStatus = (status: any): string => {
  if (typeof status === 'string') return status;
  if (typeof status === 'object' && status !== null) {
    const keys = Object.keys(status);
    if (keys.length > 0) {
      const key = keys[0];
      return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim().replace(/ /g, '');
    }
  }
  return 'Unknown';
};

// Status priority for sorting
const getStatusPriority = (status: string): number => {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case 'WaitingForPlayers':
    case 'Waitingforplayers': return 1;
    case 'InProgress':
    case 'Inprogress': return 2;
    case 'Expired': return 3;
    case 'Cancelled': return 4;
    case 'Expiredwithpenalty':
    case 'ExpiredWithPenalty': return 5;
    case 'Completed': return 6;
    default: return 7;
  }
};

function Button({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, style = {} }: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 focus:ring-secondary",
    outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground focus:ring-accent",
    ghost: "hover:bg-accent hover:text-accent-foreground focus:ring-accent",
    sol: "bg-gradient-to-r from-sol-purple to-sol-orange text-white hover:from-sol-purple-glow hover:to-sol-orange-glow shadow-lg hover:shadow-xl focus:ring-sol-orange transform hover:scale-105",
    'sol-outline': "border-2 border-sol-orange text-sol-orange bg-transparent hover:bg-sol-orange hover:text-white focus:ring-sol-orange"
  };

  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 py-2",
    lg: "h-12 px-6 py-3 text-lg"
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

// Card Component (inline)
interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function Card({ children, className = '', style = {} }: CardProps) {
  return (
    <div
      className={`rounded-xl backdrop-blur-sm border transition-all duration-200 hover:transform hover:scale-[1.02] ${className}`}
      style={{
        background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.1), hsla(15, 100%, 50%, 0.05))',
        borderColor: 'hsla(280, 100%, 35%, 0.3)',
        boxShadow: '0 8px 25px hsla(280, 100%, 35%, 0.15)',
        ...style
      }}
    >
      {children}
    </div>
  );
}

export default function Lobby() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const solanaGame = useSolanaGame();
  const { toast } = useToast();
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGameDetailsModal, setShowGameDetailsModal] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [pendingGameId, setPendingGameId] = useState<number | null>(null);
  const [createGameParams, setCreateGameParams] = useState({
    gameName: '',
    entryFee: 1,
    maxPlayers: 10,
    startTime: new Date(Date.now() + 30 * 60 * 1000),
    gameDurationHours: 2,
  });

  // Filtering and sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [showYourGames, setShowYourGames] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'entryFee' | 'players' | 'startTime' | 'prizePool' | 'status'>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate player statistics from completed games
  const playerStats = (() => {
    const stats = new Map<string, { wins: number; earnings: number; gamesPlayed: number }>();

    solanaGame.games.forEach(game => {
      const gamePlayers: string[] = [];

      if (game.players && game.players.length > 0) {
        if (typeof game.players[0] === 'string') {
          gamePlayers.push(...game.players);
        } else if (game.players[0].player) {
          gamePlayers.push(...game.players.map((p: any) =>
            typeof p.player === 'string' ? p.player : p.player.toString()
          ));
        }
      }

      gamePlayers.forEach(playerAddress => {
        if (!stats.has(playerAddress)) {
          stats.set(playerAddress, { wins: 0, earnings: 0, gamesPlayed: 0 });
        }
        const playerStat = stats.get(playerAddress)!;
        playerStat.gamesPlayed += 1;

        const normalized = normalizeStatus(game.status);
        const isWinner = game.phase3Winner === playerAddress;
        const prizeClaimed = game.phase3PrizeClaimed === true;

        if (normalized === 'Completed' && isWinner && prizeClaimed) {
          playerStat.wins += 1;

          // ✅ CALCULATE PRIZE POOL: (players × entry fee) - 1% platform fee
          const calculatedPrizePool = game.currentPlayers * game.entryFee * 0.99;
          playerStat.earnings += calculatedPrizePool;

          console.log(`[Lobby Stats] ✅ Added ${calculatedPrizePool.toFixed(4)} SOL (${game.currentPlayers} players × ${game.entryFee} SOL) to ${playerAddress.slice(0, 8)}`);
        } else if (normalized === 'Completed' && isWinner && !prizeClaimed) {
          playerStat.wins += 1;
          console.log(`[Lobby Stats] ⏳ Prize not yet claimed for ${playerAddress.slice(0, 8)}`);
        }
      });
    });

    return stats;
  })();

  // Your personal stats
  const yourStats = (() => {
    const userAddress = wallet.publicKey?.toBase58();
    if (!userAddress) return { wins: 0, earnings: 0, gamesPlayed: 0, rank: 0 };

    const stats = playerStats.get(userAddress);
    if (!stats) return { wins: 0, earnings: 0, gamesPlayed: 0, rank: 0 };

    // Calculate rank based on WINS
    const sortedPlayers = Array.from(playerStats.entries())
      .map(([player, stats]) => ({ player, ...stats }))
      .sort((a, b) => {
        // Sort by wins first, then by earnings as tiebreaker
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.earnings - a.earnings;
      });

    const rank = sortedPlayers.findIndex(p => p.player === userAddress) + 1;

    return {
      wins: stats.wins,
      earnings: stats.earnings,
      gamesPlayed: stats.gamesPlayed,
      rank: rank > 0 ? rank : sortedPlayers.length + 1
    };
  })();

  // Check if user has ever played any game
  const hasUserEverPlayed = (): boolean => {
    if (!wallet.publicKey) return false;

    const userAddress = wallet.publicKey.toBase58();

    // Check if user appears as a player in ANY game
    return solanaGame.games.some(game =>
      game.players.includes(userAddress)
    );
  };

  // Filter and sort games
  const filteredAndSortedGames = solanaGame.games
    .filter(game => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = game.name.toLowerCase().includes(query);
        const matchesCreator = game.creator.toLowerCase().includes(query);
        const matchesTx = game.txSignature?.toLowerCase().includes(query);
        if (!matchesName && !matchesCreator && !matchesTx) return false;
      }

      if (showYourGames && wallet.publicKey) {
        const userAddress = wallet.publicKey.toBase58();
        const isCreator = game.creator === userAddress;
        const isPlayer = game.players.includes(userAddress);
        if (!isCreator && !isPlayer) return false;
      }

      if (statusFilter !== 'all') {
        const normalized = normalizeStatus(game.status);
        if (statusFilter === 'active') {
          if (normalized !== 'WaitingForPlayers' && normalized !== 'InProgress') return false;
        } else if (statusFilter === 'completed') {
          if (normalized !== 'Completed') return false;
        } else if (statusFilter === 'cancelled') {
          if (normalized !== 'Cancelled' && normalized !== 'Expired' && normalized !== 'ExpiredWithPenalty') return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'status':
          comparison = getStatusPriority(a.status) - getStatusPriority(b.status);
          break;
        case 'entryFee':
          comparison = b.entryFee - a.entryFee;
          break;
        case 'players':
          comparison = b.currentPlayers - a.currentPlayers;
          break;
        case 'prizePool':
          comparison = b.prizePool - a.prizePool;
          break;
        case 'startTime':
          comparison = a.startTime.getTime() - b.startTime.getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Fetch Solana price
  const [solPrice, setSolPrice] = useState<number>(0);

  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        setSolPrice(data.solana.usd);
      } catch (error) {
        console.error('Failed to fetch SOL price:', error);
        setSolPrice(0);
      }
    };
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const performAutoRefresh = async () => {
      console.log('🔄 Auto-refresh triggered at', new Date().toLocaleTimeString());
      try {
        await solanaGame.fetchGames();
        setLastAutoRefresh(new Date());
        console.log('✅ Auto-refresh completed successfully');
      } catch (error) {
        console.error('❌ Auto-refresh failed:', error);
      }
    };

    autoRefreshIntervalRef.current = setInterval(performAutoRefresh, 40000);

    return () => {
      if (autoRefreshIntervalRef.current) {
        console.log('🧹 Cleaning up auto-refresh interval');
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [solanaGame.fetchGames]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (autoRefreshIntervalRef.current) {
          console.log('⏸️ Pausing auto-refresh (tab hidden)');
          clearInterval(autoRefreshIntervalRef.current);
          autoRefreshIntervalRef.current = null;
        }
      } else {
        console.log('▶️ Resuming auto-refresh (tab visible)');
        autoRefreshIntervalRef.current = setInterval(async () => {
          try {
            await solanaGame.fetchGames();
            setLastAutoRefresh(new Date());
          } catch (error) {
            console.error('❌ Auto-refresh failed:', error);
          }
        }, 40000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [solanaGame.fetchGames]);

  // Statistici calculate din jocurile reale
  const stats = {
    totalGames: solanaGame.games.length,
    activeGames: solanaGame.games.filter(g => {
      const normalized = normalizeStatus(g.status);
      return normalized === 'WaitingForPlayers' || normalized === 'InProgress';
    }).length,
    totalPlayers: new Set(solanaGame.games.flatMap(game => game.players)).size,
    totalPrizePool: solanaGame.games.reduce((acc, game) => acc + game.prizePool, 0),
    totalPrizePoolUSD: solanaGame.games.reduce((acc, game) => acc + game.prizePool, 0) * solPrice,
    yourWins: yourStats.wins,
    yourEarnings: yourStats.earnings
  };

  // Leaderboard data: top 4 players by WINS (not earnings)
  const leaderboardData = Array.from(playerStats.entries())
    .map(([player, stats]) => ({ player, ...stats }))
    .sort((a, b) => {
      // 1. Sort by wins first (descending)
      if (b.wins !== a.wins) return b.wins - a.wins;

      // 2. Tiebreaker: games played (descending)
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;

      // 3. Final tiebreaker: publicKey alphabetically (ascending)
      return a.player.localeCompare(b.player);
    })
    .slice(0, 4);

  const getStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'WaitingForPlayers':
      case 'Waitingforplayers': return 'text-yellow-400';
      case 'ReadyToStart': return 'text-green-400';
      case 'InProgress':
      case 'Inprogress': return 'text-sol-orange';
      case 'Completed': return 'text-green-400';
      case 'Cancelled': return 'text-red-400';
      case 'Expired': return 'text-orange-400';
      case 'Expiredwithpenalty':
      case 'ExpiredWithPenalty': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'WaitingForPlayers':
      case 'Waitingforplayers': return <Clock className="w-4 h-4" />;
      case 'ReadyToStart': return <Crown className="w-4 h-4" />;
      case 'InProgress':
      case 'Inprogress': return <Play className="w-4 h-4" />;
      case 'Completed': return <Trophy className="w-4 h-4" />;
      case 'Cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const handleJoinGame = async (game: any) => {
    setSelectedGame(game);
    setShowGameDetailsModal(true);
  };

  // Function to perform the actual game join
  const performGameJoin = async (gameId: number) => {
    try {
      console.log('🚀 Calling solanaGame.enterGame with gameId:', gameId);
      const result = await solanaGame.enterGame(gameId);

      if (result === 'already_processed') {
        console.log('🎉 Join was already successful!');
        toast({
          title: "Already Joined",
          description: "You've already entered this game successfully!",
        });
      } else {
        console.log('✅ Successfully joined game!');
        toast({
          title: "Game Joined!",
          description: "You've successfully entered the battle!",
        });
      }

      // Refresh games and close modal
      await solanaGame.fetchGames();
      setShowGameDetailsModal(false);
      setSelectedGame(null);
    } catch (error: any) {
      console.error('❌ Failed to join game:', error);
      if (!error.message?.includes('already been processed')) {
        toast({
          variant: "destructive",
          title: "Failed to join game",
          description: error.message || "Unknown error",
        });
      }
    }
  };

  const handleConfirmJoinGame = async () => {
    console.log('🎮 Enter the Game button clicked!');
    if (!selectedGame || !wallet.connected) {
      console.error('❌ Missing requirements');
      return;
    }

    // ✅ CHECK: Has user ever played before?
    if (!hasUserEverPlayed()) {
      console.log('🎓 First time player detected! Showing tutorial...');
      setPendingGameId(selectedGame.gameId);
      setShowTutorial(true);
      setShowGameDetailsModal(false); // Close game details modal
      return; // Don't join yet, wait for tutorial completion
    }

    // If user has played before, join directly
    await performGameJoin(selectedGame.gameId);
  };

  // Handler for when tutorial completes
  const handleTutorialComplete = async () => {
    console.log('✅ Tutorial completed! Proceeding to join game...');
    setShowTutorial(false);

    if (pendingGameId !== null) {
      await performGameJoin(pendingGameId);
      setPendingGameId(null);
    }
  };

  const handleStartGame = async () => {
    if (!selectedGame || !wallet.connected) return;

    try {
      console.log('🚀 Starting game:', selectedGame.gameId);
      const result = await solanaGame.startGame(selectedGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Game started successfully!');
        toast({
          title: "Game Started",
          description: "Players can now initialize their game states in Phase 1",
        });
        await solanaGame.fetchGames();
        setShowGameDetailsModal(false);
        setSelectedGame(null);
      }
    } catch (error: any) {
      console.error('❌ Failed to start game:', error);
      if (!error.message?.includes('already been processed')) {
        toast({
          variant: "destructive",
          title: "Failed to start game",
          description: error.message || "Unknown error",
        });
      }
    }
  };

  const handleClaimRefund = async () => {
    if (!selectedGame || !wallet.connected) return;

    try {
      console.log('💰 Claiming refund for game:', selectedGame.gameId);
      const result = await solanaGame.claimRefund(selectedGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Refund claimed successfully!');
        toast({
          title: "Refund Claimed!",
          description: `You've claimed ${selectedGame.entryFee.toFixed(2)} SOL!`,
        });
        await solanaGame.fetchGames();
        setShowGameDetailsModal(false);
        setSelectedGame(null);
      }
    } catch (error: any) {
      console.error('❌ Failed to claim refund:', error);
      if (!error.message?.includes('already been processed')) {
        toast({
          variant: "destructive",
          title: "Failed to claim refund",
          description: error.message || "Unknown error",
        });
      }
    }
  };

  // ✅ NOUĂ FUNCȚIE - Force Refund
  const handleForceRefund = async () => {
    if (!selectedGame || !wallet.connected) return;

    try {
      console.log('💰 Forcing refund for game:', selectedGame.gameId);
      const result = await solanaGame.forceRefundExpiredGame(selectedGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Force refund successful!');
        toast({
          title: "Refund Claimed!",
          description: `You've claimed ${selectedGame.entryFee.toFixed(2)} SOL! Creator failed to fulfill obligations.`,
        });
        await solanaGame.fetchGames();
        setShowGameDetailsModal(false);
        setSelectedGame(null);
      }
    } catch (error: any) {
      console.error('❌ Failed to force refund:', error);
      if (!error.message?.includes('already been processed')) {
        toast({
          variant: "destructive",
          title: "Failed to claim refund",
          description: error.message || "Unknown error",
        });
      }
    }
  };

  const handleClaimPrize = async (game?: Game) => {
    if (isClaiming) {
      console.log('⏸️ Already claiming, please wait...');
      return;
    }

    const targetGame = game || selectedGame;

    console.log('💰 ============ HANDLE CLAIM PRIZE START ============');
    console.log('💰 targetGame:', targetGame);
    console.log('💰 wallet.connected:', wallet.connected);
    console.log('💰 phase3PrizeClaimed BEFORE:', targetGame?.phase3PrizeClaimed);

    if (!targetGame || !wallet.connected) {
      console.error('❌ Early return - missing requirements');
      toast({
        variant: "destructive",
        title: "Cannot claim prize",
        description: "Wallet not connected or game not selected",
      });
      return;
    }

    setIsClaiming(true);

    try {
      console.log('🏆 Claiming prize for game:', targetGame.gameId);
      const result = await solanaGame.claimPhase3Prize(targetGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Prize claimed successfully!');
        toast({
          title: "Prize Claimed!",
          description: `You've claimed ${(targetGame.prizePool * 0.99).toFixed(4)} SOL!`,
        });

        // ✅ CRITICAL: Aggressive refresh loop to ensure phase3PrizeClaimed updates
        console.log('🔄 Starting aggressive refresh loop...');
        let refreshCount = 0;
        const maxRefreshes = 10;
        let prizeClaimed = false;

        while (refreshCount < maxRefreshes && !prizeClaimed) {
          refreshCount++;
          console.log(`🔄 Refresh attempt ${refreshCount}/${maxRefreshes}...`);

          await solanaGame.fetchGames();

          // Check if phase3PrizeClaimed is now true
          const updatedGame = solanaGame.games.find(g => g.gameId === targetGame.gameId);
          console.log(`💰 phase3PrizeClaimed after refresh ${refreshCount}:`, updatedGame?.phase3PrizeClaimed);

          if (updatedGame?.phase3PrizeClaimed) {
            prizeClaimed = true;
            console.log('✅ Prize claim confirmed on blockchain!');
            break;
          }

          // Wait 1 second between refreshes
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!prizeClaimed) {
          console.warn('⚠️ phase3PrizeClaimed not updated after 10 attempts, but claim was successful');
          toast({
            title: "Note",
            description: "Prize claimed successfully! Stats may take a moment to update.",
          });
        } else {
          toast({
            title: "Stats Updated!",
            description: "Your earnings have been updated successfully!",
          });
        }

        // Close modal
        if (showGameDetailsModal) {
          setShowGameDetailsModal(false);
          setSelectedGame(null);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to claim prize:', error);
      if (!error.message?.includes('already been processed')) {
        toast({
          variant: "destructive",
          title: "Failed to claim prize",
          description: error.message || "Unknown error",
        });
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCreatorCancel = async () => {
    if (!selectedGame || !wallet.connected) return;

    try {
      console.log('🚫 Cancelling game:', selectedGame.gameId);
      const result = await solanaGame.cancelGame(selectedGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Game cancelled successfully!');
        toast({
          title: "Game Cancelled",
          description: "Your funds have been returned!",
        });
        await solanaGame.fetchGames();
        setShowGameDetailsModal(false);
        setSelectedGame(null);
      }
    } catch (error: any) {
      console.error('❌ Failed to cancel game:', error);
      if (!error.message?.includes('already been processed')) {
        toast({
          variant: "destructive",
          title: "Failed to cancel game",
          description: error.message || "Unknown error",
        });
      }
    }
  };

  const handleGameCardClick = (game: Game) => {
    console.log('🎯 Game card clicked:', game);
    setSelectedGame(game);
    setShowGameDetailsModal(true);
  };

  const handleStartNewGame = () => {
    if (!wallet.connected) return;
    setShowCreateModal(true);
  };

  const handleCreateGame = async () => {
    try {
      const result = await solanaGame.createGame(createGameParams);

      if (result === 'already_processed' || result) {
        console.log('✅ Game created successfully!');
        toast({
          title: "Game Created!",
          description: "Your game has been created successfully",
        });

        setCreateGameParams({
          gameName: '',
          entryFee: 1,
          maxPlayers: 10,
          startTime: new Date(Date.now() + 30 * 60 * 1000),
          gameDurationHours: 2,
        });

        setShowCreateModal(false);
        await solanaGame.fetchGames();
      }
    } catch (error: any) {
      console.error('❌ Failed to create game:', error);
      if (!error.message?.includes('already been processed')) {
        toast({
          variant: "destructive",
          title: "Failed to create game",
          description: error.message || "Unknown error",
        });
      }
    }
  };

  // Get rank badge icon based on position
  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: <Crown className="w-6 h-6" />, color: 'hsl(50, 100%, 60%)', label: '1st' };
    if (rank === 2) return { icon: <Medal className="w-6 h-6" />, color: 'hsl(0, 0%, 75%)', label: '2nd' };
    if (rank === 3) return { icon: <Award className="w-6 h-6" />, color: 'hsl(30, 100%, 50%)', label: '3rd' };
    return { icon: <Trophy className="w-6 h-6" />, color: 'hsl(280, 100%, 45%)', label: `${rank}th` };
  };

  const userRankBadge = getRankBadge(yourStats.rank);

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navbar />

      {/* Tutorial Modal - Shows only for first-time players when joining */}
      {showTutorial && pendingGameId !== null && (
        <FirstTimeTutorial
          gameId={pendingGameId}
          onComplete={handleTutorialComplete}
        />
      )}

      <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black mb-6" style={{
            fontFamily: '"Orbitron", monospace',
            background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 30px hsla(280, 100%, 35%, 0.5)'
          }}>
            Battle Lobby
          </h1>
          <p className="text-xl max-w-3xl mx-auto" style={{ color: 'hsl(0, 0%, 70%)' }}>
            Join epic battles, compete for massive prize pools, and climb the leaderboards
          </p>
        </div>

        {/* Your Ranking Card - NEW */}
        {wallet.connected && (
          <Card className="p-6 mb-8" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.2), hsla(15, 100%, 50%, 0.1))',
            border: `2px solid ${userRankBadge.color}`,
            boxShadow: `0 10px 40px ${userRankBadge.color}40`
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full" style={{
                  background: `linear-gradient(135deg, ${userRankBadge.color}, ${userRankBadge.color}cc)`,
                  boxShadow: `0 0 20px ${userRankBadge.color}80`
                }}>
                  {userRankBadge.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-black mb-1" style={{ color: userRankBadge.color }}>
                    Your Ranking: {userRankBadge.label}
                  </h2>
                  <p className="text-sm" style={{ color: 'hsl(0, 0%, 70%)' }}>
                    {wallet.publicKey.toBase58().slice(0, 8)}...{wallet.publicKey.toBase58().slice(-6)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-black" style={{ color: 'hsl(200, 100%, 60%)' }}>
                    {yourStats.wins}
                  </div>
                  <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Wins</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black flex items-center justify-center gap-1" style={{ color: 'hsl(50, 100%, 60%)' }}>
                    <Coins className="w-6 h-6" />
                    {yourStats.earnings.toFixed(2)}
                  </div>
                  <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Earnings (SOL)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black" style={{ color: 'hsl(280, 100%, 60%)' }}>
                    {yourStats.gamesPlayed}
                  </div>
                  <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Games</div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          <div className="p-4 text-center rounded-lg" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.15), hsla(15, 100%, 50%, 0.05))',
            border: '1px solid hsla(280, 100%, 35%, 0.4)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 25px hsla(280, 100%, 35%, 0.2)'
          }}>
            <div className="text-2xl font-bold" style={{ color: 'hsl(15, 100%, 50%)' }}>{stats.totalGames}</div>
            <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Total Games</div>
          </div>
          <div className="p-4 text-center rounded-lg" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.15), hsla(15, 100%, 50%, 0.05))',
            border: '1px solid hsla(120, 100%, 35%, 0.4)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 25px hsla(120, 100%, 35%, 0.2)'
          }}>
            <div className="text-2xl font-bold" style={{ color: 'hsl(120, 80%, 50%)' }}>{stats.activeGames}</div>
            <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Active Now</div>
          </div>
          <div className="p-4 text-center rounded-lg" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.15), hsla(15, 100%, 50%, 0.05))',
            border: '1px solid hsla(280, 100%, 35%, 0.4)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 25px hsla(280, 100%, 35%, 0.2)'
          }}>
            <div className="text-2xl font-bold" style={{ color: 'hsl(280, 100%, 45%)' }}>{stats.totalPlayers.toLocaleString()}</div>
            <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Total Players</div>
          </div>
          <div className="p-4 text-center rounded-lg" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.15), hsla(15, 100%, 50%, 0.05))',
            border: '1px solid hsla(50, 100%, 50%, 0.4)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 25px hsla(50, 100%, 50%, 0.2)'
          }}>
            <div className="text-2xl font-bold" style={{ color: 'hsl(50, 100%, 60%)' }}>
              {solPrice > 0 ? `$${stats.totalPrizePoolUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `${stats.totalPrizePool.toFixed(2)} SOL`}
            </div>
            <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Prize Pool</div>
          </div>
          <div className="p-4 text-center rounded-lg" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.15), hsla(15, 100%, 50%, 0.05))',
            border: '1px solid hsla(200, 100%, 50%, 0.4)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 25px hsla(200, 100%, 50%, 0.2)'
          }}>
            <div className="text-2xl font-bold" style={{ color: 'hsl(200, 100%, 60%)' }}>{stats.yourWins}</div>
            <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Your Wins</div>
          </div>
          <div className="p-4 text-center rounded-lg" style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.15), hsla(15, 100%, 50%, 0.05))',
            border: '1px solid hsla(120, 100%, 50%, 0.4)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 25px hsla(120, 100%, 50%, 0.2)'
          }}>
            <div className="text-2xl font-bold" style={{ color: 'hsl(120, 80%, 50%)' }}>
              {stats.yourEarnings.toFixed(2)} SOL
            </div>
            <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Your Earnings</div>
          </div>
        </div>

        {/* Leaderboard Section - Top 4 */}
        {leaderboardData.length > 0 && (
          <Card className="p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6" style={{ color: 'hsl(50, 100%, 60%)' }} />
              <h2 className="text-2xl font-bold gradient-text">Top 4 Players</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {leaderboardData.map((player, index) => {
                const badge = getRankBadge(index + 1);
                return (
                  <div
                    key={player.player}
                    className="p-4 rounded-lg transition-all duration-200 hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${badge.color}15, ${badge.color}05)`,
                      border: `2px solid ${badge.color}40`,
                      boxShadow: `0 4px 15px ${badge.color}20`
                    }}
                  >
                    <div className="flex items-center justify-center mb-3">
                      <div className="p-2 rounded-full" style={{
                        background: `linear-gradient(135deg, ${badge.color}, ${badge.color}cc)`,
                        boxShadow: `0 0 15px ${badge.color}60`
                      }}>
                        {badge.icon}
                      </div>
                    </div>

                    <div className="text-center mb-3">
                      <div className="text-xs font-mono truncate mb-1" style={{ color: 'hsl(0, 0%, 90%)' }}>
                        {player.player.slice(0, 6)}...{player.player.slice(-6)}
                      </div>
                      <div className="text-xl font-black" style={{ color: badge.color }}>
                        {badge.label}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: 'hsl(0, 0%, 70%)' }}>Wins:</span>
                        <span className="font-bold" style={{ color: 'hsl(200, 100%, 60%)' }}>
                          {player.wins}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: 'hsl(0, 0%, 70%)' }}>Claimed:</span>
                        <span className="font-bold flex items-center gap-1" style={{ color: 'hsl(50, 100%, 60%)' }}>
                          <Coins className="w-3 h-3" />
                          {player.earnings.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: 'hsl(0, 0%, 70%)' }}>Games:</span>
                        <span className="font-bold" style={{ color: 'hsl(280, 100%, 60%)' }}>
                          {player.gamesPlayed}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center">
          <button
            onClick={handleStartNewGame}
            className="min-w-48 px-8 py-4 text-lg font-bold rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
              color: 'white',
              boxShadow: '0 10px 30px hsla(280, 100%, 35%, 0.4)',
              border: 'none'
            }}
          >
            <Plus className="w-5 h-5" />
            Create New Game
          </button>
          <button
            onClick={solanaGame.fetchGames}
            disabled={solanaGame.loading}
            className="min-w-48 px-8 py-4 text-lg font-bold rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
            style={{
              background: 'transparent',
              color: 'hsl(15, 100%, 50%)',
              border: '2px solid hsl(15, 100%, 50%)',
              boxShadow: 'none'
            }}
          >
            <RefreshCw className={`w-5 h-5 ${solanaGame.loading ? 'animate-spin' : ''}`} />
            Refresh Games
          </button>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, creator, or transaction..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg backdrop-blur-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2"
                style={{
                  background: 'hsla(0, 0%, 10%, 0.5)',
                  border: '1px solid hsla(280, 100%, 35%, 0.3)',
                  color: 'hsl(0, 0%, 90%)'
                }}
              />
            </div>

            <Button
              variant={showYourGames ? "sol" : "outline"}
              onClick={() => setShowYourGames(!showYourGames)}
              className="flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Your Games
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-lg backdrop-blur-sm focus:outline-none focus:ring-2"
                style={{
                  background: 'hsla(0, 0%, 10%, 0.5)',
                  border: '1px solid hsla(280, 100%, 35%, 0.3)',
                  color: 'hsl(0, 0%, 90%)'
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled/Expired</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 rounded-lg backdrop-blur-sm focus:outline-none focus:ring-2"
                style={{
                  background: 'hsla(0, 0%, 10%, 0.5)',
                  border: '1px solid hsla(280, 100%, 35%, 0.3)',
                  color: 'hsl(0, 0%, 90%)'
                }}
              >
                <option value="status">Sort by Status</option>
                <option value="startTime">Sort by Start Time</option>
                <option value="entryFee">Sort by Entry Fee</option>
                <option value="players">Sort by Players</option>
                <option value="prizePool">Sort by Prize Pool</option>
              </select>
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 rounded-lg backdrop-blur-sm flex items-center gap-2 transition-colors"
              style={{
                background: 'hsla(0, 0%, 10%, 0.5)',
                border: '1px solid hsla(280, 100%, 35%, 0.3)',
                color: 'hsl(0, 0%, 90%)'
              }}
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </button>

            <div className="flex-1" />

            <div className="px-4 py-2 rounded-lg backdrop-blur-sm" style={{
              background: 'hsla(280, 100%, 35%, 0.1)',
              border: '1px solid hsla(280, 100%, 35%, 0.2)',
              color: 'hsl(0, 0%, 70%)'
            }}>
              {filteredAndSortedGames.length} {filteredAndSortedGames.length === 1 ? 'game' : 'games'}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {solanaGame.loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'hsl(280, 100%, 35%)' }} />
            <p style={{ color: 'hsl(0, 0%, 70%)' }}>Loading games...</p>
          </div>
        )}

        {/* Games Grid */}
        {filteredAndSortedGames.length === 0 && !solanaGame.loading ? (
          <div className="text-center py-16">
            <Card className="max-w-md mx-auto p-8">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'hsl(0, 0%, 80%)' }}>No games found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your filters or create a new game</p>
              {(searchQuery || showYourGames || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setShowYourGames(false);
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAndSortedGames.map((game) => {
              const isCompleted = normalizeStatus(game.status) === 'Completed';
              const isWinner = isCompleted && game.phase3Winner === wallet.publicKey?.toBase58();
              const canClaimPrize = isWinner && !game.phase3PrizeClaimed;

              return (
                <div
                  key={game.gameId}
                  className="cursor-pointer transition-all duration-300 hover:scale-105 h-full"
                  onClick={() => handleGameCardClick(game)}
                >
                  <Card className="p-6 h-full flex flex-col" style={{
                    minHeight: '320px',
                    borderColor: isCompleted && game.phase3Winner ? 'hsla(50, 100%, 50%, 0.4)' :
                      normalizeStatus(game.status) === 'WaitingForPlayers' ? 'hsla(50, 100%, 50%, 0.4)' :
                        normalizeStatus(game.status) === 'InProgress' ? 'hsla(15, 100%, 50%, 0.4)' :
                          'hsla(120, 100%, 50%, 0.4)',
                    boxShadow: isCompleted && game.phase3Winner ? '0 10px 30px hsla(50, 100%, 50%, 0.3)' : undefined
                  }}>
                    {/* Game Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1" style={{ color: 'white' }}>{game.name}</h3>
                        <p className="text-xs" style={{ color: 'hsl(0, 0%, 50%)' }}>
                          TX: {game.txSignature ? `${game.txSignature.slice(0, 8)}...${game.txSignature.slice(-8)}` : 'N/A'}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-medium ${getStatusColor(game.status)}`}>
                        {getStatusIcon(game.status)}
                        <span className="capitalize">{normalizeStatus(game.status).replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    </div>

                    {/* Countdown Timer - for games that haven't started */}
                    {normalizeStatus(game.status) === 'WaitingForPlayers' && Date.now() < game.startTime.getTime() && (
                      <div className="mb-4 p-3 rounded-lg" style={{
                        background: 'linear-gradient(135deg, hsla(50, 100%, 50%, 0.15), hsla(50, 100%, 60%, 0.05))',
                        border: '1px solid hsla(50, 100%, 50%, 0.3)'
                      }}>
                        <div className="flex items-center justify-center">
                          <CountdownTimer targetTime={game.startTime} />
                        </div>
                      </div>
                    )}

                    {/* Winner Display */}
                    {isCompleted && game.phase3Winner && (
                      <div className="mb-4 p-3 rounded-lg" style={{
                        background: 'linear-gradient(135deg, hsla(50, 100%, 50%, 0.15), hsla(50, 100%, 60%, 0.05))',
                        border: '1px solid hsla(50, 100%, 50%, 0.4)'
                      }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="w-5 h-5" style={{ color: 'hsl(50, 100%, 60%)' }} />
                          <span className="text-sm font-bold" style={{ color: 'hsl(50, 100%, 60%)' }}>
                            Winner
                          </span>
                        </div>
                        <div className="text-xs font-mono" style={{ color: 'hsl(0, 0%, 80%)' }}>
                          {game.phase3Winner.slice(0, 8)}...{game.phase3Winner.slice(-8)}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'hsl(50, 100%, 50%)' }}>
                          Prize: {(game.currentPlayers * game.entryFee * 0.99).toFixed(2)} SOL
                          {game.phase3PrizeClaimed ? ' ✓ Claimed' : ' (Unclaimed)'}
                        </div>
                      </div>
                    )}

                    {/* Game Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" style={{ color: 'hsl(200, 100%, 60%)' }} />
                        <span className="text-sm" style={{ color: 'hsl(0, 0%, 80%)' }}>
                          {game.currentPlayers}/{game.maxPlayers}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4" style={{ color: 'hsl(50, 100%, 60%)' }} />
                        <span className="text-sm font-medium" style={{ color: 'hsl(50, 100%, 60%)' }}>
                          {(game.currentPlayers * game.entryFee * 0.99).toFixed(2)} SOL
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" style={{ color: 'hsl(280, 100%, 60%)' }} />
                        <span className="text-sm" style={{ color: 'hsl(0, 0%, 80%)' }}>{game.entryFee.toFixed(2)} SOL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" style={{ color: 'hsl(50, 100%, 60%)' }} />
                        <span className="text-sm" style={{ color: 'hsl(50, 100%, 60%)' }}>
                          {game.startTime.toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-auto flex gap-2">
                      {canClaimPrize && (
                        <button
                          className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClaimPrize(game);
                          }}
                          disabled={isClaiming}
                          style={{
                            background: 'linear-gradient(135deg, hsl(50, 100%, 50%), hsl(50, 100%, 40%))',
                            color: 'black',
                            border: 'none',
                            boxShadow: '0 5px 15px hsla(50, 100%, 50%, 0.4)'
                          }}
                        >
                          <Trophy className="w-4 h-4" />
                          {isClaiming ? 'Claiming...' : 'Claim Prize'}
                        </button>
                      )}
                      {normalizeStatus(game.status) === 'WaitingForPlayers' && !game.players.includes(wallet.publicKey?.toBase58() || '') && (
                        <button
                          className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                          style={{
                            background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                            color: 'white',
                            border: 'none',
                            boxShadow: '0 5px 15px hsla(280, 100%, 35%, 0.4)'
                          }}
                        >
                          <UserPlus className="w-4 h-4" />
                          Join Battle
                        </button>
                      )}
                      {normalizeStatus(game.status) === 'InProgress' && wallet.publicKey && game.players.includes(wallet.publicKey.toBase58()) && (
                        <button
                          className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            let targetPhase = 'phase1';
                            if (game.currentPhase === 2) targetPhase = 'phase2';
                            else if (game.currentPhase === 3) targetPhase = 'phase3';
                            navigate(`/${targetPhase}?gameId=${game.gameId}`);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, hsl(120, 100%, 35%), hsl(150, 100%, 40%))',
                            color: 'white',
                            border: 'none',
                            boxShadow: '0 5px 15px hsla(120, 100%, 35%, 0.4)'
                          }}
                        >
                          <Play className="w-4 h-4" />
                          Resume Game
                        </button>
                      )}
                      {isCompleted && !canClaimPrize && (
                        <button
                          className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2"
                          style={{
                            background: 'transparent',
                            color: 'hsl(120, 80%, 50%)',
                            border: '1px solid hsl(120, 80%, 50%)'
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          View Results
                        </button>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Game Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'white' }}>Create New Game</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1" style={{ color: 'hsl(0, 0%, 80%)' }}>Game Name</label>
                  <input
                    type="text"
                    maxLength={32}
                    value={createGameParams.gameName}
                    onChange={e => setCreateGameParams({ ...createGameParams, gameName: e.target.value })}
                    placeholder="Enter game name (1-32 characters)"
                    className="w-full px-3 py-2 rounded"
                    style={{
                      background: 'hsla(280, 100%, 35%, 0.1)',
                      border: '1px solid hsla(280, 100%, 35%, 0.3)',
                      color: 'white'
                    }}
                  />
                </div>
                <div>
                  <label className="block mb-1" style={{ color: 'hsl(0, 0%, 80%)' }}>Entry Fee (SOL)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={createGameParams.entryFee}
                    onChange={e => setCreateGameParams({ ...createGameParams, entryFee: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded"
                    style={{
                      background: 'hsla(280, 100%, 35%, 0.1)',
                      border: '1px solid hsla(280, 100%, 35%, 0.3)',
                      color: 'white'
                    }}
                  />
                </div>
                <div>
                  <label className="block mb-1" style={{ color: 'hsl(0, 0%, 80%)' }}>Max Players</label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={createGameParams.maxPlayers}
                    onChange={e => setCreateGameParams({ ...createGameParams, maxPlayers: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded"
                    style={{
                      background: 'hsla(280, 100%, 35%, 0.1)',
                      border: '1px solid hsla(280, 100%, 35%, 0.3)',
                      color: 'white'
                    }}
                  />
                </div>
                <div>
                  <label className="block mb-1" style={{ color: 'hsl(0, 0%, 80%)' }}>Game Duration</label>
                  <select
                    value={createGameParams.gameDurationHours}
                    onChange={e => setCreateGameParams({ ...createGameParams, gameDurationHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded"
                    style={{
                      background: 'hsla(280, 100%, 35%, 0.1)',
                      border: '1px solid hsla(280, 100%, 35%, 0.3)',
                      color: 'white'
                    }}
                  >
                    <option value={0.5}>30m (12/18/30 min phase)</option>
                    <option value={1}>1h (12/18/30 min phase)</option>
                    <option value={2}>2h (24/36/60 min phase)</option>
                    <option value={3}>3h (36/54/90 min phase)</option>
                    <option value={5}>5h (60/90/150 min phase)</option>
                    <option value={8}>8h (96/144/240 min phase)</option>
                    <option value={24}>24h (288/432/720 min phase)</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1" style={{ color: 'hsl(0, 0%, 80%)' }}>Start Time</label>
                  <input
                    type="datetime-local"
                    min={new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16)}
                    value={new Date(createGameParams.startTime.getTime() - createGameParams.startTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    onChange={e => setCreateGameParams({ ...createGameParams, startTime: new Date(e.target.value) })}
                    className="w-full px-3 py-2 rounded"
                    style={{
                      background: 'hsla(280, 100%, 35%, 0.1)',
                      border: '1px solid hsla(280, 100%, 35%, 0.3)',
                      color: 'white'
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'hsl(0, 0%, 60%)' }}>
                    Minimum 30 minutes from now
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateGame}
                  disabled={solanaGame.loading || !createGameParams.gameName.trim()}
                  className="flex-1 py-2 rounded font-semibold"
                  style={{
                    background: !createGameParams.gameName.trim() ? 'hsl(0, 0%, 30%)' : 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                    color: 'white',
                    border: 'none',
                    opacity: !createGameParams.gameName.trim() ? 0.5 : 1,
                    cursor: !createGameParams.gameName.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {solanaGame.loading ? 'Creating...' : 'Create Game'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded font-semibold"
                  style={{
                    background: 'transparent',
                    color: 'hsl(15, 100%, 50%)',
                    border: '1px solid hsl(15, 100%, 50%)'
                  }}
                >
                  Cancel
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* Game Details Modal */}
        {showGameDetailsModal && selectedGame && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-4">
                  <h2 className="text-2xl font-bold mb-1" style={{ color: 'white' }}>{selectedGame.name}</h2>
                  <p className="text-xs break-all" style={{ color: 'hsl(0, 0%, 50%)' }}>
                    TX: {selectedGame.txSignature ? `${selectedGame.txSignature.slice(0, 20)}...${selectedGame.txSignature.slice(-8)}` : 'N/A'}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${getStatusColor(selectedGame.status)}`}>
                  {getStatusIcon(selectedGame.status)}
                  <span className="capitalize">{normalizeStatus(selectedGame.status).replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
              </div>

              {/* Winner Display in Modal */}
              {normalizeStatus(selectedGame.status) === 'Completed' && selectedGame.phase3Winner && (
                <div className="mb-4 p-4 rounded-lg" style={{
                  background: 'linear-gradient(135deg, hsla(50, 100%, 50%, 0.2), hsla(50, 100%, 60%, 0.1))',
                  border: '2px solid hsla(50, 100%, 50%, 0.5)'
                }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-6 h-6" style={{ color: 'hsl(50, 100%, 60%)' }} />
                    <span className="text-lg font-bold" style={{ color: 'hsl(50, 100%, 60%)' }}>
                      Winner Declared!
                    </span>
                  </div>
                  <div className="text-sm font-mono mb-2" style={{ color: 'hsl(0, 0%, 90%)' }}>
                    {selectedGame.phase3Winner.slice(0, 12)}...{selectedGame.phase3Winner.slice(-12)}
                  </div>
                  <div className="text-sm" style={{ color: 'hsl(50, 100%, 50%)' }}>
                    Prize: {(selectedGame.currentPlayers * selectedGame.entryFee * 0.99).toFixed(4)} SOL
                    {selectedGame.phase3PrizeClaimed ? ' ✓ Claimed' : ' (Unclaimed)'}
                  </div>
                </div>
              )}

              {/* Game Info */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: 'hsl(200, 100%, 60%)' }} />
                  <span className="text-sm" style={{ color: 'hsl(0, 0%, 80%)' }}>
                    {selectedGame.currentPlayers}/{selectedGame.maxPlayers} Players
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" style={{ color: 'hsl(50, 100%, 60%)' }} />
                  <span className="text-sm font-medium" style={{ color: 'hsl(50, 100%, 60%)' }}>
                    {selectedGame.prizePool.toFixed(2)} SOL
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: 'hsl(280, 100%, 60%)' }} />
                  <span className="text-sm" style={{ color: 'hsl(0, 0%, 80%)' }}>
                    Entry: {selectedGame.entryFee.toFixed(2)} SOL
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: 'hsl(50, 100%, 60%)' }} />
                  <span className="text-sm" style={{ color: 'hsl(50, 100%, 60%)' }}>
                    {selectedGame.startTime.toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Players List */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'white' }}>Players in Game</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedGame.players.map((player) => (
                    <div
                      key={player}
                      className="flex items-center justify-between p-2 rounded"
                      style={{
                        background: 'hsla(280, 100%, 35%, 0.1)',
                        border: '1px solid hsla(280, 100%, 35%, 0.3)'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ background: 'hsl(280, 100%, 60%)' }}
                        ></div>
                        <span className="text-sm" style={{ color: 'hsl(0, 0%, 80%)' }}>
                          {player.substring(0, 6)}...{player.slice(-6)}
                        </span>
                      </div>
                      {player === selectedGame.creator && (
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: 'hsl(50, 100%, 60%)',
                            color: 'black'
                          }}
                        >
                          Creator
                        </span>
                      )}
                      {player === wallet.publicKey?.toBase58() && (
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: 'hsl(120, 100%, 60%)',
                            color: 'black'
                          }}
                        >
                          You
                        </span>
                      )}
                      {player === selectedGame.phase3Winner && (
                        <span
                          className="text-xs px-2 py-1 rounded flex items-center gap-1"
                          style={{
                            background: 'hsl(50, 100%, 60%)',
                            color: 'black'
                          }}
                        >
                          <Trophy className="w-3 h-3" />
                          Winner
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                {/* Claim Prize Button */}
                {normalizeStatus(selectedGame.status) === 'Completed' &&
                  selectedGame.phase3Winner === wallet.publicKey?.toBase58() &&
                  !selectedGame.phase3PrizeClaimed && (
                    <button
                      onClick={() => handleClaimPrize()}
                      disabled={solanaGame.loading || isClaiming}
                      className="flex-1 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, hsl(50, 100%, 50%), hsl(50, 100%, 40%))',
                        color: 'black',
                        border: 'none',
                        boxShadow: '0 5px 15px hsla(50, 100%, 50%, 0.4)'
                      }}
                    >
                      <Trophy className="w-4 h-4" />
                      {solanaGame.loading || isClaiming ? 'Claiming...' : `Claim Prize (${(selectedGame.prizePool * 0.99).toFixed(4)} SOL)`}
                    </button>
                  )}

                {/* Join Button */}
                {normalizeStatus(selectedGame.status) === 'WaitingForPlayers' &&
                  !selectedGame.players.includes(wallet.publicKey?.toBase58() || '') &&
                  Date.now() < selectedGame.startTime.getTime() && (
                    <button
                      onClick={handleConfirmJoinGame}
                      disabled={!wallet.connected || solanaGame.loading}
                      className="flex-1 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      <UserPlus className="w-4 h-4" />
                      {solanaGame.loading ? 'Joining...' : 'Enter the Game'}
                    </button>
                  )}

                {/* Start Button - Creator poate porni jocul cu ≥3 jucători în primele 30 min */}
                {(() => {
                  const thirtyMinutesAfterStart = selectedGame.startTime.getTime() + 30 * 60 * 1000;
                  const canStart = normalizeStatus(selectedGame.status) === 'WaitingForPlayers' &&
                    selectedGame.creator === wallet.publicKey?.toBase58() &&
                    !selectedGame.gameStarted &&
                    selectedGame.currentPlayers >= 3 &&
                    Date.now() >= selectedGame.startTime.getTime() &&
                    Date.now() <= thirtyMinutesAfterStart;

                  return canStart ? (
                    <button
                      onClick={handleStartGame}
                      disabled={solanaGame.loading}
                      className="flex-1 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, hsl(120, 100%, 35%), hsl(120, 100%, 50%))',
                        color: 'white',
                        border: 'none',
                        boxShadow: '0 5px 15px hsla(120, 100%, 35%, 0.4)'
                      }}
                    >
                      <Play className="w-4 h-4" />
                      {solanaGame.loading ? 'Starting...' : 'Start Game'}
                    </button>
                  ) : null;
                })()}

                {/* Cancel Button - Creator poate anula cu <3 jucători în primele 30 min */}
                {(() => {
                  const thirtyMinutesAfterStart = selectedGame.startTime.getTime() + 30 * 60 * 1000;
                  const canCancel = normalizeStatus(selectedGame.status) === 'WaitingForPlayers' &&
                    selectedGame.creator === wallet.publicKey?.toBase58() &&
                    !selectedGame.gameStarted &&
                    selectedGame.currentPlayers < 3 &&
                    Date.now() >= selectedGame.startTime.getTime() &&
                    Date.now() <= thirtyMinutesAfterStart;

                  return canCancel ? (
                    <button
                      onClick={handleCreatorCancel}
                      disabled={solanaGame.loading}
                      className="flex-1 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, hsl(0, 100%, 35%), hsl(0, 100%, 50%))',
                        color: 'white',
                        border: 'none',
                        boxShadow: '0 5px 15px hsla(0, 100%, 35%, 0.4)'
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                      {solanaGame.loading ? 'Cancelling...' : 'Cancel & Claim Refund'}
                    </button>
                  ) : null;
                })()}

                {/* Force Refund Button - Players pot forța refund după 30 min dacă creator nu și-a făcut datoria */}
                {(() => {
                  const thirtyMinutesAfterStart = selectedGame.startTime.getTime() + 30 * 60 * 1000;
                  const isPlayerInGame = selectedGame.players.includes(wallet.publicKey?.toBase58() || '');
                  const hasClaimedRefund = selectedGame.refundedPlayers.includes(wallet.publicKey?.toBase58() || '');

                  const canForceRefund = normalizeStatus(selectedGame.status) === 'WaitingForPlayers' &&
                    isPlayerInGame &&
                    !hasClaimedRefund &&
                    !selectedGame.gameStarted &&
                    Date.now() >= thirtyMinutesAfterStart;

                  return canForceRefund ? (
                    <button
                      onClick={handleForceRefund}
                      disabled={solanaGame.loading}
                      className="flex-1 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, hsl(50, 100%, 35%), hsl(50, 100%, 50%))',
                        color: 'black',
                        border: 'none',
                        boxShadow: '0 5px 15px hsla(50, 100%, 35%, 0.4)'
                      }}
                    >
                      <Trophy className="w-4 h-4" />
                      {solanaGame.loading ? 'Claiming...' : `Force Refund (${selectedGame.entryFee.toFixed(2)} SOL)`}
                    </button>
                  ) : null;
                })()}

                {/* Regular Refund Button - pentru statusuri Cancelled/Expired/ExpiredWithPenalty */}
                {(() => {
                  const normalized = normalizeStatus(selectedGame.status);
                  const isPlayerInGame = selectedGame.players.includes(wallet.publicKey?.toBase58() || '');
                  const hasClaimedRefund = selectedGame.refundedPlayers.includes(wallet.publicKey?.toBase58() || '');
                  const isCreator = selectedGame.creator === wallet.publicKey?.toBase58();

                  // Creator NU poate lua refund dacă statusul e ExpiredWithPenalty
                  if (isCreator && normalized === 'ExpiredWithPenalty') {
                    return null;
                  }

                  const canClaimRefund = isPlayerInGame && !hasClaimedRefund && (
                    normalized === 'Cancelled' ||
                    normalized === 'Expired' ||
                    normalized === 'Expiredwithpenalty' ||
                    normalized === 'ExpiredWithPenalty'
                  );

                  return canClaimRefund ? (
                    <button
                      onClick={handleClaimRefund}
                      disabled={solanaGame.loading}
                      className="flex-1 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, hsl(50, 100%, 35%), hsl(50, 100%, 50%))',
                        color: 'black',
                        border: 'none',
                        boxShadow: '0 5px 15px hsla(50, 100%, 35%, 0.4)'
                      }}
                    >
                      <Trophy className="w-4 h-4" />
                      {solanaGame.loading ? 'Claiming...' : `Claim Refund (${selectedGame.entryFee.toFixed(2)} SOL)`}
                    </button>
                  ) : null;
                })()}

                <button
                  onClick={() => {
                    setShowGameDetailsModal(false);
                    setSelectedGame(null);
                  }}
                  className="flex-1 py-3 rounded-lg font-semibold"
                  style={{
                    background: 'transparent',
                    color: 'hsl(15, 100%, 50%)',
                    border: '1px solid hsl(15, 100%, 50%)'
                  }}
                >
                  Close
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}