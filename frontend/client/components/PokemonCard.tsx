import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Share2, Eye, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { getRarityColor, getRarityName, getTypeColor, formatPokemonName } from "@shared/pokemonApi";

interface PokemonCardProps {
  id: string;
  pokemonId: number;
  name: string;
  pokemonType: string;
  rarityTier: 1 | 2 | 3 | 4;
  level: number;
  imageUrl: string;
  stats: {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
  };
  onBurn?: (id: string) => void;
  onTransfer?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  isLarge?: boolean;
  forceShowStats?: boolean; // Added to support global toggle
}

export function PokemonCard({
  id,
  pokemonId,
  name,
  pokemonType,
  rarityTier,
  level,
  imageUrl,
  stats,
  onBurn,
  onTransfer,
  onViewDetails,
  isLarge = false,
  forceShowStats,
}: PokemonCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Sync local state with the global toggle prop
  useEffect(() => {
    if (forceShowStats !== undefined) {
      setShowStats(forceShowStats);
    }
  }, [forceShowStats]);

  const rarityColor = getRarityColor(rarityTier);
  const rarityName = getRarityName(rarityTier);
  const typeColor = getTypeColor(pokemonType);

  const cardClasses = isLarge ? "w-full max-w-sm mx-auto" : "w-full h-full flex flex-col";

  const customBorderStyle = {
    borderColor: rarityColor,
    boxShadow: `4px 4px 0px ${rarityColor}`,
    borderWidth: '4px'
  };

  return (
    <Card
      className={`${cardClasses} bg-white rounded-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden`}
      style={customBorderStyle}
      onClick={() => window.open(`https://testnet.suivision.xyz/object/${id}`, "_blank")}
    >
      <CardContent className="p-3 flex-1 flex flex-col">
        {/* Header: Name and Rarity */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-lg font-black text-slate-800 capitalize leading-tight">{formatPokemonName(name)}</h3>
            <p className="text-[10px] font-pokemon text-slate-400 mt-0.5">#{pokemonId}</p>
          </div>
          <Badge
            style={{ backgroundColor: rarityColor, color: "white" }}
            className="font-bold border-2 border-slate-800 px-2 py-0 text-[10px]"
          >
            {rarityName}
          </Badge>
        </div>

        {/* Pokemon Image Area with Overlaid Badges */}
        <div className="relative bg-slate-50 rounded-xl p-2 mb-3 border-[3px] border-slate-800 h-36 flex items-center justify-center overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.05)] shrink-0">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_2px,transparent_2px)] [background-size:12px_12px]"></div>

          {/* Floating Level Badge (Top Left) */}
          <div className="absolute top-2 left-2 z-20">
            <Badge variant="outline" className="bg-white/90 backdrop-blur-sm border-2 border-slate-800 text-slate-800 font-black shadow-[2px_2px_0px_#1e293b] text-[10px] px-1.5 py-0">
              Lv. {level}
            </Badge>
          </div>

          {/* Floating Type Badge (Top Right) */}
          <div className="absolute top-2 right-2 z-20">
            <Badge
              style={{ backgroundColor: typeColor, color: "white" }}
              className="uppercase text-[10px] font-black border-2 border-slate-800 shadow-[2px_2px_0px_#1e293b] px-1.5 py-0"
            >
              {pokemonType}
            </Badge>
          </div>

          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" className="w-6 h-6 animate-spin pixelated opacity-50" />
            </div>
          )}
          <img
            src={imageUrl}
            alt={name}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-contain z-10 drop-shadow-md transition-opacity duration-300 ${imageLoaded ? "opacity-100 scale-110" : "opacity-0"}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://via.placeholder.com/150?text=${pokemonId}`;
              setImageLoaded(true);
            }}
          />
        </div>


        {/* Collapsible Stats Section */}
        {showStats && (
          <div className="pt-3 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
              {[
                { label: "HP", val: stats.hp, color: "text-red-600" },
                { label: "ATK", val: stats.attack, color: "text-orange-600" },
                { label: "DEF", val: stats.defense, color: "text-blue-600" },
                { label: "SP.A", val: stats.spAttack, color: "text-purple-600" },
                { label: "SP.D", val: stats.spDefense, color: "text-green-600" },
                { label: "SPD", val: stats.speed, color: "text-yellow-600" },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-50 p-1.5 rounded-md border-2 border-slate-200 flex flex-col justify-center">
                  <p className="text-[9px] font-black text-slate-400 leading-none mb-0.5">{stat.label}</p>
                  <p className={`text-xs font-black leading-none ${stat.color}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            {/* Total Stat Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-black text-slate-500 mb-0.5 px-0.5">
                <span>Total Base Stats</span>
                <span>{Math.round((stats.hp + stats.attack + stats.defense + stats.spAttack + stats.spDefense + stats.speed) / 6)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 border-[1.5px] border-slate-800 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-emerald-500 h-full transition-all"
                  style={{
                    width: `${Math.min((stats.hp + stats.attack + stats.defense + stats.spAttack + stats.spDefense + stats.speed) / 600 * 100, 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Actions Footer - Compact */}
      {(onBurn || onTransfer || onViewDetails) && (
        <CardFooter className="flex gap-1.5 p-2 border-t-[3px] border-slate-100 bg-slate-50 shrink-0">
          {onViewDetails && (
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-bold border-2 border-slate-800 shadow-[2px_2px_0px_#1e293b]" onClick={(e) => { e.stopPropagation(); onViewDetails(id); }}>
              <Eye className="w-3.5 h-3.5 mr-1" /> View
            </Button>
          )}
          {onTransfer && (
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-bold border-2 border-slate-800 shadow-[2px_2px_0px_#1e293b]" onClick={(e) => { e.stopPropagation(); onTransfer(id); }}>
              <Share2 className="w-3.5 h-3.5 mr-1" /> Send
            </Button>
          )}
          {onBurn && (
            <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs font-bold border-2 border-slate-800 shadow-[2px_2px_0px_#1e293b] hover:bg-red-600" onClick={(e) => { e.stopPropagation(); onBurn(id); }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Free
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

// Compact Skeleton loader
export function PokemonCardSkeleton() {
  return (
    <Card className="w-full h-full flex flex-col border-[4px] border-slate-200 bg-white rounded-2xl animate-pulse">
      <CardContent className="p-3 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="h-5 bg-slate-200 rounded-md w-2/3 mb-1"></div>
            <div className="h-2 bg-slate-200 rounded-md w-1/4"></div>
          </div>
          <div className="h-5 bg-slate-200 rounded-md w-16"></div>
        </div>

        <div className="h-36 bg-slate-100 border-[3px] border-slate-200 rounded-xl mb-3 shrink-0 relative">
          <div className="absolute top-2 left-2 h-4 w-12 bg-slate-200 rounded-md"></div>
          <div className="absolute top-2 right-2 h-4 w-14 bg-slate-200 rounded-md"></div>
        </div>

        <div className="mt-auto h-8 bg-slate-100 rounded-lg w-full"></div>
      </CardContent>
    </Card>
  );
}