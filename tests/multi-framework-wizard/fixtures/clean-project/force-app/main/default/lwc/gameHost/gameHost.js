import { LightningElement, api, wire } from 'lwc';
import { createRecord } from 'lightning/uiRecordApi';
import { publish, MessageContext } from 'lightning/messageService';
import RESULT_CHANNEL from '@salesforce/messageChannel/Result_Channel__c';

export default class GameHost extends LightningElement {
  @api recordId;
  @api appUrl;
  @wire(MessageContext) messageContext;

  get frames() {
    return this.appUrl ? [{ key: this.appUrl, src: this.appUrl }] : [];
  }

  async handleGameOver(event) {
    await createRecord({ apiName: 'Result__c', fields: { Score__c: event.detail.score } });
    publish(this.messageContext, RESULT_CHANNEL, { score: event.detail.score });
  }

  renderedCallback() {
    const frame = this.template.querySelector('lightning-ui-embedding');
    if (frame && frame !== this._frame) {
      this._frame = frame;
      frame.addEventListener('sf-embedding.component.error', (event) => this.handleError(event));
    }
  }
}
