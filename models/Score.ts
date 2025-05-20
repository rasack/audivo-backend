import mongoose, { Schema, Document, Model } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IScoreBase {
	promptId: string;
	scoreId: string;
	score: number;
	comment: string;
	quality: number;
	userId: string;
	adherenceToPrompt: number;
	majorIssues: string[];
	uploadedFile:string;
	responseFile:string;
	prompt:string;
}

export interface IScoreDocument extends Omit<Document, "model">, IScoreBase {}

const scoreSchema = new Schema<IScoreDocument>(
	{
		promptId: {
			type: String,
			required: true,
		},
		userId: {
			type: String,
			required: true,
		},
		scoreId: {
			type: String,
			required: true,
			unique: true,
			default: () => uuidv4(),
		},
		score: {
			type: Number,
			required: true,
			default: 0,
		},
		comment: {
			type: String,
			default: "",
		},
		quality: {
			type: Number,
			default: 0,
		},
		adherenceToPrompt: {
			type: Number,
			default: 0,
		},
		majorIssues: {
			type: [String],
			default: [],
		},
		uploadedFile:{
			type:String,
			default:""
		},
		responseFile:{
			type:String,
			default:""
		},
		prompt:{
			type:String,
			default:""
		}
	},
	{ timestamps: true }
);

const Score = (mongoose.models.Score ||
	mongoose.model<IScoreDocument>("Score", scoreSchema)) as Model<IScoreDocument>;

export default Score;
