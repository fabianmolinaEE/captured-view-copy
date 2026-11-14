import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Star,
} from "lucide-react";
import type { Category } from "@/lib/research/types";

type Screen =
  | "delivery_menu"
  | "delivery_item"
  | "delivery_basket"
  | "delivery_address"
  | "delivery_confirmation";
type Props = {
  enabled: Category[];
  onScreen: (screen: Screen) => void;
  log: (
    type: string,
    target?: string,
    metadata?: Record<string, string | number | boolean>,
  ) => void;
};
const items = [
  {
    id: "garden_pizza",
    name: "Roasted Garden Vegetable & Whipped Ricotta Pizza",
    short: "The garden party",
    description: "Roasted peppers, zucchini, basil and whipped ricotta on a slow-fermented crust.",
    price: 16,
    kind: "pizza",
  },
  {
    id: "harvest_bowl",
    name: "Warm Harvest Bowl with Lemon Tahini & Crispy Chickpeas",
    short: "A bowl of good things",
    description: "Roasted vegetables, herby grains, crispy chickpeas and lemon tahini.",
    price: 14,
    kind: "bowl",
  },
] as const;
const addresses = [
  "1847 West Meadowbrook Terrace, Building C, Apartment 1208",
  "92 Example Lane, Apartment 204",
];

