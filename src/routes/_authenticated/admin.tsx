import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  LogOut,
  Upload,
  X,
  Layers,
  Eye,
  EyeOff,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, inr, type Product, type Variant } from "@/lib/products";
import { confirmManualOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Superb Creations" }] }),
  component: AdminPage,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Draft = {
  id?: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  description: string;
  image_url: string;
  tag: string;
  in_stock: boolean;
  stock: number;
  sort_order: number;
};

const emptyDraft = (): Draft => ({
  name: "",
  slug: "",
  category: CATEGORIES[0],
  price: 0,
  description: "",
  image_url: "",
  tag: "",
  in_stock: true,
  stock: 0,
  sort_order: 0,
});

function AdminPage() {
  const { isAdmin, loading, signOut, user } = useAuth();
  const [tab, setTab] = useState<"products" | "orders" | "reviews">("products");

  if (loading) {
    return (
      <div className="container-boutique flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-boutique flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-3xl">Restricted area</h1>
        <p className="max-w-md text-muted-foreground">
          This area is for the store owner only. You're signed in as{" "}
          <span className="font-medium">{user?.email}</span>, which doesn't have admin access.
        </p>
        <button
          onClick={signOut}
          className="rounded-full border border-border px-6 py-2.5 text-xs uppercase tracking-[0.2em]"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <section className="container-boutique py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Owner dashboard</p>
          <h1 className="mt-2 font-display text-4xl">Manage store</h1>
        </div>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <div className="mt-8 flex gap-2 border-b border-border">
        {(["products", "orders", "reviews"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-4 py-2.5 text-sm capitalize transition-colors " +
              (tab === t
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsAdmin />}
      {tab === "orders" && <OrdersAdmin />}
      {tab === "reviews" && <ReviewsAdmin />}
    </section>
  );
}

function ProductsAdmin() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: d.name,
        slug: d.slug || slugify(d.name),
        category: d.category,
        price: Math.round(d.price),
        description: d.description,
        image_url: d.image_url,
        tag: d.tag || null,
        in_stock: d.in_stock,
        stock: Math.max(0, Math.round(d.stock || 0)),
        sort_order: d.sort_order,
      };
      if (d.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setDraft(null);
      toast.success("Product saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete."),
  });

  const handleUpload = async (file: File) => {
    if (!draft) return;
    setUploading(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be 5MB or smaller.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setDraft({ ...draft, image_url: data.publicUrl });
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-end">
        <button
          onClick={() => setDraft(emptyDraft())}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          <Plus size={14} /> Add product
        </button>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-sm border border-border">
              <div className="aspect-[4/3] bg-secondary">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {p.category} {!p.in_stock && "· Sold out"}
                </p>
                <h3 className="mt-1 font-display text-lg">{p.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {inr(p.price)} · Stock: {p.stock}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setDraft({ ...p, tag: p.tag ?? "", description: p.description ?? "" })
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => setVariantsFor(p)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    <Layers size={13} /> Variants
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"?`)) remove.mutate(p.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
          <div className="my-8 w-full max-w-lg rounded-sm border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{draft.id ? "Edit product" : "New product"}</h2>
              <button onClick={() => setDraft(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Name">
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      name: e.target.value,
                      slug: draft.id ? draft.slug : slugify(e.target.value),
                    })
                  }
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <select
                    className={inputCls}
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Price (₹)">
                  <input
                    type="number"
                    className={inputCls}
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Tag (e.g. New)">
                  <input
                    className={inputCls}
                    value={draft.tag}
                    onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                  />
                </Field>
                <Field label="Stock count (base — ignored if variants exist)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={draft.stock}
                    onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Display order">
                  <input
                    type="number"
                    className={inputCls}
                    value={draft.sort_order}
                    onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                  />
                </Field>

              <Field label="Product photo">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-secondary">
                    {draft.image_url && (
                      <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                    />
                  </label>
                </div>
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.in_stock}
                  onChange={(e) => setDraft({ ...draft, in_stock: e.target.checked })}
                />
                Listed in shop (untick to hide as sold out)
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDraft(null)}
                className="rounded-full border border-border px-5 py-2.5 text-xs uppercase tracking-[0.2em]"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending || !draft.name}
                onClick={() => save.mutate(draft)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
              >
                {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {variantsFor && (
        <VariantsEditor product={variantsFor} onClose={() => setVariantsFor(null)} />
      )}
    </div>
  );
}

function OrdersAdmin() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const confirmManualOrderFn = useServerFn(confirmManualOrder);
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const confirmManual = useMutation({
    mutationFn: async (orderId: string) => {
      if (!session?.access_token) throw new Error("Please sign in again.");
      await confirmManualOrderFn({
        data: { orderId, accessToken: session.access_token },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Order confirmed and stock updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not confirm order."),
  });

  if (isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;
  if (orders.length === 0)
    return <p className="mt-8 text-sm text-muted-foreground">No orders yet.</p>;

  return (
    <div className="mt-6 space-y-4">
      {orders.map((o: any) => (
        <div key={o.id} className="rounded-sm border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg">{o.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                {o.phone} {o.email && `· ${o.email}`}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg">{inr(o.total)}</p>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                {o.payment_method} · {o.payment_status} · {o.status}
              </p>
              {o.payment_method !== "razorpay" && !o.stock_deducted_at && (
                <button
                  disabled={confirmManual.isPending}
                  onClick={() => confirmManual.mutate(o.id)}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs"
                >
                  {confirmManual.isPending && <Loader2 size={12} className="animate-spin" />}
                  Confirm order
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{o.address}</p>
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            {(o.items as any[]).map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {it.name} × {it.qty}
                </span>
                <span>{inr(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {new Date(o.created_at).toLocaleString("en-IN")}
          </p>
        </div>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// =====================================================================
// VARIANT EDITOR
// =====================================================================

type VariantDraft = {
  id?: string;
  size: string;
  color: string;
  color_hex: string;
  price: string; // optional override, blank = use product price
  stock: number;
  sort_order: number;
};

const emptyVariantDraft = (): VariantDraft => ({
  size: "",
  color: "",
  color_hex: "",
  price: "",
  stock: 0,
  sort_order: 0,
});

function VariantsEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["admin-variants", product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product.id)
        .order("sort_order")
        .order("size");
      if (error) throw error;
      return (data ?? []) as Variant[];
    },
  });

  const [draft, setDraft] = useState<VariantDraft | null>(null);

  const save = useMutation({
    mutationFn: async (d: VariantDraft) => {
      const payload = {
        product_id: product.id,
        size: d.size.trim(),
        color: d.color.trim(),
        color_hex: d.color_hex.trim() || null,
        price: d.price.trim() === "" ? null : Math.max(0, Math.round(Number(d.price))),
        stock: Math.max(0, Math.round(d.stock || 0)),
        sort_order: d.sort_order,
      };
      if (d.id) {
        const { error } = await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_variants").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-variants", product.id] });
      qc.invalidateQueries({ queryKey: ["variants", product.id] });
      setDraft(null);
      toast.success("Variant saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-variants", product.id] });
      qc.invalidateQueries({ queryKey: ["variants", product.id] });
      toast.success("Variant removed.");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-sm border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Variants</p>
            <h2 className="mt-1 font-display text-2xl">{product.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => setDraft(emptyVariantDraft())}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            <Plus size={13} /> Add variant
          </button>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : variants.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No variants yet. Use "Add variant" to add sizes and colours; or leave empty to keep
            this as a single-option product (uses base stock).
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="py-2">Size</th>
                  <th className="py-2">Colour</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Stock</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-border/50">
                    <td className="py-2">{v.size || "—"}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2">
                        {v.color_hex && (
                          <span
                            className="inline-block h-4 w-4 rounded-full border border-border"
                            style={{ backgroundColor: v.color_hex }}
                          />
                        )}
                        {v.color || "—"}
                      </span>
                    </td>
                    <td className="py-2">{v.price != null ? inr(v.price) : "—"}</td>
                    <td className={"py-2 " + (v.stock <= 5 ? "text-primary" : "")}>{v.stock}</td>
                    <td className="flex justify-end gap-2 py-2">
                      <button
                        onClick={() =>
                          setDraft({
                            id: v.id,
                            size: v.size,
                            color: v.color,
                            color_hex: v.color_hex ?? "",
                            price: v.price != null ? String(v.price) : "",
                            stock: v.stock,
                            sort_order: v.sort_order,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remove this variant?")) remove.mutate(v.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-destructive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {draft && (
          <div className="mt-6 rounded-sm border border-border bg-secondary/30 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Size (e.g. S, M, L, Free Size)">
                <input
                  className={inputCls}
                  value={draft.size}
                  onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                />
              </Field>
              <Field label="Colour name">
                <input
                  className={inputCls}
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                />
              </Field>
              <Field label="Colour hex (#RRGGBB, optional)">
                <input
                  className={inputCls}
                  placeholder="#a3b18a"
                  value={draft.color_hex}
                  onChange={(e) => setDraft({ ...draft, color_hex: e.target.value })}
                />
              </Field>
              <Field label="Price override (₹, blank = base price)">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
              </Field>
              <Field label="Stock">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
                />
              </Field>
              <Field label="Order">
                <input
                  className={inputCls}
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDraft(null)}
                className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-[0.2em]"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending || (!draft.size && !draft.color)}
                onClick={() => save.mutate(draft)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-60"
              >
                {save.isPending && <Loader2 size={13} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// REVIEWS MODERATION
// =====================================================================

function ReviewsAdmin() {
  const qc = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, products(name, slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from("reviews")
        .update({ approved })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["ratings-summary"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["ratings-summary"] });
      toast.success("Review removed.");
    },
  });

  if (isLoading) return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;
  if (reviews.length === 0)
    return <p className="mt-8 text-sm text-muted-foreground">No reviews yet.</p>;

  return (
    <div className="mt-6 space-y-4">
      {reviews.map((r: any) => (
        <div key={r.id} className="rounded-sm border border-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {r.author_name || "Customer"}{" "}
                <span className="text-xs text-muted-foreground">
                  · {r.products?.name ?? "Product removed"}
                </span>
              </p>
              <div className="mt-1 inline-flex items-center gap-1 text-xs">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggle.mutate({ id: r.id, approved: !r.approved })}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                {r.approved ? <EyeOff size={12} /> : <Eye size={12} />}
                {r.approved ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this review?")) remove.mutate(r.id);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          {r.title && <p className="mt-2 font-display text-lg">{r.title}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
            {new Date(r.created_at).toLocaleString("en-IN")}
            {!r.approved && " · Hidden"}
          </p>
        </div>
      ))}
    </div>
  );
}
