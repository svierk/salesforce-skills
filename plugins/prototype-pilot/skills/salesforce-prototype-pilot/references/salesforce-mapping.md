# Salesforce mapping

The data panel turns a pretty app into an architecture story: for each screen, the records, the object or API they come from, and the query. It must be honest - a wrong object name in front of a Salesforce-savvy customer costs more than the panel gains.

## Rules

- **Standard objects where they exist, custom where a real project would add one.** `Journey_Milestone__c` is fine; inventing a standard object is not.
- **Check names you are unsure of** in the object reference or the org (see [sources.md](sources.md)). Industry clouds rename and add objects between releases.
- **Fields in API shape** - `PersonEmail`, `Status`, `AccountId`, custom fields with `__c` - so the records read like real API responses.
- **One query per block**, short, with bind variables (`:accountId`). Use `…` for long field lists.
- The panel says "mock data". Never put real records in it.

## Screen patterns and what sits behind them

| Screen pattern                     | Records and APIs                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Invitation-only access             | Person Account with an access status; the invitation by a named user (role); Experience Cloud external user                 |
| Identity check, passwordless       | Experience Cloud headless passwordless login (SMS or email OTP); Mobile SDK for biometric unlock of the stored token        |
| Profile, preferences               | Person Account fields; preferred partner as a lookup                                                                        |
| Consents                           | `Individual`, `ContactPointTypeConsent` (per channel and purpose)                                                           |
| The customer's product             | `Asset` with `Product2`; automotive: Automotive Cloud `Vehicle` and `VehicleDefinition`; configuration fields or a code     |
| Product images                     | `ContentVersion` linked to the asset, or a render service by configuration code                                             |
| Technical data                     | `Product2` with product attributes, or a custom spec object per product                                                     |
| Journey, order and delivery status | `Order` / `OrderItem` status, or a custom milestone object for production and handover steps                                |
| Guides, manual, FAQ                | Knowledge (`Knowledge__kav`) with data categories per product; search via SOSL or the Knowledge API                         |
| Chat with a personal contact       | Enhanced Messaging for In-App and Web: `MessagingSession`, `ConversationEntry`; Omni-Channel routing to the assigned user   |
| Personal contact                   | `User` on the account team (`AccountTeamMember` with a role)                                                                |
| Requests, issues                   | `Case` with type and status; a lifecycle such as New → In progress (central) → In progress (local) → Closed                 |
| Jobs for field technicians         | `WorkOrder`, `WorkOrderLineItem`, `ServiceAppointment`, `ServiceResource`; parts as `ProductConsumed`; Field Service mobile |
| Appointments                       | `ServiceAppointment` (Salesforce Scheduler or Field Service), `WorkType`                                                    |
| Events and invitations             | `Campaign`, `CampaignMember`                                                                                                |
| Loyalty, benefits                  | Loyalty Management: `LoyaltyProgramMember`, `LoyaltyMemberTier`, vouchers                                                   |
| Notifications                      | Push through the Mobile SDK, or Marketing Cloud journeys                                                                    |
| AI assistant                       | An Agentforce agent behind the chat, grounded in Knowledge and the customer's records                                       |

## By industry

| Industry               | Typical prototype                          | Objects to name                                                               |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| Automotive             | Owner app, waiting-phase companion         | Automotive Cloud `Vehicle`, `VehicleDefinition`; `Case`; `ServiceAppointment` |
| Manufacturing          | Customer or dealer portal, field companion | `Asset`, `Product2`, `Case`, `WorkOrder`; Manufacturing Cloud agreements      |
| Health and care        | Patient or care-team app                   | Health Cloud care plans, `Case`, `ServiceAppointment`; consent objects        |
| Financial services     | Client app with a personal advisor         | Financial Services Cloud financial accounts, `AccountTeamMember`, `Case`      |
| Consumer goods, retail | Member app                                 | Loyalty Management, `Order`, `Case`                                           |

## The README's "path to a real implementation"

Close the loop in the README: one bullet per area - identity, data, content, interaction, app shell (Mobile SDK native app, a PWA, or an Experience Cloud LWR site; a React UI bundle on Salesforce Multi-Framework) - naming what replaces the mock data.
