import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import { describe, expect, it, vi } from 'vitest';
import { VehicleTypeFormDialog } from '../src/features/vehicle-types/components/vehicle-type-form-dialog';
import { VehicleTypesManagement } from '../src/features/vehicle-types/components/vehicle-types-management';
import { VehicleSeatsManagement } from '../src/features/vehicles/components/vehicle-seats-management';

vi.mock('lucide-react', () => {
  const Icon = () => null;
  return {
    ArrowDown: Icon,
    ArrowUp: Icon,
    ArrowUpDown: Icon,
    CalendarDays: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    ChevronDown: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Eye: Icon,
    LoaderCircle: Icon,
    Pencil: Icon,
    Plus: Icon,
    RefreshCw: Icon,
    Search: Icon,
    X: Icon,
  };
});

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock('@/features/vehicle-types/hooks/use-vehicle-types', () => ({
  useVehicleTypes: () => ({
    vehicleTypePage: {
      data: [
        {
          vehicleTypeId: 7,
          name: 'Limousine',
          description: 'Xe limousine',
          createdAt: '2026-09-25T10:00:00.000Z',
          updatedAt: '2026-09-26T10:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    },
    error: null,
    loading: false,
    page: 1,
    searchInput: '',
    sortBy: 'updatedAt',
    sortDirection: 'asc',
    changePage: vi.fn(),
    refresh: vi.fn(),
    retry: vi.fn(),
    sortVehicleTypes: vi.fn(),
    updateSearch: vi.fn(),
  }),
}));

vi.mock('@/components/data-filters/data-filters', () => ({
  FilterToolbar: () => null,
  SearchInput: () => null,
}));

describe('Feature 02 Admin UI regressions', () => {
  it('renders the vehicle type form close action through the shared Button', () => {
    const markup = renderToStaticMarkup(
      <VehicleTypeFormDialog onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(markup).toContain('class="button button-secondary icon-button"');
    expect(markup).toContain('aria-label="Đóng biểu mẫu thêm loại xe"');
  });

  it('exposes updatedAt sorting and reports its active direction accessibly', () => {
    const markup = renderToStaticMarkup(<VehicleTypesManagement />);

    expect(markup).toContain(
      'aria-label="Sắp xếp theo Cập nhật lần cuối, tăng dần"',
    );
    expect(markup).toContain('aria-sort="ascending"');
    expect(markup).toContain('Cập nhật lần cuối');
  });

  it('renders a single main landmark on the seat configuration route', () => {
    const markup = renderToStaticMarkup(
      <VehicleSeatsManagement vehicleId={12} />,
    );

    expect(markup.match(/<main\b/g)).toHaveLength(1);
  });

  it('uses a defined shared typography token for the vehicle detail heading', () => {
    const vehicleStyles = postcss.parse(
      readFileSync(
        fileURLToPath(new URL('../src/features/vehicles/vehicles.css', import.meta.url)),
        'utf8',
      ),
    );
    const tokenStyles = postcss.parse(
      readFileSync(
        fileURLToPath(new URL('../src/styles/admin-tokens.css', import.meta.url)),
        'utf8',
      ),
    );
    let fontSizeToken: string | undefined;

    vehicleStyles.walkRules('.vehicle-detail-hero h3', (rule) => {
      rule.walkDecls('font-size', (declaration) => {
        fontSizeToken = declaration.value.match(/var\((--[\w-]+)/)?.[1];
      });
    });

    expect(fontSizeToken).toBeDefined();
    let tokenDefined = false;
    tokenStyles.walkDecls(fontSizeToken ?? '', () => {
      tokenDefined = true;
    });
    expect(tokenDefined).toBe(true);
  });
});
