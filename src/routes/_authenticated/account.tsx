import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, FileText, Gift, Heart, LogOut, MapPin, Package, Shield, Star, Ticket, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/products";
import { useBusinessSettings } from "@/lib/business-settings";
import {
  useCustomerAddresses,
  useEmailPreferences,
  useCustomerProfile,
  useDeleteAddress,
  useLoyalty,
  useNewsletterSubscribe,
  useNotifications,
  useSaveAddress,
  useSaveCustomerProfile,
  useSaveEmailPreferences,
  useWishlist,
  type CustomerAddress,
} from "@/lib/customer-engagement";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Your account — Superb Creations" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const { data: settings } = useBusinessSettings();
  const { addItem, setOpen: setCartOpen } = useCart();
  const [tab, setTab] = useState("profile");
  const { data: profile } = useCustomerProfile(user?.id);
  const saveProfile = useSaveCustomerProfile(user?.id);
  const { data: addresses = [] } = useCustomerAddresses(user?.id);
  const saveAddress = useSaveAddress(user?.id);
  const deleteAddress = useDeleteAddress(user?.id);
  const { data: wishlist = [] } = useWishlist(user?.id);
  const { data: loyalty } = useLoyalty(user?.id);
  const { data: notifications = [] } = useNotifications(user?.id);
  const { data: emailPreferences } = useEmailPreferences(user?.id);
  const saveEmailPreferences = useSaveEmailPreferences(user?.id);
  const newsletter = useNewsletterSubscribe();
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({});
  const [addressDraft, setAddressDraft] = useState<Partial<CustomerAddress> | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_events(*), shipment_events(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const fullName =
    profile?.full_name ||
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

  const paymentLabel = (order: any) => {
    if (order.payment_status === "awaiting_payment") return "Payment Pending";
    if (order.payment_status === "under_review") return "Under Review";
    if (order.payment_status === "approved" || order.status === "confirmed") return "Approved";
    if (order.payment_status === "rejected") return "Rejected";
    if (order.payment_status === "expired") return "Expired";
    return order.payment_status || order.status;
  };

  return (
    <section className="container-boutique py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">Hi {fullName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <h2 className="mt-12 font-display text-2xl">Order history</h2>
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-2">
        {[
          ["profile", "Profile", User],
          ["addresses", "Addresses", MapPin],
          ["wishlist", "Wishlist", Heart],
          ["orders", "Orders", Package],
          ["reviews", "Reviews", Star],
          ["coupons", "Coupons", Ticket],
          ["gift_cards", "Gift Cards", Gift],
          ["loyalty", "Loyalty", Star],
          ["notifications", "Notifications", Bell],
          ["security", "Security", Shield],
        ].map(([key, label, Icon]: any) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.16em] " +
              (tab === key ? "border-primary bg-primary text-primary-foreground" : "border-border")
            }
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <section className="mt-6 max-w-2xl rounded-sm border border-border p-5">
          <h2 className="font-display text-2xl">Profile</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["full_name", "Full name"],
              ["phone", "Phone number"],
              ["date_of_birth", "Date of birth"],
              ["gender", "Gender"],
              ["profile_picture_url", "Profile picture URL"],
              ["preferred_language", "Preferred language"],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  {label}
                </span>
                <input
                  type={key === "date_of_birth" ? "date" : "text"}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm"
                  value={profileDraft[key] ?? profile?.[key] ?? ""}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-2 text-sm">
            {[
              ["order_updates", "Order updates"],
              ["payment_updates", "Payment updates"],
              ["shipping_updates", "Shipping updates"],
              ["coupons", "Coupons"],
              ["announcements", "Announcements"],
              ["wishlist_alerts", "Wishlist alerts"],
              ["review_requests", "Review requests"],
            ].map(([key, label]) => {
              const prefs = {
                ...(profile?.notification_preferences ?? {}),
                ...(profileDraft.notification_preferences ? JSON.parse(profileDraft.notification_preferences) : {}),
              };
              return (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs[key] !== false}
                    onChange={(e) => {
                      const next = { ...prefs, [key]: e.target.checked };
                      setProfileDraft((d) => ({ ...d, notification_preferences: JSON.stringify(next) }));
                    }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              saveProfile.mutate(
                {
                  ...profileDraft,
                  notification_preferences: profileDraft.notification_preferences
                    ? JSON.parse(profileDraft.notification_preferences)
                    : profile?.notification_preferences,
                },
                { onSuccess: () => toast.success("Profile saved.") },
              )
            }
            className="mt-5 rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            Save profile
          </button>
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-medium">Newsletter</p>
            <button
              type="button"
              onClick={() => newsletter.mutate({ email: user?.email || "", userId: user?.id }, { onSuccess: () => toast.success("Subscribed.") })}
              className="mt-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]"
            >
              Subscribe with {user?.email}
            </button>
          </div>
        </section>
      )}

      {tab === "addresses" && (
        <section className="mt-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAddressDraft({ label: "Home", country: "India", is_shipping: true })}
              className="rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
            >
              Add address
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-sm border border-border p-4">
                <p className="font-medium">{address.label} {address.is_default && "· Default"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {address.recipient_name}<br />{address.phone}<br />
                  {[address.line1, address.line2, address.city, address.state, address.country, address.pincode].filter(Boolean).join(", ")}
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setAddressDraft(address)} className="rounded-full border border-border px-3 py-1.5 text-xs">Edit</button>
                  <button onClick={() => deleteAddress.mutate(address.id)} className="rounded-full border border-border px-3 py-1.5 text-xs text-destructive">Delete</button>
                </div>
              </div>
            ))}
          </div>
          {addressDraft && (
            <div className="mt-6 rounded-sm border border-border bg-secondary/30 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["label", "Label"],
                  ["recipient_name", "Recipient"],
                  ["phone", "Phone"],
                  ["line1", "Address line 1"],
                  ["line2", "Address line 2"],
                  ["city", "City"],
                  ["state", "State"],
                  ["country", "Country"],
                  ["pincode", "Pincode"],
                ].map(([key, label]) => (
                  <input
                    key={key}
                    placeholder={label}
                    className="rounded-md border border-border bg-background px-3 py-2.5 text-sm"
                    value={(addressDraft as any)[key] ?? ""}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {[
                  ["is_default", "Default"],
                  ["is_billing", "Billing"],
                  ["is_shipping", "Shipping"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean((addressDraft as any)[key])}
                      onChange={(e) => setAddressDraft((d) => ({ ...d, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => saveAddress.mutate(addressDraft, { onSuccess: () => { setAddressDraft(null); toast.success("Address saved."); } })}
                className="mt-4 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Save address
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "wishlist" && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wishlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your wishlist is empty.</p>
          ) : wishlist.map((item: any) => (
            <div key={item.id} className="rounded-sm border border-border p-4">
              <img src={item.products.image_url} alt={item.products.name} className="aspect-[4/5] w-full object-cover" />
              <p className="mt-3 font-display text-lg">{item.products.name}</p>
              <p className="text-sm text-muted-foreground">{inr(item.products.price)}</p>
              <button
                type="button"
                onClick={() => {
                  addItem(item.products);
                  setCartOpen(true);
                }}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-[0.18em] text-primary-foreground"
              >
                Move to cart
              </button>
            </div>
          ))}
        </section>
      )}

      {tab === "orders" && (isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-sm border border-dashed border-border py-16 text-center">
          <Package className="text-muted-foreground" size={32} />
          <p className="text-sm text-muted-foreground">No orders yet.</p>
          <Link
            to="/shop"
            className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((o: any) => (
            <div key={o.id} className="rounded-sm border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-1 font-display text-lg">Order #{o.id.slice(0, 8)}</p>
                  {o.order_number && (
                    <p className="text-xs text-muted-foreground">{o.order_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display text-lg">{inr(o.total)}</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                    {paymentLabel(o)} · {statusLabel(o.operational_status || o.status)}
                  </p>
                </div>
              </div>
              {(o.tracking_number || o.courier_name || o.estimated_delivery_date || o.tracking_url || o.shipping_status) && (
                <div className="mt-3 rounded-sm border border-border bg-background p-3 text-sm">
                  <p className="inline-flex items-center gap-2 font-medium">
                    <Truck size={14} /> Tracking
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {o.shipping_status && <p>Status: {statusLabel(o.shipping_status)}</p>}
                    {o.courier_name && <p>Courier: {o.courier_name}</p>}
                    {o.tracking_number && <p>Tracking number: {o.tracking_number}</p>}
                    {o.estimated_delivery_date && <p>Estimated delivery: {o.estimated_delivery_date}</p>}
                    {o.dispatch_date && <p>Dispatched: {o.dispatch_date}</p>}
                    {o.delivery_date && <p>Delivered: {o.delivery_date}</p>}
                  </div>
                  {o.tracking_url && (
                    <a
                      href={o.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex rounded-full border border-border px-3 py-1.5 text-xs uppercase tracking-[0.16em] hover:bg-secondary"
                    >
                      Open tracking link
                    </a>
                  )}
                </div>
              )}
              <div className="mt-3 rounded-sm bg-secondary/30 p-3 text-xs text-muted-foreground">
                <p>Created: {new Date(o.created_at).toLocaleString("en-IN")}</p>
                {o.payment_submitted_at && (
                  <p>Payment submitted: {new Date(o.payment_submitted_at).toLocaleString("en-IN")}</p>
                )}
                {o.payment_verified_at && (
                  <p>Payment approved: {new Date(o.payment_verified_at).toLocaleString("en-IN")}</p>
                )}
                {o.payment_expires_at && o.payment_status === "awaiting_payment" && (
                  <p>Payment expires: {new Date(o.payment_expires_at).toLocaleString("en-IN")}</p>
                )}
                {o.payment_rejection_reason && (
                  <p className="text-destructive">Rejection reason: {o.payment_rejection_reason}</p>
                )}
              </div>
              {(() => {
                const timeline = [
                  ...(o.order_events ?? [])
                    .filter((event: any) => event.visible_to_customer)
                    .map((event: any) => ({ ...event, label: event.label })),
                  ...(o.shipment_events ?? [])
                    .filter((event: any) => event.visible_to_customer)
                    .map((event: any) => ({
                      ...event,
                      label: `${statusLabel(event.status)}${event.tracking_number ? ` · ${event.tracking_number}` : ""}`,
                    })),
                ].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                return timeline.length > 0 ? (
                <div className="mt-3 rounded-sm border border-border p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Timeline
                  </p>
                  <div className="mt-3 space-y-2">
                    {timeline.map((event: any) => (
                        <div key={event.id} className="flex gap-3 text-xs">
                          <span className="w-24 shrink-0 text-muted-foreground">
                            {new Date(event.created_at).toLocaleString("en-IN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                          <span>{event.label}</span>
                        </div>
                      ))}
                  </div>
                </div>
                ) : null;
              })()}
              <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                {(o.items as any[]).map((it, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {it.name}
                      {it.variant_label && (
                        <span className="text-muted-foreground"> · {it.variant_label}</span>
                      )}
                      <span className="text-muted-foreground"> × {it.qty}</span>
                    </span>
                    <span>{inr(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => printCustomerInvoice(o, settings)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]"
              >
                <FileText size={13} /> Invoice
              </button>
            </div>
          ))}
        </div>
      ))}

      {tab === "reviews" && <CustomerReviews userId={user?.id} />}
      {tab === "coupons" && <CustomerCoupons />}
      {tab === "gift_cards" && <CustomerGiftCards />}
      {tab === "loyalty" && (
        <section className="mt-6 rounded-sm border border-border p-5">
          <p className="eyebrow">Loyalty points</p>
          <h2 className="mt-2 font-display text-4xl">{loyalty?.points ?? 0}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Lifetime points: {loyalty?.lifetime_points ?? 0}</p>
        </section>
      )}
      {tab === "notifications" && (
        <section className="mt-6 space-y-3">
          {notifications.length === 0 ? <p className="text-sm text-muted-foreground">No notifications yet.</p> : notifications.map((n: any) => (
            <div key={n.id} className="rounded-sm border border-border p-4">
              <p className="font-medium">{n.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </section>
      )}
      {tab === "security" && (
        <section className="mt-6 max-w-xl rounded-sm border border-border p-5">
          <h2 className="font-display text-2xl">Security</h2>
          <div className="mt-5 rounded-sm border border-border p-4">
            <p className="text-sm font-medium">Email preferences</p>
            <div className="mt-3 grid gap-2 text-sm">
              {[
                ["order_emails", "Order emails"],
                ["marketing_emails", "Marketing emails"],
                ["newsletter", "Newsletter"],
                ["offers", "Offers"],
                ["review_requests", "Review requests"],
                ["product_updates", "Product updates"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(emailPreferences?.[key] ?? ["order_emails", "review_requests"].includes(key))}
                    onChange={(e) =>
                      saveEmailPreferences.mutate({
                        order_emails: emailPreferences?.order_emails ?? true,
                        marketing_emails: emailPreferences?.marketing_emails ?? false,
                        newsletter: emailPreferences?.newsletter ?? false,
                        offers: emailPreferences?.offers ?? false,
                        review_requests: emailPreferences?.review_requests ?? true,
                        product_updates: emailPreferences?.product_updates ?? false,
                        [key]: e.target.checked,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" checked disabled />
                Security emails are always enabled.
              </label>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Password changes are handled by your sign-in provider. You can request account deletion here.</p>
          <button
            type="button"
            onClick={() => saveProfile.mutate({ delete_requested_at: new Date().toISOString() }, { onSuccess: () => toast.success("Delete request saved.") })}
            className="mt-5 rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-destructive"
          >
            Request account deletion
          </button>
        </section>
      )}
    </section>
  );
}

function CustomerReviews({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: reviews = [] } = useQuery({
    queryKey: ["my-reviews", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reviews")
        .select("*, products(name, slug)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const updateReview = async (review: any) => {
    const title = prompt("Review title", review.title || "");
    if (title === null) return;
    const body = prompt("Review", review.body || "");
    if (body === null || !body.trim()) return;
    const rating = Number(prompt("Rating 1-5", String(review.rating || 5)) || review.rating || 5);
    const { error } = await (supabase as any)
      .from("reviews")
      .update({
        title: title.trim(),
        body: body.trim(),
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        approved: false,
        status: "pending",
      })
      .eq("id", review.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-reviews", userId] });
    toast.success("Review updated for moderation.");
  };
  const deleteReview = async (review: any) => {
    if (!confirm("Delete this review?")) return;
    const { error } = await (supabase as any)
      .from("reviews")
      .delete()
      .eq("id", review.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-reviews", userId] });
    toast.success("Review deleted.");
  };
  return (
    <section className="mt-6 space-y-3">
      {reviews.length === 0 ? <p className="text-sm text-muted-foreground">No reviews yet.</p> : reviews.map((review: any) => (
        <div key={review.id} className="rounded-sm border border-border p-4">
          <p className="font-medium">{review.products?.name || "Product"} · {review.rating}/5</p>
          <p className="mt-1 text-sm">{review.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{review.status || (review.approved ? "approved" : "pending")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => updateReview(review)} className="rounded-full border border-border px-3 py-1.5 text-xs">Edit</button>
            <button onClick={() => deleteReview(review)} className="rounded-full border border-border px-3 py-1.5 text-xs text-destructive">Delete</button>
          </div>
        </div>
      ))}
    </section>
  );
}

function CustomerCoupons() {
  const { data: coupons = [] } = useQuery({
    queryKey: ["active-coupons"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("coupons")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-2">
      {coupons.length === 0 ? <p className="text-sm text-muted-foreground">No active coupons right now.</p> : coupons.map((coupon: any) => (
        <div key={coupon.id} className="rounded-sm border border-border p-4">
          <p className="font-display text-xl">{coupon.code}</p>
          <p className="mt-1 text-sm text-muted-foreground">{coupon.description || "Available at checkout"}</p>
        </div>
      ))}
    </section>
  );
}

function CustomerGiftCards() {
  return (
    <section className="mt-6 rounded-sm border border-border p-5">
      <h2 className="font-display text-2xl">Gift cards</h2>
      <p className="mt-2 text-sm text-muted-foreground">Gift card redemption support is prepared in the database and will appear here when a gift card is assigned to your account.</p>
    </section>
  );
}

function statusLabel(value?: string | null) {
  return String(value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function printCustomerInvoice(order: any, settings: any) {
  const rows = (order.items as any[])
    .map(
      (item) =>
        `<tr><td>${item.name}${item.variant_label ? ` (${item.variant_label})` : ""}</td><td>${item.qty}</td><td>${inr(item.price)}</td><td>${inr(item.price * item.qty)}</td></tr>`,
    )
    .join("");
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>Invoice ${order.order_number || order.id}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#222} table{width:100%;border-collapse:collapse;margin-top:20px} td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}.muted{color:#666;font-size:12px}</style>
    </head><body>
    ${settings?.logo_url ? `<img src="${settings.logo_url}" style="max-height:80px;max-width:220px"/>` : ""}
    <h1>Invoice</h1>
    <p class="muted">${settings?.business_name || "Superb Creations"}<br/>${settings?.address || ""}<br/>${settings?.contact_email || ""}</p>
    <h2>${order.order_number || order.id}</h2>
    <p><strong>Customer:</strong> ${order.customer_name}<br/><strong>Phone:</strong> ${order.phone}<br/><strong>Address:</strong> ${order.address}</p>
    <table><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    <h2 class="right">Total: ${inr(order.total)}</h2><p>Payment: ${order.payment_method}</p>
    </body></html>`);
  win.document.close();
  win.print();
}
