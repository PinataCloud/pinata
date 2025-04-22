export type PinataConfig = {
	pinataJwt?: string;
	pinataGateway?: string;
	pinataGatewayKey?: string;
	customHeaders?: Record<string, string>;
	endpointUrl?: string;
	uploadUrl?: string;
	legacyUploadUrl?: string;
};
