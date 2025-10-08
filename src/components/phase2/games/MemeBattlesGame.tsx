import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface Meme {
    id: number;
    text: string;
    emoji: string;
}

const MEMES: Meme[] = [
    { id: 1, text: "When SOL hits ATH", emoji: "🚀" },
    { id: 2, text: "Checking wallet after dump", emoji: "😱" },
    { id: 3, text: "HODL Gang", emoji: "💎" },
    { id: 4, text: "Wen Moon?", emoji: "🌙" },
    { id: 5, text: "Buy the dip!", emoji: "📉" },
    { id: 6, text: "NGMI vs WAGMI", emoji: "⚔️" },
    { id: 7, text: "Trust me bro", emoji: "🤝" },
    { id: 8, text: "It's just a correction", emoji: "📊" },
    { id: 9, text: "Not financial advice", emoji: "🙃" },
    { id: 10, text: "Diamond hands only", emoji: "💎" },
];

interface MemeBattlesGameProps {
    challenger: PublicKey;
    opponent: PublicKey;
    myAddress: PublicKey;
    onComplete: (winner: PublicKey) => void;
}

export default function MemeBattlesGame({
    challenger,
    opponent,
    myAddress,
    onComplete,
}: MemeBattlesGameProps) {
    const [round, setRound] = useState(1);
    const [currentMemes, setCurrentMemes] = useState<[Meme, Meme]>([MEMES[0], MEMES[1]]);
    const [myScore, setMyScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [selectedMeme, setSelectedMeme] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        // Pick two random memes for this round
        const shuffled = [...MEMES].sort(() => Math.random() - 0.5);
        setCurrentMemes([shuffled[0], shuffled[1]]);
    }, [round]);

    const handleMemeSelect = (memeIndex: number) => {
        if (selectedMeme !== null) return;

        setSelectedMeme(memeIndex);
        setShowResult(true);

        // Simulate opponent choice (50/50 random)
        const opponentChoice = Math.random() > 0.5 ? 0 : 1;

        // Winner is determined by who picks the "funnier" meme (random for demo)
        const winnerChoice = Math.random() > 0.5 ? 0 : 1;

        if (memeIndex === winnerChoice) {
            setMyScore(prev => prev + 1);
        }
        if (opponentChoice === winnerChoice) {
            setOpponentScore(prev => prev + 1);
        }

        setTimeout(() => {
            if (round === 5) {
                // Best of 5
                const finalWinner = myScore + (memeIndex === winnerChoice ? 1 : 0) >
                    opponentScore + (opponentChoice === winnerChoice ? 1 : 0)
                    ? myAddress
                    : opponent;
                onComplete(finalWinner);
            } else {
                setRound(prev => prev + 1);
                setSelectedMeme(null);
                setShowResult(false);
            }
        }, 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-sol-orange" />
                    <span className="text-2xl font-bold">
                        Round {round} / 5
                    </span>
                </div>
                <div className="flex gap-8 text-xl font-bold">
                    <div className="text-green-400">You: {myScore}</div>
                    <div className="text-red-400">Opponent: {opponentScore}</div>
                </div>
            </div>

            <Card className="p-6 bg-accent/50 border-2 border-sol-orange/30">
                <h3 className="text-2xl font-bold text-center mb-6">
                    Choose the Better Meme! 🎭
                </h3>

                <div className="grid grid-cols-2 gap-6">
                    {currentMemes.map((meme, index) => {
                        const isSelected = selectedMeme === index;

                        return (
                            <Button
                                key={meme.id}
                                onClick={() => handleMemeSelect(index)}
                                disabled={selectedMeme !== null}
                                variant="outline"
                                className={`h-48 flex-col gap-4 text-lg relative transition-all ${isSelected
                                    ? 'bg-sol-orange/20 border-sol-orange scale-105'
                                    : 'hover:bg-accent hover:border-sol-orange/50 hover:scale-105'
                                    }`}
                            >
                                <div className="text-6xl">{meme.emoji}</div>
                                <div className="font-bold text-center">{meme.text}</div>
                                {isSelected && (
                                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-sol-orange flex items-center justify-center text-2xl">
                                        ✓
                                    </div>
                                )}
                            </Button>
                        );
                    })}
                </div>
            </Card>

            {showResult && (
                <Card className="p-4 bg-sol-orange/10 border-2 border-sol-orange/50 text-center">
                    <p className="text-lg font-medium animate-pulse">
                        Judging meme quality...
                    </p>
                </Card>
            )}

            <div className="text-center text-sm text-muted-foreground">
                Pick the meme you think is funnier or more relatable!
            </div>
        </div>
    );
}
