# Scenario tests

This folder contains benchmark scenarios used by Caliper.

Each subdirectory defines one scenario with its own `config.yaml` and workload modules (`*.js`). The scenarios are tailored to the contract or workflow being tested, but they all follow the same Caliper launch pattern.

## Scenario directories

| Directory | Purpose | Main files |
|---|---|---|
| `ERC-721/` | Baseline ERC-721 benchmark for mint and transfer operations. | `config.yaml`, `mint.js`, `transfer.js` |
| `nft-create-update-delete/` | NFT lifecycle benchmark that mints a token, updates `tokenURI`, and then marks it deleted. | `config.yaml`, `mint.js`, `update.js`, `delete.js` |
| `scoring/` | NFT benchmark that adds a trust-scoring-based authorization flow. | `config.yaml`, `mint.js`, `transfer.js` |
| `simple/` | Small example benchmark for account opening, querying, and transfers. | `config.yaml`, `open.js`, `query.js`, `transfer.js` |
| `smallbank/` | Smallbank-style benchmark for create, modify, and query workloads. | `config.yaml`, `create.js`, `modify.js`, `query.js` |
| `update/` | Consistency benchmark for mint, update, and read operations. | `config.yaml`, `safeMint.js`, `update.js`, `read.js` |
| `updateTransaction/` | Update-order benchmark for testing version checks and revert behavior. | `config.yaml`, `safeMint.js`, `update-version.js`, `batch-update-order-test.js`, `concurrent-update-order.js`, `read-with-history.js` |

## Notes

- Most scenarios rely on `tokenId` or other round arguments passed through the Caliper config.
- Some scenarios require redeploying the contract before each run so that the on-chain state starts from a clean baseline.