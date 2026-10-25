// The bundle is served from https://acme--c.vf.salesforce.app in one org - a
// comment, so it does not count.
import '@salesforce/platform-sdk/ui-embedding';
import { getViewSDK } from '@salesforce/platform-sdk';

const FLOOR_APP = '/lightning/app/c__floor';

export function floorTabUrl(orgUrl: string, tab: string): string {
  return `${orgUrl}${FLOOR_APP}/n/${tab}`;
}

export function recordUrl(orgUrl: string, id: string): string {
  return `${orgUrl}/lightning/app/c__floor/r/Account/${id}/view`;
}

export async function reportResult(detail: { score: number; saved: boolean }) {
  const sdk = await getViewSDK();
  sdk.dispatchEvent?.(new CustomEvent('gameover', { detail, bubbles: true }));
}

export function listen(port: MessagePort, onData: (data: unknown) => void) {
  port.addEventListener('message', (event) => onData(event.data));
  port.start();
}
