#[allow(implicit_const_copy, lint(self_transfer))]

/// # Pokemon Loot Box Game Contract
///
/// A secure, on-chain loot box system built on Sui blockchain that implements
/// the Alkimi Hackathon Problem Statement #2: Gaming requirements.
///
/// ## Overview
/// Players purchase Pokeballs (loot boxes) and open them to catch Pokemon NFTs
/// with varying rarity tiers and power levels. The system uses Sui's native
/// on-chain randomness for fair, tamper-proof outcomes.
///
/// ## Key Features
/// - **Secure Randomness**: Uses `sui::random` with entry function protection
/// - **4-Tier Rarity System**: Common (60%), Rare (25%), Epic (12%), Legendary (3%)
/// - **Power-Based Levels**: Pokemon levels determine power (1-50 range)
/// - **Pity System**: Guarantees Legendary after 30 consecutive non-Legendary catches
/// - **Atomic Transactions**: Purchase and catch in single secure operations
/// - **Transferable NFTs**: Pokemon can be traded between players
/// - **Admin Controls**: Rarity weights and treasury management
///
/// ## Security Design
/// - Entry functions prevent randomness inspection attacks
/// - RandomGenerator created locally within consuming functions
/// - No external contracts can influence random outcomes
/// - Admin operations require AdminCap ownership
///
/// ## Economic Model
/// - Fixed price: 0.01 SUI per Pokeball
/// - Treasury accumulates all payments
/// - Admin can withdraw treasury funds
module loot_box_v2::pokemon;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::display;
use sui::dynamic_field;
use sui::event;
use sui::package;
use sui::random::{Self, Random};
use sui::sui::SUI;

// =========================================================================
// Structs
// =========================================================================

public struct POKEMON has drop {}

public struct AdminCap has key {
    id: UID,
}

public struct GameConfig<phantom T> has key {
    id: UID,
    price: u64,
    weight_common: u8,
    weight_rare: u8,
    weight_epic: u8,
    weight_legendary: u8,
    treasury: Balance<T>,
}

public struct Pokeball has key {
    id: UID,
}

public struct Pokemon has key, store {
    id: UID,
    pokemon_id: u32,
    name: String,
    rarity_tier: u8,
    level: u8,
    hp: u8,
    attack: u8,
    defense: u8,
    sp_attack: u8,
    sp_defense: u8,
    speed: u8,
    image_url: String,
    caught_at: u64,
    original_trainer: address,
    last_sender: address,
}

// =========================================================================
// Events
// =========================================================================

// UPGRADED: Now includes all stats and image_url so the frontend doesn't need an API
public struct PokemonCaught has copy, drop {
    object_id: ID,
    pokemon_id: u32,
    pokemon_name: String,
    rarity: u8,
    level: u8,
    hp: u8,
    attack: u8,
    defense: u8,
    sp_attack: u8,
    sp_defense: u8,
    speed: u8,
    image_url: String,
    original_trainer: address,
    last_sender: address,
}

public struct PokeballsPurchased has copy, drop {
    trainer: address,
    quantity: u64,
    total_price_paid: u64,
}

// =========================================================================
// Constants & Arrays
// =========================================================================

const COMMON_POKEMON: vector<u32> = vector[
    10, 11, 13, 14, 16, 17, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 32, 33,
    35, 37, 39, 41, 42, 43, 44, 46, 47, 48, 50, 51, 52, 54, 56, 57, 58, 60, 61,
    63, 64, 66, 67, 69, 70, 72, 74, 75, 77, 79, 81, 84, 86, 88, 90, 92, 93, 95,
    96, 98, 100, 102, 104, 109, 111, 116, 118, 120, 129
];

const RARE_POKEMON: vector<u32> = vector[
    12, 15, 18, 26, 31, 34, 36, 38, 40, 45, 49, 53, 55, 59, 62, 65, 68, 71, 73,
    76, 78, 80, 82, 83, 85, 87, 89, 91, 94, 97, 99, 101, 103, 105, 106, 107, 108,
    110, 112, 113, 114, 115, 117, 119, 121, 122, 123, 124, 125, 126, 127, 128,
    130, 132
];

