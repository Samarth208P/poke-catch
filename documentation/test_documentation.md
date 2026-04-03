# Pokemon Loot Box Game — Test Documentation

> Comprehensive test suite for `loot_box_v2::pokemon` with **33 tests** covering all public/entry functions, error paths, and edge cases.

---

## Test File

```
tests/pokemon_test.move → module loot_box_v2::pokemon_tests
```

---

## Test Infrastructure

### Addresses

| Constant | Address | Role |
|----------|---------|------|
| `ADMIN` | `@0xAD` | Deploys contract, owns `AdminCap` |
| `PLAYER1` | `@0x01` | Primary test player |
| `PLAYER2` | `@0x02` | Secondary player (multi-player tests) |
| `PLAYER3` | `@0x03` | Fresh player (dynamic field creation tests) |

### Helper Functions

| Helper | Purpose |
|--------|---------|
| `setup_game()` | Initializes `GameConfig<SUI>` and `AdminCap` |
| `setup_random()` | Creates deterministic `Random` shared object for testing |
| `mint_coin()` | Mints SUI test coins of a given amount |
| `force_rarity()` | Sets weights to 100% for a single rarity tier |
| `buy_box()` | Purchases 1 Pokeball for a player |
| `open_box()` | Uses `catch_pokemon` to open 1 Pokeball |
| `buy_and_open()` | Buys + opens + returns the resulting `Pokemon` |
| `assert_stats_in_range()` | Validates all 6 stats fall within `[min, max]` |

---

## Test Coverage Matrix

### 1. Initialization (1 test)

| Test | Validates |
|------|-----------|
| `test_init_game_creates_admin_cap_and_config` | `AdminCap` is sent to deployer, `GameConfig<SUI>` is shared |

---

### 2. Purchasing Pokeballs (5 tests)

| Test | Validates |
|------|-----------|
| `test_purchase_exact_payment` | Exact SUI → 1 Pokeball received, no refund |
| `test_purchase_overpayment_refunded` | Overpay → Pokeball + correct change refunded |
| `test_purchase_insufficient_payment_aborts` | Underpay → aborts with `EInvalidPayment` (code 0) |
| `test_purchase_multiple_pokeballs_bulk` | Qty=3 → all 3 Pokeballs received |
| `test_purchase_bulk_with_overpayment` | Qty=2 + overpay → 2 balls + change |

**Branches covered:**
- ✅ `coin::value >= total_price` (pass)
- ✅ `coin::value < total_price` (abort)
- ✅ `coin::value > 0` after split (refund path)
- ✅ `coin::value == 0` after split (destroy_zero path)

---

### 3. Rarity Tiers — Level & Stat Validation (4 tests)

| Test | Rarity | Level Range | Stat Range |
|------|--------|-------------|------------|
| `test_open_common_tier_with_stats` | Common | 1–10 | 20–50 |
| `test_open_rare_tier_with_stats` | Rare | 11–25 | 50–75 |
| `test_open_epic_tier_with_stats` | Epic | 26–40 | 75–100 |
| `test_open_legendary_tier_with_stats` | Legendary | 41–50 | 90–151 |

**Each test validates:**
- ✅ Correct `rarity_tier` value
- ✅ `level` within rarity-specific range
- ✅ All 6 battle stats (`hp`, `attack`, `defense`, `sp_attack`, `sp_defense`, `speed`) within range
- ✅ Pokemon `name` is non-empty

---

### 4. Batch Catching — `catch_pokemons` (1 test)

| Test | Validates |
|------|-----------|
| `test_catch_pokemons_batch` | 3 Pokeballs in vector → 3 Pokemon received |

---

### 5. Atomic Purchase & Catch — `purchase_and_catch_pokemon` (5 tests)

| Test | Validates |
|------|-----------|
| `test_purchase_and_catch_pokemon_exact_payment` | Qty=2, exact pay → 2 Pokemon with correct rarity |
| `test_purchase_and_catch_pokemon_with_overpayment` | Overpay → Pokemon + refund |
| `test_purchase_and_catch_insufficient_payment_aborts` | Underpay → abort code 0 |
| `test_purchase_and_catch_single` | Qty=1 → 1 Pokemon with valid name |
| `test_multiple_players_purchase_and_catch` | 2 players each buy+catch independently |

