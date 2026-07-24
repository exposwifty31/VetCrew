# T2 — NIBP task: decision-body spec

**Status:** design spec, ready for Claude Design · **Date:** 2026-07-25
**Belongs to:** `docs/specs/base-rung-srs.md` §4 T2 and §4b (task-interaction principle)
**Clinical source:** SunTech Vet20 operator's manual, 80-0066-00-MO Rev D — the device actually used on the floor.

---

## 1. Why this task is the flagship

Every competency tracker on the market can record *"NIBP: done."* None of them can record:

> *"On a 22 kg dog, chose cuff #2 (undersized — index marker outside the range band), measured with the patient standing, got Cuff Overpressure, re-pressed START without changing anything, then recorded a systolic that was overestimated by the undersized cuff."*

That sentence is the product. This task is where "we measure **decisions**, not tasks" stops being a claim and becomes a screen — so it is the one to build first, and the one to put on slide 7 of the concept presentation.

**The competency being tested is not "can you work the machine."** It is: *do you know what makes a blood-pressure reading trustworthy, and can you tell a bad reading from a real one?*

---

## 2. Shape: a task chip that expands into a decision body

`TaskChip` today = title + optional value field + route selector. That covers T1/T3. **T2 needs a decision body**: a task-specific panel that unfolds inside the chip as the decision tree progresses.

**Stage flow** (each stage reveals the next — never all at once, never skippable):

```
SETUP ──▶ MEASURE ──▶ ┬─▶ READING ──▶ INTERPRET ──▶ done
                      │
                      └─▶ DEVICE ERROR ──▶ DIAGNOSE ──▶ FIX ──▶ (back to MEASURE)
```

---

## 3. Stage 1 — SETUP (four decisions, none pre-filled)

Presented together, because in reality the technician sets all of this up before pressing anything. All four are independently scored.

