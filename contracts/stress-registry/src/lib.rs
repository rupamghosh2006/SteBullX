#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub struct StressScenario {
    pub id: BytesN<32>,
    pub protocol: Symbol,
    pub scenario_hash: BytesN<32>,
    pub result_hash: BytesN<32>,
    pub created_at: u64,
    pub expires_at: u64,
    pub publisher: Address,
    pub version: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Scenario(BytesN<32>),
}

#[contract]
pub struct StressScenarioRegistry;

#[contractimpl]
impl StressScenarioRegistry {
    /// Anchors compact hashes only. Full simulation artifacts stay off-chain.
    /// The publisher authorizes every write; IDs are immutable to prevent replay
    /// or silent modification of a published scenario/result pair.
    pub fn register(
        env: Env,
        publisher: Address,
        id: BytesN<32>,
        protocol: Symbol,
        scenario_hash: BytesN<32>,
        result_hash: BytesN<32>,
        expires_at: u64,
        version: u32,
    ) -> StressScenario {
        publisher.require_auth();
        if expires_at <= env.ledger().timestamp() || version == 0 {
            panic!("invalid expiry or version");
        }
        let key = DataKey::Scenario(id.clone());
        if env.storage().persistent().has(&key) {
            panic!("scenario id already registered");
        }
        let record = StressScenario {
            id,
            protocol,
            scenario_hash,
            result_hash,
            created_at: env.ledger().timestamp(),
            expires_at,
            publisher,
            version,
        };
        env.storage().persistent().set(&key, &record);
        record
    }

    pub fn get(env: Env, id: BytesN<32>) -> Option<StressScenario> {
        let record: Option<StressScenario> = env.storage().persistent().get(&DataKey::Scenario(id));
        record.filter(|item| item.expires_at > env.ledger().timestamp())
    }

    pub fn verify(env: Env, id: BytesN<32>, scenario_hash: BytesN<32>, result_hash: BytesN<32>) -> bool {
        match Self::get(env, id) {
            Some(item) => item.scenario_hash == scenario_hash && item.result_hash == result_hash,
            None => false,
        }
    }
}
