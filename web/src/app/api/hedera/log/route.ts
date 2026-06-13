import { NextResponse } from 'next/server';

// Lazy load Hedera SDK to prevent bundle size issues and compilation warnings if running in non-node envs
let hashgraphSdk: any = null;
async function getHederaSdk() {
  if (!hashgraphSdk) {
    hashgraphSdk = await import('@hashgraph/sdk');
  }
  return hashgraphSdk;
}

async function getPrivateKey(sdk: any, operatorId: string, operatorKey: string) {
  try {
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const mirrorBase = network.toLowerCase() === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com' 
      : network.toLowerCase() === 'previewnet'
      ? 'https://previewnet.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const response = await fetch(`${mirrorBase}/api/v1/accounts/${operatorId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.key && data.key._type === 'ECDSA_SECP256K1') {
        return sdk.PrivateKey.fromStringECDSA(operatorKey);
      } else if (data.key && data.key._type === 'ED25519') {
        return sdk.PrivateKey.fromStringED25519(operatorKey);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch account key type from mirror node:', err);
  }
  
  try {
    if (operatorKey.startsWith('0x') || operatorKey.length === 64) {
      return sdk.PrivateKey.fromStringECDSA(operatorKey);
    }
  } catch {}
  
  return sdk.PrivateKey.fromString(operatorKey);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, subdomain, payload } = body;

    if (!type || !payload) {
      return NextResponse.json(
        { error: 'Missing type or payload parameter.' },
        { status: 400 }
      );
    }

    // Read environment variables
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    const envTopicId = process.env.HEDERA_TOPIC_ID;
    const network = process.env.HEDERA_NETWORK || 'testnet';

    // Verify if we should run in mock / simulation mode
    const isMockMode = 
      !operatorId || 
      !operatorKey || 
      !envTopicId || 
      operatorId.includes('xxxxxx') || 
      operatorKey.includes('xxxxxx');

    if (isMockMode) {
      // Return a simulated Consensus Service log
      const simulatedTxId = `0.0.4589201@${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 1000000000)}`;
      const simulatedSeqNumber = Math.floor(Math.random() * 1000) + 10;
      const topicId = envTopicId || '0.0.4589201';

      return NextResponse.json({
        success: true,
        isSimulated: true,
        transactionId: simulatedTxId,
        sequenceNumber: simulatedSeqNumber,
        topicId: topicId,
        message: `Simulated consensus submission to topic ${topicId}`,
        info: 'Running in simulated consensus mode. To connect to real Hedera testnet/mainnet, update HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in your .env.local file.'
      });
    }

    // Real Hedera Integration
    const sdk = await getHederaSdk();
    
    // Initialize Client
    let client;
    if (network.toLowerCase() === 'mainnet') {
      client = sdk.Client.forMainnet();
    } else if (network.toLowerCase() === 'previewnet') {
      client = sdk.Client.forPreviewnet();
    } else {
      client = sdk.Client.forTestnet();
    }

    // Set operator credentials using smart key resolver
    const privateKey = await getPrivateKey(sdk, operatorId, operatorKey);
    client.setOperator(operatorId, privateKey);

    // Prepare JSON metadata message to log on Hedera Consensus Service
    const messageContent = JSON.stringify({
      type,
      subdomain: subdomain || 'anonymous.satoshisparabox.eth',
      payload,
      timestamp: new Date().toISOString()
    });

    // Create and submit the transaction to the consensus topic
    const transaction = new sdk.TopicMessageSubmitTransaction()
      .setTopicId(envTopicId)
      .setMessage(messageContent);

    // Execute the transaction
    const txResponse = await transaction.execute(client);
    
    // Get the consensus receipt
    const receipt = await txResponse.getReceipt(client);
    
    // Extract consensus parameters
    const transactionId = txResponse.transactionId.toString();
    const sequenceNumber = receipt.topicSequenceNumber ? Number(receipt.topicSequenceNumber.toString()) : 0;

    return NextResponse.json({
      success: true,
      isSimulated: false,
      transactionId,
      sequenceNumber,
      topicId: envTopicId,
      message: 'Consensus log submitted successfully to Hedera network.'
    });

  } catch (error: any) {
    console.error('Hedera API route error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit consensus message.' },
      { status: 500 }
    );
  }
}