const EPIC_POKEMON: vector<u32> = vector[
    1, 2, 3, 4, 5, 6, 7, 8, 9, 131, 133, 134, 135, 136, 137, 138, 139, 140, 141,
    142, 143, 147, 148, 149
];

const LEGENDARY_POKEMON: vector<u32> = vector[
    144, 145, 146, 150, 151
];

const COMMON_STAT_MIN: u8 = 20;
const COMMON_STAT_MAX: u8 = 50;
const RARE_STAT_MIN: u8 = 50;
const RARE_STAT_MAX: u8 = 75;
const EPIC_STAT_MIN: u8 = 75;
const EPIC_STAT_MAX: u8 = 100;
const LEGENDARY_STAT_MIN: u8 = 90;
const LEGENDARY_STAT_MAX: u8 = 151;

const COMMON_LEVEL_MIN: u8 = 1;
const COMMON_LEVEL_MAX: u8 = 10;
const RARE_LEVEL_MIN: u8 = 11;
const RARE_LEVEL_MAX: u8 = 25;
const EPIC_LEVEL_MIN: u8 = 26;
const EPIC_LEVEL_MAX: u8 = 40;
const LEGENDARY_LEVEL_MIN: u8 = 41;
const LEGENDARY_LEVEL_MAX: u8 = 50;

const DEFAULT_PRICE: u64 = 10_000_000;
const DEFAULT_W_COMMON: u8 = 60;
const DEFAULT_W_RARE: u8 = 25;
const DEFAULT_W_EPIC: u8 = 12;
const DEFAULT_W_LEGENDARY: u8 = 3;
const PITY_THRESHOLD: u64 = 30;

const RARITY_COMMON: u8 = 1;
const RARITY_RARE: u8 = 2;
const RARITY_EPIC: u8 = 3;
const RARITY_LEGENDARY: u8 = 4;

const EInvalidPayment: u64 = 0;
const ERarityWeightsTotal: u64 = 1;

// =========================================================================
// Initialization
// =========================================================================

fun init(otw: POKEMON, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    init_game_with_display<SUI>(&publisher, ctx);
    transfer::public_transfer(publisher, ctx.sender());
}

public fun init_game<T>(ctx: &mut TxContext) {
    transfer::transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender(),
    );
    transfer::share_object(GameConfig<T> {
        id: object::new(ctx),
        price: DEFAULT_PRICE,
        weight_common: DEFAULT_W_COMMON,
        weight_rare: DEFAULT_W_RARE,
        weight_epic: DEFAULT_W_EPIC,
        weight_legendary: DEFAULT_W_LEGENDARY,
        treasury: balance::zero<T>(),
    });
}

#[allow(lint(share_owned))]
public fun init_game_with_display<T>(publisher: &package::Publisher, ctx: &mut TxContext) {
    let mut fields = vector::empty<String>();
    vector::push_back(&mut fields, string::utf8(b"name"));
    vector::push_back(&mut fields, string::utf8(b"description"));
    vector::push_back(&mut fields, string::utf8(b"image_url"));
    vector::push_back(&mut fields, string::utf8(b"project_url"));
    vector::push_back(&mut fields, string::utf8(b"creator"));
    vector::push_back(&mut fields, string::utf8(b"original_trainer"));
    vector::push_back(&mut fields, string::utf8(b"last_sender"));

    let mut values = vector::empty<String>();
    vector::push_back(&mut values, string::utf8(b"{name}"));
    vector::push_back(
        &mut values,
        string::utf8(b"Level {level} Pokemon | Rarity: Tier {rarity_tier}"),
    );
    vector::push_back(&mut values, string::utf8(b"{image_url}"));
    vector::push_back(
        &mut values,
        string::utf8(b"https://loot-box-system.example.com"),
    );
    vector::push_back(&mut values, string::utf8(b"Sui Pokemon Game"));
    vector::push_back(&mut values, string::utf8(b"{original_trainer}"));
    vector::push_back(&mut values, string::utf8(b"{last_sender}"));

    let mut display_obj = display::new_with_fields<Pokemon>(publisher, fields, values, ctx);
    display::update_version(&mut display_obj);
    sui::transfer::public_share_object(display_obj);

    init_game<T>(ctx);
}

