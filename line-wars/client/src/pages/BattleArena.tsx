
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Swords, Users, Clock, Trophy, Loader2, ChevronRight, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { ref, set, onValue, push, remove, get, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { toast } from "sonner";
import { getEquippedAvatarUrl, getUserEquippedAvatarFromFirestore } from "@/lib/shop/avatarResolver";
import { getProfile } from "@/lib/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

type BattleMode = "iq" | "chess" | "tetris" | "tictactoe" | "connect4" | "checkers" | "debate" | "logiccardbattle" | "trapgrid" | "linewars";

interface WaitingRoomUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  equippedAvatar?: string;
  battleMode: BattleMode;
  questionCount?: number;
  joinedAt: number;
}

interface Challenge {
  challengerUid: string;
  challengerDisplayName: string;
  challengerPhotoURL?: string;
  challengerEquippedAvatar?: string;
  challengedUid: string;
  battleMode: BattleMode;
  questionCount?: number;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

// ─── Game mode config ─────────────────────────────────────────────────────────

const GAME_MODES: Array<{
  id: BattleMode;
  emoji: string;
  label: string;
  description: string;
  gradient: string;
  glow: string;
  rule: string;
}> = [
  {
    id: "iq",
    emoji: "🧠",
    label: "IQ Quiz",
    description: "Answer multiple-choice questions",
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    glow: "rgba(99,102,241,0.4)",
    rule: "Most correct answers wins",
  },
  {
    id: "chess",
    emoji: "♟️",
    label: "Chess",
    description: "Play chess directly against your opponent",
    gradient: "linear-gradient(135deg, #78716c, #44403c)",
    glow: "rgba(120,113,108,0.4)",
    rule: "Checkmate your opponent to win",
  },
  {
    id: "tetris",
    emoji: "🧱",
    label: "Tetris",
    description: "Same pieces, race to clear 10 lines first",
    gradient: "linear-gradient(135deg, #6366f1, #ec4899)",
    glow: "rgba(99,102,241,0.4)",
    rule: "First to clear 10 lines wins",
  },
  {
    id: "tictactoe",
    emoji: "✕○",
    label: "Tic-Tac-Toe",
    description: "Classic 3-in-a-row strategy",
    gradient: "linear-gradient(135deg, #0ea5e9, #6366f1)",
    glow: "rgba(14,165,233,0.4)",
    rule: "Get 3 in a row to win",
  },
  {
    id: "connect4",
    emoji: "🔴",
    label: "Connect-4",
    description: "Drop pieces to connect four",
    gradient: "linear-gradient(135deg, #ef4444, #eab308)",
    glow: "rgba(239,68,68,0.4)",
    rule: "Connect 4 pieces to win",
  },
  {
    id: "checkers",
    emoji: "⚫",
    label: "Checkers",
    description: "Capture all opponent pieces",
    gradient: "linear-gradient(135deg, #ef4444, #1f2937)",
    glow: "rgba(239,68,68,0.4)",
    rule: "Capture all pieces to win",
  },
  {
    id: "debate",
    emoji: "💬",
    label: "Debate Arena",
    description: "Intellectual battle of arguments and reasoning",
    gradient: "linear-gradient(135deg, #10b981, #6366f1)",
    glow: "rgba(16,185,129,0.4)",
    rule: "Score higher points to win debate",
  },
  {
    id: "logiccardbattle",
    emoji: "⚔️",
    label: "Logic Card Battle",
    description: "Use cards to manipulate sequences and achieve victory",
    gradient: "linear-gradient(135deg, #6366f1, #ec4899)",
    glow: "rgba(99,102,241,0.4)",
    rule: "First to achieve win condition wins",
  },
  {
    id: "trapgrid",
    emoji: "🕹️",
    label: "Trap Grid",
    description: "Tactical grid battle with traps and abilities",
    gradient: "linear-gradient(135deg, #ef4444, #8b5cf6)",
    glow: "rgba(239,68,68,0.4)",
    rule: "Reduce opponent HP to 0 or have most HP when time ends",
  },
  {
    id: "linewars",
    emoji: "⚡",
    label: "Line Wars",
    description: "Territory warfare with geometric tactics",
    gradient: "linear-gradient(135deg, #00ffff, #ff00ff)",
    glow: "rgba(0,255,255,0.4)",
    rule: "Control 60% territory or eliminate opponent",
  },
];

const IQ_COUNTS = [
  { count: 10, label: "Lightning", sub: "~2 min" },
  { count: 25, label: "Classic", sub: "~8 min" },
  { count: 50, label: "Marathon", sub: "~18 min" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "analogy","series","coding","odd_one_out","pattern","figure_completion",
  "embedded_figure","mirror_image","cube_dice","word_relationship",
  "direction_sense","logical_statement","situational_judgment","psychometric",
  "abstract_reasoning","numerical_reasoning","verbal_comprehension",
  "spatial_reasoning","mechanical_reasoning","data_interpretation",
  "critical_thinking","problem_solving","pattern_recognition","memory",
  "attention_detail","mathematics","science","history","geography","logic",
];

function createBattleData(
  battleId: string,
  battleMode: BattleMode,
  challenge: Challenge,
  accepterUid: string,
  accepterDisplayName: string,
  accepterPhotoURL: string | undefined,
  accepterEquippedAvatar: string | undefined,
  extraData: Record<string, unknown> = {},
) {
  return {
    battleId,
    battleType: battleMode,
    player1: {
      uid: challenge.challengerUid,
      displayName: challenge.challengerDisplayName,
      photoURL: challenge.challengerPhotoURL || null,
      equippedAvatar: challenge.challengerEquippedAvatar || null,
    },
    player2: {
      uid: accepterUid,
      displayName: accepterDisplayName,
      photoURL: accepterPhotoURL || null,
      equippedAvatar: accepterEquippedAvatar || null,
    },
    createdAt: Date.now(),
    status: "active",
    player1Progress: 0,
    player2Progress: 0,
    ...extraData,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BattleArena() {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const { user } = useFirebaseAuth();

  const [selectedMode, setSelectedMode] = useState<BattleMode>("iq");
  const [selectedCount, setSelectedCount] = useState(10);
  const [phase, setPhase] = useState<"select" | "waiting" | "found">("select");
  const [waitingUsers, setWaitingUsers] = useState<WaitingRoomUser[]>([]);
  const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);
  const [challengerProfile, setChallengerProfile] = useState<{
    displayName: string;
    photoURL: string | null;
    equippedAvatar: string | null;
    avatarUrl: string;
  } | null>(null);
  const [myWaitingRoomId, setMyWaitingRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [foundBattle, setFoundBattle] = useState<{ battleId: string; battleType: string } | null>(null);

  const myWaitingRoomIdRef = useRef<string | null>(null);
  myWaitingRoomIdRef.current = myWaitingRoomId;

  // Clean up stale/abandoned battles for this user on mount
  useEffect(() => {
    if (!user) return;
    const cleanUp = async () => {
      try {
        const snap = await get(ref(rtdb, "battles"));
        if (!snap.exists()) return;
        const data = snap.val() as Record<string, any>;
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        Object.entries(data).forEach(([key, b]) => {
          const isOld = b.createdAt < tenMinAgo;
          const isCompleted = b.status === "completed" || b.status === "abandoned";
          if (isOld || isCompleted) {
            remove(ref(rtdb, `battles/${key}`)).catch(() => {});
          }
        });
      } catch { /* non-critical */ }
    };
    cleanUp();
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (myWaitingRoomIdRef.current) {
        remove(ref(rtdb, `waitingRoom/${myWaitingRoomIdRef.current}`)).catch(() => {});
      }
    };
  }, []);

  // Listen to waiting room
  useEffect(() => {
    if (phase !== "waiting") return;
    const waitingRef = ref(rtdb, "waitingRoom");
    const unsub = onValue(waitingRef, (snap) => {
      if (!snap.exists()) { setWaitingUsers([]); return; }
      const data = snap.val() as Record<string, WaitingRoomUser>;
      const users = Object.values(data).filter(u => u.battleMode === selectedMode);
      setWaitingUsers(users);
    });
    return () => unsub();
  }, [phase, selectedMode]);

  // Listen for incoming challenges
  useEffect(() => {
    if (!user || phase !== "waiting") return;
    const challengesRef = ref(rtdb, "challenges");
    const unsub = onValue(challengesRef, async (snap) => {
      if (!snap.exists()) { setIncomingChallenge(null); setChallengerProfile(null); return; }
      const data = snap.val() as Record<string, Challenge>;
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;

      const mine = Object.values(data).find(
        c => c.challengedUid === user.uid &&
             c.status === "pending" &&
             c.battleMode === selectedMode &&
             c.createdAt > fiveMinAgo,
      );

      if (mine) {
        // Safety check: challengerUid should NOT be the same as current user's uid
        if (mine.challengerUid === user.uid) {
          console.error("[BattleArena] ERROR: challengerUid is the same as current user! Skipping challenge.");
          setIncomingChallenge(null);
          setChallengerProfile(null);
          return;
        }

        setIncomingChallenge(mine);
        // Fetch fresh challenger profile from Firestore to get correct avatar
        const freshProfile = await getUserEquippedAvatarFromFirestore(mine.challengerUid);
        if (freshProfile.displayName) {
          const avatarUrl = getEquippedAvatarUrl(
            freshProfile.equippedAvatar || undefined,
            freshProfile.photoURL || undefined
          );
          setChallengerProfile({
            displayName: freshProfile.displayName,
            photoURL: freshProfile.photoURL,
            equippedAvatar: freshProfile.equippedAvatar,
            avatarUrl,
          });
        } else {
          // Fallback to challenge data if Firestore fetch fails
          const avatarUrl = getEquippedAvatarUrl(
            mine.challengerEquippedAvatar,
            mine.challengerPhotoURL
          );
          setChallengerProfile({
            displayName: mine.challengerDisplayName,
            photoURL: mine.challengerPhotoURL || null,
            equippedAvatar: mine.challengerEquippedAvatar || null,
            avatarUrl,
          });
        }
      } else {
        setIncomingChallenge(null);
        setChallengerProfile(null);
      }
    });
    return () => unsub();
  }, [user, phase, selectedMode]);

  // Listen for battle room creation (challenger side)
  useEffect(() => {
    if (!user || phase !== "waiting") return;
    const joinedAt = Date.now();
    const battlesRef = ref(rtdb, "battles");
    const unsub = onValue(battlesRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as Record<string, any>;
      
      // Look for battles involving this user
      const myBattle = Object.values(data).find(
        b => (b.player1?.uid === user.uid || b.player2?.uid === user.uid)
          && b.status === "active"
          && b.createdAt >= joinedAt - 10000, // Increased buffer to 10 seconds for better reliability
      );
      
      if (myBattle) {
        console.log("[BattleArena] Found battle for challenger:", myBattle.battleId, "type:", myBattle.battleType);
        
        // Additional validation to ensure battle is properly initialized
        let isReady = false;
        if (myBattle.battleType === "iq") {
          isReady = myBattle.questions && Array.isArray(myBattle.questions) && myBattle.questions.length > 0;
        } else if (myBattle.battleType === "chess") {
          isReady = myBattle.board && Array.isArray(myBattle.board) && myBattle.currentTurn;
        } else if (myBattle.battleType === "tetris") {
          isReady = myBattle.seed && typeof myBattle.seed === "number";
        } else if (myBattle.battleType === "debate") {
          isReady = myBattle.topic && myBattle.debateHistory;
        } else {
          isReady = myBattle.player1 && myBattle.player2 && myBattle.status === "active";
        }
        
        if (isReady) {
          setFoundBattle({ battleId: myBattle.battleId, battleType: myBattle.battleType });
          setPhase("found");
        } else {
          console.log("[BattleArena] Battle found but not ready, waiting for initialization...");
        }
      }
    });
    return () => unsub();
  }, [user, phase]);

  // Navigate when battle found - ensure battle room is fully created
  useEffect(() => {
    if (phase !== "found" || !foundBattle || !user) return;
    
    const retryCountRef = { current: 0 };
    const maxRetries = 10; // Maximum 10 retries (20 seconds total)
    
    // Verify battle room exists and is properly initialized before navigation
    const verifyAndNavigate = async () => {
      try {
        const battleRef = ref(rtdb, `battles/${foundBattle.battleId}`);
        const snapshot = await get(battleRef);
        
        if (!snapshot.exists()) {
          console.log(`[BattleArena] Battle room not yet created, retry ${retryCountRef.current + 1}/${maxRetries}`);
          retryCountRef.current++;
          if (retryCountRef.current >= maxRetries) {
            console.error("[BattleArena] Max retries reached, battle room not found");
            toast.error("Failed to join battle - room not found");
            setPhase("select"); // Reset to selection screen
          }
          return;
        }
        
        const battleData = snapshot.val();
        
        // Validate battle room structure based on battle type
        let isReady = false;
        if (foundBattle.battleType === "iq") {
          isReady = battleData.questions && Array.isArray(battleData.questions) && battleData.questions.length > 0;
        } else if (foundBattle.battleType === "chess") {
          isReady = battleData.board && Array.isArray(battleData.board) && battleData.currentTurn;
        } else if (foundBattle.battleType === "tetris") {
          isReady = battleData.seed && typeof battleData.seed === "number";
        } else if (foundBattle.battleType === "debate") {
          isReady = battleData.topic && battleData.debateHistory;
        } else {
          // For other game types, check basic structure
          isReady = battleData.player1 && battleData.player2 && battleData.status === "active";
        }
        
        if (!isReady) {
          console.log(`[BattleArena] Battle room not fully initialized, retry ${retryCountRef.current + 1}/${maxRetries}`);
          retryCountRef.current++;
          if (retryCountRef.current >= maxRetries) {
            console.error("[BattleArena] Max retries reached, battle room not ready");
            toast.error("Failed to join battle - room not ready");
            setPhase("select"); // Reset to selection screen
          }
          return;
        }
        
        // Battle room is ready, navigate to game
        const routes: Record<string, string> = {
          chess: "/chess-battle",
          tetris: "/tetris-battle",
          tictactoe: "/tictactoe-battle",
          connect4: "/connect4-battle",
          checkers: "/checkers-battle",
          debate: "/debate-battle",
          logiccardbattle: "/logiccardbattle-battle",
          trapgrid: "/trapgrid-battle",
          linewars: "/linewars-battle-server",
          iq: "/battle-test",
        };
        const route = routes[foundBattle.battleType] ?? "/battle-test";
        console.log(`[BattleArena] Navigating to ${route} with battleId: ${foundBattle.battleId}`);
        setLocation(`${route}?battleId=${foundBattle.battleId}`);
        
      } catch (error) {
        console.error("[BattleArena] Error verifying battle room:", error);
        toast.error("Failed to join battle room");
        setPhase("select"); // Reset to selection screen on error
      }
    };
    
    // Initial delay to allow battle room creation, then verify
    const timer = setTimeout(() => {
      verifyAndNavigate();
    }, 800);
    
    // Retry verification if initial attempt fails
    const retryTimer = setInterval(() => {
      if (retryCountRef.current < maxRetries) {
        verifyAndNavigate();
      }
    }, 2000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(retryTimer);
    };
  }, [phase, foundBattle, user, setLocation]);

  const joinWaitingRoom = async () => {
    if (!user) { toast.error("Please sign in to battle"); return; }
    setLoading(true);
    try {
      // Clean up stale challenges for this user
      try {
        const challengesSnap = await get(ref(rtdb, "challenges"));
        if (challengesSnap.exists()) {
          const data = challengesSnap.val() as Record<string, Challenge>;
          const fiveMinAgo = Date.now() - 5 * 60 * 1000;
          Object.entries(data).forEach(([key, c]) => {
            if (c.createdAt < fiveMinAgo || c.challengerUid === user.uid || c.challengedUid === user.uid) {
              remove(ref(rtdb, `challenges/${key}`)).catch(() => {});
            }
          });
        }
      } catch { /* non-critical */ }

      // Remove any existing waiting room entry for this user
      try {
        const wrSnap = await get(ref(rtdb, "waitingRoom"));
        if (wrSnap.exists()) {
          const wr = wrSnap.val() as Record<string, WaitingRoomUser>;
          Object.entries(wr).forEach(([key, u]) => {
            if (u.uid === user.uid) {
              remove(ref(rtdb, `waitingRoom/${key}`)).catch(() => {});
            }
          });
        }
      } catch { /* non-critical */ }

      const roomId = push(ref(rtdb, "waitingRoom")).key!;

      // Get user's equipped avatar from Firestore (fresh data)
      const freshProfile = await getUserEquippedAvatarFromFirestore(user.uid);
      const equippedAvatar = freshProfile.equippedAvatar || '';
      const photoURL = freshProfile.photoURL || user.photoURL || '';
      const displayName = freshProfile.displayName || user.displayName || "Anonymous";

      // Build payload — RTDB rejects undefined values, use null instead
      const payload: Record<string, unknown> = {
        uid: user.uid,
        displayName: displayName,
        photoURL: photoURL ?? null,
        equippedAvatar: equippedAvatar,
        battleMode: selectedMode,
        joinedAt: Date.now(),
      };
      // Only include questionCount for IQ mode
      if (selectedMode === "iq") {
        payload.questionCount = selectedCount;
      }

      await set(ref(rtdb, `waitingRoom/${roomId}`), payload);
      setMyWaitingRoomId(roomId);
      setPhase("waiting");
    } catch (e: any) {
      console.error("[BattleArena] Failed to join waiting room:", e?.message ?? e);
      toast.error(`Failed to join waiting room: ${e?.message ?? "Permission denied"}`);
    } finally {
      setLoading(false);
    }
  };

  const leaveWaitingRoom = async () => {
    if (myWaitingRoomId) {
      await remove(ref(rtdb, `waitingRoom/${myWaitingRoomId}`)).catch(() => {});
      setMyWaitingRoomId(null);
    }
    setPhase("select");
    setIncomingChallenge(null);
  };

  const challengeUser = async (target: WaitingRoomUser) => {
    if (!user) return;
    try {
      // Get user's equipped avatar from Firestore (fresh data)
      const freshProfile = await getUserEquippedAvatarFromFirestore(user.uid);
      const equippedAvatar = freshProfile.equippedAvatar || '';
      const photoURL = freshProfile.photoURL || user.photoURL || '';
      const displayName = freshProfile.displayName || user.displayName || "Anonymous";

      // Remove challenger from waiting room when sending challenge
      if (myWaitingRoomId) {
        await remove(ref(rtdb, `waitingRoom/${myWaitingRoomId}`)).catch(() => {});
        setMyWaitingRoomId(null);
      }

      // Use consistent challenge key format
      const challengeId = `${user.uid}_${target.uid}`;
      const payload: Record<string, unknown> = {
        challengerUid: user.uid,
        challengerDisplayName: displayName,
        challengerPhotoURL: photoURL ?? null,
        challengerEquippedAvatar: equippedAvatar,
        challengedUid: target.uid,
        battleMode: selectedMode,
        status: "pending",
        createdAt: Date.now(),
      };
      if (selectedMode === "iq") {
        payload.questionCount = selectedCount;
      }
      await set(ref(rtdb, `challenges/${challengeId}`), payload);
      toast.success(`Challenge sent to ${target.displayName}!`);
    } catch (e: any) {
      console.error("[BattleArena] Failed to send challenge:", e?.message ?? e);
      toast.error("Failed to send challenge");
    }
  };

  const acceptChallenge = async (challenge: Challenge) => {
    if (!user) return;
    try {
      // Fetch fresh equipped avatars from Firestore for both players
      const [challengerProfile, accepterProfile] = await Promise.all([
        getUserEquippedAvatarFromFirestore(challenge.challengerUid),
        getUserEquippedAvatarFromFirestore(user.uid),
      ]);

      const battleId = push(ref(rtdb, "battles")).key!;
      const battleRef = ref(rtdb, `battles/${battleId}`);

      // Use fresh data from Firestore if available, fallback to challenge data
      const accepterDisplayName = accepterProfile.displayName || user.displayName || "Anonymous";
      const accepterPhotoURL = accepterProfile.photoURL || user.photoURL || undefined;
      const accepterEquippedAvatar = accepterProfile.equippedAvatar || undefined;

      // Update challenge with fresh challenger equipped avatar if available
      if (challengerProfile.equippedAvatar) {
        challenge.challengerEquippedAvatar = challengerProfile.equippedAvatar;
      }
      if (challengerProfile.photoURL) {
        challenge.challengerPhotoURL = challengerProfile.photoURL;
      }
      if (challengerProfile.displayName) {
        challenge.challengerDisplayName = challengerProfile.displayName;
      }

      const base = createBattleData(
        battleId, challenge.battleMode, challenge,
        user.uid, accepterDisplayName, accepterPhotoURL, accepterEquippedAvatar,
      );

      let extra: Record<string, unknown> = {};
      if (challenge.battleMode === "iq") {
        const { getRandomEnhancedTest } = await import("@/lib/enhancedQuestionBank");
        const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        const qs = getRandomEnhancedTest(challenge.questionCount ?? 10, cat);
        extra = {
          questionCount: challenge.questionCount ?? 10,
          questions: qs.map((q: any) => { const { correctAnswer: _ca, explanation: _ex, ...safe } = q; return safe; }),
          answers: qs.map((q: any) => q.correctAnswer),
        };
      } else if (challenge.battleMode === "chess") {
        const { parseFen, STARTING_FEN } = await import("@/lib/games/chessAI");
        const { board } = parseFen(STARTING_FEN);
        // Ensure board is a proper 2D array structure for Firebase RTDB
        // Convert to plain array structure (no nested objects)
        const boardArray = board.map(row => row.map(cell => cell));
        console.log("[BattleArena] Creating chess battle with board:", boardArray);
        console.log("[BattleArena] Board dimensions:", boardArray.length, "x", boardArray[0]?.length);
        extra = {
          board: boardArray,
          currentTurn: challenge.challengerUid, // Player 1 (White) goes first
          moveCount: 0,
        };
      } else if (challenge.battleMode === "tetris") {
        extra = { seed: Date.now(), targetScore: 1000 };
      } else if (challenge.battleMode === "tictactoe") {
        console.log("[BattleArena] Creating TicTacToe battle");
        // Firebase RTDB strips arrays of all nulls, so we use empty strings instead
        extra = {
          board: Array(9).fill(""),
          currentTurn: challenge.challengerUid,
        };
        console.log("[BattleArena] TicTacToe extra data:", extra);
      } else if (challenge.battleMode === "connect4") {
        const { createC4Board } = await import("@/lib/games/connect4");
        extra = {
          board: createC4Board(),
          currentTurn: challenge.challengerUid,
        };
      } else if (challenge.battleMode === "checkers") {
        const { createCheckersBoard } = await import("@/lib/games/checkers");
        extra = {
          board: createCheckersBoard(),
          currentTurn: challenge.challengerUid,
        };
      } else if (challenge.battleMode === "debate") {
        console.log("[BattleArena] Creating Debate battle");
        // Get a random topic for the debate
        const topics = [
          "AI should have rights similar to humans",
          "Social media improves intelligence", 
          "Free will is an illusion",
          "Space exploration is worth the cost",
          "Universal basic income should be implemented",
          "Nuclear energy is the solution to climate change"
        ];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        
        extra = {
          topic: randomTopic,
          debateHistory: [],
          currentTurn: challenge.challengerUid,
          round: 1,
          maxRounds: 6,
          player1Score: 0,
          player2Score: 0,
          aiPersonality: "academic", // Default for multiplayer
        };
        console.log("[BattleArena] Debate extra data:", extra);
      } else if (challenge.battleMode === "linewars") {
        console.log("[BattleArena] Creating Line Wars battle");
        extra = {
          // Line Wars specific initialization data
          gridSize: 50,
          cellSize: 12,
          playerSpeed: 2,
          currentTurn: challenge.challengerUid,
        };
        console.log("[BattleArena] Line Wars extra data:", extra);
      }

      // Create battle room with all required data atomically
      const battleData = { ...base, ...extra };
      
      // CRITICAL: Validate battle data before writing to ensure synchronization
      let isValid = true;
      if (challenge.battleMode === "iq") {
        isValid = !!(extra.questions && Array.isArray(extra.questions) && extra.questions.length > 0);
      } else if (challenge.battleMode === "chess") {
        isValid = !!(extra.board && Array.isArray(extra.board) && extra.currentTurn);
      } else if (challenge.battleMode === "tetris") {
        isValid = !!(extra.seed && typeof extra.seed === "number");
      } else if (challenge.battleMode === "debate") {
        isValid = !!(extra.topic && extra.debateHistory);
      } else {
        isValid = !!(base.player1 && base.player2);
      }
      
      if (!isValid) {
        console.error("[BattleArena] Invalid battle data, cannot create battle room");
        toast.error("Failed to create battle - invalid data");
        return;
      }
      
      await set(battleRef, battleData);
      console.log("[BattleArena] Battle created with validated data:", battleData);
      console.log("[BattleArena] Battle ready for both players with identical state");
      
      // Update challenge status to accepted (critical for synchronization)
      const challengesSnap = await get(ref(rtdb, "challenges"));
      if (challengesSnap.exists()) {
        const challenges = challengesSnap.val() as Record<string, Challenge>;
        const challengeKey = Object.keys(challenges).find(key => 
          challenges[key].challengerUid === challenge.challengerUid && 
          challenges[key].challengedUid === user.uid &&
          challenges[key].status === "pending"
        );
        if (challengeKey) {
          await update(ref(rtdb, `challenges/${challengeKey}`), { 
            status: "accepted",
            battleId: battleId // Include battleId for reference
          }).catch(() => {});
        }
      }

      // Remove both players from waiting room to prevent re-matching
      const wrSnap = await get(ref(rtdb, "waitingRoom"));
      if (wrSnap.exists()) {
        const wr = wrSnap.val() as Record<string, WaitingRoomUser>;
        Object.entries(wr).forEach(([key, u]) => {
          if (u.uid === user.uid || u.uid === challenge.challengerUid) {
            remove(ref(rtdb, `waitingRoom/${key}`)).catch(() => {});
          }
        });
      }

      // Update local state - this will trigger navigation for the accepting player
      setMyWaitingRoomId(null);
      setFoundBattle({ battleId, battleType: challenge.battleMode });
      setPhase("found");
      
      // Give the challenging player time to detect the battle room
      setTimeout(() => {
        console.log("[BattleArena] Battle room should now be visible to challenger");
      }, 500);
    } catch (e) {
      console.error(e);
      toast.error("Failed to accept challenge");
    }
  };

  const declineChallenge = async (challenge: Challenge) => {
    if (!user) return;
    // Find and update the challenge by searching for it
    const challengesSnap = await get(ref(rtdb, "challenges"));
    if (challengesSnap.exists()) {
      const challenges = challengesSnap.val() as Record<string, Challenge>;
      const challengeKey = Object.keys(challenges).find(key => 
        challenges[key].challengerUid === challenge.challengerUid && 
        challenges[key].challengedUid === user.uid &&
        challenges[key].status === "pending"
      );
      if (challengeKey) {
        await update(ref(rtdb, `challenges/${challengeKey}`), { status: "declined" }).catch(() => {});
      }
    }
    setIncomingChallenge(null);
  };

  const modeConfig = GAME_MODES.find(m => m.id === selectedMode)!;

  // ── Found battle screen ────────────────────────────────────────────────────

  if (phase === "found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: theme.gradient }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="text-6xl mb-4">⚔️</div>
          <p className="text-xl font-bold text-white mb-2">Battle found!</p>
          <p className="text-white/60 text-sm mb-4">Loading {modeConfig.label}...</p>
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />
        </motion.div>
      </div>
    );
  }

  // ── Waiting room ───────────────────────────────────────────────────────────

  if (phase === "waiting") {
    const others = waitingUsers.filter(u => u.uid !== user?.uid);

    return (
      <div className="min-h-screen flex flex-col" style={{ background: theme.gradient }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
          <button onClick={leaveWaitingRoom} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Leave</span>
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-white">{modeConfig.emoji} {modeConfig.label}</p>
            <p className="text-xs text-white/50">Waiting Room</p>
          </div>
          <div className="w-16" />
        </div>

        {/* Incoming challenge banner */}
        <AnimatePresence>
          {incomingChallenge && challengerProfile && (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className="mx-4 mt-4 rounded-2xl p-4"
              style={{ background: "rgba(99,102,241,0.2)", border: "2px solid #6366f1" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-400 flex-shrink-0 relative">
                  <img
                    src={challengerProfile.avatarUrl}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                  {/* Add challenger indicator */}
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-xs text-white font-bold">C</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{challengerProfile.displayName} challenged you!</p>
                  <p className="text-xs text-white/60">{modeConfig.label} battle</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => acceptChallenge(incomingChallenge)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                    style={{ background: "#6366f1" }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineChallenge(incomingChallenge)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/60"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waiting indicator */}
        <div className="flex flex-col items-center py-8 px-4">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: modeConfig.gradient }}>
              {modeConfig.emoji}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>
          <p className="text-white font-bold mb-1">Looking for opponents...</p>
          <p className="text-white/50 text-xs">{modeConfig.rule}</p>
        </div>

        {/* Players in room */}
        <div className="flex-1 px-4 overflow-y-auto">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-semibold">
            Players waiting ({others.length})
          </p>

          {others.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No one else here yet.</p>
              <p className="text-white/30 text-xs mt-1">Share the app to find opponents!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {others.map(u => (
                <motion.div
                  key={u.uid}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                    <img src={getEquippedAvatarUrl(u.equippedAvatar, u.photoURL)} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{u.displayName}</p>
                    <p className="text-xs text-white/40">
                      {modeConfig.label}
                      {u.questionCount ? ` · ${u.questionCount} questions` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => challengeUser(u)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0"
                    style={{ background: modeConfig.gradient }}
                  >
                    <Swords className="w-3 h-3" />
                    Challenge
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-6 pt-4">
          <button
            onClick={leaveWaitingRoom}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white/60"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            Leave Waiting Room
          </button>
        </div>
      </div>
    );
  }

  // ── Mode selection screen ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.gradient }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
        <button onClick={() => setLocation("/")} className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">Battle Arena ⚔️</h1>
          <p className="text-xs text-white/50">Challenge players worldwide</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {/* Game mode grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-white/80 uppercase tracking-wider font-bold">Choose Your Battle</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <p className="text-xs text-white/60">Live matchmaking</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GAME_MODES.map(mode => (
              <motion.button
                key={mode.id}
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => setSelectedMode(mode.id)}
                className="relative p-6 rounded-3xl text-left overflow-hidden group"
                style={{
                  background: selectedMode === mode.id 
                    ? mode.gradient 
                    : "rgba(255,255,255,0.08)",
                  border: `2px solid ${selectedMode === mode.id ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.12)"}`,
                  boxShadow: selectedMode === mode.id 
                    ? `0 8px 32px ${mode.glow}` 
                    : "0 4px 16px rgba(0,0,0,0.2)",
                }}
              >
                {/* Selected indicator */}
                {selectedMode === mode.id && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/30 flex items-center justify-center"
                  >
                    <div className="w-3 h-3 rounded-full bg-white" />
                  </motion.div>
                )}
                
                {/* Game emoji with enhanced styling */}
                <div className="flex items-center justify-center mb-4">
                  <div 
                    className="text-6xl filter drop-shadow-lg transition-transform group-hover:scale-110"
                    style={{
                      filter: `drop-shadow(0 4px 8px ${selectedMode === mode.id ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)'})`
                    }}
                  >
                    {mode.emoji}
                  </div>
                </div>
                
                {/* Game title and description */}
                <div className="space-y-2">
                  <p className="text-lg font-black text-white leading-tight">{mode.label}</p>
                  <p className="text-sm text-white/70 leading-relaxed">{mode.description}</p>
                  
                  {/* Rule hint */}
                  <div className="flex items-center gap-2 mt-3">
                    <Trophy className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <p className="text-xs text-white/50">{mode.rule}</p>
                  </div>
                </div>
                
                {/* Hover effect overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-3xl" />
              </motion.button>
            ))}
          </div>
        </div>

        {/* IQ question count */}
        {selectedMode === "iq" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
              <p className="text-sm text-white/80 uppercase tracking-wider font-bold">Select Duration</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {IQ_COUNTS.map(({ count, label, sub }) => (
                <motion.button
                  key={count}
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedCount(count)}
                  className="relative p-4 rounded-2xl text-center transition-all group"
                  style={{
                    background: selectedCount === count 
                      ? modeConfig.gradient 
                      : "rgba(255,255,255,0.08)",
                    border: `2px solid ${selectedCount === count ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.12)"}`,
                    boxShadow: selectedCount === count 
                      ? `0 4px 20px ${modeConfig.glow}` 
                      : "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                >
                  {selectedCount === count && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center"
                    >
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </motion.div>
                  )}
                  <p className="text-base font-bold text-white mb-1">{label}</p>
                  <p className="text-sm text-white/70">{count} Questions</p>
                  <p className="text-xs text-white/50">{sub}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Selected mode info card */}
        <motion.div
          key={selectedMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg" style={{ background: modeConfig.gradient }}>
              {modeConfig.emoji}
            </div>
            <div className="flex-1">
              <p className="text-lg font-black text-white mb-1">{modeConfig.label}</p>
              <p className="text-sm text-white/60">{modeConfig.rule}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Users, text: "Real-time matchmaking", subtext: "Battle worldwide" },
              { icon: Clock, text: "Instant challenges", subtext: "No waiting required" },
              { icon: Trophy, text: "Leaderboard ranking", subtext: "Climb to the top" },
            ].map(({ icon: Icon, text, subtext }) => (
              <div key={text} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <Icon className="w-5 h-5 text-white/60 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">{text}</p>
                  <p className="text-xs text-white/40">{subtext}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Find opponent button */}
      <div className="px-4 pb-8 pt-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02, y: -2 }}
          onClick={joinWaitingRoom}
          disabled={loading}
          className="relative w-full py-5 rounded-3xl font-black text-white flex items-center justify-center gap-3 text-lg disabled:opacity-60 overflow-hidden group"
          style={{
            background: modeConfig.gradient,
            boxShadow: `0 8px 32px ${modeConfig.glow}`,
          }}
        >
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Finding Battle...</span>
            </>
          ) : (
            <>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Swords className="w-6 h-6" />
              </motion.div>
              <span>Find Opponent</span>
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </motion.button>
        
        {/* Subtle hint text */}
        <p className="text-center text-xs text-white/40 mt-3">
          Ready to test your skills? The arena awaits!
        </p>
      </div>
    </div>
  );
}
