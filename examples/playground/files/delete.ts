import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const del = await pinata.files.public.delete([
			"0196ca35-7b3c-76ce-b7ca-ca6675d76bec",
		]);
		console.log(del);
	} catch (error) {
		console.log(error);
	}
}

main();
