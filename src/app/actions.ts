"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser, signIn, signOut } from "@/lib/auth";
import { addStudent, addTeacher, upsertAttendance } from "@/lib/db";

function clean(value: FormDataEntryValue | null) {
  return value?.toString().trim() ?? "";
}

function fail(message: string): never {
  return redirect(`/?error=${encodeURIComponent(message)}`);
}

function succeed(message: string): never {
  return redirect(`/?success=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  const username = clean(formData.get("username"));
  const password = clean(formData.get("password"));

  if (!username || !password) {
    fail("Enter both username and password.");
  }

  const user = await signIn(username, password);

  if (!user) {
    fail("Invalid username or password.");
  }

  revalidatePath("/");
  succeed(`Welcome back, ${user.name}.`);
}

export async function logoutAction() {
  await signOut();
  revalidatePath("/");
  succeed("Signed out successfully.");
}

export async function addTeacherAction(formData: FormData) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    fail("Only admins can add teachers.");
  }

  const name = clean(formData.get("name"));
  const username = clean(formData.get("username")).toLowerCase();
  const password = clean(formData.get("password"));

  if (!name || !username || !password) {
    fail("Fill teacher name, username, and password.");
  }

  try {
    addTeacher({ name, username, password });
  } catch {
    fail("Teacher username already exists.");
  }

  revalidatePath("/");
  succeed("Teacher added successfully.");
}

export async function addStudentAction(formData: FormData) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    fail("Only admins can add students.");
  }

  const name = clean(formData.get("name"));
  const className = clean(formData.get("className"));
  const section = clean(formData.get("section")).toUpperCase();
  const rollNumber = clean(formData.get("rollNumber")).toUpperCase();
  const parentContact = clean(formData.get("parentContact"));

  if (!name || !className || !section || !rollNumber || !parentContact) {
    fail("Complete all student registration fields.");
  }

  try {
    addStudent({ name, className, section, rollNumber, parentContact });
  } catch {
    fail("This roll number already exists in the selected class and section.");
  }

  revalidatePath("/");
  succeed("Student registered successfully.");
}

export async function markAttendanceAction(formData: FormData) {
  const user = await getCurrentUser();

  if (user?.role !== "teacher") {
    fail("Only teachers can mark attendance.");
  }

  const date = clean(formData.get("date"));
  const studentIds = formData.getAll("studentId");

  if (!date || studentIds.length === 0) {
    fail("Choose a valid class and date before saving attendance.");
  }

  const rows = studentIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .map((studentId) => {
      const statusValue = clean(formData.get(`status_${studentId}`));

      return {
        studentId,
        date,
        status: statusValue === "absent" ? "absent" : "present",
        markedBy: user.id,
      } as const;
    });

  upsertAttendance(rows);

  revalidatePath("/");
  succeed("Attendance saved successfully.");
}
