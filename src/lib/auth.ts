import { cookies } from "next/headers";

import {
  createSession,
  deleteSession,
  getSessionUser,
  getUserByCredentials,
  verifyPassword,
} from "@/lib/db";

const sessionCookieName = "attendance_session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  return getSessionUser(token);
}

export async function signIn(username: string, password: string) {
  const user = getUserByCredentials(username);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  const { token, expiresAt } = createSession(user.id);
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
    path: "/",
  });

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  deleteSession(token);
  cookieStore.delete(sessionCookieName);
}
