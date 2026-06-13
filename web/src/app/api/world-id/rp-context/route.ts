import { NextResponse } from 'next/server';
import { signRequest } from '@worldcoin/idkit/signing';

export async function GET() {
  try {
    const signingKey = process.env.WORLD_SIGNING_KEY;
    const appId = process.env.WORLD_ID_APP_ID || 'app_57d38506bb2953dc8219d826cd3dedd6';
    const action = process.env.WORLD_ID_ACTION || 'user-login';

    if (!signingKey || signingKey.includes('xxxxxx')) {
      return NextResponse.json({
        success: false,
        error: 'signing_key_missing',
        message: 'WORLD_SIGNING_KEY environment variable is not configured.'
      });
    }

    // Generate signature using IDKit helper with options object format
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      action,
      signingKeyHex: signingKey
    });

    return NextResponse.json({
      success: true,
      rp_context: {
        rp_id: appId,
        nonce,
        created_at: createdAt,
        expires_at: expiresAt,
        signature: sig
      }
    });
  } catch (error: any) {
    console.error('Failed to generate RP signature:', error);
    return NextResponse.json({
      success: false,
      error: 'signature_failed',
      message: error.message || 'Failed to generate Relying Party signature.'
    }, { status: 500 });
  }
}
