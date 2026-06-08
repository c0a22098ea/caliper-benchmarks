'use strict';

const Dictionary = 'abcdefghijklmnopqrstuvwxyz';
const HexCharacters = '0123456789abcdef';

class SimpleState {
    constructor(workerIndex, tokenId = 0, accounts = 0) {
        this.accountsGenerated = accounts;
        this.baseTokenId = tokenId; // config.yamlから渡されたbaseTokenId
        this.currentTokenId = tokenId; // 現在のtokenId（mintのたびにインクリメント）
        this.updateCounter = 2; // update用のカウンター
        this.accountPrefix = this._get26Num(workerIndex);
    }

    _get26Num(number){
        let result = '';

        while(number > 0) {
            result += Dictionary.charAt(number % Dictionary.length);
            number = parseInt(number / Dictionary.length);
        }

        return result;
    }

    getTransferArguments() {
        // 乱数を用いて新しいウォレットアドレスを生成
        const toAddress = '0x' + Array.from({length:40}, () => HexCharacters[Math.floor(Math.random() * HexCharacters.length)]).join('');
        const args = {
            from: "0xd1cf9d73a91de6630c2bb068ba5fddf9f0deac09",
            to: toAddress,
            tokenId: this.currentTokenId,
        };
        return args;
    }

    getMintArguments() {
        const initialCid = `ipfs://QmZrgjx7yNqYhHk7KHA4jSS7yupD4erKWUegUSzr8wDr5k`;
        const args = {
            to: "0xd1cf9d73a91de6630c2bb068ba5fddf9f0deac09",
            _tokenURI: initialCid,
        };
        // mintが成功するとコントラクト側でtokenIdがインクリメントされるので、こちらも同期
        const currentId = this.currentTokenId;
        this.currentTokenId++;
        return args;
    }

    // 現在のtokenIdを取得（update等で使用）
    //get tokenId() {
    //    return this.currentTokenId - 1; // 最後にmintされたtokenId
    //}

    // update用に順次異なるtokenIdを取得
    getNextUpdateTokenId() {
        const tokenId = this.updateCounter;
        this.updateCounter++;
        return tokenId;
    }
}

module.exports = SimpleState;
