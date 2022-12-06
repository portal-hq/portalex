export const chainToName = (chainId: number): string => {  
  if (chainId === 1) {
    return 'mainnet';
  } else if (chainId === 3) {
    return 'ropsten';
  } else if (chainId === 4) {
    return 'rinkeby';
  } else if (chainId === 5) {
    return 'goerli';
  } else if (chainId === 10) {
    return 'optimism';
  } else if (chainId === 42) {
    return 'kovan';
  } else if (chainId === 137) {
    return 'matic';
  } else if (chainId === 80001) {
    return 'maticmum';
  } else if (chainId === 42161) {
    return 'arbitrum';
  } else if (chainId === 421611) {
    return 'arbitrum-rinkeby';
  } else if (chainId === 69) {
    return 'optimism-kovan';
  } else {
    throw new Error(`Unsupported ChainId: ${chainId}`);
  }
}; 