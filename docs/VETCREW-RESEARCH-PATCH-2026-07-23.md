# VetCrew — Research Patch, 2026-07-23

**Purpose:** apply these edits to `CLAUDE.md`. Each edit names the target section, states what's wrong, and gives drop-in replacement text.

**How to use:** hand this file to Claude Code with something like *"apply the edits in VETCREW-RESEARCH-PATCH-2026-07-23.md to CLAUDE.md, one at a time, showing me each diff before writing."*

Four findings drive these edits. Two change strategy, one corrects a prior recommendation, one confirms a prior call.

---

## Findings summary

**F1 — Hebrew STT risk was overstated.**
Nova-3 Medical is trained on English medical conversations, so that model choice would have failed. But Deepgram shipped production Hebrew monolingual STT on Nova-3 (streaming + batch, with Keyterm Prompting), and Numerals support for Hebrew followed. Keyterm Prompting allows injecting up to 100 domain terms without retraining — a plausible path for veterinary drug names. Voice is deferred, not blocked.

**F2 — A close competitor is now shipping into veterinary.**
3B Scientific owns both VSI (veterinary simulators) and iSimulate. VSI markets iSimulate as "Simulated Veterinary Monitors," with products in 46+ countries and Platinum sponsorship of the InVeST veterinary simulation conference. REALITi Go already ships: instructor Control tablet driving a separate monitor tablet, remote control over the internet, configurable checklist interface, observer app on mobile devices, built-in training management system capturing event log / vital signs history / scoring / waveforms / video, PDF scenario reports and CSV export.
Gaps it leaves: multi-role information asymmetry, veterinary-native physiology, longitudinal readiness vs time-in-training, hiring use case, Hebrew.

**F3 — Non-technical-skills scoring is less reliable than assumed, and T-NOTECHS is the wrong default.**
JVME study (Jan 2026) tested three NTS instruments on video-recorded high-fidelity canine CPR simulations. Confirms no veterinary-specific NTS instrument exists. Reported ICCs: ANTS 0.803 / 0.925 (good–excellent), OGRS 0.726 / 0.888, T-NOTECHS 0.716 / 0.883 (weakest of the three). Several individual domains of all three instruments fell below 0.75. Reliability was sufficient only when three raters were used. Authors suggest standardized rater training or veterinary-specific domain anchor points would be needed.
Context: this is an instrument problem, not a veterinary one — the original T-NOTECHS validation reported video-review ICC 0.44; the Finnish validation 0.54.

**F4 — Colyseus assessment confirmed; market pain holds.**
Colyseus is binary delta state sync, rooms and matchmaking over WebSockets, and explicitly leaves database choice to the developer. No event log, replay, or event sourcing. Turnover: VHMA/AVMA survey data put technician and assistant turnover at 25–40% annually, with roughly 30–40% of technician program graduates leaving clinical work within five years. The 79% ER/specialty turnover figure traces to Instinct Science's September 2024 report and is now ~2 years old.

---

## Edit 1 — §6.1, Hebrew STT

**Target:** section `**6.1 — Hebrew STT (was fatal, now deferred).**`

**Problem:** overstates the risk. Claims voice "would not have functioned" at the pilot site. Only true for the Medical variant.

**Replace the whole 6.1 block with:**

```markdown
**6.1 — Hebrew STT (downgraded: model substitution, not a blocker).**
Nova-3 Medical is trained on English medical conversations, so that specific model choice would have failed at an Israeli pilot site. But Deepgram now ships production Hebrew monolingual STT on Nova-3 — streaming and batch, with Keyterm Prompting and Numerals. Keyterm Prompting allows injecting up to 100 domain terms without retraining, which is the likely path for veterinary drug names.
Voice stays cut from v1 on cost and sequencing grounds, not feasibility. **Before voice re-enters scope:** benchmark Nova-3 Hebrew (not Medical) against a real recording of a Hebrew code callout with English drug names, using Keyterm Prompting loaded with your formulary.
```

---

## Edit 2 — §2, add a new product truth

**Target:** section `## 2. Product truths that constrain engineering`

**Problem:** the file's moat claim assumes instructor-console-plus-logged-session is whitespace. It is not, as of 2026.

**Insert as a new §2.6, after 2.5:**

```markdown
**2.6 — Instructor console + logged session + debrief is now table stakes, not differentiation.**
3B Scientific (which owns both VSI and iSimulate) sells iSimulate REALITi into the veterinary channel as "Simulated Veterinary Monitors." REALITi Go already ships an instructor control tablet driving a separate monitor tablet, remote control over the internet, a configurable checklist interface, an observer app, a built-in training management system capturing event log / vital signs history / scoring / waveforms / video, plus PDF and CSV export.
That covers a large share of what v1 was going to build. What it does not do: multi-role stations with genuine information asymmetry (it is one monitor plus passive observers), veterinary-native physiology (it mimics human monitors and attaches to VSI manikins), longitudinal readiness relative to time-in-training, the hiring use case, or Hebrew.
**Consequence: the defensible ground is multi-role information asymmetry + longitudinal readiness + veterinary-native scenario physiology.** Do not spend build time competing on session logging and debrief export — match it and move on.
```

---

## Edit 3 — §2.2, reframe the hiring gate

