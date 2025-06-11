import { NetworkError, PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const uuid1 = crypto.randomUUID();
		const file = new File([uuid1], `file1.txt`, { type: "text/plain" });
		const { cid } = await pinata.upload.private.file(file);
		const url = await pinata.gateways.private.createAccessLink({
			cid: cid,
			expires: 30,
		});
		console.log(url);
	} catch (e) {
		const error = e as NetworkError;
		console.log(error);
		console.log(error.details?.metadata?.headers);
	}
}

main();
