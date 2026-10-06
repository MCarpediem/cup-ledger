import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { categories } from './catalog';
import { Badge } from './components';
import { categoryIds, type Category } from './model';
import styles from './App.module.css';

export function CategoryPicker({ value, onChange, disabled = false }: {
  value: Category;
  onChange: (value: Category) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();

  return <div className={styles.filterField}>
    <span>类别</span>
    <button ref={trigger} type="button" disabled={disabled} className={styles.categoryTrigger} aria-label={`饮品类别：${categories[value].name}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      <span>{categories[value].name}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    <dialog ref={dialog} id={id} className={styles.categoryDialog} aria-labelledby={`${id}-title`} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <div className={styles.sheetHandle} aria-hidden="true" />
      <header className={styles.categoryDialogHeader}><h2 id={`${id}-title`}>选择饮品类别</h2><button type="button" className={styles.iconButton} aria-label="关闭类别选择" onClick={close}><X size={21} /></button></header>
      <div className={styles.categoryOptions} role="group" aria-label="饮品类别选项">
        {categoryIds.map(category => <button type="button" key={category} className={styles.categoryOption} aria-label={categories[category].name} aria-pressed={value === category} onClick={() => { onChange(category); close(); }}>
          <Badge category={category} /><span><strong>{categories[category].name}</strong></span>{value === category && <Check className={styles.categoryCheck} size={18} aria-hidden="true" />}
        </button>)}
      </div>
    </dialog>
  </div>;
}
