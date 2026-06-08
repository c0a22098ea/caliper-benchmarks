// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

/**
 * @title DatabaseTransaction
 * @dev update.solの機能に削除（burn）とIPFS削除要求イベントを追加したERC721。
 */
contract DatabaseTransaction is ERC721Enumerable, ERC721URIStorage, ERC721Burnable, ERC2981 {
	uint256 private _tokenIdCounter;

	bytes4 private constant ERC4906_INTERFACE_ID = bytes4(0x49064906);

	struct MetadataHistory {
		string uri;
		uint256 timestamp;
		address updatedBy;
		uint256 version;
	}

	mapping(uint256 => MetadataHistory[]) private _metadataHistories;
	mapping(uint256 => uint256) private _currentMetadataVersion;

	mapping(uint256 => string) private _latestCID;
	mapping(uint256 => string) private _prevCID;
	mapping(uint256 => bool) private _isDeleted;

	error InvalidMetadataVersion(uint256 tokenId, uint256 currentVersion, uint256 providedVersion);

	event MetadataUpdated(
		uint256 indexed tokenId,
		string oldURI,
		string newURI,
		address indexed updatedBy,
		uint256 timestamp,
		uint256 version
	);

	event NFTBurned(uint256 indexed tokenId, address indexed burner, string uri);
	event IPFSUnpinRequested(uint256 indexed tokenId, string cid, address indexed requester);

	constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

	function safeMint(address to, string memory tokenURI_) public returns (uint256) {
		uint256 tokenId = _tokenIdCounter;
		_safeMint(to, tokenId);
		_setTokenURI(tokenId, tokenURI_);
		_tokenIdCounter += 1;

		_currentMetadataVersion[tokenId] = 1;
		_metadataHistories[tokenId].push(
			MetadataHistory({uri: tokenURI_, timestamp: block.timestamp, updatedBy: _msgSender(), version: 1})
		);

		_prevCID[tokenId] = "";
		_latestCID[tokenId] = _extractCID(tokenURI_);
		_isDeleted[tokenId] = false;

		return tokenId;
	}

	function updateTokenURI(uint256 tokenId, string memory newURI, uint256 newVersion) public {
		require(_exists(tokenId), "ERC5185: URI update for nonexistent token");

		uint256 currentVersion = _currentMetadataVersion[tokenId];
		if (newVersion <= currentVersion) {
			revert InvalidMetadataVersion(tokenId, currentVersion, newVersion);
		}

		_updateTokenURIInternal(tokenId, newURI, newVersion);
	}

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

			_updateTokenURIInternal(tokenIds[i], newURIs[i], newVersions[i]);

			if (tokenIds[i] < fromTokenId) fromTokenId = tokenIds[i];
			if (tokenIds[i] > toTokenId) toTokenId = tokenIds[i];
		}

		emit BatchMetadataUpdate(fromTokenId, toTokenId);
	}

	function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) public {
		require(fromTokenId <= toTokenId, "ERC5185: invalid range");
		emit BatchMetadataUpdate(fromTokenId, toTokenId);
	}

	function deleteNFT(uint256 tokenId) public {
		require(_exists(tokenId), "BurnableNFT: token does not exist");
		require(ownerOf(tokenId) == _msgSender(), "BurnableNFT: caller is not the owner");

		string memory uri = tokenURI(tokenId);
		string memory cid = _extractCID(uri);
		address requester = _msgSender();

		burn(tokenId);
		emit NFTBurned(tokenId, requester, uri);
		emit IPFSUnpinRequested(tokenId, cid, requester);
	}

	function getCurrentMetadataVersion(uint256 tokenId) public view returns (uint256) {
		require(_exists(tokenId), "ERC5185: query for nonexistent token");
		return _currentMetadataVersion[tokenId];
	}

	function getMetadataHistory(uint256 tokenId)
		public
		view
		returns (string[] memory uris, uint256[] memory timestamps, address[] memory updaters, uint256[] memory versions)
	{
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

	function getTotalSupply() public view returns (uint256) {
		return _tokenIdCounter;
	}

	function getBalance(address owner) public view returns (uint256) {
		return balanceOf(owner);
	}

	// ============ Overrides ============

	function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
		return super.tokenURI(tokenId);
	}

	function _update(address to, uint256 tokenId, address auth)
		internal
		override(ERC721, ERC721Enumerable)
		returns (address)
	{
		return super._update(to, tokenId, auth);
	}

	function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
		super._increaseBalance(account, value);
	}

	function supportsInterface(bytes4 interfaceId)
		public
		view
		override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
		returns (bool)
	{
		return interfaceId == ERC4906_INTERFACE_ID || super.supportsInterface(interfaceId);
	}

	// ============ Internals ============

	function _updateTokenURIInternal(uint256 tokenId, string memory newURI, uint256 newVersion) internal {
		string memory oldURI = tokenURI(tokenId);
		_setTokenURI(tokenId, newURI);

		_currentMetadataVersion[tokenId] = newVersion;
		_metadataHistories[tokenId].push(
			MetadataHistory({uri: newURI, timestamp: block.timestamp, updatedBy: _msgSender(), version: newVersion})
		);

		_prevCID[tokenId] = _latestCID[tokenId];
		_latestCID[tokenId] = _extractCID(newURI);
		_isDeleted[tokenId] = false;

		emit MetadataUpdated(tokenId, oldURI, newURI, _msgSender(), block.timestamp, newVersion);
	}

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

	function _exists(uint256 tokenId) internal view returns (bool) {
		return _ownerOf(tokenId) != address(0);
	}
}
