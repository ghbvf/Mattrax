import {
  ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  PartialKeys,
  RowData,
  TableOptions,
  type Table as TTable,
} from "@tanstack/solid-table";
import { For, mergeProps, ParentProps } from "solid-js";
import clsx from "clsx";

export function createStandardTable<TData extends RowData>(
  options: PartialKeys<TableOptions<TData>, "getCoreRowModel">
) {
  return createSolidTable(
    mergeProps(
      {
        getCoreRowModel: getCoreRowModel(),
        defaultColumn: mergeProps(
          { size: "auto" as unknown as number },
          options.defaultColumn
        ),
      },
      options
    )
  );
}

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Checkbox,
} from "./ui";

export function StandardTable<TData>(props: {
  table: TTable<TData>;
  class?: string;
}) {
  const numCols = () =>
    props.table
      .getHeaderGroups()
      .map((c) => c.headers.length)
      .reduce((a, b) => a + b);

  return (
    <div class={clsx("rounded-md border", props.class)}>
      <Table>
        <TableHeader>
          <For each={props.table.getHeaderGroups()}>
            {(headerGroup) => (
              <TableRow>
                {headerGroup.headers.map((header) => (
                  <TableHead style={{ width: `${header.getSize()}px` }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            )}
          </For>
        </TableHeader>
        <TableBody>
          {props.table.getRowModel().rows.length ? (
            <For each={props.table.getRowModel().rows}>
              {(row) => (
                <TableRow data-state={row.getIsSelected() && "selected"}>
                  <For each={row.getVisibleCells()}>
                    {(cell) => (
                      <TableCell>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )}
                  </For>
                </TableRow>
              )}
            </For>
          ) : (
            <TableRow>
              <TableCell colSpan={numCols()} class="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui";

export function ColumnsDropdown<TData>(
  props: ParentProps & { table: TTable<TData> }
) {
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenuTrigger asChild>{props.children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <For
          each={props.table
            .getAllColumns()
            .filter((column) => column.getCanHide())}
        >
          {(column) => (
            <DropdownMenuCheckboxItem
              class="capitalize"
              checked={column.getIsVisible()}
              onChange={(value) => column.toggleVisibility(!!value)}
            >
              {column.id.split(/(?=[A-Z])/).join(" ")}
            </DropdownMenuCheckboxItem>
          )}
        </For>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const selectCheckboxColumn = {
  id: "select",
  header: ({ table }) => (
    <Checkbox
      class="w-4"
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected()}
      onChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      class="w-4"
      checked={row.getIsSelected()}
      onChange={(value) => row.toggleSelected(!!value)}
      aria-label="Select row"
    />
  ),
  size: 1,
  enableSorting: false,
  enableHiding: false,
} satisfies ColumnDef<any>;
