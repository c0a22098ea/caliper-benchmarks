'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class UpdateAndVerifyTest extends OperationBase {
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
        
        console.log(`Worker ${this.workerIndex}: Initializing Update and Verify test`);
    }

    async submitTransaction() {
        const tokenId = 0; // safeMintで作成されたtokenId
        
        console.log(`Worker ${this.workerIndex}: === Update and Verify Scenario Test ===`);
        
        try {
            // 1. 更新前の初期CID状態を記録
            console.log(`Worker ${this.workerIndex}: Getting initial CID state...`);
            const initialCIDRequest = {
                contract: 'update',
                verb: 'getLatestCID',
                args: [tokenId],
            };
            const initialCID = await this.sutAdapter.sendRequests(initialCIDRequest);
            console.log(`Worker ${this.workerIndex}: Initial CID: ${initialCID}`);

            // 2. 更新トランザクションを実行
            const updatedCID = `ipfs://QmUpdateVerifyTest-${this.workerIndex}-${tokenId}-${Date.now()}`;
            console.log(`Worker ${this.workerIndex}: Attempting update with new CID: ${updatedCID}`);
            
            const updateRequest = {
                contract: 'update',
                verb: 'updateTokenURI',
                args: [tokenId, updatedCID, 2], // 固定バージョン2で更新
            };
            
            await this.sutAdapter.sendRequests(updateRequest);
            console.log(`Worker ${this.workerIndex}: Update transaction sent`);

            // 3. 更新後の状態確認（簡潔に）
            const finalCID = await this.sutAdapter.sendRequests(initialCIDRequest);
            
            // 4. 結果判定
            console.log(`Worker ${this.workerIndex}: === CID State Verification ===`);
            console.log(`Worker ${this.workerIndex}: Initial CID:  ${initialCID}`);
            console.log(`Worker ${this.workerIndex}: Updated CID:  ${updatedCID}`);
            console.log(`Worker ${this.workerIndex}: Final CID:    ${finalCID}`);

            if (finalCID === updatedCID) {
                console.log(`Worker ${this.workerIndex}: ✅ UPDATE CONFIRMED - CID successfully updated`);
            } else if (finalCID === initialCID) {
                console.log(`Worker ${this.workerIndex}: ⏳ UPDATE PENDING/REVERTED - CID remains initial`);
            } else {
                console.log(`Worker ${this.workerIndex}: ❌ UNEXPECTED STATE - CID is in unknown state`);
            }
            
            return {
                status: 'update_verify_complete',
                tokenId: tokenId,
                initialCID: initialCID,
                updatedCID: updatedCID,
                finalCID: finalCID,
                updateConfirmed: finalCID === updatedCID
            };
            
        } catch (error) {
            console.log(`Worker ${this.workerIndex}: ❌ Update and Verify test FAILED - ${error.message}`);
            throw error;
        }
    }
}

function createWorkloadModule() {
    return new UpdateAndVerifyTest();
}

module.exports.createWorkloadModule = createWorkloadModule;