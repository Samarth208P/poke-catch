#[test_only]
module loot_box_v2::pokemon_tests;

use loot_box_v2::pokemon::{Self, GameConfig, AdminCap, Pokeball, Pokemon};
use std::string;
use sui::coin::{Self, Coin};
use sui::random::{Self, Random};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};

// =========================================================================
// Constants
// =========================================================================

const ADMIN: address = @0xAD;
const PLAYER1: address = @0x01;
const PLAYER2: address = @0x02;
const PLAYER3: address = @0x03;

const BOX_PRICE: u64 = 10_000_000;

const RARITY_COMMON: u8 = 1;
const RARITY_RARE: u8 = 2;
const RARITY_EPIC: u8 = 3;
const RARITY_LEGENDARY: u8 = 4;

const COMMON_LEVEL_MIN: u8 = 1;
const COMMON_LEVEL_MAX: u8 = 10;
const RARE_LEVEL_MIN: u8 = 11;
const RARE_LEVEL_MAX: u8 = 25;
const EPIC_LEVEL_MIN: u8 = 26;
const EPIC_LEVEL_MAX: u8 = 40;
const LEGENDARY_LEVEL_MIN: u8 = 41;
const LEGENDARY_LEVEL_MAX: u8 = 50;

const COMMON_STAT_MIN: u8 = 20;
const COMMON_STAT_MAX: u8 = 50;
const RARE_STAT_MIN: u8 = 50;
const RARE_STAT_MAX: u8 = 75;
const EPIC_STAT_MIN: u8 = 75;
const EPIC_STAT_MAX: u8 = 100;
const LEGENDARY_STAT_MIN: u8 = 90;
const LEGENDARY_STAT_MAX: u8 = 151;

// =========================================================================
// Helpers
// =========================================================================

fun setup_game(scenario: &mut Scenario) {
    ts::next_tx(scenario, ADMIN);
    pokemon::init_game<SUI>(ts::ctx(scenario));
}

fun mint_coin(scenario: &mut Scenario, amount: u64): Coin<SUI> {
    coin::mint_for_testing<SUI>(amount, ts::ctx(scenario))
}

fun setup_random(scenario: &mut Scenario) {
    ts::next_tx(scenario, @0x0);
    random::create_for_testing(ts::ctx(scenario));
    ts::next_tx(scenario, @0x0);
    let mut random_state = ts::take_shared<Random>(scenario);
    random::update_randomness_state_for_testing(
        &mut random_state, 0,
        b"01234567890123456789012345678901",
        ts::ctx(scenario),
    );
    ts::return_shared(random_state);
}

fun force_rarity(scenario: &mut Scenario, tier: u8) {
    ts::next_tx(scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(scenario);
    if (tier == RARITY_COMMON) {
        pokemon::update_weights(&mut config, &admin_cap, 100, 0, 0, 0);
    } else if (tier == RARITY_RARE) {
        pokemon::update_weights(&mut config, &admin_cap, 0, 100, 0, 0);
    } else if (tier == RARITY_EPIC) {
        pokemon::update_weights(&mut config, &admin_cap, 0, 0, 100, 0);
    } else {
        pokemon::update_weights(&mut config, &admin_cap, 0, 0, 0, 100);
    };
    ts::return_to_sender(scenario, admin_cap);
    ts::return_shared(config);
}

fun buy_box(scenario: &mut Scenario, player: address) {
    ts::next_tx(scenario, player);
    let mut config = ts::take_shared<GameConfig<SUI>>(scenario);
    let payment = mint_coin(scenario, BOX_PRICE);
    pokemon::purchase_pokeballs(&mut config, payment, 1, ts::ctx(scenario));
    ts::return_shared(config);
}

fun open_box(scenario: &mut Scenario, player: address) {
    ts::next_tx(scenario, player);
    let mut config = ts::take_shared<GameConfig<SUI>>(scenario);
    let random_state = ts::take_shared<Random>(scenario);
    let pokeball = ts::take_from_sender<Pokeball>(scenario);
    pokemon::catch_pokemon(pokeball, &mut config, &random_state, ts::ctx(scenario));
    ts::return_shared(config);
    ts::return_shared(random_state);
}

fun buy_and_open(scenario: &mut Scenario, player: address): Pokemon {
    buy_box(scenario, player);
    open_box(scenario, player);
    ts::next_tx(scenario, player);
    ts::take_from_sender<Pokemon>(scenario)
}

/// Validates that all 6 stats fall within [min, max].
fun assert_stats_in_range(pokemon: &Pokemon, stat_min: u8, stat_max: u8) {
    let (hp, attack, defense, sp_attack, sp_defense, speed) = pokemon::get_pokemon_stats(pokemon);
    assert!(hp >= stat_min && hp <= stat_max);
    assert!(attack >= stat_min && attack <= stat_max);
    assert!(defense >= stat_min && defense <= stat_max);
    assert!(sp_attack >= stat_min && sp_attack <= stat_max);
    assert!(sp_defense >= stat_min && sp_defense <= stat_max);
    assert!(speed >= stat_min && speed <= stat_max);
}

// =========================================================================
// 1. Initialization
// =========================================================================

#[test]
fun test_init_game_creates_admin_cap_and_config() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
    let config = ts::take_shared<GameConfig<SUI>>(&scenario);

    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(config);
    ts::end(scenario);
}

