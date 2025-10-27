// src/utils/purgeDiagnostics.ts - Debugging & Monitoring Utility

import { purgeWsManager } from '@/lib/purgeWsManager';

/**
 * Comprehensive diagnostics for Purge multiplayer
 */
export class PurgeDiagnostics {
    private logHistory: string[] = [];
    private maxHistorySize = 100;
    private startTime = Date.now();

    /**
     * Get full system status
     */
    getSystemStatus() {
        const stats = purgeWsManager.getStats();
        const uptime = Date.now() - this.startTime;

        return {
            timestamp: new Date().toISOString(),
            uptime: Math.floor(uptime / 1000),
            connection: {
                connected: stats.connected,
                quality: stats.connectionQuality || 'unknown',
                latency: stats.latency || 0,
                reconnectAttempts: stats.reconnectAttempts || 0
            },
            performance: {
                queueSize: stats.queueSize || 0,
                pendingUpdates: stats.pendingUpdates || 0,
                messageCount: stats.messageCount || 0,
                messagesPerSecond: this.calculateMessagesPerSecond()
            },
            game: {
                gameId: stats.gameId || 'none',
                playerId: stats.playerId || 'none',
                handlers: stats.handlers || 0
            },
            browser: {
                online: navigator.onLine,
                userAgent: navigator.userAgent,
                connectionType: (navigator as any).connection?.effectiveType || 'unknown'
            }
        };
    }

    /**
     * Test WebSocket connection
     */
    async testConnection(wsUrl: string, gameId: string, playerId: string): Promise<{
        success: boolean;
        latency?: number;
        error?: string;
    }> {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let ws: WebSocket | null = null;
            let timeout: NodeJS.Timeout;

            try {
                const url = `${wsUrl}/game?gameId=${gameId}&playerId=${playerId}`;
                ws = new WebSocket(url);

                timeout = setTimeout(() => {
                    ws?.close();
                    resolve({
                        success: false,
                        error: 'Connection timeout (10s)'
                    });
                }, 10000);

                ws.onopen = () => {
                    const latency = Date.now() - startTime;
                    clearTimeout(timeout);
                    ws?.close();
                    resolve({
                        success: true,
                        latency
                    });
                };

                ws.onerror = () => {
                    clearTimeout(timeout);
                    resolve({
                        success: false,
                        error: 'Connection failed'
                    });
                };
            } catch (error) {
                clearTimeout(timeout!);
                resolve({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }

    /**
     * Measure actual latency
     */
    async measureLatency(iterations = 5): Promise<{
        min: number;
        max: number;
        avg: number;
        median: number;
    }> {
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = Date.now();

            // Simulate a ping-pong
            await new Promise(resolve => setTimeout(resolve, 10));

            latencies.push(Date.now() - start);
        }

        latencies.sort((a, b) => a - b);

        return {
            min: latencies[0],
            max: latencies[latencies.length - 1],
            avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            median: latencies[Math.floor(latencies.length / 2)]
        };
    }

    /**
     * Log message with timestamp
     */
    log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        this.logHistory.push(logMessage);

        // Trim history
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }

        // Also log to console with appropriate method
        const consoleMethod = level === 'error' ? console.error :
            level === 'warn' ? console.warn :
                console.log;

        consoleMethod(`[Purge]`, message);
    }

    /**
     * Get recent logs
     */
    getLogs(count = 20): string[] {
        return this.logHistory.slice(-count);
    }

    /**
     * Clear logs
     */
    clearLogs() {
        this.logHistory = [];
    }

    /**
     * Export diagnostics report
     */
    exportReport(): string {
        const status = this.getSystemStatus();
        const logs = this.getLogs(50);

        const report = `
════════════════════════════════════════════
PURGE MULTIPLAYER DIAGNOSTICS REPORT
════════════════════════════════════════════

Generated: ${new Date().toISOString()}
Uptime: ${status.uptime}s

─────────────────────────────────────────────
CONNECTION STATUS
─────────────────────────────────────────────
Connected: ${status.connection.connected}
Quality: ${status.connection.quality}
Latency: ${status.connection.latency}ms
Reconnect Attempts: ${status.connection.reconnectAttempts}

─────────────────────────────────────────────
PERFORMANCE
─────────────────────────────────────────────
Queue Size: ${status.performance.queueSize}
Pending Updates: ${status.performance.pendingUpdates}
Total Messages: ${status.performance.messageCount}
Messages/sec: ${status.performance.messagesPerSecond}

─────────────────────────────────────────────
GAME STATE
─────────────────────────────────────────────
Game ID: ${status.game.gameId}
Player ID: ${status.game.playerId}
Active Handlers: ${status.game.handlers}

─────────────────────────────────────────────
BROWSER INFO
─────────────────────────────────────────────
Online: ${status.browser.online}
Connection Type: ${status.browser.connectionType}
User Agent: ${status.browser.userAgent}

─────────────────────────────────────────────
RECENT LOGS (Last 50)
─────────────────────────────────────────────
${logs.join('\n')}

════════════════════════════════════════════
`;

        return report;
    }

