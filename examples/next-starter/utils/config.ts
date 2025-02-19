
import { PinataSDK } from "../../../dist"

export const pinata = new PinataSDK({
  pinataJwt: `${process.env.DEV_PINATA_JWT}`,
  pinataGateway: `${process.env.NEXT_PUBLIC_DEV_GATEWAY_URL}`,
  uploadUrl: `${process.env.DEV_UPLOAD_URL}`,
  endpointUrl: `${process.env.DEV_ENDPOINT_URL}`
})
