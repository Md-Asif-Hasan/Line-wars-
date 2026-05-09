import { Suspense, lazy, useEffect } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { FirebaseAuthProvider } from "./contexts/FirebaseAuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AudioProvider } from "./contexts/AudioContext";
import { useBackButton } from "./hooks/useBackButton";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { AdMob } from "@capacitor-community/admob";
import { showAppOpenAd } from "./services/appOpenAd";

const Home = lazy(() => import("./pages/HomeRedesigned"));
const TestInterface = lazy(() => import("./pages/TestInterface"));
const Results = lazy(() => import("./pages/Results"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const FirebaseAuth = lazy(() => import("./pages/FirebaseAuth"));
const Profile = lazy(() => import("./pages/Profile"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Tutorial = lazy(() => import("./pages/Tutorial"));
const BattleArena = lazy(() => import("./pages/BattleArena"));
const BattleTest = lazy(() => import("./pages/BattleTest"));
const PracticeSection = lazy(() => import("./components/PracticeSection"));
const PracticeVerbalAnalogies = lazy(() => import("./pages/PracticeVerbalAnalogies"));
const PracticeNumberSeries = lazy(() => import("./pages/PracticeNumberSeries"));
const PracticeMathProblems = lazy(() => import("./pages/PracticeMathProblems"));
const PracticePsychometric = lazy(() => import("./pages/PracticePsychometric"));
const PracticeLogicalDeduction = lazy(() => import("./pages/PracticeLogicalDeduction"));
const PracticeSituationalJudgment = lazy(() => import("./pages/PracticeSituationalJudgment"));
const PracticePatternRecognition = lazy(() => import("./pages/PracticePatternRecognition"));
const PracticeSpatialReasoning = lazy(() => import("./pages/PracticeSpatialReasoning"));
const PracticeMemory = lazy(() => import("./pages/PracticeMemory"));
const PracticeCodingDecoding = lazy(() => import("./pages/PracticeCodingDecoding"));
const PracticeAbstractReasoning = lazy(() => import("./pages/PracticeAbstractReasoning"));
const Quests = lazy(() => import("./pages/Quests"));
const DynamicQuest = lazy(() => import("./pages/DynamicQuest"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CustomTest = lazy(() => import("./pages/CustomTest"));
const Settings = lazy(() => import("./pages/Settings"));
const BrainGames = lazy(() => import("./pages/BrainGames"));
const VisualGameSession = lazy(() => import("./pages/VisualGameSession"));
const InteractiveGameSession = lazy(() => import("./pages/InteractiveGameSession"));
const ChessGame = lazy(() => import("./pages/ChessGame"));
const TetrisSolo = lazy(() => import("./pages/TetrisSolo"));
const TicTacToeGame = lazy(() => import("./pages/TicTacToeGame"));
const Connect4Game = lazy(() => import("./pages/Connect4Game"));
const CheckersGame = lazy(() => import("./pages/CheckersGame"));
const ChessBattle = lazy(() => import("./pages/ChessBattle"));
const TetrisBattle = lazy(() => import("./pages/TetrisBattle"));
const TicTacToeBattle = lazy(() => import("./pages/TicTacToeBattle"));
const Connect4Battle = lazy(() => import("./pages/Connect4Battle"));
const CheckersBattle = lazy(() => import("./pages/CheckersBattle"));
const Shop = lazy(() => import("./pages/Shop"));
const ProfileCustomization = lazy(() => import("./pages/ProfileCustomization"));
const Referral = lazy(() => import("./pages/Referral"));
const LogicCardBattle = lazy(() => import("./pages/LogicCardBattle"));
const TrapGrid = lazy(() => import("./pages/TrapGrid"));
const DebateArena = lazy(() => import("./pages/DebateArena"));
const DebateBattle = lazy(() => import("./pages/DebateBattle"));
const BattleDebate = lazy(() => import("./pages/BattleDebate"));
const LogicCardBattle1v1 = lazy(() => import("./pages/LogicCardBattle1v1"));
const TrapGrid1v1 = lazy(() => import("./pages/TrapGrid1v1"));
const LineWarsBattle = lazy(() => import("./pages/LineWarsBattle"));
const LineWarsBattleServer = lazy(() => import("./pages/LineWarsBattleServer"));

function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 70%, #0f3460 100%)" }}
    >
      <div
        className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-blue-200 backdrop-blur-sm"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        Loading...
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/privacy-policy">{() => <PrivacyPolicy />}</Route>
        <Route path="/auth">{() => <FirebaseAuth />}</Route>
        <Route path="/profile">{() => <Profile />}</Route>
        <Route path="/leaderboard">{() => <Leaderboard />}</Route>
        <Route path="/user/:uid">{() => <PublicProfile />}</Route>
        <Route path="/test">{() => <TestInterface />}</Route>
        <Route path="/custom-test">{() => <CustomTest />}</Route>
        <Route path="/results/:sessionId">{() => <Results />}</Route>
        <Route path="/tutorial">{() => <Tutorial />}</Route>
        <Route path="/battle-arena">{() => <BattleArena />}</Route>
        <Route path="/battle-debate">{() => <BattleDebate />}</Route>
        <Route path="/battle-test">{() => <BattleTest />}</Route>
        <Route path="/practice">{() => <PracticeSection />}</Route>
        <Route path="/practice/analogy">{() => <PracticeVerbalAnalogies />}</Route>
        <Route path="/practice/series">{() => <PracticeNumberSeries />}</Route>
        <Route path="/practice/math">{() => <PracticeMathProblems />}</Route>
        <Route path="/practice/psychometric">{() => <PracticePsychometric />}</Route>
        <Route path="/practice/logical_deduction">{() => <PracticeLogicalDeduction />}</Route>
        <Route path="/practice/situational_judgment">{() => <PracticeSituationalJudgment />}</Route>
        <Route path="/practice/pattern_recognition">{() => <PracticePatternRecognition />}</Route>
        <Route path="/practice/spatial_reasoning">{() => <PracticeSpatialReasoning />}</Route>
        <Route path="/practice/memory">{() => <PracticeMemory />}</Route>
        <Route path="/practice/coding_decoding">{() => <PracticeCodingDecoding />}</Route>
        <Route path="/practice/abstract_reasoning">{() => <PracticeAbstractReasoning />}</Route>
        <Route path="/quests">{() => <Quests />}</Route>
        <Route path="/quest/:questId">{() => <DynamicQuest />}</Route>
        <Route path="/settings">{() => <Settings />}</Route>
        <Route path="/brain-games/:gameType">{() => <VisualGameSession />}</Route>
        <Route path="/brain-games">{() => <BrainGames />}</Route>
        <Route path="/interactive/:gameType">{() => <InteractiveGameSession />}</Route>
        <Route path="/chess">{() => <ChessGame />}</Route>
        <Route path="/tetris">{() => <TetrisSolo />}</Route>
        <Route path="/tictactoe">{() => <TicTacToeGame />}</Route>
        <Route path="/connect4">{() => <Connect4Game />}</Route>
        <Route path="/checkers">{() => <CheckersGame />}</Route>
        <Route path="/chess-battle">{() => <ChessBattle />}</Route>
        <Route path="/tetris-battle">{() => <TetrisBattle />}</Route>
        <Route path="/tictactoe-battle">{() => <TicTacToeBattle />}</Route>
        <Route path="/connect4-battle">{() => <Connect4Battle />}</Route>
        <Route path="/checkers-battle">{() => <CheckersBattle />}</Route>
        <Route path="/shop">{() => <Shop />}</Route>
        <Route path="/referral">{() => <Referral />}</Route>
        <Route path="/profile/customize">{() => <ProfileCustomization />}</Route>
        <Route path="/logic-card-battle">{() => <LogicCardBattle />}</Route>
        <Route path="/trap-grid">{() => <TrapGrid />}</Route>
        <Route path="/debate-arena">{() => <DebateArena />}</Route>
        <Route path="/debate-battle">{() => <DebateBattle />}</Route>
        <Route path="/logiccardbattle-battle">{() => <LogicCardBattle1v1 />}</Route>
        <Route path="/trapgrid-battle">{() => <TrapGrid1v1 />}</Route>
        <Route path="/linewars-battle">{() => <LineWarsBattle />}</Route>
        <Route path="/linewars-battle-server">{() => <LineWarsBattleServer />}</Route>
        <Route path="/404">{() => <NotFound />}</Route>
        <Route path="/">{() => <Home />}</Route>
        <Route>{() => <NotFound />}</Route>
      </Switch>
    </Suspense>
  );
}

function AppInner() {
  useBackButton();

  useEffect(() => {
    // Only run on native Android platform
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Initialize AdMob
    const initAdMob = async () => {
      try {
        console.log('[AdMob] Initializing AdMob...');
        await AdMob.initialize({
          testingDevices: [],
          initializeForTesting: false,
        });
        console.log('[AdMob] AdMob initialized successfully');

        // Show app open ad on launch
        await showAppOpenAd();
      } catch (e) {
        console.error('[AdMob] Failed to initialize:', e);
      }
    };

    initAdMob();

    // Listen for app state changes (resume from background)
    const appStateListenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[AdMob] App resumed, attempting to show ad');
        showAppOpenAd();
      }
    });

    // Cleanup listener on unmount
    return () => {
      appStateListenerPromise.then(handle => handle.remove()).catch(() => {});
    };
  }, []);

  return <Router />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultThemeId="midnight">
        <AudioProvider>
          <FirebaseAuthProvider>
            <TooltipProvider>
              <Toaster />
              <AppInner />
            </TooltipProvider>
          </FirebaseAuthProvider>
        </AudioProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
