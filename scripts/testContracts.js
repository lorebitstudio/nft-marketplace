require("dotenv").config();
const { ethers } = require("hardhat");

async function sendAndWait(promise, label) {
    const tx = await promise;
    const receipt = await tx.wait();
    console.log(`✅ ${label} — txHash: ${receipt.transactionHash} @ block ${receipt.blockNumber}`);
    await new Promise(r => setTimeout(r, 10_000));
    return receipt;
}

async function main() {
    const deployer = new ethers.Wallet(process.env.TESTNET_PRIVATE_KEY, ethers.provider);
    const seller = new ethers.Wallet(process.env.SELLER_KEY, ethers.provider);
    const buyer = new ethers.Wallet(process.env.BUYER_KEY, ethers.provider);

    console.log(`👷 Deployer: ${deployer.address}`);
    console.log(`🧑 Seller: ${seller.address}`);
    console.log(`🛒 Buyer: ${buyer.address}`);

    const projectToken = await ethers.getContractAt("ProjectToken", process.env.PROJECT_TOKEN);
    const myNFT = await ethers.getContractAt("MyNFT", process.env.MY_NFT);
    const marketplace = await ethers.getContractAt("Marketplace", process.env.MARKETPLACE);

    const mintAmount = ethers.parseEther("1000");
    await sendAndWait(
        projectToken.connect(deployer).mint(buyer.address, mintAmount),
        `Minted ${ethers.formatEther(mintAmount)} ProjectToken to buyer`
    );

    const nftOwner = await myNFT.owner();
    if (nftOwner !== deployer.address) {
        throw new Error(`❌ Deployer ${deployer.address} is NOT the owner of MyNFT! Owner is ${nftOwner}`);
    }

    const tokenId0 = 0;
    await sendAndWait(
        myNFT.connect(deployer).mint(seller.address, "ipfs://example-uri"),
        `Minted NFT #${tokenId0} to seller`
    );

    const actualOwner0 = await myNFT.ownerOf(tokenId0);
    if (actualOwner0 !== seller.address) {
        throw new Error(`❌ Mint failed! tokenId=${tokenId0} owner is ${actualOwner0}, expected ${seller.address}`);
    }
    console.log(`🎯 Verified: tokenId=${tokenId0} owner=${actualOwner0}`);

    await sendAndWait(
        myNFT.connect(seller).approve(marketplace.target, tokenId0),
        `Approved NFT #${tokenId0} for marketplace`
    );

    const price0 = ethers.parseEther("100");
    await sendAndWait(
        marketplace.connect(seller).list(myNFT.target, tokenId0, price0),
        `Listed NFT #${tokenId0} for ${ethers.formatEther(price0)} ProjectToken`
    );

    await sendAndWait(
        projectToken.connect(buyer).approve(marketplace.target, price0),
        `Buyer approved ${ethers.formatEther(price0)} ProjectToken`
    );

    await sendAndWait(
        marketplace.connect(buyer).buy(myNFT.target, tokenId0),
        `Buyer bought NFT #${tokenId0}`
    );

    // NFT #1 — mint & cancel
    const tokenId1 = 1;
    await sendAndWait(
        myNFT.connect(deployer).mint(seller.address, "ipfs://example-uri-2"),
        `Minted NFT #${tokenId1} to seller`
    );

    await sendAndWait(
        myNFT.connect(seller).approve(marketplace.target, tokenId1),
        `Approved NFT #${tokenId1} for marketplace`
    );

    const price1 = ethers.parseEther("150");
    await sendAndWait(
        marketplace.connect(seller).list(myNFT.target, tokenId1, price1),
        `Listed NFT #${tokenId1} for ${ethers.formatEther(price1)} ProjectToken`
    );

    await sendAndWait(
        marketplace.connect(seller).cancel(myNFT.target, tokenId1),
        `Seller canceled listing of NFT #${tokenId1}`
    );

    // platform fee
    await sendAndWait(
        marketplace.connect(deployer).setPlatformFee(300, buyer.address),
        `Platform fee updated to 300 bps & recipient to buyer`
    );

    // NFT #2 — royalties
    const tokenId2 = 2;
    await sendAndWait(
        myNFT.connect(deployer).mint(seller.address, "ipfs://royalty-uri"),
        `Minted NFT #${tokenId2} to seller`
    );

    await sendAndWait(
        myNFT.connect(deployer).setRoyaltyInfo(deployer.address, 500),
        `Set royalties: 5% to deployer`
    );

    await sendAndWait(
        myNFT.connect(seller).approve(marketplace.target, tokenId2),
        `Approved NFT #${tokenId2} for marketplace`
    );

    const royaltyPrice = ethers.parseEther("200");
    await sendAndWait(
        marketplace.connect(seller).list(myNFT.target, tokenId2, royaltyPrice),
        `Listed NFT #${tokenId2} for ${ethers.formatEther(royaltyPrice)} ProjectToken`
    );

    const sellerBefore = await projectToken.balanceOf(seller.address);
    const ownerBefore = await projectToken.balanceOf(deployer.address);
    const buyerBefore = await projectToken.balanceOf(buyer.address);

    await sendAndWait(
        projectToken.connect(buyer).approve(marketplace.target, royaltyPrice),
        `Buyer approved ${ethers.formatEther(royaltyPrice)} ProjectToken`
    );

    await sendAndWait(
        marketplace.connect(buyer).buy(myNFT.target, tokenId2),
        `Buyer bought NFT #${tokenId2} with royalties`
    );

    const sellerAfter = await projectToken.balanceOf(seller.address);
    const ownerAfter = await projectToken.balanceOf(deployer.address);
    const buyerAfter = await projectToken.balanceOf(buyer.address);

    const platformFee = royaltyPrice * BigInt(300) / BigInt(10000);
    const royaltyAmount = royaltyPrice * BigInt(500) / BigInt(10000);

    const buyerPaid = royaltyPrice;
    const buyerEarned = platformFee;
    const buyerNet = buyerAfter - buyerBefore;

    console.log(`✅ NFT #${tokenId2} sold with royalties:`);
    console.log(`  Seller got: ${ethers.formatEther(sellerAfter - sellerBefore)} ProjectToken`);
    console.log(`  Owner got (royalty): ${ethers.formatEther(ownerAfter - ownerBefore)} ProjectToken`);
    console.log(`  Buyer paid: ${ethers.formatEther(buyerPaid)} ProjectToken`);
    console.log(`  Buyer earned (platform fee): ${ethers.formatEther(buyerEarned)} ProjectToken`);
    console.log(`  Buyer net: ${ethers.formatEther(buyerNet)} ProjectToken`);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
