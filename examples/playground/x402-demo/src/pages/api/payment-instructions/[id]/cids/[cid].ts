import type { APIRoute } from 'astro';
import { PinataSDK } from 'pinata';

export const prerender = false;

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.PINATA_JWT,
});

export const PUT: APIRoute = async ({ params }) => {
  try {
    const { id, cid } = params;
    
    if (!id || !cid) {
      return new Response(JSON.stringify({ error: 'Payment instruction ID and CID are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await pinata.x402.addCid(id, cid);
    
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error adding CID:', error);
    return new Response(JSON.stringify({ error: 'Failed to add CID' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id, cid } = params;
    
    if (!id || !cid) {
      return new Response(JSON.stringify({ error: 'Payment instruction ID and CID are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    await pinata.x402.removeCid(id, cid);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error removing CID:', error);
    return new Response(JSON.stringify({ error: 'Failed to remove CID' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};