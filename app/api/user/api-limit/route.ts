import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import { initializeUserIfNeeded, updateUserPlan } from "@/lib/api-limit";

export async function GET() {
	try {
		await dbConnect();
		const { getUser } = getKindeServerSession();
		const user = await getUser();

		if (!user?.id || !user?.email) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const result = await initializeUserIfNeeded(
			user.id,
			`${user.given_name || "Fname"} ${user.family_name || "Lname"}`,
			user.email
		);

		return NextResponse.json(result);
	} catch (error) {
		console.error("Detailed error:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

export async function PUT(req: Request) {
	try {
		await dbConnect();
		const { getUser } = getKindeServerSession();
		const user = await getUser();

		if (!user?.id || !user?.email) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const planDetails = await req.json();
		const result = await updateUserPlan(user.id, planDetails);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || "Plan update failed" },
				{ status: 400 }
			);
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error("Update plan error:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
