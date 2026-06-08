'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class SafeMintTest extends OperationBase {
    constructor() {
        super();
        this.workerIndex = -1;
        this.txCounter = 0;
    }

    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(this.workerIndex, this.tokenId, accountsPerWorker);
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.workerIndex = workerIndex;
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        console.log(`Worker ${this.workerIndex}: Starting safeMint for CID fencing mechanism test`);
    }

    async submitTransaction() {
        console.log(`Worker ${this.workerIndex}: Starting safeMint for CID fencing mechanism test`);
        
        const mintArgs = await this.simpleState.getMintArguments();
        const result = await this.sutAdapter.sendRequests(this.createConnectorRequest('safeMint', mintArgs));
        const tokenId = this.simpleState.tokenId;
        console.log(`Worker ${this.workerIndex}: Minted tokenId: ${tokenId}`);
        
        console.log(`Worker ${this.workerIndex}: safeMint completed - NFT ready for CID fencing testing`);
        return result;
    }
}

function createWorkloadModule() {
    return new SafeMintTest();
}

module.exports.createWorkloadModule = createWorkloadModule;