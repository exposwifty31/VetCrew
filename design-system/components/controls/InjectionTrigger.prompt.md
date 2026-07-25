Large, well-spaced injection target for the instructor console. Fires immediately on click — injections are a live pedagogical judgment call and must be fast (no confirm dialog; confirmation is only for destructive actions). After firing it shows the fire time and stays legible as "spent".

```jsx
<InjectionTrigger title="בעל הבית נכנס נסער" description="מסיח את דעת הצוות בזמן טיפול" kind="מידע" icon={<UserIcon/>} onFire={fire} />
<InjectionTrigger title="החמרה למצב הלם" kind="סיבוך" fired firedAt="T+04:12" />
```

`kind` is a neutral category chip (complication / info / equipment / second patient) — never colored by severity. Sized to `--control-h-lg` (56px) with strong hairlines so it's hard to mis-hit.