// =========================================================================
// Helper Functions
// =========================================================================

fun u32_to_string(mut n: u32): String {
    if (n == 0) return string::utf8(b"0");
    let mut bytes = vector::empty<u8>();
    while (n > 0) {
        vector::push_back(&mut bytes, ((n % 10) as u8) + 48);
        n = n / 10;
    };
    vector::reverse(&mut bytes);
    string::utf8(bytes)
}

fun get_pokemon_name(id: u32): String {
    let names = vector[
        b"Bulbasaur",
        b"Ivysaur",
        b"Venusaur",
        b"Charmander",
        b"Charmeleon",
        b"Charizard",
        b"Squirtle",
        b"Wartortle",
        b"Blastoise",
        b"Caterpie",
        b"Metapod",
        b"Butterfree",
        b"Weedle",
        b"Kakuna",
        b"Beedrill",
        b"Pidgey",
        b"Pidgeotto",
        b"Pidgeot",
        b"Rattata",
        b"Raticate",
        b"Spearow",
        b"Fearow",
        b"Ekans",
        b"Arbok",
        b"Pikachu",
        b"Raichu",
        b"Sandshrew",
        b"Sandslash",
        b"Nidoran-f",
        b"Nidorina",
        b"Nidoqueen",
        b"Nidoran-m",
        b"Nidorino",
        b"Nidoking",
        b"Clefairy",
        b"Clefable",
        b"Vulpix",
        b"Ninetales",
        b"Jigglypuff",
        b"Wigglytuff",
        b"Zubat",
        b"Golbat",
        b"Oddish",
        b"Gloom",
        b"Vileplume",
        b"Paras",
        b"Parasect",
        b"Venonat",
        b"Venomoth",
        b"Diglett",
        b"Dugtrio",
        b"Meowth",
        b"Persian",
        b"Psyduck",
        b"Golduck",
        b"Mankey",
        b"Primeape",
        b"Growlithe",
        b"Arcanine",
        b"Poliwag",
        b"Poliwhirl",
        b"Poliwrath",
        b"Abra",
        b"Kadabra",
        b"Alakazam",
        b"Machop",
        b"Machoke",
        b"Machamp",
        b"Bellsprout",
        b"Weepinbell",
        b"Victreebel",
        b"Tentacool",
        b"Tentacruel",
        b"Geodude",
        b"Graveler",
        b"Golem",
        b"Ponyta",
        b"Rapidash",
        b"Slowpoke",
        b"Slowbro",
        b"Magnemite",
        b"Magneton",
        b"Farfetchd",
        b"Doduo",
        b"Dodrio",
        b"Seel",
        b"Dewgong",
        b"Grimer",
        b"Muk",
        b"Shellder",
        b"Cloyster",
        b"Gastly",
        b"Haunter",
        b"Gengar",
        b"Onix",
        b"Drowzee",
        b"Hypno",
        b"Krabby",
        b"Kingler",
        b"Voltorb",
        b"Electrode",
        b"Exeggcute",
        b"Exeggutor",
        b"Cubone",
        b"Marowak",
        b"Hitmonlee",
        b"Hitmonchan",
        b"Lickitung",
        b"Koffing",
        b"Weezing",
        b"Rhyhorn",
        b"Rhydon",
        b"Chansey",
        b"Tangela",
        b"Kangaskhan",
        b"Horsea",
        b"Seadra",
        b"Goldeen",
        b"Seaking",
        b"Staryu",
        b"Starmie",
        b"Mr-mime",
        b"Scyther",
        b"Jynx",
        b"Electabuzz",
        b"Magmar",
        b"Pinsir",
        b"Tauros",
        b"Magikarp",
        b"Gyarados",
        b"Lapras",
        b"Ditto",
        b"Eevee",
        b"Vaporeon",
        b"Jolteon",
        b"Flareon",
        b"Porygon",
        b"Omanyte",
        b"Omastar",
        b"Kabuto",
        b"Kabutops",
        b"Aerodactyl",
        b"Snorlax",
        b"Articuno",
        b"Zapdos",
        b"Moltres",
        b"Dratini",
        b"Dragonair",
        b"Dragonite",
        b"Mewtwo",
        b"Mew",
    ];
    string::utf8(*vector::borrow(&names, ((id - 1) as u64)))
}

