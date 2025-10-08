import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, ExternalLink, ChevronRight } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName } from '@solana/wallet-adapter-base';


interface WalletConnectModalProps {
  children: React.ReactNode;
}

export default function WalletConnectModal({ children }: WalletConnectModalProps) {
  const [open, setOpen] = useState(false);
  const { select, connect, connecting, connected, wallets } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const handleConnect = async (walletName: string) => {
    setSelectedWallet(walletName);
    try {
      select(walletName as WalletName);
      await connect();
      setOpen(false);
    } catch (error) {
      console.error("Failed to connect:", error);
      alert(`Failed to connect to ${walletName}. Please make sure it's installed and unlocked.`);
    } finally {
      setSelectedWallet(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-0"
        style={{
          background: 'linear-gradient(135deg, hsl(280, 100%, 5%), hsl(15, 100%, 5%))',
          boxShadow: '0 25px 50px -12px hsla(280, 100%, 35%, 0.5)'
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.1), hsla(15, 100%, 50%, 0.05))',
          }}
        />
        <div className="relative">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle
              className="text-2xl font-bold text-center flex items-center justify-center gap-2"
              style={{ color: 'hsl(0, 0%, 90%)' }}
            >
              <Wallet className="w-6 h-6" style={{ color: 'hsl(280, 100%, 35%)' }} />
              Connect Wallet
            </DialogTitle>
            <p
              className="text-center text-sm mt-2"
              style={{ color: 'hsl(0, 0%, 70%)' }}
            >
              Connect your wallet to start playing SOL ROYALE
            </p>
          </DialogHeader>

          <div className="px-6 pb-6">
            <div className="space-y-3">
              {wallets.map((wallet) => {
                const isConnecting = selectedWallet === wallet.adapter.name;

                return (
                  <div
                    key={wallet.adapter.name}
                    className="group relative overflow-hidden rounded-xl p-4 cursor-pointer transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.1), hsla(15, 100%, 50%, 0.05))',
                      border: '1px solid hsla(280, 100%, 35%, 0.3)',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => handleConnect(wallet.adapter.name)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'hsl(15, 100%, 50%)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'hsla(280, 100%, 35%, 0.3)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {wallet.adapter.icon ? (
                            <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-8 h-8" />
                          ) : (
                            <Wallet className="w-8 h-8" />
                          )}
                        </div>
                        <div>
                          <div
                            className="font-semibold text-sm"
                            style={{ color: 'hsl(0, 0%, 90%)' }}
                          >
                            {wallet.adapter.name}
                          </div>
                          <div
                            className="text-xs"
                            style={{ color: 'hsl(0, 0%, 70%)' }}
                          >
                            {wallet.readyState === 'Installed' ? 'Ready to connect' : 'Click to install'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {wallet.readyState !== 'Installed' ? (
                          <div className="flex items-center gap-1">
                            <ExternalLink
                              className="w-4 h-4"
                              style={{ color: 'hsl(15, 100%, 50%)' }}
                            />
                            <span
                              className="text-xs font-medium"
                              style={{ color: 'hsl(15, 100%, 50%)' }}
                            >
                              Install
                            </span>
                          </div>
                        ) : isConnecting ? (
                          <div className="animate-spin w-4 h-4 rounded-full border-2 border-t-transparent"
                            style={{ borderColor: 'hsl(280, 100%, 35%)' }} />
                        ) : (
                          <ChevronRight
                            className="w-4 h-4 transition-transform group-hover:translate-x-1"
                            style={{ color: 'hsl(280, 100%, 35%)' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="mt-6 p-4 rounded-xl text-center"
              style={{
                background: 'linear-gradient(135deg, hsla(280, 100%, 35%, 0.2), hsla(15, 100%, 50%, 0.1))',
                border: '1px solid hsla(15, 100%, 50%, 0.5)'
              }}
            >
              <p
                className="text-sm mb-2"
                style={{ color: 'hsl(0, 0%, 90%)' }}
              >
                New to Solana wallets?
              </p>
              <button
                className="text-sm font-medium hover:underline"
                style={{ color: 'hsl(15, 100%, 50%)' }}
                onClick={() => window.open('https://docs.solana.com/wallet-guide', '_blank')}
              >
                Learn how to get started →
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}