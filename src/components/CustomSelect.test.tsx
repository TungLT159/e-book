import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomSelect, type CustomSelectOption } from './CustomSelect';

const options: CustomSelectOption[] = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
  { value: 'three', label: 'Three' },
];

function renderSelect(overrides: Partial<React.ComponentProps<typeof CustomSelect>> = {}) {
  const onChange = vi.fn();
  render(
    <CustomSelect
      label="Narrator"
      value="two"
      options={options}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe('CustomSelect', () => {
  it('renders a labelled trigger with the controlled selection and popup ARIA', async () => {
    const user = userEvent.setup();
    renderSelect({ className: 'extra' });
    const trigger = screen.getByRole('button', { name: 'Narrator' });

    expect(trigger).toHaveTextContent('Two');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger.closest('.custom-select')).toHaveClass('extra');

    await user.click(trigger);
    const listbox = screen.getByRole('listbox', { name: 'Narrator' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    expect(listbox).toHaveFocus();
    expect(listbox).toHaveAttribute('aria-activedescendant', within(listbox).getByRole('option', { name: 'Two' }).id);
    expect(within(listbox).getByRole('option', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
  });

  it('selects by pointer, closes, and restores trigger focus', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();
    const trigger = screen.getByRole('button', { name: 'Narrator' });
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Three' }));

    expect(onChange).toHaveBeenCalledWith('three');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('supports opening and wrapped keyboard navigation from the trigger', async () => {
    const user = userEvent.setup();
    renderSelect();
    const trigger = screen.getByRole('button', { name: 'Narrator' });
    trigger.focus();

    await user.keyboard('{ArrowUp}');
    let listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Three' }).id);
    await user.keyboard('{ArrowDown}');
    expect(listbox).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'One' }).id);
    await user.keyboard('{End}');
    expect(listbox).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Three' }).id);
    await user.keyboard('{Home}');
    expect(listbox).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'One' }).id);
  });

  it('selects with Space and closes with Escape or Tab using the required focus behavior', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();
    const trigger = screen.getByRole('button', { name: 'Narrator' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('two');
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).not.toHaveFocus();
  });

  it('closes on an outside pointer without changing the value or restoring focus', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();
    const trigger = screen.getByRole('button', { name: 'Narrator' });
    await user.click(trigger);
    await user.click(document.body);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).not.toHaveFocus();
  });

  it('disables the trigger when disabled or empty', () => {
    const { rerender } = render(
      <CustomSelect label="Narrator" value="" options={options} onChange={vi.fn()} disabled />,
    );
    expect(screen.getByRole('button', { name: 'Narrator' })).toBeDisabled();
    rerender(<CustomSelect label="Narrator" value="" options={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Narrator' })).toBeDisabled();
  });

  it('shows a placeholder for an unknown value without changing it', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect({ value: 'missing', placeholder: 'Choose one' });
    const trigger = screen.getByRole('button', { name: 'Narrator' });
    expect(trigger).toHaveTextContent('Choose one');
    expect(onChange).not.toHaveBeenCalled();
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'One' }).id);
  });

  it('recalculates the active option when options and value update while open', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CustomSelect label="Narrator" value="two" options={options} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Narrator' }));
    rerender(
      <CustomSelect
        label="Narrator"
        value="four"
        options={[{ value: 'four', label: 'Four' }, { value: 'five', label: 'Five' }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Four' }).id);

    rerender(
      <CustomSelect label="Narrator" value="missing" options={[{ value: 'five', label: 'Five' }]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Five' }).id);
  });

});
