// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * ClovaPoints
 * - Non-transferable points ledger
 * - Users call activate() themselves (unique-wallet metric)
 * - Users can claim points with an issuer signature (backend authorizes; user pays gas)
 */
contract ClovaPoints is EIP712 {
  using ECDSA for bytes32;

  event Activated(address indexed user, uint256 timestamp);
  event PointsClaimed(
    address indexed user,
    uint256 amount,
    bytes32 indexed reason,
    bytes32 indexed ref,
    uint256 newTotal
  );

  bytes32 public constant CLAIM_TYPEHASH =
    keccak256("Claim(address user,uint256 amount,bytes32 reason,bytes32 ref,uint256 deadline)");

  address public immutable issuer;
  uint256 public immutable activationBonus;

  mapping(address => bool) public activated;
  mapping(address => uint256) public points;
  mapping(bytes32 => bool) public usedRef;

  constructor(address _issuer, uint256 _activationBonus) EIP712("ClovaPoints", "1") {
    require(_issuer != address(0), "issuer=0");
    issuer = _issuer;
    activationBonus = _activationBonus;
  }

  function activate() external {
    require(!activated[msg.sender], "already activated");
    activated[msg.sender] = true;

    if (activationBonus > 0) {
      points[msg.sender] += activationBonus;
      emit PointsClaimed(
        msg.sender,
        activationBonus,
        keccak256("ACTIVATION_BONUS"),
        bytes32(uint256(uint160(msg.sender))),
        points[msg.sender]
      );
    }

    emit Activated(msg.sender, block.timestamp);
  }

  function claim(
    uint256 amount,
    bytes32 reason,
    bytes32 ref,
    uint256 deadline,
    bytes calldata signature
  ) external {
    require(activated[msg.sender], "not activated");
    require(block.timestamp <= deadline, "expired");
    require(!usedRef[ref], "ref used");

    bytes32 digest = _hashTypedDataV4(
      keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, amount, reason, ref, deadline))
    );

    address recovered = digest.recover(signature);
    require(recovered == issuer, "bad sig");

    usedRef[ref] = true;
    points[msg.sender] += amount;

    emit PointsClaimed(msg.sender, amount, reason, ref, points[msg.sender]);
  }
}
