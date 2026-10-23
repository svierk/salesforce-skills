# Testing

Jest tests for Lightning web components in the collection's style: `@salesforce/sfdx-lwc-jest` runs them, base components are stubs, Apex and wire adapters are mocks, and every component asserts that it is accessible. Follow the conventions of tests that already exist in the project over this page.

## Shape of a test

```js
import getOrders from '@salesforce/apex/OrderController.getOrders';
import OrderSummary from 'c/orderSummary';
import { createElement } from 'lwc';

const mockOrders = require('./data/getOrders.json');

jest.mock(
  '@salesforce/apex/OrderController.getOrders',
  () => {
    const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('c-order-summary', () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it('shows one row per order and is accessible', async () => {
    // given
    const element = createElement('c-order-summary', { is: OrderSummary });
    element.recordId = '001000000000001AAA';

    // when
    document.body.appendChild(element);
    getOrders.emit(mockOrders);
    await flushPromises();

    // then
    const rows = element.shadowRoot.querySelectorAll('li');
    expect(rows.length).toBe(mockOrders.length);
    await expect(element).toBeAccessible();
  });
});
```

- **`describe` named after the tag**, one behaviour per `it`, named as the behaviour, `given`/`when`/`then` comments as in the collection.
- **Empty the DOM and reset mocks in `afterEach`.** The DOM is shared by all tests of a file.
- **Mock data in `__tests__/data/*.json`** - real shapes, copied from a wire result or an Apex response, not invented ones.
- **Wait for rendering** after changing a property or emitting data: `await flushPromises()` or `await Promise.resolve()`, then assert.

## What to test

| Behaviour                            | How                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Rendering from public properties     | Set them before `appendChild`, assert on `element.shadowRoot`                                                                    |
| Wired data, empty data, error        | `adapter.emit(data)`, `adapter.emit([])`, and the adapter's error helper (`emitError` or `error`, by version) - one test each    |
| Imperative Apex: success and failure | `jest.mock` with `default: jest.fn()`, then `mockResolvedValue` / `mockRejectedValue`; assert the outcome - rows, message, toast |
| User interaction                     | Click or dispatch the event on the element or the base component stub; assert the result                                         |
| Events the component fires           | `element.addEventListener('<name>', handler)` before the action; assert `handler` and its `detail`                               |
| Toasts                               | Listen for the toast event name from the `lightning/platformShowToastEvent` mock; assert `variant` and message                   |
| Navigation                           | `getNavigateCalledWith()` from the `lightning/navigation` mock; assert the page reference                                        |
| Accessibility                        | `await expect(element).toBeAccessible()` in at least one test per state that renders differently                                 |

**Assert outcomes, not calls alone.** A failure test that only checks that `deleteRecord` was called proves nothing about what the user sees; check the error toast or message too. A handler the test attaches to an element and then triggers itself proves nothing at all.

## Mocks

- **Apex, wired:** `createApexTestWireAdapter` from `@salesforce/sfdx-lwc-jest`, as above. **Imperative:** `{ default: jest.fn() }`. Both with `{ virtual: true }` - the module does not exist on disk.
- **LDS and other wire adapters** (`getRecord`, `getObjectInfo`, `graphql`, `CurrentPageReference`): the project's mocks in `force-app/test/jest-mocks/lightning/`, mapped in `jest.config.js`, built with `createLdsTestWireAdapter` or `createTestWireAdapter`. Read the mock to see which helpers it offers (`emit`, `error`, `emitErrors`, ...); add one from the collection when a component imports a module the project has no mock for.
- **Static resources and libraries:** mock `lightning/platformResourceLoader` (`loadScript: jest.fn()` resolving or rejecting) and put a fake of the library's global in place - the collection's `orgChartViewer` and `qrCodeGenerator` tests show both.
- **Browser APIs Jest lacks:** canvas through `jest-canvas-mock`, `ResizeObserver` or `getUserMedia` as small fakes in the test.
- **Fakes for frames and timers record, they do not run.** A `requestAnimationFrame` fake that calls its callback right away turns an animation loop into endless recursion - and a `catch` in the component can hide the stack overflow, so the test passes. Return an id and assert the call; run a callback by hand when the test needs one frame (`requestAnimationFrame.mock.calls[0][0]()`), or use Jest's fake timers.

## Base components are stubs

`lightning-*` components render no inner DOM in Jest. Assert on their properties (`button.label`, `datatable.data`) and drive them by dispatching the event the real component would (`change` with a `detail`, `rowaction`, `save`). Your own child components (`c-*`) render for real.

## Running

```bash
npm run test:unit -- force-app/main/default/lwc/<component>     # one component
npm run test:unit:watch                                          # while working
npm run test:unit:coverage                                       # before handing over
```

Use the project's script names. A test that passes once and fails once is not done - look for a missing `await` or state leaking between tests.

## Rules

- **Never weaken an assertion to get green.** A failing test is information. If the component is wrong, fix the component. Change an expected value only when the user confirms that the behaviour changed on purpose.
- **No `it.only`, `fit`, `xit` or `.skip`** left behind - they silently change what CI runs.
- **No assertions on generated class names**, internal fields of the component or the private markup of base components.
- **No snapshot tests as the only check** - they pass whatever renders, as long as it did before.
- **Coverage is a by-product.** Test behaviours; uncovered lines are a hint where one is missing.
