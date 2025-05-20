import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import dbConnect from "@/lib/database/mongo";
import User from '@/models/User';
import { NextResponse } from "next/server";
import { UserType } from "@/lib/types";
export async function GET() {
  try {
    // Get the user's session
    const {getUser} = getKindeServerSession();
    const user = await getUser(); // Use the `getUser` method to fetch user details
    await dbConnect();
    const dbUser = await User.findOne({ user: user?.id });
    if (!dbUser || dbUser.type !== UserType.Admin) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 200 }
            );
        }
    else{
        return NextResponse.json(
            { success: true },
            { status: 200 }
        );
    }    

  } catch (error) {
    console.error('Error fetching user session:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to fetch user session' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
