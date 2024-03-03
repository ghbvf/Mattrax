import { As } from "@kobalte/core";
import { createColumnHelper } from "@tanstack/solid-table";
import { ParentProps, Suspense, createSignal } from "solid-js";

import {
  ColumnsDropdown,
  StandardTable,
  createStandardTable,
  selectCheckboxColumn,
} from "~/components/StandardTable";

const column = createColumnHelper<{ id: string; name: string }>();

export const columns = [
  selectCheckboxColumn,
  column.accessor("name", {
    header: "Name",
    cell: (props) => (
      <A
        class="font-medium hover:underline focus:underline p-1 -m-1 w-full block"
        href={props.row.original.id}
      >
        {props.getValue()}
      </A>
    ),
  }),
  // TODO: Descriptions, supported OS's.
];

function createApplicationsTable() {
  // const groups = trpc.policy.list.useQuery();

  const table = createStandardTable({
    get data() {
      return []; // TODO
      // return groups.data || [];
    },
    columns,
  });

  return { table };
}

export default function Page() {
  const { table } = createApplicationsTable();

  const isLoading = untrackScopeFromSuspense(() => false);

  if (!isDebugMode()) {
    return (
      <div class="px-4 py-8 w-full max-w-5xl mx-auto gap-4 flex flex-col">
        <div class="flex flex-row justify-between">
          <h1 class="text-3xl font-bold mb-4">Applications</h1>
        </div>
        <h1 class="text-muted-foreground opacity-70">Coming soon...</h1>
      </div>
    );
  }

  return (
    <div class="px-4 py-8 w-full max-w-5xl mx-auto gap-4 flex flex-col">
      <div class="flex flex-row justify-between">
        <h1 class="text-3xl font-bold mb-4">Applications</h1>
        <CreatePolicyDialog>
          <As component={Button}>Create Application</As>
        </CreatePolicyDialog>
      </div>
      <div class="flex flex-row items-center gap-4">
        <Input
          placeholder={isLoading() ? "Loading..." : "Search..."}
          disabled={isLoading()}
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onInput={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
        />
        <ColumnsDropdown table={table}>
          <As component={Button} variant="outline" class="ml-auto select-none">
            Columns
            <IconCarbonCaretDown class="ml-2 h-4 w-4" />
          </As>
        </ColumnsDropdown>
      </div>
      <Suspense>
        <StandardTable table={table} />
        <div class="flex items-center justify-end space-x-2">
          <div class="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div class="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </Suspense>
      <AppleAppStoreDemo />
    </div>
  );
}

import { A, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import { Button, Checkbox, Input } from "~/components/ui";

import {
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui";
import { isDebugMode, untrackScopeFromSuspense } from "~/lib";

function CreatePolicyDialog(props: ParentProps) {
  const navigate = useNavigate();
  // const mutation = trpc.app.create.useMutation(() => ({
  //   onSuccess: async (id) => {
  //     await startTransition(() => navigate(`./${id}`));
  //   },
  // }));

  return (
    <DialogRoot>
      <DialogTrigger asChild>{props.children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Application</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            // mutation.mutate({
            //   name: formData.get("name") as any,
            // });
          }}
        >
          <fieldset
            class="flex flex-col space-y-4"
            // disabled={mutation.isPending}
          >
            <Input
              type="text"
              name="name"
              placeholder="New Application"
              autocomplete="off"
            />
            <Button type="submit" disabled>
              Create
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

function AppleAppStoreDemo() {
  const [search, setSearch] = createSignal();

  // TODO: Debounce on input + cancel previous request

  // TODO: Typescript types
  // TODO: Move to Tanstack Query
  const searchQuery = createQuery(() => ({
    queryKey: ["appStoreSearch", search()],
    queryFn: async () => {
      // TODO: Pagination support
      const res = await fetch(
        `https://itunes.apple.com/search?term=${search()}&entity=software`,
      );
      return await res.json();
    },
  }));

  return (
    <>
      <input
        type="text"
        class="border border-gray-300 rounded-md p-2"
        placeholder="Search"
        onInput={(e) => setSearch(e.currentTarget.value)}
      />
      <div class="grid grid-cols-3 gap-4">
        {/* TODO: Empty and error states */}
        <Suspense fallback={<div>Loading...</div>}>
          {searchQuery.data?.results.map((app: any) => (
            <div class="flex flex-col">
              <img alt="App Artwork" src={app.artworkUrl100} />
              <div class="text-sm">{app.trackName}</div>
              <div class="text-xs">{app.sellerName}</div>
            </div>
          ))}
        </Suspense>
      </div>
    </>
  );
}
