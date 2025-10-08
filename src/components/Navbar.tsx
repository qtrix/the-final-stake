import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import WalletDropdown from './WalletDropdown';
import logo from '@/assets/token-logo.png';
import { Menu, X, Swords } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function NavbarNew() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { connected } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
    setIsOpen(false);
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-lg border-b border-border/50' : 'bg-transparent'
      }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div
            className="font-display text-2xl lg:text-3xl font-black cursor-pointer flex items-center gap-3"
            onClick={() => navigate('/')}
          >
            <img src={logo} alt="Final Stake Logo" className="w-12 h-12 lg:w-16 lg:h-16 animate-pulse-glow" />
            <span className="gradient-text">FINAL STAKE</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-6">
            <button
              onClick={() => scrollToSection('home')}
              className="text-foreground hover:text-secondary transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-foreground hover:text-secondary transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('gameplay')}
              className="text-foreground hover:text-secondary transition-colors"
            >
              Gameplay
            </button>
            <button
              onClick={() => navigate('/roadmap')}
              className="text-foreground hover:text-secondary transition-colors"
            >
              Roadmap
            </button>

            <Button
              variant="sol"
              onClick={() => navigate('/lobby')}
              className="rounded-full flex items-center gap-2"
            >
              <Swords className="w-4 h-4" />
              Battle Lobby
            </Button>

            {connected ? (
              <WalletDropdown />
            ) : (
              <WalletMultiButton />
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden text-foreground p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden py-4 space-y-4 bg-background/95 backdrop-blur-lg border-t border-border/50">
            <button
              onClick={() => scrollToSection('home')}
              className="block w-full text-left text-foreground hover:text-secondary transition-colors py-2"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left text-foreground hover:text-secondary transition-colors py-2"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('gameplay')}
              className="block w-full text-left text-foreground hover:text-secondary transition-colors py-2"
            >
              Gameplay
            </button>
            <button
              onClick={() => navigate('/roadmap')}
              className="block w-full text-left text-foreground hover:text-secondary transition-colors py-2"
            >
              Roadmap
            </button>

            <Button
              variant="sol"
              onClick={() => navigate('/lobby')}
              className="w-full rounded-full flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" />
              Battle Lobby
            </Button>

            {connected ? (
              <WalletDropdown />
            ) : (
              <WalletMultiButton className="!w-full" />
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
