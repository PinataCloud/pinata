import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const data = await pinata.files.public
			.queue()
			.cid("QmU2trVdrKBPsSZxCzzxDUa7HVTf8H2G8v5Ec7tMp7zdZF");
		console.log(data);
	} catch (error) {
		console.log(error);
	}
}

main();
