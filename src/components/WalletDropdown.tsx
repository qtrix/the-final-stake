import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WalletDropdown() {
  const { publicKey, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [level] = useState(1);
  const [xp] = useState(10);
  const [maxXp] = useState(12);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!publicKey) return null;

  const address = publicKey.toBase58();
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
  const xpPercentage = (xp / maxXp) * 100;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sol-purple/20 border border-sol-purple/30 hover:bg-sol-purple/30 transition-all duration-300"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-sol flex items-center justify-center font-bold text-sm">
          {address.slice(0, 2).toUpperCase()}
        </div>
        <span className="hidden md:block text-sm font-medium">{shortAddress}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-lg bg-card border border-border shadow-xl overflow-hidden z-50">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-sol flex items-center justify-center font-bold text-lg">
                {address.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-foreground">{shortAddress}</div>
                <div className="text-xs text-sol-orange">Level {level}</div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{xp} / {maxXp} XP</span>
                <span>{xpPercentage.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-sol transition-all duration-300"
                  style={{ width: `${xpPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                navigate('/profile');
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
            >
              <User className="w-4 h-4" />
              <span className="text-sm">Profile</span>
            </button>
            <button
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
