// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Marketplace is Ownable, ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price; // price in ProjectToken
    }

    IERC20 public immutable paymentToken;

    // nftContract => tokenId => listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    uint96 public platformFeeBps = 250; // e.g., 2.5%
    address public feeRecipient;

    event Listed(address indexed nft, uint256 indexed tokenId, address indexed seller, uint256 price);
    event Purchased(address indexed nft, uint256 indexed tokenId, address indexed buyer, uint256 price);
    event Canceled(address indexed nft, uint256 indexed tokenId);

    constructor(address _paymentToken, address _feeRecipient) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
    }

    function list(address nft, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be > 0");
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);

        listings[nft][tokenId] = Listing({ seller: msg.sender, price: price });

        emit Listed(nft, tokenId, msg.sender, price);
    }

    function cancel(address nft, uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[nft][tokenId];
        require(listing.seller == msg.sender, "Not seller");

        delete listings[nft][tokenId];
        IERC721(nft).transferFrom(address(this), msg.sender, tokenId);

        emit Canceled(nft, tokenId);
    }

    function buy(address nft, uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[nft][tokenId];
        require(listing.price > 0, "Not listed");

        uint256 fee = (listing.price * platformFeeBps) / 10_000;
        uint256 royaltyAmount = 0;
        address royaltyReceiver;

        // check for royalties
        if (IERC165(nft).supportsInterface(type(IERC2981).interfaceId)) {
            (royaltyReceiver, royaltyAmount) = IERC2981(nft).royaltyInfo(tokenId, listing.price);
            require(royaltyAmount + fee <= listing.price, "Royalties + fee exceed price");
        }

        uint256 sellerProceeds = listing.price - fee - royaltyAmount;

        delete listings[nft][tokenId];

        if (sellerProceeds > 0) {
            require(paymentToken.transferFrom(msg.sender, listing.seller, sellerProceeds), "Payment to seller failed");
        }

        if (fee > 0) {
            require(paymentToken.transferFrom(msg.sender, feeRecipient, fee), "Payment of fee failed");
        }

        if (royaltyAmount > 0) {
            require(paymentToken.transferFrom(msg.sender, royaltyReceiver, royaltyAmount), "Payment of royalties failed");
        }

        IERC721(nft).transferFrom(address(this), msg.sender, tokenId);

        emit Purchased(nft, tokenId, msg.sender, listing.price);
    }

    function setPlatformFee(uint96 bps, address recipient) external onlyOwner {
        require(bps <= 1000, "Fee too high");
        platformFeeBps = bps;
        feeRecipient = recipient;
    }
}
