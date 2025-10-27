import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import solanaIdl from '../lib/solana_survivor.json';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import type { Game } from '@/hooks/useSolanaGame';
import {
    Shield,
    Play,
    FastForward,
    XCircle,
    Users,
    Trophy,
    Clock,
    DollarSign,
    ArrowLeft,
    RefreshCw,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const PROGRAM_ID = new PublicKey(solanaIdl.address);

// Game Status Enum
const GameStatus = {
    WaitingForPlayers: 'WaitingForPlayers',
    ReadyToStart: 'ReadyToStart',
    InProgress: 'InProgress',
    Completed: 'Completed',
    Cancelled: 'Cancelled',
    Expired: 'Expired',
    ExpiredWithPenalty: 'ExpiredWithPenalty',
};

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

export default function AdminDashboard() {
    const wallet = useWallet();
    const navigate = useNavigate();
    const solanaGame = useSolanaGame();
    const [adminPubkey, setAdminPubkey] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (!wallet.publicKey) {
            navigate('/');
            return;
        }
        checkAdminStatus();
    }, [wallet.publicKey]);

    const checkAdminStatus = async () => {
        if (!wallet.publicKey) return;

        try {
            const connection = new Connection('https://api.devnet.solana.com');

            const [gameRegistryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('game_registry')],
                PROGRAM_ID
            );

            // Check if account exists
            const accountInfo = await connection.getAccountInfo(gameRegistryPDA);

            if (!accountInfo) {
                console.log('Game registry account does not exist yet');
                setIsAdmin(false);
                return;
            }

            // Manually decode admin pubkey (skip 8 byte discriminator + 8 bytes gameCount + 8 bytes totalGamesCreated)
            const adminPubkeyBytes = accountInfo.data.slice(24, 56);
            const adminPubkey = new PublicKey(adminPubkeyBytes);

            console.log('Admin wallet:', adminPubkey.toString());
            console.log('Your wallet:', wallet.publicKey.toString());

            setAdminPubkey(adminPubkey.toString());
            setIsAdmin(adminPubkey.toString() === wallet.publicKey.toString());
        } catch (error) {
            console.error('Error checking admin status:', error);
            setIsAdmin(false);
        }
    };

    const adminStartGame = async (gamePubkey: PublicKey, gameId: number) => {
        if (!solanaGame.program || !wallet.publicKey) return;

        setActionLoading(`start-${gameId}`);
        try {
            const [gameRegistryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('game_registry')],
                PROGRAM_ID
            );

            const tx = await solanaGame.program.methods
                .adminStartGame()
                .accounts({
                    game: gamePubkey,
                    gameRegistry: gameRegistryPDA,
                    admin: wallet.publicKey,
                })
                .rpc();

            toast.success('Game started successfully!');
            await solanaGame.refreshGames();
        } catch (error: any) {
            console.error('Error starting game:', error);
            toast.error('Failed to start game: ' + error.message);
        }
        setActionLoading(null);
    };

    const adminAdvancePhase = async (gamePubkey: PublicKey, gameId: number) => {
        if (!solanaGame.program || !wallet.publicKey) return;

        setActionLoading(`advance-${gameId}`);
        try {
            const [gameRegistryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('game_registry')],
                PROGRAM_ID
            );

            const tx = await solanaGame.program.methods
                .adminAdvancePhase()
                .accounts({
                    game: gamePubkey,
                    gameRegistry: gameRegistryPDA,
                    admin: wallet.publicKey,
                })
                .rpc();

            toast.success('Phase advanced successfully!');
            await solanaGame.refreshGames();
        } catch (error: any) {
            console.error('Error advancing phase:', error);
            toast.error('Failed to advance phase: ' + error.message);
        }
        setActionLoading(null);
    };

    const adminClosePurge = async (gamePubkey: PublicKey, game: Game) => {
        if (!solanaGame.program || !wallet.publicKey) return;

        setActionLoading(`close-${game.gameId}`);
        try {
            const [gameRegistryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('game_registry')],
                PROGRAM_ID
            );

            const tx = await solanaGame.program.methods
                .adminClosePurgeNoReady()
                .accounts({
                    game: gamePubkey,
                    gameRegistry: gameRegistryPDA,
                    admin: wallet.publicKey,
                })
                .rpc();

            toast.success('Game closed and funds redistributed!');
            await solanaGame.refreshGames();
        } catch (error: any) {
            console.error('Error closing game:', error);
            toast.error('Failed to close game: ' + error.message);
        }
        setActionLoading(null);
    };

    const canStartGame = (game: Game) => {
        const status = normalizeStatus(game.status);
        return status === 'WaitingForPlayers' && !game.gameStarted && game.currentPlayers >= 3;
    };

    const canAdvancePhase = (game: Game) => {
        const status = normalizeStatus(game.status);
        return status === 'InProgress' && game.gameStarted;
    };

    const canClosePurge = (game: Game) => {
        const status = normalizeStatus(game.status);
        return status === 'InProgress' &&
            game.currentPhase === 3 &&
            game.phase3PlayersReady === 0;
    };

    const getStatusColor = (status: string) => {
        const normalized = normalizeStatus(status);
        switch (normalized) {
            case 'WaitingForPlayers': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
            case 'InProgress': return 'text-green-400 bg-green-400/10 border-green-400/30';
            case 'Completed': return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
            case 'Cancelled': return 'text-red-400 bg-red-400/10 border-red-400/30';
            case 'Expired': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
            case 'ExpiredWithPenalty': return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
        }
    };

    const getStatusIcon = (status: string) => {
        const normalized = normalizeStatus(status);
        switch (normalized) {
            case 'WaitingForPlayers': return Clock;
            case 'InProgress': return Play;
            case 'Completed': return CheckCircle;
            case 'Cancelled': return XCircle;
            case 'Expired': return AlertCircle;
            case 'ExpiredWithPenalty': return AlertCircle;
            default: return AlertCircle;
        }
    };

    if (!wallet.connected) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <ParticleBackground />
                <Navbar />
                <div className="text-center">
                    <Shield className="w-16 h-16 text-sol-orange mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
                    <p className="text-muted-foreground">Please connect your wallet to access the admin dashboard.</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-background">
                <ParticleBackground />
                <Navbar />
                <main className="container mx-auto px-4 py-20">
                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                        <div className="text-center">
                            <Shield className="w-20 h-20 text-sol-orange mx-auto mb-6 animate-pulse" />
                            <h1 className="text-3xl font-bold mb-4 gradient-text">Access Denied</h1>
                            <p className="text-muted-foreground mb-6">You do not have admin privileges.</p>
                            <Button
                                onClick={() => navigate('/')}
                                variant="sol"
                                className="rounded-full"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Home
                            </Button>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <ParticleBackground />
            <Navbar />

            <main className="container mx-auto px-4 py-20 relative z-10">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Shield className="w-8 h-8 text-sol-orange" />
                                <h1 className="text-4xl font-black gradient-text">Admin Dashboard</h1>
                            </div>
                            <p className="text-muted-foreground">Manage games and monitor platform activity</p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => solanaGame.refreshGames()}
                                variant="sol-outline"
                                size="sm"
                                disabled={solanaGame.loading}
                                className="rounded-full"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${solanaGame.loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                onClick={() => navigate('/')}
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Trophy className="w-5 h-5 text-sol-orange" />
                                <span className="text-sm text-muted-foreground">Total Games</span>
                            </div>
                            <div className="text-3xl font-black gradient-text">{solanaGame.games.length}</div>
                        </Card>

                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Play className="w-5 h-5 text-green-400" />
                                <span className="text-sm text-muted-foreground">Active Games</span>
                            </div>
                            <div className="text-3xl font-black text-green-400">
                                {solanaGame.games.filter(g => normalizeStatus(g.status) === 'InProgress').length}
                            </div>
                        </Card>

                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="w-5 h-5 text-blue-400" />
                                <span className="text-sm text-muted-foreground">Total Players</span>
                            </div>
                            <div className="text-3xl font-black text-blue-400">
                                {solanaGame.games.reduce((sum, game) => sum + game.currentPlayers, 0)}
                            </div>
                        </Card>

                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <DollarSign className="w-5 h-5 text-sol-orange" />
                                <span className="text-sm text-muted-foreground">Total Prize Pool</span>
                            </div>
                            <div className="text-3xl font-black text-sol-orange">
                                {solanaGame.games.reduce((sum, game) => sum + game.prizePool, 0).toFixed(2)} SOL
                            </div>
                        </Card>
                    </div>

                    {/* Games List */}
                    {solanaGame.loading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="w-8 h-8 animate-spin text-sol-orange" />
                        </div>
                    ) : solanaGame.games.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-xl font-bold mb-2">No Games Yet</h3>
                            <p className="text-muted-foreground">Games will appear here once they are created.</p>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {solanaGame.games.map((game) => {
                                const status = normalizeStatus(game.status);
                                const StatusIcon = getStatusIcon(game.status);
                                const statusColorClass = getStatusColor(game.status);

                                return (
                                    <Card key={game.gameId} className="p-6">
                                        <div className="space-y-4">
                                            {/* Header */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="text-2xl font-black gradient-text">#{game.gameId}</div>
                                                        <h3 className="text-xl font-bold truncate">{game.name}</h3>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono truncate">
                                                        Creator: {game.creator}
                                                    </div>
                                                </div>

                                                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${statusColorClass}`}>
                                                    <StatusIcon className="w-4 h-4" />
                                                    <span className="text-sm font-bold">{status}</span>
                                                </div>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                                                <div className="bg-background/50 rounded-lg p-3">
                                                    <div className="text-xs text-muted-foreground mb-1">Phase</div>
                                                    <div className="text-lg font-black gradient-text">
                                                        {game.currentPhase === 0 ? 'Setup' : `Phase ${game.currentPhase}`}
                                                    </div>
                                                </div>

                                                <div className="bg-background/50 rounded-lg p-3">
                                                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        Players
                                                    </div>
                                                    <div className="text-lg font-black gradient-text">
                                                        {game.currentPlayers} / {game.maxPlayers}
                                                    </div>
                                                </div>

                                                <div className="bg-background/50 rounded-lg p-3">
                                                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                                        <DollarSign className="w-3 h-3" />
                                                        Prize Pool
                                                    </div>
                                                    <div className="text-lg font-black text-sol-orange">
                                                        {game.prizePool.toFixed(2)} SOL
                                                    </div>
                                                </div>

                                                <div className="bg-background/50 rounded-lg p-3">
                                                    <div className="text-xs text-muted-foreground mb-1">Phase 3 Ready</div>
                                                    <div className="text-lg font-black gradient-text">
                                                        {game.phase3PlayersReady} players
                                                    </div>
                                                </div>

                                                <div className="bg-background/50 rounded-lg p-3">
                                                    <div className="text-xs text-muted-foreground mb-1">Started</div>
                                                    <div className={`text-lg font-black ${game.gameStarted ? 'text-green-400' : 'text-red-400'}`}>
                                                        {game.gameStarted ? 'Yes' : 'No'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
                                                {canStartGame(game) && (
                                                    <Button
                                                        variant="sol"
                                                        size="sm"
                                                        onClick={() => {
                                                            const gamePubkey = new PublicKey(game.creator); // This should be the game PDA
                                                            // Get proper game PDA
                                                            const [gamePDA] = PublicKey.findProgramAddressSync(
                                                                [Buffer.from('game'), Buffer.from(new Uint8Array(new BigUint64Array([BigInt(game.gameId)]).buffer))],
                                                                PROGRAM_ID
                                                            );
                                                            adminStartGame(gamePDA, game.gameId);
                                                        }}
                                                        disabled={actionLoading === `start-${game.gameId}`}
                                                        className="rounded-full"
                                                    >
                                                        {actionLoading === `start-${game.gameId}` ? (
                                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <Play className="w-4 h-4 mr-2" />
                                                        )}
                                                        Start Game
                                                    </Button>
                                                )}

                                                {canAdvancePhase(game) && (
                                                    <Button
                                                        variant="sol-outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const [gamePDA] = PublicKey.findProgramAddressSync(
                                                                [Buffer.from('game'), Buffer.from(new Uint8Array(new BigUint64Array([BigInt(game.gameId)]).buffer))],
                                                                PROGRAM_ID
                                                            );
                                                            adminAdvancePhase(gamePDA, game.gameId);
                                                        }}
                                                        disabled={actionLoading === `advance-${game.gameId}`}
                                                        className="rounded-full"
                                                    >
                                                        {actionLoading === `advance-${game.gameId}` ? (
                                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <FastForward className="w-4 h-4 mr-2" />
                                                        )}
                                                        Advance Phase
                                                    </Button>
                                                )}

                                                {canClosePurge(game) && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => {
                                                            const [gamePDA] = PublicKey.findProgramAddressSync(
                                                                [Buffer.from('game'), Buffer.from(new Uint8Array(new BigUint64Array([BigInt(game.gameId)]).buffer))],
                                                                PROGRAM_ID
                                                            );
                                                            adminClosePurge(gamePDA, game);
                                                        }}
                                                        disabled={actionLoading === `close-${game.gameId}`}
                                                        className="rounded-full"
                                                    >
                                                        {actionLoading === `close-${game.gameId}` ? (
                                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 mr-2" />
                                                        )}
                                                        Close & Redistribute
                                                    </Button>
                                                )}

                                                {!canStartGame(game) && !canAdvancePhase(game) && !canClosePurge(game) && (
                                                    <p className="text-sm text-muted-foreground italic">
                                                        No admin actions available
                                                    </p>
                                                )}
                                            </div>

                                            {/* Phase 3 Warning */}
                                            {game.currentPhase === 3 && game.phase3PlayersReady === 0 && (
                                                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                                    <div className="text-sm">
                                                        <p className="font-semibold text-red-400 mb-1">No Players Ready!</p>
                                                        <p className="text-muted-foreground">
                                                            This game is eligible for force close with 25% platform fee and 75% redistribution to purge players.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}