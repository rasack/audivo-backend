import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
	orderId: string | undefined;
	amount: number;
	originalAmount: number;
	currency: string;
	userId: string;
	status: "PENDING" | "PAID" | "FAILED";
	paymentSessionId: string | undefined;
	orderNote?: string;
	planDetails: {
		generations: number;
	};
	couponCode?: string;
	discountAmount: number;
}
export type OrderCreation = Omit<IOrder, keyof Document>;

const OrderSchema: Schema = new Schema(
	{
		orderId: { type: String, required: true, unique: true },
		amount: { type: Number, required: true },
		originalAmount: { type: Number, required: true },
		currency: { type: String, required: true },
		userId: {
			type: String,
			ref: "User",
			required: true,
		},
		status: {
			type: String,
			required: true,
			enum: ["PENDING", "PAID", "FAILED"],
		},
		paymentSessionId: { type: String, required: false },
		orderNote: { type: String },
		planDetails: {
			generations: { type: Number, required: true },
		},
		couponCode: { type: String },
		discountAmount: { type: Number, required: true },
	},
	{ timestamps: true }
);

export default mongoose.models.Order ||
	mongoose.model<IOrder>("Order", OrderSchema);
