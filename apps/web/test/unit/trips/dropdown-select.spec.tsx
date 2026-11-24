import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DropdownSelect } from '../../../src/features/trips/components/trip-list';

const options = [
  { value: 'departure', label: 'Giờ đi sớm nhất' },
  { value: 'price', label: 'Giá thấp nhất' },
  { value: 'departure-desc', label: 'Giờ đi trễ nhất' },
];

afterEach(() => cleanup());

describe('DropdownSelect keyboard controls', () => {
  it('moves through options and selects the focused option', () => {
    const onChange = vi.fn();
    render(
      <DropdownSelect
        value="price"
        options={options}
        onChange={onChange}
        ariaLabel="Sắp xếp theo"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Sắp xếp theo' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const optionElements = screen.getAllByRole('option');
    expect(document.activeElement).toBe(optionElements[1]);

    fireEvent.keyDown(optionElements[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(optionElements[2]);

    fireEvent.keyDown(optionElements[2], { key: 'Home' });
    expect(document.activeElement).toBe(optionElements[0]);

    fireEvent.keyDown(optionElements[0], { key: 'End' });
    expect(document.activeElement).toBe(optionElements[2]);

    fireEvent.keyDown(optionElements[2], { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('departure-desc');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape and restores focus to the trigger', () => {
    render(
      <DropdownSelect
        value="departure"
        options={options}
        onChange={vi.fn()}
        ariaLabel="Sắp xếp theo"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Sắp xếp theo' });
    fireEvent.keyDown(trigger, { key: 'End' });
    expect(document.activeElement).toBe(screen.getAllByRole('option')[2]);

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
