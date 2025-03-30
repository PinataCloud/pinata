import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { PinataSDK } from 'pinata'

interface Bindings {
  PINATA_JWT: string;
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(cors())

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/upload_url', async (c) => {

  const pinata = new PinataSDK({
    pinataJwt: c.env.PINATA_JWT
  })

  const url = await pinata.upload.public.createSignedURL({
    expires: 60
  })

  return c.json({ url }, { status: 200 })
})

export default app
