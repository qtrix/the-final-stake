import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Clock, Trophy, TrendingUp, Play, UserPlus, Eye, Crown, Zap, Calendar, Timer, Plus, RefreshCw, AlertCircle, XCircle, Search, Filter, ArrowUpDown } from 'lucide-react';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
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

// Helper to normalize status (handles both string and object formats from Solana)
const normalizeStatus = (status: any): string => {
  if (typeof status === 'string') return status;
  if (typeof status === 'object' && status !== null) {
    const keys = Object.keys(status);
    if (keys.length > 0) {
      // Convert camelCase/lowercase to PascalCase
      const key = keys[0];
      return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim().replace(/ /g, '');
    }
  }
  return 'Unknown';
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

// Ready Check Modal Component (inline)
interface ReadyCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  gameTitle: string;
}

function ReadyCheckModal({ isOpen, onClose, onConfirm, gameTitle }: ReadyCheckModalProps) {
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(10);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <Crown className="w-16 h-16 text-sol-orange mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold mb-2 gradient-text">Joining Battle</h2>
          <p className="text-muted-foreground">{gameTitle}</p>
        </div>

        <div className="mb-8">
          <div className="text-6xl font-bold text-sol-orange mb-2">{countdown}</div>
          <p className="text-sm text-muted-foreground">seconds to confirm</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 p-4 rounded-lg border border-border/50">
            <input
              type="checkbox"
              id="ready-check"
              checked={isReady}
              onChange={(e) => setIsReady(e.target.checked)}
              className="w-5 h-5 accent-sol-orange"
            />
            <label htmlFor="ready-check" className="text-lg font-medium">
              I'm ready to battle!
            </label>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="sol"
              onClick={onConfirm}
              disabled={!isReady}
              className="flex-1"
            >
              <Zap className="w-4 h-4 mr-2" />
              Let's Fight!
            </Button>
          </div>
        </div>
      </Card>
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
  const [showReadyCheck, setShowReadyCheck] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGameDetailsModal, setShowGameDetailsModal] = useState(false);
  const [createGameParams, setCreateGameParams] = useState({
    gameName: '',
    entryFee: 1,
    maxPlayers: 10,
    startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now (minimum)
    gameDurationHours: 2, // Default 2 ore
  });

  // Filtering and sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [showYourGames, setShowYourGames] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'entryFee' | 'players' | 'startTime' | 'prizePool'>('startTime');

  // Filter and sort games
  const filteredAndSortedGames = solanaGame.games
    .filter(game => {
      // Search filter (by name, creator, or transaction)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = game.name.toLowerCase().includes(query);
        const matchesCreator = game.creator.toLowerCase().includes(query);
        const matchesTx = game.txSignature?.toLowerCase().includes(query);
        if (!matchesName && !matchesCreator && !matchesTx) return false;
      }

      // Your games filter
      if (showYourGames && wallet.publicKey) {
        const userAddress = wallet.publicKey.toBase58();
        const isCreator = game.creator === userAddress;
        const isPlayer = game.players.includes(userAddress);
        if (!isCreator && !isPlayer) return false;
      }

      // Status filter
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
      switch (sortBy) {
        case 'entryFee':
          return b.entryFee - a.entryFee;
        case 'players':
          return b.currentPlayers - a.currentPlayers;
        case 'prizePool':
          return b.prizePool - a.prizePool;
        case 'startTime':
        default:
          return a.startTime.getTime() - b.startTime.getTime();
      }
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
    // Refresh price every 60 seconds
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Statistici calculate din jocurile reale
  const stats = {
    totalGames: solanaGame.games.length,
    activeGames: solanaGame.games.filter(g => g.status === 'WaitingForPlayers' || g.status === 'InProgress').length,
    // Total distinct players across all games
    totalPlayers: new Set(solanaGame.games.flatMap(game => game.players)).size,
    totalPrizePool: solanaGame.games.reduce((acc, game) => acc + game.prizePool, 0),
    totalPrizePoolUSD: solanaGame.games.reduce((acc, game) => acc + game.prizePool, 0) * solPrice,
    yourWins: 0, // Winner tracking not available in current contract version
    yourEarnings: 0 // Winner tracking not available in current contract version
  };

  // Leaderboard data: top players by wins and earnings
  const leaderboardData = (() => {
    const playerStats = new Map<string, { wins: number; earnings: number; gamesPlayed: number }>();

    solanaGame.games.forEach(game => {
      game.players.forEach(player => {
        if (!playerStats.has(player)) {
          playerStats.set(player, { wins: 0, earnings: 0, gamesPlayed: 0 });
        }
        const stats = playerStats.get(player)!;
        stats.gamesPlayed += 1;
      });
    });

    return Array.from(playerStats.entries())
      .map(([player, stats]) => ({ player, ...stats }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10);
  })();



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
    switch (status) {
      case 'WaitingForPlayers': return <Clock className="w-4 h-4" />;
      case 'ReadyToStart': return <Crown className="w-4 h-4" />;
      case 'InProgress': return <Play className="w-4 h-4" />;
      case 'Completed': return <Trophy className="w-4 h-4" />;
      case 'Cancelled': return <Users className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-400 bg-green-400/20';
      case 'Medium': return 'text-yellow-400 bg-yellow-400/20';
      case 'Hard': return 'text-orange-400 bg-orange-400/20';
      case 'Extreme': return 'text-red-400 bg-red-400/20';
      default: return 'text-muted-foreground bg-muted/20';
    }
  };

  const handleJoinGame = async (game: any) => {
    setSelectedGame(game);
    setShowGameDetailsModal(true);
  };

  const handleConfirmJoinGame = async () => {
    console.log('🎮 Enter the Game button clicked!');
    console.log('🎯 Selected game:', selectedGame);
    console.log('🔗 Wallet connected:', wallet.connected);

    if (!selectedGame || !wallet.connected) {
      console.error('❌ Missing requirements:', { selectedGame: !!selectedGame, walletConnected: wallet.connected });
      return;
    }

    try {
      console.log('🚀 Calling solanaGame.enterGame with gameId:', selectedGame.gameId);
      const result = await solanaGame.enterGame(selectedGame.gameId);

      if (result === 'already_processed') {
        console.log('🎉 Join was already successful! Closing modal...');
      } else {
        console.log('✅ Successfully joined game!');
      }

      setShowGameDetailsModal(false);
      setSelectedGame(null);
      console.log('🔄 Modal closed and state reset');
    } catch (error) {
      console.error('❌ Failed to join game:', error);
      // Modal rămâne deschis ca să poată încerca din nou
    }
  };

  const handleStartGame = async () => {
    if (!selectedGame || !wallet.connected) {
      return;
    }

    try {
      console.log('🚀 Starting game:', selectedGame.gameId);
      const result = await solanaGame.startGame(selectedGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Game started successfully!');
        toast({
          title: "Game Started",
          description: "Players can now initialize their game states in Phase 1",
        });
        setShowGameDetailsModal(false);
        setSelectedGame(null);
      }
    } catch (error) {
      console.error('❌ Failed to start game:', error);
      toast({
        variant: "destructive",
        title: "Failed to start game",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleClaimRefund = async () => {
    if (!selectedGame || !wallet.connected) {
      return;
    }

    try {
      console.log('💰 Claiming refund for game:', selectedGame.gameId);
      const result = await solanaGame.claimRefund(selectedGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Refund claimed successfully!');
        setShowGameDetailsModal(false);
        setSelectedGame(null);
      }
    } catch (error) {
      console.error('❌ Failed to claim refund:', error);
    }
  };

  const handleCreatorCancel = async () => {
    if (!selectedGame || !wallet.connected) {
      return;
    }

    try {
      console.log('🚫 Cancelling game:', selectedGame.gameId);
      const result = await solanaGame.cancelGame(selectedGame.gameId);

      if (result === 'already_processed' || result) {
        console.log('✅ Game cancelled successfully!');
        setShowGameDetailsModal(false);
        setSelectedGame(null);
      }
    } catch (error) {
      console.error('❌ Failed to cancel game:', error);
    }
  };

  const handleGameCardClick = (game: Game) => {
    console.log('🎯 Game card clicked:', game);
    console.log('📝 Setting selected game and showing modal');
    setSelectedGame(game);
    setShowGameDetailsModal(true);
  };

  // Debugging effect
  useEffect(() => {
    if (showGameDetailsModal && selectedGame) {
      console.log('🔍 Modal open with game:', selectedGame);
      console.log('👤 Current wallet:', wallet.publicKey?.toBase58());
      console.log('🎮 Players in game:', selectedGame.players);
      console.log('✅ Is user in game?', selectedGame.players.includes(wallet.publicKey?.toBase58() || ''));
      console.log('🎯 Game status:', selectedGame.status);
      console.log('🔗 Wallet connected:', wallet.connected);
    }
  }, [showGameDetailsModal, selectedGame, wallet.publicKey, wallet.connected]);

  const handleReadyConfirm = async () => {
    if (selectedGameId) {
      const game = solanaGame.games.find(g => g.gameId === selectedGameId);
      if (game) {
        await handleJoinGame(game);
      }
    }
    setShowReadyCheck(false);
    setSelectedGameId(null);
  };

  const handleStartNewGame = () => {
    if (!wallet.connected) {
      return; // Let them click the connect wallet button in the nav
    }
    setShowCreateModal(true);
  };

  const handleCreateGame = async () => {
    try {
      const result = await solanaGame.createGame(createGameParams);

      if (result === 'already_processed' || result) {
        console.log('✅ Game created successfully!');
        setShowCreateModal(false);
        // Reset form
        setCreateGameParams({
          gameName: '',
          entryFee: 1,
          maxPlayers: 10,
          startTime: new Date(Date.now() + 30 * 60 * 1000),
          gameDurationHours: 2,
        });
      }
    } catch (error) {
      console.error('❌ Failed to create game:', error);
      // Don't close modal on error so user can try again or fix parameters
    }
  };

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navbar />

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
            <div className="text-2xl font-bold" style={{ color: 'hsl(120, 80%, 50%)' }}>${stats.yourEarnings}</div>
            <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>Earnings</div>
          </div>
        </div>

        {/* Leaderboard Section */}
        {leaderboardData.length > 0 && (
          <Card className="p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6" style={{ color: 'hsl(50, 100%, 60%)' }} />
              <h2 className="text-2xl font-bold gradient-text">Top Players</h2>
            </div>

            <div className="space-y-3">
              {leaderboardData.map((player, index) => (
                <div
                  key={player.player}
                  className="flex items-center gap-4 p-3 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: index < 3
                      ? 'linear-gradient(135deg, hsla(50, 100%, 50%, 0.15), hsla(15, 100%, 50%, 0.05))'
                      : 'hsla(0, 0%, 10%, 0.3)',
                    border: `1px solid ${index < 3 ? 'hsla(50, 100%, 50%, 0.3)' : 'hsla(280, 100%, 35%, 0.2)'}`,
                  }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold"
                    style={{
                      background: index === 0 ? 'linear-gradient(135deg, hsl(50, 100%, 60%), hsl(45, 100%, 50%))' :
                        index === 1 ? 'linear-gradient(135deg, hsl(0, 0%, 75%), hsl(0, 0%, 65%))' :
                          index === 2 ? 'linear-gradient(135deg, hsl(30, 100%, 50%), hsl(25, 100%, 45%))' :
                            'hsla(280, 100%, 35%, 0.3)',
                      color: index < 3 ? 'white' : 'hsl(0, 0%, 70%)'
                    }}
                  >
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'hsl(0, 0%, 90%)' }}>
                      {player.player.slice(0, 4)}...{player.player.slice(-4)}
                    </div>
                    <div className="text-xs" style={{ color: 'hsl(0, 0%, 60%)' }}>
                      {player.gamesPlayed} games played
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: 'hsl(50, 100%, 60%)' }}>
                      {player.wins} {player.wins === 1 ? 'win' : 'wins'}
                    </div>
                    <div className="text-xs" style={{ color: 'hsl(0, 0%, 70%)' }}>
                      {player.earnings.toFixed(2)} SOL
                    </div>
                  </div>
                </div>
              ))}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 15px 40px hsla(15, 100%, 50%, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 30px hsla(280, 100%, 35%, 0.4)';
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'hsl(15, 100%, 50%)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'hsl(15, 100%, 50%)';
            }}
          >
            <RefreshCw className={`w-5 h-5 ${solanaGame.loading ? 'animate-spin' : ''}`} />
            Refresh Games
          </button>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
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

            {/* Your Games Toggle */}
            <Button
              variant={showYourGames ? "sol" : "outline"}
              onClick={() => setShowYourGames(!showYourGames)}
              className="flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Your Games
            </Button>
          </div>

          {/* Status Filter and Sort */}
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
                <option value="startTime">Sort by Start Time</option>
                <option value="entryFee">Sort by Entry Fee</option>
                <option value="players">Sort by Players</option>
                <option value="prizePool">Sort by Prize Pool</option>
              </select>
            </div>

            <div className="flex-1" />

            {/* Results count */}
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
            {filteredAndSortedGames.map((game) => (
              <div
                key={game.gameId}
                className="cursor-pointer transition-all duration-300 hover:scale-105 h-full"
                onClick={() => handleGameCardClick(game)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Card className="p-6 h-full flex flex-col" style={{
                  minHeight: '320px',
                  borderColor: game.status === 'WaitingForPlayers' ? 'hsla(50, 100%, 50%, 0.4)' :
                    game.status === 'InProgress' ? 'hsla(15, 100%, 50%, 0.4)' :
                      'hsla(120, 100%, 50%, 0.4)',
                  boxShadow: `0 10px 30px ${game.status === 'WaitingForPlayers' ? 'hsla(50, 100%, 50%, 0.2)' :
                    game.status === 'InProgress' ? 'hsla(15, 100%, 50%, 0.2)' :
                      'hsla(120, 100%, 50%, 0.2)'}`
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
                      <span className="capitalize">{game.status.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                  </div>

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
                        {game.prizePool} SOL
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" style={{ color: 'hsl(280, 100%, 60%)' }} />
                      <span className="text-sm" style={{ color: 'hsl(0, 0%, 80%)' }}>{game.entryFee.toFixed(2)} SOL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {game.status === 'WaitingForPlayers' && (
                        <>
                          {Date.now() < game.startTime.getTime() ? (
                            <CountdownTimer targetTime={game.startTime} />
                          ) : Date.now() < game.expireTime.getTime() ? (
                            game.currentPlayers >= 3 ? (
                              <>
                                <Timer className="w-4 h-4 animate-pulse" style={{ color: 'hsl(50, 100%, 60%)' }} />
                                <span className="text-xs" style={{ color: 'hsl(50, 100%, 50%)' }}>Ready</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4" style={{ color: 'hsl(30, 100%, 60%)' }} />
                                <span className="text-xs" style={{ color: 'hsl(30, 100%, 50%)' }}>Need players</span>
                              </>
                            )
                          ) : (
                            <>
                              <Clock className="w-4 h-4" style={{ color: 'hsl(0, 100%, 60%)' }} />
                              <span className="text-xs" style={{ color: 'hsl(0, 100%, 50%)' }}>Expired</span>
                            </>
                          )}
                        </>
                      )}
                      {game.status === 'InProgress' && (
                        <>
                          <Clock className="w-4 h-4" style={{ color: 'hsl(15, 100%, 60%)' }} />
                          <span className="text-sm" style={{ color: 'hsl(15, 100%, 50%)' }}>In Progress</span>
                        </>
                      )}
                      {game.status === 'Completed' && (
                        <>
                          <Calendar className="w-4 h-4" style={{ color: 'hsl(120, 80%, 60%)' }} />
                          <span className="text-sm" style={{ color: 'hsl(120, 80%, 50%)' }}>
                            Completed
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Start Time Display */}
                  <div className="mb-4">
                    <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: 'hsla(280, 100%, 35%, 0.2)',
                        color: 'hsl(280, 100%, 60%)',
                        border: '1px solid hsl(280, 100%, 35%)'
                      }}
                    >
                      Starts: {game.startTime.toLocaleDateString()}
                    </span>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {normalizeStatus(game.status) === 'WaitingForPlayers' && (
                      <button
                        className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                        onClick={() => handleJoinGame(game)}
                        style={{
                          background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                          color: 'white',
                          border: 'none',
                          boxShadow: '0 5px 15px hsla(280, 100%, 35%, 0.4)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 8px 25px hsla(15, 100%, 50%, 0.6)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 5px 15px hsla(280, 100%, 35%, 0.4)';
                        }}
                      >
                        <UserPlus className="w-4 h-4" />
                        Join Battle
                      </button>
                    )}
                    {normalizeStatus(game.status) === 'InProgress' && (
                      <>
                        {wallet.publicKey && game.players.includes(wallet.publicKey.toBase58()) ? (
                          <button
                            className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetPhase = game.currentPhase === 2 ? 'phase2' : 'phase1';
                              console.log(`🎮 Navigating to ${targetPhase} for gameId:`, game.gameId);
                              navigate(`/${targetPhase}?gameId=${game.gameId}`);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, hsl(120, 100%, 35%), hsl(150, 100%, 40%))',
                              color: 'white',
                              border: 'none',
                              boxShadow: '0 5px 15px hsla(120, 100%, 35%, 0.4)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = '0 8px 25px hsla(150, 100%, 40%, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = '0 5px 15px hsla(120, 100%, 35%, 0.4)';
                            }}
                          >
                            <Play className="w-4 h-4" />
                            Resume Game
                          </button>
                        ) : (
                          <button
                            className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2"
                            disabled
                            style={{
                              background: 'transparent',
                              color: 'hsl(0, 0%, 50%)',
                              border: '1px solid hsl(0, 0%, 30%)',
                              cursor: 'not-allowed'
                            }}
                          >
                            <Eye className="w-4 h-4" />
                            Watch Live
                          </button>
                        )}
                      </>
                    )}
                    {normalizeStatus(game.status) === 'Completed' && (
                      <button
                        className="flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                        style={{
                          background: 'transparent',
                          color: 'hsl(120, 80%, 50%)',
                          border: '1px solid hsl(120, 80%, 50%)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'hsl(120, 80%, 50%)';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'hsl(120, 80%, 50%)';
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        View Results
                      </button>
                    )}
                  </div>

                  {/* Progress Bar for Waiting Games */}
                  {normalizeStatus(game.status) === 'WaitingForPlayers' && (
                    <div className="mt-4">
                      <div className="w-full rounded-full h-2 overflow-hidden" style={{
                        background: 'hsla(280, 100%, 35%, 0.2)'
                      }}>
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${(game.currentPlayers / game.maxPlayers) * 100}%`,
                            background: 'linear-gradient(90deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                            boxShadow: '0 0 10px hsla(280, 100%, 35%, 0.6)'
                          }}
                        ></div>
                      </div>
                      <p className="text-xs mt-2 text-center" style={{ color: 'hsl(0, 0%, 60%)' }}>
                        {game.maxPlayers - game.currentPlayers} spots remaining
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            ))}
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
                    <option value={1}>1 oră (12/18/30 min fazele)</option>
                    <option value={2}>2 ore (24/36/60 min fazele)</option>
                    <option value={3}>3 ore (36/54/90 min fazele)</option>
                    <option value={5}>5 ore (60/90/150 min fazele)</option>
                    <option value={8}>8 ore (96/144/240 min fazele)</option>
                    <option value={24}>24 ore (288/432/720 min fazele)</option>
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
                    Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone} • Minimum 30 minutes from now
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
                  Create Game
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
                    TX: {selectedGame.txSignature ? `${selectedGame.txSignature.slice(0, Math.min(20, Math.floor(window.innerWidth / 25)))}...${selectedGame.txSignature.slice(-8)}` : 'N/A'}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${getStatusColor(selectedGame.status)}`}>
                  {getStatusIcon(selectedGame.status)}
                  <span className="capitalize">{selectedGame.status.replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
              </div>

              {/* Game Status Display */}
              {selectedGame.status === 'WaitingForPlayers' && (
                <div className="mb-4 p-3 rounded-lg text-center" style={{
                  background: 'linear-gradient(135deg, hsla(50, 100%, 50%, 0.15), hsla(280, 100%, 35%, 0.1))',
                  border: '1px solid hsla(50, 100%, 50%, 0.3)'
                }}>
                  {Date.now() < selectedGame.startTime.getTime() ? (
                    <CountdownTimer targetTime={selectedGame.startTime} className="justify-center text-lg" />
                  ) : Date.now() < selectedGame.expireTime.getTime() ? (
                    selectedGame.currentPlayers >= 3 ? (
                      <div className="flex items-center justify-center gap-2 text-yellow-400">
                        <Timer className="w-5 h-5 animate-pulse" />
                        <span className="text-sm font-medium">Waiting for creator to start...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-orange-400">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Not enough players - Claim refund</span>
                      </div>
                    )
                  ) : (
                    selectedGame.currentPlayers >= 3 ? (
                      <div className="flex items-center justify-center gap-2 text-red-400">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm font-medium">Expired - Everyone can claim refunds</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-red-400">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm font-medium">Expired - Claim your refund</span>
                      </div>
                    )
                  )}
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
                  {selectedGame.players.map((player, index) => (
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
                    </div>
                  ))}

                  {/* Empty slots */}
                  {Array.from({ length: selectedGame.maxPlayers - selectedGame.currentPlayers }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="flex items-center gap-2 p-2 rounded border-dashed border"
                      style={{
                        borderColor: 'hsla(0, 0%, 50%, 0.3)',
                        color: 'hsl(0, 0%, 50%)'
                      }}
                    >
                      <div className="w-3 h-3 rounded-full border border-dashed" style={{ borderColor: 'hsl(0, 0%, 50%)' }}></div>
                      <span className="text-sm">Waiting for player...</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {/* Join button - only if not in game and before start time */}
                {selectedGame.status === 'WaitingForPlayers' &&
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

                {/* Start button - only for creator after start time and before expire time */}
                {(selectedGame.status === 'WaitingForPlayers' ||
                  selectedGame.status === 'ReadyToStart') &&
                  selectedGame.creator === wallet.publicKey?.toBase58() &&
                  Date.now() >= selectedGame.startTime.getTime() &&
                  Date.now() < selectedGame.expireTime.getTime() &&
                  selectedGame.currentPlayers >= 3 && (
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
                  )}

                {/* Cancel button - for creator with < 3 players after start time */}
                {selectedGame.status === 'WaitingForPlayers' &&
                  selectedGame.creator === wallet.publicKey?.toBase58() &&
                  Date.now() >= selectedGame.startTime.getTime() &&
                  Date.now() < selectedGame.expireTime.getTime() &&
                  selectedGame.currentPlayers < 3 &&
                  !selectedGame.gameStarted && (
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
                      {solanaGame.loading ? 'Cancelling...' : 'Cancel & Refund'}
                    </button>
                  )}

                {/* Refund button - for players in cancelled/expired games who haven't claimed yet */}
                {(() => {
                  const normalizedStatus = normalizeStatus(selectedGame.status);
                  const isPlayerInGame = selectedGame.players.includes(wallet.publicKey?.toBase58() || '');
                  const hasClaimedRefund = selectedGame.refundedPlayers.includes(wallet.publicKey?.toBase58() || '');
                  const isCreator = selectedGame.creator === wallet.publicKey?.toBase58();
                  const isExpired = Date.now() >= selectedGame.expireTime.getTime();
                  const afterStartTime = Date.now() >= selectedGame.startTime.getTime();
                  const notEnoughPlayers = selectedGame.currentPlayers < 3;

                  // Show refund button if:
                  // 1. Player is in game AND hasn't claimed refund
                  // 2. Game is in a refundable state (Cancelled, Expired, or not started with < 3 players)
                  // 3. For ExpiredWithPenalty, only non-creators can claim
                  const canClaimRefund = isPlayerInGame && !hasClaimedRefund && (
                    normalizedStatus === 'Cancelled' ||
                    normalizedStatus === 'Expired' ||
                    (normalizedStatus === 'Expiredwithpenalty' && !isCreator) ||
                    (normalizedStatus === 'ExpiredWithPenalty' && !isCreator) ||
                    (afterStartTime && notEnoughPlayers && !selectedGame.gameStarted)
                  );

                  console.log('🔍 Refund button logic:', {
                    normalizedStatus,
                    isPlayerInGame,
                    hasClaimedRefund,
                    isCreator,
                    canClaimRefund,
                    wallet: wallet.publicKey?.toBase58(),
                    players: selectedGame.players,
                    refundedPlayers: selectedGame.refundedPlayers
                  });

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

                {/* Already joined indicator */}
                {selectedGame.players.includes(wallet.publicKey?.toBase58() || '') &&
                  Date.now() < selectedGame.startTime.getTime() && (
                    <div
                      className="flex-1 py-3 rounded-lg font-semibold text-center"
                      style={{
                        background: 'hsl(120, 100%, 60%)',
                        color: 'black'
                      }}
                    >
                      ✓ Already Joined
                    </div>
                  )}

                {/* Already refunded indicator */}
                {selectedGame.refundedPlayers.includes(wallet.publicKey?.toBase58() || '') && (
                  <div
                    className="flex-1 py-3 rounded-lg font-semibold text-center"
                    style={{
                      background: 'hsl(50, 100%, 60%)',
                      color: 'black'
                    }}
                  >
                    ✓ Refund Claimed
                  </div>
                )}

                {/* Penalty message for creator in ExpiredWithPenalty games */}
                {(() => {
                  const normalizedStatus = normalizeStatus(selectedGame.status);
                  const isCreator = selectedGame.creator === wallet.publicKey?.toBase58();
                  const hasClaimedRefund = selectedGame.refundedPlayers.includes(wallet.publicKey?.toBase58() || '');
                  const isPenaltyStatus = normalizedStatus === 'Expiredwithpenalty' || normalizedStatus === 'ExpiredWithPenalty';

                  return (isPenaltyStatus && isCreator && !hasClaimedRefund) ? (
                    <div
                      className="flex-1 py-3 rounded-lg font-semibold text-center flex items-center justify-center gap-2"
                      style={{
                        background: 'hsl(0, 100%, 50%)',
                        color: 'white'
                      }}
                    >
                      <AlertCircle className="w-4 h-4" />
                      Entry forfeited (penalty)
                    </div>
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