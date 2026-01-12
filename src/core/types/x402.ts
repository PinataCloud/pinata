export type NetworkIdentifier =
	| "base"
	| "base-sepolia"
	| "eip155:8453"
	| "eip155:84532";

export interface PaymentRequirement {
	asset: string;
	pay_to: string;
	network: NetworkIdentifier;
	amount: string;
	description?: string;
}

export interface PaymentInstruction {
	id: string;
	version: number;
	payment_requirements: PaymentRequirement[];
	name: string;
	description?: string;
	created_at: string;
}

export interface CreatePaymentInstructionRequest {
	name: string;
	payment_requirements: PaymentRequirement[];
	description?: string;
}

export interface UpdatePaymentInstructionRequest {
	name?: string;
	payment_requirements?: PaymentRequirement[];
	description?: string;
}

export interface PaymentInstructionListQuery {
	limit?: number;
	pageToken?: string;
	cid?: string;
	name?: string;
	id?: string;
}

export interface PaymentInstructionListResponse {
	data: {
		payment_instructions: PaymentInstruction[];
		next_page_token?: string;
	};
}

export interface PaymentInstructionResponse {
	data: PaymentInstruction;
}

export interface PaymentInstructionDeleteResponse {
	data: {};
}

export interface CidListQuery {
	limit?: number;
	pageToken?: string;
}

export interface CidListResponse {
	data: {
		cids: string[];
		next_page_token?: string;
	};
}

export interface CidAssociation {
	payment_instruction_id: string;
	cid: string;
	created_at: string;
}

export interface CidAssociationResponse {
	data: CidAssociation;
}

export interface CidRemoveResponse {
	data: {};
}
