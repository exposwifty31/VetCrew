---
name: vetcrew-scenario-authoring
description: How to define and structure a VetCrew training scenario — patient vitals/deterioration model, role objectives, instructor injection points, and the non-technical-skill dimensions a scenario is meant to exercise. Consult this whenever writing or editing a scenario definition, converting a clinical case into a training scenario, designing the scenario schema/editor, or deciding what a new scenario should test. Use even if the user just says "let's build the GDV scenario" or "add a new case" without mentioning "scenario authoring" explicitly.
---

# VetCrew Scenario Authoring

A scenario is content, not code. It should be data (JSON/YAML) that a non-engineer — including Dan wearing his clinical-content hat, not his developer hat — can write or edit without touching the sim engine. This mirrors the discipline VetTrack already uses for Hebrew UI strings living in one file, not scattered through components: keep the domain content separable from the system that runs it.

## Anatomy of a scenario

1. **Patient profile** — species, signalment, presenting complaint, baseline vitals.
2. **Vitals model** — a parametrized deterioration/improvement curve, not a per-second script. Define it as "HR trends toward X over Y minutes if untreated, toward Z if [specific intervention] occurs" rather than hardcoding a timeline. A scripted-per-second timeline breaks the moment a crew acts faster or slower than expected, which is the whole point of the exercise.
3. **Role objectives** — per station, what "correct" looks like: a checklist of expected actions, not a single correct path. Some items are role-specific (the person on IV access has different objectives than the person managing the airway); some are shared (someone should call out vitals changes — that's a communication objective, not a task objective).
4. **Injection points** — predefined, optional events the instructor can trigger live: a complication, new information (owner calls, prior history surfaces), an equipment failure, a second patient arriving mid-scenario. These are *available*, not scheduled — the instructor decides live whether and when to use them based on how the crew is doing.
5. **Trigger conditions** — most injections are instructor-manual, but some can be conditional (e.g. "if no one has secured IV access by T+90s, [complication] becomes available to trigger"). Keep conditional triggers rare and legible — a scenario with too many auto-triggers stops being instructor-driven and starts being a fixed script, which undercuts the "live crew trainer" value proposition.
6. **Scoring hooks** — which non-technical-skill dimensions (see `vetcrew-readiness-scoring`) this scenario is designed to exercise. Not every scenario needs to test every dimension — a straightforward stabilization case tests different things than a "two patients, one team" triage-under-load scenario.

## Why instructor-injected branching, not authored branching trees

It's tempting to pre-author a full decision tree ("if the crew does X, go to branch A; if Y, branch B..."). Don't. Branching trees explode authoring cost combinatorially, and the market research on military/medical crew trainers consistently favors the opposite pattern: a live instructor console that can "insert flags" into a running scenario, rather than a pre-scripted tree the system walks automatically. Author a solid baseline vitals trajectory plus a menu of optional injections, and let the human instructor provide the branching judgment live. This is cheaper to build, cheaper to author, and puts the pedagogical judgment where it belongs — with the instructor, not the content author.

## Example scaffold

```yaml
scenario_id: gdv-canine-v1
title: "Canine GDV — decompensating"
species: canine
presenting_complaint: "Large-breed dog, acute abdominal distension, retching"

baseline_vitals:
  hr: 160
  resp_rate: 40
  mm_color: pale
  crt_sec: 2.5

deterioration:
  untreated_trend: "HR rises toward 200, CRT worsens toward 4s over 10 min"
  on_iv_access_and_fluids: "HR stabilizes, does not worsen further"
  on_decompression: "resp_rate and mm_color begin improving within 3 min"

role_objectives:
  primary_tech:
    - "Establish IV access within 3 minutes"
    - "Call out vitals changes to the team (closed-loop communication)"
  triage_tech:
    - "Recognize GDV presentation and escalate immediately"
  team_shared:
    - "Confirm decompression plan verbally before acting"

injection_points:
  - id: owner_arrives_distressed
    description: "Owner arrives at treatment area, distressed, asking questions"
    trigger: manual
  - id: second_patient_triage
    description: "A second, lower-acuity patient arrives requiring triage"
    trigger: manual

conditional_injections:
  - id: decompensation_escalates
    condition: "no_iv_access_by_t90s"
    description: "Patient begins showing signs of shock"

scoring_dimensions: [situational_awareness, communication, decision_making]
```

## Clinical accuracy is a liability boundary, not a UX detail

Because scenario performance can feed a hiring-readiness decision (see `vetcrew-readiness-scoring`), a clinically inaccurate scenario isn't just a bad training experience — it's a bad input to a hiring decision. Any scenario touching current-standard protocols (e.g. CPR/resuscitation sequencing) should be checked against current RECOVER guidelines or equivalent before it's used for anything other than internal testing. Flag this explicitly in a scenario's metadata (`clinically_reviewed: true/false`) rather than assuming review happened.

## Versioning

Scenarios are versioned independently of the sim engine. A scenario used to score a hiring decision should record which version was used, so a later scenario edit doesn't retroactively change the meaning of a past score.
