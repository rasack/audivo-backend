import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Order from "@/models/Order";

export async function GET(req: NextRequest) {
	const { getUser } = getKindeServerSession();
	const user = await getUser();

	if (!user || !user.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		await dbConnect();
		const orders = await Order.find({ userId: user.id }).sort({
			createdAt: -1,
		});

		return NextResponse.json(orders);
	} catch (error) {
		console.error("Error fetching orders:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
