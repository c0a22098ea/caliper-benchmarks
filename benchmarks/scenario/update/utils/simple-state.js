'use strict';

const Dictionary = 'abcdefghijklmnopqrstuvwxyz';
const HexCharacters = '0123456789abcdef';

class SimpleState {
    constructor(workerIndex, tokenId = 101, accounts = 0) {
        this.accountsGenerated = accounts;
        this.tokenId = tokenId + (workerIndex * 1000);
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
            tokenId: this.tokenId-1,
        };
        this.tokenId++;
        return args;
    }

    getMintArguments() {
        const initialCid = `ipfs://QmZrgjx7yNqYhHk7KHA4jSS7yupD4erKWUegUSzr8wDr5k`;
        const args = {
            to: "0xd1cf9d73a91de6630c2bb068ba5fddf9f0deac09",
            _tokenURI: initialCid,
        };
        this.tokenId++;
        return args;
    }
}

module.exports = SimpleState;
