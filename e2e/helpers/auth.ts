export function testBearer(
  userId: string,
  role: "manager" | "instructor" | "trainee",
): string {
  return `test:${userId}:${role}`;
}

export function authHeaders(userId: string, role: "manager" | "instructor" | "trainee") {
  return { Authorization: `Bearer ${testBearer(userId, role)}` };
}
