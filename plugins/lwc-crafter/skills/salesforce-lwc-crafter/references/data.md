# Data

How a component reads and writes Salesforce data, and keeps what it shows true. Most bugs that users describe as "the component shows old values" are a cache that nobody refreshed; most security findings are an Apex method that trusts its caller.

## Choose the source

| Need                                                                                                                                                                     | Use                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| A form to view, create or edit one record                                                                                                                                | `lightning-record-form`, `lightning-record-edit-form`, `lightning-record-view-form`                    |
| Fields of one or a few records                                                                                                                                           | `getRecord`, `getRecords` from `lightning/uiRecordApi`                                                 |
| Object metadata, labels, picklist values                                                                                                                                 | `getObjectInfo`, `getPicklistValues`, `getPicklistValuesByRecordType` from `lightning/uiObjectInfoApi` |
| Related records of a record                                                                                                                                              | `getRelatedListRecords` from `lightning/uiRelatedListApi`                                              |
| A filtered, sorted or paginated list; several objects or related records in one query; counts, sums, averages                                                            | The GraphQL wire adapter (`graphql` from `lightning/graphql`)                                          |
| Create, update, delete of single records                                                                                                                                 | `createRecord`, `updateRecord`, `deleteRecord` - or the record form                                    |
| Writes to several records, or to records the component reads through GraphQL                                                                                             | `executeMutation` from `lightning/graphql`                                                             |
| What LDS and GraphQL cannot do: server-side business logic, complex DML, callouts, field sets, custom settings, custom metadata and other data the UI API does not offer | Apex                                                                                                   |

Lightning Data Service (LDS) shares one cache between all components on the page, respects sharing and field-level security, and updates every component when a record changes through it. Apex has none of that for free. Go down the table and stop at the first row that fits.

**One source per record.** Apex and LDS keep separate caches. A record read through Apex and edited through LDS - or the other way round - shows two different states on one page.

## GraphQL before Apex

Most custom controllers behind a component only read records: one query with a filter, a sort and a limit, sometimes a child relationship or a count. The GraphQL wire adapter does that from the component, so the server side disappears - no `@AuraEnabled` endpoint to secure, no test class and coverage to keep up, no Apex to deploy and maintain with the component, no second cache next to LDS. Since Spring '26, `executeMutation` takes the same step for creates, updates and deletes.

