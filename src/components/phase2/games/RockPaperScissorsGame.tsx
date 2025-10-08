// src/components/phase2/games/RockPaperScissorsGame.tsx
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Choice = 'rock' | 'paper' | 'scissors';

interface Props {
    onComplete: (winner: PublicKey) => Promise<void>;
    challenger: PublicKey;
    opponent: PublicKey;
    myAddress: PublicKey;
    challengeId: string;
    onGameStart: () => void;
}

export default function RockPaperScissorsGame({
    onComplete,
    challenger,
    opponent,
    myAddress,
    onGameStart
}: Props) {
    const [myChoice, setMyChoice] = useState<Choice | null>(null);
    const [opponentChoice, setOpponentChoice] = useState<Choice | null>(null);
    const [round, setRound] = useState(1);
    const [myScore, setMyScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [roundResult, setRoundResult] = useState<string>('');
    const [showResult, setShowResult] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);

    const choices: Choice[] = ['rock', 'paper', 'scissors'];
    const emojis: Record<Choice, string> = {
        rock: '🪨',
        paper: '📄',
        scissors: '✂️'
    };

    useEffect(() => {
        if (!gameStarted) {
            onGameStart();
            setGameStarted(true);
        }
    }, []);

    const determineWinner = (player: Choice, opp: Choice): 'player' | 'opponent' | 'tie' => {
        if (player === opp) return 'tie';

        if (
            (player === 'rock' && opp === 'scissors') ||
            (player === 'paper' && opp === 'rock') ||
            (player === 'scissors' && opp === 'paper')
        ) {
            return 'player';
        }

        return 'opponent';
    };

    const handleChoice = async (choice: Choice) => {
        setMyChoice(choice);

        // Simulate opponent choice (in production, this would come from blockchain/oracle)
        const oppChoice = choices[Math.floor(Math.random() * 3)];
        setOpponentChoice(oppChoice);

        setShowResult(true);

        // Determine round winner
        setTimeout(() => {
            const winner = determineWinner(choice, oppChoice);

            let newMyScore = myScore;
            let newOppScore = opponentScore;

            if (winner === 'player') {
                newMyScore = myScore + 1;
                setMyScore(newMyScore);
                setRoundResult('You won this round! 🎉');
            } else if (winner === 'opponent') {
                newOppScore = opponentScore + 1;
                setOpponentScore(newOppScore);
                setRoundResult('Opponent won this round! 😢');
            } else {
                setRoundResult("It's a tie! 🤝");
            }

            // Check if game is over (best of 5)
            setTimeout(() => {
                if (newMyScore >= 3) {
                    onComplete(myAddress);
                } else if (newOppScore >= 3) {
                    const opponentAddr = challenger.equals(myAddress) ? opponent : challenger;
                    onComplete(opponentAddr);
                } else {
                    // Next round
                    setRound(round + 1);
                    setMyChoice(null);
                    setOpponentChoice(null);
                    setShowResult(false);
                    setRoundResult('');
                }
            }, 2000);
        }, 1000);
    };

    return (
        <div className="space-y-6">
            {/* Score Display */}
            <div className="grid grid-cols-3 gap-4 text-center">
                <Card className="p-4 border-2 border-green-500/30 bg-green-500/10">
                    <div className="text-sm text-muted-foreground mb-2">You</div>
                    <div className="text-4xl font-bold text-green-400">{myScore}</div>
                </Card>

                <Card className="p-4 border-2 border-sol-orange/30 bg-sol-orange/10">
                    <div className="text-sm text-muted-foreground mb-2">Round</div>
                    <div className="text-4xl font-bold text-sol-orange">{round}</div>
                </Card>

                <Card className="p-4 border-2 border-red-500/30 bg-red-500/10">
                    <div className="text-sm text-muted-foreground mb-2">Opponent</div>
                    <div className="text-4xl font-bold text-red-400">{opponentScore}</div>
                </Card>
            </div>

            {/* Game Status */}
            <div className="text-center">
                <p className="text-lg font-semibold text-muted-foreground mb-2">
                    Best of 5 rounds • First to 3 wins!
                </p>
                {roundResult && (
                    <p className="text-xl font-bold text-sol-orange animate-pulse">
                        {roundResult}
                    </p>
                )}
            </div>

            {/* Choices Display */}
            {showResult && (
                <div className="grid grid-cols-2 gap-8 py-8">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-4">Your Choice</p>
                        <div className="text-8xl animate-bounce">
                            {myChoice && emojis[myChoice]}
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-4">Opponent's Choice</p>
                        <div className="text-8xl animate-bounce">
                            {opponentChoice && emojis[opponentChoice]}
                        </div>
                    </div>
                </div>
            )}

            {/* Choice Buttons */}
            {!showResult && (
                <div className="space-y-4">
                    <p className="text-center text-lg font-semibold">Choose your move:</p>
                    <div className="grid grid-cols-3 gap-4">
                        {choices.map((choice) => (
                            <Button
                                key={choice}
                                onClick={() => handleChoice(choice)}
                                disabled={myChoice !== null}
                                className="h-32 text-6xl hover:scale-110 transition-transform"
                                variant="outline"
                            >
                                {emojis[choice]}
                            </Button>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
                        <div>Rock</div>
                        <div>Paper</div>
                        <div>Scissors</div>
                    </div>
                </div>
            )}

            {/* Instructions */}
            <Card className="p-4 bg-accent/50">
                <p className="text-sm text-center text-muted-foreground">
                    🪨 beats ✂️ • 📄 beats 🪨 • ✂️ beats 📄
                </p>
            </Card>
        </div>
    );
}