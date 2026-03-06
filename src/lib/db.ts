import Database from "better-sqlite3";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type Role = "admin" | "teacher";
export type AttendanceStatus = "present" | "absent";

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  role: Role;
};

export type Student = {
  id: number;
  name: string;
  className: string;
  section: string;
  rollNumber: string;
  parentContact: string;
};

export type AttendanceStudentRow = Student & {
  status: AttendanceStatus | null;
};

const dataDirectory = path.join(process.cwd(), "data");
const dbPath = path.join(dataDirectory, "attendance.db");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const inputHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, "hex");

  return (
    inputHash.length === storedBuffer.length &&
    timingSafeEqual(inputHash, storedBuffer)
  );
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      section TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      parent_contact TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_name, section, roll_number)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      staff_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
      marked_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, date),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (marked_by) REFERENCES staff(id) ON DELETE CASCADE
    );
  `);

  const insertStaff = db.prepare(`
    INSERT OR IGNORE INTO staff (name, username, password_hash, role)
    VALUES (@name, @username, @password_hash, @role)
  `);

  insertStaff.run({
    name: "Principal Admin",
    username: "admin",
    password_hash: hashPassword("Admin@123"),
    role: "admin",
  });

  insertStaff.run({
    name: "Aarav Sharma",
    username: "teacher",
    password_hash: hashPassword("Teacher@123"),
    role: "teacher",
  });

  const studentCount =
    (db.prepare("SELECT COUNT(*) AS count FROM students").get() as {
      count: number;
    }).count ?? 0;

  if (studentCount === 0) {
    const insertStudent = db.prepare(`
      INSERT INTO students (name, class_name, section, roll_number, parent_contact)
      VALUES (@name, @class_name, @section, @roll_number, @parent_contact)
    `);

    const seedStudents = [
      ["Anaya Verma", "8", "A", "08A01", "+91 98765 12340"],
      ["Vihaan Kapoor", "8", "A", "08A02", "+91 98765 12341"],
      ["Ishita Nair", "8", "B", "08B01", "+91 98765 12342"],
      ["Arjun Mehta", "9", "A", "09A01", "+91 98765 12343"],
      ["Siya Reddy", "9", "A", "09A02", "+91 98765 12344"],
      ["Kabir Singh", "10", "C", "10C01", "+91 98765 12345"],
    ];

    const transaction = db.transaction(() => {
      for (const student of seedStudents) {
        insertStudent.run({
          name: student[0],
          class_name: student[1],
          section: student[2],
          roll_number: student[3],
          parent_contact: student[4],
        });
      }
    });

    transaction();
  }
}

initializeDatabase();

export function createSession(staffId: number) {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  db.prepare(
    "INSERT INTO sessions (token, staff_id, expires_at) VALUES (?, ?, ?)",
  ).run(token, staffId, expiresAt);

  return { token, expiresAt };
}

export function getUserByCredentials(username: string) {
  return db
    .prepare(
      "SELECT id, name, username, password_hash, role FROM staff WHERE username = ?",
    )
    .get(username) as
    | (SessionUser & {
        password_hash: string;
      })
    | undefined;
}

export function getSessionUser(token: string | undefined) {
  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `
      SELECT staff.id, staff.name, staff.username, staff.role
      FROM sessions
      JOIN staff ON staff.id = sessions.staff_id
      WHERE sessions.token = ? AND sessions.expires_at > CURRENT_TIMESTAMP
    `,
    )
    .get(token) as SessionUser | undefined;

  return row ?? null;
}

export function deleteSession(token: string | undefined) {
  if (!token) {
    return;
  }

  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function addTeacher(input: {
  name: string;
  username: string;
  password: string;
}) {
  db.prepare(
    `
    INSERT INTO staff (name, username, password_hash, role)
    VALUES (?, ?, ?, 'teacher')
  `,
  ).run(input.name, input.username, hashPassword(input.password));
}

export function addStudent(input: {
  name: string;
  className: string;
  section: string;
  rollNumber: string;
  parentContact: string;
}) {
  db.prepare(
    `
    INSERT INTO students (name, class_name, section, roll_number, parent_contact)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(
    input.name,
    input.className,
    input.section,
    input.rollNumber,
    input.parentContact,
  );
}

