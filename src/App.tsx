import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Lobby from "./pages/Lobby";
import Roadmap from "./pages/Roadmap";
import Phase1 from "./pages/Phase1";
import Phase2 from "./pages/Phase2";
import Phase3 from "./pages/Phase3"; // 👈 ADD THIS
import Tokenomics from "./pages/Tokenomics";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import CryptoTrivia from "./pages/games/CryptoTrivia";
import RockPaperScissors from "./pages/games/RockPaperScissors";
import SpeedTrading from "./pages/games/SpeedTrading";
import MemeBattles from "./pages/games/MemeBattles";
import HowToPlay from './pages/HowToPlay';
import Phase3Winner from './pages/Phase3Winner';
import Team from "./pages/Team";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/phase1" element={<Phase1 />} />
          <Route path="/phase2" element={<Phase2 />} />
          <Route path="/phase3" element={<Phase3 />} /> {/* 👈 ADD THIS */}
          <Route path="/phase3/winner" element={<Phase3Winner />} />
          <Route path="/games/crypto-trivia" element={<CryptoTrivia />} />
          <Route path="/games/rock-paper-scissors" element={<RockPaperScissors />} />
          <Route path="/games/speed-trading" element={<SpeedTrading />} />
          <Route path="/games/meme-battles" element={<MemeBattles />} />
          <Route path="/tokenomics" element={<Tokenomics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/how-it-works" element={<HowToPlay />} />
          <Route path="/team" element={<Team />} />
          <Route path="/admin" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;