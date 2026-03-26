import { SuiProvider } from "./context/SuiProvider";
import { CustomWallet } from "./components/CustomWallet.tsx";
import { PokemonGame } from "./components/PokemonGame.tsx";
import { Toaster } from "sonner";

export default function App() {
  return (
    <SuiProvider>
      {/* Reduced main container padding from p-4 lg:p-8 to p-2 md:p-4 */}
      <div className="min-h-screen flex flex-col items-center p-2 md:p-4 relative overflow-hidden font-nunito">

        {/* Header Section: Reduced vertical/horizontal padding, gap, bottom margin, and border radius */}
        <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center py-3 gap-3 z-10 border-b-[3px] border-slate-800/10 mb-5 bg-white/50 rounded-2xl px-5 backdrop-blur-sm poke-border">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2">
              <img src="/pokecatch.png" alt="PokeCatch" className="h-16 md:h-24 w-auto object-contain" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <CustomWallet />
          </div>
        </header>

        {/* Main Game Interface */}
        <main className="w-full max-w-6xl flex-1 z-10">
          <PokemonGame />
        </main>

        {/* Footer Info: Reduced top margin and padding */}
        <footer className="w-full max-w-6xl py-4 mt-8 z-10 text-center">
          <div className="bg-white/80 inline-block px-4 py-1.5 rounded-full poke-border text-slate-600 font-bold text-[11px]">
            Built for Trainers by PokeCatch Team
          </div>
        </footer>

        {/* Toaster styled to fit the light theme */}
        <Toaster position="bottom-right" richColors theme="light" className="font-nunito font-bold" />
      </div>
    </SuiProvider>
  );
}