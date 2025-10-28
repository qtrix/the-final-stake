// src/hooks/useSolanaGame.tsx - VERSIUNE CU CONFIRMĂRI EXPLICITE
import { useEffect, useState, useRef, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import solanaIdl from '../lib/solana_survivor.json';
import bs58 from 'bs58';
import { rpcCache } from '@/lib/rpcCache'
import { toast } from 'sonner';

// ✅ UPDATED PROGRAM ID - deployed contract
const PROGRAM_ID = new PublicKey('AU3td9Pd4mU5XTn8fQUwKjZZhMsizEpQNjtbMBbfvJvi');

// ✅ Helper function pentru confirmarea tranzacțiilor
const confirmTransaction = async (
  connection: Connection,
  signature: string,
  commitment: 'confirmed' | 'finalized' = 'confirmed'
): Promise<void> => {
  console.log('⏳ Waiting for transaction confirmation...');
  await connection.confirmTransaction(signature, commitment);
  console.log('✅ Transaction confirmed!');
};

export interface Game {
  gameId: number;
  name: string;
  creator: string;
  entryFee: number;
  maxPlayers: number;
  currentPlayers: number;
  startTime: Date;
  expireTime: Date;
  status: 'WaitingForPlayers' | 'ReadyToStart' | 'InProgress' | 'Completed' | 'Cancelled' | 'Expired' | 'ExpiredWithPenalty';
  prizePool: number;
  players: string[];
  gameStarted: boolean;
  refundedPlayers: string[];
  currentPhase: number;
  phaseEndTime: Date;
  phaseAdvanceDeadline: Date;
  phases: {
    phase1Duration: number;
    phase2Duration: number;
    phase3Duration: number;
  };
  txSignature?: string;
  phase2RequiredGames: number;
  phase2MaxGamesPerOpponent: number;
  phase3ReadyDeadline: Date;
  phase3ExtendedDeadline: Date | null;
  phase3PlayersReady: number;
  phase3Started: boolean;
  phase3Winner: string | null;
  phase3PrizeClaimed: boolean;
  platformFeeCollected: number;
}

export interface GameEvent {
  eventType: 'SeasonChange' | 'MarketShift' | 'Breakthrough' | 'WhaleEntry';
  poolAffected: 'Mining' | 'Farming' | 'Trading' | 'Research' | 'Social';
  timestamp: Date;
  phaseNumber: number;
  newValue?: number;
  multiplier?: number;
  participant?: PublicKey;
}

interface CreateGameParams {
  gameName: string;
  entryFee: number;
  maxPlayers: number;
  startTime: Date;
  gameDurationHours: number;
}

export interface PlayerGameState {
  player: string;
  virtualBalance: number;
  totalEarned: number;
  lastClaimTime: Date;
  hasActiveAllocation: boolean;
  allocations: {
    mining: number;
    farming: number;
    trading: number;
    research: number;
    social: number;
  };
}

export interface PlayerPhase2Stats {
  totalGamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  opponentPlayCounts: Record<string, number>;
}

export type MiniGameType = 'CryptoTrivia' | 'RockPaperScissors' | 'SpeedTrading' | 'MemeBattle';
export type ChallengeStatus = 'Pending' | 'Accepted' | 'BothReady' | 'InProgress' | 'Completed' | 'Expired' | 'ForcedAccept';

export interface Challenge {
  publicKey: PublicKey;
  challengeId: number;
  gameId: number;
  challenger: PublicKey;
  opponent: PublicKey;
  betAmount: number;
  gameType: MiniGameType;
  status: ChallengeStatus;
  createdAt: Date;
  acceptedAt: Date | null;
  gameStartedAt: Date | null;
  winner: PublicKey | null;
  opponentDeclineCount: number;
}

export interface GamePoolState {
  miningPoolTotal: number;
  farmingPoolTotal: number;
  tradingPoolTotal: number;
  researchPoolTotal: number;
  socialPoolTotal: number;
  socialPoolParticipants: number;
  farmingSeason: number;
  tradingMarketState: number;
}

export interface InitProgress {
  status: 'idle' | 'starting' | 'initializing-players' | 'initializing-pool' | 'ready' | 'error';
  progress: number;
  currentStep: string;
  error?: string;
}

export interface PhaseAdvanceProgress {
  step: string;
  progress: number;
  current?: number;
  total?: number;
}

export interface Phase3ReadyState {
  gameId: number;
  player: string;
  ready: boolean;
  virtualBalance: number;
  markedReadyAt: Date;
}

export interface Phase3GameState {
  readyDeadline: Date;
  extendedDeadline: Date | null;
  playersReady: number;
  totalPlayers: number;
  started: boolean;
  winner: string | null;
  platformFeeCollected: number;
}

// PDA Derivation Functions
export function getGameRegistryPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("game_registry")],
    programId
  );
}

