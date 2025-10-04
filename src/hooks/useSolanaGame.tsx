import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN, Idl } from '@project-serum/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import idlJson from '../lib/solana_survivor.json';

const PROGRAM_ID = new PublicKey('9piTJQs5dZT9wqu1Fx7cK1CGfTypYa8SGrVhgLnx2JhX');

// Use the IDL directly, bypassing strict typing
const idl = idlJson as any;

export interface Game {
  gameId: number;
  name: string;
  creator: string;
  entryFee: number;
  maxPlayers: number;
  currentPlayers: number;
  startTime: Date;
  expireTime: Date;
  status: 'WaitingForPlayers' | 'ReadyToStart' | 'InProgress' | 'Completed' | 'Cancelled' | 'Expired' | 'ExpiredWithPenalty' | 'waitingForPlayers' | 'readyToStart' | 'inProgress' | 'completed' | 'cancelled' | 'expired' | 'expiredWithPenalty';
  prizePool: number;
  players: string[];
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  winner?: string;
  gameStarted: boolean;
  refundedPlayers: string[];
  txSignature?: string;
}

interface CreateGameParams {
  gameName: string;
  entryFee: number;
  maxPlayers: number;
  startTime: Date;
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
  const FETCH_COOLDOWN_MS = 5000; // 5 seconds between fetches

  console.log('🔄 useSolanaGame render:', { 
    connected: wallet.connected, 
    publicKey: wallet.publicKey?.toBase58(),
    programExists: !!program,
    attempts: initializationAttempts
  });

  // Initialize Anchor program (works with or without wallet)
  useEffect(() => {
    const initializeProgram = async () => {
      setInitializationAttempts(prev => prev + 1);
      console.log('=== PROGRAM INITIALIZATION ATTEMPT ===', initializationAttempts + 1);
      console.log('Wallet state:', { 
        connected: wallet.connected, 
        publicKey: wallet.publicKey?.toBase58(),
        wallet: !!wallet 
      });

      try {
        console.log('🚀 Starting Anchor program initialization...');
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        console.log('✅ Connection created');
        
        // Create a read-only provider if wallet not connected
        let provider;
        if (wallet.connected && wallet.publicKey) {
          console.log('🔗 Creating provider with connected wallet:', wallet.publicKey.toBase58());
          provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: 'confirmed' });
        } else {
          console.log('📖 Creating read-only provider (no wallet)');
          // Create a dummy wallet for read-only operations
          const dummyWallet = {
            publicKey: new PublicKey('11111111111111111111111111111111'),
            signTransaction: async (tx: any) => tx,
            signAllTransactions: async (txs: any) => txs,
          };
          provider = new AnchorProvider(connection, dummyWallet as any, { preflightCommitment: 'confirmed' });
        }
        console.log('✅ Provider created successfully');
        
        console.log('📄 IDL validation:', { 
          hasIdl: !!idl, 
          programId: PROGRAM_ID.toBase58(),
          idlName: idl?.metadata?.name 
        });
        
        console.log('🔨 Creating Anchor program...');
        
        // Create a working IDL structure for @project-serum/anchor v0.26.0
        // This old version doesn't support the new IDL format, so we manually create it
        const workingIdl = {
          version: "0.1.0",
          name: "solana_survivor",
          instructions: [
            {
              name: "createGame",
              accounts: [
                { name: "game", isMut: true, isSigner: false },
                { name: "gameRegistry", isMut: true, isSigner: false },
                { name: "creator", isMut: true, isSigner: true },
                { name: "systemProgram", isMut: false, isSigner: false }
              ],
              args: [
                { name: "gameName", type: "string" },
                { name: "entryFee", type: "u64" },
                { name: "maxPlayers", type: "u8" },
                { name: "startTime", type: "i64" }
              ]
            },
            {
              name: "enterGame",
              accounts: [
                { name: "game", isMut: true, isSigner: false },
                { name: "player", isMut: true, isSigner: true },
                { name: "systemProgram", isMut: false, isSigner: false }
              ],
              args: []
            },
            {
              name: "startGame",
              accounts: [
                { name: "game", isMut: true, isSigner: false },
                { name: "creator", isMut: true, isSigner: true }
              ],
              args: []
            },
            {
              name: "claimRefund",
              accounts: [
                { name: "game", isMut: true, isSigner: false },
                { name: "player", isMut: true, isSigner: true }
              ],
              args: []
            },
            {
              name: "creatorCancelGame",
              accounts: [
                { name: "game", isMut: true, isSigner: false },
                { name: "creator", isMut: true, isSigner: true }
              ],
              args: []
            }
          ],
          accounts: [
            {
              name: "GameRegistry",
              type: {
                kind: "struct",
                fields: [
                  { name: "authority", type: "publicKey" },
                  { name: "gameCount", type: "u64" },
                  { name: "totalVolume", type: "u64" }
                ]
              }
            },
            {
              name: "Game",
              type: {
                kind: "struct",
                fields: [
                  { name: "game_id", type: "u64" },
                  { name: "name", type: "string" },
                  { name: "creator", type: "publicKey" },
                  { name: "entry_fee", type: "u64" },
                  { name: "max_players", type: "u8" },
                  { name: "current_players", type: "u8" },
                  { name: "start_time", type: "i64" },
                  { name: "expire_time", type: "i64" },
                  { name: "status", type: { defined: "GameStatus" } },
                  { name: "prize_pool", type: "u64" },
                  { name: "players", type: { vec: "publicKey" } },
                  { name: "created_at", type: "i64" },
                  { name: "started_at", type: { option: "i64" } },
                  { name: "ended_at", type: { option: "i64" } },
                  { name: "winner", type: { option: "publicKey" } },
                  { name: "game_started", type: "bool" },
                  { name: "refunded_players", type: { vec: "publicKey" } }
                ]
              }
            }
          ],
          types: [
            {
              name: "GameStatus",
              type: {
                kind: "enum",
                variants: [
                  { name: "WaitingForPlayers" },
                  { name: "ReadyToStart" },
                  { name: "InProgress" },
                  { name: "Completed" },
                  { name: "Cancelled" },
                  { name: "Expired" },
                  { name: "ExpiredWithPenalty" }
                ]
              }
            }
          ],
          events: [],
          errors: []
        };
        
        const prog = new Program(workingIdl as any, PROGRAM_ID, provider);
        console.log('✅ Program created with working IDL successfully:', !!prog);
        
        setProgram(prog);
        console.log('✅ Program state updated');

        console.log('🎮 Fetching existing games...');
        await fetchGames(prog);
      } catch (error) {
        console.error('❌ Failed to initialize program:', error);
        console.error('Error details:', error?.message, error?.stack);
        setProgram(null);
      }
    };

