import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Instagram, Youtube, MessageCircle, Mail, MapPin } from "lucide-react";
import { whatsappLink } from "@/lib/products";

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
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setError(null);
    const text = `Hi Superb Creations, this is ${parsed.data.name}.\n\n${parsed.data.message}`;
    window.open(whatsappLink(text), "_blank", "noopener,noreferrer");
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
          WhatsApp — usually within a few hours.
        </p>

        <ul className="mt-10 space-y-5 text-sm">
          <li className="flex items-center gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blush">
              <MessageCircle size={16} />
            </span>
            <a href={whatsappLink("Hi Superb Creations!")} target="_blank" rel="noreferrer" className="hover:underline">
              WhatsApp · +91 70062 02496
            </a>
          </li>
          <li className="flex items-center gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blush">
              <Mail size={16} />
            </span>
            <a href="mailto:hello@superbcreations.in" className="hover:underline">
              hello@superbcreations.in
            </a>
          </li>
          <li className="flex items-center gap-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blush">
              <MapPin size={16} />
            </span>
            <span>Studio · India · Mon–Sat, 10am–7pm</span>
          </li>
        </ul>

        <div className="mt-8 flex gap-3">
          <a
            href="https://www.instagram.com/superb_creations_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-primary-foreground"
          >
            <Instagram size={16} />
          </a>
          <a
            href="https://youtube.com/@superb_creations?si=8gHDjFUhjRMpktts"
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-primary-foreground"
          >
            <Youtube size={16} />
          </a>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-sm bg-secondary/60 p-8 md:p-10">
        <h2 className="font-display text-2xl">Send a message</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll reply on WhatsApp — your message opens a chat with us.
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.22em] text-primary-foreground hover:opacity-90"
          >
            <MessageCircle size={14} /> Send via WhatsApp
          </button>
        </div>
      </form>
    </section>
  );
}