/** Original, local vector artwork keeps the demo independent of third-party image services. */
function FoodArt({ kind }: { kind: "pizza" | "bowl" }) {
  return (
    <svg
      viewBox="0 0 320 175"
      role="img"
      aria-label={
        kind === "pizza"
          ? "Vegetable pizza with basil and ricotta"
          : "Harvest bowl with vegetables and chickpeas"
      }
    >
      <rect width="320" height="175" fill={kind === "pizza" ? "#e7cdaa" : "#d4dfc7"} />
      <ellipse cx="166" cy="147" rx="108" ry="16" fill="#34261b" opacity=".12" />
      <ellipse cx="160" cy="88" rx="107" ry="76" fill="#fffaf0" />
      <ellipse cx="160" cy="85" rx="91" ry="63" fill={kind === "pizza" ? "#d9a34c" : "#83955d"} />
      <ellipse cx="160" cy="83" rx="80" ry="53" fill={kind === "pizza" ? "#eed38d" : "#c4bd80"} />
      {[
        [-47, -11],
        [32, -24],
        [-12, 28],
        [48, 17],
      ].map(([x, y], i) => (
        <ellipse
          key={i}
          cx={160 + x!}
          cy={83 + y!}
          rx="16"
          ry="9"
          fill={kind === "pizza" ? "#ba4a31" : "#c8753e"}
          transform={`rotate(${i * 32} ${160 + x!} ${83 + y!})`}
        />
      ))}
      {[
        [-19, -23],
        [20, 10],
        [-45, 20],
        [50, -8],
        [0, 0],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${160 + x!} ${83 + y!}) rotate(${i * 53})`}>
          <ellipse rx="11" ry="5" fill="#497443" />
          <path d="M-8 0H8" stroke="#83a263" />
        </g>
      ))}
      {[
        [-36, -30],
        [2, 30],
        [38, 1],
        [6, -8],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={160 + x!}
          cy={83 + y!}
          r={kind === "pizza" ? 7 : 5}
          fill={kind === "pizza" ? "#fff7d9" : "#e8c276"}
        />
      ))}
      <path d="M267 26l16 32M279 20l16 32" stroke="#fff6e7" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function FoodDeliveryDemo({ enabled, onScreen, log }: Props) {
  const [screen, setScreen] = useState<Screen>("delivery_menu");
  const [selected, setSelected] = useState(0);
  const [size, setSize] = useState("Regular");
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState(0);
  const [hasItem, setHasItem] = useState(false);
  const item = items[selected]!;
  const clipped = enabled.includes("text_clipping");
  const price = item.price + (size === "Large" ? 6 : 0);
  const go = (next: Screen, target: string, back = false) => {
    log(back ? "backtrack" : "button_click", target);
    setScreen(next);
    onScreen(next);
    log("screen_view", next);
  };
  const openItem = (index: number) => {
    if (index !== selected) {
      setSize("Regular");
      setQuantity(1);
    }
    setSelected(index);
    go("delivery_item", `open_${items[index]!.id}`);
  };
  const art = (index: number) =>
    enabled.includes("dead_click") ? (
      <div className="food-art" data-target={`${items[index]!.id}_image`}>
        <FoodArt kind={items[index]!.kind} />
      </div>
    ) : (
      <button
        className="food-art"
        aria-label={`View ${items[index]!.name}`}
        data-target={`${items[index]!.id}_image`}
        onClick={() => openItem(index)}
      >
        <FoodArt kind={items[index]!.kind} />
      </button>
    );
  return (
    <div className="delivery-demo">
      <header className="delivery-header">
        {screen === "delivery_menu" ? (
          <span className="delivery-wordmark">
            miso<span>✳</span>
          </span>
        ) : (
          <button
            aria-label="Back"
            onClick={() =>
              go(
                screen === "delivery_address"
                  ? "delivery_basket"
                  : screen === "delivery_basket"
                    ? "delivery_item"
                    : "delivery_menu",
                "back",
                true,
              )
            }
          >
            <ArrowLeft size={19} />
          </button>
        )}
        <span>
          {screen === "delivery_menu"
            ? "Good food. Good mood."
            : screen === "delivery_item"
              ? "Make it yours"
              : screen === "delivery_address"
                ? "Delivery details"
                : screen === "delivery_confirmation"
                  ? "Order confirmed"
                  : "Your basket"}
        </span>
        <button
          aria-label="Open basket"
          data-target="open_basket"
          onClick={() =>
            hasItem ? go("delivery_basket", "open_basket") : go("delivery_menu", "empty_basket")
          }
        >
          <ShoppingBag size={19} />
          {hasItem && <small>{quantity}</small>}
        </button>
      </header>
      {screen === "delivery_menu" ? (
        <>
          <div className="delivery-intro">
            <span className="delivery-kicker">A LITTLE LOCAL LOVE</span>
            <h2>
              Your next
              <br />
              happy bite.
            </h2>
            <p>Fresh favorites from around the corner.</p>
            <div className="delivery-location">
              <MapPin size={13} /> Delivering to Example neighborhood <ChevronDown size={12} />
            </div>
          </div>
          {enabled.includes("dead_click") ? (
            <div className="delivery-offer" data-target="offer_banner">
              <span>Something delicious awaits</span>
              <strong>
                Meet your new favorites <ArrowRight size={16} />
              </strong>
            </div>
          ) : (
            <button
              className="delivery-offer"
              data-target="offer_banner"
              onClick={() => openItem(0)}
            >
              <span>Something delicious awaits</span>
              <strong>
                Meet your new favorites <ArrowRight size={16} />
              </strong>
            </button>
          )}
          <div className="delivery-section-title">
            <h3>Little Green Kitchen</h3>
            <span>
              <Star size={11} fill="currentColor" /> 4.8 · Demo
            </span>
          </div>
          <div className="delivery-meta">Vegetarian comfort food · 20–30 min · $2 delivery</div>
          <div className="delivery-menu">
            {items.map((food, index) => (
              <article className="delivery-food-card" key={food.id}>
                {art(index)}
                <div className="delivery-food-copy">
                  <span className="delivery-kicker">{food.short}</span>
                  <h3>{food.name}</h3>
                  <div>
                    <strong>${food.price.toFixed(2)}</strong>
                    <button data-target={`${food.id}_details`} onClick={() => openItem(index)}>
                      View item <Plus size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : screen === "delivery_item" ? (
        <>
          <div className="food-art delivery-detail-art">
            <FoodArt kind={item.kind} />
          </div>
          <section className="delivery-body">
            <span className="delivery-kicker">LITTLE GREEN KITCHEN</span>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <fieldset>
              <legend>Choose your size</legend>
              {["Regular", "Large"].map((option) => (
                <label className="delivery-option" key={option}>
                  <input
                    type="radio"
                    name="portion"
                    checked={size === option}
                    onChange={() => {
                      setSize(option);
                      log("selection_change", "portion_size", { changed: true });
                    }}
                  />
                  <span>
                    <strong>{option}</strong>
                    <small>
                      {option === "Large"
                        ? "Serves 2 · ideal for sharing"
                        : "Serves 1 · a meal for one"}
                    </small>
                  </span>
                  <strong>{option === "Large" ? "+$6" : "Included"}</strong>
                </label>
              ))}
            </fieldset>
            <div className="delivery-quantity">
              <span>Quantity</span>
              <div>
                <button
                  aria-label="Decrease quantity"
                  disabled={quantity === 1}
                  onClick={() => {
                    setQuantity((n) => Math.max(1, n - 1));
                    log("button_click", "decrease_quantity");
                  }}
                >
                  <Minus size={14} />
                </button>
                <strong>{quantity}</strong>
                <button
                  aria-label="Increase quantity"
                  onClick={() => {
                    setQuantity((n) => n + 1);
                    log("button_click", "increase_quantity");
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <button
              className="delivery-primary"
              data-target="add_to_basket"
              onClick={() => {
                setHasItem(true);
                go("delivery_basket", "add_to_basket");
              }}
            >
              {" "}
              {hasItem ? "Update basket" : "Add to basket"}
              <span>${(price * quantity).toFixed(2)}</span>
            </button>
          </section>
        </>
      ) : screen === "delivery_basket" ? (
        <section className="delivery-body">
          <span className="delivery-kicker">A GOOD CHOICE</span>
          <h2>Almost at your door.</h2>
          <p>One last look before we get cooking.</p>
          <div className="delivery-basket-item">
            <div className="food-art">
              <FoodArt kind={item.kind} />
            </div>
            <div className="delivery-basket-copy">
              <strong className={clipped ? "delivery-truncate" : ""}>{item.name}</strong>
              {!enabled.includes("missing_context") && (
                <small>
                  {size} · Serves {size === "Large" ? 2 : 1}
                </small>
              )}
              <small>
                Quantity {quantity} · ${(price * quantity).toFixed(2)}
              </small>
              <button
                data-target="edit_item"
                onClick={() => go("delivery_item", "edit_item", true)}
              >
                Edit item
              </button>
            </div>
          </div>
          <div className="delivery-address">
            <MapPin size={18} />
            <div>
              <strong>Deliver to</strong>
              <span className={clipped ? "delivery-truncate" : ""}>{addresses[address]}</span>
              <small>Alex Example · Contactless delivery</small>
            </div>
            <button
              aria-label="Edit delivery address"
              data-target="edit_address"
              onClick={() => go("delivery_address", "edit_address")}
            >
              Edit
            </button>
          </div>
          <div className="delivery-totals">
            <div>
              <span>Subtotal</span>
              <span>${(price * quantity).toFixed(2)}</span>
            </div>
            <div>
              <span>Delivery</span>
              <span>$2.00</span>
            </div>
            <div>
              <strong>Total</strong>
              <strong>${(price * quantity + 2).toFixed(2)}</strong>
            </div>
          </div>
          <button
            className="delivery-primary"
            data-target="place_order"
            onClick={() => {
              log("submit_attempt", "place_order");
              go("delivery_confirmation", "order_complete");
            }}
          >
            Place demo order
            <ArrowRight size={17} />
          </button>
          <p className="delivery-disclaimer">Fictional restaurant. No payment or real delivery.</p>
        </section>
      ) : screen === "delivery_address" ? (
        <section className="delivery-body">
          <span className="delivery-kicker">DELIVERY DETAILS</span>
          <h2>The right doorstep.</h2>
          <p>Choose a synthetic address for this demo.</p>
          <fieldset>
            <legend>Saved addresses</legend>
            {addresses.map((value, index) => (
              <label className="delivery-option" key={value}>
                <input
                  type="radio"
                  name="saved-address"
                  checked={address === index}
                  onChange={() => {
                    setAddress(index);
                    log("selection_change", "saved_address", { changed: true });
                  }}
                />
                <span>{value}</span>
              </label>
            ))}
          </fieldset>
          <button
            className="delivery-primary"
            data-target="save_address"
            onClick={() => go("delivery_basket", "save_address")}
          >
            Use this address
            <Check size={17} />
          </button>
        </section>
      ) : (
        <section className="delivery-body delivery-thanks">
          <div>
            <Check size={30} />
          </div>
          <span className="delivery-kicker">GOOD FOOD IS ON THE WAY</span>
          <h2>
            You've got
            <br />
            great taste.
          </h2>
          <p>Your demo order is complete. Nothing has been charged or sent to a restaurant.</p>
          <button
            className="delivery-primary"
            onClick={() => {
              setHasItem(false);
              go("delivery_menu", "return_to_menu");
            }}
          >
            Back to the menu
            <ArrowRight size={17} />
          </button>
        </section>
      )}
      <footer className="delivery-footer">miso · A fictional food-delivery demo</footer>
    </div>
  );
}
