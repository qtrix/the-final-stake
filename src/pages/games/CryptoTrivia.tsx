import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Clock, Trophy, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from '@/components/ParticleBackground';

const questions = [
    {
        question: "What is the maximum supply of Bitcoin?",
        options: ["21 million", "100 million", "No limit", "50 million"],
        correct: 0
    },
    {
        question: "Which consensus mechanism does Ethereum 2.0 use?",
        options: ["Proof of Work", "Proof of Stake", "Proof of Authority", "Delegated Proof of Stake"],
        correct: 1
    },
    {
        question: "What does DeFi stand for?",
        options: ["Digital Finance", "Decentralized Finance", "Distributed Finance", "Dynamic Finance"],
        correct: 1
    },
    {
        question: "Which blockchain is Solana built on?",
        options: ["Ethereum", "Bitcoin", "Its own blockchain", "Polygon"],
        correct: 2
    }
];

export default function CryptoTrivia() {
    const navigate = useNavigate();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [gameState, setGameState] = useState<'playing' | 'finished'>('playing');
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

    useEffect(() => {
        if (gameState === 'playing' && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0) {
            handleTimeUp();
        }
    }, [timeLeft, gameState]);

    const handleAnswer = (answerIndex: number) => {
        setSelectedAnswer(answerIndex);

        setTimeout(() => {
            if (answerIndex === questions[currentQuestion].correct) {
                setScore(score + 1);
            }

            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(currentQuestion + 1);
                setTimeLeft(15);
                setSelectedAnswer(null);
            } else {
                setGameState('finished');
            }
        }, 1500);
    };

    const handleTimeUp = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setTimeLeft(15);
            setSelectedAnswer(null);
        } else {
            setGameState('finished');
        }
    };

    return (
        <div className="min-h-screen relative">
            <ParticleBackground />

            <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-lg border-b border-border/50">
                <div className="container mx-auto px-4 py-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/phase2')}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Arena
                    </Button>
                </div>
            </nav>

            <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-display font-black mb-4">
                        <span className="gradient-text">🧠 Crypto Trivia</span>
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Test your crypto knowledge
                    </p>
                </div>

                {gameState === 'playing' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-sol-orange" />
                                <span className="text-lg font-bold">{timeLeft}s</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-sol-purple" />
                                <span className="text-lg font-bold">{currentQuestion + 1}/{questions.length}</span>
                            </div>
                        </div>

                        <Card className="p-8 mb-8">
                            <h2 className="text-xl font-bold mb-6 text-center">
                                {questions[currentQuestion].question}
                            </h2>

                            <div className="grid grid-cols-1 gap-4">
                                {questions[currentQuestion].options.map((option, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleAnswer(index)}
                                        disabled={selectedAnswer !== null}
                                        className={`p-4 rounded-lg border text-left transition-all ${selectedAnswer === null
                                                ? 'border-border hover:border-sol-orange hover:bg-sol-orange/10'
                                                : selectedAnswer === index
                                                    ? index === questions[currentQuestion].correct
                                                        ? 'border-green-500 bg-green-500/20'
                                                        : 'border-red-500 bg-red-500/20'
                                                    : index === questions[currentQuestion].correct
                                                        ? 'border-green-500 bg-green-500/20'
                                                        : 'border-border opacity-50'
                                            }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}

                {gameState === 'finished' && (
                    <Card className="p-8 max-w-md mx-auto text-center">
                        <Trophy className="w-16 h-16 text-sol-orange mx-auto mb-6" />
                        <h2 className="text-2xl font-bold mb-4">Game Complete!</h2>
                        <p className="text-lg mb-2">Score: {score}/{questions.length}</p>
                        <p className="text-muted-foreground mb-6">
                            {score >= 3 ? 'Victory! 🎉' : 'Better luck next time!'}
                        </p>
                        <Button variant="sol" onClick={() => navigate('/phase2')}>
                            Back to Arena
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
}
