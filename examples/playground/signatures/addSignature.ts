import { PinataSDK } from "pinata";
import { createWalletClient, custom, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

export const walletClient = createWalletClient({
	chain: mainnet,
	transport: http(),
});

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

export const domain = {
	name: "Sign",
	version: "1.0.0",
	chainId: 1,
} as const;

export const types = {
	Sign: [
		{ name: "address", type: "address" },
		{ name: "cid", type: "string" },
		{ name: "date", type: "string" },
	],
	EIP712Domain: [
		{
			name: "name",
			type: "string",
		},
		{
			name: "version",
			type: "string",
		},
		{
			name: "chainId",
			type: "uint256",
		},
	],
};

async function main() {
	try {
		const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x`);
		const uuid = crypto.randomUUID();
		const file = new File([uuid], `${uuid}.txt`, {
			type: "text/plain",
		});
		const upload = await pinata.upload.public.file(file);
		console.log(upload);

		const signature = await walletClient.signTypedData({
			account,
			domain,
			types,
			primaryType: "Sign",
			message: {
				address: process.env.ADDRESS,
				cid: upload.cid,
				date: Date.now(),
			},
		});
		console.log(signature);
		const sign = await pinata.signatures.public.add({
			cid: upload.cid,
			signature: signature,
			address: "0x",
		});
		console.log(sign);
		const getSig = await pinata.signatures.public.get(upload.cid);
		console.log(getSig);

		const deleteSig = await pinata.signatures.public.delete(upload.cid);
		console.log(deleteSig);
	} catch (error) {
		console.log(error);
	}
}

main();
