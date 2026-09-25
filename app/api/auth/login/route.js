import { NextResponse } from "next/server";
import {
  checkPassword,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/auth";

// A short, IP-agnostic slow-down: this route isn't rate-limited, but
// the passcode is a shared secret you rotate on Vercel, not a
// per-user account — treat repeated failures as a signal to rotate it.
export async function POST(request) {
  let password = "";
  try {
    const body = await request.json();
    password = body?.password ?? "";
  } catch (err) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!process.env.HSE_UPLOAD_PASSWORD) {
    return NextResponse.json(
      {
        error:
          "Upload isn't configured yet — HSE_UPLOAD_PASSWORD is missing from the server's environment variables.",
      },
      { status: 500 }
    );
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  let token;
  try {
    token = createSessionToken();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Upload isn't configured yet — AUTH_SECRET is missing from the server's environment variables.",
      },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
