import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@project-serum/anchor';
import { User, LogOut, ChevronDown, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import solanaIdl from '../lib/solana_survivor.json';

const PROGRAM_ID = new PublicKey(solanaIdl.address);

export default function WalletDropdown() {
  const { publicKey, disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [level] = useState(1);
  const [xp] = useState(10);
  const [maxXp] = useState(12);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const wallet = useWallet();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if user is admin
  useEffect(() => {
    checkAdminStatus();
  }, [publicKey]);

  const checkAdminStatus = async () => {
    if (!publicKey) {
      setIsAdmin(false);
      setCheckingAdmin(false);
      return;
    }

    setCheckingAdmin(true);
    try {
      const connection = new Connection('https://api.devnet.solana.com');

      const [gameRegistryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('game_registry')],
        PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(gameRegistryPDA);

      if (!accountInfo) {
        console.log('Game registry account does not exist yet');
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      // Decode admin pubkey (skip 8 byte discriminator + 8 bytes gameCount + 8 bytes totalGamesCreated)
      const adminPubkeyBytes = accountInfo.data.slice(24, 56);
      const adminPubkey = new PublicKey(adminPubkeyBytes);

      console.log('Admin wallet:', adminPubkey.toString());
      console.log('Your wallet:', publicKey.toString());
      console.log('Is admin:', adminPubkey.toString() === publicKey.toString());

      setIsAdmin(adminPubkey.toString() === publicKey.toString());

    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  };

  if (!publicKey) return null;

  const address = publicKey.toBase58();
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
  const xpPercentage = (xp / maxXp) * 100;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sol-purple/20 border border-sol-purple/30 hover:bg-sol-purple/30 transition-all duration-300 relative"
      >
        {/* Admin Badge */}
        {isAdmin && !checkingAdmin && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-sol-orange rounded-full flex items-center justify-center animate-pulse-glow">
            <Shield className="w-2.5 h-2.5 text-white" />
          </div>
        )}

        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isAdmin ? 'bg-gradient-sol' : 'bg-gradient-sol'
          }`}>
          {address.slice(0, 2).toUpperCase()}
        </div>
        <span className="hidden md:block text-sm font-medium">{shortAddress}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-lg bg-card border border-border shadow-xl overflow-hidden z-50">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${isAdmin ? 'bg-gradient-sol' : 'bg-gradient-sol'
                }`}>
                {address.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-foreground flex items-center gap-2">
                  {shortAddress}
                  {isAdmin && (
                    <span className="px-2 py-0.5 rounded-full bg-sol-orange/20 text-sol-orange text-xs font-bold flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-sol-orange">Level {level}</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {xp} / {maxXp} XP
                </span>
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

            {/* Admin Dashboard Button */}
            {isAdmin && (
              <button
                onClick={() => {
                  navigate('/admin');
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sol-orange/10 text-sol-orange transition-colors text-left"
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold">Admin Dashboard</span>
              </button>
            )}

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