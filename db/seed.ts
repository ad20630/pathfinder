import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// SAMPLE DATA: fictional employers and programs around Alpharetta, GA, for demo purposes only.
async function main() {
  const { db } = await import("./index");
  const { resources } = await import("./schema");
  await db.delete(resources);
  await db.insert(resources).values([
    {
      type: "hiring",
      title: "Regional Distribution Center: Equipment Operators",
      description: "Hiring 40 operators, $21-24/hr, paid forklift certification. Open to displaced warehouse and assembly workers.",
      skills: "forklift, inventory, warehouse, safety",
      link: "https://example.org/apply/equipment-operator",
      lat: 34.0905, lng: -84.2480,
    },
    {
      type: "hiring",
      title: "Hospital Patient Transport Aide",
      description: "Entry level, $18/hr plus benefits. Training provided. Good fit for people with customer-facing experience.",
      skills: "customer service, communication, physical stamina",
      lat: 34.0870, lng: -84.2700,
    },
    {
      type: "hiring",
      title: "Solar Installer Helper",
      description: "Apprentice-style role, $19/hr rising to $28/hr after certification. No degree needed.",
      skills: "manual work, tools, safety, teamwork",
      lat: 34.0540, lng: -84.3120,
    },
    {
      type: "hiring",
      title: "Credit Union Fraud Analyst Trainee",
      description: "Learn to review flagged transactions alongside AI fraud-detection tools. Starts at $24/hr.",
      skills: "attention to detail, data entry, customer service, AI tools",
      link: "https://example.org/apply/fraud-analyst",
      lat: 34.0707, lng: -84.2780,
    },
    {
      type: "training",
      title: "Intro to AI Tools for Office Work (free, 6 weeks)",
      description: "Evening class at the community college. Learn to use AI assistants for writing, spreadsheets and research. No prerequisites.",
      skills: "AI literacy, prompt writing, spreadsheets, writing",
      link: "https://example.org/classes/ai-office",
      lat: 34.0618, lng: -84.3097,
    },
    {
      type: "training",
      title: "CDL Truck Driving Program (12 weeks)",
      description: "Tuition covered for displaced workers through the state workforce grant. Job placement support.",
      skills: "driving, safety, logistics",
      lat: 34.0980, lng: -84.3300,
    },
    {
      type: "training",
      title: "Medical Coding Certificate (online + Saturdays)",
      description: "16-week certificate. Works well for bookkeepers and data-entry workers moving into healthcare.",
      skills: "data entry, attention to detail, health records, accounting",
      lat: 34.0460, lng: -84.2600,
    },
    {
      type: "training",
      title: "Library Digital Skills & AI Basics Lab",
      description: "Free drop-in help: computer basics, resumes, and a hands-on intro to AI chat tools. Loaner laptops available.",
      skills: "computer basics, AI literacy, resume writing",
      lat: 34.0640, lng: -84.2860,
    },
    {
      type: "support",
      title: "Workforce Center: Free Career Counseling",
      description: "One-on-one skills assessment, resume help and referrals. Walk-ins welcome Mon-Fri.",
      skills: "career counseling, resume writing, interview practice",
      lat: 34.0754, lng: -84.2941,
    },
    {
      type: "support",
      title: "Job-Seeker Childcare & Transit Vouchers",
      description: "Short-term childcare and bus passes while you retrain or interview. Apply through the Workforce Center.",
      skills: "childcare, transportation",
      lat: 34.0830, lng: -84.2850,
    },
  ]);
  console.log("Seeded.");
  process.exit(0);
}
main();
