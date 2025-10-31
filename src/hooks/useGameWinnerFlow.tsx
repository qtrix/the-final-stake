// src/hooks/useGameWinnerFlow.tsx - VERSIUNE cu AUTO-RECOVERY
import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useSolanaGame } from '@/hooks/useSolanaGame';
import { toast } from 'sonner';

interface WinnerFlowOptions {
    gameId: string;
    sendWinner: (winnerId: string) => void;
    // ✅ NOI: Informații de la server pentru auto-recovery
    serverWinner?: string | null;  // Winner-ul stocat pe server
    serverGameStatus?: string;     // Status-ul jocului pe server (ended, active, etc)
    serverPrizeAmount?: number;    // Suma premiului
}

interface BlockchainWinnerState {
    hasWinner: boolean;
    winner: string | null;
    prizeClaimed: boolean;
    isChecking: boolean;
}

export const useGameWinnerFlow = ({
    gameId,
    sendWinner,
    serverWinner,
    serverGameStatus,
    serverPrizeAmount
}: WinnerFlowOptions) => {
    const navigate = useNavigate();
    const wallet = useWallet();
    const { games, submitPhase3Winner, loading } = useSolanaGame();

    const [isProcessingWinner, setIsProcessingWinner] = useState(false);
    const [blockchainState, setBlockchainState] = useState<BlockchainWinnerState>({
        hasWinner: false,
        winner: null,
        prizeClaimed: false,
        isChecking: true,
    });
    const [retryAttempts, setRetryAttempts] = useState(0);
    const MAX_RETRY_ATTEMPTS = 3;

    // ✅ NEW: Ref pentru a preveni multiple auto-recovery simultan
    const autoRecoveryInProgress = useRef(false);
    const hasAttemptedAutoRecovery = useRef(false);

    // ✅ VERIFICARE CONTINUĂ: Monitorizează starea din blockchain
    useEffect(() => {
        const checkBlockchainState = async () => {
            try {
                const game = games.find(g => g.gameId === parseInt(gameId));

                if (!game) {
                    setBlockchainState(prev => ({ ...prev, isChecking: false }));
                    return;
                }

                // ✅ FIX: Verifică explicit pentru null/undefined
                const rawWinner = game.phase3Winner;
                const winner = rawWinner ? rawWinner : null; // Convertește undefined în null
                const hasWinner = winner !== null && winner !== undefined;
                const prizeClaimed = game.phase3PrizeClaimed || false;

                setBlockchainState({
                    hasWinner,
                    winner,
                    prizeClaimed,
                    isChecking: false,
                });

                console.log('[WinnerFlow] 🔍 Blockchain state:', {
                    hasWinner,
                    winner: winner ? winner.slice(0, 8) + '...' : 'None',
                    prizeClaimed,
                });
            } catch (error) {
                console.error('[WinnerFlow] Error checking blockchain state:', error);
                setBlockchainState(prev => ({ ...prev, isChecking: false }));
            }
        };

        checkBlockchainState();

        // Verifică periodic (la fiecare 5 secunde)
        const interval = setInterval(checkBlockchainState, 5000);

        return () => clearInterval(interval);
    }, [games, gameId]);

    // ✅ NEW: AUTO-RECOVERY - Detectează și corectează automat discrepanța
    useEffect(() => {
        // Guard conditions
        if (!wallet.publicKey) {
            console.log('[WinnerFlow] 🔒 Auto-recovery skipped: wallet not connected');
            return;
        }

        if (blockchainState.isChecking) {
            console.log('[WinnerFlow] 🔍 Auto-recovery waiting: still checking blockchain');
            return;
        }

        if (isProcessingWinner || autoRecoveryInProgress.current) {
            console.log('[WinnerFlow] ⏳ Auto-recovery skipped: processing in progress');
            return;
        }

        if (hasAttemptedAutoRecovery.current) {
            console.log('[WinnerFlow] ✅ Auto-recovery already attempted in this session');
            return;
        }

        // ✅ DETECȚIE: Verifică dacă există discrepanță între server și blockchain
        const shouldAutoRecover =
            serverGameStatus === 'ended' &&              // Joc terminat pe server
            serverWinner &&                               // Există winner pe server
            !blockchainState.hasWinner;                   // DAR nu există pe blockchain

        if (shouldAutoRecover) {
            console.log('[WinnerFlow] 🚨 DISCREPANCY DETECTED!');
            console.log('[WinnerFlow] 📊 Server:', {
                status: serverGameStatus,
                winner: serverWinner?.slice(0, 8) + '...',
                prize: serverPrizeAmount
            });
            console.log('[WinnerFlow] ⛓️ Blockchain:', {
                hasWinner: blockchainState.hasWinner,
                winner: blockchainState.winner
            });

            // ✅ TRIGGER AUTO-RECOVERY
            autoRecoveryInProgress.current = true;
            hasAttemptedAutoRecovery.current = true;

            toast.info('Detected missing blockchain transaction. Attempting auto-recovery...', {
                duration: 5000
            });

            // Așteaptă un pic pentru UI feedback, apoi execută
            setTimeout(() => {
                console.log('[WinnerFlow] 🔄 Starting auto-recovery process...');
                autoRecoverBlockchainTransaction(serverWinner, serverPrizeAmount || 0);
            }, 1000);
        }

    }, [
        wallet.publicKey,
        blockchainState.isChecking,
        blockchainState.hasWinner,
        serverGameStatus,
        serverWinner,
        serverPrizeAmount,
        isProcessingWinner
    ]);

    /**
     * ✅ NEW: Auto-recovery function
     */
    const autoRecoverBlockchainTransaction = async (winnerId: string, prizeAmount: number) => {
        console.log('[WinnerFlow] 🔄 AUTO-RECOVERY: Attempting to declare winner on blockchain...');

        setIsProcessingWinner(true);

        try {
            toast.loading('Auto-recovery: Declaring winner on blockchain...', { id: 'auto-recovery' });

            // Execută tranzacția blockchain
            const winnerPubkey = new PublicKey(winnerId);
            await submitPhase3Winner(parseInt(gameId), winnerPubkey);

            console.log('[WinnerFlow] ✅ AUTO-RECOVERY SUCCESS!');
            toast.success('Winner successfully declared on blockchain!', { id: 'auto-recovery' });

            // Trimite la server pentru confirmare (poate că nu a ajuns prima dată)
            sendWinner(winnerId);

            // Așteaptă puțin pentru propagare
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Navighează la pagina de winner
            navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);

            // Reset state
            setRetryAttempts(0);

        } catch (error: any) {
            console.error('[WinnerFlow] ❌ AUTO-RECOVERY FAILED:', error);

            // Verifică dacă winner-ul e deja declarat
            if (error.message?.includes('already declared') || error.message?.includes('already set')) {
                console.log('[WinnerFlow] ℹ️ Winner was already declared (race condition)');
                toast.info('Winner already declared on blockchain!', { id: 'auto-recovery' });

                // Navighează oricum
                navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);
            } else {
                toast.error(`Auto-recovery failed: ${error.message}`, {
                    id: 'auto-recovery',
                    duration: 7000,
                    description: 'You can manually retry from the game page.'
                });

                setRetryAttempts(prev => prev + 1);
            }
        } finally {
            setIsProcessingWinner(false);
            autoRecoveryInProgress.current = false;
        }
    };

    /**
     * ✅ FUNCȚIE ÎMBUNĂTĂȚITĂ: Declară câștigătorul
     */
    const declareWinner = useCallback(async (winnerId: string, prizeAmount: number) => {
        if (isProcessingWinner) {
            console.log('[WinnerFlow] Already processing winner');
            return;
        }

        if (!wallet.publicKey) {
            toast.error('Wallet not connected');
            return;
        }

        setIsProcessingWinner(true);

        try {
            console.log('[WinnerFlow] 🏆 Starting winner declaration:', winnerId.slice(0, 8) + '...');

            // ✅ STEP 0: Verifică dacă winner-ul e deja pe blockchain
            if (blockchainState.hasWinner && blockchainState.winner) {
                if (blockchainState.winner === winnerId) {
                    console.log('[WinnerFlow] ✅ Winner already on blockchain!');
                    toast.success('Winner already declared on blockchain!');

                    // Trimite la server pentru siguranță
                    sendWinner(winnerId);

                    // Navighează direct
                    navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);
                    return;
                } else {
                    toast.error('A different winner is already declared on blockchain!');
                    return;
                }
            }

            toast.loading('Declaring winner on blockchain...', { id: 'winner-process' });

            // ✅ STEP 1: BLOCKCHAIN FIRST - Execută tranzacția blockchain
            console.log('[WinnerFlow] 💎 Executing blockchain transaction...');

            const winnerPubkey = new PublicKey(winnerId);
            await submitPhase3Winner(parseInt(gameId), winnerPubkey);

            console.log('[WinnerFlow] ✅ Blockchain transaction confirmed!');
            toast.success('Winner declared on blockchain!', { id: 'winner-process' });

            // ✅ STEP 2: Trimite la server DUPĂ blockchain
            console.log('[WinnerFlow] 📤 Sending winner to server...');
            sendWinner(winnerId);

            // Așteaptă server să proceseze
            await new Promise(resolve => setTimeout(resolve, 500));

            // ✅ STEP 3: Navighează la pagina de winner
            console.log('[WinnerFlow] 🎉 Navigating to winner page...');
            navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);

            // Reset retry counter
            setRetryAttempts(0);

        } catch (error: any) {
            console.error('[WinnerFlow] ❌ Error declaring winner:', error);

            // Handle specific errors
            if (error.message?.includes('already declared') || error.message?.includes('already set')) {
                toast.info('Winner already declared!', { id: 'winner-process' });
                sendWinner(winnerId);
                navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);
            } else {
                toast.error(error.message || 'Failed to declare winner', { id: 'winner-process' });
                setRetryAttempts(prev => prev + 1);
            }
        } finally {
            setIsProcessingWinner(false);
        }
    }, [gameId, sendWinner, wallet.publicKey, submitPhase3Winner, navigate, isProcessingWinner, blockchainState]);

    /**
     * ✅ FUNCȚIE: Retry pentru tranzacția blockchain
     */
    const retryBlockchainTransaction = useCallback(async (winnerId: string, prizeAmount: number) => {
        if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
            toast.error(`Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached`);
            return;
        }

        if (!wallet.publicKey) {
            toast.error('Wallet not connected');
            return;
        }

        console.log(`[WinnerFlow] 🔄 Retry attempt ${retryAttempts + 1}/${MAX_RETRY_ATTEMPTS}`);

        setIsProcessingWinner(true);

        try {
            // Verifică din nou starea
            if (blockchainState.hasWinner && blockchainState.winner === winnerId) {
                console.log('[WinnerFlow] ✅ Winner already on blockchain!');
                toast.success('Winner already declared on blockchain!');
                navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);
                setRetryAttempts(0);
                return;
            }

            toast.loading('Retrying blockchain transaction...', { id: 'winner-retry' });

            // Execută tranzacția
            const winnerPubkey = new PublicKey(winnerId);
            await submitPhase3Winner(parseInt(gameId), winnerPubkey);

            toast.success('Blockchain transaction successful!', { id: 'winner-retry' });

            // Trimite la server
            sendWinner(winnerId);

            // Navighează după succes
            await new Promise(resolve => setTimeout(resolve, 500));
            navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);

            setRetryAttempts(0);
        } catch (error: any) {
            console.error('[WinnerFlow] ❌ Retry failed:', error);
            toast.error(`Retry failed: ${error.message}`, { id: 'winner-retry' });
            setRetryAttempts(prev => prev + 1);
        } finally {
            setIsProcessingWinner(false);
        }
    }, [gameId, wallet.publicKey, submitPhase3Winner, sendWinner, navigate, retryAttempts, blockchainState]);

    /**
     * ✅ FUNCȚIE: Verifică și sincronizează starea
     */
    const syncBlockchainState = useCallback(async (winnerId: string, prizeAmount: number) => {
        console.log('[WinnerFlow] 🔄 Syncing blockchain state...');

        const game = games.find(g => g.gameId === parseInt(gameId));

        if (!game) {
            toast.error('Game not found');
            return;
        }

        const onchainWinner = game.phase3Winner;

        if (!onchainWinner) {
            // Winner NU e pe blockchain
            console.log('[WinnerFlow] ⚠️ Winner NOT on blockchain, attempting to set...');
            toast.info('Winner not on blockchain. Submitting transaction...');
            await retryBlockchainTransaction(winnerId, prizeAmount);
        } else if (onchainWinner === winnerId) {
            // Winner e corect pe blockchain
            console.log('[WinnerFlow] ✅ Blockchain state is correct!');
            toast.success('Blockchain is already synced!');
            navigate(`/phase3-winner?gameId=${gameId}&winner=${winnerId}&prize=${prizeAmount.toFixed(4)}`);
        } else {
            // Alt winner e pe blockchain
            console.log('[WinnerFlow] ⚠️ Different winner on blockchain!');
            toast.error('A different winner is declared on blockchain');
        }
    }, [games, gameId, navigate, retryBlockchainTransaction]);

    /**
     * ✅ HELPER: Verifică dacă trebuie să se facă tranzacția blockchain
     */
    const needsBlockchainTransaction = useCallback((winnerId: string): boolean => {
        // Dacă încă verifică, așteaptă
        if (blockchainState.isChecking) {
            console.log('[WinnerFlow] 🔍 Still checking blockchain...');
            return false;
        }

        // ✅ FIX PRINCIPAL: Dacă nu există winner pe blockchain, trebuie tranzacție
        if (!blockchainState.hasWinner) {
            console.log('[WinnerFlow] ⚠️ NO winner on blockchain → NEEDS TRANSACTION');
            return true;
        }

        // Dacă winner-ul e diferit, conflict - nu permite
        if (blockchainState.winner && blockchainState.winner !== winnerId) {
            console.log('[WinnerFlow] ⚠️ Different winner on blockchain → CONFLICT');
            return false;
        }

        // Winner corect deja pe blockchain
        console.log('[WinnerFlow] ✅ Correct winner already on blockchain');
        return false;
    }, [blockchainState]);

    /**
     * ✅ NEW: Reset auto-recovery state (util pentru testing sau refresh manual)
     */
    const resetAutoRecovery = useCallback(() => {
        hasAttemptedAutoRecovery.current = false;
        autoRecoveryInProgress.current = false;
        console.log('[WinnerFlow] 🔄 Auto-recovery state reset');
    }, []);

    return {
        // Funcții principale
        declareWinner,
        retryBlockchainTransaction,
        syncBlockchainState,
        resetAutoRecovery,

        // Stare
        isProcessingWinner,
        blockchainState,
        retryAttempts,
        maxRetries: MAX_RETRY_ATTEMPTS,
        needsBlockchainTransaction,

        // Loading states
        isLoading: isProcessingWinner || loading || blockchainState.isChecking,
        canRetry: retryAttempts < MAX_RETRY_ATTEMPTS,

        // ✅ NEW: Auto-recovery info
        hasAttemptedAutoRecovery: hasAttemptedAutoRecovery.current,
        isAutoRecovering: autoRecoveryInProgress.current,
    };
};