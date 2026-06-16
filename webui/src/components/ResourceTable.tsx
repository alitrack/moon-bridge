import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";

export type ResourceColumn<T> = {
  header: string;
  accessor: (row: T) => ReactNode;
};

type ResourceTableProps<T> = {
  columns: ResourceColumn<T>[];
  data: T[];
  emptyLabel?: string;
};

export function ResourceTable<T>({
  columns,
  data,
  emptyLabel
}: ResourceTableProps<T>) {
  const { t } = useI18n();
  const columnHelper = createColumnHelper<T>();
  const table = useReactTable({
    data,
    columns: columns.map((column, index) =>
      columnHelper.display({
        id: `${index}-${column.header}`,
        header: column.header,
        cell: (context) => column.accessor(context.row.original)
      })
    ) as ColumnDef<T>[],
    getCoreRowModel: getCoreRowModel()
  });

  if (data.length === 0) {
    return <p className="empty-state">{emptyLabel ?? t("empty.resources")}</p>;
  }

  return (
    <div className="table-scroll">
      <table className="resource-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} scope="col">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
