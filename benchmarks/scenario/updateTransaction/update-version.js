'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class UpdateVersionTest extends OperationBase {
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
        
        this.version =  this.simpleState.getNextUpdateTokenId()
        this.suffix = roundArguments.suffix || 'default';
          this.simpleState.tokenId = 1; 
        
        console.log(`Worker ${this.workerIndex}: Initializing version test - version: ${this.version}, suffix: ${this.suffix}`);
    }

    async submitTransaction() {       
        const tokenId = this.simpleState.tokenId++;
        console.log(`Worker ${this.workerIndex}: Preparing to update tokenId: ${tokenId} to version: ${this.version}`);
        
        // バージョン付きメタデータ(CID)の準備
        const updatedCid = `ipfs://QmOrderTest-${this.suffix}-${this.workerIndex}-${tokenId}-${Date.now()}`;
        console.log(`Worker ${this.workerIndex}: Attempting updateTokenURI - tokenId: ${tokenId}, version: ${this.version}, CID: ${updatedCid}`);

        try {
            // update.solのupdateTokenURI関数を呼び出し（バージョンチェック付き）
            const updateRequest = {
                contract: 'update',
                verb: 'updateTokenURI',
                args: [tokenId, updatedCid, this.version],
                options: {
                    gas: 500000 // 必要に応じて適切なガス値を指定
    }
            };
            
            const result = await this.sutAdapter.sendRequests(updateRequest);
            console.log(`Worker ${this.workerIndex}: ✅ Update SUCCESS for version ${this.version} - Order management allowed the update`);
            return result;
        } catch (error) {
            console.log(`Worker ${this.workerIndex}: ❌ Update FAILED for version ${this.version} - ${error.message}`);
            
            // InvalidMetadataVersionエラーの検出
            if (error.message.includes('InvalidMetadataVersion')) {
                console.log(`Worker ${this.workerIndex}: 🔒 InvalidMetadataVersion detected - Order management working correctly!`);
            }
            
            // リバートが期待される場合があるので、テスト結果として記録
            return {
                status: 'reverted',
                error: error.message,
                version: this.version,
                orderManagementWorking: error.message.includes('InvalidMetadataVersion')
            };
        }
    }
}

function createWorkloadModule() {
    return new UpdateVersionTest();
}

module.exports.createWorkloadModule = createWorkloadModule;