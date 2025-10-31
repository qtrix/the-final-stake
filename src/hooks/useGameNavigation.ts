// src/hooks/useGameNavigation.ts - Hook pentru navigare automată în funcție de faza jocului

'use client'; // Pentru Next.js App Router

import { useEffect, useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Pentru App Router
// SAU pentru Pages Router: import { useRouter } from 'next/router';
import { Game } from './useSolanaGame';
import {
    getGameRoute,
    getGameNavigationInfo,
    canAccessPhase,
    GamePhaseRoute,
    GameNavigationInfo
} from '@/lib/gameNavigation';
import { toast } from 'sonner';

export interface UseGameNavigationOptions {
    /** Dacă true, va face redirect automat când faza se schimbă */
    autoRedirect?: boolean;
    /** Dacă true, va afișa toast-uri când se face redirect */
    showToasts?: boolean;
    /** Delay în ms înainte de redirect (pentru a preveni flashing) */
    redirectDelay?: number;
    /** Callback când se face redirect */
    onRedirect?: (from: string, to: string, reason: string) => void;
    /** Verifică continuu faza (polling interval în ms) */
    pollingInterval?: number;
}

export interface UseGameNavigationReturn {
    /** Ruta corectă pentru faza curentă */
    correctRoute: GamePhaseRoute;
    /** Informații complete despre navigare */
    navigationInfo: GameNavigationInfo;
    /** Face redirect manual către faza corectă */
    redirectToCurrentPhase: () => void;
    /** Verifică dacă utilizatorul poate accesa o fază specifică */
    canAccessPhase: (phase: number) => { canAccess: boolean; reason?: string };
    /** Timpul rămas până la sfârșitul fazei */
    phaseTimeRemaining: number;
    /** Mesaj despre starea curentă */
    statusMessage: string;
}

/**
 * Hook pentru gestionarea automată a navigării în funcție de faza jocului
 * 
 * @example
 * ```tsx
 * function GamePage() {
 *   const { game } = useSolanaGame();
 *   const { navigationInfo, redirectToCurrentPhase } = useGameNavigation(game, {
 *     autoRedirect: true,
 *     showToasts: true,
 *   });
 * 
 *   return <div>Current phase: {navigationInfo.phase}</div>;
 * }
 * ```
 */
export function useGameNavigation(
    game: Game | null | undefined,
    options: UseGameNavigationOptions = {}
): UseGameNavigationReturn {
    const {
        autoRedirect = false,
        showToasts = true,
        redirectDelay = 1000,
        onRedirect,
        pollingInterval = 0, // 0 = disabled
    } = options;

    const router = useRouter();
    const pathname = usePathname(); // Pentru App Router
    // SAU pentru Pages Router: const pathname = router.pathname;

    const [lastPhase, setLastPhase] = useState<number>(0);
    const [isRedirecting, setIsRedirecting] = useState(false);

    // Obține informații despre navigare
    const correctRoute = getGameRoute(game);
    const navigationInfo = getGameNavigationInfo(game, pathname, game?.gameId);

    // Callback pentru redirect
    const redirectToCurrentPhase = useCallback(() => {
        if (!correctRoute || isRedirecting) return;

        const targetRoute = navigationInfo.route || correctRoute;
        if (pathname === targetRoute) return;

        setIsRedirecting(true);

        if (showToasts) {
            toast.info(navigationInfo.message || 'Redirecting to current phase...');
        }

        if (onRedirect) {
            onRedirect(pathname, targetRoute, navigationInfo.message);
        }

        // Delay pentru a preveni flashing
        setTimeout(() => {
            router.push(targetRoute);
            setIsRedirecting(false);
        }, redirectDelay);
    }, [
        correctRoute,
        navigationInfo,
        pathname,
        isRedirecting,
        showToasts,
        onRedirect,
        router,
        redirectDelay,
    ]);

    // Auto-redirect când faza se schimbă
    useEffect(() => {
        if (!autoRedirect || !game) return;

        // Detectează schimbarea fazei
        if (game.currentPhase !== lastPhase && lastPhase !== 0) {
            console.log(`🎮 Phase changed: ${lastPhase} → ${game.currentPhase}`);

            if (showToasts) {
                toast.success(`Phase ${game.currentPhase} started! 🚀`);
            }

            redirectToCurrentPhase();
        }

        setLastPhase(game.currentPhase);
    }, [game?.currentPhase, lastPhase, autoRedirect, redirectToCurrentPhase, showToasts]);

    // Redirect inițial (dacă utilizatorul este pe ruta greșită)
    useEffect(() => {
        if (!autoRedirect || !game || isRedirecting) return;

        // Verifică doar dacă este pe ruta complet greșită
        if (navigationInfo.shouldRedirect) {
            console.log(`🔄 Wrong route detected. Redirecting from ${pathname} to ${navigationInfo.route}`);
            redirectToCurrentPhase();
        }
    }, [autoRedirect, game, navigationInfo.shouldRedirect, pathname, isRedirecting, redirectToCurrentPhase]);

    // Polling pentru verificări periodice
    useEffect(() => {
        if (!pollingInterval || pollingInterval <= 0 || !autoRedirect) return;

        const interval = setInterval(() => {
            if (game && navigationInfo.shouldRedirect && !isRedirecting) {
                console.log('🔄 Polling: Phase mismatch detected');
                redirectToCurrentPhase();
            }
        }, pollingInterval);

        return () => clearInterval(interval);
    }, [pollingInterval, autoRedirect, game, navigationInfo.shouldRedirect, isRedirecting, redirectToCurrentPhase]);

    // Helper pentru verificare access la fază
    const checkPhaseAccess = useCallback((phase: number) => {
        return canAccessPhase(game, phase);
    }, [game]);

    // Calculează timpul rămas
    const phaseTimeRemaining = game
        ? Math.max(0, game.phaseEndTime.getTime() - Date.now())
        : 0;

    return {
        correctRoute,
        navigationInfo,
        redirectToCurrentPhase,
        canAccessPhase: checkPhaseAccess,
        phaseTimeRemaining,
        statusMessage: navigationInfo.message,
    };
}

/**
 * Hook simplificat - doar pentru auto-redirect
 * 
 * @example
 * ```tsx
 * function GamePage() {
 *   const { game } = useSolanaGame();
 *   useAutoGameRedirect(game); // Asta e tot! 🎯
 * 
 *   return <div>Game content</div>;
 * }
 * ```
 */
export function useAutoGameRedirect(
    game: Game | null | undefined,
    showToasts = true
) {
    useGameNavigation(game, {
        autoRedirect: true,
        showToasts,
        redirectDelay: 500,
    });
}

/**
 * Hook pentru protecție de rută - previne accesul la faze invalide
 * 
 * @example
 * ```tsx
 * function Phase2Page() {
 *   const { game } = useSolanaGame();
 *   const { isAllowed, reason } = usePhaseGuard(game, 2);
 * 
 *   if (!isAllowed) {
 *     return <div>Access denied: {reason}</div>;
 *   }
 * 
 *   return <div>Phase 2 content</div>;
 * }
 * ```
 */
export function usePhaseGuard(
    game: Game | null | undefined,
    requiredPhase: number
): { isAllowed: boolean; reason?: string; redirecting: boolean } {
    const router = useRouter();
    const [redirecting, setRedirecting] = useState(false);

    const access = canAccessPhase(game, requiredPhase);

    useEffect(() => {
        if (!access.canAccess && game) {
            console.log(`🚫 Phase ${requiredPhase} access denied: ${access.reason}`);
            toast.error(access.reason || 'Access denied');

            setRedirecting(true);
            setTimeout(() => {
                const correctRoute = getGameRoute(game);
                if (correctRoute) {
                    router.push(`${correctRoute}/${game.gameId}`);
                } else {
                    router.push('/');
                }
            }, 1500);
        }
    }, [access.canAccess, access.reason, game, requiredPhase, router]);

    return {
        isAllowed: access.canAccess,
        reason: access.reason,
        redirecting,
    };
}