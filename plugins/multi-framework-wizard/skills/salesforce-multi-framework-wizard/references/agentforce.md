# Agentforce

Where an agent plugs into a multi-framework architecture. Polyglot Arcade v1.0.0 has no agent yet - its roadmap names an Agentforce question like "who is this week's champion?" - so this reference applies the arcade's rules to the agent touchpoints Salesforce offers, and points to where their current state lives. Every one of them moves between releases: read the status, framework support and org requirements in the sources before designing with it ([sources.md](sources.md#salesforce-documentation)).

## Agent or UI

| Give it to an agent                                                      | Keep it in the UI                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Questions across data - "who leads this week?", "which accounts played?" | Real-time and high-frequency interaction - a game loop, a live board |
| Guided tasks with a few steps and rules                                  | Spatial work - drag and drop, canvas, maps                           |
| Summaries, explanations, next steps                                      | Work where every click must be fast and exact                        |

An agent is one more surface: it gets a role, a pattern and a data path like every other one.

## A conversation inside a UI bundle

The **Agentforce Conversation Client** brings an employee agent's chat into an app outside Lightning. At Winter '27 Salesforce documents it for React UI bundles:

```tsx
import { useEffect, useRef } from 'react';
import { embedAgentforceClient } from '@salesforce/agentforce-conversation-client';

export function AgentPanel({ agentId }: { agentId: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    embedAgentforceClient({ container, agentforceClientConfig: { agentId, renderingConfig: { mode: 'floating' } } });
    return () => container.replaceChildren();
  }, [agentId]);
  return <div ref={ref} />;
}
```

- **Check the API first.** The guide's text also names `createAccWidget`; read the installed package's exports and the Conversation Client Developer Guide before writing the call.
- **Angular:** the client mounts into a container element, so an Angular component with an element reference that mounts in `ngAfterViewInit` and clears the container in `ngOnDestroy` follows the same shape - Salesforce documented React only at Winter '27, so verify it in a scratch org and record it in an ADR.
- **One place.** Put the conversation where users start - the entry point - not into every bundle. Inline mode needs a container with a real height.
- **Org requirements at Winter '27**, all org-wide (ground rule 10): Agentforce turned on, at least one Agentforce Employee Agent with topics and actions, the first-party Salesforce cookie requirement turned off in My Domain, and the app's origin under Trusted Domains for Inline Frames with the Lightning Out type in Session Settings. A `frontdoorUrl` is only for apps without an org session - never for a guest you do not control.
- **Customer-facing agents** on a site use Enhanced Chat instead; the guide links the alternatives.
- Salesforce's `experience-ui-bundle-agentforce-client-generate` skill generates the React integration; this skill decides where it goes and what it may touch.

## An agent on the same data

The agent answers from and acts on the same records the apps write - "who is this week's champion?" is a query on `Arcade_Score__c`, not a new API.

- **No second data path.** Agent actions - a flow, an Apex action, a prompt template - read and write the same objects under the agent user's permissions. If an action needs Apex, it follows the same rules as any Apex endpoint ([data-and-security.md](data-and-security.md#the-data-model-as-contract)).
- **The data contract is the agent's contract.** Object and field labels and descriptions are what the agent reasons over - write them so a planner picks the right action, and keep the vocabulary the same as in the apps.
- **A dedicated permission set** for what the agent may read and do, smaller than a user's. An agent that changes data is validated like a host-saves guest: known fields, checked types, attributed to what the context says.
- **Hand over the agent itself.** Agent Script, topics, actions, tests and deployment belong to an agent skill - Salesforce's `agentforce-adlc` plugin. Agents are `AiAgentDefinition` metadata from API 68.0; retrieve them with their dependencies before reviewing.

## Agent output as UI

Structured agent output can render as interactive UI instead of text. At Winter '27 that is **Lightning types** - a `LightningTypeBundle` with a `schema.json` bound to the action's output and a `renderer.json` - and **UI widgets** from the Headless Experience Layer (beta), which render the same output in Agentforce, Slack and MCP clients.

- **Reuse the domain's vocabulary.** The widget for a result shows the same fields, names and colors as the surfaces - a leaderboard row looks like a leaderboard row.
- **The widget is a surface too:** one role, its data through the action, no hidden calls of its own.
- Salesforce's `platform-lightning-widgets` skills generate Lightning types and widgets; read the current metadata format there.

## Data for other AI clients

Salesforce Hosted MCP Servers expose org capabilities - since Winter '27 also agents as MCP tools - to clients like Claude. The same rules hold: the tool works on the shared data under a named user's permissions, with a task-specific name and description, and the org-wide setup is shown before it is changed.

## Building with Agentforce Vibes

Agentforce Vibes and Builder Central generate UI bundles from natural language. The output is an ordinary Salesforce DX project with UIBundle metadata, so the architecture still applies: one role per surface, the data as contract, the trust settings, the X-ray before merging.
