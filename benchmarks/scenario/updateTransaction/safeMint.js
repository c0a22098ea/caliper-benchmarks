'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class MintForOrderTest extends OperationBase {
    constructor() {
        super();
    }

    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(this.workerIndex, this.tokenId, accountsPerWorker);
    }

    async submitTransaction() {
        console.log(`Worker ${this.workerIndex}: Starting safeMint for order revert test`);
        
        const mintArgs = this.simpleState.getMintArguments();
        const result = await this.sutAdapter.sendRequests(this.createConnectorRequest('safeMint', mintArgs, 'updateTransaction'));
        const tokenId = this.simpleState.tokenId;
        console.log(`Worker ${this.workerIndex}: Minted tokenId: ${tokenId}`);
        
        console.log(`Worker ${this.workerIndex}: safeMint completed - NFT ready for order testing`);
        return result;
    }
}

function createWorkloadModule() {
    return new MintForOrderTest();
}

module.exports.createWorkloadModule = createWorkloadModule;