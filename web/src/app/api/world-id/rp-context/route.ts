import { NextResponse } from 'next/server';
import { signRequest } from '@worldcoin/idkit/signing';

type SignatureType = 'request' | 'create_session' | 'session';

function isSignatureType(value: unknown): value is SignatureType {
  return (
    value === 'request' || value === 'create_session' || value === 'session'
  );
}

export async function GET() {
  try {
    const signingKey = process.env.WORLD_SIGNING_KEY;
    const appId = process.env.WORLD_ID_APP_ID || 'app_57d38506bb2953dc8219d826cd3dedd6';
    const rpId = process.env.WORLD_ID_RP_ID || appId;
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
      app_id: appId,
      action: action,
      rp_context: {
        rp_id: rpId,
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

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      signature_type?: SignatureType;
      action?: string;
      ttl?: number;
    };

    const signatureType = body.signature_type ?? 'request';
    if (!isSignatureType(signatureType)) {
      return NextResponse.json(
        { error: 'Invalid signature_type' },
        { status: 400 },
      );
    }

    if (body.action !== undefined && typeof body.action !== 'string') {
      return NextResponse.json(
        { error: 'action must be a string' },
        { status: 400 },
      );
    }

    const action = body.action?.trim() || undefined;
    if (signatureType !== 'request' && action) {
      return NextResponse.json(
        { error: 'Session signatures must not include action' },
        { status: 400 },
      );
    }

    const signingKey = process.env.WORLD_SIGNING_KEY;
    if (!signingKey || signingKey.includes('xxxxxx')) {
      return NextResponse.json(
        { error: 'WORLD_SIGNING_KEY environment variable is not configured.' },
        { status: 500 },
      );
    }

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      ...(signatureType === 'request' && action ? { action } : {}),
      signingKeyHex: signingKey,
      ttl: body.ttl,
    });

    console.log('Generated RP signature via POST:', {
      signatureType,
      sig,
      nonce,
      createdAt,
      expiresAt,
    });

    return NextResponse.json({
      sig: sig,
      nonce: nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Error generating RP signature via POST:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 },
    );
  }
}
