import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT,
	pinataGateway: "",
});

async function main() {
	try {
		const uuid = crypto.randomUUID();
		const upload = await pinata.upload.public.file(
			new File([uuid], `${uuid}.txt`, { type: "text/plain" }),
		);
		const url = await pinata.gateways.public.convert(upload.cid);
		console.log(url);
		const content = await pinata.gateways.public.get(upload.cid);
		console.log(content);
	} catch (error) {
		console.log(error);
	}
}

main();