// =========================================================================
// 2. Purchasing Pokeballs
// =========================================================================

#[test]
fun test_purchase_exact_payment() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE);
    pokemon::purchase_pokeballs(&mut config, payment, 1, ts::ctx(&mut scenario));
    ts::return_shared(config);

    ts::next_tx(&mut scenario, PLAYER1);
    let pokeball = ts::take_from_sender<Pokeball>(&scenario);
    ts::return_to_sender(&scenario, pokeball);
    ts::end(scenario);
}

#[test]
fun test_purchase_overpayment_refunded() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    let overpay = BOX_PRICE + 500_000_000;
    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, overpay);
    pokemon::purchase_pokeballs(&mut config, payment, 1, ts::ctx(&mut scenario));
    ts::return_shared(config);

    ts::next_tx(&mut scenario, PLAYER1);
    let refund = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&refund) == 500_000_000);
    ts::return_to_sender(&scenario, refund);
    let pokeball = ts::take_from_sender<Pokeball>(&scenario);
    ts::return_to_sender(&scenario, pokeball);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 0, location = loot_box_v2::pokemon)]
fun test_purchase_insufficient_payment_aborts() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE - 1);
    pokemon::purchase_pokeballs(&mut config, payment, 1, ts::ctx(&mut scenario));

    ts::return_shared(config);
    ts::end(scenario);
}

#[test]
fun test_purchase_multiple_pokeballs_bulk() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 3);
    pokemon::purchase_pokeballs(&mut config, payment, 3, ts::ctx(&mut scenario));
    ts::return_shared(config);

    // Verify all 3 pokeballs were received
    ts::next_tx(&mut scenario, PLAYER1);
    let pb1 = ts::take_from_sender<Pokeball>(&scenario);
    let pb2 = ts::take_from_sender<Pokeball>(&scenario);
    let pb3 = ts::take_from_sender<Pokeball>(&scenario);
    ts::return_to_sender(&scenario, pb1);
    ts::return_to_sender(&scenario, pb2);
    ts::return_to_sender(&scenario, pb3);
    ts::end(scenario);
}

#[test]
fun test_purchase_bulk_with_overpayment() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 2 + 1_000_000);
    pokemon::purchase_pokeballs(&mut config, payment, 2, ts::ctx(&mut scenario));
    ts::return_shared(config);

    ts::next_tx(&mut scenario, PLAYER1);
    let refund = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&refund) == 1_000_000);
    ts::return_to_sender(&scenario, refund);
    let pb1 = ts::take_from_sender<Pokeball>(&scenario);
    let pb2 = ts::take_from_sender<Pokeball>(&scenario);
    ts::return_to_sender(&scenario, pb1);
    ts::return_to_sender(&scenario, pb2);
    ts::end(scenario);
}

// =========================================================================
// 3. Opening – All 4 Rarity Tiers with Level and Stat Validation
// =========================================================================