    /**
     * Download diagnostics report
     */
    downloadReport() {
        const report = this.exportReport();
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `purge-diagnostics-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Calculate messages per second
     */
    private calculateMessagesPerSecond(): number {
        const stats = purgeWsManager.getStats();
        const uptime = (Date.now() - this.startTime) / 1000;
        return uptime > 0 ? Math.round((stats.messageCount || 0) / uptime) : 0;
    }
}

// Singleton instance
export const purgeDiagnostics = new PurgeDiagnostics();

/**
 * React Component for Debug Panel
 */
import { useState, useEffect } from 'react';

export function PurgeDebugPanel() {
    const [status, setStatus] = useState<any>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStatus(purgeDiagnostics.getSystemStatus());
            if (showLogs) {
                setLogs(purgeDiagnostics.getLogs(20));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [showLogs]);

    if (!status) return null;

    return (
        <div 
            className= "fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg max-w-md text-xs font-mono"
    style = {{ zIndex: 9999 }
}
        >
    <div className="flex justify-between items-center mb-2" >
        <h3 className="font-bold text-sm" > Purge Debug < /h3>
            < button
onClick = {() => purgeDiagnostics.downloadReport()}
className = "px-2 py-1 bg-blue-600 rounded text-xs"
    >
    Export
    < /button>
    < /div>

{/* Connection Status */ }
<div className="mb-2" >
    <div className="flex items-center gap-2" >
        <div 
                        className={
    `w-2 h-2 rounded-full ${status.connection.connected ? 'bg-green-500' : 'bg-red-500'
    }`
}
/>
    < span className = {`${status.connection.quality === 'good' ? 'text-green-400' :
            status.connection.quality === 'fair' ? 'text-yellow-400' :
                'text-red-400'
        }`}>
            { status.connection.quality.toUpperCase() }
            < /span>
            < span className = "text-gray-400" >
                { status.connection.latency }ms
                    < /span>
                    < /div>
                    < /div>

{/* Performance */ }
<div className="grid grid-cols-2 gap-2 mb-2 text-xs" >
    <div>
    <span className="text-gray-400" > Queue: </span>
        < span className = "ml-1" > { status.performance.queueSize } < /span>
            < /div>
            < div >
            <span className="text-gray-400" > Pending: </span>
                < span className = "ml-1" > { status.performance.pendingUpdates } < /span>
                    < /div>
                    < div >
                    <span className="text-gray-400" > Messages: </span>
                        < span className = "ml-1" > { status.performance.messageCount } < /span>
                            < /div>
                            < div >
                            <span className="text-gray-400" > Msg / s: </span>
                                < span className = "ml-1" > { status.performance.messagesPerSecond } < /span>
                                    < /div>
                                    < /div>

{/* Game Info */ }
<div className="mb-2 text-xs" >
    <div className="text-gray-400" > Game: { status.game.gameId } </div>
        < div className = "text-gray-400" > Player: { status.game.playerId } </div>
            < /div>

{/* Logs Toggle */ }
<button
                onClick={ () => setShowLogs(!showLogs) }
className = "w-full px-2 py-1 bg-gray-800 rounded text-xs mb-2"
    >
    { showLogs? 'Hide': 'Show' } Logs
        < /button>

{/* Logs */ }
{
    showLogs && (
        <div className="max-h-48 overflow-y-auto bg-black p-2 rounded text-xs" >
        {
            logs.map((log, i) => (
                <div key= { i } className = "mb-1 text-gray-300" >
                { log }
                < /div>
            ))
        }
            < /div>
            )
}
</div>
    );
}

/**
 * Usage Example:
 * 
 * import { PurgeDebugPanel, purgeDiagnostics } from '@/utils/purgeDiagnostics';
 * 
 * // In your component:
 * <PurgeDebugPanel />
 * 
 * // Or programmatically:
 * console.log(purgeDiagnostics.getSystemStatus());
 * purgeDiagnostics.downloadReport();
 */