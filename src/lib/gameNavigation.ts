// src/lib/gameNavigation.ts - Utilități pentru navigare automată în funcție de faza jocului

import { Game } from '@/hooks/useSolanaGame';

export type GamePhaseRoute =
    | '/lobby'           // Jocul nu a început, se așteaptă jucători
    | '/game/phase1'     // Phase 1: Resource Allocation
    | '/game/phase2'     // Phase 2: Mini Games Arena
    | '/game/phase3'     // Phase 3: The Purge / Battle Royale
    | '/game/completed'  // Jocul s-a terminat
    | '/game/cancelled'  // Jocul a fost anulat
    | null;              // Nu se poate determina sau jocul nu există

export interface GameNavigationInfo {
    route: GamePhaseRoute;
    shouldRedirect: boolean;
    phase: number;
    status: Game['status'];
    message: string;
}

/**
 * Determină ruta corectă pentru un joc în funcție de starea sa
 */
export function getGameRoute(game: Game | null | undefined): GamePhaseRoute {
    if (!game) return null;

    // Verifică starea jocului
    switch (game.status) {
        case 'WaitingForPlayers':
        case 'ReadyToStart':
            return '/lobby';

        case 'Cancelled':
            return '/game/cancelled';

        case 'Completed':
            return '/game/completed';

        case 'Expired':
        case 'ExpiredWithPenalty':
            return '/game/cancelled';

        case 'InProgress':
            // Verifică faza curentă
            if (game.currentPhase === 1) {
                return '/game/phase1';
            } else if (game.currentPhase === 2) {
                return '/game/phase2';
            } else if (game.currentPhase === 3) {
                return '/game/phase3';
            }
            // Fallback
            return '/lobby';

        default:
            return '/lobby';
    }
}

/**
 * Obține informații complete despre navigarea jocului
 */
export function getGameNavigationInfo(
    game: Game | null | undefined,
    currentPath: string,
    gameId?: number
): GameNavigationInfo {
    const route = getGameRoute(game);

    if (!game || !route) {
        return {
            route: null,
            shouldRedirect: false,
            phase: 0,
            status: 'WaitingForPlayers',
            message: 'Game not found',
        };
    }

    // Construiește ruta completă cu gameId
    const fullRoute = route === '/lobby'
        ? `/lobby/${gameId}`
        : `${route}/${gameId}`;

    // Verifică dacă trebuie să facă redirect
    const shouldRedirect = currentPath !== fullRoute && currentPath !== route;

    // Construiește mesajul
    let message = '';
    switch (game.status) {
        case 'WaitingForPlayers':
            message = `Waiting for ${game.maxPlayers - game.currentPlayers} more players...`;
            break;
        case 'ReadyToStart':
            message = 'Game ready to start!';
            break;
        case 'InProgress':
            message = `Phase ${game.currentPhase} in progress`;
            break;
        case 'Completed':
            message = 'Game completed';
            break;
        case 'Cancelled':
            message = 'Game cancelled';
            break;
        case 'Expired':
        case 'ExpiredWithPenalty':
            message = 'Game expired';
            break;
    }

    return {
        route: fullRoute as GamePhaseRoute,
        shouldRedirect,
        phase: game.currentPhase,
        status: game.status,
        message,
    };
}

/**
 * Verifică dacă un jucător poate accesa o anumită fază
 */
export function canAccessPhase(
    game: Game | null | undefined,
    targetPhase: number,
    playerAddress?: string
): { canAccess: boolean; reason?: string } {
    if (!game) {
        return { canAccess: false, reason: 'Game not found' };
    }

    // Verifică dacă jucătorul este în joc
    if (playerAddress && !game.players.includes(playerAddress)) {
        return { canAccess: false, reason: 'You are not in this game' };
    }

    // Verifică dacă jocul a început
    if (!game.gameStarted) {
        return { canAccess: false, reason: 'Game has not started yet' };
    }

    // Verifică dacă faza țintă este faza curentă sau anterioară
    if (targetPhase > game.currentPhase) {
        return {
            canAccess: false,
            reason: `Phase ${targetPhase} is not available yet. Current phase: ${game.currentPhase}`
        };
    }

    // Verifică statutul jocului
    if (game.status !== 'InProgress') {
        return {
            canAccess: false,
            reason: `Game is ${game.status.toLowerCase()}`
        };
    }

    return { canAccess: true };
}

/**
 * Obține timpul rămas până la sfârșitul fazei
 */
export function getPhaseTimeRemaining(game: Game): {
    timeRemaining: number;
    phaseEndTime: Date;
    hasExpired: boolean;
} {
    const now = new Date();
    const phaseEndTime = game.phaseEndTime;
    const timeRemaining = phaseEndTime.getTime() - now.getTime();
    const hasExpired = timeRemaining <= 0;

    return {
        timeRemaining: Math.max(0, timeRemaining),
        phaseEndTime,
        hasExpired,
    };
}

/**
 * Formatează timpul rămas într-un string lizibil
 */
export function formatTimeRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return 'Expired';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}