import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const groups = await pinata.groups.private.list();
		console.log(groups);
	} catch (error) {
		console.log(error);
	}
}

main();
