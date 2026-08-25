import ExcelJS from "exceljs";

type ShortlistRow = {
  title: string;
  cluster: string;
  organizer: string | null;
  minGrade: number;
  maxGrade: number;
  registrationOpensOn: Date | null;
  registrationDeadline: Date;
  fee: string | null;
  mode: string | null;
  link: string;
};

const dateFmt = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function styleHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
  ws.getRow(1).alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function buildShortlistWorkbook(studentName: string, rows: ShortlistRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Extracurricular Activities Portal";
  const ws = wb.addWorksheet("My shortlist");

  ws.columns = [
    { header: "Activity", key: "title", width: 38 },
    { header: "Category", key: "cluster", width: 22 },
    { header: "Organizer", key: "organizer", width: 24 },
    { header: "Grades", key: "grades", width: 12 },
    { header: "Registration opens", key: "opens", width: 18 },
    { header: "Registration deadline", key: "deadline", width: 20 },
    { header: "Fee", key: "fee", width: 16 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Link", key: "link", width: 45 },
  ];

  rows.forEach((r) => {
    ws.addRow({
      title: r.title,
      cluster: r.cluster,
      organizer: r.organizer ?? "—",
      grades: `${r.minGrade}–${r.maxGrade}`,
      opens: dateFmt(r.registrationOpensOn),
      deadline: dateFmt(r.registrationDeadline),
      fee: r.fee ?? "—",
      mode: r.mode ?? "—",
      link: r.link,
    });
  });

  styleHeader(ws);
  ws.eachRow((row, i) => {
    if (i > 1) row.getCell("link").font = { color: { argb: "FF4338CA" }, underline: true };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

type TrackingRow = {
  activityTitle: string;
  cluster: string;
  studentName: string;
  studentEmail: string;
  grade: number | null;
  clicked: boolean;
  clickCount: number;
  lastClickedAt: Date | null;
  selfReportedRegistered: boolean;
  selfReportedAt: Date | null;
};

export async function buildTrackingWorkbook(rows: TrackingRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Extracurricular Activities Portal";
  const ws = wb.addWorksheet("Engagement tracking");

  ws.columns = [
    { header: "Activity", key: "activityTitle", width: 34 },
    { header: "Category", key: "cluster", width: 20 },
    { header: "Student", key: "studentName", width: 22 },
    { header: "Email", key: "studentEmail", width: 30 },
    { header: "Grade", key: "grade", width: 8 },
    { header: "Clicked link?", key: "clicked", width: 14 },
    { header: "Click count", key: "clickCount", width: 12 },
    { header: "Last clicked", key: "lastClickedAt", width: 18 },
    { header: "Self-reported registered?", key: "selfReportedRegistered", width: 22 },
    { header: "Reported on", key: "selfReportedAt", width: 16 },
  ];

  rows.forEach((r) => {
    ws.addRow({
      activityTitle: r.activityTitle,
      cluster: r.cluster,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      grade: r.grade ?? "—",
      clicked: r.clicked ? "Yes" : "No",
      clickCount: r.clickCount,
      lastClickedAt: dateFmt(r.lastClickedAt),
      selfReportedRegistered: r.selfReportedRegistered ? "Yes" : "No",
      selfReportedAt: dateFmt(r.selfReportedAt),
    });
  });

  styleHeader(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
