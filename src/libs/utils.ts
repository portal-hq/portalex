export const chainToName = (chainId: number): string => {
  if (chainId === 1) {
    return 'mainnet'
  } else if (chainId === 3) {
    return 'ropsten'
  } else if (chainId === 4) {
    return 'rinkeby'
  } else if (chainId === 5) {
    return 'goerli'
  } else if (chainId === 10) {
    return 'optimism'
  } else if (chainId === 42) {
    return 'kovan'
  } else if (chainId === 137) {
    return 'matic'
  } else if (chainId === 80001) {
    return 'mumbai'
  } else if (chainId === 42161) {
    return 'arbitrum'
  } else if (chainId === 421611) {
    return 'arbitrum-rinkeby'
  } else if (chainId === 11155111) {
    return 'sepolia'
  } else if (chainId === 69) {
    return 'optimism-kovan'
  } else {
    throw new Error(`Unsupported ChainId: ${chainId}`)
  }
}

// 2024-12-10T21:50:06.355Z
export const isValidISO8601 = (dateString: string): boolean => {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
  return iso8601Regex.test(dateString)
}
