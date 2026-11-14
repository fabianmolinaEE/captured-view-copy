import { isCompetitorSession } from "./competitors";
import { UBER_EATS_SOURCE } from "./publicVideo";
import { demoSources } from "./types";

export const products = [
  {
    id: "uber-eats",
    name: "Uber Eats",
    description: "Food ordering, checkout and delivery",
    source: UBER_EATS_SOURCE,
  },
  {
    id: "checkout",
    name: "Bag Checkout App",
    description: "Carry · Product discovery and bag checkout",
    source: demoSources.checkout,
  },
] as const;
export type ProductId = (typeof products)[number]["id"];
export function isProductId(value: unknown): value is ProductId {
  return products.some((product) => product.id === value);
}
export function productForSource(source: string | null | undefined) {
  if (source === "Carry checkout") return products.find((product) => product.id === "checkout"); // Historical recordings need no migration.
  return products.find((product) => product.source === source);
}
type Scoped = {
  source_app?: string | null;
  public_video?: { competitor_of?: unknown } | undefined;
};
/** Own-product sessions only: competitor footage (Explorer) never counts toward a product. */
export function sessionsForProduct<T extends Scoped>(sessions: T[], id: ProductId | null): T[] {
  return id
    ? sessions.filter(
        (session) =>
          productForSource(session.source_app)?.id === id &&
          !isCompetitorSession({
            source_app: session.source_app ?? "",
            public_video: session.public_video,
          }),
      )
    : [];
}
/** Archived recordings (e.g. the retired Miso fixture): no product and not competitor footage. */
export function isArchivedSession(session: Scoped) {
  return (
    !productForSource(session.source_app) &&
    !isCompetitorSession({
      source_app: session.source_app ?? "",
      public_video: session.public_video,
    })
  );
}
export function productNameForSource(source: string) {
  return source === demoSources.delivery
    ? "Archived delivery app"
    : (productForSource(source)?.name ?? source);
}
