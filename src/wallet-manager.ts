import TonConnect, { type WalletInfo } from '@tonconnect/sdk';

/**
 * Simple helper to get wallet list
 */
export async function getWallets(): Promise<WalletInfo[]> {
  return await TonConnect.getWallets();
}
