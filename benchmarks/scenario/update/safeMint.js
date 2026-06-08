'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class Mint extends OperationBase {
    constructor() {
        super();
    }

    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(this.workerIndex, this.tokenId, accountsPerWorker);
    }

    async submitTransaction() {
        
        // --- 1. NFT発行 (safeMint) ---
        // MyERC5185を使用して発行
        // const mintRequest = {
        //     contract: 'MyERC5185',
        //     verb: 'safeMint',
        //     args: ["0xd1cf9d73a91de6630c2bb068ba5fddf9f0deac09", initialCid],
        // };
        // await this.sutAdapter.sendRequests(mintRequest);

        const mintArgs = this.simpleState.getMintArguments();
        const result = await this.sutAdapter.sendRequests(this.createConnectorRequest('safeMint', mintArgs));
        console.log(`Worker ${this.workerIndex}: Result: ${JSON.stringify(result)}`);
        return result;
    }
}

function createWorkloadModule() {
    return new Mint();
}

module.exports.createWorkloadModule = createWorkloadModule;