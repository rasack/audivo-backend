import { IMusicSettings } from "@/lib/types";
import mongoose, { Schema, Document, Model } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IPromptBase {
	isDeleted: boolean;
	isActive: boolean;
	promptId: string;
	userId: string;
	type: number;
	prompt: string;
	isAi: boolean;
	duration?: number;
	model?: string;
	aiPrompt: string;
	param: IMusicSettings[];
	requestFile: string[];
	responseFile: string[];
	convId?: string;
	playCount: number;
	downloadCount: number;
	isFavorite: number;
	isValid:boolean;
	response:string;
	negative_prompt:string;
	isCopyright:boolean;
}


export interface IPromptDocument extends Omit<Document, "model">, IPromptBase {}

const promptSchema = new Schema<IPromptDocument>(
	{
		isDeleted: {
			type: Boolean,
			required: true,
			default: false,
		},
		isActive: {
			type: Boolean,
			required: true,
			default: true,
		},
		promptId: {
			type: String,
			required: true,
			unique: true,
			default: () => uuidv4(),
		},
		userId: {
			type: String,
			ref: "User",
			required: true,
		},
		type: {
			type: Number,
			required: true,
			default: 0, // 0 - music, 1 - sound
		},
		prompt: {
			type: String,
			required: true,
		},
		negative_prompt:{
            type:String,
			default: ""
		},
		isAi: {
			type: Boolean,
			required: true,
			default: false,
		},
		duration: {
			type: Number,
			required: false,
		},
		model: {
			type: String,
			required: false,
		},
		aiPrompt: {
			type: String,
			default: "Not Applicable",
		},
		param: {
			type: [{ type: Schema.Types.Mixed }],
			default: [],
		},
		requestFile: {
			type: [String],
			default: [],
		},
		responseFile: {
			type: [String],
			default: [],
		},
		convId: {
			type: String,
			default: undefined,
		},
		playCount: {
			type: Number,
			required: true,
			default: 0,
		},
		downloadCount: {
			type: Number,
			required: true,
			default: 0,
		},
		isFavorite: {
			type: Number,
			default: 0,
		},
		isValid:{
			type:Boolean,
			default:true,
		},
		response:{
			type:String,
			default:undefined
		},
		isCopyright:{
			type:Boolean,
			default:false,
		}
	},
	{ timestamps: true }
);

const Prompt = (mongoose.models.Prompt ||
	mongoose.model<IPromptDocument>(
		"Prompt",
		promptSchema
	)) as Model<IPromptDocument>;

export default Prompt;