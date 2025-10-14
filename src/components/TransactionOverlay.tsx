import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface TransactionOverlayProps {
    show: boolean;
    message?: string;
}

export default function TransactionOverlay({ show, message = 'Finalizing transaction...' }: TransactionOverlayProps) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
            <Card className="p-8 max-w-md mx-4">
                <div className="text-center">
                    <Loader2 className="w-16 h-16 animate-spin text-sol-orange mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Processing</h3>
                    <p className="text-muted-foreground">{message}</p>
                    <p className="text-sm text-muted-foreground mt-4">Please wait, do not close this window...</p>
                </div>
            </Card>
        </div>
    );
}