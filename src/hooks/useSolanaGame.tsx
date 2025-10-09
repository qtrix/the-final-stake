// src/hooks/useSolanaGame.tsx - VERSIUNE FINALĂ COMPLETĂ
import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import solanaIdl from '../lib/solana_survivor.json';
import bs58 from 'bs58';

// ✅ UPDATED PROGRAM ID - deployed contract
const PROGRAM_ID = new PublicKey('AU3td9Pd4mU5XTn8fQUwKjZZhMsizEpQNjtbMBbfvJvi');

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
  // ✅ NEW: Phase 2 requirements calculated by contract
  phase2RequiredGames: number;
  phase2MaxGamesPerOpponent: number;
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

// ✅ NEW: Phase 2 player statistics
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

// PDA Derivation Functions - these must match the contract exactly
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

  // Rate limiting to prevent excessive RPC calls
  const fetchInProgressRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const FETCH_COOLDOWN_MS = 5000;

  console.log('🔄 useSolanaGame render:', {
    connected: wallet.connected,
    publicKey: wallet.publicKey?.toBase58(),
    programExists: !!program,
    attempts: initializationAttempts
  });

  // Initialize Anchor program connection
  useEffect(() => {
    const initializeProgram = async () => {
      setInitializationAttempts(prev => prev + 1);
      console.log('=== PROGRAM INITIALIZATION ATTEMPT ===', initializationAttempts + 1);

      try {
        console.log('🚀 Starting Anchor program initialization with new Program ID...');
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        let provider;
        if (wallet.connected && wallet.publicKey) {
          console.log('🔗 Creating provider with connected wallet:', wallet.publicKey.toBase58());
          provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: 'confirmed' });
        } else {
          console.log('📖 Creating read-only provider (no wallet)');
          const dummyWallet = {
            publicKey: new PublicKey('11111111111111111111111111111111'),
            signTransaction: async (tx: any) => tx,
            signAllTransactions: async (txs: any) => txs,
          };
          provider = new AnchorProvider(connection, dummyWallet as any, { preflightCommitment: 'confirmed' });
        }

        const prog = new Program(solanaIdl as any, provider);
        setProgram(prog);
        console.log('✅ Program initialized with ID:', PROGRAM_ID.toBase58());

        console.log('🎮 Fetching existing games...');
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
          // ✅ Read Phase 2 requirements from contract
          phase2RequiredGames: g.phase2RequiredGames || 5,
          phase2MaxGamesPerOpponent: g.phase2MaxGamesPerOpponent || 3,
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

  // Fetch player state and normalize from lamports to SOL
  const getPlayerState = async (gameId: number, playerPubkey?: PublicKey): Promise<PlayerGameState | null> => {
    if (!program || !playerPubkey) return null;

    try {
      const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, playerPubkey);
      const playerState = await (program.account as any).playerGameState.fetch(playerStatePDA);

      console.log('📊 Player state for', playerPubkey.toBase58().slice(0, 8), ':', {
        virtualBalance: playerState.virtualBalance.toNumber(),
        totalEarned: playerState.totalEarned?.toNumber() || 0,
        lastClaimTime: playerState.lastClaimTime?.toNumber() || 0,
      });

      // ✅ Normalize from lamports to SOL for easier frontend calculations
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
      console.warn(`⚠️ Player state not found for ${playerPubkey.toBase58().slice(0, 8)}...`);
      return null;
    }
  };

  // Fetch pool state and normalize from lamports to SOL
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

  // ✅ NEW: Get player's Phase 2 statistics by analyzing completed challenges
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
      // Fetch all challenges for this game
      const allChallenges = await (program.account as any).challenge.all([
        {
          memcmp: {
            offset: 8 + 8, // discriminator + challenge_id
            bytes: bs58.encode(new BN(gameId).toArrayLike(Buffer, "le", 8)),
          }
        }
      ]);

      const playerAddress = playerPubkey.toBase58();

      let totalGamesPlayed = 0;
      let gamesWon = 0;
      let gamesLost = 0;
      const opponentPlayCounts: Record<string, number> = {};

      // Analyze each challenge to build statistics
      allChallenges.forEach((c: any) => {
        const challenge = c.account;
        const isParticipant =
          challenge.challenger.toBase58() === playerAddress ||
          challenge.opponent.toBase58() === playerAddress;

        if (!isParticipant) return;

        // Only count completed games with a winner
        if (challenge.status.completed && challenge.winner) {
          totalGamesPlayed++;

          const opponentAddr = challenge.challenger.toBase58() === playerAddress
            ? challenge.opponent.toBase58()
            : challenge.challenger.toBase58();

          // Track how many games played against each opponent
          opponentPlayCounts[opponentAddr] = (opponentPlayCounts[opponentAddr] || 0) + 1;

          // Track wins and losses
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
      console.error('Error fetching player Phase 2 stats:', error);
      return {
        totalGamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        opponentPlayCounts: {}
      };
    }
  };

  const createGame = async (params: CreateGameParams) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    setLoading(true);
    try {
      console.log('🎮 Attempting to create game on Solana...');

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
        .rpc();

      console.log('✅ Game created on Solana! TX:', tx);
      await fetchGames(program);
      return tx;
    } catch (err: any) {
      console.error('❌ Error creating game on Solana:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const enterGame = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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
        .rpc();

      console.log('✅ Successfully joined game on Solana! TX:', tx);
      await fetchGames(program);
      return tx;
    } catch (err: any) {
      console.error('❌ Error joining game on Solana:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Batch initialize all player states in a game (for already started games)
  const batchInitializeGameStates = async (
    gameId: number,
    onProgress?: (progress: InitProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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

      // Process players in batches of 10 to avoid overwhelming the network
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
          currentStep: `Initializing players ${i * BATCH_SIZE + 1}-${Math.min((i + 1) * BATCH_SIZE, players.length)} of ${players.length}...`,
        });

        // Initialize all players in this batch in parallel
        const initPromises = batch.map(async (player: PublicKey) => {
          try {
            const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, player);

            await program.methods
              .initializePlayerState()
              .accounts({
                playerState: playerStatePDA,
                game: gamePDA,
                player: player,
                systemProgram: SystemProgram.programId,
              })
              .rpc();

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
      await program.methods
        .initializePoolState()
        .accounts({
          poolState: poolStatePDA,
          game: gamePDA,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

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

  // Start game with automatic batch initialization
  const startGameWithBatchInit = async (
    gameId: number,
    onProgress?: (progress: InitProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      onProgress?.({
        status: 'starting',
        progress: 5,
        currentStep: 'Starting game...',
      });

      const [gamePDA] = getGamePDA(program.programId, gameId);
      await program.methods
        .startGame()
        .accounts({
          game: gamePDA,
          creator: wallet.publicKey,
        })
        .rpc();

      // Now initialize all states
      await batchInitializeGameStates(gameId, (progress) => {
        // Adjust progress to account for start_game (5% done)
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

  const initializePlayerState = async (gameId: number): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);

    await program.methods
      .initializePlayerState()
      .accounts({
        playerState: playerStatePDA,
        game: gamePDA,
        player: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await fetchGames(program);
  };

  const initializePoolState = async (gameId: number): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

    await program.methods
      .initializePoolState()
      .accounts({
        poolState: poolStatePDA,
        game: gamePDA,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await fetchGames(program);
  };

  // Submit resource allocations - converts SOL amounts to lamports for contract
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
      throw new Error('Wallet not connected or program not initialized');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);
    const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

    console.log('📤 Submitting allocations (SOL):', allocations);

    // Convert SOL amounts to lamports before sending to contract
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
      .rpc();

    console.log('✅ Allocations submitted successfully! TX:', tx);
    return tx;
  };

  // Claim ongoing rewards during phase
  const claimRewards = async (gameId: number): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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
      .rpc();

    return tx;
  };

  // Claim rewards for all players at phase end (used for batch processing)
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

    // Batch in groups of 10
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

          await program.methods
            .claimPhaseEndRewards()
            .accounts({
              playerState: playerStatePDA,
              poolState: poolStatePDA,
              game: gamePDA,
              player: player,
            })
            .rpc();

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

  // Advance to next phase (simplified - only advances and claims for caller)
  const advancePhase = async (
    gameId: number,
    onProgress?: (progress: PhaseAdvanceProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      onProgress?.({ step: 'Advancing to next phase...', progress: 50 });

      const [gamePDA] = getGamePDA(program.programId, gameId);
      await program.methods
        .advancePhase()
        .accounts({
          game: gamePDA,
          caller: wallet.publicKey,
        })
        .rpc();

      onProgress?.({ step: 'Phase advanced! Claiming your rewards...', progress: 75 });

      // Claim rewards for the caller
      const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);
      const [poolStatePDA] = getPoolStatePDA(program.programId, gameId);

      await program.methods
        .claimPhaseEndRewards()
        .accounts({
          playerState: playerStatePDA,
          poolState: poolStatePDA,
          game: gamePDA,
          player: wallet.publicKey,
        })
        .rpc();

      onProgress?.({ step: 'Phase advanced! Your rewards claimed!', progress: 100 });
      await fetchGames(program);
    } catch (error: any) {
      onProgress?.({
        step: 'Failed to advance phase',
        progress: 0,
      });
      throw error;
    }
  };

  const startGame = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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
        .rpc();

      console.log('✅ Game started on Solana! TX:', tx);
      await fetchGames(program);
      return tx;
    } catch (err) {
      console.error('❌ Error starting game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelGame = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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
        .rpc();

      console.log('✅ Game cancelled! TX:', tx);
      await fetchGames(program);
      return tx;
    } catch (err) {
      console.error('❌ Error cancelling game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const claimRefund = async (gameId: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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
        .rpc();

      console.log('✅ Refund claimed! TX:', tx);
      await fetchGames(program);
      return tx;
    } catch (err) {
      console.error('❌ Error claiming refund:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ==================== PHASE 2 FUNCTIONS ====================

  const createChallenge = async (
    gameId: number,
    opponent: PublicKey,
    betAmount: number, // in SOL
    gameType: MiniGameType
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    const [gamePDA] = getGamePDA(program.programId, gameId);
    const [playerStatePDA] = getPlayerStatePDA(program.programId, gameId, wallet.publicKey);

    const timestamp = Math.floor(Date.now() / 1000);
    const [challengePDA] = getChallengePDA(program.programId, gameId, wallet.publicKey, opponent, timestamp);

    // Convert game type to enum format expected by contract
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
      .rpc();

    console.log('✅ Challenge created! TX:', tx);
    return tx;
  };

  const respondToChallenge = async (
    challengePDA: PublicKey,
    gameId: number,
    accept: boolean
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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
      .rpc();

    console.log(`✅ Challenge ${accept ? 'accepted' : 'declined'}! TX:`, tx);
    return tx;
  };

  const markReady = async (challengePDA: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    const tx = await program.methods
      .readyForGame()
      .accounts({
        challenge: challengePDA,
        player: wallet.publicKey,
      })
      .rpc();

    console.log('✅ Marked ready! TX:', tx);
    return tx;
  };

  const startMiniGame = async (challengePDA: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    const tx = await program.methods
      .startMiniGame()
      .accounts({
        challenge: challengePDA,
        player: wallet.publicKey,
      })
      .rpc();

    console.log('✅ Mini game started! TX:', tx);
    return tx;
  };

  const claimMiniGameWin = async (
    challengePDA: PublicKey,
    gameId: number,
    winner: PublicKey,
    loser: PublicKey
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
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
      .rpc();

    console.log('✅ Win claimed! TX:', tx);
    return tx;
  };

  const getPendingChallenges = async (gameId: number): Promise<Challenge[]> => {
    if (!program || !wallet.publicKey) return [];

    try {
      const challenges = await (program.account as any).challenge.all([
        {
          memcmp: {
            offset: 8 + 8, // discriminator + challenge_id
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
      console.error('Error fetching pending challenges:', error);
      return [];
    }
  };

  const getActiveChallenges = async (gameId: number): Promise<Challenge[]> => {
    if (!program || !wallet.publicKey) return [];

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
      console.error('Error fetching active challenges:', error);
      return [];
    }
  };

  const getMyChallenges = async (gameId: number): Promise<Challenge[]> => {
    if (!program || !wallet.publicKey) return [];

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
      console.error('Error fetching my challenges:', error);
      return [];
    }
  };

  // Fetch game events from the contract
  const getGameEvents = async (gameId: number): Promise<GameEvent[]> => {
    if (!program) return [];

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
      console.error('Error fetching game events:', error);
      return [];
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
    // Phase 2 functions
    createChallenge,
    respondToChallenge,
    markReady,
    startMiniGame,
    claimMiniGameWin,
    getPendingChallenges,
    getActiveChallenges,
    getMyChallenges,
    getGameEvents,
    getPlayerPhase2Stats, // ✅ NEW
  };
}