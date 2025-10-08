import { useEffect, useState, useRef, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import solanaIdl from '../lib/solana_survivor.json';
import bs58 from 'bs58';

const PROGRAM_ID = new PublicKey(solanaIdl.address);

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

export type MiniGameType = 'CryptoTrivia' | 'RockPaperScissors' | 'SpeedTrading' | 'MemeBattle';
export type ChallengeStatus = 'Pending' | 'Accepted' | 'BothReady' | 'InProgress' | 'Completed' | 'Expired' | 'ForcedAccept';

export interface Challenge {
  publicKey: PublicKey;
  challengeId: number;
  gameId: number;
  challenger: PublicKey;
  opponent: PublicKey;
  betAmount: number; // in SOL
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
  progress: number; // 0-100
  currentStep: string;
  error?: string;
}

export interface PhaseAdvanceProgress {
  step: string;
  progress: number; // 0-100
  current?: number;
  total?: number;
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

  // Refs to prevent duplicate fetches and race conditions
  const fetchInProgressRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const FETCH_COOLDOWN_MS = 5000;

  console.log('🔄 useSolanaGame render:', {
    connected: wallet.connected,
    publicKey: wallet.publicKey?.toBase58(),
    programExists: !!program,
    attempts: initializationAttempts
  });

  // Initialize Anchor program
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
        console.log('✅ Program state updated');

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

        // Convert status to PascalCase to match TypeScript type
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

  // Fetch player state for a specific game and player
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
      console.warn(`⚠️ Player state not found for ${playerPubkey.toBase58().slice(0, 8)}... (may not be initialized yet)`);
      return null;
    }
  };

  // Fetch pool state for a specific game
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
      // Silent fail - state not initialized yet is expected
      return null;
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

  // Smart Game Initialization with Batching (for already started games)
  const batchInitializeGameStates = async (
    gameId: number,
    onProgress?: (progress: InitProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);

      // Step 1: Get player list from game
      onProgress?.({
        status: 'initializing-players',
        progress: 10,
        currentStep: 'Loading player list...',
      });

      const game = await (program.account as any).game.fetch(gamePDA);
      const players = game.players;

      // Step 2: Initialize players in batches of 10 (parallel)
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

        // Initialize batch in parallel
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

      // Step 3: Initialize pool state
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

      // Done!
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

  // Start game WITH batch initialization (for new games)
  const startGameWithBatchInit = async (
    gameId: number,
    onProgress?: (progress: InitProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      // Step 1: Start game
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

      // Step 2: Now do batch initialization
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

  // Initialize individual player state
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

  // Initialize pool state (creator only)
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

  // Submit Allocations (3 accounts needed)
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

    console.log('📤 Submitting allocations (lamports):', {
      mining: allocationsInLamports.mining.toString(),
      farming: allocationsInLamports.farming.toString(),
      trading: allocationsInLamports.trading.toString(),
      research: allocationsInLamports.research.toString(),
      social: allocationsInLamports.social.toString()
    });

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

  // Claim Rewards (3 accounts needed)
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

  // Claim Phase End Rewards (for all players before advancing phase)
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

  // Simplified Advance Phase - only advances and claims for creator
  const advancePhase = async (
    gameId: number,
    onProgress?: (progress: PhaseAdvanceProgress) => void
  ): Promise<void> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      // Step 1: Advance phase
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

      // Step 2: Claim rewards for the creator (caller)
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

    // Convert game type to enum format
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
            offset: 8 + 8, // After discriminator + challenge_id
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



  // Add this function to the hook
  const getGameEvents = async (gameId: number): Promise<GameEvent[]> => {
    if (!program) return [];

    try {
      const [gamePDA] = getGamePDA(program.programId, gameId);
      const game = await (program.account as any).game.fetch(gamePDA);

      const events: GameEvent[] = [];

      // Parse events from the game account
      if (game.events && Array.isArray(game.events)) {
        game.events.forEach((event: any) => {
          const eventType = Object.keys(event.eventType)[0];
          const poolAffected = Object.keys(event.poolAffected)[0];

          // Map contract event types to frontend types
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

      console.log('📊 Fetched game events:', events);
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
  };
}
