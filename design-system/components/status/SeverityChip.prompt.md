Severity/criticality chip — the loudest signal in VetCrew. Always redundantly coded (color **plus** a unique shape glyph **plus** the text label), so it is legible with no color perception. `normal` is deliberately neutral/quiet; color only appears from `watch` upward.

```jsx
<SeverityChip level="critical" />
<SeverityChip level="watch" appearance="outline" size="lg" />
<SeverityChip level="elevated" appearance="bare" showLabel={false} />
```

Levels (rank order): `normal` (dot, neutral) · `watch` (ring, blue) · `elevated` (triangle, amber) · `critical` (octagon, vermilion). Appearances: `solid` tinted fill, `outline` hairline, `bare` glyph+label for inline use in a card header. Hebrew labels by default; `lang="en"` for English.
