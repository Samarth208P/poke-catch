<div align="center">
  <img src="frontend/public/pokecatch.png" alt="PokeCatch Logo" width="300" />
</div>

# 🎮 PokeCatch — Sui-Powered Pokemon Loot Box Game

[![Live Demo](https://img.shields.io/badge/demo-live-green?style=for-the-badge)](https://pokecatch.vercel.app/)
[![Sui Blockchain](https://img.shields.io/badge/Built%20on-Sui-blue?style=for-the-badge)](https://sui.io/)

A decentralized Pokemon loot box system on the **Sui Blockchain**. Players purchase Pokeballs, open them to catch Pokemon NFTs with randomized rarity, stats, and levels — all determined by Sui's native on-chain randomness.

---

## ✨ Core Features

- **On-Chain Randomness** — Every catch uses `sui::random` for tamper-proof, verifiable outcomes
- **4-Tier Rarity System** — Common (60%), Rare (25%), Epic (12%), Legendary (3%)
- **151 Gen-1 Pokemon** — Distributed across rarity pools (68 Common, 54 Rare, 24 Epic, 5 Legendary)
- **Pity System** — After 29 consecutive non-Legendary catches, the 30th is guaranteed Legendary
- **Randomized Stats** — Each Pokemon gets unique HP, Attack, Defense, Sp.Atk, Sp.Def, Speed within rarity-specific ranges
- **Transferable NFTs** — Trade Pokemon between trainers on-chain
- **Atomic Transactions** — Purchase + catch in a single secure operation
- **Admin Controls** — Configurable rarity weights and treasury withdrawal

---

## 🛠️ Smart Contract

**Module:** `loot_box_v2::pokemon` (`sources/pokemon_game.move`)

### Key Functions

| Function | Description |
|----------|-------------|
| `purchase_pokeballs` | Buy Pokeballs with SUI (0.01 SUI each) |
| `purchase_and_catch_pokemon` | Atomic buy + catch in one transaction |
| `catch_pokemon` / `catch_pokemons` | Use Pokeball(s) to catch Pokemon (single or batch) |
| `transfer_pokemon` | Send a Pokemon to another trainer |
| `burn_pokemon` | Permanently destroy a Pokemon NFT |
| `update_weights` | Admin: adjust rarity probabilities (must sum to 100) |
| `withdraw_treasury` | Admin: withdraw accumulated SUI from treasury |

### Rarity & Stats

| Tier | Level Range | Stat Range | Pool Size |
|------|-------------|------------|-----------|
| Common | 1–10 | 20–50 | 68 Pokemon |
| Rare | 11–25 | 50–75 | 54 Pokemon |
| Epic | 26–40 | 75–100 | 24 Pokemon |
| Legendary | 41–50 | 90–151 | 5 Pokemon |

Within each tier, every Pokemon is equally likely to appear.

### Security

- `entry` functions prevent randomness inspection attacks
- `AdminCap` required for all admin operations
- Payment assertions prevent underpayment exploits
- Per-player pity counters stored as dynamic fields on shared `GameConfig`

---

## 🧪 Test Suite

**33 tests, 100% branch coverage** (`tests/pokemon_test.move`)

```bash
sui move test
# Test result: OK. Total tests: 33; passed: 33; failed: 0
```

Coverage includes: initialization, purchasing (exact/overpay/underpay/bulk), all 4 rarity tiers with stat validation, batch catching, atomic purchase-and-catch, transfer, burn, admin weight updates, treasury operations, and pity system edge cases.

---

## 📁 Project Structure

```
loot-box-system/
├── sources/
│   └── pokemon_game.move    # Smart contract
├── tests/
│   └── pokemon_test.move    # Full test suite (33 tests)
├── frontend/                # React + Vite + Sui dApp Kit
├── documentation/           # Contract & test docs
└── Move.toml                # Package config
```

---

## 🚀 Getting Started

### Prerequisites
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install)
- [Node.js & npm](https://nodejs.org/)

### Setup

```bash
# Clone
git clone https://gitlab.alkimi.org/samarth/pokecatch.git
cd pokecatch

# Deploy contract
sui client publish --gas-budget 100000000

# Run tests
sui move test

# Start frontend
cd frontend && npm install && npm run dev
```

---

## 🏆 Alkimi Hackathon

Built for **Alkimi Hackathon — Problem Statement #2 (Gaming)**. Demonstrates on-chain randomness, secure NFT minting, and premium dApp UX on Sui.

**Live:** [pokecatch.vercel.app](https://pokecatch.vercel.app/)

---

**Built with ❤️ by the PokeCatch Team**
