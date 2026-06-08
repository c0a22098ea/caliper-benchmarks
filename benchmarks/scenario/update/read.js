'use strict';

const OperationBase = require('./utils/operation-base');
const SimpleState = require('./utils/simple-state');

class Read extends OperationBase {
    constructor() {
        super();
    }

    createSimpleState() {
        const accountsPerWorker = this.numberOfAccounts / this.totalWorkers;
        return new SimpleState(this.workerIndex, this.tokenId, accountsPerWorker);
    }

    async submitTransaction() {
        const tokenId = this.simpleState.tokenId++;
        const initialCid = `ipfs://QmZrgjx7yNqYhHk7KHA4jSS7yupD4erKWUegUSzr8wDr5k`;
        //const updatedCid = `123`; // タイムスタンプを追加してユニークにする
        const updatedCid = `ipfs://QmUpdatedNewCID-${this.workerIndex}-${tokenId}`;
        let count = 0;

        try {
            // --- 3. 整合性チェック (読み取り) ---
            const readRequest = {
                contract: 'MyERC5185',
                verb: 'tokenURI',
                args: [tokenId],
                readOnly: true // これを追加
            };

            const result = await this.sutAdapter.sendRequests(readRequest);
            const retrievedCid = result.status.result;

            // --- 4. 判定ロジック ---
            if (tokenId !== 1 && retrievedCid !== updatedCid) {
                let errorType = 'UNKNOWN_INCONSISTENCY';

                if (retrievedCid === initialCid) {
                    // Client 0 で更新したはずなのに、Client 1 ではまだ古い値が見えている状態
                    errorType = 'SYNC_DELAY_STALE_DATA';
                } else if (!retrievedCid || retrievedCid === '') {
                    // Client 1 にはまだトランザクション自体が届いていない可能性
                    errorType = 'PROPAGATION_MISSING';
                }

                const msg = `[${errorType}] Node .69 returned old/missing data for Token ${tokenId}. Expected: ${updatedCid}, Got: ${retrievedCid}`;
                count++;
                console.error(msg);

                // Failをわざと発生させる
                //throw new Error(msg);
                if (result && result.status) {
                    result.status.status = 'failed'; // 確実にFailとしてカウントさせる
                }
                
            
                return result; // エラーを throw せずにリターンして次のトークンへ進める
                
            }

            
        } catch (error) {
            console.log(`数数えてみたよ${count}`);
            console.error(`Error during read transaction for Token ${tokenId}:`, error);
            throw error;
        }
       
    }
}

function createWorkloadModule() {
    return new Read();
}

module.exports.createWorkloadModule = createWorkloadModule;