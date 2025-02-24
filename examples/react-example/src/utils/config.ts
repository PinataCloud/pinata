import { PinataSDK } from "../../../../dist"

export const pinata = new PinataSDK({
  pinataJwt: `${import.meta.env.VITE_DEV_PINATA_JWT}`,
  pinataGateway: `${import.meta.env.VITE_DEV_GATEWAY_URL}`,
  uploadUrl: `${import.meta.env.VITE_DEV_UPLOAD_URL}`,
  endpointUrl: `${import.meta.env.VITE_DEV_ENDPOINT_URL}`
})
