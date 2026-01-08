import type { APIRoute } from 'astro';
import { PinataSDK } from 'pinata';

export const prerender = false;

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.PINATA_JWT,
});

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'Payment instruction ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const searchParams = new URLSearchParams(url.search);
    const options = {
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      pageToken: searchParams.get('pageToken') || undefined,
    };

    const result = await pinata.x402.listCids(id, options);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error listing CIDs:', error);
    return new Response(JSON.stringify({ error: 'Failed to list CIDs' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};