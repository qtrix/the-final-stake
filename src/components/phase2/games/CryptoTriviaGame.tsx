// src/components/phase2/games/CryptoTriviaGame.tsx
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Question {
    question: string;
    options: string[];
    correct: number;
}

const questions: Question[] = [
    {
        question: "What is the maximum supply of Bitcoin?",
        options: ["21 million", "18 million", "100 million", "Unlimited"],
        correct: 0
    },
    {
        question: "Which consensus mechanism does Ethereum 2.0 use?",
        options: ["Proof of Work", "Proof of Stake", "Proof of Authority", "Proof of Burn"],
        correct: 1
    },
    {
        question: "What does DeFi stand for?",
        options: ["Digital Finance", "Decentralized Finance", "Defined Finance", "Distributed Finance"],
        correct: 1
    },
    {
        question: "Which blockchain is known for smart contracts?",
        options: ["Bitcoin", "Litecoin", "Ethereum", "Dogecoin"],
        correct: 2
    },
    {
        question: "What is a 'gas fee' in blockchain?",
        options: ["Mining reward", "Transaction cost", "Token price", "Staking reward"],
        correct: 1
    },
    {
        question: "What does NFT stand for?",
        options: ["New Financial Token", "Non-Fungible Token", "Network File Transfer", "Next Future Tech"],
        correct: 1
    },
    {
        question: "Which year was Bitcoin created?",
        options: ["2007", "2008", "2009", "2010"],
        correct: 2
    },
    {
        question: "What is a blockchain fork?",
        options: ["A new crypto", "A chain split", "A wallet type", "A mining tool"],
        correct: 1
    },
    {
        question: "What does HODL mean?",
        options: ["Hold On for Dear Life", "Highly Organized Digital Ledger", "Hold", "None"],
        correct: 0
    },
    {
        question: "What is the native token of Solana?",
        options: ["ETH", "SOL", "BTC", "ADA"],
        correct: 1
    }
];

interface Props {
    onComplete: (winner: PublicKey) => Promise<void>;
    challenger: PublicKey;
    opponent: PublicKey;
    myAddress: PublicKey;
    challengeId: string;
    onGameStart: () => void;
}

export default function CryptoTriviaGame({
    onComplete,
    challenger,
    opponent,
    myAddress,
    onGameStart
}: Props) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [myScore, setMyScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);

    useEffect(() => {
        if (!gameStarted) {
            onGameStart();
            setGameStarted(true);
        }
    }, []);

    const handleAnswer = (answerIndex: number) => {
        setSelectedAnswer(answerIndex);
        setShowResult(true);

        const correct = questions[currentQuestion].correct === answerIndex;

        // Simulate opponent answer (50% chance correct)
        const opponentCorrect = Math.random() > 0.5;

        if (correct) setMyScore(myScore + 1);
        if (opponentCorrect) setOpponentScore(opponentScore + 1);

        setTimeout(() => {
            if (currentQuestion + 1 >= 10) {
                // Game over
                const finalMyScore = myScore + (correct ? 1 : 0);
                const finalOppScore = opponentScore + (opponentCorrect ? 1 : 0);

                if (finalMyScore > finalOppScore) {
                    onComplete(myAddress);
                } else if (finalOppScore > finalMyScore) {
                    const opponentAddr = challenger.equals(myAddress) ? opponent : challenger;
                    onComplete(opponentAddr);
                } else {
                    // Tie - challenger wins
                    onComplete(challenger);
                }
            } else {
                setCurrentQuestion(currentQuestion + 1);
                setSelectedAnswer(null);
                setShowResult(false);
            }
        }, 2000);
    };

    const progress = ((currentQuestion + 1) / 10) * 100;

    return (
        <div className="space-y-6">
            {/* Progress */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Question {currentQuestion + 1}/10</span>
                    <span>Progress: {progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 text-center border-2 border-green-500/30 bg-green-500/10">
                    <div className="text-sm text-muted-foreground mb-1">Your Score</div>
                    <div className="text-3xl font-bold text-green-400">{myScore}</div>
                </Card>
                <Card className="p-4 text-center border-2 border-red-500/30 bg-red-500/10">
                    <div className="text-sm text-muted-foreground mb-1">Opponent Score</div>
                    <div className="text-3xl font-bold text-red-400">{opponentScore}</div>
                </Card>
            </div>

            {/* Question */}
            <Card className="p-6 bg-accent/30">
                <h3 className="text-xl font-bold mb-6 text-center">
                    {questions[currentQuestion].question}
                </h3>

                <div className="grid grid-cols-1 gap-3">
                    {questions[currentQuestion].options.map((option, index) => {
                        const isSelected = selectedAnswer === index;
                        const isCorrect = questions[currentQuestion].correct === index;
                        const showCorrect = showResult && isCorrect;
                        const showWrong = showResult && isSelected && !isCorrect;

                        return (
                            <Button
                                key={index}
                                onClick={() => !showResult && handleAnswer(index)}
                                disabled={showResult}
                                variant={showCorrect ? "default" : showWrong ? "destructive" : "outline"}
                                className={`h-auto py-4 px-6 text-left justify-start text-base ${showCorrect ? 'bg-green-500 hover:bg-green-600' :
                                        showWrong ? 'bg-red-500 hover:bg-red-600' : ''
                                    }`}
                            >
                                <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                                {option}
                                {showCorrect && ' ✓'}
                                {showWrong && ' ✗'}
                            </Button>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}