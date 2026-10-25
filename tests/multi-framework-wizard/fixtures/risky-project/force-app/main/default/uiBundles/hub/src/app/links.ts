import { getViewSDK } from '@salesforce/platform-sdk';

export const hubUrl = '/lightning/app/c__hub';
export const cabinetUrl = 'https://acme--c.vf.salesforce.app/app/c__cabinet';
export const tabUrl = (orgUrl: string) => `${orgUrl}/lightning/n/Games`;

export async function loadRecords() {
  return fetch('/services/data/v62.0/ui-api/records');
}

export function announce() {
  window.parent.postMessage({ type: 'ready' }, '*');
}

export function listen(handle: (data: unknown) => void) {
  window.addEventListener('message', (event) => handle(event.data));
}

export async function report(detail: unknown) {
  const sdk = await getViewSDK();
  sdk.dispatchEvent?.(new CustomEvent('gameover', { detail }));
}

// xray-ignore hardcoded-bundle-url -- the documented example org of the README
export const exampleUrl = 'https://example--c.vf.salesforce.app/app/c__hub';

// xray-ignore hardcoded-bundle-url
export const unexplainedUrl = 'https://other--c.vf.salesforce.app/app/c__hub';
