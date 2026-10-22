/**
 * Copyright notice of the fixture
 */
import { Driver as _Driver, Element as _Element, Locator as _Locator, BaseUtamElement as _BaseUtamElement, UtamBasePageObject as _UtamBasePageObject } from '@utam/core';

/**
 * Selector: acme-card.
 * Represents the acme-card component.
 * generated from JSON dist/widgets/card.utam.json
 * @version 2026-01-01T00:00:00.000Z
 * @author Test
 */
export default class Card extends _UtamBasePageObject {
    constructor(driver: _Driver, element?: _Element, locator?: _Locator);
    /**
     * Returns the card title
     * @return the title text
     */
    getTitle(): Promise<string>;
    getRoot(): Promise<(_BaseUtamElement)>;
}
