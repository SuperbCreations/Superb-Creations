import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Facebook, Instagram, Youtube, MessageCircle, Mail, MapPin } from "lucide-react";
import { settingBool, useBusinessSettings, whatsappUrl } from "@/lib/business-settings";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  message: z.string().trim().min(1, "Tell us a little more").max(800),
});

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Superb Creations" },
      {
        name: "description",
        content:
          "Get in touch with Superb Creations. Order on WhatsApp, follow us on Instagram or send a message.",
      },
      { property: "og:title", content: "Contact — Superb Creations" },
      { property: "og:description", content: "We'd love to hear from you." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { settings } = useBusinessSettings();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const storeName = settings.store_name;
  const canWhatsapp = settingBool(settings, "enable_whatsapp");
  const addressText = [
    settings.address,
    settings.city,
    settings.state,
    settings.country,
  ]
    .filter(Boolean)
    .join(" · ");
  const hoursText = settings.business_hours;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !canWhatsapp) {
      setError("WhatsApp support is currently unavailable. Please use email.");
      return;
    }
    const parsed = schema.safeParse({ name, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setError(null);
    const text = `Hi ${storeName}, this is ${parsed.data.name}.\n\n${parsed.data.message}`;
    window.open(whatsappUrl(settings, text), "_blank", "noopener,noreferrer");
  };

  return (
    <section className="container-boutique grid gap-12 py-20 md:grid-cols-2 md:py-28">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
          Say hello.
        </h1>
        <p className="mt-5 max-w-md text-muted-foreground">
          Questions about sizing, custom orders or wholesale? We reply fastest on
          WhatsApp during store hours.
        </p>

        <ul className="mt-10 space-y-5 text-sm">
          {canWhatsapp && (
            <li className="flex items-center gap-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blush">
                <MessageCircle size={16} />
              </span>
              <a
                href={whatsappUrl(settings, `Hi ${storeName}!`)}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                WhatsApp · {settings.phone_number}
              </a>
            </li>
          )}
          <li className="flex items-center gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blush">
              <Mail size={16} />
            </span>
            <a href={`mailto:${settings.contact_email}`} className="hover:underline">
              {settings.contact_email}
            </a>
          </li>
          <li className="flex items-center gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blush">
              <MapPin size={16} />
            </span>
            <span>
              {addressText && <span className="block">{addressText}</span>}
              {hoursText && <span className="block">{hoursText}</span>}
            </span>
          </li>
        </ul>

        <div className="mt-8 flex gap-3">
          {settings && settingBool(settings, "show_instagram") && settings.instagram_url && (
            <SocialIcon href={settings.instagram_url} label="Instagram" icon={<Instagram size={16} />} />
          )}
          {settings && settingBool(settings, "show_youtube") && settings.youtube_url && (
            <SocialIcon href={settings.youtube_url} label="YouTube" icon={<Youtube size={16} />} />
          )}
          {settings && settingBool(settings, "show_facebook") && settings.facebook_url && (
            <SocialIcon href={settings.facebook_url} label="Facebook" icon={<Facebook size={16} />} />
          )}
        </div>
      </div>

      <form onSubmit={submit} className="rounded-sm bg-secondary/60 p-8 md:p-10">
        <h2 className="font-display text-2xl">Send a message</h2>
          <p className="mt-1 text-sm text-muted-foreground">
          We'll reply on WhatsApp when it is available, or by email.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="eyebrow">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-2 w-full border-b border-border bg-transparent px-0 py-2 text-base outline-none focus:border-primary"
              placeholder="Aanya Sharma"
            />
          </label>
          <label className="block">
            <span className="eyebrow">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={800}
              rows={5}
              className="mt-2 w-full resize-none border-b border-border bg-transparent px-0 py-2 text-base outline-none focus:border-primary"
              placeholder="I'd like to ask about…"
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={!canWhatsapp}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground hover:opacity-90"
          >
            <MessageCircle size={14} /> Send via WhatsApp
          </button>
        </div>
      </form>
    </section>
  );
}

function SocialIcon({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-primary-foreground"
    >
      {icon}
    </a>
  );
}
