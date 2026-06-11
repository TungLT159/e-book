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
  const valueId = `${id}-value`;
  const listboxId = `${id}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeState, setActiveState] = useState({
    value: options.find((option) => option.value === value)?.value ?? options[0]?.value,
    options,
    controlledValue: value,
  });
  const isDisabled = disabled || options.length === 0;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const inputsChanged = activeState.options !== options || activeState.controlledValue !== value;
  const preferredActiveValue = inputsChanged
    ? (selectedOption?.value ?? options[0]?.value)
    : activeState.value;
  const effectiveActiveIndex = Math.max(
    options.findIndex((option) => option.value === preferredActiveValue),
    0,
  );
  const isOpen = open && !isDisabled;

  const optionId = (index: number) => `${id}-option-${index}`;

  const openList = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (isDisabled) return;
    setActiveState({ value: options[index]?.value, options, controlledValue: value });
    setOpen(true);
  };

  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const interactionIsDisabled = (target: HTMLElement) =>
    target.closest('.custom-select')?.querySelector<HTMLButtonElement>('.custom-select__trigger')?.disabled ?? true;

  const selectActiveOption = (target: HTMLElement) => {
    if (interactionIsDisabled(target)) return;
    const option = options[effectiveActiveIndex];
    if (!option) return;
    onChange(option.value);
    closeAndRestoreFocus();
  };

  useEffect(() => {
    if (isOpen) listboxRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!open || isDisabled) return;
    setActiveState({
      value: selectedOption?.value ?? options[0]?.value,
      options,
      controlledValue: value,
    });
  }, [options, value]);

  useEffect(() => {
    if (open && isDisabled) setOpen(false);
  }, [isDisabled, open]);

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
    if (interactionIsDisabled(event.currentTarget)) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveState({
          value: options[(effectiveActiveIndex + 1) % options.length].value,
          options,
          controlledValue: value,
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveState({
          value: options[(effectiveActiveIndex - 1 + options.length) % options.length].value,
          options,
          controlledValue: value,
        });
        break;
      case 'Home':
        event.preventDefault();
        setActiveState({ value: options[0].value, options, controlledValue: value });
        break;
      case 'End':
        event.preventDefault();
        setActiveState({ value: options[options.length - 1].value, options, controlledValue: value });
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectActiveOption(event.currentTarget);
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
        aria-labelledby={`${labelId} ${valueId}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={isDisabled}
        onClick={() => (isOpen ? setOpen(false) : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span id={valueId} className="custom-select__value">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className="custom-select__chevron" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          ref={listboxRef}
          id={listboxId}
          className="custom-select__listbox"
          role="listbox"
          aria-labelledby={labelId}
          aria-activedescendant={optionId(effectiveActiveIndex)}
          tabIndex={-1}
          onKeyDown={handleListboxKeyDown}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === effectiveActiveIndex;
            return (
              <div
                id={optionId(index)}
                key={option.value}
                className={`custom-select__option${active ? ' custom-select__option--active' : ''}${selected ? ' custom-select__option--selected' : ''}`}
                role="option"
                aria-selected={selected}
                onPointerMove={(event) => {
                  if (!interactionIsDisabled(event.currentTarget)) {
                    setActiveState({ value: option.value, options, controlledValue: value });
                  }
                }}
                onClick={(event) => {
                  if (interactionIsDisabled(event.currentTarget)) return;
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
