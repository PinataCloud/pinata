export function getFileIdFromMetadata(headers: Headers): string {
	const uploadMetadata = headers.get("upload-metadata");
	if (!uploadMetadata) return "";

	const metadataParts = uploadMetadata.split(",");
	const fileIdPart = metadataParts.find((part) => part.startsWith("file_id "));

	if (!fileIdPart) return "";

	const encodedFileId = fileIdPart.split(" ")[1];
	return atob(encodedFileId);
}
