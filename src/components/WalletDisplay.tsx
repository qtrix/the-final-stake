import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Copy } from 'lucide-react';
import { useState } from 'react';

export default function WalletDisplay() {
  const { connected, publicKey, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!connected || !publicKey) return null;

  const address = publicKey.toBase58();
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all duration-300"
        style={{
          background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.1), hsla(15, 100%, 50%, 0.05))',
          border: '1px solid hsla(280, 100%, 35%, 0.3)',
          backdropFilter: 'blur(10px)'
        }}
        onClick={handleCopy}
      >
        <Wallet className="w-4 h-4" style={{ color: 'hsl(280, 100%, 35%)' }} />
        <span className="text-sm font-medium" style={{ color: 'hsl(0, 0%, 90%)' }}>
          {shortAddress}
        </span>
        <Copy className="w-3 h-3" style={{ color: 'hsl(0, 0%, 70%)' }} />
      </div>

      {copied && (
        <span className="text-xs animate-pulse" style={{ color: 'hsl(15, 100%, 50%)' }}>
          Copied!
        </span>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={disconnect}
        className="px-3 py-2 rounded-xl border transition-all duration-300 hover:scale-105"
        style={{
          background: 'transparent',
          color: 'hsl(15, 100%, 50%)',
          borderColor: 'hsl(15, 100%, 50%)'
        }}
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}