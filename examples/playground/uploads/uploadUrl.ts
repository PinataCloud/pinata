import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const data = await pinata.upload.public
			.url("https://i.imgur.com/u4mGk5b.gif")
			.keyvalues({
				name: "upload url test",
			});
		console.log(data);
	} catch (error) {
		console.log(error);
	}
}

main();
