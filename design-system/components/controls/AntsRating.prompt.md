A single ANTS crew-skill category scored 1–5. The scale is redundantly coded (number + fill height, not color). Crucially, every rating links to its evidence — `onJumpToEvidence` jumps the AAR timeline to the events that justify the score, so a rating is never a disconnected number.

```jsx
<AntsRating
  category="תקשורת"
  value={3}
  anchors={["חסרה", "מוגבלת", "מספקת", "טובה", "מצוינת"]}
  evidenceCount={4}
  onChange={setV}
  onJumpToEvidence={() => scrubTo(events)}
/>
```

Keyboard: it's a radiogroup; arrow keys move the rating (RTL-mirrored). Use one per ANTS category (situational awareness, decision-making, communication, leadership/teamwork).
