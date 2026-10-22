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
      className={`border border-line bg-panel rounded-[2px] overflow-x-auto select-text ${className}`}
    >
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-panel-2 border-b border-line text-[11px] font-semibold text-text-2 uppercase select-none">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="h-7 min-h-[28px]">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isSorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={`px-2.5 py-1 border-r border-line last:border-r-0 font-medium ${
                      canSort ? 'cursor-pointer hover:bg-panel' : ''
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
                        <span className="text-text-3">
                          {isSorted === 'asc' ? (
                            <ChevronUp className="w-3 h-3 text-accent" />
                          ) : isSorted === 'desc' ? (
                            <ChevronDown className="w-3 h-3 text-accent" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-30" />
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
        <tbody className="divide-y divide-line">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="h-14 text-center text-text-3 font-mono text-xs"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => {
              const isSelected =
                selectedRowId !== undefined &&
                selectedRowId !== null &&
                row.id === String(selectedRowId);

              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick && onRowClick(row.original)}
                  className={`h-7 min-h-[28px] transition-colors ${
                    isSelected
                      ? 'bg-accent/10 border-l-2 border-l-accent'
                      : onRowClick
                      ? 'cursor-pointer hover:bg-panel-2'
                      : 'hover:bg-panel-2/40'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-2.5 py-1 border-r border-line last:border-r-0 truncate text-text"
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
  );
}
