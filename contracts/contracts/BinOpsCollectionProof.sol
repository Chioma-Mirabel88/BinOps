// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BinOpsCollectionProof {
    address public owner;

    struct CollectionProof {
        bytes32 collectionReference;
        bytes32 evidenceHash;
        uint256 recordedAt;
        address verifier;
    }

    mapping(bytes32 => CollectionProof) private proofs;
    mapping(address => bool) public authorisedVerifiers;

    event VerifierAuthorised(address indexed verifier);
    event CollectionProofRecorded(
        bytes32 indexed collectionReference,
        bytes32 evidenceHash,
        uint256 recordedAt,
        address indexed verifier
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlyVerifier() {
        require(authorisedVerifiers[msg.sender], "Not authorised");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorisedVerifiers[msg.sender] = true;
    }

    function authoriseVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier");
        authorisedVerifiers[verifier] = true;
        emit VerifierAuthorised(verifier);
    }

    function recordProof(
        bytes32 collectionReference,
        bytes32 evidenceHash
    ) external onlyVerifier {
        require(collectionReference != bytes32(0), "Invalid reference");
        require(evidenceHash != bytes32(0), "Invalid evidence hash");
        require(
            proofs[collectionReference].recordedAt == 0,
            "Proof already recorded"
        );

        proofs[collectionReference] = CollectionProof({
            collectionReference: collectionReference,
            evidenceHash: evidenceHash,
            recordedAt: block.timestamp,
            verifier: msg.sender
        });

        emit CollectionProofRecorded(
            collectionReference,
            evidenceHash,
            block.timestamp,
            msg.sender
        );
    }

    function verifyProof(
        bytes32 collectionReference
    ) external view returns (CollectionProof memory) {
        require(
            proofs[collectionReference].recordedAt != 0,
            "Proof not found"
        );
        return proofs[collectionReference];
    }
}
