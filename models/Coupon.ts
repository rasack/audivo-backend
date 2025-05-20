import mongoose, { Document, Model, Schema } from "mongoose";

interface ICoupon extends Document {
	code: string;
	discountType: "percentage" | "fixed";
	discountValue: number;
	expiryDate: Date;
	maxUses: number;
	currentUses: number;
	isValid: () => boolean;
	applyDiscount: (amount: number) => number;
	use: () => Promise<void>;
}

const CouponSchema: Schema = new Schema({
	code: { type: String, required: true, unique: true },
	discountType: { type: String, enum: ["percentage", "fixed"], required: true },
	discountValue: { type: Number, required: true },
	expiryDate: { type: Date, required: true },
	maxUses: { type: Number, required: true },
	currentUses: { type: Number, default: 0 },
});

CouponSchema.methods.isValid = function (this: ICoupon): boolean {
	return this.currentUses < this.maxUses && new Date() < this.expiryDate;
};

CouponSchema.methods.applyDiscount = function (
	this: ICoupon,
	amount: number
): number {
	if (this.discountType === "percentage") {
		return amount * (1 - this.discountValue / 100);
	} else {
		return Math.max(0, amount - this.discountValue);
	}
};

CouponSchema.methods.use = async function (this: ICoupon): Promise<void> {
	this.currentUses += 1;
	await this.save();
};

const Coupon: Model<ICoupon> =
	mongoose.models.Coupon || mongoose.model<ICoupon>("Coupon", CouponSchema);

export default Coupon;
