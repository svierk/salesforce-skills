import { Driver as _Driver, Element as _Element, Locator as _Locator, UtamBasePageObject as _UtamBasePageObject } from '@utam/core';
import _OrderLine from '../pageObjects/orderLine';

/**
 * generated from JSON force-app/main/default/lwc/orderSummary/__utam__/orderSummary.utam.json
 * @version 2026-01-01T00:00:00.000Z
 * @author UTAM
 */
declare class OrderSummary extends _UtamBasePageObject {
    constructor(driver: _Driver, element?: _Element, locator?: _Locator);
    /**
     * Types a search term into the filter
     */
    filterLines(term: string): Promise<void>;
    getLineByProduct(productName: string): Promise<_OrderLine>;
}
export = OrderSummary;
