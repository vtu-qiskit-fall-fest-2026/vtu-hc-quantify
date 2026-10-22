import { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  className?: string;
  emptyText?: string;
  onRowClick?: (row: TData) => void;
  selectedRowId?: string | number | null;
  getRowId?: (row: TData) => string;
}

export function DataTable<TData>({
  data,
  columns,
  className = '',
  emptyText = 'No records found',
  onRowClick,
  selectedRowId,
  getRowId,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowId,
  });

  return (
    <div
      className={`border border-line/80 bg-tile rounded-inner overflow-hidden select-text ${className}`}
    >
      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-tileMint/80 sticky top-0 z-10 border-b border-line text-[11px] font-semibold text-ink font-ui uppercase tracking-wide select-none">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="h-9 min-h-[36px]">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 border-r border-line/40 last:border-r-0 font-medium ${
                        canSort ? 'cursor-pointer hover:bg-tileMint transition-colors' : ''
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1.5 justify-between">
                        <div className="truncate">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </div>
                        {canSort && (
                          <span className="text-ink3 flex-shrink-0">
                            {isSorted === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-green" />
                            ) : isSorted === 'desc' ? (
                              <ChevronDown className="w-3.5 h-3.5 text-green" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line/40">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-16 text-center text-ink3 font-mono text-xs"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => {
                const isSelected =
                  selectedRowId !== undefined &&
                  selectedRowId !== null &&
                  row.id === String(selectedRowId);

                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={`h-9 min-h-[36px] transition-colors ${
                      isSelected
                        ? 'bg-greenSoft/80 font-medium text-ink'
                        : idx % 2 === 1
                        ? 'bg-tileMint/20 hover:bg-greenSoft/40'
                        : 'bg-tile hover:bg-greenSoft/30'
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-1.5 border-r border-line/30 last:border-r-0 truncate text-ink"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
