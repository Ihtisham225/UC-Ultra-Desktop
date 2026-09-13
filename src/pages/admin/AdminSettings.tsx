import { WhatsAppSettingsCard } from "@/components/WhatsAppSettingsCard";
import { SiteSettingsCard } from "@/components/SiteSettingsCard";
import { AdminPageHeader } from "@/components/admin/AdminUi";

export default function AdminSettings() {
  return (
    <>
      <AdminPageHeader
        title="Platform settings"
        description="The central WhatsApp sender and the public site's branding."
      />
      <div className="space-y-4">
        <WhatsAppSettingsCard />
        <SiteSettingsCard />
      </div>
    </>
  );
}
