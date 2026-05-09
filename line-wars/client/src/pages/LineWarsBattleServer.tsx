// ─── Server-Authoritative Line Wars Battle Component ────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Hand, Flag, RotateCcw, Users, Trophy, Clock, Wifi, WifiOff } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { toast } from "sonner";
import { LineWarsRenderer } from "@/lib/games/linewars/renderer";
import { LineWarsClientSync, LineWarsGameState } from "@/lib/games/linewars/client-sync";
import { getEquippedAvatarUrl, getUserEquippedAvatarFromFirestore } from "@/lib/shop/avatarResolver";

interface BattleData {
  battleId: string;
  battleType: string;
  player1: {
    uid: string;
    displayName: string;
    photoURL: string | null;
    equippedAvatar: string | null;
  };
  player2: {
    uid: string;
    displayName: string;
    photoURL: string | null;
    equippedAvatar: string | null;
  };
  status: string;
  createdAt: number;
  player1Score?: number;
  player2Score?: number;
  winner?: string;
}

export default function LineWarsBattleServer() {
  const { theme } = useTheme();
  const { user } = useFirebaseAuth();
  const [searchParams] = useSearchParams();
  const [, setLocation] = useLocation();

  const battleId = searchParams.get("battleId");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LineWarsRenderer | null>(null);
  const clientSyncRef = useRef<LineWarsClientSync | null>(null);
  const engineStubRef = useRef<any>(null);

  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [gameState, setGameState] = useState<LineWarsGameState | null>(null);
  const [playerSlot, setPlayerSlot] = useState<"player1" | "player2" | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showDrawRequest, setShowDrawRequest] = useState(false);
  const [playerProfiles, setPlayerProfiles] = useState<{
    player1: { displayName: string; avatarUrl: string };
    player2: { displayName: string; avatarUrl: string };
  } | null>(null);

  // Initialize engine stub for renderer
  const initializeEngineStub = useCallback(() => {
    let _lastState: LineWarsGameState | null = null;
    const engineStub = {
      getState: () => {
        if (_lastState) {
          return _lastState;
        }
        return {
          players: {
            player1: { x: 10, y: 25, direction: 0, alive: true, color: "#00ffff", trail: { owner: "player1", points: [], active: false }, territories: [], speed: 2, id: "player1" },
            player2: { x: 40, y: 25, direction: Math.PI, alive: true, color: "#ff00ff", trail: { owner: "player2", points: [], active: false }, territories: [], speed: 2, id: "player2" }
          },
          gameStatus: "waiting" as const,
          gameTime: 0,
          lastUpdate: Date.now(),
          gridSize: 50,
          cellSize: 12,
          winner: undefined,
          drawRequestedBy: undefined
        } as unknown as LineWarsGameState;
      },
      setLastState: (state: LineWarsGameState) => {
        _lastState = state;
      },
      setBattleId: () => {},
      setCallbacks: () => {},
      start: () => {},
      stop: () => {},
      changeDirection: () => {},
      requestDraw: () => {},
      forfeit: () => {},
      reset: () => {}
    } as unknown as any;

    engineStubRef.current = engineStub;
    return engineStub;
  }, []);

  // Connect to WebSocket server
  const connectToServer = useCallback(async () => {
    if (!battleId || !user || connecting) return;

    setConnecting(true);
    setConnectionError(null);

    try {
      const clientSync = new LineWarsClientSync(
        process.env.NODE_ENV === 'production' 
          ? 'wss://your-server.com' 
          : 'ws://localhost:8080'
      );

      // Set up event handlers
      clientSync.onConnected((clientId) => {
        console.log('[LineWarsBattle] Connected to server:', clientId);
        setConnected(true);
        setConnecting(false);
      });

      clientSync.onJoinedGame((slot) => {
        console.log('[LineWarsBattle] Joined game as:', slot);
        setPlayerSlot(slot);
      });

      clientSync.onGameState((state) => {
        setGameState(state);
        if (engineStubRef.current) {
          engineStubRef.current.setLastState(state);
        }
        rendererRef.current?.render(state);
      });

      clientSync.onError((error) => {
        console.error('[LineWarsBattle] Server error:', error);
        setConnectionError(error);
        setConnecting(false);
        toast.error(`Server error: ${error}`);
      });

      clientSync.onDisconnected(() => {
        console.log('[LineWarsBattle] Disconnected from server');
        setConnected(false);
        toast.error('Disconnected from server');
      });

      // Connect to server
      await clientSync.connect();
      
      // Join game
      await clientSync.joinGame(battleId, user.uid);
      
      clientSyncRef.current = clientSync;

    } catch (error: any) {
      console.error('[LineWarsBattle] Failed to connect:', error);
      setConnectionError(error.message || 'Failed to connect to server');
      setConnecting(false);
      toast.error('Failed to connect to game server');
    }
  }, [battleId, user, connecting]);

  // Initialize renderer when canvas is ready
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      const engineStub = initializeEngineStub();
      const renderer = new LineWarsRenderer(canvasRef.current, engineStub);
      
      // Optimize for mobile
      if (typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)) {
        renderer.setMobileOptimizations(true);
      }

      rendererRef.current = renderer;
    }
  }, [initializeEngineStub]);

  // Load battle data
  useEffect(() => {
    if (!battleId) {
      setLocation("/battle-arena");
      return;
    }

    // For now, create mock battle data
    // In production, this would come from Firebase or your backend
    const mockBattleData: BattleData = {
      battleId,
      battleType: "line-wars",
      player1: {
        uid: "mock-player1",
        displayName: "Player 1",
        photoURL: null,
        equippedAvatar: null
      },
      player2: {
        uid: "mock-player2", 
        displayName: "Player 2",
        photoURL: null,
        equippedAvatar: null
      },
      status: "waiting",
      createdAt: Date.now()
    };

    setBattleData(mockBattleData);

    // Load player profiles
    const loadProfiles = async () => {
      try {
        const [p1Profile, p2Profile] = await Promise.all([
          getUserEquippedAvatarFromFirestore(mockBattleData.player1.uid),
          getUserEquippedAvatarFromFirestore(mockBattleData.player2.uid)
        ]);

        setPlayerProfiles({
          player1: {
            displayName: p1Profile.displayName || mockBattleData.player1.displayName,
            avatarUrl: getEquippedAvatarUrl(p1Profile.equippedAvatar || undefined, p1Profile.photoURL || undefined)
          },
          player2: {
            displayName: p2Profile.displayName || mockBattleData.player2.displayName,
            avatarUrl: getEquippedAvatarUrl(p2Profile.equippedAvatar || undefined, p2Profile.photoURL || undefined)
          }
        });
      } catch (error) {
        console.error('[LineWarsBattle] Failed to load profiles:', error);
      }
    };

    loadProfiles();
    setLoading(false);
  }, [battleId, setLocation]);

  // Connect to server when battle data is loaded
  useEffect(() => {
    if (!loading && battleData && user && rendererRef.current) {
      connectToServer();
    }
  }, [loading, battleData, user, rendererRef.current, connectToServer]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!connected || !clientSyncRef.current || gameState?.gameStatus !== "playing") return;

    let direction: number | null = null;

    // Map keys to directions
    switch (e.key) {
      case "ArrowUp":
      case "w":
        direction = -Math.PI / 2;
        break;
      case "ArrowRight":
      case "d":
        direction = 0;
        break;
      case "ArrowDown":
      case "s":
        direction = Math.PI / 2;
        break;
      case "ArrowLeft":
      case "a":
        direction = Math.PI;
        break;
    }

    if (direction !== null) {
      clientSyncRef.current.sendPlayerInput(direction);
      return;
    }

    // Handle game actions
    if (e.key === " " && gameState.gameStatus === "playing") {
      e.preventDefault();
      clientSyncRef.current.sendGameAction({ type: "draw_request", timestamp: Date.now() });
      setShowDrawRequest(true);
      setTimeout(() => setShowDrawRequest(false), 3000);
    }

    if ((e.key === "f" || e.key === "Backspace") && gameState.gameStatus === "playing") {
      e.preventDefault();
      clientSyncRef.current.sendGameAction({ type: "forfeit", timestamp: Date.now() });
    }

    if (e.key === "r" && gameState.gameStatus !== "playing") {
      clientSyncRef.current.sendGameAction({ type: "reset", timestamp: Date.now() });
    }
  }, [connected, gameState?.gameStatus]);

  // Handle touch input
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!connected || !clientSyncRef.current || gameState?.gameStatus !== "playing") return;

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    const handleTouchEnd = (endEvt: TouchEvent) => {
      const endTouch = endEvt.changedTouches[0];
      const deltaX = endTouch.clientX - startX;
      const deltaY = endTouch.clientY - startY;

      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        document.removeEventListener("touchend", handleTouchEnd);
        return;
      }

      let direction: number;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        direction = deltaX > 0 ? 0 : Math.PI;
      } else {
        direction = deltaY > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      clientSyncRef.current?.sendPlayerInput(direction);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchend", handleTouchEnd);
  }, [connected, gameState?.gameStatus]);

  // Set up event listeners
  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("touchstart", handleTouchStart);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTouchStart);
      }
    };
  }, [handleKeyPress, handleTouchStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientSyncRef.current?.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.gradient }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading battle...</p>
        </div>
      </div>
    );
  }

  if (!battleData || !playerProfiles) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.gradient }}>
        <p className="text-white">Battle data not found</p>
      </div>
    );
  }

  const myRole = playerSlot === "player1" ? "Player 1 (Cyan)" : playerSlot === "player2" ? "Player 2 (Magenta)" : "Spectator";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.gradient }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)" }}>
        <button 
          onClick={() => setLocation("/battle-arena")}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Leave</span>
        </button>

        <div className="text-center">
          <h1 className="text-lg font-bold text-white">⚡ Line Wars</h1>
          <p className="text-xs text-white/60">{myRole}</p>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <div className="flex items-center gap-1 text-green-400">
              <Wifi className="w-4 h-4" />
              <span className="text-xs">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-400">
              <WifiOff className="w-4 h-4" />
              <span className="text-xs">
                {connecting ? "Connecting..." : "Disconnected"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Players Info */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(0,0,0,0.2)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: "#00ffff" }}>
            <img src={playerProfiles.player1.avatarUrl} className="w-full h-full object-cover" alt="" />
          </div>
          <div>
            <p className="text-sm font-bold text-white" style={{ color: "#00ffff" }}>{playerProfiles.player1.displayName}</p>
            <p className="text-xs text-white/60">Player 1</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-white/40">VS</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-white" style={{ color: "#ff00ff" }}>{playerProfiles.player2.displayName}</p>
            <p className="text-xs text-white/60">Player 2</p>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: "#ff00ff" }}>
            <img src={playerProfiles.player2.avatarUrl} className="w-full h-full object-cover" alt="" />
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-2xl border"
            style={{ borderColor: "rgba(255,255,255,0.2)" }}
          />

          {/* Connection overlay */}
          {!connected && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg" style={{ background: "rgba(0,0,0,0.8)" }}>
              <div className="text-center px-6">
                {connecting ? (
                  <>
                    <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-bold text-blue-300">Connecting to server...</p>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-bold text-red-300 mb-2">Connection Lost</p>
                    {connectionError && (
                      <p className="text-xs text-red-200 mb-3">{connectionError}</p>
                    )}
                    <button
                      onClick={connectToServer}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                    >
                      Reconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Draw request notification */}
          <AnimatePresence>
            {showDrawRequest && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg"
                style={{ background: "rgba(255,255,0,0.2)", border: "1px solid #ffff00" }}
              >
                <p className="text-sm font-bold text-yellow-300">Draw request sent!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 space-y-3">
        {/* Game Status */}
        {gameState && gameState.gameStatus !== "playing" && (
          <div className="text-center p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
            <p className="text-lg font-bold text-white">
              {gameState.gameStatus === "draw" ? "Draw!" :
               gameState.gameStatus === "player1_win" ? `${playerProfiles.player1.displayName} Wins!` :
               `${playerProfiles.player2.displayName} Wins!`}
            </p>
            <button
              onClick={() => {
                clientSyncRef.current?.sendGameAction({ type: "reset", timestamp: Date.now() });
              }}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 mx-auto"
              style={{ background: "linear-gradient(135deg, #00ffff, #ff00ff)" }}
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}

        {/* Control Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              clientSyncRef.current?.sendGameAction({ type: "draw_request", timestamp: Date.now() });
              setShowDrawRequest(true);
              setTimeout(() => setShowDrawRequest(false), 3000);
            }}
            disabled={!connected || gameState?.gameStatus !== "playing"}
            className="py-3 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
          >
            <Hand className="w-4 h-4" />
            Draw
          </button>

          <button
            onClick={() => {
              clientSyncRef.current?.sendGameAction({ type: "forfeit", timestamp: Date.now() });
            }}
            disabled={!connected || gameState?.gameStatus !== "playing"}
            className="py-3 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            <Flag className="w-4 h-4" />
            Forfeit
          </button>

          <button
            onClick={() => {
              clientSyncRef.current?.sendGameAction({ type: "reset", timestamp: Date.now() });
            }}
            disabled={!connected}
            className="py-3 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {/* Instructions */}
        <div className="p-3 rounded-lg" style={{ background: "rgba(0,0,0,0.2)" }}>
          <p className="text-xs text-white/60 text-center font-bold mb-2">
            {myRole}
          </p>
          <p className="text-xs text-white/60 text-center">
            Arrow Keys/WASD to move • Space to draw • F to forfeit
          </p>
          <p className="text-xs text-white/60 text-center mt-1">
            R to reset when game ends • Mobile: Swipe to change direction
          </p>
        </div>
      </div>
    </div>
  );
}
