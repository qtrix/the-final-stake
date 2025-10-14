// src/components/phase3/PurgeGameWrapper.tsx
import React, { useState, useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import PurgeGame from '@/pages/PurgeGame'; // Import original game

interface PurgeGameWrapperProps {
    gameId: number;
    readyPlayers: Array<{ player: string; ready: boolean }>;
    onGameEnd: (winner: PublicKey) => Promise<void>;
    myAddress: PublicKey;
}

const PurgeGameWrapper: React.FC<PurgeGameWrapperProps> = ({
    gameId,
    readyPlayers,
    onGameEnd,
    myAddress
}) => {
    const [gameStarted, setGameStarted] = useState(false);
    const [submittingResult, setSubmittingResult] = useState(false);

    // Convert ready players to game format
    const players = readyPlayers
        .filter(p => p.ready)
        .map((p, index) => ({
            address: p.player,
            name: p.player === myAddress.toBase58()
                ? 'YOU'
                : `PLAYER ${index + 1}`,
            isYou: p.player === myAddress.toBase58()
        }));

    const handleStartBattle = () => {
        setGameStarted(true);
    };

    const handleBattleEnd = async (winner: string) => {
        console.log('🏆 Battle ended! Winner:', winner);

        setSubmittingResult(true);
        try {
            const winnerPubkey = new PublicKey(winner);
            await onGameEnd(winnerPubkey);
        } catch (error) {
            console.error('Failed to submit battle result:', error);
        } finally {
            setSubmittingResult(false);
        }
    };

    if (!gameStarted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black flex items-center justify-center">
                <div className="max-w-2xl mx-auto p-8 text-center">
                    <div className="text-8xl mb-6 animate-pulse">⚔️</div>
                    <h1 className="text-6xl font-black bg-gradient-to-r from-red-600 via-red-400 to-orange-500 bg-clip-text text-transparent mb-6">
                        THE PURGE
                    </h1>
                    <p className="text-2xl text-red-300 mb-8">
                        {players.length} Warriors Enter • Only One Survives
                    </p>

                    <div className="bg-black/80 border-2 border-red-600 rounded-xl p-6 mb-8">
                        <h3 className="text-xl font-bold text-red-400 mb-4">Ready Players:</h3>
                        <div className="space-y-2">
                            {players.map((p, i) => (
                                <div
                                    key={i}
                                    className={`p-3 rounded-lg ${p.isYou
                                            ? 'bg-purple-600/30 border-2 border-purple-400'
                                            : 'bg-red-900/30 border border-red-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-sm">
                                            {p.address.slice(0, 8)}...{p.address.slice(-6)}
                                        </span>
                                        <span className={`font-bold ${p.isYou ? 'text-purple-300' : 'text-red-300'}`}>
                                            {p.name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        onClick={handleStartBattle}
                        className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-2xl px-12 py-6 font-black"
                    >
                        💀 ENTER THE ARENA 💀
                    </Button>
                </div>
            </div>
        );
    }

    if (submittingResult) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-16 h-16 animate-spin text-red-500 mx-auto mb-4" />
                    <p className="text-2xl text-red-300 font-bold">
                        Submitting Battle Results...
                    </p>
                </div>
            </div>
        );
    }

    // Render actual PurgeGame with blockchain integration
    return (
        <PurgeGame
            players={players}
            onGameEnd={handleBattleEnd}
        />
    );
};

export default PurgeGameWrapper;