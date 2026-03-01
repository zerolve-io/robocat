/**
 * RoboCat API — Cloudflare Worker stub.
 * Returns a simple health-check response. Game logic TBD.
 */
export default {
  async fetch(_request: Request): Promise<Response> {
    return Response.json(
      { status: 'ok', service: 'robocat-api', version: '0.1.0' },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  },
} satisfies ExportedHandler;
