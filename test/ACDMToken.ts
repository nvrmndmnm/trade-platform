import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";

const { expect } = require("chai");

describe("Token contract", () => {
    const name: String = "ACDM Token";
    const symbol: String = "ACDM";

    let Token: ContractFactory;
    let token: Contract;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;

    beforeEach(async () => {
        Token = await ethers.getContractFactory("ACDMToken");
        [owner, addr1, addr2] = await ethers.getSigners();

        token = await Token.deploy("ACDM Token", "ACDM");
    });

    describe("Deployment", () => {
        it("Should have correct name", async () => {
            expect(await token.name()).to.equal(name);
        });
        it("Should have correct symbol", async () => {
            expect(await token.symbol()).to.equal(symbol);
        });
    });

    describe("Minting and burning tokens", () => {
        it("Should let the owner mint new tokens", async () => {
            const initialSupply = await token.totalSupply();
            const initialBalance = await token.balanceOf(owner.address);
            await token.mint(owner.address, 50);
            expect(await token.balanceOf(owner.address)).to.equal(initialBalance.add(50));
            expect(await token.totalSupply()).to.equal(initialSupply.add(50));
        });

        it("Should let the owner burn tokens", async () => {
            await token.mint(owner.address, 100);
            const initialSupply = await token.totalSupply();
            const initialBalance = await token.balanceOf(owner.address);
            await token.burn(owner.address, 50);
            expect(await token.balanceOf(owner.address)).to.equal(initialBalance.sub(50));
            expect(await token.totalSupply()).to.equal(initialSupply.sub(50));
        });
    });
});