// =========================================================================
// Core Game Logic
// =========================================================================

#[allow(lint(self_transfer))]
public fun purchase_pokeballs<T>(
    config: &mut GameConfig<T>,
    mut payment: Coin<T>,
    quantity: u64,
    ctx: &mut TxContext,
) {
    let total_price = config.price * quantity;
    assert!(coin::value(&payment) >= total_price, EInvalidPayment);

    let paid = coin::split(&mut payment, total_price, ctx);
    balance::join(&mut config.treasury, coin::into_balance(paid));

    if (coin::value(&payment) > 0) {
        transfer::public_transfer(payment, ctx.sender());
    } else {
        coin::destroy_zero(payment);
    };

    event::emit(PokeballsPurchased {
        trainer: ctx.sender(),
        quantity,
        total_price_paid: total_price,
    });

    let mut i = 0;
    while (i < quantity) {
        transfer::transfer(Pokeball { id: object::new(ctx) }, ctx.sender());
        i = i + 1;
    };
}

#[allow(lint(self_transfer))]
entry fun purchase_and_catch_pokemon<T>(
    config: &mut GameConfig<T>,
    payment: Coin<T>,
    quantity: u64,
    r: &Random,
    ctx: &mut TxContext,
) {
    let mut pokeballs = vector::empty<Pokeball>();
    let total_price = config.price * quantity;
    let mut payment_coin = payment;

    assert!(coin::value(&payment_coin) >= total_price, EInvalidPayment);

    let paid = coin::split(&mut payment_coin, total_price, ctx);
    balance::join(&mut config.treasury, coin::into_balance(paid));

    if (coin::value(&payment_coin) > 0) {
        transfer::public_transfer(payment_coin, ctx.sender());
    } else {
        coin::destroy_zero(payment_coin);
    };

    event::emit(PokeballsPurchased {
        trainer: ctx.sender(),
        quantity,
        total_price_paid: total_price,
    });

    let mut i = 0;
    while (i < quantity) {
        vector::push_back(&mut pokeballs, Pokeball { id: object::new(ctx) });
        i = i + 1;
    };

    catch_pokemon_internal(pokeballs, config, r, ctx);
}

#[allow(lint(self_transfer))]
entry fun catch_pokemon<T>(
    pokeball: Pokeball,
    config: &mut GameConfig<T>,
    r: &Random,
    ctx: &mut TxContext,
) {
    let mut pokeballs = vector::empty<Pokeball>();
    vector::push_back(&mut pokeballs, pokeball);
    catch_pokemon_internal(pokeballs, config, r, ctx);
}

#[allow(lint(self_transfer))]
entry fun catch_pokemons<T>(
    pokeballs: vector<Pokeball>,
    config: &mut GameConfig<T>,
    r: &Random,
    ctx: &mut TxContext,
) {
    catch_pokemon_internal(pokeballs, config, r, ctx);
}