#[test]
fun test_open_common_tier_with_stats() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (name, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_COMMON);
    assert!(string::length(&name) > 0);
    assert!(level >= COMMON_LEVEL_MIN && level <= COMMON_LEVEL_MAX);
    assert_stats_in_range(&pokemon, COMMON_STAT_MIN, COMMON_STAT_MAX);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

#[test]
fun test_open_rare_tier_with_stats() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_RARE);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_RARE);
    assert!(level >= RARE_LEVEL_MIN && level <= RARE_LEVEL_MAX);
    assert_stats_in_range(&pokemon, RARE_STAT_MIN, RARE_STAT_MAX);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

#[test]
fun test_open_epic_tier_with_stats() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_EPIC);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_EPIC);
    assert!(level >= EPIC_LEVEL_MIN && level <= EPIC_LEVEL_MAX);
    assert_stats_in_range(&pokemon, EPIC_STAT_MIN, EPIC_STAT_MAX);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

#[test]
fun test_open_legendary_tier_with_stats() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_LEGENDARY);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_LEGENDARY);
    assert!(level >= LEGENDARY_LEVEL_MIN && level <= LEGENDARY_LEVEL_MAX);
    assert_stats_in_range(&pokemon, LEGENDARY_STAT_MIN, LEGENDARY_STAT_MAX);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

// =========================================================================
// 4. Batch Catching (catch_pokemons entry function)
// =========================================================================

#[test]
fun test_catch_pokemons_batch() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // Purchase 3 pokeballs individually
    buy_box(&mut scenario, PLAYER1);
    buy_box(&mut scenario, PLAYER1);
    buy_box(&mut scenario, PLAYER1);

    // Collect all 3 into a vector and batch catch
    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let random_state = ts::take_shared<Random>(&scenario);
    let pb1 = ts::take_from_sender<Pokeball>(&scenario);
    let pb2 = ts::take_from_sender<Pokeball>(&scenario);
    let pb3 = ts::take_from_sender<Pokeball>(&scenario);
    let mut pokeballs = vector::empty<Pokeball>();
    vector::push_back(&mut pokeballs, pb1);
    vector::push_back(&mut pokeballs, pb2);
    vector::push_back(&mut pokeballs, pb3);

    pokemon::catch_pokemons(pokeballs, &mut config, &random_state, ts::ctx(&mut scenario));

    ts::return_shared(config);
    ts::return_shared(random_state);

    // Should have 3 pokemon now
    ts::next_tx(&mut scenario, PLAYER1);
    let p1 = ts::take_from_sender<Pokemon>(&scenario);
    let p2 = ts::take_from_sender<Pokemon>(&scenario);
    let p3 = ts::take_from_sender<Pokemon>(&scenario);
    pokemon::burn_pokemon(p1);
    pokemon::burn_pokemon(p2);
    pokemon::burn_pokemon(p3);
    ts::end(scenario);
}

// =========================================================================
// 5. Atomic Purchase and Catch
// =========================================================================

#[test]
fun test_purchase_and_catch_pokemon_exact_payment() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_RARE);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let random_state = ts::take_shared<Random>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 2);

    pokemon::purchase_and_catch_pokemon(
        &mut config, payment, 2, &random_state, ts::ctx(&mut scenario),
    );

    ts::return_shared(config);
    ts::return_shared(random_state);

    // Should have 2 pokemon, no refund (exact payment)
    ts::next_tx(&mut scenario, PLAYER1);
    let p1 = ts::take_from_sender<Pokemon>(&scenario);
    let p2 = ts::take_from_sender<Pokemon>(&scenario);
    let (_, r1, _) = pokemon::get_item_stats(&p1);
    let (_, r2, _) = pokemon::get_item_stats(&p2);
    assert!(r1 == RARITY_RARE);
    assert!(r2 == RARITY_RARE);
    pokemon::burn_pokemon(p1);
    pokemon::burn_pokemon(p2);
    ts::end(scenario);
}

