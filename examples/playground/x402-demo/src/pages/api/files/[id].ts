import type { APIRoute } from 'astro';
import { PinataSDK } from 'pinata';

export const prerender = false;

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.PINATA_JWT,
});

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'File ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await pinata.files.public.get(id);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error getting file:', error);
    return new Response(JSON.stringify({ error: 'Failed to get file' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'File ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    await pinata.files.public.delete([id]);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete file' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'File ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const result = await pinata.files.public.update({
      id,
      name: body.name,
    });
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating file:', error);
    return new Response(JSON.stringify({ error: 'Failed to update file' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};