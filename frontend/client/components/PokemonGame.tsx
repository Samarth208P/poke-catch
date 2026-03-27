import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PokemonCard } from "./PokemonCard";
import { fetchPokemonData, getTypeColor, getRarityColor, getRarityName } from "../../shared/pokemonApi";
import { BarChart3, ArrowDownUp, LayoutGrid, Grip, ArrowLeft, Volume2, ExternalLink, Check, Users, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID;
const GAME_CONFIG_ID = import.meta.env.VITE_GAME_CONFIG_ID;

interface CaughtPokemon {
  id: string;
  pokemonId: number;
  name: string;
  pokemonType: string;
  rarityTier: 1 | 2 | 3 | 4;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  sp_attack: number;
  sp_defense: number;
  speed: number;
  imageUrl: string;
  caught_at: number;
  originalTrainer: string;
  lastSender: string;
}

type SortOption = "rarity" | "level" | "stats" | "number";

export function PokemonGame({ 
  externalViewingAddress, 
  onViewChange, 
  friends = [] 
}: { 
  externalViewingAddress?: string, 
  onViewChange: (addr: string) => void, 
  friends?: { name: string, address: string }[] 
}) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [config, setConfig] = useState<any>(null);
  const [pity, setPity] = useState<number>(0);
  const [caughtPokemon, setCaughtPokemon] = useState<CaughtPokemon[]>([]);
  const [revealedPokemon, setRevealedPokemon] = useState<CaughtPokemon[]>([]);
  const [openingState, setOpeningState] = useState<"idle" | "catching" | "revealing">("idle");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(0);

  const [sortBy, setSortBy] = useState<SortOption>("rarity");
  const [showAllStats, setShowAllStats] = useState(false);
  const [viewMode, setViewMode] = useState<"enlarge" | "compact">("compact");
  const [selectedPokemon, setSelectedPokemon] = useState<CaughtPokemon | null>(null);

  // Sync viewingAddress with prop or default to account
  const viewingAddress = externalViewingAddress || account?.address || "";
  const setViewingAddress = onViewChange;


  const refreshPokemon = async () => {
    const targetAddress = viewingAddress || account?.address;
    if (!targetAddress) return;

    try {
      const configObj = await suiClient.getObject({ id: GAME_CONFIG_ID, options: { showContent: true } });
      const fields = (configObj.data?.content as any)?.fields;
      setConfig({
        price: Number(fields.price),
        w_common: fields.weight_common,
        w_rare: fields.weight_rare,
        w_epic: fields.weight_epic,
        w_legendary: fields.weight_legendary,
      });

      const pityRes = await suiClient.getDynamicFieldObject({
        parentId: GAME_CONFIG_ID,
        name: { type: "address", value: targetAddress },
      });
      setPity(pityRes.data ? Number((pityRes.data.content as any).fields.value) : 0);

      const pokemonType = `${PACKAGE_ID}::pokemon::Pokemon`;
      const rawItems: any[] = [];
      let cursor: string | null | undefined = null;

      for (let i = 0; i < 20; i++) {
        const page = await suiClient.getOwnedObjects({
          owner: targetAddress,
          filter: { StructType: pokemonType },
          options: { showType: true, showContent: true },
          cursor,
          limit: 50,
        });

        for (const obj of page.data ?? []) {
          const id = obj.data?.objectId;
          if (!id) continue;
          const f = (obj.data?.content as any)?.fields;

          rawItems.push({
            id,
            pokemonId: Number(f?.pokemon_id || 1),
            name: f?.name || "Unknown",
            rarityTier: Number(f?.rarity_tier || 1) as 1 | 2 | 3 | 4,
            level: Number(f?.level || 1),
            hp: Number(f?.hp || 20),
            attack: Number(f?.attack || 20),
            defense: Number(f?.defense || 20),
            sp_attack: Number(f?.sp_attack || 20),
            sp_defense: Number(f?.sp_defense || 20),
            speed: Number(f?.speed || 20),
            imageUrl: f?.image_url || "",
            caught_at: Number(f?.caught_at || 0),
            originalTrainer: f?.original_trainer || "",
            lastSender: f?.last_sender || "",
          });
        }
        if (!page.hasNextPage) break;
        cursor = page.nextCursor;
      }

      const enrichedItems = await Promise.all(
        rawItems.map(async (p) => {
          const apiData = await fetchPokemonData(p.pokemonId);
          return { ...p, pokemonType: apiData.type };
        })
      );

      setCaughtPokemon(enrichedItems);
    } catch (e) {
      console.error("Failed to refresh Pokemon", e);
    }
  };

  useEffect(() => { refreshPokemon(); }, [account, viewingAddress]);

  const sortedPokemon = useMemo(() => {
    return [...caughtPokemon].sort((a, b) => {
      switch (sortBy) {
        case "level":
          return b.level - a.level;
        case "stats":
          const statsA = a.hp + a.attack + a.defense + a.sp_attack + a.sp_defense + a.speed;
          const statsB = b.hp + b.attack + b.defense + b.sp_attack + b.sp_defense + b.speed;
          return statsB - statsA;
        case "number":
          return a.pokemonId - b.pokemonId;
        case "rarity":
        default:
          return b.rarityTier - a.rarityTier || b.level - a.level;
      }
    });
  }, [caughtPokemon, sortBy]);

  const handleCatchPokemon = async (quantity: number = 1) => {
    if (!account || !config) return toast.error("Game not loaded.");

    setOpeningState("catching");
    setRevealedPokemon([]);
    setCurrentRevealIndex(0);

    try {
      const tx = new Transaction();
      const totalPrice = config.price * quantity;
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(totalPrice)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::pokemon::purchase_and_catch_pokemon`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [tx.object(GAME_CONFIG_ID), coin, tx.pure.u64(quantity), tx.object("0x8")],
      });

      signAndExecute({ transaction: tx }, {
        onSuccess: async (result) => {
          try {
            await new Promise((r) => setTimeout(r, 1500));

            const txDetail = await suiClient.getTransactionBlock({ digest: result.digest, options: { showEvents: true } });
            const events = txDetail.events?.filter((e) => e.type.includes("PokemonCaught"));

            if (events && events.length > 0) {
              const revealedRaw: any[] = events.map(e => {
                const parsedJson = e.parsedJson as any;
                return {
                  id: parsedJson.object_id,
                  pokemonId: Number(parsedJson.pokemon_id),
                  name: parsedJson.pokemon_name,
                  rarityTier: Number(parsedJson.rarity) as 1 | 2 | 3 | 4,
                  level: Number(parsedJson.level),
                  hp: Number(parsedJson.hp),
                  attack: Number(parsedJson.attack),
                  defense: Number(parsedJson.defense),
                  sp_attack: Number(parsedJson.sp_attack),
                  sp_defense: Number(parsedJson.sp_defense),
                  speed: Number(parsedJson.speed),
                  imageUrl: parsedJson.image_url,
                  caught_at: Date.now(),
                  originalTrainer: parsedJson.original_trainer,
                  lastSender: parsedJson.last_sender,
                };
              });

              const revealedEnriched = await Promise.all(
                revealedRaw.map(async (p) => {
                  const apiData = await fetchPokemonData(p.pokemonId);
                  return { ...p, pokemonType: apiData.type };
                })
              );

              setRevealedPokemon(revealedEnriched);
              setOpeningState("revealing");
            } else {
              setOpeningState("idle");
            }
            refreshPokemon();
          } catch (e) {
            toast.error("Error processing results.");
            setOpeningState("idle");
          }
        },
        onError: (e) => {
          toast.error(e.message);
          setOpeningState("idle");
        },
      });
    } catch (e: any) {
      toast.error(e.message);
      setOpeningState("idle");
    }
  };

  const handleTransferPokemon = async (id: string, recipient: string) => {
    if (!account) return;
    if (!recipient || recipient.length < 40) return toast.error("Invalid recipient address.");

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::pokemon::transfer_pokemon`,
        arguments: [tx.object(id), tx.pure.address(recipient)],
      });

      signAndExecute({ transaction: tx }, {
        onSuccess: async () => {
          toast.success("Pokemon transferred successfully!");
          setCaughtPokemon((prev) => prev.filter((p) => p.id !== id));
          if (selectedPokemon?.id === id) setSelectedPokemon(null);
          await new Promise((r) => setTimeout(r, 1500));
          refreshPokemon();
        },
        onError: (e) => toast.error(e.message),
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReleasePokemon = async (id: string) => {
    if (!account) return;
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::pokemon::burn_pokemon`,
        arguments: [tx.object(id)],
      });

      signAndExecute({ transaction: tx }, {
        onSuccess: async () => {
          toast.success("Pokemon released back to the wild!");
          setCaughtPokemon((prev) => prev.filter((p) => p.id !== id));
          if (selectedPokemon?.id === id) setSelectedPokemon(null);
          await new Promise((r) => setTimeout(r, 1500));
          refreshPokemon();
        },
        onError: (e) => toast.error(e.message),
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const isViewingOwnPC = viewingAddress === account?.address;

  return (
    <div className="w-full font-nunito">

      {createPortal(
        <AnimatePresence>
          {selectedPokemon && (
            <DetailedPokemonModal
              pokemon={selectedPokemon}
              friends={friends}
              onClose={() => setSelectedPokemon(null)}
              onRelease={() => handleReleasePokemon(selectedPokemon.id)}
              onTransfer={(id, recipient) => handleTransferPokemon(id, recipient)}
              isReadOnly={!isViewingOwnPC}
            />
          )}

          {(openingState === "catching" || openingState === "revealing") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl overflow-y-auto min-h-screen p-4 py-12"
            >
              {openingState === "catching" && (
                <div className="flex flex-col items-center justify-center my-auto">
                  <motion.img
                    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
                    className="w-32 h-32 pixelated drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                    animate={{ rotate: [0, -25, 25, -25, 25, 0], y: [0, -40, 0] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  />
                  <motion.p
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="mt-8 text-2xl font-pokemon text-white tracking-widest"
                  >
                    Throwing Pokeballs...
                  </motion.p>
                </div>
              )}

              {/* SEQUENTIAL REVEAL ANIMATION */}
              {openingState === "revealing" && revealedPokemon.length > 0 && (
                <div className="w-full max-w-6xl flex flex-col items-center justify-center my-auto min-h-[60vh]">
                  <motion.h2
                    key={`title-${currentRevealIndex}`}
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-4xl md:text-6xl font-pokemon text-yellow-400 mb-8 tracking-widest text-center"
                    style={{ WebkitTextStroke: '2px #1e3a8a', textShadow: '4px 4px 0px rgba(30, 58, 138, 0.8)' }}
                  >
                    {revealedPokemon.length > 1
                      ? `Gotcha! (${currentRevealIndex + 1}/${revealedPokemon.length})`
                      : 'Gotcha!'}
                  </motion.h2>

                  <div className="flex justify-center w-full px-4 h-full relative">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentRevealIndex}
                        initial={{ scale: 0.8, opacity: 0, x: 100 }}
                        animate={{ scale: 1, opacity: 1, x: 0 }}
                        exit={{ scale: 0.8, opacity: 0, x: -100 }}
                        transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                        className="w-full max-w-md absolute"
                        style={{ position: "relative" }}
                      >
                        <PokemonCard
                          id={revealedPokemon[currentRevealIndex].id}
                          pokemonId={revealedPokemon[currentRevealIndex].pokemonId}
                          name={revealedPokemon[currentRevealIndex].name}
                          pokemonType={revealedPokemon[currentRevealIndex].pokemonType}
                          rarityTier={revealedPokemon[currentRevealIndex].rarityTier}
                          level={revealedPokemon[currentRevealIndex].level}
                          imageUrl={revealedPokemon[currentRevealIndex].imageUrl}
                          stats={{
                            hp: revealedPokemon[currentRevealIndex].hp,
                            attack: revealedPokemon[currentRevealIndex].attack,
                            defense: revealedPokemon[currentRevealIndex].defense,
                            spAttack: revealedPokemon[currentRevealIndex].sp_attack,
                            spDefense: revealedPokemon[currentRevealIndex].sp_defense,
                            speed: revealedPokemon[currentRevealIndex].speed,
                          }}
                          isLarge
                          forceShowStats={true}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="mt-12 z-10"
                  >
                    {currentRevealIndex < revealedPokemon.length - 1 ? (
                      <Button
                        onClick={() => setCurrentRevealIndex(prev => prev + 1)}
                        className="px-10 py-6 text-xl font-black bg-yellow-400 hover:bg-yellow-300 text-slate-900 border-4 border-slate-900 rounded-xl shadow-[6px_6px_0px_#0f172a] transition-transform hover:-translate-y-1 uppercase tracking-widest"
                      >
                        Next Pokémon
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setOpeningState("idle");
                          setCurrentRevealIndex(0);
                        }}
                        className="px-12 py-6 text-xl font-black bg-blue-500 hover:bg-blue-400 text-white border-4 border-slate-900 rounded-xl shadow-[6px_6px_0px_#0f172a] transition-transform hover:-translate-y-1 uppercase tracking-widest"
                      >
                        Finish
                      </Button>
                    )}
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Wild Encounter Box - Hidden when viewing friends PC */}
        {isViewingOwnPC && (
          <Card className="bg-white poke-border mb-6 overflow-hidden">
            <div className="bg-blue-500 py-2 px-4 sm:px-6 border-b-4 border-slate-800 flex items-center justify-between">
              <CardTitle className="text-white font-black uppercase tracking-wider text-lg flex items-center gap-2">
                Wild Encounter!
              </CardTitle>
              <div className="bg-white/20 px-3 py-1 rounded-lg border border-white/30 backdrop-blur-sm">
                <span className="text-[10px] font-black text-white/70 uppercase tracking-widest mr-2">Pity</span>
                <span className="text-sm font-black text-yellow-300">{pity} / 30</span>
              </div>
            </div>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full">
                  <label className="text-xs font-black text-slate-600 mb-2 block uppercase tracking-wider">Select Balls</label>
                  <div className="flex gap-2 sm:gap-3">
                    {[1, 5, 10].map((qty) => (
                      <Button
                        key={qty}
                        variant="outline"
                        onClick={() => setSelectedQuantity(qty)}
                        className={`flex-1 font-bold border-4 shadow-[4px_4px_0px_#1e293b] py-2 h-auto ${selectedQuantity === qty
                          ? 'bg-blue-100 border-blue-500 text-blue-800'
                          : 'bg-white border-slate-800 hover:bg-slate-100'
                          }`}
                      >
                        x{qty}
                      </Button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleCatchPokemon(selectedQuantity)}
                  disabled={!account || !config}
                  className="poke-button px-6 py-4 text-lg w-full md:w-auto mt-2 md:mt-0 flex items-center justify-center gap-3 h-full self-stretch"
                >
                  <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" className="w-6 h-6 pixelated" />
                  CATCH POKEMON
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PC Box Area */}
        <div className="mt-8">
          <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0px_#1e293b] rounded-3xl p-4 sm:p-5 mb-8 flex flex-col xl:flex-row justify-between items-center gap-5">
            
            {/* Left: Title & Account Selector */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto justify-between xl:justify-start">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] flex items-center justify-center shrink-0 ${isViewingOwnPC ? 'bg-red-500' : 'bg-blue-500'}`}>
                  <LayoutGrid className="w-7 h-7 text-white" />
                </div>
                <div className="flex flex-col items-start">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-widest leading-none mb-1">
                    {isViewingOwnPC ? "My PC Box" : "Friend's PC"}
                  </h2>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border-2 border-slate-200">
                    {caughtPokemon.length} Pokémon Stored
                  </span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 bg-slate-50 px-4 py-2 h-[44px] font-bold border-2 border-slate-300 shadow-[3px_3px_0px_#cbd5e1] hover:bg-slate-100 transition-all rounded-xl min-w-[180px] justify-between xl:ml-4"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Users className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate text-slate-700 text-sm uppercase tracking-wider">
                        {isViewingOwnPC
                          ? "My Account"
                          : (friends.find(f => f.address === viewingAddress)?.name || (viewingAddress?.slice(0, 6) + "..." + viewingAddress?.slice(-4)))}
                      </span>
                    </div>
                    <ArrowDownUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-white poke-border border-4 border-slate-900 shadow-[6px_6px_0px_#1e293b] rounded-2xl p-2 mt-1">
                  <DropdownMenuItem
                    onClick={() => {
                      setViewingAddress(account?.address || "");
                    }}
                    className={`flex items-center justify-between p-3 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg uppercase text-[10px] tracking-widest ${isViewingOwnPC ? 'bg-blue-50 border-2 border-blue-200' : ''}`}
                  >
                    My Account {isViewingOwnPC && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </DropdownMenuItem>

                  {friends.length > 0 && (
                    <div className="my-1 border-t-2 border-slate-100" />
                  )}

                  {friends.map(f => (
                    <DropdownMenuItem
                      key={f.address}
                      onClick={() => {
                        setViewingAddress(f.address);
                      }}
                      className={`flex flex-col items-start p-3 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg uppercase text-[10px] tracking-widest ${viewingAddress === f.address ? 'bg-blue-50 border-2 border-blue-200' : ''}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{f.name}</span>
                        {viewingAddress === f.address && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 mt-0.5 normal-case">{f.address.slice(0, 8)}...{f.address.slice(-6)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: View & Sort Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full xl:w-auto bg-slate-100/80 p-2 sm:p-2.5 rounded-2xl border-2 border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(prev => prev === "enlarge" ? "compact" : "enlarge")}
                className="font-black bg-white border-2 border-slate-300 shadow-[2px_2px_0px_#cbd5e1] rounded-xl hover:bg-slate-50 transition-all h-10 text-slate-600 uppercase tracking-wider text-[11px]"
              >
                {viewMode === "enlarge" ? (
                  <><Grip className="w-4 h-4 mr-1.5" /> Compact</>
                ) : (
                  <><LayoutGrid className="w-4 h-4 mr-1.5" /> Enlarge</>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllStats(!showAllStats)}
                disabled={viewMode === "compact"}
                className={`font-black border-2 shadow-[2px_2px_0px_#cbd5e1] rounded-xl transition-all h-10 uppercase tracking-wider text-[11px] ${
                  showAllStats && viewMode === "enlarge" 
                    ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-[2px_2px_0px_#93c5fd]' 
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                } ${viewMode === "compact" ? "opacity-50 cursor-not-allowed shadow-none" : ""}`}
              >
                <BarChart3 className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">{showAllStats ? "Hide Stats" : "Show Stats"}</span>
                <span className="sm:hidden">Stats</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 font-black bg-white border-2 border-slate-300 shadow-[2px_2px_0px_#cbd5e1] rounded-xl h-10 min-w-[140px] justify-between uppercase tracking-wider text-[11px] hover:bg-slate-50 transition-all text-slate-600"
                  >
                    <div className="flex items-center gap-1.5">
                      <ArrowDownUp className="h-3.5 w-3.5" />
                      Sort: {sortBy === "rarity" ? "Rarity" : sortBy === "level" ? "Level" : sortBy === "stats" ? "Total" : "Dex #"}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-white poke-border border-4 border-slate-900 shadow-[6px_6px_0px_#1e293b] rounded-2xl p-2 mt-1"
                >
                  <DropdownMenuItem
                    onClick={() => setSortBy("rarity")}
                    className="flex items-center justify-between p-2 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg uppercase text-[10px] tracking-widest"
                  >
                    Rarity {sortBy === "rarity" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("level")}
                    className="flex items-center justify-between p-2 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg uppercase text-[10px] tracking-widest"
                  >
                    Level {sortBy === "level" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("stats")}
                    className="flex items-center justify-between p-2 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg uppercase text-[10px] tracking-widest"
                  >
                    Total Stats {sortBy === "stats" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("number")}
                    className="flex items-center justify-between p-2 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg uppercase text-[10px] tracking-widest"
                  >
                    Pokédex # {sortBy === "number" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {sortedPokemon.length === 0 ? (
    <Card className="bg-white poke-border text-center py-12">
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" className="w-12 h-12 mx-auto mb-4 opacity-30 pixelated grayscale" />
      <p className="text-slate-500 font-bold text-base">This PC box is currently empty.</p>
    </Card>
  ) : viewMode === "compact" ? (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4 bg-white/50 backdrop-blur-sm p-5 sm:p-6 rounded-xl border-4 border-slate-800 shadow-[4px_4px_0px_#1e293b]">
      {sortedPokemon.map((pokemon) => (
        <button
          key={pokemon.id}
          onClick={() => setSelectedPokemon(pokemon)}
          className="w-[72px] h-[72px] sm:w-[88px] sm:h-[88px] md:w-24 md:h-24 bg-white border-2 rounded-lg hover:bg-blue-50 hover:-translate-y-1 transition-all flex items-center justify-center p-2 relative group"
          style={{
            borderColor: getRarityColor(pokemon.rarityTier),
            boxShadow: `2px 2px 0px ${getRarityColor(pokemon.rarityTier)}`
          }}
        >
          <div className="absolute -top-2 -right-2 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
            Lv.{pokemon.level}
          </div>
          <img src={pokemon.imageUrl} alt={pokemon.name} className="w-full h-full object-contain pixelated" />
        </button>
      ))}
    </div>
  ) : (
    /* ENLARGED MODE: Intercepting clicks with onClickCapture to prioritize the modal */
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {sortedPokemon.map((pokemon) => (
        <div 
          key={pokemon.id} 
          onClickCapture={(e) => {
            // Check if the clicked element (or its parent) is a button
            const target = e.target as HTMLElement;
            if (target.closest('button')) {
              return; // It's a button (like "Release"), let it do its thing
            }
            
            // It's NOT a button, so block the explorer link and open the modal instead
            e.preventDefault();
            e.stopPropagation();
            setSelectedPokemon(pokemon);
          }}
          className="cursor-pointer transition-transform hover:-translate-y-1 active:scale-[0.98]"
        >
          <PokemonCard
            id={pokemon.id}
            pokemonId={pokemon.pokemonId}
            name={pokemon.name}
            pokemonType={pokemon.pokemonType}
            rarityTier={pokemon.rarityTier}
            level={pokemon.level}
            imageUrl={pokemon.imageUrl}
            stats={{
              hp: pokemon.hp,
              attack: pokemon.attack,
              defense: pokemon.defense,
              spAttack: pokemon.sp_attack,
              spDefense: pokemon.sp_defense,
              speed: pokemon.speed,
            }}
            onBurn={isViewingOwnPC ? (e: any) => {
              if (e && e.stopPropagation) e.stopPropagation();
              handleReleasePokemon(pokemon.id);
            } : undefined}
            forceShowStats={showAllStats}
          />
        </div>
      ))}
    </div>
  )}
        </div>
      </div>
    </div>
  );
}

// --- COMPACT MODAL ---
function DetailedPokemonModal({ pokemon, friends, onClose, onRelease, onTransfer, isReadOnly }: { pokemon: CaughtPokemon, friends: { name: string, address: string }[], onClose: () => void, onRelease: () => void, onTransfer: (id: string, recipient: string) => void, isReadOnly: boolean }) {
  const [transferRecipient, setTransferRecipient] = useState("");

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const playCry = () => {
    try {
      const audio = new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemon.pokemonId}.ogg`);
      audio.volume = 0.5;
      audio.play();
    } catch (e) {
      console.error("Failed to play Pokémon cry:", e);
      toast.error("Could not play sound.");
    }
  };

  const rarityColors: Record<number, string> = {
    1: "bg-slate-200 text-slate-800",
    2: "bg-green-400 text-green-950",
    3: "bg-blue-400 text-blue-950",
    4: "bg-purple-400 text-purple-950",
    5: "bg-yellow-400 text-yellow-950"
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-slate-900 w-full max-w-5xl max-h-[90vh] border-8 border-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[48px] flex flex-col md:flex-row overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white text-slate-900 border-4 border-slate-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:bg-slate-200 p-2 rounded-xl flex items-center justify-center z-[10001] transition-transform hover:-translate-y-1"
        >
          <Plus className="w-6 h-6 rotate-45" strokeWidth={4} />
        </button>

        {/* Left Column: Image, Level & Sound */}
        <div className="md:w-2/5 flex flex-col items-center justify-center bg-slate-800/50 p-6 sm:p-8 relative gap-6 border-b-8 md:border-b-0 md:border-r-8 border-slate-950">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent rounded-full blur-3xl scale-75 opacity-50 z-0"></div>

          {/* Image Frame */}
          <div className="bg-slate-800 border-4 border-slate-950 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-full p-6 relative z-10 group bg-[radial-gradient(circle,_#334155_0%,_#1e293b_100%)]">
            <img
              src={pokemon.imageUrl}
              alt={pokemon.name}
              className="w-40 h-40 sm:w-56 sm:h-56 object-contain pixelated drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Level & Sound Button */}
          <div className="flex items-center gap-3 relative z-10">
            <span className="text-lg sm:text-xl font-black text-slate-800 bg-white px-5 py-2.5 rounded-xl border-4 border-slate-950 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              Lv. {pokemon.level}
            </span>
            <button
              onClick={playCry}
              className="bg-blue-500 text-white p-3 rounded-xl border-4 border-slate-950 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:bg-blue-400 hover:-translate-y-1 transition-transform"
              title="Play Cry"
            >
              <Volume2 className="w-5 h-5" fill="currentColor" />
            </button>
          </div>
        </div>

        {/* Right Column: Details & Actions */}
        <div className="flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto overflow-x-hidden gap-4 scrollbar-hide">
          
          {/* Header Block */}
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-pokemon text-yellow-400 tracking-widest capitalize" style={{ WebkitTextStroke: '2px #000', textShadow: '4px 4px 0px #000' }}>
              {pokemon.name}
            </h2>

            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="px-3 py-1 text-white rounded-lg border-2 border-slate-950 shadow-[2px_2px_0px_#000]" style={{ backgroundColor: getTypeColor(pokemon.pokemonType) }}>
                {pokemon.pokemonType}
              </span>
              <span className={`px-3 py-1 rounded-lg border-2 border-slate-950 shadow-[2px_2px_0px_#000] ${rarityColors[pokemon.rarityTier] || "bg-slate-200"}`}>
                {getRarityName(pokemon.rarityTier)}
              </span>
              <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-lg border-2 border-slate-950 shadow-[2px_2px_0px_#000]">
                #{pokemon.pokemonId}
              </span>
            </div>
          </div>

          {/* Transfer Section (Hidden if ReadOnly) */}
          {!isReadOnly && (
            <div className="bg-slate-800/40 p-4 rounded-2xl border-2 border-slate-950 shadow-[4px_4px_0px_#000] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Send</h4>
                {friends.length > 0 && (
                  <span className="text-[9px] font-bold text-blue-400 uppercase bg-blue-500/10 px-2 py-0.5 rounded-md">
                    {friends.length} Friends
                  </span>
                )}
              </div>
              
              {friends.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {friends.map(f => (
                    <button
                      key={f.address}
                      onClick={() => setTransferRecipient(f.address)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 text-[9px] font-black uppercase transition-all ${
                        transferRecipient === f.address 
                        ? 'bg-blue-500 border-white text-white scale-105' 
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Recipient 0x..."
                    className="w-full bg-slate-900 border-2 border-slate-950 rounded-lg px-3 py-2 font-mono text-[11px] font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                    value={transferRecipient}
                    onChange={(e) => setTransferRecipient(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => onTransfer(pokemon.id, transferRecipient)}
                  className="bg-blue-500 hover:bg-blue-400 text-white font-black py-0 px-4 text-xs rounded-lg border-2 border-slate-950 shadow-[2px_2px_0px_#000] uppercase h-auto"
                >
                  Send
                </Button>
              </div>
            </div>
          )}

          {/* Stats Bar Container */}
          <div className="bg-white/5 p-4 rounded-2xl border-2 border-slate-950 shadow-[4px_4px_0px_#000] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-1 mb-1">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Stats</h3>
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Total: {pokemon.hp + pokemon.attack + pokemon.defense + pokemon.sp_attack + pokemon.sp_defense + pokemon.speed}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <StatBarMini label="HP" value={pokemon.hp} color="bg-red-500" />
              <StatBarMini label="Atk" value={pokemon.attack} color="bg-orange-500" />
              <StatBarMini label="Def" value={pokemon.defense} color="bg-yellow-500" />
              <StatBarMini label="SpA" value={pokemon.sp_attack} color="bg-blue-500" />
              <StatBarMini label="SpD" value={pokemon.sp_defense} color="bg-green-500" />
              <StatBarMini label="Spe" value={pokemon.speed} color="bg-pink-500" />
            </div>
            <div className="pt-2 border-t border-slate-700/50 mt-1">
              <StatBarMini 
                label="AVG" 
                value={Math.floor((pokemon.hp + pokemon.attack + pokemon.defense + pokemon.sp_attack + pokemon.sp_defense + pokemon.speed) / 6)} 
                color="bg-purple-500" 
              />
            </div>
          </div>

          {/* Explorer & Release Buttons */}
          <div className="flex gap-3 mt-auto pt-2">
            <Button
              onClick={() => window.open(`https://testnet.suivision.xyz/object/${pokemon.id}`, '_blank')}
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-black py-3 px-4 text-sm rounded-xl flex-1 border-4 border-slate-950 shadow-[4px_4px_0px_#000] transition-transform hover:-translate-y-1 uppercase flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Explorer
            </Button>

            {!isReadOnly && (
              <Button
                onClick={onRelease}
                className="bg-red-500 hover:bg-red-400 text-white font-black py-3 px-4 text-sm rounded-xl flex-1 border-4 border-slate-950 shadow-[4px_4px_0px_#000] transition-transform hover:-translate-y-1 uppercase"
              >
                Release
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatBarMini({ label, value, color }: { label: string, value: number, color: string }) {
  const percentage = Math.min(100, Math.max(0, (value / 255) * 100));

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1 }}
          className={`h-full ${color}`}
        />
      </div>
      <span className="w-6 text-right font-black text-white text-[10px]">{value}</span>
    </div>
  );
}

function StatBar({ label, value, color }: { label: string, value: number, color: string }) {
  const percentage = Math.min(100, Math.max(0, (value / 255) * 100));

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="w-16 sm:w-24 text-xs sm:text-sm font-black text-slate-600 uppercase tracking-wider">{label}</span>
      <span className="w-8 sm:w-12 text-right font-black text-slate-900 text-base sm:text-lg">{value}</span>
      <div className="flex-1 h-4 sm:h-5 bg-slate-200 rounded-full overflow-hidden border-2 border-slate-900 shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut", type: "spring", bounce: 0.2 }}
          className={`h-full ${color} border-r-2 border-slate-900`}
        />
      </div>
    </div>
  );
}