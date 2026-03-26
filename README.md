# 🎮 PokeCatch: Premium Sui-Powered Loot Box Game

[![Live Demo](https://img.shields.io/badge/demo-live-green?style=for-the-badge)](https://pokecatch.vercel.app/)
[![Sui Blockchain](https://img.shields.io/badge/Built%20on-Sui-blue?style=for-the-badge)](https://sui.io/)

PokeCatch is a decentralized Pokemon-themed loot box system built on the **Sui Blockchain**. It leverages Sui's native on-chain randomness to provide a fair, transparent, and exciting "catching" experience where every Pokemon is a unique NFT (Dynamic Object) with randomized stats and rarity tiers.

---

## 🚀 Live Deployment
Check out the live game here: **[https://pokecatch.vercel.app/](https://pokecatch.vercel.app/)**

---

## ✨ Features

### 1. On-Chain Randomness
Every Pokemon catch uses the `sui::random` module. This ensures that the rarity and stats (HP, Attack, Defense, etc.) are determined cryptographically on-chain, making them tamper-proof and verifiable.

### 2. Rarity & Stats System
- **Tiers**: Common, Rare, Epic, and Legendary.
- **Dynamic Stats**: Each Pokemon has a unique set of base stats generated at mint time.
- **Visual Excellence**: Premium pixel-art UI with horizontal friend carousels and detailed attribute badges.

### 3. Pity System (Guaranteed Rewards)
To ensure a fair experience, we've implemented a **Pity Counter**. If a trainer goes 30 encounters without a Legendary catch, the system guarantees a high-rarity encounter on the next attempt.

### 4. Trainer Social System (Friends)
- **Add Trainers**: Add friends via their Sui wallet address.
- **View PC Boxes**: Switch between your own collection and your friends' "PC Boxes" to see their caught Pokemon.
- **Quick Transfer**: Easily send your Pokemon NFTs to friends directly from the detailed view modal.

### 5. Immersive UI/UX
- **Retro Aesthetic**: Custom "Poke-Border" and pixelated design language.
- **Pokemon Cries**: Integrated audio for Pokemon cries when viewing details.
- **Detailed Modals**: Compact, non-scrolling card design for viewing Pokemon stats, rarity, and ownership history.

---

## 🛠️ Technical Architecture

### Smart Contract (Move)
The core logic resides in `sources/pokemon_game.move`:
- `purchase_loot_box`: Allows users to spend SUI to receive a random Pokemon.
- `open_loot_box`: The `entry` function that consumes the randomness beacon.
- `GameConfig`: A shared object managing the treasury and game parameters.
- `Pity System`: Tracked per-user to ensure fair distribution.

### Frontend (React + Vite + Sui DApp Kit)
- **Framework**: Vite + React + Tailwind CSS.
- **State Management**: `@mysten/dapp-kit` for wallet connections and blockchain queries.
- **Animations**: `framer-motion` for smooth UI transitions and "catch" animations.

---

## 📁 Project Structure

```text
LootBoxSystem/
├── sources/               # Sui Move Smart Contracts
│   └── pokemon_game.move  # Core Game Logic
├── tests/                 # Move Test Suite
├── frontend/              # React Web Application
│   ├── client/            # Main UI Components (PokemonGame.tsx, etc.)
│   ├── public/            # Static Assets (pokecatch.png)
│   └── vercel.json        # Deployment Configuration
└── README.md              # Project Documentation
```

---

## 📦 Getting Started

### Prerequisites
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install)
- [Node.js & npm/pnpm](https://nodejs.org/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://gitlab.alkimi.org/samarth/pokecatch.git
   cd pokecatch
   ```

2. **Deploy the Smart Contract**:
   ```bash
   sui client publish --gas-budget 100000000
   ```

3. **Setup Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🏆 Alkimi Hackathon
Created for the **Alkimi Hackathon - Problem Statement #2 (Gaming)**. This project demonstrates best practices in on-chain randomness, secure NFT minting, and premium dApp user experience on the Sui network.

---

**Built with ❤️ by the PokeCatch Team**
