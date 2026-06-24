import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Product, Variant } from "@/lib/products";
import { effectivePrice, variantLabel } from "@/lib/products";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";

export type CartItem = {
  /** Unique cart key: `${product_id}::${variant_id ?? 'base'}` */
  id: string;
  product_id: string;
  variant_id: string | null;
  variant_label: string | null;
  slug: string;
  name: string;
  price: number;
  image_url: string;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, variant?: Variant | null, qty?: number) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const GUEST_STORAGE_KEY = "sc_cart_v2:guest";
const legacyStorageKey = "sc_cart_v2";

const cartStorageKey = (userId?: string) =>
  userId ? `sc_cart_v2:user:${userId}` : GUEST_STORAGE_KEY;

const readCart = (key: string): CartItem[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeCart = (key: string, items: CartItem[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* ignore */
  }
};

const mergeCartItems = (base: CartItem[], incoming: CartItem[]) => {
  const merged = new Map<string, CartItem>();
  for (const item of [...base, ...incoming]) {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? { ...existing, qty: existing.qty + item.qty } : item);
  }
  return [...merged.values()];
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const storageKeyRef = useRef(GUEST_STORAGE_KEY);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    const nextKey = cartStorageKey(user?.id);
    const legacyItems = readCart(legacyStorageKey);
    const guestItems = readCart(GUEST_STORAGE_KEY);
    const nextItems = readCart(nextKey);
    let resolved = nextItems;

    if (legacyItems.length > 0) {
      resolved = mergeCartItems(resolved, legacyItems);
      localStorage.removeItem(legacyStorageKey);
    }

    if (user?.id && guestItems.length > 0) {
      resolved = mergeCartItems(resolved, guestItems);
      localStorage.removeItem(GUEST_STORAGE_KEY);
    }

    storageKeyRef.current = nextKey;
    loadedRef.current = true;
    setItems(resolved);
    writeCart(nextKey, resolved);
  }, [loading, user?.id]);

  useEffect(() => {
    if (!loadedRef.current) return;
    writeCart(storageKeyRef.current, items);
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    return {
      items,
      count,
      subtotal,
      isOpen,
      setOpen,
      addItem: (product, variant = null, qty = 1) => {
        const availableStock = variant ? variant.stock : product.stock;
        if (!product.in_stock || product.active === false || availableStock <= 0 || variant?.active === false) {
          return;
        }
        trackAnalyticsEvent({
          eventType: "add_to_cart",
          productId: product.id,
          metadata: { qty, variant: variant ? variantLabel(variant) : "base" },
        });
        setItems((prev) => {
          const key = `${product.id}::${variant?.id ?? "base"}`;
          const found = prev.find((i) => i.id === key);
          if (found) {
            return prev.map((i) =>
              i.id === key ? { ...i, qty: i.qty + qty } : i,
            );
          }
          return [
            ...prev,
            {
              id: key,
              product_id: product.id,
              variant_id: variant?.id ?? null,
              variant_label: variant ? variantLabel(variant) : null,
              slug: product.slug,
              name: product.name,
              price: effectivePrice(product, variant),
              image_url: product.cover_image_url || product.image_url || "",
              qty,
            },
          ];
        });
      },
      removeItem: (id) =>
        setItems((prev) => {
          const item = prev.find((i) => i.id === id);
          if (item) {
            trackAnalyticsEvent({
              eventType: "remove_from_cart",
              productId: item.product_id,
              metadata: { qty: item.qty },
            });
          }
          return prev.filter((i) => i.id !== id);
        }),
      setQty: (id, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.id !== id)
            : prev.map((i) => (i.id === id ? { ...i, qty } : i)),
        ),
      clear: () => setItems([]),
    };
  }, [items, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
