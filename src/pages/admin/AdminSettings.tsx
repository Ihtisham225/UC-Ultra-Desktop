import { WhatsAppSettingsCard } from "@/components/WhatsAppSettingsCard";
import { SiteSettingsCard } from "@/components/SiteSettingsCard";
import { SupportContactCard } from "@/components/SupportContactCard";
import { AdminPageHeader } from "@/components/admin/AdminUi";

export default function AdminSettings() {
  return (
    <>
      <AdminPageHeader
        title="Platform settings"
        description="The central WhatsApp sender, the support contact and the public site's branding."
      />
      <div className="space-y-4">
        <WhatsAppSettingsCard />
        <SupportContactCard />
        <SiteSettingsCard />
      </div>
    </>
  );
}
