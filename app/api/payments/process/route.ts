import { NextRequest, NextResponse } from "next/server";
import { Cashfree } from "cashfree-pg";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import dbConnect from "@/lib/database/mongo";
import Order from "@/models/Order";
import { startSession } from "mongoose";
import { updateUserPlan } from "@/lib/api-limit";
import Coupon from "@/models/Coupon";

export async function POST(req: NextRequest) {
	await dbConnect();

	const { getUser, isAuthenticated } = getKindeServerSession();
	const user = await getUser();
	const isUserAuthenticated = await isAuthenticated();

	if (!isUserAuthenticated || !user) {
		console.log("Unauthorized access attempt");
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401 }
		);
	}

	const { orderId } = await req.json();

	if (!orderId) {
		console.log("Invalid order ID provided");
		return NextResponse.json(
			{ success: false, error: "Invalid order ID" },
			{ status: 400 }
		);
	}

	try {
		const order = await Order.findOne({ orderId });

		if (!order) {
			console.log("Order not found:", orderId);
			return NextResponse.json(
				{ success: false, error: "Order not found" },
				{ status: 404 }
			);
		}

		// If the order is already in a final state, return the current status
		if (order.status === "PAID" || order.status === "FAILED") {
			return NextResponse.json({
				success: true,
				status: order.status,
				message: `Payment ${order.status.toLowerCase()}`,
				usage: order.planDetails,
			});
		}

		// Only fetch from Cashfree if the order is still pending
		Cashfree.XClientId = process.env.NEXT_PUBLIC_CASHFREE_APP_ID!;
		Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY!;
		Cashfree.XEnvironment =
			process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === "SANDBOX"
				? Cashfree.Environment.SANDBOX
				: Cashfree.Environment.PRODUCTION;

		const cashfreeResponse = await Cashfree.PGOrderFetchPayments(
			"2023-08-01",
			orderId
		);

		if (!cashfreeResponse.data || cashfreeResponse.data.length === 0) {
			console.log("No payment information found");
			return NextResponse.json({
				success: false,
				status: "PENDING",
				message: "Payment information not available",
			});
		}

		const latestPayment =
			cashfreeResponse.data[cashfreeResponse.data.length - 1];

		const session = await startSession();
		try {
			await session.withTransaction(async () => {
				if (
					latestPayment.payment_status === "SUCCESS" &&
					order.status !== "PAID"
				) {
					if (order.couponCode) {
						const coupon = await Coupon.findOne({ code: order.couponCode });
						if (coupon) {
							coupon.currentUses += 1;
							await coupon.save({ session });
						}
					}
					const updateResult = await updateUserPlan(
						order.userId,
						order.planDetails,
						session
					);
					if (!updateResult.success) {
						throw new Error(updateResult.error || "Failed to update user plan");
					}
					order.status = "PAID";
					order.paymentDetails = latestPayment;
					await order.save({ session });
				} else if (
					latestPayment.payment_status === "FAILED" &&
					order.status !== "FAILED"
				) {
					order.status = "FAILED";
					order.paymentDetails = latestPayment;
					order.errorDetails = {
						errorCode:
							latestPayment.error_details?.error_code || "UNKNOWN_ERROR",
						errorDescription:
							latestPayment.error_details?.error_description ||
							"Unknown error occurred",
						errorReason:
							latestPayment.error_details?.error_reason || "Unknown reason",
						errorSource:
							latestPayment.error_details?.error_source || "Unknown source",
					};
					await order.save({ session });
				}
			});
		} finally {
			session.endSession();
		}

		return NextResponse.json({
			success: true,
			status: order.status,
			message: `Payment ${order.status.toLowerCase()}`,
			usage: order.planDetails,
			errorDetails: order.status === "FAILED" ? order.errorDetails : undefined,
		});
	} catch (error) {
		console.error("Error processing payment:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to process payment",
			},
			{ status: 500 }
		);
	}
}
