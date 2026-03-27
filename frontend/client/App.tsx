import { SuiProvider } from "./context/SuiProvider";
import { CustomWallet } from "./components/CustomWallet.tsx";
import { PokemonGame } from "./components/PokemonGame.tsx";
import { FriendsPage } from "./components/FriendsPage.tsx";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { Users, Home, LayoutGrid } from "lucide-react";
import { Button } from "./components/ui/button";

export default function App() {
  const [currentPage, setCurrentPage] = useState<"game" | "friends">("game");
  const [viewingAddress, setViewingAddress] = useState<string>("");

  // Global Friends State
  const [friends, setFriends] = useState<{ name: string, address: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("pokeFriends");
      if (saved) return JSON.parse(saved);
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("pokeFriends", JSON.stringify(friends));
  }, [friends]);

  const addFriend = (name: string, address: string) => {
    setFriends([...friends, { name, address }]);
  };

  const removeFriend = (address: string) => {
    setFriends(friends.filter(f => f.address !== address));
  };

  const viewFriendPC = (address: string) => {
    setViewingAddress(address);
    setCurrentPage("game");
  };

  return (
    <SuiProvider>
      <div className="min-h-screen flex flex-col items-center p-2 md:p-4 relative overflow-hidden font-nunito bg-slate-50/50">
        
        {/* Header Section: Compact, blurred, and refined styling */}
<header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center py-3 gap-3 z-10 border-b-[3px] border-slate-800/10 mb-5 bg-white/50 rounded-2xl px-5 backdrop-blur-sm poke-border">
  <div className="flex items-center gap-4">
    <button 
      onClick={() => { setCurrentPage("game"); setViewingAddress(""); }} 
      className="hover:scale-105 transition-transform active:scale-95 shrink-0"
    >
      {/* Increased height slightly from the first snippet to ensure the logo remains legible */}
      <img src="/pokecatch.png" alt="PokeCatch" className="h-10 md:h-14 w-auto object-contain" />
    </button>
    
    <nav className="hidden sm:flex items-center gap-1.5 bg-slate-800/5 p-1 rounded-xl border border-slate-800/10">
       <Button 
         variant={currentPage === "game" ? "default" : "ghost"}
         onClick={() => { setCurrentPage("game"); setViewingAddress(""); }}
         className={`rounded-lg font-bold uppercase tracking-wide px-4 h-9 text-xs ${currentPage === "game" ? "bg-red-500 hover:bg-red-400 text-white shadow-sm" : "text-slate-600"}`}
       >
         <Home className="w-3.5 h-3.5 mr-1.5" />
         Game
       </Button>
       <Button 
         variant={currentPage === "friends" ? "default" : "ghost"}
         onClick={() => setCurrentPage("friends")}
         className={`rounded-lg font-bold uppercase tracking-wide px-4 h-9 text-xs ${currentPage === "friends" ? "bg-blue-500 hover:bg-blue-400 text-white shadow-sm" : "text-slate-600"}`}
       >
         <Users className="w-3.5 h-3.5 mr-1.5" />
         Friends
       </Button>
    </nav>
  </div>

  <div className="flex items-center gap-2">
    <div className="sm:hidden flex gap-1.5 mr-1">
        <Button variant="outline" size="icon" onClick={() => setCurrentPage("game")} className={`h-9 w-9 rounded-lg border-2 ${currentPage === "game" ? "bg-red-50 border-red-500/50 text-red-600" : "border-slate-200"}`}><Home className="w-4 h-4"/></Button>
        <Button variant="outline" size="icon" onClick={() => setCurrentPage("friends")} className={`h-9 w-9 rounded-lg border-2 ${currentPage === "friends" ? "bg-blue-50 border-blue-500/50 text-blue-600" : "border-slate-200"}`}><Users className="w-4 h-4"/></Button>
    </div>
    <CustomWallet />
  </div>
</header>

        {/* Main Interface */}
        <main className="w-full max-w-6xl flex-1 z-10">
          {currentPage === "game" ? (
            <PokemonGame 
                externalViewingAddress={viewingAddress} 
                onViewChange={setViewingAddress}
                friends={friends}
            />
          ) : (
            <FriendsPage 
                friends={friends} 
                onAddFriend={addFriend} 
                onRemoveFriend={removeFriend} 
                onViewFriend={viewFriendPC}
            />
          )}
        </main>

        <Toaster position="bottom-right" richColors theme="light" className="font-nunito font-bold" />
      </div>
    </SuiProvider>
  );
}