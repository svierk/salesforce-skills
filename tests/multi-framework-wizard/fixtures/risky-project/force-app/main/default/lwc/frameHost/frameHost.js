import { LightningElement, api } from 'lwc';

export default class FrameHost extends LightningElement {
  @api src;
  @api props;
}