    // Initialize program on mount or when wallet changes
    initializeProgram();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up useSolanaGame hook');
      fetchInProgressRef.current = false;
    };
  }, [wallet.connected, wallet.publicKey?.toBase58()]);

  const fetchGames = async (prog: Program) => {
    // Check if fetch is already in progress
    if (fetchInProgressRef.current) {
      console.log('⏸️ Fetch already in progress, skipping...');
      return;
    }

    // Check cooldown period
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
      
      // Fetch all game accounts
      const accounts = await prog.account.game.all();
      console.log('📊 Raw accounts fetched:', accounts.length);
      console.log('📊 First account sample:', accounts[0]?.account);
      
      const formattedGames: Game[] = accounts.map((acc, index) => {
        try {
          const g = acc.account as any;
          console.log(`🔄 Processing game ${index}:`, {
            gameId: g.gameId?.toString(),
            entryFee: g.entryFee?.toString(),
            maxPlayers: g.maxPlayers,
            currentPlayers: g.currentPlayers,
            status: g.status
          });
          
          return {
            gameId: g.gameId.toNumber(),
            name: g.name || `Game #${g.gameId.toNumber()}`,
            creator: g.creator.toBase58(),
            entryFee: g.entryFee.toNumber() / LAMPORTS_PER_SOL,
            maxPlayers: g.maxPlayers,
            currentPlayers: g.currentPlayers,
            startTime: new Date(g.startTime.toNumber() * 1000),
            expireTime: new Date(g.expireTime.toNumber() * 1000),
            status: Object.keys(g.status)[0] as Game['status'],
            prizePool: g.prizePool.toNumber() / LAMPORTS_PER_SOL,
            players: g.players.map((p: PublicKey) => p.toBase58()),
            createdAt: new Date(g.createdAt.toNumber() * 1000),
            startedAt: g.startedAt ? new Date(g.startedAt.toNumber() * 1000) : undefined,
            endedAt: g.endedAt ? new Date(g.endedAt.toNumber() * 1000) : undefined,
            winner: g.winner ? g.winner.toBase58() : undefined,
            gameStarted: g.gameStarted || false,
            refundedPlayers: g.refundedPlayers ? g.refundedPlayers.map((p: PublicKey) => p.toBase58()) : [],
            txSignature: acc.publicKey.toBase58(),
          };
        } catch (mapError) {
          console.error(`❌ Error processing game ${index}:`, mapError);
          throw mapError;
        }
      });
      
      console.log('✅ Processed games:', formattedGames.length);
      setGames(formattedGames);
    } catch (err) {
      console.error('❌ Error fetching games:', err);
      console.error('❌ Error details:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
      setGames([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  };

  const createGame = async (params: CreateGameParams) => {
    console.log('createGame called with:', params);
    console.log('Wallet state:', { connected: wallet.connected, publicKey: wallet.publicKey?.toBase58() });
    
    if (!program || !wallet.publicKey) {
      console.error('Program or wallet not available:', { program: !!program, publicKey: !!wallet.publicKey });
      throw new Error('Wallet not connected or program not initialized');
    }
    
    setLoading(true);
    try {
      console.log('🎮 Attempting to create game on Solana...');
      
      const creatorPubkey = wallet.publicKey;
      
      // Find the game registry PDA
      const [gameRegistryPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('game_registry')], 
        program.programId
      );
      console.log('📍 Game Registry PDA:', gameRegistryPDA.toBase58());

      // Try to fetch the registry to get game count
      let gameId;
      try {
        const registry = await program.account.gameRegistry.fetch(gameRegistryPDA);
        gameId = registry.gameCount;
        console.log('📊 Current game count:', gameId.toString());
      } catch (registryError) {
        console.warn('⚠️ Could not fetch game registry, using timestamp as game ID');
        gameId = new BN(Date.now());
      }
      
      // Find the game PDA
      const [gamePDA] = await PublicKey.findProgramAddress(
        [Buffer.from('game'), gameId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      console.log('🎯 Game PDA:', gamePDA.toBase58());

      console.log('📝 Creating transaction...');
      const tx = await program.methods
        .createGame(
          params.gameName,
          new BN(params.entryFee * LAMPORTS_PER_SOL),
          params.maxPlayers,
          new BN(Math.floor(params.startTime.getTime() / 1000))
        )
        .accounts({
          game: gamePDA,
          gameRegistry: gameRegistryPDA,
          creator: creatorPubkey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      console.log('✅ Game created on Solana! TX:', tx);
      
      // Refresh games after successful creation
      await fetchGames(program);
      return tx;
    } catch (err: any) {
      console.error('❌ Error creating game on Solana:', err);
      
      // Check if transaction was actually processed (success despite error)
      if (err.transactionMessage && err.transactionMessage.includes('already been processed')) {
        console.log('🎉 Transaction already processed - game creation was successful!');
        // Refresh games to see the new game
        await fetchGames(program);
        return 'already_processed';
      }
      
      // Log detailed error info
      if (err.transactionLogs) {
        console.error('📋 Transaction logs:', err.transactionLogs);
      }
      if (err.programErrorStack) {
        console.error('🏗️ Program error stack:', err.programErrorStack);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const enterGame = async (gameId: number) => {
    console.log('enterGame called with gameId:', gameId);
    console.log('Wallet state:', { connected: wallet.connected, publicKey: wallet.publicKey?.toBase58() });
    
    if (!program || !wallet.publicKey) {
      console.error('Program or wallet not available:', { program: !!program, publicKey: !!wallet.publicKey });
      throw new Error('Wallet not connected or program not initialized');
    }
    
    setLoading(true);
    try {
      console.log('🎮 Attempting to join game on Solana...');
      
      const playerPubkey = wallet.publicKey;
      
      // Find the game PDA
      const [gamePDA] = await PublicKey.findProgramAddress(
        [Buffer.from('game'), new BN(gameId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      console.log('🎯 Game PDA for gameId', gameId, ':', gamePDA.toBase58());

      console.log('📝 Creating enter game transaction...');
      
      let gameAccount: any;
      try {
        // First try to fetch the game to understand its structure
        gameAccount = await program.account.game.fetch(gamePDA);
        console.log('🎮 Game account data:', gameAccount);
        console.log('💰 Entry fee required:', gameAccount.entryFee.toNumber() / LAMPORTS_PER_SOL, 'SOL');
        console.log('👥 Current players:', gameAccount.currentPlayers);
        console.log('🎯 Max players:', gameAccount.maxPlayers);
        console.log('📋 Players list:', gameAccount.players);
        console.log('⚡ Game status:', gameAccount.status);
        
        // Check if player already in game
        const playerAlreadyInGame = gameAccount.players.some((p: any) => 
          p.toBase58() === playerPubkey.toBase58()
        );
        console.log('🔍 Player already in game?', playerAlreadyInGame);
        
        if (playerAlreadyInGame) {
          throw new Error('You are already in this game!');
        }
        
      } catch (fetchError) {
        console.warn('⚠️ Could not fetch game account:', fetchError);
        throw fetchError;
      }
      
      console.log('💸 Player wallet balance check needed for', gameAccount.entryFee.toNumber() / LAMPORTS_PER_SOL, 'SOL');
      
      const tx = await program.methods
        .enterGame()
        .accounts({
          game: gamePDA,
          player: playerPubkey,
          systemProgram: web3.SystemProgram.programId
        })
        .rpc();

      console.log('✅ Successfully joined game on Solana! TX:', tx);
      
      // Refresh games after successful join
      await fetchGames(program);
      return tx;
    } catch (err: any) {
      console.error('❌ Error joining game on Solana:', err);
      
      // Log detailed transaction info
      if (err.transactionLogs) {
        console.error('📋 Transaction logs:', err.transactionLogs);
        
        // Check for insufficient funds
        const insufficientFundsLog = err.transactionLogs.find((log: string) => 
          log.includes('insufficient lamports')
        );
        
        if (insufficientFundsLog) {
          const match = insufficientFundsLog.match(/insufficient lamports (\d+), need (\d+)/);
          if (match) {
            const current = parseInt(match[1]) / LAMPORTS_PER_SOL;
            const needed = parseInt(match[2]) / LAMPORTS_PER_SOL;
            const shortage = needed - current;
            
            throw new Error(`Insufficient SOL! You have ${current.toFixed(3)} SOL but need ${needed.toFixed(3)} SOL. Please add ${shortage.toFixed(3)} SOL to your wallet.`);
          }
        }
      }
      
      // Check if transaction was already processed (success!)
      if (err.transactionMessage && err.transactionMessage.includes('already been processed')) {
        console.log('🎉 Transaction already processed - join was successful!');
        // Refresh games to see the updated state
        await fetchGames(program);
        return 'already_processed';
      }
      
      if (err.programErrorStack) {
        console.error('🏗️ Program error stack:', err.programErrorStack);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startGame = async (gameId: number) => {
    console.log('startGame called with gameId:', gameId);
    console.log('Wallet state:', { connected: wallet.connected, publicKey: wallet.publicKey?.toBase58() });
    
    if (!program || !wallet.publicKey) {
      console.error('Program or wallet not available:', { program: !!program, publicKey: !!wallet.publicKey });
      throw new Error('Wallet not connected or program not initialized');
    }
    
    setLoading(true);
    try {
      console.log('🎮 Attempting to start game on Solana...');
      
      const creatorPubkey = wallet.publicKey;
      
      // Find the game PDA
      const [gamePDA] = await PublicKey.findProgramAddress(
        [Buffer.from('game'), new BN(gameId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      console.log('🎯 Game PDA for gameId', gameId, ':', gamePDA.toBase58());

      console.log('📝 Creating start game transaction...');
      
      const tx = await program.methods
        .startGame()
        .accounts({
          game: gamePDA,
          creator: creatorPubkey
        })
        .rpc();

      console.log('✅ Successfully started game on Solana! TX:', tx);
      
      // Refresh games after successful start
      await fetchGames(program);
      return tx;
    } catch (err: any) {
      console.error('❌ Error starting game on Solana:', err);
      
      // Check if transaction was already processed (success!)
      if (err.transactionMessage && err.transactionMessage.includes('already been processed')) {
        console.log('🎉 Transaction already processed - start was successful!');
        await fetchGames(program);
        return 'already_processed';
      }
      
      if (err.transactionLogs) {
        console.error('📋 Transaction logs:', err.transactionLogs);
      }
      if (err.programErrorStack) {
        console.error('🏗️ Program error stack:', err.programErrorStack);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const claimRefund = async (gameId: number) => {
    console.log('claimRefund called with gameId:', gameId);
    console.log('Wallet state:', { connected: wallet.connected, publicKey: wallet.publicKey?.toBase58() });
    
    if (!program || !wallet.publicKey) {
      console.error('Program or wallet not available:', { program: !!program, publicKey: !!wallet.publicKey });
      throw new Error('Wallet not connected or program not initialized');
    }
    
    setLoading(true);
    try {
      console.log('💰 Attempting to claim refund on Solana...');
      
      const playerPubkey = wallet.publicKey;
      
      // Find the game PDA
      const [gamePDA] = await PublicKey.findProgramAddress(
        [Buffer.from('game'), new BN(gameId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      console.log('🎯 Game PDA for gameId', gameId, ':', gamePDA.toBase58());

      console.log('📝 Creating claim refund transaction...');
      
      const tx = await program.methods
        .claimRefund()
        .accounts({
          game: gamePDA,
          player: playerPubkey
        })
        .rpc();

      console.log('✅ Successfully claimed refund on Solana! TX:', tx);
      
      // Refresh games after successful refund
      await fetchGames(program);
      return tx;
    } catch (err: any) {
      console.error('❌ Error claiming refund on Solana:', err);
      
      // Check if transaction was already processed (success!)
      if (err.transactionMessage && err.transactionMessage.includes('already been processed')) {
        console.log('🎉 Transaction already processed - refund was successful!');
        await fetchGames(program);
        return 'already_processed';
      }
      
      if (err.transactionLogs) {
        console.error('📋 Transaction logs:', err.transactionLogs);
      }
      if (err.programErrorStack) {
        console.error('🏗️ Program error stack:', err.programErrorStack);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const creatorCancelGame = async (gameId: number) => {
    console.log('creatorCancelGame called with gameId:', gameId);
    console.log('Wallet state:', { connected: wallet.connected, publicKey: wallet.publicKey?.toBase58() });
    
    if (!program || !wallet.publicKey) {
      console.error('Program or wallet not available:', { program: !!program, publicKey: !!wallet.publicKey });
      throw new Error('Wallet not connected or program not initialized');
    }
    
    setLoading(true);
    try {
      console.log('🚫 Attempting to cancel game on Solana...');
      
      const creatorPubkey = wallet.publicKey;
      
      // Find the game PDA
      const [gamePDA] = await PublicKey.findProgramAddress(
        [Buffer.from('game'), new BN(gameId).toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      console.log('🎯 Game PDA for gameId', gameId, ':', gamePDA.toBase58());

      console.log('📝 Creating cancel game transaction...');
      
      const tx = await program.methods
        .creatorCancelGame()
        .accounts({
          game: gamePDA,
          creator: creatorPubkey
        })
        .rpc();

      console.log('✅ Successfully cancelled game on Solana! TX:', tx);
      
      // Refresh games after successful cancellation
      await fetchGames(program);
      return tx;
    } catch (err: any) {
      console.error('❌ Error cancelling game on Solana:', err);
      
      // Check if transaction was already processed (success!)
      if (err.transactionMessage && err.transactionMessage.includes('already been processed')) {
        console.log('🎉 Transaction already processed - cancel was successful!');
        await fetchGames(program);
        return 'already_processed';
      }
      
      if (err.transactionLogs) {
        console.error('📋 Transaction logs:', err.transactionLogs);
      }
      if (err.programErrorStack) {
        console.error('🏗️ Program error stack:', err.programErrorStack);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshGames = async () => {
    if (program) {
      await fetchGames(program);
    }
  };

  return {
    games,
    loading,
    createGame,
    enterGame,
    startGame,
    claimRefund,
    creatorCancelGame,
    refreshGames,
    connected: wallet.connected,
    address: wallet.publicKey?.toBase58(),
  };
}