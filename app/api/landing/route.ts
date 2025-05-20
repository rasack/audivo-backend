// app/api/check-user/route.ts (API Route)
import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function GET(req: NextRequest) {
  // Retrieve the session using Kinde's helper
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (user) {
    // If the user is authenticated, respond with a flag to redirect to /music
    return NextResponse.json({ redirectToMusic: true });
  }

  // If the user is not authenticated, return a flag to not redirect
  return NextResponse.json({ redirectToMusic: false });
}