#[test]
fun test_purchase_and_catch_pokemon_with_overpayment() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let random_state = ts::take_shared<Random>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE + 5_000_000);

    pokemon::purchase_and_catch_pokemon(
        &mut config, payment, 1, &random_state, ts::ctx(&mut scenario),
    );

    ts::return_shared(config);
    ts::return_shared(random_state);

    ts::next_tx(&mut scenario, PLAYER1);
    let refund = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&refund) == 5_000_000);
    ts::return_to_sender(&scenario, refund);

    let p = ts::take_from_sender<Pokemon>(&scenario);
    pokemon::burn_pokemon(p);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 0, location = loot_box_v2::pokemon)]
fun test_purchase_and_catch_insufficient_payment_aborts() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let random_state = ts::take_shared<Random>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE - 1);

    pokemon::purchase_and_catch_pokemon(
        &mut config, payment, 1, &random_state, ts::ctx(&mut scenario),
    );

    ts::return_shared(config);
    ts::return_shared(random_state);
    ts::end(scenario);
}

// =========================================================================
// 6. Item Lifecycle – Transfer & Burn
// =========================================================================

#[test]
fun test_transfer_pokemon_preserves_stats() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, original_rarity, original_level) = pokemon::get_item_stats(&pokemon);
    let (ohp, oatk, odef, ospa, ospd, ospd2) = pokemon::get_pokemon_stats(&pokemon);

    ts::next_tx(&mut scenario, PLAYER1);
    pokemon::transfer_pokemon(pokemon, PLAYER2, ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, PLAYER2);
    let received = ts::take_from_sender<Pokemon>(&scenario);
    let (_, rarity, level) = pokemon::get_item_stats(&received);
    let (hp, atk, def, spa, spd, spd2) = pokemon::get_pokemon_stats(&received);

    assert!(rarity == original_rarity);
    assert!(level == original_level);
    assert!(hp == ohp && atk == oatk && def == odef);
    assert!(spa == ospa && spd == ospd && spd2 == ospd2);

    ts::return_to_sender(&scenario, received);
    ts::end(scenario);
}

#[test]
fun test_burn_removes_pokemon() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    pokemon::burn_pokemon(pokemon);

    ts::next_tx(&mut scenario, PLAYER1);
    assert!(!ts::has_most_recent_for_sender<Pokemon>(&scenario));
    ts::end(scenario);
}

#[test]
fun test_transfer_then_burn_by_recipient() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);

    ts::next_tx(&mut scenario, PLAYER1);
    pokemon::transfer_pokemon(pokemon, PLAYER2, ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, PLAYER2);
    let received = ts::take_from_sender<Pokemon>(&scenario);
    pokemon::burn_pokemon(received);

    ts::next_tx(&mut scenario, PLAYER2);
    assert!(!ts::has_most_recent_for_sender<Pokemon>(&scenario));
    ts::end(scenario);
}

// =========================================================================
// 7. Admin – Weights & Treasury
// =========================================================================

#[test]
fun test_update_weights_valid() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);

    pokemon::update_weights(&mut config, &admin_cap, 40, 30, 20, 10);

    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(config);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 1, location = loot_box_v2::pokemon)]
fun test_update_weights_invalid_sum_aborts() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
    pokemon::update_weights(&mut config, &admin_cap, 50, 30, 15, 4);

    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(config);
    ts::end(scenario);
}

#[test]
fun test_withdraw_full_treasury() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 2);
    pokemon::purchase_pokeballs(&mut config, payment, 2, ts::ctx(&mut scenario));
    ts::return_shared(config);

    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
    pokemon::withdraw_treasury(&mut config, &admin_cap, BOX_PRICE * 2, ts::ctx(&mut scenario));
    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(config);

    ts::next_tx(&mut scenario, ADMIN);
    let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&payout) == BOX_PRICE * 2);
    ts::return_to_sender(&scenario, payout);
    ts::end(scenario);
}

#[test]
fun test_withdraw_partial_treasury() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 5);
    pokemon::purchase_pokeballs(&mut config, payment, 5, ts::ctx(&mut scenario));
    ts::return_shared(config);

    // Withdraw only 2 boxes' worth
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
    pokemon::withdraw_treasury(&mut config, &admin_cap, BOX_PRICE * 2, ts::ctx(&mut scenario));
    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(config);

    ts::next_tx(&mut scenario, ADMIN);
    let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&payout) == BOX_PRICE * 2);
    ts::return_to_sender(&scenario, payout);
    ts::end(scenario);
}

