/* VetCrew AAR — sample session data (event-sourced replay).
   window.VCAAR_DATA. Times are seconds from session start. */
window.VCAAR_DATA = {
  session: {
    title: "החייאת כלב — היפוך קיבה (GDV)",
    scenario: "gdv-canine-v1",
    date: "24 ביולי 2026 · 08:14",
    duration: 420,
    state: "scored",
    engine: "Alpha · פרוצדורלי",
  },
  roles: [
    { id: "primary_tech", label: "טכנאי ראשי", short: "ט.ר" },
    { id: "vet",          label: "וטרינר",     short: "וט" },
    { id: "triage_tech",  label: "טכנאי טריאז'", short: "ט.ט" },
  ],
  // ordered event log
  events: [
    { id: "e1",  t: 12,  type: "phase",     role: "patient",      label: "קבלה וטריאז'", detail: "כלב גזע גדול, בטן תפוחה, ניסיונות הקאה." },
    { id: "e2",  t: 34,  type: "callout",   role: "triage_tech",  label: "זיהוי GDV והסלמה", detail: "הטכנאי מזהה את התמונה ומסלים מיידית לצוות." },
    { id: "e3",  t: 74,  type: "action",    role: "primary_tech", label: "גישה ורידית", detail: "צנתר 18G בגף קדמי שמאלי — 62 שניות מהקבלה." },
    { id: "e4",  t: 96,  type: "callout",   role: "vet",          label: "קריאת מדדים בקול", detail: "\"דופק 176, ריריות חיוורות\" — לולאה סגורה חלקית." },
    { id: "e5",  t: 132, type: "action",    role: "primary_tech", label: "התחלת נוזלים", detail: "בולוס גבישי 20ml/kg." },
    { id: "e6",  t: 168, type: "vitals",    role: "patient",      label: "דופק עולה", detail: "HR 188 — טרם ייצוב.", severity: "elevated" },
    { id: "e7",  t: 196, type: "injection", role: "instructor",   label: "בעל הבית נכנס נסער", detail: "הזרקת מדריך — הסחת דעת בזמן טיפול." },
    { id: "e8",  t: 244, type: "action",    role: "vet",          label: "דקומפרסיה", detail: "החדרת צינור קיבה, שחרור גז." },
    { id: "e9",  t: 300, type: "vitals",    role: "patient",      label: "החמרה חולפת", detail: "HR 196, CRT 4ש' — לפני תגובה לטיפול.", severity: "critical" },
    { id: "e10", t: 348, type: "vitals",    role: "patient",      label: "התייצבות", detail: "HR יורד ל-150, ריריות משתפרות.", severity: "watch" },
    { id: "e11", t: 396, type: "phase",     role: "patient",      label: "סיום — מטופל מיוצב", detail: "מועבר להמשך ניטור." },
  ],
  // vitals breakpoints; the viewer interpolates between them
  vitals: {
    hr:   [[0,160],[74,176],[168,188],[300,196],[348,150],[420,142]],
    spo2: [[0,95],[168,93],[300,90],[348,94],[420,96]],
    rr:   [[0,44],[168,48],[300,52],[348,36],[420,30]],
    temp: [[0,38.9],[420,38.4]],
  },
  scores: {
    ants: [
      { key: "sa",   label: "מודעות מצבית", value: 4, anchors: ["חסרה","מוגבלת","מספקת","טובה","מצוינת"], evidence: ["e2","e6","e9"] },
      { key: "dm",   label: "קבלת החלטות", value: 4, anchors: ["חסרה","מוגבלת","מספקת","טובה","מצוינת"], evidence: ["e3","e5","e8"] },
      { key: "comm", label: "תקשורת", value: 3, anchors: ["חסרה","מוגבלת","מספקת","טובה","מצוינת"], evidence: ["e4","e7"] },
      { key: "lead", label: "מנהיגות וצוות", value: 3, anchors: ["חסרה","מוגבלת","מספקת","טובה","מצוינת"], evidence: ["e2","e8"] },
    ],
    technical: [
      { label: "גישה ורידית < 3 דקות", done: true,  weight: 3, t: 74 },
      { label: "בולוס נוזלים מתאים",     done: true,  weight: 2, t: 132 },
      { label: "דקומפרסיה בזמן",         done: true,  weight: 3, t: 244 },
      { label: "ניטור רציף מדווח בקול",  done: false, weight: 2, t: 96 },
    ],
  },
};
