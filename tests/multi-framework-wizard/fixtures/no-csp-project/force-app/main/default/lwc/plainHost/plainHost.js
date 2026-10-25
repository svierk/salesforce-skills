import { LightningElement } from 'lwc';

export default class PlainHost extends LightningElement {
  renderedCallback() {
    this.template
      .querySelector('lightning-ui-embedding')
      ?.addEventListener('sf-embedding.component.error', (event) => this.handleError(event));
  }
}
