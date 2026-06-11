import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  label: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function CustomSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = '',
  className,
}: CustomSelectProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const listboxId = `${id}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const isDisabled = disabled || options.length === 0;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const optionId = (index: number) => `${id}-option-${index}`;

  const openList = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (isDisabled) return;
    setActiveIndex(index);
    setOpen(true);
  };

  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selectActiveOption = () => {
    const option = options[activeIndex];
    if (!option) return;
    onChange(option.value);
    closeAndRestoreFocus();
  };

  useEffect(() => {
    if (open) listboxRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextSelectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : 0);
    if (options.length === 0) setOpen(false);
  }, [options, value]);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [open]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Home') {
      event.preventDefault();
      openList(event.key === 'Home' ? 0 : undefined);
    } else if (event.key === 'ArrowUp' || event.key === 'End') {
      event.preventDefault();
      openList(options.length - 1);
    }
  };

  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectActiveOption();
        break;
      case 'Escape':
        event.preventDefault();
        closeAndRestoreFocus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={`custom-select${className ? ` ${className}` : ''}`}>
      <span id={labelId} className="custom-select__label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="custom-select__trigger"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={isDisabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="custom-select__value">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className="custom-select__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={listboxRef}
          id={listboxId}
          className="custom-select__listbox"
          role="listbox"
          aria-labelledby={labelId}
          aria-activedescendant={optionId(activeIndex)}
          tabIndex={-1}
          onKeyDown={handleListboxKeyDown}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <div
                id={optionId(index)}
                key={option.value}
                className={`custom-select__option${active ? ' custom-select__option--active' : ''}${selected ? ' custom-select__option--selected' : ''}`}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(option.value);
                  closeAndRestoreFocus();
                }}
              >
                <span className="custom-select__option-label">{option.label}</span>
                {selected ? <Check className="custom-select__check" aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
