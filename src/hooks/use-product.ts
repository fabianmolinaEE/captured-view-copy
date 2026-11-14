import { useEffect, useSyncExternalStore } from "react";
import { competitorProductOf } from "@/lib/research/competitors";
import { isProductId, productForSource, products, type ProductId } from "@/lib/research/products";
import type { Session } from "@/lib/research/types";

const key = "loopmate-product";
const change = "loopmate-product-change";
let memory: ProductId | null = null;
function snapshot(): ProductId | null {
  try {
    const value = window.sessionStorage.getItem(key);
    return isProductId(value) ? value : null;
  } catch {
    return memory;
  }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.storageArea && event.storageArea !== window.sessionStorage) return;
    if (event.key === key || event.key === null) notify();
  };
  window.addEventListener(change, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(change, notify);
    window.removeEventListener("storage", storage);
  };
}
export function selectProduct(id: ProductId | null) {
  memory = id;
  try {
    if (id) window.sessionStorage.setItem(key, id);
    else window.sessionStorage.removeItem(key);
  } catch {
    /* The selection remains usable for this browser session. */
  }
  window.dispatchEvent(new Event(change));
}
export function useProduct() {
  const productId = useSyncExternalStore(subscribe, snapshot, () => null);
  return { productId, product: products.find((p) => p.id === productId), selectProduct };
}
/** The product a recording belongs to: its own product, or the product competitor footage is compared with. */
export function evidenceProductOf(
  session: Pick<Session, "source_app" | "public_video"> | undefined,
): ProductId | undefined {
  if (!session) return undefined;
  return (
    productForSource(session.source_app)?.id ?? competitorProductOf(session as Session) ?? undefined
  );
}
/** An explicit evidence deep link adopts its product before rendering detail data. */
export function useEvidenceProduct(
  session:
    (Pick<Session, "id" | "source_app"> & Partial<Pick<Session, "public_video">>) | undefined,
) {
  const { productId } = useProduct();
  const target = evidenceProductOf(session);
  const sessionId = session?.id;
  useEffect(() => {
    if (target) selectProduct(target);
  }, [target, sessionId]);
  return !!target && target === productId;
}
