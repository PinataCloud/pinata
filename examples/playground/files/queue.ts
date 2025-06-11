import { NetworkError, PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const data = await pinata.files.public
			.queue()
			.cid("QmTzJGZMQ9h3GLHeQ9NE5MmMY2S3VfGgBRBrVckhkxCuS9");
		console.log(data);
	} catch (e) {
		const error = e as NetworkError;
		console.log(error);
		console.log(error.details?.metadata);
	}
}

await main();
