import { assert } from "chai"
import { ethers, upgrades } from "hardhat"
import { EigerSwap, EigerSwap__factory } from "../typechain"
import SwapRouter02 from "@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json"

import WETH from "../dep/weth.json"
import { BigNumber, Contract } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import bn from "bignumber.js"

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

describe("Eiger Swap", function () {
  let provider = ethers.provider

  let owner: SignerWithAddress
  let userOne: SignerWithAddress
  let userTwo: SignerWithAddress

  let wethContract: Contract
  let usdcContract: Contract
  let daiContract: Contract

  let swapRouterContract: Contract

  let eigerSwap: EigerSwap

  it("Setup accounts", async () => {
    const signers = await ethers.getSigners()
    owner = signers[0]
    userOne = signers[1]
    userTwo = signers[2]
  })

  it("Setup contracts", async () => {
    wethContract = new Contract("0xfff9976782d46cc05630d1f6ebab18b2324d6b14", WETH.abi, provider)
    usdcContract = new Contract("0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", WETH.abi, provider)
    daiContract = new Contract("0xdAC17F958D2ee523a2206206994597C13D831ec7", WETH.abi, provider)

    swapRouterContract = new Contract("0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", SwapRouter02.abi, provider)

    let eigerSwapFactory: EigerSwap__factory = await ethers.getContractFactory("EigerSwap")
    eigerSwap = (await upgrades.deployProxy(eigerSwapFactory, [swapRouterContract.address, wethContract.address], {
      initializer: "__eiger_swap_init",
      kind: "uups",
    })) as unknown as EigerSwap

    await eigerSwap.deployed()

    assert((await eigerSwap.owner()).toLowerCase() === owner.address.toLowerCase())
    assert(!(await eigerSwap.paused()))
    assert((await eigerSwap.wethAddress()).toLowerCase() === wethContract.address.toLowerCase())
    assert((await eigerSwap.swapRouter()).toLowerCase() === swapRouterContract.address.toLowerCase())
  })

  it("Swap from router", async () => {
    assert((await usdcContract.balanceOf(userOne.address)).toNumber() === 0)

    let swapTx = await swapRouterContract.connect(userOne).exactInputSingle(
      {
        tokenIn: wethContract.address,
        tokenOut: usdcContract.address,
        fee: BigNumber.from(3000),
        recipient: userOne.address,
        // deadline: BigNumber.from("572779296775126679160087327237723835625201219568"),
        amountIn: ethers.utils.parseEther("0.001"),
        amountOutMinimum: BigNumber.from(0),
        sqrtPriceLimitX96: BigNumber.from(0),
      },
      {
        value: ethers.utils.parseEther("0.001"),
      },
    )

    await swapTx.wait()

    assert((await usdcContract.balanceOf(userOne.address)).toNumber() > 0)
  })

  it("Swap from eiger contract without min out amount", async () => {
    assert((await usdcContract.balanceOf(userTwo.address)).toNumber() === 0)

    let swapTx = await eigerSwap.connect(userTwo).swapEtherToToken(usdcContract.address, 0, {
      value: ethers.utils.parseEther("0.001"),
    })

    await swapTx.wait()

    assert((await usdcContract.balanceOf(userTwo.address)).toNumber() > 0)
  })

  it("Swap from eiger contract with min out amount", async () => {
    let swapTx = await eigerSwap.connect(userTwo).swapEtherToToken(usdcContract.address, 1.5 * 1000000, {
      value: ethers.utils.parseEther("0.001"),
    })

    await swapTx.wait()
  })

  it("Swap from eiger contract - Error (Value must be greater than zero)", async () => {
    try {
      let swapTx = await eigerSwap.connect(userTwo).swapEtherToToken(usdcContract.address, 1.5 * 1000000, {
        value: 0,
      })

      await swapTx.wait()
    } catch (e: any) {
      assert(
        e.message ===
          "VM Exception while processing transaction: reverted with reason string 'Value must be greater than zero'",
      )
    }
  })

  it("Swap from eiger contract - Error (Too little received)", async () => {
    try {
      let swapTx = await eigerSwap.connect(userTwo).swapEtherToToken(usdcContract.address, 15 * 1000000, {
        value: ethers.utils.parseEther("0.001"),
      })

      await swapTx.wait()
    } catch (e: any) {
      assert(
        e.message === "VM Exception while processing transaction: reverted with reason string 'Too little received'",
      )
    }
  })

  it("Swap from eiger contract - Error (Pausable: paused)", async () => {
    let pauseTx = await eigerSwap.connect(owner).pause(true)

    await pauseTx.wait()

    try {
      let swapTx = await eigerSwap.connect(userTwo).swapEtherToToken(usdcContract.address, 1.5 * 1000000, {
        value: ethers.utils.parseEther("0.001"),
      })

      await swapTx.wait()
    } catch (e: any) {
      assert(e.message === "VM Exception while processing transaction: reverted with reason string 'Pausable: paused'")
    }
  })
})
