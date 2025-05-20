import mongoose, { Schema, Document } from "mongoose";

export interface IWaitlistedUserDoc extends Document {
	name: string;
	email: string;
}

const waitlistedUserSchema = new Schema<IWaitlistedUserDoc>(
	{
		name: {
			type: String,
			required: [true, "Name is required"], //for validation error
			trim: true,
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			lowercase: true,
			trim: true,
			unique: true,
		},
	},
	{
		timestamps: true,
	}
);

export default mongoose.models.WaitlistedUser || mongoose.model("WaitlistedUser", waitlistedUserSchema);
