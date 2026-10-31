import { LightningElement, api } from 'lwc';

export default class FrameHost extends LightningElement {
  @api src;
  @api props;

  get guestSrc() {
    const url = new URL(this.src);
    url.pathname = '/embed';
    return url.toString();
  }
}
