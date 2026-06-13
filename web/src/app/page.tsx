'use client';

import { useState, useEffect, useRef } from 'react';
import { IDKitWidget, VerificationLevel } from '@worldcoin/idkit';
import { 
  Shield, 
  Lock, 
  Unlock, 
  Key, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  Clock, 
  UserCheck, 
  RefreshCw, 
  Terminal, 
  Globe, 
  Activity, 
  Leaf, 
  ShieldCheck,
  Eye,
  EyeOff,
  Database,
  ArrowRight,
  Sparkles,
  QrCode
} from 'lucide-react';

interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  blobId: string;
  status: 'stored' | 'purged';
  encryptionKey: string;
  hederaTxId: string;
}

interface HcsLog {
  timestamp: string;
  sequenceNumber: number;
  topicId: string;
  transactionId: string;
  type: 'IDENTITY_REGISTERED' | 'BLOB_UPLOADED' | 'SESSION_LOCKED' | 'FIXER_SCHEDULED' | 'BLOB_PURGED';
  subdomain: string;
  payload: string;
}

export default function SatoshiParaBox() {
  // Config
  const [config, setConfig] = useState({
    worldIdAppId: 'app_staging_satoshis_parabox',
    worldIdAction: 'user-login',
    hederaTopicId: '0.0.9224062',
    walrusPublisher: 'https://publisher.walrus-testnet.walrus.space',
    walrusAggregator: 'https://aggregator.walrus-testnet.walrus.space',
    isDemoMode: true
  });

  // Auth & Session state
  const [isVerified, setIsVerified] = useState(false);
  const [nullifierHash, setNullifierHash] = useState('');
  const [userSubdomain, setUserSubdomain] = useState('');
  const [walletAddress, setWalletAddress] = useState('0x6f99147...189a');
  const [masterKey, setMasterKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showIdkitModal, setShowIdkitModal] = useState(false);
  
  // Tab Navigation
  const [activeTab, setActiveTab] = useState<'vault' | 'logs' | 'fixer'>('vault');

  // Auto-Lockout / TTL state (60s session)
  const [lockoutTtl] = useState(60);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Vault files state
  const [files, setFiles] = useState<VaultFile[]>([]);

  // HCS logs state
  const [hcsLogs, setHcsLogs] = useState<HcsLog[]>([]);

  // Console Logs
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'System: Satoshi\'s ParaBox environment initialized.',
    'System: Security state standard. Waiting for secure identity verification.'
  ]);

  // Add a line to terminal console
  const logToConsole = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  // Simulated World ID Success Handler
  const triggerSimulationSuccess = () => {
    setIsVerifying(true);
    logToConsole('World ID: Initializing connection request with local simulator...');
    
    setTimeout(() => {
      logToConsole('World ID: Simulator Handshake complete.');
      logToConsole('World ID: Generating ZK proof for action "user-login"...');
      
      setTimeout(() => {
        logToConsole('ZKP Verification: Success! Nullifier Hash verified as unique human.');
        const mockNullifier = '0x' + Array.from({ length: 64 }, () => 
          Math.floor(Math.random() * 16).toString(16)
        ).join('');
        
        const shortHash = mockNullifier.substring(2, 8);
        const assignedSubdomain = `human_${shortHash}.satoshisparabox.eth`;
        
        // Generate client-side key
        const generatedKey = Array.from({ length: 32 }, () => 
          Math.floor(Math.random() * 16).toString(16)
        ).join('');
        
        setNullifierHash(mockNullifier);
        setUserSubdomain(assignedSubdomain);
        setMasterKey(generatedKey);
        setIsVerified(true);
        setSecondsLeft(lockoutTtl);
        setIsVerifying(false);
        setShowIdkitModal(false);
        
        logToConsole(`ENS Routing: Subdomain ${assignedSubdomain} registered successfully via NameStone.`);
        logToConsole(`Security: Client-side AES key loaded. Vault decrypted.`);
        
        addHcsLog('IDENTITY_REGISTERED', assignedSubdomain, `Registered World ID Nullifier ${mockNullifier.substring(0, 14)}... to dynamic subdomain.`);
      }, 1000);
    }, 1000);
  };

  // Real World ID proof verification and success handlers
  const handleWorldIdVerify = async (proofResult: any) => {
    logToConsole('World ID: Proof generated. Sending ZK proof to backend for verification...');
    
    const response = await fetch('/api/world-id/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...proofResult,
        action: config.worldIdAction
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      logToConsole(`ZKP Verification Error: ${errorData.message || 'Proof verification failed.'}`);
      throw new Error(errorData.message || 'Verification failed.');
    }
    
    logToConsole('ZKP Verification: Success! Proof verified against World ID staging API.');
  };

  const handleWorldIdSuccess = (proofResult: any) => {
    logToConsole('World ID: Verification flow completed successfully.');
    
    const nullifier = proofResult.nullifier_hash;
    const shortHash = nullifier.startsWith('0x') ? nullifier.substring(2, 8) : nullifier.substring(0, 6);
    const assignedSubdomain = `human_${shortHash}.satoshisparabox.eth`;
    
    // Generate client-side key
    const generatedKey = Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    setNullifierHash(nullifier);
    setUserSubdomain(assignedSubdomain);
    setMasterKey(generatedKey);
    setIsVerified(true);
    setSecondsLeft(lockoutTtl);
    
    logToConsole(`ENS Routing: Subdomain ${assignedSubdomain} registered successfully via NameStone.`);
    logToConsole(`Security: Client-side AES key loaded. Vault decrypted.`);
    
    addHcsLog('IDENTITY_REGISTERED', assignedSubdomain, `Registered World ID Nullifier ${nullifier.substring(0, 14)}... to dynamic subdomain.`);
  };

  // Session expiry / auto lockout logic
  useEffect(() => {
    if (isVerified) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            handleLockout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVerified]);

  // Load HCS messages dynamically from the Hedera Mirror Node on page load
  useEffect(() => {
    const fetchHcsMessages = async () => {
      try {
        logToConsole(`Mirror Node: Syncing live audit feed from Hedera testnet for Topic ${config.hederaTopicId}...`);
        const response = await fetch(
          `https://testnet.mirrornode.hedera.com/api/v1/topics/${config.hederaTopicId}/messages?order=desc&limit=15`
        );
        if (!response.ok) {
          throw new Error('Mirror Node returned an error response.');
        }
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          const parsedLogs: HcsLog[] = data.messages.map((msg: any) => {
            let decodedPayload = '';
            try {
              decodedPayload = atob(msg.message);
            } catch {
              decodedPayload = msg.message;
            }

            let type: HcsLog['type'] = 'BLOB_UPLOADED';
            let subdomain = 'satoshis.parabox.eth';
            let payloadText = decodedPayload;

            try {
              const parsedJSON = JSON.parse(decodedPayload);
              type = parsedJSON.type || 'BLOB_UPLOADED';
              subdomain = parsedJSON.subdomain || 'satoshis.parabox.eth';
              payloadText = parsedJSON.payload || decodedPayload;
            } catch {
              if (decodedPayload.includes('IDENTITY_REGISTERED')) type = 'IDENTITY_REGISTERED';
              else if (decodedPayload.includes('SESSION_LOCKED')) type = 'SESSION_LOCKED';
              else if (decodedPayload.includes('BLOB_PURGED')) type = 'BLOB_PURGED';
              else if (decodedPayload.includes('FIXER_SCHEDULED')) type = 'FIXER_SCHEDULED';
            }

            return {
              timestamp: new Date(Number(msg.consensus_timestamp) * 1000).toISOString(),
              sequenceNumber: msg.sequence_number,
              topicId: config.hederaTopicId,
              transactionId: msg.consensus_timestamp,
              type,
              subdomain,
              payload: payloadText
            };
          });
          
          setHcsLogs(parsedLogs);
          logToConsole(`Mirror Node: Loaded ${parsedLogs.length} live on-chain logs.`);
        } else {
          setHcsLogs([]);
          logToConsole('Mirror Node: Topic is empty. Ready for new live transactions.');
        }
      } catch (err: any) {
        logToConsole(`Mirror Node Sync Error: ${err.message}.`);
        setHcsLogs([]);
      }
    };

    fetchHcsMessages();
  }, [config.hederaTopicId]);

  const handleLockout = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsVerified(false);
    setMasterKey('');
    logToConsole('Security: Session TTL expired. Active encryption keys purged from local memory.');
    addHcsLog('SESSION_LOCKED', userSubdomain, 'Session locked automatically due to inactivity timeout (TTL).');
    alert('Security Alert: Session expired. All local keys have been wiped for privacy. Please verify again.');
  };

  const extendSession = () => {
    setSecondsLeft(lockoutTtl);
    logToConsole('Security: Session extended. TTL timer reset.');
  };

  // HashScan Link Formatter
  const getHashscanLink = (txId: string) => {
    if (!txId) return '#';
    if (txId.includes('fallback')) return '#';
    
    // If it's in the format operator@seconds.nanos (Transaction ID)
    if (txId.includes('@')) {
      const parts = txId.split('@');
      if (parts.length > 1) {
        const timeParts = parts[1].split('.');
        const formattedId = `${parts[0]}-${timeParts[0]}-${timeParts[1] || '0'}`;
        return `https://hashscan.io/testnet/transaction/${formattedId}/message`;
      }
    }
    
    // Otherwise, assume it is a consensus timestamp (seconds.nanos)
    return `https://hashscan.io/testnet/transaction/${txId}/message`;
  };

  // Hedera Log creation
  const addHcsLog = async (
    type: HcsLog['type'], 
    subdomain: string, 
    payload: string
  ): Promise<string> => {
    try {
      logToConsole(`Hedera Network: Submitting Consensus Message for ${type}...`);
      
      const response = await fetch('/api/hedera/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, subdomain, payload })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit message to Hedera API route.');
      }
      
      const data = await response.json();
      
      const newLog: HcsLog = {
        timestamp: new Date().toISOString(),
        sequenceNumber: data.sequenceNumber || (hcsLogs.length + 1),
        topicId: data.topicId || config.hederaTopicId,
        transactionId: data.transactionId,
        type,
        subdomain: subdomain || 'satoshis.parabox.eth',
        payload: data.isSimulated ? `(SIMULATED) ${payload}` : payload
      };
      
      setHcsLogs((prev) => [newLog, ...prev]);
      logToConsole(`Hedera Network: Consensus confirmed. Tx ID: ${data.transactionId} (Simulated: ${data.isSimulated ? 'Yes' : 'No'})`);
      return data.transactionId;
    } catch (err: any) {
      logToConsole(`Hedera Network Error: ${err.message}`);
      const fallbackLog: HcsLog = {
        timestamp: new Date().toISOString(),
        sequenceNumber: hcsLogs.length + 1,
        topicId: config.hederaTopicId,
        transactionId: `0.0.4589201@fallback_${Math.floor(Date.now() / 1000)}`,
        type,
        subdomain: subdomain || 'satoshis.parabox.eth',
        payload: `(LOCAL FALLBACK) ${payload}`
      };
      setHcsLogs((prev) => [fallbackLog, ...prev]);
      return fallbackLog.transactionId;
    }
  };

  // Walrus File upload simulation
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadFileToWalrus = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    logToConsole(`Security: Reading file ${selectedFile.name} data...`);

    try {
      // 1. Generate client-side AES key from browser Web Crypto API
      logToConsole(`Security: Encrypting file using Web Crypto API (AES-GCM 256-bit)...`);
      const aesKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // exportable
        ['encrypt', 'decrypt']
      );

      // Export key to hex string
      const exportedKey = await window.crypto.subtle.exportKey('raw', aesKey);
      const keyHex = Array.from(new Uint8Array(exportedKey))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Create a unique IV (Initialization Vector)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const fileData = await selectedFile.arrayBuffer();

      // Encrypt the file buffer
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        fileData
      );

      // Package encrypted data with IV prepended so we can decrypt it later
      // IV is 12 bytes
      const finalPayload = new Uint8Array(12 + encryptedData.byteLength);
      finalPayload.set(iv, 0);
      finalPayload.set(new Uint8Array(encryptedData), 12);

      logToConsole(`Security: Encryption successful. Key: ${keyHex.substring(0, 16)}...`);
      logToConsole(`Walrus Protocol: Pushing encrypted blob (epochs=5) to publisher node...`);

      // 2. Upload to Walrus Publisher
      const publisherUrl = config.walrusPublisher;
      
      const response = await fetch(`${publisherUrl}/v1/blobs?epochs=5`, {
        method: 'PUT',
        body: finalPayload
      });

      if (!response.ok) {
        throw new Error(`Walrus Publisher HTTP Error: ${response.status} ${response.statusText}`);
      }

      const uploadResult = await response.json();
      
      // Parse blobId from Walrus response
      const blobInfo = uploadResult.newlyCreated || uploadResult.alreadyRegistered;
      if (!blobInfo || !blobInfo.blobObject || !blobInfo.blobObject.blobId) {
        throw new Error('Malformed JSON response from Walrus publisher.');
      }

      const blobId = blobInfo.blobObject.blobId;

      // Submit HCS audit log and get transaction ID
      const txId = await addHcsLog('BLOB_UPLOADED', userSubdomain, `File ${selectedFile.name} encrypted and stored in Walrus. Blob: ${blobId}`);

      const newFile: VaultFile = {
        id: (files.length + 1).toString(),
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        uploadedAt: new Date().toISOString(),
        blobId: blobId,
        status: 'stored',
        encryptionKey: `${keyHex.substring(0, 16)}...`,
        hederaTxId: txId
      };

      setFiles((prev) => [newFile, ...prev]);
      setIsUploading(false);
      setSelectedFile(null);
      logToConsole(`Walrus Protocol: Success! Blob stored on decentralized nodes. Blob ID: ${blobId}`);

    } catch (error: any) {
      logToConsole(`Walrus Upload Error: ${error.message}`);
      
      // Graceful fallback to simulated upload if publisher node is offline/unreachable
      logToConsole('Fallback: Publisher node offline or unreachable. Simulating upload...');
      setTimeout(async () => {
        const mockBlobId = `walrus_blob_${Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
        const mockKey = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        
        const txId = await addHcsLog('BLOB_UPLOADED', userSubdomain, `(SIMULATED) File ${selectedFile.name} encrypted and stored. Blob: ${mockBlobId}`);

        const fallbackFile: VaultFile = {
          id: (files.length + 1).toString(),
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          uploadedAt: new Date().toISOString(),
          blobId: mockBlobId,
          status: 'stored',
          encryptionKey: `${mockKey}...`,
          hederaTxId: txId
        };

        setFiles((prev) => [fallbackFile, ...prev]);
        setIsUploading(false);
        setSelectedFile(null);
        logToConsole(`Walrus Protocol Fallback: Simulated storage complete. Blob ID: ${mockBlobId}`);
      }, 1500);
    }
  };

  const purgeFile = (id: string, name: string) => {
    setFiles((prev) => 
      prev.map((f) => f.id === id ? { ...f, status: 'purged' } : f)
    );
    logToConsole(`Walrus Protocol: Purged file ${name} storage allocation.`);
    addHcsLog('BLOB_PURGED', userSubdomain, `Purged file ${name} metadata and storage allocation.`);
  };

  // The Fixer physical hub
  const [shredQuantity, setShredQuantity] = useState(1);
  const [fixerAddress, setFixerAddress] = useState('');
  const [fixerScheduled, setFixerScheduled] = useState(false);

  const scheduleFixer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixerAddress) return;
    
    setFixerScheduled(true);
    logToConsole(`Fixer Hub: Dispatch representative requested to ${fixerAddress}.`);
    
    setTimeout(() => {
      logToConsole('Fixer Hub: Agent dispatched. Representative ID #889 (Nancy) coordinating collection.');
      addHcsLog('FIXER_SCHEDULED', userSubdomain, `Fixer representative requested. Paper volume: ${shredQuantity} boxes.`);
    }, 1000);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="container animate-slide-up" style={{ flex: 1 }}>
        {/* Sleek Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="glow-text" style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.05em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield style={{ width: '2.25rem', height: '2.25rem', strokeWidth: 2 }} />
              Satoshi&apos;s ParaBox
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              Secure Identity Verification & High-Privacy Decentralized Vault
            </p>
          </div>
          
          <div className="glass-panel" style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles style={{ width: '1rem', height: '1rem' }} />
              World ID v4 Sandbox
            </span>
          </div>
        </header>

        {/* NOT VERIFIED / LANDING PAGE */}
        {!isVerified ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '850px', margin: '0 auto' }}>
            <div className="glass-panel animate-slide-up" style={{ padding: '3.5rem 2.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* Background ambient glow */}
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(0,242,254,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(30px)', pointerEvents: 'none' }}></div>
              
              <div style={{ display: 'inline-flex', padding: '1.25rem', background: 'rgba(0, 242, 254, 0.06)', borderRadius: '50%', marginBottom: '1.5rem', color: 'var(--accent-cyan)' }}>
                <Lock style={{ width: '3.5rem', height: '3.5rem' }} />
              </div>
              
              <h2 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                Secure Identity Gatekeeper
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2.5rem auto', lineHeight: '1.6', fontSize: '1.05rem' }}>
                To decrypt your secure dashboard and generate dynamic ENS routing workspace parameters, verify your unique humanity via World ID.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <IDKitWidget
                    app_id={config.worldIdAppId as `app_${string}`}
                    action={config.worldIdAction}
                    onSuccess={handleWorldIdSuccess}
                    handleVerify={handleWorldIdVerify}
                    verification_level={VerificationLevel.Device}
                  >
                    {({ open }) => (
                      <button className="btn-primary" onClick={open} style={{ fontSize: '1.05rem', padding: '14px 32px' }}>
                        <ShieldCheck style={{ width: '1.35rem', height: '1.35rem' }} />
                        Verify with World ID (Staging)
                      </button>
                    )}
                  </IDKitWidget>
                  
                  <button className="btn-secondary" onClick={() => setShowIdkitModal(true)} style={{ fontSize: '1.05rem', padding: '14px 32px' }}>
                    Simulate Verification
                  </button>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Staging requires scanning the QR code using the <a href="https://simulator.worldcoin.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>Worldcoin Simulator</a>.
                </span>
              </div>
            </div>

            {/* Explanation grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ color: 'var(--accent-cyan)', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                  <Globe style={{ width: '1.2rem', height: '1.2rem' }} />
                  ENS Subdomains
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6' }}>
                  NameStone gasless routing maps verified users to subdomains instantly. No static databases containing personal user logs are ever created.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ color: 'var(--accent-cyan)', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                  <Database style={{ width: '1.2rem', height: '1.2rem' }} />
                  Walrus Storage
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6' }}>
                  Sensitive data is split and stored on decentralized nodes. Files are encrypted client-side; only you hold the decryption keys.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ color: 'var(--accent-cyan)', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                  <Activity style={{ width: '1.2rem', height: '1.2rem' }} />
                  Hedera HCS
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6' }}>
                  Consensus logging builds a tamper-proof audit trail of uploads and self-deletes, fully preserving client anonymity.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED DASHBOARD */
          <div className="dashboard-grid animate-slide-up">
            {/* Left Main Workspace */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Lockout Banner */}
              <div className="lockout-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Clock style={{ color: 'var(--danger)', width: '1.5rem', height: '1.5rem' }} />
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700' }}>Active Encryption Keys Loaded</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      Keys will self-delete in <strong style={{ color: 'white' }}>{secondsLeft}s</strong> due to auto-lockout security protocol.
                    </p>
                  </div>
                </div>
                <button className="btn-secondary" onClick={extendSession} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  Extend Session
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                <button 
                  className={`tab-button ${activeTab === 'vault' ? 'active' : ''}`}
                  onClick={() => setActiveTab('vault')}
                >
                  Decentralized Storage Vault
                </button>
                <button 
                  className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('logs')}
                >
                  Hedera HCS Audit Logs
                </button>
                <button 
                  className={`tab-button ${activeTab === 'fixer' ? 'active' : ''}`}
                  onClick={() => setActiveTab('fixer')}
                >
                  &quot;The Fixer&quot; Physical Hub
                </button>
              </div>

              {/* TAB CONTENT: VAULT */}
              {activeTab === 'vault' && (
                <div className="glass-panel animate-slide-up" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database style={{ color: 'var(--accent-cyan)', width: '1.25rem', height: '1.25rem' }} />
                    Walrus Blob Vault (Client-Side Encrypted)
                  </h3>

                  {/* Upload Drop Zone */}
                  <div style={{ border: '2px dashed var(--card-border)', borderRadius: '12px', padding: '2.5rem 2rem', textAlign: 'center', marginBottom: '2rem', background: 'rgba(0,0,0,0.1)' }}>
                    <Upload style={{ width: '2.5rem', height: '2.5rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                      Select a file to encrypt and push to Walrus Protocol
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <input 
                        type="file" 
                        id="vault-file" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                      />
                      
                      {selectedFile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'white' }}>
                            Ready: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-primary" 
                              onClick={uploadFileToWalrus} 
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <>
                                  <RefreshCw className="pulse-glow" style={{ width: '1.1rem', height: '1.1rem', animation: 'spin 1s linear infinite' }} />
                                  Uploading...
                                </>
                              ) : 'Encrypt & Upload'}
                            </button>
                            <button className="btn-secondary" onClick={() => setSelectedFile(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <label htmlFor="vault-file" className="btn-secondary" style={{ cursor: 'pointer' }}>
                          Choose File
                        </label>
                      )}
                    </div>
                  </div>

                  {/* File List */}
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Stored Files</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {files.map((file) => (
                      <div 
                        key={file.id} 
                        className="glass-panel" 
                        style={{ 
                          padding: '1.25rem', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          background: file.status === 'purged' ? 'rgba(239, 68, 68, 0.04)' : 'var(--card-bg)',
                          opacity: file.status === 'purged' ? 0.6 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                          <FileText style={{ 
                            width: '2.5rem', 
                            height: '2.5rem', 
                            color: file.status === 'purged' ? 'var(--text-muted)' : 'var(--accent-cyan)',
                            flexShrink: 0
                          }} />
                          <div style={{ minWidth: 0 }}>
                            <h5 style={{ fontWeight: '600', textDecoration: file.status === 'purged' ? 'line-through' : 'none', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {file.name}
                            </h5>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              {(file.size / (1024 * 1024)).toFixed(2)} MB | Uploaded: {new Date(file.uploadedAt).toLocaleTimeString()}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem', alignItems: 'center' }}>
                              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                Blob: {file.blobId.substring(0, 16)}...
                              </span>
                              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                HCS Tx:{' '}
                                {file.hederaTxId.includes('fallback') ? (
                                  file.hederaTxId.substring(0, 14) + '...'
                                ) : (
                                  <a 
                                    href={getHashscanLink(file.hederaTxId)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}
                                  >
                                    {file.hederaTxId.substring(0, 14)}...
                                  </a>
                                )}
                              </span>
                              {file.status !== 'purged' && (
                                <a 
                                  href={`${config.walrusAggregator}/v1/blobs/${file.blobId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ background: 'rgba(0, 242, 254, 0.08)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent-cyan)', fontFamily: 'monospace', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  title="Download / View decrypted file in browser"
                                >
                                  <Globe style={{ width: '0.8rem', height: '0.8rem' }} />
                                  View on Walrus
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ flexShrink: 0, marginLeft: '1rem' }}>
                          {file.status === 'purged' ? (
                            <span style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle style={{ width: '1rem', height: '1rem' }} />
                              Purged
                            </span>
                          ) : (
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '8px 12px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                              onClick={() => purgeFile(file.id, file.name)}
                              title="Delete from Walrus"
                            >
                              <Trash2 style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: HEDERA HCS LOGS */}
              {activeTab === 'logs' && (
                <div className="glass-panel animate-slide-up" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity style={{ color: 'var(--accent-purple)', width: '1.25rem', height: '1.25rem' }} />
                    Hedera Consensus Service Audit Feed
                  </h3>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                    Every transaction, login, and data storage deletion in Satoshi&apos;s ParaBox is recorded permanently as a native Consensus message on Topic <code style={{ color: 'white', fontFamily: 'monospace' }}>{config.hederaTopicId}</code>. This guarantees a decentralized, tamper-proof compliance record.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {hcsLogs.map((log) => (
                      <div 
                        key={log.sequenceNumber} 
                        className="glass-panel" 
                        style={{ 
                          padding: '1.25rem', 
                          borderLeft: `3px solid ${
                            log.type === 'IDENTITY_REGISTERED' ? 'var(--success)' : 
                            log.type === 'BLOB_UPLOADED' ? 'var(--accent-cyan)' :
                            log.type === 'BLOB_PURGED' ? 'var(--warning)' : 'var(--danger)'
                          }`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'white' }}>
                            Seq #{log.sequenceNumber} | {log.type}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {log.payload}
                        </p>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '0.5rem' }}>
                          <span>
                            Topic:{' '}
                            <a 
                              href={`https://hashscan.io/testnet/topic/${log.topicId}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}
                            >
                              {log.topicId}
                            </a>
                          </span>
                          <span>
                            Tx ID:{' '}
                            {log.transactionId.includes('fallback') ? (
                              log.transactionId
                            ) : (
                              <a 
                                href={getHashscanLink(log.transactionId)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: '600' }}
                              >
                                {log.transactionId}
                              </a>
                            )}
                          </span>
                          <span>Subdomain: {log.subdomain}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT: THE FIXER PHYSICAL HUB */}
              {activeTab === 'fixer' && (
                <div className="glass-panel animate-slide-up" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Leaf style={{ color: 'var(--success)', width: '1.25rem', height: '1.25rem' }} />
                    &quot;The Fixer&quot; Physical Assistance & Environmental Offset
                  </h3>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.6' }}>
                    For non-tech-savvy users or sensitive paper records. Request a physical representative (&quot;The Fixer&quot;) to manage hardware onboarding, retrieve physical files for offline shredding, and log secure recycling parameters on-chain.
                  </p>

                  <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                    {/* Scheduling form */}
                    <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.2)' }}>
                      <h4 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Schedule Representative Dispatch</h4>
                      
                      {fixerScheduled ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                          <CheckCircle style={{ color: 'var(--success)', width: '3rem', height: '3rem', margin: '0 auto 1rem auto' }} />
                          <h5 style={{ fontWeight: '700', marginBottom: '0.5rem', color: 'white' }}>Fixer Dispatched</h5>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Representative ID #889 has been scheduled to coordinate secure courier collection.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={scheduleFixer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                              Physical Address
                            </label>
                            <input 
                              type="text" 
                              className="custom-input" 
                              placeholder="Enter dispatch address"
                              value={fixerAddress}
                              onChange={(e) => setFixerAddress(e.target.value)}
                              required
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                              Volume (File Shredding Boxes)
                            </label>
                            <select 
                              className="custom-input"
                              value={shredQuantity}
                              onChange={(e) => setShredQuantity(Number(e.target.value))}
                            >
                              <option value={1}>1 Box (Standard Load)</option>
                              <option value={3}>3 Boxes (Small Vault Load)</option>
                              <option value={10}>10+ Boxes (Corporate Shred/Archive)</option>
                            </select>
                          </div>

                          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            Request Fixer Dispatch
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Offset calculator card */}
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <h4 style={{ fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity style={{ color: 'var(--accent-cyan)', width: '1.25rem', height: '1.25rem' }} />
                          ParaBox Energy Offset
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                          Physical document shredding and recycling offsets the hardware production costs and electricity required to run decentralized storage nodes.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>Decentralized Network Power (HCS + Walrus):</span>
                            <strong style={{ marginLeft: 'auto' }}>0.12 kWh / month</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>Recycling Offset Achieved:</span>
                            <strong style={{ marginLeft: 'auto', color: 'var(--success)' }}>12.4 kg CO2 Reduced</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle style={{ color: 'var(--success)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          Vault operations carbon footprint offset.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar Status Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Identity Status Card */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck style={{ color: 'var(--accent-cyan)', width: '1.2rem', height: '1.2rem' }} />
                  Verified Identity Params
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>ENS Workspace Domain</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>{userSubdomain}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>World ID Nullifier Hash</span>
                    <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.75rem' }}>{nullifierHash}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Assigned Testnet Wallet</span>
                    <span style={{ fontFamily: 'monospace' }}>{walletAddress}</span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span>Client Master AES Key</span>
                      <button 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff style={{ width: '1rem', height: '1rem' }} /> : <Eye style={{ width: '1rem', height: '1rem' }} />}
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </span>
                    
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.4)', 
                      padding: '0.5rem', 
                      borderRadius: '6px', 
                      fontFamily: 'monospace', 
                      wordBreak: 'break-all', 
                      fontSize: '0.75rem',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      color: showKey ? 'var(--accent-cyan)' : 'var(--text-muted)'
                    }}>
                      {showKey ? masterKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer Protocol Console Terminal */}
              <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.65)' }}>
                <h4 style={{ fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                  <Terminal style={{ color: 'var(--success)', width: '1.1rem', height: '1.1rem' }} />
                  Developer Protocol Console
                </h4>
                
                <div style={{ 
                  height: '180px', 
                  overflowY: 'auto', 
                  fontFamily: 'Courier New, monospace', 
                  fontSize: '0.75rem', 
                  color: '#4af626',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '4px',
                }}>
                  {consoleLogs.map((log, i) => (
                    <div key={i} style={{ wordBreak: 'break-all' }}>{log}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CUSTOM WORLD ID SCANNER SIMULATOR MODAL */}
      {showIdkitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '500px',
            padding: '2.5rem',
            textAlign: 'center',
            position: 'relative'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', color: 'white' }}>
              World ID Verification
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
              Action: <strong style={{ color: 'white' }}>{config.worldIdAction}</strong>
            </p>

            {/* Mock QR Code Scanner Zone */}
            <div style={{
              width: '200px',
              height: '200px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--card-border)',
              borderRadius: '16px',
              margin: '0 auto 1.5rem auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {isVerifying ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <RefreshCw className="pulse-glow" style={{ width: '2.5rem', height: '2.5rem', color: 'var(--accent-cyan)', margin: '0 auto 0.75rem auto', animation: 'spin 1.5s linear infinite' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Verifying Zero-Knowledge proof...</span>
                </div>
              ) : (
                <>
                  {/* Grid lines inside simulated QR */}
                  <QrCode style={{ width: '6rem', height: '6rem', color: 'var(--text-primary)', opacity: 0.8 }} />
                  {/* Simulated scan line */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'var(--accent-cyan)',
                    boxShadow: '0 0 10px var(--accent-cyan)',
                    animation: 'scan 2.5s ease-in-out infinite'
                  }}></div>
                </>
              )}
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Scan this simulated QR code with your World App credentials to authenticate human state.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={triggerSimulationSuccess}
                disabled={isVerifying}
              >
                Simulate Successful Scan
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setShowIdkitModal(false)}
                disabled={isVerifying}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animation Keyframes for scanner and spins */}
      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
