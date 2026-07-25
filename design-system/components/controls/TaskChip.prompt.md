Base-rung task primitive — the SmartFlow-style *mental model* (color-coded task squares) in VetCrew's own visual language. Deliberately **matte and contained**: it lives only inside the task panel and never uses a monitor channel color. Redundantly coded — filled square badge color + code icon shape + Hebrew code label.

```jsx
<TaskChip code="do" title="בצע TPR על צ'רלי" />
<TaskChip code="timed" title="NIBP כל 15 דק׳"
  window={{ label:"חלון 15 דק׳", remaining:"נותרו 4:12", closing:true }} />
<TaskChip code="approval" title="מתן מורפיום" onCallDoctor={escalate} />
<TaskChip code="do" state="locked" title="החלפת עירוי" holder="דנה כ." />
```

Codes: `do` (amber) · `report` (purple, perform→enter value) · `timed` (green, windowed) · `approval` (red, locked, only action = call doctor). States: `available` / `in_progress` / `done` / `error` / `locked` / `released`. Never computes an answer; wrong report values are shown invalid but not auto-corrected.

## Medication tasks — drug · dose · route are three separately scored dimensions

A `report` chip is the medication primitive. The task names the **drug** and states a dose in **mg** (never in ml — computing ml is the assessment). The technician scores on three independent dimensions:

1. **drug** — named in `title` (context; the task tells them which drug).
2. **dose** — the `report` field: the technician computes ml themselves. Never pre-filled, never computed for them. A wrong volume is shown invalid (`reportError`) but never auto-corrected.
3. **route** — the `routeOptions` selector (IV / IM / SC / PO). Never pre-filled, never hinted.

```jsx
// fresh medication task — dose blank, no route chosen. Title states drug + mg only.
<TaskChip code="report" title="Cefazolin · 250 mg" detail="חשב נפח, בחר מתן, ודווח"
  reportUnit="ml" reportValue={ml} onReportChange={setMl}
  routeOptions={["IV","IM","SC","PO"]} route={chosen} onRouteChange={setRoute} />

// wrong route LOGGED — e.g. a SC-only drug given IV. Flagged, not blocked.
<TaskChip code="report" title="Diphenhydramine · 20 mg" reportUnit="ml"
  reportValue="0.8" routeOptions={["IV","IM","SC","PO"]} route="IV" routeError />
```

**Rules that must not soften (these ARE the assessment):**
- **Route is never pre-filled and never hinted.** All options — including contraindicated ones — are always offered, so a wrong choice is *expressible*. The mistake is the measurement.
- **A wrong route is LOGGED, never blocked.** `routeError` flags the chosen route (redundantly: red border + ⚠ icon + the note "מתן שגוי — נרשם"), but selection stays changeable. Blocking the mistake destroys the instrument.
- **Correct volume by the wrong route is a FAIL, not partial credit.** Dose and route are scored separately; a right number down a fatal route is still a fatal error.
- **The component carries slots, not verdicts.** WHICH routes are contraindicated for WHICH drug is scenario data requiring clinical sign-off (§2.5). `routeError` is passed in by the engine/scenario; the chip never hardcodes a contraindication.

**QA-trap variant (built separately — F2/step 24):** at Tier 4 an order *someone else logged* specifies a contraindicated route; the correct technician action is **refuse and flag**, not execute. That "refuse / flag for review" action is a first-class control, as prominent as completing — see the `approval` code's escalate pattern.
