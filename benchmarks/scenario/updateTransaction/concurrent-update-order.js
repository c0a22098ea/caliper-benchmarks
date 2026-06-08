'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class ConcurrentUpdateOrderTest extends OperationBase {
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
        const tokenId = this.simpleState.tokenId;
        
        // 同時実行時の競合状態をテストするため、異なるバージョンで更新を試行
        // workerIndexに基づいてバージョンを決定（意図的に順序を混ぜる）
        const versionMap = {
            0: 10,  // 新しいバージョン（成功するはず）
            1: 8,   // 古いバージョン（リバートするはず）
            2: 12,  // 新しいバージョン（成功するはず）
            3: 6,   // 古いバージョン（リバートするはず）
            4: 15   // 新しいバージョン（成功するはず）
        };
        
        const version = versionMap[this.workerIndex % 5] || (10 + this.workerIndex);
        const updatedCid = `ipfs://QmConcurrent-${version}-${this.workerIndex}-${tokenId}-${Date.now()}`;
        
        // ランダムな遅延を追加して競合状態をシミュレート
        const delay = Math.random() * 200; // 0-200ms
        await new Promise(resolve => setTimeout(resolve, delay));

        console.log(`Worker ${this.workerIndex}: Concurrent update attempt - version: ${version}, delay: ${delay.toFixed(2)}ms`);

        try {
            const updateRequest = {
                contract: 'update',
                verb: 'updateTokenURI',
                args: [tokenId, updatedCid, version],
            };
            
            const result = await this.sutAdapter.sendRequests(updateRequest);
            console.log(`Worker ${this.workerIndex}: ✅ Concurrent update SUCCESS for version ${version}`);
            return result;
        } catch (error) {
            console.log(`Worker ${this.workerIndex}: ❌ Concurrent update FAILED for version ${version} - ${error.message}`);
            
            // 順序エラーの詳細をログ記録
            if (error.message.includes('InvalidMetadataVersion')) {
                console.log(`Worker ${this.workerIndex}: 🔒 Version conflict in concurrent environment - Order management working correctly!`);
            }
            
            return {
                status: 'concurrent_failed',
                error: error.message,
                version: version,
                workerIndex: this.workerIndex,
                concurrentTest: true,
                orderManagementWorking: error.message.includes('InvalidMetadataVersion')
            };
        }
    }
}

function createWorkloadModule() {
    return new ConcurrentUpdateOrderTest();
}

module.exports.createWorkloadModule = createWorkloadModule;