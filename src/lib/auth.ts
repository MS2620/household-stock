const QUICK_ADD_TOKEN = process.env.QUICK_ADD_TOKEN;

if (!QUICK_ADD_TOKEN) {
  throw new Error(
    "QUICK_ADD_TOKEN is not set in the environment variables.",
  );
}

export function verifyQuickAddToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);

  return token === QUICK_ADD_TOKEN;
}