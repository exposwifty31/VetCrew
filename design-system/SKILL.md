---
name: vetcrew-design
description: Use this skill to generate well-branded interfaces and assets for VetCrew, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping. VetCrew is a Hebrew-first (RTL), tablet-first veterinary ER/ICU crew-training and readiness-assessment product with three distinct surfaces (AAR replay viewer, instructor console, trainee station).
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## VetCrew-specific rules you must not break
- **RTL-native, Hebrew-first.** Design in Hebrew with logical properties (`inset-inline-*`, `margin-inline`, `border-inline-start`) — never LTR-then-flip. Mirror directional icons.
- **Severity is never hue-only.** Always pair color with the `SeverityGlyph` shape + a text label. `normal` is quiet/neutral; color appears only from `watch` upward. Validate any new severity treatment in greyscale.
- **Teal = action only.** Never use the action teal for severity or status. Running-session status is its own green.
- **Never fake live data.** A dropped connection uses the `reconnecting` state (freeze + hatch + last-seen), which must never resemble a live reading.
- **Three registers, not one.** The AAR viewer (reflective/data-rich), instructor console (dense/fast/hard-to-mis-click), and trainee station (calm/glanceable/partial) share tokens but are different instruments — do not homogenize them.
- **Tablet-first & AA.** ≥44px touch targets, visible focus rings, WCAG 2.1 AA contrast, tabular mono for any ticking number.

## How to use the files
- Link `styles.css` for all tokens (primitive→semantic→component; light + dark via `data-theme`).
- Mount components from the compiled bundle: `const { Button, SeverityChip, VitalCard, TimelineScrubber, ... } = window.DesignSystem_ad98cb` (see each component's `.prompt.md`).
- Icons: load Lucide (CDN) + `assets/icons.js`, then `<VC.Icon name="..." />`.
- Study `ui_kits/` for how the three registers compose the primitives.
