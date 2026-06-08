'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

const CONTRACT = 'databaseTransaction';

class NftMintOnce extends OperationBase {
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
        console.log(`Worker ${this.workerIndex}: Starting safeMint`);

        const mintArgs = this.simpleState.getMintArguments();
        const request = this.createConnectorRequest('safeMint', mintArgs, CONTRACT);
        const result = await this.sutAdapter.sendRequests(request);

        // Our SimpleState increments tokenId after preparing args; minted tokenId is previous value.
        const mintedTokenId = this.simpleState.currentTokenId - 1;
        
        this.currentTokenId++;
        console.log(`Worker ${this.workerIndex}: Minted tokenId (expected): ${mintedTokenId}`);
        console.log(`Worker ${this.workerIndex}: Mint transaction result: ${JSON.stringify(result)}`);

        return result;
    }
}

function createWorkloadModule() {
    return new NftMintOnce();
}

module.exports.createWorkloadModule = createWorkloadModule;
