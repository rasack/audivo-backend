import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import dbConnect from "@/lib/database/mongo";
import User from '@/models/User';
import { NextResponse } from "next/server";
export async function GET() {
  try {
    const {getUser} = getKindeServerSession();
    const user = await getUser(); 
    await dbConnect();
    const dbUser = await User.findOne({ user: user?.id });
    if (!dbUser || dbUser.type === 2) {
            return NextResponse.json(
                { success: false},
                { status: 403 }
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
