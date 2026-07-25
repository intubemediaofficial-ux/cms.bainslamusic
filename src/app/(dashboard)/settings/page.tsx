"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Bell, Globe, Shield, Landmark, FileText, Loader2, CheckCircle, AlertCircle, Building2, Palette } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePendingGuard } from "@/components/ReadOnlyBanner";
import BrandingSettings from "@/components/features/BrandingSettings";
import NetworkSettings from "@/components/features/NetworkSettings";

interface BankDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  upiId: string;
  panNumber: string;
}

interface Agreement {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  notes: string;
}

interface CompanyProfile {
  id: string;
  branding?: {
    brandName?: string;
    brandColor?: string;
    brandLogo?: string;
  };
  whiteLabelEnabled?: boolean;
  revenueSharePercent?: number;
  customNetworks?: string[];
}

const emptyBankDetails: BankDetails = {
  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
  upiId: "",
  panNumber: "",
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const guardPending = usePendingGuard();
  const [activeSection, setActiveSection] = useState("bank");
  const [bankDetails, setBankDetails] = useState<BankDetails>(emptyBankDetails);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankError, setBankError] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companyProfileLoading, setCompanyProfileLoading] = useState(false);

  const userId = session?.user?.email || "";
  const isCompany = session?.user?.role === "company";

  const fetchBankDetails = useCallback(async () => {
    if (!userId) return;
    try {
      setBankLoading(true);
      const res = await fetch(`/api/client-data?action=getBankDetails&userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setBankDetails(json.data);
      }
    } catch { /* silent */ }
    finally { setBankLoading(false); }
  }, [userId]);

  const fetchAgreements = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/client-data?action=getAgreements&userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setAgreements(json.data);
      }
    } catch { /* silent */ }
  }, [userId]);

  const fetchCompanyProfile = useCallback(async () => {
    if (!isCompany) return;
    setCompanyProfileLoading(true);
    try {
      const res = await fetch("/api/users?action=me", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.data) setCompanyProfile(json.data);
    } catch { /* silent */ }
    finally { setCompanyProfileLoading(false); }
  }, [isCompany]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBankDetails();
    fetchAgreements();
    fetchCompanyProfile();
  }, [fetchBankDetails, fetchAgreements, fetchCompanyProfile]);

  const saveBankDetails = async () => {
    if (guardPending()) return;
    setBankSaving(true);
    setBankError("");
    setBankSaved(false);
    try {
      const res = await fetch("/api/client-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveBankDetails", userId, bankDetails }),
      });
      if (res.ok) {
        setBankSaved(true);
        setTimeout(() => setBankSaved(false), 3000);
      } else {
        setBankError("Failed to save bank details");
      }
    } catch {
      setBankError("Network error");
    } finally {
      setBankSaving(false);
    }
  };

  const sections = [
    { id: "bank", label: "Bank Details", icon: Landmark },
    { id: "agreements", label: "Agreements", icon: FileText },
    ...(isCompany ? [
      { id: "network", label: "Network Settings", icon: Building2 },
      { id: "branding", label: "White-Label Branding", icon: Palette },
    ] : []),
    { id: "general", label: "General", icon: Globe },
    { id: "security", label: "Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Manage your account settings, bank details, and agreements.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-56 shrink-0">
          <nav className="bg-white rounded-xl border border-border p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground hover:bg-slate-50"
                }`}
              >
                <section.icon className="w-4 h-4" />
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1">
          {activeSection === "bank" && (
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-600" />
                Bank Account Details
              </h3>
              {bankLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Account Holder Name</label>
                      <input
                        type="text"
                        value={bankDetails.accountHolderName}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                        placeholder="Enter account holder name"
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Bank Name</label>
                      <input
                        type="text"
                        value={bankDetails.bankName}
                        onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                        placeholder="Enter bank name"
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Account Number</label>
                      <input
                        type="text"
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                        placeholder="Enter account number"
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">IFSC Code</label>
                      <input
                        type="text"
                        value={bankDetails.ifscCode}
                        onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                        placeholder="Enter IFSC code"
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Branch Name</label>
                      <input
                        type="text"
                        value={bankDetails.branchName}
                        onChange={(e) => setBankDetails({ ...bankDetails, branchName: e.target.value })}
                        placeholder="Enter branch name"
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">UPI ID</label>
                      <input
                        type="text"
                        value={bankDetails.upiId}
                        onChange={(e) => setBankDetails({ ...bankDetails, upiId: e.target.value })}
                        placeholder="Enter UPI ID (e.g. name@upi)"
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">PAN Number</label>
                      <input
                        type="text"
                        value={bankDetails.panNumber}
                        onChange={(e) => setBankDetails({ ...bankDetails, panNumber: e.target.value.toUpperCase() })}
                        placeholder="Enter PAN number"
                        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>

                  {bankError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {bankError}
                    </div>
                  )}
                  {bankSaved && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Bank details saved successfully!
                    </div>
                  )}

                  <button
                    onClick={saveBankDetails}
                    disabled={bankSaving}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {bankSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Bank Details
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === "agreements" && (
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Agreements & Licenses
              </h3>
              {agreements.length === 0 ? (
                <div className="text-center py-10">
                  <FileText className="w-12 h-12 text-muted mx-auto mb-3" />
                  <p className="text-sm text-muted">No agreements uploaded yet.</p>
                  <p className="text-xs text-muted mt-1">Your admin will upload agreements here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agreements.map((ag) => (
                    <div key={ag.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{ag.fileName}</p>
                          <p className="text-xs text-muted">Uploaded {new Date(ag.uploadedAt).toLocaleDateString("en-IN")}</p>
                          {ag.notes && <p className="text-xs text-muted mt-0.5">{ag.notes}</p>}
                        </div>
                      </div>
                      <a
                        href={ag.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === "network" && isCompany && (
            companyProfileLoading ? (
              <div className="bg-white rounded-xl border border-border py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : companyProfile ? (
              <NetworkSettings
                userId={companyProfile.id}
                currentNetworkName={companyProfile.customNetworks?.[0] || ""}
                currentRevenueShare={companyProfile.revenueSharePercent || 0}
                role="company"
                onSave={fetchCompanyProfile}
              />
            ) : (
              <div className="bg-white rounded-xl border border-border p-6 text-sm text-muted">Company settings could not be loaded.</div>
            )
          )}

          {activeSection === "branding" && isCompany && (
            companyProfileLoading ? (
              <div className="bg-white rounded-xl border border-border py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : companyProfile?.whiteLabelEnabled ? (
              <BrandingSettings
                userId={companyProfile.id}
                currentBranding={companyProfile.branding}
                onSave={fetchCompanyProfile}
              />
            ) : (
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="font-semibold text-foreground flex items-center gap-2"><Palette className="w-5 h-5 text-purple-500" />White-Label Branding</h3>
                <p className="text-sm text-muted mt-3">White-label access is controlled by the main administrator. Once enabled, you can set your brand name, brand color, and upload your logo here.</p>
              </div>
            )
          )}

          {activeSection === "general" && (
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-6">General Settings</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Name</label>
                  <input type="text" defaultValue={session?.user?.name || ""} className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input type="email" defaultValue={session?.user?.email || ""} disabled className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-slate-50 text-muted" />
                </div>
              </div>
            </div>
          )}

          {activeSection === "security" && (
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-6">Security Settings</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Current Password</label>
                  <input type="password" placeholder="Enter current password" className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-light" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                  <input type="password" placeholder="Enter new password" className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-light" />
                </div>
                <button className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  <Save className="w-4 h-4" />
                  Update Password
                </button>
              </div>
            </div>
          )}

          {activeSection === "notifications" && (
            <div className="bg-white rounded-xl border border-border p-6">
              <h3 className="font-semibold text-foreground mb-6">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { label: "Revenue reports", desc: "Daily/weekly revenue summary" },
                  { label: "Payment updates", desc: "When payment status changes" },
                  { label: "Content ID claims", desc: "New copyright claim notifications" },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted mt-0.5">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
