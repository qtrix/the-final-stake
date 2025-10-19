import { Twitter, Github, Linkedin, Mail, Code, Zap, Trophy } from 'lucide-react';
import ParticleBackground from "../components/ParticleBackground";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Team() {
    const teamMember = {
        name: "Bogdan Lacatusu",
        role: "Founder & Lead Developer",
        image: "/images/team/img.JPG", // Replace with actual path
        bio: "Battle-tested blockchain developer since 2020. From DeFi protocols to DAO governance, data scraping to gaming vaults, NFT real estate to on-chain analytics—I've seen it all. Every challenge, every late-night debugging session, every failed transaction taught me something. Now, I'm bringing everything I've learned into The Final Stake: a game that captures the chaos, strategy, and survival instinct of the crypto world.",
        experience: [
            { icon: Code, label: "4+ Years", subtitle: "Blockchain Dev" },
            { icon: Zap, label: "15+ Projects", subtitle: "Shipped" },
            { icon: Trophy, label: "Multiple", subtitle: "Ecosystems" }
        ],
        expertise: [
            "Smart Contract Architecture",
            "DeFi Protocol Design",
            "Full-Stack Web3",
            "Game Theory & Economics",
            "Real-time Systems",
            "On-chain Analytics"
        ],
        social: {
            twitter: "https://twitter.com/0xnullhex_blc",
            github: "https://github.com/qtrix",
            linkedin: "https://linkedin.com/in/bogdan-lacatusu",
            email: "bogdan.lacatusu13@gmail.com"
        }
    };

    return (
        <div className="min-h-screen relative text-white">
            <ParticleBackground />
            <Navbar />

            <div className="container mx-auto px-4 pt-24 pb-16 relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-6">
                        <span
                            className="bg-clip-text text-transparent"
                            style={{
                                background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}
                        >
                            The Team
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Built by someone who's survived the trenches of Web3
                    </p>
                </div>

                {/* Team Member Card */}
                <div className="max-w-5xl mx-auto">
                    <div
                        className="p-8 md:p-12 rounded-2xl border border-white/20 backdrop-blur-lg"
                        style={{
                            background: 'linear-gradient(135deg, rgba(106, 13, 173, 0.1), rgba(255, 94, 0, 0.05))',
                            boxShadow: '0 8px 32px rgba(106, 13, 173, 0.4)'
                        }}
                    >
                        <div className="grid md:grid-cols-[300px_1fr] gap-8 items-start">
                            {/* Photo Section */}
                            <div className="flex flex-col items-center">
                                <div
                                    className="w-64 h-64 rounded-2xl mb-6 overflow-hidden border-4 border-white/20"
                                    style={{
                                        boxShadow: '0 10px 40px rgba(255, 94, 0, 0.3)'
                                    }}
                                >
                                    <img
                                        src={teamMember.image}
                                        alt={teamMember.name}
                                        className="w-full h-full object-cover"
                                        style={{
                                            filter: 'grayscale(100%) contrast(1.1)',
                                        }}
                                    />
                                </div>

                                {/* Social Links */}
                                <div className="flex gap-4 mb-6">
                                    <a
                                        href={teamMember.social.twitter}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                                        style={{
                                            background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                                        }}
                                    >
                                        <Twitter className="w-5 h-5" />
                                    </a>
                                    <a
                                        href={teamMember.social.github}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                                        style={{
                                            background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                                        }}
                                    >
                                        <Github className="w-5 h-5" />
                                    </a>
                                    <a
                                        href={teamMember.social.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                                        style={{
                                            background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                                        }}
                                    >
                                        <Linkedin className="w-5 h-5" />
                                    </a>
                                    <a
                                        href={`mailto:${teamMember.social.email}`}
                                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                                        style={{
                                            background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                                        }}
                                    >
                                        <Mail className="w-5 h-5" />
                                    </a>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-4 w-full">
                                    {teamMember.experience.map((stat, index) => {
                                        const Icon = stat.icon;
                                        return (
                                            <div
                                                key={index}
                                                className="text-center p-3 rounded-lg"
                                                style={{
                                                    background: 'rgba(106, 13, 173, 0.1)',
                                                    border: '1px solid rgba(255, 94, 0, 0.2)'
                                                }}
                                            >
                                                <Icon className="w-5 h-5 mx-auto mb-2 text-orange-400" />
                                                <div className="text-lg font-bold text-white">{stat.label}</div>
                                                <div className="text-xs text-gray-400">{stat.subtitle}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-3xl font-black text-white mb-2">
                                        {teamMember.name}
                                    </h2>
                                    <p
                                        className="text-lg font-semibold mb-4"
                                        style={{
                                            background: 'linear-gradient(135deg, hsl(280, 100%, 45%), hsl(15, 100%, 50%))',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent'
                                        }}
                                    >
                                        {teamMember.role}
                                    </p>
                                </div>

                                {/* Bio */}
                                <div className="text-gray-300 leading-relaxed text-lg">
                                    {teamMember.bio}
                                </div>

                                {/* Expertise */}
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                        Expertise
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {teamMember.expertise.map((skill, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2 p-3 rounded-lg"
                                                style={{
                                                    background: 'rgba(106, 13, 173, 0.1)',
                                                    border: '1px solid rgba(255, 94, 0, 0.2)'
                                                }}
                                            >
                                                <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                                <span className="text-sm text-gray-300">{skill}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Notable Projects */}
                                <div
                                    className="p-6 rounded-xl border border-orange-500/30"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255, 94, 0, 0.05), rgba(106, 13, 173, 0.05))'
                                    }}
                                >
                                    <h3 className="text-lg font-bold text-white mb-3">
                                        Previous Ventures
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-400">
                                        <div>• DeFi Protocols</div>
                                        <div>• DAO Governance</div>
                                        <div>• Data Scraping</div>
                                        <div>• Gaming Vaults</div>
                                        <div>• NFT Real Estate</div>
                                        <div>• On-chain Analytics</div>
                                    </div>
                                </div>

                                {/* Quote */}
                                <div
                                    className="p-6 rounded-xl border-l-4 italic text-gray-300"
                                    style={{
                                        borderColor: 'hsl(15, 100%, 50%)',
                                        background: 'rgba(0, 0, 0, 0.3)'
                                    }}
                                >
                                    "I didn't just build The Final Stake to make a game. I built it to prove that blockchain gaming can be strategic, fair, and actually fun. No pay-to-win. No endless grinding. Just pure skill, strategy, and survival."
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vision Statement */}
                <div className="max-w-4xl mx-auto mt-16">
                    <div
                        className="p-8 rounded-2xl border border-white/20 backdrop-blur-lg text-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(106, 13, 173, 0.1), rgba(255, 94, 0, 0.05))'
                        }}
                    >
                        <h3 className="text-2xl font-bold mb-4">
                            <span
                                className="bg-clip-text text-transparent"
                                style={{
                                    background: 'linear-gradient(135deg, hsl(280, 100%, 35%), hsl(15, 100%, 50%))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}
                            >
                                The Vision
                            </span>
                        </h3>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            The Final Stake isn't just another blockchain game—it's a culmination of years spent in the Web3 trenches. Every mechanism, every phase, every line of code reflects real experiences from the crypto world: the thrill of DeFi yields, the intensity of PvP competition, and the ultimate test of survival when the market (or safe zone) turns against you. This is Web3 gaming, evolved.
                        </p>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}