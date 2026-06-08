// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

/**
 * @title update
 * @dev ERC721 NFTコントラクトにERC5185/ERC4906（Metadata Update Extension）を実装
 *
 * 機能:
 * - NFTの発行（ミント）
 * - メタデータURIの更新とMetadataUpdateイベントの発行
 * - バッチメタデータ更新とBatchMetadataUpdateイベントの発行
 * - CID管理（最新/直前）
 * - 論理削除フラグ
 * - ロイヤリティ設定（ERC2981）
 */
contract update is ERC721Enumerable, ERC721URIStorage, ERC2981 {
    /// @dev tokenIdを自動インクリメントするためのカウンター
    uint256 private _tokenIdCounter;

    /// @dev ERC4906のインターフェースID (0x49064906)
    bytes4 private constant ERC4906_INTERFACE_ID = bytes4(0x49064906);

    /// @dev メタデータ更新履歴を保存する構造体
    struct MetadataHistory {
        string uri;
        uint256 timestamp;
        address updatedBy;
        uint256 version;
    }

    /// @dev 各tokenIdの最新CID（tokenURIのIPFSハッシュ部分）
    mapping(uint256 => string) private _latestCID;
    /// @dev 各tokenIdの直前のCID
    mapping(uint256 => string) private _prevCID;
    /// @dev 各tokenIdの論理削除フラグ
    mapping(uint256 => bool) private _isDeleted;

    /**
     * @dev URIからCID部分(ipfs://以降)を抽出
     */
    function _extractCID(string memory uri) internal pure returns (string memory) {
        bytes memory b = bytes(uri);
        bytes memory prefix = bytes("ipfs://");
        if (b.length <= prefix.length) return "";
        for (uint256 i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) return "";
        }
        bytes memory cid = new bytes(b.length - prefix.length);
        for (uint256 i = 0; i < cid.length; i++) {
            cid[i] = b[i + prefix.length];
        }
        return string(cid);
    }

    /// @dev tokenIdごとのメタデータ更新履歴
    mapping(uint256 => MetadataHistory[]) private _metadataHistories;

    /// @dev tokenIdごとの現在のメタデータバージョン
    mapping(uint256 => uint256) private _currentMetadataVersion;

    /// @dev バージョンが古い場合のカスタムエラー
    error InvalidMetadataVersion(uint256 tokenId, uint256 currentVersion, uint256 providedVersion);

    /// @dev メタデータが更新されたときに発行されるカスタムイベント（詳細情報付き）
    event MetadataUpdated(
        uint256 indexed tokenId,
        string oldURI,
        string newURI,
        address indexed updatedBy,
        uint256 timestamp,
        uint256 version
    );

    /**
     * @dev コンストラクタ
     * @param _name NFTコレクションの名前
     * @param _symbol NFTコレクションのシンボル
     */
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    /**
     * @dev NFTを作成する関数
     * @param to NFTの受取アドレス
     * @param _tokenURI メタデータのURI（IPFS CID等）
     * @return tokenId 作成されたNFTのtokenId
     */
    function safeMint(address to, string memory _tokenURI) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        _tokenIdCounter += 1;

        _currentMetadataVersion[tokenId] = 1;

        // 初期メタデータを履歴に記録
        _metadataHistories[tokenId].push(MetadataHistory({
            uri: _tokenURI,
            timestamp: block.timestamp,
            updatedBy: _msgSender(),
            version: 1
        }));

        _prevCID[tokenId] = "";
        _latestCID[tokenId] = _extractCID(_tokenURI);
        _isDeleted[tokenId] = false;

        return tokenId;
    }

    /**
     * @dev ERC5185準拠: 単一のNFTのメタデータURIを更新する
     * @param tokenId 更新するNFTのtokenId
     * @param newURI 新しいメタデータURI
     * @param newVersion 新しいメタデータバージョン
     *
     * 要件:
     * - tokenIdが存在すること
     * - 新しいバージョンが現在より大きいこと
     */
    function updateTokenURI(uint256 tokenId, string memory newURI, uint256 newVersion) public {
        require(_exists(tokenId), "ERC5185: URI update for nonexistent token");

        uint256 currentVersion = _currentMetadataVersion[tokenId];
        if (newVersion <= currentVersion) {
            revert InvalidMetadataVersion(tokenId, currentVersion, newVersion);
        }

        string memory oldURI = tokenURI(tokenId);
        _setTokenURI(tokenId, newURI);
        _currentMetadataVersion[tokenId] = newVersion;

        // メタデータ履歴を記録
        _metadataHistories[tokenId].push(MetadataHistory({
            uri: newURI,
            timestamp: block.timestamp,
            updatedBy: _msgSender(),
            version: newVersion
        }));

        _prevCID[tokenId] = _latestCID[tokenId];
        _latestCID[tokenId] = _extractCID(newURI);
        _isDeleted[tokenId] = false;

        // ERC5185/ERC4906 MetadataUpdateイベントを発行
        emit MetadataUpdate(tokenId);

        // カスタムの詳細イベントも発行
        emit MetadataUpdated(tokenId, oldURI, newURI, _msgSender(), block.timestamp, newVersion);
    }

    /**
     * @dev ERC5185準拠: 複数のNFTのメタデータURIをバッチ更新する
     * @param tokenIds 更新するNFTのtokenId配列
     * @param newURIs 新しいメタデータURI配列
     * @param newVersions 新しいメタデータバージョン配列
     *
     * 要件:
     * - tokenIds配列とnewURIs配列の長さが同じであること
     * - tokenIds配列とnewVersions配列の長さが同じであること
     * - 各tokenIdが存在すること
     */
    function batchUpdateTokenURIs(
        uint256[] memory tokenIds,
        string[] memory newURIs,
        uint256[] memory newVersions
    ) public {
        require(tokenIds.length == newURIs.length, "ERC5185: arrays length mismatch");
        require(tokenIds.length == newVersions.length, "ERC5185: version array length mismatch");
        require(tokenIds.length > 0, "ERC5185: empty arrays");

        uint256 fromTokenId = type(uint256).max;
        uint256 toTokenId = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "ERC5185: URI update for nonexistent token");

            uint256 currentVersion = _currentMetadataVersion[tokenIds[i]];
            if (newVersions[i] <= currentVersion) {
                revert InvalidMetadataVersion(tokenIds[i], currentVersion, newVersions[i]);
            }

            string memory oldURI = tokenURI(tokenIds[i]);
            _setTokenURI(tokenIds[i], newURIs[i]);
            _currentMetadataVersion[tokenIds[i]] = newVersions[i];

            // メタデータ履歴を記録
            _metadataHistories[tokenIds[i]].push(MetadataHistory({
                uri: newURIs[i],
                timestamp: block.timestamp,
                updatedBy: _msgSender(),
                version: newVersions[i]
            }));

            _prevCID[tokenIds[i]] = _latestCID[tokenIds[i]];
            _latestCID[tokenIds[i]] = _extractCID(newURIs[i]);
            _isDeleted[tokenIds[i]] = false;

            // カスタムの詳細イベントを発行
            emit MetadataUpdated(tokenIds[i], oldURI, newURIs[i], _msgSender(), block.timestamp, newVersions[i]);

            // 範囲の計算
            if (tokenIds[i] < fromTokenId) fromTokenId = tokenIds[i];
            if (tokenIds[i] > toTokenId) toTokenId = tokenIds[i];
        }

        // ERC5185/ERC4906 BatchMetadataUpdateイベントを発行
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    /**
     * @dev 現在のメタデータバージョンを取得する
     * @param tokenId バージョンを取得するNFTのtokenId
     * @return 現在のバージョン番号
     */
    function getCurrentMetadataVersion(uint256 tokenId) public view returns (uint256) {
        require(_exists(tokenId), "ERC5185: query for nonexistent token");
        return _currentMetadataVersion[tokenId];
    }

    /**
     * @dev ERC5185準拠: 連続する範囲のNFTのメタデータ更新を通知する
     * @param fromTokenId 更新範囲の開始tokenId
     * @param toTokenId 更新範囲の終了tokenId
     *
     * このメソッドは実際のメタデータを変更せず、イベントのみを発行します。
     * オフチェーンでメタデータが更新された場合（例: IPFSの内容が変更された場合）に使用します。
     */
    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) public {
        require(fromTokenId <= toTokenId, "ERC5185: invalid range");
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    /**
     * @dev 特定のNFTのメタデータ更新履歴を取得する
     * @param tokenId 履歴を取得するNFTのtokenId
     * @return uris URIの配列
     * @return timestamps タイムスタンプの配列
     * @return updaters 更新者アドレスの配列
     */
    function getMetadataHistory(uint256 tokenId) public view returns (
        string[] memory uris,
        uint256[] memory timestamps,
        address[] memory updaters,
        uint256[] memory versions
    ) {
        require(_exists(tokenId), "ERC5185: query for nonexistent token");

        MetadataHistory[] storage histories = _metadataHistories[tokenId];
        uint256 length = histories.length;

        uris = new string[](length);
        timestamps = new uint256[](length);
        updaters = new address[](length);
        versions = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            uris[i] = histories[i].uri;
            timestamps[i] = histories[i].timestamp;
            updaters[i] = histories[i].updatedBy;
            versions[i] = histories[i].version;
        }

        return (uris, timestamps, updaters, versions);
    }

    /**
     * @dev 特定のNFTのメタデータ更新回数を取得する
     * @param tokenId カウントを取得するNFTのtokenId
     * @return count 更新回数
     */
    function getMetadataUpdateCount(uint256 tokenId) public view returns (uint256) {
        require(_exists(tokenId), "ERC5185: query for nonexistent token");
        return _metadataHistories[tokenId].length;
    }

    function getLatestCID(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "ERC5185: query for nonexistent token");
        return _latestCID[tokenId];
    }

    function getPrevCID(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "ERC5185: query for nonexistent token");
        return _prevCID[tokenId];
    }

    function getDeleted(uint256 tokenId) public view returns (bool) {
        require(_exists(tokenId), "ERC5185: query for nonexistent token");
        return _isDeleted[tokenId];
    }

    function setDeleted(uint256 tokenId, bool isDeleted) public {
        require(_exists(tokenId), "ERC5185: query for nonexistent token");
        _isDeleted[tokenId] = isDeleted;
    }

    // ============ オーバーライド関数 ============

    /**
     * @dev tokenURIを返却する
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev NFTの作成やtransfer時に呼び出されるhook
     */
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev balanceOf等で使用されるhook
     */
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    /**
     * @dev ERC-165 supportsInterface
     * ERC4906のインターフェースIDもサポートとして宣言
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721Enumerable, ERC721URIStorage, ERC2981) returns (bool) {
        return interfaceId == ERC4906_INTERFACE_ID || super.supportsInterface(interfaceId);
    }

    /**
     * @dev トークンが存在するかどうかを確認する内部関数
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @dev 呼び出し者がトークンの所有者または承認者かどうかを確認する内部関数
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }
}
