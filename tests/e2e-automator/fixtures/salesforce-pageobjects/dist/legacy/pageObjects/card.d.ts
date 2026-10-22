import { UtamBaseRootPageObject as _UtamBaseRootPageObject } from '@utam/core';

export default class Card extends _UtamBaseRootPageObject {
    getBodyText(): Promise<string>;
}
