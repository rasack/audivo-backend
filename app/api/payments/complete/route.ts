import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Order from "@/models/Order";
import User from "@/models/User";
import Coupon from "@/models/Coupon";
import { calculatePricing } from "@/lib/pricing";
import AdminSettings from "@/models/AdminSettings";
import { updateUserPlan } from "@/lib/api-limit";
import { startSession } from "mongoose";

export async function POST(request: Request) {
	try {
		await dbConnect();

		const { getUser, isAuthenticated } = getKindeServerSession();
		const user = await getUser();
		const isUserAuthenticated = await isAuthenticated();

		if (!isUserAuthenticated || !user) {
			return NextResponse.json(
				{ success: false, error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const existingUser = await User.findOne({ user: user.id });
		if (!existingUser) {
			return NextResponse.json(
				{ success: false, error: "User not found" },
				{ status: 404 }
			);
		}

		const body = await request.json();
		const { generations, couponCode, orderNote } = body;

		if (!generations || generations <= 0) {
			return NextResponse.json(
				{ error: "Invalid generations count" },
				{ status: 400 }
			);
		}

		const adminSettings = await AdminSettings.findOne();
		if (!adminSettings) {
			return NextResponse.json(
				{ success: false, error: "Failed to fetch admin settings" },
				{ status: 500 }
			);
		}

		const { pricePerGeneration } = adminSettings;
		const pricing = await calculatePricing({
			generations,
			pricePerGeneration,
			couponCode,
		});

		if (pricing.finalPrice > 0) {
			return NextResponse.json(
				{ error: "This endpoint is for zero-cost orders only" },
				{ status: 400 }
			);
		}

		const session = await startSession();
		try {
			await session.withTransaction(async () => {
				if (couponCode && pricing.appliedCoupon) {
					const coupon = await Coupon.findOne({ code: couponCode }).session(
						session
					);
					if (coupon) {
						await coupon.use();
					}
				}

				const newOrder = new Order({
					orderId: `free_${Date.now()}`,
					amount: 0,
					originalAmount: pricing.totalPrice,
					currency: "INR",
					userId: user.id,
					status: "PAID",
					orderNote,
					planDetails: {
						generations,
					},
					couponCode,
					discountAmount: pricing.discountAmount,
					completedAt: new Date(),
				});

				await newOrder.save({ session });

				const updateResult = await updateUserPlan(
					user.id,
					{ generations },
					session
				);

				if (!updateResult.success) {
					throw new Error(updateResult.error || "Failed to update user plan");
				}
			});

			return NextResponse.json({
				success: true,
				message: "Order completed successfully",
			});
		} catch (error) {
			console.error("Transaction error:", error);
			return NextResponse.json(
				{ success: false, error: "Failed to complete order" },
				{ status: 500 }
			);
		} finally {
			session.endSession();
		}
	} catch (error) {
		console.error("Error completing order:", error);
		return NextResponse.json(
			{ success: false, error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
