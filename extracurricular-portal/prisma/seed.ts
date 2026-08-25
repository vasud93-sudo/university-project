// Demo data seed - real activities extracted from the school's own
// "Career Counselling School Wide Communication (2026-27)" document, plus a
// synthetic student roster and a handful of engagement events so every
// admin/student view has something to show on first run.
//
// Run with: npm run db:seed

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const d = (s: string) => new Date(s);

async function main() {
  console.log("Seeding…");

  // --- Admin -----------------------------------------------------------
  await prisma.user.upsert({
    where: { email: "admin@fountainheadschools.org" },
    create: { email: "admin@fountainheadschools.org", name: "Career Counselling Admin", role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  // --- Clusters ----------------------------------------------------------
  const clusterDefs = [
    { name: "STEM & Olympiads", colorTag: "violet", description: "Science, maths & logic competitions" },
    { name: "University Admissions & Testing", colorTag: "sky", description: "Standardized tests, application timelines, guidance" },
    { name: "Innovation & Research", colorTag: "emerald", description: "Research fairs, innovation grants, science awards" },
    { name: "Global Programs & Entrepreneurship", colorTag: "amber", description: "International camps, summer schools, business programs" },
    { name: "Arts, Design & Architecture", colorTag: "rose", description: "Design, architecture & creative enrichment" },
    { name: "Sports & Leadership", colorTag: "teal", description: "Athletics, MUN, and leadership programs" },
  ];
  const clusters: Record<string, string> = {};
  for (const c of clusterDefs) {
    const row = await prisma.cluster.upsert({
      where: { name: c.name },
      create: c,
      update: { colorTag: c.colorTag, description: c.description },
    });
    clusters[c.name] = row.id;
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@fountainheadschools.org" } });

  // --- Students (demo roster) --------------------------------------------
  const students = [
    { name: "Diya Shah", email: "diya.shah@fountainheadschools.org", grade: 6, section: "A" },
    { name: "Kabir Singh", email: "kabir.singh@fountainheadschools.org", grade: 6, section: "A" },
    { name: "Vihaan Patel", email: "vihaan.patel@fountainheadschools.org", grade: 7, section: "A" },
    { name: "Myra Kapoor", email: "myra.kapoor@fountainheadschools.org", grade: 7, section: "B" },
    { name: "Ishaan Verma", email: "ishaan.verma@fountainheadschools.org", grade: 8, section: "A" },
    { name: "Anaya Reddy", email: "anaya.reddy@fountainheadschools.org", grade: 8, section: "A" },
    { name: "Aarav Mehta", email: "aarav.mehta@fountainheadschools.org", grade: 9, section: "A" },
    { name: "Saanvi Iyer", email: "saanvi.iyer@fountainheadschools.org", grade: 9, section: "A" },
    { name: "Reyansh Nair", email: "reyansh.nair@fountainheadschools.org", grade: 9, section: "B" },
    { name: "Aditi Rao", email: "aditi.rao@fountainheadschools.org", grade: 10, section: "A" },
    { name: "Arjun Malhotra", email: "arjun.malhotra@fountainheadschools.org", grade: 10, section: "B" },
    { name: "Kiara Bose", email: "kiara.bose@fountainheadschools.org", grade: 11, section: "A" },
    { name: "Vivaan Joshi", email: "vivaan.joshi@fountainheadschools.org", grade: 11, section: "A" },
    { name: "Ananya Desai", email: "ananya.desai@fountainheadschools.org", grade: 12, section: "A" },
    { name: "Rohan Gupta", email: "rohan.gupta@fountainheadschools.org", grade: 12, section: "A" },
  ];
  const studentIds: Record<string, string> = {};
  for (const s of students) {
    const row = await prisma.user.upsert({
      where: { email: s.email },
      create: { ...s, role: "STUDENT" },
      update: { name: s.name, grade: s.grade, section: s.section },
    });
    studentIds[s.email] = row.id;
  }

  // --- Activities, extracted from Communications #22, 24, 25, 27, 28, 29 -
  // and #13, of the school's own Term 1 2026-27 document. Dates are as
  // stated there; four activities (marked below) never had a literal URL in
  // the source text (just linked button text like "Click Here") so they use
  // an example.com placeholder - swap in the real link before real use.
  const activityDefs = [
    {
      title: "Harvard Undergraduate Science Olympiad (HUSO) 2026",
      organizer: "Learn with Leaders, in collaboration with Harvard Undergraduate Science Olympiad",
      summary: "Interdisciplinary STEM olympiad across Biology, Earth Science, Chemistry, Physics & Maths, with a Harvard bootcamp for top scorers.",
      description: `HUSO challenges students beyond the classroom syllabus, evaluating critical thinking and practical application across Biology, Earth Science, Chemistry, Physics, and Mathematics.

Rewards & Recognition
• All participants: official Certificate of Participation from HUSO
• Top 100 students: Harvard certificates, medals, and an invite to a 4-day in-person STEM bootcamp with Harvard mentors in New Delhi (January 2027)
• Top 10 students: trophies, distinction medals, a scholarship from École Polytechnique, and a USD 200 scholarship for Learn with Leaders programs
• Overall winner: a fully funded summer camp at Harvard University

Competition structure
• Round 1 (online): 3-hour multiple-choice exam, 14th & 15th November 2026. Category 1 = Grades 7-8, Category 2 = Grades 9-10.
• Round 2 (in-person, January 2027): top 100 students (50 per category) advance to a 4-day STEM bootcamp and written exam in New Delhi.

Fee: ₹2000 + 18% GST per student, discounted to ₹1700 (incl. taxes) for Fountainhead School students using scholarship code SCHVICHUSO at checkout.`,
      link: "https://example.com/register/huso-2026",
      fee: "₹1700 (incl. taxes) with code SCHVICHUSO",
      mode: "Online (Round 1), In-person New Delhi (Round 2)",
      minGrade: 7,
      maxGrade: 10,
      registrationOpensOn: d("2026-08-12"),
      registrationDeadline: d("2026-11-10"),
      eventDate: d("2026-11-14"),
      status: "PUBLISHED" as const,
      clusterId: clusters["STEM & Olympiads"],
      sourceNote: "Communication 27 - link was a 'Click Here' button in the source doc, not a literal URL. Placeholder - replace before real use.",
    },
    {
      title: "Ramanujan National Maths Challenge (RNMC) 2026",
      organizer: "All India Council for Technical Skill Development (AICTSD)",
      summary: "National-level mathematics competition recognising talented young mathematicians with the title 'National Maths Scholar - 2026'.",
      description: `A national-level mathematics competition conducted by AICTSD, aiming to identify and recognise talented young mathematicians.

Key details
• Eligibility: Grades 4-12
• Last date to register: 30 November 2026
• Online examination: 15 December 2026
• Final result: 10 January 2027
• Registration fee: ₹270
• Mode: Online

Prizes: 1st ₹1,00,000 · 2nd ₹50,000 · 3rd ₹25,000

Registration is subject to eligibility criteria specified by AICTSD - review the syllabus before registering.`,
      link: "https://example.com/register/rnmc-2026",
      fee: "₹270",
      mode: "Online",
      minGrade: 4,
      maxGrade: 12,
      registrationOpensOn: d("2026-08-19"),
      registrationDeadline: d("2026-11-30"),
      eventDate: d("2026-12-15"),
      status: "PUBLISHED" as const,
      clusterId: clusters["STEM & Olympiads"],
      sourceNote: "Communication 28 - link was 'RNMC 2026 Registration - AICTSD' button text, not a literal URL. Placeholder - replace before real use.",
    },
    {
      title: "Entrepreneurship Powered by AI Winter Camp — University of Salamanca, Spain",
      organizer: "Learn with Leaders",
      summary: "Highly selective 20-student global program in startup creation, AI-driven business strategy and financial literacy at the University of Salamanca.",
      description: `A highly selective global learning opportunity hosted at the historic University of Salamanca in Spain, 13th-19th December 2026 (7 days / 6 nights). Only 20 students admitted globally.

Program highlights
• Elite mentorship from Professor George Benaroya (NYU Faculty, rated 5/5) in leadership, marketing and finance
• AI & financial mastery: using AI for research/brand strategy, building profit & loss models, personal finance skills
• University profile boost: Letter of Participation from NYU Faculty and University of Salamanca; top 20% earn a Letter of Recommendation from NYU Faculty
• Global exposure: cultural tours in Spain, networking, and a pitch-style business plan presentation

Fee (includes accommodation, meals, and transfers to/from Madrid Airport - travel to Madrid is arranged by the family):
• Early Bird: EUR 3,250 (by 31 October 2026)
• Regular: EUR 3,850 (by 15 November 2026)`,
      link: "https://example.com/register/salamanca-ai-camp",
      fee: "EUR 3,250 early bird / EUR 3,850 regular",
      mode: "Offline — Salamanca, Spain",
      location: "University of Salamanca, Spain",
      minGrade: 8,
      maxGrade: 12,
      registrationOpensOn: d("2026-08-01"),
      registrationDeadline: d("2026-11-15"),
      eventDate: d("2026-12-13"),
      status: "PUBLISHED" as const,
      clusterId: clusters["Global Programs & Entrepreneurship"],
      sourceNote: "Communication 29 - link was a brochure/'Apply Here' button, not a literal URL. Placeholder - replace before real use.",
    },
    {
      title: "INSPIRE Awards – MANAK 2026 (National Innovation Foundation)",
      organizer: "Department of Science & Technology (DST) / National Innovation Foundation (NIF)",
      summary: "Submit an original technological idea solving a real-world problem for a shot at national recognition and a ₹10,000 award.",
      description: `A flagship DST program (INSPIRE - MANAK) motivating students aged 10-16 to innovate and address real societal problems through science and technology.

Who can participate: individual students (not groups) from Grades 6-12, ages 10-16.

What's invited: original, creative technological ideas/innovations solving a daily problem - household, agricultural, labour, or societal. Ideas are judged on novelty, problem-solving value, social applicability, cost-effectiveness, and relevance to current government schemes.

Note: each student needs a bank account in their own name before submitting, since the ₹10,000 award (if selected) is transferred via Direct Benefit Transfer.

The school shortlists the best 5 entries to nominate on behalf of Fountainhead School.

Deadline to submit ideas: 1 September 2026, via the linked Google Form.`,
      link: "https://docs.google.com/forms/d/e/1FAIpQLSdT-vIW63vqzyGPQaqQd823aot9i_onRqHUr5KFNBFiQaz31A/viewform?usp=dialog",
      fee: "Free to enter (₹10,000 award if selected)",
      mode: "Online submission",
      minGrade: 6,
      maxGrade: 12,
      registrationOpensOn: d("2026-08-10"),
      registrationDeadline: d("2026-09-01"),
      eventDate: null,
      status: "PUBLISHED" as const,
      clusterId: clusters["Innovation & Research"],
      sourceNote: "Communication 25",
    },
    {
      title: "International Logic Olympiad (ILO) 2026",
      organizer: "International Logic Olympiad",
      summary: "A curriculum-free logic, analytical thinking and problem-solving competition — no coaching or prep required.",
      description: `Unlike traditional Olympiads, the ILO isn't tied to any school syllabus. It tests logical reasoning, analytical thinking, and problem-solving through fun, objective multiple-choice questions, entirely online.

Format
• Qualifier round: Saturday, 24th January 2027 (all registered students get a Certificate of Participation)
• Grand Finals: Saturday, 31st January 2027 (top 20% of qualifier round advance)

What you get when you register: a "One Problem a Day" logic puzzle delivered by email from the day you register, plus national exposure by benchmarking against peers countrywide.

Categories: Junior (Grade 7), Senior (Grades 8-11).`,
      link: "https://example.com/register/ilo-2026",
      fee: "₹500",
      mode: "Online",
      minGrade: 7,
      maxGrade: 11,
      registrationOpensOn: d("2026-08-11"),
      registrationDeadline: d("2026-11-30"),
      eventDate: d("2027-01-24"),
      status: "PUBLISHED" as const,
      clusterId: clusters["STEM & Olympiads"],
      sourceNote: "Communication 24 - link was a 'Register for ILO Here' button, not a literal URL. Placeholder - replace before real use.",
    },
    {
      title: "PSAT Exam 2026–27",
      organizer: "College Board, administered by Fountainhead School",
      summary: "Digital PSAT registration is open — recommended early practice for students planning to take the SAT.",
      description: `Registration for the digital PSAT exam for 2026-27 is open. The PSAT is highly recommended for students planning to appear for the SAT (the US university entrance exam) - research shows students who take the PSAT score significantly higher on the SAT later.

Fountainhead School has been an authorised PSAT test centre since 2017.

Why take it
• An early, low-pressure university-readiness assessment (scores aren't shared with universities)
• Excellent, cost-effective SAT practice, assessing the same skills in a grade-appropriate way
• A detailed score report and skill breakdown to target practice efficiently
• Can be linked to a free Khan Academy SAT practice account for customized prep

Exam date: 7 October 2026. Payment (UPI, net banking, credit/debit card) is completed as part of registration via the linked circular.`,
      link: "https://parents.fountainheadschools.org/EmailDisplay/Circulars?CircularmasterID=4573",
      fee: "Paid at registration (multiple payment methods)",
      mode: "In-person, Fountainhead School campus",
      minGrade: 8,
      maxGrade: 11,
      registrationOpensOn: d("2026-07-15"),
      registrationDeadline: d("2026-08-10"),
      eventDate: d("2026-10-07"),
      status: "PUBLISHED" as const,
      clusterId: clusters["University Admissions & Testing"],
      sourceNote: "Communication 22 — deadline already passed as of this seed's reference date; kept published to demonstrate the 'closed' state.",
    },
    {
      title: "Indian Olympiad Qualifier in Mathematics (IOQM) 2026–27",
      organizer: "HBCSE / Mathematics Teachers' Association of India (MTAI)",
      summary: "The first-stage qualifier for India's national Mathematical Olympiad programme.",
      description: `IOQM is the entry point to India's prestigious Mathematical Olympiad programme, open to students in Grades 8-12 who meet eligibility criteria.

Focuses on mathematical reasoning, logical thinking, creativity and problem-solving - drawing from number theory, algebra, geometry and combinatorics - rather than routine calculation.

Why participate: develop higher-order mathematical thinking, gain exposure to national-level academic competition, and strengthen your profile for future academic and university applications.

Exam date: 6 September 2026 (Sunday).`,
      link: "https://ioqm.mtai.org.in/",
      fee: "As per AICTSD/HBCSE norms",
      mode: "Online / test centre (per HBCSE norms)",
      minGrade: 8,
      maxGrade: 12,
      registrationOpensOn: d("2026-08-15"),
      registrationDeadline: d("2026-08-30"),
      eventDate: d("2026-09-06"),
      status: "PUBLISHED" as const,
      clusterId: clusters["STEM & Olympiads"],
      sourceNote: "Communication 13 — source note didn't state an explicit registration deadline (only the exam date, 6 Sept); deadline here is inferred as ~1 week before the exam.",
    },
  ];

  const activityIds: Record<string, string> = {};
  for (const a of activityDefs) {
    const existing = await prisma.activity.findFirst({ where: { title: a.title } });
    const row = existing
      ? await prisma.activity.update({ where: { id: existing.id }, data: { ...a, createdById: admin.id } })
      : await prisma.activity.create({ data: { ...a, createdById: admin.id } });
    activityIds[a.title] = row.id;
  }

  const huso = activityIds["Harvard Undergraduate Science Olympiad (HUSO) 2026"];
  const ioqm = activityIds["Indian Olympiad Qualifier in Mathematics (IOQM) 2026–27"];
  const inspire = activityIds["INSPIRE Awards – MANAK 2026 (National Innovation Foundation)"];
  const ilo = activityIds["International Logic Olympiad (ILO) 2026"];
  const salamanca = activityIds["Entrepreneurship Powered by AI Winter Camp — University of Salamanca, Spain"];

  const aarav = studentIds["aarav.mehta@fountainheadschools.org"];
  const saanvi = studentIds["saanvi.iyer@fountainheadschools.org"];
  const ishaan = studentIds["ishaan.verma@fountainheadschools.org"];
  const reyansh = studentIds["reyansh.nair@fountainheadschools.org"];
  const kiara = studentIds["kiara.bose@fountainheadschools.org"];

  // --- Sample engagement: shortlists, clicks, self-reports ---------------
  const shortlists: [string, string][] = [
    [aarav, huso],
    [aarav, ilo],
    [saanvi, ioqm],
    [kiara, salamanca],
  ];
  for (const [studentId, activityId] of shortlists) {
    await prisma.shortlist.upsert({
      where: { activityId_studentId: { activityId, studentId } },
      create: { activityId, studentId },
      update: {},
    });
  }

  const clicks: [string, string, "REMINDER_EMAIL" | "BROWSE" | "BULK_EMAIL", number][] = [
    [aarav, huso, "REMINDER_EMAIL", 2],
    [saanvi, ioqm, "BROWSE", 1],
    [ishaan, huso, "REMINDER_EMAIL", 1],
    [reyansh, ilo, "BULK_EMAIL", 1],
  ];
  for (const [studentId, activityId, source, count] of clicks) {
    for (let i = 0; i < count; i++) {
      await prisma.activityClick.create({ data: { studentId, activityId, source } });
    }
  }

  const selfReports: [string, string][] = [
    [aarav, inspire],
    [ishaan, huso],
  ];
  for (const [studentId, activityId] of selfReports) {
    await prisma.registrationSelfReport.upsert({
      where: { activityId_studentId: { activityId, studentId } },
      create: { activityId, studentId },
      update: {},
    });
  }

  console.log(`Seeded ${Object.keys(clusters).length} clusters, ${students.length} students, ${activityDefs.length} activities.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
