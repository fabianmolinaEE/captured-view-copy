import { UberEatsSetup } from "./UberEatsSources";
import { useProduct } from "@/hooks/use-product";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Circle,
  Square,
  ShieldCheck,
  Info,
  X,
  Wifi,
  BatteryFull,
  Package,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell, PageHeading } from "./Shell";
import { CaptureController, captureSupport, type CaptureState } from "@/lib/research/capture";
import { saveSession, downloadFile } from "@/lib/research/sessionStorage";
import { watchCaptureViewport } from "@/lib/research/captureViewport";
import {
  scenarios,
  deliveryScenarios,
  demoSources,
  duration,
  type DemoKind,
  type Category,
  type Session,
} from "@/lib/research/types";
import { FoodDeliveryDemo } from "./FoodDeliveryDemo";
import weekender from "@/assets/weekender.jpg";
export function TestApp({ initialDemo }: { initialDemo?: DemoKind }) {
  const { productId } = useProduct();
  if (productId === "uber-eats") return <UberEatsSetup />;
  const demo = initialDemo ?? "checkout";
  return <CaptureApp key={demo} initialDemo={demo} />;
}
function CaptureApp({ initialDemo }: { initialDemo: DemoKind }) {
  const demo = initialDemo;
  const [attempt, setAttempt] = useState(0);
  const availableScenarios = demo === "delivery" ? deliveryScenarios : scenarios;
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<Category[]>(
    initialDemo === "delivery"
      ? ["dead_click", "missing_context", "text_clipping"]
      : ["long_loading"],
  );
  const [delay, setDelay] = useState(6);
  const [title, setTitle] = useState(
    initialDemo === "delivery" ? "Food delivery research session" : "Bag checkout research session",
  );
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState("");
  const [screen, setScreen] = useState(initialDemo === "delivery" ? "delivery_menu" : "browse");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [zip, setZip] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [unsaved, setUnsaved] = useState<Session>();
  const active = state === "recording";
  const locked = active || state === "requesting_permission" || state === "stopping" || savePending;
  const mounted = useRef(true);
  const controller = useRef<CaptureController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => {
    mounted.current = true;
    setSupported(captureSupport());
    controller.current = new CaptureController((s, e) => {
      if (!mounted.current) return;
      setState(s);
      if (e) setError(e);
    });
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
      controller.current?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setElapsed(controller.current?.elapsed() ?? 0), 200);
    return () => clearInterval(timer);
  }, [active]);
  const pointerCoordinates = (event: { clientX: number; clientY: number }) => {
    const rect = document.querySelector(".phone")!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };
  const log = (
    type: string,
    target_id?: string,
    metadata?: Record<string, string | number | boolean>,
    operation_id?: string,
  ) =>
    controller.current?.logger.log(type, screenRef.current, { target_id, metadata, operation_id });
  const go = (next: string) => {
    log("button_click", `go_${next}`);
    setScreen(next);
    screenRef.current = next;
    controller.current?.logger.log("screen_view", next);
  };
  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const first = demo === "delivery" ? "delivery_menu" : "browse";
    setScreen(first);
    screenRef.current = first;
    setAttempt((n) => n + 1);
    setLoading(false);
    setModal(false);
    setZip("");
    setElapsed(0);
  };
  useEffect(() => {
    if (!active) return;
    const phone = document.querySelector<HTMLElement>(".phone");
    const capture = controller.current;
    const stopWatching =
      phone && capture
        ? watchCaptureViewport(phone, capture, () =>
            capture.logger.log("capture_viewport_changed", screenRef.current),
          )
        : () => {};
    log("screen_view");
    if (enabled.includes("fighting_ui"))
      later(() => {
        setModal(true);
        log("modal_open", "promo");
      }, 1100);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      stopWatching();
      window.removeEventListener("beforeunload", beforeUnload);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [active, enabled]);
  const start = async () => {
    if (!consent || !controller.current) return;
    reset();
    setError("");
    await controller.current.start(
      title,
      enabled,
      delay * 1000,
      async (session) => {
        if (mounted.current) setSavePending(true);
        try {
          await saveSession(session);
          if (mounted.current) await navigate({ to: "/sessions/$id", params: { id: session.id } });
        } catch (e) {
          if (!mounted.current) return;
          setUnsaved(session);
          setError(e instanceof Error ? e.message : "Saving failed.");
          setState("error");
        } finally {
          if (mounted.current) setSavePending(false);
        }
      },
      { name: demoSources[demo], scenarios: availableScenarios },
    );
  };
  const details = () => {
    log("button_click", "view_item");
    if (!enabled.includes("long_loading")) {
      go("item_details");
      return;
    }
    setScreen("item_details");
    screenRef.current = "item_details";
    controller.current?.logger.log("screen_view", "item_details");
    setLoading(true);
    const op = crypto.randomUUID();
    log("application_request_start", "item_details", { source: "local_simulated_backend" }, op);
    log("spinner_shown", "item_details", undefined, op);
    later(() => {
      setLoading(false);
      log("application_request_end", "item_details", { source: "local_simulated_backend" }, op);
      log("spinner_hidden", "item_details", undefined, op);
    }, delay * 1000);
  };
  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    log("submit_attempt", "delivery_submit");
    if (enabled.includes("silent_form_rejection") && zip !== "94107") {
      log("validation_rejected", "postal_code", { field_id: "postal_code", valid: false });
      return;
    }
    log("validation_accepted", "delivery_submit", { valid: true });
    go("review_order");
  };
  const order = () => {
    if (loading) log("retry", "place_order");
    log("submit_attempt", "place_order");
    const op = crypto.randomUUID();
    log("application_request_start", "place_order", { source: "local_simulated_backend" }, op);
    setLoading(true);
    log("spinner_shown", "place_order", undefined, op);
    later(
      () => {
        if (enabled.includes("silent_failure"))
          log("application_timeout", "place_order", { source: "local_simulated_backend" }, op);
        else {
          log("application_request_end", "place_order", { source: "local_simulated_backend" }, op);
          log("spinner_hidden", "place_order", undefined, op);
          setLoading(false);
          go("confirmation");
        }
        // Only the planted "Request timeout" scenario stalls. A healthy order resolves quickly so
        // other scenarios don't carry an unplanned long-spinner signal into analysis.
      },
      enabled.includes("silent_failure") ? 4000 : 600,
    );
  };
  const dismiss = () => {
    log("modal_close_attempt", "promo_close", { hit: true });
    setModal(false);
    log("modal_closed", "promo");
    later(() => {
      setModal(true);
      log("modal_open", "promo");
    }, 800);
  };
  return (
    <Shell section="Test App" productSwitchDisabled={locked || !!unsaved}>
      <PageHeading
        title="Test App"
        description={`${demo === "delivery" ? "Delivery test" : "Bag Checkout App"} · Real interactions, synthetic data`}
      />
      <div className={`record-bar ${active ? "live" : ""}`}>
        <span className={active ? "record-dot" : "text-muted-foreground"}>
          <Circle size={12} fill={active ? "currentColor" : "none"} />
        </span>
        <span>
          {active
            ? "Recording this session"
            : state === "requesting_permission"
              ? "Waiting for screen-sharing permission…"
              : state === "stopping" || savePending
                ? "Saving your recording…"
                : "Ready for a new session"}
        </span>
        {active && (
          <>
            <span className="ml-auto font-mono">{duration(elapsed)}</span>
            <Button variant="destructive" size="sm" onClick={() => controller.current?.stop()}>
              <Square size={13} />
              Stop & save session
            </Button>
          </>
        )}
      </div>
      {error && (
        <div className="error-note mb-5" role="alert">
          {error}
        </div>
      )}
      {unsaved && (
        <Button
          onClick={() =>
            downloadFile(unsaved.video_blob, `recovered-${unsaved.id}.${unsaved.extension}`)
          }
        >
          Download unsaved recording
        </Button>
      )}
      <div className={`test-layout ${locked ? "capture-layout" : ""}`}>
        <section>
          <h2 className="text-base font-semibold">Choose scenarios</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Researcher setup · Hidden from AI analysis
          </p>
          {!active ? (
            <>
              <label className="field">
                Session title
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
              </label>
              {availableScenarios.map((s) => (
                <label className="scenario-option" key={s.id}>
                  <input
                    type="checkbox"
                    checked={enabled.includes(s.id)}
                    disabled={locked}
                    onChange={(e) =>
                      setEnabled((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }
                  />
                  <span>
                    {s.name}
                    <small>{s.detail}</small>
                  </span>
                </label>
              ))}
              {enabled.includes("long_loading") && (
                <label className="field">
                  Loading delay · {delay} seconds
                  <input
                    type="range"
                    min={2}
                    max={8}
                    value={delay}
                    disabled={locked}
                    onChange={(e) => setDelay(Number(e.target.value))}
                  />
                </label>
              )}
              <div className="info-note mt-5">
                <ShieldCheck />
                <span>Stays in this browser. Frames are sent only if you approve analysis.</span>
              </div>
              <label className="scenario-option border-0 mt-2">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={locked}
                />
                <span>I consent to recording this controlled test session.</span>
              </label>
              <Button
                className="w-full mt-3"
                disabled={!consent || locked || supported === false}
                onClick={start}
              >
                <Circle size={14} />
                Share this tab & start recording
              </Button>
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                Pick this tab in the share picker. Only that tab is captured.
              </p>
              {supported === false && (
                <div className="error-note mt-4">
                  Screen capture unavailable. Use desktop Chrome or Edge on HTTPS.
                </div>
              )}
            </>
          ) : (
            <div className="info-note mt-6">
              <Info />
              <span>Recording. Use the app naturally; scenarios stay hidden until you stop.</span>
            </div>
          )}
        </section>
        <section>
          <div
            className={`phone ${demo === "delivery" ? "delivery-phone" : ""}`}
            onPointerDown={(e) => {
              const target = e.target as HTMLElement;
              const id =
                target.closest("[data-target]")?.getAttribute("data-target") ||
                target.tagName.toLowerCase();
              controller.current?.logger.log("pointer_down", screenRef.current, {
                ...pointerCoordinates(e),
                target_id: id,
                metadata: {
                  hit: !!target.closest("button"),
                  coordinate_space: "checkout_normalized",
                },
              });
            }}
            onScroll={(e) =>
              log("scroll", "phone", { scroll_top: Math.round(e.currentTarget.scrollTop) })
            }
          >
            {demo === "delivery" ? (
              <FoodDeliveryDemo
                key={attempt}
                enabled={enabled}
                onScreen={(next) => {
                  screenRef.current = next;
                  setScreen(next);
                }}
                log={(type, target, metadata) => log(type, target, metadata)}
              />
            ) : (
              <>
                <div className="phone-status">
                  <span>9:41</span>
                  <span className="flex gap-1.5">
                    <Wifi size={11} />
                    <BatteryFull size={14} />
                  </span>
                </div>
                <div className="phone-nav">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Back"
                    onClick={() => {
                      log("backtrack", "back");
                      setLoading(false);
                      go(screen === "review_order" ? "delivery_form" : "browse");
                    }}
                  >
                    <ArrowLeft />
                  </Button>
                  <span className="shop-brand">
                    carry<span className="text-primary">.</span>
                  </span>
                  <ShoppingBag size={19} />
                </div>
                <div className="shop-content">
                  {loading && screen === "item_details" ? (
                    <div className="waiting">
                      <div className="spinner" />
                      <p>Getting the details…</p>
                    </div>
                  ) : screen === "browse" ? (
                    <>
                      <div className="eyebrow mb-3">Made for getting away</div>
                      <h2>A little less baggage.</h2>
                      <p>Thoughtful essentials for your next escape.</p>
                      <img
                        src={weekender}
                        alt="Sage canvas weekender bag"
                        className="product-photo"
                        width={1024}
                        height={768}
                      />
                      <div className="product-title">
                        <span>The Weekender</span>
                        <span>$68</span>
                      </div>
                      <p>Sage · Recycled canvas</p>
                      <Button className="shop-button" data-target="view_item" onClick={details}>
                        Explore the bag
                        <ArrowRight />
                      </Button>
                      <div className="shop-caption">Free delivery. More adventures.</div>
                    </>
                  ) : screen === "item_details" ? (
                    <>
                      <img
                        src={weekender}
                        alt="The Weekender in sage"
                        className="product-photo mt-0"
                        width={1024}
                        height={768}
                      />
                      <div className="product-title">
                        <span>The Weekender</span>
                        <span>$68</span>
                      </div>
                      <p>
                        Room for a weekend. Ready for anything.
                        <br />
                        Durable canvas · 32L · Sage
                      </p>
                      {enabled.includes("missed_button") ? (
                        <div
                          className="miss-region"
                          data-target="checkout_region"
                          onPointerDown={(e) => {
                            const hit = !!(e.target as HTMLElement).closest("button");
                            controller.current?.logger.log("tap", screenRef.current, {
                              target_id: "checkout_button",
                              ...pointerCoordinates(e),
                              metadata: { hit, coordinate_space: "checkout_normalized" },
                            });
                          }}
                        >
                          <Button
                            className="tiny-target"
                            data-target="checkout_button"
                            onClick={() => go("delivery_form")}
                          >
                            Checkout
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="shop-button"
                          data-target="checkout_button"
                          onClick={() => go("delivery_form")}
                        >
                          Continue to checkout
                          <ArrowRight />
                        </Button>
                      )}
                      <div className="shop-caption">Secure checkout · Synthetic demo</div>
                    </>
                  ) : screen === "delivery_form" ? (
                    <>
                      <div className="eyebrow mb-3">Checkout · 1 of 2</div>
                      <h2>Where to?</h2>
                      <p>Use made-up details for this demo.</p>
                      <form onSubmit={submitForm}>
                        <label className="field">
                          Contact name
                          <input
                            placeholder="Alex Example"
                            onFocus={() => log("input_focus", "contact_name")}
                            onChange={() => log("input_change", "contact_name", { changed: true })}
                          />
                        </label>
                        <label className="field">
                          Delivery address
                          <input
                            placeholder="123 Example Street"
                            onFocus={() => log("input_focus", "address")}
                            onChange={() => log("input_change", "address", { changed: true })}
                          />
                        </label>
                        <label className="field">
                          Postal code
                          <input
                            placeholder="e.g. 10001"
                            value={zip}
                            onFocus={() => log("input_focus", "postal_code")}
                            onChange={(e) => {
                              setZip(e.target.value);
                              log("input_change", "postal_code", { changed: true });
                            }}
                          />
                        </label>
                        <Button type="submit" className="shop-button" data-target="delivery_submit">
                          Review order
                          <ArrowRight />
                        </Button>
                      </form>
                    </>
                  ) : screen === "review_order" ? (
                    <>
                      <div className="eyebrow mb-3">Checkout · 2 of 2</div>
                      <h2>One last look.</h2>
                      <div className="flex items-center gap-3 my-6">
                        <img
                          src={weekender}
                          alt="Weekender bag"
                          className="w-20 rounded"
                          width={1024}
                          height={768}
                        />
                        <div className="text-xs">
                          <strong>The Weekender</strong>
                          <p>Sage · Quantity 1</p>
                        </div>
                      </div>
                      <div className="text-xs space-y-4 border-y py-5">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>$68.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Delivery</span>
                          <span className="text-success">Free</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>$68.00</span>
                        </div>
                      </div>
                      {loading && (
                        <div className="text-center">
                          <div className="spinner" />
                          <p>Placing your order…</p>
                        </div>
                      )}
                      <Button className="shop-button" data-target="place_order" onClick={order}>
                        {loading ? "Try again" : "Place demo order"}
                        <Package />
                      </Button>
                      <div className="shop-caption">No payment will be taken.</div>
                    </>
                  ) : (
                    <div className="waiting">
                      <Check className="mx-auto text-success mb-5" size={40} />
                      <h2>You’re all set.</h2>
                      <p>Your synthetic order is complete.</p>
                      <Button className="shop-button" onClick={() => go("browse")}>
                        Back to browsing
                      </Button>
                    </div>
                  )}
                </div>
                {modal && (
                  <div className="promo-overlay">
                    <div
                      className="promo"
                      onPointerDown={(e) => {
                        if (!(e.target as HTMLElement).closest("button"))
                          controller.current?.logger.log("modal_close_attempt", screenRef.current, {
                            target_id: "promo_close",
                            ...pointerCoordinates(e),
                            metadata: { hit: false, coordinate_space: "checkout_normalized" },
                          });
                      }}
                    >
                      <Button
                        className="close-promo"
                        variant="ghost"
                        aria-label="Dismiss promotion"
                        onClick={dismiss}
                      >
                        <X size={10} />
                      </Button>
                      <Sparkles className="mx-auto text-primary" />
                      <h3>A little welcome gift.</h3>
                      <p>Take 10% off your next adventure.</p>
                      <Button variant="outline" className="shop-button" onClick={dismiss}>
                        Maybe later
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-4 leading-relaxed">
            Controlled demo app · Synthetic information only
            <br />
            Real recording and real interaction logs
          </p>
        </section>
      </div>
    </Shell>
  );
}
