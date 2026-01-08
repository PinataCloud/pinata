import type {
	PinataConfig,
	PaymentInstructionListQuery,
	PaymentInstructionListResponse,
	CreatePaymentInstructionRequest,
	UpdatePaymentInstructionRequest,
	PaymentInstructionResponse,
	PaymentInstructionDeleteResponse,
	CidListQuery,
	CidListResponse,
	CidAssociationResponse,
	CidRemoveResponse,
} from "../../types";
import { formatConfig } from "../../../utils/format-config";
import {
	listPaymentInstructions,
	createPaymentInstruction,
	getPaymentInstruction,
	updatePaymentInstruction,
	deletePaymentInstruction,
	listCids,
	addCid,
	removeCid,
} from "../../functions";

export class X402 {
	config: PinataConfig | undefined;

	constructor(config?: PinataConfig) {
		this.config = formatConfig(config);
	}

	updateConfig(newConfig: PinataConfig): void {
		this.config = newConfig;
	}

	listPaymentInstructions(
		options?: PaymentInstructionListQuery,
	): Promise<PaymentInstructionListResponse> {
		return listPaymentInstructions(this.config, options);
	}

	createPaymentInstruction(
		request: CreatePaymentInstructionRequest,
	): Promise<PaymentInstructionResponse> {
		return createPaymentInstruction(this.config, request);
	}

	getPaymentInstruction(id: string): Promise<PaymentInstructionResponse> {
		return getPaymentInstruction(this.config, id);
	}

	updatePaymentInstruction(
		id: string,
		request: UpdatePaymentInstructionRequest,
	): Promise<PaymentInstructionResponse> {
		return updatePaymentInstruction(this.config, id, request);
	}

	deletePaymentInstruction(id: string): Promise<PaymentInstructionDeleteResponse> {
		return deletePaymentInstruction(this.config, id);
	}

	listCids(
		paymentInstructionId: string,
		options?: CidListQuery,
	): Promise<CidListResponse> {
		return listCids(this.config, paymentInstructionId, options);
	}

	addCid(
		paymentInstructionId: string,
		cid: string,
	): Promise<CidAssociationResponse> {
		return addCid(this.config, paymentInstructionId, cid);
	}

	removeCid(
		paymentInstructionId: string,
		cid: string,
	): Promise<CidRemoveResponse> {
		return removeCid(this.config, paymentInstructionId, cid);
	}
}