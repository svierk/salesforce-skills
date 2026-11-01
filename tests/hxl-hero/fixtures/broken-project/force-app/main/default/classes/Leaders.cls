global class Leaders {
  global class Request {
    @InvocableVariable
    global String game;
  }
  global class Response {
    @InvocableVariable(label='Rows')
    global List<Row> rows;
    @InvocableVariable(label='Total')
    global Integer total;
  }
  global class Row {
    @AuraEnabled
    global String name;
  }
  @InvocableMethod(label='Leaders')
  global static List<Response> leaders(List<Request> requests) {
    List<Score__c> scores = [SELECT Id FROM Score__c];
    return new List<Response>();
  }
}
