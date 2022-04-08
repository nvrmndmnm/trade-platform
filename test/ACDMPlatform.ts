import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";

const { expect } = require("chai");

describe("Platform contract", () => {
    let Token: ContractFactory;
    let Platform: ContractFactory;
    let token: Contract;
    let platform: Contract;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;
    let addr4: SignerWithAddress;
    let addr5: SignerWithAddress;

    beforeEach(async () => {
        Token = await ethers.getContractFactory("ACDMToken");
        Platform = await ethers.getContractFactory("ACDMPlatform");
        [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();


        token = await Token.deploy("ACDM Token", "ACDM");
        platform = await Platform.deploy(token.address, 1000);
        token.mint(platform.address, 100000);
        token.transferOwnership(platform.address);

    });

    describe("Deployment", () => {
        it("Should have correct initial values", async () => {
            expect(await platform.token()).to.equal(token.address);
            expect(await platform.tradeACDMVolume()).to.equal(100000);
            expect(await ethers.provider.getBalance(platform.address)).to.equal(0);
        });
    });

    describe("Register, buy, withdraw", () => {
        it("Should register referral", async () => {
            await platform.connect(addr1).register(addr2.address);
        });
        it("Should revert referring already registered address", async () => {
            await platform.connect(addr1).register(addr2.address);
            await expect(platform.connect(addr1).register(addr3.address))
                .to.be.revertedWith("This address already has a referrer");
        });
        it("Should revert referring yourself", async () => {
            await expect(platform.connect(addr1).register(addr1.address))
                .to.be.revertedWith("Cannot refer yourself");
        });

        it("Should buy ACDM tokens", async () => {
            let initialPlatformBalance = await ethers.provider.getBalance(platform.address);
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            expect(await token.balanceOf(addr1.address)).to.equal(10000);
            expect(await platform.tradeACDMVolume()).to.equal(90000);
            expect(await ethers.provider.getBalance(platform.address))
                .to.equal(initialPlatformBalance.add(ethers.utils.parseEther("0.1")));
        });
        it("Should revert buying at trade round", async () => {
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await expect(platform.connect(addr2).buyACDM(
                10000,
                { value: ethers.utils.parseEther("0.1") }
            )).to.be.revertedWith("Cannot buy ACDM tokens during trade round");
        });
        it("Should revert buying more than supply", async () => {
            await expect(platform.connect(addr1).buyACDM(
                110000,
                { value: ethers.utils.parseEther("1.1") }
            )).to.be.revertedWith("Cannot buy more tokens than supply");
        });
        it("Should revert buying at lower price", async () => {
            await expect(platform.connect(addr1).buyACDM(
                10000,
                { value: ethers.utils.parseEther("0.01") }
            )).to.be.revertedWith("Not enough ETH");
        });

        it("Should withdraw ETH", async () => {
            await platform.connect(addr1).buyACDM
                (100000,
                    { value: ethers.utils.parseEther("1") }
                );
            let initialPlatformBalance = await ethers.provider.getBalance(platform.address);
            await platform.connect(owner).withdrawETH(owner.address, ethers.utils.parseEther("0.1"));
            expect(await ethers.provider.getBalance(platform.address))
                .to.equal(initialPlatformBalance.sub(ethers.utils.parseEther("0.1")));
        });
        it("Should revert withdrawal if no ETH in contract", async () => {
            await expect(platform.connect(owner).withdrawETH(owner.address, ethers.utils.parseEther("0.1")))
                .to.be.revertedWith("No ETH to withdraw");
        });
        it("Should revert withdrawal of more ETH than balance", async () => {
            await platform.connect(addr1).buyACDM
                (100000,
                    { value: ethers.utils.parseEther("1") }
                );
            await expect(platform.connect(owner).withdrawETH(owner.address, ethers.utils.parseEther("10")))
                .to.be.revertedWith("Could not send ETH");
        });
    });

    describe("Referral system", () => {
        it("Should pay commissions to referrers in sale round", async () => {
            await platform.connect(addr3).register(addr4.address);
            await platform.connect(addr1).register(addr3.address);

            let initialPlatformBalance = await ethers.provider.getBalance(platform.address);
            let initialAddr3Balance = await ethers.provider.getBalance(addr3.address);
            let initialAddr4Balance = await ethers.provider.getBalance(addr4.address);

            await platform.connect(addr1).buyACDM
                (100000,
                    { value: ethers.utils.parseEther("1") }
                );

            expect(await ethers.provider.getBalance(platform.address))
                .to.equal(initialPlatformBalance.add(ethers.utils.parseEther("0.92")));
            expect(await ethers.provider.getBalance(addr3.address))
                .to.equal(initialAddr3Balance.add(ethers.utils.parseEther("0.05")));
            expect(await ethers.provider.getBalance(addr4.address))
                .to.equal(initialAddr4Balance.add(ethers.utils.parseEther("0.03")));
        });
        it("Should pay commissions to referrers in trade round", async () => {
            await platform.connect(addr3).register(addr4.address);
            await platform.connect(addr2).register(addr3.address);
            await platform.connect(addr5).register(owner.address);

            await platform.connect(addr1).buyACDM
                (100000,
                    { value: ethers.utils.parseEther("1") }
                );
            await token.connect(addr1).approve(platform.address, 100000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(100000, ethers.utils.parseEther("1"));

            let initialAddr3Balance = await ethers.provider.getBalance(addr3.address);
            let initialAddr4Balance = await ethers.provider.getBalance(addr4.address);
            let initialPlatformBalance = await ethers.provider.getBalance(platform.address);

            await platform.connect(addr2).redeemOrder(50000, 0,
                { value: ethers.utils.parseEther("0.5") });
            await platform.connect(addr5).redeemOrder(50000, 0,
                { value: ethers.utils.parseEther("0.5") });

            expect(await ethers.provider.getBalance(addr3.address))
                .to.equal(initialAddr3Balance.add(ethers.utils.parseEther("0.0125")));
            expect(await ethers.provider.getBalance(addr4.address))
                .to.equal(initialAddr4Balance.add(ethers.utils.parseEther("0.0125")));
            expect(await ethers.provider.getBalance(platform.address))
                .to.equal(initialPlatformBalance.add(ethers.utils.parseEther("0.0125")));
        });
    });

    describe("Sale and trade", () => {
        it("Should start trade round when time is up", async () => {
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            expect(await platform.roundType()).to.equal(1);
        });
        it("Should start trade round when volume is reached", async () => {
            await platform.connect(addr1).buyACDM
                (100000,
                    { value: ethers.utils.parseEther("1") }
                );
            await platform.startTradeRound();
            expect(await platform.roundType()).to.equal(1);
        });
        it("Should revert starting if trade round is already active", async () => {
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await expect(platform.startTradeRound())
                .to.be.revertedWith("Trade round is already active");
        });
        it("Should revert starting if sale round is not over yet", async () => {
            await expect(platform.startTradeRound())
                .to.be.revertedWith("Wait until sale round is over");
        });

        it("Should start sale round when time is up", async () => {
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startSaleRound();
            expect(await platform.roundType()).to.equal(0);
        });
        it("Should revert starting if sale round is already active", async () => {
            await expect(platform.startSaleRound())
                .to.be.revertedWith("Sale round is already active");
        });
        it("Should revert starting if trade round is not over yet", async () => {
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await expect(platform.startSaleRound())
                .to.be.revertedWith("Wait until trade round is over");
        });
        it("Should start sale round with zero trade ETH volume", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("100"));
            await platform.connect(addr2).redeemOrder(5000, 0,
                { value: ethers.utils.parseEther("100") });
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startSaleRound();
            expect(await platform.roundType()).to.equal(0);
        });
    });

    describe("Order management", () => {
        it("Should add orders", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("0.11"));

            expect(Object.values(await platform.orders(0))[0]).to.equal(addr1.address);
            expect(await token.balanceOf(addr1.address)).to.equal(0);
            expect(await token.balanceOf(platform.address)).to.equal(100000);
        });
        it("Should revert adding orders during sale round", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await expect(platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("0.11")))
                .to.be.revertedWith("Wait until sale round is over");
        });
        it("Should revert adding orders if not enough tokens", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await expect(platform.connect(addr1).addOrder(11000, ethers.utils.parseEther("0.11")))
                .to.be.revertedWith("Not enough ACDM tokens");
        });

        it("Should remove orders", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("0.11"));
            await platform.connect(addr1).removeOrder(0);

            expect(Object.values(await platform.orders(0))[1]).to.equal(0);
            expect(Object.values(await platform.orders(0))[2]).to.equal(0);
        });
        it("Should revert removing other addresses' orders", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("0.11"));
            await expect(platform.connect(addr2).removeOrder(0))
                .to.be.revertedWith("You cannot remove this order");
        });

        it("Should redeem orders", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("100"));
            let initialAddr1Balance = await ethers.provider.getBalance(addr1.address);
            await platform.connect(addr2).redeemOrder(5000, 0,
                { value: ethers.utils.parseEther("50") });

            expect(await token.balanceOf(addr2.address)).to.equal(5000);
            expect(await ethers.provider.getBalance(addr1.address))
                .to.equal(initialAddr1Balance.add(ethers.utils.parseEther("47.5")));
        });
        it("Should revert redemption of non-existent orders", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await expect(platform.connect(addr2).redeemOrder(5000, 0,
                { value: ethers.utils.parseEther("0.055") }))
                .to.be.revertedWith("Order does not exist");
        });
        it("Should revert redemption of non-existent orders after sale round start", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("0.11"));
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startSaleRound();
            await expect(platform.connect(addr2).redeemOrder(5000, 0,
                { value: ethers.utils.parseEther("0.055") }))
                .to.be.revertedWith("Order does not exist");
        });
        it("Should revert if not enough ACDM in order", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("0.11"));
            await expect(platform.connect(addr2).redeemOrder(11000, 0,
                { value: ethers.utils.parseEther("0.5") }))
                .to.be.revertedWith("Order does not have enough tokens");
        });
        it("Should revert if not enough ETH", async () => {
            await platform.connect(addr1).buyACDM
                (10000,
                    { value: ethers.utils.parseEther("0.1") }
                );
            await token.connect(addr1).approve(platform.address, 10000);
            await ethers.provider.send("evm_increaseTime", [1001]);
            await platform.startTradeRound();
            await platform.connect(addr1).addOrder(10000, ethers.utils.parseEther("0.11"));
            await expect(platform.connect(addr2).redeemOrder(5000, 0,
                { value: ethers.utils.parseEther("0.054") }))
                .to.be.revertedWith("Not enough ETH");
        });
    });
});