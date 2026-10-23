import NAME_FIELD from '@salesforce/schema/Account.Name';
import { getRecord } from 'lightning/uiRecordApi';
import { LightningElement, api, wire } from 'lwc';

// The full rule set must stay silent on this component: comments such as
// element.innerHTML = value or eval('x') are not code.
export default class CleanCard extends LightningElement {
  @api recordId;
  @api title = '';

  items = [];
  _timer;

  @wire(getRecord, { recordId: '$recordId', fields: [NAME_FIELD] })
  record;

  get hasItems() {
    return this.items.length > 0;
  }

  get labels() {
    return { empty: 'Nothing here yet' };
  }

  handleResize = () => {
    this.items = [...this.items];
  };

  connectedCallback() {
    window.addEventListener('resize', this.handleResize);
    this._timer = setInterval(this.handleResize, 60000);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
    clearInterval(this._timer);
  }

  handleRefresh() {
    this.dispatchEvent(new CustomEvent('refresh_requested', { detail: { recordId: this.recordId } }));
  }
}
