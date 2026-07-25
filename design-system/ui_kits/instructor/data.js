/* VetCrew instructor console — sample live-session data. window.VCINS_DATA */
window.VCINS_DATA = {
  session: { title: "החייאת כלב — GDV", scenario: "gdv-canine-v1", engine: "Alpha · פרוצדורלי" },
  roles: [
    { id: "primary_tech", label: "טכנאי ראשי", who: "נועה ל.", conn: "live",         task: "מבצע גישה ורידית" },
    { id: "vet",          label: "וטרינר",     who: "ד״ר כהן",  conn: "live",         task: "מעריך ריריות ו-CRT" },
    { id: "triage_tech",  label: "טכנאי טריאז'", who: "יונתן ר.", conn: "reconnecting", task: "—" },
  ],
  vitals: { hr: 176, spo2: 93, rr: 46, temp: 38.7 },
  injections: [
    { id: "owner",   title: "בעל הבית נכנס נסער", desc: "הסחת דעת לצוות בזמן טיפול", kind: "מידע", icon: "user-round" },
    { id: "history", title: "היסטוריה חדשה מהתיק", desc: "אירוע דומה לפני חודשיים", kind: "מידע", icon: "file-text" },
    { id: "iv-fail", title: "כשל בגישה הורידית", desc: "הצנתר יוצא — נדרשת גישה חוזרת", kind: "ציוד", icon: "zap-off" },
    { id: "monitor", title: "תקלה במוניטור", desc: "קריאת SpO₂ הופכת ללא אמינה", kind: "ציוד", icon: "monitor-off" },
    { id: "second",  title: "מטופל שני בטריאז'", desc: "עומס — חלוקת קשב בין שני מטופלים", kind: "מטופל נוסף", icon: "plus" },
  ],
  // becomes available on a condition (surfaced, not auto-fired)
  conditional: { id: "shock", title: "החמרה למצב הלם", desc: "זמין: לא בוצעה גישה ורידית עד T+90ש'", kind: "סיבוך", icon: "activity" },
};
