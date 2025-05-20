import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import User from "@/models/User";

export async function GET(req: NextRequest) {
	const { getUser } = getKindeServerSession();
	const user = await getUser();

	if (!user || !user.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		await dbConnect();
		const dbUser = await User.findOne({ user: user.id });

		if (!dbUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		return NextResponse.json({
			name: dbUser.name,
			email: dbUser.email,
			phNo: dbUser.phNo?.toString() || "",
			address: dbUser.address || "",
		});
	} catch (error) {
		console.error("Error fetching user data:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}

export async function PUT(req: NextRequest) {
	const { getUser } = getKindeServerSession();
	const user = await getUser();

	if (!user || !user.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { name, email, phNo, address } = await req.json();

		await dbConnect();
		const updatedUser = await User.findOneAndUpdate(
			{ user: user.id },
			{
				$set: {
					name,
					email,
					phNo: phNo ? parseInt(phNo, 10) : null,
					address,
				},
			},
			{ new: true }
		);
		if (!updatedUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		return NextResponse.json({
			name: updatedUser.name,
			email: updatedUser.email,
			phNo: updatedUser.phNo?.toString() || "",
			address: updatedUser.address || "",
		});
	} catch (error) {
		console.error("Error updating user data:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
