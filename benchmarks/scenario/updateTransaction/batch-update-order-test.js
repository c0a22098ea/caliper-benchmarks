'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class BatchUpdateOrderTest extends OperationBase {
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
    }

    async submitTransaction() {
        const baseTokenId = this.simpleState.tokenId;
        
        // バッチ更新用のデータを準備 - 同じtokenIdに対して複数の更新を試行
        const tokenIds = [baseTokenId, baseTokenId, baseTokenId];
        const newURIs = [
            `ipfs://QmBatchTest1-${this.workerIndex}-${Date.now()}`,
            `ipfs://QmBatchTest2-${this.workerIndex}-${Date.now()}`,
            `ipfs://QmBatchTest3-${this.workerIndex}-${Date.now()}`
        ];
        
        // 意図的に順序を入れ替えたバージョン配列
        // 4は成功、3は現在のバージョン(3)と同じかそれより小さいのでリバート、5は成功する想定
        const versions = [4, 3, 5];

        console.log(`Worker ${this.workerIndex}: Starting batch update with mixed order versions: ${versions.join(', ')}`);
        console.log(`Worker ${this.workerIndex}: Expected result: version 3 should revert due to order management`);

        try {
            const batchUpdateRequest = {
                contract: 'update',
                verb: 'batchUpdateTokenURIs',
                args: [tokenIds, newURIs, versions],
            };
            
            const result = await this.sutAdapter.sendRequests(batchUpdateRequest);
            console.log(`Worker ${this.workerIndex}: ⚠️ Batch update completed unexpectedly - Order management may not be working`);
            return result;
        } catch (error) {
            console.log(`Worker ${this.workerIndex}: ❌ Batch update failed - ${error.message}`);
            
            // InvalidMetadataVersionエラーの詳細分析
            if (error.message.includes('InvalidMetadataVersion')) {
                console.log(`Worker ${this.workerIndex}: 🔒 InvalidMetadataVersion in batch update - Order management working correctly!`);
                console.log(`Worker ${this.workerIndex}: Batch failed due to version ${versions[1]} (expected behavior)`);
            }
            
            return {
                status: 'batch_failed',
                error: error.message,
                expectedRevert: true,
                batchVersions: versions,
                orderManagementWorking: error.message.includes('InvalidMetadataVersion')
            };
        }
    }
}

function createWorkloadModule() {
    return new BatchUpdateOrderTest();
}

module.exports.createWorkloadModule = createWorkloadModule;