- **Before writing an `@AuraEnabled` method,** check the need against the [GraphQL section](#graphql). Apex is the answer only for a row of the table above that GraphQL cannot serve - name that reason in the design.
- **In a review,** a cacheable Apex method that only runs a query the UI API could answer is a finding: the fix is a GraphQL query, and removing the class and its test class once nothing calls them.
- **Moving a component off Apex** goes method by method: the read-only, cacheable methods first; a parent query that fetches what several child components loaded separately, handed down through `@api` properties; then compare the output and the network payload before and after.

The collection shows this on two components, each built for the same need with and without a custom backend. Read their catalog pages and sources ([sources.md](sources.md#the-catalog)), and copy the GraphQL one:

| Need                                                                             | With a custom data layer                                                                               | GraphQL, no Apex                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A configurable table with search, sorting, pagination, inline editing and delete | `customDatatable` - the Apex class `CustomDatatableUtil` with its test class, columns from a field set | `graphqlDatatable` - columns from a `fields` list and `getObjectInfo`, search with one `like` variable per field type, `orderBy`, cursor pagination with `totalCount`, writes with `executeMutation` |
| A map of the current record's address                                            | `customMapView` - `getRecord` with `layoutTypes: ['Full']`: every field of the layout, and only those  | `graphqlMapView` - one query for exactly the address fields the admin mapped, by the page's object name and record Id                                                                                |

The map views share their attributes, so a placement switches by the tag alone; the GraphQL table takes a `fields` list where the Apex one took a field set.

## Lightning Data Service

- **Import fields and objects** from `@salesforce/schema` (`import NAME from '@salesforce/schema/Account.Name'`). A string is not checked at deploy time; a renamed field then breaks the component silently.
- **Field paths start at the record's own object:** `Case.Account.Name` on a Case, never `Account.Name`.
- **Read values with `getFieldValue`** and `getFieldDisplayValue`, which handle relationship paths and formatting.
- **`optionalFields`** for fields the user may not see - a missing permission then leaves the field out instead of failing the whole record.

## GraphQL

The GraphQL wire adapter (`graphql` and `gql` from `lightning/graphql`) fetches exactly the fields and records needed - from several objects and their relationships in one query - with filters, sorting, cursor pagination and aggregates, through the same LDS cache and under the user's sharing and field-level security. Read what the org's release supports - queries, mutations, aggregates - in the developer guide before using it ([sources.md](sources.md#documentation)).

- **One record, fields known at build time:** `getRecord` with `@salesforce/schema` imports stays simpler. When the fields come from configuration, a GraphQL query for exactly those fields beats `getRecord` with `layoutTypes`, which loads the whole layout and misses fields that are not on it - as the collection's `graphqlMapView` does.
- **Mobile Offline** is not supported by `lightning/graphql`. Check the guide for the org's release before building a GraphQL component for the offline mobile app; the older `lightning/uiGraphQLApi` module supports it, with fewer features.

- **Values go into `variables`**, never into the query string. A search term built into the query text breaks on the first quote and lets the user change the query. The query itself may be built from trusted configuration - object and field names an admin set - but validate them against `getObjectInfo` first.
- **Variables are typed by field type.** The filter operators of the UI API expect their value in the field's own type: `like` on a text field takes a `String`, on an email field an `Email`, on a phone field a `PhoneNumber` - one `String` variable for all searched fields fails validation. Declare one variable per type you need, and read the types from the org's schema instead of guessing them: `__type(name: "<Object>_Filter")` lists the operator type per field, `__type(name: "<Type>Operators")` the value type per operator.
- **Only filterable fields in a filter.** `getObjectInfo` marks each field `filterable`; long text areas are not, and one of them in a `where` fails the whole query.
- **Check a generated query against the org** before you trust it - the UI API's GraphQL endpoint accepts the same query and variables, and its error messages name the problem:

  ```bash
  sf api request rest /services/data/v<api version>/graphql --method POST --body @query.json --target-org <alias>
  ```

  `query.json` holds `{ "query": "...", "variables": { ... } }` - take the query the component builds, for example from `getLastConfig()` of the wire adapter in a Jest test.

- **Paginate with cursors** (`first`, `after`, `pageInfo.endCursor`), as the collection's `graphqlDatatable` does.
- **Refresh** with the `refresh` function the wire result provides.
- **Write with `executeMutation`** from `lightning/graphql` - an imperative call from an event handler, never `@wire`, awaited inside `try`/`catch`. Values go into `variables` here too: `mutation UpdateContact($input: ContactUpdateInput!)` with `variables: { input: { Id, Contact: { ... } } }` - not a record Id or a field value written into the mutation text. A create takes all required, createable fields; an update the `Id` and only updateable fields; a delete only the `Id`, typed `RecordDeleteInput!` for every object, where create and update take `<Object>CreateInput!` and `<Object>UpdateInput!`.
- **Check `errors` in the result.** A mutation or query that fails returns `errors`, an array - not the `error` of the LDS functions. Show the first message; do not treat a result with `errors` as success.

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
| `executeMutation`, or a GraphQL query whose data changed     | The `refresh` function of the wire result - LDS cannot know whether a new record matches a filter |

Not: `refreshApex` on an LDS adapter, extra `optionalFields` to bust the cache, or a page reload.

## Large data

- **Fetch only what is shown** - the fields of the columns, the rows of the page.
- **Paginate or load on scroll** on the server; `lightning-datatable` supports infinite loading.
- **Search on the server** with a debounced input - not by loading everything and filtering in the browser.
- **Aggregate on the server.** Counting thousands of records in JavaScript means fetching them first.
