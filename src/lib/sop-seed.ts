// Seed SOPs derived from the Operator Blueprint + RECLAYOUT case study.
// These are the Operator's own doctrine, translated into working SOPs,
// templates, training modules, scenarios, frameworks, and patterns.
// Seeded once per user on first Library visit.

export type SopCategory = "sop" | "template" | "training" | "scenario" | "framework" | "pattern";

export interface SeedSop {
  category: SopCategory;
  title: string;
  summary: string;
  body: string;
  source: string;
  tags: string[];
}

export const SOP_SEED: SeedSop[] = [
  {
    category: "framework",
    title: "The Operator Identity",
    summary: "The shift from worker to operator: work to control outcomes, not to match pay.",
    source: "Operator Blueprint · Ch.1 & Ch.7",
    tags: ["identity", "mindset", "operator"],
    body: `# The Operator Identity

## Core Law
Systems are patterns. Once you identify the pattern, you can control the outcome.

## The Shift
- Workers adjust effort to match pay.
- Operators adjust outcomes and then name the price.
- You do not wait for tasks — you identify problems and build solutions.

## Daily Practice
1. Walk into any environment asking: what is the pattern here?
2. Note the inefficiencies without judgment — write them down.
3. Ask: "If I ran this, what would I fix first?"
4. Build the fix as a prototype before proposing it.
5. Show results. Then name your value.`,
  },
  {
    category: "framework",
    title: "System Structure — Intake · Process · Output",
    summary: "Every system reduces to three parts. Diagnose the weakest link.",
    source: "Operator Blueprint · Ch.2",
    tags: ["systems", "diagnosis", "apex"],
    body: `# System Structure

Every system — a warehouse, a sales funnel, a payroll cycle, a household — has three parts:

1. **Intake** — what enters (leads, shipments, requests, raw material, tasks).
2. **Process** — what happens inside (verification, transformation, decisions).
3. **Output** — what leaves (deliveries, revenue, decisions, finished product).

## Diagnostic Sequence
- Where is intake noisy, unverified, or unbounded?
- Where does process create traffic jams, waiting, rework, or confusion?
- Where does output fail to reach the next system reliably?

The weakest of the three is where the operator intervenes first. Fixing the strongest link creates no visible gain.`,
  },
  {
    category: "framework",
    title: "The 5→2 Method",
    summary: "Compress any five-step process to two motions without losing verification.",
    source: "Operator Blueprint · Ch.3",
    tags: ["optimization", "5-to-2", "compression"],
    body: `# The 5→2 Method

## Principle
Reduce steps, reduce time, increase output — without losing the checks that protect quality.

## Procedure
1. **Map** the current process on paper. Every touch, every handoff.
2. **Classify** each step: value-adding, verification, or friction.
3. **Combine** steps that touch the same object.
4. **Eliminate** steps that only exist because of the prior structure.
5. **Redesign** so the operator moves in one direction through the work.

## Example (from RECLAYOUT case study)
Old: receive → separate → verify → receive-again → move-to-putaway → putaway. Five motions, four handoffs, congestion.
New: load → verify+receive+putaway in dedicated ops area → move to finished. Two motions. One direction of flow. Errors caught before finished area.

## Test
After compression, ask: which of the removed steps would silently allow a defect through? If any, add a verification checkpoint back in — but only one.`,
  },
  {
    category: "framework",
    title: "Utilization vs. Liability",
    summary: "Everything is either making money or losing it. There is no neutral.",
    source: "Operator Blueprint · Ch.4",
    tags: ["utilization", "kpi", "capacity"],
    body: `# Utilization vs. Liability

## Standard
Every asset, employee, hour, dollar, license, subscription, workflow, tool, and space is either being utilized to generate value or is a liability draining value. Neutral does not exist.

## Audit Loop (monthly)
1. List every recurring cost, subscription, and asset.
2. For each, write one line: what value it produced this month.
3. If the line is empty, downgrade, cancel, or reassign.
4. For each employee/agent: what did they produce this month vs. what did they consume in time?

## Applied to Time
Your calendar is the highest-value asset you own. Any block that isn't producing, protecting, or preparing is liability. Guard blocks for producing; schedule liability blocks (email, admin) into named windows.`,
  },
  {
    category: "sop",
    title: "The Two-Week Takeover",
    summary: "From observation to control in 14 days, without asking permission.",
    source: "Operator Blueprint · Ch.5",
    tags: ["takeover", "onboarding", "control", "sop"],
    body: `# SOP — The Two-Week Takeover

## Purpose
Enter a new environment (job, contract, project) as an operator, not an employee. Move from observation to control in 14 days.

## Week 1 — Observation & Mapping
- **Day 1-2**: Do the work as instructed. Take no notes visible to others; take detailed notes privately.
- **Day 3-4**: Map every system encountered using Intake · Process · Output.
- **Day 5**: Identify the top 3 inefficiencies. Rank by (impact × ease of fix).
- **Day 6-7**: Draft a private fix for the top-1 inefficiency.

## Week 2 — Quiet Deployment & Positioning
- **Day 8-9**: Deploy the fix without announcement. Let results speak first.
- **Day 10-11**: Deploy fixes 2 and 3.
- **Day 12**: Prepare a one-page "Results Delivered" memo — numbers, before/after, next opportunities.
- **Day 13**: Deliver the memo to the person with authority to expand your scope.
- **Day 14**: Name your expanded role, expanded compensation, or the terms under which you'll take on the next problem.

## Rule
You do not ask permission to fix things that are visibly broken. You ask permission to be paid for having fixed them.`,
  },
  {
    category: "sop",
    title: "Positioning & Getting Paid for Value",
    summary: "Turning demonstrated control into income.",
    source: "Operator Blueprint · Ch.6",
    tags: ["positioning", "pricing", "income"],
    body: `# SOP — Positioning & Getting Paid for Value

## Sequence
1. **Demonstrate before naming a price.** Fix something visible first.
2. **Quantify the fix.** Hours saved, errors eliminated, throughput gained, dollars retained.
3. **Attach the number to a comparable.** "This saves the equivalent of X hours per week / $Y per month."
4. **Propose the arrangement in writing** — scope, cadence, escalation path, price.
5. **Name a price anchored to the value delivered, not the time spent.**

## Common Failure Modes
- Naming a price before showing a result: undervalues you immediately.
- Charging hourly for high-leverage work: caps your income at your capacity.
- Explaining the process instead of the outcome: makes you look like a task-doer.

## Language Templates
- "I found we were losing about X per week to [pattern]. I've stopped it. Going forward, here's what I'd protect for you next…"
- "The system as it stood was costing about Y. The new one is holding at Z. I'd like to formalize this at [price] per month."`,
  },
  {
    category: "training",
    title: "Critical Thinking Drill — Pattern Recognition",
    summary: "A repeatable 15-minute exercise to sharpen operator vision.",
    source: "Derived from Operator Blueprint core doctrine",
    tags: ["training", "critical-thinking", "daily"],
    body: `# Training Drill — Pattern Recognition (15 min/day)

## Setup
Pick any environment you'll pass through today: a store, an office, a website, a phone system, a delivery flow, a household routine.

## Steps
1. **(3 min) Observe silently.** No judgment yet. Just watch the sequence.
2. **(3 min) Map** the Intake → Process → Output on paper or notes.
3. **(3 min) List** every friction point, wait, duplicate motion, or unclear handoff.
4. **(3 min) Prioritize** by asking: which one, fixed, changes the output the most?
5. **(3 min) Sketch** the 5→2 compression for the top-1 friction.

## Weekly Review
- How many of your daily fixes could stand as SOPs?
- Which environment gave you the highest-leverage insight?
- What pattern showed up in two or more environments? (That's a framework being born.)`,
  },
  {
    category: "training",
    title: "Adjusting Methods When the First Approach Fails",
    summary: "The disciplined loop for changing tactics without changing goals.",
    source: "Derived from Operator Blueprint",
    tags: ["training", "resilience", "adaptation"],
    body: `# Training — Adjusting Methods

## Trigger
The current method has run for its planned duration or budget and has not produced the expected outcome.

## The Loop
1. **State the outcome you still want**, in one sentence. Do not soften it.
2. **List the assumptions the failed method depended on.** Which turned out to be wrong?
3. **Identify one assumption to reverse.** Not all of them — one.
4. **Design a new method that respects the reversed assumption.**
5. **Set a new budget** (time + resources + emotional bandwidth) — shorter than the first.
6. **Run.** Do not blend the old method into the new one; that hides which is working.
7. **Review at budget end.** Was the reversal correct? If not, reverse a different assumption next.

## Guardrail
If three reversals in a row fail, the goal itself may be wrong. Escalate to IRIS for objective review, not a fourth reversal.`,
  },
  {
    category: "scenario",
    title: "Scenario — The Underutilized High Performer",
    summary: "You are producing well above pay grade. What now?",
    source: "Operator Blueprint · Final Section",
    tags: ["scenario", "positioning", "career"],
    body: `# Scenario — The Underutilized High Performer

## Situation
You are consistently producing well above what you are being paid for. Your peers know it. Your manager may or may not know it. You feel resentment building.

## Wrong Moves
- Reducing effort to match pay (kills your operator identity).
- Complaining to peers (poisons your reputation).
- Quitting without a next position (transfers leverage away from you).

## Operator Sequence
1. **Document** the last 90 days of value produced — projects, saves, revenue, prevented losses.
2. **Convert** into one paragraph and one number.
3. **Book a formal conversation** — not a hallway comment.
4. **Present** the number, then the ask: expanded role, expanded pay, or expanded autonomy.
5. **If declined** without a real reason: begin the Two-Week Takeover at a different company or on your own book. Do not stay bitter — move.

## Rule
You are not underpaid. You are under-utilized. The fix is scope, not sympathy.`,
  },
  {
    category: "scenario",
    title: "Scenario — Fixing a Broken Handoff",
    summary: "Work stalls between two people or two teams.",
    source: "Derived from RECLAYOUT + Operator Blueprint",
    tags: ["scenario", "workflow", "handoff"],
    body: `# Scenario — Fixing a Broken Handoff

## Symptom
Work moves fine within one team, then stalls at the handoff to the next.

## Diagnostic Questions
1. Is the receiving team expected to verify the work? If yes, are the verification criteria written down?
2. Do the two teams share vocabulary for what "done" means at the handoff line?
3. Is there a queue, or does work arrive in bursts that overwhelm the receiver?
4. Does the sender get feedback when their handoff was clean vs. messy?

## Operator Fix (usually one of these)
- **Redraw the boundary.** Move the verification step to the sender before handoff.
- **Establish a queue with a WIP limit.** Receiver pulls when ready, not pushed at.
- **Create a one-line handoff form** with fields for what the receiver actually needs.
- **Install a feedback loop.** Weekly, receiver rates last week's handoffs to sender.

## Anti-Pattern
Adding a meeting. Meetings mask handoff failures without fixing the structural cause.`,
  },
  {
    category: "template",
    title: "Template — 5→2 Compression Analysis",
    summary: "Fill-in-the-blank template for compressing a five-step process.",
    source: "Derived from Operator Blueprint · Ch.3",
    tags: ["template", "5-to-2", "compression"],
    body: `# Template — 5→2 Compression Analysis

## Process being analyzed
Name: __________
Current step count: __________
Current cycle time: __________
Known defect / error rate: __________

## Step-by-step map (before)
| # | Step | Actor | Time | Adds value? (Y/N) | Is verification? (Y/N) |
|---|------|-------|------|-------------------|------------------------|
| 1 |      |       |      |                   |                        |
| 2 |      |       |      |                   |                        |
| 3 |      |       |      |                   |                        |
| 4 |      |       |      |                   |                        |
| 5 |      |       |      |                   |                        |

## Compression moves
- Steps merged: __________
- Steps eliminated: __________
- Verifications retained: __________

## Proposed process (after)
| # | Step | Actor | Time | Verification retained here? |
|---|------|-------|------|------------------------------|
| 1 |      |       |      |                              |
| 2 |      |       |      |                              |

## Predicted results
- New cycle time: __________
- New defect risk: __________
- Blockers this creates: __________

## Deployment plan
- Pilot scope: __________
- Rollback trigger: __________
- Owner: __________`,
  },
  {
    category: "template",
    title: "Template — Warehouse / Physical Layout Optimization",
    summary: "From the RECLAYOUT case study — apply to any physical space.",
    source: "RECLAYOUT case study",
    tags: ["template", "layout", "warehouse", "flow"],
    body: `# Template — Physical Layout Optimization

## Space audit
Space: __________
Current color/zone key: __________
Observed workflow direction: __________

## Traffic map
- Where do people cross paths? __________
- Where does equipment queue? __________
- Where does inventory bottleneck? __________
- Where does verification happen? __________

## Redesign principles (from RECLAYOUT)
1. **One direction of flow.** Work moves in a single motion from intake to output.
2. **Designated zones for each stage.** No zone shares a purpose.
3. **Errors caught at the zone before finished.** Finished inventory is only what has passed verification.
4. **Individual lanes for people/equipment.** No shared paths at peak volume.
5. **High-volume days handled by the layout, not by extra people.**

## New layout sketch
Zones (color-coded):
- Loading: __________
- Quarantine: __________
- Operations (verify + receive + put-away): __________
- Finished: __________

## Predicted results
- Cycle time change: __________
- Error rate change: __________
- Traffic conflict resolution: __________`,
  },
  {
    category: "pattern",
    title: "Pattern — Diversified Business Income Stack",
    summary: "How to layer independent business income sources so no single failure hurts.",
    source: "Operator doctrine — synthesized",
    tags: ["pattern", "business", "diversification", "resilience"],
    body: `# Pattern — Diversified Business Income Stack

## Purpose
A structural pattern for reducing single-point-of-failure risk in an Operator's income. This is an operational planning tool, not a financial promise. No income level, outcome, or timeline is guaranteed — every layer requires the Operator's own execution and their own regulated financial accounts. MOS never receives, holds, invests, trades, or transfers Operator or customer funds.

## Definition
A layered set of business income sources where no single source exceeds ~30% of total income, no source has a single point of failure, and each source has a documented "quiet mode" (income continues without daily effort for at least 30 days).

## Building Sequence
1. **Anchor income** (day job, primary client, primary business): stabilize before layering.
2. **Skill-adjacent service income**: something the Operator can charge for using diagnosed problems.
3. **Productized version of the service**: turn the top-3 repeated requests into a fixed-scope, fixed-price offer.
4. **Digital asset income** (SOPs, templates, courses, tooling): captures the value of the Operator's expertise without ongoing time.
5. **Independent holdings** (dividend-paying assets, licensed IP, referral streams — held in the Operator's own regulated financial accounts): the last layer, funded by the earlier layers.

## Rule
Never fund layer N+1 with money not yet earned from layer N. Never leave layer N to build layer N+1 — grow N+1 alongside.

## Risk Guardrails
- No layer requires borrowing against another layer's future income.
- Each layer has a documented shutdown procedure (how to wind it down without hurting the others).
- SENTINEL reviews the stack quarterly for concentration and single points of failure.
- Any activity involving investing, trading, custody, or transferring funds happens through the Operator's own regulated accounts, after their own due diligence — never through MOS.`,
  },

  {
    category: "pattern",
    title: "Pattern — Turning Successful Activity Into a System",
    summary: "The three-repeat rule for what becomes an SOP.",
    source: "Operator + APEX doctrine",
    tags: ["pattern", "sop", "systematization"],
    body: `# Pattern — Systematization Trigger

## The Three-Repeat Rule
Any activity you have performed successfully three times, that produced a meaningful outcome each time, is a candidate for an SOP.

## Systematization Steps
1. **Reconstruct** the last successful run in writing. Every input, every step, every judgment call.
2. **Identify** the judgment calls where you made a decision the average person wouldn't make automatically.
3. **Convert** each judgment call into an explicit criterion or a "escalate to operator" flag.
4. **Write** the SOP as if for someone with no context.
5. **Test** the SOP by handing it to someone (or an executive agent) and watching them run it without your help.
6. **Refine** based on where they got stuck — those points are missing context, not user error.
7. **Publish** to the SOP library. Tag with the mission or domain it serves.

## Anti-Pattern
Writing an SOP for something you've only done once. You are documenting luck, not a system.`,
  },
  {
    category: "sop",
    title: "SOP — Mission Kickoff",
    summary: "How every new mission begins, so nothing important is skipped.",
    source: "MOS operating doctrine",
    tags: ["sop", "mission", "kickoff"],
    body: `# SOP — Mission Kickoff

## Trigger
The Operator has decided something is important enough to become a mission.

## Steps
1. **IRIS defines intent.** One paragraph: what changes when this is complete, why it matters, what success looks like.
2. **APEX designs structure.** Phases, deliverables, KPIs, dependencies, and the SOPs or templates this mission will produce.
3. **KATANA writes the plan.** First three moves, resources needed, first blocker likely to appear, approval points.
4. **SENTINEL flags risk.** Risk classification, required approval level (1–5), safeguards, verdict.
5. **Operator confirms** or edits, then charters the mission.
6. **Mission is created** in the record with stage=chartered, sponsor executive assigned, deliverables + risks locked in.
7. **Activity log entry** made: "Mission chartered by Operator."

## Rule
No mission moves to Active until it has been through all four executives. Skipping a step creates a mission that will fail at exactly the skipped step.`,
  },
];
