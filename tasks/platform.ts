import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import 'dotenv/config';

const PLATFORM_ADDRESS = `${process.env.PLATFORM_ADDRESS}`;

task("register", "Register new address")
    .addParam("address", "Sign up address")
    .addParam("referrer", "Referral address")
    .setAction(async (args, hre) => {
        const platform = await hre.ethers.getContractAt("ACDMPlatform", PLATFORM_ADDRESS);
        const signer = await hre.ethers.getSigner(args.address);
        await platform.connect(signer).register(args.referrer);
        console.log(`Signed up an address: ${args.address} with referrer ${args.referrer}.`);
    });

task("buy-acdm", "Buy ACDM tokens")
    .addParam("address", "Signer address")
    .addParam("amount", "Amount of ACDM tokens")
    .setAction(async (args, hre) => {
        const platform = await hre.ethers.getContractAt("ACDMPlatform", PLATFORM_ADDRESS);
        const signer = await hre.ethers.getSigner(args.address);
        await platform.connect(signer).buyACDM(args.amount);
        console.log(`Bought ${args.amount} tokens.`);
    });

task("start-sale", "Start sale round")
    .addParam("address", "Signer address")
    .setAction(async (args, hre) => {
        const platform = await hre.ethers.getContractAt("ACDMPlatform", PLATFORM_ADDRESS);
        const signer = await hre.ethers.getSigner(args.address);
        let tx = await platform.connect(signer).startSaleRound();
        console.log(`Sale round started.`);
    });

task("start-trade", "Start trade round")
    .addParam("address", "Signer address")
    .setAction(async (args, hre) => {
        const platform = await hre.ethers.getContractAt("ACDMPlatform", PLATFORM_ADDRESS);
        const signer = await hre.ethers.getSigner(args.address);
        await platform.connect(signer).startTradeRound();
        console.log(`Trade round started.`);
    });

task("add-order", "Add new order")
    .addParam("address", "Signer address")
    .addParam("acdm", "Amount of ACDM to sell")
    .addParam("eth", "Amount of ETH to sell")
    .setAction(async (args, hre) => {
        const platform = await hre.ethers.getContractAt("ACDMPlatform", PLATFORM_ADDRESS);
        const signer = await hre.ethers.getSigner(args.address);
        await platform.connect(signer).addOrder(args.acdm, args.eth);
        console.log(`Added new order for ${args.acdm} tokens.`);
    });

task("remove-order", "Remove order by ID")
    .addParam("address", "Signer address")
    .addParam("id", "Order ID").setAction(async (args, hre) => {
        const platform = await hre.ethers.getContractAt("ACDMPlatform", PLATFORM_ADDRESS);
        const signer = await hre.ethers.getSigner(args.address);
        await platform.connect(signer).removeOrder(args.id);
        console.log(`Removed order with id ${args.id}.`);
    });

task("redeem-order", "Redeem order by ID")
    .addParam("address", "Signer address")
    .addParam("amount", "Amount of ACDM tokens")
    .addParam("id", "Order ID")
    .setAction(async (args, hre) => {
        const platform = await hre.ethers.getContractAt("ACDMPlatform", PLATFORM_ADDRESS);
        const signer = await hre.ethers.getSigner(args.address);
        await platform.connect(signer).redeemOrder(args.amount, args.id);
        console.log(`Redeemed order with ID ${args.id}.`);
    });
