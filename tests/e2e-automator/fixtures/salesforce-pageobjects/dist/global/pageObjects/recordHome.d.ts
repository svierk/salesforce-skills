import { UtamBaseRootPageObject as _UtamBaseRootPageObject } from '@utam/core';
import _Card from 'salesforce-pageobjects/widgets/pageObjects/card';

/**
 * Represents a record home page
 */
export default class RecordHome extends _UtamBaseRootPageObject {
    getCard(): Promise<_Card>;
}
