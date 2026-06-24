import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/products";

export function CartSheet() {
  const { items, isOpen, setOpen, setQty, removeItem, subtotal, count } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">
            Your bag {count > 0 && <span className="text-muted-foreground">({count})</span>}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag className="text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">Your bag is empty.</p>
            <Link
              to="/shop"
              onClick={() => setOpen(false)}
              className="rounded-full bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-primary-foreground"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto py-2">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-secondary">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <p className="font-display text-base leading-snug">{item.name}</p>
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label="Remove"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {item.variant_label && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.variant_label}</p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">{inr(item.price)}</p>
                    <div className="mt-auto flex items-center gap-2">
                      <button
                        onClick={() => setQty(item.id, item.qty - 1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border"
                        aria-label="Decrease"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm">{item.qty}</span>
                      <button
                        onClick={() => setQty(item.id, item.qty + 1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border"
                        aria-label="Increase"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <SheetFooter className="border-t border-border pt-4">
              <div className="w-full space-y-3">
                <div className="flex justify-between font-display text-lg">
                  <span>Subtotal</span>
                  <span>{inr(subtotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shipping & taxes calculated at checkout.
                </p>
                <Link
                  to="/checkout"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-full bg-primary py-3 text-center text-xs uppercase tracking-[0.22em] text-primary-foreground"
                >
                  Checkout
                </Link>
                <Link
                  to="/cart"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-full border border-border py-3 text-center text-xs uppercase tracking-[0.22em]"
                >
                  View bag
                </Link>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
