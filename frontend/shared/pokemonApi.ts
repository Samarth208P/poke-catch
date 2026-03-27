/**
 * PokéAPI Integration Service
 * Fetches and caches Pokemon data from https://pokeapi.co/api/v2/
 */

export interface PokemonData {
  id: number;
  name: string;
  type: string;
  imageUrl: string;
  stats: {
    hp: number;
    attack: number;
    defense: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  height: number;
  weight: number;
}

export interface PokemonSpecies {
  id: number;
  name: string;
  types: string[];
  rarityTier: 1 | 2 | 3 | 4;
}

// Cache for Pokemon data to avoid repeated API calls
const pokemonCache = new Map<number, PokemonData>();
const speciesCache = new Map<number, PokemonSpecies>();

/**
 * Fetch Pokemon data from PokéAPI
 * @param pokemonId - Pokemon ID (1-151 for Gen 1)
 * @returns Promise<PokemonData>
 */
export async function fetchPokemonData(pokemonId: number): Promise<PokemonData> {
  // Check cache first
  if (pokemonCache.has(pokemonId)) {
    return pokemonCache.get(pokemonId)!;
  }

  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    
    if (!response.ok) {
      throw new Error(`Pokemon API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse stats from API response
    const statsMap: { [key: string]: number } = {};
    data.stats.forEach((stat: any) => {
      statsMap[stat.stat.name] = stat.base_stat;
    });

    // Get primary type
    const primaryType = data.types[0]?.type?.name || "normal";

    // Build Pokemon data object
    const pokemonData: PokemonData = {
      id: data.id,
      name: data.name,
      type: primaryType,
      imageUrl: data.sprites?.other?.["official-artwork"]?.front_default || 
               data.sprites?.front_default || 
               `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`,
      stats: {
        hp: statsMap["hp"] || 45,
        attack: statsMap["attack"] || 49,
        defense: statsMap["defense"] || 49,
        spAtk: statsMap["sp-attack"] || 65,
        spDef: statsMap["sp-defense"] || 65,
        speed: statsMap["speed"] || 45,
      },
      height: data.height || 10,
      weight: data.weight || 69,
    };

    // Cache it
    pokemonCache.set(pokemonId, pokemonData);
    return pokemonData;
  } catch (error) {
    console.error(`Failed to fetch Pokemon ${pokemonId}:`, error);
    // Return placeholder data
    return {
      id: pokemonId,
      name: `Pokemon #${pokemonId}`,
      type: "unknown",
      imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`,
      stats: {
        hp: 50,
        attack: 50,
        defense: 50,
        spAtk: 50,
        spDef: 50,
        speed: 50,
      },
      height: 0,
      weight: 0,
    };
  }
}

/**
 * Batch fetch multiple Pokemon
 * @param pokemonIds - Array of Pokemon IDs
 * @returns Promise<PokemonData[]>
 */
export async function fetchMultiplePokemon(pokemonIds: number[]): Promise<PokemonData[]> {
  return Promise.all(pokemonIds.map(id => fetchPokemonData(id)));
}

/**
 * Format Pokemon name for display
 * Capitalize first letter
 */
export function formatPokemonName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Get type color for Pokemon
 */
export function getTypeColor(type: string): string {
  const typeColors: { [key: string]: string } = {
    normal: "#A8A878",
    fire: "#F08030",
    water: "#6890F0",
    grass: "#78C850",
    electric: "#F8D030",
    ice: "#98D8D8",
    fighting: "#C03028",
    poison: "#A040A0",
    ground: "#E0C068",
    flying: "#A890F0",
    psychic: "#F85888",
    bug: "#A8B820",
    rock: "#B8A038",
    ghost: "#705898",
    dragon: "#7038F8",
    dark: "#705848",
    steel: "#B8B8D0",
    fairy: "#EE99AC",
    unknown: "#68A090",
  };
  return typeColors[type.toLowerCase()] || "#68A090";
}

/**
 * Get rarity color based on tier
 */
export function getRarityColor(tier: 1 | 2 | 3 | 4): string {
  const rarityColors = {
    1: "#94A3B8",    // Common - Slate
    2: "#3B82F6",    // Rare - Blue
    3: "#A855F7",    // Epic - Purple
    4: "#F59E0B",    // Legendary - Amber
  };
  return rarityColors[tier];
}

/**
 * Get rarity name
 */
export function getRarityName(tier: 1 | 2 | 3 | 4): string {
  const rarities = {
    1: "Common",
    2: "Rare",
    3: "Epic",
    4: "Legendary",
  };
  return rarities[tier];
}
