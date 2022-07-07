import { PrismaClient, Wallet } from '@prisma/client'
import { ethers, Wallet as EthersWallet } from 'ethers'
import { SigningKey } from 'ethers/lib/utils'

export default class WalletService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Creates a new wallet using ethers library.
   *
   * @returns wallet
   */
  async createWallet(): Promise<Wallet> {
    let ethersWallet = EthersWallet.createRandom()
    let wallet = await this.prisma.wallet.create({
      data: {
        publicKey: ethersWallet.address,
        privateKey: ethersWallet.privateKey,
      },
    })
    return wallet
  }

   /**
   * Uses the address of a user to get their private key and make a signing object
   *
   * @returns SigningKey
   */
  async getSigningKey(address: string): Promise<SigningKey> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { publicKey: address },
    })
    if (!wallet) {
      throw new Error('No wallet found for that address')
    }
    return new SigningKey(wallet.privateKey)
  }

     /**
   * Uses the address of a user to get their private key and return it
   *
   * @returns PrivateKey
   */
  async getPrivateKey(address: string): Promise<string> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { publicKey: address },
    })
    if (!wallet) {
      throw new Error('No wallet found for that address')
    }
    return wallet.privateKey
  }
}