**Target:** section `**2.2 — The two use cases have different evidentiary bars.**`

**Problem:** says the hiring gate needs a score distribution. True but insufficient — new reliability data says a single live rater cannot support a verdict at all, regardless of N.

**Append to the end of 2.2, keeping the existing text:**

```markdown
Reliability data sharpens this further. In video-recorded canine CPR simulations, non-technical-skills scoring reached sufficient reliability only with **three raters**, and several individual domains of every instrument tested fell below ICC 0.75. Live single-instructor scoring is harder than video review, so one instructor cannot support a hiring verdict at any sample size.
**Reframe: VetCrew produces evidence for a hiring conversation, not a score that decides one.** A replayable, role-attributed record that a manager reviews is defensible; a number from one live rater is not. This strengthens rather than weakens the event-sourced architecture — the evidence is the product.
```

---

## Edit 4 — §3, correct the Deepgram drop rationale

**Target:** the bullet beginning `- **Deepgram Nova-3 Medical + voice (TTS/STT)** — see §6.`

**Replace that bullet with:**

```markdown
- **Voice (TTS + push-to-talk STT)** — cut on cost and sequencing, not feasibility. Nova-3 Medical is English-only, but Nova-3 Hebrew monolingual is production-available with Keyterm Prompting for domain vocabulary. Re-enters after scoring is validated (see §6.1).
```

---

## Edit 5 — §6, add a competitor-watch risk and date-stamp the market data

**Target:** section `## 6. Open risks`

**Insert as a new 6.5:**

```markdown
**6.5 — Competitor encroachment on the multi-role gap.**
iSimulate REALITi already supports adding tablets that act as monitor, defibrillator, or ventilator. That is one configuration change away from multi-station. If 3B/iSimulate ships role-specific views with information asymmetry into the veterinary channel, the primary differentiator disappears. Monitor their veterinary product releases and InVeST conference announcements quarterly.
```

**Also amend 6.4** — the 79% ER/specialty turnover figure is from Instinct Science's September 2024 report. Add: *"Re-check for a 2025 or 2026 edition before using this number externally."*

---

## Separate: skill edit (optional, apply if you agree with the clinical call)

**File:** `~/.claude/skills/vetcrew-readiness-scoring/SKILL.md`

Three changes, all driven by F3:

1. **Flip the default instrument.** The skill currently recommends "T-NOTECHS-shaped" dimensions. ANTS outperformed T-NOTECHS in exactly the canine CPR context (0.803/0.925 vs 0.716/0.883). Your clinical call, but the evidence favours ANTS as the starting rubric.

2. **Demote per-domain scoring.** The skill recommends per-dimension drift detection for veteran refreshers. Individual domains showed poor-to-moderate agreement across all three instruments. Use overall scores for anything consequential; treat domain-level output as directional only, and say so in the UI.

3. **Add the rater-count constraint.** Add to the auditability section: sufficient reliability required three raters on video review. Single live rater is below bar for consequential decisions. Either record sessions for asynchronous multi-rater review, or restrict single-rater output to formative feedback.

**Opportunity worth flagging in the skill:** the JVME authors suggest veterinary-specific domain anchor points would improve reliability. Those do not exist. Authoring them is more defensible IP than any architecture decision in this project.

---

## Sources

- Deepgram — Hebrew/Persian/Urdu on Nova-3: https://deepgram.com/learn/speech-to-text-for-hebrew-persian-urdu-on-nova-3 (Feb 2026)
- Deepgram changelog (Hebrew Numerals, Nova-3 Medical batch update): https://developers.deepgram.com/changelog (May 2026)
- Deepgram Nova-3 Medical (English medical corpus): AWS Marketplace listing; Deepgram launch release (Mar 2025)
- Veterinary Simulator Industries — iSimulate product line: https://www.vetsimulators.com/ and https://www.vetsimulators.com/blog/isimulate
- iSimulate REALITi 360 / Go feature set: https://www.isimulate.com/realiti360 ; https://www.optisafe.uk/realiti-go
- "Reliability of Three Non-Technical Skills Assessment Instruments in Video-Recorded High-Fidelity Simulations of Canine Cardiopulmonary Resuscitation," Journal of Veterinary Medical Education: https://pubmed.ncbi.nlm.nih.gov/41780033/ (Jan 2026)
- Kim et al., rescuer team size and non-technical skills, JVECC: https://onlinelibrary.wiley.com/doi/10.1111/vec.70107 (Apr 2026)
- T-NOTECHS Finnish validation (ICC 0.54; original video-review ICC 0.44), BMC Medical Education: https://pmc.ncbi.nlm.nih.gov/articles/PMC6354341/
- Colyseus docs — state synchronization, framework scope: https://docs.colyseus.io/state ; https://colyseus.io/framework/
- Instinct Science, 2nd annual State of Emergency and Specialty Veterinary Care Report (Sept 2024)
- Veterinary staffing cost/turnover aggregation citing VHMA and AVMA surveys (Jun 2026) — secondary source, verify against primary VHMA/AVMA publications before external use

**Caveat:** REALITi feature details come from vendor and distributor pages, not hands-on testing. Confirm the multi-station and information-asymmetry limitations directly with 3B/VSI before treating that gap as durable.
