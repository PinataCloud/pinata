import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const uuid1 = crypto.randomUUID();
		const uuid2 = crypto.randomUUID();
		const file = new File([uuid1], `${uuid1}.txt`, {
			type: "text/plain",
		});
		const upload = await pinata.upload.public.file(file);
		console.log(upload);

		const file2 = new File([uuid2], `${uuid2}.txt`, {
			type: "text/plain",
		});
		const upload2 = await pinata.upload.public.file(file2);
		console.log(upload2);
		await new Promise((resolve) => setTimeout(resolve, 5000));
		const swap = await pinata.files.public.addSwap({
			cid: upload.cid,
			swapCid: upload2.cid,
		});
		console.log(swap);

		const history = await pinata.files.public.getSwapHistory({
			cid: upload.cid,
			domain: "",
		});
		console.log(history);

		const remove = await pinata.files.public.deleteSwap(upload.cid);
		console.log(remove);
	} catch (error) {
		console.log(error);
	}
}

main();