### 3a. Patient position
Options (all selectable, including the wrong ones):
- **שכיבה על הצד** — lateral recumbency *(the manual's preferred setup)*
- **ישיבה** — seated *(acceptable **only** if paired with "hold the limb up," see 3b)*
- **עמידה** — standing *(a real error when a front limb is used — the cuff is not at heart level)*

**Design note:** show a small patient-posture illustration per option, not just text. The whole point is *cuff at heart level*, and a picture makes that legible in a way a label doesn't.

### 3b. Cuff site
- **גפה קדמית, מעל כף הרגל** — front limb, above the paw *(correct: not over a joint)*
- **גפה קדמית, מעל מפרק** — over a joint *(wrong — manual says avoid)*
- **בסיס הזנב** — tail base *(correct **only** when the patient is agitated/biting or standing)*

**Dependency:** the correctness of the site depends on the position chosen in 3a. Standing + front limb = wrong. Standing + tail base = right. Seated + front limb is right **only** with "hold the limb up" checked. The UI must let all combinations be expressed; the engine scores the combination, not each in isolation.

Include a checkbox for **"מחזיק את הגפה בגובה הלב"** (holding the limb at heart level) — which is what makes the seated option valid.

Also require the **artery-marker alignment** confirmation — the cuff has an artery marker that must sit over the limb artery.

### 3c. Cuff size — *the highest-value control on the screen*
A row of cuff options (#1 … #5), each labelled with its **limb-circumference range**.

When one is selected, show the **index marker vs. range band** exactly as the physical cuff does — because in reality the technician *can see this*; the information is available, the **judgment** is theirs.

Three cases the design must render distinctly:
1. **Index falls inside the band** → this cuff fits.
2. **Index falls outside the band** → this cuff does not fit *(selectable anyway — permitted and logged)*.
3. **Two adjacent sizes both fit** → **this is the scored judgment.** The rule is *choose the larger*; an undersized cuff **overestimates** blood pressure. The UI must not hint which one to take.

Optional secondary readout: cuff width as a % of limb circumference (target ≈ **40% dog / 30% cat**), shown as a fact, not as a verdict.

### 3d. Animal mode
**Small** / **Large** companion animal.

**Dependency:** determined by the cuff chosen in 3c — **#3 or smaller → Small; #4 or larger → Large.** Never auto-set from the cuff choice; the technician must select it, and a mismatch is both a scored error *and* a legitimate cause of `Artifact Detected` later.

---

## 4. Stage 2 — MEASURE

A single prominent **START/STOP** control (the real device's is magenta at rest, blue while measuring — mirror that behaviour, in our own palette).

During measurement, show the **live cuff pressure** inflating then bleeding down — same motion language as the SunTech component spec (inflate past systolic to an occlusion target, then step down).

The trainee may **stop** mid-measurement, as on the real device.

---

## 5. Stage 3a — DEVICE ERROR → DIAGNOSE → FIX

When the scenario injects an error, the device shows its real message and the task's **next decision becomes "what caused it?"**

Present the plausible causes as selectable options. The correct set differs per error:

| Injected error | Correct cause(s) to identify |
|---|---|
| **Artifact Detected** | patient motion/trembling · wrong animal mode · cuff position · cuff size |
| **Poor Signal Quality** | cuff position · cuff not snug · wrong cuff size |
| **Measurement Too Long** | cuff not snug/mispositioned · patient moving |
| **Cuff Overpressure** | **cuff too small** · patient movement · hose pinched · patient lying/standing on the cuff |
| **Air Blockage** | hose bent or pinched · patient lying/standing on the cuff |
| **Check Batteries / Monitor Not Ready / System Failure** | **a device fault, not a patient problem** — the device-vs-patient discrimination test |

**Then they must actually fix it** — the fix loops back to the relevant SETUP control (re-choose cuff size, re-position the patient, settle the animal) before MEASURE re-enables.

**The scored failure mode to make possible:** pressing **START again with nothing changed**. It must be available, and it must be logged as "re-attempted without addressing the cause."

---

## 6. Stage 3b — READING → INTERPRET

On a successful measurement, show **SYS / DIA / MAP / HR**.

The technician then decides:
- **Is this reading trustworthy?** (accept / discard and re-measure)
- **Take another reading** — real practice is multiple readings; the device supports **averaging**, and the UI should offer it.
- **Interpret against the species range** — the must-know is **SYS/DIA min/max for dog and cat**. MAP is displayed but is *should-know*, not the scored value.

**Scored:** whether SYS/DIA were correctly judged in/out of range for **this species**, and whether a single suspect reading was accepted uncritically.

---

## 7. What the record must store

Not "NIBP: pass/fail" — the **whole decision chain**, so the AAR can reconstruct it:

```
position: standing            ✗ (cuff not at heart level with a front limb)
site:     front limb, above paw
limb hold: —
cuff:     #2  (index OUTSIDE range band; #3 and #4 both fitted)   ✗ undersized
mode:     Small                ✓ (consistent with cuff #2)
attempt 1 → Cuff Overpressure
  diagnosed as: "patient movement"   ✗ (primary cause was the undersized cuff)
  fix applied:  none — pressed START again        ✗
attempt 2 → SYS 168 / DIA 96 (MAP 120)
  accepted without re-measure                      ✗
  interpretation: "within range"                   ✗ (overestimated by undersized cuff)
```

Every line above is one event in the log, and every ✗ links back to the moment that produced it (§4b).

---

## 8. Visual rules (inherit, don't invent)

- **This lives in the TASK zone** — matte work-software language, contained. Task code colours only; **never** a monitor channel colour. The device readout it produces belongs to the instrument zone.
- **Hebrew-first, RTL-native.** Clinical abbreviations (SYS/DIA/MAP/NIBP) stay Latin, as on the device.
- **Never pre-fill, never hint, never block.** Wrong options are always selectable; the mistake is the measurement.
- **Progressive disclosure**: stages unfold; do not show DIAGNOSE options before an error exists.
- Touch targets ≥44px; the cuff-size row must stay usable at arm's length on a tablet.

---

## 9. States for Claude Design to produce

1. **SETUP — empty**, nothing chosen (the honest starting state).
2. **SETUP — cuff selected, index inside band** (good fit).
3. **SETUP — cuff selected, index outside band** (undersized, selected anyway — permitted).
4. **SETUP — two sizes fit** (the judgment moment).
5. **MEASURING** — live cuff pressure inflating/deflating.
6. **DEVICE ERROR** — e.g. *Cuff Overpressure*, with the diagnose options revealed.
7. **DIAGNOSED + FIX REQUIRED** — cause chosen, loop back to the control that needs changing.
8. **READING** — SYS/DIA/MAP/HR with accept / re-measure / average.
9. **DONE (correct path)** and **DONE (with logged errors)** — so the contrast is visible.

---

## 10. Clinical gate

Every value in this spec — species SYS/DIA ranges, cuff-size-to-circumference bands, the #3/#4 mode threshold, the 300 mmHg overpressure limit — is a **clinical claim under §2.5**. Sourced from the Vet20 manual, but it must still be **confirmed against the named standard and signed off** before it scores a real person. The spec defines *structure*; the reviewer confirms *values*.