#[allow(lint(self_transfer))]
fun catch_pokemon_internal<T>(
    mut pokeballs: vector<Pokeball>,
    config: &mut GameConfig<T>,
    r: &Random,
    ctx: &mut TxContext,
) {
    let trainer = ctx.sender();
    let mut gen = random::new_generator(r, ctx);

    let mut pity = if (dynamic_field::exists_(&config.id, trainer)) {
        *dynamic_field::borrow<address, u64>(&config.id, trainer)
    } else {
        0
    };

    let len = vector::length(&pokeballs);
    let mut idx = 0;

    while (idx < len) {
        let pokeball_obj = vector::pop_back(&mut pokeballs);
        let Pokeball { id } = pokeball_obj;
        object::delete(id);

        let pity_trigger = pity >= (PITY_THRESHOLD - 1);
        let rarity = if (pity_trigger) {
            pity = 0;
            RARITY_LEGENDARY
        } else {
            let roll = random::generate_u8_in_range(&mut gen, 0, 99);
            let w1 = config.weight_common;
            let w2 = w1 + config.weight_rare;
            let w3 = w2 + config.weight_epic;
            if (roll < w1) {
                pity = pity + 1;
                RARITY_COMMON
            } else if (roll < w2) {
                pity = pity + 1;
                RARITY_RARE
            } else if (roll < w3) {
                pity = pity + 1;
                RARITY_EPIC
            } else {
                pity = 0;
                RARITY_LEGENDARY
            }
        };

        let level = if (rarity == RARITY_COMMON) {
            random::generate_u8_in_range(&mut gen, COMMON_LEVEL_MIN, COMMON_LEVEL_MAX)
        } else if (rarity == RARITY_RARE) {
            random::generate_u8_in_range(&mut gen, RARE_LEVEL_MIN, RARE_LEVEL_MAX)
        } else if (rarity == RARITY_EPIC) {
            random::generate_u8_in_range(&mut gen, EPIC_LEVEL_MIN, EPIC_LEVEL_MAX)
        } else {
            random::generate_u8_in_range(&mut gen, LEGENDARY_LEVEL_MIN, LEGENDARY_LEVEL_MAX)
        };

        let stat_min = if (rarity == RARITY_COMMON) { COMMON_STAT_MIN } else if (
            rarity == RARITY_RARE
        ) { RARE_STAT_MIN } else if (rarity == RARITY_EPIC) { EPIC_STAT_MIN } else {
            LEGENDARY_STAT_MIN
        };

        let stat_max = if (rarity == RARITY_COMMON) { COMMON_STAT_MAX } else if (
            rarity == RARITY_RARE
        ) { RARE_STAT_MAX } else if (rarity == RARITY_EPIC) { EPIC_STAT_MAX } else {
            LEGENDARY_STAT_MAX
        };

        let hp = random::generate_u8_in_range(&mut gen, stat_min, stat_max);
        let attack = random::generate_u8_in_range(&mut gen, stat_min, stat_max);
        let defense = random::generate_u8_in_range(&mut gen, stat_min, stat_max);
        let sp_attack = random::generate_u8_in_range(&mut gen, stat_min, stat_max);
        let sp_defense = random::generate_u8_in_range(&mut gen, stat_min, stat_max);
        let speed = random::generate_u8_in_range(&mut gen, stat_min, stat_max);

        let pokemon_id = if (rarity == RARITY_COMMON) {
            let len = vector::length(&COMMON_POKEMON);
            let idx = random::generate_u32_in_range(&mut gen, 0, (len - 1) as u32);
            *vector::borrow(&COMMON_POKEMON, idx as u64)
        } else if (rarity == RARITY_RARE) {
            let len = vector::length(&RARE_POKEMON);
            let idx = random::generate_u32_in_range(&mut gen, 0, (len - 1) as u32);
            *vector::borrow(&RARE_POKEMON, idx as u64)
        } else if (rarity == RARITY_EPIC) {
            let len = vector::length(&EPIC_POKEMON);
            let idx = random::generate_u32_in_range(&mut gen, 0, (len - 1) as u32);
            *vector::borrow(&EPIC_POKEMON, idx as u64)
        } else {
            let len = vector::length(&LEGENDARY_POKEMON);
            let idx = random::generate_u32_in_range(&mut gen, 0, (len - 1) as u32);
            *vector::borrow(&LEGENDARY_POKEMON, idx as u64)
        };

        let name = get_pokemon_name(pokemon_id);

        // Generate Image URL dynamically
        let mut img = string::utf8(
            b"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/",
        );
        string::append(&mut img, u32_to_string(pokemon_id));
        string::append(&mut img, string::utf8(b".png"));

        let pokemon = Pokemon {
            id: object::new(ctx),
            pokemon_id,
            name,
            rarity_tier: rarity,
            level,
            hp,
            attack,
            defense,
            sp_attack,
            sp_defense,
            speed,
            image_url: img,
            caught_at: ctx.epoch(),
            original_trainer: trainer,
            last_sender: trainer,
        };

        // Upgraded Event Emission
        event::emit(PokemonCaught {
            object_id: object::id(&pokemon),
            pokemon_id: pokemon.pokemon_id,
            pokemon_name: pokemon.name,
            rarity: rarity,
            level,
            hp,
            attack,
            defense,
            sp_attack,
            sp_defense,
            speed,
            image_url: pokemon.image_url,
            original_trainer: trainer,
            last_sender: trainer,
        });

        transfer::public_transfer(pokemon, trainer);
        idx = idx + 1;
    };

    vector::destroy_empty(pokeballs);

    if (dynamic_field::exists_(&config.id, trainer)) {
        *dynamic_field::borrow_mut<address, u64>(&mut config.id, trainer) = pity;
    } else {
        dynamic_field::add(&mut config.id, trainer, pity);
    };
}

