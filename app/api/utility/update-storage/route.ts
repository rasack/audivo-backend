import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/database/mongo";
import User from "@/models/User";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function POST(req: NextRequest) {
  try {
    await dbConnect(); // Ensure MongoDB connection

    const { isAuthenticated, getUser } = getKindeServerSession();

    if (!(await isAuthenticated())) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const kindeUser = await getUser();
    if (!kindeUser || !kindeUser.email) {
      return NextResponse.json({ success: false, message: "User details not found in Kinde" }, { status: 400 });
    }

    const body = await req.json();
    const { given } = body;

    // Find user by email and increment totalReq
    const updatedUser = await User.findOneAndUpdate(
      { email: kindeUser.email },
      { $inc: { storageUsed: given } },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ success: false, message: "User not found in database" }, { status: 404 });
    }

    return NextResponse.json({ success: true, size:updatedUser.storageUsed }, { status: 200 });
  } catch (error) {
    console.error("Error in increment API:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}
