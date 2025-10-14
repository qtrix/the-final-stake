import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import RockPaperScissorsGame from './games/RockPaperScissorsGame';
import type { MiniGameType } from '@/hooks/useSolanaGame';

interface GameModalProps {
    challengePDA: PublicKey;
    challengeId: string;
    gameType: MiniGameType;
    challenger: PublicKey;
    opponent: PublicKey;
    betAmount: number;
    myAddress: PublicKey;
    onGameEnd: (winner: PublicKey) => void;
    onClose: () => void;
}

export default function GameModal({
    challengePDA,
    challengeId,
    gameType,
    challenger,
    opponent,
    betAmount,
    myAddress,
    onGameEnd,
    onClose,
}: GameModalProps) {
    const isChallenger = myAddress.equals(challenger);
    const opponentAddress = isChallenger ? opponent : challenger;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-2xl">✂️</span>
                            Rock Paper Scissors Battle
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="hover:bg-red-500/10"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                    <div className="flex items-center justify-between mt-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Bet Amount</p>
                            <p className="text-xl font-bold text-sol-orange">{betAmount.toFixed(4)} SOL</p>
                        </div>
                        <div className="text-right">
                            <p className="text-muted-foreground">Opponent</p>
                            <p className="font-mono text-sm">
                                {opponentAddress.toBase58().slice(0, 8)}...
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    <RockPaperScissorsGame
                        challengeId={challengeId}
                        playerAddress={myAddress}
                        opponentAddress={opponentAddress}
                        betAmount={betAmount}
                        onGameEnd={onGameEnd}
                    />
                </CardContent>
            </Card>
        </div>
    );
}