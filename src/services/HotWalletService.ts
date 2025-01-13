import { Alchemy, Network } from 'alchemy-sdk'
import { ethers, utils, Wallet } from 'ethers'
import { isAddress } from 'ethers/lib/utils'

import { ALCHEMY_API_KEY } from '../config'
import { logger } from '../libs/logger'

class HotWalletService {
  constructor(public address: string, private privateKey: string) {}
  /*
   * returns (String) Users account balance of Ether in USD.
   */
  async getBalance(chainId: number) {
    // Get the provider
    const alchemy = new Alchemy({
      apiKey: ALCHEMY_API_KEY,
      network: this.getAlchemyNetwork(chainId),
    })
    const provider = await alchemy.config.getProvider()

    // Get the balance
    const wallet = new Wallet(this.privateKey, provider)
    const bigNumberBalance = await wallet.getBalance()

    // Format the balance
    const balance = ethers.utils.formatEther(bigNumberBalance)
    return balance
  }

  /*
   * Initiates transfer of AMOUNT of eth to the to address.
   * Returns 200 if the request was successful
   */
  async sendTransaction(to: string, amount: number, chainId: string | number) {
    let from = this.address
    const privateKey = this.privateKey

    // Check if the private key is configured
    if (!this.privateKey) {
      throw new Error(
        'No exchange private key configured. Cannot transfer funds.',
      )
    }

    // Check if the addresses are valid
    if (!isAddress(from) || !isAddress(to)) {
      const notAddress = !isAddress(from) ? from : to
      throw new Error(`Address "${notAddress} is not a valid ethereum address.`)
    }

    const formattedChainId: number =
      typeof chainId === 'string' && chainId.includes(':')
        ? Number(chainId.split(':')[1])
        : Number(chainId)

    // Get the provider
    const alchemy = new Alchemy({
      apiKey: ALCHEMY_API_KEY,
      network: this.getAlchemyNetwork(formattedChainId),
    })
    const provider = await alchemy.config.getProvider()

    // if its negative, we want to transfer from the web3 wallet to the exchange
    if (amount < 0) {
      from = to
      to = this.address
      amount = Math.abs(amount)

      const toBalance = await provider.getBalance(to)
      if (toBalance.lt(utils.parseEther(amount.toString()))) {
        throw new Error(
          `Address ${to} does not have a high enough balance (${toBalance} to transfer ${amount} eth out`,
        )
      }

      throw new Error(
        `Transfers from the web3 wallet back to the exchange wallet are not supported yet.`,
      )
    }

    // Check for pending transactions
    const latestNonce = await provider.getTransactionCount(from, 'latest')
    const pendingNonce = await provider.getTransactionCount(from, 'pending')

    // Create basic transaction
    const tx: Record<string, any> = {
      from,
      to,
      value: ethers.utils.parseEther(String(amount)),
      nonce: latestNonce,
    }

    // Only add gas price adjustments if there's a pending transaction
    if (pendingNonce > latestNonce) {
      const pendingCount = pendingNonce - latestNonce
      const premium = 120 + pendingCount * 20 // Base 20% + 20% for each pending tx
      logger.info(
        `${pendingCount} pending transactions detected, using ${premium}% gas premium`,
      )

      const feeData = await provider.getFeeData()
      tx.maxFeePerGas = feeData.maxFeePerGas?.mul(premium).div(100)
      tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
        ?.mul(premium)
        .div(100)
    }

    logger.info(`Sending transaction: ${JSON.stringify(tx)}`, { tx })

    // If there's a gap between latest and pending, there might be stuck transactions
    if (pendingNonce > latestNonce + 1) {
      logger.warn(
        `Potential nonce gap detected. Latest: ${latestNonce}, Pending: ${pendingNonce}`,
      )
    }

    // Send it
    const wallet = new Wallet(privateKey, provider)
    return await wallet
      .sendTransaction(tx)
      .then((res) => {
        logger.info(`Transaction submitted: ${res.hash}`)
        return res.hash
      })
      .catch((error) => {
        logger.error(`Error sending transaction: ${error}`)
        throw error
      })
  }

  private getAlchemyNetwork(chainId: number): Network {
    switch (chainId) {
      case 1:
        return Network.ETH_MAINNET
      case 11155111:
        return Network.ETH_SEPOLIA
      case 8453:
        return Network.BASE_MAINNET
      case 84532:
        return Network.BASE_SEPOLIA
      default:
        throw new Error(`Chain ID ${chainId} not supported by Alchemy`)
    }
  }
}
export default HotWalletService
