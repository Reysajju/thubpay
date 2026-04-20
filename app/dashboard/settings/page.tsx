'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Shield, CreditCard, Key, Bell, Users, Palette, Building2, AlertCircle, CheckCircle2, Clock, ArrowRight, Plus, Loader2 } from 'lucide-react';

type Tab = 'gateways' | 'api_keys' | 'notifications' | 'team' | 'branding';

export default function SettingsPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('gateways');

  // Get workspace ID from pathname
  const getWorkspaceId = () => {
    const match = pathname.match(/\/dashboard\/(brand|workspace)\/([a-f0-9-]+)/);
    return match ? match[2] : '';
  };

  const workspaceId = getWorkspaceId();

  const tabs = [
    { id: 'gateways' as Tab, label: 'Payment Gateways', icon: CreditCard },
    { id: 'api_keys' as Tab, label: 'API Keys', icon: Key },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'team' as Tab, label: 'Team Members', icon: Users },
    { id: 'branding' as Tab, label: 'Branding', icon: Palette }
  ];

  return (
    <div className="min-h-screen bg-thubpay-obsidian">
      {/* Header */}
      <div className="bg-thubpay-surface shadow-sm border-b border-thubpay-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-thubpay-gold/10 text-thubpay-gold'
                        : 'text-zinc-300 hover:bg-thubpay-elevated'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'gateways' && (
              <GatewaySettings workspaceId={workspaceId!} />
            )}
            {activeTab === 'api_keys' && (
              <APIKeySettings workspaceId={workspaceId!} />
            )}
            {activeTab === 'notifications' && (
              <NotificationSettings workspaceId={workspaceId!} />
            )}
            {activeTab === 'team' && (
              <TeamSettings workspaceId={workspaceId!} />
            )}
            {activeTab === 'branding' && (
              <BrandingSettings workspaceId={workspaceId!} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Gateway Settings Component
function GatewaySettings({ workspaceId }: { workspaceId: string }) {
  const [gateways, setGateways] = useState<any[]>([]);
  const [showAddGateway, setShowAddGateway] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  
  // New state variables for robust handling and animations
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const refreshGateways = () => {
    fetch('/api/dashboard/settings/gateways')
      .then(res => res.json())
      .then(data => setGateways(data.gateways || []))
      .catch(err => console.error('Failed to fetch gateways:', err));
  };

  useEffect(() => {
    refreshGateways();
  }, [workspaceId]);

  const handleConnectGateway = async () => {
    if (!selectedGateway || !apiKey) return;
    setIsConnecting(true);
    
    try {
      const res = await fetch('/api/dashboard/settings/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          gateway_slug: selectedGateway,
          api_key: apiKey,
          secret_key: secretKey,
          mode: testMode ? 'test' : 'live'
        })
      });

      if (res.ok) {
        refreshGateways();
        setShowAddGateway(false);
        setApiKey('');
        setSecretKey('');
        setTestMode(false);
      } else {
        console.error('Failed to save gateway');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  const supportedGateways = [
    'stripe',
    'paypal',
    'square',
    'braintree',
    'authorize_net',
    'adyen',
    'razorpay',
    'mollie',
    'checkout_com',
    'verifone'
  ];

  const gatewayColors: Record<string, string> = {
    stripe: '#635BFF',
    paypal: '#003087',
    square: '#1e1e1e',
    braintree: '#00A0E9',
    authorize_net: '#29558E',
    adyen: '#CD0C39',
    razorpay: '#5F259F',
    mollie: '#FC9121',
    checkout_com: '#0A75F1',
    verifone: '#2563EB'
  };

  return (
    <div className="space-y-6">
      <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            Connected Payment Gateways
          </h2>
          <button
            onClick={() => setShowAddGateway(true)}
            className="inline-flex items-center gap-2 px-4 py-2 btn-gradient text-[#111] rounded-lg hover:opacity-95 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Gateway
          </button>
        </div>

        <div className="space-y-4">
          {gateways.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
              <p>No gateways connected yet</p>
              <p className="text-sm mt-2">Click "Add Gateway" to connect a payment service</p>
            </div>
          ) : (
            gateways.map((gateway) => (
              <div key={gateway.id} className="border border-thubpay-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${gatewayColors[gateway.gateway_slug]}20` }}
                    >
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: gatewayColors[gateway.gateway_slug] }}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">
                        {gateway.gateway_slug.charAt(0).toUpperCase() + gateway.gateway_slug.slice(1)}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        {gateway.key_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        gateway.mode === 'live'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-yellow-500/15 text-yellow-300'
                      }`}
                    >
                      {gateway.mode.toUpperCase()}
                    </span>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Gateway Modal */}
      {showAddGateway && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-thubpay-surface rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add Payment Gateway</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {supportedGateways.map((gateway) => (
                  <button
                    key={gateway}
                    onClick={() => setSelectedGateway(gateway)}
                    className={`flex items-center gap-2 p-3 border-2 rounded-lg transition-colors ${
                      selectedGateway === gateway
                        ? 'border-thubpay-gold bg-thubpay-gold/10'
                        : 'border-thubpay-border hover:border-thubpay-border'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${gatewayColors[gateway]}20` }}
                    >
                      <div className="w-5 h-5 rounded" style={{ backgroundColor: gatewayColors[gateway] }} />
                    </div>
                    <span className="font-medium text-sm capitalize">
                      {gateway.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>

              {selectedGateway && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                      Public / API Key *
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your public or API key"
                      className="w-full px-3 py-2 border border-thubpay-border bg-thubpay-elevated rounded-lg focus:ring-2 focus:ring-thubpay-gold focus:border-thubpay-gold text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                      Secret Key
                    </label>
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="Enter your secret key (if applicable)"
                      className="w-full px-3 py-2 border border-thubpay-border bg-thubpay-elevated rounded-lg focus:ring-2 focus:ring-thubpay-gold focus:border-thubpay-gold text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="testMode"
                      checked={testMode}
                      onChange={(e) => setTestMode(e.target.checked)}
                      className="rounded border-thubpay-border bg-thubpay-elevated form-checkbox text-thubpay-gold focus:ring-thubpay-gold/50"
                    />
                    <label htmlFor="testMode" className="text-sm text-zinc-300">
                      Use test environment
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddGateway(false)}
                      disabled={isConnecting}
                      className="flex-1 px-4 py-2 border border-thubpay-border rounded-lg hover:bg-thubpay-elevated transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConnectGateway}
                      disabled={isConnecting || !apiKey.trim()}
                      className="flex-1 px-4 py-2 btn-gradient text-[#111] rounded-lg hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                        </>
                      ) : (
                        'Connect Gateway'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// API Key Settings Component
function APIKeySettings({ workspaceId }: { workspaceId: string }) {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read', 'write']);

  useEffect(() => {
    // Fetch API keys from API
    fetch('/api/dashboard/settings/api-keys')
      .then(res => res.json())
      .then(data => setApiKeys(data))
      .catch(err => console.error('Failed to fetch API keys:', err));
  }, [workspaceId]);

  return (
    <div className="space-y-6">
      <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            API Keys
          </h2>
          <button
            onClick={() => setShowNewKey(true)}
            className="inline-flex items-center gap-2 px-4 py-2 btn-gradient text-[#111] rounded-lg hover:opacity-95 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate New Key
          </button>
        </div>

        <div className="space-y-4">
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Key className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
              <p>No API keys created yet</p>
              <p className="text-sm mt-2">Generate API keys to integrate programmatically</p>
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="border border-thubpay-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{apiKey.name}</h3>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-400">
                      Revoke
                    </Button>
                  </div>
                </div>
                <div className="font-mono text-sm bg-thubpay-elevated p-2 rounded mb-2">
                  {apiKey.key_value.substring(0, 20)}...{apiKey.key_value.substring(apiKey.key_value.length - 20)}
                </div>
                <div className="flex items-center justify-between text-sm text-zinc-500">
                  <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                  <span>Permissions: {apiKey.permissions.join(', ')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New Key Modal */}
      {showNewKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-thubpay-surface rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Generate API Key</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Key Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Production Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold focus:border-thubpay-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    {['read', 'write', 'admin'].map((permission) => (
                      <label key={permission} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          value={permission}
                          checked={newKeyPermissions.includes(permission)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyPermissions([...newKeyPermissions, permission]);
                            } else {
                              setNewKeyPermissions(newKeyPermissions.filter(p => p !== permission));
                            }
                          }}
                          className="rounded border-thubpay-border"
                        />
                        <span className="text-sm capitalize">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-200">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    <strong>Important:</strong> Copy this key now. You won't be able to see it again.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowNewKey(false);
                      setNewKeyName('');
                      setNewKeyPermissions(['read', 'write']);
                    }}
                    className="flex-1 px-4 py-2 border border-thubpay-border rounded-lg hover:bg-thubpay-elevated transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Call API to generate key
                      setShowNewKey(false);
                    }}
                    className="flex-1 px-4 py-2 btn-gradient text-[#111] rounded-lg hover:opacity-95 transition-colors"
                  >
                    Generate Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Notification Settings Component
function NotificationSettings({ workspaceId }: { workspaceId: string }) {
  const [preferences, setPreferences] = useState<any[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);

  useEffect(() => {
    // Fetch notification preferences from API
    fetch('/api/dashboard/settings/notifications')
      .then(res => res.json())
      .then(data => setPreferences(data))
      .catch(err => console.error('Failed to fetch notification preferences:', err));
  }, [workspaceId]);

  const events = [
    { id: 'payment_succeeded', label: 'Payment Received', description: 'Send when a payment is successfully received' },
    { id: 'payment_failed', label: 'Payment Failed', description: 'Send when a payment attempt fails' },
    { id: 'invoice_paid', label: 'Invoice Paid', description: 'Send when an invoice is marked as paid' },
    { id: 'subscription_renewed', label: 'Subscription Renewed', description: 'Send when a subscription is renewed' },
    { id: 'payout_completed', label: 'Payout Completed', description: 'Send when a payout is processed' },
    { id: 'dispute_alert', label: 'Dispute Alert', description: 'Send when a chargeback is filed' }
  ];

  const channels = [
    { id: 'email', label: 'Email', description: 'Send via email' },
    { id: 'slack', label: 'Slack', description: 'Send via Slack webhook' },
    { id: 'in_app', label: 'In-App', description: 'Display in app notifications' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
        <h2 className="text-lg font-semibold text-white mb-6">
          Email Notifications
        </h2>
        <div className="space-y-4">
          {emailTemplates.length === 0 ? (
            <p className="text-zinc-500 text-sm">Loading email templates...</p>
          ) : (
            emailTemplates.map((template) => (
              <div key={template.id} className="border border-thubpay-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white capitalize">{template.id.replace('_', ' ')}</h3>
                  <select className="text-sm border border-thubpay-border rounded-lg px-2 py-1">
                    <option>Transactional</option>
                    <option>Marketing</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={template.subject}
                      className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                      Email Template
                    </label>
                    <textarea
                      rows={4}
                      value={template.html_content}
                      className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
        <h2 className="text-lg font-semibold text-white mb-6">
          Notification Preferences
        </h2>
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="border border-thubpay-border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-white">{event.label}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{event.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {channels.map((channel) => (
                    <label key={channel.id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={preferences.some((p) => p.event_type === event.id && p.channel === channel.id)}
                        className="rounded border-thubpay-border"
                      />
                      <span className="text-xs text-zinc-400 capitalize">{channel.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Team Settings Component
function TeamSettings({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  useEffect(() => {
    // Fetch workspace members from API
    fetch('/api/dashboard/settings/team')
      .then(res => res.json())
      .then(data => setMembers(data))
      .catch(err => console.error('Failed to fetch team members:', err));
  }, [workspaceId]);

  const roles = [
    { id: 'owner', label: 'Owner', description: 'Full access to all features' },
    { id: 'admin', label: 'Admin', description: 'All features except key management' },
    { id: 'member', label: 'Member', description: 'Read-only access to most features' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            Team Members
          </h2>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 px-4 py-2 btn-gradient text-[#111] rounded-lg hover:opacity-95 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Invite Member
          </button>
        </div>

        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
              <p>No team members yet</p>
              <p className="text-sm mt-2">Invite team members to collaborate</p>
            </div>
          ) : (
            members.map((member) => (
              <div key={member.user_id} className="border border-thubpay-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-thubpay-gold/15 flex items-center justify-center">
                      <span className="text-thubpay-gold font-medium">
                        {member.email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{member.email}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          member.role === 'owner'
                            ? 'bg-purple-100 text-purple-700'
                            : member.role === 'admin'
                            ? 'bg-thubpay-gold/15 text-thubpay-gold'
                            : 'bg-thubpay-elevated text-zinc-300'
                        }`}
                      >
                        {member.role}
                      </span>
                    </div>
                  </div>
                  {member.role !== 'owner' && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-400">
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-thubpay-surface rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="member@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold focus:border-thubpay-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                    className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold focus:border-thubpay-gold"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowInvite(false);
                      setEmail('');
                      setRole('member');
                    }}
                    className="flex-1 px-4 py-2 border border-thubpay-border rounded-lg hover:bg-thubpay-elevated transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Call API to invite member
                      setShowInvite(false);
                    }}
                    className="flex-1 px-4 py-2 btn-gradient text-[#111] rounded-lg hover:opacity-95 transition-colors"
                  >
                    Send Invite
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Branding Settings Component
function BrandingSettings({ workspaceId }: { workspaceId: string }) {
  const [brand, setBrand] = useState<any>({});
  const [showSave, setShowSave] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setBrand((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
    setShowSave(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // TODO: Upload and get URL
      setBrand((prev: any) => ({ ...prev, logo_url: URL.createObjectURL(file) }));
      setShowSave(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
        <h2 className="text-lg font-semibold text-white mb-6">
          Branding
        </h2>

        <div className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Logo
            </label>
            <div className="flex items-center gap-4">
              {brand.logo_url ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-thubpay-elevated">
                  <img
                    src={brand.logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-thubpay-elevated flex items-center justify-center text-zinc-500">
                  <Building2 className="w-8 h-8" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-zinc-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-thubpay-gold/10 file:text-thubpay-gold
                    hover:file:bg-thubpay-gold/15"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  PNG, JPG up to 2MB (recommended 500x500px)
                </p>
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                value={brand.company_name || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Support Email
              </label>
              <input
                type="email"
                name="support_email"
                value={brand.support_email || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Website URL
            </label>
            <input
              type="url"
              name="website_url"
              value={brand.website_url || ''}
              onChange={handleInputChange}
              placeholder="https://yourcompany.com"
              className="w-full px-3 py-2 border border-thubpay-border rounded-lg focus:ring-2 focus:ring-thubpay-gold"
            />
          </div>

          {/* Theme Colors */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Brand Colors
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brand.primary_color || '#3B82F6'}
                    onChange={(e) => handleInputChange({ target: { name: 'primary_color', value: e.target.value } } as any)}
                    className="w-12 h-10 rounded border border-thubpay-border"
                  />
                  <input
                    type="text"
                    value={brand.primary_color || ''}
                    onChange={(e) => handleInputChange({ target: { name: 'primary_color', value: e.target.value } } as any)}
                    className="flex-1 px-3 py-2 border border-thubpay-border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brand.secondary_color || '#10B981'}
                    onChange={(e) => handleInputChange({ target: { name: 'secondary_color', value: e.target.value } } as any)}
                    className="w-12 h-10 rounded border border-thubpay-border"
                  />
                  <input
                    type="text"
                    value={brand.secondary_color || ''}
                    onChange={(e) => handleInputChange({ target: { name: 'secondary_color', value: e.target.value } } as any)}
                    className="flex-1 px-3 py-2 border border-thubpay-border rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {showSave && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => {
              // TODO: Call API to save branding
              setShowSave(false);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 btn-gradient text-[#111] rounded-lg hover:opacity-95 shadow-lg transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

// Button Component
function Button({ variant = 'default', size = 'default', children, className = '', ...props }: any) {
  const baseStyles = 'inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors';

  const variants: Record<string, string> = {
    default: 'bg-thubpay-gold text-[#111] hover:opacity-90',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-thubpay-border bg-thubpay-surface hover:bg-thubpay-elevated',
    ghost: 'hover:bg-thubpay-elevated',
    primary: 'btn-gradient text-[#111] hover:opacity-95'
  };

  const sizes: Record<string, string> = {
    default: 'px-4 py-2',
    sm: 'px-3 py-1.5 text-sm',
    lg: 'px-8 py-3',
    icon: 'p-2'
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}


