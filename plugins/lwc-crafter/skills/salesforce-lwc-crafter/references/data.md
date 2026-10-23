# Data

How a component reads and writes Salesforce data, and keeps what it shows true. Most bugs that users describe as "the component shows old values" are a cache that nobody refreshed; most security findings are an Apex method that trusts its caller.

## Choose the source

| Need                                                                                                              | Use                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A form to view, create or edit one record                                                                         | `lightning-record-form`, `lightning-record-edit-form`, `lightning-record-view-form`                    |
| Fields of one or a few records                                                                                    | `getRecord`, `getRecords` from `lightning/uiRecordApi`                                                 |
| Object metadata, labels, picklist values                                                                          | `getObjectInfo`, `getPicklistValues`, `getPicklistValuesByRecordType` from `lightning/uiObjectInfoApi` |
| Related records of a record                                                                                       | `getRelatedListRecords` from `lightning/uiRelatedListApi`                                              |
| A filtered, sorted or paginated list; several objects in one call                                                 | The GraphQL wire adapter                                                                               |
| Create, update, delete of single records                                                                          | `createRecord`, `updateRecord`, `deleteRecord` - or the record form                                    |
| What LDS and GraphQL cannot do: aggregates, custom metadata, complex logic, transactions across records, callouts | Apex                                                                                                   |

Lightning Data Service (LDS) shares one cache between all components on the page, respects sharing and field-level security, and updates every component when a record changes through it. Apex has none of that for free. Go down the table and stop at the first row that fits.

**One source per record.** Apex and LDS keep separate caches. A record read through Apex and edited through LDS - or the other way round - shows two different states on one page.

## Lightning Data Service

- **Import fields and objects** from `@salesforce/schema` (`import NAME from '@salesforce/schema/Account.Name'`). A string is not checked at deploy time; a renamed field then breaks the component silently.
- **Field paths start at the record's own object:** `Case.Account.Name` on a Case, never `Account.Name`.
- **Read values with `getFieldValue`** and `getFieldDisplayValue`, which handle relationship paths and formatting.
- **`optionalFields`** for fields the user may not see - a missing permission then leaves the field out instead of failing the whole record.

## GraphQL

The GraphQL wire adapter (`lightning/graphql`) fetches exactly the fields and records needed, with filters, sorting and cursor pagination, through the same LDS cache. Read what the org's release supports - queries, mutations, aggregates - in the developer guide before using it.

- **Values go into `variables`**, never into the query string. A search term built into the query text breaks on the first quote and lets the user change the query. The query itself may be built from trusted configuration - object and field names an admin set - but validate them against `getObjectInfo` first.
- **Paginate with cursors** (`first`, `after`, `pageInfo.endCursor`), as the collection's `graphqlDatatable` does.
- **Refresh** with the `refresh` function the wire result provides.

## Apex

For reads, `@AuraEnabled(cacheable=true)` - required for `@wire`, and the result is cached on the client. For writes, an imperative call from an event handler; cacheable methods cannot change data.

Every `@AuraEnabled` method is a public endpoint. Any user with access to the class can call it, with any arguments, without your component. So, in every method - the collection's `CustomDatatableUtil` and `ContentDocumentController` show each point:

- **`with sharing`** on the class.
- **User mode** - `WITH USER_MODE` in static SOQL, `AccessLevel.USER_MODE` for dynamic SOQL and DML - so object and field permissions of the running user apply.
- **Bind variables** for every value from the client. Dynamic SOQL with `Database.queryWithBinds`, never string concatenation of values.
- **Allowlists for identifiers.** Object names, field names and sort directions cannot be bound: validate them - a sort field must be one of the queried fields, a direction is `ASC` or `DESC`, an object name goes through `Schema.describeSObjects`.
- **Limits.** A `LIMIT` on every query a user can widen; server-side pagination for lists. SOQL `OFFSET` stops at 2,000 rows - beyond that, use a cursor (keyset pagination, or GraphQL).
- **Errors for people.** Catch, log what the team needs, and throw an `AuraHandledException` with a message the user may read - no stack traces, no query text.
- **Return only what the component shows.** Not whole records with every field, not data the user should not see.
- **Tests** run as a user with the permissions of the real persona (`System.runAs`), including a case where access is missing.

Imperative calls: `await` inside `try`/`catch`/`finally`, with a loading state set before and cleared in `finally`. The error's message is in `error.body.message` for Apex and LDS errors; lwc-recipes' `ldsUtils` has a `reduceErrors` helper that handles every shape.

## The wire service

`@wire` is a subscription, not a function call. It delivers when the component connects and again whenever a reactive parameter (`'$recordId'`) or the cached data changes.

- **Do not change wired data.** It is read-only and shared. Copy it (`structuredClone`, or spread for flat objects) before changing it.
- **Handle every state:** loading (neither `data` nor `error` yet), data, empty data, error. A component that only handles `data` shows nothing - and no reason - when something goes wrong. An error is shown as an error, with its message - not as the empty state, which tells the user there is nothing when the truth is that loading failed.
- **Make handlers idempotent.** A wire handler runs more than once. Derive the state from the latest value; guard true one-time side effects.
- **Do not rely on order.** Several wire adapters deliver independently. When state depends on two of them, compute it when both have values.
- **Depend through parameters.** To load B after A, make B's reactive parameter `undefined` until A has delivered - the wire service waits while a parameter is `undefined`. No promise chains, no imperative calls inside a wire handler.
- **Each reactive value is its own top-level property.** Replacing a whole config object does not trigger the wire again.
- **No writes through `@wire`.**
- **Never change a reactive parameter in `renderedCallback`** - an endless render loop.

## Keep it fresh

| After                                                        | Do                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `createRecord`, `updateRecord`, `deleteRecord`, record forms | Nothing - LDS updates every component that shows the record                                       |
| An imperative Apex call that changed records                 | `notifyRecordUpdateAvailable([{ recordId }])` for each changed record, so LDS reloads it          |
| A change that a wired Apex method's result depends on        | `refreshApex(this.wiredResult)` - with the whole object the wire delivered, stored in the handler |
| A change that standard components on the page must show      | Dispatch `RefreshEvent` from `lightning/refresh`                                                  |
| A GraphQL query whose data changed                           | The `refresh` function of the wire result                                                         |

Not: `refreshApex` on an LDS adapter, extra `optionalFields` to bust the cache, or a page reload.

## Large data

- **Fetch only what is shown** - the fields of the columns, the rows of the page.
- **Paginate or load on scroll** on the server; `lightning-datatable` supports infinite loading.
- **Search on the server** with a debounced input - not by loading everything and filtering in the browser.
- **Aggregate on the server.** Counting thousands of records in JavaScript means fetching them first.
