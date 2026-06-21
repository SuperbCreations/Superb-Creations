import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product, Variant } from "@/lib/products";
import { effectivePrice, variantLabel } from "@/lib/products";

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
const STORAGE_KEY = "sc_cart_v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
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
      addItem: (product, variant = null, qty = 1) =>
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
              image_url: product.image_url,
              qty,
            },
          ];
        }),
      removeItem: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
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
