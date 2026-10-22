import { Driver as _Driver, Element as _Element, Locator as _Locator, UtamBaseRootPageObject as _UtamBaseRootPageObject } from '@utam/core';
import _Card from 'salesforce-pageobjects/widgets/pageObjects/card';

/**
 * A list of acme-card components with a title.
 */
export default class CardList extends _UtamBaseRootPageObject {
    constructor(driver: _Driver, element?: _Element, locator?: _Locator);
    /**
     * Waits for the card with the given title and returns it
     */
    waitForCard(title: string): Promise<_Card>;
    getCards(): Promise<_Card[]>;
}
