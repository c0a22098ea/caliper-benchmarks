'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class ReadWithHistory extends OperationBase {
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
        
        console.log(`Worker ${this.workerIndex}: Reading final state and history for tokenId: ${tokenId}`);

        try {
            // 現在のバージョンを取得
            const getCurrentVersionRequest = {
                contract: 'update',
                verb: 'getCurrentMetadataVersion',
                args: [tokenId],
                readOnly: true
            };
            const currentVersionResult = await this.sutAdapter.sendRequests(getCurrentVersionRequest);
            
            // メタデータ履歴を取得
            const getHistoryRequest = {
                contract: 'update',
                verb: 'getMetadataHistory',
                args: [tokenId],
                readOnly: true
            };
            const historyResult = await this.sutAdapter.sendRequests(getHistoryRequest);
            
            // 更新回数を取得
            const getUpdateCountRequest = {
                contract: 'update',
                verb: 'getMetadataUpdateCount',
                args: [tokenId],
                readOnly: true
            };
            const updateCountResult = await this.sutAdapter.sendRequests(getUpdateCountRequest);
            
            console.log(`Worker ${this.workerIndex}: Final state analysis:`);
            console.log(`  - Current version: ${JSON.stringify(currentVersionResult)}`);
            console.log(`  - Update count: ${JSON.stringify(updateCountResult)}`);
            console.log(`  - History: ${JSON.stringify(historyResult, null, 2)}`);
            
            return {
                status: 'success',
                currentVersion: currentVersionResult,
                updateCount: updateCountResult,
                history: historyResult,
                orderManagementVerified: true
            };
            
        } catch (error) {
            console.log(`Worker ${this.workerIndex}: Failed to read final state - ${error.message}`);
            return {
                status: 'read_failed',
                error: error.message
            };
        }
    }
}

function createWorkloadModule() {
    return new ReadWithHistory();
}

module.exports.createWorkloadModule = createWorkloadModule;