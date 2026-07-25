Action button — petrol-teal is the one interactive color in the whole system; use `danger` only for destructive, irreversible actions (which the instructor console confirms first).

```jsx
<Button variant="primary" size="lg" onClick={fire}>שלח</Button>
<Button variant="secondary" iconStart={<PlayIcon/>}>המשך</Button>
<Button variant="ghost" size="sm">בטל</Button>
<Button variant="danger">סיים סשן</Button>
```

Variants: `primary` (teal fill), `secondary` (outline + teal text), `ghost` (text only), `danger` (vermilion fill). Sizes: `sm` 40px (dense AAR desktop toolbars), `md` 48px default, `lg` 56px (instructor injection actions). Always ≥44px touch on md/lg. RTL-aware icon slots (`iconStart`/`iconEnd`).
