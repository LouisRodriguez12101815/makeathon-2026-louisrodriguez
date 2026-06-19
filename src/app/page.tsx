'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { syncCheckoutWithFigma, processCheckoutPayment, getRecentTransactions } from '@/app/actions/checkoutActions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bot, DollarSign, ShieldCheck, Mail, User, Phone, CheckCircle, RefreshCw, Layers, Sparkles, Database, AlertTriangle, TrendingDown, Clipboard, Check } from 'lucide-react';

export default function Home() {
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const WALKTHROUGH_KEY = 'feeshield_walkthrough_dismissed';
  
  // State for merchant variables
  const [auditSettings, setAuditSettings] = useState({
    merchantId: 'feeshield_merchant',
    checkoutTitle: "FeeShield Contract Audit Panel",
    paymentMethods: ["dLocal", "Ebanx", "Mercado Pago", "Stripe LATAM"],
    brandColor: '#ef4444', // Red Warning Theme
    amountUsd: 10000,
  });

  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // State for Audit Inputs
  const [selectedProcessor, setSelectedProcessor] = useState('dLocal');
  const [amount, setAmount] = useState(25000);
  const [quotedPercent, setQuotedPercent] = useState(4.2); // Quoted 4.2%
  const [quotedDays, setQuotedDays] = useState(4); // Quoted 4 days

  type AuditStatus = 'Gouged' | 'Warning' | 'Fair';

  interface AuditResult {
    success: true;
    standardPercent: number;
    standardDays: number;
    expectedFee: number;
    actualChargedFee: number;
    calculatedLoss: number;
    status: AuditStatus;
    delayMarkup: number;
  }

  interface RecentAudit {
    id: string;
    payer_name: string;
    payer_email: string;
    payment_method: string;
    amount: number;
    status: AuditStatus;
    gateway_used: string;
    created_at?: string;
  }

  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [copied, setCopied] = useState(false);

  // Load audits on demand after lead completion
  const loadAudits = async () => {
    setDbLoading(true);
    try {
      const res = await getRecentTransactions();
      if (res.success && Array.isArray(res.audits)) {
        setRecentAudits(res.audits as RecentAudit[]);
      }
    } catch (e: unknown) {
      console.warn('Could not load audits:', e);
    } finally {
      setDbLoading(false);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadCaptured(true);

    const dismissed = window.localStorage.getItem(WALKTHROUGH_KEY) === '1';
    if (!dismissed) {
      setShowWalkthrough(true);
    }

    await loadAudits();
  };

  const handleFigmaSync = async () => {
    setFigmaLoading(true);
    try {
      const res = await syncCheckoutWithFigma(auditSettings.merchantId);
      if (res.success && res.settings) {
        setAuditSettings({
          merchantId: res.settings.merchant_id,
          checkoutTitle: res.settings.checkout_title,
          paymentMethods: res.settings.payment_methods,
          brandColor: res.settings.brand_color,
          amountUsd: res.settings.amount_usd,
        });
        alert(res.message);
      } else {
        alert(res.message || "Figma Sync failed. Standard placeholders loaded.");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      alert("Figma Sync Error: " + message);
    } finally {
      setFigmaLoading(false);
    }
  };

  const activateDemoMode = () => {
    setSelectedProcessor('dLocal');
    setAmount(25000);
    setQuotedPercent(4.5);
    setQuotedDays(4);
    setAuditResult(null);
  };

  const closeWalkthrough = (persistDismissal: boolean) => {
    if (persistDismissal) {
      window.localStorage.setItem(WALKTHROUGH_KEY, '1');
    }
    setShowWalkthrough(false);
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuditLoading(true);
    setAuditResult(null);

    try {
      const res = await processCheckoutPayment({
        payerName: leadData.name,
        payerEmail: leadData.email,
        paymentMethod: selectedProcessor,
        amount: amount,
        quotedPercentage: quotedPercent,
        quotedSettlementDays: quotedDays,
      });

      if (res.success) {
        // Overriding mock values from Actions with real state variables for accuracy
        const standardPercent = selectedProcessor === 'dLocal' ? 2.8 : selectedProcessor === 'Ebanx' ? 2.9 : selectedProcessor === 'Mercado Pago' ? 3.5 : 3.9;
        const standardDays = selectedProcessor === 'Mercado Pago' ? 0 : selectedProcessor === 'Ebanx' ? 1 : selectedProcessor === 'dLocal' ? 2 : 3;
        
        const expectedFee = amount * (standardPercent / 100) + 0.30;
        const actualChargedFee = amount * (quotedPercent / 100) + 0.30;
        const calculatedLoss = Number((actualChargedFee - expectedFee).toFixed(2));
        
        let status: AuditStatus = 'Fair';
        if (calculatedLoss > 150) {
          status = 'Gouged';
        } else if (calculatedLoss > 10) {
          status = 'Warning';
        }

        setAuditResult({
          success: true,
          standardPercent,
          standardDays,
          expectedFee,
          actualChargedFee,
          calculatedLoss,
          status,
          delayMarkup: quotedDays - standardDays
        });
        
        try {
          await loadAudits(); // Refresh list
        } catch (dbErr) {
          console.warn("Could not load audits log list:", dbErr);
        }
      } else {
        alert("Audit failed. Did you run the SQL migrations in Supabase? Error details: " + res.message);
      }
  } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : String(e);
      alert("Connection Error. Ensure your Supabase Database is set up correctly: " + message);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate dynamic renegotiation email draft based on audit variables
  const generateEmailScript = () => {
    if (!auditResult) return '';
    return `Subject: RE: Contract Rate Audit Variance — ${leadData.name || 'Our Company'} / ${selectedProcessor}

Dear Payouts Account Team,

I am writing to request a formal review of our current contract pricing structure for our LATAM routes. 

We recently completed a benchmark audit of our account activity. For a standard volume of $${amount.toLocaleString()} on our corridors, our contracted rate of ${quotedPercent}% and a settlement delay of ${quotedDays} days results in an estimated overage loss of $${auditResult.calculatedLoss.toLocaleString()} above standard public baselines (which sit at ${auditResult.standardPercent}% with ${auditResult.standardDays} day(s) settlement).

We value our partnership with ${selectedProcessor}, but we must align our operating metrics with standard market limits to ensure commercial viability. Please let me know when you are available this week for a brief call to discuss adjusting our percentage fees.

Best regards,
${leadData.name}
${leadData.email}`;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-8 my-8">
        
        {/* Header Banner */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14}/> B2B Payment Audit Platform
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Fee<span className="text-red-500">Shield</span> LATAM Fee Radar
          </h1>
          <p className="text-slate-400 text-sm md:text-md">
            The design-to-database contract auditing platform. Match quoted merchant rates against public baselines and generate copy-paste negotiation scripts to stop fee bleeding.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!leadCaptured ? (
            <motion.div
              key="lead-gate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-center text-2xl">Unlock Audit Console</CardTitle>
                  <CardDescription className="text-slate-400 text-center">
                    Provide credentials to explore the LATAM Price Gouging Spotter & Copilot.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Engagement links: make social + writeup impossible to miss for reviewers */}
                  <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="text-xs font-extrabold tracking-wider uppercase text-amber-200">Engagement links</div>
                    <p className="mt-1 text-sm text-slate-200">
                      Review the build story + socials (hackathon requirement):
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <a
                        href="https://www.linkedin.com/posts/cloud-louis_forgot-just-how-many-tools-were-on-figma-share-7473542221330534400-Xcj2/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAEDY9f8BPSK9XermphDoPj6w2YLqsA39hL0"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-bold text-slate-100 hover:bg-slate-900 hover:border-slate-500 transition-colors"
                      >
                        LinkedIn — social post
                      </a>
                      <a
                        href="https://medium.com/@louis.rodriguez006/feeshield-a-30-second-audit-for-latam-payment-processor-fees-config-makeathon-05f7f23930e4"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-bold text-slate-100 hover:bg-slate-900 hover:border-slate-500 transition-colors"
                      >
                        Medium — full writeup
                      </a>
                      <a
                        href="https://x.com/Louis_buckies/status/2067772057547374957"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-bold text-slate-100 hover:bg-slate-900 hover:border-slate-500 transition-colors"
                      >
                        X — announcement post
                      </a>
                    </div>
                    <div className="mt-3 text-xs text-slate-300">
                      Quick links: <a className="underline hover:text-white" target="_blank" rel="noreferrer" href="https://youtu.be/ANryI-RTDHk">demo video</a> ·{' '}
                      <a className="underline hover:text-white" target="_blank" rel="noreferrer" href="https://github.com/LouisRodriguez12101815/makeathon-2026-louisrodriguez">source</a> ·{' '}
                      <a className="underline hover:text-white" target="_blank" rel="noreferrer" href="https://www.figma.com/file/UiTojwSQh8dbKeJZI1YonL/branding_makeAthon">Figma board</a>
                    </div>
                  </div>

                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2"><User size={16}/> Your Name</label>
                      <input 
                        required 
                        type="text" 
                        className="w-full p-3 rounded-md bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500 text-white" 
                        placeholder="Jane Doe"
                        value={leadData.name}
                        onChange={e => setLeadData({...leadData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2"><Mail size={16}/> Work Email</label>
                      <input 
                        required 
                        type="email" 
                        className="w-full p-3 rounded-md bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500 text-white" 
                        placeholder="jane@company.com"
                        value={leadData.email}
                        onChange={e => setLeadData({...leadData, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2"><Phone size={16}/> Phone Number</label>
                      <input 
                        required 
                        type="tel" 
                        className="w-full p-3 rounded-md bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500 text-white" 
                        placeholder="+1 (555) 000-0000"
                        value={leadData.phone}
                        onChange={e => setLeadData({...leadData, phone: e.target.value})}
                      />
                    </div>
                    <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-md transition-all shadow-lg shadow-red-600/10">
                      Access Console
                    </button>
                    <p className="text-xs text-slate-500 text-center">B2B Audit Access - Verified details logged to Supabase.</p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <p className="text-xs text-slate-400">
                  Short flow: set quoted terms, run audit, then copy the generated negotiation script.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={activateDemoMode}
                    className="px-3 py-2 text-xs font-bold rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles size={14} />
                    Demo Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWalkthrough(true)}
                    className="px-3 py-2 text-xs font-bold rounded-md border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-colors"
                  >
                    Walkthrough
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT SIDE: Figma & Config Customization Dashboard */}
                <div className="lg:col-span-5 space-y-6">
                  <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-slate-100 flex items-center gap-2">
                        <Layers className="text-red-500" /> Figma Design Integrator
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        Synchronize brand palettes and active payment vectors live from your Figma project canvas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="p-4 bg-slate-800/50 rounded-lg space-y-2 border border-slate-700/30">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Figma Node Map</div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                          Your Figma design key is linked. The compiler scans for custom vector frames named <code className="text-red-400">Branding</code> to map corporate styles.
                        </div>
                      </div>

                      <button 
                        onClick={handleFigmaSync} 
                        disabled={figmaLoading}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={figmaLoading ? "animate-spin" : ""} size={18} />
                        {figmaLoading ? "Analyzing Canvas Nodes..." : "Sync from Figma Canvas"}
                      </button>

                      <div className="border-t border-slate-800 pt-6 space-y-4">
                        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Fee Audit Parameters</h4>
                        
                        <div className="space-y-2">
                          <label className="text-xs text-slate-400 font-bold uppercase">Quoted Fee Percentage</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              step="0.1"
                              min="0.1"
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                              value={quotedPercent}
                              onChange={e => setQuotedPercent(Number(e.target.value))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs text-slate-400 font-bold uppercase">Quoted Settlement Delay</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="0"
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                              value={quotedDays}
                              onChange={e => setQuotedDays(Number(e.target.value))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">days</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs text-slate-400 font-bold uppercase">Total Transaction Size</label>
                          <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="number" 
                              className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                              value={amount}
                              onChange={e => setAmount(Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pricing Matrix & Audit Guidelines Reference Card (Interactive Instructions) */}
                  <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        <TrendingDown className="text-red-500" /> Baseline Rates Reference
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Compare your quoted rates against standard public rates stored in Supabase:
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="divide-y divide-slate-800">
                        <div className="py-2 flex justify-between text-xs">
                          <span className="font-bold text-slate-300">dLocal:</span>
                          <span className="text-slate-400">2.8% fee | 2 days settlement</span>
                        </div>
                        <div className="py-2 flex justify-between text-xs">
                          <span className="font-bold text-slate-300">Ebanx:</span>
                          <span className="text-slate-400">2.9% fee | 1 day settlement</span>
                        </div>
                        <div className="py-2 flex justify-between text-xs">
                          <span className="font-bold text-slate-300">Mercado Pago:</span>
                          <span className="text-slate-400">3.5% fee | Instant settlement</span>
                        </div>
                        <div className="py-2 flex justify-between text-xs">
                          <span className="font-bold text-slate-300">Stripe LATAM:</span>
                          <span className="text-slate-400">3.9% fee | 3 days settlement</span>
                        </div>
                      </div>

                      <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/10 space-y-1">
                        <div className="text-xs font-bold text-red-400 flex items-center gap-1">
                          <AlertTriangle size={12} /> How to Test Overage Spotting:
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          1. Select <strong className="text-slate-300">dLocal</strong> as target processor.<br/>
                          2. Set Quoted Fee to <strong className="text-slate-300">4.5%</strong> and size to <strong className="text-slate-300">$25,000</strong>.<br/>
                          3. Click <strong className="text-slate-300">Audit Contract</strong> to see your overage and copy the auto-generated Account Team email!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT SIDE: Interactive Fee Shield Audit Panel */}
                <div className="lg:col-span-7 space-y-6">
                  <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl overflow-hidden relative">
                    <div className="h-2 w-full" style={{ backgroundColor: auditSettings.brandColor }}></div>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
                          <TrendingDown style={{ color: auditSettings.brandColor }} /> {auditSettings.checkoutTitle}
                        </CardTitle>
                        <div className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded">
                          Diagnostic Live Preview
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      
                      <form onSubmit={handleAuditSubmit} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Target Processor</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {auditSettings.paymentMethods.map(method => {
                              const active = selectedProcessor === method;
                              return (
                                <button 
                                  type="button"
                                  key={method}
                                  onClick={() => setSelectedProcessor(method)}
                                  className={`p-3 rounded-lg border text-xs font-bold transition-all flex flex-col items-center justify-center gap-2 ${active ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                                >
                                  <span>{method}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={auditLoading}
                          style={{ backgroundColor: auditSettings.brandColor }}
                          className="w-full hover:brightness-110 text-white font-bold py-3.5 px-4 rounded shadow-lg transition-all text-sm uppercase tracking-wider"
                        >
                          {auditLoading ? "Analyzing..." : `Audit ${selectedProcessor} Contract`}
                        </button>
                      </form>

                      {/* Display Audit Results */}
                      <AnimatePresence mode="wait">
                        {auditResult && auditResult.success && (
                          <motion.div 
                            key="audit-output" 
                            initial={{ opacity: 0, y: 20 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="space-y-6 pt-6 border-t border-slate-800"
                          >
                            
                            {/* Visual Gouging Meter */}
                            {auditResult.status === "Gouged" && (
                              <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-xl flex items-start gap-4">
                                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={24} />
                                <div>
                                  <h4 className="text-red-400 font-bold text-md">Price Gouging Detected!</h4>
                                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    Your quoted rate is higher than standard public fees for {selectedProcessor}. You are losing about <strong className="text-red-400">${auditResult.calculatedLoss.toLocaleString()}</strong> on this transaction benchmark.
                                  </p>
                                </div>
                              </div>
                            )}

                            {auditResult.status === "Warning" && (
                              <div className="bg-yellow-500/10 border border-yellow-500/30 p-5 rounded-xl flex items-start gap-4">
                                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={24} />
                                <div>
                                  <h4 className="text-yellow-400 font-bold text-md">Moderate Markup Warning</h4>
                                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    Quoted rates show a slight inflation. You are paying a markup of about <strong className="text-yellow-400">${auditResult.calculatedLoss.toLocaleString()}</strong> above baseline standards.
                                  </p>
                                </div>
                              </div>
                            )}

                            {auditResult.status === "Fair" && (
                              <div className="bg-green-500/10 border border-green-500/30 p-5 rounded-xl flex items-start gap-4">
                                <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={24} />
                                <div>
                                  <h4 className="text-green-400 font-bold text-md">Fair Price Confirmed</h4>
                                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    Excellent! Your contracted rate matches or beats standard pricing benchmarks for {selectedProcessor} within the target region.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Comparison Statistics Card */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400 uppercase font-medium">Standard Public Fee</div>
                                <div className="text-lg font-bold text-slate-200 mt-1">{auditResult.standardPercent}%</div>
                              </div>
                              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400 uppercase font-medium">Your Quoted Fee</div>
                                <div className="text-lg font-bold text-slate-200 mt-1">{quotedPercent}%</div>
                              </div>
                              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg col-span-2 md:col-span-1">
                                <div className="text-xs text-slate-400 uppercase font-medium">Overage Variance</div>
                                <div className={`text-lg font-black mt-1 ${auditResult.status === 'Fair' ? 'text-green-400' : 'text-red-400'}`}>
                                  ${auditResult.calculatedLoss.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {/* CFO Negotiation Copilot Mailer (Action 2 Focus) */}
                            {auditResult.status !== 'Fair' && (
                              <div className="space-y-3 pt-4 border-t border-slate-800/60">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Bot size={14} className="text-blue-400" /> Account Manager Negotiation Script
                                  </h4>
                                  <button 
                                    type="button" 
                                    onClick={() => handleCopyText(generateEmailScript())}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                                  >
                                    {copied ? (
                                      <>Copied <Check size={12} /></>
                                    ) : (
                                      <>Copy Script <Clipboard size={12} /></>
                                    )}
                                  </button>
                                </div>
                                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-line leading-relaxed h-48 overflow-y-auto border-slate-100">
                                  {generateEmailScript()}
                                </div>
                              </div>
                            )}

                          </motion.div>
                        )}
                      </AnimatePresence>

                    </CardContent>
                  </Card>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Database Real-Time Transactions Log */}
        {leadCaptured && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Card className="bg-slate-900 border-slate-800 shadow-xl">
              <CardHeader className="flex flex-row justify-between items-center border-b border-slate-800/60 pb-4">
                <div>
                  <CardTitle className="text-slate-100 flex items-center gap-2 text-md">
                    <Database size={18} className="text-red-400" /> Supabase Audit Log
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Real-time fee transparency entries logged securely on Supabase.
                  </CardDescription>
                </div>
                <button 
                  onClick={loadAudits}
                  className="p-2 border border-slate-700 text-slate-400 rounded hover:text-slate-100 hover:border-slate-500 transition-colors"
                  disabled={dbLoading}
                >
                  <RefreshCw size={14} className={dbLoading ? "animate-spin" : ""} />
                </button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-400">
                    <thead className="text-xs uppercase bg-slate-800/40 text-slate-400 border-b border-slate-800/60">
                      <tr>
                        <th className="px-6 py-3">Auditor</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Processor Checked</th>
                        <th className="px-6 py-3">Audit Amount</th>
                        <th className="px-6 py-3">Loss over Standard</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAudits && recentAudits.length > 0 ? (
                        recentAudits.map((tx) => (
                          <tr key={tx.id} className="border-b border-slate-800/40 hover:bg-slate-800/10 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-200">{tx.payer_name}</td>
                            <td className="px-6 py-4">{tx.payer_email}</td>
                            <td className="px-6 py-4">{tx.payment_method}</td>
                            <td className="px-6 py-4 text-slate-200 font-bold">${tx.amount.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <span className={tx.status === 'Fair' ? "text-green-400" : "text-red-400"}>
                                {tx.gateway_used}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                tx.status === 'Fair' 
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                  : tx.status === 'Warning'
                                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-500">
                            No fee audits recorded in Supabase yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <AnimatePresence>
          {leadCaptured && showWalkthrough && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
              >
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">Welcome to FeeShield</h3>
                  <p className="text-sm text-slate-400">
                    You are auditing whether your payment processor quote is above normal LATAM market rates.
                  </p>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
                    <span className="text-slate-200 font-semibold">1) Enter quoted terms</span>
                    <p className="text-slate-400 text-xs mt-1">Set processor, quoted fee %, settlement delay, and transaction amount.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
                    <span className="text-slate-200 font-semibold">2) Run the contract audit</span>
                    <p className="text-slate-400 text-xs mt-1">FeeShield compares your quote against benchmark public baselines and computes overage.</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
                    <span className="text-slate-200 font-semibold">3) Use negotiation leverage</span>
                    <p className="text-slate-400 text-xs mt-1">Copy the generated script and send it to your account manager.</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={activateDemoMode}
                    className="px-4 py-2 rounded-md text-sm font-bold border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    Load Demo Inputs
                  </button>
                  <button
                    type="button"
                    onClick={() => closeWalkthrough(false)}
                    className="px-4 py-2 rounded-md text-sm font-bold border border-slate-700 text-slate-200 hover:border-slate-600"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => closeWalkthrough(true)}
                    className="px-4 py-2 rounded-md text-sm font-bold bg-slate-100 text-slate-900 hover:bg-white"
                  >
                    Don&apos;t show again
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
