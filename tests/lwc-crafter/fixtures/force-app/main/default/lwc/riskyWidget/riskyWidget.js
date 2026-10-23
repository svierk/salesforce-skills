import { subscribe } from 'c/pubsub';
import { LightningElement, api, track } from 'lwc';

export default class RiskyWidget extends LightningElement {
  @api recordId;
  @track count = 0;

  connectedCallback() {
    document.addEventListener('click', this.close.bind(this));
    setInterval(() => this.count++, 1000);
    subscribe('refresh', () => this.render());
  }

  renderedCallback() {
    this.template.querySelector('div').innerHTML = this.recordId;
    this.template.querySelector('div').innerHTML = '';
    const total = eval('1 + 1');
    document.write(total);
    $A.get('e.force:refreshView').fire();
    document.querySelector('.outside').appendChild(document.createElement('span'));
  }

  close() {
    this.recordId = '001000000000001AAA';
    this.dispatchEvent(new CustomEvent('onClose', { bubbles: true, composed: true }));
    globalThis.location.href = 'https://acme.my.salesforce.com/lightning/page/home';
    // lwc-check-ignore no-eval -- the expression comes from a constant, reviewed in ABC-123
    eval('2 + 2');
    // lwc-check-ignore no-eval
    eval('3 + 3');
    console.log(confirm('Sure?'));
  }
}