// =========================================================================
// Utility Functions
// =========================================================================

public fun get_item_stats(pokemon: &Pokemon): (String, u8, u8) {
    (pokemon.name, pokemon.rarity_tier, pokemon.level)
}

public fun get_pokemon_stats(pokemon: &Pokemon): (u8, u8, u8, u8, u8, u8) {
    (
        pokemon.hp,
        pokemon.attack,
        pokemon.defense,
        pokemon.sp_attack,
        pokemon.sp_defense,
        pokemon.speed,
    )
}

entry fun transfer_pokemon(
    mut pokemon: Pokemon,
    recipient: address,
    ctx: &TxContext
) {
    pokemon.last_sender = ctx.sender();
    transfer::public_transfer(pokemon, recipient);
}

public fun burn_pokemon(pokemon: Pokemon) {
    let Pokemon {
        id,
        pokemon_id: _,
        name: _,
        rarity_tier: _,
        level: _,
        hp: _,
        attack: _,
        defense: _,
        sp_attack: _,
        sp_defense: _,
        speed: _,
        image_url: _,
        caught_at: _,
        original_trainer: _,
        last_sender: _,
    } = pokemon;
    object::delete(id);
}

// =========================================================================
// Admin Functions
// =========================================================================

public fun update_weights<T>(
    config: &mut GameConfig<T>,
    _cap: &AdminCap,
    common: u8,
    rare: u8,
    epic: u8,
    legendary: u8,
) {
    assert!(common + rare + epic + legendary == 100, ERarityWeightsTotal);
    config.weight_common = common;
    config.weight_rare = rare;
    config.weight_epic = epic;
    config.weight_legendary = legendary;
}

public fun withdraw_treasury<T>(
    config: &mut GameConfig<T>,
    _cap: &AdminCap,
    amount: u64,
    ctx: &mut TxContext,
) {
    let coin_out = coin::take(&mut config.treasury, amount, ctx);
    transfer::public_transfer(coin_out, ctx.sender());
}

#[test_only]
public fun set_pity_for_testing<T>(config: &mut GameConfig<T>, player: address, pity: u64) {
    if (dynamic_field::exists_(&config.id, player)) {
        *dynamic_field::borrow_mut<address, u64>(&mut config.id, player) = pity;
    } else {
        dynamic_field::add(&mut config.id, player, pity);
    };
}
