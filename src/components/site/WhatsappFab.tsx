import { MessageCircle } from "lucide-react";
import { settingBool, useBusinessSettings, whatsappUrl } from "@/lib/business-settings";

export function WhatsappFab() {
  const { data: settings } = useBusinessSettings();
  if (!settings || !settingBool(settings, "enable_whatsapp")) return null;

  return (
    <a
      href={whatsappUrl(settings, `Hi ${settings.store_name}! I'd like to know more about your collection.`)}
      target="_blank"
      rel="noreferrer"
      aria-label="Order on WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white shadow-soft transition-transform hover:scale-105"
      style={{ backgroundColor: "var(--whatsapp)" }}
    >
      <MessageCircle size={18} />
      <span className="hidden sm:inline">Order on WhatsApp</span>
    </a>
  );
}
