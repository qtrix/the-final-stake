// src/pages/Profile.tsx - ULTIMATE PROFILE PAGE
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Trophy, Target, Users, Clock, ArrowLeft, Copy, Check, Award,
  Zap, Star, TrendingUp, Edit2, Save, X, Loader2, ExternalLink,
  Coins, Percent, BarChart3, Calendar, Flame, Shield, Crown, Swords, AlertCircle  // ← ADDED!
} from 'lucide-react';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { toast } from 'sonner';

export default function Profile() {
  const { publicKey, connected } = useWallet();
  const navigate = useNavigate();
  const { stats, gameHistory, achievements, profile, updateProfile, loading } = usePlayerProfile();

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(profile);

  useEffect(() => {
    if (!connected) {
      navigate('/');
    }
  }, [connected, navigate]);

  useEffect(() => {
    setEditForm(profile);
  }, [profile]);

  if (!publicKey) return null;

  const address = publicKey.toBase58();
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-6)}`;
  const displayName = profile.username || shortAddress;
  const maxXp = 1000;
  const xpPercentage = (stats.xp / maxXp) * 100;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = () => {
    updateProfile(editForm);
    setEditing(false);
    toast.success('Profile updated!');
  };

  const handleCancelEdit = () => {
    setEditForm(profile);
    setEditing(false);
  };

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'Bronze': return 'from-orange-800 to-orange-600';
      case 'Silver': return 'from-gray-400 to-gray-200';
      case 'Gold': return 'from-yellow-600 to-yellow-400';
      case 'Platinum': return 'from-cyan-400 to-blue-400';
      case 'Diamond': return 'from-blue-400 to-purple-400';
      case 'Immortal': return 'from-red-500 to-pink-500';
      case 'Mythic': return 'from-purple-600 via-pink-500 to-red-500';
      default: return 'from-gray-600 to-gray-400';
    }
  };

  const getRankIcon = (rank: string) => {
    switch (rank) {
      case 'Bronze': return Shield;
      case 'Silver': return Shield;
      case 'Gold': return Trophy;
      case 'Platinum': return Trophy;
      case 'Diamond': return Crown;
      case 'Immortal': return Crown;
      case 'Mythic': return Flame;
      default: return Shield;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Common': return 'text-gray-400 border-gray-400/30';
      case 'Rare': return 'text-blue-400 border-blue-400/30';
      case 'Epic': return 'text-purple-400 border-purple-400/30';
      case 'Legendary': return 'text-orange-400 border-orange-400/30';
      default: return 'text-muted-foreground border-border/30';
    }
  };

  const getAchievementIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      Trophy, Target, Users, Coins, Award, Zap, Star, TrendingUp
    };
    return icons[iconName] || Award;
  };

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <ParticleBackground />
        <Navbar />
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading your legendary profile...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: Trophy,
      label: 'Total Wins',
      value: stats.totalWins.toString(),
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/20',
      gradient: 'from-yellow-600/20 to-orange-600/20'
    },
    {
      icon: Target,
      label: 'Total Kills',
      value: stats.totalKills.toString(),
      color: 'text-red-400',
      bgColor: 'bg-red-400/20',
      gradient: 'from-red-600/20 to-pink-600/20'
    },
    {
      icon: Users,
      label: 'Games Played',
      value: stats.totalGames.toString(),
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/20',
      gradient: 'from-blue-600/20 to-cyan-600/20'
    },
    {
      icon: Coins,
      label: 'Total Earned',
      value: `${stats.totalEarnings.toFixed(2)} SOL`,
      color: 'text-green-400',
      bgColor: 'bg-green-400/20',
      gradient: 'from-green-600/20 to-emerald-600/20'
    },
    {
      icon: Percent,
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/20',
      gradient: 'from-purple-600/20 to-pink-600/20'
    },
    {
      icon: BarChart3,
      label: 'Avg Kills/Game',
      value: stats.averageKills.toFixed(1),
      color: 'text-orange-400',
      bgColor: 'bg-orange-400/20',
      gradient: 'from-orange-600/20 to-red-600/20'
    },
  ];

  const RankIcon = getRankIcon(stats.rank);

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navbar />

      <main className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/lobby')}
            className="mb-8 flex items-center gap-2 hover:text-primary transition-all hover:scale-105"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lobby
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN - Profile Card */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Card */}
              <Card className="text-center relative overflow-hidden border-2">
                {/* Animated Background - Removed pulse */}
                <div className={`absolute inset-0 bg-gradient-to-br ${getRankColor(stats.rank)} opacity-10`} />

                <div className="relative z-10 p-6">
                  {/* Avatar Section */}
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <div className={`absolute inset-0 bg-gradient-to-br ${getRankColor(stats.rank)} rounded-full blur-xl opacity-60`} />

                    {editing ? (
                      <div className="relative w-32 h-32 rounded-full border-4 border-background bg-background flex items-center justify-center">
                        <Input
                          type="text"
                          placeholder="Avatar URL"
                          value={editForm.avatarUrl}
                          onChange={(e) => setEditForm({ ...editForm, avatarUrl: e.target.value })}
                          className="text-xs text-center"
                        />
                      </div>
                    ) : profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Avatar"
                        className="relative w-32 h-32 rounded-full border-4 border-background object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${address}`;
                        }}
                      />
                    ) : (
                      <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${getRankColor(stats.rank)} flex items-center justify-center text-4xl font-black border-4 border-background`}>
                        {address.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Rank Badge on Avatar */}
                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r ${getRankColor(stats.rank)} flex items-center gap-1 shadow-lg border-2 border-background`}>
                      <RankIcon className="w-3 h-3" />
                      <span className="text-xs font-black">{stats.rank}</span>
                    </div>
                  </div>

                  {/* Username/Address */}
                  {editing ? (
                    <Input
                      type="text"
                      placeholder="Username"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="text-center text-xl font-bold mb-2"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold mb-2">
                      <span className={`bg-gradient-to-r ${getRankColor(stats.rank)} bg-clip-text text-transparent`}>
                        {displayName}
                      </span>
                    </h1>
                  )}

                  {/* Address */}
                  <button
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 mx-auto text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {shortAddress}
                      </>
                    )}
                  </button>

                  {/* Bio */}
                  {editing ? (
                    <Textarea
                      placeholder="Write something about yourself..."
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="mb-4 text-sm"
                      rows={3}
                    />
                  ) : profile.bio ? (
                    <p className="text-sm text-muted-foreground mb-4 italic">{profile.bio}</p>
                  ) : null}

                  {/* Edit Buttons */}
                  {editing ? (
                    <div className="flex gap-2 mb-6">
                      <Button
                        onClick={handleSaveProfile}
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setEditing(true)}
                      size="sm"
                      variant="outline"
                      className="mb-6 w-full"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}

                  {/* Level & XP */}
                  <div className="space-y-4 mb-6 bg-background/50 rounded-lg p-4 border border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground font-semibold">Level</span>
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-400" />
                        <span className={`text-3xl font-black bg-gradient-to-r ${getRankColor(stats.rank)} bg-clip-text text-transparent`}>
                          {stats.level}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span className="font-semibold">{stats.xp} / {maxXp} XP</span>
                        <span className="font-bold">{xpPercentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-4 bg-background rounded-full overflow-hidden border-2 border-border/50">
                        <div
                          className={`h-full bg-gradient-to-r ${getRankColor(stats.rank)} transition-all duration-500 relative overflow-hidden`}
                          style={{ width: `${xpPercentage}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rank Display */}
                  <div className="pt-6 border-t border-border/50">
                    <div className="text-sm text-muted-foreground mb-3 font-semibold">Current Rank</div>
                    <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r ${getRankColor(stats.rank)} shadow-lg relative overflow-hidden group`}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      <RankIcon className="w-6 h-6 relative z-10" />
                      <span className="text-2xl font-black relative z-10">{stats.rank}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Tier {stats.rankTier} / 7
                    </p>
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="border-2">
                <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/lobby')}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:scale-105 transition-transform shadow-lg"
                    size="lg"
                  >
                    <Swords className="w-5 h-5 mr-2" />
                    Join Battle
                  </Button>
                  <Button
                    onClick={() => navigate('/roadmap')}
                    variant="outline"
                    className="w-full hover:scale-105 transition-transform"
                    size="lg"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    View Roadmap
                  </Button>
                </div>
              </Card>
            </div>

            {/* RIGHT COLUMNS - Stats & Activity */}
            <div className="lg:col-span-2 space-y-8">
              {/* Battle Statistics */}
              <div>
                <h2 className="text-4xl font-black mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                  Battle Statistics
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statCards.map((stat, index) => (
                    <Card
                      key={index}
                      className="group hover:scale-105 transition-all duration-300 border-2 relative overflow-hidden cursor-pointer"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

                      <div className="relative z-10 flex items-center gap-4 p-6">
                        <div className={`w-16 h-16 rounded-xl ${stat.bgColor} flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform shadow-lg`}>
                          <stat.icon className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground font-semibold mb-1">{stat.label}</div>
                          <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Recent Games */}
              <Card className="border-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Match History
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="font-semibold">Last 10 Games</span>
                  </div>
                </div>

                {gameHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-lg text-muted-foreground">No games played yet</p>
                    <p className="text-sm text-muted-foreground mt-2">Join a battle to start your journey!</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-4">
                    {gameHistory.slice(0, 10).map((game, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-5 rounded-xl bg-background/50 hover:bg-background/80 transition-all border-2 border-border/30 hover:border-primary/30 group"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-black text-sm border-2 flex-shrink-0 ${game.isWinner
                            ? 'bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400 text-white shadow-lg shadow-yellow-500/50'
                            : 'bg-muted border-border text-muted-foreground'
                            } group-hover:scale-110 transition-transform`}>
                            {game.isWinner ? (
                              <>
                                <Trophy className="w-6 h-6 mb-1" />
                                <span className="text-xs">WIN</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xl">#{game.position || '?'}</span>
                              </>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-lg mb-1">
                              Game #{game.gameId} • Phase {game.phase}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Target className="w-4 h-4" />
                                {game.kills} kills
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {new Date(game.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-black text-xl ${game.reward > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                            {game.reward > 0 ? `+${game.reward.toFixed(4)}` : '0.0000'} SOL
                          </div>
                          <div className="text-xs font-semibold">
                            {game.isWinner && !game.prizeClaimed ? (
                              <span className="text-yellow-400 flex items-center justify-end gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Unclaimed
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Reward</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Achievements */}
              <Card className="border-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Achievements
                  </h3>
                  <div className="text-sm font-bold">
                    <span className="text-primary">{achievements.filter(a => a.unlocked).length}</span>
                    <span className="text-muted-foreground"> / {achievements.length}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {achievements.map((achievement, index) => {
                    const Icon = getAchievementIcon(achievement.icon);
                    const progress = achievement.unlocked ? 100 : (achievement.progress / achievement.total) * 100;

                    return (
                      <div
                        key={index}
                        className={`p-5 rounded-xl border-2 transition-all duration-300 hover:scale-105 relative overflow-hidden ${achievement.unlocked
                          ? 'bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/50 shadow-lg'
                          : 'bg-background/30 border-border/30 opacity-60'
                          }`}
                      >
                        {achievement.unlocked && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-5 h-5 text-green-400" />
                          </div>
                        )}

                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-12 h-12 rounded-xl ${achievement.unlocked
                            ? 'bg-gradient-to-br from-primary to-secondary'
                            : 'bg-muted'
                            } flex items-center justify-center flex-shrink-0 shadow-lg`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-sm truncate">{achievement.title}</h4>
                              <span className={`text-xs font-bold ${getRarityColor(achievement.rarity)} px-2 py-0.5 rounded border whitespace-nowrap`}>
                                {achievement.rarity}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{achievement.description}</p>

                            {/* Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground font-semibold">
                                  {achievement.progress} / {achievement.total}
                                </span>
                                <span className="font-bold text-primary">{progress.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 bg-background rounded-full overflow-hidden border border-border/50">
                                <div
                                  className={`h-full transition-all duration-500 ${achievement.unlocked
                                    ? 'bg-gradient-to-r from-primary to-secondary'
                                    : 'bg-muted'
                                    }`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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