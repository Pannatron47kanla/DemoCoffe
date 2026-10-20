import type { MenuItem } from '../lib/types';

export function MenuGrid({ items, onSelect }: { items: MenuItem[]; onSelect: (item: MenuItem) => void }) {
  return (
    <div className="menu-grid">
      {items.map((item) => (
        <button key={item.id} type="button" className="menu-item" disabled={!item.available} onClick={() => onSelect(item)}>
          <span className="name">{item.name}</span>
          <span className="price">{item.basePrice.amount}</span>
          {item.available ? null : <span className="sold-out">หมด</span>}
        </button>
      ))}
    </div>
  );
}
