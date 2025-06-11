import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const files = await pinata.files.public.list().limit(1);
		console.log(files.files);

		const link = await pinata.gateways.public.convert(files.files[0].cid);
		console.log(link);
	} catch (error) {
		console.log(error);
	}
}

main();
