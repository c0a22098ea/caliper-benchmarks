'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

const CONTRACT = 'databaseTransaction';

class NftLogicalDelete extends OperationBase {
    constructor() {
        super();
        this.isDeleted = true;
        this.workerIndex = -1;
    }

    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(this.workerIndex, this.tokenId, accountsPerWorker);
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.workerIndex = workerIndex;
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.isDeleted = roundArguments.isDeleted ?? true;
    }

    async submitTransaction() {
        const tokenId = await this._resolveTargetTokenId();

        const request = {
            contract: 'databaseTransaction',
            verb: 'setDeleted',
            args: [tokenId, this.isDeleted],
            readOnly: false
        };

        console.log(`Worker ${this.workerIndex}: setDeleted(tokenId=${tokenId}, isDeleted=${this.isDeleted})`);
        return this.sutAdapter.sendRequests(request);
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
    return new NftLogicalDelete();
}

module.exports.createWorkloadModule = createWorkloadModule;
