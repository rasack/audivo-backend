import mongoose, { Schema, Document } from "mongoose";
import { UserType } from "@/lib/types";

export interface IUserDoc extends Document {
	user: string;
	isActive: boolean;
	isDeleted: boolean;
	type: UserType;
	name: string;
	storageUsed: number;
	email: string;
	phNo?: number;
	address?: string;
	planType?: number;
	totalReq: number;
	reqMonth: number;
}

const userSchema = new Schema<IUserDoc>(
	{
		user: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		isDeleted: {
			type: Boolean,
			default: false,
		},
		type: {
			type: Number,
			enum: Object.values(UserType).filter((v) => typeof v === "number"),
			default: 2,
		},
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			lowercase: true,
			trim: true,
		},
		phNo: {
			type: Number,
			default: null,
		},
		address: {
			type: String,
			default: null,
		},
		planType: {
			type: Number,
			default: 0,
		}, // 0: trial, 1: admin, 2: Premium-yearly, 3: Pro-monthly, 4: Pro-yearly
		totalReq: {
			type: Number,
			required: true,
			default: 0,
		},
		storageUsed: {
			type: Number,
			default: 0,
		},
		reqMonth: {
			type: Number,
			required: true,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

export default mongoose.models.User || mongoose.model("User", userSchema);
