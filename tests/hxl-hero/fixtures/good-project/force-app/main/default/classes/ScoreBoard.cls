/** Top players of a game, for an MCP tool. */
global with sharing class ScoreBoard {
  global class Request {
    @InvocableVariable(label='Game' description='Game key (see https://example.com/games). Empty for all.')
    global String game;
  }

  global class Response {
    @InvocableVariable(label='Has Entries' description='True when someone scored')
    global Boolean hasEntries;
    @InvocableVariable(label='Entries' description='Players (best first)')
    global List<Entry> entries;
  }

  global class Entry {
    @AuraEnabled
    global String player;
    @AuraEnabled
    global Integer score;
  }

  // @InvocableVariable in a comment does not count
  @InvocableMethod(label='Get Score Board' description='Top players (by best round)')
  global static List<Response> getScoreBoard(List<Request> requests) {
    List<Response> responses = new List<Response>();
    for (Request request : requests) {
      Response response = new Response();
      response.entries = new List<Entry>();
      for (AggregateResult row : [SELECT CreatedBy.Name player, MAX(Score__c) best FROM Score__c WITH USER_MODE GROUP BY CreatedBy.Name]) {
        Entry entry = new Entry();
        entry.player = (String) row.get('player');
        entry.score = ((Decimal) row.get('best')).intValue();
        response.entries.add(entry);
      }
      response.hasEntries = !response.entries.isEmpty();
      responses.add(response);
    }
    return responses;
  }
}
