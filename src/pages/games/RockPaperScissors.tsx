import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from '@/components/ParticleBackground';

const moves = [
    { name: 'Bitcoin', emoji: '₿', beats: ['Altcoin', 'Rug Pull'] },
    { name: 'Ethereum', emoji: '⟠', beats: ['Bitcoin', 'Paper Hands'] },
    { name: 'Altcoin', emoji: '🪙', beats: ['Ethereum', 'Diamond Hands'] },
    { name: 'Diamond Hands', emoji: '💎', beats: ['Bitcoin', 'Rug Pull'] },
    { name: 'Paper Hands', emoji: '📄', beats: ['Altcoin', 'Diamond Hands'] },
    { name: 'Rug Pull', emoji: '🚨', beats: ['Ethereum', 'Paper Hands'] }
];

export default function RockPaperScissors() {
    const navigate = useNavigate();
    const [gameState, setGameState] = useState<'playing' | 'result' | 'finished'>('playing');
    const [playerScore, setPlayerScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [currentRound, setCurrentRound] = useState(1);
    const [playerMove, setPlayerMove] = useState<string | null>(null);
    const [opponentMove, setOpponentMove] = useState<string | null>(null);
    const [roundResult, setRoundResult] = useState<string | null>(null);

    const makeMove = (moveName: string) => {
        const randomOpponentMove = moves[Math.floor(Math.random() * moves.length)];
        const playerMoveObj = moves.find(m => m.name === moveName)!;

        setPlayerMove(moveName);
        setOpponentMove(randomOpponentMove.name);

        let result = '';
        if (playerMoveObj.beats.includes(randomOpponentMove.name)) {
            result = 'win';
            setPlayerScore(playerScore + 1);
        } else if (randomOpponentMove.beats.includes(moveName)) {
            result = 'lose';
            setOpponentScore(opponentScore + 1);
        } else {
            result = 'tie';
        }

        setRoundResult(result);
        setGameState('result');

        setTimeout(() => {
            if (currentRound < 3) {
                setCurrentRound(currentRound + 1);
                setGameState('playing');
                setPlayerMove(null);
                setOpponentMove(null);
                setRoundResult(null);
            } else {
                setGameState('finished');
            }
        }, 3000);
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
                        <span className="gradient-text">✂️ Crypto Battle</span>
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Rock-Paper-Scissors with crypto moves
                    </p>
                </div>

                {(gameState === 'playing' || gameState === 'result') && (
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-4">Round {currentRound}/3</h2>
                            <div className="flex justify-center gap-8 text-lg">
                                <span>You: {playerScore}</span>
                                <span>Opponent: {opponentScore}</span>
                            </div>
                        </div>

                        {gameState === 'result' && (
                            <Card className="p-8 mb-8 text-center">
                                <div className="flex justify-center items-center gap-8 mb-6">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">
                                            {moves.find(m => m.name === playerMove)?.emoji}
                                        </div>
                                        <p className="font-bold">You: {playerMove}</p>
                                    </div>
                                    <div className="text-2xl">VS</div>
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">
                                            {moves.find(m => m.name === opponentMove)?.emoji}
                                        </div>
                                        <p className="font-bold">Opponent: {opponentMove}</p>
                                    </div>
                                </div>
                                <p className="text-xl font-bold">
                                    {roundResult === 'win' && <span className="text-green-400">You Win!</span>}
                                    {roundResult === 'lose' && <span className="text-red-400">You Lose!</span>}
                                    {roundResult === 'tie' && <span className="text-yellow-400">Tie!</span>}
                                </p>
                            </Card>
                        )}

                        {gameState === 'playing' && (
                            <Card className="p-8">
                                <h3 className="text-xl font-bold text-center mb-6">Choose Your Move</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {moves.map((move) => (
                                        <button
                                            key={move.name}
                                            onClick={() => makeMove(move.name)}
                                            className="p-6 rounded-lg border border-border hover:border-sol-orange hover:bg-sol-orange/10 transition-all text-center"
                                        >
                                            <div className="text-4xl mb-2">{move.emoji}</div>
                                            <div className="font-bold">{move.name}</div>
                                            <div className="text-sm text-muted-foreground mt-2">
                                                Beats: {move.beats.join(', ')}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                )}

                {gameState === 'finished' && (
                    <Card className="p-8 max-w-md mx-auto text-center">
                        <Trophy className="w-16 h-16 text-sol-orange mx-auto mb-6" />
                        <h2 className="text-2xl font-bold mb-4">Battle Complete!</h2>
                        <p className="text-lg mb-2">Final Score: {playerScore} - {opponentScore}</p>
                        <p className="text-muted-foreground mb-6">
                            {playerScore > opponentScore
                                ? 'Victory! 🎉'
                                : playerScore < opponentScore
                                    ? 'Better luck next time!'
                                    : 'It\'s a tie!'}
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
