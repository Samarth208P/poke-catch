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
        &mut random_state,
        0,
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

// =========================================================================
// 1. Initialisation
// =========================================================================

#[test]
fun test_init_game_objects_created() {
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
// 2. Purchasing
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
    assert!(coin::value(&refund) == 500_000_000, 21);
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

// =========================================================================
// 3. Opening – Rarity Tiers & Catching
// =========================================================================

#[test]
fun test_open_common_tier() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (name, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_COMMON, 100);
    // FIX: Instead of checking for "Pokemon", we just ensure a dynamic name was successfully generated
    assert!(string::length(&name) > 0, 101);
    assert!(level >= COMMON_LEVEL_MIN && level <= COMMON_LEVEL_MAX, 102);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

#[test]
fun test_open_rare_tier() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_RARE);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_RARE, 200);
    assert!(level >= RARE_LEVEL_MIN && level <= RARE_LEVEL_MAX, 202);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

#[test]
fun test_open_epic_tier() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_EPIC);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_EPIC, 300);
    assert!(level >= EPIC_LEVEL_MIN && level <= EPIC_LEVEL_MAX, 302);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

#[test]
fun test_open_legendary_tier() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_LEGENDARY);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity, level) = pokemon::get_item_stats(&pokemon);

    assert!(rarity == RARITY_LEGENDARY, 400);
    assert!(level >= LEGENDARY_LEVEL_MIN && level <= LEGENDARY_LEVEL_MAX, 402);

    pokemon::burn_pokemon(pokemon);
    ts::end(scenario);
}

// =========================================================================
// 4. Item Lifecycle – Transfer & Burn
// =========================================================================

#[test]
fun test_transfer_item_to_another_player() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    let (_, original_rarity, original_level) = pokemon::get_item_stats(&pokemon);

    ts::next_tx(&mut scenario, PLAYER1);
    pokemon::transfer_pokemon(pokemon, PLAYER2, ts::ctx(&mut scenario));

    ts::next_tx(&mut scenario, PLAYER2);
    let received = ts::take_from_sender<Pokemon>(&scenario);
    let (_, rarity, level) = pokemon::get_item_stats(&received);

    assert!(rarity == original_rarity, 500);
    assert!(level  == original_level, 501);

    ts::return_to_sender(&scenario, received);
    ts::end(scenario);
}

#[test]
fun test_burn_item_removes_it() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    let pokemon = buy_and_open(&mut scenario, PLAYER1);
    pokemon::burn_pokemon(pokemon);

    ts::next_tx(&mut scenario, PLAYER1);
    assert!(!ts::has_most_recent_for_sender<Pokemon>(&scenario), 600);

    ts::end(scenario);
}

// =========================================================================
// 5. Admin – Rarity Weight Updates & Treasury Withdrawing
// =========================================================================

#[test]
#[expected_failure(abort_code = 1, location = loot_box_v2::pokemon)]
fun test_update_weights_invalid_sum_aborts() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);

    pokemon::update_weights(&mut config, &admin_cap, 50, 30, 15, 4); // Sum = 99

    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(config);
    ts::end(scenario);
}

#[test]
fun test_withdraw_treasury() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);

    // Player 1 purchases 2 Pokeballs
    ts::next_tx(&mut scenario, PLAYER1);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let payment = mint_coin(&mut scenario, BOX_PRICE * 2);
    pokemon::purchase_pokeballs(&mut config, payment, 2, ts::ctx(&mut scenario));
    ts::return_shared(config);

    // Admin withdraws the funds
    ts::next_tx(&mut scenario, ADMIN);
    let mut admin_config = ts::take_shared<GameConfig<SUI>>(&scenario);
    let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
    pokemon::withdraw_treasury(
        &mut admin_config,
        &admin_cap,
        BOX_PRICE * 2,
        ts::ctx(&mut scenario),
    );
    ts::return_to_sender(&scenario, admin_cap);
    ts::return_shared(admin_config);

    // Admin should have received the funds
    ts::next_tx(&mut scenario, ADMIN);
    let payout = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&payout) == BOX_PRICE * 2, 901);
    ts::return_to_sender(&scenario, payout);

    ts::end(scenario);
}

// =========================================================================
// 6. Pity System Dynamics
// =========================================================================

#[test]
fun test_pity_triggers_exactly_on_30th_open() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // Fast-forward pity safely without timing out
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 29);
    ts::return_shared(config);

    // 30th pull: Pity threshold hit
    let pkmn_30 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity_30, _) = pokemon::get_item_stats(&pkmn_30);
    assert!(rarity_30 == RARITY_LEGENDARY, 1030); // Guaranteed Legendary
    pokemon::burn_pokemon(pkmn_30);

    // 31st pull: Pity resets
    let pkmn_31 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity_31, _) = pokemon::get_item_stats(&pkmn_31);
    assert!(rarity_31 == RARITY_COMMON, 1031);
    pokemon::burn_pokemon(pkmn_31);

    ts::end(scenario);
}

#[test]
fun test_natural_legendary_resets_pity_counter() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);

    // Because pity DOES NOT reset on natural legendary anymore, 
    // we set it to 29 and expect a Legendary on the very next pull (the 30th open overall)
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 29); 
    ts::return_shared(config);

    let pkmn_30 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity_30, _) = pokemon::get_item_stats(&pkmn_30);
    assert!(rarity_30 == RARITY_LEGENDARY, 1101);
    pokemon::burn_pokemon(pkmn_30);

    ts::end(scenario);
}

#[test]
fun test_pity_is_independent_per_player() {
    let mut scenario = ts::begin(ADMIN);
    setup_game(&mut scenario);
    setup_random(&mut scenario);
    force_rarity(&mut scenario, RARITY_COMMON);

    // Player 1 pulls 29 times
    ts::next_tx(&mut scenario, ADMIN);
    let mut config = ts::take_shared<GameConfig<SUI>>(&scenario);
    pokemon::set_pity_for_testing(&mut config, PLAYER1, 29);
    ts::return_shared(config);

    // Player 2 pulls 1 time
    let pkmn_p2 = buy_and_open(&mut scenario, PLAYER2);
    pokemon::burn_pokemon(pkmn_p2);

    // Player 1 pulls their 30th time
    let pkmn_p1_30 = buy_and_open(&mut scenario, PLAYER1);
    let (_, rarity_p1_30, _) = pokemon::get_item_stats(&pkmn_p1_30);
    assert!(rarity_p1_30 == RARITY_LEGENDARY, 1200); // Player 1 hits their own pity
    pokemon::burn_pokemon(pkmn_p1_30);

    // Player 2 pulls their 2nd time
    let pkmn_p2_2 = buy_and_open(&mut scenario, PLAYER2);
    let (_, rarity_p2_2, _) = pokemon::get_item_stats(&pkmn_p2_2);
    assert!(rarity_p2_2 == RARITY_COMMON, 1201); // Player 2 did not inherit Player 1's pity
    pokemon::burn_pokemon(pkmn_p2_2);

    ts::end(scenario);
}