#[test]
fun test_treasury_accumulates_across_players() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    // Player 1 buys 2
    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 2);
    pokemon::purchase_pokeballs(&mut config, payment, 2, ts::ctx(&mut scenario));
    ts::return_shared(config);

    // Player 2 buys 3
    ts::next_tx(&mut scenario, PLAYER2);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 3);
    pokemon::purchase_pokeballs(&mut config, payment, 3, ts::ctx(&mut scenario));
    ts::return_shared(config);

    // Withdraw total = 5 * BOX_PRICE
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
    pokemon::withdraw_treasury(&mut config, &admin_cap, BOX_PRICE * 5, ts::ctx(&mut scenario));
    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(config);

    ts::next_tx(&mut scenario, ADMIN);
    let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&payout) == BOX_PRICE * 5);
    ts::return_to_sender(&scenario, payout);
    ts::end(scenario);
}

// =========================================================================
// 8. Pity System
// =========================================================================

#[test]
fun test_pity_triggers_on_30th_open() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 29);
    ts::return_shared(config);

    // 30th pull: pity threshold hit
    let pkmn_30 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity_30, _) = pokemon::get_item_stats(&pkmn_30);
    assert!(rarity_30 == RARITY_LEGENDARY);
    pokemon::burn_pokemon(pkmn_30);

    // 31st pull: pity resets, should be common (weights forced)
    let pkmn_31 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity_31, _) = pokemon::get_item_stats(&pkmn_31);
    assert!(rarity_31 == RARITY_COMMON);
    pokemon::burn_pokemon(pkmn_31);
    ts::end(scenario);
}

#[test]
fun test_natural_legendary_resets_pity() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    // Force legendary via pity at 29
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 29);
    ts::return_shared(config);

    let pkmn = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, _) = pokemon::get_item_stats(&pkmn);
    assert!(rarity == RARITY_LEGENDARY);
    pokemon::burn_pokemon(pkmn);
    ts::end(scenario);
}

#[test]
fun test_pity_independent_per_player() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // Give Player1 high pity
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 29);
    ts::return_shared(config);

    // Player 2 catches — fresh pity
    let pkmn_p2 = buy_and_open(&mut scenario, PLAYER2);
    let (_, r2, _) = pokemon::get_item_stats(&pkmn_p2);
    assert!(r2 == RARITY_COMMON);
    pokemon::burn_pokemon(pkmn_p2);

    // Player 1 hits pity
    let pkmn_p1 = buy_and_open(&mut scenario, PLAYER1);
    let (_, r1, _) = pokemon::get_item_stats(&pkmn_p1);
    assert!(r1 == RARITY_LEGENDARY);
    pokemon::burn_pokemon(pkmn_p1);

    // Player 2 second pull — still common
    let pkmn_p2_b = buy_and_open(&mut scenario, PLAYER2);
    let (_, r2b, _) = pokemon::get_item_stats(&pkmn_p2_b);
    assert!(r2b == RARITY_COMMON);
    pokemon::burn_pokemon(pkmn_p2_b);
    ts::end(scenario);
}

#[test]
fun test_pity_below_threshold_no_legendary() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // Set pity to 28 (one below threshold - 1)
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 28);
    ts::return_shared(config);

    let pkmn = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, _) = pokemon::get_item_stats(&pkmn);
    assert!(rarity == RARITY_COMMON); // Not yet at pity threshold
    pokemon::burn_pokemon(pkmn);
    ts::end(scenario);
}

#[test]
fun test_pity_first_catch_creates_dynamic_field() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // Player3 has never caught before — no dynamic field exists
    let pkmn = buy_and_open(&mut scenario, PLAYER3);
    let (_, rarity, _) = pokemon::get_item_stats(&pkmn);
    assert!(rarity == RARITY_COMMON);
    pokemon::burn_pokemon(pkmn);

    // Second catch — dynamic field now exists and gets updated
    let pkmn2 = buy_and_open(&mut scenario, PLAYER3);
    pokemon::burn_pokemon(pkmn2);
    ts::end(scenario);
}

