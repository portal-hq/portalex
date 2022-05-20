import {
  ETH_NETWORK,
} from '../config'
import { ethers, utils, Wallet } from 'ethers'
import { isAddress } from 'ethers/lib/utils'
import { PrismaClient } from '@prisma/client'

class HotWalletService {
  constructor(private prisma: PrismaClient, public address: string, private privateKey: string) {
  }
  /*
   * returns (String) Users account balance of Ether in USD.
   */
  async getBalance() {
    const provider = ethers.getDefaultProvider(ETH_NETWORK)
    const wallet = new Wallet(this.privateKey, provider)
    const bigNumberBalance = await wallet.getBalance()
    const balance = ethers.utils.formatEther(bigNumberBalance)
    return balance
  }

  /*
   * Initiates transfer of AMOUNT of eth to the to address.
   * Returns 200 if the request was successful
   */
  async sendTransaction(to: string, amount: number) {
    let from = this.address
    let privateKey = this.privateKey

    if (!this.privateKey) {
      throw new Error(
        'No exchange private key configured. Cannot transfer funds.'
      )
    }

    if (!isAddress(from) || !isAddress(to)) {
      const notAddress = !isAddress(from) ? from : to
      throw new Error(`Address "${notAddress} is not a valid ethereum address.`)
    }

    const provider = ethers.getDefaultProvider(ETH_NETWORK)

    // if its negative, we want to transfer from the web3 wallet to the exchange
    if (amount < 0) {
      from = to
      to = this.address
      amount = Math.abs(amount)

      const toBalance = await provider.getBalance(to)
      if (toBalance.lt(utils.parseEther(amount.toString())) ) {
        throw new Error(`Address ${to} does not have a high enough balance (${toBalance} to transfer ${amount} eth out`)
      }

      throw new Error(`Transfers from the web3 wallet back to the exchange wallet are not supported yet.`)
    }

    const wallet = new Wallet(privateKey, provider)
    const gasPrice = await provider.getGasPrice()
    const tx = {
      from,
      to,
      value: ethers.utils.parseEther(String(amount)),
      nonce: await provider.getTransactionCount(from, 'latest'),
      gasLimit: ethers.utils.hexlify(100000),
      gasPrice,
    }

    await wallet
      .sendTransaction(tx)
      .then((res) => {
        console.info(`Transaction submitted: ${res.hash}`)
      })
      .catch(console.error)

    return 200
  }
}
export default HotWalletService
