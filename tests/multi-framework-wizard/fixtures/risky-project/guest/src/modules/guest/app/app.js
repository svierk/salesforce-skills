import { LightningElement } from 'lwc';
import { getViewSDK } from '@salesforce/platform-sdk';

export default class App extends LightningElement {
  async connectedCallback() {
    this.sdk = await getViewSDK();
  }
}