export function upsertAttendance(
  rows: Array<{
    studentId: number;
    date: string;
    status: AttendanceStatus;
    markedBy: number;
  }>,
) {
  const statement = db.prepare(`
    INSERT INTO attendance (student_id, date, status, marked_by, updated_at)
    VALUES (@studentId, @date, @status, @markedBy, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, date)
    DO UPDATE SET
      status = excluded.status,
      marked_by = excluded.marked_by,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    for (const row of rows) {
      statement.run(row);
    }
  });

  transaction();
}

export function getStudents(filters?: { className?: string; section?: string }) {
  const where: string[] = [];
  const params: string[] = [];

  if (filters?.className) {
    where.push("class_name = ?");
    params.push(filters.className);
  }

  if (filters?.section) {
    where.push("section = ?");
    params.push(filters.section);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  return db
    .prepare(
      `
      SELECT
        id,
        name,
        class_name AS className,
        section,
        roll_number AS rollNumber,
        parent_contact AS parentContact
      FROM students
      ${clause}
      ORDER BY CAST(class_name AS INTEGER), section, roll_number
    `,
    )
    .all(...params) as Student[];
}

export function getStudentsForAttendance(filters: {
  className?: string;
  section?: string;
  date: string;
}) {
  const where: string[] = [];
  const params: string[] = [filters.date];

  if (filters.className) {
    where.push("students.class_name = ?");
    params.push(filters.className);
  }

  if (filters.section) {
    where.push("students.section = ?");
    params.push(filters.section);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  return db
    .prepare(
      `
      SELECT
        students.id,
        students.name,
        students.class_name AS className,
        students.section,
        students.roll_number AS rollNumber,
        students.parent_contact AS parentContact,
        attendance.status
      FROM students
      LEFT JOIN attendance
        ON attendance.student_id = students.id
        AND attendance.date = ?
      ${clause}
      ORDER BY CAST(students.class_name AS INTEGER), students.section, students.roll_number
    `,
    )
    .all(...params) as AttendanceStudentRow[];
}

export function getOverviewStats() {
  const [studentRow, teacherRow, attendanceRow] = [
    db.prepare("SELECT COUNT(*) AS count FROM students").get() as { count: number },
    db.prepare("SELECT COUNT(*) AS count FROM staff WHERE role = 'teacher'").get() as {
      count: number;
    },
    db.prepare(
      "SELECT COUNT(*) AS count FROM attendance WHERE date = date('now', 'localtime')",
    ).get() as { count: number },
  ];

  return {
    students: studentRow.count,
    teachers: teacherRow.count,
    attendanceToday: attendanceRow.count,
  };
}

export function getClassOptions() {
  return db
    .prepare(
      `
      SELECT DISTINCT class_name AS className
      FROM students
      ORDER BY CAST(class_name AS INTEGER), class_name
    `,
    )
    .all() as Array<{ className: string }>;
}

export function getSectionOptions(className?: string) {
  const query = className
    ? `
      SELECT DISTINCT section
      FROM students
      WHERE class_name = ?
      ORDER BY section
    `
    : `
      SELECT DISTINCT section
      FROM students
      ORDER BY section
    `;

  return className
    ? (db.prepare(query).all(className) as Array<{ section: string }>)
    : (db.prepare(query).all() as Array<{ section: string }>);
}

export function getDailyAttendanceReport(filters: {
  date: string;
  className?: string;
  section?: string;
}) {
  const where = ["attendance.date = ?"];
  const params: string[] = [filters.date];

  if (filters.className) {
    where.push("students.class_name = ?");
    params.push(filters.className);
  }

  if (filters.section) {
    where.push("students.section = ?");
    params.push(filters.section);
  }

  return db
    .prepare(
      `
      SELECT
        students.class_name AS className,
        students.section,
        COUNT(*) AS totalStudents,
        SUM(CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END) AS presentCount,
        SUM(CASE WHEN attendance.status = 'absent' THEN 1 ELSE 0 END) AS absentCount
      FROM attendance
      JOIN students ON students.id = attendance.student_id
      WHERE ${where.join(" AND ")}
      GROUP BY students.class_name, students.section
      ORDER BY CAST(students.class_name AS INTEGER), students.section
    `,
    )
    .all(...params) as Array<{
    className: string;
    section: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
  }>;
}

export function getMonthlyAttendanceReport(filters: {
  month: string;
  className?: string;
  section?: string;
}) {
  const where = ["substr(attendance.date, 1, 7) = ?"];
  const params: string[] = [filters.month];

  if (filters.className) {
    where.push("students.class_name = ?");
    params.push(filters.className);
  }

  if (filters.section) {
    where.push("students.section = ?");
    params.push(filters.section);
  }

  return db
    .prepare(
      `
      SELECT
        students.id,
        students.name,
        students.class_name AS className,
        students.section,
        students.roll_number AS rollNumber,
        SUM(CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END) AS presentCount,
        SUM(CASE WHEN attendance.status = 'absent' THEN 1 ELSE 0 END) AS absentCount,
        ROUND(
          CAST(SUM(CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END) AS REAL)
          * 100.0
          / COUNT(*),
          1
        ) AS attendancePercentage
      FROM attendance
      JOIN students ON students.id = attendance.student_id
      WHERE ${where.join(" AND ")}
      GROUP BY students.id
      ORDER BY attendancePercentage DESC, students.name
    `,
    )
    .all(...params) as Array<{
    id: number;
    name: string;
    className: string;
    section: string;
    rollNumber: string;
    presentCount: number;
    absentCount: number;
    attendancePercentage: number;
  }>;
}

export function getClassPerformance(filters: { month: string }) {
  return db
    .prepare(
      `
      SELECT
        students.class_name AS className,
        students.section,
        ROUND(
          AVG(CASE WHEN attendance.status = 'present' THEN 100.0 ELSE 0 END),
          1
        ) AS averageAttendance
      FROM attendance
      JOIN students ON students.id = attendance.student_id
      WHERE substr(attendance.date, 1, 7) = ?
      GROUP BY students.class_name, students.section
      ORDER BY averageAttendance DESC
    `,
    )
    .all(filters.month) as Array<{
    className: string;
    section: string;
    averageAttendance: number;
  }>;
}

export function getTeachers() {
  return db
    .prepare(
      `
      SELECT id, name, username
      FROM staff
      WHERE role = 'teacher'
      ORDER BY name
    `,
    )
    .all() as Array<{ id: number; name: string; username: string }>;
}
