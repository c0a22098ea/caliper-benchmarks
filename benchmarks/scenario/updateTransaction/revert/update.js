'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class UpdateTest extends OperationBase {
    constructor() {
        super();
        this.workerIndex = -1;
    }

    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(this.workerIndex, this.tokenId, accountsPerWorker);
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.workerIndex = workerIndex;
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        this.version = roundArguments.version || 1;
        
        console.log(`Worker ${this.workerIndex}: Initializing Update test - version: ${this.version}`);
    }

    async submitTransaction() {
        const tokenId = this.simpleState.tokenId + 1 + this.simpleState.getNextUpdateTokenId();
        console.log(`Worker ${this.workerIndex}: TokenId to update: ${tokenId}, version: ${this.version}`);
        
        // バージョン付きメタデータ(CID)の準備
        const updatedCID = `ipfs://QmFencingTest-${this.workerIndex}-${tokenId}-${Date.now()}`;
        
        try {
            // update.solのupdateTokenURI関数を呼び出し（バージョンチェック付き）
            const updateRequest = {
                contract: 'update',
                verb: 'updateTokenURI',
                args: [tokenId, updatedCID, this.version],
            };
            
            const result = await this.sutAdapter.sendRequests(updateRequest);
            console.log(`Worker ${this.workerIndex}: ✅ Update SUCCESS for version ${this.version}`);
            return result;
        } catch (error) {
            console.log(`Worker ${this.workerIndex}: ❌ Update FAILED for version ${this.version} - ${error.message}`);
            
            if (error.message.includes('InvalidMetadataVersion')) {
                console.log(`Worker ${this.workerIndex}: 🔒 InvalidMetadataVersion detected - Order management working correctly!`);
            }
            throw error;
        }
    }
}

function createWorkloadModule() {
    return new UpdateTest();
}

module.exports.createWorkloadModule = createWorkloadModule;