// =========================================================================
// 9. get_pokemon_stats Accessor
// =========================================================================

#[test]
fun test_get_pokemon_stats_returns_six_values() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (hp, atk, def, spa, spd, spe) = pokemon::get_pokemon_stats(&pokemon);

    // All stats should be > 0 (minimum for common is 20)
    assert!(hp > 0 && atk > 0 && def > 0 && spa > 0 && spd > 0 && spe > 0);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

// =========================================================================
// 10. Weights Applied Correctly After Update
// =========================================================================

#[test]
fun test_updated_weights_affect_rarity_output() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    // Set 100% epic
    force_rarity(&mut scenario, RARITY_EPIC);

    let pkmn = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, _) = pokemon::get_item_stats(&pkmn);
    assert!(rarity == RARITY_EPIC);
    pokemon::burn_pokemon(pkmn);

    // Now switch to 100% legendary
    force_rarity(&mut scenario, RARITY_LEGENDARY);

    let pkmn2 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity2, _) = pokemon::get_item_stats(&pkmn2);
    assert!(rarity2 == RARITY_LEGENDARY);
    pokemon::burn_pokemon(pkmn2);
    ts::end(scenario);
}

// =========================================================================
// 11. Edge Cases
// =========================================================================

#[test]
fun test_purchase_and_catch_single() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let random_state = ts::take_shared<Random>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE);

    pokemon::purchase_and_catch_pokemon(
        &mut config, payment, 1, &random_state, ts::ctx(&mut scenario),
    );

    ts::return_shared(config);
    ts::return_shared(random_state);

    ts::next_tx(&mut scenario, PLAYER1);
    let p = ts::take_from_sender<Pokemon>(&scenario);
    let (name, _, _) = pokemon::get_item_stats(&p);
    assert!(string::length(&name) > 0);
    pokemon::burn_pokemon(p);
    ts::end(scenario);
}

#[test]
fun test_multiple_players_purchase_and_catch() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    // Player 1
    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let random_state = ts::take_shared<Random>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE);
    pokemon::purchase_and_catch_pokemon(
        &mut config, payment, 1, &random_state, ts::ctx(&mut scenario),
    );
    ts::return_shared(config);
    ts::return_shared(random_state);

    // Player 2
    ts::next_tx(&mut scenario, PLAYER2);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let random_state = ts::take_shared<Random>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE);
    pokemon::purchase_and_catch_pokemon(
        &mut config, payment, 1, &random_state, ts::ctx(&mut scenario),
    );
    ts::return_shared(config);
    ts::return_shared(random_state);

    // Both should have pokemon
    ts::next_tx(&mut scenario, PLAYER1);
    let p1 = ts::take_from_sender<Pokemon>(&scenario);
    pokemon::burn_pokemon(p1);

    ts::next_tx(&mut scenario, PLAYER2);
    let p2 = ts::take_from_sender<Pokemon>(&scenario);
    pokemon::burn_pokemon(p2);
    ts::end(scenario);
}

#[test]
fun test_set_pity_updates_existing_field() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // First catch creates pity dynamic field
    let pkmn = buy_and_open(&mut scenario, PLAYER1);
    pokemon::burn_pokemon(pkmn);

    // Now use set_pity to update the existing field
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 29);
    ts::return_shared(config);

    // Should trigger pity
    let pkmn2 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, _) = pokemon::get_item_stats(&pkmn2);
    assert!(rarity == RARITY_LEGENDARY);
    pokemon::burn_pokemon(pkmn2);
    ts::end(scenario);
}

#[test]
fun test_set_pity_creates_new_field() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // Player3 has never caught — set pity directly
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER3, 29);
    ts::return_shared(config);

    let pkmn = buy_and_open(&mut scenario, PLAYER3);
    let (_, rarity, _) = pokemon::get_item_stats(&pkmn);
    assert!(rarity == RARITY_LEGENDARY);
    pokemon::burn_pokemon(pkmn);
    ts::end(scenario);
}
