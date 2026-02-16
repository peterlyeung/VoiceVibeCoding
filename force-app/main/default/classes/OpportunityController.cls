public with sharing class OpportunityController {
    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getOpportunities() {
        return [
            SELECT Id, Name, Amount, StageName, CloseDate, 
                   AccountId, Account.Name, 
                   OwnerId, Owner.Name,
                   CreatedDate
            FROM Opportunity 
            ORDER BY CreatedDate DESC
        ];
    }
    
    @AuraEnabled(cacheable=false)
    public static List<Contact> getContactsForAccount(Id accountId) {
        if (accountId == null) {
            return new List<Contact>();
        }
        return [
            SELECT Id, Name, Email, Phone, Title, 
                   LastActivityDate, CreatedDate
            FROM Contact 
            WHERE AccountId = :accountId
            ORDER BY LastActivityDate DESC NULLS LAST, CreatedDate DESC
            LIMIT 50
        ];
    }
}
