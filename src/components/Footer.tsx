import { Button } from '@/components/ui/button';
import logo from '@/assets/token-logo.png';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  const communityLinks = [
    { name: 'Discord', url: 'https://discord.gg/vJwrA2hN', icon: '💬' },
    { name: 'Telegram', url: 'https://t.me/+QjCU0Ixpb7gyNDVk', icon: '📨' },
  ];

  const platformLinks = [
    { name: 'Support', href: '#', action: () => navigate('/support') },
    { name: 'FAQ', href: '#', action: () => navigate('/faq') },
    { name: 'Partnership Program', href: '#', action: () => navigate('/partnerships') },
    { name: 'Tokenomics', href: '#', action: () => navigate('/tokenomics') },
  ];

  const aboutLinks = [
    { name: 'About Us', href: '#', action: () => navigate('/about') },
    { name: 'Team', href: '#', action: () => navigate('/team') },
    { name: 'Roadmap', href: '#', action: () => navigate('/roadmap') },
    { name: 'Careers', href: '#', action: () => navigate('/careers') },
  ];

  return (
    <footer className="relative mt-16 py-16 border-t border-border/30 bg-card">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-t from-sol-purple/10 to-sol-orange/5" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="font-display text-2xl font-black mb-4 flex items-center gap-3">
              <img src={logo} alt="Final Stake Logo" className="logo-flame w-10 h-10 animate-pulse-glow" />
              <span className="gradient-text">FINAL STAKE</span>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              The ultimate 100-player blockchain battle royale on Solana.
              Strategic warfare meets decentralized gaming.
            </p>
            <Button
              variant="sol"
              onClick={() => navigate('/register')}
              className="rounded-full"
            >
              Join Early Access
            </Button>
          </div>

          {/* Community Section */}
          <div>
            <h3 className="text-lg font-bold mb-6 text-secondary">Community</h3>
            <div className="space-y-4">
              {communityLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-muted-foreground hover:text-secondary 
                           transition-colors duration-300 group"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform duration-300">
                    {link.icon}
                  </span>
                  <span>{link.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Platform Section */}
          <div>
            <h3 className="text-lg font-bold mb-6 text-secondary">Platform</h3>
            <div className="space-y-4">
              {platformLinks.map((link, index) => (
                <button
                  key={index}
                  onClick={link.action}
                  className="block text-left text-muted-foreground hover:text-secondary 
                           transition-colors duration-300"
                >
                  {link.name}
                </button>
              ))}
              <a
                href="https://finalstake.gitbook.io/final-stake/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-left text-muted-foreground hover:text-secondary 
                         transition-colors duration-300"
              >
                Whitepaper
              </a>
            </div>
          </div>

          {/* About Section */}
          <div>
            <h3 className="text-lg font-bold mb-6 text-secondary">About</h3>
            <div className="space-y-4">
              {aboutLinks.map((link, index) => (
                <button
                  key={index}
                  onClick={link.action}
                  className="block text-left text-muted-foreground hover:text-secondary 
                           transition-colors duration-300"
                >
                  {link.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="border-t border-border/30 pt-12 mb-12 bg-background/50 rounded-lg p-8">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-xl font-bold mb-4 gradient-text">Stay Updated</h3>
            <p className="text-muted-foreground mb-6">
              Get the latest news, updates, and exclusive content delivered to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-full bg-background border border-border 
                         focus:border-sol-orange focus:ring-2 focus:ring-sol-orange/20 
                         outline-none transition-all duration-300"
              />
              <Button variant="sol" className="rounded-full px-6">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-border/30 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 Final Stake. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <button className="text-muted-foreground hover:text-secondary transition-colors">
                Privacy Policy
              </button>
              <button className="text-muted-foreground hover:text-secondary transition-colors">
                Terms of Service
              </button>
              <button className="text-muted-foreground hover:text-secondary transition-colors">
                Cookie Policy
              </button>
            </div>
          </div>
        </div>

        {/* Powered by Solana */}
        <div className="text-center mt-8 pt-8 border-t border-border/30">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span>Powered by</span>
            <span className="font-bold text-sol-purple">Solana</span>
            <span className="text-lg">⚡</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
