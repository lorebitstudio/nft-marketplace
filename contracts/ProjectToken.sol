// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProjectToken
 * @dev ERC20 token with pausing, burn, and capped supply.
 */
contract ProjectToken is ERC20, Pausable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    constructor() ERC20("Project Token", "PRJ") Ownable(msg.sender) {}

    /// @notice Mint tokens to an address. Only owner can call. Respects the max supply.
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
    }

    /// @notice Pause all transfers
    function pause() public onlyOwner {
        _pause();
    }

    /// @notice Unpause all transfers
    function unpause() public onlyOwner {
        _unpause();
    }

    /// @notice Override transfer to respect pause
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    /// @notice Override transferFrom to respect pause
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    /// @notice Burn tokens from sender
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /// @notice Burn tokens from another account using allowance
    function burnFrom(address from, uint256 amount) public {
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _burn(from, amount);
    }
}
