# Pokemon Loot Box Game — Contract Documentation

> A secure, on-chain loot box system on Sui blockchain for the Alkimi Hackathon Problem Statement #2.

---

## Module

```
module loot_box_v2::pokemon
```

---

## Architecture Overview

```
┌─────────────┐     purchase      ┌─────────────┐     catch       ┌─────────────┐
│   Trainer   │ ───────────────►  │  Pokeball    │ ─────────────►  │  Pokemon    │
│  (wallet)   │   pays SUI        │   (NFT)      │  consumes ball  │   (NFT)     │
└─────────────┘                   └─────────────┘                  └─────────────┘
       │                                                                  │
       │  ┌──────────────┐                                                │
       └─►│  GameConfig   │◄── stores treasury, weights, pity counters    │
          └──────────────┘                                                │
                 ▲                                                        │
                 │  AdminCap required                                     ▼
          ┌──────────────┐                                        ┌──────────────┐
          │   Admin Ops  │                                        │  Transfer /  │
          │  (weights,   │                                        │  Burn        │
          │   withdraw)  │                                        └──────────────┘
          └──────────────┘
```

---

## Structs

| Struct | Abilities | Purpose |
|--------|-----------|---------|
| `POKEMON` | `drop` | One-time witness for package publishing |
| `AdminCap` | `key` | Capability granting admin rights (weight updates, treasury withdrawal) |
| `GameConfig<T>` | `key` | Shared object storing price, rarity weights, treasury balance, and per-player pity counters (via dynamic fields) |
| `Pokeball` | `key` | Unopened loot box — consumed when catching a Pokemon |
| `Pokemon` | `key, store` | The NFT: stores pokemon_id, name, rarity, level, 6 battle stats, image URL, trainer info |

---

## Events

| Event | Emitted When |
|-------|-------------|
| `PokemonCaught` | A Pokemon NFT is created (includes all stats, image, trainer) |
| `PokeballsPurchased` | Pokeballs are purchased (includes trainer, quantity, total price) |

---

## Constants

### Rarity Weights (Default)

| Tier | ID | Weight | Level Range | Stat Range |
|------|----|--------|-------------|------------|
| Common | 1 | 60% | 1–10 | 20–50 |
| Rare | 2 | 25% | 11–25 | 50–75 |
| Epic | 3 | 12% | 26–40 | 75–100 |
| Legendary | 4 | 3% | 41–50 | 90–151 |

### Other Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_PRICE` | 10,000,000 MIST (0.01 SUI) | Cost per Pokeball |
| `PITY_THRESHOLD` | 30 | Guaranteed Legendary after 30 non-Legendary catches |

### Error Codes

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | `EInvalidPayment` | Payment amount is less than required |
| 1 | `ERarityWeightsTotal` | Rarity weights don't sum to 100 |

---

## Functions

### Initialization

#### `fun init(otw: POKEMON, ctx: &mut TxContext)`
- **Visibility:** Private (called automatically on publish)
- **Action:** Claims publisher, calls `init_game_with_display<SUI>`, transfers publisher to sender

#### `public fun init_game<T>(ctx: &mut TxContext)`
- **Action:** Creates `AdminCap` (transferred to sender) and shared `GameConfig<T>` with default values

#### `public fun init_game_with_display<T>(publisher: &Publisher, ctx: &mut TxContext)`
- **Action:** Creates `Display<Pokemon>` object for wallet/explorer rendering, then calls `init_game<T>`

---

### Core Game Logic

#### `public fun purchase_pokeballs<T>(...)`
```move
public fun purchase_pokeballs<T>(
    config: &mut GameConfig<T>,
    payment: Coin<T>,
    quantity: u64,
    ctx: &mut TxContext,
)
```
- Deducts `price × quantity` from payment
- Refunds change (or destroys zero coin)
- Creates and transfers `quantity` Pokeball objects
- Emits `PokeballsPurchased`
- **Aborts:** `EInvalidPayment` if underpaid

#### `entry fun purchase_and_catch_pokemon<T>(...)`
```move
entry fun purchase_and_catch_pokemon<T>(
    config: &mut GameConfig<T>,
    payment: Coin<T>,
    quantity: u64,
    r: &Random,
    ctx: &mut TxContext,
)
```
- Atomic: purchase + catch in one transaction
- Requires `Random` shared object for on-chain randomness
- **Entry-only** to prevent randomness inspection attacks

#### `entry fun catch_pokemon<T>(pokeball, config, r, ctx)`
- Uses a single Pokeball to catch one Pokemon

#### `entry fun catch_pokemons<T>(pokeballs, config, r, ctx)`
- Batch: uses a vector of Pokeballs to catch multiple Pokemon in one call

---

### Internal Catch Logic

`fun catch_pokemon_internal<T>(...)` — shared implementation:

1. Retrieves (or initializes) per-player pity counter from `GameConfig` dynamic fields
2. For each Pokeball:
   - Consumes the Pokeball (deletes the object)
   - **Pity check:** If counter ≥ 29, forces Legendary and resets counter
   - **Random roll:** Otherwise, rolls 0–99 against cumulative weight thresholds
   - Generates level and 6 stats within rarity-appropriate ranges
   - Selects a random Pokemon ID from the rarity pool
   - Builds sprite URL from PokeAPI
   - Creates + transfers the `Pokemon` NFT
   - Emits `PokemonCaught` event
3. Persists updated pity counter

---

### Utility Functions

| Function | Signature | Returns |
|----------|-----------|---------|
| `get_item_stats` | `(pokemon: &Pokemon)` | `(name, rarity_tier, level)` |
| `get_pokemon_stats` | `(pokemon: &Pokemon)` | `(hp, attack, defense, sp_attack, sp_defense, speed)` |
| `transfer_pokemon` | `(pokemon, recipient, ctx)` | Updates `last_sender`, transfers to recipient |
| `burn_pokemon` | `(pokemon: Pokemon)` | Permanently destroys the NFT |

---

### Admin Functions

#### `public fun update_weights<T>(...)`
```move
public fun update_weights<T>(
    config: &mut GameConfig<T>,
    _cap: &AdminCap,
    common: u8, rare: u8, epic: u8, legendary: u8,
)
```
- Requires `AdminCap`
- **Aborts:** `ERarityWeightsTotal` if sum ≠ 100

#### `public fun withdraw_treasury<T>(...)`
```move
public fun withdraw_treasury<T>(
    config: &mut GameConfig<T>,
    _cap: &AdminCap,
    amount: u64,
    ctx: &mut TxContext,
)
```
- Withdraws `amount` from treasury, transfers coin to caller
- Requires `AdminCap`

---

### Test-Only

#### `public fun set_pity_for_testing<T>(config, player, pity)`
- Sets/creates the pity counter for a player (only available in `#[test_only]` context)

---

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Randomness inspection | `entry` functions prevent intermediate inspection of `Random` |
| Unauthorized admin ops | All admin functions require `AdminCap` ownership |
| Payment manipulation | `assert!` checks exact payment before processing |
| Pity counter tampering | Stored as dynamic fields on shared `GameConfig` — only modifiable by contract logic |

---

## Pokemon Pools

| Tier | Count | Example Pokemon |
|------|-------|-----------------|
| Common | 68 | Pikachu, Zubat, Geodude, Magikarp |
| Rare | 54 | Raichu, Arcanine, Gengar, Gyarados |
| Epic | 24 | Bulbasaur–Blastoise, Eevee, Snorlax, Dragonite |
| Legendary | 5 | Articuno, Zapdos, Moltres, Mewtwo, Mew |
