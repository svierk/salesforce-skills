# Apex tools

An MCP tool of a custom Salesforce MCP server is an invocable action - for HXL, an Apex `@InvocableMethod`. The UI API cannot provide one, which is the reason to write Apex at all; keep the class thin: read, shape, return.

## Shape

```apex
global with sharing class ArcadeHallOfFame {
  global class Request {
    @InvocableVariable(label='Game' description='Game key or name, such as brick-breaker. Leave empty for every game.')
    global String game;
  }

  global class Response {
    @InvocableVariable(label='Has Entries' description='True when at least one player scored')
    global Boolean hasEntries;
    @InvocableVariable(label='Entries' description='The top 10 players by best round')
    global List<Entry> entries;
    // ... one variable per value the widget shows or uses
  }

  @JsonAccess(serializable='always' deserializable='always')
  global class Entry {
    @AuraEnabled
    global String player;
    @AuraEnabled
    global Integer score;
  }

  @InvocableMethod(label='Get Arcade Hall of Fame' description='Ranks the players of a game by their best round. ...')
  global static List<Response> getHallOfFame(List<Request> requests) {
    // one Response per Request, in order
  }
}
```

- **`global`** on the class, the request, the response and every inner class the types reference - Lightning types resolve them across namespaces. A code analyzer flags `global`; it is required here.
- **Top-level outputs are `@InvocableVariable`**, fields of inner classes are `@AuraEnabled` - the describe surfaces the first, the Lightning type resolves the second.
- **Lists as inner classes** (`List<Entry>`) are referenced as `@apexClassType/c__<Class>$<Inner>`. Keep the inner classes small and flat.
- **Types the widget can use:** `String`, `Integer`, `Decimal`, `Boolean`, lists of inner classes. Format dates in Apex (`Datetime.format()` uses the asking user's locale and time zone) unless the widget's date formulas are verified for the release.
- **Bulk-safe:** the method receives a list of requests. Build one response per request, and keep queries out of the per-request loop where the volume can grow.

## Security

- **`with sharing`** on every class and **`WITH USER_MODE`** in static SOQL, `AccessLevel.USER_MODE` in `Database.queryWithBinds` - the tool sees what the asking user sees in the apps, field-level security included.
- **Bind variables**, never string concatenation of inputs into SOQL; a `LIKE` pattern escapes `%` and `_`, not quotes.
- **Read-only by default.** A tool that writes needs the same validation as any input from outside - known fields, checked types, the user's permission - and a tool description that says it writes (`readOnly` and `destructive` hints in the server definition).
- **The permission set** of the users grants the class (`classAccesses`). Without it the MCP server lists no tools for them.

## Descriptions

The method's label and description become the tool's name and documentation unless the server definition overrides them; the variables' descriptions become the input schema the model reads. Write them for a model that has never seen the org: what the tool answers, the valid values of every input, what an empty input means, and two example questions. Put "exactly one request per call" in the server's tool description ([mcp-server.md](mcp-server.md#tool-descriptions)).

## Tests

- **More than one user.** Create users in `@TestSetup` inside `System.runAs(new User(Id = UserInfo.getUserId()))` to avoid mixed DML, assign the permission set that grants the fields, and insert their records inside `System.runAs(<user>)` so `CreatedById` differs. Use unusual names - real users of the org are visible in tests.
- **The running user may lack the permission set** in a fresh org; assign it in the test setup when it is missing.
- **Cover** ties, empty results, unknown inputs, the default for an empty input, and a user who has never played.
- **One `Test.startTest()` per method** - a helper that calls it breaks a test that calls the helper twice.
- Run them in the org with code coverage, and in CI with the DevOps Starter Kit's `sfdx-run-tests` where the project uses it.
