import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Users, Clock, ArrowLeft, Copy, Check, Award, Zap, Star, TrendingUp } from 'lucide-react';

export default function Profile() {
  const { publicKey, connected } = useWallet();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [level] = useState(12);
  const [xp] = useState(2850);
  const [maxXp] = useState(3000);

  useEffect(() => {
    if (!connected) {
      navigate('/');
    }
  }, [connected, navigate]);

  if (!publicKey) return null;

  const address = publicKey.toBase58();
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-6)}`;
  const xpPercentage = (xp / maxXp) * 100;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { icon: Trophy, label: 'Total Wins', value: '47', color: 'text-sol-orange', bgColor: 'bg-sol-orange/20' },
    { icon: Target, label: 'Total Kills', value: '342', color: 'text-sol-purple', bgColor: 'bg-sol-purple/20' },
    { icon: Users, label: 'Games Played', value: '128', color: 'text-secondary', bgColor: 'bg-secondary/20' },
    { icon: Clock, label: 'Playtime', value: '89h', color: 'text-primary', bgColor: 'bg-primary/20' },
  ];

  const achievements = [
    { icon: Award, title: 'First Blood', description: 'Get your first kill', unlocked: true, rarity: 'Common' },
    { icon: Trophy, title: 'Victory Royale', description: 'Win your first match', unlocked: true, rarity: 'Rare' },
    { icon: Zap, title: 'Speed Demon', description: 'Win a match in under 15 minutes', unlocked: true, rarity: 'Epic' },
    { icon: Target, title: 'Sharpshooter', description: 'Get 10 kills in a single match', unlocked: false, rarity: 'Legendary' },
    { icon: Star, title: 'Champion', description: 'Win 50 matches', unlocked: false, rarity: 'Legendary' },
    { icon: TrendingUp, title: 'Rising Star', description: 'Reach level 25', unlocked: false, rarity: 'Epic' },
  ];

  const recentGames = [
    { position: 1, kills: 8, reward: '2.5 SOL', time: '2 hours ago' },
    { position: 3, kills: 5, reward: '0.8 SOL', time: '5 hours ago' },
    { position: 12, kills: 3, reward: '0.1 SOL', time: '1 day ago' },
  ];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-gray-400';
      case 'Rare': return 'text-blue-400';
      case 'Epic': return 'text-sol-purple';
      case 'Legendary': return 'text-sol-orange';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navbar />
      
      <main className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-8 flex items-center gap-2 hover:text-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Card */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="text-center relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-sol opacity-5 animate-pulse-glow" />
                
                <div className="relative z-10">
                  {/* Avatar with Glow Effect */}
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <div className="absolute inset-0 bg-gradient-sol rounded-full blur-xl opacity-50 animate-pulse-glow" />
                    <div className="relative w-32 h-32 rounded-full bg-gradient-sol flex items-center justify-center text-4xl font-black border-4 border-background">
                      {address.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  
                  <h1 className="text-2xl font-bold mb-2 gradient-text">{shortAddress}</h1>
                  
                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 mx-auto text-sm text-muted-foreground hover:text-secondary transition-colors mb-6"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Address
                      </>
                    )}
                  </button>

                  {/* Level & XP */}
                  <div className="space-y-4 mb-6 bg-background/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Level</span>
                      <span className="text-2xl font-black gradient-text">{level}</span>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>{xp} / {maxXp} XP</span>
                        <span>{xpPercentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-4 bg-background rounded-full overflow-hidden border border-border/50">
                        <div 
                          className="h-full bg-gradient-sol transition-all duration-500 relative overflow-hidden"
                          style={{ width: `${xpPercentage}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rank Badge */}
                  <div className="pt-6 border-t border-border/50">
                    <div className="text-sm text-muted-foreground mb-2">Current Rank</div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-sol">
                      <Trophy className="w-5 h-5" />
                      <span className="text-xl font-black">Silver Elite</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              <Card>
                <h3 className="text-lg font-bold mb-4 gradient-text">Quick Actions</h3>
                <div className="space-y-3">
                  <Button 
                    variant="sol" 
                    onClick={() => navigate('/lobby')}
                    className="w-full rounded-full"
                  >
                    Join Battle Lobby
                  </Button>
                  <Button 
                    variant="sol-outline" 
                    onClick={() => navigate('/roadmap')}
                    className="w-full rounded-full"
                  >
                    View Roadmap
                  </Button>
                </div>
              </Card>
            </div>

            {/* Stats & Activity */}
            <div className="lg:col-span-2 space-y-8">
              {/* Battle Statistics */}
              <div>
                <h2 className="text-3xl font-black mb-6 gradient-text">Battle Statistics</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.map((stat, index) => (
                    <Card key={index} className="group hover:scale-105 transition-transform duration-300">
                      <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-xl ${stat.bgColor} flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                          <stat.icon className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">{stat.label}</div>
                          <div className="text-3xl font-black gradient-text">{stat.value}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Recent Games */}
              <Card>
                <h3 className="text-2xl font-bold mb-6 gradient-text">Recent Games</h3>
                <div className="space-y-3">
                  {recentGames.map((game, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${
                          game.position === 1 ? 'bg-sol-orange text-white' :
                          game.position <= 3 ? 'bg-sol-purple text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          #{game.position}
                        </div>
                        <div>
                          <div className="font-semibold">Position {game.position}</div>
                          <div className="text-sm text-muted-foreground">{game.kills} kills • {game.time}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sol-orange">{game.reward}</div>
                        <div className="text-xs text-muted-foreground">Reward</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Achievements */}
              <Card>
                <h3 className="text-2xl font-bold mb-6 gradient-text">Achievements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {achievements.map((achievement, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        achievement.unlocked 
                          ? 'bg-gradient-sol/10 border-sol-orange/50' 
                          : 'bg-background/30 border-border/30 opacity-50'
                      } transition-all duration-300 hover:scale-105`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg ${
                          achievement.unlocked ? 'bg-gradient-sol' : 'bg-muted'
                        } flex items-center justify-center flex-shrink-0`}>
                          <achievement.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-bold text-sm truncate">{achievement.title}</h4>
                            <span className={`text-xs font-semibold ${getRarityColor(achievement.rarity)} whitespace-nowrap`}>
                              {achievement.rarity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{achievement.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
