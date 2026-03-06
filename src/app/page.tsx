import {
  addStudentAction,
  addTeacherAction,
  loginAction,
  logoutAction,
  markAttendanceAction,
} from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import {
  getClassOptions,
  getClassPerformance,
  getDailyAttendanceReport,
  getMonthlyAttendanceReport,
  getOverviewStats,
  getSectionOptions,
  getStudents,
  getStudentsForAttendance,
  getTeachers,
} from "@/lib/db";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const card =
  "rounded-[28px] border border-white/65 bg-white/80 p-5 shadow-[0_24px_80px_rgba(34,51,84,0.12)] backdrop-blur md:p-6";
const input =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#b06a3c] focus:ring-2 focus:ring-[#f2d6c2]";

function pick(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function Banner({ tone, message }: { tone: "success" | "error"; message: string }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-emerald-300/70 bg-emerald-100/80 text-emerald-950"
          : "border-rose-300/70 bg-rose-100/80 text-rose-950"
      }`}
    >
      {message}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <input
        className={input}
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  allowAll = false,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  allowAll?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <select className={input} defaultValue={value} name={name}>
        {allowAll ? <option value="">All</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,242,237,0.88))] p-5 shadow-[0_14px_30px_rgba(23,31,56,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{note}</p>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={card}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b06a3c]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-2xl text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Landing({
  success,
  error,
  stats,
}: {
  success: string;
  error: string;
  stats: { students: number; teachers: number; attendanceToday: number };
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fdf1e8,transparent_35%),radial-gradient(circle_at_top_right,#dbeafe,transparent_28%),linear-gradient(180deg,#fffdf9_0%,#f6f4ef_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden rounded-[36px] border border-white/60 bg-[#12344d] p-6 text-white shadow-[0_30px_120px_rgba(12,30,45,0.28)] md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f4c7a1_0%,transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.22),transparent_25%)] opacity-60" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#f8d6bc]">
              School Attendance Suite
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-5xl leading-tight md:text-7xl">
              Elegant attendance tracking for every class, every day.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
              Register students, manage teachers, capture class-wise attendance,
              and review daily or monthly performance in one mobile-friendly
              dashboard powered by Next.js and SQLite.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <Stat label="Students" value={String(stats.students)} note="Seeded and ready for registration updates." />
              <Stat label="Teachers" value={String(stats.teachers)} note="Only teacher accounts can mark attendance." />
              <Stat label="Today" value={String(stats.attendanceToday)} note="Attendance entries already captured today." />
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f6c6a5]">
                  Included Modules
                </p>
                <ul className="mt-4 grid gap-3 text-sm text-slate-100">
                  <li>Student registration with class, section, roll number, and parent contact</li>
                  <li>Teacher-only login for present and absent marking</li>
                  <li>Date-wise and class-wise attendance management</li>
                  <li>Daily reports, monthly reports, and attendance percentages</li>
                  <li>Admin workspace for teacher and student management</li>
                </ul>
              </div>
              <div className="rounded-[28px] border border-white/15 bg-[#f8f3ec] p-5 text-slate-900">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b06a3c]">
                  Demo Access
                </p>
                <div className="mt-4 grid gap-4 text-sm">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="font-semibold">Admin portal</p>
                    <p className="mt-1 text-slate-600">Username: <span className="font-medium text-slate-900">admin</span></p>
                    <p className="text-slate-600">Password: <span className="font-medium text-slate-900">Admin@123</span></p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="font-semibold">Teacher portal</p>
                    <p className="mt-1 text-slate-600">Username: <span className="font-medium text-slate-900">teacher</span></p>
                    <p className="text-slate-600">Password: <span className="font-medium text-slate-900">Teacher@123</span></p>
                  </div>
                  <p className="text-xs leading-6 text-slate-500">
                    SQLite is a local file database, so there are no separate
                    database credentials to expose in the frontend.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-[36px] border border-white/70 bg-white/78 p-6 shadow-[0_24px_100px_rgba(34,51,84,0.12)] backdrop-blur md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#b06a3c]">
              Staff Login
            </p>
            <h2 className="mt-4 font-serif text-4xl text-slate-950">
              Secure access for teachers and admin staff
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Teachers can mark attendance. Admins can register students, add
              teachers, and review institutional reports.
            </p>
          </div>
          <div className="mt-8 grid gap-4">
            {success ? <Banner tone="success" message={success} /> : null}
            {error ? <Banner tone="error" message={error} /> : null}
          </div>
          <form action={loginAction} className="mt-8 grid gap-4">
            <Field label="Username" name="username" placeholder="Enter your username" />
            <Field label="Password" name="password" placeholder="Enter your password" type="password" />
            <button className="mt-2 rounded-2xl bg-[#12344d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0c2739]">
              Sign in
            </button>
          </form>
          <div className="mt-8 rounded-[28px] bg-[linear-gradient(135deg,#f6ede4,#fff7ee)] p-5">
            <p className="text-sm font-semibold text-slate-900">Mobile-friendly by design</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              The interface is tuned for phones, tablets, and desktops so staff
              can check attendance quickly during class.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const success = pick(params.success);
  const error = pick(params.error);
  const classes = getClassOptions().map((item) => item.className);
  const stats = getOverviewStats();

  if (!user) {
    return <Landing error={error} stats={stats} success={success} />;
  }

  const attClass = pick(params.attClass) || classes[0] || "";
  const attSections = getSectionOptions(attClass || undefined).map((item) => item.section);
  const attSection = pick(params.attSection) || attSections[0] || "";
  const attDate = pick(params.attDate) || today;
  const reportClass = pick(params.reportClass);
  const reportSections = getSectionOptions(reportClass || undefined).map((item) => item.section);
  const reportSection = pick(params.reportSection);
  const safeReportSection = reportSections.includes(reportSection) ? reportSection : "";
  const reportDate = pick(params.reportDate) || today;
  const reportMonth = pick(params.reportMonth) || currentMonth;

  const teachers = getTeachers();
  const students = getStudents();
  const attendanceRows = getStudentsForAttendance({
    className: attClass || undefined,
    section: attSection || undefined,
    date: attDate,
  });
  const dailyReport = getDailyAttendanceReport({
    date: reportDate,
    className: reportClass || undefined,
    section: safeReportSection || undefined,
  });
  const monthlyReport = getMonthlyAttendanceReport({
    month: reportMonth,
    className: reportClass || undefined,
    section: safeReportSection || undefined,
  });
  const classPerformance = getClassPerformance({ month: reportMonth });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7efe7,transparent_25%),radial-gradient(circle_at_bottom_right,#d7e5ff,transparent_25%),linear-gradient(180deg,#f8f4ee_0%,#eff5fb_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#12344d_0%,#204f73_55%,#d1a17a_100%)] p-6 text-white shadow-[0_28px_120px_rgba(14,33,58,0.28)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#f8d8bf]">
                {user.role === "admin" ? "Admin Dashboard" : "Teacher Workspace"}
              </p>
              <h1 className="mt-4 font-serif text-4xl md:text-5xl">
                {user.role === "admin"
                  ? "School operations in one refined dashboard."
                  : "Mark attendance with speed and clarity."}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-100 md:text-base">
                Signed in as {user.name} ({user.username}).{" "}
                {user.role === "admin"
                  ? "Manage teachers, register students, and review performance trends."
                  : "Attendance tools are restricted to teacher accounts only, with date-wise and class-wise controls."}
              </p>
            </div>
            <form action={logoutAction}>
              <button className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/18">
                Logout
              </button>
            </form>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Students" value={String(stats.students)} note="Active registered learners across all classes." />
          <Stat label="Teachers" value={String(stats.teachers)} note="Teacher accounts available for attendance marking." />
          <Stat label="Attendance Today" value={String(stats.attendanceToday)} note="Date-wise entries saved for the current day." />
        </div>
        <div className="mt-6 grid gap-4">
          {success ? <Banner tone="success" message={success} /> : null}
          {error ? <Banner tone="error" message={error} /> : null}
        </div>
        {user.role === "admin" ? (
          <div className="mt-6 grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Section
                eyebrow="Add Teachers"
                title="Create teacher login accounts"
                description="Admin users can add teacher usernames and passwords. Attendance marking remains restricted to teachers."
              >
                <form action={addTeacherAction} className="grid gap-4 md:grid-cols-2">
                  <Field label="Teacher name" name="name" placeholder="e.g. Riya Patel" />
                  <Field label="Username" name="username" placeholder="e.g. riya.patel" />
                  <div className="md:col-span-2">
                    <Field label="Password" name="password" placeholder="Create a password" type="password" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button className="rounded-2xl bg-[#12344d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0d293d]">
                      Add teacher
                    </button>
                  </div>
                </form>
              </Section>
              <Section
                eyebrow="Student Registration"
                title="Register new students"
                description="Capture student name, class or section, roll number, and parent contact. The record becomes immediately available in reports and attendance views."
              >
                <form action={addStudentAction} className="grid gap-4 md:grid-cols-2">
                  <Field label="Student name" name="name" placeholder="e.g. Neha Joshi" />
                  <Field label="Class" name="className" placeholder="e.g. 7" />
                  <Field label="Section" name="section" placeholder="e.g. B" />
                  <Field label="Roll number" name="rollNumber" placeholder="e.g. 07B15" />
                  <div className="md:col-span-2">
                    <Field label="Parent contact" name="parentContact" placeholder="e.g. +91 98765 11111" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button className="rounded-2xl bg-[#b06a3c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#9b5c33]">
                      Register student
                    </button>
                  </div>
                </form>
              </Section>
            </div>

            <Section
              eyebrow="Reports"
              title="Daily, monthly, and percentage-based attendance reports"
              description="Use the filters below to inspect attendance by date, month, class, or section. Percentages are calculated from recorded attendance entries."
            >
              <form className="grid gap-4 md:grid-cols-4">
                <Field label="Daily report date" name="reportDate" defaultValue={reportDate} type="date" />
                <Field label="Monthly report" name="reportMonth" defaultValue={reportMonth} type="month" />
                <SelectField label="Class" name="reportClass" options={classes} value={reportClass} allowAll />
                <SelectField
                  label="Section"
                  name="reportSection"
                  options={reportSections}
                  value={safeReportSection}
                  allowAll
                />
                <div className="md:col-span-4 flex justify-end">
                  <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300">
                    Apply filters
                  </button>
                </div>
              </form>
              <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] bg-[#f7f4ef] p-4">
                  <h3 className="font-serif text-2xl text-slate-950">Daily report</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="pb-3 font-medium">Class</th>
                          <th className="pb-3 font-medium">Present</th>
                          <th className="pb-3 font-medium">Absent</th>
                          <th className="pb-3 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyReport.length > 0 ? (
                          dailyReport.map((row) => (
                            <tr key={`${row.className}-${row.section}`} className="border-t border-slate-200/80">
                              <td className="py-3 font-medium text-slate-900">Class {row.className} - {row.section}</td>
                              <td className="py-3 text-emerald-700">{row.presentCount}</td>
                              <td className="py-3 text-rose-700">{row.absentCount}</td>
                              <td className="py-3 text-slate-700">{row.totalStudents}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-5 text-slate-500" colSpan={4}>
                              No attendance rows for the selected date.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-[24px] bg-[#fffaf5] p-4">
                  <h3 className="font-serif text-2xl text-slate-950">Monthly report</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="pb-3 font-medium">Student</th>
                          <th className="pb-3 font-medium">Class</th>
                          <th className="pb-3 font-medium">Present</th>
                          <th className="pb-3 font-medium">Absent</th>
                          <th className="pb-3 font-medium">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyReport.length > 0 ? (
                          monthlyReport.map((row) => (
                            <tr key={row.id} className="border-t border-slate-200/80">
                              <td className="py-3 font-medium text-slate-900">{row.name}</td>
                              <td className="py-3 text-slate-700">{row.className} - {row.section}</td>
                              <td className="py-3 text-emerald-700">{row.presentCount}</td>
                              <td className="py-3 text-rose-700">{row.absentCount}</td>
                              <td className="py-3 text-slate-700">{percent(row.attendancePercentage)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-5 text-slate-500" colSpan={5}>
                              No monthly attendance data for the selected filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[24px] bg-[#f0f6ff] p-4">
                  <h3 className="font-serif text-2xl text-slate-950">Class-wise attendance</h3>
                  <div className="mt-4 grid gap-3">
                    {classPerformance.length > 0 ? (
                      classPerformance.map((row) => (
                        <div
                          key={`${row.className}-${row.section}`}
                          className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
                        >
                          <span className="font-medium text-slate-900">Class {row.className} - {row.section}</span>
                          <span className="text-sm font-semibold text-[#12344d]">{percent(row.averageAttendance)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Class performance will appear after attendance is marked.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-[24px] bg-[#f7f4ef] p-4">
                  <h3 className="font-serif text-2xl text-slate-950">Registered students</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="pb-3 font-medium">Name</th>
                          <th className="pb-3 font-medium">Class</th>
                          <th className="pb-3 font-medium">Roll</th>
                          <th className="pb-3 font-medium">Parent contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id} className="border-t border-slate-200/80">
                            <td className="py-3 font-medium text-slate-900">{student.name}</td>
                            <td className="py-3 text-slate-700">{student.className} - {student.section}</td>
                            <td className="py-3 text-slate-700">{student.rollNumber}</td>
                            <td className="py-3 text-slate-700">{student.parentContact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Section>
            <Section
              eyebrow="Team"
              title="Teacher directory"
              description="These are the current teacher accounts available for attendance operations."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {teachers.map((teacher) => (
                  <div key={teacher.id} className="rounded-[24px] bg-[#fff8f2] p-4">
                    <p className="font-semibold text-slate-950">{teacher.name}</p>
                    <p className="mt-1 text-sm text-slate-600">@{teacher.username}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        ) : (
          <div className="mt-6 grid gap-6">
            <Section
              eyebrow="Attendance Marking"
              title="Teacher-only daily attendance"
              description="Choose a class, section, and date. Every student defaults to present unless explicitly marked absent."
            >
              <form className="grid gap-4 md:grid-cols-4">
                <SelectField label="Class" name="attClass" options={classes} value={attClass} />
                <SelectField label="Section" name="attSection" options={attSections} value={attSection} />
                <Field label="Attendance date" name="attDate" defaultValue={attDate} type="date" />
                <div className="flex items-end">
                  <button className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300">
                    Load class list
                  </button>
                </div>
              </form>
              <form action={markAttendanceAction} className="mt-6">
                <input name="date" type="hidden" value={attDate} />
                <div className="overflow-x-auto rounded-[24px] bg-[#f7f4ef] p-3">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-3 pl-3 font-medium">Student</th>
                        <th className="pb-3 font-medium">Roll number</th>
                        <th className="pb-3 font-medium">Parent contact</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRows.length > 0 ? (
                        attendanceRows.map((student) => (
                          <tr key={student.id} className="border-t border-slate-200/80 bg-white">
                            <td className="px-3 py-4">
                              <input name="studentId" type="hidden" value={student.id} />
                              <div className="font-medium text-slate-950">{student.name}</div>
                              <div className="text-xs text-slate-500">Class {student.className} - {student.section}</div>
                            </td>
                            <td className="py-4 text-slate-700">{student.rollNumber}</td>
                            <td className="py-4 text-slate-700">{student.parentContact}</td>
                            <td className="py-4">
                              <div className="inline-flex rounded-full bg-slate-100 p-1">
                                <label className="cursor-pointer rounded-full px-3 py-2 text-xs font-semibold text-slate-700 has-[:checked]:bg-emerald-600 has-[:checked]:text-white">
                                  <input
                                    className="sr-only"
                                    defaultChecked={student.status !== "absent"}
                                    name={`status_${student.id}`}
                                    type="radio"
                                    value="present"
                                  />
                                  Present
                                </label>
                                <label className="cursor-pointer rounded-full px-3 py-2 text-xs font-semibold text-slate-700 has-[:checked]:bg-rose-600 has-[:checked]:text-white">
                                  <input
                                    className="sr-only"
                                    defaultChecked={student.status === "absent"}
                                    name={`status_${student.id}`}
                                    type="radio"
                                    value="absent"
                                  />
                                  Absent
                                </label>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-8 text-slate-500" colSpan={4}>
                            No students found for this class and section.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="rounded-2xl bg-[#12344d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0d293d]">
                    Save attendance
                  </button>
                </div>
              </form>
            </Section>
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Section
                eyebrow="Daily Overview"
                title="Date-wise class summary"
                description="Once a teacher saves attendance, the selected day summary appears here."
              >
                <div className="grid gap-3">
                  {dailyReport.length > 0 ? (
                    dailyReport.map((row) => (
                      <div key={`${row.className}-${row.section}`} className="rounded-[24px] bg-[#f7f4ef] p-4">
                        <p className="font-semibold text-slate-900">Class {row.className} - {row.section}</p>
                        <div className="mt-3 flex gap-3 text-sm">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                            Present: {row.presentCount}
                          </span>
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
                            Absent: {row.absentCount}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No attendance data has been submitted for the selected date.
                    </p>
                  )}
                </div>
              </Section>
              <Section
                eyebrow="Monthly Performance"
                title="Student attendance percentage"
                description="This monthly list helps teachers identify attendance trends and follow up with parents if needed."
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-3 font-medium">Student</th>
                        <th className="pb-3 font-medium">Present</th>
                        <th className="pb-3 font-medium">Absent</th>
                        <th className="pb-3 font-medium">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyReport.length > 0 ? (
                        monthlyReport.map((row) => (
                          <tr key={row.id} className="border-t border-slate-200/80">
                            <td className="py-3 font-medium text-slate-900">{row.name}</td>
                            <td className="py-3 text-emerald-700">{row.presentCount}</td>
                            <td className="py-3 text-rose-700">{row.absentCount}</td>
                            <td className="py-3 text-slate-700">{percent(row.attendancePercentage)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-5 text-slate-500" colSpan={4}>
                            No monthly attendance data available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
