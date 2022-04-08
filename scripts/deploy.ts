import { ethers } from "hardhat";
import 'dotenv/config';

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const Token = await ethers.getContractFactory("ACDMToken");
    const token = await Token.deploy("ACDM Token", "ACDM");
    await token.deployed();

    console.log("Token address: ", token.address);

    const Platform = await ethers.getContractFactory("ACDMPlatform");
    const platform = await Platform.deploy(token.address, 259200);
    await platform.deployed();

    await token.transferOwnership(platform.address);
    console.log("ACDMPlatform contract address:", platform.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });