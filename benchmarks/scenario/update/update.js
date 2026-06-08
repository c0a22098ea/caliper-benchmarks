'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class Update extends OperationBase {
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
        this.simpleState.tokenId = 1; // トークンIDの初期値を1に設定（0はミントで使用済みのため）
    }

    async submitTransaction() {
        const tokenId = this.simpleState.tokenId++;
        
        // メタデータ(CID)の準備
        //const updatedCid = `123`; // タイムスタンプを追加してユニークにする
        const updatedCid = `ipfs://QmUpdatedNewCID-${this.workerIndex}-${tokenId}`;
        // --- 2. メタデータ更新 (updateTokenURI / ERC-5185) ---
        const updateRequest = {
            contract: 'MyERC5185',
            verb: 'updateTokenURI',
            args: [tokenId, updatedCid],
        };
        // 🔥 更新完了時（送信時）の値をコンソールに出力する
        console.log(`Worker ${this.workerIndex}: Completed Update for Token ${tokenId} with CID: ${updatedCid}`);
        await this.sutAdapter.sendRequests(updateRequest);

        
    }
}

function createWorkloadModule() {
    return new Update();
}

module.exports.createWorkloadModule = createWorkloadModule;