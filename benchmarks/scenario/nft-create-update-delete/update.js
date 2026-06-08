'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

const CONTRACT = 'databaseTransaction';

class Update extends OperationBase {
    constructor() {
        super();
        this.workerIndex = -1;
        this.version = undefined;
        this.currentTokenId = 0;
    }

    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(this.workerIndex, this.tokenId, accountsPerWorker);
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.workerIndex = workerIndex;
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

                this.version = typeof roundArguments.version !== 'undefined' ? roundArguments.version : this.simpleState.getNextUpdateTokenId();
                this.currentTokenId = this.tokenId;
    }

    async submitTransaction() {
        const tokenId = await this._resolveTargetTokenId();
        
        // メタデータ(CID)の準備
        //const updatedCid = `123`; // タイムスタンプを追加してユニークにする
        const updatedCid = `ipfs://QmUpdatedNewCID-${this.workerIndex}-${tokenId}`;

        const updateRequest = {
            contract: 'databaseTransaction',
            verb: 'updateTokenURI',
            args: [tokenId, updatedCid, this.version]
        };

        console.log(JSON.stringify(updateRequest, null, 2));
        console.log(`Worker ${this.workerIndex}: Completed Update for Token ${tokenId} with CID: ${updatedCid} (version=${this.version})`);

        const result = await this.sutAdapter.sendRequests(updateRequest);
        this.currentTokenId++;
        return result;
    }

    async _resolveTargetTokenId() {
        const totalSupply = await this._getTotalSupply();
        if (totalSupply > 0) {
            return totalSupply - 1;
        }

        return this.tokenId;
    }

    async _getTotalSupply() {
        const request = {
            contract: 'databaseTransaction',
            verb: 'getTotalSupply',
            args: [],
            readOnly: true
        };

        const result = await this.sutAdapter.sendRequests(request);
        const rawValue = result?.status?.result ?? result?.result ?? result;

        if (typeof rawValue === 'number') {
            return rawValue;
        }

        if (typeof rawValue === 'string') {
            return Number(rawValue);
        }

        if (rawValue && typeof rawValue.toString === 'function') {
            return Number(rawValue.toString());
        }

        throw new Error('Failed to read total supply');
    }
}

function createWorkloadModule() {
    return new Update();
}

module.exports.createWorkloadModule = createWorkloadModule;