import mongoose from "mongoose";

export interface IAdminSettingsDoc extends Document {
	maxFreeCount: number;
	pricePerGeneration: number;
}

const adminSettingsSchema = new mongoose.Schema<IAdminSettingsDoc>({
	maxFreeCount: {
		type: Number,
		required: true,
		default: 10,
	},
	pricePerGeneration: {
		type: Number,
		required: true,
		default: 10,
	},
});

export default mongoose.models.AdminSettings ||
	mongoose.model("AdminSettings", adminSettingsSchema);
