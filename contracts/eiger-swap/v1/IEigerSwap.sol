//SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface IEigerSwap {
  /// @dev swaps the `msg.value` Ether to at least `minAmount` of tokens in `address`, or reverts
  /// @param token The address of ERC-20 token to swap
  /// @param minAmount The minimum amount of tokens transferred to msg.sender
  /// @return The actual amount of transferred tokens
  function swapEtherToToken(address token, uint minAmount) external payable returns (uint);
}
