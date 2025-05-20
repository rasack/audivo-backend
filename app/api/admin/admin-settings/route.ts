import dbConnect from "@/lib/database/mongo";
import AdminSettings from "@/models/AdminSettings";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";
export async function GET() {
	const { getUser } = getKindeServerSession();
	const user = await getUser();
	if (!user || !user.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	try {
		await dbConnect();
		const adminSettings = await AdminSettings.findOne().sort({ createdAt: -1 });
		if (!adminSettings) {
			return NextResponse.json(
				{ error: "Admin settings not found" },
				{ status: 404 }
			);
		}
		const { maxFreeCount, pricePerGeneration } = adminSettings;
		return NextResponse.json({ maxFreeCount, pricePerGeneration });
	} catch (error) {
		console.error("Error fetching admin settings:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
