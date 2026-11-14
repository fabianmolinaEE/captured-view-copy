import { ArrowUpRight, Check, ShoppingBag, Utensils } from "lucide-react";
import { products, type ProductId } from "@/lib/research/products";

export function ProductPicker({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: ProductId | null;
  onSelect: (id: ProductId) => void;
  disabled?: boolean;
}) {
  return (
    <section
      className={`product-picker ${selected ? "has-product" : ""}`}
      aria-label="Choose product"
    >
      <div className="product-picker-intro">
        <span className="section-kicker">Your products</span>
        {!selected && (
          <>
            <h1>Which product are we improving?</h1>
            <p>Pick one to see its insights and recordings.</p>
          </>
        )}
      </div>
      <div className="product-options">
        {products.map((product) => {
          const Icon = product.id === "checkout" ? ShoppingBag : Utensils;
          return (
            <button
              type="button"
              key={product.id}
              className={`product-option product-${product.id}`}
              aria-label={product.name}
              aria-pressed={selected === product.id}
              disabled={disabled}
              onClick={() => onSelect(product.id)}
            >
              <span className="product-option-icon">
                <Icon size={22} />
              </span>
              <span className="product-option-copy">
                <strong>{product.name}</strong>
                <small>{product.description}</small>
              </span>
              <span className="product-option-arrow">
                {selected === product.id ? <Check size={18} /> : <ArrowUpRight size={19} />}
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="product-scope-note">
          Showing {products.find((product) => product.id === selected)?.name}
        </p>
      )}
    </section>
  );
}
