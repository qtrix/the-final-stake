// src/utils/transactionHelper.ts
import { Connection } from '@solana/web3.js';
import { toast } from 'sonner';

/**
 * Confirm a Solana transaction with retry logic
 */
export const confirmTransaction = async (
    connection: Connection,
    signature: string,
    maxRetries: number = 3
): Promise<void> => {
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const latestBlockhash = await connection.getLatestBlockhash('confirmed');

            await connection.confirmTransaction(
                {
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                },
                'confirmed'
            );

            console.log('✅ Transaction confirmed:', signature);
            return;
        } catch (error: any) {
            retries++;
            console.warn(`⚠️ Confirmation attempt ${retries}/${maxRetries} failed:`, error.message);

            if (retries >= maxRetries) {
                throw new Error(`Failed to confirm transaction after ${maxRetries} attempts: ${error.message}`);
            }

            // Wait before retry (longer exponential backoff: 5s, 10s, 20s)
            const delay = Math.pow(2, retries) * 2500; // Increased from 1000 to 2500
            console.log(`⏳ Waiting ${delay / 1000}s before next confirmation attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

/**
 * Execute a Solana transaction with proper error handling and loading states
 */
export interface ExecuteTransactionOptions<T> {
    operation: () => Promise<string>; // Returns transaction signature
    setLoading: (loading: boolean) => void;
    onSuccess?: (signature: string, result?: T) => void | Promise<void>;
    onError?: (error: Error) => void;
    successMessage?: string;
    errorMessage?: string;
    connection: Connection;
    skipConfirmation?: boolean;
}

export async function executeTransaction<T = void>({
    operation,
    setLoading,
    onSuccess,
    onError,
    successMessage = 'Transaction successful!',
    errorMessage = 'Transaction failed',
    connection,
    skipConfirmation = false,
}: ExecuteTransactionOptions<T>): Promise<string | null> {
    setLoading(true);

    try {
        console.log('📤 Executing transaction...');
        const signature = await operation();
        console.log('📝 Transaction signature:', signature);

        if (!skipConfirmation) {
            console.log('⏳ Confirming transaction...');
            await confirmTransaction(connection, signature);
        }

        toast.success(successMessage, {
            description: `Signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        });

        if (onSuccess) {
            await onSuccess(signature);
        }

        return signature;
    } catch (error: any) {
        console.error('❌ Transaction failed:', error);

        const errorMsg = error?.message || error?.toString() || 'Unknown error';

        toast.error(errorMessage, {
            description: errorMsg.length > 100 ? errorMsg.slice(0, 100) + '...' : errorMsg,
        });

        if (onError) {
            onError(error);
        }

        return null;
    } finally {
        setLoading(false);
    }
}

/**
 * Retry a transaction with exponential backoff
 */
export async function retryTransaction<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Retry] ${operationName} - Attempt ${attempt}/${maxRetries}`);
            const result = await operation();
            console.log(`[Retry] ${operationName} - Success`);
            return result;
        } catch (error: any) {
            lastError = error;
            const errorMessage = error?.message?.toLowerCase() || '';

            const isRetryable =
                errorMessage.includes('timeout') ||
                errorMessage.includes('blockhash not found') ||
                errorMessage.includes('block height exceeded') ||
                errorMessage.includes('transaction simulation failed') ||
                errorMessage.includes('node is behind');

            console.error(`[Retry] ${operationName} - Attempt ${attempt} failed:`, errorMessage);

            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }

            const delay = Math.pow(2, attempt - 1) * 1000;
            console.log(`[Retry] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}