**Branches covered:**
- ✅ Exact payment (destroy_zero path)
- ✅ Overpayment (refund path)
- ✅ Insufficient payment (abort path)

---

### 6. Item Lifecycle — Transfer & Burn (3 tests)

| Test | Validates |
|------|-----------|
| `test_transfer_pokemon_preserves_stats` | All stats preserved after transfer; `last_sender` updated |
| `test_burn_removes_pokemon` | Pokemon no longer exists after burn |
| `test_transfer_then_burn_by_recipient` | Recipient can burn a received Pokemon |

---

### 7. Admin — Weights & Treasury (6 tests)

| Test | Validates |
|------|-----------|
| `test_update_weights_valid` | Weights summing to 100 accepted |
| `test_update_weights_invalid_sum_aborts` | Sum ≠ 100 → abort code 1 (`ERarityWeightsTotal`) |
| `test_updated_weights_affect_rarity_output` | Changing from 100% Epic → 100% Legendary changes output |
| `test_withdraw_full_treasury` | Full withdrawal returns correct amount |
| `test_withdraw_partial_treasury` | Partial withdrawal returns requested amount |
| `test_treasury_accumulates_across_players` | Multiple players' payments accumulate correctly |

---

### 8. Pity System (7 tests)

| Test | Validates |
|------|-----------|
| `test_pity_triggers_on_30th_open` | Pity=29 → next catch is Legendary; pity resets (next = Common) |
| `test_natural_legendary_resets_pity` | Pity=29 → Legendary forced at threshold |
| `test_pity_independent_per_player` | Player1 pity=29 doesn't affect Player2 |
| `test_pity_below_threshold_no_legendary` | Pity=28 → still Common (threshold not reached) |
| `test_pity_first_catch_creates_dynamic_field` | First catch for new player creates the dynamic field |
| `test_set_pity_updates_existing_field` | `set_pity_for_testing` updates an existing pity field |
| `test_set_pity_creates_new_field` | `set_pity_for_testing` creates field for player who hasn't caught yet |

**Branches covered:**
- ✅ `pity >= PITY_THRESHOLD - 1` (pity trigger → Legendary)
- ✅ `pity < PITY_THRESHOLD - 1` (normal roll)
- ✅ `dynamic_field::exists_` = true (update path)
- ✅ `dynamic_field::exists_` = false (add path)

---

### 9. Accessor Functions (1 test)

| Test | Validates |
|------|-----------|
| `test_get_pokemon_stats_returns_six_values` | `get_pokemon_stats` returns 6 non-zero values |

> `get_item_stats` is exercised in every rarity and pity test.

---

## Branch Coverage Summary

| Function | Branches | Covered |
|----------|----------|---------|
| `purchase_pokeballs` | exact pay, overpay, underpay | ✅ All 3 |
| `purchase_and_catch_pokemon` | exact pay, overpay, underpay | ✅ All 3 |
| `catch_pokemon_internal` — rarity roll | Common, Rare, Epic, Legendary | ✅ All 4 |
| `catch_pokemon_internal` — pity | trigger, no-trigger | ✅ Both |
| `catch_pokemon_internal` — dynamic field | create, update | ✅ Both |
| `catch_pokemon_internal` — level ranges | 4 tiers | ✅ All 4 |
| `catch_pokemon_internal` — stat ranges | 4 tiers | ✅ All 4 |
| `catch_pokemon_internal` — pokemon pool | 4 tiers | ✅ All 4 |
| `update_weights` | valid, invalid sum | ✅ Both |
| `withdraw_treasury` | full, partial | ✅ Both |
| `transfer_pokemon` | transfer + verify | ✅ |
| `burn_pokemon` | burn + verify removed | ✅ |
| `set_pity_for_testing` | create, update | ✅ Both |

---

## Running Tests

```bash
# Run all tests
sui move test

# Run a specific test
sui move test test_pity_triggers_on_30th_open

# Run with verbose output
sui move test --verbose
```

**Expected output:**
```
Test result: OK. Total tests: 33; passed: 33; failed: 0
```
