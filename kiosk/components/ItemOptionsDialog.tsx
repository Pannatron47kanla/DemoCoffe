import { useState } from 'react';
import type { MenuItem } from '../lib/types';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

export type AddInput = { menuItemId: string; optionChoiceIds: string[]; quantity: number };

export function ItemOptionsDialog({ item, onAdd, onClose }: { item: MenuItem; onAdd: (input: AddInput) => void; onClose: () => void }) {
  // หนึ่งกลุ่มเลือกได้ไม่เกินหนึ่งตัวเลือก: groupId -> choiceId
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [missing, setMissing] = useState<string | null>(null);

  function toggle(groupId: string, choiceId: string, required: boolean) {
    setPicked((current) => {
      const next = { ...current };
      if (current[groupId] === choiceId && !required) delete next[groupId];
      else next[groupId] = choiceId;
      return next;
    });
  }

  function submit() {
    const unpicked = item.optionGroups.find((g) => g.required && !picked[g.id]);
    if (unpicked) {
      setMissing(unpicked.name);
      return;
    }
    const optionChoiceIds = item.optionGroups.flatMap((g) => (picked[g.id] ? [picked[g.id] as string] : []));
    onAdd({ menuItemId: item.id, optionChoiceIds, quantity });
  }

  return (
    <div className="dialog">
      <div role="dialog" aria-label={item.name}>
        <h2>{item.name}</h2>
        {item.optionGroups.map((group) => (
          <fieldset key={group.id}>
            <legend>{group.name}</legend>
            <div className="choices">
              {group.choices.map((choice) => (
                <button key={choice.id} type="button" aria-pressed={picked[group.id] === choice.id} onClick={() => toggle(group.id, choice.id, group.required)}>
                  {choice.name}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {missing ? <p className="error" role="alert">กรุณาเลือก{missing}</p> : null}
        <div className="qty-controls">
          <button type="button" aria-label="−" disabled={quantity <= MIN_QUANTITY} onClick={() => setQuantity(quantity - 1)}>−</button>
          <span>{quantity}</span>
          <button type="button" aria-label="+" disabled={quantity >= MAX_QUANTITY} onClick={() => setQuantity(quantity + 1)}>+</button>
        </div>
        <button type="button" className="primary" onClick={submit}>ใส่ตะกร้า</button>
        <button type="button" onClick={onClose}>ยกเลิก</button>
      </div>
    </div>
  );
}