export function getGamePDA(programId: PublicKey, gameId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("game"), new BN(gameId).toArrayLike(Buffer, "le", 8)],
    programId
  );
}

export function getPlayerStatePDA(programId: PublicKey, gameId: number, player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("player_state"),
      new BN(gameId).toArrayLike(Buffer, "le", 8),
      player.toBuffer(),
    ],
    programId
  );
}

export function getPoolStatePDA(programId: PublicKey, gameId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_state"), new BN(gameId).toArrayLike(Buffer, "le", 8)],
    programId
  );
}

export function getChallengePDA(
  programId: PublicKey,
  gameId: number,
  challenger: PublicKey,
  opponent: PublicKey,
  timestamp: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("challenge"),
      new BN(gameId).toArrayLike(Buffer, "le", 8),
      challenger.toBuffer(),
      opponent.toBuffer(),
      new BN(timestamp).toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

export function useSolanaGame() {
  const wallet = useWallet();
  const [program, setProgram] = useState<Program | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  const fetchInProgressRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const FETCH_COOLDOWN_MS = 5000;

  console.log('🔄 useSolanaGame render:', {
    connected: wallet.connected,
    publicKey: wallet.publicKey?.toBase58(),
    programExists: !!program,
    attempts: initializationAttempts
  });

  useEffect(() => {
    const initializeProgram = async () => {
      setInitializationAttempts(prev => prev + 1);
      console.log('=== PROGRAM INITIALIZATION ATTEMPT ===', initializationAttempts + 1);

      try {
        console.log('🚀 Starting Anchor program initialization...');
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        let provider;
        if (wallet.connected && wallet.publicKey) {
          console.log('🔗 Creating provider with connected wallet:', wallet.publicKey.toBase58());
          provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: 'confirmed' });
        } else {
          console.log('📖 Creating read-only provider');
          const dummyWallet = {
            publicKey: new PublicKey('11111111111111111111111111111111'),
            signTransaction: async (tx: any) => tx,
            signAllTransactions: async (txs: any) => txs,
          };
          provider = new AnchorProvider(connection, dummyWallet as any, { preflightCommitment: 'confirmed' });
        }

        const prog = new Program(solanaIdl as any, provider);
        setProgram(prog);
        console.log('✅ Program initialized');

        await fetchGames(prog);
      } catch (error) {
        console.error('❌ Failed to initialize program:', error);
        setProgram(null);
      }
    };

    initializeProgram();

    return () => {
      console.log('🧹 Cleaning up useSolanaGame hook');
      fetchInProgressRef.current = false;
    };
  }, [wallet.connected, wallet.publicKey?.toBase58()]);

  const fetchGames = async (prog: Program) => {
    if (fetchInProgressRef.current) {
      console.log('⏸️ Fetch already in progress, skipping...');
      return;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (timeSinceLastFetch < FETCH_COOLDOWN_MS) {
      console.log(`⏰ Fetch cooldown active. Wait ${Math.ceil((FETCH_COOLDOWN_MS - timeSinceLastFetch) / 1000)}s`);
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchTimeRef.current = now;
    setLoading(true);

    try {
      console.log('🎮 Fetching games from Solana...');

      const accounts = await (prog.account as any).game.all();
      console.log('📊 Raw accounts fetched:', accounts.length);

      const formattedGames: Game[] = accounts.map((acc: any) => {
        const g = acc.account;
        const rawStatus = Object.keys(g.status)[0];
        const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

        return {
          gameId: g.gameId.toNumber(),
          name: g.name || `Game #${g.gameId.toNumber()}`,
          creator: g.creator.toBase58(),
          entryFee: g.entryFee.toNumber() / LAMPORTS_PER_SOL,
          maxPlayers: g.maxPlayers,
          currentPlayers: g.currentPlayers,
          startTime: new Date(g.startTime.toNumber() * 1000),
          expireTime: new Date(g.expireTime.toNumber() * 1000),
          status: status as Game['status'],
          prizePool: g.prizePool.toNumber() / LAMPORTS_PER_SOL,
          players: g.players.map((p: PublicKey) => p.toBase58()),
          gameStarted: g.gameStarted || false,
          refundedPlayers: g.refundedPlayers ? g.refundedPlayers.map((p: PublicKey) => p.toBase58()) : [],
          currentPhase: g.currentPhase || 0,
          phaseEndTime: new Date(g.phaseEndTime?.toNumber() * 1000 || Date.now()),
          phaseAdvanceDeadline: new Date(g.phaseAdvanceDeadline?.toNumber() * 1000 || Date.now()),
          phases: {
            phase1Duration: g.phases?.phase1Duration?.toNumber() || 0,
            phase2Duration: g.phases?.phase2Duration?.toNumber() || 0,
            phase3Duration: g.phases?.phase3Duration?.toNumber() || 0,
          },
          txSignature: acc.publicKey.toBase58(),
          phase2RequiredGames: g.phase2RequiredGames || 5,
          phase2MaxGamesPerOpponent: g.phase2MaxGamesPerOpponent || 3,
          phase3ReadyDeadline: g.phase3ReadyDeadline && g.phase3ReadyDeadline.toNumber() > 0
            ? new Date(g.phase3ReadyDeadline.toNumber() * 1000)
            : new Date(Date.now() + 30 * 60 * 1000),
          phase3ExtendedDeadline: g.phase3ExtendedDeadline && g.phase3ExtendedDeadline.toNumber() > 0
            ? new Date(g.phase3ExtendedDeadline.toNumber() * 1000)
            : null,
          phase3PlayersReady: g.phase3PlayersReady || 0,
          phase3Started: g.phase3Started || false,
          phase3Winner: g.phase3Winner ? g.phase3Winner.toBase58() : null,
          phase3PrizeClaimed: g.phase3PrizeClaimed || false,
          platformFeeCollected: g.platformFeeCollected?.toNumber() || 0,
        };
      });

      console.log('✅ Processed games:', formattedGames.length);
      setGames(formattedGames);
    } catch (err) {
      console.error('❌ Error fetching games:', err);
      setGames([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  };

  const getPlayerState = async (gameId: number, playerPubkey?: PublicKey): Promise<PlayerGameState | null> => {
    if (!program || !playerPubkey) return null;

    try {
      const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, playerPubkey);
      const playerState = await (program.account as any).playerGameState.fetch(playerStatePDA);

      return {
        player: playerState.player.toString(),
        virtualBalance: playerState.virtualBalance.toNumber(),
        totalEarned: playerState.totalEarned?.toNumber() || 0,
        lastClaimTime: new Date((playerState.lastClaimTime?.toNumber() || 0) * 1000),
        hasActiveAllocation: playerState.hasActiveAllocation || false,
        allocations: {
          mining: playerState.allocations?.mining?.toNumber() || 0,
          farming: playerState.allocations?.farming?.toNumber() || 0,
          trading: playerState.allocations?.trading?.toNumber() || 0,
          research: playerState.allocations?.research?.toNumber() || 0,
          social: playerState.allocations?.social?.toNumber() || 0,
        },
      };
    } catch (error: any) {
      console.warn(`⚠️ Player state not found`);
      return null;
    }
  };

  const getPoolState = async (gameId: number): Promise<GamePoolState | null> => {
    if (!program) return null;

    try {
      const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);
      const poolState = await (program.account as any).gamePoolState.fetch(poolStatePDA);

      return {
        miningPoolTotal: poolState.miningPoolTotal.toNumber() / LAMPORTS_PER_SOL,
        farmingPoolTotal: poolState.farmingPoolTotal.toNumber() / LAMPORTS_PER_SOL,
        tradingPoolTotal: poolState.tradingPoolTotal.toNumber() / LAMPORTS_PER_SOL,
        researchPoolTotal: poolState.researchPoolTotal.toNumber() / LAMPORTS_PER_SOL,
        socialPoolTotal: poolState.socialPoolTotal.toNumber() / LAMPORTS_PER_SOL,
        socialPoolParticipants: poolState.socialPoolParticipants,
        farmingSeason: poolState.farmingSeason,
        tradingMarketState: poolState.tradingMarketState,
      };
    } catch (error) {
      return null;
    }
  };

  const getPlayerPhase2Stats = async (
    gameId: number,
    playerPubkey: PublicKey
  ): Promise<PlayerPhase2Stats> => {
    if (!program) {
      return {
        totalGamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        opponentPlayCounts: {}
      };
    }

    try {
      const allChallenges = await (program.account as any).challenge.all([
        {
          memcmp: {
            offset: 8 + 8,
            bytes: bs58.encode(new BN(gameId).toArrayLike(Buffer, "le", 8)),
          }
        }
      ]);

      const playerAddress = playerPubkey.toBase58();
      let totalGamesPlayed = 0;
      let gamesWon = 0;
      let gamesLost = 0;
      const opponentPlayCounts: Record<string, number> = {};

      allChallenges.forEach((c: any) => {
        const challenge = c.account;
        const isParticipant =
          challenge.challenger.toBase58() === playerAddress ||
          challenge.opponent.toBase58() === playerAddress;

        if (!isParticipant) return;

        if (challenge.status.completed && challenge.winner) {
          totalGamesPlayed++;

          const opponentAddr = challenge.challenger.toBase58() === playerAddress
            ? challenge.opponent.toBase58()
            : challenge.challenger.toBase58();

          opponentPlayCounts[opponentAddr] = (opponentPlayCounts[opponentAddr] || 0) + 1;

          if (challenge.winner.toBase58() === playerAddress) {
            gamesWon++;
          } else {
            gamesLost++;
          }
        }
      });

      return {
        totalGamesPlayed,
        gamesWon,
        gamesLost,
        opponentPlayCounts
      };
    } catch (error) {
      console.error('Error fetching Phase 2 stats:', error);
      return {
        totalGamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        opponentPlayCounts: {}
      };
    }
  };

  // ✅ CREATE GAME - cu confirmare
  const createGame = async (params: CreateGameParams) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gameRegistryPDA] = getGameRegistryPDA(program.programId);
      const gameRegistry = await (program.account as any).gameRegistry.fetch(gameRegistryPDA);
      const gameCount = gameRegistry.gameCount;
      const [gamePDA] = getGamePDA(program.programId, gameCount.toNumber());

      const tx = await program.methods
        .createGame(
          params.gameName,
          new BN(params.entryFee * LAMPORTS_PER_SOL),
          params.maxPlayers,
          new BN(Math.floor(params.startTime.getTime() / 1000)),
          params.gameDurationHours
        )
        .accounts({
          game: gamePDA,
          gameRegistry: gameRegistryPDA,
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ ENTER GAME - cu confirmare
  const enterGame = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .enterGame()
        .accounts({
          game: gamePDA,
          player: wallet.publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      console.log('📝 Transaction sent:', tx);
      await confirmTransaction(program.provider.connection, tx);
      console.log('✅ Successfully joined game!');

      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ BATCH INITIALIZE - cu confirmare pentru fiecare TX
  const batchInitializeGameStates = async (
    gameId: number,
    onProgress?: (progress: InitProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      onProgress?.({
        status: 'initializing-players',
        progress: 10,
        currentStep: 'Loading player list...',
      });

      const game = await (program.account as any).game.fetch(gamePDA);
      const players = game.players;

      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < players.length; i += BATCH_SIZE) {
        batches.push(players.slice(i, i + BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchProgress = 10 + (70 * (i / batches.length));

        onProgress?.({
          status: 'initializing-players',
          progress: batchProgress,
          currentStep: `Initializing players ${i * BATCH_SIZE + 1}-${Math.min((i + 1) * BATCH_SIZE, players.length)}...`,
        });

        const initPromises = batch.map(async (player: PublicKey) => {
          try {
            const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, player);

            const tx = await program.methods
              .initializePlayerState()
              .accounts({
                playerState: playerStatePDA,
                game: gamePDA,
                player: player,
                systemProgram: SystemProgram.programId,
              })
              .rpc({ skipPreflight: false, commitment: 'confirmed' });

            // ✅ Așteaptă confirmarea
            await confirmTransaction(program.provider.connection, tx);

            return { player: player.toString(), success: true };
          } catch (error) {
            console.error(`Failed to init player ${player.toString()}:`, error);
            return { player: player.toString(), success: false, error };
          }
        });

        await Promise.allSettled(initPromises);
      }

      onProgress?.({
        status: 'initializing-pool',
        progress: 90,
        currentStep: 'Initializing resource pools...',
      });

      const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);
      const poolTx = await program.methods
        .initializePoolState()
        .accounts({
          poolState: poolStatePDA,
          game: gamePDA,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      // ✅ Confirmare
      await confirmTransaction(program.provider.connection, poolTx);

      onProgress?.({
        status: 'ready',
        progress: 100,
        currentStep: 'Game ready!',
      });

      await fetchGames(program);
    } catch (error: any) {
      onProgress?.({
        status: 'error',
        progress: 0,
        currentStep: 'Initialization failed',
        error: error.message,
      });
      throw error;
    }
  };

  // ✅ START GAME WITH BATCH INIT - cu confirmare
  const startGameWithBatchInit = async (
    gameId: number,
    onProgress?: (progress: InitProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      onProgress?.({
        status: 'starting',
        progress: 5,
        currentStep: 'Starting game...',
      });

      const [gamePDA] = getGamePDA(program.programId, gameId);
      const tx = await program.methods
        .startGame()
        .accounts({
          game: gamePDA,
          creator: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      // ✅ Confirmare
      await confirmTransaction(program.provider.connection, tx);

      await batchInitializeGameStates(gameId, (progress) => {
        onProgress?.({
          ...progress,
          progress: 5 + (progress.progress * 0.95),
        });
      });
    } catch (error: any) {
      onProgress?.({
        status: 'error',
        progress: 0,
        currentStep: 'Failed to start game',
        error: error.message,
      });
      throw error;
    }
  };

  // ✅ INITIALIZE PLAYER STATE - cu confirmare
  const initializePlayerState = async (gameId: number): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);

    const tx = await program.methods
      .initializePlayerState()
      .accounts({
        playerState: playerStatePDA,
        game: gamePDA,
        player: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    await fetchGames(program);
  };

  // ✅ INITIALIZE POOL STATE - cu confirmare
  const initializePoolState = async (gameId: number): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

    const tx = await program.methods
      .initializePoolState()
      .accounts({
        poolState: poolStatePDA,
        game: gamePDA,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    await fetchGames(program);
  };

  // ✅ SUBMIT ALLOCATIONS - cu confirmare
  const submitAllocations = async (
    gameId: number,
    allocations: {
      mining: number;
      farming: number;
      trading: number;
      research: number;
      social: number;
    }
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);
    const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

    const allocationsInLamports = {
      mining: new BN(Math.floor(allocations.mining * LAMPORTS_PER_SOL)),
      farming: new BN(Math.floor(allocations.farming * LAMPORTS_PER_SOL)),
      trading: new BN(Math.floor(allocations.trading * LAMPORTS_PER_SOL)),
      research: new BN(Math.floor(allocations.research * LAMPORTS_PER_SOL)),
      social: new BN(Math.floor(allocations.social * LAMPORTS_PER_SOL))
    };

    const tx = await program.methods
      .submitAllocations(
        allocationsInLamports.mining,
        allocationsInLamports.farming,
        allocationsInLamports.trading,
        allocationsInLamports.research,
        allocationsInLamports.social
      )
      .accounts({
        playerState: playerStatePDA,
        poolState: poolStatePDA,
        game: gamePDA,
        player: wallet.publicKey,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    return tx;
  };

  // ✅ CLAIM REWARDS - cu confirmare
  const claimRewards = async (gameId: number): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);
    const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

    const tx = await program.methods
      .claimRewards()
      .accounts({
        playerState: playerStatePDA,
        poolState: poolStatePDA,
        game: gamePDA,
        player: wallet.publicKey,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    return tx;
  };

  // ✅ CLAIM ALL PHASE END REWARDS - cu confirmare per batch
  const claimAllPhaseEndRewards = async (
    gameId: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> => {
    if (!program) {
      throw new Error('Program not initialized');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const game = await (program.account as any).game.fetch(gamePDA);
    const players = game.players;
    const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      batches.push(players.slice(i, i + BATCH_SIZE));
    }

    let processed = 0;

    for (const batch of batches) {
      const claimPromises = batch.map(async (player: PublicKey) => {
        try {
          const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, player);

          const tx = await program.methods
            .claimPhaseEndRewards()
            .accounts({
              playerState: playerStatePDA,
              poolState: poolStatePDA,
              game: gamePDA,
              player: player,
            })
            .rpc({ skipPreflight: false, commitment: 'confirmed' });

          // ✅ Confirmare
          await confirmTransaction(program.provider.connection, tx);

          processed++;
          onProgress?.(processed, players.length);
          return { player: player.toString(), success: true };
        } catch (error) {
          console.error(`Failed to claim for ${player.toString()}:`, error);
          processed++;
          onProgress?.(processed, players.length);
          return { player: player.toString(), success: false, error };
        }
      });

      await Promise.allSettled(claimPromises);
    }
  };

  // ✅ ADVANCE PHASE - cu confirmare
  const advancePhase = async (
    gameId: number,
    onProgress?: (progress: PhaseAdvanceProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      onProgress?.({ step: 'Advancing to next phase...', progress: 50 });

      const [gamePDA] = getGamePDA(program.programId, gameId);
      const tx = await program.methods
        .advancePhase()
        .accounts({
          game: gamePDA,
          caller: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);

      onProgress?.({ step: 'Claiming your rewards...', progress: 75 });

      const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);
      const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

      const claimTx = await program.methods
        .claimPhaseEndRewards()
        .accounts({
          playerState: playerStatePDA,
          poolState: poolStatePDA,
          game: gamePDA,
          player: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, claimTx);

      onProgress?.({ step: 'Phase advanced!', progress: 100 });
      await fetchGames(program);
    } catch (error: any) {
      onProgress?.({ step: 'Failed to advance phase', progress: 0 });
      throw error;
    }
  };

  // ✅ START GAME - cu confirmare
  const startGame = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .startGame()
        .accounts({
          game: gamePDA,
          creator: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ CANCEL GAME - cu confirmare
  const cancelGame = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .creatorCancelGame()
        .accounts({
          game: gamePDA,
          creator: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ CLAIM REFUND - cu confirmare
  const claimRefund = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .claimRefund()
        .accounts({
          game: gamePDA,
          player: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ CREATE CHALLENGE - cu confirmare
  const createChallenge = async (
    gameId: number,
    opponent: PublicKey,
    betAmount: number,
    gameType: MiniGameType
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);

    const timestamp = Math.floor(Date.now() / 1000);
    const [challengePDA] = getChallengePDA(program.programId, gameId, wallet.publicKey, opponent, timestamp);

    const gameTypeEnum = {
      CryptoTrivia: { cryptoTrivia: {} },
      RockPaperScissors: { rockPaperScissors: {} },
      SpeedTrading: { speedTrading: {} },
      MemeBattle: { memeBattle: {} },
    }[gameType];

    const tx = await program.methods
      .createChallenge(
        opponent,
        new BN(timestamp),
        new BN(betAmount * LAMPORTS_PER_SOL),
        gameTypeEnum
      )
      .accounts({
        challenge: challengePDA,
        game: gamePDA,
        playerState: playerStatePDA,
        challenger: wallet.publicKey,
        opponent: opponent,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    rpcCache.invalidate(`pending_challenges_${gameId}_${opponent.toBase58()}`);
    rpcCache.invalidate(`my_challenges_${gameId}_${wallet.publicKey!.toBase58()}`);
    return tx;
  };

  // ✅ RESPOND TO CHALLENGE - cu confirmare
  const respondToChallenge = async (
    challengePDA: PublicKey,
    gameId: number,
    accept: boolean
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [opponentStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);

    const tx = await program.methods
      .respondChallenge(accept)
      .accounts({
        challenge: challengePDA,
        game: gamePDA,
        opponentState: opponentStatePDA,
        opponent: wallet.publicKey,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    rpcCache.invalidate(`pending_challenges_${gameId}_${wallet.publicKey!.toBase58()}`);
    rpcCache.invalidate(`active_challenges_${gameId}_${wallet.publicKey!.toBase58()}`);
    return tx;
  };

  // ✅ MARK READY - cu confirmare
  const markReady = async (challengePDA: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const tx = await program.methods
      .readyForGame()
      .accounts({
        challenge: challengePDA,
        player: wallet.publicKey,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    return tx;
  };

  // ✅ START MINI GAME - cu confirmare
  const startMiniGame = async (challengePDA: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const tx = await program.methods
      .startMiniGame()
      .accounts({
        challenge: challengePDA,
        player: wallet.publicKey,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    return tx;
  };

  // ✅ CLAIM MINI GAME WIN - cu confirmare
  const claimMiniGameWin = async (
    challengePDA: PublicKey,
    gameId: number,
    winner: PublicKey,
    loser: PublicKey
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [winnerStatePDA] = getPlayerStatePDA(program.programId, gameId, winner);
    const [loserStatePDA] = getPlayerStatePDA(program.programId, gameId, loser);

    const tx = await program.methods
      .claimMiniGameWin(winner)
      .accounts({
        challenge: challengePDA,
        game: gamePDA,
        winnerState: winnerStatePDA,
        loserState: loserStatePDA,
        claimer: wallet.publicKey,
      })
      .rpc({ skipPreflight: false, commitment: 'confirmed' });

    await confirmTransaction(program.provider.connection, tx);
    rpcCache.invalidate(`active_challenges_${gameId}_${wallet.publicKey!.toBase58()}`);
    rpcCache.invalidate(`my_challenges_${gameId}_${wallet.publicKey!.toBase58()}`);
    rpcCache.invalidate(`player_stats_${gameId}_${wallet.publicKey!.toBase58()}`);
    return tx;
  };

  const getPendingChallenges = async (gameId: number): Promise<Challenge[]> => {
    if (!program || !wallet.publicKey) return [];

    const cacheKey = `pending_challenges_${gameId}_${wallet.publicKey.toBase58()}`;

    return rpcCache.get(
      cacheKey,
      async () => {
        try {
          const challenges = await (program.account as any).challenge.all([
            {
              memcmp: {
                offset: 8 + 8,
                bytes: bs58.encode(new BN(gameId).toArrayLike(Buffer, "le", 8)),
              }
            }
          ]);

          return challenges
            .filter((c: any) =>
              c.account.opponent.equals(wallet.publicKey) &&
              c.account.status.pending
            )
            .map((c: any) => ({
              publicKey: c.publicKey,
              challengeId: c.account.challengeId.toNumber(),
              gameId: c.account.gameId.toNumber(),
              challenger: c.account.challenger,
              opponent: c.account.opponent,
              betAmount: c.account.betAmount.toNumber() / LAMPORTS_PER_SOL,
              gameType: Object.keys(c.account.gameType)[0] as MiniGameType,
              status: Object.keys(c.account.status)[0] as ChallengeStatus,
              createdAt: new Date(c.account.createdAt.toNumber() * 1000),
              acceptedAt: c.account.acceptedAt ? new Date(c.account.acceptedAt.toNumber() * 1000) : null,
              gameStartedAt: c.account.gameStartedAt ? new Date(c.account.gameStartedAt.toNumber() * 1000) : null,
              winner: c.account.winner,
              opponentDeclineCount: c.account.opponentDeclineCount,
            }));
        } catch (error) {
          return [];
        }
      },
      15000
    );
  };

  const getMyChallenges = async (gameId: number): Promise<Challenge[]> => {
    if (!program || !wallet.publicKey) return [];

    const cacheKey = `my_challenges_${gameId}_${wallet.publicKey.toBase58()}`;

    return rpcCache.get(
      cacheKey,
      async () => {
        try {
          const challenges = await (program.account as any).challenge.all([
            {
              memcmp: {
                offset: 8 + 8,
                bytes: bs58.encode(new BN(gameId).toArrayLike(Buffer, "le", 8)),
              }
            }
          ]);

          return challenges
            .filter((c: any) => c.account.challenger.equals(wallet.publicKey))
            .map((c: any) => ({
              publicKey: c.publicKey,
              challengeId: c.account.challengeId.toNumber(),
              gameId: c.account.gameId.toNumber(),
              challenger: c.account.challenger,
              opponent: c.account.opponent,
              betAmount: c.account.betAmount.toNumber() / LAMPORTS_PER_SOL,
              gameType: Object.keys(c.account.gameType)[0] as MiniGameType,
              status: Object.keys(c.account.status)[0] as ChallengeStatus,
              createdAt: new Date(c.account.createdAt.toNumber() * 1000),
              acceptedAt: c.account.acceptedAt ? new Date(c.account.acceptedAt.toNumber() * 1000) : null,
              gameStartedAt: c.account.gameStartedAt ? new Date(c.account.gameStartedAt.toNumber() * 1000) : null,
              winner: c.account.winner,
              opponentDeclineCount: c.account.opponentDeclineCount,
            }));
        } catch (error) {
          return [];
        }
      },
      12000
    );
  };

  const getGameEvents = async (gameId: number): Promise<GameEvent[]> => {
    if (!program) return [];

    const cacheKey = `game_events_${gameId}`;

    return rpcCache.get(
      cacheKey,
      async () => {
        try {
          const [gamePDA] = getGamePDA(program.programId, gameId);
          const game = await (program.account as any).game.fetch(gamePDA);
          const events: GameEvent[] = [];

          if (game.events && Array.isArray(game.events)) {
            game.events.forEach((event: any) => {
              const eventType = Object.keys(event.eventType)[0];
              const poolAffected = Object.keys(event.poolAffected)[0];

              const mappedEvent: GameEvent = {
                eventType: eventType as GameEvent['eventType'],
                poolAffected: poolAffected as GameEvent['poolAffected'],
                timestamp: new Date(event.timestamp.toNumber() * 1000),
                phaseNumber: event.phaseNumber,
                newValue: event.newValue?.toNumber(),
                multiplier: event.multiplier?.toNumber(),
                participant: event.participant || undefined,
              };

              events.push(mappedEvent);
            });
          }

          return events;
        } catch (error) {
          return [];
        }
      },
      15000
    );
  };

  const getActiveChallenges = async (gameId: number): Promise<Challenge[]> => {
    if (!program || !wallet.publicKey) return [];

    const cacheKey = `active_challenges_${gameId}_${wallet.publicKey.toBase58()}`;

    return rpcCache.get(
      cacheKey,
      async () => {
        try {
          const challenges = await (program.account as any).challenge.all([
            {
              memcmp: {
                offset: 8 + 8,
                bytes: bs58.encode(new BN(gameId).toArrayLike(Buffer, "le", 8)),
              }
            }
          ]);

          return challenges
            .filter((c: any) =>
              (c.account.challenger.equals(wallet.publicKey) || c.account.opponent.equals(wallet.publicKey)) &&
              (c.account.status.accepted || c.account.status.bothReady || c.account.status.inProgress)
            )
            .map((c: any) => ({
              publicKey: c.publicKey,
              challengeId: c.account.challengeId.toNumber(),
              gameId: c.account.gameId.toNumber(),
              challenger: c.account.challenger,
              opponent: c.account.opponent,
              betAmount: c.account.betAmount.toNumber() / LAMPORTS_PER_SOL,
              gameType: Object.keys(c.account.gameType)[0] as MiniGameType,
              status: Object.keys(c.account.status)[0] as ChallengeStatus,
              createdAt: new Date(c.account.createdAt.toNumber() * 1000),
              acceptedAt: c.account.acceptedAt ? new Date(c.account.acceptedAt.toNumber() * 1000) : null,
              gameStartedAt: c.account.gameStartedAt ? new Date(c.account.gameStartedAt.toNumber() * 1000) : null,
              winner: c.account.winner,
              opponentDeclineCount: c.account.opponentDeclineCount,
            }));
        } catch (error) {
          return [];
        }
      },
      10000
    );
  };

  // ✅ ADVANCE TO PHASE 3 - cu confirmare
  const advanceToPhase3 = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .advanceToPhase3()
        .accounts({
          game: gamePDA,
          caller: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      toast.success('🎮 Phase 3 Started!');
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ MARK READY PHASE 3 - cu confirmare
  const markReadyPhase3 = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);
      const [readyStatePDA] = getPhase3ReadyStatePDA(
        program.programId,
        gameId,
        wallet.publicKey
      );

      const tx = await program.methods
        .markReadyPhase3()
        .accounts({
          game: gamePDA,
          readyState: readyStatePDA,
          player: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      toast.success('Marked as READY! ✓');
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ SUBMIT PHASE 3 WINNER - cu confirmare
  const submitPhase3Winner = async (gameId: number, winner: PublicKey) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .submitPhase3Winner(winner)
        .accounts({
          game: gamePDA,
          submitter: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      toast.success('🏆 Winner declared!');
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  // ✅ CLAIM PHASE 3 PRIZE - cu confirmare
  const claimPhase3Prize = async (gameId: number) => {
    console.log('🏆 [claimPhase3Prize] Starting...');

    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .claimPhase3Prize()
        .accounts({
          game: gamePDA,
          winner: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      console.log('📝 Transaction sent:', tx);
      await confirmTransaction(program.provider.connection, tx);
      console.log('✅ Prize claimed successfully!');

      toast.success('💰 Prize claimed!');
      await fetchGames(program);
      return tx;
    } catch (error: any) {
      console.error('❌ Error claiming prize:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ✅ START PHASE 3 GAME - cu confirmare
  const startPhase3Game = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const readyStates = await getPhase3ReadyStates(gameId);
      const remainingAccounts = readyStates.map(state => ({
        pubkey: getPhase3ReadyStatePDA(
          program.programId,
          gameId,
          new PublicKey(state.player)
        )[0],
        isSigner: false,
        isWritable: false,
      }));

      const tx = await program.methods
        .startPhase3Game()
        .accounts({
          game: gamePDA,
          caller: wallet.publicKey,
        })
        .remainingAccounts(remainingAccounts)
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      toast.success('🎮 THE PURGE BEGINS!');
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  const getPhase3ReadyStates = useCallback(async (gameId: number): Promise<Phase3ReadyState[]> => {
    if (!program) return [];

    try {
      const allReadyStates = await program.account.phase3ReadyState.all([
        {
          memcmp: {
            offset: 8,
            bytes: bs58.encode(new BN(gameId).toArrayLike(Buffer, "le", 8)),
          }
        }
      ]);

      return allReadyStates.map((state: any) => ({
        gameId: state.account.gameId.toNumber(),
        player: state.account.player.toBase58(),
        ready: state.account.ready,
        virtualBalance: state.account.virtualBalance
          ? state.account.virtualBalance.toNumber()
          : 0, // ✅ ADD THIS LINE!
        markedReadyAt: new Date(state.account.markedReadyAt.toNumber() * 1000),
      }));
    } catch (error) {
      return [];
    }
  }, [program]);

  const getPhase3ReadyStatePDA = (
    programId: PublicKey,
    gameId: number,
    player: PublicKey
  ): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('phase3_ready'),
        new BN(gameId).toArrayLike(Buffer, 'le', 8),
        player.toBuffer(),
      ],
      programId
    );
  };

  // ✅ CLAIM PLATFORM FEE - cu confirmare
  const claimPlatformFee = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .claimPlatformFee()
        .accounts({
          game: gamePDA,
          admin: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      toast.success('💰 Fee claimed!');
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };
  const forceRefundExpiredGame = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      const tx = await program.methods
        .forceRefundExpiredGame()
        .accounts({
          game: gamePDA,
          player: wallet.publicKey,
        })
        .rpc({ skipPreflight: false, commitment: 'confirmed' });

      await confirmTransaction(program.provider.connection, tx);
      toast.success('💰 Refund claimed!');
      await fetchGames(program);
      return tx;
    } finally {
      setLoading(false);
    }
  };

  return {
    program,
    games,
    loading,
    createGame,
    enterGame,
    startGame,
    startGameWithBatchInit,
    batchInitializeGameStates,
    initializePlayerState,
    initializePoolState,
    cancelGame,
    claimRefund,
    submitAllocations,
    claimRewards,
    advancePhase,
    getPlayerState,
    getPoolState,
    refreshGames: () => program && fetchGames(program),
    fetchGames: () => program && fetchGames(program),
    createChallenge,
    respondToChallenge,
    markReady,
    startMiniGame,
    claimMiniGameWin,
    getPendingChallenges,
    getActiveChallenges,
    getMyChallenges,
    getGameEvents,
    getPlayerPhase2Stats,
    advanceToPhase3,
    markReadyPhase3,
    startPhase3Game,
    getPhase3ReadyStates,
    claimPlatformFee,
    submitPhase3Winner,
    claimPhase3Prize,
    forceRefundExpiredGame,
  };
}