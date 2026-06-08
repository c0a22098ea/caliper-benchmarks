'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class VerifyTest extends OperationBase {
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
        
        console.log(`Worker ${this.workerIndex}: Initializing Verify test`);
    }

    async submitTransaction() {
        const tokenId = 0; // safeMintで作成されたtokenId
        
        console.log(`Worker ${this.workerIndex}: === Verify Test ===`);
        
        try {
            // CID確認のみ実行
            console.log(`Worker ${this.workerIndex}: Getting current CID state...`);
            
            const verifyCIDRequest = {
                contract: 'update',
                verb: 'getLatestCID',
                args: [tokenId],
            };
            
            const currentCID = await this.sutAdapter.sendRequests(verifyCIDRequest);
            console.log(`Worker ${this.workerIndex}: ✅ Current CID: ${currentCID}`);
            
            return {
                status: 'verify_complete',
                tokenId: tokenId,
                currentCID: currentCID
            };
            
        } catch (error) {
            console.log(`Worker ${this.workerIndex}: ❌ Verify test FAILED - ${error.message}`);
            throw error;
        }
    }
}

function createWorkloadModule() {
    return new VerifyTest();
}

module.exports.createWorkloadModule = createWorkloadModule;