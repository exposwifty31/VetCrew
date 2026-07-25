/* VetCrew trainee station — sample data. window.VCTR_DATA */
window.VCTR_DATA = {
  role: { label: "טכנאי ראשי", who: "נועה ל." },
  patient: "כלב · גזע גדול · GDV",
  // what THIS role sees (partial view). abp is withheld — must ask the team.
  visible: { hr: 168, spo2: 92 },
  withheld: [{ abbr: "ABP", name: "לחץ דם", holder: "וטרינר" }],
  steps: [
    "אשר זהות מטופל ומשקל",
    "הכן ערכת צנתר 18G",
    "בצע גישה ורידית — גף קדמי שמאלי",
    "חבר סט עירוי ובצע בולוס גבישי",
    "קרא מדדים בקול לצוות",
    "תעד את הפעולה ועדכן וטרינר",
  ],
};
